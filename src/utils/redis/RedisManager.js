import Redis from 'ioredis';
import { performanceMonitor } from './PerformanceMonitor.js';
import { redisLogger } from './RedisLogger.js';
import { localStorageFallback } from './LocalStorageFallback.js';
import { EventEmitter } from 'events';
import config from '../../config.js';

class RedisManager extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.isConnected = false;
        this.maxRetries = config.redis.maxRetries || 10;
        this.retryCount = 0;
        this._reconnectTimer = null;
        this._manuallyDisconnected = false;
        this.stats = {
            operations: 0,
            errors: 0,
            lastError: null,
            lastOperation: null,
            connectionDrops: 0
        };
    }

    updateStats(operation, isError = false, error = null) {
        this.stats.operations++;
        this.stats.lastOperation = new Date();
        if (isError) {
            this.stats.errors++;
            this.stats.lastError = error;
        }
    }

    async connect() {
        try {
            if (this.client) {
                console.log('Redis client already exists, disconnecting...');
                this._manuallyDisconnected = true;
                
                await new Promise((resolve) => {
                    this.client.once('end', () => {
                        setTimeout(resolve, 100);
                    });
                    this.client.disconnect();
                });
                
                this._manuallyDisconnected = false;
                this.client = null;
            }

            const redisClientConfig = {
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password,
                retryStrategy: (times) => {
                    const maxRetryTime = config.redis.maxRetryTime;
                    if (this._manuallyDisconnected) {
                        return null;
                    }
                    if (times * 1000 > maxRetryTime) {
                        this.emit('fallback');
                        return null;
                    }
                    return Math.min(times * 1000, 10000);
                },
                connectTimeout: config.redis.connectTimeout,
                enableReadyCheck: true,
                maxRetriesPerRequest: config.redis.maxRetries
            };
            
            console.log('Connecting to Redis with config:', {
                ...redisClientConfig,
                password: redisClientConfig.password ? '***' : undefined
            });
            
            this.client = new Redis(redisClientConfig);

            this.client.on('connect', () => {
                redisLogger.info('Successfully connected to Redis');
                this.isConnected = true;
                this.retryCount = 0;
                this.emit('connected');
                performanceMonitor.recordMetric('redis_connection', 1);
            });

            this.client.on('error', (err) => {
                if (!this._manuallyDisconnected) {
                    redisLogger.error('Redis connection error:', err);
                    this.isConnected = false;
                    this.stats.errors++;
                    this.stats.lastError = err;
                    performanceMonitor.recordMetric('redis_errors', this.stats.errors);
                }
            });

            this.client.on('close', () => {
                if (this._manuallyDisconnected) {
                    redisLogger.info('Redis connection closed due to manual disconnect');
                    this.isConnected = false;
                    this.emit('disconnected');
                    return;
                }
                
                redisLogger.warn('Redis connection closed, attempting to reconnect...');
                this.isConnected = false;
                this.stats.connectionDrops++;
                this.emit('disconnected');
                
                this.client.once('end', () => {
                    performanceMonitor.recordMetric('redis_disconnections', this.stats.connectionDrops);
                });
                
                if (this._reconnectTimer) {
                    clearTimeout(this._reconnectTimer);
                }
                
                const baseDelay = 1000;
                const maxDelay = 60000;
                const jitter = Math.random() * 1000;
                const backoffTime = Math.min(baseDelay * Math.pow(2, this.retryCount) + jitter, maxDelay);
                
                this._reconnectTimer = setTimeout(async () => {
                    try {
                        if (!this.isConnected && !this._manuallyDisconnected) {
                            this.retryCount++;
                            redisLogger.info(`Reconnection attempt ${this.retryCount} after ${backoffTime}ms`);
                            await this.connect();
                        }
                    } catch (error) {
                        redisLogger.error(`Redis reconnection attempt ${this.retryCount} failed:`, error);
                        if (this.retryCount >= this.maxRetries) {
                            redisLogger.error('Max reconnection attempts reached, switching to fallback mode');
                            this.emit('fallback');
                        }
                    }
                }, backoffTime);
            });

            setInterval(async () => {
                if (this.isConnected) {
                    try {
                        const info = await this.client.info();
                        const metrics = this.parseRedisInfo(info);
                        await performanceMonitor.recordMetric('redis_memory', metrics.used_memory);
                        await performanceMonitor.recordMetric('redis_clients', metrics.connected_clients);
                        await performanceMonitor.recordMetric('redis_ops', metrics.total_commands_processed);
                    } catch (error) {
                        redisLogger.error('Failed to collect Redis metrics:', error);
                    }
                }
            }, 60000);

            return this.client;
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.client) {
            try {
                this._manuallyDisconnected = true;
                
                await new Promise((resolve, reject) => {
                    this.client.once('end', resolve);
                    this.client.once('error', reject);
                    this.client.disconnect();
                }).catch((error) => {
                    redisLogger.error('Redis disconnect error:', error);
                });
                
                this.client = null;
                this.isConnected = false;
                this._manuallyDisconnected = false;
                return true;
            } catch (error) {
                redisLogger.error('Redis disconnect error:', error);
                this._manuallyDisconnected = false;
                return false;
            }
        }
        return true;
    }

    async getClient() {
        if (!this.client || !this.isConnected) {
            try {
                await this.connect();
            } catch (error) {
                redisLogger.warn('Failed to connect to Redis, using local storage fallback');
                return null;
            }
        }
        return this.client;
    }

    parseRedisInfo(info) {
        const metrics = {};
        const lines = info.split('\n');
        
        for (const line of lines) {
            if (line && !line.startsWith('#')) {
                const [key, value] = line.split(':');
                if (key && value) {
                    metrics[key.trim()] = parseInt(value) || value.trim();
                }
            }
        }
        
        return {
            used_memory: metrics.used_memory || 0,
            connected_clients: metrics.connected_clients || 0,
            total_commands_processed: metrics.total_commands_processed || 0,
            uptime_in_seconds: metrics.uptime_in_seconds || 0,
            used_memory_peak: metrics.used_memory_peak || 0,
            used_cpu_sys: metrics.used_cpu_sys || 0
        };
    }

    async getHealthStatus() {
        if (!this.isConnected) {
            return {
                status: 'disconnected',
                message: 'Redis is not connected',
                lastError: this.stats.lastError?.message
            };
        }

        try {
            const info = await this.client.info();
            const metrics = this.parseRedisInfo(info);
            const health = await performanceMonitor.checkHealth();

            return {
                status: health.status,
                metrics: metrics,
                stats: this.stats,
                memory: {
                    used: metrics.used_memory,
                    peak: metrics.used_memory_peak
                },
                uptime: metrics.uptime_in_seconds,
                operations: {
                    total: this.stats.operations,
                    errors: this.stats.errors,
                    success_rate: ((this.stats.operations - this.stats.errors) / this.stats.operations * 100).toFixed(2)
                }
            };
        } catch (error) {
            redisLogger.error('Health check failed:', error);
            return {
                status: 'error',
                message: 'Failed to get Redis health status',
                error: error.message
            };
        }
    }

    async set(key, value, expireSeconds = null) {
        try {
            const client = await this.getClient();
            if (client) {
                if (expireSeconds) {
                    await client.setex(key, expireSeconds, JSON.stringify(value));
                } else {
                    await client.set(key, JSON.stringify(value));
                }
            } else {
                await localStorageFallback.set(key, value, expireSeconds);
            }
            return true;
        } catch (error) {
            redisLogger.error('Redis set error:', error);
            return await localStorageFallback.set(key, value, expireSeconds);
        }
    }

    async get(key) {
        try {
            const client = await this.getClient();
            if (client) {
                const value = await client.get(key);
                return value ? JSON.parse(value) : null;
            } else {
                return await localStorageFallback.get(key);
            }
        } catch (error) {
            redisLogger.error('Redis get error:', error);
            return await localStorageFallback.get(key);
        }
    }

    async del(key) {
        try {
            const client = await this.getClient();
            if (!client) {
                return await localStorageFallback.del(key);
            }
            await client.del(key);
            return true;
        } catch (error) {
            redisLogger.error('Redis del error:', error);
            return await localStorageFallback.del(key);
        }
    }

    async exists(key) {
        try {
            const client = await this.getClient();
            if (!client) {
                return await localStorageFallback.exists(key);
            }
            return await client.exists(key);
        } catch (error) {
            redisLogger.error('Redis exists error:', error);
            return await localStorageFallback.exists(key);
        }
    }
}

export const redisManager = new RedisManager();
export default redisManager;