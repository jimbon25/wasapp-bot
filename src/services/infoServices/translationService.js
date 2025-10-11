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
            { code: 'af', name: 'Afrikaans' },
            { code: 'sq', name: 'Albanian' },
            { code: 'am', name: 'Amharic' },
            { code: 'ar', name: 'Arabic' },
            { code: 'hy', name: 'Armenian' },
            { code: 'as', name: 'Assamese' },
            { code: 'ay', name: 'Aymara' },
            { code: 'az', name: 'Azerbaijani' },
            { code: 'bm', name: 'Bambara' },
            { code: 'eu', name: 'Basque' },
            { code: 'be', name: 'Belarusian' },
            { code: 'bn', name: 'Bengali' },
            { code: 'bho', name: 'Bhojpuri' },
            { code: 'bs', name: 'Bosnian' },
            { code: 'bg', name: 'Bulgarian' },
            { code: 'ca', name: 'Catalan' },
            { code: 'ceb', name: 'Cebuano' },
            { code: 'zh-CN', name: 'Chinese (Simplified)' },
            { code: 'zh-TW', name: 'Chinese (Traditional)' },
            { code: 'co', name: 'Corsican' },
            { code: 'hr', name: 'Croatian' },
            { code: 'cs', name: 'Czech' },
            { code: 'da', name: 'Danish' },
            { code: 'nl', name: 'Dutch' },
            { code: 'en', name: 'English' },
            { code: 'et', name: 'Estonian' },
            { code: 'ee', name: 'Ewe' },
            { code: 'fi', name: 'Finnish' },
            { code: 'fr', name: 'French' },
            { code: 'gl', name: 'Galician' },
            { code: 'ka', name: 'Georgian' },
            { code: 'de', name: 'German' },
            { code: 'el', name: 'Greek' },
            { code: 'gn', name: 'Guarani' },
            { code: 'gu', name: 'Gujarati' },
            { code: 'ht', name: 'Haitian Creole' },
            { code: 'ha', name: 'Hausa' },
            { code: 'haw', name: 'Hawaiian' },
            { code: 'iw', name: 'Hebrew' },
            { code: 'hi', name: 'Hindi' },
            { code: 'hu', name: 'Hungarian' },
            { code: 'is', name: 'Icelandic' },
            { code: 'ig', name: 'Igbo' },
            { code: 'ilo', name: 'Ilocano' },
            { code: 'id', name: 'Indonesian' },
            { code: 'ga', name: 'Irish' },
            { code: 'it', name: 'Italian' },
            { code: 'ja', name: 'Japanese' },
            { code: 'jw', name: 'Javanese' },
            { code: 'kn', name: 'Kannada' },
            { code: 'kk', name: 'Kazakh' },
            { code: 'km', name: 'Khmer' },
            { code: 'rw', name: 'Kinyarwanda' },
            { code: 'kok', name: 'Konkani' },
            { code: 'ko', name: 'Korean' },
            { code: 'kri', name: 'Krio' },
            { code: 'ckb', name: 'Kurdish (Sorani)' },
            { code: 'ky', name: 'Kyrgyz' },
            { code: 'lo', name: 'Lao' },
            { code: 'la', name: 'Latin' },
            { code: 'lv', name: 'Latvian' },
            { code: 'ln', name: 'Lingala' },
            { code: 'lt', name: 'Lithuanian' },
            { code: 'lg', name: 'Luganda' },
            { code: 'lb', name: 'Luxembourgish' },
            { code: 'mk', name: 'Macedonian' },
            { code: 'mai', name: 'Maithili' },
            { code: 'mg', name: 'Malagasy' },
            { code: 'ms', name: 'Malay' },
            { code: 'ml', name: 'Malayalam' },
            { code: 'mt', name: 'Maltese' },
            { code: 'mi', name: 'Maori' },
            { code: 'mr', name: 'Marathi' },
            { code: 'mni-Mtei', name: 'Meiteilon (Manipuri)' },
            { code: 'lus', name: 'Mizo' },
            { code: 'mn', name: 'Mongolian' },
            { code: 'my', name: 'Myanmar (Burmese)' },
            { code: 'ne', name: 'Nepali' },
            { code: 'no', name: 'Norwegian' },
            { code: 'or', name: 'Odia (Oriya)' },
            { code: 'om', name: 'Oromo' },
            { code: 'ps', name: 'Pashto' },
            { code: 'fa', name: 'Persian' },
            { code: 'pl', name: 'Polish' },
            { code: 'pt', name: 'Portuguese' },
            { code: 'pa', name: 'Punjabi' },
            { code: 'qu', name: 'Quechua' },
            { code: 'ro', name: 'Romanian' },
            { code: 'ru', name: 'Russian' },
            { code: 'sa', name: 'Sanskrit' },
            { code: 'nso', name: 'Sepedi' },
            { code: 'sr', name: 'Serbian' },
            { code: 'sn', name: 'Shona' },
            { code: 'sd', name: 'Sindhi' },
            { code: 'si', name: 'Sinhala' },
            { code: 'sk', name: 'Slovak' },
            { code: 'sl', name: 'Slovenian' },
            { code: 'so', name: 'Somali' },
            { code: 'es', name: 'Spanish' },
            { code: 'su', name: 'Sundanese' },
            { code: 'sw', name: 'Swahili' },
            { code: 'sv', name: 'Swedish' },
            { code: 'tl', name: 'Tagalog (Filipino)' },
            { code: 'tg', name: 'Tajik' },
            { code: 'ta', name: 'Tamil' },
            { code: 'tt', name: 'Tatar' },
            { code: 'te', name: 'Telugu' },
            { code: 'th', name: 'Thai' },
            { code: 'ti', name: 'Tigrinya' },
            { code: 'ts', name: 'Tsonga' },
            { code: 'tr', name: 'Turkish' },
            { code: 'tk', name: 'Turkmen' },
            { code: 'tw', name: 'Twi' },
            { code: 'uk', name: 'Ukrainian' },
            { code: 'ur', name: 'Urdu' },
            { code: 'ug', name: 'Uyghur' },
            { code: 'uz', name: 'Uzbek' },
            { code: 'vi', name: 'Vietnamese' },
            { code: 'cy', name: 'Welsh' },
            { code: 'xh', name: 'Xhosa' },
            { code: 'yi', name: 'Yiddish' },
            { code: 'yo', name: 'Yoruba' },
            { code: 'zu', name: 'Zulu' }
        ];
    }
}

export default new TranslationService();