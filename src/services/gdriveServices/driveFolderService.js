import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { driveFolderRedis } from '../../utils/redis/driveFolderRedis.js';
import { driveFolderValidator } from './driveFolderValidator.js';
import logger from '../../utils/common/logger.js';
import activeDriveAccountManager from '../../utils/gdrive/activeDriveAccountManager.js';
import config from '../../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DriveFolderService {
    constructor() {
        this.foldersPath = path.join(__dirname, '../../data/static/drive-folders.json');
        this.MAX_FOLDER_HISTORY = 10;
        this.FOLDER_EXPIRY_DAYS = 30;
    }

    async backupToJson() {
        try {
            const allData = { folders: {} };
            const redisManager = (await import('../../utils/redis/index.js')).redisManager;
            
            const allGdriveAccounts = config.apis.googleDriveAccounts;
            for (const gdriveAccount of allGdriveAccounts) {
                const accountName = gdriveAccount.accountName;
                const keys = await redisManager.client.keys(`drive:folders:*:${accountName}`);
                
                for (const key of keys) {
                    const userId = key.split(':')[2];
                    const userData = await driveFolderRedis.getFolders(userId, accountName);
                    if (userData.recentFolders.length > 0) {
                        if (!allData.folders[userId]) allData.folders[userId] = {};
                        allData.folders[userId][accountName] = userData;
                    }
                }
            }

            await fs.writeFile(this.foldersPath, JSON.stringify(allData, null, 2));
            logger.info('Drive folders backed up to JSON');
        } catch (error) {
            logger.error('Error backing up drive folders:', error);
        }
    }

    async saveFolders(userId, gdriveAccountName, folders) {
        await driveFolderRedis.saveFolders(userId, gdriveAccountName, folders);
        driveFolderRedis.scheduleBackup(() => this.backupToJson());
    }

    async addFolder(userId, folderData) {
        const activeAccount = await activeDriveAccountManager.getActiveAccount();
        if (!activeAccount) throw new Error('No active Google Drive account configured.');
        const gdriveAccountName = activeAccount.accountName;

        const data = await driveFolderRedis.getFolders(userId, gdriveAccountName);
        
        data.recentFolders = data.recentFolders
            .filter(f => f.folderId !== folderData.folderId);

        data.recentFolders.unshift({
            folderId: folderData.folderId,
            folderName: folderData.folderName,
            createdAt: folderData.createdAt || new Date().toISOString(),
            lastAccessed: new Date().toISOString()
        });

        data.recentFolders = data.recentFolders
            .slice(0, this.MAX_FOLDER_HISTORY);

        await this.saveFolders(userId, gdriveAccountName, data);
    }

    async getFolders(userId) {
        const activeAccount = await activeDriveAccountManager.getActiveAccount();
        if (!activeAccount) return [];
        const gdriveAccountName = activeAccount.accountName;

        const data = await driveFolderRedis.getFolders(userId, gdriveAccountName);
        const now = new Date();
        
        let folders = data.recentFolders.filter(folder => {
            const lastAccessed = new Date(folder.lastAccessed);
            const daysDiff = (now - lastAccessed) / (1000 * 60 * 60 * 24);
            return daysDiff <= this.FOLDER_EXPIRY_DAYS;
        });
        
        folders = await driveFolderValidator.validateFolders(folders);

        if (folders.length !== data.recentFolders.length) {
            await this.saveFolders(userId, gdriveAccountName, { recentFolders: folders });
        }

        return folders;
    }

    async getFolder(userId, folderName) {
        const activeAccount = await activeDriveAccountManager.getActiveAccount();
        if (!activeAccount) return null;
        const gdriveAccountName = activeAccount.accountName;

        const data = await driveFolderRedis.getFolders(userId, gdriveAccountName);
        const folder = data.recentFolders.find(
            f => f.folderName.toLowerCase() === folderName.toLowerCase()
        );
        
        if (folder) {
            const exists = await driveFolderValidator.isFolderExists(folder.folderId);
            if (!exists) {
                data.recentFolders = data.recentFolders.filter(f => f.folderId !== folder.folderId);
                await this.saveFolders(userId, gdriveAccountName, data);
                return null;
            }
        }
        
        return folder;
    }

    async updateFolderAccess(userId, folderId) {
        const activeAccount = await activeDriveAccountManager.getActiveAccount();
        if (!activeAccount) return;
        const gdriveAccountName = activeAccount.accountName;

        const data = await driveFolderRedis.getFolders(userId, gdriveAccountName);
        const folder = data.recentFolders.find(f => f.folderId === folderId);

        if (folder) {
            folder.lastAccessed = new Date().toISOString();
            await this.saveFolders(userId, gdriveAccountName, data);
        }
    }

    async renameFolder(userId, oldName, newName) {
        const activeAccount = await activeDriveAccountManager.getActiveAccount();
        if (!activeAccount) return false;
        const gdriveAccountName = activeAccount.accountName;

        const data = await driveFolderRedis.getFolders(userId, gdriveAccountName);
        const folder = data.recentFolders
            .find(f => f.folderName.toLowerCase() === oldName.toLowerCase());

        if (folder) {
            folder.folderName = newName;
            folder.lastAccessed = new Date().toISOString();
            await this.saveFolders(userId, gdriveAccountName, data);
            return true;
        }

        return false;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    async formatFolderList(userId) {
        const folders = await this.getFolders(userId);
        if (folders.length === 0) {
            return '📂 Tidak ada folder yang tersimpan';
        }

        const folderList = folders.map((folder, index) => {
            return `${index + 1}. ${folder.folderName}\n` + 
                   `➤ Dibuat: ${this.formatDate(folder.createdAt)}\n` + 
                   `➤ Terakhir diakses: ${this.formatDate(folder.lastAccessed)}`;
        }).join('\n\n');

        return `📂 Daftar Folder:\n\n${folderList}\n\n` + 
               `Gunakan "/gdrive folder <nama>" untuk melanjutkan upload ke folder yang ada.`;
    }
}

const driveFolderService = new DriveFolderService();
export default driveFolderService;
