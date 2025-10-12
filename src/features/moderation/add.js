import logger from '../../utils/common/logger.js';

export default {
    name: 'add',
    description: 'Menambahkan anggota ke grup (Admin Only).',
    
    adminOnly: true,

    async execute(message, args) {
        try {
            const chat = await message.getChat();

            if (!chat.isGroup) {
                return message.reply('❌ Perintah ini hanya bisa digunakan di dalam grup.');
            }

            const numberToAdd = args[0];
            if (!numberToAdd || !/^\d+$/.test(numberToAdd)) {
                return message.reply('⚠️ Format salah. Gunakan: /add <nomorhp>\nContoh: /add 08123456789');
            }

            let normalizedNumber = numberToAdd.replace(/\D/g, '');
            if (normalizedNumber.startsWith('0')) {
                normalizedNumber = '62' + normalizedNumber.substring(1);
            }
            const userId = `${normalizedNumber}@c.us`;

            const response = await chat.addParticipants([userId]);

            const result = response[userId];
            
            if (result.code === 200) {
                 logger.info(`User ${userId} was added to group ${chat.name} by ${message.from}.`);
                 await message.reply(`Berhasil menambahkan ${normalizedNumber} ke grup.`);
            } else if (result.code === 403) {
                 await message.reply(`❌ Gagal menambahkan ${normalizedNumber}. Pengguna tersebut mungkin mengaktifkan setelan privasi grup atau nomornya salah.`);
            } else if (result.code === 404) {
                 await message.reply(`❌ Gagal menambahkan ${normalizedNumber}. Nomor tidak terdaftar di WhatsApp.`);
            } else {
                 logger.warn(`Failed to add ${userId} with code ${result.code} and message: ${result.message}`);
                 await message.reply(`❌ Gagal menambahkan ${normalizedNumber}. Kode error: ${result.code || 'Tidak diketahui'}.`);
            }

        } catch (error) {
            logger.error(`Error on /add command:`, error);
            await message.reply('❌ Gagal menambahkan anggota. Pastikan bot adalah admin dan nomor yang dimasukkan valid.');
        }
    }
};