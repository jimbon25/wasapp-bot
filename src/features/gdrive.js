import logger from '../utils/common/logger.js';
import googleDriveService from '../services/gdriveServices/googleDriveService.js';
import uploadSessionService from '../services/gdriveServices/uploadSessionService.js';
import driveFolderService from '../services/gdriveServices/driveFolderService.js';
import { FileManager } from '../utils/fileManagement/fileManager.js';

export default {
    name: 'gdrive',
    
    async handleMediaMessage(message) {
        try {
            const userId = message.from;
            const session = await uploadSessionService.getSession(userId);
            
            if (!session) return false;
            
            await message.reply(`📤 Mengupload ke folder "${session.folderName}"...`);
            
            const fileManager = new FileManager();
            const downloadedMedia = await message.downloadMedia();
            const tempFilePath = await fileManager.saveMedia(downloadedMedia);
            
            const mimeType = downloadedMedia.mimetype;
            
            const fileExt = fileManager.getExtensionFromMimeType(mimeType);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            
            let fileName;
            if (message.type === 'document') {
                fileName = downloadedMedia.filename || message.mediaData?.fileName || `document_${timestamp}${fileExt}`;
            } else if (message.type === 'image') {
                fileName = `photo_${timestamp}${fileExt}`;
            } else if (message.type === 'video') {
                fileName = `video_${timestamp}${fileExt}`;
            } else if (message.type === 'audio') {
                fileName = `audio_${timestamp}${fileExt}`;
            } else {
                fileName = `media_${timestamp}${fileExt}`;
            }
            
            logger.info('Upload Info:', {
                messageType: message.type,
                mimeType: mimeType,
                generatedName: fileName,
                mediaFilename: downloadedMedia.filename,
                mediaDataFilename: message.mediaData?.fileName
            });
            
            try {
                await googleDriveService.uploadFile(tempFilePath, fileName, session.folderId, mimeType);
                await uploadSessionService.updateSession(userId);
                await message.reply('✅ File berhasil diupload ke folder!');
                return true;
            } catch (error) {
                if (error.message.includes('rate limit')) {
                    await message.reply('⚠️ Google Drive API rate limit terlampaui. Mohon coba lagi nanti.');
                } else {
                    await message.reply('❌ Terjadi kesalahan saat mengupload file. Mohon coba lagi.');
                    logger.error('Error uploading media in session:', error);
                }
                return true;
            } finally {
                if (tempFilePath) {
                    try {
                        await fileManager.deleteFile(tempFilePath);
                    } catch (deleteError) {
                        logger.error(`Failed to delete temporary file: ${tempFilePath}`, deleteError);
                    }
                }
            }
        } catch (error) {
            logger.error('Error handling media message:', error);
            return false;
        }
    },

    async execute(message, args) {
        try {
            const userId = message.from;

            if (args[0] === 'done') {
                const hasSession = await uploadSessionService.hasActiveSession(userId);
                if (!hasSession) {
                    await message.reply('⚠️ Tidak ada sesi upload yang aktif.');
                    return;
                }
                
                const session = await uploadSessionService.getSession(userId);
                await uploadSessionService.endSession(userId);
                await message.reply(`✅ Sesi upload ke folder "${session.folderName}" selesai.\nTotal file yang diupload: ${session.uploadCount}\n\nFolder Link: ${session.folderLink}`);
                return;
            }

            if (args[0] === 'folders') {
                const folderList = await driveFolderService.formatFolderList(userId);
                await message.reply(folderList);
                return;
            }

            if (args[0] === 'folder') {
                if (!args[1]) {
                    await message.reply('⚠️ Mohon berikan nama folder!');
                    return;
                }
                const targetFolderName = args.slice(1).join(' ');
                const existingFolder = await driveFolderService.getFolder(userId, targetFolderName);
                
                if (!existingFolder) {
                    await message.reply(`❌ Folder "${targetFolderName}" tidak ditemukan!`);
                    return;
                }

                await uploadSessionService.createSession(userId, existingFolder.folderId, existingFolder.folderName);
                await driveFolderService.updateFolderAccess(userId, existingFolder.folderId);
                
                await message.reply(
                    '✅ Sesi upload dimulai!\n' +
                    `Folder: ${existingFolder.folderName}\n` +
                    `Dibuat pada: ${driveFolderService.formatDate(existingFolder.createdAt)}\n` +
                    'Silakan kirim foto/media yang ingin diupload.\n' +
                    'Ketik /gdrive done untuk mengakhiri sesi.'
                );
                return;
            }

            if (args[0] === 'rename') {
                if (args.length < 3) {
                    await message.reply('⚠️ Format: /gdrive rename <nama lama> <nama baru>');
                    return;
                }
                const oldName = args[1];
                const newName = args.slice(2).join(' ');
                
                const renamed = await driveFolderService.renameFolder(userId, oldName, newName);
                if (renamed) {
                    await message.reply(`✅ Folder "${oldName}" telah diubah menjadi "${newName}"`);
                } else {
                    await message.reply(`❌ Folder "${oldName}" tidak ditemukan!`);
                }
                return;
            }

            if (args[0] === 'status') {
                const session = await uploadSessionService.getSession(userId);
                if (!session) {
                    await message.reply('ℹ️ Tidak ada sesi upload yang aktif.');
                    return;
                }
                
                await message.reply(
                    '📊 Status Upload:\n' +
                    `Folder: ${session.folderName}\n` +
                    `File terupload: ${session.uploadCount || 0}`
                );
                return;
            }

            if (args[0] === '-folder') {
                if (!args[1]) {
                    await message.reply('⚠️ Mohon tentukan nama folder. Contoh: /gdrive -folder Foto Liburan');
                    return;
                }

                const folderName = args.slice(1).join(' ');
                try {
                    const folder = await googleDriveService.createFolder(folderName);
                    await uploadSessionService.createSession(userId, folder.id, folderName, folder.webViewLink);
                    await driveFolderService.addFolder(userId, {
                        folderId: folder.id,
                        folderName: folderName,
                        createdAt: new Date().toISOString()
                    });
                    await message.reply(`✅ Sesi upload dimulai!\n\nFolder: ${folderName}\nSilakan kirim foto/media yang ingin diupload.\nKetik /gdrive done untuk mengakhiri sesi.`);
                    return;
                } catch (error) {
                    await message.reply('❌ Gagal membuat folder di Google Drive. Mohon coba lagi.');
                    throw error;
                }
            }

            const hasMedia = message.hasMedia || message._data?.quotedMsg?.hasMedia;
            if (!hasMedia) {
                await message.reply('⚠️ Silakan kirim atau reply file/media yang ingin diupload ke Google Drive.\n\nCommand yang tersedia:\n/gdrive -folder [nama] : Buat folder baru\n/gdrive folder [nama] : Lanjut upload ke folder yang ada\n/gdrive folders : Lihat daftar folder\n/gdrive rename [lama] [baru] : Ganti nama folder\n/gdrive status : Cek status upload');
                return;
            }

            const session = await uploadSessionService.getSession(userId);

            const mediaMessage = message.hasMedia ? message : await message.getQuotedMessage();
            
            const fileManager = new FileManager();
            const caption = session ? undefined : args.join(' ') || undefined;
            
            const uploadMsg = session 
                ? `📤 Mengupload ke folder "${session.folderName}"...`
                : '📤 Sedang mengupload ke Google Drive...';
            await message.reply(uploadMsg);
            
            const downloadedMedia = await mediaMessage.downloadMedia();
            const tempFilePath = await fileManager.saveMedia(downloadedMedia, caption);

            try {
                const result = await googleDriveService.uploadFile(
                    tempFilePath, 
                    caption,
                    session ? session.folderId : undefined
                );

                if (session) {
                    await uploadSessionService.updateSession(userId);
                    await message.reply('✅ File berhasil diupload ke folder!');
                } else {
                    await message.reply(`✅ File berhasil diupload ke Google Drive!\n\nLink: ${result.webViewLink}`);
                }
            } catch (error) {
                if (error.message.includes('rate limit')) {
                    await message.reply('⚠️ Google Drive API rate limit terlampaui. Mohon coba lagi nanti.');
                } else if (error.message.includes('Access denied')) {
                    await message.reply('⚠️ Gagal mengakses Google Drive. Mohon hubungi admin untuk pengecekan credentials.');
                } else if (error.message.includes('File size exceeds')) {
                    await message.reply('⚠️ Ukuran file terlalu besar. Mohon kirim file yang lebih kecil.');
                } else {
                    await message.reply('❌ Terjadi kesalahan saat mengupload file. Mohon coba lagi.');
                }
                throw error;
            } finally {
                if (tempFilePath) {
                    try {
                        await fileManager.deleteFile(tempFilePath);
                        logger.info(`Temporary file deleted: ${tempFilePath}`);
                    } catch (deleteError) {
                        logger.error(`Failed to delete temporary file: ${tempFilePath}`, deleteError);
                    }
                }
            }
        } catch (error) {
            logger.error('Error in gdrive command', { error: error.message });
            throw error;
        }
    }
};