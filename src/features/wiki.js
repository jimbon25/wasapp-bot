import logger from '../utils/common/logger.js';
import wikipediaService from '../services/infoServices/wikipediaService.js';

export default {
    name: 'wiki',
    description: 'Mencari ringkasan artikel dari Wikipedia.',
    async execute(message, args) {
        const searchTerm = args.join(' ');

        if (!searchTerm) {
            return message.reply('Gunakan: /wiki [topik yang ingin dicari]');
        }

        try {
            await message.reply(`🔎 Mencari "${searchTerm}" di Wikipedia...`);
            const article = await wikipediaService.searchArticle(searchTerm);

            if (!article) {
                return message.reply(`Maaf, artikel dengan judul "${searchTerm}" tidak ditemukan di Wikipedia.`);
            }

            const reply = `*${article.title}*\n\n${article.summary}\n\n*Selengkapnya:*
${article.url}`;

            await message.reply(reply);

        } catch (error) {
            logger.error(`Error on /wiki command for term "${searchTerm}":`, error);
            await message.reply(error.message || '❌ Terjadi kesalahan saat menjalankan perintah /wiki.');
        }
    }
};