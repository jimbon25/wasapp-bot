import logger from '../utils/common/logger.js';

export default {
    name: 'ping',
    async execute(message) {
        try {
            logger.info(`User ${message.from} pinged the bot`);
            await message.reply('pong ');
        } catch (error) {
            logger.error('Failed to respond to ping', error);
            throw error;
        }
    }
};