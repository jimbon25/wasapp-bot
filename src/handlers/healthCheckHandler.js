import { AccountHealthChecker } from '../utils/common/accountHealthChecker.js';
import { loadGmailAccounts } from './gmailAccountHandler.js';
import { loadDriveConfig } from '../utils/gdrive/driveConfigManager.js';
import tokenManager from '../utils/common/tokenManagerInstance.js';
import logger from '../utils/common/logger.js';

export async function checkAccountsHealth(msg) {
    try {
        const gmailAccounts = await loadGmailAccounts();
        const driveAccounts = await loadDriveConfig();

        const formattedGmailAccounts = gmailAccounts.map(acc => ({
            name: acc.name,
            type: 'gmail'
        }));

        const formattedDriveAccounts = driveAccounts.map(acc => ({
            name: acc.accountName,
            type: 'drive'
        }));

        const allAccounts = [...formattedGmailAccounts, ...formattedDriveAccounts];

        const healthResults = await AccountHealthChecker.checkAllAccounts(allAccounts, tokenManager);

        const healthyAccounts = healthResults.filter(result => result.status === 'healthy');
        const unhealthyAccounts = healthResults.filter(result => result.status !== 'healthy');

        let statusMessage = '*Status Kesehatan Akun*\n\n';

        if (healthyAccounts.length > 0) {
            statusMessage += '*Akun Sehat:*\n';
            healthyAccounts.forEach(acc => {
                statusMessage += `- ${acc.type.toUpperCase()}: ${acc.accountName}\n`;
            });
            statusMessage += '\n';
        }

        if (unhealthyAccounts.length > 0) {
            statusMessage += '*❌ Akun Bermasalah:*\n';
            unhealthyAccounts.forEach(acc => {
                statusMessage += `- ${acc.type.toUpperCase()}: ${acc.accountName}\n`;
                let message = acc.message;
                if (message.includes('Token tidak valid')) {
                    message += '\nSilakan gunakan /reauth untuk mengotorisasi ulang akun ini.';
                }
                statusMessage += `  Masalah: ${message}\n`;
            });
            statusMessage += '\n';
        }

        statusMessage += `Total Akun: ${allAccounts.length}\n`;
        statusMessage += `Sehat: ${healthyAccounts.length}\n`;
        statusMessage += `Bermasalah: ${unhealthyAccounts.length}`;

        if (msg) {
            await msg.reply(statusMessage);
        } else {
            logger.info('Health check results:', statusMessage);
        }

        return healthResults;

    } catch (error) {
        const errorMessage = `❌ Terjadi kesalahan saat mengecek kesehatan akun: ${error.message}`;
        if (msg) {
            await msg.reply(errorMessage);
        }
        logger.error('Error in checkAccountsHealth:', error);
        throw error;
    }
}