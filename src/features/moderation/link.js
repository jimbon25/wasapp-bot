import logger from '../../utils/common/logger.js';

export default {
    name: 'link',
    description: 'Menampilkan link undangan grup (Admin Only).',
    
    adminOnly: true,

    async execute(message, args) {
        try {
            const chat = await message.getChat();

            if (!chat.isGroup) {
                return message.reply('✗ Perintah ini hanya bisa digunakan di dalam grup.');
            }

            const inviteCode = await chat.getInviteCode();
            const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
            
            logger.info(`Admin ${message.from} requested invite link for group ${chat.name}.`);
            await message.reply(` Link undangan untuk grup *${chat.name}*:\n${inviteLink}`);

        } catch (error) {
            logger.error("Error on /link command:", error);
            await message.reply('✗ Gagal mendapatkan link undangan. Pastikan bot adalah admin di grup ini.');
        }
    }
};