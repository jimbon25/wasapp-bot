import { redisManager } from './RedisManager.js';
import { messageQueueManager } from './MessageQueueManager.js';
import { rateLimitManager } from './RateLimitManager.js';
import { sessionBackupManager } from './SessionBackupManager.js';
import { performanceMonitor } from './PerformanceMonitor.js';
import { cacheManager } from './CacheManager.js';
import config from '../../config.js';


class FallbackConfig {
    constructor() {
        this.features = {
            messageQueue: true,
            rateLimiting: true,
            sessionBackup: true,
            performance: true,
            caching: true
        };
        this.thresholds = {
            messageQueueSize: config.redis.queueMaxLength,
            rateLimit: config.redis.rateLimitThreshold,
            memoryUsage: config.redis.memoryThreshold,
            cpuUsage: config.redis.cpuThreshold
        };
        this.redisClient = null;
        this.configKey = 'fallback:config';
    }

    async init() {
        try {
            try {
                await redisManager.connect();
                this.redisClient = await redisManager.getClient();
            } catch (redisError) {
                console.warn('Redis not available:', redisError.message);
                this.redisClient = null;
            }

            if (this.redisClient) {
                await this.loadConfig();
                await this.startMonitoring();
                console.info('FallbackConfig initialized with Redis');
            } else {
                await this.loadLocalConfig();
                console.info('FallbackConfig initialized with local storage');
            }
        } catch (error) {
            console.error('Failed to initialize FallbackConfig:', error);
            this.useDefaultConfig();
            console.warn('Using default configuration due to initialization error');
        }
    }

    async loadLocalConfig() {
        try {
            const localConfig = await localStorageFallback.get('fallback:config');
            if (localConfig) {
                this.features = { ...this.features, ...localConfig.features };
                this.thresholds = { ...this.thresholds, ...localConfig.thresholds };
            }
        } catch (error) {
            console.error('Local config load error:', error);
            this.useDefaultConfig();
        }
    }

    useDefaultConfig() {
        this.features = {
            messageQueue: true,
            rateLimiting: true,
            sessionBackup: true,
            performance: true,
            caching: true
        };
        this.thresholds = {
            messageQueueSize: config.redis.queueMaxLength,
            rateLimit: config.redis.rateLimitThreshold,
            memoryUsage: config.redis.memoryThreshold,
            cpuUsage: config.redis.cpuThreshold
        };
    }

    async loadConfig() {
        if (!this.redisClient) {
            return;
        }

        try {
            const savedConfig = await this.redisClient.get(this.configKey);
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                this.features = { ...this.features, ...config.features };
                this.thresholds = { ...this.thresholds, ...config.thresholds };
            }
        } catch (error) {
            console.error('Redis loadConfig error:', error);
        }
    }

    async saveConfig() {
        if (!this.redisClient) await this.init();

        try {
            await this.redisClient.set(this.configKey, JSON.stringify({
                features: this.features,
                thresholds: this.thresholds
            }));
        } catch (error) {
            console.error('Redis saveConfig error:', error);
        }
    }

    async updateFeature(feature, enabled) {
        if (this.features.hasOwnProperty(feature)) {
            this.features[feature] = enabled;
            await this.saveConfig();
            await this.applyFeatureState(feature, enabled);
        }
    }

    async updateThreshold(threshold, value) {
        if (this.thresholds.hasOwnProperty(threshold)) {
            this.thresholds[threshold] = value;
            await this.saveConfig();
        }
    }

    async applyFeatureState(feature, enabled) {
        switch (feature) {
            case 'messageQueue':
                if (enabled) {
                    await messageQueueManager.init();
                }
                break;
            case 'rateLimiting':
                if (enabled) {
                    await rateLimitManager.init();
                }
                break;
            case 'sessionBackup':
                if (enabled) {
                    await sessionBackupManager.init();
                } else {
                    sessionBackupManager.stopPeriodicBackup();
                }
                break;
            case 'performance':
                if (enabled) {
                    await performanceMonitor.init();
                } else {
                    performanceMonitor.stopMetricsCollection();
                }
                break;
            case 'caching':
                if (enabled) {
                    await cacheManager.init();
                }
                break;
        }
    }

    async startMonitoring() {
        setInterval(async () => {
            if (!this.features.performance) return;

            const health = await performanceMonitor.checkHealth();
            if (health.status === 'unhealthy') {
                await this.enableAllFallbacks();
            }
        }, 60000);
    }

    async enableAllFallbacks() {
        for (const feature in this.features) {
            if (!this.features[feature]) {
                await this.updateFeature(feature, true);
                console.log(`Enabled ${feature} fallback due to system health`);
            }
        }
    }

    getFeatureState(feature) {
        return this.features[feature] || false;
    }

    getThreshold(threshold) {
        return this.thresholds[threshold];
    }

    async getStatus() {
        return {
            features: this.features,
            thresholds: this.thresholds,
            health: await performanceMonitor.checkHealth()
        };
    }
}

export const fallbackConfig = new FallbackConfig();
export default fallbackConfig;