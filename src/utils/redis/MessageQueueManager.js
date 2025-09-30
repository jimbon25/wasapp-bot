import RedisQueue from './RedisQueue.js';
import config from '../../config.js';

class MessageQueueManager {
    constructor(maxMemoryLength = config.redis.queueMaxLength) {
        this.memoryQueue = [];
        this.maxMemoryLength = maxMemoryLength;
        this.redisQueue = new RedisQueue('message_queue', maxMemoryLength);
        this.isUsingRedis = false;
    }

    async init() {
        try {
            await this.redisQueue.init();
            if (this.memoryQueue.length === 0) {
                await this.recoverFromRedis();
            }
        } catch (error) {
            console.error('Failed to initialize MessageQueueManager:', error);
        }
    }

    async enqueue(message) {
        if (this.isUsingRedis) {
            return await this.redisQueue.enqueue(message);
        }

        if (this.memoryQueue.length >= this.maxMemoryLength * 0.9) {
            await this.switchToRedis();
            return await this.redisQueue.enqueue(message);
        }

        this.memoryQueue.push(message);
        return true;
    }

    async dequeue() {
        if (this.isUsingRedis) {
            return await this.redisQueue.dequeue();
        }

        return this.memoryQueue.shift() || null;
    }

    async peek() {
        if (this.isUsingRedis) {
            return await this.redisQueue.peek();
        }

        return this.memoryQueue[0] || null;
    }

    async getLength() {
        if (this.isUsingRedis) {
            return await this.redisQueue.getLength();
        }

        return this.memoryQueue.length;
    }

    async switchToRedis() {
        if (this.isUsingRedis) return;

        try {
            while (this.memoryQueue.length > 0) {
                const message = this.memoryQueue.shift();
                await this.redisQueue.enqueue(message);
            }
            this.isUsingRedis = true;
            console.log('Switched to Redis queue');
        } catch (error) {
            console.error('Failed to switch to Redis:', error);
            this.isUsingRedis = false;
        }
    }

    async switchToMemory() {
        if (!this.isUsingRedis) return;

        try {
            const redisLength = await this.redisQueue.getLength();
            if (redisLength <= this.maxMemoryLength * 0.7) {
                while (this.memoryQueue.length < this.maxMemoryLength) {
                    const message = await this.redisQueue.dequeue();
                    if (!message) break;
                    this.memoryQueue.push(message);
                }
                this.isUsingRedis = false;
                console.log('Switched back to memory queue');
            }
        } catch (error) {
            console.error('Failed to switch to memory:', error);
        }
    }

    async recoverFromRedis() {
        try {
            const redisLength = await this.redisQueue.getLength();
            if (redisLength > 0) {
                console.log(`Recovering ${redisLength} messages from Redis`);
                while (this.memoryQueue.length < this.maxMemoryLength) {
                    const message = await this.redisQueue.dequeue();
                    if (!message) break;
                    this.memoryQueue.push(message);
                }
            }
        } catch (error) {
            console.error('Failed to recover from Redis:', error);
        }
    }

    async clear() {
        this.memoryQueue = [];
        if (this.isUsingRedis) {
            await this.redisQueue.clear();
        }
    }

    isRedisActive() {
        return this.isUsingRedis;
    }
}

export const messageQueueManager = new MessageQueueManager(
    config.redis.queueMaxLength
);
export default messageQueueManager;