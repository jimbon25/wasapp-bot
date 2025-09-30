import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/common/logger.js';
import { redisManager } from '../utils/redis/index.js';
import fileManager from '../utils/fileManagement/fileManager.js';
import pkg from 'whatsapp-web.js';
const { MessageMedia, Location } = pkg;
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JSON_BACKUP_PATH = path.join(__dirname, '../data/static/autoreply.json');

const KEY_PREFIX = 'autoreply';

class AutoReplyManager {
    constructor() {
        this.backupTimer = null;
        this.backupDelay = 10000;
    }

    getKey(scope, contextId = '') {
        if (scope === 'global') return `${KEY_PREFIX}:global`;
        if (scope === 'group' && contextId) return `${KEY_PREFIX}:group:${contextId}`;
        if (scope === 'user' && contextId) return `${KEY_PREFIX}:user:${contextId}`;
        throw new Error(`Invalid scope or missing contextId for autoreply key. Scope: ${scope}, ContextID: ${contextId}`);
    }

    async backupRulesToJson() {
        try {
            const client = await redisManager.getClient();
            const allKeys = await client.keys(`${KEY_PREFIX}:*`);
            
            const backupData = {
                global: [],
                groups: {},
                users: {}
            };

            for (const key of allKeys) {
                const rules = await client.hgetall(key);
                const rulesArray = Object.values(rules).map(jsonString => JSON.parse(jsonString));

                if (key.includes(':global')) {
                    backupData.global = rulesArray;
                } else if (key.includes(':group:')) {
                    const groupId = key.split(':').pop();
                    backupData.groups[groupId] = rulesArray;
                } else if (key.includes(':user:')) {
                    const userId = key.split(':').pop();
                    backupData.users[userId] = rulesArray;
                }
            }

            const jsonContent = JSON.stringify(backupData, null, 2);
            await fs.writeFile(JSON_BACKUP_PATH, jsonContent, 'utf8');
            logger.info(`Successfully backed up all autoreply rules to autoreply.json`);
        } catch (error) {
            logger.error('Failed to back up autoreply rules to JSON file:', error);
        }
    }

    scheduleBackup() {
        if (this.backupTimer) clearTimeout(this.backupTimer);
        this.backupTimer = setTimeout(() => this.backupRulesToJson(), this.backupDelay);
    }

