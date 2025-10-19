import fetch from 'node-fetch';

class TelegramNotifier {
    constructor(config) {
        this.botToken = config.botToken;
        this.chatId = config.chatId;
        this.enabled = config.enabled || false;
        this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
        this.environment = config.environment || 'development';
    }

    async sendMessage(message) {
        if (!this.enabled) return;

        try {
            const formattedMessage = this.formatMessage(message);
            const url = `${this.baseUrl}/sendMessage`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: this.chatId,
                    text: formattedMessage,
                    parse_mode: 'MarkdownV2',
                    disable_web_page_preview: true
                })
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('Failed to send Telegram notification:', error);
            }
        } catch (error) {
            console.error('Error sending Telegram notification:', error);
        }
    }

    formatMessage(message) {
        const timestamp = new Date().toISOString();
        const envInfo = this.environment.toUpperCase();
        
        const header = this.escapeMarkdown(
            `🤖 *WhatsApp Bot Alert*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `⚡ *Environment:* ${envInfo}\n` +
            `🕒 *Time:* ${timestamp}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📝 *Message:*\n`
        );

        return `${header}${message}`;
    }

    escapeMarkdown(text) {
        return text
            .replace(/([_*\[\]()~`>#+=|{}.!-])/g, '\\$1')
            .replace(/\\\n/g, '\n')
            .replace(/\\([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '$1');
    }

    async error(message, error = null) {
        const errorTitle = this.escapeMarkdown('✗ ERROR');
        const errorMsg = this.escapeMarkdown(message);
        let formattedMessage = `${errorTitle}\n${errorMsg}`;
        
        if (error) {
            const stackTrace = this.escapeMarkdown(error.stack || error.toString());
            formattedMessage += `\n\n${this.escapeMarkdown('Stack Trace:')}\n\`\`\`\n${stackTrace}\n\`\`\``;
        }
        
        await this.sendMessage(formattedMessage);
    }

    async warn(message) {
        const warningTitle = this.escapeMarkdown('⚠️ WARNING');
        const warningMsg = this.escapeMarkdown(message);
        await this.sendMessage(`${warningTitle}\n${warningMsg}`);
    }

    async info(message) {
        const infoTitle = this.escapeMarkdown('ℹ️ INFO');
        const infoMsg = this.escapeMarkdown(message);
        await this.sendMessage(`${infoTitle}\n${infoMsg}`);
    }
}

export default TelegramNotifier;