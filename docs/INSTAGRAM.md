# Panduan Fitur Instagram Downloader

Fitur ini memungkinkan Anda untuk mengunduh postingan, Reels, dan Stories dari Instagram langsung melalui WhatsApp. Fitur ini dirancang agar tangguh dengan sistem rotasi akun dan cooldown otomatis untuk menghindari pemblokiran dari Instagram.

## Daftar Isi
1.  [Fitur Utama](#1-fitur-utama)
2.  [Konfigurasi](#2-konfigurasi)
3.  [Cara Penggunaan](#3-cara-penggunaan)
4.  [Cara Kerja (Detail Teknis)](#4-cara-kerja-detail-teknis)
5.  [Troubleshooting](#5-troubleshooting)

---

## 1. Fitur Utama

-   **Download Konten:** Mendukung unduhan untuk Postingan (gambar dan video), Reels, dan Stories.
-   **Rotasi Akun Otomatis:** Bot dapat menggunakan hingga 4 akun Instagram secara bergantian. Jika satu akun gagal atau terkena limit, bot akan otomatis mencoba dengan akun berikutnya.
-   **Sistem Cooldown Cerdas:** Jika sebuah akun terkena rate-limit, gagal login, atau diblokir sementara, bot akan memberlakukan masa jeda (cooldown) pada akun tersebut dan tidak akan menggunakannya untuk sementara waktu.

---

## 2. Konfigurasi

Untuk menggunakan fitur ini, Anda perlu mengkonfigurasi setidaknya satu akun Instagram di file `.env`.

Buka file `.env` Anda dan isi variabel-variabel berikut:

| Variabel | Deskripsi |
| :--- | :--- |
| `INSTAGRAM_ACCOUNT_1_USERNAME` | Username akun Instagram pertama Anda. |
| `INSTAGRAM_ACCOUNT_1_PASSWORD` | Password akun Instagram pertama Anda. |
| `INSTAGRAM_ACCOUNT_2_USERNAME` | (Opsional) Username akun kedua. |
| `INSTAGRAM_ACCOUNT_2_PASSWORD` | (Opsional) Password akun kedua. |
| `INSTAGRAM_ACCOUNT_3_USERNAME` | (Opsional) Username akun ketiga. |
| `INSTAGRAM_ACCOUNT_3_PASSWORD` | (Opsional) Password akun ketiga. |
| `INSTAGRAM_ACCOUNT_4_USERNAME` | (Opsional) Username akun keempat. |
| `INSTAGRAM_ACCOUNT_4_PASSWORD` | (Opsional) Password akun keempat. |

**Penting:**
- Semakin banyak akun yang Anda konfigurasikan, semakin baik ketahanan bot terhadap rate-limit dari Instagram.
- Pastikan akun yang digunakan adalah akun yang valid dan aktif.

Variabel-variabel berikut juga dapat disesuaikan untuk mengatur perilaku bot:

| Variabel | Deskripsi | Default |
| :--- | :--- | :--- |
| `INSTAGRAM_RETRY_DELAY` | Jeda (ms) sebelum mencoba lagi dengan akun lain. | `5000` (5 detik) |
| `INSTAGRAM_MAX_RETRIES` | Jumlah percobaan maksimal sebelum menyerah. | `4` |
| `INSTAGRAM_COOLDOWN_RATE_LIMITED` | Durasi cooldown (ms) jika akun terkena rate limit. | `1800000` (30 menit) |
| `INSTAGRAM_COOLDOWN_AUTH_FAILED` | Durasi cooldown (ms) jika login gagal. | `3600000` (1 jam) |
| `INSTAGRAM_COOLDOWN_BLOCKED` | Durasi cooldown (ms) jika akun diblokir. | `86400000` (24 jam) |

---

## 3. Cara Penggunaan

Gunakan perintah `/download` diikuti dengan URL Instagram yang valid.

**Sintaks:**
`/download [URL Instagram]`

**Contoh:**
-   **Postingan:** `/download https://www.instagram.com/p/Cxyz.../`
-   **Reels:** `/download https://www.instagram.com/reel/Cxyz.../`
-   **Stories:** `/download https://www.instagram.com/stories/username/1234.../`

Bot akan memproses permintaan dan mengirimkan file media (gambar atau video) sebagai dokumen.

---

## 4. Cara Kerja (Detail Teknis)

1.  **Permintaan Masuk:** Saat perintah `/download` diterima, bot akan memilih akun Instagram yang "tersedia" dari daftar yang dikonfigurasi.
2.  **Pemilihan Akun:** Akun dianggap tersedia jika tidak sedang dalam masa cooldown atau terblokir.
3.  **Proses Unduh:** Bot menggunakan `yt-dlp` dengan kredensial akun yang dipilih untuk mengunduh konten.
4.  **Penanganan Error:**
    -   Jika unduhan berhasil, akun ditandai sebagai sukses.
    -   Jika unduhan gagal karena error spesifik (seperti rate-limit atau login gagal), bot akan:
        a. Menandai akun saat ini dengan status error dan memberlakukannya masa cooldown. Status ini disimpan di Redis dengan kunci `instagram:account:<username>`.
        b. Beralih ke akun berikutnya yang tersedia.
        c. Mencoba mengunduh lagi.
    -   Proses ini berlanjut hingga unduhan berhasil atau semua akun sudah dicoba.
5.  **Penyimpanan Status:** Status setiap akun (percobaan gagal, masa cooldown) disimpan di Redis untuk persistensi. Lihat `docs/REDIS_KEYS.md` untuk detail.

---

## 5. Troubleshooting

-   **"Semua akun Instagram sedang dalam cooldown. Silakan coba lagi nanti."**
    -   **Penyebab:** Semua akun yang Anda konfigurasikan telah gagal baru-baru ini (misalnya karena terlalu banyak permintaan) dan sekarang sedang dalam masa jeda.
    -   **Solusi:** Tunggu hingga masa cooldown selesai (default 30 menit hingga 24 jam tergantung jenis error). Anda juga bisa menambahkan lebih banyak akun di file `.env` untuk meningkatkan ketahanan.

-   **"Media tidak tersedia atau bersifat private."**
    -   **Penyebab:** URL yang Anda berikan merujuk ke akun Instagram yang di-private, atau postingan tersebut telah dihapus.
    -   **Solusi:** Bot tidak dapat mengunduh dari akun private. Pastikan akun target bersifat publik.

-   **"Gagal mengunduh konten."**
    -   **Penyebab:** Bisa jadi karena masalah jaringan, URL tidak valid, atau error tak terduga dari `yt-dlp`.
    -   **Solusi:** Pastikan URL valid dan coba lagi setelah beberapa saat. Jika masalah berlanjut, periksa log bot untuk detail error.
