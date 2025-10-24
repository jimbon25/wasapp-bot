import { generateAuthUrlWithState } from '../utils/common/authUrlGenerator.js';
import tokenManager from '../utils/common/tokenManagerInstance.js';
import logger from '../utils/common/logger.js';
import { loadGmailAccounts } from '../handlers/gmailAccountHandler.js';
import { loadDriveConfig } from '../utils/gdrive/driveConfigManager.js';

export default {
    name: 'reauth',
    adminOnly: true,
    async execute(message, args) {
        try {
            if (!args || args.length < 2) {
                await message.reply(
                    '❌ Format yang benar: /reauth [tipe] [nama_akun]\n' +
                    'Tipe: gmail atau drive\n' +
                    'Contoh: /reauth gmail Dimas'
                );
                return;
            }

            const [type, accountName] = args;
            
            if (!['gmail', 'drive'].includes(type.toLowerCase())) {
                await message.reply('❌ Tipe akun harus gmail atau drive');
                return;
            }

            // Verifikasi akun ada
            let accountExists = false;
            if (type.toLowerCase() === 'gmail') {
                const gmailAccounts = await loadGmailAccounts();
                accountExists = gmailAccounts.some(acc => acc.name === accountName);
            } else {
                const driveAccounts = await loadDriveConfig();
                accountExists = driveAccounts.some(acc => acc.accountName === accountName);
            }

            if (!accountExists) {
                await message.reply(`❌ Akun ${type} dengan nama ${accountName} tidak ditemukan`);
                return;
            }

            const authUrl = await generateAuthUrlWithState(type.toLowerCase(), accountName);
            
            if (type.toLowerCase() === 'gmail') {
                await tokenManager.gmail.deleteToken(accountName, 'gmail');
            } else {
                await tokenManager.drive.deleteToken(accountName, 'drive');
            }

            await message.reply(
                '*🔄 Proses Otorisasi Ulang*\n\n' +
                `Akun: ${accountName} (${type})\n\n` +
                '1. Buka link berikut di browser:\n' +
                `${authUrl}\n\n` +
                '2. Login dan berikan izin akses\n' +
                '3. Copy kode yang muncul\n' +
                '4. Kirim kode dengan format:\n' +
                `   /auth ${type} ${accountName} KODE\n\n` +
                '⚠️ Link hanya berlaku 10 menit'
            );

            logger.info(`Reauth URL generated for ${type} account: ${accountName}`);

        } catch (error) {
            logger.error('Error in reauth command:', error);
            await message.reply('❌ Terjadi kesalahan saat memproses otorisasi ulang');
        }
    }
};