import { MessageAnalyzer, VIRTEX_CONSTANTS } from '../src/utils/messageHandling/messageAnalyzer.js';
import { VirtexValidator } from '../src/utils/messageHandling/virtexValidator.js';

describe('MessageAnalyzer', () => {
    describe('countSpecialCharacters', () => {
        test('should count emoji correctly', () => {
            expect(MessageAnalyzer.countSpecialCharacters('Hello 👋')).toBe(1);
            expect(MessageAnalyzer.countSpecialCharacters('🌟✨💫')).toBe(3);
        });

        test('should handle normal text', () => {
            expect(MessageAnalyzer.countSpecialCharacters('Hello World')).toBe(0);
        });
    });

    describe('hasRepeatedCharacters', () => {
        test('should detect repeated characters', () => {
            expect(MessageAnalyzer.hasRepeatedCharacters('aaaaaaaaaaaaa')).toBe(true);
            expect(MessageAnalyzer.hasRepeatedCharacters('Hello')).toBe(false);
        });
    });
});

describe('VirtexDetection', () => {
    const mockMessages = {
        normal: 'Hello, how are you?',
        longMessage: 'a'.repeat(1500),
        emojiSpam: '😀'.repeat(100),
        repeatedChars: 'x'.repeat(20),
        virtexExample: '᭫'.repeat(50) + '҈'.repeat(50)
    };

    let validator;

    beforeEach(() => {
        validator = new VirtexValidator();
    });

    test('should pass normal messages', () => {
        const result = validator.validateMessage(mockMessages.normal);
        expect(result.isVirtex).toBe(false);
    });

    test('should detect long messages', () => {
        const result = validator.validateMessage(mockMessages.longMessage);
        expect(result.isVirtex).toBe(true);
        expect(result.reasons).toContain(`Message too long`);
    });

    test('should detect emoji spam', () => {
        const result = validator.validateMessage(mockMessages.emojiSpam);
        expect(result.isVirtex).toBe(true);
        expect(result.reasons).toContain('Too many special characters');
    });

    test('should detect repeated characters', () => {
        const result = validator.validateMessage(mockMessages.repeatedChars);
        expect(result.isVirtex).toBe(true);
        expect(result.reasons).toContain('Suspicious character repetition');
    });

    test('should detect virtex patterns', () => {
        const result = validator.validateMessage(mockMessages.virtexExample);
        expect(result.isVirtex).toBe(true);
    });
});