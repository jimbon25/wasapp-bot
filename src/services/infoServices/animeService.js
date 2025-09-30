import axios from 'axios';
import { redisManager } from '../../utils/redis/index.js';
import logger from '../../utils/common/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AnimeService {
    constructor() {
        this.cacheManager = redisManager;
        this.CACHE_PREFIX = config.apis.jikan.cache.prefix;
        this.CACHE_TTL = config.apis.jikan.cache.ttl;
        this.JIKAN_API = config.apis.jikan.baseUrl;
    }

    /**
     * Mendapatkan data anime dari Jikan API
     * @param {string} query - Nama anime yang dicari
     */
    async searchAnime(query) {
        const cacheKey = `${this.CACHE_PREFIX}${query}`;
        
        try {
            // Cek cache dulu
            const cached = await this.cacheManager.client.get(cacheKey);
            if (cached) {
                try {
                    logger.info(`Cache hit for anime search: ${query}`);
                    return JSON.parse(cached);
                } catch (parseError) {
                    logger.warn(`Error parsing cached data for ${query}, fetching fresh data`);
                }
            }

            const response = await axios.get(`${this.JIKAN_API}/anime`, {
                params: {
                    q: query,
                    limit: 1,
                    sfw: true
                }
            });

            if (response.data.data.length === 0) {
                throw new Error('Anime tidak ditemukan');
            }

            const animeData = response.data.data[0];
            
            try {
                await this.cacheManager.client.setex(
                    cacheKey,
                    this.CACHE_TTL,
                    JSON.stringify(animeData)
                );
            } catch (cacheError) {
                logger.warn(`Failed to cache anime data for ${query}:`, cacheError);
            }

            if (!animeData || typeof animeData !== 'object') {
                throw new Error('Invalid anime data received from API');
            }

            return animeData;

        } catch (error) {
            logger.error('Error searching anime:', error);
            if (error.response?.status === 404) {
                throw new Error('Anime tidak ditemukan');
            } else if (error.response?.status === 429) {
                throw new Error('Terlalu banyak request, mohon tunggu sebentar');
            }
            throw error;
        }
    }

    /**
     * Mendapatkan link streaming dari sources.json
     * @param {string} title - Judul anime yang dicari
     */
    async getStreamingLinks(title) {
        try {
            const sourcesPath = path.join(__dirname, '../../data/static/sources.json');
            const sourcesRaw = await fs.readFile(sourcesPath, 'utf8');
            const sources = JSON.parse(sourcesRaw);

            const animePlatforms = sources.unofficial_platforms;
            
            const searchQuery = title.toLowerCase().replace(/\s+/g, '+');
            
            const streamingLinks = Object.values(animePlatforms)
                .map(platform => {
                    const searchUrl = platform.patterns.search.replace('{query}', searchQuery);
                    return `${platform.emoji} ${platform.name}: ${searchUrl}`;
                })
                .slice(0, 3);

            if (streamingLinks.length === 0) {
                throw new Error('Link streaming tidak ditemukan');
            }

            return streamingLinks;


        } catch (error) {
            logger.error('Error getting streaming links:', error);
            throw error;
        }
    }

    /**
     * Format pesan untuk respons WhatsApp
     * @param {Object} animeData - Data anime dari Jikan
     * @param {Array} streamingLinks - Link streaming
     */
    formatMessage(animeData, streamingLinks) {
        const message = `🎯 *${animeData.title}*${animeData.title_japanese ? ` (${animeData.title_japanese})` : ''}

📺 *Episode:* ${animeData.episodes || 'Ongoing'}
⭐ *Rating:* ${animeData.score || 'N/A'}/10

📝 *Synopsis:*
${animeData.synopsis?.slice(0, 200)}...

*Link Pencarian:*
${streamingLinks.join('\n')}

*Note:* 
_Gunakan adblock untuk kenyamanan menonton_`;

        return message;
    }
}

export default new AnimeService();