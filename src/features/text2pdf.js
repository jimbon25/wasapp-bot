import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;
import logger from '../utils/common/logger.js';
import pdfService from '../services/pdfServices/pdfService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    name: 'text2pdf',
    description: 'Mengkonversi teks menjadi file PDF. Contoh: /text2pdf Ini adalah contoh teks',
    usage: '/text2pdf <teks>',
    
    async execute(message, args) {
        try {
            if (args.length === 0) {
                return message.reply('⚠️ Mohon berikan teks yang ingin dikonversi ke PDF.\n\nContoh: /text2pdf Ini adalah contoh teks');
            }

            const text = args.join(' ');

            const timestamp = new Date().getTime();
            const tempDir = path.join(__dirname, '../../temp');
            const tempTextFile = path.join(tempDir, `text_${timestamp}.txt`);
            const outputPdfFile = path.join(tempDir, `text_${timestamp}.pdf`);

            await fs.writeFile(tempTextFile, text, 'utf8');

            await message.reply('🔄 Sedang mengkonversi teks ke PDF...');
            
            await pdfService.convertToPdf(tempTextFile, outputPdfFile);

            await message.reply('Teks berhasil dikonversi ke PDF');
            const media = MessageMedia.fromFilePath(outputPdfFile);
            await message.reply(media, null, { sendMediaAsDocument: true });

            try {
                await Promise.all([
                    fs.unlink(tempTextFile),
                    fs.unlink(outputPdfFile)
                ]);
            } catch (cleanupError) {
                logger.warn('Error cleaning up temporary files:', cleanupError);
            }

            logger.info(`Text to PDF conversion completed for user ${message.from}`);

        } catch (error) {
            logger.error('Error in text2pdf command:', error);
            await message.reply('❌ Maaf, terjadi kesalahan saat mengkonversi teks ke PDF.');
            
            try {
                await Promise.all([
                    fs.unlink(tempTextFile).catch(() => {}),
                    fs.unlink(outputPdfFile).catch(() => {})
                ]);
            } catch (cleanupError) {
                logger.warn('Error cleaning up temporary files:', cleanupError);
            }
        }
    }
};