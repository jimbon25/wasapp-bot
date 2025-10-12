# Panduan Fitur Auto-Upload Media

Dokumen ini menjelaskan cara kerja, konfigurasi, dan penggunaan fitur upload media otomatis ke cloud storage (Google Drive atau Mega.nz).

## Daftar Isi
1.  [Konsep Utama](#1-konsep-utama)
2.  [Konfigurasi (.env)](#2-konfigurasi-env)
3.  [Cara Penggunaan](#3-cara-penggunaan)
4.  [Alur Kerja Teknis](#4-alur-kerja-teknis)
5.  [Troubleshooting](#5-troubleshooting)

---

## 1. Konsep Utama

Fitur Auto-Upload dirancang untuk menyederhanakan proses pengarsipan banyak file media dari grup WhatsApp tertentu ke cloud. Daripada mengunggah file satu per satu, bot akan secara cerdas:

1.  **Mendeteksi Media**: Secara otomatis mendeteksi ketika file media (gambar, video, dokumen) dikirim di grup yang telah dikonfigurasi.
2.  **Membuat Batch**: Mengumpulkan semua media yang dikirim oleh seorang admin dalam rentang waktu singkat ke dalam satu "batch" atau kelompok.
3.  **Menunggu Jeda (Debounce)**: Setelah media terakhir dikirim, bot akan menunggu selama periode waktu yang ditentukan (misalnya, 30 detik) untuk memastikan tidak ada file lain yang akan ditambahkan.
4.  **Memberi Konfirmasi**: Setelah jeda waktu berakhir, bot akan membalas pesan *pertama* dari batch tersebut, menanyakan admin apakah mereka ingin mengunggah semua file yang terkumpul.
5.  **Mengunggah ke Cloud**: Admin kemudian dapat membalas pesan konfirmasi dari bot dengan perintah `/upload drive` atau `/upload mega` untuk mengunggah seluruh batch ke layanan cloud yang dipilih.

Fitur ini sangat berguna untuk mengarsipkan dokumentasi, foto acara, atau file penting lainnya dari grup tanpa harus melakukannya secara manual.

---

## 2. Konfigurasi (.env)

Untuk mengaktifkan dan mengkonfigurasi fitur ini, Anda perlu mengatur variabel berikut di file `.env` Anda:

```env
# Auto Upload Feature (comma-separated group IDs)
AUTO_UPLOAD_GROUP_IDS=120363403219253424@g.us,120363049927123456@g.us

# Waktu jeda (dalam detik) sebelum bot meminta konfirmasi upload
AUTO_UPLOAD_DEBOUNCE_SECONDS=30
```

-   `AUTO_UPLOAD_GROUP_IDS`
    -   **Wajib diisi** untuk mengaktifkan fitur ini.
    -   Isi dengan satu atau lebih ID grup WhatsApp, dipisahkan dengan koma. Bot hanya akan memantau media di grup-grup ini.
    -   Untuk mendapatkan ID grup, admin dapat menggunakan perintah `/groupid` di dalam grup target.

-   `AUTO_UPLOAD_DEBOUNCE_SECONDS`
    -   Waktu (dalam detik) yang ditunggu bot setelah pesan media terakhir diterima sebelum mengirimkan prompt konfirmasi.
    -   Nilai defaultnya adalah `30` detik. Anda bisa menaikkan nilai ini jika Anda sering mengirim banyak file dengan jeda yang lebih lama.

**Penting:** Setelah mengubah nilai-nilai ini, restart bot agar perubahan diterapkan.

---

## 3. Cara Penggunaan

Berikut adalah langkah-langkah untuk menggunakan fitur auto-upload:

1.  **Kirim File Media**: Di dalam salah satu grup yang terdaftar di `AUTO_UPLOAD_GROUP_IDS`, kirim satu atau beberapa file media (gambar, video, dll.). Anda bisa mengirimnya satu per satu atau sekaligus.

2.  **Tunggu Konfirmasi Bot**: Setelah Anda selesai mengirim semua file, tunggu beberapa saat (sesuai `AUTO_UPLOAD_DEBOUNCE_SECONDS`). Bot akan secara otomatis membalas pesan **pertama** yang Anda kirim dengan pesan konfirmasi.
    > Pesan Bot: "Saya mendeteksi ada 5 file media. Balas pesan *ini* untuk menyimpan semuanya:\n/upload drive\n/upload mega"

3.  **Balas untuk Mengunggah**: Balas (reply) pesan konfirmasi dari bot tersebut dengan salah satu perintah berikut:
    -   `/upload drive` untuk mengunggah semua file dalam batch ke Google Drive.
    -   `/upload mega` untuk mengunggah semua file ke akun Mega.nz Anda yang terhubung.

4.  **Proses Upload**: Bot akan mulai mengunggah semua file dalam batch.
    -   Untuk **Google Drive**, bot akan membuat folder baru dengan nama berdasarkan tanggal dan waktu, lalu mengunggah semua file ke dalamnya.
    -   Untuk **Mega.nz**, file akan diunggah ke folder default yang telah Anda atur.

5.  **Selesai**: Setelah semua file berhasil diunggah, bot akan memberikan konfirmasi akhir beserta link ke folder (untuk Google Drive) atau daftar link file (untuk Mega.nz).

---

## 4. Alur Kerja Teknis

1.  Pesan masuk diperiksa di `clientSetup.js`.
2.  Jika pesan berisi media, bukan perintah, dikirim di grup yang valid, dan `AUTO_UPLOAD_GROUP_IDS` telah diatur, logika batching di `uploadBatchManager.js` dipicu.
3.  Setiap pesan media dari admin yang sama di grup yang sama ditambahkan ke sebuah "batch" yang disimpan dalam `Map`.
4.  Sebuah `setTimeout` (timer) diatur ulang setiap kali pesan media baru dari admin tersebut masuk.
5.  Jika timer selesai (tidak ada media baru dalam periode debounce), bot akan mengirim pesan konfirmasi dengan membalas pesan pertama dalam batch.
6.  Ketika admin membalas pesan konfirmasi tersebut dengan `/upload`, perintah `upload.js` dieksekusi.
7.  Perintah `/upload` mengambil batch yang tersimpan, lalu melakukan iterasi untuk mengunduh setiap media dan mengunggahnya ke layanan cloud yang dipilih (`googleDriveService.js` atau `megaService.js`).
8.  Setelah selesai, batch akan dihapus dari `uploadBatchManager`.

---

## 5. Troubleshooting

-   **Bot tidak memberikan konfirmasi upload setelah saya mengirim file.**
    -   **Penyebab**: Pastikan grup saat ini sudah ditambahkan ke `AUTO_UPLOAD_GROUP_IDS` di file `.env`.
    -   **Solusi**: Dapatkan ID grup dengan `/groupid`, tambahkan ke `.env`, lalu restart bot.

-   **Perintah `/upload drive` atau `/upload mega` tidak berfungsi.**
    -   **Penyebab**: Anda harus *membalas (reply)* pesan konfirmasi dari bot, bukan mengirimnya sebagai pesan baru.
    -   **Solusi**: Cari pesan konfirmasi dari bot, lalu reply dengan perintah yang sesuai.

-   **Upload ke Google Drive gagal.**
    -   **Penyebab**: Konfigurasi Google Drive mungkin belum selesai atau token sudah kedaluwarsa.
    -   **Solusi**: Ikuti panduan di `docs/GOOGLE_DRIVE.md` dan pastikan Anda telah menjalankan `node scripts/setup-google-drive.js` dengan sukses.

-   **Upload ke Mega.nz gagal.**
    -   **Penyebab**: Anda belum menghubungkan akun Mega.nz Anda.
    -   **Solusi**: Kirim perintah `/mega login <email> <password>` di chat pribadi dengan bot terlebih dahulu.
