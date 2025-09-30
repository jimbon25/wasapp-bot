import { redisManager } from './RedisManager.js';
import config from '../../config.js';

class SessionBackupManager {
    constructor(backupInterval = config.redis.sessionBackupInterval) {
        this.redisClient = null;
        this.backupInterval = backupInterval;
        this.backupTimer = null;
        this.prefix = 'session';
    }

    async init() {
        try {
            await redisManager.connect();
            this.redisClient = await redisManager.getClient();
            
            if (!this.redisClient) {
                throw new Error('Redis client not available');
            }
            
            this.startPeriodicBackup();
            return true;
        } catch (error) {
            console.error('Failed to initialize SessionBackupManager:', error);
            throw error;
        }
    }

    getKey(sessionId) {
        return `${this.prefix}:${sessionId}`;
    }

    async backupSession(sessionId, data) {
        try {
            if (!this.redisClient) await this.init();
            if (!this.redisClient) {
                console.warn('Redis client not available for backup');
                return false;
            }

            const key = this.getKey(sessionId);
            await redisManager.set(key, data);
            await redisManager.set(`${key}:timestamp`, Date.now());
            return true;
        } catch (error) {
            console.error('Redis backup error:', error);
            return false;
        }
    }

    async restoreSession(sessionId) {
        try {
            if (!this.redisClient) await this.init();
            if (!this.redisClient) {
                console.warn('Redis client not available for restore');
                return null;
            }

            const key = this.getKey(sessionId);
            return await redisManager.get(key);
        } catch (error) {
            console.error('Redis restore error:', error);
            return null;
        }
    }

    async getLastBackupTime(sessionId) {
        try {
            if (!this.redisClient) await this.init();
            if (!this.redisClient) {
                console.warn('Redis client not available for getLastBackupTime');
                return null;
            }

            const key = this.getKey(sessionId);
            const timestamp = await redisManager.get(`${key}:timestamp`);
            return timestamp ? parseInt(timestamp) : null;
        } catch (error) {
            console.error('Redis getLastBackupTime error:', error);
            return null;
        }
    }

    async deleteBackup(sessionId) {
        try {
            if (!this.redisClient) await this.init();
            if (!this.redisClient) {
                console.warn('Redis client not available for deleteBackup');
                return false;
            }

            const key = this.getKey(sessionId);
            await redisManager.del(key);
            await redisManager.del(`${key}:timestamp`);
            return true;
        } catch (error) {
            console.error('Redis deleteBackup error:', error);
            return false;
        }
    }

    startPeriodicBackup() {
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
        }

        this.backupTimer = setInterval(async () => {
            try {
                await this.backupAllSessions();
            } catch (error) {
                console.error('Periodic backup error:', error);
            }
        }, this.backupInterval * 1000);
    }

    stopPeriodicBackup() {
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
            this.backupTimer = null;
        }
    }

    async backupAllSessions() {
        console.log('backupAllSessions should be implemented by the consumer');
    }

    async validateBackup(sessionId) {
        const backup = await this.restoreSession(sessionId);
        return backup !== null;
    }
}

export const sessionBackupManager = new SessionBackupManager(
    config.redis.sessionBackupInterval
);
export default sessionBackupManager;