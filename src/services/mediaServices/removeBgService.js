import pkg from 'node-fetch';
const { default: fetch } = pkg;
import FormData from 'form-data';
import fs from 'fs/promises';
import logger from '../../utils/common/logger.js';
import config from '../../config.js';

class RemoveBgService {
    constructor() {
        this.apiKey = config.apiKeys.removebg;
        this.apiUrl = config.services.removebg.apiUrl;
        this.supportedFormats = config.services.removebg.supportedFormats;
    }

    /**
     * Validates if the API key is configured
     */
    validateConfig() {
        if (!this.apiKey) {
            throw new Error('REMOVEBG_API_KEY is not configured in environment variables');
        }
    }

    /**
     * Validates if the file is a supported image format
     * @param {string} mimetype - The MIME type of the file
     */
    validateImageFormat(mimetype) {
        if (!this.supportedFormats.includes(mimetype)) {
            throw new Error(`Unsupported image format. Supported formats: ${this.supportedFormats.join(', ')}`);
        }
    }

    /**
     * Removes background from an image file
     * @param {string} inputPath - Path to the input image file
     * @param {string} outputPath - Path where the processed image will be saved
     * @returns {Promise<void>}
     */
    async removeBackground(inputPath, outputPath, bgColor = 'transparent') {
        try {
            this.validateConfig();
            
            const normalizedColor = bgColor.toLowerCase() === 'transparent' ? '#00000000' : bgColor;

            const imageData = await fs.readFile(inputPath);

            const formData = new FormData();
            formData.append('image_file', imageData, 'image.png');
            formData.append('size', 'auto');
            formData.append('format', 'png');
            formData.append('bg_color', normalizedColor);
            formData.append('channels', 'rgba');

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'X-Api-Key': this.apiKey,
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                logger.error('RemoveBG API Error:', error);
                throw new Error('Failed to remove background');
            }

            const outputBuffer = await response.buffer();
            await fs.writeFile(outputPath, outputBuffer);

            logger.info('Background removed successfully', {
                inputFile: inputPath,
                outputFile: outputPath
            });
        } catch (error) {
            logger.error('Error in removeBackground:', error);
            throw error;
        }
    }
}

export default new RemoveBgService();