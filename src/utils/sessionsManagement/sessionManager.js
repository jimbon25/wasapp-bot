import fs from 'fs';
import path from 'path';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import logger from '../common/logger.js';
import { sessionBackupManager } from '../redis/index.js';
import config from '../../config.js';

class SessionManager {
    constructor() {
        this.sessionsDir = config.app.sessionsDir;
        this.ensureSessionDirectory();
        this.initializeRedisBackup();
    }

    ensureSessionDirectory() {
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
            logger.info('Created authentication directory');
        }
    }

    async initializeRedisBackup() {
        try {
            await sessionBackupManager.init();
            logger.info('Redis session backup initialized');
        } catch (error) {
            logger.warn('Redis session backup initialization failed:', error.message);
            logger.info('Session backups will be stored locally only');
            const backupDir = path.join(this.sessionsDir, 'backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
        }
    }

    async cleanSession(clientId = 'default-session') {
        try {
            const sessionPath = path.join(this.sessionsDir, `session-${clientId}`);
            if (fs.existsSync(sessionPath)) {
                logger.info(`Cleaning session directory: ${sessionPath}`);
                await fs.promises.rm(sessionPath, { recursive: true });
                logger.info('Session directory cleaned successfully');
            }
        } catch (error) {
            logger.error('Error cleaning session directory:', error);
            throw error;
        }
    }

    async retryCreateClient(maxRetries = 3, retryDelay = 5000) {
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger.info(`Attempting to create client (attempt ${attempt}/${maxRetries})`);
                
                if (attempt > 1) {
                    await this.cleanSession();
                }
                
                const client = await this.createClient();
                logger.info('Client created successfully');
                return client;
            } catch (error) {
                lastError = error;
                logger.error(`Failed to create client (attempt ${attempt}/${maxRetries}):`, error);
                
                if (attempt < maxRetries) {
                    logger.info(`Waiting ${retryDelay/1000} seconds before next attempt...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        }
        
        throw new Error(`Failed to create client after ${maxRetries} attempts. Last error: ${lastError.message}`);
    }

    async backupSession(clientId = 'default-session') {
        try {
            const sessionPath = path.join(this.sessionsDir, `session-${clientId}`);
            if (!fs.existsSync(sessionPath)) {
                logger.warn(`No session found for client ${clientId}`);
                return false;
            }

            const sessionData = {};
            const files = fs.readdirSync(sessionPath);
            for (const file of files) {
                const filePath = path.join(sessionPath, file);
                const stat = fs.statSync(filePath);
                if (stat.isFile()) {
                    sessionData[file] = fs.readFileSync(filePath, 'utf8');
                }
            }

            await sessionBackupManager.backupSession(clientId, sessionData);
            logger.info(`Session backup completed for client ${clientId}`);
            return true;
        } catch (error) {
            logger.error('Session backup failed:', error);
            return false;
        }
    }

    async restoreSession(clientId = 'default-session') {
        try {
            const sessionData = await sessionBackupManager.restoreSession(clientId);
            if (!sessionData) {
                logger.warn(`No backup found for client ${clientId}`);
                return false;
            }

            const sessionPath = path.join(this.sessionsDir, clientId);
            if (!fs.existsSync(sessionPath)) {
                fs.mkdirSync(sessionPath, { recursive: true });
            }

            for (const [file, content] of Object.entries(sessionData)) {
                const filePath = path.join(sessionPath, file);
                fs.writeFileSync(filePath, content, 'utf8');
            }

            logger.info(`Session restored for client ${clientId}`);
            return true;
        } catch (error) {
            logger.error('Session restore failed:', error);
            return false;
        }
    }

    async validateSession(clientId = 'default-session') {
        try {
            const sessionPath = path.join(this.sessionsDir, clientId);
            let hasLocalSession = fs.existsSync(sessionPath);
            let hasBackup = false;

            try {
                hasBackup = await sessionBackupManager.validateBackup(clientId);
            } catch (error) {
                logger.warn('Session backup validation failed:', error.message);
            }

            if (clientId === 'default-session' && !hasLocalSession) {
                try {
                    if (hasBackup) {
                        await this.restoreSession(clientId);
                        hasLocalSession = true;
                        logger.info('Restored default session from backup');
                    } else {
                        fs.mkdirSync(sessionPath, { recursive: true });
                        logger.info('Created new default session directory');
                        hasLocalSession = true;
                    }
                } catch (restoreError) {
                    logger.error('Failed to restore/create default session:', restoreError);
                }
            }

            return {
                local: hasLocalSession,
                backup: hasBackup
            };
        } catch (error) {
            logger.error('Session validation failed:', error);
            return { local: false, backup: false };
        }
    }

    async createClient() {
        try {
            const puppeteerOptions = {
                headless: config.app.puppeteer.headless,
                args: config.app.puppeteer.args,
                executablePath: config.app.puppeteer.executablePath,
                handleSIGINT: false,
                handleSIGTERM: false,
                handleSIGHUP: false,
                timeout: 60000,
                ignoreHTTPSErrors: true
            };

            const client = new Client({
                authStrategy: new LocalAuth({
                    clientId: 'default-session',
                    dataPath: this.sessionsDir
                }),
                puppeteer: puppeteerOptions,
                qrMaxRetries: 3,
                authTimeoutMs: 60000,
                restartOnAuthFail: true
            });

            client.on('change_state', state => {
                logger.info(`Client state changed to: ${state}`);
            });

            setInterval(() => {
                this.backupSession();
            }, 300000);

            return client;
        } catch (error) {
            logger.error('Failed to create client:', error);
            throw error;
        }
    }
}

export default new SessionManager();