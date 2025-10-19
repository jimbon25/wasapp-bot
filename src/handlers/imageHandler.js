import logger from '../utils/common/logger.js';
import securityManager from '../utils/systemService/securityManager.js';

export default {
    name: 'imagehandler',
    description: 'Handler for image messages without specific commands',
    async execute(msg) {
        try {
            if (msg.body.startsWith('/') || msg.body.startsWith('!')) return false;
            
            if (!msg.hasMedia) return false;
            
            const media = await msg.downloadMedia();
            if (!media || !media.mimetype.startsWith('image/')) return false;

            const senderId = msg.from;
            
            const commandCheck = await securityManager.canExecuteCommand(senderId, 'media');
            if (!commandCheck.allowed) {
                await msg.reply(commandCheck.reason);
                return true;
            }
            
            if (!securityManager.messageLimiter.tryConsume(senderId)) {
                await msg.reply('⚠️ Anda terlalu sering mengirim gambar. Silakan coba lagi nanti. 🕒');
                return true;
            }

            const imageExt = media.mimetype.split('/')[1];
            const imagePath = path.join(TEMP_DIR, `${Date.now()}.${imageExt}`);
            fs.writeFileSync(imagePath, Buffer.from(media.data, 'base64'));

            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }

            return true;
        } catch (error) {
            logger.error('Error handling image message:', error);
            await msg.reply('✗ Terjadi kesalahan saat memproses gambar.');
            return true;
        }
    }
};