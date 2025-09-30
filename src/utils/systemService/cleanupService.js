import fs from 'fs/promises';
import path from 'path';
import logger from '../common/logger.js';

/**
 * Retention periods in milliseconds
 */
import config from '../../config.js';

export const RETENTION_PERIODS = {
    TEMP: config.system.cleanup.retention.temp,
    DOCS: config.system.cleanup.retention.docs,
    MEDIA: config.system.cleanup.retention.media
};

class CleanupService {
    constructor() {
        this.cleanupJobs = new Map();
        this.initialized = false;
    }

    /**
     * Initialize cleanup service
     * @param {Object} config Configuration object
     */
    initialize(config = {}) {
        if (this.initialized) {
            return;
        }

        this.paths = {
            temp: path.join(process.cwd(), 'temp'),
            docs: path.join(process.cwd(), 'docs'),
            ...config.paths
        };

        this.ensureDirectories();

        this.startSchedulers();

        this.initialized = true;
        logger.info('CleanupService initialized');
    }

    /**
     * Ensure all required directories exist
     */
    async ensureDirectories() {
        for (const [key, dir] of Object.entries(this.paths)) {
            try {
                await fs.mkdir(dir, { recursive: true });
                logger.info(`Directory ensured: ${dir}`);
            } catch (error) {
                logger.error(`Failed to create directory ${dir}:`, error);
            }
        }
    }

    /**
     * Start cleanup schedulers
     */
    startSchedulers() {
        // Use intervals from config
        this.scheduleCleanup('temp', RETENTION_PERIODS.TEMP, config.system.cleanup.intervals.temp);
        this.scheduleCleanup('docs', RETENTION_PERIODS.DOCS, config.system.cleanup.intervals.docs);
        this.scheduleCleanup('media', RETENTION_PERIODS.MEDIA, config.system.cleanup.intervals.media);
    }

    /**
     * Schedule a cleanup job
     */
    scheduleCleanup(type, retentionPeriod, interval) {
        const job = setInterval(async () => {
            try {
                const directory = this.paths[type];
                await this.cleanupDirectory(directory, retentionPeriod);
            } catch (error) {
                logger.error(`Cleanup failed for ${type}:`, error);
            }
        }, interval);

        this.cleanupJobs.set(type, job);
        logger.info(`Scheduled cleanup for ${type} (${retentionPeriod}ms retention)`);
    }

    /**
     * Cleanup a specific directory
     */
    async cleanupDirectory(directory, retentionPeriod) {
        try {
            const now = Date.now();
            const files = await fs.readdir(directory);
            
            let deletedCount = 0;
            let errorCount = 0;

            for (const file of files) {
                try {
                    const filePath = path.join(directory, file);
                    const stats = await fs.stat(filePath);
                    
                    if (now - stats.mtimeMs > retentionPeriod) {
                        await fs.unlink(filePath);
                        deletedCount++;
                        logger.debug(`Deleted old file: ${filePath}`);
                    }
                } catch (error) {
                    errorCount++;
                    logger.error(`Failed to process file ${file}:`, error);
                }
            }

            logger.info(`Cleanup completed - Directory: ${directory}, Deleted: ${deletedCount}, Errors: ${errorCount}`);
        } catch (error) {
            logger.error(`Directory cleanup failed for ${directory}:`, error);
            throw error;
        }
    }

    /**
     * Stop all cleanup jobs
     */
    stopAll() {
        for (const [type, job] of this.cleanupJobs) {
            clearInterval(job);
            logger.info(`Stopped cleanup job for ${type}`);
        }
        this.cleanupJobs.clear();
    }

    /**
     * Force immediate cleanup of a directory
     */
    async forceCleanup(type) {
        try {
            const directory = this.paths[type];
            const retentionPeriod = RETENTION_PERIODS[type.toUpperCase()];
            
            if (!directory || !retentionPeriod) {
                throw new Error(`Invalid cleanup type: ${type}`);
            }

            await this.cleanupDirectory(directory, retentionPeriod);
            logger.info(`Force cleanup completed for ${type}`);
        } catch (error) {
            logger.error(`Force cleanup failed for ${type}:`, error);
            throw error;
        }
    }
}

export default new CleanupService();