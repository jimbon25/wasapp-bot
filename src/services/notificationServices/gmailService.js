import { google } from 'googleapis';
import fs from 'fs/promises';
import { PubSub } from '@google-cloud/pubsub';
import config from '../../config.js';
import logger from '../../utils/common/logger.js';
import { redisManager } from '../../utils/redis/index.js';

const GMAIL_STATE_KEY = 'gmail:notifications:enabled';
const GMAIL_HISTORY_ID_KEY_PREFIX = 'gmail:historyId:';

class GmailService {
    constructor() {
        this.config = config.apis.gmail;
        this.clients = new Map(); // Store multiple clients, keyed by email address
        this.initialized = false;
        this.pubSubClient = null;
        this.subscription = null;
    }

    //### DYNAMIC STATUS METHODS ###

    async setPollingStatus(enabled) {
        const client = await redisManager.getClient();
        if (!client) {
            logger.warn('Redis client not available. Cannot set Gmail polling status.');
            return;
        }
        await client.set(GMAIL_STATE_KEY, enabled ? 'true' : 'false');
    }

    async isPollingEnabled() {
        const client = await redisManager.getClient();
        if (!client) {
            logger.warn('Redis client not available. Falling back to .env config for Gmail status.');
            return this.config.enabled;
        }
        const status = await client.get(GMAIL_STATE_KEY);
        if (status === null) {
            return this.config.enabled;
        }
        return status === 'true';
    }

    async _initializeState() {
        const client = await redisManager.getClient();
        if (!client) return;

        const status = await client.get(GMAIL_STATE_KEY);
        if (status === null) {
            logger.info(`Initializing Gmail state in Redis from .env config (GMAIL_ENABLED=${this.config.enabled})`);
            await this.setPollingStatus(this.config.enabled);
        }
    }

    //### CORE SERVICE METHODS ###

