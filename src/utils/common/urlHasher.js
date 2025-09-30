import crypto from 'crypto';

export function hashUrl(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

export function generateCacheKey(url) {
    const hash = hashUrl(url);
    return `download_${hash}`;
}