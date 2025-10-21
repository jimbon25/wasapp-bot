import { redisManager } from '../../../utils/redis/index.js';
import logger from '../../../utils/common/logger.js';
import config from '../../../config.js';
import EncryptionUtil from '../../../utils/common/encryptionUtil.js';

class MegaAuthService {
    constructor() {
        const secretKey = config.mega.credentialsSecret;
        if (!secretKey) {
            throw new Error('MEGA_CREDENTIALS_SECRET is not defined in .env file. Mega.nz integration will not work.');
        }
        this.encryptionUtil = new EncryptionUtil(secretKey);
        this.redisKey = 'mega_credentials';
    }

    encrypt(password) {
        return this.encryptionUtil.encrypt(password);
    }

    decrypt(encryptedPassword) {
        return this.encryptionUtil.decrypt(encryptedPassword);
    }

    async saveCredentials(userId, email, password) {
        try {
            const encryptedPassword = this.encrypt(password);
            const credentials = {
                email,
                encryptedPassword
            };
            const client = await redisManager.getClient();
            await client.hset(this.redisKey, userId, JSON.stringify(credentials));
            logger.info(`Successfully saved encrypted Mega credentials for user ${userId}`);
        } catch (error) {
            logger.error(`Failed to save Mega credentials for user ${userId}`, error);
            throw new Error('Gagal menyimpan kredensial.');
        }
    }

    async getCredentials(userId) {
        try {
            const client = await redisManager.getClient();
            const data = await client.hget(this.redisKey, userId);

            if (!data) {
                return null;
            }

            const credentials = JSON.parse(data);
            const password = this.decrypt(credentials.encryptedPassword);

            return { email: credentials.email, password };
        } catch (error) {
            logger.error(`Failed to retrieve or decrypt Mega credentials for user ${userId}`, error);
            return null; // Return null on any error to prevent leaks
        }
    }

    async deleteCredentials(userId) {
        try {
            const client = await redisManager.getClient();
            const result = await client.hdel(this.redisKey, userId);
            if (result > 0) {
                logger.info(`Successfully deleted Mega credentials for user ${userId}`);
            }
            return result > 0;
        } catch (error) {
            logger.error(`Failed to delete Mega credentials for user ${userId}`, error);
            throw new Error('Gagal menghapus kredensial.');
        }
    }
}

export default new MegaAuthService();
