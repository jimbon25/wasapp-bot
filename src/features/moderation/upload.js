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
        const validTargets = ['drive', 'mega', 'cancel'];
        const target = args[0];
        const senderId = message.author || message.from; // Needed for Mega auth

        if (!target || !validTargets.includes(target)) {
            return message.reply('❌ Format salah. Gunakan `/upload drive`, `/upload mega`, atau `/upload cancel`.');
        }

        const chat = await message.getChat();
        if (!chat.isGroup) {
            return message.reply('❌ Perintah ini hanya bisa digunakan di dalam grup.');
        }
        
        const batchKey = uploadBatchManager.createBatchKey(chat.id._serialized);

        if (target === 'cancel') {
            const batch = uploadBatchManager.getBatch(batchKey);
            if (batch && batch.timer) {
                clearTimeout(batch.timer);
                const fileCount = batch.messages.length;
                uploadBatchManager.deleteBatch(batchKey);
                logger.info(`Auto-upload batch of ${fileCount} files canceled by user ${senderId} in group ${chat.id._serialized}`);
                return message.reply(`Sesi pengumpulan file media telah dibatalkan total ${fileCount} file canceled.`);
            } else {
                return message.reply('Tidak ada sesi pengumpulan file yang aktif untuk dibatalkan.');
            }
        }

        if (!message.hasQuotedMsg) {
            return message.reply('❌ Perintah `/upload drive` atau `/upload mega` harus digunakan dengan membalas pesan konfirmasi dari bot.');
        }
        
        const quotedMsg = await message.getQuotedMessage();
        if (!quotedMsg.fromMe) {
             return message.reply('❌ Perintah ini hanya valid jika digunakan untuk membalas pesan prompt dari bot.');
        }

        const batch = uploadBatchManager.getBatch(batchKey);

        if (!batch || batch.messages.length === 0) {
            return message.reply('❌ Tidak ada sesi upload aktif atau file dalam batch. Sesi mungkin sudah kedaluwarsa atau dibatalkan.');
        }

        const fileCount = batch.messages.length;
        await message.reply(`Mengupload ${fileCount} file ke ${target}. Ini mungkin butuh beberapa saat...`);

        try {
            if (target === 'drive') {
                const timestamp = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).replace(/\./g, ':');
                const folderName = `Upload Batch - ${timestamp}`;
                
                await message.reply(`Membuat folder baru di Google Drive: \"${folderName}\"...`);
                const newFolder = await googleDriveService.createFolder(folderName);

                const uploadPromises = batch.messages.map(async (mediaMsg) => {
                    let tempFilePath = null;
                    try {
                        const media = await mediaMsg.downloadMedia();
                        tempFilePath = await fileManager.saveMedia(media, media.filename || `upload-${Date.now()}`);
                        return await googleDriveService.uploadFile(tempFilePath, media.filename, newFolder.id);
                    } finally {
                        if (tempFilePath) {
                            await fileManager.deleteFile(tempFilePath).catch(e => logger.error(`Failed to delete temp file: ${tempFilePath}`, e));
                        }
                    }
                });
                
                const results = await Promise.all(uploadPromises);
                await message.reply(`Berhasil mengupload ${results.length} file ke folder baru!\n\nLink Folder: ${newFolder.webViewLink}`);

            } else if (target === 'mega') {
                const uploadPromises = batch.messages.map(async (mediaMsg) => {
                    let tempFilePath = null;
                    try {
                        const media = await mediaMsg.downloadMedia();
                        tempFilePath = await fileManager.saveMedia(media, media.filename || `upload-${Date.now()}`);
                        const userCredentials = await megaAuthService.getCredentials(senderId);
                        if (!userCredentials) {
                            throw new Error('Akun Mega.nz Anda tidak terhubung.');
                        }
                        return await megaService.uploadFile(tempFilePath, media.filename, userCredentials);
                    } finally {
                        if (tempFilePath) {
                            await fileManager.deleteFile(tempFilePath).catch(e => logger.error(`Failed to delete temp file: ${tempFilePath}`, e));
                        }
                    }
                });

                const results = await Promise.all(uploadPromises);
                const successCount = results.length;
                const links = results.map((r, i) => `${i + 1}. ${r.link}`).join('\n');
                await message.reply(`Berhasil mengupload ${successCount} dari ${fileCount} file ke Mega.nz.\n\n${links}`);
            }

        } catch (error) {
            logger.error(`Error on bulk /upload command:`, error);
            await message.reply(`❌ Gagal mengupload batch file. Alasan: ${error.message}`);
        } finally {
            uploadBatchManager.deleteBatch(batchKey);
        }
    }
};
