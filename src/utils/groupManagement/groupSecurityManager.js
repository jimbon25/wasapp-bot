
import { redisManager } from '../redis/index.js';
import logger from '../common/logger.js';
import config from '../../config.js';

const GROUP_BLACKLIST_KEY = 'group:blacklist';
const GROUP_WARNING_PREFIX = 'group:warnings:';
const GROUP_WARNING_TTL = 24 * 60 * 60;

class GroupSecurityManager {
    constructor() {
        this.threshold = config.security.groupWarningThreshold || 3;
    }

    /**
     * Memeriksa apakah sebuah grup ada di daftar hitam.
     * @param {string | null} groupId ID grup yang akan diperiksa.
     * @returns {Promise<boolean>} True jika grup diblokir.
     */
    async isGroupBlacklisted(groupId) {
        if (!groupId) {
            return false;
        }
        try {
            const client = await redisManager.getClient();
            if (!client) return false;
            return await client.sismember(GROUP_BLACKLIST_KEY, groupId) === 1;
        } catch (error) {
            logger.error(`Gagal memeriksa status daftar hitam grup ${groupId}:`, error);
            return false;
        }
    }

    /**
     * Menangani pelanggaran di dalam grup, menaikkan jumlah peringatan,
     * dan memblokir grup jika threshold tercapai.
     * @param {string | null} groupId ID grup tempat pelanggaran terjadi.
     */
    async handleGroupViolation(groupId) {
        if (!groupId) {
            return;
        }

        try {
            const client = await redisManager.getClient();
            if (!client) return;

            const warningKey = `${GROUP_WARNING_PREFIX}${groupId}`;

            const warningCount = await client.incr(warningKey);

            if (warningCount === 1) {
                await client.expire(warningKey, GROUP_WARNING_TTL);
            }

            logger.warn(`Pelanggaran terdeteksi di grup ${groupId}. Jumlah peringatan: ${warningCount}/${this.threshold}`);

            if (warningCount >= this.threshold) {
                await client.sadd(GROUP_BLACKLIST_KEY, groupId);
                logger.error(`GRUP DIBLOKIR: Grup ${groupId} telah masuk daftar hitam karena mencapai ${warningCount} pelanggaran.`);
            }
        } catch (error) {
            logger.error(`Gagal menangani pelanggaran di grup ${groupId}:`, error);
        }
    }
}

const groupSecurityManager = new GroupSecurityManager();
export default groupSecurityManager;
