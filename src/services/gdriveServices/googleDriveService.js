
import { google } from 'googleapis';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import logger from '../../utils/common/logger.js';
import config from '../../config.js';
import { FileManager } from '../../utils/fileManagement/fileManager.js';
import activeDriveAccountManager from '../../utils/gdrive/activeDriveAccountManager.js';
import EncryptionUtil from '../../utils/common/encryptionUtil.js';

class GoogleDriveService {
    constructor() {
        this.fileManager = new FileManager();
        this.driveClientsCache = new Map();
        const secretKey = config.mega.credentialsSecret;
        if (secretKey) {
            this.encryptionUtil = new EncryptionUtil(secretKey);
        } else {
            logger.warn('MEGA_CREDENTIALS_SECRET is not set. Google Drive token encryption/decryption will be disabled.');
            this.encryptionUtil = null;
        }
    }

    async _getDriveClient() {
        const activeAccount = await activeDriveAccountManager.getActiveAccount();

        if (!activeAccount) {
            throw new Error('No active Google Drive account is configured. Please run the setup script.');
        }

        // Return cached client if available
        if (this.driveClientsCache.has(activeAccount.accountName)) {
            return { client: this.driveClientsCache.get(activeAccount.accountName), config: activeAccount };
        }

        try {
            const credentials = JSON.parse(await fsPromises.readFile(activeAccount.credentialsPath, 'utf8'));
            const oauth2Client = new google.auth.OAuth2(
                credentials.installed.client_id,
                credentials.installed.client_secret,
                credentials.installed.redirect_uris[0]
            );

            const tokenContent = await fsPromises.readFile(activeAccount.tokenPath, 'utf8');
            let tokens;

            try {
                // First, assume the token is encrypted
                if (!this.encryptionUtil) throw new Error('Encryption utility is not available.');
                const decryptedToken = this.encryptionUtil.decrypt(tokenContent);
                tokens = JSON.parse(decryptedToken);
            } catch (e) {
                // If decryption fails, assume it's a plaintext (old) token and migrate it
                logger.warn(`Could not decrypt GDrive token for ${activeAccount.accountName}. Assuming plaintext and attempting to migrate.`);
                try {
                    tokens = JSON.parse(tokenContent);
                    if (this.encryptionUtil) {
                        const encryptedTokens = this.encryptionUtil.encrypt(JSON.stringify(tokens));
                        await fsPromises.writeFile(activeAccount.tokenPath, encryptedTokens, 'utf8');
                        logger.info(`Successfully migrated and encrypted GDrive token for ${activeAccount.accountName}.`);
                    }
                } catch (parseError) {
                    logger.error(`Failed to parse GDrive token for ${activeAccount.accountName} as JSON after decryption failure. Please re-authorize the account.`, parseError);
                    throw new Error(`Invalid token file for ${activeAccount.accountName}.`);
                }
            }

            oauth2Client.setCredentials(tokens);

            const drive = google.drive({ version: 'v3', auth: oauth2Client });
            
            // Cache the new client
            this.driveClientsCache.set(activeAccount.accountName, drive);
            logger.info(`Google Drive client initialized for account: ${activeAccount.accountName}`);

            return { client: drive, config: activeAccount };
        } catch (error) {
            logger.error(`Failed to initialize Google Drive client for account ${activeAccount.accountName}:`, error);
            throw new Error(`Failed to initialize Google Drive for account: ${activeAccount.accountName}. Please re-authorize it.`);
        }
    }

    async createFolder(folderName, parentFolderId = null) {
        try {
            const { client: drive, config: activeConfig } = await this._getDriveClient();
            const finalParentFolderId = parentFolderId || activeConfig.defaultFolderId;

            const fileMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [finalParentFolderId]
            };

            const folder = await drive.files.create({
                resource: fileMetadata,
                fields: 'id, webViewLink'
            });

            logger.info(`Created Google Drive folder: ${folderName}`);
            return folder.data;
        } catch (error) {
            logger.error('Failed to create Google Drive folder:', error);
            throw this.handleDriveError(error);
        }
    }

    async uploadFile(filePath, customFileName = '', parentFolderId = null, mimeType = null) {
        try {
            const { client: drive, config: activeConfig } = await this._getDriveClient();
            const finalParentFolderId = parentFolderId || activeConfig.defaultFolderId;

            const stats = await fsPromises.stat(filePath);
            if (stats.size > activeConfig.maxFileSize * 1024 * 1024) {
                throw new Error(`File size exceeds maximum limit of ${activeConfig.maxFileSize}MB`);
            }

            const fileName = customFileName || path.basename(filePath);
            const detectedMimeType = mimeType || this.fileManager.getMimeType(filePath);
            const allowedTypes = activeConfig.mimeTypes;
            if (!allowedTypes.includes('*/*') && 
                !allowedTypes.includes(detectedMimeType) && 
                !allowedTypes.some(type => type.endsWith('/*') && detectedMimeType.startsWith(type.slice(0, -1)))) {
                throw new Error(`File type ${detectedMimeType} is not allowed`);
            }

            const fileMetadata = {
                name: fileName,
                parents: [finalParentFolderId]
            };

            const media = {
                mimeType: detectedMimeType,
                body: fs.createReadStream(filePath)
            };

            let attempt = 1;
            while (attempt <= activeConfig.maxRetries) {
                try {
                    const response = await drive.files.create({
                        requestBody: fileMetadata,
                        media: media,
                        fields: 'id, webViewLink',
                        timeout: activeConfig.uploadTimeout
                    });

                    logger.info(`File uploaded successfully to Google Drive: ${fileName}`);
                    return {
                        fileId: response.data.id,
                        webViewLink: response.data.webViewLink
                    };
                } catch (error) {
                    if (attempt === activeConfig.maxRetries) throw error;
                    
                    logger.warn(`Upload attempt ${attempt} failed, retrying in ${activeConfig.retryDelay}ms`);
                    await new Promise(resolve => setTimeout(resolve, activeConfig.retryDelay));
                    attempt++;
                }
            }
        } catch (error) {
            logger.error('Failed to upload file to Google Drive:', error);
            throw this.handleDriveError(error);
        }
    }

    handleDriveError(error) {
        if (error.response?.data?.error === 'invalid_grant') {
            logger.error('Google Drive refresh token is invalid. Re-authentication required.', error);
            return new Error('Google Drive authentication has expired or been revoked. Please re-run the setup script.');
        }
        if (error.code === 403) {
            return new Error('Access denied to Google Drive. Please check credentials.');
        }
        if (error.code === 429) {
            return new Error('Google Drive API rate limit exceeded. Please try again later.');
        }
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            return new Error('Connection to Google Drive failed. Please check your internet connection.');
        }
        return error;
    }
}

export default new GoogleDriveService();
