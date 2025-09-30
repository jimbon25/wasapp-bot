import pkg from 'whatsapp-web.js';
const { Client } = pkg;
import { AIChatHandler } from './src/handlers/aiChat.js';
import logger from './src/utils/common/logger.js';
import sessionManager from './src/utils/sessionsManagement/sessionManager.js';
import { initializeCommandHandler } from './src/handlers/commandHandler.js';
import securityManager from './src/utils/systemService/securityManager.js'; // Note the lowercase 's'
import cleanupService from './src/utils/systemService/cleanupService.js';
import dotenv from 'dotenv';
import { redisManager, fallbackConfig } from './src/utils/redis/index.js';
import config from './src/config.js';
import { runDataMigration } from './src/startup/migration.js'; // New import
import { setupClient } from './src/startup/clientSetup.js'; // New import

// Load environment variables
dotenv.config();

// Initialize Redis and fallback configuration
try {
    await redisManager.connect();
    await fallbackConfig.init();
    logger.info('Redis system initialized successfully');
    
    // Run data migration after Redis is initialized
    await runDataMigration();
} catch (error) {
    logger.warn('Redis initialization failed, continuing without Redis:', error.message);
}

// Log admin configuration for debugging
try {
    logger.info('=== Admin Configuration ===');
    logger.info(`Admin numbers from env: ${process.env.ADMIN_NUMBERS}`);
    logger.info(`Configured admin numbers: ${JSON.stringify(config.adminNumbers)}`);
    logger.info(`SecurityManager admin numbers: ${JSON.stringify(securityManager.adminNumbers)}`);
    logger.info('=========================');
} catch (error) {
    logger.error('Error while checking admin configuration:', error);
}

// Initialize command handler with security manager
const commandHandler = initializeCommandHandler(securityManager);

// Initialize file manager
import fileManager, { FILE_TYPES } from './src/utils/fileManagement/fileManager.js';
await fileManager.initialize({
    baseDir: process.env.BASE_DIR || process.cwd()
});

// Initialize cleanup service with file manager paths
cleanupService.initialize({
    paths: {
        temp: fileManager.getPath(FILE_TYPES.TEMP),
        docs: fileManager.getPath(FILE_TYPES.DOCUMENT),
        media: fileManager.getPath(FILE_TYPES.IMAGE)
    }
});

// Initialize AI chat handler
const aiHandler = new AIChatHandler();

// Initialize error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled Promise Rejection:', error);
});

// Initialize the client with session handling and retry mechanism
async function initializeClient() {
    try {
        // Attempt to create client with retries
        const client = await sessionManager.retryCreateClient(3, 5000);
        // Pass necessary instances to setupClient
        await setupClient(client, securityManager, commandHandler, aiHandler);
        
        // Initialize with retry
        let initAttempts = 0;
        const maxInitAttempts = 3;
        
        while (initAttempts < maxInitAttempts) {
            try {
                await client.initialize();
                logger.info('Client initialized successfully');
                break;
            } catch (error) {
                initAttempts++;
                logger.error(`Failed to initialize client (attempt ${initAttempts}/${maxInitAttempts}):`, error);
                
                if (initAttempts < maxInitAttempts) {
                    const delay = 5000; // 5 seconds
                    logger.info(`Waiting ${delay/1000} seconds before next attempt...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error;
                }
            }
        }
    } catch (error) {
        logger.error('Failed to initialize client after all retries:', error);
        process.exit(1);
    }
}

// Start the bot
initializeClient().catch(error => {
    logger.error('Failed to start the bot', error);
    process.exit(1);
});
