import { redisManager } from './RedisManager.js';
import config from '../../config.js';

class RedisRateLimiter {
    constructor(prefix = 'ratelimit', windowMs = config.redis.rateLimitWindow, maxRequests = config.redis.rateLimitMax) {
        this.prefix = prefix;
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        this.redisClient = null;
    }

    async init() {
        try {
            this.redisClient = redisManager.getClient();
        } catch (error) {
            console.error('Failed to initialize RedisRateLimiter:', error);
            throw error;
        }
    }

    getKey(identifier) {
        return `${this.prefix}:${identifier}`;
    }

    async increment(identifier) {
        const key = this.getKey(identifier);

        try {
            const client = await redisManager.getClient();
            if (!client) return 0;

            const count = await client.incr(key);
            await client.pexpire(key, this.windowMs);
            return count;
        } catch (error) {
            console.error('Redis increment error:', error);
            return 0;
        }
    }

    async getCurrentCount(identifier) {
        const key = this.getKey(identifier);

        try {
            const value = await redisManager.get(key);
            return parseInt(value) || 0;
        } catch (error) {
            console.error('Redis getCurrentCount error:', error);
            return 0;
        }
    }

    async isRateLimited(identifier) {
        const currentCount = await this.getCurrentCount(identifier);
        return currentCount >= this.maxRequests;
    }

    async reset(identifier) {
        if (!this.redisClient) await this.init();
        const key = this.getKey(identifier);

        try {
            await this.redisClient.del(key);
            return true;
        } catch (error) {
            console.error('Redis reset error:', error);
            return false;
        }
    }
}

export default RedisRateLimiter;