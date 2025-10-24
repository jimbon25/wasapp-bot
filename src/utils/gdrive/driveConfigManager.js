import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../common/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', '..', 'data', 'credentials', 'gdrive_config.json');

export async function loadDriveConfig() {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await saveDriveConfig([]);
            return [];
        }
        throw error;
    }
}

export async function saveDriveConfig(config) {
    try {
        await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (error) {
        logger.error('Error saving GDrive config:', error);
        throw error;
    }
}

export async function getDriveAccount(accountName) {
    const accounts = await loadDriveConfig();
    return accounts.find(acc => acc.accountName.toLowerCase() === accountName.toLowerCase());
}

export async function getAllDriveAccounts() {
    return await loadDriveConfig();
}