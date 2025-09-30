import fs from 'fs/promises';
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;
import removeBgService from '../services/mediaServices/removeBgService.js';
import fileManager, { FILE_TYPES } from '../utils/fileManagement/fileManager.js';
import logger from '../utils/common/logger.js';
import { getColorHex, isValidColor, getAvailableColors } from '../utils/common/colorMap.js';

export class RemoveBgHandler {
    constructor() {
        this.commandRegex = /^\/rmbg(?:\s+([a-zA-Z0-9]+))?$/i;
    }

    /**
     * Gets a safe message ID string from a message object
     * @param {Message} message - WhatsApp message object
     * @returns {string}
     */
    getMessageId(message) {
        if (typeof message.id === 'string') return message.id;
        if (message.id?._serialized) return message.id._serialized;
        if (message.id?.id) {
            return `${message.id.fromMe ? 'true' : 'false'}_${message.id.remote}_${message.id.id}`;
        }
        return 'unknown';
    }

    /**
     * Checks if message is a remove background command
     * @param {Message} message - WhatsApp message object
     * @returns {boolean}
     */
    isRemoveBgCommand(message) {
        return this.commandRegex.test(message.body.trim());
    }

    /**
     * Extracts and validates the background color from the command
     * @param {string} command - The command text
     * @returns {Object} Object containing color and any validation error
     */
    extractBackgroundColor(command) {
        const match = command.trim().match(this.commandRegex);
        const colorName = match?.[1] || 'transparent';

        if (!isValidColor(colorName)) {
            const availableColors = getAvailableColors().join(', ');
            return {
                error: `Warna '${colorName}' tidak valid. Warna yang tersedia: ${availableColors}`
            };
        }

        return {
            color: getColorHex(colorName)
        };
    }

    /**
     * Handle the remove background command
     * @param {Message} message - WhatsApp message object
     */
    async handleCommand(message) {
        try {
            if (!message.hasMedia) {
                await message.reply('Tolong kirim gambar dengan caption /rmbg untuk menghapus background 🖼️');
                return;
            }

            const media = await message.downloadMedia();

            removeBgService.validateImageFormat(media.mimetype);

            const inputFileName = `rmbg_input_${Date.now()}.png`;
            const outputFileName = `rmbg_output_${Date.now()}.png`;
            const inputPath = fileManager.getPath(FILE_TYPES.TEMP, inputFileName);
            const outputPath = fileManager.getPath(FILE_TYPES.TEMP, outputFileName);

            await fileManager.writeBase64File(inputPath, media.data);

            try {
                const { color, error } = this.extractBackgroundColor(message.body);
                
                if (error) {
                    await message.reply(error);
                    return;
                }

                await removeBgService.removeBackground(inputPath, outputPath, color);

                const processedImage = await fileManager.readFileAsBase64(outputPath);
                const messageMedia = new MessageMedia('image/png', processedImage, 'image-transparent.png');

                const chat = await message.getChat();
                await chat.sendMessage(messageMedia, { 
                    sendMediaAsDocument: true,
                    caption: `✨ Background telah diubah${color !== '#00000000' ? ' dengan warna ' + message.body.split(' ')[1] : ''}!`
                });

                try {
                    await fs.unlink(inputPath);
                    await fs.unlink(outputPath);
                } catch (cleanupError) {
                    logger.warn('Failed to cleanup temporary files:', cleanupError);
                }

                logger.info('Successfully processed remove background request', {
                    user: message.from,
                    messageId: this.getMessageId(message)
                });
            } catch (error) {
                await message.reply('Gagal menghapus background, coba lagi nanti 🙏');
                throw error;
            }
        } catch (error) {
            logger.error('Error in RemoveBgHandler:', {
                error: error.message || error,
                user: message.from,
                messageId: this.getMessageId(message)
            });

            if (!error.message.includes('Failed to remove background')) {
                await message.reply('Gagal menghapus background, coba lagi nanti 🙏');
            }
        }
    }
}

export default new RemoveBgHandler();