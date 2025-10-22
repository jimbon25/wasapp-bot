import logger from '../../utils/common/logger.js';
import megaService from '../../services/storage/megaService.js';
import megaSessionService from '../../services/storage/megaSessionService.js';
import megaAuthService from '../../services/storage/auth/megaAuthService.js';
import fileManager, { FILE_TYPES } from '../../utils/fileManagement/fileManager.js';

async function handleMediaMessage(message) {
    let tempFilePath = null;
    try {
        const userId = message.author || message.from;
        const session = await megaSessionService.getSession(userId);

        if (!session || !session.isActive) return false;

        const userCredentials = await megaAuthService.getCredentials(userId);
        if (!userCredentials) {
            await message.reply('✗ Akun Mega.nz Anda tidak terhubung. Silakan login dengan `/mega login <email> <password>` di chat pribadi dengan bot.');
            await megaSessionService.endSession(userId);
            return true;
        }

        await message.react('📤');

        const downloadedMedia = await message.downloadMedia();
        if (!downloadedMedia) {
            throw new Error('Gagal mengunduh media.');
        }

        const remoteFileName = downloadedMedia.filename || `mega-upload-${Date.now()}`;
        tempFilePath = fileManager.getPath(FILE_TYPES.TEMP, remoteFileName);
        await fileManager.writeBase64File(tempFilePath, downloadedMedia.data);

        await megaService.uploadFile(tempFilePath, remoteFileName, userCredentials);
        await message.react('');
        return true;

    } catch (error) {
        await message.react('✗');
        logger.error('Error handling Mega media message:', error);
        await message.reply(`✗ Gagal mengupload file ke sesi Mega.\nAlasan: ${error.message}`);
        return true;
    } finally {
        if (tempFilePath) {
            try {
                await fileManager.deleteFile(tempFilePath);
            } catch (cleanupError) {
                logger.error(`Gagal menghapus file sementara: ${tempFilePath}`, cleanupError);
            }
        }
    }
}

export default {
    name: 'mega',
    description: 'Uploads files to a personal Mega.nz account with session support.',
    // adminOnly: true,

    handleMediaMessage: handleMediaMessage,

    async execute(message, args) {
        try {
            const userId = message.author || message.from;
            const chat = await message.getChat();

            // --- Credential Management Commands ---
            if (args[0] === 'login') {
                if (chat.isGroup) {
                    return message.reply('✗ Perintah ini hanya bisa digunakan di chat pribadi dengan bot untuk keamanan.');
                }
                if (args.length !== 3) {
                    return message.reply('Format salah. Gunakan: `/mega login <email> <password>`');
                }
                const email = args[1];
                const password = args[2];

                await megaAuthService.saveCredentials(userId, email, password);
                await message.reply(' Akun Mega.nz Anda telah berhasil terhubung. Kredensial Anda disimpan dalam bentuk terenkripsi.');
                
                // Delete the message containing the password for security
                try {
                    await message.delete(true);
                } catch (delError) {
                    logger.warn(`Could not delete login message for user ${userId}. It might have been deleted already or I lack permissions.`);
                    await message.reply('⚠️ Gagal menghapus pesan login Anda. Mohon hapus secara manual untuk keamanan.');
                }
                return;
            }

            if (args[0] === 'logout') {
                const deleted = await megaAuthService.deleteCredentials(userId);
                if (deleted) {
                    return message.reply(' Akun Mega.nz Anda telah berhasil diputus.');
                }
                return message.reply('ℹ️ Tidak ada akun Mega.nz yang terhubung.');
            }

            if (args[0] === 'account') {
                const creds = await megaAuthService.getCredentials(userId);
                if (creds && creds.email) {
                    return message.reply(` Akun Mega.nz yang terhubung saat ini: ${creds.email}`);
                }
                return message.reply('ℹ️ Tidak ada akun Mega.nz yang terhubung. Silakan login dengan `/mega login`.');
            }

            // --- Session and Upload Commands ---
            const userCredentials = await megaAuthService.getCredentials(userId);
            if (!userCredentials) {
                return message.reply('✗ Akun Mega.nz Anda belum terhubung. Silakan login terlebih dahulu dengan: `/mega login <email> <password>` di chat pribadi dengan bot.');
            }

            if (args[0] === 'start') {
                await megaSessionService.startSession(userId);
                return message.reply(' Sesi upload Mega dimulai. Semua file yang Anda kirim sekarang akan diupload ke akun Mega Anda.\n\nKetik `/mega done` untuk mengakhiri sesi.');
            }

            if (args[0] === 'done') {
                const hasSession = await megaSessionService.hasActiveSession(userId);
                if (!hasSession) {
                    return message.reply('⚠️ Tidak ada sesi upload Mega yang aktif.');
                }
                await megaSessionService.endSession(userId);
                return message.reply(' Sesi upload Mega telah diakhiri.');
            }

            const mediaMessage = message.hasMedia ? message : (message.hasQuotedMsg ? await message.getQuotedMessage() : null);
            if (mediaMessage && mediaMessage.hasMedia) {
                let tempFilePath = null;
                try {
                    await message.reply('⏳ Memproses upload tunggal ke akun Mega.nz Anda...');
                    const downloadedMedia = await mediaMessage.downloadMedia();
                    const remoteFileName = downloadedMedia.filename || `mega-upload-${Date.now()}`;
                    tempFilePath = fileManager.getPath(FILE_TYPES.TEMP, remoteFileName);
                    await fileManager.writeBase64File(tempFilePath, downloadedMedia.data);

                    const result = await megaService.uploadFile(tempFilePath, remoteFileName, userCredentials);
                    return message.reply(` File berhasil diupload ke akun Mega Anda!\nLink: ${result.link}`);
                } finally {
                    if (tempFilePath) await fileManager.deleteFile(tempFilePath);
                }
            }

            await message.reply(
                '*Perintah Meganz*\n\n' +
                '*Manajemen Akun (di chat pribadi):*\n' +
                '`/mega login <email> <pass>` - Hubungkan akun Mega\n' +
                '`/mega logout` - Putuskan koneksi akun Mega\n' +
                '`/mega account` - Lihat akun yang terhubung\n\n' +
                '*Sesi Upload:*\n' +
                '`/mega start` - Mulai sesi upload\n' +
                '`/mega done` - Akhiri sesi upload\n\n' +
                'Atau, reply sebuah file dengan `/mega` untuk upload tunggal.'
            );

        } catch (error) {
            logger.error('Error in /mega command:', error);
            await message.reply(`✗ Terjadi kesalahan pada perintah Mega.\nAlasan: ${error.message}`);
        }
    }
};
