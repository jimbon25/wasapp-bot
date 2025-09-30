import logger from '../../utils/common/logger.js';
import moderationService from '../../services/moderationService.js';

export default {
    name: 'removeforbidden',
    description: 'Menghapus kata dari daftar terlarang (Admin Only).',
    adminOnly: true,

    async execute(message, args) {
        try {
            const word = args.join(' ').trim();
            if (!word) {
                return message.reply('⚠️ Mohon masukkan kata yang ingin dihapus dari daftar terlarang. Contoh: /removeforbidden katajelek');
            }

            const removed = await moderationService.removeForbiddenWord(word);
            
            if (removed) {
                await message.reply(`✅ Kata "${word}" telah dihapus dari daftar terlarang.`);
            } else {
                await message.reply(`❌ Gagal menghapus kata "${word}" dari daftar terlarang. Mungkin tidak ada dalam daftar.`);
            }

        } catch (error) {
            logger.error(`Error on /removeforbidden command:`, error);
            await message.reply('❌ Terjadi kesalahan saat menghapus kata terlarang.');
        }
    }
};
