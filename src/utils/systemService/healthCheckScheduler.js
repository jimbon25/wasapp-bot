import { checkAccountsHealth } from '../../handlers/healthCheckHandler.js';
import logger from '../common/logger.js';

const HEALTH_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 jam

export function startHealthCheckScheduler() {
    setTimeout(async () => {
        try {
            logger.info('Running scheduled health check...');
            await checkAccountsHealth();
        } catch (error) {
            logger.error('Error in scheduled health check:', error);
        }
    }, 5 * 60 * 1000); // Mulai 5 menit setelah bot start

    setInterval(async () => {
        try {
            logger.info('Running scheduled health check...');
            await checkAccountsHealth();
        } catch (error) {
            logger.error('Error in scheduled health check:', error);
        }
    }, HEALTH_CHECK_INTERVAL);

    logger.info('Health check scheduler started');
}