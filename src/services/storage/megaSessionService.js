import { redisManager } from '../../utils/redis/RedisManager.js';
import logger from '../../utils/common/logger.js';

class MegaSessionService {
    constructor() {
        this.redis = redisManager;
        this.sessionPrefix = 'mega_session:';
        this.sessionTimeout = 15 * 60; // 15 minutes
    }

    async startSession(userId) {
        const sessionKey = `${this.sessionPrefix}${userId}`;
        await this.redis.set(sessionKey, 'true', this.sessionTimeout);
        logger.info(`Started Mega upload session for user ${userId}`);
    }

    async getSession(userId) {
        const sessionKey = `${this.sessionPrefix}${userId}`;
        const session = await this.redis.get(sessionKey);
        if (session) {
            await this.redis.client.expire(sessionKey, this.sessionTimeout);
            return { isActive: true };
        }
        return null;
    }

    async endSession(userId) {
        await this.redis.del(`${this.sessionPrefix}${userId}`);
        logger.info(`Ended Mega upload session for user ${userId}`);
    }

    async hasActiveSession(userId) {
        const key = `${this.sessionPrefix}${userId}`;
        const result = await this.redis.exists(key);
        return result === 1;
    }
}

export default new MegaSessionService();