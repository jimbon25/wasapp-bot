import { getFileSizeLimit, formatFileSize } from './fileConstants.js';

class MediaValidator {
    /**
     * Validate media size and type
     * @param {Object} media - Media object from whatsapp-web.js
     * @returns {Object} Validation result { valid: boolean, error: string|null }
     */
    validateMedia(media) {
        if (!media || !media.mimetype) {
            return { valid: false, error: 'Invalid media format' };
        }

        const sizeLimit = getFileSizeLimit(media.mimetype);
        
        const fileSize = this.calculateFileSize(media.data);
        
        if (fileSize > sizeLimit) {
            return {
                valid: false,
                error: `File too large. Maximum size allowed is ${formatFileSize(sizeLimit)}, got ${formatFileSize(fileSize)}`
            };
        }

        return { valid: true, error: null };
    }

    /**
     * Calculate file size from base64 string
     * @param {string} base64String - Base64 encoded file data
     * @returns {number} File size in bytes
     */
    calculateFileSize(base64String) {
        const base64Data = base64String.replace(/^data:[^;]+;base64,/, '');
        
        const padding = base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0;
        return (base64Data.length * 3) / 4 - padding;
    }
}

export default new MediaValidator();