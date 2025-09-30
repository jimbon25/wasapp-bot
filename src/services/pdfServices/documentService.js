import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import fileManager, { FILE_TYPES } from '../../utils/fileManagement/fileManager.js';
import logger from '../../utils/common/logger.js';

const execAsync = promisify(exec);

class DocumentService {
    constructor() {
    }

    async saveFile(mediaData, filename) {
        const buffer = Buffer.from(mediaData.data, 'base64');
        const result = await fileManager.saveFile(FILE_TYPES.DOCUMENT, buffer, {
            filename: filename
        });
        return result.path;
    }

    async convertToPdf(inputPath) {
        const filename = path.basename(inputPath);
        const pdfFilename = filename.replace(/\.[^.]+$/, '.pdf');
        const outputPath = fileManager.getPath(FILE_TYPES.TEMP, pdfFilename);
        
        try {
            await execAsync(`unoconv -f pdf -o "${outputPath}" "${inputPath}"`);
            return outputPath;
        } catch (error) {
            logger.error('Error converting file:', error);
            throw new Error('Failed to convert document to PDF');
        }
    }

    async convertDocumentToPdf(mediaData, filename) {
        let inputPath = null;
        let outputPath = null;
        
        try {
            if (!mediaData || !mediaData.data) {
                throw new Error('Invalid media data received');
            }

            const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
            
            inputPath = await this.saveFile(mediaData, safeFilename);
            
            outputPath = await this.convertToPdf(inputPath);
            
            const pdfBuffer = await fs.readFile(outputPath);
            const pdfBase64 = pdfBuffer.toString('base64');
            
            if (!pdfBase64) {
                throw new Error('PDF conversion resulted in empty file');
            }

            const pdfFilename = safeFilename.replace(/\.[^.]+$/, '.pdf');
            
            return {
                mimetype: 'application/pdf',
                data: pdfBase64,
                filename: pdfFilename
            };
        } catch (error) {
            console.error('Error in document conversion:', error);
            if (error.message.includes('unoconv')) {
                throw new Error('PDF conversion failed. Please make sure the document is not corrupted.');
            }
            throw error;
        } finally {
            if (inputPath || outputPath) {
                await this.cleanup(inputPath, outputPath);
            }
        }
    }

    async cleanup(...filePaths) {
        for (const filePath of filePaths) {
            try {
                await fs.unlink(filePath);
            } catch (error) {
                console.error('Error cleaning up file:', filePath, error);
            }
        }
    }
}

export default new DocumentService();