import logger from '../../utils/common/logger.js';
import securityManager from '../../utils/systemService/securityManager.js';

export default {
    name: 'warnings',
    description: 'Melihat jumlah peringatan pengguna. Bisa dengan mention atau reply pesan (Admin Only).',
    adminOnly: true,

    async execute(message, args) {
        try {
            const chat = await message.getChat();
            if (!chat.isGroup) {
                return message.reply('❌ Perintah ini hanya bisa digunakan di dalam grup.');
            }

            let targetUserId;

            if (message.hasQuotedMsg) {
                const quotedMsg = await message.getQuotedMessage();
                targetUserId = quotedMsg.author;
            } else if (message.mentionedIds.length > 0) {
                targetUserId = message.mentionedIds[0];
            } else {
                return message.reply('⚠️ Cara penggunaan:\n1. `/warnings @pengguna`\n2. Balas pesan pengguna dengan `/warnings`');
            }

            if (!targetUserId) {
                return message.reply('❌ Tidak dapat menemukan target pengguna.');
            }

            const groupId = chat.id._serialized;

            let warningCount = await securityManager.getWarnings(targetUserId, groupId);
            const isMuted = await securityManager.isUserMuted(targetUserId, groupId);
            let muteStatus = '';
            
            if (isMuted) {
                const timeRemaining = await securityManager.getMuteTimeRemaining(targetUserId, groupId);
                muteStatus = `
🔇 Status: Dimute (${Math.ceil(timeRemaining/60)} menit tersisa)`;
                warningCount = securityManager.muteThreshold;
            }
            
            await message.reply(`📊 *Status Peringatan*\n` + 
                              `👤 Pengguna: @${targetUserId.split('@')[0]}\n` + 
                              `⚠️ Jumlah Peringatan: ${warningCount}/${securityManager.muteThreshold}${muteStatus}`);

        } catch (error) {
            logger.error(`Error on /warnings command:`, error);
            await message.reply('❌ Terjadi kesalahan saat memeriksa peringatan.');
        }
    }
};
