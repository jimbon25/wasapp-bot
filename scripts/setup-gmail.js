import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import config from '../src/config.js';
import logger from '../src/utils/common/logger.js';

const GMAIL_ACCOUNTS_JSON_PATH = path.join(process.cwd(), 'src', 'data', 'static', 'gmail_accounts.json');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => {
        rl.question(query, resolve);
    });
}

async function loadGmailAccounts() {
    try {
        const jsonData = await fs.promises.readFile(GMAIL_ACCOUNTS_JSON_PATH, 'utf8');
        return JSON.parse(jsonData);
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        logger.error('Failed to read gmail_accounts.json:', error);
        return [];
    }
}

async function saveGmailAccounts(accounts) {
    try {
        await fs.promises.writeFile(GMAIL_ACCOUNTS_JSON_PATH, JSON.stringify(accounts, null, 2));
    } catch (error) {
        logger.error('Failed to save gmail_accounts.json:', error);
        throw new Error('Could not save account configuration.');
    }
}

async function addNewAccount() {
    console.log('\n--- Menambahkan Akun Gmail Baru ---');
    const name = await question('Masukkan nama pendek untuk akun ini (contoh: Pribadi, Kantor): ');
    if (!name) {
        console.log('Penambahan akun dibatalkan.');
        return;
    }

    const targetNumbersStr = await question('Masukkan nomor WhatsApp target (pisahkan dengan koma jika lebih dari satu): ');
    const targetNumbers = targetNumbersStr.split(',').map(n => {
        let num = n.trim();
        if (num.endsWith('@c.us')) {
            return num;
        }
        num = num.replace(/\D/g, '');
        if (num.startsWith('0')) {
            num = '62' + num.substring(1);
        }
        if (num) {
            return `${num}@c.us`;
        }
        return null;
    }).filter(n => n);
    if (targetNumbers.length === 0) {
        console.log('Nomor target tidak boleh kosong. Penambahan akun dibatalkan.');
        return;
    }

    const sanitizedName = name.toLowerCase().replace(/\s+/g, '-');
    // Always use the centralized credentials file
    const credentialsPath = path.join('src', 'data', 'credentials', 'credentials-gmail-all.json');
    const tokenPath = path.join('src', 'data', 'credentials', `token-gmail-${sanitizedName}.json`);
    const processedLabel = `Wabot-Notif-${name.replace(/\s+/g, '')}`;

    const newAccount = {
        name,
        credentialsPath,
        tokenPath,
        targetNumbers,
        processedLabel
    };

    console.log('\nKonfigurasi akun yang akan dibuat:');
    console.log(JSON.stringify(newAccount, null, 2));
    
    const confirmation = await question('\nApakah konfigurasi di atas sudah benar? (y/n): ');
    if (confirmation.toLowerCase() !== 'y') {
        console.log('Penambahan akun dibatalkan.');
        return;
    }

    // Correct instruction for the user
    console.log(`\nMemastikan file kredensial terpusat ada di: ${credentialsPath}`);
    if (!fs.existsSync(credentialsPath)) {
        logger.error(`File kredensial terpusat tidak ditemukan di ${credentialsPath}.`);
        logger.error('Mohon unduh file kredensial OAuth 2.0 dari Google Cloud, beri nama "credentials-gmail-all.json", dan letakkan di folder "src/data/credentials/".');
        await question('Tekan ENTER setelah file diletakkan untuk melanjutkan, atau batalkan dengan CTRL+C.');
    }

    const accounts = await loadGmailAccounts();
    // Check if an account with the same name already exists
    const existingAccountIndex = accounts.findIndex(acc => acc.name.toLowerCase() === name.toLowerCase());
    if (existingAccountIndex !== -1) {
        accounts[existingAccountIndex] = newAccount;
        console.log(`\nAkun dengan nama "${name}" sudah ada dan telah diperbarui.`);
    } else {
        accounts.push(newAccount);
        console.log(`\nAkun "${name}" telah berhasil ditambahkan ke konfigurasi!`);
    }
    
    await saveGmailAccounts(accounts);

    console.log('Anda sekarang dapat memilih akun ini dari menu utama untuk diotorisasi.');
    await question('Tekan ENTER untuk kembali ke menu utama.');
}

