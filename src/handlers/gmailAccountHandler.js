import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import logger from '../utils/common/logger.js';
import config from '../config.js';
import { google } from 'googleapis';
import securityManager from '../utils/systemService/securityManager.js';
import MessageCollector from '../utils/messageHandling/messageCollector.js';
import tokenManager from '../utils/common/tokenManagerInstance.js';
import { InputValidator } from '../utils/common/inputValidator.js';
import { AccountHealthChecker } from '../utils/common/accountHealthChecker.js';
import { withRetry } from '../utils/common/retryHandler.js';
import { gmailRateLimiter } from '../utils/common/rateLimiter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GMAIL_ACCOUNTS_JSON_PATH = path.join(process.cwd(), 'src/data/credentials/gmailCredentials', 'gmail_accounts.json');

async function getAvailablePort(startPort = 3000) {
    return new Promise((resolve, reject) => {
        const server = http.createServer();
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(getAvailablePort(startPort + 1));
            } else {
                reject(err);
            }
        });
    });
}

export async function loadGmailAccounts() {
    try {
        const jsonData = await fs.readFile(GMAIL_ACCOUNTS_JSON_PATH, 'utf8');
        return JSON.parse(jsonData);
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        logger.error('Failed to read gmail_accounts.json:', error);
        return [];
    }
}

export async function saveGmailAccounts(accounts) {
    try {
        await fs.writeFile(GMAIL_ACCOUNTS_JSON_PATH, JSON.stringify(accounts, null, 2));
    } catch (error) {
        logger.error('Failed to save gmail_accounts.json:', error);
        throw new Error('Could not save account configuration.');
    }
}

