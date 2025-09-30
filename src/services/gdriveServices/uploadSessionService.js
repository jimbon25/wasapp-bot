import { redisManager } from '../../utils/redis/RedisManager.js';
import logger from '../../utils/common/logger.js';

class UploadSessionService {
    constructor() {
        this.redis = redisManager;
        this.sessionPrefix = 'gdrive_session:';
        this.sessionTimeout = 5 * 60;
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
        
        await this.redis.set(
            `${this.sessionPrefix}${userId}`,
            JSON.stringify(sessionData),
            this.sessionTimeout
        );
        
        logger.info(`Created upload session for user ${userId} with folder ${folderName}`);
    }

    /**
     * Get active session for a user
     * @param {string} userId - The WhatsApp user ID
     */
    async getSession(userId) {
        const session = await this.redis.get(`${this.sessionPrefix}${userId}`);
        if (!session) return null;
        
        try {
            return JSON.parse(session);
        } catch (error) {
            logger.error('Error parsing session data', { userId, error });
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
        await this.redis.set(
            `${this.sessionPrefix}${userId}`,
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
        await this.redis.del(`${this.sessionPrefix}${userId}`);
        logger.info(`Ended upload session for user ${userId}`);
    }

    /**
     * Check if user has an active session
     * @param {string} userId - The WhatsApp user ID
     */
    async hasActiveSession(userId) {
        return await this.redis.exists(`${this.sessionPrefix}${userId}`);
    }
}

export default new UploadSessionService();