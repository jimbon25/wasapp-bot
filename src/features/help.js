import helpHandler from '../handlers/helpHandler.js';
    import logger from '../utils/common/logger.js';

    export default {
        name: 'help',
        description: 'Menampilkan daftar semua perintah yang tersedia.',
        async execute(message, args) {
            try {
                await helpHandler.handleCommand(message);
            } catch (error) {
                logger.error('Error executing help command:', error);
                   await message.reply('✘ Terjadi kesalahan saat menampilkan menu bantuan.');
                }
            }
        };
