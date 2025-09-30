import axios from 'axios';
import logger from '../../utils/common/logger.js';
import config from '../../config.js';
import { redisManager } from '../../utils/redis/index.js';
import dataSessionManager from '../../utils/sessionsManagement/dataSessionManager.js';

const KEYWORD_TO_TAG_MAP = config.services.maps.keywords;


class MapsService {
    constructor() {
        this.overpassConfig = config.maps.overpass;
        this.nominatimConfig = config.maps.nominatim;
        this.cacheConfig = config.maps.locationCache;

        if (!KEYWORD_TO_TAG_MAP) {
            throw new Error('Maps keywords configuration is missing in config.js');
        }
    }

    /**
     * Get user's last known location from cache
     */
    async getUserLocation(userId) {
        try {
            const sessionLocation = await dataSessionManager.getFromCache('maps', `user-location-${userId}`);
            if (sessionLocation) {
                return sessionLocation;
            }

            const client = await redisManager.getClient();
            const locationKey = `location:${userId}`;
            const location = await client.get(locationKey);
            return location ? JSON.parse(location) : null;
        } catch (error) {
            logger.error('Error getting user location:', error);
            return null;
        }
    }

    /**
     * Save user's location to cache
     */
    async saveUserLocation(userId, latitude, longitude) {
        try {
            const locationData = { latitude, longitude };
            await dataSessionManager.saveToCache('maps', `user-location-${userId}`, locationData, this.cacheConfig.ttl * 1000);

            const client = await redisManager.getClient();
            if (client) {
                const locationKey = `location:${userId}`;
                await client.set(locationKey, JSON.stringify(locationData), 'EX', this.cacheConfig.ttl);
            }
            return true;
        } catch (error) {
            logger.error('Error saving user location:', error);
            return false;
        }
    }

