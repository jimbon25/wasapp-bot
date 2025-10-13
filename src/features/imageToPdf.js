import { promises as fs } from 'fs';
import pkg from 'whatsapp-web.js';
import pdfService from '../services/pdfServices/pdfService.js';
import logger from '../utils/common/logger.js';
import fileManager, { FILE_TYPES } from '../utils/fileManagement/fileManager.js';
const { MessageMedia } = pkg;

/**
 * Handles the core logic of converting an image to PDF and sending it.
 * @param {import('whatsapp-web.js').Message} msg - The original message object to reply to.
 * @param {import('whatsapp-web.js').MessageMedia} media - The media object to be converted.
 */
async function convertAndSendPdf(msg, media) {
    if (!media || !media.mimetype.startsWith('image/')) {
        await msg.reply('❌ File yang dikirim bukan gambar. Mohon kirim file gambar yang valid.');
        return;
    }

    await msg.reply('⏳ Sedang memproses gambar ke PDF...');

    const imagePath = fileManager.getPath(FILE_TYPES.TEMP, `${Date.now()}.${media.mimetype.split('/')[1] || 'png'}`);
    let pdfPath;

    try {
        await fs.writeFile(imagePath, Buffer.from(media.data, 'base64'));

        pdfPath = await pdfService.createPDF([imagePath]);

        const pdfBuffer = await fs.readFile(pdfPath);
        const pdfSize = pdfBuffer.length;

        if (pdfSize > 16 * 1024 * 1024) {
            throw new Error('PDF file too large (max 16MB)');
        }

        const pdfBase64 = pdfBuffer.toString('base64');

        const pdfMedia = new MessageMedia('application/pdf', pdfBase64, 'converted.pdf');

        const chat = await msg.getChat();
        await chat.sendMessage('📄 PDF dari gambar Anda', {
            media: pdfMedia
        });

    } catch (error) {
        logger.error('Error creating/sending PDF:', error);
        if (error.message.includes('too large')) {
            await msg.reply('❌ Ukuran PDF terlalu besar (maksimal 16MB). Mohon kompres gambar terlebih dahulu.');
        } else {
            await msg.reply('❌ Terjadi kesalahan saat membuat atau mengirim PDF. Silakan coba lagi.');
        }
    } finally {
        if (imagePath) {
            await fs.unlink(imagePath).catch(err => logger.error(`Failed to delete temp image ${imagePath}:`, err));
        }
        if (pdfPath) {
            await fs.unlink(pdfPath).catch(err => logger.error(`Failed to delete temp PDF ${pdfPath}:`, err));
        }
    }
}

export default {
    name: 'topdf',
    description: 'Konversi gambar ke PDF secara langsung.',
    requiredPermissions: ['media'],
    async execute(msg, args = []) {

        try {
            const mediaMsg = msg.hasMedia ? msg : (msg.hasQuotedMsg ? await msg.getQuotedMessage() : null);

            if (!mediaMsg || !mediaMsg.hasMedia) {
                await msg.reply('ℹ️ Cara penggunaan:1. Kirim gambar dengan caption `/topdf`2. Balas sebuah gambar dengan pesan `/topdf`Gambar akan langsung dikonversi menjadi PDF! 🖼️ ➡️ 📄');
                return;
            }

            const media = await mediaMsg.downloadMedia();
            await convertAndSendPdf(msg, media);

        } catch (error) {
            logger.error('Error in /topdf command execution:', error);
            await msg.reply('❌ Terjadi kesalahan saat memproses permintaan Anda.');
        }
    }
};