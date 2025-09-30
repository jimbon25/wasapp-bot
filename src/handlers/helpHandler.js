import { getAvailableColors } from '../utils/common/colorMap.js';

export class HelpHandler {
    constructor() {
        this.commandRegex = /^\/help$/i;
    }

    /**
     * Checks if message is a help command
     * @param {Message} message - WhatsApp message object
     * @returns {boolean}
     */
    isHelpCommand(message) {
        return this.commandRegex.test(message.body.trim());
    }

    /**
     * Generate help message for all commands
     * @returns {string}
     */
    generateHelpMessage() {
        const commands = [
            {
                name: '📷 Remove Background',
                command: '/rmbg [warna]',
                description: 'Menghapus background dari gambar. Kirim gambar dengan caption /rmbg',
                examples: [
                    '/rmbg - Background menjadi transparan',
                    '/rmbg red - Background menjadi merah',
                    '/rmbg blue - Background menjadi biru'
                ],
                note: `Warna yang tersedia: ${getAvailableColors().join(', ')}`
            }
            // Tambahkan command lain di sini
        ];

        let message = '🤖 *DAFTAR PERINTAH BOT*\n\n';

        commands.forEach(cmd => {
            message += `*${cmd.name}*\n`;
            message += `Command: \`${cmd.command}\`\n`;
            message += `${cmd.description}\n\n`;
            
            if (cmd.examples) {
                message += '*Contoh:*\n';
                cmd.examples.forEach(example => {
                    message += `\`${example}\`\n`;
                });
                message += '\n';
            }

            if (cmd.note) {
                message += `*Note:* ${cmd.note}\n`;
            }

            message += '\n';
        });

        message += '💡 Ketik /help untuk melihat daftar perintah ini lagi';
        return message;
    }

    /**
     * Handle the help command
     * @param {Message} message - WhatsApp message object
     */
    async handleCommand(message) {
        try {
            const helpMessage = this.generateHelpMessage();
            await message.reply(helpMessage);
        } catch (error) {
            console.error('Error in HelpHandler:', error);
            await message.reply('Maaf, terjadi kesalahan saat menampilkan bantuan 🙏');
        }
    }
}

export default new HelpHandler();