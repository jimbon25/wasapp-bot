import fs from 'fs';
import path from 'path';
import { redisLogger } from './RedisLogger.js';

class LocalStorageFallback {
    constructor(baseDir = process.cwd()) {
        this.baseDir = path.join(baseDir, '.redis-fallback');
        this.ensureDirectory();
    }

    ensureDirectory() {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }

    getFilePath(key) {
        return path.join(this.baseDir, `${key}.json`);
    }

    async set(key, value, ttl = null) {
        try {
            const data = {
                value,
                ttl: ttl ? Date.now() + (ttl * 1000) : null
            };
            fs.writeFileSync(this.getFilePath(key), JSON.stringify(data));
            return true;
        } catch (error) {
            redisLogger.error('LocalStorageFallback set error:', error);
            return false;
        }
    }

    async get(key) {
        try {
            const filePath = this.getFilePath(key);
            if (!fs.existsSync(filePath)) {
                return null;
            }

            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Check TTL
            if (data.ttl && Date.now() > data.ttl) {
                fs.unlinkSync(filePath);
                return null;
            }

            return data.value;
        } catch (error) {
            redisLogger.error('LocalStorageFallback get error:', error);
            return null;
        }
    }

    async del(key) {
        try {
            const filePath = this.getFilePath(key);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return true;
        } catch (error) {
            redisLogger.error('LocalStorageFallback del error:', error);
            return false;
        }
    }

    async exists(key) {
        try {
            const filePath = this.getFilePath(key);
            return fs.existsSync(filePath);
        } catch (error) {
            redisLogger.error('LocalStorageFallback exists error:', error);
            return false;
        }
    }

    async cleanup() {
        try {
            const files = fs.readdirSync(this.baseDir);
            for (const file of files) {
                try {
                    const filePath = path.join(this.baseDir, file);
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    if (data.ttl && Date.now() > data.ttl) {
                        fs.unlinkSync(filePath);
                    }
                } catch (error) {
                    continue;
                }
            }
        } catch (error) {
            redisLogger.error('LocalStorageFallback cleanup error:', error);
        }
    }
}

export const localStorageFallback = new LocalStorageFallback();
export default localStorageFallback;