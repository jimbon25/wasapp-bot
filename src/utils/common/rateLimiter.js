class RateLimiter {
    constructor(maxRequests = 100, timeWindow = 60000) {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = new Map();
    }

    async checkLimit(accountId) {
        const now = Date.now();
        const accountRequests = this.requests.get(accountId) || [];
        
        const validRequests = accountRequests.filter(timestamp => 
            now - timestamp < this.timeWindow
        );

        if (validRequests.length >= this.maxRequests) {
            const oldestRequest = validRequests[0];
            const timeToWait = this.timeWindow - (now - oldestRequest);
            throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(timeToWait / 1000)} seconds`);
        }

        validRequests.push(now);
        this.requests.set(accountId, validRequests);
        
        return true;
    }

    async reset(accountId) {
        this.requests.delete(accountId);
    }
}

export const gmailRateLimiter = new RateLimiter(100, 60000); // 100 requests per minute
export const driveRateLimiter = new RateLimiter(1000, 60000); // 1000 requests per minute