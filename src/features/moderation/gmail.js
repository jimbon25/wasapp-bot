import logger from '../../utils/common/logger.js';
import gmailService from '../../services/notificationServices/gmailService.js';
import { redisManager } from '../../utils/redis/index.js';
import pkg from 'whatsapp-web.js';
import activeGmailAccountManager from '../../utils/gmail/activeGmailAccountManager.js';
const { MessageMedia } = pkg;

export default {
    name: 'gmail',
    description: 'Mengontrol fitur notifikasi Gmail, mengirim email, dan mengunduh lampiran.',
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

                case 'accounts':
                    const allAccounts = activeGmailAccountManager.getAvailableAccounts();
                    const activeAccount = await activeGmailAccountManager.getActiveAccount();

                    if (!allAccounts || allAccounts.length === 0) {
                        await message.reply('Tidak ada akun Gmail yang terkonfigurasi.');
                        return;
                    }

                    let response = 'Daftar Akun Gmail Terkonfigurasi:\n';
                    allAccounts.forEach(acc => {
                        const isActive = activeAccount && acc.name === activeAccount.name ? '(Aktif)' : '';
                        response += `- ${acc.name} ${isActive}\n`;
                    });
                    response += '\nGunakan `/gmail set-account [nama_akun]` untuk mengganti akun aktif.';
                    await message.reply(response);
                    break;

                case 'set-account':
                    const accountName = args.slice(1).join(' ');
                    if (!accountName) {
                        await message.reply('⚠️ Mohon berikan nama akun yang ingin diaktifkan. Contoh: `/gmail set-account Pribadi`');
                        return;
                    }

                    const success = await activeGmailAccountManager.setActiveAccount(accountName);
                    if (success) {
                        await message.reply(`✔ Akun Gmail aktif telah diubah menjadi: *${accountName}*`);
                    } else {
                        await message.reply(`✘ Akun "${accountName}" tidak ditemukan. Gunakan \"/gmail accounts\" untuk melihat daftar akun yang tersedia.`);
                    }
                    break;

                case 'send': {
                    const activeSendAccount = await activeGmailAccountManager.getActiveAccount();
                    if (!activeSendAccount) {
                        return message.reply('✘ Tidak ada akun Gmail yang aktif. Atur dengan `/gmail set-account [nama_akun]` terlebih dahulu.');
                    }

                    const content = args.slice(1).join(' ');
                    
                    const emailMatch = content.match(/^([^\s]+)/);
                    const to = emailMatch ? emailMatch[1] : null;

                    const subjectMatch = content.match(/"(.*?)"/);
                    const subject = subjectMatch ? subjectMatch[1] : null;

                    let body = '';
                    if (subjectMatch) {
                        const endOfSubjectIndex = content.indexOf(subjectMatch[0]) + subjectMatch[0].length;
                        body = content.substring(endOfSubjectIndex).trim();
                    }

                    if (!to || !subject || !body) {
                        return message.reply('Format salah. Gunakan:\n/gmail send <penerima> "<subjek>" <isi pesan>');
                    }

                    await message.reply(`Mengirim email dari *${activeSendAccount.name}* ke *${to}*...`);
                    await gmailService.sendEmail(activeSendAccount.name, to, subject, body);
                    await message.reply('✔ Email berhasil terkirim!');
                    break;
                }

                case 'download':
                    if (!message.hasQuotedMsg) {
                        return message.reply('✗ Perintah ini harus digunakan dengan membalas pesan notifikasi Gmail yang berisi lampiran.');
                    }

                    const quotedMsg = await message.getQuotedMessage();
                    const contextKey = `gmail_notif:${quotedMsg.id._serialized}`;
                    const redisClient = await redisManager.getClient();
                    const contextData = await redisClient.get(contextKey);

                    if (!contextData) {
                        return message.reply('✗ Konteks untuk notifikasi ini tidak ditemukan atau sudah kedaluwarsa. Mohon coba dengan notifikasi yang lebih baru.');
                    }

                    const context = JSON.parse(contextData);
                    if (!context.attachments || context.attachments.length === 0) {
                        return message.reply('✗ Email ini tidak memiliki lampiran untuk diunduh.');
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
                        replyText += '\nContoh: `/gmail download 1`';
                        return message.reply(replyText);
                    }

                    if (!attachmentToDownload) {
                        return message.reply(`✗ Lampiran dengan nomor ${attachmentIndex} tidak ditemukan.`);
                    }

                    await message.reply(`Mengunduh lampiran "${attachmentToDownload.filename}"...`);

                    const attachmentAccountName = context.accountName;
                    const attachmentData = await gmailService.downloadAttachment(attachmentAccountName, context.gmailMessageId, attachmentToDownload.id);

                    const media = new MessageMedia(attachmentToDownload.mimetype, attachmentData.data, attachmentToDownload.filename);
                    await message.reply(media, undefined, { sendMediaAsDocument: true });

                    break;

                default:
                    await message.reply(
                        '*Perintah Gmail*\n\n' +
                        'Gunakan perintah ini untuk mengelola akun Gmail Anda.\n\n' +
                        '*Sub-perintah yang tersedia:*\n' +
                        '`/gmail send <to> "<subj>" <body>` - Kirim email\n' +
                        '`/gmail accounts` - Lihat daftar akun\n' +
                        '`/gmail set-account <nama>` - Pilih akun aktif\n' +
                        '`/gmail on` - Aktifkan notifikasi email masuk\n' +
                        '`/gmail off` - Matikan notifikasi email masuk\n' +
                        '`/gmail status` - Cek status notifikasi\n' +
                        '`/gmail download [no]` - (Balas notifikasi) Unduh lampiran'
                    );
                    break;
            }
        } catch (error) {
            logger.error('Error executing /gmail command:', error);
            await message.reply(`Terjadi kesalahan saat menjalankan perintah Gmail.\nAlasan: ${error.message}`);
        }
    }
};