import { redisManager } from './RedisManager.js';

class RedisQueue {
    constructor(queueName, maxMemoryLength = 1000) {
        this.queueName = queueName;
        this.maxMemoryLength = maxMemoryLength;
        this.redisClient = null;
    }

    async init() {
        try {
            this.redisClient = redisManager.getClient();
        } catch (error) {
            console.error('Failed to initialize RedisQueue:', error);
            throw error;
        }
    }

    async enqueue(data) {
        try {
            const client = await redisManager.getClient();
            if (!client) return false;
            
            await client.rpush(this.queueName, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Redis enqueue error:', error);
            return false;
        }
    }

    async dequeue() {
        try {
            const client = await redisManager.getClient();
            if (!client) return null;
            
            const data = await client.lpop(this.queueName);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Redis dequeue error:', error);
            return null;
        }
    }

    async peek() {
        try {
            const client = await redisManager.getClient();
            if (!client) return null;
            
            const data = await client.lindex(this.queueName, 0);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Redis peek error:', error);
            return null;
        }
    }

    async getLength() {
        try {
            const client = await redisManager.getClient();
            if (!client) return 0;
            
            return await client.llen(this.queueName);
        } catch (error) {
            console.error('Redis getLength error:', error);
            return 0;
        }
    }

    async clear() {
        try {
            const client = await redisManager.getClient();
            if (!client) return false;
            
            await client.del(this.queueName);
            return true;
        } catch (error) {
            console.error('Redis clear error:', error);
            return false;
        }
    }
}

export default RedisQueue;