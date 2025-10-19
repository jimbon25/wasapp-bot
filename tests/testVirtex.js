import { VirtexValidator } from '../src/utils/messageHandling/virtexValidator.js';

// Test cases
const testCases = [
    {
        name: 'Normal Message',
        input: 'Hello, how are you?',
        expectVirtex: false
    },
    {
        name: 'Long Message',
        input: 'a'.repeat(1500),
        expectVirtex: true
    },
    {
        name: 'Emoji Spam',
        input: '😀'.repeat(100),
        expectVirtex: true
    },
    {
        name: 'Character Repetition',
        input: 'x'.repeat(20),
        expectVirtex: true
    },
    {
        name: 'Virtex Pattern',
        input: '᭫'.repeat(50) + '҈'.repeat(50),
        expectVirtex: true
    }
];

// Run tests
console.log('🧪 Running Virtex Detection Tests...\n');

const validator = new VirtexValidator();
let passed = 0;
let failed = 0;

for (const test of testCases) {
    const result = validator.validateMessage(test.input);
    const success = result.isVirtex === test.expectVirtex;
    
    if (success) {
        passed++;
        console.log(` ${test.name}: PASSED`);
    } else {
        failed++;
        console.log(`✗ ${test.name}: FAILED`);
        console.log('Expected:', test.expectVirtex ? 'virtex' : 'not virtex');
        console.log('Got:', result.isVirtex ? 'virtex' : 'not virtex');
        if (result.reasons) console.log('Reasons:', result.reasons);
    }
    console.log('');
}

console.log('📊 Test Summary:');
console.log(`Total Tests: ${testCases.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

// Exit with appropriate code
process.exit(failed > 0 ? 1 : 0);