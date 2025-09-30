import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;
import animeService from '../services/infoServices/animeService.js';
import logger from '../utils/common/logger.js';

export default {
    name: 'anime',
    description: 'Mencari informasi anime dan link streaming.',
    usage: '/anime [judul]',
    
    async execute(message, args) {
        try {
            if (args.length === 0) {
                return message.reply('⚠️ Mohon berikan judul anime.\n\n*Contoh:*\n`/anime one piece`');
            }

            const query = args.join(' ');

            await message.reply('🔍 Sedang mencari informasi anime...');

            const animeData = await animeService.searchAnime(query);

            const searchTitles = [
                animeData.title,
                animeData.title_english,
                ...animeData.title_synonyms || [],
            ].filter(Boolean);

            let streamingLinks = [];
            for (const title of searchTitles) {
                try {
                    streamingLinks = await animeService.getStreamingLinks(title);
                    if (streamingLinks.length > 0) break;
                } catch (e) {
                    logger.info(`Tidak ada link streaming untuk judul: ${title}`);
                }
            }

            if (streamingLinks.length === 0) {
                streamingLinks = [`Maaf, link streaming untuk ${animeData.title} belum tersedia.`];
            }

            const formattedMessage = animeService.formatMessage(animeData, streamingLinks);

            if (animeData.images?.jpg?.large_image_url) {
                const thumbnail = await MessageMedia.fromUrl(animeData.images.jpg.large_image_url);
                await message.reply(thumbnail, null, { caption: formattedMessage });
            } else {
                await message.reply(formattedMessage);
            }

            logger.info(`Anime info sent for query: ${query}`);

        } catch (error) {
            logger.error('Error in anime command:', error);
            
            let errorMessage = '❌ Maaf, terjadi kesalahan.';
            if (error.message === 'Anime tidak ditemukan') {
                errorMessage = '❌ Anime tidak ditemukan. Coba cari dengan kata kunci lain.';
            } else if (error.message === 'Link streaming tidak ditemukan') {
                errorMessage = '❌ Link streaming tidak tersedia untuk anime ini.';
            }
            
            await message.reply(errorMessage);
        }
    }
};