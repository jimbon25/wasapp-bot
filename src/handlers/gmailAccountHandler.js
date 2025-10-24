import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import logger from '../utils/common/logger.js';
import config from '../config.js';
import EncryptionUtil from '../utils/common/encryptionUtil.js';
import { google } from 'googleapis';
import securityManager from '../utils/systemService/securityManager.js';
import MessageCollector from '../utils/messageHandling/messageCollector.js';

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
    // Hanya admin yang bisa menambah akun
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

        const accountName = args.join(' ');
        const accounts = await loadGmailAccounts();

        // Cek apakah nama akun sudah ada
        if (accounts.some(acc => acc.name.toLowerCase() === accountName.toLowerCase())) {
            await msg.reply(`❌ Akun dengan nama "${accountName}" sudah ada.`);
            return;
        }

        await msg.reply(
            `*📧 Setup Akun Gmail: ${accountName}*\n\n` +
            'Balas pesan ini dengan nomor WhatsApp target untuk notifikasi.\n' +
            'Jika lebih dari satu nomor, pisahkan dengan koma.\n\n' +
            'Contoh:\n' +
            '`0812xxxx, 0857xxxx`');

        // Menunggu balasan nomor target
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

        const targetNumbers = targetResponse.body.split(',').map(n => {
            let num = n.trim();
            if (num.endsWith('@c.us')) return num;
            num = num.replace(/\D/g, '');
            if (num.startsWith('0')) num = '62' + num.substring(1);
            return num ? `${num}@c.us` : null;
        }).filter(n => n);

        if (targetNumbers.length === 0) {
            await msg.reply('❌ Format nomor tidak valid. Silakan mulai setup dari awal.');
            return;
        }

        // Mulai proses otorisasi
        await msg.reply('🔄 Memulai proses otorisasi...');

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
            '*🔐 Proses Otorisasi Gmail*\n\n' +
            '1. Buka URL berikut di browser Anda:\n' +
            '`' + authUrl + '`\n\n' +
            '2. Login ke akun Gmail yang ingin Anda hubungkan\n' +
            '3. Berikan izin untuk aplikasi\n' +
            '4. Anda akan melihat kode otorisasi\n' +
            '5. *Salin kode tersebut dan kirim ke sini*\n\n' +
            '_Waktu timeout 5 menit_');

        // Tunggu user mengirim kode otorisasi
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

        const { tokens } = await oAuth2Client.getToken(code);
        
        // Enkripsi token
        const secretKey = config.mega.credentialsSecret;
        if (!secretKey) {
            throw new Error('MEGA_CREDENTIALS_SECRET is not defined in .env');
        }
        const encryptionUtil = new EncryptionUtil(secretKey);
        const encryptedTokens = encryptionUtil.encrypt(JSON.stringify(tokens));

        // Simpan token
        const tokenPath = path.join(
            config.apis.gmail.credentialsDir,
            `token-gmail-${accountName.toLowerCase().replace(/\s+/g, '-')}.json`
        );
        await fs.writeFile(tokenPath, encryptedTokens);

        // Tambahkan akun ke konfigurasi
        const newAccount = {
            name: accountName,
            credentialsPath: config.apis.gmail.sharedCredentialsPath,
            tokenPath: `src/data/credentials/gmailCredentials/token-gmail-${accountName.toLowerCase().replace(/\s+/g, '-')}.json`,
            targetNumbers,
            processedLabel: `Wabot-Notif-${accountName.replace(/\s+/g, '')}`
        };

        accounts.push(newAccount);
        await saveGmailAccounts(accounts);

        // Kirim pesan sukses dan tunggu sampai terkirim
        await msg.reply(
            `*✅ Setup Akun Gmail Berhasil!*\n\n` +
            `*Nama Akun:* ${accountName}\n` +
            `*Target WhatsApp:* ${targetNumbers.map(n => n.replace('@c.us', '')).join(', ')}\n\n` +
            'Bot akan restart otomatis untuk menerapkan perubahan.');

        // Tunggu sebentar untuk memastikan pesan terkirim
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Trigger restart bot dengan delay untuk memastikan pesan terkirim
        logger.info(`Gmail account "${accountName}" setup completed. Restarting bot in 2 seconds...`);
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