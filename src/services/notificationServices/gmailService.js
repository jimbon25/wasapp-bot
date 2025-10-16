import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import config from '../../config.js';
import logger from '../../utils/common/logger.js';

class GmailService {
    constructor() {
        this.config = config.apis.gmail;
        this.gmail = null;
        this.initialized = false;
        this.processedLabelId = null;
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
            await this._ensureLabelExists();

            this.initialized = true;
            logger.info('Gmail service initialized successfully with processed label.');
        } catch (error) {
            logger.error('Failed to initialize Gmail service. Make sure credentials and token files exist.', error);
            this.initialized = false;
        }
    }

    async _ensureLabelExists() {
        const labelName = this.config.processedLabel;
        try {
            const res = await this.gmail.users.labels.list({ userId: 'me' });
            const labels = res.data.labels;
            const existingLabel = labels.find(label => label.name === labelName);

            if (existingLabel) {
                this.processedLabelId = existingLabel.id;
                logger.info(`Found existing Gmail label: '${labelName}' (ID: ${this.processedLabelId})`);
            } else {
                logger.info(`Label '${labelName}' not found, creating it...`);
                const newLabel = await this.gmail.users.labels.create({
                    userId: 'me',
                    resource: {
                        name: labelName,
                        labelListVisibility: 'labelShow',
                        messageListVisibility: 'show',
                    },
                });
                this.processedLabelId = newLabel.data.id;
                logger.info(`Successfully created Gmail label: '${labelName}' (ID: ${this.processedLabelId})`);
            }
        } catch (error) {
            logger.error(`Failed to ensure Gmail label '${labelName}' exists.`, error);
            throw error; // Re-throw to prevent service from initializing incorrectly
        }
    }

    async getUnreadEmails() {
        if (!this.initialized || !this.processedLabelId) {
            logger.warn('Gmail service not ready or label not configured. Cannot fetch emails.');
            return [];
        }

        try {
            const query = `is:unread -label:${this.config.processedLabel}`;
            const response = await this.gmail.users.messages.list({
                userId: 'me',
                q: query,
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

    async applyProcessedLabel(messageId) {
        if (!this.initialized || !this.processedLabelId) return;

        try {
            await this.gmail.users.messages.modify({
                userId: 'me',
                id: messageId,
                resource: {
                    addLabelIds: [this.processedLabelId],
                },
            });
            logger.info(`Applied label to email ${messageId}.`);
        } catch (error) {
            logger.error(`Error applying label to email ${messageId}:`, error);
        }
    }
}

export default new GmailService();