import { google } from 'googleapis';
import fs from 'fs/promises';
import config from '../../config.js';
import logger from '../../utils/common/logger.js';

class GmailService {
    constructor() {
        this.config = config.apis.gmail;
        this.clients = new Map(); // Store multiple clients
        this.initialized = false;
        this.recentlyProcessed = new Set(); // Cache for recently processed email IDs
    }

    async initialize() {
        if (this.initialized || !this.config.enabled) {
            return;
        }

        logger.info(`Initializing Gmail service for ${this.config.accounts.length} account(s)...`);

        for (const account of this.config.accounts) {
            try {
                const credentials = JSON.parse(await fs.readFile(account.credentialsPath, 'utf8'));
                const { client_secret, client_id, redirect_uris } = credentials.installed;
                const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

                const token = JSON.parse(await fs.readFile(account.tokenPath, 'utf8'));
                oAuth2Client.setCredentials(token);

                const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
                const processedLabelId = await this._ensureLabelExists(gmail, account.processedLabel);

                this.clients.set(account.name, {
                    gmail,
                    processedLabelId,
                    targetNumbers: account.targetNumbers,
                    name: account.name
                });

                logger.info(`Gmail account "${account.name}" initialized successfully.`);
            } catch (error) {
                logger.error(`Failed to initialize Gmail account "${account.name}". Please check its configuration and token file.`, error);
            }
        }

        if (this.clients.size > 0) {
            this.initialized = true;
            logger.info('Gmail service initialization complete.');
        }
    }

    async _ensureLabelExists(gmail, labelName) {
        try {
            const res = await gmail.users.labels.list({ userId: 'me' });
            const existingLabel = res.data.labels.find(label => label.name === labelName);

            if (existingLabel) {
                logger.info(`Found existing Gmail label: '${labelName}' (ID: ${existingLabel.id})`);
                return existingLabel.id;
            }
            
            logger.info(`Label '${labelName}' not found, creating it...`);
            const newLabel = await gmail.users.labels.create({
                userId: 'me',
                resource: {
                    name: labelName,
                    labelListVisibility: 'labelShow',
                    messageListVisibility: 'show',
                },
            });
            logger.info(`Successfully created Gmail label: '${labelName}' (ID: ${newLabel.data.id})`);
            return newLabel.data.id;

        } catch (error) {
            logger.error(`Failed to ensure Gmail label '${labelName}' exists.`, error);
            throw error;
        }
    }

    async startPolling(whatsappClient) {
        if (!this.initialized) {
            logger.warn('Gmail service is not initialized or no accounts are configured. Polling will not start.');
            return;
        }

        logger.info(`Starting Gmail polling service for ${this.clients.size} account(s). Interval: ${this.config.pollingInterval} seconds.`);

        setInterval(async () => {
            for (const [name, clientData] of this.clients.entries()) {
                await this.checkAccountForEmails(clientData, whatsappClient);
            }
        }, this.config.pollingInterval * 1000);
    }

    async checkAccountForEmails(clientData, whatsappClient) {
        try {
            const unreadEmails = await this.getUnreadEmails(clientData);
            if (unreadEmails.length > 0) {
                logger.info(`Found ${unreadEmails.length} unread emails for account "${clientData.name}".`);
            }

            for (const message of unreadEmails) {
                // Check local cache first to prevent re-processing due to propagation delay
                if (this.recentlyProcessed.has(message.id)) {
                    logger.info(`Skipping email ${message.id} for account "${clientData.name}" as it was recently processed.`);
                    continue;
                }

                const details = await this.getEmailDetails(clientData, message.id);
                if (details) {
                    const receivedDate = new Date(parseInt(details.internalDate));
                    const timestamp = receivedDate.toLocaleString('id-ID', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                    });

                    const notifMessage = `📧 *GMAIL NOTIFICATION* 📧\n` +
                                     `━━━━━━━━━━━━━\n\n` +
                                     `*Akun:* _${clientData.name}_\n` +
                                     `*Waktu:* ${timestamp}\n\n` +
                                     `*Dari:*\n${details.from}\n\n` +
                                     `*Subjek:*\n${details.subject}\n\n` +
                                     `*Pesan:*\n_${details.snippet}_\n\n` +
                                     `━━━━━━━━━━━━━`;

                    // Add to local cache before sending
                    this.recentlyProcessed.add(details.id);
                    setTimeout(() => {
                        this.recentlyProcessed.delete(details.id);
                        logger.info(`Removed email ${details.id} from recently processed cache.`);
                    }, 5 * 60 * 1000); // 5-minute cache lifetime

                    for (const targetNumber of clientData.targetNumbers) {
                        if (targetNumber) {
                            try {
                                await whatsappClient.sendMessage(targetNumber, notifMessage);
                                logger.info(`Sent Gmail notification from "${clientData.name}" to ${targetNumber}`);
                            } catch (error) {
                                logger.error(`Failed to send Gmail notification to ${targetNumber}:`, error);
                            }
                        }
                    }
                    await this.applyProcessedLabel(clientData, details.id);
                }
            }
        } catch (error) {
            logger.error(`Error polling emails for account "${clientData.name}":`, error);
        }
    }

    async getUnreadEmails(clientData) {
        try {
            const query = `is:unread -label:"${clientData.processedLabelName}"`;
            const response = await clientData.gmail.users.messages.list({
                userId: 'me',
                q: query,
            });
            return response.data.messages || [];
        } catch (error) {
            logger.error(`Error fetching unread emails for "${clientData.name}":`, error);
            return [];
        }
    }

    async getEmailDetails(clientData, messageId) {
        try {
            const response = await clientData.gmail.users.messages.get({
                userId: 'me',
                id: messageId,
            });

            const headers = response.data.payload.headers;
            const fromHeader = headers.find(h => h.name === 'From').value;
            const subjectHeader = headers.find(h => h.name === 'Subject').value;
            const snippet = response.data.snippet;
            const internalDate = response.data.internalDate;

            return {
                id: messageId,
                from: fromHeader,
                subject: subjectHeader,
                snippet: snippet,
                internalDate: internalDate, // Add internalDate to the return object
            };
        } catch (error) {
            logger.error(`Error getting details for email ${messageId} from "${clientData.name}":`, error);
            return null;
        }
    }

    async applyProcessedLabel(clientData, messageId) {
        try {
            await clientData.gmail.users.messages.modify({
                userId: 'me',
                id: messageId,
                resource: {
                    addLabelIds: [clientData.processedLabelId],
                    removeLabelIds: ['UNREAD'] // Mark email as read
                },
            });
            logger.info(`Applied label and marked as read for email ${messageId} for account "${clientData.name}".`);
        } catch (error) {
            logger.error(`Error modifying email ${messageId} for "${clientData.name}":`, error);
        }
    }
}

export default new GmailService();