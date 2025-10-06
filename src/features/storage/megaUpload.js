
import megaService from '../../services/storage/megaService.js';
import fileManager, { FILE_TYPES } from '../../utils/fileManagement/fileManager.js';
import logger from '../../utils/common/logger.js';

export default {
    name: 'mega-upload',
    description: 'Uploads a file to Mega.nz.',
    adminOnly: true, // Recommended to keep this true for security

    async execute(message, args) {
        let tempFilePath = null;
        try {
            const mediaMessage = message.hasMedia ? message : (message.hasQuotedMsg ? await message.getQuotedMessage() : null);

            if (!mediaMessage || !mediaMessage.hasMedia) {
                await message.reply('❌ Please reply to a file or send a file with the caption `/mega-upload`.');
                return;
            }

            await message.reply('⏳ Processing file for Mega.nz upload...');

            const downloadedMedia = await mediaMessage.downloadMedia();
            if (!downloadedMedia) {
                throw new Error('Failed to download media.');
            }

            // Save media to a temporary file
            const remoteFileName = downloadedMedia.filename || `mega-upload-${Date.now()}`;
            tempFilePath = fileManager.getPath(FILE_TYPES.TEMP, remoteFileName);
            await fileManager.writeBase64File(tempFilePath, downloadedMedia.data);

            // Upload the file using the service
            const result = await megaService.uploadFile(tempFilePath, remoteFileName);

            await message.reply(
                `✅ File uploaded successfully to Mega.nz!\n\n` +
                `*File Name:* ${result.name}\n` +
                `*Size:* ${(result.size / 1024 / 1024).toFixed(2)} MB\n` +
                `*Link:* ${result.link}`
            );

        } catch (error) {
            logger.error('Error in /mega-upload command:', error);
            await message.reply(`❌ Failed to upload file to Mega.nz.\n*Reason:* ${error.message}`);
        } finally {
            // Cleanup the temporary file
            if (tempFilePath) {
                try {
                    await fileManager.deleteFile(tempFilePath);
                    logger.info(`Cleaned up temporary file: ${tempFilePath}`);
                } catch (cleanupError) {
                    logger.error(`Failed to clean up temporary file ${tempFilePath}:`, cleanupError);
                }
            }
        }
    }
};
