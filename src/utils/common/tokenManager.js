import fs from 'fs/promises';
import path from 'path';
import logger from './logger.js';

const VALID_SERVICES = ['gmail', 'drive'];
const MAX_TOKEN_SIZE = 1024 * 10;

export class TokenManager {
    constructor(baseDir, encryptionUtil) {
        if (!baseDir) {
            throw new Error('baseDir is required');
        }
        if (!encryptionUtil) {
            throw new Error('encryptionUtil is required');
        }
        
        this.baseDir = baseDir;
        this.encryptionUtil = encryptionUtil;
        this.backupDir = path.join(baseDir, 'backup');
        this.tokenCache = new Map();
        
        this.initializeDirectories();
    }

    async initializeDirectories() {
        try {
            await fs.mkdir(this.baseDir, { recursive: true });
            await fs.mkdir(this.backupDir, { recursive: true });
            logger.info('TokenManager directories initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize TokenManager directories:', error);
            throw new Error('Failed to initialize token storage directories');
        }
    }

    validateServiceName(serviceName) {
        if (!VALID_SERVICES.includes(serviceName.toLowerCase())) {
            throw new Error(`Invalid service name. Must be one of: ${VALID_SERVICES.join(', ')}`);
        }
    }

    validateAccountName(accountName) {
        if (!accountName || typeof accountName !== 'string') {
            throw new Error('Account name is required and must be a string');
        }
        if (!/^[a-zA-Z0-9\s-]{3,30}$/.test(accountName)) {
            throw new Error('Account name must be 3-30 characters and contain only letters, numbers, spaces, and hyphens');
        }
    }

    validateTokens(tokens) {
        if (!tokens || typeof tokens !== 'object') {
            throw new Error('Invalid token format');
        }
        
        const tokenStr = JSON.stringify(tokens);
        if (tokenStr.length > MAX_TOKEN_SIZE) {
            throw new Error('Token size exceeds maximum allowed size');
        }
    }

    getCacheKey(accountName, serviceName) {
        return `${serviceName.toLowerCase()}-${accountName.toLowerCase()}`;
    }

    async saveToken(accountName, serviceName, tokens) {
        this.validateAccountName(accountName);
        this.validateServiceName(serviceName);
        this.validateTokens(tokens);

        const tokenFileName = `token-${serviceName}-${accountName.toLowerCase()}.json`;
        const tokenPath = path.join(this.baseDir, tokenFileName);
        const backupPath = path.join(this.backupDir, tokenFileName);

        const encryptedTokens = this.encryptionUtil.encrypt(JSON.stringify(tokens));

        try {
            if (await this.fileExists(tokenPath)) {
                await fs.copyFile(tokenPath, backupPath);
            }

            await fs.writeFile(tokenPath, encryptedTokens);
            
            const cacheKey = this.getCacheKey(accountName, serviceName);
            this.tokenCache.set(cacheKey, tokens);
            
            logger.info(`Token saved successfully for ${serviceName} account: ${accountName}`);
            return tokenPath;
        } catch (error) {
            logger.error(`Error saving token for ${serviceName} account ${accountName}:`, error);
            throw new Error(`Gagal menyimpan token untuk akun ${accountName}`);
        }
    }

    async loadToken(accountName, serviceName) {
        this.validateAccountName(accountName);
        this.validateServiceName(serviceName);

        const cacheKey = this.getCacheKey(accountName, serviceName);
        const cachedToken = this.tokenCache.get(cacheKey);
        if (cachedToken) {
            return cachedToken;
        }

        const tokenPath = path.join(this.baseDir, `token-${serviceName}-${accountName.toLowerCase()}.json`);
        
        try {
            const encryptedToken = await fs.readFile(tokenPath, 'utf8');
            const tokens = JSON.parse(this.encryptionUtil.decrypt(encryptedToken));
            
            this.tokenCache.set(cacheKey, tokens);
            
            return tokens;
        } catch (error) {
            if (error.code === 'ENOENT') {
                const restored = await this.restoreToken(accountName, serviceName);
                if (restored) {
                    return await this.loadToken(accountName, serviceName);
                }
            }
            logger.error(`Error loading token for ${serviceName} account ${accountName}:`, error);
            throw new Error(`Gagal memuat token untuk akun ${accountName}`);
        }
    }

    async deleteToken(accountName, serviceName) {
        this.validateAccountName(accountName);
        this.validateServiceName(serviceName);

        const tokenFileName = `token-${serviceName}-${accountName.toLowerCase()}.json`;
        const tokenPath = path.join(this.baseDir, tokenFileName);
        const backupPath = path.join(this.backupDir, tokenFileName);

        try {
            if (await this.fileExists(tokenPath)) {
                await fs.copyFile(tokenPath, backupPath);
                await fs.unlink(tokenPath);
                
                const cacheKey = this.getCacheKey(accountName, serviceName);
                this.tokenCache.delete(cacheKey);
                
                logger.info(`Token deleted successfully for ${serviceName} account: ${accountName}`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`Error deleting token for ${serviceName} account ${accountName}:`, error);
            throw new Error(`Gagal menghapus token untuk akun ${accountName}`);
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async restoreToken(accountName, serviceName) {
        this.validateAccountName(accountName);
        this.validateServiceName(serviceName);

        const tokenFileName = `token-${serviceName}-${accountName.toLowerCase()}.json`;
        const tokenPath = path.join(this.baseDir, tokenFileName);
        const backupPath = path.join(this.backupDir, tokenFileName);

        try {
            if (await this.fileExists(backupPath)) {
                await fs.copyFile(backupPath, tokenPath);
                
                const cacheKey = this.getCacheKey(accountName, serviceName);
                this.tokenCache.delete(cacheKey);
                
                logger.info(`Token restored successfully for ${serviceName} account: ${accountName}`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`Error restoring token for ${serviceName} account ${accountName}:`, error);
            throw new Error(`Gagal memulihkan token untuk akun ${accountName}`);
        }
    }

    async listAccounts(serviceName) {
        this.validateServiceName(serviceName);
        
        try {
            const files = await fs.readdir(this.baseDir);
            return files
                .filter(file => file.startsWith(`token-${serviceName}-`) && file.endsWith('.json'))
                .map(file => {
                    const match = file.match(new RegExp(`token-${serviceName}-(.+)\.json`));
                    return match ? match[1] : null;
                })
                .filter(Boolean);
        } catch (error) {
            logger.error(`Error listing accounts for ${serviceName}:`, error);
            throw new Error(`Gagal mendapatkan daftar akun untuk ${serviceName}`);
        }
    }

    async validateToken(accountName, serviceName) {
        try {
            const tokens = await this.loadToken(accountName, serviceName);
            if (!tokens || !tokens.access_token || !tokens.refresh_token) {
                return false;
            }
            if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
                return false;
            }
            return true;
        } catch {
            return false;
        }
    }

    clearCache() {
        this.tokenCache.clear();
        logger.info('Token cache cleared');
    }
}