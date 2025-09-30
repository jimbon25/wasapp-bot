import RateLimiter from './rateLimiter.js';
import MessageValidator from '../messageHandling/messageValidator.js';
import MessageQueue from '../messageHandling/messageQueue.js';
import logger from '../common/logger.js';
import { VirtexValidator } from '../messageHandling/virtexValidator.js';
import groupSecurityManager from '../groupManagement/groupSecurityManager.js'; // <-- Impor baru
import config from '../../config.js';
import { redisManager } from '../redis/index.js'; // Added import

class SecurityManager {
    constructor() {
        this.adminNumbers = config.adminNumbers || [];
        this.commandLimiter = new RateLimiter(config.security.commandLimiter);
        this.aiCommandLimiter = new RateLimiter(config.security.aiCommandLimiter);
        this.translateLimiter = new RateLimiter(config.security.translateLimiter);
        this.virtexValidator = new VirtexValidator();
        this.messageLimiter = new RateLimiter(config.security.messageLimiter);
        this.validator = new MessageValidator(redisManager);
        this.messageQueue = new MessageQueue({
            processingInterval: 1000,
            maxQueueSize: 50
        });
        this.commandCooldowns = config.security.cooldowns;
        this.userCooldowns = new Map();
        this.warningsKey = 'moderation:warnings';
        this.mutedUsersKey = 'moderation:muted_users';
        this.muteThreshold = config.security.autoMute.warningThreshold;
        this.muteDuration = config.security.autoMute.durationSeconds;
    }

    /**
     * Add warning to a user and check for auto-mute threshold
     */
    async addWarning(userId, groupId, reason) {
        try {
            const client = await redisManager.getClient();
            const warningKey = `${this.warningsKey}:${groupId}:${userId}`;
            
            const warnings = await client.incr(warningKey);
            
            if (warnings >= this.muteThreshold) {
                await this.muteUser(userId, groupId);
                await client.del(warningKey);
                return {
                    warnings: 0,
                    muted: true,
                    duration: this.muteDuration
                };
            }

            return {
                warnings,
                muted: false
            };
        } catch (error) {
            logger.error('Error adding warning:', error);
            return { warnings: 0, error: true };
        }
    }

    async getWarnings(userId, groupId) {
        try {
            const client = await redisManager.getClient();
            const warningKey = `${this.warningsKey}:${groupId}:${userId}`;
            const warnings = await client.get(warningKey);
            return parseInt(warnings) || 0;
        } catch (error) {
            logger.error('Error getting warnings:', error);
            return 0;
        }
    }

    async resetWarnings(userId, groupId) {
        try {
            const client = await redisManager.getClient();
            const warningKey = `${this.warningsKey}:${groupId}:${userId}`;
            await client.del(warningKey);
            await this.unmuteUser(userId, groupId);
            return true;
        } catch (error) {
            logger.error('Error resetting warnings:', error);
            return false;
        }
    }

    async muteUser(userId, groupId) {
        try {
            const client = await redisManager.getClient();
            const muteKey = `${this.mutedUsersKey}:${groupId}:${userId}`;
            
            await client.set(muteKey, 'muted');
            await client.expire(muteKey, this.muteDuration);
            
            logger.warn(`User ${userId} has been muted in group ${groupId} for ${this.muteDuration} seconds`);
            return true;
        } catch (error) {
            logger.error('Error muting user:', error);
            return false;
        }
    }

    async isUserMuted(userId, groupId) {
        try {
            const client = await redisManager.getClient();
            const muteKey = `${this.mutedUsersKey}:${groupId}:${userId}`;
            const isMuted = await client.exists(muteKey);
            return isMuted === 1;
        } catch (error) {
            logger.error('Error checking mute status:', error);
            return false;
        }
    }

