import { autoReplyManager } from '../autoreply.js';
import logger from '../../utils/common/logger.js';
import fileManager, { FILE_TYPES } from '../../utils/fileManagement/fileManager.js';
import path from 'path';
import { promises as fs } from 'fs';

const AUTOREPLY_MEDIA_DIR = path.join(fileManager.baseDir, 'media', 'autoreply');

export default {
    name: 'addreply',
    description: 'Add or update an autoreply rule with scope (Admin only).',
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
            
            const fullArgs = contentArgs.join(' ');
            let keywordsPart;
            let replyData;

            if (message.hasQuotedMsg) {
                const quotedMsg = await message.getQuotedMessage();
                keywordsPart = fullArgs.trim();
                if (!keywordsPart) {
                    return await message.reply('Mohon sediakan kata kunci untuk auto-reply saat membalas pesan.');
                }

                if (quotedMsg.hasMedia) {
                    let keywords = keywordsPart;
                    let caption = '';
                    const separatorIndex = keywordsPart.indexOf('|');
                    if (separatorIndex !== -1) {
                        keywords = keywordsPart.substring(0, separatorIndex).trim();
                        caption = keywordsPart.substring(separatorIndex + 1).trim();
                    }
                    keywordsPart = keywords;

                    const media = await quotedMsg.downloadMedia();
                    const mediaType = media.mimetype.split('/')[0];
                    const fileExtension = fileManager.getExtensionFromMimeType(media.mimetype);
                    const fileName = `autoreply_${Date.now()}${fileExtension}`;
                    const filePath = path.join(AUTOREPLY_MEDIA_DIR, fileName);

                    await fs.mkdir(AUTOREPLY_MEDIA_DIR, { recursive: true });
                    await fileManager.writeBase64File(filePath, media.data);

                    replyData = { type: mediaType, path: filePath, caption: caption || quotedMsg.body || '' };
                    if (media.mimetype === 'image/webp') replyData.type = 'sticker';

                } else if (quotedMsg.location) {
                    replyData = {
                        type: 'location',
                        latitude: quotedMsg.location.latitude,
                        longitude: quotedMsg.location.longitude,
                        description: quotedMsg.location.description || ''
                    };
                } else if (quotedMsg.body) {
                    replyData = { type: 'text', content: quotedMsg.body };
                } else {
                    return await message.reply('⚠️ Pesan yang di-reply tidak mengandung media, lokasi, atau teks yang valid.');
                }
            } else {
                const parts = fullArgs.split('|');
                if (parts.length !== 2) {
                    return await message.reply('Format salah. Gunakan: /addreply [--scope] kata,kunci | balasan');
                }
                keywordsPart = parts[0].trim();
                let replyText = parts[1].trim();

                if (!keywordsPart || !replyText) {
                    return await message.reply('Kata kunci dan balasan tidak boleh kosong.');
                }
                replyData = { type: 'text', content: replyText };
            }

            const keywords = keywordsPart.split(',').map(k => k.trim()).filter(k => k);
            if (keywords.length === 0) {
                return await message.reply('Mohon sediakan setidaknya satu kata kunci.');
            }

            const result = await autoReplyManager.addRule(scope, contextId, keywords, replyData);

            if (result.success) {
                let scopeMessage = 'secara global';
                if (scope === 'group') scopeMessage = 'untuk grup ini';
                if (scope === 'user') scopeMessage = `untuk pengguna ${contextId}`;

                const replyMessage = ` Auto-reply (${replyData.type}) untuk kata kunci "${keywords.join(', ')}" telah ditambahkan ${scopeMessage}.`;
                logger.info(`[addreply] Admin ${senderId} added rule. Scope: ${scope}, Context: ${contextId}, Keywords: "${keywords.join(', ')}"`);
                await message.reply(replyMessage);
            } else {
                await message.reply('✗ Gagal menyimpan auto-reply.');
            }
        } catch (error) {
            logger.error('[addreply] An error occurred:', error);
            await message.reply('✗ Terjadi kesalahan internal saat menambahkan balasan.');
        }
    }
};