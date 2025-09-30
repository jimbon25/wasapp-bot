import { promises as fs } from 'fs';
import path from 'path';
import logger from '../common/logger.js';
import { FILE_PATTERNS } from '../fileManagement/fileConstants.js';
import config from '../../config.js';

class InstagramCacheManager {
    constructor(tempDir) {
        this.tempDir = tempDir;
        this.startCleanupInterval();
    }

    startCleanupInterval() {
        setInterval(() => this.cleanupCache(), config.files.instagramCache.cleanupInterval);
        logger.info(`Instagram cache cleanup scheduled every ${config.files.instagramCache.cleanupInterval / 1000} seconds`);
    }

    async cleanupCache() {
        try {
            const files = await fs.readdir(this.tempDir);
            const now = Date.now();
            let cleanedCount = 0;

            for (const file of files) {
                if (FILE_PATTERNS.INSTAGRAM_CACHE.test(file)) {
                    const filePath = path.join(this.tempDir, file);
                    const stats = await fs.stat(filePath);
                    const fileAge = now - stats.mtimeMs;

                    if (fileAge > config.files.instagramCache.maxAge) {
                        await fs.unlink(filePath);
                        cleanedCount++;
                        logger.info(`Cleaned up Instagram cache file: ${file}`);
                    }
                }
            }

            if (cleanedCount > 0) {
                logger.info(`Instagram cache cleanup completed. Removed ${cleanedCount} files.`);
            }
        } catch (error) {
            logger.error('Error during Instagram cache cleanup:', error);
        }
    }

    async cleanupFile(filePath) {
        try {
            await fs.unlink(filePath);
            logger.info(`Manually cleaned up Instagram cache file: ${path.basename(filePath)}`);
        } catch (error) {
            logger.error(`Error cleaning up Instagram cache file ${path.basename(filePath)}:`, error);
        }
    }
}

export default InstagramCacheManager;