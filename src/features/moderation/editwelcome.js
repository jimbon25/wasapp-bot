import logger from '../../utils/common/logger.js';
import welcomeManager from '../../utils/groupManagement/welcomeManager.js';

export default {
    name: 'editwelcome',
    description: 'Mengedit pesan selamat datang untuk grup ini (Admin Only).',
    adminOnly: true,

    async execute(message, args) {
        try {
            const chat = await message.getChat();

            if (!chat.isGroup) {
                return message.reply('✗ Perintah ini hanya bisa digunakan di dalam grup.');
            }

            const groupId = chat.id._serialized;

            const currentMessage = await welcomeManager.getWelcome(groupId);
            if (!currentMessage) {
                return message.reply('✗ Grup ini belum memiliki pesan selamat datang. Gunakan /setwelcome untuk membuat pesan baru.');
            }

            if (args.length === 0) {
                return message.reply(`📝 Pesan selamat datang saat ini:\n\n"${currentMessage}"\n\nUntuk mengubah, ketik:\n/editwelcome [pesan baru]`);
            }

            const newMessage = args.join(' ');
            await welcomeManager.setWelcome(groupId, newMessage);

            logger.info(`Welcome message edited in group ${chat.name} (${groupId}) by admin`);
            await message.reply(` Pesan selamat datang telah diubah:\n\nPesan lama:\n"${currentMessage}"\n\nPesan baru:\n"${newMessage}"`);

        } catch (error) {
            logger.error(`Error pada perintah /editwelcome:`, error);
            await message.reply('✗ Terjadi kesalahan saat mengedit pesan selamat datang.');
        }
    }
};