# WhatsApp Bot

Bot WhatsApp multifungsi dengan fitur AI chat (Gemini), Instagram downloader, translator, jadwal sholat, Google Drive uploader, dan berbagai utilitas lainnya. Dirancang untuk stabilitas dan skalabilitas dengan integrasi Redis.

## Fitur Utama

### AI & Chat
-   **AI Chat (Gemini)**: Interaksi cerdas dengan dua mode: `/ask` untuk jawaban akademis dan `/talk` untuk percakapan santai.
-   **Memory Management**: Mengingat konteks percakapan sebelumnya.
-   **Multi-model Fallback**: Otomatis beralih ke model alternatif jika model utama gagal.
-   **Auto-reply**: Balasan otomatis berdasarkan pola teks yang dikonfigurasi.
-   **Translasi Multi-bahasa**: Terjemahkan teks ke berbagai bahasa dengan `/translate`.

### Media & Download
-   **Instagram Downloader**: Unduh post, reel, dan story Instagram dengan `/download`.
    -   **Rotasi Akun Otomatis**: Menggunakan beberapa akun Instagram secara bergantian untuk menghindari rate limit.
    -   **Sistem Cooldown Cerdas**: Memberi jeda pada akun yang terkena limitasi.
-   **Sticker Maker**: Buat stiker WhatsApp dari gambar dengan `/stiker`.
-   **Background Remover**: Hapus background dari gambar dengan `/rmbg`.

### Konversi Dokumen & Media
-   **PDF Generator**: Konversi teks (`/text2pdf`), gambar (`/topdf`), dan dokumen Word (`/word2pdf`) ke PDF.
-   **Formatting Profesional**: Output PDF diformat dengan template HTML untuk keterbacaan.

### Integrasi Cloud Storage
-   **Google Drive**: Unggah file ke Google Drive dengan `/gdrive`, mendukung sesi multi-upload dan manajemen folder.
-   **Mega.nz**: Unggah file ke Mega.nz dengan `/mega`, mendukung sesi multi-upload ke folder default.

### Informasi & Utilitas
-   **Jadwal Sholat**: Tampilkan jadwal sholat untuk berbagai kota dengan `/sholat`.
-   **Wikipedia Search**: Cari ringkasan artikel dari Wikipedia dengan `/wiki`.
-   **Status Bot**: Cek status bot dengan `/ping`.

### Manajemen & Moderasi Grup
-   **Manajemen Auto-Reply**: Admin dapat menambah, menghapus, dan melihat aturan auto-reply.
-   **Manajemen Anggota**: `/kick` anggota dari grup, `/add` anggota baru.
-   **Utilitas Grup**: Dapatkan link undangan grup dengan `/link`.
-   **Manajemen Konten**: `/addforbidden`, `/removeforbidden`, `/listforbidden` untuk kata-kata terlarang.
-   **Sistem Peringatan & Auto-Mute**: `/warnings`, `/resetwarnings` untuk mengelola peringatan pengguna.
-   **Welcome Message**: `/setwelcome`, `/editwelcome` untuk pesan selamat datang kustomisasi.

### Sistem & Performa
-   **Redis Integration**: Session management, caching, message queue, rate limiting, dan monitoring.
-   **Deteksi Virtex**: Memvalidasi pesan untuk mendeteksi teks berbahaya atau spam.
-   **Manajemen File Otomatis**: Membersihkan file temporary secara otomatis.
-   **Notifikasi Telegram**: Mengirim notifikasi ke admin jika terjadi error kritis.

### Notifikasi
-   **Notifikasi Gmail Real-time**: Menerima pemberitahuan instan untuk email baru dari beberapa akun Gmail melalui *push notifications* Google Pub/Sub, lengkap dengan *direct link* ke pesan.

