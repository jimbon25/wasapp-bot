import logger from '../../utils/common/logger.js';
import gmailService from '../../services/notificationServices/gmailService.js';
import { redisManager } from '../../utils/redis/index.js';
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;

export default {
    name: 'gmail',
    description: 'Mengontrol fitur notifikasi Gmail dan mengunduh lampiran.',
    adminOnly: true,

    async execute(message, args) {
        const subCommand = args[0]?.toLowerCase();

        try {
            switch (subCommand) {
                case 'on':
                    await gmailService.setPollingStatus(true);
                    await message.reply('Notifikasi Gmail diaktifkan.');
                    logger.info(`Gmail notifications turned ON by admin ${message.author || message.from}`);
                    break;

                case 'off':
                    await gmailService.setPollingStatus(false);
                    await message.reply('Notifikasi Gmail dinonaktifkan.');
                    logger.info(`Gmail notifications turned OFF by admin ${message.author || message.from}`);
                    break;

                case 'status':
                    const isEnabled = await gmailService.isPollingEnabled();
                    const statusMessage = isEnabled
                        ? 'Status Notifikasi Gmail: *Aktif* (ON)'
                        : 'Status Notifikasi Gmail: *Tidak Aktif* (OFF)';
                    await message.reply(statusMessage);
                    break;

                case 'download':
                    if (!message.hasQuotedMsg) {
                        return message.reply('❌ Perintah ini harus digunakan dengan membalas pesan notifikasi Gmail yang berisi lampiran.');
                    }

                    const quotedMsg = await message.getQuotedMessage();
                    const contextKey = `gmail_notif:${quotedMsg.id._serialized}`;
                    const redisClient = await redisManager.getClient();
                    const contextData = await redisClient.get(contextKey);

                    if (!contextData) {
                        return message.reply('❌ Konteks untuk notifikasi ini tidak ditemukan atau sudah kedaluwarsa. Mohon coba dengan notifikasi yang lebih baru.');
                    }

                    const context = JSON.parse(contextData);
                    if (!context.attachments || context.attachments.length === 0) {
                        return message.reply('❌ Email ini tidak memiliki lampiran untuk diunduh.');
                    }

                    let attachmentToDownload;
                    const attachmentIndex = parseInt(args[1], 10);

                    if (context.attachments.length === 1 && !args[1]) {
                        attachmentToDownload = context.attachments[0];
                    } else if (args[1] && !isNaN(attachmentIndex)) {
                        attachmentToDownload = context.attachments.find(att => att.index === attachmentIndex);
                    } else {
                        let replyText = 'Email ini memiliki beberapa lampiran. Mohon tentukan nomor lampiran yang ingin diunduh:\n';
                        context.attachments.forEach(att => {
                            replyText += `*${att.index}.* ${att.filename}\n`;
                        });
                        replyText += '\\nContoh: `/gmail download 1`';
                        return message.reply(replyText);
                    }

                    if (!attachmentToDownload) {
                        return message.reply(`❌ Lampiran dengan nomor ${attachmentIndex} tidak ditemukan.`);
                    }

                    await message.reply(`⏳ Mengunduh lampiran \"${attachmentToDownload.filename}\"...`);

                    const accountName = context.accountName; // Assuming you store accountName in context
                    const attachmentData = await gmailService.downloadAttachment(accountName, context.gmailMessageId, attachmentToDownload.id);

                    const media = new MessageMedia(attachmentToDownload.mimetype, attachmentData.data, attachmentToDownload.filename);
                    await message.reply(media, undefined, { sendMediaAsDocument: true });

                    break;

                default:
                    await message.reply(
                        '*Perintah Gmail*\n\n' +
                        'Gunakan perintah ini untuk mengontrol notifikasi Gmail atau mengunduh lampiran.\n\n' +
                        '*Sub-perintah yang tersedia:*\n' +
                        '● `/gmail on` - Mengaktifkan notifikasi\n' +
                        '● `/gmail off` - Menonaktifkan notifikasi\n' +
                        '● `/gmail status` - Mengecek status saat ini\n' +
                        '● `/gmail download [nomor]` - (Balas ke notifikasi) Mengunduh lampiran email.'
                    );
                    break;
            }
        } catch (error) {
            logger.error('Error executing /gmail command:', error);
            await message.reply('Terjadi kesalahan saat menjalankan perintah Gmail.');
        }
    }
};
