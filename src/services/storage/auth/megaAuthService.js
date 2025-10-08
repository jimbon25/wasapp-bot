import crypto from 'crypto';
import { redisManager } from '../../../utils/redis/index.js';
import logger from '../../../utils/common/logger.js';
import config from '../../../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

class MegaAuthService {
    constructor() {
        this.secretKey = config.mega.credentialsSecret;
        this.redisKey = 'mega_credentials';
    }

    _deriveKey(salt) {
        if (!this.secretKey) {
            throw new Error('MEGA_CREDENTIALS_SECRET is not defined in .env file.');
        }
        return crypto.pbkdf2Sync(this.secretKey, salt, 100000, KEY_LENGTH, 'sha512');
    }

    encrypt(password) {
        const salt = crypto.randomBytes(SALT_LENGTH);
        const key = this._deriveKey(salt);
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();

        return Buffer.concat([salt, iv, tag, encrypted]).toString('hex');
    }

    decrypt(encryptedPassword) {
        try {
            const data = Buffer.from(encryptedPassword, 'hex');
            const salt = data.slice(0, SALT_LENGTH);
            const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
            const tag = data.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
            const encrypted = data.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

            const key = this._deriveKey(salt);
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            decipher.setAuthTag(tag);

            return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
        } catch (error) {
            logger.error('Failed to decrypt Mega password. This could be due to a changed secret key or corrupted data.', error);
            throw new Error('Gagal mendekripsi password. Kunci rahasia mungkin telah berubah.');
        }
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
