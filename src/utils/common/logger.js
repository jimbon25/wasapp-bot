import fs from 'fs';
import path from 'path';
import TelegramNotifier from './telegramNotifier.js';
import config from '../../config.js';

class Logger {
    constructor() {
        this.logsDir = config.app.logDir;
        this.logFile = path.join(this.logsDir, 'bot.log');
        this.errorLogFile = path.join(this.logsDir, 'wabot-error.log');
        this.maxSize = 5 * 1024 * 1024;
        this.maxFiles = 5;
        
        this.telegram = new TelegramNotifier({
            botToken: config.telegram.botToken,
            chatId: config.telegram.chatId,
            enabled: config.telegram.enabled,
            environment: config.app.environment
        });
        
        this.notifyLevels = config.telegram.notifyLevels;
        
        this.ensureLogFile();
    }

    ensureLogFile() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true, mode: 0o777 });
        }
        if (!fs.existsSync(this.logFile)) {
            fs.writeFileSync(this.logFile, '', { mode: 0o666 });
        }
        if (!fs.existsSync(this.errorLogFile)) {
            fs.writeFileSync(this.errorLogFile, '', { mode: 0o666 });
        }
    }

    async rotateIfNeeded() {
        try {
            const stats = fs.statSync(this.logFile);
            if (stats.size >= this.maxSize) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const rotatedFile = path.join(this.logsDir, `bot-${timestamp}.log`);
                
                fs.renameSync(this.logFile, rotatedFile);
                
                fs.writeFileSync(this.logFile, '');
                
                const files = fs.readdirSync(this.logsDir)
                    .filter(f => f.startsWith('bot-') && f.endsWith('.log'))
                    .sort()
                    .reverse();
                
                if (files.length > this.maxFiles) {
                    for (const file of files.slice(this.maxFiles)) {
                        fs.unlinkSync(path.join(this.logsDir, file));
                    }
                }
            }
        } catch (error) {
            console.error('Error rotating log file:', error);
        }
    }

    formatMessage(level, message, error = null) {
        const timestamp = new Date().toISOString();
        let logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        if (error) {
            logMessage += `\nError Details: ${error.stack || error}`;
        }
        return logMessage + '\n';
    }

    async writeLog(message, isError = false) {
        await this.rotateIfNeeded();
        fs.appendFileSync(this.logFile, message);
        if (isError) {
            fs.appendFileSync(this.errorLogFile, message);
        }
    }

    async info(message) {
        const logMessage = this.formatMessage('info', message);
        console.log(`ℹ️ ${message}`);
        await this.writeLog(logMessage);
        
        if (this.notifyLevels.includes('info')) {
            await this.telegram.info(message);
        }
    }

    async warn(message) {
        const logMessage = this.formatMessage('warn', message);
        console.warn(`⚠️ ${message}`);
        await this.writeLog(logMessage, true);
        
        if (this.notifyLevels.includes('warn')) {
            await this.telegram.warn(message);
        }
    }

    async error(message, error = null) {
        const messageText = typeof message === 'object' ? 
            JSON.stringify(message) : 
            message;
            
        const logMessage = this.formatMessage('error', messageText, error);
        console.error(`✗ ${messageText}`);
        if (error) {
            console.error(error);
        }
        await this.writeLog(logMessage, true);
        
        if (this.notifyLevels.includes('error')) {
            await this.telegram.error(message, error);
        }
    }
}

export default new Logger();