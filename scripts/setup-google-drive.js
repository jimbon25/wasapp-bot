import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import logger from '../src/utils/common/logger.js';

// ANSI Colors
const colors = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
};

const GDRIVE_CONFIG_PATH = path.join(process.cwd(), 'src', 'data', 'credentials', 'gdrive_config.json');
const CREDENTIALS_DIR = path.join(process.cwd(), 'src', 'data', 'credentials');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => {
        rl.question(query, resolve);
    });
}

function printHeader(title) {
    console.log(`\n${colors.cyan}--- ${title} ---${colors.reset}\n`);
}

async function loadDriveConfig() {
    try {
        const jsonData = await fs.readFile(GDRIVE_CONFIG_PATH, 'utf8');
        return JSON.parse(jsonData);
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        logger.error('Gagal membaca gdrive_config.json:', error);
        console.log(`${colors.red}File konfigurasi gdrive_config.json tidak ditemukan atau rusak.${colors.reset}`);
        process.exit(1);
    }
}

async function saveDriveConfig(accounts) {
    try {
        await fs.writeFile(GDRIVE_CONFIG_PATH, JSON.stringify(accounts, null, 2));
    } catch (error) {
        logger.error('Gagal menyimpan gdrive_config.json:', error);
        throw new Error('Tidak dapat menyimpan konfigurasi Google Drive.');
    }
}

async function addNewAccount() {
    printHeader('Menambahkan Akun Google Drive Baru');
    const name = await question('➤ Masukkan nama pendek untuk akun ini (contoh: Pribadi, Kantor): ');
    if (!name) {
        console.log(colors.yellow, 'Penambahan akun dibatalkan.', colors.reset);
        return;
    }

    const folderId = await question(`➤ Masukkan ID folder Google Drive default untuk diunggah: `);
    if (!folderId) {
        console.log(colors.red, '✗ ID Folder tidak boleh kosong. Penambahan akun dibatalkan.', colors.reset);
        return;
    }

    const sanitizedName = name.toLowerCase().replace(/\s+/g, '-');
    const newAccount = {
        accountName: name,
        credentialsPath: 'src/data/credentials/credentials.json',
        tokenPath: `src/data/credentials/token-drive-${sanitizedName}.json`,
        defaultFolderId: folderId.trim()
    };

    console.log('\nKonfigurasi akun yang akan dibuat:');
    console.log(colors.yellow, JSON.stringify(newAccount, null, 2), colors.reset);
    
    const confirmation = await question('\nApakah konfigurasi di atas sudah benar? (y/n): ');
    if (confirmation.toLowerCase() !== 'y') {
        console.log(colors.yellow, 'Penambahan akun dibatalkan.', colors.reset);
        return;
    }

    const accounts = await loadDriveConfig();
    const existingAccountIndex = accounts.findIndex(acc => acc.accountName.toLowerCase() === name.toLowerCase());
    if (existingAccountIndex !== -1) {
        accounts[existingAccountIndex] = newAccount;
        console.log(colors.green, `\n✔ Akun dengan nama "${name}" sudah ada dan telah diperbarui.`, colors.reset);
    } else {
        accounts.push(newAccount);
        console.log(colors.green, `\n✔ Akun "${name}" telah berhasil ditambahkan ke konfigurasi!`, colors.reset);
    }
    
    await saveDriveConfig(accounts);

    console.log('\nAnda sekarang dapat memilih akun ini dari menu utama untuk diotorisasi.');
    await question('Tekan ENTER untuk kembali ke menu utama.');
}

async function deleteAccount(accounts) {
    printHeader('Hapus Akun Google Drive');
    if (accounts.length === 0) {
        console.log(colors.yellow, '\nTidak ada akun untuk dihapus.', colors.reset);
        await question('Tekan ENTER untuk kembali ke menu utama.');
        return;
    }

    console.log('Pilih akun yang akan dihapus:');
    accounts.forEach((acc, index) => {
        console.log(`  ${index + 1}: ${acc.accountName}`);
    });
    console.log('-------------------------');
    const choice = await question('Masukkan nomor akun yang akan dihapus (atau ketik "batal"): ');

    if (choice.toLowerCase() === 'batal') {
        console.log(colors.yellow, 'Penghapusan dibatalkan.', colors.reset);
        return;
    }

    const index = parseInt(choice, 10) - 1;
    if (index >= 0 && index < accounts.length) {
        const accountToDelete = accounts[index];
        const confirmDelete = await question(`Apakah Anda yakin ingin menghapus akun "${accountToDelete.accountName}"? (y/n): `); 

        if (confirmDelete.toLowerCase() === 'y') {
            accounts.splice(index, 1);
            await saveDriveConfig(accounts);
            console.log(colors.green, `✔ Akun "${accountToDelete.accountName}" telah dihapus dari konfigurasi.`, colors.reset);

            try {
                const tokenFullPath = path.join(process.cwd(), accountToDelete.tokenPath);
                await fs.unlink(tokenFullPath);
                console.log(colors.green, `✔ File token "${accountToDelete.tokenPath}" juga telah dihapus.`, colors.reset);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    logger.error(`Gagal menghapus file token "${accountToDelete.tokenPath}":`, error);
                }
            }
        } else {
            console.log(colors.yellow, 'Penghapusan dibatalkan.', colors.reset);
        }
    } else {
        console.error(colors.red, 'Pilihan tidak valid.', colors.reset);
    }
    await question('Tekan ENTER untuk kembali ke menu utama.');
}

