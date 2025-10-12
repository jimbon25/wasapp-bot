import { promises as fs } from 'fs';
import path from 'path';
import pkg from 'whatsapp-web.js';
import logger from '../utils/common/logger.js';
import downloaderService from '../services/mediaServices/downloaderService.js';

const { MessageMedia } = pkg;

export default {
    name: 'download',
    description: 'Downloads content from a given URL.',
    requiredPermissions: ['media'],
    async execute(message, args) {

        const url = args[0];
        if (!url) {
            await message.reply('Format salah. Gunakan: /download <URL>');
            return;
        }

        let statusMsg;
        try {
            statusMsg = await message.reply('⏳ Sabar, lagi di proses...');

            const filePath = await downloaderService.download(url);

            if (statusMsg) {
                await statusMsg.edit(' Download selesai! Mengirim file...');
            }

            const fileInfo = await fs.stat(filePath);
            const fileSizeMB = (fileInfo.size / (1024 * 1024)).toFixed(2);
            let fileName = path.basename(filePath);
            
            if (fileName.length > 30) {
                const ext = path.extname(fileName);
                const name = path.basename(fileName, ext);
                fileName = name.substring(0, 25) + '...' + ext;
            }

            const shortUrl = url.length > 40 ? url.substring(0, 35) + '...' : url;

            try {
                const chat = await message.getChat();
                const media = MessageMedia.fromFilePath(filePath);
                
                if (fileName.toLowerCase().endsWith('.mp4')) {
                    media.mimetype = 'video/mp4';
                }

                await chat.sendMessage(media, {
                    sendMediaAsDocument: true,
                    caption: `📥 ${shortUrl}`,
                    quotedMessageId: message.id._serialized
                });

                await message.reply('File berhasil dikirim!');
            } catch (error) {
                logger.error('Error sending file:', error);
                await message.reply('❌ Gagal mengirim file. Silakan coba lagi atau hubungi admin.');
            }

        } catch (error) {
            logger.error('Error in /download command:', error);
            const errorMessage = `❌ Gagal mengunduh konten.
Alasan: ${error.message}`.substring(0, 200);
            if (statusMsg) {
                await statusMsg.edit(errorMessage);
            } else {
                await message.reply(errorMessage);
            }
        }
    }
};