async function deleteAccount(accounts) {
    if (accounts.length === 0) {
        console.log('\nTidak ada akun untuk dihapus.');
        await question('Tekan ENTER untuk kembali ke menu utama.');
        return;
    }

    console.log('\n--- Hapus Akun Gmail ---');
    console.log('Pilih akun yang akan dihapus:');
    accounts.forEach((acc, index) => {
        console.log(`${index + 1}: ${acc.name}`);
    });
    console.log('-------------------------');
    const choice = await question('Masukkan nomor akun yang akan dihapus (atau ketik "batal"): ');

    if (choice.toLowerCase() === 'batal') {
        console.log('Penghapusan dibatalkan.');
        return;
    }

    const index = parseInt(choice, 10) - 1;
    if (index >= 0 && index < accounts.length) {
        const accountToDelete = accounts[index];
        const confirmDelete = await question(`Apakah Anda yakin ingin menghapus akun "${accountToDelete.name}"? (y/n): `); 

        if (confirmDelete.toLowerCase() === 'y') {
            // Remove account from array
            accounts.splice(index, 1);
            await saveGmailAccounts(accounts);
            console.log(`Akun "${accountToDelete.name}" telah dihapus dari konfigurasi.`);

            // Try to delete the token file
            try {
                if (fs.existsSync(accountToDelete.tokenPath)) {
                    await fs.promises.unlink(accountToDelete.tokenPath);
                    console.log(`File token "${accountToDelete.tokenPath}" juga telah dihapus.`);
                }
            } catch (error) {
                logger.error(`Gagal menghapus file token "${accountToDelete.tokenPath}":`, error);
                console.log(`⚠️ Gagal menghapus file token. Anda mungkin perlu menghapusnya secara manual.`);
            }
        } else {
            console.log('Penghapusan dibatalkan.');
        }
    } else {
        console.error('Pilihan tidak valid.');
    }
    await question('Tekan ENTER untuk kembali ke menu utama.');
}

async function selectAccount(accounts) {
    console.log('\n--- Manajemen Akun Gmail --- ');
    console.log('Pilih akun untuk diotorisasi atau kelola akun:');
    
    if (accounts.length > 0) {
        accounts.forEach((acc, index) => {
            const tokenExists = fs.existsSync(acc.tokenPath);
            console.log(`${index + 1}: ${acc.name} ${tokenExists ? '("✔ Linked")' : '("✘ Not Linked")'}`);
        });
    } else {
        console.log('(Tidak ada akun yang dikonfigurasi)');
    }

    console.log('-----------------------------------');
    console.log('A: Tambah Akun Baru');
    console.log('D: Hapus Akun');
    console.log('Q: Keluar');

    const choice = await question('Pilihan Anda: ');
    return choice.toLowerCase();
}

async function authorizeAccount(account) {
    try {
        const credentials = JSON.parse(
            fs.readFileSync(account.credentialsPath, 'utf8')
        );

        const { client_secret, client_id, redirect_uris } = credentials.installed;
        const oAuth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            redirect_uris[0]
        );

        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/gmail.modify']
        });

        console.log(`\nBuka URL berikut di browser untuk mengotorisasi akun "${account.name}":`);
        console.log(authUrl);

        const code = await question('\nMasukkan kode dari halaman otorisasi di sini: ');
        
        const { tokens } = await oAuth2Client.getToken(code);
        
        fs.writeFileSync(account.tokenPath, JSON.stringify(tokens));
        console.log(`\n Token untuk "${account.name}" berhasil disimpan di:`, account.tokenPath);
        
        oAuth2Client.setCredentials(tokens);
        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
        
        console.log('\nMenguji koneksi ke Gmail API...');
        const response = await gmail.users.getProfile({ userId: 'me' });
        
        console.log(`Koneksi berhasil! Alamat Email: ${response.data.emailAddress}`);
        
        console.log(`\nMendaftarkan push notification untuk ${response.data.emailAddress}...`);
        await gmail.users.watch({
            userId: 'me',
            resource: {
                labelIds: ['INBOX'],
                topicName: config.apis.gmail.topicName
            }
        });
        console.log('Berhasil mendaftar push notification. Bot akan menerima update secara real-time.');
        await question('\nOtorisasi selesai. Tekan ENTER untuk kembali ke menu utama.');

    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.error(`File kredensial tidak ditemukan di: ${account.credentialsPath}`);
            logger.error(`Mohon unduh file JSON kredensial dari Google Cloud Console dan letakkan di path yang benar.`);
        } else {
            logger.error(`Terjadi kesalahan saat proses otorisasi untuk "${account.name}":`, error.response ? error.response.data : error.message);
        }
        await question('\nProses gagal. Tekan ENTER untuk kembali ke menu utama.');
    }
}

async function main() {
    while (true) {
        const accounts = await loadGmailAccounts();
        const choice = await selectAccount(accounts);

        if (choice === 'q') {
            console.log('Keluar dari skrip setup.');
            rl.close();
            break;
        }

        if (choice === 'a') {
            await addNewAccount();
            continue;
        }

        if (choice === 'd') {
            await deleteAccount(accounts);
            continue;
        }

        const index = parseInt(choice, 10) - 1;
        if (index >= 0 && index < accounts.length) {
            await authorizeAccount(accounts[index]);
        } else {
            console.error('Pilihan tidak valid. Silakan coba lagi.');
            await question('Tekan ENTER untuk melanjutkan.');
        }
    }
}

main().catch(err => {
    logger.error('Skrip setup gagal:', err);
    rl.close();
});
