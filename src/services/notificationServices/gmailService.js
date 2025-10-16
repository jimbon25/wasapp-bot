import { google } from 'googleapis';
import fs from 'fs/promises';
import config from '../../config.js';
import logger from '../../utils/common/logger.js';

class GmailService {
    constructor() {
        this.config = config.apis.gmail;
        this.gmail = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            const credentials = JSON.parse(await fs.readFile(this.config.credentialsPath, 'utf8'));
            const { client_secret, client_id, redirect_uris } = credentials.installed;
            const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

            const token = JSON.parse(await fs.readFile(this.config.tokenPath, 'utf8'));
            oAuth2Client.setCredentials(token);

            this.gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
            this.initialized = true;
            logger.info('Gmail service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Gmail service. Make sure credentials and token files exist.', error);
            this.initialized = false;
        }
    }

    async getUnreadEmails() {
        if (!this.initialized) {
            logger.warn('Gmail service not initialized. Cannot fetch emails.');
            return [];
        }

        try {
            const response = await this.gmail.users.messages.list({
                userId: 'me',
                q: 'is:unread',
            });
            return response.data.messages || [];
        } catch (error) {
            logger.error('Error fetching unread emails:', error);
            return [];
        }
    }

    async getEmailDetails(messageId) {
        if (!this.initialized) return null;

        try {
            const response = await this.gmail.users.messages.get({
                userId: 'me',
                id: messageId,
            });

            const headers = response.data.payload.headers;
            const fromHeader = headers.find(h => h.name === 'From').value;
            const subjectHeader = headers.find(h => h.name === 'Subject').value;
            const snippet = response.data.snippet;

            return {
                id: messageId,
                from: fromHeader,
                subject: subjectHeader,
                snippet: snippet,
            };
        } catch (error) {
            logger.error(`Error getting details for email ${messageId}:`, error);
            return null;
        }
    }

    async markAsRead(messageId) {
        if (!this.initialized) return;

        try {
            await this.gmail.users.messages.modify({
                userId: 'me',
                id: messageId,
                resource: {
                    removeLabelIds: ['UNREAD'],
                },
            });
            logger.info(`Marked email ${messageId} as read.`);
        } catch (error) {
            logger.error(`Error marking email ${messageId} as read:`, error);
        }
    }
}

export default new GmailService();
