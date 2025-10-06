
import { Storage } from 'megajs';
import fs from 'fs';
import path from 'path';
import logger from '../../utils/common/logger.js';
import config from '../../config.js';

class MegaService {
    constructor() {
        this.email = config.mega.email;
        this.password = config.mega.password;
        this.uploadFolder = config.mega.uploadFolder;
        this.storage = null;
        this.isInitialized = false;
        this.root = null;
    }

    async initialize() {
        if (this.isInitialized) {
            return;
        }

        if (!this.email || !this.password) {
            throw new Error('Mega.nz email or password is not configured in .env file.');
        }

        try {
            logger.info('Initializing Mega.nz service and logging in...');
            this.storage = await new Storage({
                email: this.email,
                password: this.password
            }).ready;

            this.root = this.storage.root;
            if (this.uploadFolder && this.uploadFolder !== '/Root/') {
                let folderNode = this.storage.root;
                const parts = this.uploadFolder.split('/').filter(p => p && p !== 'Root');
                for (const part of parts) {
                    let child = folderNode.children.find(c => c.name === part);
                    if (!child) {
                        logger.info(`Creating Mega folder: ${part}`);
                        child = await folderNode.mkdir(part);
                    }
                    folderNode = child;
                }
                this.root = folderNode;
            }

            this.isInitialized = true;
            logger.info('Mega.nz service initialized successfully.');
        } catch (error) {
            logger.error('Failed to login to Mega.nz:', error);
            throw new Error('Failed to login to Mega.nz. Please check your credentials in the .env file.');
        }
    }

    async uploadFile(filePath, remoteFileName) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const fileName = remoteFileName || path.basename(filePath);
            logger.info(`Uploading file ${fileName} to Mega.nz...`);

            const fileStream = fs.createReadStream(filePath);
            const uploadedFile = await this.root.upload({
                name: fileName,
                size: fs.statSync(filePath).size
            }, fileStream).complete;

            const link = await uploadedFile.link(false);

            logger.info(`File ${fileName} uploaded successfully to Mega.nz.`);
            return {
                name: uploadedFile.name,
                size: uploadedFile.size,
                link: link
            };
        } catch (error) {
            logger.error('Failed to upload file to Mega.nz:', error);
            if (error.message.includes('ESID')) {
                 throw new Error('Mega.nz session expired. The bot might need a restart.');
            }
            if (error.message.includes('EFAILED')) {
                throw new Error('Mega.nz upload failed. The file might be empty or corrupted.');
            }
            throw new Error('An unexpected error occurred during Mega.nz upload.');
        }
    }
}

const megaService = new MegaService();
export default megaService;
