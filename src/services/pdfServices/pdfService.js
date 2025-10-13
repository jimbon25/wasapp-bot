import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { exec } from 'child_process';
import { cacheManager, messageQueueManager } from '../../utils/redis/index.js';
import logger from '../../utils/common/logger.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fileManager, { FILE_TYPES } from '../../utils/fileManagement/fileManager.js';

class PDFService {
    constructor() {
        this.cacheManager = cacheManager;
        this.queueManager = messageQueueManager;
    }

    async convertToPdf(inputFile, outputFile, options = {}) {
        try {
            const outputDir = path.dirname(outputFile);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const templatePath = path.join(__dirname, 'templates', 'text2pdf.html');
            let template = await fs.promises.readFile(templatePath, 'utf8');

            const content = await fs.promises.readFile(inputFile, 'utf8');

            const now = new Date();
            const timestamp = now.toLocaleString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const lines = content.replace(/\r\n/g, '\n').split('\n');
            let inUnorderedList = false;
            let inOrderedList = false;
            const processedLines = [];

            for (const line of lines) {
                const isUnorderedListItem = line.match(/^[-•]\s+/);
                const isOrderedListItem = line.match(/^\d+\.\s+/);

                if (inOrderedList && !isOrderedListItem) {
                    processedLines.push('</ol>');
                    inOrderedList = false;
                }

                if (inUnorderedList && !isUnorderedListItem) {
                    processedLines.push('</ul>');
                    inUnorderedList = false;
                }

                if (line.match(/^[\w\s]+:\s*$/)) {
                    processedLines.push(`<h2>${line.trim()}</h2>`);
                } else if (isUnorderedListItem) {
                    if (!inUnorderedList) {
                        processedLines.push('<ul>');
                        inUnorderedList = true;
                    }
                    processedLines.push(`<li>${line.replace(/^[-•]\s+/, '')}</li>`);
                } else if (isOrderedListItem) {
                    if (!inOrderedList) {
                        processedLines.push('<ol>');
                        inOrderedList = true;
                    }
                    processedLines.push(`<li>${line.replace(/^\d+\.\s+/, '')}</li>`);
                } else if (line.trim() === '') {
                    processedLines.push('</p><p>');
                } else {
                    processedLines.push(line);
                }
            }

            if (inUnorderedList) {
                processedLines.push('</ul>');
            }
            if (inOrderedList) {
                processedLines.push('</ol>');
            }

            const processedText = processedLines.join('\n')
                .replace(/<\/p><p><\/p><p>/g, '</p><p>')
                .replace(/<\/p><p>\s*<ul>/g, '</p><ul>')
                .replace(/<\/ul>\s*<\/p><p>/g, '</ul><p>')
                .replace(/<\/p><p>\s*<ol>/g, '</p><ol>')
                .replace(/<\/ol>\s*<\/p><p>/g, '</ol><p>')
                .trim();

            const templateHtml = template
                .replace('{{CONTENT}}', `<p>${processedText}</p>`)
                .replace('{{TIMESTAMP}}', timestamp);

            const tempHtmlFile = inputFile.replace('.txt', '.html');
            await fs.promises.writeFile(tempHtmlFile, templateHtml, 'utf8');

            const command = `unoconv -f pdf -o "${outputFile}" "${tempHtmlFile}"`;
            const { stdout, stderr } = await execAsync(command);
            
            if (stderr) {
                logger.warn('unoconv stderr:', stderr);
            }

            try {
                await fs.promises.unlink(tempHtmlFile);
            } catch (error) {
                logger.warn('Error cleaning up HTML file:', error);
            }

            if (!fs.existsSync(outputFile)) {
                throw new Error('PDF file not created');
            }

            logger.info(`Successfully converted text to PDF with formatting`);
            return outputFile;
        } catch (error) {
            logger.error('Error converting to PDF:', error);
            throw error;
        }
    }

