import logger from '../src/utils/logger.js';

async function testTelegramNotifications() {
    console.log('🧪 Starting Telegram notification tests...\n');

    try {
        // Test 1: Simple error message
        console.log('Test 1: Simple error message');
        await logger.error('Test error message from WhatsApp Bot');
        console.log('✓ Sent simple error message\n');

        // Test 2: Error with stack trace
        console.log('Test 2: Error with stack trace');
        const error = new Error('Test error with stack trace');
        await logger.error('Complex error occurred', error);
        console.log('✓ Sent error with stack trace\n');

        // Test 3: Warning message
        console.log('Test 3: Warning message');
        await logger.warn('Test warning message from WhatsApp Bot');
        console.log('✓ Sent warning message\n');

        // Test 4: Info message (might not be sent if not in TELEGRAM_NOTIFY_LEVELS)
        console.log('Test 4: Info message');
        await logger.info('Test info message from WhatsApp Bot');
        console.log('✓ Attempted to send info message\n');

        // Test 5: Simulated runtime error
        console.log('Test 5: Simulated runtime error');
        try {
            throw new Error('Simulated runtime error for testing');
        } catch (err) {
            await logger.error('Runtime error occurred', err);
        }
        console.log('✓ Sent simulated runtime error\n');

        // Test 6: Long message test
        console.log('Test 6: Long message test');
        const longMessage = 'This is a very long error message '.repeat(20) + 
                          'to test how Telegram handles message formatting and line breaks';
        await logger.error(longMessage);
        console.log('✓ Sent long message\n');

        console.log(' All test messages sent successfully!');
        console.log('Please check your Telegram chat/group to verify the notifications.');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the tests
testTelegramNotifications().catch(console.error);