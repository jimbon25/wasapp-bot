import logger from '../../utils/common/logger.js';
import googleDriveService from '../../services/gdriveServices/googleDriveService.js';
import megaService from '../../services/storage/megaService.js';
import megaAuthService from '../../services/storage/auth/megaAuthService.js';
import fileManager from '../../utils/fileManagement/fileManager.js';
import * as uploadBatchManager from '../../utils/systemService/uploadBatchManager.js';

export default {
    name: 'upload',
    description: 'Uploads a batch of media files to cloud storage (Admin Only).',
    adminOnly: true,

    async execute(message, args) {
        const validTargets = ['drive', 'mega'];
        const target = args[0];
        const senderId = message.author || message.from;

        if (!target || !validTargets.includes(target)) {
            return message.reply('❌ Format salah. Gunakan `/upload drive` atau `/upload mega`.');
        }

        // This command must be a reply to a message.
        if (!message.hasQuotedMsg) {
            return message.reply('❌ Perintah ini harus digunakan dengan membalas pesan konfirmasi dari bot.');
        }

        const chat = await message.getChat();
        if (!chat.isGroup) {
            return message.reply('❌ Perintah ini hanya bisa digunakan di dalam grup.');
        }

        const batchKey = uploadBatchManager.createBatchKey(chat.id._serialized, senderId);
        const batch = uploadBatchManager.getBatch(batchKey);

        if (!batch || batch.messages.length === 0) {
            return message.reply('❌ Tidak ada sesi upload aktif atau tidak ada file dalam batch. Silakan kirim file terlebih dahulu.');
        }

        const fileCount = batch.messages.length;
        await message.reply(`⏳ Oke, mengupload ${fileCount} file ke ${target}. Ini mungkin butuh beberapa saat...`);

        const uploadPromises = batch.messages.map(async (mediaMsg) => {
            let tempFilePath = null;
            try {
                const media = await mediaMsg.downloadMedia();
                tempFilePath = await fileManager.saveMedia(media, media.filename || `upload-${Date.now()}`);
                
                if (target === 'drive') {
                    return await googleDriveService.uploadFile(tempFilePath, media.filename);
                } else if (target === 'mega') {
                    const userCredentials = await megaAuthService.getCredentials(senderId);
                    if (!userCredentials) {
                        throw new Error('Akun Mega.nz Anda tidak terhubung.');
                    }
                    return await megaService.uploadFile(tempFilePath, media.filename, userCredentials);
                }
            } finally {
                if (tempFilePath) {
                    await fileManager.deleteFile(tempFilePath).catch(e => logger.error(`Failed to delete temp file: ${tempFilePath}`, e));
                }
            }
        });

        try {
            const results = await Promise.all(uploadPromises);
            const successCount = results.length;
            
            let links = '';
            if (target === 'drive') {
                links = results.map((r, i) => `${i + 1}. ${r.webViewLink}`).join('\n');
            } else {
                links = results.map((r, i) => `${i + 1}. ${r.link}`).join('\n');
            }

            await message.reply(`✅ Berhasil mengupload ${successCount} dari ${fileCount} file ke ${target}.\n\n${links}`);

        } catch (error) {
            logger.error(`Error on bulk /upload command:`, error);
            await message.reply(`❌ Gagal mengupload batch file. Alasan: ${error.message}`);
        } finally {
            // Cleanup the batch after processing
            uploadBatchManager.deleteBatch(batchKey);
        }
    }
};
