/**
 * Message queue to prevent flooding and manage message sending rate
 */
class MessageQueue {
    constructor(options = {}) {
        this.queue = new Map();
        this.processingInterval = options.processingInterval || 1000; // Time between messages
        this.maxQueueSize = options.maxQueueSize || 100; // Maximum messages in queue per user
        this.running = false;
    }

    /**
     * Add message to queue
     */
    async enqueue(userId, message, priority = 0) {
        if (!this.queue.has(userId)) {
            this.queue.set(userId, []);
        }

        const userQueue = this.queue.get(userId);

        if (userQueue.length >= this.maxQueueSize) {
            throw new Error('Queue full for this user');
        }

        userQueue.push({
            message,
            priority,
            timestamp: Date.now()
        });

        userQueue.sort((a, b) => b.priority - a.priority);

        if (!this.running) {
            this.running = true;
            this.processQueue();
        }
    }

    /**
     * Process messages in queue
     */
    async processQueue() {
        while (this.running && this.hasMessages()) {
            for (const [userId, userQueue] of this.queue) {
                if (userQueue.length > 0) {
                    const item = userQueue.shift();
                    try {
                        await item.message();
                    } catch (error) {
                        console.error('Error processing message:', error);
                    }
                    if (userQueue.length === 0) {
                        this.queue.delete(userId);
                    }
                    await new Promise(resolve => setTimeout(resolve, this.processingInterval));
                }
            }
        }
        this.running = false;
    }

    /**
     * Check if there are messages in any queue
     */
    hasMessages() {
        return Array.from(this.queue.values()).some(q => q.length > 0);
    }

    /**
     * Get queue length for a user
     */
    getQueueLength(userId) {
        return this.queue.get(userId)?.length || 0;
    }

    /**
     * Clear queue for a user
     */
    clearQueue(userId) {
        this.queue.delete(userId);
    }
}

export default MessageQueue;