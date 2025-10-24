import { google } from 'googleapis';
import logger from './logger.js';

export class AccountHealthChecker {
    static async checkGmailHealth(auth) {
        try {
            const gmail = google.gmail({ version: 'v1', auth });
            await gmail.users.getProfile({ userId: 'me' });
            return { status: 'healthy', message: 'Gmail account is working properly' };
        } catch (error) {
            logger.error('Gmail health check failed:', error);
            return {
                status: 'unhealthy',
                message: 'Gmail account needs reauthorization',
                error: error.message
            };
        }
    }

    static async checkDriveHealth(auth) {
        try {
            const drive = google.drive({ version: 'v3', auth });
            await drive.about.get({ fields: 'user' });
            return { status: 'healthy', message: 'Drive account is working properly' };
        } catch (error) {
            logger.error('Drive health check failed:', error);
            return {
                status: 'unhealthy',
                message: 'Drive account needs reauthorization',
                error: error.message
            };
        }
    }

    static async checkAllAccounts(accounts, tokenManager) {
        const results = [];
        
        for (const account of accounts) {
            try {
                const encryptedTokens = account.type === 'gmail' 
                    ? await tokenManager.gmail.loadToken(account.name, 'gmail')
                    : await tokenManager.drive.loadToken(account.name, 'drive');
                if (!encryptedTokens) {
                    throw new Error('Token tidak ditemukan');
                }

                if (!encryptedTokens.access_token || !encryptedTokens.refresh_token) {
                    throw new Error('Token tidak lengkap atau rusak');
                }

                const config = (await import('../../config.js')).default;
                
                const oauth2Client = new google.auth.OAuth2(
                    config.google.clientId,
                    config.google.clientSecret,
                    config.google.redirectUri
                );
                oauth2Client.setCredentials(encryptedTokens);

                const health = account.type === 'gmail' 
                    ? await this.checkGmailHealth(oauth2Client)
                    : await this.checkDriveHealth(oauth2Client);

                results.push({
                    accountName: account.name,
                    type: account.type,
                    ...health
                });
            } catch (error) {
                let errorMessage = error.message;
                
                if (error.message.includes('Cannot read properties of undefined')) {
                    errorMessage = 'Token tidak valid atau perlu diperbarui';
                }

                results.push({
                    accountName: account.name,
                    type: account.type,
                    status: 'error',
                    message: errorMessage
                });
            }
        }

        return results;
    }
}