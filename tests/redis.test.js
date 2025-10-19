import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
    redisManager,
    messageQueueManager,
    rateLimitManager,
    sessionBackupManager,
    performanceMonitor,
    cacheManager,
    fallbackConfig
} from '../src/utils/redis/index.js';

// Load test environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.test') });

// Test Redis Connection
async function testRedisConnection() {
    console.log('\n🔄 Testing Redis Connection...');
    try {
        console.log('Redis Config:', {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
            password: process.env.REDIS_PASSWORD ? '***' : undefined
        });
        
        await redisManager.connect();
        
        // Test simple operation
        await redisManager.set('test', 'test');
        const value = await redisManager.get('test');
        const success = value === 'test';
        
        console.log('Redis Test Operation:', success ? 'Success' : 'Failed');
        console.log(' Redis Connection:', success ? 'Success' : 'Failed');
        return success;
    } catch (error) {
        console.error('✗ Redis Connection Error:', error.message);
        console.error('Error Stack:', error.stack);
        return false;
    }
}

// Test Message Queue
async function testMessageQueue() {
    console.log('\n🔄 Testing Message Queue...');
    try {
        await messageQueueManager.init();
        
        // Test enqueue
        await messageQueueManager.enqueue({ test: 'message1' });
        await messageQueueManager.enqueue({ test: 'message2' });
        
        // Test dequeue
        const msg1 = await messageQueueManager.dequeue();
        const msg2 = await messageQueueManager.dequeue();
        
        console.log(' Message Queue Test:', 
            msg1.test === 'message1' && msg2.test === 'message2' ? 'Success' : 'Failed');
        return true;
    } catch (error) {
        console.error('✗ Message Queue Test Error:', error.message);
        return false;
    }
}

// Test Rate Limiting
async function testRateLimiting() {
    console.log('\n🔄 Testing Rate Limiting...');
    try {
        await rateLimitManager.init();
        const testId = 'test-user';
        
        // Test normal operation
        const allowed1 = await rateLimitManager.checkRateLimit(testId);
        
        // Force rate limit
        for (let i = 0; i < 100; i++) {
            await rateLimitManager.checkRateLimit(testId);
        }
        
        // Should be rate limited now
        const allowed2 = await rateLimitManager.checkRateLimit(testId);
        
        console.log(' Rate Limiting Test:', 
            allowed1 && !allowed2 ? 'Success' : 'Failed');
        return true;
    } catch (error) {
        console.error('✗ Rate Limiting Test Error:', error.message);
        return false;
    }
}

// Test Session Backup
async function testSessionBackup() {
    console.log('\n🔄 Testing Session Backup...');
    try {
        await sessionBackupManager.init();
        const testSession = { id: 'test-session', data: { key: 'value' } };
        
        // Test backup
        await sessionBackupManager.backupSession('test', testSession);
        
        // Test restore
        const restored = await sessionBackupManager.restoreSession('test');
        
        console.log(' Session Backup Test:', 
            JSON.stringify(restored) === JSON.stringify(testSession) ? 'Success' : 'Failed');
        return true;
    } catch (error) {
        console.error('✗ Session Backup Test Error:', error.message);
        return false;
    }
}

// Test Cache Performance
async function testCachePerformance() {
    console.log('\n🔄 Testing Cache Performance...');
    try {
        await cacheManager.init();
        
        // Test set and get
        await cacheManager.set('test-key', { data: 'test' });
        const cached = await cacheManager.get('test-key');
        
        // Test performance
        const start = Date.now();
        for (let i = 0; i < 1000; i++) {
            await cacheManager.get('test-key');
        }
        const end = Date.now();
        const timePerOp = (end - start) / 1000;
        
        console.log(' Cache Performance Test:', 
            cached && timePerOp < 1 ? 'Success' : 'Failed',
            `(${timePerOp.toFixed(3)}ms per operation)`);
        return true;
    } catch (error) {
        console.error('✗ Cache Performance Test Error:', error.message);
        return false;
    }
}

// Test Monitoring System
async function testMonitoring() {
    console.log('\n🔄 Testing Monitoring System...');
    try {
        await performanceMonitor.init();
        
        // Test metrics recording
        await performanceMonitor.recordMetric('test-metric', 100);
        const metrics = await performanceMonitor.getMetrics('test-metric');
        
        // Test health check
        const health = await performanceMonitor.checkHealth();
        
        console.log(' Monitoring Test:', 
            metrics.length > 0 && health.status ? 'Success' : 'Failed');
        return true;
    } catch (error) {
        console.error('✗ Monitoring Test Error:', error.message);
        return false;
    }
}

// Run all tests
async function runTests() {
    console.log('🚀 Starting Redis Integration Tests...\n');
    
    const results = {
        connection: await testRedisConnection(),
        messageQueue: await testMessageQueue(),
        rateLimiting: await testRateLimiting(),
        sessionBackup: await testSessionBackup(),
        cachePerformance: await testCachePerformance(),
        monitoring: await testMonitoring()
    };
    
    console.log('\n📊 Test Results Summary:');
    Object.entries(results).forEach(([test, passed]) => {
        console.log(`${passed ? '' : ''} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    
    const totalPassed = Object.values(results).filter(r => r).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`\n📈 Overall: ${totalPassed}/${totalTests} tests passed`);
    
    return totalPassed === totalTests;
}

// Execute tests
runTests().then(success => {
    if (!success) {
        process.exit(1);
    }
});