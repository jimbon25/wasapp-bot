import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/common/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CommandHandler {
    constructor(securityManager) {
        this.commands = new Map();
        this.securityManager = securityManager;
        this.initCommands();
    }

    async initCommands() {
        await this.loadCommands();
    }

    async loadCommands() {
        try {
            await this.loadCommandsFromDirectory('../menu');
            await this.loadCommandsFromDirectory('../features');
        } catch (error) {
            logger.error('Failed to load commands', error);
        }
    }

    async loadCommandsFromDirectory(relativePath) {
        const absolutePath = path.join(__dirname, relativePath);
        if (!fs.existsSync(absolutePath)) {
            return;
        }

        const files = fs.readdirSync(absolutePath, { withFileTypes: true });
        for (const file of files) {
            const newRelativePath = path.join(relativePath, file.name);
            if (file.isDirectory()) {
                await this.loadCommandsFromDirectory(newRelativePath);
            } else if (file.name.endsWith('.js')) {
                try {
                    const commandModule = await import(path.join('file://', absolutePath, file.name));
                    const command = commandModule.default;
                    if (command && command.name && command.execute) {
                        this.commands.set(command.name, command);
                        logger.info(`Loaded command: ${command.name}`);
                    }
                } catch (error) {
                    logger.error(`Failed to load command from ${file.name}`, error);
                }
            }
        }
    }

    async handleMessage(message) {
        try {
            const content = message.body.toLowerCase().trim();
            if (!content.startsWith('/')) {
                return { handled: false, reason: 'not-command' };
            }

            const [commandName, ...args] = content.slice(1).split(' ');
            const command = this.commands.get(commandName);

            if (!command) {
                return { handled: false, reason: 'command-not-found' };
            }

            if (command.adminOnly) {
                const isAuthorized = await this.securityManager.isAuthorized(message, 'admin');
                if (!isAuthorized) {
                    const contact = await message.getContact();
                    logger.warn(`Unauthorized access attempt for admin command '${commandName}' by ${contact.id._serialized}`);
                    await message.reply('❌ Anda tidak memiliki izin untuk menggunakan perintah ini.');
                    return { handled: false, reason: 'unauthorized' };
                }
            }

            if (command.requiredPermissions) {
                for (const permission of command.requiredPermissions) {
                    const hasPermission = await this.securityManager.hasPermission(message, permission);
                    if (!hasPermission) {
                        const contact = await message.getContact();
                        logger.warn(`Permission denied for command '${commandName}' by ${contact.id._serialized} (missing: ${permission})`);
                        await message.reply('❌ Anda tidak memiliki izin yang diperlukan untuk perintah ini.');
                        return { handled: false, reason: 'permission-denied' };
                    }
                }
            }

            logger.info(`Executing command: ${commandName}`);
            await command.execute(message, args);
            return { handled: true, command: commandName };

        } catch (error) {
            logger.error('Error handling message', error);
            await message.reply('Maaf, terjadi kesalahan saat menjalankan perintah tersebut.');
            return { handled: false, reason: 'error', error: error.message };
        }
    }
}

let commandHandler;

export function initializeCommandHandler(securityManager) {
    commandHandler = new CommandHandler(securityManager);
    return commandHandler;
}

export { commandHandler };