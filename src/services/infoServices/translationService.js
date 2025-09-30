import translate from 'translate-google';
import logger from '../../utils/common/logger.js';
import { redisManager } from '../../utils/redis/index.js';
import config from '../../config.js';

/**
 * Service for handling translation functionality using translate-google (free version)
 */
class TranslationService {
    constructor() {
        this.cacheDuration = config.app.translation.cacheDuration * 1000; // Convert seconds to milliseconds
    }

    /**
     * Generate cache key for translation
     */
    getCacheKey(text, targetLang, sourceLang = 'auto') {
        return `translate:${sourceLang}:${targetLang}:${text}`;
    }

    /**
     * Get cached translation if available
     */
    async getCachedTranslation(text, targetLang, sourceLang = 'auto') {
        try {
            const client = await redisManager.getClient();
            if (!client) return null;

            const key = this.getCacheKey(text, targetLang, sourceLang);
            const cached = await client.get(key);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            logger.error('Error getting cached translation:', error);
            return null;
        }
    }

    /**
     * Cache translation result
     */
    async cacheTranslation(text, targetLang, result, sourceLang = 'auto') {
        try {
            const client = await redisManager.getClient();
            if (!client) return;

            const key = this.getCacheKey(text, targetLang, sourceLang);
            await client.set(key, JSON.stringify(result), 'PX', this.cacheDuration);
        } catch (error) {
            logger.error('Error caching translation:', error);
        }
    }

    /**
     * Translate text using translate-google
     */
    isValidLanguage(langCode) {
        const normalizedCode = langCode.toUpperCase();
        return this.getSupportedLanguages().some(lang => 
            lang.code.toUpperCase() === normalizedCode
        );
    }

    async translate(text, targetLang, sourceLang = 'auto') {
        try {
            if (!this.isValidLanguage(targetLang)) {
                throw new Error(`Bahasa '${targetLang}' tidak didukung. Gunakan /translate languages untuk melihat daftar bahasa yang didukung.`);
            }

            if (sourceLang !== 'auto' && !this.isValidLanguage(sourceLang)) {
                throw new Error(`Bahasa sumber '${sourceLang}' tidak didukung. Gunakan /translate languages untuk melihat daftar bahasa yang didukung.`);
            }

            const cached = await this.getCachedTranslation(text, targetLang, sourceLang);
            if (cached) {
                logger.info('Using cached translation');
                return cached;
            }

            const options = {
                to: targetLang.toUpperCase()
            };
            if (sourceLang !== 'auto') {
                options.from = sourceLang.toUpperCase();
            }

            const translatedText = await translate(text, options);

            const result = {
                translatedText,
                detectedSourceLanguage: sourceLang === 'auto' ? await this.detectLanguage(text) : sourceLang
            };

            await this.cacheTranslation(text, targetLang, result, sourceLang);

            return result;
        } catch (error) {
            logger.error('Translation error:', error);
            throw new Error('Failed to translate text: ' + error.message);
        }
    }

    /**
     * Detect language of text
     */
    async detectLanguage(text) {
        try {
            const result = await translate(text, { to: 'en' });
            return result.from && result.from.language.iso || 'unknown';
        } catch (error) {
            logger.error('Language detection error:', error);
            return 'unknown';
        }
    }

    /**
     * Get list of supported languages
     */
    getSupportedLanguages() {
        return [
            { code: 'id', name: 'Indonesian' },
            { code: 'en', name: 'English' },
            { code: 'ar', name: 'Arabic' },
            { code: 'ja', name: 'Japanese' },
            { code: 'ko', name: 'Korean' },
            { code: 'zh-CN', name: 'Chinese (Simplified)' }, // Updated code
            { code: 'zh-TW', name: 'Chinese (Traditional)' }, // Updated code
            { code: 'ms', name: 'Malay' },
            { code: 'nl', name: 'Dutch' },
            { code: 'fr', name: 'French' },
            { code: 'de', name: 'German' },
            { code: 'es', name: 'Spanish' },
            { code: 'it', name: 'Italian' },
            { code: 'pt', name: 'Portuguese' },
            { code: 'ru', name: 'Russian' },
            { code: 'tr', name: 'Turkish' },
            { code: 'vi', name: 'Vietnamese' },
            { code: 'th', name: 'Thai' },
            { code: 'hi', name: 'Hindi' },
            { code: 'bn', name: 'Bengali' }
        ];
    }
}

export default new TranslationService();