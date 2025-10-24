import logger from '../utils/common/logger.js';
import MessageCollector from '../utils/messageHandling/messageCollector.js';
import securityManager from '../utils/systemService/securityManager.js';
import { loadGmailAccounts, saveGmailAccounts } from './gmailAccountHandler.js';
import tokenManager from '../utils/common/tokenManagerInstance.js';

export async function handleGmailAccountDeletion(msg, client, args) {
    const isAuthorized = await securityManager.isAuthorized(msg, 'admin');
    if (!isAuthorized) {
        await msg.reply('❌ Maaf, hanya admin yang bisa menghapus akun Gmail.');
        return;
    }

    try {
        if (!args || args.length === 0) {
            await msg.reply(
                '*Hapus Akun Gmail*\n\n' +
                'Untuk menghapus akun, gunakan format:\n' +
                '`/gmail remove-account [nama_akun]`\n\n' +
                'Contoh:\n' +
                '`/gmail remove-account Kantor`');
            return;
        }

        const accountName = args.join(' ');
        const accounts = await loadGmailAccounts();

        // Cek apakah akun ada
        const accountToDelete = accounts.find(acc => acc.name.toLowerCase() === accountName.toLowerCase());
        if (!accountToDelete) {
            await msg.reply(`❌ Akun dengan nama "${accountName}" tidak ditemukan.`);
            return;
        }

        await msg.reply(
            `*⚠️ Konfirmasi Penghapusan Akun Gmail*\n\n` +
            `Anda akan menghapus akun: *${accountToDelete.name}*\n` +
            `Target notifikasi: ${accountToDelete.targetNumbers.map(n => n.replace('@c.us', '')).join(', ')}\n\n` +
            `Ketik *CONFIRM* untuk melanjutkan atau ketik apa saja untuk membatalkan.`
        );

        const confirmCollector = new MessageCollector(
            client,
            async (response) => {
                const senderID = response.author || response.from;
                return senderID === (msg.author || msg.from);
            },
            { time: 30000, max: 1 }
        );

        const confirmCollected = await confirmCollector.collect();
        if (confirmCollected.length === 0) {
            await msg.reply('❌ Waktu habis. Penghapusan dibatalkan.');
            return;
        }

        const confirmation = confirmCollected[0].body.trim();
        if (confirmation !== 'CONFIRM') {
            await msg.reply('❌ Penghapusan dibatalkan.');
            return;
        }

        try {
            const deleted = await tokenManager.gmail.deleteToken(accountToDelete.name, 'gmail');
            if (deleted) {
                logger.info(`Token deleted for Gmail account: ${accountToDelete.name}`);
            } else {
                logger.warn(`No token found for Gmail account: ${accountToDelete.name}`);
            }
        } catch (error) {
            logger.error('Error deleting token:', error);
        }

        const updatedAccounts = accounts.filter(acc => acc.name.toLowerCase() !== accountName.toLowerCase());
        await saveGmailAccounts(updatedAccounts);

        await msg.reply(
            `*Akun Gmail Berhasil Dihapus*\n\n` +
            `*Nama Akun:* ${accountToDelete.name}\n\n` +
            'Bot akan restart otomatis untuk menerapkan perubahan.'
        );

        await new Promise(resolve => setTimeout(resolve, 2000));

        logger.info(`Gmail account "${accountName}" successfully deleted. Restarting bot in 2 seconds...`);
        setTimeout(() => {
            process.exit(0);
        }, 2000);

    } catch (error) {
        logger.error('Error in Gmail account deletion:', error);
        await msg.reply(
            '❌ Terjadi kesalahan saat menghapus akun Gmail.\n\n' +
            'Error: ' + error.message);
    }
}