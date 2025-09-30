import fs from 'fs/promises';
import path from 'path';
import logger from '../common/logger.js';
import { redisManager } from '../redis/index.js';

import config from '../../config.js';

const MEMORY_FILE_PATH = path.join(process.cwd(), config.system.memory.filePath);
const CHAT_HISTORY_KEY_PREFIX = config.system.memory.prefix;

class MemoryManager {
    constructor() {
        this.maxHistory = config.system.memory.maxHistory;
        this.initialized = false;
        this.backupTimer = null;
        this.backupDelay = config.system.memory.backupDelay;
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            const dataDir = path.dirname(MEMORY_FILE_PATH);
            await fs.mkdir(dataDir, { recursive: true });

            await this.loadMemories();
            
            this.initialized = true;
            logger.info('MemoryManager initialized with Redis and JSON backup.');
        } catch (error) {
            logger.error('Failed to initialize MemoryManager:', error);
            this.initialized = false;
            throw error;
        }
    }

    async loadMemories() {
        try {
            const client = await redisManager.getClient();
            if (!client) {
                logger.warn('Redis client not available. Cannot load memories from Redis.');
                await this._loadFromJsonBackup();
                return;
            }

            const existingKeys = await client.keys(`${CHAT_HISTORY_KEY_PREFIX}*`);
            if (existingKeys.length === 0) {
                logger.info('No existing chat history in Redis. Attempting to load from JSON backup.');
                await this._loadFromJsonBackup();
            } else {
                logger.info(`Loaded ${existingKeys.length} chat histories from Redis.`);
            }
        } catch (error) {
            logger.error('Error loading memories from Redis:', error);
            await this._loadFromJsonBackup();
        }
    }

    async _loadFromJsonBackup() {
        try {
            const data = await fs.readFile(MEMORY_FILE_PATH, 'utf8');
            const parsed = JSON.parse(data);
            
            const client = await redisManager.getClient();
            if (client) {
                for (const userId in parsed) {
                    if (Object.prototype.hasOwnProperty.call(parsed, userId)) {
                        const history = parsed[userId];
                        for (const msg of history) {
                            await client.rpush(`${CHAT_HISTORY_KEY_PREFIX}${userId}`, JSON.stringify(msg));
                        }
                        await client.ltrim(`${CHAT_HISTORY_KEY_PREFIX}${userId}`, 0, this.maxHistory - 1);
                    }
                }
                logger.info(`Populated Redis with ${Object.keys(parsed).length} chat histories from JSON backup.`);
            } else {
                logger.warn('Redis client not available. Cannot populate from JSON backup to Redis.');
            }
            logger.info('Memories loaded from JSON backup.');
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.info('No existing JSON memory file, starting fresh.');
            } else {
                logger.error('Error loading memories from JSON backup:', error);
            }
        }
    }

    async backupToJson() {
        try {
            const client = await redisManager.getClient();
            if (!client) {
                logger.warn('Redis client not available. Skipping JSON backup.');
                return;
            }

            const allKeys = await client.keys(`${CHAT_HISTORY_KEY_PREFIX}*`);
            const allMemories = {};

            for (const key of allKeys) {
                const userId = key.replace(CHAT_HISTORY_KEY_PREFIX, '');
                const history = await client.lrange(key, 0, -1);
                allMemories[userId] = history.map(msg => JSON.parse(msg));
            }
            
            await fs.writeFile(MEMORY_FILE_PATH, JSON.stringify(allMemories, null, 2));
            logger.info(`Successfully backed up ${Object.keys(allMemories).length} chat histories to JSON.`);
        } catch (error) {
            logger.error('Error backing up memories to JSON:', error);
        }
    }

    scheduleBackup() {
        if (this.backupTimer) {
            clearTimeout(this.backupTimer);
        }
        this.backupTimer = setTimeout(() => {
            this.backupToJson();
        }, this.backupDelay);
        logger.info(`JSON backup scheduled in ${this.backupDelay / 1000} seconds.`);
    }

    async addMemory(userId, role, content) {
        const client = await redisManager.getClient();
        if (!client) {
            logger.warn('Redis client not available. Cannot add memory.');
            return;
        }

        const key = `${CHAT_HISTORY_KEY_PREFIX}${userId}`;
        const messageObject = {
            role,
            parts: [{ text: content }],
            timestamp: new Date().toISOString()
        };

        await client.rpush(key, JSON.stringify(messageObject));
        await client.ltrim(key, -this.maxHistory, -1);

        this.scheduleBackup();
    }

    async getUserMemory(userId) {
        const client = await redisManager.getClient();
        if (!client) {
            logger.warn('Redis client not available. Cannot get user memory.');
            return [];
        }
        const key = `${CHAT_HISTORY_KEY_PREFIX}${userId}`;
        const history = await client.lrange(key, 0, -1);
        return history.map(msg => JSON.parse(msg));
    }

    async clearMemory(userId) {
        const client = await redisManager.getClient();
        if (!client) {
            logger.warn('Redis client not available. Cannot clear memory.');
            return;
        }
        const key = `${CHAT_HISTORY_KEY_PREFIX}${userId}`;
        await client.del(key);
        this.scheduleBackup();
        logger.info(`Cleared memory for user: ${userId}`);
    }

    async formatMemoryForAI(userId, mode) {
        const userMemory = await this.getUserMemory(userId);
        const formattedMemory = userMemory.slice(-this.maxHistory)
            .map((msg, index) => {
                const role = msg.role === 'user' ? 'User' : 'Assistant';
                return `${role}: ${msg.parts[0].text}`;
            })
            .join('\n');
        return formattedMemory;
    }
}

export default new MemoryManager();
