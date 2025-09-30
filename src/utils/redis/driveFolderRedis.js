import { redisManager } from './index.js';
import logger from '../common/logger.js';

const FOLDER_KEY_PREFIX = 'drive:folders:';
const FOLDER_DEBOUNCE_MS = 10000; // 10 seconds

class DriveFolderRedis {
    constructor() {
        this.debounceTimers = new Map();
    }

    /**
     * Get Redis key for user's folders
     */
    getFolderKey(userId) {
        return `${FOLDER_KEY_PREFIX}${userId}`;
    }

    /**
     * Get folders from Redis
     */
    async getFolders(userId) {
        try {
            const data = await redisManager.client.get(this.getFolderKey(userId));
            if (!data) return { recentFolders: [] };
            return JSON.parse(data);
        } catch (error) {
            logger.error('Error getting folders from Redis:', error);
            return { recentFolders: [] };
        }
    }

    /**
     * Save folders to Redis
     */
    async saveFolders(userId, folders) {
        try {
            await redisManager.client.set(
                this.getFolderKey(userId),
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