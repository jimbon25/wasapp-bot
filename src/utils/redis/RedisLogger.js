import logger from '../common/logger.js';

class RedisLogger {
    constructor() {
        this.logPrefix = '[Redis]';
    }

    info(message, ...args) {
        logger.info(`${this.logPrefix} ${message}`, ...args);
    }

    warn(message, ...args) {
        logger.warn(`${this.logPrefix} ${message}`, ...args);
    }

    error(message, ...args) {
        logger.error(`${this.logPrefix} ${message}`, ...args);
    }

    debug(message, ...args) {
        logger.debug(`${this.logPrefix} ${message}`, ...args);
    }
}

export const redisLogger = new RedisLogger();
export default redisLogger;