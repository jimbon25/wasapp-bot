import logger from '../common/logger.js';
import instagramStateCache from './instagramStateCache.js';

class InstagramAccountManager {
    constructor(accounts) {
        this.accounts = accounts;
        this.currentIndex = 0;
        this.accountStates = new Map();
        this.initializeAccountStates();
    }

    async initializeAccountStates() {
        const cachedStates = await instagramStateCache.getAllAccountStates();

        this.accounts.forEach((account, index) => {
            const cachedState = cachedStates[account.username];
            const state = cachedState || {
                failedAttempts: 0,
                lastUsed: 0,
                cooldownUntil: 0,
                isBlocked: false
            };
            this.accountStates.set(index, state);
        });
    }

    getCurrentAccount() {
        return {
            ...this.accounts[this.currentIndex],
            index: this.currentIndex
        };
    }

    isAccountAvailable(index) {
        const state = this.accountStates.get(index);
        if (!state) return false;

        const now = Date.now();
        return !state.isBlocked && now >= state.cooldownUntil;
    }

    async markAccountError(index, errorType) {
        const state = this.accountStates.get(index);
        if (!state) return;

        state.failedAttempts++;
        state.lastUsed = Date.now();

        switch (errorType) {
            case 'rate_limited':
                state.cooldownUntil = Date.now() + (30 * 60 * 1000); // 30 minutes cooldown
                break;
            case 'auth_failed':
                state.cooldownUntil = Date.now() + (60 * 60 * 1000); // 1 hour cooldown
                break;
            case 'account_blocked':
                state.isBlocked = true;
                state.cooldownUntil = Date.now() + (24 * 60 * 60 * 1000); // 24 hours cooldown
                break;
            default:
                state.cooldownUntil = Date.now() + (5 * 60 * 1000); // 5 minutes default cooldown
        }

        await instagramStateCache.saveAccountState(this.accounts[index].username, state);

        logger.warn(`Instagram account ${this.accounts[index].username} marked with error: ${errorType}. Cooldown until: ${new Date(state.cooldownUntil)}`);
    }

    async markAccountSuccess(index) {
        const state = this.accountStates.get(index);
        if (!state) return;

        state.failedAttempts = 0;
        state.lastUsed = Date.now();
        state.cooldownUntil = 0;
        state.isBlocked = false;

        await instagramStateCache.saveAccountState(this.accounts[index].username, state);
        
        logger.info(`Instagram account ${this.accounts[index].username} successfully used`);
    }

    getNextAvailableAccount() {
        const startIndex = this.currentIndex;
        let index = startIndex;
        
        do {
            if (this.isAccountAvailable(index)) {
                this.currentIndex = index;
                logger.info(`Switching to Instagram account: ${this.accounts[index].username}`);
                return this.getCurrentAccount();
            }
            index = (index + 1) % this.accounts.length;
        } while (index !== startIndex);

        let earliestCooldown = Infinity;
        let bestIndex = 0;

        this.accountStates.forEach((state, i) => {
            if (!state.isBlocked && state.cooldownUntil < earliestCooldown) {
                earliestCooldown = state.cooldownUntil;
                bestIndex = i;
            }
        });

        this.currentIndex = bestIndex;
        const waitTime = Math.max(0, earliestCooldown - Date.now());
        logger.warn(`All accounts are in cooldown. Using account ${this.accounts[bestIndex].username} with ${waitTime}ms wait time`);
        
        return {
            ...this.accounts[bestIndex],
            index: bestIndex,
            waitTime
        };
    }

    resetAccountState(index) {
        const state = this.accountStates.get(index);
        if (state) {
            state.failedAttempts = 0;
            state.cooldownUntil = 0;
            state.isBlocked = false;
            logger.info(`Reset state for Instagram account: ${this.accounts[index].username}`);
        }
    }

    getAllAccountsStatus() {
        return this.accounts.map((account, index) => {
            const state = this.accountStates.get(index);
            return {
                username: account.username,
                isActive: this.isAccountAvailable(index),
                failedAttempts: state.failedAttempts,
                cooldownRemaining: Math.max(0, state.cooldownUntil - Date.now()),
                isBlocked: state.isBlocked
            };
        });
    }
}

export default InstagramAccountManager;