    async getMuteTimeRemaining(userId, groupId) {
        try {
            const client = await redisManager.getClient();
            const muteKey = `${this.mutedUsersKey}:${groupId}:${userId}`;
            const ttl = await client.ttl(muteKey);
            return ttl > 0 ? ttl : 0;
        } catch (error) {
            logger.error('Error getting mute time remaining:', error);
            return 0;
        }
    }

    async unmuteUser(userId, groupId) {
        try {
            const client = await redisManager.getClient();
            const muteKey = `${this.mutedUsersKey}:${groupId}:${userId}`;
            await client.del(muteKey);
            logger.info(`User ${userId} has been manually unmuted in group ${groupId}`);
            return true;
        } catch (error) {
            logger.error('Error unmuting user:', error);
            return false;
        }
    }

    /**
     * Check if a command can be executed
     */
    async canExecuteCommand(userId, commandType = 'default') {
        const limiter = commandType === 'ai' ? this.aiCommandLimiter : this.commandLimiter;
        
        if (!limiter.tryConsume(userId)) {
            const waitTime = commandType === 'ai' ? '5 seconds' : '1 second';
            return {
                allowed: false,
                reason: `Rate limit exceeded. Please wait ${waitTime} between commands.`
            };
        }

        const cooldown = this.commandCooldowns[commandType] || this.commandCooldowns.default;
        const lastUse = this.userCooldowns.get(`${userId}-${commandType}`);
        const now = Date.now();

        if (lastUse && now - lastUse < cooldown) {
            return {
                allowed: false,
                reason: `Command on cooldown. Please wait ${Math.ceil((cooldown - (now - lastUse)) / 1000)} seconds.`
            };
        }

        const warningCount = this.validator.getWarningCount(userId);
        if (warningCount >= 5) {
            return {
                allowed: false,
                reason: 'Too many warnings. Access temporarily restricted.'
            };
        }

        this.userCooldowns.set(`${userId}-${commandType}`, now);

        return { allowed: true };
    }

    /**
     * Validate and queue a message
     */
    async validateAndQueueMessage(message, sendFunction) {
        // Extract info from message object
        const chat = await message.getChat();
        const userId = message.author || message.from;
        const groupId = chat.isGroup ? chat.id._serialized : null;
        const messageBody = message.body;
        const messageType = message.type;

        if (await groupSecurityManager.isGroupBlacklisted(groupId)) {
            logger.warn(`Pesan dari grup yang diblokir diabaikan: ${groupId}`);
            return { allowed: false, reason: 'Group is blacklisted.' };
        }

        if (await this.virtexValidator.isBlacklisted(userId)) {
            return {
                allowed: false,
                reason: 'Your access has been restricted due to previous violations.'
            };
        }

        if (messageType === 'chat') {
            const command = messageBody.startsWith('/') ? messageBody.split(' ')[0].toLowerCase() : null;
            
            const virtexCheck = this.virtexValidator.validateMessage(messageBody, command);
            if (virtexCheck.isVirtex) {
                logger.warn('Virtex detected', {
                    userId,
                    reasons: virtexCheck.reasons,
                    details: virtexCheck.details
                });

                await this.virtexValidator.addToBlacklist(userId);
                await groupSecurityManager.handleGroupViolation(groupId);

                return {
                    allowed: false,
                    reason: 'Pesan terdeteksi sebagai spam/virtex 🚫'
                };
            }

            if (this.validator.containsSpam(messageBody)) {
                this.validator.addWarning(userId, 'spam_content');
                return {
                    allowed: false,
                    reason: 'Message contains spam content.'
                };
            }

            if (this.validator.isFlooding(messageBody)) {
                this.validator.addWarning(userId, 'message_flooding');
                return {
                    allowed: false,
                    reason: 'Please avoid message flooding.'
                };
            }

            if (this.validator.isDuplicateMessage(userId, messageBody)) {
                this.validator.addWarning(userId, 'duplicate_messages');
                return {
                    allowed: false,
                    reason: 'Too many similar messages.'
                };
            }
        }

        if (!this.messageLimiter.tryConsume(userId)) {
            return {
                allowed: false,
                reason: 'Message rate limit exceeded. Please slow down.'
            };
        }

        try {
            await this.messageQueue.enqueue(userId, sendFunction);
            return { allowed: true };
        } catch (error) {
            logger.error('Error queuing message:', error);
            return {
                allowed: false,
                reason: 'Message queue full. Please try again later.'
            };
        }
    }

