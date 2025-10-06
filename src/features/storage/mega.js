import logger from '../../utils/common/logger.js';
import megaService from '../../services/storage/megaService.js';
import megaSessionService from '../../services/storage/megaSessionService.js';
import fileManager, { FILE_TYPES } from '../../utils/fileManagement/fileManager.js';

async function handleMediaMessage(message) {
    let tempFilePath = null;
    try {
        const userId = message.author || message.from;
        const session = await megaSessionService.getSession(userId);

        // Only handle media if a session is active
        if (!session || !session.isActive) return false;

        await message.react('📤');

        const downloadedMedia = await message.downloadMedia();
        if (!downloadedMedia) {
            throw new Error('Gagal mengunduh media.');
        }

        const remoteFileName = downloadedMedia.filename || `mega-upload-${Date.now()}`;
        tempFilePath = fileManager.getPath(FILE_TYPES.TEMP, remoteFileName);
        await fileManager.writeBase64File(tempFilePath, downloadedMedia.data);

        await megaService.uploadFile(tempFilePath, remoteFileName);
        await message.react('✅');
        return true;

    } catch (error) {
        await message.react('❌');
        logger.error('Error handling Mega media message:', error);
        await message.reply(`❌ Gagal mengupload file ke sesi Mega.\nAlasan: ${error.message}`);
        return true; // Indicate the message was handled
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
    description: 'Uploads files to Mega.nz with session support.',
    adminOnly: true,

    handleMediaMessage: handleMediaMessage,

    async execute(message, args) {
        try {
            const userId = message.author || message.from;

            if (args[0] === 'start') {
                await megaSessionService.startSession(userId);
                return message.reply('✅ Sesi upload Mega dimulai. Semua file yang Anda kirim sekarang akan diupload ke folder default.\n\nKetik `/mega done` untuk mengakhiri sesi.');
            }

            if (args[0] === 'done') {
                const hasSession = await megaSessionService.hasActiveSession(userId);
                if (!hasSession) {
                    return message.reply('⚠️ Tidak ada sesi upload Mega yang aktif.');
                }
                await megaSessionService.endSession(userId);
                return message.reply('✅ Sesi upload Mega telah diakhiri.');
            }

            // Single file upload (original functionality)
            const mediaMessage = message.hasMedia ? message : (message.hasQuotedMsg ? await message.getQuotedMessage() : null);
            if (mediaMessage && mediaMessage.hasMedia) {
                let tempFilePath = null;
                try {
                    await message.reply('⏳ Memproses upload tunggal ke Mega.nz...');
                    const downloadedMedia = await mediaMessage.downloadMedia();
                    const remoteFileName = downloadedMedia.filename || `mega-upload-${Date.now()}`;
                    tempFilePath = fileManager.getPath(FILE_TYPES.TEMP, remoteFileName);
                    await fileManager.writeBase64File(tempFilePath, downloadedMedia.data);

                    const result = await megaService.uploadFile(tempFilePath, remoteFileName);
                    return message.reply(`✅ File berhasil diupload ke folder default Mega!\nLink: ${result.link}`);
                } finally {
                    if (tempFilePath) await fileManager.deleteFile(tempFilePath);
                }
            }

            await message.reply(
                '*Perintah Sesi Mega*\n\n' +
                '`/mega start` - Memulai sesi upload, semua file berikutnya akan diupload otomatis.\n' +
                '`/mega done` - Mengakhiri sesi upload.\n\n' +
                'Atau, reply sebuah file dengan `/mega` untuk upload tunggal.'
            );

        } catch (error) {
            logger.error('Error in /mega command:', error);
            await message.reply(`❌ Terjadi kesalahan pada perintah Mega.\nAlasan: ${error.message}`);
        }
    }
};
