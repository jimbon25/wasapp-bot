import fs from 'fs/promises';
import logger from '../utils/common/logger.js';
import { redisManager } from '../utils/redis/index.js';

/**
 * One-time data migration from JSON files to Redis
 */
export async function runDataMigration() {
    const client = await redisManager.getClient();
    
    const hasBlacklist = await client.exists('blacklist:users');
    if (!hasBlacklist) {
        try {
            const blacklistData = JSON.parse(await fs.readFile('./src/data/static/blacklist.json', 'utf8'));
            if (blacklistData.blockedUsers?.length > 0) {
                await client.sadd('blacklist:users', blacklistData.blockedUsers);
                logger.info(`Migrated ${blacklistData.blockedUsers.length} users to blacklist in Redis`);
            } else {
                logger.info('No blacklist users to migrate');
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.info('No blacklist.json file found, skipping migration');
            } else {
                logger.warn('Blacklist migration failed:', error.message);
            }
        }
    } else {
        logger.info('Blacklist data already exists in Redis, skipping migration');
    }
    
    logger.info('Starting autoreply data migration check...');

    const oldKeyExists = await client.exists('autoreply:patterns');
    if (oldKeyExists) {
        await client.rename('autoreply:patterns', 'autoreply:global');
        logger.info('MIGRATION: Renamed legacy Redis key "autoreply:patterns" to "autoreply:global".');
    }

    const globalKeyExists = await client.exists('autoreply:global');
    if (!globalKeyExists) {
        try {
            const autoreplyData = JSON.parse(await fs.readFile('./src/data/static/autoreply.json', 'utf8'));
            if (Array.isArray(autoreplyData) && autoreplyData.length > 0) {
                const rulesToMigrate = {};
                for (const rule of autoreplyData) {
                    const primaryKey = rule.primaryKey || (rule.keywords && rule.keywords[0] ? rule.keywords[0].toLowerCase() : null);
                    if (primaryKey) {
                        rulesToMigrate[primaryKey] = JSON.stringify(rule);
                    }
                }
                
                if (Object.keys(rulesToMigrate).length > 0) {
                    await client.hset('autoreply:global', rulesToMigrate);
                    logger.info(`MIGRATION: Migrated ${Object.keys(rulesToMigrate).length} autoreply rules from autoreply.json to "autoreply:global" in Redis.`);
                }
            } else {
                logger.info('autoreply.json is empty or not an array, no rules to migrate.');
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.info('No autoreply.json file found, skipping JSON migration.');
            } else {
                logger.warn('Autoreply JSON migration failed:', error.message);
            }
        }
    } else {
        logger.info('Autoreply data already exists in Redis, skipping JSON migration.');
    }

    const hasWelcomeMessages = await client.exists('welcome_messages');
    if (!hasWelcomeMessages) {
        try {
            const welcomeData = JSON.parse(await fs.readFile('./src/data/static/welcome.json', 'utf8'));
            if (Object.keys(welcomeData).length > 0) {
                await client.hset('welcome_messages', welcomeData);
                logger.info(`Migrated ${Object.keys(welcomeData).length} welcome messages to Redis`);
            } else {
                logger.info('No welcome messages to migrate from JSON');
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.info('No welcome.json file found, skipping migration');
            } else {
                logger.warn('Welcome messages migration failed:', error.message, '\nDetails:', error.stack);
            }
        }
    } else {
        logger.info('Welcome messages already exist in Redis, skipping migration');
    }
}
