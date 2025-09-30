import logger from '../utils/common/logger.js';
import { redisManager } from '../utils/redis/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FORBIDDEN_WORDS_KEY = 'moderation:forbidden_words';
const JSON_BACKUP_PATH = path.join(__dirname, '../data/static/forbiddenWords.json');

class ModerationService {
    constructor() {
        this.forbiddenWords = [];
        this.loadForbiddenWords();
        this.backupTimer = null;
        this.backupDelay = 10000;
    }

    async loadForbiddenWords() {
        try {
            const client = await redisManager.getClient();
            const words = await client.smembers(FORBIDDEN_WORDS_KEY);
            
            if (words.length > 0) {
                this.forbiddenWords = words.map(word => new RegExp(`\\b${word}\\b`, 'i'));
                logger.info(`Loaded ${this.forbiddenWords.length} forbidden words for moderation from Redis.`);
            } else {
                try {
                    const jsonContent = await fs.readFile(JSON_BACKUP_PATH, 'utf8');
                    const jsonWords = JSON.parse(jsonContent);
                    if (Array.isArray(jsonWords) && jsonWords.length > 0) {
                        await client.sadd(FORBIDDEN_WORDS_KEY, ...jsonWords);
                        this.forbiddenWords = jsonWords.map(word => new RegExp(`\b${word}\b`, 'i'));
                        logger.info(`Loaded ${this.forbiddenWords.length} forbidden words from JSON backup and synced to Redis.`);
                    } else {
                        logger.info('JSON backup file is empty or invalid.');
                        this.forbiddenWords = [];
                    }
                } catch (jsonError) {
                    if (jsonError.code === 'ENOENT') {
                        logger.info('No JSON backup file found for forbidden words.');
                    } else {
                        logger.error('Failed to load forbidden words from JSON backup:', jsonError);
                    }
                    this.forbiddenWords = [];
                }
            }
        } catch (error) {
            logger.error('Failed to load forbidden words from Redis:', error);
            this.forbiddenWords = [
                new RegExp(`\\bkatajelek1\\b`, 'i'),
                new RegExp(`\\bkatajelek2\\b`, 'i')
            ];
            logger.warn('Using hardcoded forbidden words due to Redis error or empty state.');
        }
    }

    async backupToJson() {
        try {
            const client = await redisManager.getClient();
            const words = await client.smembers(FORBIDDEN_WORDS_KEY);
            const jsonContent = JSON.stringify(words, null, 2);
            await fs.writeFile(JSON_BACKUP_PATH, jsonContent, 'utf8');
            logger.info(`Successfully backed up ${words.length} forbidden words to forbiddenWords.json`);
        } catch (error) {
            logger.error('Failed to back up forbidden words to JSON file:', error);
        }
    }

    scheduleBackup() {
        if (this.backupTimer) {
            clearTimeout(this.backupTimer);
        }
        this.backupTimer = setTimeout(() => {
            this.backupToJson();
        }, this.backupDelay);
        logger.info(`Forbidden words backup scheduled in ${this.backupDelay / 1000} seconds.`);
    }

    async addForbiddenWord(word) {
        try {
            const client = await redisManager.getClient();
            const added = await client.sadd(FORBIDDEN_WORDS_KEY, word.toLowerCase());
            if (added > 0) {
                await this.loadForbiddenWords();
                this.scheduleBackup();
                return true;
            }
            return false;
        } catch (error) {
            logger.error('Failed to add forbidden word to Redis:', error);
            return false;
        }
    }

    async removeForbiddenWord(word) {
        try {
            const client = await redisManager.getClient();
            const removed = await client.srem(FORBIDDEN_WORDS_KEY, word.toLowerCase());
            if (removed > 0) {
                await this.loadForbiddenWords();
                this.scheduleBackup();
                return true;
            }
            return false;
        } catch (error) {
            logger.error('Failed to remove forbidden word from Redis:', error);
            return false;
        }
    }

    async checkMessageForForbiddenWords(message) {
        const chat = await message.getChat();

        if (!chat.isGroup) {
            logger.info('Message not in group, skipping moderation');
            return false;
        }
        
        const config = (await import('../config.js')).default;
        
        if (!config.botNumber) {
            logger.error('BOT_NUMBER not set in environment variables');
            return false;
        }
        
        const botId = config.botNumber;
        logger.info(`Using bot ID: ${botId}`);
        
        const freshChat = await message.getChat();
        
        logger.info(`Group ${freshChat.name} details:`, {
            participantCount: freshChat.participants.length,
            participants: freshChat.participants.map(p => ({
                id: p.id._serialized,
                isAdmin: p.isAdmin
            }))
        });
        
        const botParticipant = freshChat.participants.find(p => p.id._serialized === botId);
        
        logger.info(`Bot participant data:`, botParticipant ? {
            id: botParticipant.id._serialized,
            isAdmin: botParticipant.isAdmin
        } : 'Not found in participants list');
        
        if (!botParticipant) {
            logger.warn(`Bot not found in group ${freshChat.name} (${freshChat.id._serialized})`);
            return false;
        }
        
        if (!botParticipant.isAdmin) {
            logger.warn(`Bot is not admin in group ${freshChat.name} (${freshChat.id._serialized}). Current status:`, {
                botId: botParticipant.id._serialized,
                isAdmin: botParticipant.isAdmin
            });
            return false;
        }

        const fromUser = message.author || message.from;

        const senderParticipant = chat.participants.find(p => p.id._serialized === fromUser);
        if (senderParticipant && senderParticipant.isAdmin) {
            logger.info(`Skipping moderation for admin message from ${fromUser}`);
            return false;
        }

        logger.info(`Checking message from ${fromUser} in group ${chat.name} for forbidden words`);
        const messageBody = message.body.toLowerCase();
        const groupId = chat.id._serialized;

        const securityManager = (await import('../utils/systemService/securityManager.js')).default;
        const isMuted = await securityManager.isUserMuted(fromUser, groupId);
        
        if (isMuted) {
            const timeRemaining = await securityManager.getMuteTimeRemaining(fromUser, groupId);
            try {
                await message.delete(true);
                logger.warn(`Deleted message from muted user ${fromUser}. Mute expires in ${timeRemaining} seconds`);
                return true;
            } catch (error) {
                logger.error(`Failed to delete message from muted user ${fromUser}:`, error);
                return false;
            }
        }

        for (const wordRegex of this.forbiddenWords) {
            if (wordRegex.test(messageBody)) {
                try {
                    await message.delete(true);
                    
                    const result = await securityManager.addWarning(fromUser, groupId, 'forbidden word');
                    if (result.muted) {
                        logger.warn(`User ${fromUser} has been auto-muted for ${result.duration} seconds due to reaching warning threshold`);
                        await message.reply(`⚠️ *Peringatan*\nAnda telah dimute selama ${result.duration} detik karena mencapai batas peringatan.`);
                    } else {
                        await message.reply(`⚠️ *Peringatan*\nPesan dihapus karena mengandung kata terlarang.\nPeringatan: ${result.warnings}/${securityManager.muteThreshold}`);
                    }

                    return true;
                } catch (deleteError) {
                    logger.error(`Failed to delete message from ${fromUser}:`, deleteError);
                    return false;
                }
            }
        }
        return false;
    }
}

export default new ModerationService();