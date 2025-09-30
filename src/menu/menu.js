import logger from '../utils/common/logger.js';

const menuText = `🤖 *DAFTAR PERINTAH BOT*

📄 *Document Tools*
\`/text2pdf [teks]\`
Konversi teks langsung menjadi file PDF
*Contoh:* \`/text2pdf Ini adalah contoh teks yang akan dikonversi\`

\`/word2pdf\`
Konversi dokumen Word ke PDF
*Contoh:* _Reply dokumen Word dengan perintah_ \`/word2pdf\`

\`/topdf\`
Konversi gambar ke PDF
*Contoh:* _Reply gambar dengan perintah_ \`/topdf\`

🎨 *Media Tools*
\`/rmbg [warna]\`
Hapus background gambar
*Contoh:*
\`/rmbg\` - Background transparan
\`/rmbg red\` - Background merah
\`/rmbg blue\` - Background biru

\`/stiker\`
Buat stiker dari gambar
*Contoh:* _Reply gambar dengan perintah_ \`/stiker\`

\`/download [link]\`
Download media dari link
*Contoh:* \`/download [url]\`

📤 *Google Drive Commands*
\`/gdrive [caption]\`
Upload single file ke Google Drive
*Contoh:* _Reply file dengan perintah_ \`/gdrive nama-file\`

\`/gdrive -folder [nama]\`
Buat folder baru untuk upload multiple file
*Contoh:* \`/gdrive -folder Foto Liburan\`

\`/gdrive folder [nama]\`
Lanjut upload ke folder yang sudah ada
*Contoh:* \`/gdrive folder Foto Liburan\`

\`/gdrive folders\`
Lihat daftar folder yang tersedia

\`/gdrive rename [lama] [baru]\`
Ganti nama folder
*Contoh:* \`/gdrive rename Liburan Liburan2025\`

\`/gdrive done\`
Selesai upload ke folder

\`/gdrive status\`
Cek status upload saat ini

*Anime & Entertainment*
Command: \`/anime [judul]\`
Mencari info anime dan link streaming
*Contoh:* \`/anime one piece\`

*Language & AI*
\`/translate [bahasa] [teks]\`
Terjemahkan teks ke bahasa lain
*Contoh:* \`/translate en Selamat pagi\`

\`/talk [teks]\`
Chat santai dengan AI
*Contoh:* \`/talk Ceritakan tentang Indonesia\`

\`/ask [pertanyaan]\`
Tanya hal spesifik ke AI
*Contoh:* \`/ask Bagaimana cara kerja energi surya?\`

📍 *Location Services*
\`/maps [keyword]\`
Mencari dan menampilkan lokasi di peta
*Contoh:* \`/maps Monas Jakarta\`

\`/sholat [kota]\`
Menampilkan jadwal sholat
*Contoh:* \`/sholat surabaya\`

\`/wiki [keyword]\`
Information 
*Contoh:* \`/wiki WhatsApp\`

💡 *Utilitas*
\`/ping\`
Cek status dan respon bot

*Admin Commands*
\`/add [nomor]\`
Tambah anggota ke grup

\`/addreply [kunci] | [balasan]\`
Tambah auto-reply (gunakan --global atau --user untuk scope lain)

\`/delreply [kunci]\`
Hapus auto-reply (gunakan --global atau --user untuk scope lain)

\`/listreply\`
Tampilkan daftar auto-reply (gunakan --global atau --user untuk scope lain)

\`/editwelcome [teks]\`
Edit pesan sambutan grup

\`/setwelcome [teks]\`
Set pesan sambutan grup baru

\`/kick [reply/tag]\`
Keluarkan anggota dari grup

\`/link\`
Dapatkan link invite grup

\`/warnings\`
Cek daftar peringatan anggota

\`/resetwarnings [reply/tag]\`
Reset peringatan anggota

\`/addforbidden [keyword]\`
Tambah kata terlarang

\`/removeforbidden [keyword]\`
Hapus kata terlarang

\`/listforbidden\`
Tampilkan daftar kata terlarang

💡 *Bantuan*
\`/help\`
Menampilkan bantuan detail untuk setiap perintah

📝 *Notes:*
• Reply media/file dengan command untuk fitur konversi
• Beberapa command memerlukan akses admin
• Untuk detail lengkap setiap command, gunakan \`/help\``;

export default {
    name: 'menu',
    async execute(message) {
        try {
            logger.info(`User ${message.from} requested menu`);
            await message.reply(menuText);
        } catch (error) {
            logger.error('Failed to send menu', error);
            throw error;
        }
    }
};