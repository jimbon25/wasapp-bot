/**
 * Utility class to collect messages in a chat
 */
class MessageCollector {
    constructor(client, filter, options = {}) {
        this.client = client;
        this.filter = filter;
        this.options = {
            max: options.max || 1,
            time: options.time || 60000,
            ...options
        };
        this.collected = [];
        this.listener = null;
        this._timeout = null;
    }

    /**
     * Start collecting messages
     * @returns {Promise<Message[]>} Collected messages
     */
    async collect() {
        return new Promise((resolve, reject) => {
            this.listener = async (msg) => {
                try {
                    if (await this.filter(msg)) {
                        this.collected.push(msg);
                        if (this.collected.length >= this.options.max) {
                            this.stop();
                            resolve(this.collected);
                        }
                    }
                } catch (error) {
                    this.stop();
                    reject(error);
                }
            };

            this.client.on('message', this.listener);

            this._timeout = setTimeout(() => {
                this.stop();
                resolve(this.collected);
            }, this.options.time);
        });
    }

    /**
     * Stop collecting messages
     */
    stop() {
        if (this.listener) {
            this.client.removeListener('message', this.listener);
            this.listener = null;
        }
        if (this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = null;
        }
    }
}

export default MessageCollector;