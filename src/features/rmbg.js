import removeBgHandler from '../handlers/removeBgHandler.js';
import logger from '../utils/common/logger.js';

export default {
    name: 'rmbg',
    description: 'Menghapus background dari gambar. Kirim gambar dengan caption /rmbg',
    requiredPermissions: ['media'],
    async execute(message, args) {
        try {
            await removeBgHandler.handleCommand(message);

        } catch (error) {
            logger.error('Error executing rmbg command:', error);
            await message.reply('❌ Terjadi kesalahan saat memproses perintah remove background.');
        }
    }
};