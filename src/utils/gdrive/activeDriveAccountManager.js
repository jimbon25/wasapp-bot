import { redisManager } from '../redis/index.js';
import config from '../../config.js';
import logger from '../common/logger.js';

const ACTIVE_ACCOUNT_KEY = 'gdrive:active_account_name';

class ActiveDriveAccountManager {
    constructor() {
        // No longer initialize this.accounts in constructor
    }

    _getAccountsFromConfig() {
        // Dynamically get accounts from config when needed
        return config.apis.googleDriveAccounts || [];
    }

    /**
     * Sets the name of the account to be used for all GDrive operations.
     * @param {string} accountName - The name of the account to set as active.
     * @returns {Promise<boolean>} - True if successful, false if account name is not found.
     */
    async setActiveAccount(accountName) {
        const accounts = this._getAccountsFromConfig();
        logger.info(`[setActiveAccount] Accounts from config: ${JSON.stringify(accounts.map(a => a.accountName))}`);
        logger.info(`[setActiveAccount] Attempting to set: "${accountName}"`);
        const accountExists = accounts.some(acc => acc.accountName.toLowerCase() === accountName.toLowerCase());
        if (!accountExists) {
            logger.warn(`Attempted to set non-existent Drive account "${accountName}" as active.`);
            return false;
        }

        const client = await redisManager.getClient();
        await client.set(ACTIVE_ACCOUNT_KEY, accountName);
        logger.info(`Active Google Drive account set to: "${accountName}"`);
        return true;
    }

    /**
     * Retrieves the full configuration for the currently active Google Drive account.
     * @returns {Promise<object | null>} - The active account's configuration object, or null if no accounts are configured.
     */
    async getActiveAccount() {
        const accounts = this._getAccountsFromConfig();
        if (!accounts || accounts.length === 0) {
            logger.warn('No Google Drive accounts are configured.');
            return null;
        }

        const client = await redisManager.getClient();
        let activeAccountName = await client.get(ACTIVE_ACCOUNT_KEY);

        if (!activeAccountName) {
            // If no active account is set in Redis, default to the first one in the config
            activeAccountName = accounts[0].accountName;
            await this.setActiveAccount(activeAccountName); // Set it in Redis for future calls
        }

        const activeAccount = accounts.find(acc => acc.accountName.toLowerCase() === activeAccountName.toLowerCase());

        if (!activeAccount) {
            // If the stored active account no longer exists, fall back to the first one
            logger.warn(`Active account "${activeAccountName}" not found in config, falling back to the first account.`);
            const fallbackAccount = accounts[0];
            await this.setActiveAccount(fallbackAccount.accountName);
            return fallbackAccount;
        }

        return activeAccount;
    }

    /**
     * Gets the list of all available account configurations.
     * @returns {Array<object>} - An array of account configurations.
     */
    getAvailableAccounts() {
        return this._getAccountsFromConfig();
    }
}

export default new ActiveDriveAccountManager();