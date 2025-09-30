import { google } from 'googleapis';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import logger from '../../utils/common/logger.js';
import config from '../../config.js';
import { FileManager } from '../../utils/fileManagement/fileManager.js';

class GoogleDriveService {
    constructor() {
        this.initialized = false;
        this.drive = null;
        this.fileManager = new FileManager();
        this.config = config.apis.googleDrive;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            const credentials = JSON.parse(await fsPromises.readFile(this.config.credentialsPath, 'utf8'));
            
            const oauth2Client = new google.auth.OAuth2(
                credentials.installed.client_id,
                credentials.installed.client_secret,
                credentials.installed.redirect_uris[0]
            );

            const tokens = JSON.parse(await fsPromises.readFile(this.config.tokenPath, 'utf8'));
            oauth2Client.setCredentials(tokens);

            this.drive = google.drive({ version: 'v3', auth: oauth2Client });
            this.initialized = true;
            logger.info('Google Drive service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Google Drive service:', error);
            throw new Error('Google Drive initialization failed');
        }
    }

    async createFolder(folderName, parentFolderId = this.config.folderId) {
        try {
            await this.initialize();

            const fileMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentFolderId]
            };

            const folder = await this.drive.files.create({
                resource: fileMetadata,
                fields: 'id, webViewLink'
            });

            logger.info(`Created Google Drive folder: ${folderName}`);
            return folder.data;
        } catch (error) {
            logger.error('Failed to create Google Drive folder:', error);
            throw this.handleDriveError(error);
        }
    }

    async uploadFile(filePath, customFileName = '', parentFolderId = this.config.folderId, mimeType = null) {
        try {
            await this.initialize();

            const stats = await fsPromises.stat(filePath);
            if (stats.size > this.config.maxFileSize * 1024 * 1024) {
                throw new Error(`File size exceeds maximum limit of ${this.config.maxFileSize}MB`);
            }

            const fileName = customFileName || path.basename(filePath);
            const detectedMimeType = mimeType || this.fileManager.getMimeType(filePath);
            const allowedTypes = this.config.mimeTypes;
            if (!allowedTypes.includes('*/*') && 
                !allowedTypes.includes(detectedMimeType) && 
                !allowedTypes.some(type => type.endsWith('/*') && detectedMimeType.startsWith(type.slice(0, -1)))) {
                throw new Error(`File type ${detectedMimeType} is not allowed`);
            }

            const fileMetadata = {
                name: fileName,
                parents: [parentFolderId]
            };

            const media = {
                mimeType: detectedMimeType,
                body: fs.createReadStream(filePath)
            };

            let attempt = 1;
            while (attempt <= this.config.maxRetries) {
                try {
                    const response = await this.drive.files.create({
                        requestBody: fileMetadata,
                        media: media,
                        fields: 'id, webViewLink',
                        timeout: this.config.uploadTimeout
                    });

                    logger.info(`File uploaded successfully to Google Drive: ${fileName}`);
                    return {
                        fileId: response.data.id,
                        webViewLink: response.data.webViewLink
                    };
                } catch (error) {
                    if (attempt === this.config.maxRetries) throw error;
                    
                    logger.warn(`Upload attempt ${attempt} failed, retrying in ${this.config.retryDelay}ms`);
                    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
                    attempt++;
                }
            }
        } catch (error) {
            logger.error('Failed to upload file to Google Drive:', error);
            throw this.handleDriveError(error);
        }
    }

    isAllowedMimeType(mimeType) {
        return this.config.allowedMimeTypes.some(allowed => {
            if (allowed.endsWith('/*')) {
                const type = allowed.split('/')[0];
                return mimeType.startsWith(`${type}/`);
            }
            return mimeType === allowed;
        });
    }

    handleDriveError(error) {
        if (error.response?.data?.error === 'invalid_grant') {
            logger.error('Google Drive refresh token is invalid. Re-authentication required.', error);
            return new Error('Google Drive authentication has expired or been revoked. Please re-run the setup script.');
        }
        if (error.code === 403) {
            return new Error('Access denied to Google Drive. Please check credentials.');
        }
        if (error.code === 429) {
            return new Error('Google Drive API rate limit exceeded. Please try again later.');
        }
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            return new Error('Connection to Google Drive failed. Please check your internet connection.');
        }
        return error;
    }
}

export default new GoogleDriveService();