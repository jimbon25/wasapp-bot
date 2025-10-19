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
                            const isUnread = msg.message && Array.isArray(msg.message.labelIds) && msg.message.labelIds.includes('UNREAD');
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
        const redisClient = await redisManager.getClient();
        if (!redisClient) {
            logger.warn('Redis client not available, cannot check for duplicate notifications.');
            return;
        }

        const notifiedIdsKey = `gmail:notified_ids:${clientData.name}`;

        try {
            const isNotified = await redisClient.sismember(notifiedIdsKey, messageId);
            if (isNotified) {
                logger.info(`Skipping notification for already processed email ${messageId} for account \"${clientData.name}\".`);
                return;
            }

            const details = await this.getEmailDetails(clientData, messageId);
            if (!details) return;

            const receivedDate = new Date(parseInt(details.internalDate));
            const timestamp = receivedDate.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

            let notifMessage = `*GMAIL NOTIFICATION*\n` +
                                 `━━━━━━━━━━━━━\n\n` +
                                 `*Akun:* _${clientData.name}_\n` +
                                 `*Waktu:* ${timestamp}\n` +
                                 `*Dari:* ${details.from}\n\n` +
                                 `*Subjek:* ${details.subject}\n\n` +
                                 `*Pesan:* _${details.snippet}_\n\n`;

            if (details.attachments.length > 0) {
                notifMessage += `*Lampiran:*\n`;
                details.attachments.forEach((att, index) => {
                    const fileSize = (att.size / 1024).toFixed(2); // KB
                    notifMessage += `${index + 1}. ${att.filename} (${fileSize} KB)\n`;
                });
                notifMessage += `\nBalas pesan ini dengan \`/gmail download [nomor]\` untuk mengunduh lampiran.\n`;
            }

            notifMessage += `\n*Lihat Pesan:* ${details.messageUrl}\n\n`;

            for (const targetNumber of clientData.targetNumbers) {
                if (targetNumber) {
                    try {
                        const sentMsg = await whatsappClient.sendMessage(targetNumber, notifMessage);
                        logger.info(`Sent Gmail notification from \"${clientData.name}\" to ${targetNumber}`);

                        // Store context for reply-based download
                        if (details.attachments.length > 0) {
                            const context = {
                                accountName: clientData.name, // Add account name to context
                                gmailMessageId: messageId,
                                attachments: details.attachments.map((att, index) => ({
                                    index: index + 1,
                                    id: att.id,
                                    filename: att.filename,
                                    mimetype: att.mimetype
                                }))
                            };
                            const contextKey = `gmail_notif:${sentMsg.id._serialized}`;
                            await redisClient.set(contextKey, JSON.stringify(context), 'EX', 86400); // 24 hour expiry
                        }

                    } catch (error) {
                        logger.error(`Failed to send Gmail notification to ${targetNumber}:`, error);
                    }
                }
            }

            // Add to Redis set after successful notification attempt
            await redisClient.sadd(notifiedIdsKey, messageId);
            await redisClient.expire(notifiedIdsKey, this.config.notifiedIdExpiryDays * 24 * 60 * 60);

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
                format: 'full', // Change to 'full' to get payload including parts
            });

            const payload = response.data.payload;
            const headers = payload.headers;
            const fromHeader = headers.find(h => h.name === 'From').value;
            const subjectHeader = headers.find(h => h.name === 'Subject').value;

            const attachments = [];
            if (payload.parts) {
                const findAttachments = (parts) => {
                    parts.forEach(part => {
                        if (part.filename && part.body.attachmentId) {
                            attachments.push({
                                id: part.body.attachmentId,
                                filename: part.filename,
                                size: part.body.size,
                                mimetype: part.mimeType
                            });
                        }
                        if (part.parts) {
                            findAttachments(part.parts);
                        }
                    });
                };
                findAttachments(payload.parts);
            }


            return {
                id: messageId,
                from: fromHeader,
                subject: subjectHeader,
                snippet: response.data.snippet,
                internalDate: response.data.internalDate,
                messageUrl: `https://mail.google.com/mail/#all/${messageId}`,
                attachments: attachments
            };
        } catch (error) {
            logger.error(`Error getting details for email ${messageId} from \"${clientData.name}\":`, error);
            return null;
        }
    }

    async downloadAttachment(accountName, messageId, attachmentId) {
        const clientData = Array.from(this.clients.values()).find(c => c.name === accountName);
        if (!clientData) {
            throw new Error(`Gmail account named '${accountName}' not found or initialized.`);
        }

        try {
            const response = await clientData.gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: messageId,
                id: attachmentId
            });
            // Convert base64url to standard base64
            const base64Data = response.data.data.replace(/-/g, '+').replace(/_/g, '/');
            response.data.data = base64Data;
            return response.data;
        } catch (error) {
            logger.error(`Failed to download attachment ${attachmentId} from message ${messageId}:`, error);
            throw new Error('Failed to download attachment from Gmail.');
        }
    }

    async applyProcessedLabel(clientData, messageId) {
        try {
            const resource = {
                addLabelIds: [clientData.processedLabelId],
                removeLabelIds: []
            };

            // Only mark as read if the config flag is not set to true
            if (!this.config.leaveAsUnread) {
                resource.removeLabelIds.push('UNREAD');
            }

            await clientData.gmail.users.messages.modify({
                userId: 'me',
                id: messageId,
                resource: resource,
            });

            const logMessage = this.config.leaveAsUnread
                ? `Applied label for email ${messageId} for account "${clientData.name}".`
                : `Applied label and marked as read for email ${messageId} for account "${clientData.name}".`;
            logger.info(logMessage);

        } catch (error) {
            logger.error(`Error modifying email ${messageId} for "${clientData.name}":`, error);
        }
    }
}

export default new GmailService();