import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import logger from '../common/logger.js';

/**
 * File types and their directories
 */
export const FILE_TYPES = {
    DOCUMENT: 'media/documents',
    IMAGE: 'media/images',
    STICKER: 'media/stickers',
    VIDEO: 'media/videos',
    AUDIO: 'media/audio',
    TEMP: 'temp'
};

export class FileManager {
    constructor() {
        this.baseDir = path.resolve(process.cwd());
        this.initialized = false;
        this.stats = {
            writes: 0,
            reads: 0,
            deletes: 0,
            errors: 0
        };

        // MIME type mapping
        this.mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.pdf': 'application/pdf',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.webp': 'image/webp',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.zip': 'application/zip',
            '.7z': 'application/x-7z-compressed',
            '.rar': 'application/vnd.rar',
            '.bin': 'application/macbinary',
            '.binary': 'application/x-binary'
        };
    }

    /**
     * Initialize the file manager
     */
    async initialize(config = {}) {
        if (this.initialized) {
            return;
        }

        this.baseDir = config.baseDir || this.baseDir;

        for (const type of Object.values(FILE_TYPES)) {
            await this.ensureDirectory(type);
        }

        this.initialized = true;
        logger.info('FileManager initialized');
    }

    /**
     * Ensure a directory exists
     */
    async ensureDirectory(type) {
        const dir = this.getPath(type);
        try {
            await fs.mkdir(dir, { recursive: true, mode: 0o755 });
            logger.info(`Directory ensured: ${dir}`);
        } catch (error) {
            logger.error(`Failed to create directory ${dir}:`, error);
            throw error;
        }
    }

    /**
     * Get absolute path for a file type
     */
    getPath(type, filename = '') {
        const normalizedBase = path.resolve(this.baseDir);
        const cleanFilename = path.basename(filename);
        return path.join(normalizedBase, type, cleanFilename);
    }

    /**
     * Get MIME type for a file
     */
    getMimeType(filePath, mimeType = null) {
        if (mimeType) {
            // If MIME type is provided, use it
            return mimeType;
        }
        const ext = path.extname(filePath).toLowerCase();
        return this.mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * Get file extension from MIME type
     */
    getExtensionFromMimeType(mimeType) {
        // Reverse mapping of MIME types to extensions
        const mimeToExt = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'application/pdf': '.pdf',
            'video/mp4': '.mp4',
            'video/webm': '.webm',
            'application/msword': '.doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
            'application/zip': '.zip',
            'application/x-7z-compressed': '.7z',
            'application/vnd.rar': '.rar'
        };
        return mimeToExt[mimeType] || '.bin';
    }

    /**
     * Get MIME type for a file
     */
    getMimeType(filePath, mimeType = null) {
        if (mimeType) return mimeType;
        
        const ext = path.extname(filePath).toLowerCase();
        const detectedMimeType = this.mimeTypes[ext] || 'application/octet-stream';
        logger.info(`File extension: ${ext}, Detected MIME type: ${detectedMimeType}`);
        return detectedMimeType;
    }

    /**
     * Generate safe filename
     */
    generateSafeFilename(originalName = '', prefix = '') {
        const hash = crypto.randomBytes(4).toString('hex');
        const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
        return `${prefix}${hash}_${safeName}`;
    }

    /**
     * Save WhatsApp media
     */
    async saveMedia(media, caption = '') {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            // Determine file type and extension
            let fileType = FILE_TYPES.TEMP;
            let extension = '';
            
            switch (media.mimetype) {
                case 'image/jpeg':
                case 'image/png':
                case 'image/webp':
                    fileType = FILE_TYPES.IMAGE;
                    extension = media.mimetype.split('/')[1];
                    break;
                case 'video/mp4':
                case 'video/webm':
                    fileType = FILE_TYPES.VIDEO;
                    extension = media.mimetype.split('/')[1];
                    break;
                case 'application/pdf':
                    fileType = FILE_TYPES.DOCUMENT;
                    extension = 'pdf';
                    break;
                default:
                    fileType = FILE_TYPES.TEMP;
                    extension = 'bin';
            }

            // Generate filename
            const safeCaption = caption ? caption.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30) : '';
            const filename = `${safeCaption}_${Date.now()}.${extension}`;

            // Save file
            const filePath = this.getPath(fileType, filename);
            await fs.writeFile(filePath, media.data, 'base64');
            
            this.stats.writes++;
            logger.info(`Media saved: ${filePath}`);
            
            return filePath;
        } catch (error) {
            this.stats.errors++;
            logger.error('Failed to save media:', error);
            throw error;
        }
    }

    /**
     * Save file with proper segregation
     */
    async saveFile(type, content, options = {}) {
        try {
            if (!this.initialized) {
                throw new Error('FileManager not initialized');
            }

            const filename = this.generateSafeFilename(options.filename || '', options.prefix);
            const filePath = this.getPath(type, filename);

            // Create buffer from content
            const buffer = Buffer.isBuffer(content) ? content :
                         typeof content === 'string' ? Buffer.from(content) :
                         Buffer.from(content.toString());

            // Save file
            await fs.writeFile(filePath, buffer, { mode: 0o644 });
            
            this.stats.writes++;
            logger.info(`File saved: ${filePath}`);
            
            return {
                path: filePath,
                filename: filename,
                size: buffer.length
            };
        } catch (error) {
            this.stats.errors++;
            logger.error('Error saving file:', error);
            throw error;
        }
    }

    /**
     * Read file safely
     */
    async readFile(type, filename) {
        try {
            if (!this.initialized) {
                throw new Error('FileManager not initialized');
            }

            const filePath = this.getPath(type, filename);
            const content = await fs.readFile(filePath);
            
            this.stats.reads++;
            return content;
        } catch (error) {
            this.stats.errors++;
            logger.error('Error reading file:', error);
            throw error;
        }
    }

    /**
     * Delete file safely
     */
    async deleteFile(filePath) {
        try {
            if (!this.initialized) {
                throw new Error('FileManager not initialized');
            }

            // Normalize path to prevent double base directory
            const normalizedPath = path.normalize(filePath);
            await fs.unlink(normalizedPath);
            
            this.stats.deletes++;
            logger.info(`File deleted: ${filePath}`);
        } catch (error) {
            this.stats.errors++;
            logger.error('Error deleting file:', error);
            throw error;
        }
    }

    /**
     * Move file between types
     */
    async moveFile(fromType, toType, filename) {
        try {
            if (!this.initialized) {
                throw new Error('FileManager not initialized');
            }

            const sourcePath = this.getPath(fromType, filename);
            const destPath = this.getPath(toType, filename);
            
            await fs.rename(sourcePath, destPath);
            logger.info(`File moved: ${sourcePath} -> ${destPath}`);
        } catch (error) {
            this.stats.errors++;
            logger.error('Error moving file:', error);
            throw error;
        }
    }

    /**
     * Get file stats
     */
    async getFileStats(type, filename) {
        try {
            if (!this.initialized) {
                throw new Error('FileManager not initialized');
            }

            const filePath = this.getPath(type, filename);
            return await fs.stat(filePath);
        } catch (error) {
            logger.error('Error getting file stats:', error);
            throw error;
        }
    }

    /**
     * Write base64 data to file
     */
    async writeBase64File(filePath, base64Data) {
        try {
            const buffer = Buffer.from(base64Data, 'base64');
            await fs.writeFile(filePath, buffer);
            logger.info(`Base64 data written to file: ${filePath}`);
        } catch (error) {
            logger.error('Error writing base64 data:', error);
            throw error;
        }
    }

    /**
     * Read file as base64
     */
    async readFileAsBase64(filePath) {
        try {
            const buffer = await fs.readFile(filePath);
            return buffer.toString('base64');
        } catch (error) {
            logger.error('Error reading file as base64:', error);
            throw error;
        }
    }

    /**
     * Get manager statistics
     */
    getStats() {
        return {
            ...this.stats,
            timestamp: new Date().toISOString()
        };
    }
}

export default new FileManager();