    /**
     * Get security status for a user
     */
    getUserStatus(userId) {
        return {
            warningCount: this.validator.getWarningCount(userId),
            queueLength: this.messageQueue.getQueueLength(userId),
            commandTokens: this.commandLimiter.getTokens(userId),
            messageTokens: this.messageLimiter.getTokens(userId)
        };
    }

    /**
     * Reset all restrictions for a user
     */
    resetUser(userId) {
        this.validator.resetWarnings(userId);
        this.messageQueue.clearQueue(userId);
        this.commandLimiter.resetBucket(userId);
        this.messageLimiter.resetBucket(userId);
        this.userCooldowns.clear();
    }

    /**
     * Check if a user is an admin based on their WhatsApp ID
     * @param {string} userId - WhatsApp user ID (e.g., 628123456789@c.us)
     * @returns {boolean} - True if user is an admin, false otherwise
     */
    isAdmin(userId) {
        logger.info(`[Admin Check] Checking status for ${userId} against admin list: ${JSON.stringify(this.adminNumbers)}`);
        const isAdmin = this.adminNumbers.includes(userId);
        logger.info(`[Admin Check] Result for ${userId}: ${isAdmin}`);
        return isAdmin;
    }

    /**
     * Check if a user is authorized for a specific role
     * @param {string} userId - WhatsApp user ID
     * @param {string} role - Role to check (e.g., 'admin', 'moderator', etc.)
     * @returns {Promise<boolean>} - True if user is authorized for the role
     */
    async isAuthorized(message, role) {
        if (role !== 'admin') {
            return true;
        }

        const contact = await message.getContact();
        const senderId = contact.id._serialized;

        logger.info(`[Auth] Checking admin auth for user ${senderId}`);

        if (this.isAdmin(senderId)) {
            logger.info(`[Auth] User ${senderId} is a Super Admin. Access granted.`);
            return true;
        }
        logger.info(`[Auth] User ${senderId} is NOT a Super Admin.`);

        const chat = await message.getChat();
        if (chat.isGroup) {
            logger.info(`[Auth] Command run in group: ${chat.name}. Checking group admin status.`);
            const participant = chat.participants.find(p => p.id._serialized === senderId);
            
            if (participant) {
                logger.info(`[Auth] Found participant object for ${senderId}. Is admin: ${participant.isAdmin}`);
                if (participant.isAdmin) {
                    logger.info(`[Auth] User ${senderId} is a Group Admin. Access granted.`);
                    return true;
                }
            } else {
                logger.warn(`[Auth] Could NOT find participant object for ${senderId} in group ${chat.name}.`);
            }
        } else {
            logger.info(`[Auth] Command not run in a group. Private chat access is for Super Admins only.`);
        }

        logger.warn(`[Auth] All checks failed for ${senderId}. Access denied.`);
        return false;
    }

    /**
     * Check if a user has a specific permission
     * @param {string} userId - WhatsApp user ID
     * @param {string} permission - Permission to check
     * @returns {Promise<boolean>} - True if user has the permission
     */
    async hasPermission(message, permission) {
        const contact = await message.getContact();
        const senderId = contact.id._serialized;

        if (this.isAdmin(senderId)) {
            return true;
        }

        switch (permission) {
            case 'translate':
                return this.translateLimiter.tryConsume(senderId);
            case 'ai':
                return this.aiCommandLimiter.tryConsume(senderId);
            default:
                return this.commandLimiter.tryConsume(senderId);
        }
    }
}

const securityManagerInstance = new SecurityManager();
export default securityManagerInstance;