    async optimizeImage(imagePath) {
        try {
            let quality = 85;
            let optimizedImageBuffer;
            
            const metadata = await sharp(imagePath).metadata();
            const isPortrait = metadata.height > metadata.width;
            
            do {
                let sharpInstance = sharp(imagePath);
                
                const a4Width = 2480;
                const a4Height = 3508;

                sharpInstance = sharpInstance
                    .ensureAlpha()
                    .composite([{
                        input: Buffer.from([255, 255, 255, 255]),
                        raw: {
                            width: 1,
                            height: 1,
                            channels: 4
                        },
                        tile: true,
                        blend: 'dest-over'
                    }]);

                if (isPortrait) {
                    sharpInstance = sharpInstance.resize({
                        height: a4Height,
                        width: a4Width,
                        fit: 'inside',
                        withoutEnlargement: true,
                        background: { r: 255, g: 255, b: 255, alpha: 1 }
                    });
                } else {
                    sharpInstance = sharpInstance.resize({
                        width: a4Height,
                        height: a4Width,
                        fit: 'inside',
                        withoutEnlargement: true,
                        background: { r: 255, g: 255, b: 255, alpha: 1 }
                    });
                }
                
                optimizedImageBuffer = await sharpInstance
                    .flatten({ background: { r: 255, g: 255, b: 255 } })
                    .removeAlpha()
                    .jpeg({ 
                        quality: quality,
                        chromaSubsampling: '4:4:4'
                    })
                    .toBuffer();
                
                if (optimizedImageBuffer.length > 2 * 1024 * 1024) {
                    quality -= 10;
                } else {
                    break;
                }
            } while (quality >= 30);
            
            if (quality < 30) {
                logger.warn('Image quality reduced to minimum but still large:', imagePath);
            }
            
            return optimizedImageBuffer;
        } catch (error) {
            logger.error('Error optimizing image:', error);
            throw new Error('Failed to optimize image');
        }
    }

    async createPDF(images, options = {}) {
        const {
            size = 'A4',
            compress = true,
            margin = 20
        } = options;

        const doc = new PDFDocument({ 
            size,
            autoFirstPage: false,
            compress,
            margin
        });

        const outputPath = fileManager.getPath(FILE_TYPES.TEMP, `${Date.now()}.pdf`);
        const writeStream = fs.createWriteStream(outputPath);
        doc.pipe(writeStream);

        try {
            for (const imagePath of images) {
                const metadata = await sharp(imagePath).metadata();
                const isPortrait = metadata.height > metadata.width;
                
                const optimizedImage = await this.optimizeImage(imagePath);
                
                doc.addPage({
                    size: 'A4',
                    layout: isPortrait ? 'portrait' : 'landscape',
                    margin
                });

                const pageWidth = doc.page.width - (margin * 2);
                const pageHeight = doc.page.height - (margin * 2);

                doc.image(optimizedImage, {
                    fit: [pageWidth, pageHeight],
                    align: 'center',
                    valign: 'center'
                });
            }

            doc.end();

            return new Promise((resolve, reject) => {
                writeStream.on('finish', () => resolve(outputPath));
                writeStream.on('error', reject);
            });
        } catch (error) {
            doc.end();
            logger.error('Error creating PDF:', error);
            throw new Error('Failed to create PDF');
        }
    }

    async addToQueue(sessionId, imagePath) {
        const key = `pdf_queue:${sessionId}`;
        await this.queueManager.enqueue({ key, path: imagePath });
    }

    async getQueuedImages(sessionId) {
        const key = `pdf_queue:${sessionId}`;
        const queueLength = await this.queueManager.getLength();
        const images = [];
        
        for (let i = 0; i < queueLength; i++) {
            const item = await this.queueManager.peek();
            if (item && item.key === key) {
                images.push(item.path);
            }
        }
        
        return images;
    }

    async clearQueue(sessionId) {
        const key = `pdf_queue:${sessionId}`;
        await this.queueManager.clear();
    }

    async removeFromQueue(sessionId, index) {
        const key = `pdf_queue:${sessionId}`;
        const images = await this.getQueuedImages(sessionId);
        if (index >= 0 && index < images.length) {
            await this.queueManager.clear();
            
            images.splice(index, 1);
            for (const imagePath of images) {
                await this.queueManager.enqueue({ key, path: imagePath });
            }
            return true;
        }
        return false;
    }

    async reorderQueue(sessionId, oldIndex, newIndex) {
        const key = `pdf_queue:${sessionId}`;
        const images = await this.getQueuedImages(sessionId);
        
        if (oldIndex >= 0 && oldIndex < images.length && 
            newIndex >= 0 && newIndex < images.length) {
            await this.queueManager.clear();
            
            const [image] = images.splice(oldIndex, 1);
            images.splice(newIndex, 0, image);
            for (const imagePath of images) {
                await this.queueManager.enqueue({ key, path: imagePath });
            }
            return true;
        }
        return false;
    }

    cleanup() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        fs.readdir(this.tempDir, (err, files) => {
            if (err) {
                logger.error('Error reading temp directory:', err);
                return;
            }

            files.forEach(file => {
                const filePath = path.join(this.tempDir, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) {
                        logger.error('Error getting file stats:', err);
                        return;
                    }

                    if (stats.mtimeMs < oneHourAgo) {
                        fs.unlink(filePath, err => {
                            if (err) logger.error('Error deleting file:', err);
                        });
                    }
                });
            });
        });
    }
}

export default new PDFService();