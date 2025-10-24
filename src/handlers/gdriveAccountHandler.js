import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/common/logger.js';
import MessageCollector from '../utils/messageHandling/messageCollector.js';
import securityManager from '../utils/systemService/securityManager.js';
import { loadDriveConfig, saveDriveConfig } from '../utils/gdrive/driveConfigManager.js';
import { getOAuth2Client, generateAuthUrl, exchangeCode } from '../utils/gdrive/driveAuth.js';
import tokenManager from '../utils/common/tokenManagerInstance.js';
import { InputValidator } from '../utils/common/inputValidator.js';
import { AccountHealthChecker } from '../utils/common/accountHealthChecker.js';
import { withRetry } from '../utils/common/retryHandler.js';
import { driveRateLimiter } from '../utils/common/rateLimiter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_DIR = path.join(__dirname, '..', 'data', 'credentials');

export async function handleGDriveAccountSetup(msg, client, args) {
    const isAuthorized = await securityManager.isAuthorized(msg, 'admin');
    if (!isAuthorized) {
        await msg.reply('❌ Maaf, hanya admin yang bisa menambahkan akun Google Drive.');
        return;
    }

    try {
        if (!args || args.length === 0) {
            await msg.reply(
                '*🔧 Setup Akun Google Drive*\n\n' +
                'Untuk menambahkan akun baru, gunakan format:\n' +
                '`/gdrive add-account [nama_akun]`\n\n' +
                'Contoh:\n' +
                '`/gdrive add-account Drive-Kantor`'
            );
            return;
        }

        let validatedName;
        try {
            validatedName = await InputValidator.validateAccountName(args.join(' '));
        } catch (error) {
            await msg.reply(`❌ ${error.message}`);
            return;
        }

        try {
            await driveRateLimiter.checkLimit('setup-account');
        } catch (error) {
            await msg.reply(`❌ ${error.message}`);
            return;
        }

        const accounts = await loadDriveConfig();

        if (accounts.some(acc => acc.accountName.toLowerCase() === validatedName.toLowerCase())) {
            await msg.reply(`❌ Akun dengan nama "${validatedName}" sudah ada.`);
            return;
        }

        await msg.reply(
            `*Setup Google Drive: ${validatedName}*\n\n` +
            'Balas pesan ini dengan ID folder default untuk upload.\n' +
            'ID folder dapat dilihat dari URL Google Drive:\n' +
            'https://drive.google.com/drive/folders/<folder_id>'
        );

        const folderCollector = new MessageCollector(
            client,
            async (response) => {
                const senderID = response.author || response.from;
                return senderID === (msg.author || msg.from);
            },
            { time: 300000, max: 1 }
        );

        const folderCollected = await folderCollector.collect();
        if (folderCollected.length === 0) {
            await msg.reply('❌ Waktu habis. Silakan mulai setup dari awal.');
            return;
        }

        let folderId;
        try {
            folderId = await InputValidator.validateDriveFolderId(folderCollected[0].body.trim());
        } catch (error) {
            await msg.reply(`❌ ${error.message}`);
            return;
        }

        const oauth2Client = await getOAuth2Client();
        const authUrl = generateAuthUrl(oauth2Client);

        await msg.reply(
            '*Otorisasi Akun Google Drive*\n\n' +
            'Untuk menghubungkan akun Google Drive Anda:\n\n' +
            '1. Buka link berikut di browser:\n' +
            `${authUrl}\n\n` +
            '2. Pilih akun Google yang ingin dihubungkan\n' +
            '3. Berikan izin yang diminta\n' +
            '4. Salin kode yang muncul\n' +
            '5. Balas pesan ini dengan kode tersebut\n\n' +
            'Menunggu kode...'
        );

        const codeCollector = new MessageCollector(
            client,
            async (response) => {
                const senderID = response.author || response.from;
                return senderID === (msg.author || msg.from);
            },
            { time: 300000, max: 1 }  // 5 menit timeout
        );

        const codeCollected = await codeCollector.collect();
        if (codeCollected.length === 0) {
            await msg.reply('❌ Waktu habis. Silakan mulai setup dari awal.');
            return;
        }

        const code = codeCollected[0].body.trim();

        const tokens = await withRetry(async () => {
            return await exchangeCode(oauth2Client, code);
        });

        oauth2Client.setCredentials(tokens);

        const healthCheck = await AccountHealthChecker.checkDriveHealth(oauth2Client);
        if (healthCheck.status !== 'healthy') {
            await msg.reply('⚠️ Terjadi masalah saat verifikasi akun: ' + healthCheck.message);
            return;
        }

        const tokenPath = await withRetry(async () => {
            return await tokenManager.drive.saveToken(validatedName, 'drive', tokens);
        });

        accounts.push({
            accountName: validatedName,
            credentialsPath: "src/data/credentials/credentials.json",
            tokenPath: `src/data/credentials/${path.basename(tokenPath)}`,
            defaultFolderId: folderId
        });

        await saveDriveConfig(accounts);

        await msg.reply(
            `*Setup Google Drive Berhasil!*\n\n` +
            `*Nama Akun:* ${validatedName}\n` +
            `*Default Folder ID:* ${folderId}\n\n` +
            'Bot akan restart otomatis untuk menerapkan perubahan.'
        );

        logger.info(`Google Drive account "${validatedName}" setup completed. Restarting bot in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));  // Tunggu 5 detik

        process.exit(0);

    } catch (error) {
        logger.error('Error in GDrive account setup:', error);
        await msg.reply('❌ Terjadi kesalahan saat setup akun. Error: ' + error.message);
    }
}

export async function handleGDriveAccountDeletion(msg, client, args) {
    const isAuthorized = await securityManager.isAuthorized(msg, 'admin');
    if (!isAuthorized) {
        await msg.reply('❌ Maaf, hanya admin yang bisa menghapus akun Google Drive.');
        return;
    }

    try {
        if (!args || args.length === 0) {
            await msg.reply(
                '*Hapus Akun Google Drive*\n\n' +
                'Untuk menghapus akun, gunakan format:\n' +
                '`/gdrive remove-account [nama_akun]`\n\n' +
                'Contoh:\n' +
                '`/gdrive remove-account Drive-Kantor`');
            return;
        }

        let validatedName;
        try {
            validatedName = await InputValidator.validateAccountName(args.join(' '));
        } catch (error) {
            await msg.reply(`❌ ${error.message}`);
            return;
        }

        try {
            await driveRateLimiter.checkLimit('delete-account');
        } catch (error) {
            await msg.reply(`❌ ${error.message}`);
            return;
        }

        const accounts = await loadDriveConfig();

        const accountToDelete = accounts.find(acc => acc.accountName.toLowerCase() === validatedName.toLowerCase());
        if (!accountToDelete) {
            await msg.reply(`❌ Akun dengan nama "${validatedName}" tidak ditemukan.`);
            return;
        }

        try {
            const oauth2Client = await getOAuth2Client();
            const tokens = await tokenManager.drive.loadToken(accountToDelete.accountName, 'drive');
            oauth2Client.setCredentials(tokens);
            
            const healthCheck = await AccountHealthChecker.checkDriveHealth(oauth2Client);
            if (healthCheck.status === 'unhealthy') {
                await msg.reply('⚠️ Akun yang akan dihapus sudah tidak valid: ' + healthCheck.message);
            }
        } catch (error) {
            logger.warn(`Could not check account health before deletion: ${error.message}`);
        }

        await msg.reply(
            `*⚠️ Konfirmasi Penghapusan*\n\n` +
            `Anda akan menghapus akun: *${accountToDelete.accountName}*\n` +
            `Default Folder ID: ${accountToDelete.defaultFolderId}\n\n` +
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
            await msg.reply('❌ Waktu habis. Silakan mulai dari awal.');
            return;
        }

        const confirmation = confirmCollected[0].body.trim().toUpperCase();
        if (confirmation !== 'CONFIRM') {
            await msg.reply('Penghapusan akun dibatalkan.');
            return;
        }

        try {
            await withRetry(async () => {
                const deleted = await tokenManager.drive.deleteToken(accountToDelete.accountName, 'drive');
                if (deleted) {
                    logger.info(`Token deleted for Drive account: ${accountToDelete.accountName}`);
                } else {
                    logger.warn(`No token found for Drive account: ${accountToDelete.accountName}`);
                }
            }, 3, 2000); // 3 attempts, 2 second initial delay
        } catch (error) {
            logger.error('Error deleting token:', error);
        }

        const updatedAccounts = accounts.filter(acc => acc.accountName !== accountToDelete.accountName);
        await saveDriveConfig(updatedAccounts);

        await msg.reply(
            `*Akun Berhasil Dihapus!*\n\n` +
            `*Nama Akun:* ${accountToDelete.accountName}\n\n` +
            'Bot akan restart otomatis untuk menerapkan perubahan.'
        );

        logger.info(`Google Drive account "${accountToDelete.accountName}" deleted. Restarting bot in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));  // Tunggu 5 detik

        process.exit(0);

    } catch (error) {
        logger.error('Error in GDrive account deletion:', error);
        await msg.reply('❌ Terjadi kesalahan saat menghapus akun. Error: ' + error.message);
    }
}