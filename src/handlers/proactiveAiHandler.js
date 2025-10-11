
import { redisManager } from '../utils/redis/index.js';
import config from '../config.js';
import logger from '../utils/common/logger.js';

const GREETINGS = ['halo', 'hai', 'pagi', 'siang', 'sore', 'malam', 'assalamualaikum', 'bot'];
const QUESTIONS = ['apa', 'siapa', 'kapan', 'dimana', 'mengapa', 'bagaimana', 'berapa', '?'];

class ProactiveAiHandler {
    constructor() {
        this.config = config.app.proactive;
    }

    async shouldTrigger(message) {
        if (!this.config || !this.config.enabled || message.body.startsWith('/')) {
            return false;
        }

        const chat = await message.getChat();
        const lowerBody = message.body.toLowerCase();
        const chatKey = `proactive_ts:${chat.id._serialized}`;

        // 1. Pemicu di Grup (Hanya jika di-mention)
        if (chat.isGroup) {
            if (message.mentionedIds.includes(config.botNumber)) {
                logger.info(`Proactive AI triggered by mention in group ${chat.name}.`);
                return true;
            }
            return false; // Di grup, AI proaktif hanya aktif jika di-mention
        }

        // 2. Pemicu di Chat Pribadi
        const client = await redisManager.getClient();
        if (!client) return false; // Jangan aktif jika Redis tidak terhubung

        const lastMessageTimestamp = await client.get(chatKey);
        // Selalu perbarui timestamp setiap ada pesan masuk untuk me-reset timer idle
        await client.set(chatKey, Date.now().toString());

        // 2a. Cek jika ini pesan pertama (tidak ada timestamp sebelumnya)
        if (!lastMessageTimestamp) {
            logger.info(`Proactive AI triggered for the first message from ${chat.id.user}.`);
            return true;
        }

        // 2b. Cek jika percakapan sudah "dingin" (idle)
        const idleTimeMinutes = (Date.now() - parseInt(lastMessageTimestamp, 10)) / (1000 * 60);
        if (idleTimeMinutes > this.config.idleTimeout) {
            logger.info(`Proactive AI triggered by idle timeout (${idleTimeMinutes.toFixed(2)}m) for ${chat.id.user}.`);
            return true;
        }

        // 2c. Cek jika itu pertanyaan atau sapaan (hanya jika percakapan tidak idle)
        const isQuestion = QUESTIONS.some(q => lowerBody.includes(q));
        const isGreeting = GREETINGS.some(g => lowerBody.startsWith(g));

        if (isQuestion || isGreeting) {
            // Untuk menghindari terlalu "cerewet", kita bisa tambahkan kondisi
            // misalnya, hanya merespons sapaan/pertanyaan jika sudah idle lebih dari 1-2 menit.
            if (idleTimeMinutes > 1) {
                 logger.info(`Proactive AI triggered by question/greeting after short idle from ${chat.id.user}.`);
                 return true;
            }
        }

        return false;
    }
}

export default new ProactiveAiHandler();
