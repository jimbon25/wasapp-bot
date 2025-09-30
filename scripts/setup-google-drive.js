import { google } from 'googleapis';
import fs from 'fs';
import readline from 'readline';
import config from '../src/config.js';

const driveConfig = config.apis.googleDrive;

const credentials = JSON.parse(
    fs.readFileSync(driveConfig.credentialsPath, 'utf8')
);

const { client_secret, client_id, redirect_uris } = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
);

const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file']
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
        
        fs.writeFileSync(driveConfig.tokenPath, JSON.stringify(tokens));
        console.log('Token saved to:', driveConfig.tokenPath);
        
        oAuth2Client.setCredentials(tokens);
        const drive = google.drive({ version: 'v3', auth: oAuth2Client });
        
        console.log('Testing connection to Google Drive...');
        const response = await drive.files.list({
            pageSize: 1,
            fields: 'files(name)'
        });
        
        console.log('✅ Connection successful! Found', response.data.files.length, 'files');
        console.log('Bot is ready to use Google Drive features');
    } catch (error) {
        console.error('Error retrieving access token:', error);
    }
});