import { checkAccountsHealth } from '../handlers/healthCheckHandler.js';

export default {
    name: 'healthcheck',
    adminOnly: true,
    async execute(message, args) {
        try {
            await message.reply('Mengecek kesehatan semua akun...');
            await checkAccountsHealth(message);
        } catch (error) {
            await message.reply('❌ Terjadi kesalahan saat mengecek kesehatan akun.');
        }
    }
};