import logger from '../../utils/common/logger.js';
import welcomeManager from '../../utils/groupManagement/welcomeManager.js';

export default {
    name: 'setwelcome',
    description: 'Mengatur pesan selamat datang untuk grup ini (Admin Only).',
    adminOnly: true,

    async execute(message, args) {
        try {
            const chat = await message.getChat();

            if (!chat.isGroup) {
                return message.reply('❌ Perintah ini hanya bisa digunakan di dalam grup.');
            }

            const welcomeMessage = args.join(' ');
            if (!welcomeMessage) {
                return message.reply('⚠️ Mohon sertakan pesan selamat datang. Contoh: /setwelcome Selamat datang di grup kita!');
            }

            const groupId = chat.id._serialized;
            await welcomeManager.setWelcome(groupId, welcomeMessage);

            logger.info(`Pesan selamat datang untuk grup ${chat.name} (${groupId}) diatur oleh admin.`);
            await message.reply(`✅ Pesan selamat datang telah diatur untuk grup ini: "${welcomeMessage}"`);

        } catch (error) {
            logger.error(`Error pada perintah /setwelcome:`, error);
            await message.reply('❌ Terjadi kesalahan saat mengatur pesan selamat datang.');
        }
    }
};
