import { redisManager } from './RedisManager.js';
import { performanceMonitor } from './PerformanceMonitor.js';
import { redisLogger } from './RedisLogger.js';

class RedisAlertSystem {
    constructor() {
        this.thresholds = {
            memoryUsage: 80,
            errorRate: 10,
            responseTime: 100
        };
        this.alertInterval = null;
    }

    async start() {
        this.alertInterval = setInterval(async () => {
            await this.checkAlerts();
        }, 60000);
    }

    stop() {
        if (this.alertInterval) {
            clearInterval(this.alertInterval);
            this.alertInterval = null;
        }
    }

    async checkAlerts() {
        try {
            const health = await redisManager.getHealthStatus();
            
            if (health.memory) {
                const memoryUsage = (health.memory.used / health.memory.peak) * 100;
                if (memoryUsage > this.thresholds.memoryUsage) {
                    this.triggerAlert('memory', `High memory usage: ${memoryUsage.toFixed(2)}%`);
                }
            }

            if (health.operations) {
                const errorRate = (health.operations.errors / health.operations.total) * 100;
                if (errorRate > this.thresholds.errorRate) {
                    this.triggerAlert('errors', `High error rate: ${errorRate.toFixed(2)}%`);
                }
            }

            if (health.status === 'unhealthy') {
                this.triggerAlert('system', 'Redis system is unhealthy');
            }

            await performanceMonitor.recordMetric('redis_alerts', this.currentAlerts.length);

        } catch (error) {
            redisLogger.error('Alert check failed:', error);
        }
    }

    triggerAlert(type, message) {
        const alert = {
            type,
            message,
            timestamp: new Date(),
            id: `${type}_${Date.now()}`
        };

        redisLogger.warn(`[ALERT] ${message}`);
        this.currentAlerts.push(alert);

        if (this.currentAlerts.length > 100) {
            this.currentAlerts.shift();
        }


    }

    getAlerts(type = null) {
        if (type) {
            return this.currentAlerts.filter(alert => alert.type === type);
        }
        return this.currentAlerts;
    }

    clearAlerts() {
        this.currentAlerts = [];
    }
}

export const redisAlertSystem = new RedisAlertSystem();
export default redisAlertSystem;