import stickerService from '../services/mediaServices/stickerService.js';
import logger from '../utils/common/logger.js';

let MessageMedia;
try {
    const pkg = await import('whatsapp-web.js');
    MessageMedia = pkg.default.MessageMedia || pkg.MessageMedia;
    if (!MessageMedia) {
        throw new Error('MessageMedia not found in whatsapp-web.js');
    }
} catch (error) {
    logger.error('Failed to import MessageMedia:', error);
    throw new Error('Critical dependency failed to load: MessageMedia');
}

export default {
    name: 'stiker',
    description: 'Membuat stiker dari gambar',
    requiredPermissions: ['media'],
    async execute(message, args) {
        try {
            


            if (!message || typeof message.reply !== 'function') {
                logger.error('Invalid message object received');
                return;
            }

            if (!message.from) {
                logger.error('Invalid chat ID');
                return;
            }

            logger.info(`Processing sticker request from ${message.from}`);

            const chat = await message.getChat();
            if (!chat) {
                logger.error(`Invalid chat instance for ID ${message.from}`);
                return message.reply('Maaf, terjadi kesalahan. Silakan coba lagi.');
            }

            const hasQuotedMessage = message.hasQuotedMsg;
            const hasMedia = message.hasMedia;

            if (!hasMedia && !hasQuotedMessage) {
                return await message.reply(
                    'Kirim gambar dengan caption /stiker atau reply gambar dengan pesan /stiker'
                ).catch(err => {
                    logger.error('Error sending help message:', err);
                });
            }

            let targetMsg;
            try {
                targetMsg = hasQuotedMessage ? await message.getQuotedMessage() : message;
            } catch (error) {
                logger.error('Error getting quoted message:', error);
                return await message.reply('Gagal mengambil pesan yang di-reply');
            }
            
            if (!targetMsg.hasMedia) {
                return await message.reply('Pesan yang di-reply harus berupa gambar');
            }

            await message.reply('⌛ Sedang membuat stiker...').catch(err => {
                logger.error('Error sending processing message:', err);
            });

            const media = await Promise.race([
                targetMsg.downloadMedia(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Download timeout')), 30000)
                )
            ]);

            if (!media || !media.data) {
                throw new Error('Invalid media data received');
            }

            const imageBuffer = Buffer.from(media.data, 'base64');
            await stickerService.validateImage(imageBuffer);

            const stickerBuffer = await Promise.race([
                stickerService.createSticker(imageBuffer, {
                    quality: 80,
                    size: 512
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Conversion timeout')), 30000)
                )
            ]);

            if (!Buffer.isBuffer(stickerBuffer)) {
                throw new Error('Invalid sticker buffer generated');
            }

            const stickerMedia = new MessageMedia(
                'image/webp',
                stickerBuffer.toString('base64')
            );

            await chat.sendMessage(stickerMedia, {
                sendMediaAsSticker: true,
                stickerName: "Created with ❤️",
                stickerAuthor: "BotTalkin"
            });

            logger.info(`Sticker created for user ${message.from}`);

        } catch (error) {
            logger.error('Error in sticker command:', error);
            
            let errorMessage = 'Maaf, gagal membuat stiker. ';
            
            if (error.message.includes('too large')) {
                errorMessage += 'Ukuran file terlalu besar (max 2MB)';
            } else if (error.message.includes('Unsupported format')) {
                errorMessage += 'Format file tidak didukung. Gunakan JPG atau PNG';
            } else if (error.message.includes('Download timeout')) {
                errorMessage += 'Waktu download media terlalu lama. Coba lagi dengan gambar yang lebih kecil.';
            } else if (error.message.includes('Conversion timeout')) {
                errorMessage += 'Waktu pembuatan stiker terlalu lama. Coba lagi dengan gambar yang lebih sederhana.';
            } else if (error.message.includes('Invalid media data')) {
                errorMessage += 'Media tidak valid atau rusak.';
            } else {
                errorMessage += 'Silakan coba lagi.';
                logger.error('Unexpected error details:', error.stack);
            }
            
            try {
                await message.reply(errorMessage);
            } catch (replyError) {
                logger.error('Failed to send error message:', replyError);
            }
        }
    }
};