export async function handleGmailAccountSetup(msg, client, args) {
    const isAuthorized = await securityManager.isAuthorized(msg, 'admin');
    if (!isAuthorized) {
        await msg.reply('❌ Maaf, hanya admin yang bisa menambahkan akun Gmail.');
        return;
    }

    const chat = await msg.getChat();

    try {
        if (!args || args.length === 0) {
            await msg.reply(
                '*🔧 Setup Akun Gmail*\n\n' +
                'Untuk menambahkan akun baru, gunakan format:\n' +
                '`/gmail add-account [nama_akun]`\n\n' +
                'Contoh:\n' +
                '`/gmail add-account Kantor`');
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
            await gmailRateLimiter.checkLimit('setup-account');
        } catch (error) {
            await msg.reply(`❌ ${error.message}`);
            return;
        }

        const accounts = await loadGmailAccounts();

        if (accounts.some(acc => acc.name.toLowerCase() === validatedName.toLowerCase())) {
            await msg.reply(`❌ Akun dengan nama "${validatedName}" sudah ada.`);
            return;
        }

        await msg.reply(
            `*Setup Akun Gmail: ${validatedName}*\n\n` +
            'Balas pesan ini dengan nomor WhatsApp target untuk notifikasi.\n' +
            'Jika lebih dari satu nomor, pisahkan dengan koma.\n\n' +
            'Contoh:\n' +
            '`0812xxxx, 0857xxxx`');

        const numberCollector = new MessageCollector(
            client,
            async (response) => {
                const senderID = response.author || response.from;
                return senderID === (msg.author || msg.from);
            },
            { time: 60000, max: 1 }
        );

        const numbersCollected = await numberCollector.collect();
        if (numbersCollected.length === 0) {
            await msg.reply('❌ Waktu habis. Silakan mulai setup dari awal.');
            return;
        }
        const targetResponse = numbersCollected[0];

        let targetNumbers;
        try {
            targetNumbers = InputValidator.validateWhatsappNumbers(targetResponse.body);
        } catch (error) {
            await msg.reply(`❌ ${error.message}`);
            return;
        }

        if (targetNumbers.length === 0) {
            await msg.reply('❌ Setidaknya satu nomor WhatsApp harus valid.');
            return;
        }

        await msg.reply('Memulai proses otorisasi...');

        const credentials = JSON.parse(
            await fs.readFile(config.apis.gmail.sharedCredentialsPath, 'utf8')
        );

        const { client_secret, client_id } = credentials.installed;
        const server = http.createServer();
        const port = await getAvailablePort();
        const oAuth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            'urn:ietf:wg:oauth:2.0:oob'  // Untuk mendapatkan kode manual
        );

        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/gmail.modify']
        });

        await msg.reply(
            '*Proses Otorisasi Gmail*\n\n' +
            '1. Buka URL berikut di browser Anda:\n' +
            '`' + authUrl + '`\n\n' +
            '2. Login ke akun Gmail yang ingin Anda hubungkan\n' +
            '3. Berikan izin untuk aplikasi\n' +
            '4. Anda akan melihat kode otorisasi\n' +
            '5. *Salin kode tersebut dan kirim ke sini*\n\n' +
            '_Waktu timeout 5 menit_');

        const authCollector = new MessageCollector(
            client,
            async (response) => {
                const senderID = response.author || response.from;
                return senderID === (msg.author || msg.from);
            },
            { time: 300000, max: 1 }  // 5 menit timeout
        );

        const authCollected = await authCollector.collect();
        if (authCollected.length === 0) {
            await msg.reply('❌ Waktu habis. Silakan mulai setup dari awal.');
            return;
        }

        const code = authCollected[0].body.trim();

        const { tokens } = await withRetry(async () => {
            return await oAuth2Client.getToken(code);
        });
        
        const tokenPath = await withRetry(async () => {
            return await tokenManager.gmail.saveToken(validatedName, 'gmail', tokens);
        });

        oAuth2Client.setCredentials(tokens);
        const healthCheck = await AccountHealthChecker.checkGmailHealth(oAuth2Client);
        if (healthCheck.status !== 'healthy') {
            await msg.reply('⚠️ Akun berhasil ditambahkan tapi ada masalah: ' + healthCheck.message);
        }

        const newAccount = {
            name: validatedName,
            credentialsPath: config.apis.gmail.sharedCredentialsPath,
            tokenPath: path.join(__dirname, '..', 'data', 'credentials', 'gmailCredentials', `token-gmail-${validatedName.toLowerCase().replace(/\s+/g, '-')}.json`),
            targetNumbers,
            processedLabel: `Wabot-Notif-${validatedName.replace(/\s+/g, '')}`
        };

        accounts.push(newAccount);
        await saveGmailAccounts(accounts);

        await msg.reply(
            `*Setup Akun Gmail Berhasil!*\n\n` +
            `*Nama Akun:* ${validatedName}\n` +
            `*Target WhatsApp:* ${targetNumbers.map(n => n.replace('@c.us', '')).join(', ')}\n\n` +
            'Bot akan restart otomatis untuk menerapkan perubahan.');

        await new Promise(resolve => setTimeout(resolve, 2000));

        logger.info(`Gmail account "${validatedName}" setup completed. Restarting bot in 2 seconds...`);
        setTimeout(() => {
            process.exit(0);
        }, 2000);

    } catch (error) {
        logger.error('Error in Gmail account setup:', error);
        await msg.reply(
            '❌ Terjadi kesalahan saat setup akun Gmail.\n\n' +
            'Error: ' + error.message);
    }
}

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

        let validatedName;
        try {
            validatedName = await InputValidator.validateAccountName(args.join(' '));
        } catch (error) {
            await msg.reply(`❌ ${error.message}`);
            return;
        }

        try {
            await gmailRateLimiter.checkLimit('delete-account');
        } catch (error) {
            await msg.reply(`❌ ${error.message}`);
            return;
        }

        const accounts = await loadGmailAccounts();

        const accountToDelete = accounts.find(acc => acc.name.toLowerCase() === validatedName.toLowerCase());
        if (!accountToDelete) {
            await msg.reply(`❌ Akun dengan nama "${validatedName}" tidak ditemukan.`);
            return;
        }

        try {
            const credentials = JSON.parse(
                await fs.readFile(config.apis.gmail.sharedCredentialsPath, 'utf8')
            );
            const { client_secret, client_id } = credentials.installed;
            const oauth2Client = new google.auth.OAuth2(client_id, client_secret);
            
            const tokens = await tokenManager.gmail.loadToken(accountToDelete.name, 'gmail');
            oauth2Client.setCredentials(tokens);
            
            const healthCheck = await AccountHealthChecker.checkGmailHealth(oauth2Client);
            if (healthCheck.status === 'unhealthy') {
                await msg.reply('⚠️ Akun yang akan dihapus sudah tidak valid: ' + healthCheck.message);
            }
        } catch (error) {
            logger.warn(`Could not check account health before deletion: ${error.message}`);
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
                const deleted = await tokenManager.gmail.deleteToken(accountToDelete.name, 'gmail');
                if (deleted) {
                    logger.info(`Token deleted for Gmail account: ${accountToDelete.name}`);
                } else {
                    logger.warn(`No token found for Gmail account: ${accountToDelete.name}`);
                }
            }, 3, 2000); // 3 attempts, 2 second initial delay
        } catch (error) {
            logger.error('Error deleting token:', error);
        }

        const updatedAccounts = accounts.filter(acc => acc.name !== accountToDelete.name);
        await saveGmailAccounts(updatedAccounts);

        await msg.reply(
            `*Akun Gmail Berhasil Dihapus!*\n\n` +
            `*Nama Akun:* ${accountToDelete.name}\n\n` +
            'Bot akan restart otomatis untuk menerapkan perubahan.'
        );

        logger.info(`Gmail account "${accountToDelete.name}" deleted. Restarting bot in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        process.exit(0);

    } catch (error) {
        logger.error('Error in Gmail account deletion:', error);
        await msg.reply('❌ Terjadi kesalahan saat menghapus akun. Error: ' + error.message);
    }
}