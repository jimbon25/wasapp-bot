import crypto from 'crypto';
import logger from './logger.js'; // Assuming logger is available in common utils

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

class EncryptionUtil {
    constructor(secretKey) {
        if (!secretKey) {
            throw new Error('EncryptionUtil requires a secretKey to be initialized.');
        }
        this.secretKey = secretKey;
    }

    _deriveKey(salt) {
        return crypto.pbkdf2Sync(this.secretKey, salt, 100000, KEY_LENGTH, 'sha512');
    }

    encrypt(text) {
        const salt = crypto.randomBytes(SALT_LENGTH);
        const key = this._deriveKey(salt);
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();

        return Buffer.concat([salt, iv, tag, encrypted]).toString('hex');
    }

    decrypt(encryptedText) {
        try {
            const data = Buffer.from(encryptedText, 'hex');
            const salt = data.slice(0, SALT_LENGTH);
            const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
            const tag = data.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
            const encrypted = data.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

            const key = this._deriveKey(salt);
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            decipher.setAuthTag(tag);

            return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
        } catch (error) {
            logger.error('Failed to decrypt data. This could be due to a changed secret key or corrupted data.', error);
            throw new Error('Failed to decrypt data. Secret key might have changed or data is corrupted.');
        }
    }
}

export default EncryptionUtil;
