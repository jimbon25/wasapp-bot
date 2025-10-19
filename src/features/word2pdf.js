import documentService from '../services/pdfServices/documentService.js';
import pkg from 'whatsapp-web.js';
import mediaValidator from '../utils/fileManagement/mediaValidator.js';
import logger from '../utils/common/logger.js';
import securityManager from '../utils/systemService/securityManager.js';
const { MessageMedia } = pkg;

const command = {
    name: 'word2pdf',
    description: 'Convert Word document to PDF',
    requiredPermissions: ['media'],
    async execute(message) {
        try {

            let docMedia;
            
            if (message.hasMedia) {
                docMedia = await message.downloadMedia();
            } else if (message.hasQuotedMsg) {
                const quotedMsg = await message.getQuotedMessage();
                if (!quotedMsg || !quotedMsg.hasMedia) {
                    await message.reply('Please send a Word document with caption /word2pdf or reply to a document with /word2pdf command');
                    return;
                }
                docMedia = await quotedMsg.downloadMedia();
            } else {
                await message.reply('Please send a Word document with caption /word2pdf or reply to a document with /word2pdf command');
                return;
            }

            await message.reply('⌛ Processing document...');
            
            const validTypes = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            if (!validTypes.includes(docMedia.mimetype)) {
                await message.reply('✗ Please provide a valid Word document (.doc or .docx)');
                return;
            }

            const validation = mediaValidator.validateMedia(docMedia);
            if (!validation.valid) {
                await message.reply(`✗ ${validation.error}`);
                logger.warn(`File size validation failed for user ${message.from}: ${validation.error}`);
                return;
            }

            const conversionResult = await securityManager.validateAndQueueMessage(
                message,
                async () => {
                    const pdfData = await documentService.convertDocumentToPdf(
                        docMedia,
                        docMedia.filename || 'document.docx'
                    );

                    const media = new MessageMedia(
                        pdfData.mimetype,
                        pdfData.data,
                        pdfData.filename
                    );

                    try {
                        const chat = await message.getChat();
                        
                        console.log('Chat info:', {
                            id: chat.id,
                            name: chat.name,
                            isGroup: chat.isGroup
                        });
                        
                        console.log('Media info:', {
                            mimetype: media.mimetype,
                            filename: media.filename,
                            dataLength: media.data.length
                        });

                        await chat.sendMessage(' Here is your PDF document', {
                            media: media
                        });
                    } catch (sendError) {
                        console.error('Error sending message:', sendError);
                        await message.reply('✗ Failed to send PDF. Error: ' + sendError.message);
                        throw sendError;
                    }
                }
            );
        } catch (error) {
            console.error('Error in word2pdf command:', error);
            await message.reply('✗ Sorry, there was an error converting your document. Please try again.');
        }
    }
};

export default command;