## Tech Stack
-   **Node.js**: Runtime JavaScript
-   **whatsapp-web.js**: Library untuk interaksi WhatsApp Web
-   **Redis**: Database in-memory untuk caching dan manajemen sesi
-   **Google Gemini API**: Untuk fitur AI Chat
-   **yt-dlp**: Untuk mengunduh media
-   **FFmpeg**: Untuk pemrosesan media
-   **Sharp**: Untuk pemrosesan gambar (stiker, rmbg)
-   **unoconv & LibreOffice**: Untuk konversi dokumen ke PDF

## Setup & Konfigurasi

### 1. Prerequisites
Pastikan Anda telah menginstal perangkat lunak berikut:
-   **Node.js** (versi LTS direkomendasikan)
-   **Git**
-   **yt-dlp** dan **FFmpeg** (untuk fitur download media)
-   **Redis Server** (direkomendasikan menggunakan WSL2 di Windows)

### 2. Clone Repository
```bash
git clone https://github.com/jimboss/whatsapp-bot.git
cd whatsapp-bot
```

### 3. Instalasi Dependensi
```bash
npm install
```

### 4. Environment Variables
Konfigurasi bot diatur melalui file `.env`. Salin `.env.example` ke `.env` dan sesuaikan nilai-nilainya.

```bash
cp .env.example .env
```

Buka file `.env` dan isi variabel-variabel penting seperti:
-   `ADMIN_NUMBERS`: Nomor WhatsApp admin (format: `62812xxxx@c.us`)
-   `GEMINI_API_KEY`: API key untuk AI chat (dari Google AI Studio)
-   `REMOVEBG_API_KEY`: API key untuk remove.bg
-   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`: Untuk notifikasi error via Telegram
-   `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`: Konfigurasi Redis Anda
-   `INSTAGRAM_ACCOUNT_1_USERNAME`, `INSTAGRAM_ACCOUNT_1_PASSWORD`: Minimal satu akun Instagram untuk downloader
-   `MEGA_CREDENTIALS_SECRET`: Kunci rahasia untuk enkripsi kredensial Mega.nz (wajib diisi)

Lihat [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) untuk daftar lengkap konfigurasi dan penjelasannya.

### 5. Konfigurasi Google Drive (Opsional)
Jika Anda ingin menggunakan fitur upload ke Google Drive, Anda perlu mengkonfigurasi kredensial API Google Drive. Ikuti panduan di [Integrasi Google Drive](docs/DOKUMENTASI_LENGKAP.md#google-drive) dan jalankan script setup:
```bash
node scripts/setup-google-drive.js
```

## Menjalankan Bot

1.  Pastikan Redis Server Anda berjalan.
2.  Jalankan bot dari terminal:
    ```bash
npm start
    ```
3.  Sebuah kode QR akan muncul di terminal. Scan dengan WhatsApp di HP Anda (`Pengaturan` > `Perangkat Tertaut` > `Tautkan Perangkat`).
4.  Setelah berhasil, bot akan online dan siap digunakan.

## Deployment

### Linux (Systemd)
Untuk menjalankan bot sebagai service di Linux, ikuti langkah-langkah berikut:
1.  Copy file service ke systemd:
    ```bash
sudo cp systemd/wabot.service /etc/systemd/system/
    ```
2.  Reload systemd daemon:
    ```bash
sudo systemctl daemon-reload
    ```
3.  Start service:
    ```bash
sudo systemctl start wabot
    ```
4.  Enable autostart:
    ```bash
