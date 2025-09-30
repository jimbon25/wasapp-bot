import { aiChatHandler } from '../handlers/aiChat.js';
import logger from '../utils/common/logger.js';
import { CHAT_MODES } from '../utils/common/prompts.js';

export default {
    name: 'ask',
    description: 'Bertanya kepada AI untuk jawaban akademis.',
    requiredPermissions: ['ai'],
    async execute(message, args) {
        try {

            const content = args.join(' ');
            if (!content) {
                await message.reply('Mohon berikan pertanyaan yang ingin dijawab. Contoh: /ask apa itu fotosintesis?');
                return;
            }

            const response = await aiChatHandler.handleMessage(
                message.from,
                content,
                CHAT_MODES.ASK
            );
            await message.reply(response);
        } catch (error) {
            logger.error('Error executing ask command:', error);
            await message.reply('❌ Terjadi kesalahan pada perintah /ask.');
        }
    }
};