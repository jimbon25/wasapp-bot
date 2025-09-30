import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import logger from '../../utils/common/logger.js';
import config from '../../config.js';

class StickerService {
    constructor() {
        this.tempDir = config.app.sticker.tempDir;
        this.ensureTempDir();
    }

    startCleanupSchedule() {
        setInterval(() => this.cleanupOldTempFiles(), config.services.sticker.cleanupInterval);
    }

    async cleanupOldTempFiles() {
        try {
            const files = await fs.readdir(this.tempDir);
            const now = Date.now();
            
            for (const file of files) {
                const filePath = path.join(this.tempDir, file);
                const stats = await fs.stat(filePath);
                
                if (now - stats.mtimeMs > config.services.sticker.maxFileAge) {
                    await this.cleanupTempFiles(filePath);
                }
            }
        } catch (error) {
            logger.error('Error cleaning up old temp files:', error);
        }
    }

    async ensureTempDir() {
        try {
            try {
                await fs.access(this.tempDir);
                const testFile = path.join(this.tempDir, '.test');
                await fs.writeFile(testFile, '');
                await fs.unlink(testFile);
                return;
            } catch (e) {
                await fs.mkdir(this.tempDir, { recursive: true, mode: 0o700 });
                
                const testFile = path.join(this.tempDir, '.test');
                await fs.writeFile(testFile, '');
                await fs.unlink(testFile);
            }
        } catch (error) {
            logger.error('Error creating/accessing temp directory:', error);
            
            let errorMessage = 'Tidak dapat membuat direktori temporary. ';
            if (error.code === 'EACCES') {
                errorMessage += 'Tidak memiliki izin yang cukup untuk menulis ke direktori.';
            } else if (error.code === 'EROFS') {
                errorMessage += 'Filesystem dalam mode read-only.';
            } else if (error.code === 'ENOSPC') {
                errorMessage += 'Tidak cukup ruang disk tersedia.';
            } else {
                errorMessage += `Error: ${error.message}`;
            }
            
            throw new Error(errorMessage);
        }
    }

    async cleanupTempFiles(filePath) {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            logger.error('Error cleaning up temp file:', error);
        }
    }

    /**
     * Convert image to WebP sticker
     */
    async createSticker(imageBuffer, options = {}) {
        try {
            const {
                quality = 80,
                size = 512,
                animated = false
            } = options;

            const timestamp = Date.now();
            const inputPath = path.join(this.tempDir, `input-${timestamp}`);
            const outputPath = path.join(this.tempDir, `sticker-${timestamp}.webp`);

            await fs.writeFile(inputPath, imageBuffer);

            await sharp(inputPath)
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp({
                    quality,
                    lossless: false,
                    effort: 6
                })
                .toFile(outputPath);

            const processedBuffer = await fs.readFile(outputPath);

            await this.cleanupTempFiles(inputPath);
            await this.cleanupTempFiles(outputPath);

            return processedBuffer;
        } catch (error) {
            logger.error('Error creating sticker:', error);
            throw new Error('Failed to create sticker');
        }
    }

    /**
     * Validate image file
     */
    async validateImage(buffer) {
        try {
            const metadata = await sharp(buffer).metadata();
            
            if (buffer.length > 2 * 1024 * 1024) {
                throw new Error('File too large. Maximum size is 2MB');
            }

            const supportedFormats = ['jpeg', 'jpg', 'png'];
            if (!supportedFormats.includes(metadata.format)) {
                throw new Error('Unsupported format. Please send JPG or PNG image');
            }

            return true;
        } catch (error) {
            logger.error('Image validation error:', error);
            throw error;
        }
    }
}

export default new StickerService();