import config from '../../config.js';

/**
 * Cleanup intervals in milliseconds
 */
export const CLEANUP_INTERVALS = {
    TEMP: config.files.tempFileMaxAge,
    DOCUMENTS: 7 * 24 * 60 * 60 * 1000,
    MEDIA: 3 * 24 * 60 * 60 * 1000,
    INSTAGRAM_CACHE: config.files.instagramCache.maxAge
};

export const FILE_PATTERNS = {
    INSTAGRAM_CACHE: /^download_[a-f0-9]{32}\.mp4$/
};

/**
 * File size limits loaded from configuration
 */
export const FILE_SIZE_LIMITS = {
    DOCUMENT: {
        PDF: config.files.limits.document.pdf,
        WORD: config.files.limits.document.word,
        EXCEL: config.files.limits.document.excel,
        DEFAULT: config.files.limits.document.default
    },
    IMAGE: {
        JPEG: config.files.limits.image.jpeg,
        PNG: config.files.limits.image.png,
        GIF: config.files.limits.image.gif,
        DEFAULT: config.files.limits.image.default
    },
    VIDEO: {
        MP4: config.files.limits.video.mp4,
        DEFAULT: config.files.limits.video.default
    },
    AUDIO: {
        MP3: config.files.limits.audio.mp3,
        DEFAULT: config.files.limits.audio.default
    }
};

/**
 * Mime type mappings
 */
export const MIME_TYPE_CATEGORIES = {
    // Documents
    'application/pdf': 'DOCUMENT.PDF',
    'application/msword': 'DOCUMENT.WORD',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCUMENT.WORD',
    'application/vnd.ms-excel': 'DOCUMENT.EXCEL',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'DOCUMENT.EXCEL',
    
    // Images
    'image/jpeg': 'IMAGE.JPEG',
    'image/png': 'IMAGE.PNG',
    'image/gif': 'IMAGE.GIF',
    
    // Videos
    'video/mp4': 'VIDEO.MP4',
    
    // Audio
    'audio/mpeg': 'AUDIO.MP3',
    'audio/mp3': 'AUDIO.MP3'
};

/**
 * Get file size limit based on mime type
 * @param {string} mimeType - MIME type of the file
 * @returns {number} Size limit in bytes
 */
export function getFileSizeLimit(mimeType) {
    const category = MIME_TYPE_CATEGORIES[mimeType];
    if (!category) {
        return FILE_SIZE_LIMITS.DOCUMENT.DEFAULT;
    }

    const [type, subtype] = category.split('.');
    return FILE_SIZE_LIMITS[type][subtype] || FILE_SIZE_LIMITS[type].DEFAULT;
}

/**
 * Format bytes to human readable size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
}