import config from '../../config.js';

/**
 * Rate limiter implementation using token bucket algorithm
 */
class RateLimiter {
    constructor(type = 'default') {
        // Get settings based on limiter type
        const settings = config.security[`${type}Limiter`] || config.security.commandLimiter;
        
        this.capacity = settings.capacity;
        this.refillRate = settings.refillRate;
        this.refillInterval = settings.refillInterval;
        this.buckets = new Map();
        
        setInterval(() => this.refillBuckets(), this.refillInterval);
    }

    /**
     * Refill all buckets based on the refill rate
     */
    refillBuckets() {
        for (const [key, bucket] of this.buckets) {
            bucket.tokens = Math.min(
                bucket.tokens + this.refillRate,
                this.capacity
            );
        }
    }

    /**
     * Get or create a bucket for a specific key
     */
    getBucket(key) {
        if (!this.buckets.has(key)) {
            this.buckets.set(key, {
                tokens: this.capacity,
                lastRefill: Date.now()
            });
        }
        return this.buckets.get(key);
    }

    /**
     * Check if action is allowed and consume a token if it is
     */
    tryConsume(key, tokens = 1) {
        const bucket = this.getBucket(key);
        
        if (bucket.tokens >= tokens) {
            bucket.tokens -= tokens;
            return true;
        }
        return false;
    }

    /**
     * Get remaining tokens for a key
     */
    getTokens(key) {
        return this.getBucket(key).tokens;
    }

    /**
     * Reset bucket for a key
     */
    resetBucket(key) {
        this.buckets.delete(key);
    }
}

export default RateLimiter;