    async initialize(whatsappClient) {
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
                const profile = await gmail.users.getProfile({ userId: 'me' });
                const emailAddress = profile.data.emailAddress;

                const { id: processedLabelId, name: processedLabelName } = await this._ensureLabelExists(gmail, account.processedLabel);

                this.clients.set(emailAddress, {
                    gmail,
                    processedLabelId,
                    processedLabelName,
                    targetNumbers: account.targetNumbers,
                    name: account.name
                });

                logger.info(`Gmail account "${account.name}" (${emailAddress}) initialized successfully.`);
            } catch (error) {
                logger.error(`Failed to initialize Gmail account "${account.name}". Please check its configuration and token file.`, error);
            }
        }

        if (this.clients.size > 0) {
            this.initialized = true;
            await this._initializeState();
            this.startListening(whatsappClient); // Start listening to Pub/Sub
            logger.info('Gmail service initialization complete.');
        }
    }

    async _ensureLabelExists(gmail, labelName) {
        try {
            const res = await gmail.users.labels.list({ userId: 'me' });
            const existingLabel = res.data.labels.find(label => label.name === labelName);

            if (existingLabel) {
                return { id: existingLabel.id, name: existingLabel.name };
            }
            
            const newLabel = await gmail.users.labels.create({
                userId: 'me',
                resource: {
                    name: labelName,
                    labelListVisibility: 'labelShow',
                    messageListVisibility: 'show',
                },
            });
            return { id: newLabel.data.id, name: newLabel.data.name };

        } catch (error) {
            logger.error(`Failed to ensure Gmail label '${labelName}' exists.`, error);
            throw error;
        }
    }

    startListening(whatsappClient) {
        if (!this.initialized || !this.config.subscriptionName) {
            logger.warn('Gmail push notifications not started: Service not initialized or subscription name not configured.');
            return;
        }

        this.pubSubClient = new PubSub({ projectId: this.config.projectId });
        this.subscription = this.pubSubClient.subscription(this.config.subscriptionName);

        const messageHandler = async message => {
            logger.info(`Received Gmail push notification: ${message.id}`);
            message.ack(); // Acknowledge immediately

            try {
                const pollingEnabled = await this.isPollingEnabled();
                if (!pollingEnabled) {
                    logger.info('Gmail notifications are disabled, skipping processing.');
                    return;
                }

                const data = JSON.parse(message.data.toString());
                const emailAddress = data.emailAddress;
                const historyId = data.historyId;

                const clientData = this.clients.get(emailAddress);
                if (!clientData) {
                    logger.warn(`Received notification for unknown email: ${emailAddress}`);
                    return;
                }

                await this.processHistory(clientData, historyId, whatsappClient);

            } catch (error) {
                logger.error('Error processing Pub/Sub message:', error);
            }
        };

        this.subscription.on('message', messageHandler);
        this.subscription.on('error', error => {
            logger.error('Gmail Pub/Sub subscription error:', error);
        });

        logger.info(`Listening for Gmail notifications on subscription: ${this.config.subscriptionName}`);
    }

    async processHistory(clientData, newHistoryId, whatsappClient) {
        const redisClient = await redisManager.getClient();
        const historyKey = `${GMAIL_HISTORY_ID_KEY_PREFIX}${clientData.name}`;
        const startHistoryId = await redisClient.get(historyKey);

        if (!startHistoryId) {
            logger.warn(`No previous historyId found for ${clientData.name}. Storing current one and processing next time.`);
            await redisClient.set(historyKey, newHistoryId);
            return;
        }

        try {
            const response = await clientData.gmail.users.history.list({
                userId: 'me',
                startHistoryId: startHistoryId,
                historyTypes: ['messageAdded']
            });

            const history = response.data.history;
            if (history && history.length > 0) {
                for (const record of history) {
                    if (record.messagesAdded) {
                        for (const msg of record.messagesAdded) {
                            // Check if the message is unread before processing
                            const isUnread = msg.message.labelIds.includes('UNREAD');
                            if (isUnread) {
                                await this.sendNotificationForMessage(clientData, msg.message.id, whatsappClient);
                            }
                        }
                    }
                }
            }

            await redisClient.set(historyKey, newHistoryId);

        } catch (error) {
            logger.error(`Error processing history for ${clientData.name}:`, error);
        }
    }

    async sendNotificationForMessage(clientData, messageId, whatsappClient) {
        try {
            const details = await this.getEmailDetails(clientData, messageId);
            if (!details) return;

            const receivedDate = new Date(parseInt(details.internalDate));
            const timestamp = receivedDate.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

            const notifMessage = `📧 *GMAIL NOTIFICATION* 📧\n` +
                                 `━━━━━━━━━━━━━\n\n` +
                                 `*Akun:* _${clientData.name}_\n` +
                                 `*Waktu:* ${timestamp}\n\n` +
                                 `*Dari:*
${details.from}\n\n` +
                                 `*Subjek:*
${details.subject}\n\n` +
                                 `*Pesan:*
_${details.snippet}_\n\n` +
                                 `*Lihat Pesan:* ${details.messageUrl}\n\n`;
                                    ;
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

        } catch (error) {
            logger.error(`Error sending notification for message ${messageId}:`, error);
        }
    }

    async getEmailDetails(clientData, messageId) {
        try {
            const response = await clientData.gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'metadata',
                metadataHeaders: ['From', 'Subject']
            });

            const headers = response.data.payload.headers;
            const fromHeader = headers.find(h => h.name === 'From').value;
            const subjectHeader = headers.find(h => h.name === 'Subject').value;

            return {
                id: messageId,
                from: fromHeader,
                subject: subjectHeader,
                snippet: response.data.snippet,
                internalDate: response.data.internalDate,
                messageUrl: `https://mail.google.com/mail/#all/${messageId}` // Tambahan baru
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
                    removeLabelIds: ['UNREAD']
                },
            });
            logger.info(`Applied label and marked as read for email ${messageId} for account "${clientData.name}".`);
        } catch (error) {
            logger.error(`Error modifying email ${messageId} for "${clientData.name}":`, error);
        }
    }
}

export default new GmailService();