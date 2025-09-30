/**
 * Constants for virtex detection
 */
import dotenv from 'dotenv';
dotenv.config();

const whitelistedCommands = (process.env.WHITELISTED_COMMANDS || '/text2pdf,/ask,/translate').split(',');
const maxWhitelistedLength = parseInt(process.env.MAX_WHITELISTED_LENGTH || '5000', 10);

import config from '../../config.js';

export const VIRTEX_CONSTANTS = {
    MAX_MESSAGE_LENGTH: config.security.virtex.maxMessageLength,
    MAX_EMOJI_RATIO: config.security.virtex.maxEmojiRatio,
    MAX_REPEATED_CHARS: config.security.virtex.maxRepeatedChars,
    SUSPICIOUS_UNICODE_RANGES: [
        [0x1F300, 0x1F9FF],  // Emoji & Symbols
        [0x2600, 0x26FF],    // Misc Symbols
        [0x2700, 0x27BF],    // Dingbats
        [0xFE00, 0xFE0F],    // Variation Selectors
        [0x200B, 0x200F],    // Zero-width chars & directional marks
        [0x2028, 0x202F],    // Special whitespace
    ],
    WHITELISTED_COMMANDS: whitelistedCommands,
    WHITELISTED_MAX_LENGTH: maxWhitelistedLength
};

/**
 * Utilities for analyzing message content
 */
export class MessageAnalyzer {
    /**
     * Count emoji and special characters in text
     * @param {string} text - Text to analyze
     * @returns {number} Count of emoji and special characters
     */
    static countSpecialCharacters(text) {
        let count = 0;
        for (let i = 0; i < text.length; i++) {
            const code = text.codePointAt(i);
            if (code > 0x7F || // Non-ASCII
                VIRTEX_CONSTANTS.SUSPICIOUS_UNICODE_RANGES.some(([start, end]) => 
                    code >= start && code <= end)) {
                count++;
            }
        }
        return count;
    }

    /**
     * Check for repeated characters (potential spam)
     * @param {string} text - Text to analyze
     * @returns {boolean} True if suspicious repetition found
     */
    static hasRepeatedCharacters(text) {
        let count = 1;
        for (let i = 1; i < text.length; i++) {
            if (text[i] === text[i - 1]) {
                count++;
                if (count > VIRTEX_CONSTANTS.MAX_REPEATED_CHARS) {
                    return true;
                }
            } else {
                count = 1;
            }
        }
        return false;
    }
}