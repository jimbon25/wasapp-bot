import qrcode from 'qrcode-terminal';
import config from '../config.js';
import logger from '../utils/common/logger.js';
import { redisManager } from '../utils/redis/index.js';
import { autoReplyManager } from '../features/autoreply.js';
import moderationService from '../services/moderationService.js';
import proactiveAiHandler from '../handlers/proactiveAiHandler.js';
import { CHAT_MODES } from '../utils/common/prompts.js';
import * as uploadBatchManager from '../utils/systemService/uploadBatchManager.js';

/**
 * Sets up event listeners for the WhatsApp client.
 * @param {import('whatsapp-web.js').Client} client - The WhatsApp client instance.
 * @param {import('../utils/systemService/securityManager.js').default} securityManager - The security manager instance.
 * @param {import('../handlers/commandHandler.js').default} commandHandler - The command handler instance.
 * @param {import('../handlers/aiChat.js').AIChatHandler} aiHandler - The AI chat handler instance.
 */
export async function setupClient(client, securityManager, commandHandler, aiHandler) {
    client.on('qr', (qr) => {
        logger.info('QR Code generated, please scan with WhatsApp');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        logger.info('WhatsApp bot is ready and online! ✅');
    });

    client.on('auth_failure', (error) => {
        logger.error('Authentication failed', error);
    });

    client.on('disconnected', (reason) => {
        logger.warn(`Client was disconnected: ${reason}`);
    });

    client.on('message', async (message) => {
        try {
            const isModCommand = message.body.toLowerCase().startsWith('/removeforbidden') || 
                               message.body.toLowerCase().startsWith('/addforbidden') ||
                               message.body.toLowerCase().startsWith('/listforbidden');
            
            if (!isModCommand) {
                const messageDeleted = await moderationService.checkMessageForForbiddenWords(message);
                if (messageDeleted) {
                    return;
                }
            }

            const chat = await message.getChat();
            const senderId = message.author || message.from;
            const groupId = chat.isGroup ? chat.id._serialized : null;

            const validationResult = await securityManager.validateAndQueueMessage(
                message,
                async () => {
                    // New Proactive AI Logic
                    const shouldTrigger = await proactiveAiHandler.shouldTrigger(message);
                    if (shouldTrigger) {
                        const response = await aiHandler.handleMessage(message.from, message.body, CHAT_MODES.PROACTIVE);
                        await message.reply(response);
                        return; // Stop further processing
                    }

                    // Auto Upload Feature Detection (with Batching)
                    if (message.hasMedia && !message.body.startsWith('/') && chat.isGroup && config.app.autoUpload.enabled && config.app.autoUpload.groupIds.includes(chat.id._serialized)) {
                        const batchKey = uploadBatchManager.createBatchKey(groupId, senderId);
                        const batch = uploadBatchManager.getBatch(batchKey) || { messages: [], timer: null };

                        // If a timer is already running, clear it.
                        if (batch.timer) {
                            clearTimeout(batch.timer);
                        }

                        // Add the new message to the batch.
                        batch.messages.push(message);

                        // Set a new timer.
                        batch.timer = setTimeout(() => {
                            const finalBatch = uploadBatchManager.getBatch(batchKey);
                            if (finalBatch) {
                                const fileCount = finalBatch.messages.length;
                                const s = fileCount > 1 ? 's' : '';
                                const replyText = `Saya mendeteksi ada ${fileCount} file${s} media. Balas pesan *ini* untuk menyimpan semuanya:

/upload drive
/upload mega`;
                                
                                // Reply to the first message of the batch to establish a reply chain.
                                finalBatch.messages[0].reply(replyText);
                                logger.info(`Auto-upload: Prompted admin for a batch of ${fileCount} file(s) in group ${chat.name}.`);
                            }
                        }, config.app.autoUpload.debounceSeconds * 1000);

                        // Save the updated batch state.
                        uploadBatchManager.setBatch(batchKey, batch);
                        
                        return; // Stop further processing for this media message.
                    }

                    // Existing Logic
                    if (message.location) {
                        const mapsCommand = commandHandler.commands.get('maps');
                        if (mapsCommand) {
                            await mapsCommand.execute(message, []);
                            return;
                        }
                    }

                    if (message.hasMedia) {
                        const gdriveCommand = commandHandler.commands.get('gdrive');
                        if (gdriveCommand) {
                            const gdriveHandled = await gdriveCommand.handleMediaMessage?.(message);
                            if (gdriveHandled) return;
                        }

                        const megaCommand = commandHandler.commands.get('mega');
                        if (megaCommand) {
                            const megaHandled = await megaCommand.handleMediaMessage?.(message);
                            if (megaHandled) return;
                        }
                    }

                    if (message.body.startsWith('/')) {
                        const result = await commandHandler.handleMessage(message);
                        
                        if (result.handled) {
                            logger.info(`Command executed: ${result.command}`);
                            return;
                        }

                        if (result.reason === 'command-not-found') {
                            await autoReplyManager.handleMessage(message);
                            return;
                        }

                        if (result.reason === 'unauthorized' || result.reason === 'permission-denied') {
                            return;
                        }
                    } else {
                        await autoReplyManager.handleMessage(message);
                    }
                }
            );
        } catch (error) {
            logger.error('Error handling message', error);
            await message.reply('Maaf, terjadi kesalahan. Mohon coba lagi dalam beberapa saat. 🙏');
        }
    });

    client.on('group_join', async (notification) => {
        try {
            const chat = await notification.getChat();

            const botParticipant = chat.participants.find(p => p.isMe);
            if (!botParticipant || !botParticipant.isAdmin) {
                return;
            }

            const groupId = chat.id._serialized;
            const client = await redisManager.getClient();
            const welcomeMessage = await client.hget('welcome_messages', groupId);
            
            if (welcomeMessage) {
                const newMembers = notification.recipientIds
                    .map(id => `@${id.split('@')[0]}`)
                    .join(', ');

                await chat.sendMessage(`Selamat datang ${newMembers}!

${welcomeMessage}`);
                logger.info(`Sent welcome message to ${newMembers} in group ${chat.name} (${groupId})`);
            }
        } catch (error) {
            logger.error(`Error sending welcome message in group ${chat.name} (${groupId}):`, error);
        }
    });
}