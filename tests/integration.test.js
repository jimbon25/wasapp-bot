const { commandHandler, SecurityManager } = require('./__mocks__/mockHandlers.js');

// Mock Message object
const createMockMessage = (body, from = '1234567890') => ({
    body,
    from,
    reply: jest.fn()
});

describe('Command Handler Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should handle non-command messages correctly', async () => {
        const message = createMockMessage('Hello world');
        const result = await commandHandler.handleMessage(message);
        expect(result).toEqual({ handled: false, reason: 'not-command' });
    });

    test('should handle unknown commands correctly', async () => {
        const message = createMockMessage('/unknowncommand');
        const result = await commandHandler.handleMessage(message);
        expect(result).toEqual({ handled: false, reason: 'command-not-found' });
    });

    test('should handle unauthorized admin commands correctly', async () => {
        // Mock SecurityManager.isAuthorized to return false
        jest.spyOn(SecurityManager, 'isAuthorized').mockResolvedValue(false);

        const message = createMockMessage('/admincommand', 'non-admin-user');
        const mockCommand = {
            name: 'admincommand',
            adminOnly: true,
            execute: jest.fn()
        };

        // Temporarily add mock command
        commandHandler.commands.set('admincommand', mockCommand);
        
        const result = await commandHandler.handleMessage(message);
        expect(result).toEqual({ handled: false, reason: 'unauthorized' });
        expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('tidak memiliki izin'));
        expect(mockCommand.execute).not.toHaveBeenCalled();

        // Clean up
        commandHandler.commands.delete('admincommand');
    });

    test('should handle permission checks correctly', async () => {
        // Mock SecurityManager methods
        jest.spyOn(SecurityManager, 'hasPermission').mockResolvedValue(false);

        const message = createMockMessage('/restrictedcommand', 'regular-user');
        const mockCommand = {
            name: 'restrictedcommand',
            requiredPermissions: ['special-permission'],
            execute: jest.fn()
        };

        // Temporarily add mock command
        commandHandler.commands.set('restrictedcommand', mockCommand);
        
        const result = await commandHandler.handleMessage(message);
        expect(result).toEqual({ handled: false, reason: 'permission-denied' });
        expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('tidak memiliki izin'));
        expect(mockCommand.execute).not.toHaveBeenCalled();

        // Clean up
        commandHandler.commands.delete('restrictedcommand');
    });

    test('should handle command execution errors gracefully', async () => {
        const message = createMockMessage('/errorcommand');
        const mockCommand = {
            name: 'errorcommand',
            execute: jest.fn().mockRejectedValue(new Error('Test error'))
        };

        // Temporarily add mock command
        commandHandler.commands.set('errorcommand', mockCommand);
        
        const result = await commandHandler.handleMessage(message);
        expect(result).toEqual({
            handled: false,
            reason: 'error',
            error: 'Test error'
        });
        expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('terjadi kesalahan'));

        // Clean up
        commandHandler.commands.delete('errorcommand');
    });

    test('should execute authorized commands successfully', async () => {
        // Mock SecurityManager methods
        jest.spyOn(SecurityManager, 'hasPermission').mockResolvedValue(true);
        jest.spyOn(SecurityManager, 'isAuthorized').mockResolvedValue(true);

        const message = createMockMessage('/testcommand arg1 arg2');
        const mockCommand = {
            name: 'testcommand',
            requiredPermissions: ['test-permission'],
            execute: jest.fn().mockResolvedValue(undefined)
        };

        // Temporarily add mock command
        commandHandler.commands.set('testcommand', mockCommand);
        
        const result = await commandHandler.handleMessage(message);
        expect(result).toEqual({ handled: true, command: 'testcommand' });
        expect(mockCommand.execute).toHaveBeenCalledWith(message, ['arg1', 'arg2']);

        // Clean up
        commandHandler.commands.delete('testcommand');
    });
});