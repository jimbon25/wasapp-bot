import { autoReplyManager } from '../autoreply.js';
import logger from '../../utils/common/logger.js';

export default {
    name: 'listreply',
    description: 'List all autoreply rules for a specific scope (Admin only).',
    adminOnly: true,
    async execute(message, args) {
        try {
            const chat = await message.getChat();

            let scope = 'global';
            let contextId = '';

            if (chat.isGroup) {
                scope = 'group';
                contextId = chat.id._serialized;
            }

            if (args[0]?.startsWith('--')) {
                const flag = args[0];

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

            const rules = await autoReplyManager.listRules(scope, contextId);

            if (!rules || rules.length === 0) {
                let scopeMessage = 'global';
                if (scope === 'group') scopeMessage = 'grup ini';
                return await message.reply(`ℹ️ Tidak ada auto-reply yang terkonfigurasi untuk ${scopeMessage}.`);
            }

            let scopeTitle = 'Global';
            if (scope === 'group') scopeTitle = `Grup Ini (${chat.name})`;

            let response = `*Daftar Auto-Reply (Scope: ${scopeTitle})*`;
            rules.forEach((rule, index) => {
                const keywords = rule.keywords.join(', ');
                const primaryKey = rule.primaryKey;

                let replyContentDisplay;
                switch (rule.reply.type) {
                    case 'text':
                        replyContentDisplay = `Teks: "${rule.reply.content}"`;
                        break;
                    case 'image':
                        replyContentDisplay = `Gambar (Caption: "${rule.reply.caption || ''}")`;
                        break;
                    case 'sticker':
                        replyContentDisplay = `Stiker`;
                        break;
                    case 'location':
                        replyContentDisplay = `Lokasi (Lat: ${rule.reply.latitude}, Lon: ${rule.reply.longitude})`;
                        break;
                    default:
                        replyContentDisplay = `Tipe tidak dikenal: ${rule.reply.type}`; 
                        break;
                }

                response += `\n\n${index + 1}. *Kata Kunci:* ${keywords}`;
                response += `\n   *Balasan:* ${replyContentDisplay}`;
                response += `\n   *(ID untuk /delreply: ${primaryKey})*`;
            });

            await message.reply(response);

        } catch (error) {
            logger.error('[listreply] An error occurred:', error);
            await message.reply('✗ Terjadi kesalahan internal saat menampilkan daftar balasan.');
        }
    }
};