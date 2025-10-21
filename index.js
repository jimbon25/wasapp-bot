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
import fs from 'fs';
import path from 'path';

import taskManager from './src/utils/systemService/taskManager.js';

// Load environment variables
dotenv.config();

// Global flag for graceful shutdown
global.isShuttingDown = false;

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

/**
 * Watches for configuration changes and triggers a graceful restart.
 * @param {import('whatsapp-web.js').Client} client - The WhatsApp client instance.
 */
function startFileWatcher(client) {
    const configPaths = [
        path.join(process.cwd(), 'src', 'data', 'credentials', 'gmailCredentials', 'gmail_accounts.json'),
        path.join(process.cwd(), 'src', 'data', 'credentials', 'gmailCredentials')
    ];

    const restartBot = async () => {
        if (global.isShuttingDown) return; // Shutdown already in progress
        global.isShuttingDown = true;

        logger.warn('Configuration change detected. Initiating graceful shutdown...');
        logger.info('Bot will stop accepting new requests and restart after current tasks are finished.');

        const shutdownInterval = setInterval(async () => {
            const activeTasks = taskManager.getActiveCount();
            if (activeTasks === 0) {
                clearInterval(shutdownInterval);
                logger.warn('All tasks finished. Proceeding with client destruction and restart.');
                if (client) {
                    try {
                        await client.destroy();
                        logger.info('WhatsApp client destroyed.');
                    } catch (e) {
                        logger.error('Error destroying client during restart:', e);
                    }
                }
                process.exit(0); // Exit gracefully, systemd will handle the restart
            } else {
                logger.info(`Waiting for ${activeTasks} tasks to complete before restarting...`);
            }
        }, 3000); // Check every 3 seconds
    };

    let debounceTimer = null;
    const handleFileChange = (eventType, filename) => {
        // We only care about Gmail-related files in the gmailCredentials directory
        if (filename && !(filename.startsWith('token-gmail-') || filename === 'credentials-gmail-all.json' || filename === 'wabot-pubsub-key.json')) {
            return;
        }
        logger.info(`File change detected in configuration files: ${filename || 'directory'} (${eventType})`);
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(restartBot, 5000); // Wait 5 seconds to prevent rapid restarts
    };

    configPaths.forEach(configPath => {
        if (fs.existsSync(configPath)) {
            fs.watch(configPath, { recursive: true }, handleFileChange);
            logger.info(`Watching for changes in: ${configPath}`);
        } else {
            logger.warn(`Could not watch path, as it does not exist: ${configPath}`);
        }
    });
}


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

        // Start watching for config changes to auto-restart
        startFileWatcher(client);

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