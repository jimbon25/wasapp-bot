import logger from '../../utils/common/logger.js';
import gmailService from '../../services/notificationServices/gmailService.js';

export default {
    name: 'gmail',
    description: 'Mengontrol fitur notifikasi Gmail secara dinamis.',
    adminOnly: true,

    async execute(message, args) {
        const subCommand = args[0]?.toLowerCase();

        try {
            switch (subCommand) {
                case 'on':
                    await gmailService.setPollingStatus(true);
                    await message.reply('✅ Notifikasi Gmail telah diaktifkan.');
                    logger.info(`Gmail notifications turned ON by admin ${message.author || message.from}`);
                    break;

                case 'off':
                    await gmailService.setPollingStatus(false);
                    await message.reply('❌ Notifikasi Gmail telah dinonaktifkan.');
                    logger.info(`Gmail notifications turned OFF by admin ${message.author || message.from}`);
                    break;

                case 'status':
                    const isEnabled = await gmailService.isPollingEnabled();
                    const statusMessage = isEnabled
                        ? 'Status Notifikasi Gmail saat ini: *Aktif* (ON) ✅'
                        : 'Status Notifikasi Gmail saat ini: *Tidak Aktif* (OFF) ❌';
                    await message.reply(statusMessage);
                    break;

                default:
                    await message.reply(
                        '*Perintah Gmail*\n\n' +
                        'Gunakan perintah ini untuk mengontrol notifikasi Gmail tanpa me-restart bot.\n\n' +
                        '*Sub-perintah yang tersedia:*\n' +
                        '● `/gmail on` - Mengaktifkan notifikasi\n' +
                        '● `/gmail off` - Menonaktifkan notifikasi\n' +
                        '● `/gmail status` - Mengecek status saat ini'
                    );
                    break;
            }
        } catch (error) {
            logger.error('Error executing /gmail command:', error);
            await message.reply('Terjadi kesalahan saat menjalankan perintah Gmail.');
        }
    }
};
