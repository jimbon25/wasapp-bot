import axios from 'axios';
import logger from '../../utils/common/logger.js';
import config from '../../config.js';

class WikipediaService {
    constructor() {
        this.apiUrl = config.app.wikipedia.apiUrl;
    }

    async searchArticle(searchTerm) {
        if (!this.apiUrl) {
            throw new Error('WIKIPEDIA_API_URL tidak diatur di file .env atau config.js');
        }

        const params = {
            action: 'query',
            format: 'json',
            prop: 'extracts|info',
            exintro: true,
            explaintext: true,
            inprop: 'url',
            redirects: 1,
            titles: searchTerm,
        };

        try {
            const response = await axios.get(this.apiUrl, { params });
            const pages = response.data.query.pages;
            const pageId = Object.keys(pages)[0];

            if (!pageId || pageId === '-1') {
                return null;
            }

            const page = pages[pageId];

            return {
                title: page.title,
                summary: this.formatSummary(page.extract),
                url: page.fullurl,
            };

        } catch (error) {
            logger.error('Gagal mengambil data dari Wikipedia API:', error);
            throw new Error('Maaf, terjadi kesalahan saat menghubungi Wikipedia.');
        }
    }

    formatSummary(text) {
        if (!text) {
            return 'Ringkasan tidak tersedia.';
        }
        if (text.length > 500) {
            return text.substring(0, 500) + '...';
        }
        return text;
    }
}

export default new WikipediaService();
