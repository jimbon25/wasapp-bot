# Dokumentasi Lengkap WhatsApp Bot

Dokumen ini adalah panduan terpusat yang mencakup semua aspek dari WhatsApp Bot, mulai dari instalasi, konfigurasi, penggunaan, hingga panduan untuk pengembang.

## Dokumentasi Terkait
Untuk panduan yang lebih spesifik mengenai fitur-fitur utama, silakan lihat:
- **[Panduan Integrasi Google Drive](./GOOGLE_DRIVE.md)**
- **[Panduan Fitur Instagram Downloader](./INSTAGRAM.md)**
- **[Panduan Fitur Auto-Reply](./AUTOREPLY.md)**
- **[Daftar Kunci Redis (Teknis)](./REDIS_KEYS.md)**

## Daftar Isi
1.  [Pengenalan](#1-pengenalan)
2.  [Fitur Utama](#2-fitur-utama)
3.  [Instalasi dan Setup](#3-instalasi-dan-setup)
4.  [Referensi Perintah](#4-referensi-perintah)
5.  [Topik Lanjutan](#5-topik-lanjutan)
6.  [Troubleshooting](#6-troubleshooting)

---

## 1. Pengenalan

Bot WhatsApp multifungsi dengan fitur AI chat (Gemini), Instagram downloader, translator, jadwal sholat, Google Drive uploader, dan berbagai utilitas lainnya. Dirancang untuk stabilitas dan skalabilitas dengan integrasi Redis.

### Tech Stack
-   **Node.js**: Runtime JavaScript
-   **whatsapp-web.js**: Library untuk interaksi WhatsApp Web
-   **Redis**: Database in-memory untuk caching dan manajemen sesi
-   **Google Gemini API**: Untuk fitur AI Chat
-   **yt-dlp**: Untuk mengunduh media
-   **FFmpeg**: Untuk pemrosesan media
-   **Sharp**: Untuk pemrosesan gambar (stiker, rmbg)
-   **unoconv & LibreOffice**: Untuk konversi dokumen ke PDF

---

## 2. Fitur Utama

### AI & Chat

- **AI Chat (Gemini)**: Interaksi cerdas dengan dua mode: `/ask` untuk jawaban akademis dan `/talk` untuk percakapan santai.
- **Memory Management**: Mengingat konteks percakapan sebelumnya untuk kesinambungan.
- **Multi-model Fallback**: Otomatis beralih ke model alternatif jika model utama gagal.
- **Auto-reply**: Balasan otomatis berdasarkan pola teks yang dikonfigurasi. Admin dapat menambah, menghapus, dan melihat aturan auto-reply langsung dari WhatsApp.
- **Translasi Multi-bahasa**: Terjemahkan teks ke berbagai bahasa dengan `/translate`.

### Media & Download

- **Instagram Downloader**: Unduh post, reel, dan story Instagram dengan `/download`.
    - **Rotasi Akun Otomatis**: Menggunakan beberapa akun Instagram secara bergantian untuk menghindari rate limit.
    - **Sistem Cooldown Cerdas**: Memberi jeda pada akun yang terkena limitasi.
- **Sticker Maker**: Buat stiker WhatsApp dari gambar dengan `/stiker`.
- **Background Remover**: Hapus background dari gambar dengan `/rmbg`.

### Konversi Dokumen & Media

- **PDF Generator**: Konversi teks (`/text2pdf`), gambar (`/topdf`), dan dokumen Word (`/word2pdf`) ke PDF.
- **Formatting Profesional**: Output PDF diformat dengan template HTML untuk keterbacaan.

### Integrasi Google Drive

- **Upload File**: Unggah file (foto, video, dokumen) ke Google Drive dengan `/gdrive`.
- **Mode Single & Multi-upload**: Upload satu file atau mulai sesi untuk upload banyak file ke dalam satu folder.
- **Manajemen Folder**: Buat, lihat riwayat, dan ganti nama folder Drive langsung dari bot.

### Informasi & Utilitas

- **Maps Service**: Cari lokasi terdekat dengan `/maps`.
- **Jadwal Sholat**: Tampilkan jadwal sholat untuk berbagai kota dengan `/sholat`.
- **Wikipedia Search**: Cari ringkasan artikel dari Wikipedia dengan `/wiki`.
- **Status Bot**: Cek status bot dengan `/ping`.

### Manajemen & Moderasi Grup

- **Manajemen Anggota**: `/kick` anggota dari grup, `/add` anggota baru.
- **Utilitas Grup**: Dapatkan link undangan grup dengan `/link`.
- **Manajemen Konten**: `/addforbidden`, `/removeforbidden`, `/listforbidden` untuk kata-kata terlarang.
- **Sistem Peringatan & Auto-Mute**: `/warnings`, `/resetwarnings` untuk mengelola peringatan pengguna.
- **Welcome Message**: `/setwelcome`, `/editwelcome` untuk pesan selamat datang kustomisasi.

### Sistem & Performa

- **Redis Integration**: Manajemen sesi, caching, antrian pesan, rate limiting, dan monitoring.
- **Deteksi Virtex**: Memvalidasi pesan untuk mendeteksi teks berbahaya atau spam.
- **Manajemen File Otomatis**: Membersihkan file temporary secara otomatis.
- **Notifikasi Telegram**: Mengirim notifikasi ke admin jika terjadi error kritis.

---

## 3. Instalasi dan Setup

### 3.1. Prasyarat
Pastikan perangkat lunak berikut telah terinstal di sistem Anda:
-   **Node.js** (versi LTS direkomendasikan)
-   **Git**
-   **Redis Server**
-   **yt-dlp** dan **FFmpeg** (untuk fitur download media)
-   **unoconv** & **LibreOffice** (untuk fitur konversi dokumen ke PDF)

### 3.2. Instalasi Proyek
1.  **Clone Repository**:
    ```bash
    git clone https://github.com/jimboss/whatsapp-bot.git
    cd whatsapp-bot
    ```
2.  **Instalasi Dependensi**:
    ```bash
    npm install
    ```

### 3.3. Konfigurasi Environment (`.env`)
Konfigurasi bot diatur melalui file `.env`.
1.  Salin file `.env.example` menjadi `.env`:
    ```bash
    cp .env.example .env
    ```
2.  Buka file `.env` menggunakan editor teks dan sesuaikan nilainya. Variabel yang paling penting adalah:
    -   `ADMIN_NUMBERS`: Nomor WhatsApp Anda sebagai admin.
    -   `GEMINI_API_KEY`: Kunci API untuk layanan AI Gemini.
    -   `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`: Kredensial untuk koneksi ke Redis.

    Untuk daftar lengkap semua variabel dan penjelasannya, lihat tabel di bawah ini.

#### Core Configuration
| Variabel | Wajib | Deskripsi | Contoh |
|---|---|---|---|
| `NODE_ENV` | Ya | Environment aplikasi | `development`, `production` |
| `ADMIN_NUMBERS` | Ya | Nomor WhatsApp admin (format: `62812xxxx@c.us`) | `62812xxxx@c.us,62857xxxx@c.us` |
| `WABOT_SESSION_DIR` | Ya | Direktori untuk menyimpan session | `/home/user/whatsapp-bot/sessions` |

#### External Services
| Variabel | Wajib | Deskripsi |
|---|---|---|
| `GEMINI_API_KEY` | Ya | API key untuk Google Gemini |
| `REMOVEBG_API_KEY` | Ya | API key untuk remove.bg |
| `TELEGRAM_BOT_TOKEN` | Tidak | Token bot Telegram untuk notifikasi |
| `TELEGRAM_CHAT_ID` | Tidak | ID chat Telegram untuk notifikasi |

#### Redis Configuration
| Variabel | Wajib | Deskripsi | Default |
|---|---|---|---|
| `REDIS_HOST` | Ya | Host Redis server | `127.0.0.1` |
| `REDIS_PORT` | Ya | Port Redis server | `6379` |
| `REDIS_PASSWORD` | Ya | Password Redis | - |

#### Instagram Integration
| Variabel | Wajib | Deskripsi |
|---|---|---|
| `INSTAGRAM_ACCOUNT_[1-4]_USERNAME` | Ya* | Username Instagram |
| `INSTAGRAM_ACCOUNT_[1-4]_PASSWORD` | Ya* | Password Instagram |
*\*Minimal satu akun harus dikonfigurasi*

### 3.4. Panduan Instalasi Detail

#### 3.4.1. Linux (systemd)
Untuk menjalankan bot sebagai service di Linux:
1.  **Edit File Service**: Buka `systemd/wabot.service` dan sesuaikan `User`, `Group`, dan path di `WorkingDirectory` dan `ExecStart` agar sesuai dengan lingkungan server Anda.
2.  **Salin File Service**:
    ```bash
    sudo cp systemd/wabot.service /etc/systemd/system/
    ```
3.  **Reload Systemd**:
    ```bash
    sudo systemctl daemon-reload
    ```
4.  **Jalankan Service**:
    ```bash
    sudo systemctl start wabot
    ```
5.  **Aktifkan Auto-start**:
    ```bash
    sudo systemctl enable wabot
    ```

#### 3.4.2. Windows 11
*(Ringkasan dari `docs/Panduan_Windows.md`)*

1.  **Persiapan Awal**: Instal **Node.js** dan **Git** dari situs resminya.
2.  **Instalasi Redis**: Cara termudah adalah melalui **WSL (Windows Subsystem for Linux)**.
    -   Buka PowerShell sebagai Admin dan jalankan `wsl --install`.
    -   Restart komputer Anda.
    -   Di dalam WSL (Ubuntu), jalankan `sudo apt update && sudo apt install redis-server`.
    -   Konfigurasi password di `sudo nano /etc/redis/redis.conf`.
    -   Jalankan Redis dengan `sudo service redis-server start`.
3.  **Setup Proyek**: Lakukan `git clone` dan `npm install` seperti pada langkah instalasi umum.
4.  **Menjalankan Bot**:
    -   Pastikan Redis berjalan.
    -   Jalankan `npm start` di Command Prompt.
    -   Scan kode QR yang muncul menggunakan WhatsApp di HP Anda.
5.  **Auto-start (Opsional)**: Gunakan **Task Scheduler** di Windows untuk menjalankan file `start-bot.bat` (yang perlu Anda buat) saat startup.

---

## 4. Referensi Perintah

Berikut adalah daftar perintah utama yang tersedia.

### AI & Chat
| Command | Deskripsi |
|---|---|
| `/ask [pertanyaan]` | Bertanya kepada AI (Gemini) untuk jawaban akademis dan terstruktur. |
| `/talk [pesan]` | Memulai chat interaktif dan santai dengan AI (Gemini). |

### Media & Konversi
| Command | Deskripsi |
|---|---|
| `/stiker` | Membuat stiker dari gambar. Kirim gambar dengan caption atau reply gambar dengan perintah ini. |
| `/rmbg [warna]` | Menghapus background gambar. Warna opsional (contoh: `red`, `blue`, `transparent`). |
| `/topdf` | Mengkonversi satu atau beberapa gambar menjadi satu file PDF. |
| `/word2pdf` | Mengkonversi dokumen Word (.doc, .docx) ke PDF. |
| `/text2pdf [teks]` | Mengkonversi teks panjang menjadi file PDF yang diformat rapi. |
| `/download [URL]` | Mengunduh post/reel/story dari Instagram. |

### Google Drive
| Command | Deskripsi |
|---|---|
| `/gdrive [caption]` | Mengunggah file (reply atau kirim dengan caption) ke folder Drive utama. |
| `/gdrive -folder [nama]` | Membuat folder baru dan memulai sesi upload ke folder tersebut. |
| `/gdrive folder [nama]` | Melanjutkan sesi upload ke folder yang sudah ada. |
| `/gdrive folders` | Melihat daftar 10 folder terakhir yang digunakan. |
| `/gdrive rename [lama] [baru]` | Mengganti nama folder yang tersimpan di riwayat. |
| `/gdrive done` | Mengakhiri sesi upload. |
| `/gdrive status` | Melihat status sesi upload yang sedang berjalan. |

### Informasi & Utilitas
| Command | Deskripsi |
|---|---|
| `/sholat [kota]` | Menampilkan jadwal sholat untuk kota tertentu di Indonesia. |
| `/translate [lang] [teks]` | Menerjemahkan teks. Contoh: `/translate id Hello`. |
| `/wiki [kata kunci]` | Mencari ringkasan artikel di Wikipedia. |
| `/maps [lokasi]` | Mencari lokasi di peta berdasarkan kata kunci (memerlukan user mengirim lokasi dulu). |
| `/ping` | Menguji status dan respons bot. |
| `/menu` | Menampilkan semua command yang tersedia. |

### Moderasi & Admin Grup
| Command | Deskripsi |
|---|---|
| `/kick [@user/reply]` | Mengeluarkan anggota dari grup. |
| `/add [nomor]` | Menambahkan anggota ke grup. |
| `/link` | Menampilkan link undangan grup. |
| `/setwelcome [pesan]` | Mengatur pesan selamat datang untuk anggota baru. |
| `/editwelcome [pesan]` | Mengedit pesan selamat datang yang sudah ada. |
| `/addforbidden [kata]` | Menambahkan kata ke daftar terlarang. |
| `/removeforbidden [kata]` | Menghapus kata dari daftar terlarang. |
| `/listforbidden` | Melihat daftar kata terlarang. |
| `/warnings [@user/reply]` | Melihat jumlah peringatan pengguna di grup. |
| `/resetwarnings [@user/reply]`| Mereset jumlah peringatan pengguna. |
| `/addreply`, `/delreply`, `/listreply`       | Mengelola aturan auto-reply (teks & media). Lihat [panduan lengkap](./AUTOREPLY.md). |

---

## 5. Topik Lanjutan

### 5.1. Integrasi Redis
Bot ini menggunakan Redis secara ekstensif untuk meningkatkan skalabilitas dan keandalan.

- **Fitur yang Didukung Redis**:
  - **Manajemen Sesi**: Menyimpan sesi login untuk menghindari scan QR berulang.
  - **Caching**: Menyimpan hasil dari API call (Anime, Jadwal Sholat, Terjemahan) untuk respons lebih cepat.
  - **Antrian Pesan**: Mengelola antrian pesan sebagai fallback saat traffic tinggi.
  - **Rate Limiting**: Membatasi frekuensi penggunaan perintah untuk mencegah abuse.
  - **Manajemen Konfigurasi**: Menyimpan konfigurasi dinamis seperti auto-reply, welcome message, dan kata terlarang.
  - **Backup**: Konfigurasi dinamis di-backup secara periodik ke file JSON sebagai cadangan.

- **Kunci-Kunci Redis (`Redis Keys`)**:
  Aplikasi ini menggunakan beragam kunci di Redis untuk menyimpan data. Untuk daftar lengkap semua kunci, tipe datanya, deskripsi, dan contoh penggunaannya, silakan merujuk ke dokumentasi terpisah berikut:
  - [**Dokumentasi Lengkap Kunci-Kunci Redis**](REDIS_KEYS.md)

### 5.2. Panduan Keamanan
- **Variabel Lingkungan**: Jangan pernah commit file `.env` ke repository. Gunakan password yang kuat dan rotasi API key secara berkala.
- **Keamanan Redis**: Gunakan password yang kuat, batasi akses Redis hanya ke `localhost`, dan aktifkan mode terproteksi.
- **Validasi Input**: Bot melakukan validasi untuk mencegah konten berbahaya, termasuk deteksi "virtex" (teks spam/virus).
- **Rate Limiting**: Terdapat pembatasan frekuensi untuk penggunaan perintah umum, perintah AI, dan fitur terjemahan untuk mencegah abuse.
- **Moderasi Grup**: Fitur seperti filter kata terlarang dan sistem peringatan/auto-mute membantu menjaga ketertiban grup.

### 5.3. Panduan untuk Developer
- **Menambah Perintah Admin**:
  1. Buat file baru di `src/features/`.
  2. Gunakan template dasar perintah dan pastikan properti `adminOnly: true` diatur.
  3. Tulis logika perintah Anda di dalam fungsi `execute`. Sistem akan menangani otorisasi secara otomatis.
  4. Otorisasi membedakan **Super Admin** (dari `.env`) dan **Admin Grup** (dari status di grup WhatsApp).

- **Menambah Fitur Moderasi**:
  1. Tempatkan file fitur di `src/features/moderation/`.
  2. Selain `adminOnly: true`, Anda harus menambahkan pemeriksaan manual di dalam kode untuk memastikan **bot itu sendiri adalah admin** di grup tersebut sebelum melakukan aksi (contoh: `if (!chat.me?.isAdmin)`).

---

## 6. Troubleshooting

### Masalah Umum
- **QR Code tidak muncul atau bot crash**: Kemungkinan Puppeteer (browser internal) gagal dijalankan. Coba hapus folder `.wwebjs_auth` lalu jalankan lagi `npm start`.
- **Error "Redis connection failed"**: Pastikan service Redis berjalan dan konfigurasi (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`) di file `.env` sudah benar.
- **Perintah admin tidak berfungsi**: Pastikan nomor HP Anda di file `.env` pada variabel `ADMIN_NUMBERS` sudah benar, termasuk format `62...@c.us`.
- **Error "EACCES: permission denied"**: Pastikan user yang menjalankan bot memiliki izin tulis (*write access*) ke direktori proyek (terutama folder `logs`, `temp`, `sessions`).
- **Konversi Dokumen Gagal**: Pastikan **LibreOffice** dan **unoconv** terinstal di server dan service `unoconv-listener` berjalan.
