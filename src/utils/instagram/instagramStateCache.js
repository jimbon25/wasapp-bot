import Redis from 'ioredis';
import logger from '../common/logger.js';
import config from '../../config.js';

class InstagramStateCache {
    constructor() {
        this.memoryStorage = new Map();
        this.isRedisConnected = false;

        this.client = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            retryStrategy: (times) => {
                const delay = Math.min(times * 1000, config.redis.maxRetryTime);
                logger.warn(`Redis connection attempt ${times}. Retrying in ${delay}ms...`);
                return delay;
            },
            maxRetriesPerRequest: config.redis.maxRetries || 3
        });

        this.setupRedisEventHandlers();
    }

    setupRedisEventHandlers() {
        this.client.on('connect', () => {
            logger.info('Redis client connected');
            this.isRedisConnected = true;
            this.syncMemoryToRedis();
        });

        this.client.on('error', (err) => {
            logger.error('Redis Client Error:', err);
            this.isRedisConnected = false;
        });

        this.client.on('close', () => {
            logger.warn('Redis connection closed');
            this.isRedisConnected = false;
        });

        this.client.on('reconnecting', () => {
            logger.info('Redis client reconnecting...');
        });
    }

    async syncMemoryToRedis() {
        try {
            if (!this.isRedisConnected || this.memoryStorage.size === 0) return;

            for (const [username, state] of this.memoryStorage.entries()) {
                const key = `instagram:account:${username}`;
                await this.client.set(key, JSON.stringify(state));
                await this.client.expire(key, config.redis.cacheTtl);
            }
            
            logger.info('Successfully synced memory storage to Redis');
            this.memoryStorage.clear();
        } catch (error) {
            logger.error('Failed to sync memory storage to Redis:', error);
        }
    }

    async saveAccountState(username, state) {
        try {
            const key = `instagram:account:${username}`;
            
            if (this.isRedisConnected) {
                await this.client.set(key, JSON.stringify(state));
                await this.client.expire(key, config.redis.cacheTtl);
                logger.info(`Saved state for ${username} to Redis`);
            } else {
                this.memoryStorage.set(username, state);
                logger.info(`Saved state for ${username} to memory (Redis offline)`);
            }
        } catch (error) {
            logger.error(`Failed to save account state for ${username}:`, error);
            this.memoryStorage.set(username, state);
        }
    }

    async getAccountState(username) {
        try {
            const key = `instagram:account:${username}`;
            
            if (this.isRedisConnected) {
                const state = await this.client.get(key);
                if (state) {
                    return JSON.parse(state);
                }
            }
            
            const memoryState = this.memoryStorage.get(username);
            if (memoryState) {
                logger.info(`Retrieved state for ${username} from memory`);
                return memoryState;
            }
            
            return null;
        } catch (error) {
            logger.error(`Failed to get account state for ${username}:`, error);
            return this.memoryStorage.get(username) || null;
        }
    }

    async clearAccountState(username) {
        try {
            const key = `instagram:account:${username}`;
            
            if (this.isRedisConnected) {
                await this.client.del(key);
            }
            
            this.memoryStorage.delete(username);
            logger.info(`Cleared state for ${username}`);
        } catch (error) {
            logger.error(`Failed to clear account state for ${username}:`, error);
            this.memoryStorage.delete(username);
        }
    }

    async getAllAccountStates() {
        try {
            const states = {};
            
            if (this.isRedisConnected) {
                const keys = await this.client.keys('instagram:account:*');
                
                for (const key of keys) {
                    const username = key.split(':')[2];
                    const state = await this.getAccountState(username);
                    if (state) {
                        states[username] = state;
                    }
                }
            }
            
            for (const [username, state] of this.memoryStorage.entries()) {
                states[username] = state;
            }
            
            return states;
        } catch (error) {
            logger.error('Failed to get all account states:', error);
            return Object.fromEntries(this.memoryStorage);
        }
    }
}

export default new InstagramStateCache();