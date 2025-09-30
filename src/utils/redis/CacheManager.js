import { redisManager } from './RedisManager.js';
import config from '../../config.js';

class CacheManager {
    constructor(defaultTTL = config.redis.cacheTtl) {
        this.redisClient = null;
        this.prefix = 'cache';
        this.defaultTTL = defaultTTL;
        this.memoryCache = new Map();
        this.memoryCacheStats = new Map();
    }

    async init() {
        try {
            this.redisClient = redisManager.getClient();
        } catch (error) {
            console.error('Failed to initialize CacheManager:', error);
            throw error;
        }
    }

    getKey(key) {
        return `${this.prefix}:${key}`;
    }

    async set(key, value, ttl = this.defaultTTL) {
        this.setMemoryCache(key, value, ttl);

        const redisKey = this.getKey(key);

        try {
            return await redisManager.set(redisKey, value, ttl);
        } catch (error) {
            console.error('Redis set error:', error);
            return false;
        }
    }

    async get(key) {
        const memoryValue = this.getMemoryCache(key);
        if (memoryValue !== null) {
            this.updateCacheStats(key, true); // Hit
            return memoryValue;
        }

        const redisKey = this.getKey(key);
        try {
            const value = await redisManager.get(redisKey);
            if (value) {
                this.setMemoryCache(key, value);
                this.updateCacheStats(key, true); // Hit
                return value;
            }
        } catch (error) {
            console.error('Redis get error:', error);
        }

        this.updateCacheStats(key, false); // Miss
        return null;
    }

    async delete(key) {
        this.memoryCache.delete(key);

        const redisKey = this.getKey(key);
        try {
            return await redisManager.del(redisKey);
        } catch (error) {
            console.error('Redis delete error:', error);
            return false;
        }
    }

    setMemoryCache(key, value, ttl = this.defaultTTL) {
        this.memoryCache.set(key, {
            value,
            expires: Date.now() + (ttl * 1000)
        });
    }

    getMemoryCache(key) {
        const cached = this.memoryCache.get(key);
        if (!cached) return null;

        if (Date.now() > cached.expires) {
            this.memoryCache.delete(key);
            return null;
        }

        return cached.value;
    }

    updateCacheStats(key, isHit) {
        const stats = this.memoryCacheStats.get(key) || { hits: 0, misses: 0 };
        if (isHit) {
            stats.hits++;
        } else {
            stats.misses++;
        }
        this.memoryCacheStats.set(key, stats);
    }

    async getStats(key) {
        return this.memoryCacheStats.get(key) || { hits: 0, misses: 0 };
    }

    async clearExpired() {
        for (const [key, value] of this.memoryCache.entries()) {
            if (Date.now() > value.expires) {
                this.memoryCache.delete(key);
            }
        }
    }

    startCleanupInterval() {
        setInterval(() => this.clearExpired(), 60000); // Clean every minute
    }

    async flush() {
        this.memoryCache.clear();
        this.memoryCacheStats.clear();

        if (!this.redisClient) await this.init();
        try {
            const keys = await this.redisClient.keys(`${this.prefix}:*`);
            if (keys.length > 0) {
                await this.redisClient.del(keys);
            }
            return true;
        } catch (error) {
            console.error('Redis flush error:', error);
            return false;
        }
    }
}

export const cacheManager = new CacheManager(
    config.redis.cacheTtl
);
export default cacheManager;