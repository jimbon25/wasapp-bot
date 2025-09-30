import logger from '../../utils/common/logger.js';
import securityManager from '../../utils/systemService/securityManager.js';

export default {
    name: 'resetwarnings',
    description: 'Meriset jumlah peringatan pengguna. Bisa dengan mention atau reply pesan (Admin Only).',
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
                return message.reply('⚠️ Cara penggunaan:\n1. `/resetwarnings @pengguna`\n2. Balas pesan pengguna dengan `/resetwarnings`');
            }

            if (!targetUserId) {
                return message.reply('❌ Tidak dapat menemukan target pengguna.');
            }

            const groupId = chat.id._serialized;
            await securityManager.resetWarnings(targetUserId, groupId);
            
            await message.reply(`✅ Peringatan untuk pengguna @${targetUserId.split('@')[0]} di grup ini telah direset.`);

        } catch (error) {
            logger.error(`Error on /resetwarnings command:`, error);
            await message.reply('❌ Terjadi kesalahan saat meriset peringatan.');
        }
    }
};
