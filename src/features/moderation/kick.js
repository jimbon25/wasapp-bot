import logger from '../../utils/common/logger.js';

export default {
    name: 'kick',
    description: 'Mengeluarkan anggota dari grup. Bisa dengan mention atau reply pesan.',
    
    adminOnly: true,

    async execute(message, args) {
        try {
            const chat = await message.getChat();

            if (!chat.isGroup) {
                return message.reply('❌ Perintah ini hanya bisa digunakan di dalam grup.');
            }

            let userToKickId;
            if (message.hasQuotedMsg) {
                const quotedMsg = await message.getQuotedMessage();
                userToKickId = quotedMsg.author;
            } else if (message.mentionedIds.length > 0) {
                userToKickId = message.mentionedIds[0];
            } else {
                return message.reply('⚠️ Cara penggunaan:\n1. `/kick @pengguna`\n2. Balas pesan pengguna dengan `/kick`');
            }

            if (!userToKickId) {
                return message.reply('❌ Tidak dapat menemukan target pengguna.');
            }
            
            const participantToKick = chat.participants.find(p => p.id._serialized === userToKickId);
            if (participantToKick && participantToKick.isAdmin) {
                return message.reply('❌ Tidak dapat mengeluarkan sesama admin.');
            }

            await chat.removeParticipants([userToKickId]);
            
            logger.info(`User ${userToKickId} was kicked from group ${chat.name} by ${message.from}.`);

        } catch (error) {
            logger.error(`Error on /kick command:`, error);
            await message.reply('❌ Gagal mengeluarkan anggota. Pastikan bot adalah admin dan target bukan admin lain.');
        }
    }
};
