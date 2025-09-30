import { cities } from '../data/constants/cities.js';
import prayerService from '../services/infoServices/prayerService.js';
import logger from '../utils/common/logger.js';
import securityManager from '../utils/systemService/securityManager.js';

export default {
    name: 'sholat',
    requiredPermissions: ['default'],
    async execute(message, args) {
        try {
            if (!args.length) {
                return message.reply(
                    'Silakan masukkan nama kota.\n' +
                    'Contoh: /sholat surabaya\n\n' +
                    'Kota yang tersedia:\n' +
                    Object.keys(cities).map(city => `- ${city}`).join('\n')
                );
            }

            const cityQuery = args[0].toLowerCase();
            const city = cities[cityQuery];

            if (!city) {
                return message.reply(
                    'Maaf, kota tidak ditemukan.\n' +
                    'Kota yang tersedia:\n' +
                    Object.keys(cities).map(city => `- ${city}`).join('\n')
                );
            }

            logger.info(`Getting prayer times for ${city.name}`);
            
            const queueResult = await securityManager.validateAndQueueMessage(
                message,
                async () => {
                    try {
                        const response = await prayerService.getPrayerTimes(city.code, city.name);
                        await message.reply(response);
                        return true;
                    } catch (error) {
                        logger.error('Error getting prayer times:', error);
                        throw error;
                    }
                }
            );

            if (!queueResult.allowed) {
                await message.reply(`⚠️ ${queueResult.reason}`);
            }

        } catch (error) {
            logger.error('Error in sholat command:', error);
            await message.reply('Maaf, terjadi kesalahan saat mengambil jadwal sholat. Silakan coba lagi nanti.');
        }
    }
};