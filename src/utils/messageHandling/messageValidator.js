/**
 * Message validator utility to prevent risky content and behavior
 */

const SPAM_PATTERNS = [
    /(?:\b|^)(jual|beli|promo)\b.*(?:\b|$)(follower|subscriber|like)/i,
    /(?:\b|^)(crypto|bitcoin|eth|bnb|investment)/i,
    /(?:\b|^)(porn|sex|xxx)/i,
    /\b(wa\.me|t\.me)\/([a-zA-Z0-9+])/i
];

const FLOOD_PATTERNS = [
    /(.)\1{9,}/,  // Same character repeated 10+ times
    /(.[^\w\s])\2{4,}/  // Same special character repeated 5+ times
];

class MessageValidator {
    constructor(redisManager) { // Modified constructor
        this.redis = redisManager;
        this.messageHistory = new Map();
        this.WARNING_KEY_PREFIX = 'warnings:';
        this.WARNING_TTL_SECONDS = 24 * 60 * 60; // 24 hours
    }

    /**
     * Check if message contains spam patterns
     */
    containsSpam(message) {
        return SPAM_PATTERNS.some(pattern => pattern.test(message));
    }

    /**
     * Check if message is flooding (repetitive characters/patterns)
     */
    isFlooding(message) {
        return FLOOD_PATTERNS.some(pattern => pattern.test(message));
    }

    /**
     * Check if user is sending too many similar messages
     */
    isDuplicateMessage(userId, message, timeWindow = 60000) {
        if (!this.messageHistory.has(userId)) {
            this.messageHistory.set(userId, []);
        }

        const history = this.messageHistory.get(userId);
        const now = Date.now();

        while (history.length > 0 && now - history[0].time > timeWindow) {
            history.shift();
        }

        const similarCount = history.filter(m => 
            this.calculateSimilarity(m.text, message) > 0.8
        ).length;

        history.push({ text: message, time: now });

        return similarCount >= 3;
    }

    /**
     * Calculate similarity between two strings (simple implementation)
     */
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        return (longer.length - this.levenshteinDistance(longer, shorter)) / longer.length;
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null)
            .map(() => Array(str1.length + 1).fill(null));

        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Add warning for a user
     */
    async addWarning(userId, reason) { // Made async
        const client = await this.redis.getClient();
        if (!client) {
            logger.warn(`Redis client not available for addWarning. Warning for ${userId} not persisted.`);
            return 0; // Indicate failure to persist warning
        }

        const key = `${this.WARNING_KEY_PREFIX}${userId}`;
        const count = await client.incr(key);
        await client.expire(key, this.WARNING_TTL_SECONDS); // Set expiry

        return count;
    }

    /**
     * Get warning count for a user
     */
    async getWarningCount(userId) { // Made async
        const client = await this.redis.getClient();
        if (!client) {
            logger.warn(`Redis client not available for getWarningCount. Returning 0 for ${userId}.`);
            return 0; // Indicate no warnings if Redis is not available
        }

        const key = `${this.WARNING_KEY_PREFIX}${userId}`;
        const count = await client.get(key);

        return parseInt(count) || 0;
    }

    /**
     * Reset warnings for a user
     */
    async resetWarnings(userId) { // Made async
        const client = await this.redis.getClient();
        if (!client) {
            logger.warn(`Redis client not available for resetWarnings. Warnings for ${userId} not reset.`);
            return; // Cannot reset if Redis is not available
        }

        const key = `${this.WARNING_KEY_PREFIX}${userId}`;
        await client.del(key);
    }
}

export default MessageValidator;
