import { redisManager } from './index.js';
import logger from '../common/logger.js';

const FOLDER_KEY_PREFIX = 'drive:folders:';
const FOLDER_DEBOUNCE_MS = 10000; // 10 seconds

class DriveFolderRedis {
    constructor() {
        this.debounceTimers = new Map();
    }

    /**
     * Get Redis key for user's folders, now including the GDrive account name.
     */
    getFolderKey(userId, gdriveAccountName) {
        if (!gdriveAccountName) {
            logger.warn('gdriveAccountName is required for getFolderKey but was not provided. Falling back to default.');
            return `${FOLDER_KEY_PREFIX}${userId}:default`;
        }
        return `${FOLDER_KEY_PREFIX}${userId}:${gdriveAccountName}`;
    }

    /**
     * Get folders from Redis for a specific user and GDrive account.
     */
    async getFolders(userId, gdriveAccountName) {
        try {
            const data = await redisManager.client.get(this.getFolderKey(userId, gdriveAccountName));
            if (!data) return { recentFolders: [] };
            return JSON.parse(data);
        } catch (error) {
            logger.error('Error getting folders from Redis:', error);
            return { recentFolders: [] };
        }
    }

    /**
     * Save folders to Redis for a specific user and GDrive account.
     */
    async saveFolders(userId, gdriveAccountName, folders) {
        try {
            await redisManager.client.set(
                this.getFolderKey(userId, gdriveAccountName),
                JSON.stringify(folders)
            );
        } catch (error) {
            logger.error('Error saving folders to Redis:', error);
            throw error;
        }
    }

    /**
     * Schedule JSON backup with debounce
     */
    scheduleBackup(callback) {
        const key = 'folderBackup';
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }

        const timer = setTimeout(async () => {
            try {
                await callback();
                this.debounceTimers.delete(key);
            } catch (error) {
                logger.error('Error in folder backup:', error);
            }
        }, FOLDER_DEBOUNCE_MS);

        this.debounceTimers.set(key, timer);
    }
}

export const driveFolderRedis = new DriveFolderRedis();
