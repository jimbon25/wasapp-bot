import { google } from 'googleapis';
import fs from 'fs';
import readline from 'readline';
import config from '../src/config.js';
import logger from '../src/utils/common/logger.js';

const gmailConfig = config.apis.gmail;

if (!gmailConfig.accounts || gmailConfig.accounts.length === 0) {
    logger.error('No Gmail accounts configured in .env file. Please follow the new format (GMAIL_ACCOUNT_1_NAME, etc.).');
    process.exit(1);
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function selectAccount() {
    return new Promise((resolve) => {
        console.log('Please select the Gmail account to authorize:');
        gmailConfig.accounts.forEach((acc, index) => {
            console.log(`${index + 1}: ${acc.name}`);
        });
        console.log('-----------------------------------');

        rl.question('Enter the number of the account: ', (number) => {
            const index = parseInt(number, 10) - 1;
            if (index >= 0 && index < gmailConfig.accounts.length) {
                resolve(gmailConfig.accounts[index]);
            } else {
                console.error('Invalid selection. Please try again.');
                resolve(selectAccount());
            }
        });
    });
}

async function authorizeAccount(account) {
    try {
        const credentials = JSON.parse(
            fs.readFileSync(account.credentialsPath, 'utf8')
        );

        const { client_secret, client_id, redirect_uris } = credentials.installed;
        const oAuth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            redirect_uris[0]
        );

        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/gmail.modify']
        });

        console.log(`\nAuthorize the account "${account.name}" by visiting this url:`, authUrl);

        rl.question('\nEnter the code from that page here: ', async (code) => {
            rl.close();
            try {
                const { tokens } = await oAuth2Client.getToken(code);
                
                fs.writeFileSync(account.tokenPath, JSON.stringify(tokens));
                console.log(`\nToken for "${account.name}" saved to:`, account.tokenPath);
                
                oAuth2Client.setCredentials(tokens);
                const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
                
                console.log('\nTesting connection to Gmail API...');
                const response = await gmail.users.getProfile({
                    userId: 'me'
                });
                
                console.log(`Connection successful! Email address: ${response.data.emailAddress}`);
                console.log(`Bot is now ready to use the "${account.name}" Gmail account.`);

                // --- LANGKAH BARU: Mendaftarkan Push Notification ---
                console.log(`
Registering for push notifications for ${response.data.emailAddress}...`);
                await gmail.users.watch({
                    userId: 'me',
                    resource: {
                        labelIds: ['INBOX'],
                        topicName: config.apis.gmail.topicName
                    }
                });
                console.log('Successfully registered for push notifications. The bot will now receive real-time updates.');
                // --- AKHIR LANGKAH BARU ---

            } catch (error) {
                console.error('Error during post-authorization setup:', error.response ? error.response.data : error.message);
            }
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.error(`Credentials file not found at: ${account.credentialsPath}`);
            logger.error(`Please download the credentials JSON from Google Cloud Console and place it at the correct path.`);
        } else {
            logger.error(`An error occurred during authorization setup for "${account.name}":`, error);
        }
        rl.close();
    }
}

async function main() {
    const selectedAccount = await selectAccount();
    await authorizeAccount(selectedAccount);
}

main().catch(err => logger.error('Setup script failed:', err));
