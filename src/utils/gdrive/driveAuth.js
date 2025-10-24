import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../common/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = path.join(__dirname, '..', '..', 'data', 'credentials', 'credentials.json');

const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
];

export async function getOAuth2Client() {
    try {
        const content = await fs.readFile(CREDENTIALS_PATH);
        const credentials = JSON.parse(content);
        const { client_secret, client_id, redirect_uris } = credentials.installed;
        
        return new google.auth.OAuth2(
            client_id,
            client_secret,
            'urn:ietf:wg:oauth:2.0:oob'  // Untuk mendapatkan kode manual
        );
    } catch (error) {
        logger.error('Error loading client credentials:', error);
        throw new Error('Failed to load Google Drive credentials');
    }
}

export function generateAuthUrl(oauth2Client) {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
    });
}

export async function exchangeCode(oauth2Client, code) {
    try {
        const { tokens } = await oauth2Client.getToken(code);
        return tokens;
    } catch (error) {
        logger.error('Error exchanging code for tokens:', error);
        throw new Error('Failed to exchange authorization code');
    }
}

export async function authorizeClient(oauth2Client, tokenPath) {
    try {
        const content = await fs.readFile(tokenPath);
        const decryptedToken = await decryptToken(content);
        const tokens = JSON.parse(decryptedToken);
        oauth2Client.setCredentials(tokens);
        return oauth2Client;
    } catch (error) {
        logger.error('Error loading client token:', error);
        throw new Error('Failed to authorize Google Drive client');
    }
}