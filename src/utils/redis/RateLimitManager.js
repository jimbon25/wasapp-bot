import RedisRateLimiter from './RedisRateLimiter.js';
import config from '../../config.js';

class RateLimitManager {
    constructor() {
        this.localCounters = new Map();
        this.redisLimiter = new RedisRateLimiter(
            'ratelimit',
            config.redis.rateLimitWindow,
            config.redis.rateLimitMax
        );
        this.fallbackThreshold = config.redis.rateLimitThreshold;
    }

    async init() {
        try {
            await this.redisLimiter.init();
        } catch (error) {
            console.error('Failed to initialize RateLimitManager:', error);
        }
    }

    async checkRateLimit(identifier) {
        const localCount = this.getLocalCount(identifier);
        
        if (localCount >= this.fallbackThreshold) {
            const isLimited = await this.redisLimiter.isRateLimited(identifier);
            if (isLimited) {
                return false;
            }
        }

        this.incrementLocal(identifier);
        await this.redisLimiter.increment(identifier);
        
        return true;
    }

    getLocalCount(identifier) {
        return this.localCounters.get(identifier) || 0;
    }

    incrementLocal(identifier) {
        const current = this.getLocalCount(identifier);
        this.localCounters.set(identifier, current + 1);
    }

    async resetLimits(identifier) {
        this.localCounters.delete(identifier);
        await this.redisLimiter.reset(identifier);
    }

    async getCurrentLimits(identifier) {
        const local = this.getLocalCount(identifier);
        const redis = await this.redisLimiter.getCurrentCount(identifier);
        return { local, redis };
    }
}

export const rateLimitManager = new RateLimitManager();
export default rateLimitManager;