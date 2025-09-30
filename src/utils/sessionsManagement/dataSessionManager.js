import fs from 'fs/promises';
import path from 'path';
import logger from '../common/logger.js';
import config from '../../config.js';

class DataSessionManager {
    constructor() {
        this.baseDir = config.sessionDir;
        this.initializeFolders();
    }

    async initializeFolders() {
        const folders = [
            'groups/settings',
            'groups/stats',
            'users/preferences',
            'users/limits',
            'cache/maps',
            'cache/translate',
            'cache/wiki',
            'backup/autoreply',
            'backup/forbidden',
            'backup/welcome'
        ];

        for (const folder of folders) {
            const folderPath = path.join(this.baseDir, folder);
            try {
                await fs.mkdir(folderPath, { recursive: true });
                logger.info(`Created session directory: ${folderPath}`);
            } catch (error) {
                logger.error(`Failed to create session directory: ${folderPath}`, error);
            }
        }
    }

    // Group Management
    async saveGroupSettings(groupId, settings) {
        const filePath = path.join(this.baseDir, 'groups/settings', `${groupId}.json`);
        await this.saveData(filePath, settings);
    }

    async getGroupSettings(groupId) {
        const filePath = path.join(this.baseDir, 'groups/settings', `${groupId}.json`);
        return await this.getData(filePath, {});
    }

    async updateGroupStats(groupId, stats) {
        const filePath = path.join(this.baseDir, 'groups/stats', `${groupId}.json`);
        const currentStats = await this.getData(filePath, {});
        const updatedStats = { ...currentStats, ...stats, lastUpdated: new Date().toISOString() };
        await this.saveData(filePath, updatedStats);
    }

    // User Management
    async saveUserPreferences(userId, preferences) {
        const filePath = path.join(this.baseDir, 'users/preferences', `${userId}.json`);
        await this.saveData(filePath, preferences);
    }

    async getUserPreferences(userId) {
        const filePath = path.join(this.baseDir, 'users/preferences', `${userId}.json`);
        return await this.getData(filePath, {});
    }

    async updateUserLimits(userId, limits) {
        const filePath = path.join(this.baseDir, 'users/limits', `${userId}.json`);
        const currentLimits = await this.getData(filePath, {});
        const updatedLimits = { ...currentLimits, ...limits, lastUpdated: new Date().toISOString() };
        await this.saveData(filePath, updatedLimits);
    }

    // Cache Management
    async saveToCache(category, key, data, ttl = 3600000) { // default 1 hour TTL
        const filePath = path.join(this.baseDir, 'cache', category, `${key}.json`);
        const cacheData = {
            data,
            expires: Date.now() + ttl,
        };
        await this.saveData(filePath, cacheData);
    }

    async getFromCache(category, key) {
        const filePath = path.join(this.baseDir, 'cache', category, `${key}.json`);
        const cached = await this.getData(filePath);
        
        if (!cached) return null;
        
        if (cached.expires < Date.now()) {
            await fs.unlink(filePath).catch(() => {});
            return null;
        }
        
        return cached.data;
    }

    // Backup Management
    async createBackup(category, data) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = path.join(this.baseDir, 'backup', category, `backup-${timestamp}.json`);
        await this.saveData(filePath, {
            timestamp,
            data,
        });
        
        // Keep only last 5 backups
        await this.cleanupOldBackups(category, 5);
    }

    async getLatestBackup(category) {
        const backupDir = path.join(this.baseDir, 'backup', category);
        try {
            const files = await fs.readdir(backupDir);
            const latest = files.sort().pop();
            if (!latest) return null;
            
            return await this.getData(path.join(backupDir, latest));
        } catch (error) {
            logger.error(`Failed to get latest backup for ${category}`, error);
            return null;
        }
    }

    // Utility Methods
    async saveData(filePath, data) {
        try {
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            logger.error(`Failed to save data to ${filePath}`, error);
            throw error;
        }
    }

    async getData(filePath, defaultValue = null) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return defaultValue;
            }
            logger.error(`Failed to read data from ${filePath}`, error);
            throw error;
        }
    }

    // Cleanup Methods
    async cleanupCache(maxAge = 86400000) { // default 24 hours
        const cacheDir = path.join(this.baseDir, 'cache');
        const categories = ['maps', 'translate', 'wiki'];
        
        for (const category of categories) {
            const categoryPath = path.join(cacheDir, category);
            try {
                const files = await fs.readdir(categoryPath);
                for (const file of files) {
                    const filePath = path.join(categoryPath, file);
                    const cached = await this.getData(filePath);
                    
                    if (cached && cached.expires < Date.now()) {
                        await fs.unlink(filePath).catch(() => {});
                        logger.info(`Cleaned up expired cache file: ${filePath}`);
                    }
                }
            } catch (error) {
                logger.error(`Failed to cleanup cache for ${category}`, error);
            }
        }
    }

    async cleanupOldBackups(category, keepCount = 5) {
        const backupDir = path.join(this.baseDir, 'backup', category);
        try {
            const files = await fs.readdir(backupDir);
            if (files.length <= keepCount) return;

            const sortedFiles = files.sort();
            const filesToDelete = sortedFiles.slice(0, -keepCount);

            for (const file of filesToDelete) {
                const filePath = path.join(backupDir, file);
                await fs.unlink(filePath);
                logger.info(`Cleaned up old backup: ${filePath}`);
            }
        } catch (error) {
            logger.error(`Failed to cleanup old backups for ${category}`, error);
        }
    }
}

export default new DataSessionManager();