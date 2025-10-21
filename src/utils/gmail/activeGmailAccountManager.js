
import { redisManager } from '../redis/index.js';
import config from '../../config.js';
import logger from '../common/logger.js';

const ACTIVE_ACCOUNT_KEY = 'gmail:active_account_name';

class ActiveGmailAccountManager {
    constructor() {}

    _getAccountsFromConfig() {
        return config.apis.gmail.accounts || [];
    }

    async setActiveAccount(accountName) {
        const accounts = this._getAccountsFromConfig();
        const accountExists = accounts.some(acc => acc.name.toLowerCase() === accountName.toLowerCase());
        if (!accountExists) {
            logger.warn(`Attempted to set non-existent Gmail account "${accountName}" as active.`);
            return false;
        }

        const client = await redisManager.getClient();
        await client.set(ACTIVE_ACCOUNT_KEY, accountName);
        logger.info(`Active Gmail account set to: "${accountName}"`);
        return true;
    }

    async getActiveAccount() {
        const accounts = this._getAccountsFromConfig();
        if (!accounts || accounts.length === 0) {
            logger.warn('No Gmail accounts are configured.');
            return null;
        }

        const client = await redisManager.getClient();
        let activeAccountName = await client.get(ACTIVE_ACCOUNT_KEY);

        if (!activeAccountName) {
            activeAccountName = accounts[0].name;
            await this.setActiveAccount(activeAccountName);
        }

        const activeAccount = accounts.find(acc => acc.name.toLowerCase() === activeAccountName.toLowerCase());

        if (!activeAccount) {
            logger.warn(`Active Gmail account "${activeAccountName}" not found in config, falling back to the first account.`);
            const fallbackAccount = accounts[0];
            await this.setActiveAccount(fallbackAccount.name);
            return fallbackAccount;
        }

        return activeAccount;
    }

    getAvailableAccounts() {
        return this._getAccountsFromConfig();
    }
}

export default new ActiveGmailAccountManager();
