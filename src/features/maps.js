import mapsService from '../services/infoServices/mapsService.js';
import logger from '../utils/common/logger.js';

export default {
    name: 'maps',
    description: 'Mencari lokasi terdekat. Contoh: /maps coffee shop',
    async execute(message, args) {
        try {
            if (message.location) {
                await mapsService.saveUserLocation(
                    message.from,
                    message.location.latitude,
                    message.location.longitude
                );
                return;
            }

            if (!args || args.length === 0) {
                return message.reply(
                    'Silakan masukkan kata kunci pencarian.\n\n' +
                    '*Contoh Pencarian Terdekat:*\n/maps coffee shop\n\n' +
                    '*Contoh Pencarian di Lokasi Spesifik:*\n/maps monas, jakarta\n\n' +
                    '*Tips:* Kirim lokasi Anda untuk pencarian terdekat yang lebih akurat!'
                );
            }

            const keyword = args.join(' ');
            const response = await mapsService.search(keyword, message.from);
            return message.reply(response);

        } catch (error) {
            logger.error('Error in maps command:', error);
            return message.reply('Maaf, terjadi kesalahan. Silakan coba lagi nanti.');
        }
    }
};