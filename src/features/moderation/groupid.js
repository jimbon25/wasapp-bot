import logger from '../../utils/common/logger.js';

export default {
    name: 'groupid',
    description: 'Menampilkan ID unik dari grup saat ini (Admin Only).',
    adminOnly: true,

    async execute(message, args) {
        try {
            const chat = await message.getChat();

            if (!chat.isGroup) {
                return message.reply('✗ Perintah ini hanya bisa digunakan di dalam grup.');
            }

            const groupId = chat.id._serialized;
            
            logger.info(`Admin ${message.author || message.from} requested group ID for "${chat.name}".`);
            
            // Correctly formatted reply
            await message.reply('ID untuk grup ini adalah:\n```' + groupId + '```');

        } catch (error) {
            logger.error(`Error on /groupid command:`, error);
            await message.reply('✗ Terjadi kesalahan saat mengambil ID grup.');
        }
    }
};