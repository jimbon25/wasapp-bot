import logger from '../../utils/common/logger.js';
import moderationService from '../../services/moderationService.js';

export default {
    name: 'addforbidden',
    description: 'Menambahkan kata ke daftar terlarang (Admin Only).',
    adminOnly: true,

    async execute(message, args) {
        try {
            const word = args.join(' ').trim();
            if (!word) {
                return message.reply('⚠️ Mohon masukkan kata yang ingin ditambahkan ke daftar terlarang. Contoh: /addforbidden katajelek');
            }

            const added = await moderationService.addForbiddenWord(word);
            
            if (added) {
                await message.reply(`✅ Kata "${word}" telah ditambahkan ke daftar terlarang.`);
            } else {
                await message.reply(`❌ Gagal menambahkan kata "${word}" ke daftar terlarang. Mungkin sudah ada atau terjadi kesalahan.`);
            }

        } catch (error) {
            logger.error(`Error on /addforbidden command:`, error);
            await message.reply('❌ Terjadi kesalahan saat menambahkan kata terlarang.');
        }
    }
};
