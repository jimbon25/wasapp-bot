import translationService from '../services/infoServices/translationService.js';
import logger from '../utils/common/logger.js';

const helpText = `*Perintah Translate*
Menerjemahkan teks ke bahasa yang diinginkan.

Penggunaan:
1. Reply pesan:
   Reply pesan yang ingin diterjemahkan dengan:
   /translate [kode_bahasa]
   Contoh: /translate id
   
   Atau dengan bahasa sumber:
   /translate [kode_bahasa_sumber]>[kode_bahasa_tujuan]
   Contoh: /translate en>id

2. Auto detect bahasa:
   /translate [kode_bahasa] [teks]
   Contoh: /translate id Hello, how are you?

3. Tentukan bahasa sumber:
   /translate [kode_bahasa_sumber]>[kode_bahasa_tujuan] [teks]
   Contoh: /translate en>id Hello, how are you?

4. Lihat daftar bahasa:
   /translate languages

Kode bahasa umum:
- id (Indonesia)
- en (Inggris)
- ar (Arab)
- ja (Jepang)
- ko (Korea)
- zh (Mandarin)
- ms (Melayu)
- nl (Belanda)
- fr (Perancis)
- de (Jerman)
- es (Spanyol)

Ketik /translate languages untuk melihat semua kode bahasa yang didukung.`;

export default {
    name: 'translate',
    requiredPermissions: ['translate'],
    async execute(message, args) {
        try {

            if (args[0] === 'languages') {
                const languages = await translationService.getSupportedLanguages();
                const langList = languages
                    .map(lang => `${lang.code}: ${lang.name}`)
                    .join('\n');
                return message.reply('*Daftar Bahasa yang Didukung:*\n\n' + langList);
            }

            if (message.hasQuotedMsg) {
                const quotedMsg = await message.getQuotedMessage();
                
                if (!quotedMsg.body) {
                    return message.reply('Pesan yang di-reply harus mengandung teks.');
                }

                if (!args[0]) {
                    return message.reply(helpText);
                }

                let sourceLang = 'auto';
                let targetLang;
                let text = quotedMsg.body;

                if (args[0].includes('>')) {
                    const [src, tgt] = args[0].split('>');
                    sourceLang = src.trim();
                    targetLang = tgt.trim();
                } else {
                    targetLang = args[0];
                }

                if (!/^[a-zA-Z-]{2,5}$/.test(targetLang)) {
                    return message.reply(
                        'Format kode bahasa tidak valid. Gunakan format seperti: id, en, ar, dll.\n\n' + 
                        'Ketik /translate languages untuk melihat daftar kode bahasa yang didukung.'
                    );
                }

                logger.info(`Translating replied message to ${targetLang}: ${text}`);
                
                const result = await translationService.translate(text, targetLang, sourceLang);
                const response = [
                    '*Hasil Terjemahan:*',
                    `${result.translatedText}`,
                    '',
                    '*Informasi:*',
                    `Bahasa sumber: ${result.detectedSourceLanguage || sourceLang}`,
                    `Bahasa tujuan: ${targetLang}`
                ].join('\n');

                await message.reply(response);
                return;
            }

            if (args.length < 2) {
                return message.reply(helpText);
            }

            let sourceLang = 'auto';
            let targetLang;
            let text;

            if (args[0].includes('>')) {
                const [src, tgt] = args[0].split('>');
                sourceLang = src.trim();
                targetLang = tgt.trim();
                text = args.slice(1).join(' ');
            } else {
                targetLang = args[0];
                text = args.slice(1).join(' ');
            }

            if (!/^[a-zA-Z-]{2,5}$/.test(targetLang)) {
                return message.reply(
                    'Format kode bahasa tidak valid. Gunakan format seperti: id, en, ar, dll.\n\n' + 
                    'Ketik /translate languages untuk melihat daftar kode bahasa yang didukung.'
                );
            }

            logger.info(`Translating to ${targetLang}: ${text}`);
            const result = await translationService.translate(text, targetLang, sourceLang);

            const response = [
                '*Hasil Terjemahan:*',
                `${result.translatedText}`,
                '',
                '*Informasi:*',
                `Bahasa sumber: ${result.detectedSourceLanguage || sourceLang}`,
                `Bahasa tujuan: ${targetLang}`
            ].join('\n');

            await message.reply(response);
        } catch (error) {
            logger.error('Translation command error:', error);
            await message.reply(
                'Maaf, terjadi kesalahan saat menerjemahkan.\n' +
                'Pastikan format perintah sudah benar dan coba lagi nanti.'
            );
        }
    }
};