import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../common/logger.js';
import { redisManager } from '../redis/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JSON_BACKUP_PATH = path.join(__dirname, '../../data/static/welcome.json');

const WELCOME_KEY = 'welcome_messages';

class WelcomeManager {
    constructor() {
        this.messages = new Map();
        this.backupTimer = null;
        this.backupDelay = 10000;
    }

    async loadMessages() {
        try {
            const client = await redisManager.getClient();
            const messages = await client.hgetall(WELCOME_KEY);
            
            if (!messages) {
                logger.warn('No welcome messages found in Redis');
                this.messages.clear();
                return;
            }

            this.messages = new Map(Object.entries(messages));
            logger.info(`Loaded ${this.messages.size} welcome messages from Redis`);
        } catch (error) {
            logger.error('Failed to load welcome messages from Redis', error);
            this.messages.clear();
        }
    }

    async backupToJson() {
        try {
            const messages = await this.listMessages();
            const jsonContent = JSON.stringify(messages, null, 2);
            await fs.writeFile(JSON_BACKUP_PATH, jsonContent, 'utf8');
            logger.info(`Successfully backed up ${Object.keys(messages).length} welcome messages to welcome.json`);
        } catch (error) {
            logger.error('Failed to back up welcome messages to JSON file:', error);
        }
    }

    scheduleBackup() {
        if (this.backupTimer) {
            clearTimeout(this.backupTimer);
        }
        this.backupTimer = setTimeout(() => {
            this.backupToJson();
        }, this.backupDelay);
        logger.info(`Welcome messages backup scheduled in ${this.backupDelay / 1000} seconds.`);
    }

    async setWelcome(groupId, message) {
        try {
            const client = await redisManager.getClient();
            await client.hset(WELCOME_KEY, groupId, message);
            this.scheduleBackup();
            await this.loadMessages();
            return true;
        } catch (error) {
            logger.error('Failed to set welcome message:', error);
            throw error;
        }
    }

    async deleteWelcome(groupId) {
        try {
            const client = await redisManager.getClient();
            const result = await client.hdel(WELCOME_KEY, groupId);
            if (result > 0) {
                this.scheduleBackup();
                await this.loadMessages();
            }
            return result > 0;
        } catch (error) {
            logger.error('Failed to delete welcome message:', error);
            throw error;
        }
    }

    async getWelcome(groupId) {
        try {
            const client = await redisManager.getClient();
            return await client.hget(WELCOME_KEY, groupId);
        } catch (error) {
            logger.error('Failed to get welcome message:', error);
            throw error;
        }
    }

    async listMessages() {
        try {
            const client = await redisManager.getClient();
            const messages = await client.hgetall(WELCOME_KEY);
            return messages || {};
        } catch (error) {
            logger.error('Failed to list welcome messages:', error);
            throw error;
        }
    }
}

const welcomeManager = new WelcomeManager();
export default welcomeManager;