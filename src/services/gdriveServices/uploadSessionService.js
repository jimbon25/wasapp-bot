import { redisManager } from '../../utils/redis/RedisManager.js';
import logger from '../../utils/common/logger.js';
import activeDriveAccountManager from '../../utils/gdrive/activeDriveAccountManager.js';

class UploadSessionService {
    constructor() {
        this.redis = redisManager;
        this.sessionPrefix = 'gdrive_session:';
        this.sessionTimeout = 5 * 60;
    }

    async getSessionKey(userId) {
        const activeAccount = await activeDriveAccountManager.getActiveAccount();
        if (!activeAccount) {
            throw new Error('No active Google Drive account configured for session.');
        }
        return `${this.sessionPrefix}${userId}:${activeAccount.accountName}`;
    }

    /**
     * Create a new upload session for a user
     * @param {string} userId - The WhatsApp user ID
     * @param {string} folderId - The Google Drive folder ID
     * @param {string} folderName - The folder name
     */
    async createSession(userId, folderId, folderName, folderLink) {
        const sessionData = {
            folderId,
            folderName,
            folderLink,
            startTime: Date.now(),
            uploadCount: 0
        };
        
        const sessionKey = await this.getSessionKey(userId);
        await this.redis.set(
            sessionKey,
            JSON.stringify(sessionData),
            this.sessionTimeout
        );
        
        logger.info(`Created upload session for user ${userId} with folder ${folderName} for account ${sessionKey.split(':').pop()}`);
    }

    /**
     * Get active session for a user
     * @param {string} userId - The WhatsApp user ID
     */
    async getSession(userId) {
        try {
            const sessionKey = await this.getSessionKey(userId);
            const session = await this.redis.get(sessionKey);
            if (!session) return null;
            
            try {
                return JSON.parse(session);
            } catch (error) {
                logger.error('Error parsing session data', { userId, error });
                return null;
            }
        } catch (error) {
            logger.warn(`Could not get session for user ${userId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Update session upload count and refresh timeout
     * @param {string} userId - The WhatsApp user ID
     */
    async updateSession(userId) {
        const session = await this.getSession(userId);
        if (!session) return false;

        session.uploadCount++;
        const sessionKey = await this.getSessionKey(userId);
        await this.redis.set(
            sessionKey,
            JSON.stringify(session),
            this.sessionTimeout
        );
        
        return true;
    }

    /**
     * End a user's upload session
     * @param {string} userId - The WhatsApp user ID
     */
    async endSession(userId) {
        try {
            const sessionKey = await this.getSessionKey(userId);
            await this.redis.del(sessionKey);
            logger.info(`Ended upload session for user ${userId} for account ${sessionKey.split(':').pop()}`);
        } catch (error) {
            logger.warn(`Could not end session for user ${userId}: ${error.message}`);
        }
    }

    /**
     * Check if user has an active session
     * @param {string} userId - The WhatsApp user ID
     */
    async hasActiveSession(userId) {
        try {
            const sessionKey = await this.getSessionKey(userId);
            return await this.redis.exists(sessionKey);
        } catch (error) {
            logger.warn(`Could not check active session for user ${userId}: ${error.message}`);
            return 0;
        }
    }
}

export default new UploadSessionService();
