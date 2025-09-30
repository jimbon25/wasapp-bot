import logger from '../../utils/common/logger.js';
import config from '../../config.js';

const cache = new Map();

/**
 * Service for handling prayer times functionality
 */
class PrayerService {
    constructor() {
        this.baseUrl = config.app.prayer.apiUrl;
        this.cacheDuration = config.app.prayer.cacheDuration * 1000; // Convert seconds to milliseconds
    }

    /**
     * Get cached data if available and not expired
     */
    getCachedData(key) {
        if (cache.has(key)) {
            const { data, timestamp } = cache.get(key);
            if (Date.now() - timestamp < this.cacheDuration) {
                return data;
            }
            cache.delete(key); // Remove expired cache
        }
        return null;
    }

    /**
     * Cache data with timestamp
     */
    setCacheData(key, data) {
        cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Format prayer times response
     */
    formatPrayerTimes(data, cityName) {
        const { jadwal } = data;
        const date = new Date(jadwal.date).toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        return `*Jadwal Sholat ${cityName}*
📅 ${date}

🌅 Subuh: ${jadwal.subuh}
🌄 Terbit: ${jadwal.terbit}
☀️ Dzuhur: ${jadwal.dzuhur}
🌅 Ashar: ${jadwal.ashar}
🌆 Maghrib: ${jadwal.maghrib}
🌃 Isya: ${jadwal.isya}

_Data dari MyQuran.com_`;
    }

    /**
     * Get prayer times for a specific city
     */
    async getPrayerTimes(cityCode, cityName) {
        try {
            const cacheKey = `prayer_${cityCode}_${new Date().toISOString().split('T')[0]}`;
            const cachedData = this.getCachedData(cacheKey);
            if (cachedData) {
                return this.formatPrayerTimes(cachedData, cityName);
            }

            const currentYear = new Date().getFullYear();
            const year = currentYear > 2024 ? 2024 : currentYear;
            const month = String(new Date().getMonth() + 1).padStart(2, '0');
            const date = String(new Date().getDate()).padStart(2, '0');
            const url = `${this.baseUrl}/jadwal/${cityCode}/${year}/${month}/${date}`;
            
            logger.info(`Fetching prayer times from: ${url}`);
            
            let response;
            let retries = 3;
            let lastError = null;
            
            while (retries > 0) {
                try {
                    response = await fetch(url, {
                        timeout: 5000,
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'WhatsApp-Bot/1.0'
                        }
                    });
                    
                    if (response.status === 404 || (response.status >= 400 && response.status < 500)) {
                        const errorBody = await response.json();
                        throw new Error(`DATA_NOT_FOUND: ${errorBody.message || 'Data tidak tersedia'}`);
                    }
                    
                    if (response.ok) break;
                    
                    const errorText = await response.text();
                    lastError = new Error(`API_ERROR: ${response.status} - ${errorText}`);
                    logger.warn(`API attempt failed (${retries} retries left): ${response.status}`, {
                        error: errorText,
                        url: url
                    });
                    
                    if (response.status >= 500) {
                        retries--;
                        if (retries > 0) await new Promise(r => setTimeout(r, 2000 * (4 - retries))); // Exponential backoff
                    } else {
                        break;
                    }
                } catch (error) {
                    lastError = error;
                    if (error.name === 'AbortError' || error.name === 'TypeError') {
                        logger.warn(`Network error (${retries} retries left):`, {
                            error: error.message,
                            type: error.name
                        });
                        retries--;
                        if (retries > 0) await new Promise(r => setTimeout(r, 2000 * (4 - retries)));
                    } else {
                        break;
                    }
                }
            }
            
            if (!response?.ok) {
                const errorMessage = lastError?.message || 'Unknown error occurred';
                logger.error(`Prayer API Error:`, {
                    error: errorMessage,
                    status: response?.status,
                    url: url
                });
                throw lastError || new Error('SERVICE_ERROR: Layanan tidak tersedia');
            }
            
            const data = await response.json();
            
            logger.info(`API Response: ${JSON.stringify(data)}`);
            
            if (data.status === true) {
                if (!data.data || !data.data.jadwal) {
                    throw new Error('Invalid response format from API');
                }
                this.setCacheData(cacheKey, data.data);
                return this.formatPrayerTimes({
                    jadwal: data.data.jadwal,
                    date: `${year}-${month}-${date}`
                }, cityName);
            } else {
                throw new Error(data.message || 'Failed to get prayer times');
            }
        } catch (error) {
            logger.error('Error fetching prayer times:', error);
            
            if (error.message.startsWith('DATA_NOT_FOUND:')) {
                throw new Error('Maaf, jadwal sholat untuk kota dan tanggal tersebut belum tersedia. Coba gunakan tanggal yang lebih dekat.');
            } else if (error.message.startsWith('API_ERROR:')) {
                if (error.message.includes('500')) {
                    throw new Error('Maaf, server jadwal sholat sedang bermasalah. Silakan coba lagi dalam beberapa menit.');
                } else {
                    throw new Error('Maaf, terjadi kesalahan saat mengakses layanan jadwal sholat. Mohon coba lagi nanti.');
                }
            } else if (error.message.includes('Invalid response format')) {
                throw new Error('Maaf, terjadi kesalahan format data dari server. Tim kami akan memperbaikinya.');
            } else if (error.name === 'AbortError') {
                throw new Error('Maaf, server jadwal sholat tidak merespons. Silakan coba lagi.');
            } else if (error.name === 'TypeError') {
                throw new Error('Maaf, gagal terhubung ke server jadwal sholat. Mohon periksa koneksi internet Anda.');
            } else {
                throw new Error('Maaf, terjadi kesalahan saat mengambil jadwal sholat. Silakan coba lagi nanti.');
            }
        }
    }
}

const prayerService = new PrayerService();
export default prayerService;