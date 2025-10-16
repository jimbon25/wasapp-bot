import { google } from 'googleapis';
import fs from 'fs';
import readline from 'readline';
import config from '../src/config.js';

const gmailConfig = config.apis.gmail;

const credentials = JSON.parse(
    fs.readFileSync(gmailConfig.credentialsPath, 'utf8')
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

console.log('Authorize this app by visiting this url:', authUrl);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Enter the code from that page here: ', async (code) => {
    rl.close();
    try {
        const { tokens } = await oAuth2Client.getToken(code);
        
        fs.writeFileSync(gmailConfig.tokenPath, JSON.stringify(tokens));
        console.log('Token saved to:', gmailConfig.tokenPath);
        
        oAuth2Client.setCredentials(tokens);
        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
        
        console.log('Testing connection to Gmail API...');
        const response = await gmail.users.getProfile({
            userId: 'me'
        });
        
        console.log(' Connection successful! Email address:', response.data.emailAddress);
        console.log('Bot is ready to use Gmail features');
    } catch (error) {
        console.error('Error retrieving access token:', error);
    }
});