    /**
     * Search places using Overpass API with improved tag-based logic
     */
    async searchWithOverpass(keyword, latitude, longitude) {
        const lowerKeyword = keyword.toLowerCase();
        let searchCriteria = [];

        for (const [key, tags] of Object.entries(KEYWORD_TO_TAG_MAP)) {
            if (lowerKeyword.includes(key)) {
                searchCriteria = tags;
                break;
            }
        }

        if (searchCriteria.length === 0) {
            logger.warn(`No specific tag mapping found for keyword: "${keyword}". Overpass search will be skipped.`);
            return null;
        }

        const queryParts = searchCriteria.map(criterion => {
            let tagsString = `["${criterion.key}"="${criterion.value}"]`;
            if (criterion.additionalTags) {
                for (const [addKey, addValue] of Object.entries(criterion.additionalTags)) {
                    tagsString += `["${addKey}"="${addValue}"]`;
                }
            }
            const around = `(around:${this.overpassConfig.searchRadius},${latitude},${longitude});`;
            return `node${tagsString}${around}
                    way${tagsString}${around}
                    relation${tagsString}${around}`;
        }).join('');

        const query = `
            [out:json][timeout:${this.overpassConfig.timeout}];
            (
                ${queryParts}
            );
            out body center;
        `;

        try {
            const response = await axios.post(this.overpassConfig.apiUrl, query, {
                timeout: this.overpassConfig.timeout,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            if (!response.data || !response.data.elements || response.data.elements.length === 0) {
                return null;
            }

            return response.data.elements
                .filter(element => element.tags && element.tags.name)
                .map(element => {
                    const lat = element.lat || (element.center && element.center.lat);
                    const lon = element.lon || (element.center && element.center.lon);
                    
                    let address = element.tags['addr:street'] || '';
                    if (element.tags['addr:housenumber']) {
                        address = `${element.tags['addr:housenumber']} ${address}`;
                    }
                    
                    let type = '';
                    if (element.tags.amenity) type = element.tags.amenity.replace(/_/g, ' ');
                    else if (element.tags.shop) type = element.tags.shop.replace(/_/g, ' ');
                    
                    return {
                        name: element.tags.name,
                        address: address,
                        type: type,
                        cuisine: element.tags.cuisine,
                        opening_hours: element.tags.opening_hours,
                        phone: element.tags.phone,
                        website: element.tags.website,
                        latitude: lat,
                        longitude: lon
                    };
                })
                .filter(place => place.latitude && place.longitude)
                .slice(0, this.nominatimConfig.limit);
        } catch (error) {
            logger.error('Overpass API error:', error);
            return null;
        }
    }

    /**
     * Search places using Nominatim API
     */
    async searchWithNominatim(keyword, latitude, longitude) {
        try {
            const response = await axios.get(this.nominatimConfig.apiUrl, {
                params: {
                    q: keyword,
                    format: 'json',
                    limit: this.nominatimConfig.limit,
                    addressdetails: 1,
                    viewbox: `${longitude - 0.1},${latitude + 0.1},${longitude + 0.1},${latitude - 0.1}`,
                    bounded: 1
                },
                timeout: this.nominatimConfig.timeout,
                headers: { 'User-Agent': this.nominatimConfig.userAgent }
            });

            if (!response.data || response.data.length === 0) {
                return null;
            }

            return response.data.map(place => ({
                name: place.display_name.split(',')[0],
                address: place.display_name,
                latitude: parseFloat(place.lat),
                longitude: parseFloat(place.lon)
            }));
        } catch (error) {
            logger.error('Nominatim API error:', error);
            return null;
        }
    }

    /**
     * Format location results into a readable message
     */
    formatResults(results) {
        if (!results || results.length === 0) {
            return 'Tidak ada lokasi yang ditemukan. Coba kata kunci lain (misal: kopi, masjid, atm) atau kirim lokasi Anda untuk pencarian yang lebih akurat.';
        }

        const formattedResults = results.map((place, index) => {
            const mapLink = `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=18/${place.latitude}/${place.longitude}`;
            let details = [];
            
            if (place.type) details.push(place.type.charAt(0).toUpperCase() + place.type.slice(1));
            if (place.cuisine) details.push(place.cuisine);
            if (place.address && place.address.trim()) details.push(place.address);
            if (place.opening_hours) details.push(`Buka: ${place.opening_hours}`);
            if (place.phone) details.push(`Telp: ${place.phone}`);
            
            const detailsText = details.length > 0 ? `
   📍 ${details.join(' • ')}` : '';
            const websiteText = place.website ? `
   🌐 ${place.website}` : '';

            return `${index + 1}. *${place.name}*${detailsText}${websiteText}
   🗺️ ${mapLink}`;
        }).join('');

        return `Lokasi ditemukan (${results.length} hasil):

${formattedResults}`;
    }

    /**
     * Geocode a location name to coordinates using Nominatim.
     */
    async geocodeLocation(locationName) {
        try {
            const response = await axios.get(this.nominatimConfig.apiUrl, {
                params: {
                    q: locationName,
                    format: 'json',
                    limit: 1
                },
                timeout: this.nominatimConfig.timeout,
                headers: { 'User-Agent': this.nominatimConfig.userAgent }
            });

            if (response.data && response.data.length > 0) {
                const place = response.data[0];
                return { latitude: parseFloat(place.lat), longitude: parseFloat(place.lon) };
            }
            return null;
        } catch (error) {
            logger.error(`Geocoding error for "${locationName}":`, error);
            return null;
        }
    }

    /**
     * Main search function that implements the search strategy.
     * Now supports dynamic location searching.
     */
    async search(keyword, userId) {
        try {
            const parts = keyword.split(',');
            let searchKeyword = keyword;
            let locationName = null;
            let searchLocation = null;

            // 1. Parse input for a specific location
            if (parts.length > 1) {
                searchKeyword = parts[0].trim();
                locationName = parts.slice(1).join(',').trim();
            }

            // 2. Determine the search coordinates
            if (locationName) {
                // Scenario B: Geocode the provided location name
                logger.info(`Geocoding specific location: "${locationName}"`);
                searchLocation = await this.geocodeLocation(locationName);
                if (!searchLocation) {
                    return `Maaf, lokasi "${locationName}" tidak dapat ditemukan.`;
                }
            } else {
                // Scenario A: Use the user's saved location
                searchLocation = await this.getUserLocation(userId);
                if (!searchLocation) {
                    return 'Lokasi Anda belum tersimpan. Mohon kirim lokasi Anda saat ini (gunakan fitur "Share Location" di WhatsApp) agar saya bisa mencari tempat terdekat.';
                }
            }

            // 3. Perform the search using the determined coordinates
            let results = await this.searchWithOverpass(
                searchKeyword,
                searchLocation.latitude,
                searchLocation.longitude
            );

            // 4. Fallback to Nominatim if Overpass fails
            if (!results || results.length === 0) {
                logger.info('Overpass search yielded no results or was skipped. Falling back to Nominatim.');
                results = await this.searchWithNominatim(
                    searchKeyword,
                    searchLocation.latitude,
                    searchLocation.longitude
                );
            }

            return this.formatResults(results);
        } catch (error) {
            logger.error('Error in maps search:', error);
            return 'Maaf, terjadi kesalahan saat mencari lokasi. Silakan coba lagi nanti.';
        }
    }
}

export default new MapsService();
