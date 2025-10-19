import { autoReplyManager } from '../autoreply.js';
import logger from '../../utils/common/logger.js';

export default {
    name: 'delreply',
    description: 'Delete an autoreply rule from a specific scope (Admin only).',
    adminOnly: true,
    async execute(message, args) {
        try {
            const chat = await message.getChat();
            const senderId = message.author || message.from;

            let scope = 'global';
            let contextId = '';
            let contentArgs = [...args];

            if (chat.isGroup) {
                scope = 'group';
                contextId = chat.id._serialized;
            }

            if (args[0]?.startsWith('--')) {
                const flag = args[0];
                contentArgs.shift();

                if (flag === '--global') {
                    scope = 'global';
                    contextId = '';
                } else if (flag === '--group') {
                    if (!chat.isGroup) return await message.reply('✗ Flag --group hanya bisa digunakan di dalam grup.');
                    scope = 'group';
                    contextId = chat.id._serialized;
                } else if (flag.startsWith('--user=')) {
                    scope = 'user';
                    const userNumber = flag.split('=')[1];
                    if (!userNumber || !/^\d+$/.test(userNumber)) {
                        return await message.reply('⚠️ Nomor pengguna untuk flag --user tidak valid. Gunakan format: --user=62812... ');
                    }
                    contextId = `${userNumber}@c.us`;
                } else {
                    return await message.reply('⚠️ Flag tidak valid. Gunakan --global, --group, atau --user=<nomor>.');
                }
            }

            const primaryKey = contentArgs.join(' ').trim().toLowerCase();

            if (!primaryKey) {
                return await message.reply('Format salah. Gunakan: /delreply [--scope] [kata_kunci_utama]');
            }

            const wasDeleted = await autoReplyManager.deleteRule(scope, contextId, primaryKey);

            if (wasDeleted) {
                let scopeMessage = 'global';
                if (scope === 'group') scopeMessage = 'grup ini';
                if (scope === 'user') scopeMessage = `pengguna ${contextId}`;

                logger.info(`[delreply] Admin ${senderId} deleted rule with key: "${primaryKey}" from scope: ${scope}`);
                await message.reply(` Auto-reply untuk kata kunci utama "${primaryKey}" telah dihapus dari ${scopeMessage}.`);
            } else {
                await message.reply(`⚠️ Auto-reply dengan kata kunci utama "${primaryKey}" tidak ditemukan pada scope yang ditentukan.`);
            }
        } catch (error) {
            logger.error('[delreply] An error occurred:', error);
            await message.reply('✗ Terjadi kesalahan internal saat menghapus balasan.');
        }
    }
};