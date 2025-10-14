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

1.  **Mendeteksi Media**: Secara otomatis mendeteksi ketika file media (gambar, video, dokumen) dikirim oleh **siapa pun** di grup yang telah dikonfigurasi.
2.  **Membuat Batch Grup**: Mengumpulkan semua media yang terkirim dalam rentang waktu singkat ke dalam satu "batch" atau kelompok milik grup tersebut.
3.  **Menunggu Jeda (Debounce)**: Setelah media terakhir dikirim, bot akan menunggu selama periode waktu yang ditentukan (misalnya, 30 detik) untuk memastikan tidak ada file lain yang akan ditambahkan.
4.  **Memberi Konfirmasi**: Setelah jeda waktu berakhir, bot akan mengirimkan **pesan baru** ke grup, yang berisi informasi jumlah file yang terkumpul dan pilihan tindakan untuk para admin.
5.  **Eksekusi oleh Admin**: Seorang admin kemudian dapat membalas pesan konfirmasi dari bot tersebut untuk mengunggah seluruh batch ke cloud, atau membatalkannya.

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

1.  **Kirim File Media**: Siapa pun di dalam grup yang terdaftar di `AUTO_UPLOAD_GROUP_IDS` dapat mengirim satu atau beberapa file media.

2.  **Tunggu Konfirmasi Bot**: Setelah file media terakhir dikirim, tunggu beberapa saat (sesuai `AUTO_UPLOAD_DEBOUNCE_SECONDS`). Bot akan secara otomatis mengirimkan **pesan baru** ke dalam grup.
    > Pesan Bot: "Saya mendeteksi ada 5 file media dari anggota grup. Admin dapat membalas pesan *ini* untuk menyimpan semuanya:

/upload drive
/upload mega

Atau ketik /upload cancel untuk membatalkan."

3.  **Admin Memilih Tindakan**:
    -   **Untuk Mengunggah**: Seorang admin harus **membalas (reply) pesan konfirmasi dari bot tersebut** dengan perintah `/upload drive` atau `/upload mega`.
    -   **Untuk Membatalkan**: Seorang admin dapat mengirim perintah `/upload cancel` di grup untuk membatalkan seluruh batch. Perintah ini tidak perlu me-reply pesan bot.

4.  **Proses Upload (jika tidak dibatalkan)**: Bot akan mulai mengunggah semua file dalam batch.
    -   Untuk **Google Drive**, bot akan membuat folder baru dengan nama berdasarkan tanggal dan waktu, lalu mengunggah semua file ke dalamnya.
    -   Untuk **Mega.nz**, file akan diunggah ke folder default yang telah diatur oleh admin yang menjalankan perintah.

5.  **Selesai**: Setelah semua file berhasil diunggah, bot akan memberikan konfirmasi akhir beserta link ke folder (untuk Google Drive) atau daftar link file (untuk Mega.nz).

---

## 4. Alur Kerja Teknis

1.  Pesan masuk diperiksa di `clientSetup.js`.
2.  Jika pesan berisi media, bukan perintah, dan dikirim di grup yang valid, logika batching di `uploadBatchManager.js` dipicu.
3.  Kunci batch dibuat hanya berdasarkan `groupId`, menjadikannya milik grup.
4.  Setiap pesan media dari siapa pun di grup tersebut ditambahkan ke "batch" grup.
5.  Sebuah `setTimeout` (timer) diatur ulang setiap kali pesan media baru masuk.
6.  Jika timer selesai, bot akan mengirim **pesan konfirmasi baru** ke grup.
7.  Admin dapat merespons dengan beberapa cara:
    -   **`/upload drive` atau `/upload mega` (sebagai balasan pesan bot)**: Perintah `upload.js` dieksekusi. Ia mengambil batch grup yang tersimpan, lalu melakukan iterasi untuk mengunduh dan mengunggah setiap media.
    -   **`/upload cancel`**: Perintah `upload.js` dieksekusi. Ia akan menemukan batch grup yang aktif, membatalkan timer, dan menghapus batch dari `uploadBatchManager`.
8.  Setelah selesai (baik upload maupun cancel), batch akan dihapus dari `uploadBatchManager`.

---

## 5. Troubleshooting

-   **Bot tidak memberikan konfirmasi upload setelah saya mengirim file.**
    -   **Penyebab**: Pastikan grup saat ini sudah ditambahkan ke `AUTO_UPLOAD_GROUP_IDS` di file `.env`.
    -   **Solusi**: Dapatkan ID grup dengan `/groupid`, tambahkan ke `.env`, lalu restart bot.

-   **Perintah `/upload drive` atau `/upload mega` tidak berfungsi.**
    -   **Penyebab**: Anda harus *membalas (reply)* **pesan konfirmasi yang dikirim oleh bot**, bukan mengirimnya sebagai pesan baru atau membalas pesan media dari pengguna lain.
    -   **Solusi**: Cari pesan konfirmasi dari bot, lalu reply dengan perintah yang sesuai.

-   **Upload ke Google Drive gagal.**
    -   **Penyebab**: Konfigurasi Google Drive mungkin belum selesai atau token sudah kedaluwarsa.
    -   **Solusi**: Ikuti panduan di `docs/GOOGLE_DRIVE.md` dan pastikan Anda telah menjalankan `node scripts/setup-google-drive.js` dengan sukses.

-   **Upload ke Mega.nz gagal.**
    -   **Penyebab**: Admin yang menjalankan perintah belum menghubungkan akun Mega.nz-nya.
    -   **Solusi**: Admin tersebut harus mengirim perintah `/mega login <email> <password>` di chat pribadi dengan bot terlebih dahulu.