sudo systemctl enable wabot
    ```

### Windows 11
Untuk panduan instalasi, konfigurasi, auto-start, dan troubleshooting lengkap di Windows 11, silakan lihat [Panduan Instalasi Windows 11](docs/DOKUMENTASI_LENGKAP.md#342-windows-11).

## Commands

Berikut adalah daftar perintah utama yang tersedia. Untuk daftar lengkap dan bantuan detail, gunakan `/menu` atau `/help [command]` di bot.

| Kategori           | Command                               | Deskripsi                                                              |
| :----------------- | :------------------------------------ | :--------------------------------------------------------------------- |
| **Umum**           | `/menu`                               | Menampilkan semua command yang tersedia.                               |
|                    | `/ping`                               | Menguji status dan respons bot.                                        |
|                    | `/help [command]`                     | Menampilkan bantuan penggunaan untuk command spesifik.                 |
| **Media & Konversi** | `/stiker`                             | Membuat stiker dari gambar (kirim gambar dengan caption atau reply).   |
|                    | `/rmbg [warna]`                       | Menghapus background gambar (opsional dengan warna latar belakang).    |
|                    | `/topdf`                              | Mengkonversi gambar ke PDF.                                            |
|                    | `/word2pdf`                           | Mengkonversi dokumen Word ke PDF.                                      |
| **Informasi & Utilitas** | `/sholat [kota]`                      | Menampilkan jadwal sholat untuk kota tertentu.                         |
|                    | `/translate [lang] [teks]`            | Menerjemahkan teks ke bahasa lain.                                     |
|                    | `/wiki [kata kunci]`                  | Mencari ringkasan artikel di Wikipedia.                                |
| **AI & Chat**      | `/ask [pertanyaan]`                   | Bertanya kepada AI (Gemini) untuk jawaban akademis.                    |
|                    | `/talk [pesan]`                       | Memulai chat interaktif dan santai dengan AI (Gemini).                 |
| **Instagram**      | `/download [URL]`                     | Mengunduh post/reel/story dari Instagram.                              |
| **Google Drive**   | `/gdrive [caption]`                   | Mengunggah file ke Google Drive.                                       |
|                    | `/gdrive -folder [nama]`              | Membuat folder baru untuk sesi multi-upload.                           |
|                    | `/gdrive folder [nama]`               | Melanjutkan sesi upload ke folder yang sudah ada.                      |
|                    | `/gdrive folders`                     | Melihat daftar folder Google Drive yang tersimpan.                     |
|                    | `/gdrive rename [lama] [baru]`        | Mengganti nama folder yang tersimpan.                                  |
|                    | `/gdrive status`                      | Melihat status sesi upload yang sedang berjalan.                       |
|                    | `/gdrive done`                        | Mengakhiri sesi upload Google Drive.                                   |
| **Mega.nz**        | `/mega login [email] [pass]`          | (Admin) Menghubungkan akun Mega.nz pribadi (di chat pribadi).          |
|                    | `/mega account`                       | (Admin) Melihat akun Mega.nz yang terhubung.                           |
|                    | `/mega logout`                        | (Admin) Memutus koneksi akun Mega.nz.                                  |
|                    | `/mega start`                         | (Admin) Memulai sesi upload ke akun Mega pribadi.                      |
|                    | `/mega done`                          | (Admin) Mengakhiri sesi upload Mega.                                   |
| **Moderasi Grup**  | `/kick [@user/reply]`                 | Mengeluarkan anggota dari grup.                                        |
|                    | `/add [nomor]`                        | Menambahkan anggota ke grup.                                           |
|                    | `/addreply [kunci] [balasan]`         | Menambah atau memperbarui aturan auto-reply.                           |
|                    | `/delreply [kunci]`                   | Menghapus aturan auto-reply.                                           |
|                    | `/listreply`                          | Melihat semua aturan auto-reply.                                       |
|                    | `/setwelcome [pesan]`                 | Mengatur pesan selamat datang untuk grup.                              |
|                    | `/editwelcome [pesan]`                | Mengedit pesan selamat datang grup yang sudah ada.                     |
|                    | `/addforbidden [kata]`                | Menambahkan kata ke daftar terlarang.                                  |
|                    | `/removeforbidden [kata]`             | Menghapus kata dari daftar terlarang.                                  |
|                    | `/listforbidden`                      | Melihat daftar kata terlarang.                                         |
|                    | `/warnings [@user/reply]`             | Melihat jumlah peringatan pengguna di grup.                            |
|                    | `/resetwarnings [@user/reply]`        | Mereset jumlah peringatan pengguna.                                    |
|                    | `/link`                               | Menampilkan link undangan grup.                                        |

## Dokumentasi Lengkap

Untuk informasi lebih detail mengenai setiap aspek bot, silakan kunjungi dokumen-dokumen berikut:

-   [**Panduan Integrasi Google Drive**](./docs/GOOGLE_DRIVE.md): Konfigurasi dan penggunaan fitur Google Drive dari A-Z.
-   [**Panduan Fitur Mega.nz Uploader**](./docs/MEGA.md): Konfigurasi dan penggunaan fitur upload ke Mega.nz.
-   [**Panduan Fitur Instagram Downloader**](./docs/INSTAGRAM.md): Konfigurasi dan cara kerja fitur download Instagram.
-   [**Panduan Fitur Auto-Reply**](./docs/AUTOREPLY.md): Panduan lengkap untuk mengelola fitur auto-reply.
-   [**Dokumentasi Lengkap (Utama)**](./docs/DOKUMENTASI_LENGKAP.md): Penjelasan semua fitur, instalasi, dan perintah.
-   [**Daftar Kunci Redis**](./docs/REDIS_KEYS.md): Referensi teknis semua key Redis yang digunakan bot.

## Catatan Keamanan Fitur Teks Panjang

-   Fitur `/text2pdf`, `/ask`, dan `/translate` di-whitelist dari sistem deteksi virtex sehingga dapat menerima input teks panjang (hingga 5000 karakter) tanpa dianggap spam/virus text.
-   Command lain yang mengirim pesan sangat panjang tetap bisa dianggap virtex dan akun bisa diblokir otomatis.
-   Jika Anda menggunakan `/text2pdf` dengan teks lebih dari 5000 karakter, pesan tetap akan dianggap virtex dan akun bisa masuk blacklist.

## Troubleshooting

### Masalah Permission
1.  **Error: Read-only file system**
    -   Pastikan service memiliki akses write ke direktori yang dibutuhkan.
    -   Cek konfigurasi `ReadWritePaths` di file service (untuk Linux).
2.  **Error: Cannot create temporary directory**
    -   Pastikan `TEMP_DIR` sudah diset dengan benar di `.env`.
    -   Cek permission direktori temporary.
    -   Default menggunakan `/tmp/whatsapp-bot-*` (untuk Linux).
3.  **Error: Sticker creation failed**
    -   Pastikan gambar dalam format JPG/PNG dan ukuran maksimal 2MB.
    -   Pastikan gambar tidak corrupt.
4.  **Error: Cannot write to logs**
    -   Pastikan user service memiliki akses ke direktori logs.
    -   Cek ownership dan permission direktori.

### Masalah Service
1.  **Service tidak start**
    -   Cek log dengan `journalctl -u wabot` (untuk Linux).
    -   Pastikan path Node.js benar dan environment variables sudah terverifikasi.
2.  **Stiker tidak bisa dibuat**
    -   Cek permission direktori temp.
    -   Pastikan package `sharp` terinstal dengan benar.
    -   Verifikasi format dan ukuran gambar.

Untuk troubleshooting lebih lanjut, terutama di Windows, lihat [Panduan Troubleshooting](docs/DOKUMENTASI_LENGKAP.md#6-troubleshooting).

## Changelog

### Perubahan Terbaru

#### Fitur Baru (Features)

*   **Fitur Pengiriman Email via Gmail**: Pengguna kini dapat mengirim email langsung dari WhatsApp.
    *   Menambahkan perintah `/gmail send <penerima> "<subjek>" <pesan>` untuk membuat dan mengirim email.
    *   Menambahkan sistem "akun aktif" dengan perintah `/gmail accounts` dan `/gmail set-account [nama_akun]` untuk memilih akun pengirim.
*   **Restart Otomatis untuk Konfigurasi Baru**: Bot kini dapat mendeteksi perubahan pada konfigurasi akun Gmail (penambahan, penghapusan, atau otorisasi baru) dan akan secara otomatis me-restart dirinya sendiri untuk menerapkan perubahan tersebut. Pengguna tidak perlu lagi me-restart service secara manual.
*   **Unduh Lampiran Gmail**: Pengguna sekarang dapat mengunduh lampiran email langsung dari WhatsApp dengan membalas pesan notifikasi Gmail menggunakan perintah `/gmail download [nomor]`.
*   **Pembatalan Auto-Upload**: Menambahkan perintah baru `/upload cancel`. Admin sekarang dapat membatalkan sesi pengumpulan media untuk fitur `AUTO_UPLOAD` sebelum bot mengirimkan prompt konfirmasi.

#### Perubahan & Peningkatan (Changes & Improvements)

*   **Peningkatan Stabilitas: Implementasi Graceful Shutdown**: Bot sekarang menggunakan mekanisme *graceful shutdown* saat melakukan restart otomatis (misalnya setelah perubahan konfigurasi Gmail). Bot akan berhenti menerima perintah baru dan menunggu semua tugas yang sedang berjalan (seperti upload atau download) selesai sebelum me-restart. Hal ini mencegah proses terputus di tengah jalan dan meningkatkan keandalan secara keseluruhan.
*   **Peningkatan Skrip Setup Gmail**: Skrip `setup-gmail.js` kini lebih mudah digunakan. Pengguna dapat memasukkan nomor telepon target dalam format biasa (misalnya, `0812...`) dan skrip akan secara otomatis memformatnya ke format WhatsApp yang benar (`62812...@c.us`).
*   **Peningkatan Notifikasi Gmail**:
    *   Notifikasi sekarang menampilkan daftar lampiran yang ada di email.
    *   Bot kini dapat mengirim notifikasi email **tanpa harus menandai email sebagai 'telah dibaca'** di akun Gmail Anda, memberikan kontrol penuh atas status inbox Anda.
    *   Perilaku ini dapat diaktifkan melalui variabel baru di `.env`: `GMAIL_LEAVE_AS_UNREAD=true`.
    *   Masa kedaluwarsa untuk jejak notifikasi di Redis kini juga dapat diatur melalui `GMAIL_NOTIFIED_ID_EXPIRY_DAYS`.
*   **Notifikasi Gmail Real-time**: Fitur notifikasi Gmail dirombak total dari sistem *polling* menjadi *push notifications* menggunakan Google Cloud Pub/Sub. Kini mendukung notifikasi instan dari multi-akun Gmail dan menyertakan *direct link* ke pesan email. ([Lihat Dokumentasi Lengkap](./docs/GMAIL.md))
*   **Sistem Batch Auto-Upload Menjadi Milik Grup**:
    *   Fitur `AUTO_UPLOAD` sekarang mengumpulkan file media yang dikirim oleh **siapa saja** di dalam grup.
    *   Pesan konfirmasi upload sekarang dikirim sebagai **pesan baru** ke grup, sehingga bisa direspons oleh admin mana pun.

#### Perbaikan Bug (Fixes)

*   **Perbaikan Sensitivitas Huruf Besar/Kecil Akun Google Drive:** Memperbaiki masalah di mana pergantian akun Google Drive gagal karena sensitivitas huruf besar/kecil pada nama akun.
*   **Pengunduhan Lampiran Gmail**: Memperbaiki error `atob` yang terjadi karena salah encoding `base64`. Lampiran sekarang dapat diunduh dengan benar.
*   **Perintah Admin pada Batch**: Memperbaiki bug di mana admin tidak dapat menjalankan perintah pada batch media yang dimulai oleh member biasa.
