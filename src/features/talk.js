import { aiChatHandler } from '../handlers/aiChat.js';
import logger from '../utils/common/logger.js';
import { CHAT_MODES } from '../utils/common/prompts.js';

export default {
    name: 'talk',
    description: 'Mengobrol santai dengan AI.',
    requiredPermissions: ['ai'],
    async execute(message, args) {
        try {

            const content = args.join(' ');
            if (!content) {
                await message.reply('Mohon berikan pesan yang ingin dibahas. Contoh: /talk apa kabar?');
                return;
            }

            const response = await aiChatHandler.handleMessage(
                message.from,
                content,
                CHAT_MODES.TALK
            );
            await message.reply(response);
        } catch (error) {
            logger.error('Error executing talk command:', error);
            await message.reply('❌ Terjadi kesalahan pada perintah /talk.');
        }
    }
};