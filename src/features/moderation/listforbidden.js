import logger from '../../utils/common/logger.js';
import moderationService from '../../services/moderationService.js';

export default {
    name: 'listforbidden',
    description: 'Melihat daftar kata terlarang (Admin Only).',
    adminOnly: true,

    async execute(message, args) {
        try {
            await moderationService.loadForbiddenWords(); 
            
            const forbiddenWordRegexes = moderationService.forbiddenWords; 

            if (!forbiddenWordRegexes || forbiddenWordRegexes.length === 0) {
                return message.reply('ℹ️ Tidak ada kata terlarang yang terdaftar saat ini.');
            }

            let response = '*Daftar Kata Terlarang Aktif:*\n';
            forbiddenWordRegexes.forEach((wordRegex, index) => {
                const originalWord = wordRegex.source.replace(/\b/g, ''); 
                response += `${index + 1}. ${originalWord}\n`;
            });

            await message.reply(response);

        } catch (error) {
            logger.error(`Error on /listforbidden command:`, error);
            await message.reply('✗ Terjadi kesalahan saat menampilkan daftar kata terlarang.');
        }
    }
};