    async addRule(scope, contextId, keywords, replyData) {
        try {
            if (!keywords || keywords.length === 0) throw new Error('Keywords cannot be empty.');
            
            const primaryKey = keywords[0].toLowerCase();
            const patternBody = keywords.map(kw => kw.toLowerCase().replace(/[.*+?^${}()|[\\]/g, '\\$&')).join('|');
            const finalPattern = `\\b(?:${patternBody})\\b`;

            const rule = {
                primaryKey: primaryKey,
                keywords: keywords,
                reply: replyData,
                pattern: finalPattern,
                scope: scope,
                contextId: contextId
            };
            
            const client = await redisManager.getClient();
            const redisKey = this.getKey(scope, contextId);
            await client.hset(redisKey, primaryKey, JSON.stringify(rule));
            
            this.scheduleBackup();
            return { success: true, pattern: finalPattern };
        } catch (error) {
            logger.error('Failed to add autoreply rule:', error);
            throw error;
        }
    }

    async deleteRule(scope, contextId, primaryKey) {
        try {
            const client = await redisManager.getClient();
            const redisKey = this.getKey(scope, contextId);
            
            const ruleJson = await client.hget(redisKey, primaryKey);
            if (!ruleJson) return false;

            const ruleToDelete = JSON.parse(ruleJson);
            const result = await client.hdel(redisKey, primaryKey);
            
            if (result > 0) {
                if (ruleToDelete.reply && ruleToDelete.reply.path) {
                    const mediaTypes = ['image', 'sticker', 'video', 'document'];
                    if (mediaTypes.includes(ruleToDelete.reply.type)) {
                        try {
                            await fileManager.deleteFile(ruleToDelete.reply.path);
                            logger.info(`Deleted associated media file: ${ruleToDelete.reply.path}`);
                        } catch (fileError) {
                            logger.error(`Failed to delete associated media file ${ruleToDelete.reply.path}:`, fileError);
                        }
                    }
                }
                this.scheduleBackup();
            }
            return result > 0;
        } catch (error) {
            logger.error('Failed to delete autoreply rule:', error);
            throw error;
        }
    }

    async listRules(scope, contextId) {
        try {
            const client = await redisManager.getClient();
            const redisKey = this.getKey(scope, contextId);
            const rules = await client.hgetall(redisKey);
            if (!rules) return [];
            return Object.values(rules).map(jsonString => JSON.parse(jsonString));
        } catch (error) {
            logger.error('Failed to list autoreply rules:', error);
            throw error;
        }
    }

    async getRulesForContext(scope, contextId) {
        try {
            const client = await redisManager.getClient();
            const redisKey = this.getKey(scope, contextId);
            const rules = await client.hgetall(redisKey);
            if (!rules) return [];

            return Object.values(rules).map(jsonString => {
                try {
                    const rule = JSON.parse(jsonString);
                    return {
                        pattern: new RegExp(rule.pattern, 'i'),
                        reply: rule.reply
                    };
                } catch (e) {
                    logger.warn(`Invalid JSON in autoreply rule: ${jsonString}`, e);
                    return null;
                }
            }).filter(r => r !== null);
        } catch (error) {
            logger.error(`Failed to load autoreply data from Redis for scope ${scope}:`, error);
            return [];
        }
    }

    async handleMessage(message) {
        try {
            if (message.fromMe) return false;

            const chat = await message.getChat();
            const userId = message.author || message.from;
            const groupId = chat.isGroup ? chat.id._serialized : null;

            if (chat.isGroup) {
                if (!config.botNumber) {
                    logger.error('BOT_NUMBER is not set in .env, cannot check admin status for autoreply.');
                    return false;
                }
                const botId = config.botNumber;
                const botParticipant = chat.participants.find(p => p.id._serialized === botId);
                if (!botParticipant || !botParticipant.isAdmin) {
                    return false;
                }
            }

            const searchText = message.body.toLowerCase().trim();
            
            const scopesToCheck = [
                { scope: 'user', contextId: userId },
            ];
            if (groupId) {
                scopesToCheck.push({ scope: 'group', contextId: groupId });
            }
            scopesToCheck.push({ scope: 'global', contextId: '' });

            for (const { scope, contextId } of scopesToCheck) {
                const rules = await this.getRulesForContext(scope, contextId);
                for (const entry of rules) {
                    if (entry.pattern.test(searchText)) {
                        logger.info(`Autoreply triggered (Scope: ${scope}) for message: "${searchText}"`);
                        
                        const replyContent = entry.reply;

                        switch (replyContent.type) {
                            case 'text':
                                await message.reply(replyContent.content);
                                break;
                            case 'image':
                                if (replyContent.path) {
                                    const media = MessageMedia.fromFilePath(replyContent.path);
                                    await message.reply(media, null, { caption: replyContent.caption || '' });
                                } else {
                                    await message.reply('Maaf, gambar balasan tidak ditemukan.');
                                }
                                break;
                            case 'sticker':
                                if (replyContent.path) {
                                    const media = MessageMedia.fromFilePath(replyContent.path);
                                    await message.reply(media, null, { sendMediaAsSticker: true });
                                } else {
                                    await message.reply('Maaf, stiker balasan tidak ditemukan.');
                                }
                                break;
                            case 'location':
                                if (replyContent.latitude && replyContent.longitude) {
                                    const location = new Location(replyContent.latitude, replyContent.longitude, replyContent.description || ' ');
                                    await message.reply(location);
                                } else {
                                    await message.reply('Maaf, lokasi balasan tidak valid.');
                                }
                                break;
                            default:
                                logger.warn(`Unsupported reply type: ${replyContent.type} for pattern: ${entry.pattern}`);
                                await message.reply('Maaf, tipe balasan tidak didukung.');
                                break;
                        }
                        return true;
                    }
                }
            }
            return false;
        } catch (error) {
            logger.error('Error in autoreply handler', error);
            return false;
        }
    }
}

const autoReplyManager = new AutoReplyManager();

export default {
    name: 'autoreply',
    description: 'Fitur auto reply untuk kata kunci tertentu',
    execute: async (message) => {
        return await autoReplyManager.handleMessage(message);
    }
};

export { autoReplyManager };