import { redisManager } from './RedisManager.js';
import { localStorageFallback } from './LocalStorageFallback.js';
import os from 'os';

class PerformanceMonitor {
    constructor() {
        this.redisClient = null;
        this.prefix = 'performance';
        this.instanceId = `${os.hostname()}:${process.pid}`;
        this.metricsInterval = null;
    }

    async init() {
        try {
            this.redisClient = redisManager.getClient();
            this.startMetricsCollection();
        } catch (error) {
            console.error('Failed to initialize PerformanceMonitor:', error);
            throw error;
        }
    }

    getKey(metric) {
        return `${this.prefix}:${this.instanceId}:${metric}`;
    }

    async recordMetric(metric, value) {
        try {
            this.redisClient = await redisManager.getClient();
            if (!this.redisClient) {
                return await localStorageFallback.set(
                    `metrics:${metric}:${Date.now()}`,
                    { timestamp: Date.now(), value },
                    3600
                );
            }

            const key = this.getKey(metric);
            const timestamp = Date.now();
            await this.redisClient.zadd(key, timestamp, JSON.stringify({ timestamp, value }));
            await this.redisClient.zremrangebyscore(key, '-inf', timestamp - 3600000);
            return true;
        } catch (error) {
            console.error('Redis recordMetric error:', error);
            return await localStorageFallback.set(
                `metrics:${metric}:${Date.now()}`,
                { timestamp: Date.now(), value },
                3600
            );
        }
    }

    async getMetrics(metric, startTime = Date.now() - 3600000) {
        try {
            this.redisClient = await redisManager.getClient();
            if (!this.redisClient) {
                const metrics = [];
                const prefix = `metrics:${metric}:`;
                const files = await localStorageFallback.listKeys(prefix);
                for (const key of files) {
                    const data = await localStorageFallback.get(key);
                    if (data && data.timestamp >= startTime) {
                        metrics.push(data);
                    }
                }
                return metrics.sort((a, b) => a.timestamp - b.timestamp);
            }

            const key = this.getKey(metric);
            const data = await this.redisClient.zrangebyscore(key, startTime, '+inf');
            return data.map(item => JSON.parse(item));
        } catch (error) {
            console.error('Redis getMetrics error:', error);
            return this.getLocalMetrics(metric, startTime);
        }
    }

    async getLocalMetrics(metric, startTime) {
        try {
            const metrics = [];
            const prefix = `metrics:${metric}:`;
            const files = await localStorageFallback.listKeys(prefix);
            for (const key of files) {
                const data = await localStorageFallback.get(key);
                if (data && data.timestamp >= startTime) {
                    metrics.push(data);
                }
            }
            return metrics.sort((a, b) => a.timestamp - b.timestamp);
        } catch (error) {
            console.error('Local metrics retrieval error:', error);
            return [];
        }
    }

    startMetricsCollection() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }

        this.metricsInterval = setInterval(async () => {
            try {
                await this.collectSystemMetrics();
            } catch (error) {
                console.error('Metrics collection error:', error);
            }
        }, 10000);
    }

    stopMetricsCollection() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = null;
        }
    }

    async collectSystemMetrics() {
        const metrics = {
            cpu: os.loadavg()[0],
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            heap: process.memoryUsage().heapUsed,
            activeHandles: process._getActiveHandles().length,
            activeRequests: process._getActiveRequests().length
        };

        await Promise.all([
            this.recordMetric('cpu', metrics.cpu),
            this.recordMetric('memory', metrics.memory.heapUsed),
            this.recordMetric('uptime', metrics.uptime),
            this.recordMetric('activeHandles', metrics.activeHandles),
            this.recordMetric('activeRequests', metrics.activeRequests)
        ]);
    };

    async getSystemStatus() {
        const metrics = {
            cpu: (await this.getMetrics('cpu')).slice(-1)[0],
            memory: (await this.getMetrics('memory')).slice(-1)[0],
            uptime: (await this.getMetrics('uptime')).slice(-1)[0],
            activeHandles: (await this.getMetrics('activeHandles')).slice(-1)[0],
            activeRequests: (await this.getMetrics('activeRequests')).slice(-1)[0]
        };

        return {
            timestamp: Date.now(),
            instanceId: this.instanceId,
            metrics
        };
    };

    async checkHealth() {
        const status = await this.getSystemStatus();
        const metrics = status.metrics;

        const thresholds = {
            cpu: 80,
            memory: 1024 * 1024 * 1024,
            activeHandles: 1000,
            activeRequests: 1000
        };

        const health = {
            status: 'healthy',
            checks: {
                cpu: metrics.cpu?.value < thresholds.cpu,
                memory: metrics.memory?.value < thresholds.memory,
                activeHandles: metrics.activeHandles?.value < thresholds.activeHandles,
                activeRequests: metrics.activeRequests?.value < thresholds.activeRequests
            }
        };

        if (Object.values(health.checks).includes(false)) {
            health.status = 'unhealthy';
        }

        return health;
    };
}

export const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;