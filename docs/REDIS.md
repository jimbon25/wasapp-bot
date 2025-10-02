# Panduan Lengkap Konfigurasi dan Penggunaan Redis

Dokumen ini menjelaskan peran vital Redis dalam arsitektur bot, cara mengkonfigurasinya, dan bagaimana Redis mendukung berbagai fitur untuk stabilitas dan performa.

## Daftar Isi
1.  [Peran Redis di Dalam Bot](#1-peran-redis-di-dalam-bot)
2.  [Prasyarat](#2-prasyarat)
3.  [Konfigurasi Environment (.env)](#3-konfigurasi-environment-env)
4.  [Bagaimana Redis Digunakan (Fitur)](#4-bagaimana-redis-digunakan-fitur)
5.  [Struktur Data (Redis Keys)](#5-struktur-data-redis-keys)
6.  [Troubleshooting](#6-troubleshooting)

---

## 1. Peran Redis di Dalam Bot

Redis adalah *database in-memory* super cepat yang menjadi tulang punggung dari bot ini. Penggunaannya tidak hanya sebatas caching, tetapi mencakup berbagai aspek penting yang memastikan bot berjalan dengan andal dan efisien.

-   **Performa**: Dengan menyimpan data yang sering diakses di memori, Redis mengurangi latensi secara drastis.
-   **Stabilitas**: Menyimpan sesi login di Redis memastikan bot dapat pulih dengan cepat setelah restart tanpa perlu scan QR ulang.
-   **Skalabilitas**: Mengelola antrian pesan dan rate limiting memungkinkan bot menangani beban kerja yang tinggi tanpa crash.
-   **Fleksibilitas**: Konfigurasi seperti auto-reply dan kata terlarang disimpan di Redis, memungkinkan admin mengubahnya secara dinamis tanpa perlu me-restart bot.

---

## 2. Prasyarat

-   **Redis Server**: Anda harus memiliki Redis server yang sedang berjalan. Ini bisa diinstal secara lokal, melalui Docker, atau menggunakan layanan cloud seperti Redis Labs.
-   **Konektivitas**: Pastikan bot dapat terhubung ke Redis server Anda (periksa host, port, dan firewall).

---

## 3. Konfigurasi Environment (.env)

Semua konfigurasi koneksi dan perilaku Redis diatur melalui file `.env`.

| Variabel | Wajib | Deskripsi | Default |
| :--- | :--- | :--- | :--- |
| `REDIS_HOST` | Ya | Alamat host server Redis Anda. | `127.0.0.1` |
| `REDIS_PORT` | Ya | Port yang digunakan oleh Redis server. | `6379` |
| `REDIS_PASSWORD` | Tidak | Password untuk otentikasi ke Redis. Kosongkan jika tidak ada. | - |
| `REDIS_CONNECT_TIMEOUT` | Tidak | Waktu maksimum (ms) untuk menunggu koneksi berhasil. | `15000` |
| `REDIS_MAX_RETRY_TIME` | Tidak | Durasi maksimum (ms) bot akan mencoba menyambung kembali ke Redis sebelum menyerah. | `60000` |
| `REDIS_MAX_RETRIES` | Tidak | Jumlah maksimum percobaan koneksi ulang. | `10` |
| `REDIS_RECONNECT_DELAY`| Tidak | Jeda waktu (ms) antar percobaan koneksi ulang. | `5000` |
| `REDIS_MEMORY_THRESHOLD`| Tidak | Batas penggunaan memori (%) sebelum sistem peringatan aktif. | `80` |
| `REDIS_CPU_THRESHOLD` | Tidak | Batas penggunaan CPU (%) sebelum sistem peringatan aktif. | `80` |
| `REDIS_QUEUE_MAX_LENGTH`| Tidak | Panjang maksimum antrian pesan di Redis. | `1000` |
| `REDIS_RATE_LIMIT_WINDOW`| Tidak | Jendela waktu (ms) untuk rate limiting. | `60000` |
| `REDIS_RATE_LIMIT_MAX` | Tidak | Jumlah permintaan maksimum dalam satu jendela waktu. | `100` |
| `REDIS_RATE_LIMIT_THRESHOLD`| Tidak | Batas (%) penggunaan rate limit lokal sebelum beralih ke Redis. | `80` |
| `REDIS_SESSION_BACKUP_INTERVAL`| Tidak | Interval (detik) untuk melakukan backup sesi WhatsApp ke Redis. | `300` |
| `REDIS_CACHE_TTL` | Tidak | Waktu hidup default (detik) untuk data cache. | `3600` |

---

## 4. Bagaimana Redis Digunakan (Fitur)

Berikut adalah rincian bagaimana berbagai fitur bot bergantung pada Redis:

-   **Manajemen Sesi (`sessionManager.js`)**
    -   **Tujuan**: Menghindari scan QR code berulang kali saat bot di-restart.
    -   **Cara Kerja**: Sesi otentikasi WhatsApp secara periodik di-backup ke Redis. Saat bot dimulai, ia akan mencoba memulihkan sesi dari Redis.
    -   **Kunci Terkait**: `session:<clientId>`, `session:<clientId>:timestamp`

-   **Caching (`CacheManager.js`)**
    -   **Tujuan**: Mempercepat respons untuk data yang jarang berubah.
    -   **Cara Kerja**: Hasil dari panggilan API eksternal (seperti jadwal sholat, info anime, terjemahan) disimpan di Redis dengan waktu kedaluwarsa (TTL). Permintaan berikutnya akan mengambil data dari cache jika masih valid.
    -   **Kunci Terkait**: `cache:anime:<query>`, `cache:translate:<...>`, `cache:prayer_<...>`

-   **Rate Limiting (`RateLimitManager.js`)**
    -   **Tujuan**: Mencegah penyalahgunaan (abuse) bot oleh pengguna.
    -   **Cara Kerja**: Setiap kali pengguna menjalankan perintah, sebuah counter di Redis akan dinaikkan. Jika counter melebihi batas dalam jendela waktu yang ditentukan, permintaan selanjutnya akan ditolak.
    -   **Kunci Terkait**: `ratelimit:<identifier>`

-   **Manajemen Konfigurasi Dinamis**
    -   **Tujuan**: Memungkinkan admin mengubah perilaku bot secara real-time.
    -   **Cara Kerja**: Data seperti aturan auto-reply, daftar kata terlarang, dan pesan selamat datang disimpan dalam struktur data Redis (Hash, Set). Perintah admin akan memodifikasi data ini langsung di Redis, dan bot akan langsung menggunakan data yang sudah diperbarui.
    -   **Kunci Terkait**: `autoreply:global`, `autoreply:group:<groupId>`, `moderation:forbidden_words`, `welcome_messages`

-   **Manajemen State & Moderasi**
    -   **Tujuan**: Melacak status pengguna dan fitur yang sedang berjalan.
    -   **Cara Kerja**: Redis digunakan untuk menyimpan status sementara seperti sesi upload Google Drive, status cooldown akun Instagram, jumlah peringatan pengguna, dan status mute.
    -   **Kunci Terkait**: `gdrive_session:<userId>`, `instagram:account:<username>`, `moderation:warnings:<groupId>:<userId>`

-   **Antrian Pesan (Message Queue)**
    -   **Tujuan**: Menangani lonjakan pesan dan memastikan tidak ada pesan yang hilang.
    -   **Cara Kerja**: Pesan yang masuk dapat dimasukkan ke dalam antrian di Redis dan diproses satu per satu, mencegah "banjir" permintaan ke bot.
    -   **Kunci Terkait**: `message_queue`

---

## 5. Struktur Data (Redis Keys)

Untuk referensi teknis lengkap mengenai semua kunci (keys) yang digunakan bot di Redis, tipe datanya, deskripsi, dan contoh penggunaannya, silakan lihat dokumen terpisah:
-   [**Dokumentasi Kunci-Kunci Redis](./REDIS_KEYS.md)**

---

## 6. Troubleshooting

-   **Problem**: Bot crash saat startup dengan error `Redis connection failed`.
    -   **Solusi**:
        1.  Pastikan Redis server Anda berjalan.
        2.  Periksa `REDIS_HOST` dan `REDIS_PORT` di file `.env` Anda.
        3.  Jika Redis Anda menggunakan password, pastikan `REDIS_PASSWORD` sudah diisi dengan benar.
        4.  Periksa log firewall di server Anda untuk memastikan koneksi ke port Redis diizinkan.

-   **Problem**: Bot sering logout sendiri atau meminta scan QR ulang.
    -   **Solusi**: Ini bisa terjadi jika backup sesi ke Redis gagal. Periksa log bot untuk error terkait `SessionBackupManager` atau koneksi Redis. Pastikan Redis memiliki cukup memori.

-   **Problem**: Perubahan pada auto-reply atau kata terlarang tidak langsung aktif.
    -   **Solusi**: Periksa log bot untuk error koneksi Redis. Jika bot tidak dapat terhubung ke Redis, ia mungkin berjalan dalam mode fallback (jika ada) dan tidak dapat memuat konfigurasi terbaru.
