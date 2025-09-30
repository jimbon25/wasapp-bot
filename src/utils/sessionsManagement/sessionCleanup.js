import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';
import logger from '../common/logger.js';

import config from '../../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SessionCleanup {
    constructor() {
        this.activeSession = null;
    }

    async markSessionActive(phoneNumber) {
        this.activeSession = phoneNumber;
        await this.cleanupInactiveSessions();
    }

    async cleanupInactiveSessions() {
        try {
            const sessionDir = config.app.sessionsDir;
            
            if (!await this.pathExists(sessionDir)) {
                logger.info('No session directory found, skipping cleanup');
                return;
            }

            const files = await fs.readdir(sessionDir);
            if (!files.length) {
                logger.info('No sessions to cleanup');
                return;
            }
            
            const RETENTION_DAYS = 7;
            const now = Date.now();
            
            for (const file of files) {
                try {
                    const fullPath = join(sessionDir, file);
                    const stat = await fs.stat(fullPath);

                    const isExpired = now - stat.mtime > RETENTION_DAYS * 24 * 60 * 60 * 1000;
                    const isInactive = !this.activeSession || !file.includes(this.activeSession);

                    if (stat.isDirectory() && isExpired && isInactive) {
                        await this.removeDirectory(fullPath);
                        logger.info(`Cleaned up old session data: ${file}`);
                    }
                } catch (err) {
                    logger.error(`Error processing session file ${file}:`, err);
                    continue;
                }
            }

            logger.info('Session cleanup completed successfully');
        } catch (error) {
            logger.error('Error during session cleanup:', error);
        }
    }

    async pathExists(path) {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    }

    async removeDirectory(dir) {
        try {
            const items = await fs.readdir(dir);
            for (const item of items) {
                const fullPath = join(dir, item);
                const stat = await fs.stat(fullPath);
                
                if (stat.isDirectory()) {
                    await this.removeDirectory(fullPath);
                } else {
                    await fs.unlink(fullPath);
                }
            }
            await fs.rmdir(dir);
        } catch (error) {
            logger.error(`Error removing directory ${dir}:`, error);
        }
    }
}

const sessionCleanup = new SessionCleanup();
export default sessionCleanup;