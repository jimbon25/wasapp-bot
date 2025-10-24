import { google } from 'googleapis';
import config from '../../config.js';
import logger from './logger.js';

const GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify'
];

const DRIVE_SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
];

/**
 * Generates OAuth2 authorization URL with embedded state for reauthorization flow.
 * Different from basic generateAuthUrl in driveAuth.js, this function:
 * - Embeds service type (gmail/drive) and account name in state parameter
 * - Uses configured redirect URI from config
 * - Sets specific scopes based on service type
 * 
 * @param {string} type - Service type ('gmail' or 'drive')
 * @param {string} accountName - Name of the account being reauthorized
 * @returns {Promise<string>} Authorization URL with embedded state
 */
export async function generateAuthUrlWithState(type, accountName) {
    try {
        const oauth2Client = new google.auth.OAuth2(
            config.google.clientId,
            config.google.clientSecret,
            config.google.redirectUri
        );

        const scopes = type === 'gmail' ? GMAIL_SCOPES : DRIVE_SCOPES;

        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent', // Force to show consent screen
            state: JSON.stringify({ type, accountName }) // Save account info in state
        });
    } catch (error) {
        logger.error('Error generating auth URL:', error);
        throw new Error('Gagal membuat URL otorisasi');
    }
}