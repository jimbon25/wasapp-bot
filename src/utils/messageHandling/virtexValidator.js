import { MessageAnalyzer, VIRTEX_CONSTANTS } from './messageAnalyzer.js';
import logger from '../common/logger.js';
import { redisManager } from '../redis/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BLACKLIST_KEY = 'blacklist:users';
const JSON_BACKUP_PATH = path.join(__dirname, '../../data/static/blacklist.json');

export class VirtexValidator {
    constructor() {
        this.backupTimer = null;
        this.backupDelay = 10000; // 10 seconds
    }

    async backupToJson() {
        try {
            const client = await redisManager.getClient();
            if (!client) {
                logger.warn('Redis client not available for blacklist backup.');
                return;
            }
            const users = await client.smembers(BLACKLIST_KEY);
            const jsonContent = JSON.stringify({ blockedUsers: users.sort() }, null, 2);
            await fs.writeFile(JSON_BACKUP_PATH, jsonContent, 'utf8');
            logger.info(`Successfully backed up ${users.length} blacklisted users to blacklist.json`);
        } catch (error) {
            logger.error('Failed to back up blacklist to JSON file:', error);
        }
    }

    scheduleBackup() {
        if (this.backupTimer) {
            clearTimeout(this.backupTimer);
        }
        this.backupTimer = setTimeout(() => {
            this.backupToJson();
        }, this.backupDelay);
        logger.info(`Blacklist backup scheduled in ${this.backupDelay / 1000} seconds.`);
    }

    /**
     * Add user to blacklist
     * @param {string} userId - User ID to blacklist
     */
    async addToBlacklist(userId) {
        const client = await redisManager.getClient();
        const added = await client.sadd(BLACKLIST_KEY, userId);
        if (added > 0) {
            logger.warn(`User ${userId} added to blacklist`);
            this.scheduleBackup();
        }
    }

    /**
     * Check if a message contains virtex
     * @param {string} message - Message content to check
     * @returns {Object} Validation result
     */
    validateMessage(message, command = null) {
        if (!message || typeof message !== 'string') {
            return { isVirtex: false };
        }

        const length = message.length;
        const specialCharCount = MessageAnalyzer.countSpecialCharacters(message);
        const hasRepeatedChars = MessageAnalyzer.hasRepeatedCharacters(message);
        const specialCharRatio = specialCharCount / length;
        
        const isWhitelisted = command && VIRTEX_CONSTANTS.WHITELISTED_COMMANDS.includes(command);

        const reasons = [];

        const maxLength = isWhitelisted ? VIRTEX_CONSTANTS.WHITELISTED_MAX_LENGTH : VIRTEX_CONSTANTS.MAX_MESSAGE_LENGTH;
        if (length > maxLength) {
            reasons.push(`Message too long (${length} > ${maxLength})`);
        }

        if (specialCharRatio > VIRTEX_CONSTANTS.MAX_EMOJI_RATIO) {
            reasons.push(`Too many special characters (${Math.round(specialCharRatio * 100)}%)`);
        }

        if (hasRepeatedChars) {
            reasons.push('Suspicious character repetition detected');
        }

        const isVirtex = reasons.length > 0;

        if (isVirtex) {
            logger.warn('Virtex detected', {
                length,
                specialCharCount,
                specialCharRatio,
                hasRepeatedChars,
                reasons
            });
        }

        return {
            isVirtex,
            reasons,
            details: {
                length,
                specialCharCount,
                specialCharRatio,
                hasRepeatedChars
            }
        };
    }

    /**
     * Check if a user is blacklisted
     * @param {string} userId - User ID to check
     * @returns {Promise<boolean>} True if user is blacklisted
     */
    async isBlacklisted(userId) {
        const client = await redisManager.getClient();
        return await client.sismember(BLACKLIST_KEY, userId);
    }
}