async function selectAccount(accounts) {
    printHeader('Manajemen Akun Google Drive');
    
    if (accounts.length > 0) {
        for (let i = 0; i < accounts.length; i++) {
            const acc = accounts[i];
            let status = `${colors.red}✗ Not Linked${colors.reset}`;
            try {
                await fs.access(path.join(process.cwd(), acc.tokenPath));
                status = `${colors.green}✔ Linked${colors.reset}`;
            } catch (e) { /* File not found, so not linked */ }
            console.log(`  ${colors.bold}${i + 1}:${colors.reset} ${acc.accountName} (${status})`);
        }
    } else {
        console.log(`  ${colors.yellow}(Tidak ada akun yang dikonfigurasi)${colors.reset}`);
    }

    console.log('\n' + '─'.repeat(62));
    console.log(`  ${colors.bold}[A]${colors.reset} Tambah Akun   ${colors.bold}[D]${colors.reset} Hapus Akun   ${colors.bold}[Q]${colors.reset} Keluar`);
    console.log('─'.repeat(62));

    const choice = await question('Pilihan Anda: ');
    return choice.toLowerCase();
}

async function authorizeAccount(account) {
    printHeader(`Otorisasi Akun: ${account.accountName}`);
    const credentialsPath = path.join(process.cwd(), account.credentialsPath);

    try {
        await fs.access(credentialsPath);
    } catch (error) {
        console.log(`${colors.red}✗ File kredensial (credentials.json) tidak ditemukan di ${credentialsPath}.${colors.reset}`);
        console.log(`   Silakan unduh file kredensial OAuth 2.0 dari Google Cloud Console dan letakkan di sana.`);
        await question('Tekan ENTER untuk kembali ke menu utama...');
        return;
    }

    const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.file']
    });

    console.log(`\n${colors.yellow}Buka URL berikut di browser untuk otorisasi:${colors.reset}`);
    console.log(colors.cyan, authUrl, colors.reset);

    const code = await question(`\n${colors.yellow}Masukkan kode otorisasi dari halaman tersebut di sini: ${colors.reset}`);
    
    try {
        const { tokens } = await oAuth2Client.getToken(code);
        const tokenPath = path.join(process.cwd(), account.tokenPath);
        await fs.writeFile(tokenPath, JSON.stringify(tokens));
        console.log(`${colors.green}✔ Token berhasil disimpan di: ${account.tokenPath}${colors.reset}`);
        
        console.log('\nMenguji koneksi ke Google Drive...');
        oAuth2Client.setCredentials(tokens);
        const drive = google.drive({ version: 'v3', auth: oAuth2Client });
        const about = await drive.about.get({ fields: 'user' });
        const email = about.data.user.emailAddress;
        console.log(`${colors.green}✔ Koneksi ke Google Drive berhasil! Akun terhubung: ${email}${colors.reset}`);

    } catch (error) {
        logger.error('Gagal mendapatkan atau menguji token akses:', error.response ? error.response.data : error.message);
        console.log(`${colors.red}✗ Gagal mendapatkan token. Pastikan kode yang dimasukkan benar.${colors.reset}`);
    }
    await question('\nTekan ENTER untuk kembali ke menu utama.');
}

async function main() {
    while (true) {
        const accounts = await loadDriveConfig();
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
            console.error(colors.red, 'Pilihan tidak valid. Silakan coba lagi.', colors.reset);
            await question('Tekan ENTER untuk melanjutkan.');
        }
    }
}

main().catch(err => {
    logger.error('Skrip setup Google Drive gagal:', err);
    rl.close();
});