# Panduan Fitur Mega.nz Uploader

Dokumen ini menjelaskan cara mengkonfigurasi dan menggunakan fitur upload ke Mega.nz, termasuk mode upload tunggal dan mode sesi untuk banyak file.

## Daftar Isi
1.  [Fitur Utama](#1-fitur-utama)
2.  [Konfigurasi (.env)](#2-konfigurasi-env)
3.  [Cara Penggunaan](#3-cara-penggunaan)
4.  [Skenario Penggunaan](#4-skenario-penggunaan)
5.  [Troubleshooting](#5-troubleshooting)

---

## 1. Fitur Utama

-   **Upload File Tunggal**: Kemudahan untuk meng-upload satu file dengan cepat tanpa memulai sesi.
-   **Sesi Multi-Upload**: Memulai "mode sesi" di mana semua file yang dikirim akan di-upload secara otomatis ke folder yang sama.
-   **Folder Terpusat**: Semua file di-upload ke satu folder default yang telah dikonfigurasi di file `.env`, menyederhanakan manajemen file.

---

## 2. Konfigurasi (.env)

Untuk mengaktifkan fitur ini, Anda perlu menambahkan kredensial akun Mega.nz Anda ke dalam file `.env` di direktori utama bot.

Buka file `.env` dan isi variabel-variabel berikut:

| Variabel | Wajib | Deskripsi | 
| :--- | :--- | :--- | 
| `MEGA_EMAIL` | Ya | Alamat email yang terdaftar di akun Mega.nz Anda. | 
| `MEGA_PASSWORD` | Ya | Kata sandi akun Mega.nz Anda. **Penting:** Menyimpan kata sandi dalam bentuk teks biasa memiliki risiko keamanan. Pastikan file `.env` Anda aman. | 
| `MEGA_UPLOAD_FOLDER`| Tidak | Path folder di Mega.nz tempat file akan di-upload. Jika tidak diisi, file akan di-upload ke folder root. Contoh: `/Root/WabotUploads/` | 

Setelah mengisi variabel di atas, simpan file `.env` dan restart bot agar konfigurasi baru dapat dimuat.

---

## 3. Cara Penggunaan

Setelah konfigurasi selesai, Anda dapat menggunakan perintah-perintah berikut.

### Upload File Tunggal

Gunakan perintah `/mega` untuk meng-upload satu file saja. Ini bisa dilakukan dengan dua cara:

1.  **Dengan Caption**: Kirim file (gambar, video, atau dokumen) dan sertakan caption `/mega`.
2.  **Dengan Balasan (Reply)**: Balas (reply) pesan yang berisi file dengan pesan `/mega`.

Bot akan meng-upload file tersebut dan membalas dengan link-nya.

### Sesi Multi-Upload

Ini adalah mode yang efisien untuk meng-upload banyak file sekaligus.

-   **Memulai Sesi**
    ```
    /mega start
    ```
    Setelah mengirim perintah ini, bot akan masuk ke mode sesi. Bot akan membalas untuk mengonfirmasi bahwa sesi telah dimulai.

-   **Mengirim File**
    Setelah sesi aktif, cukup kirimkan file-file Anda (gambar, video, dokumen) satu per satu ke chat. Bot akan secara otomatis meng-upload setiap file yang masuk dan memberikan reaksi (reaction) ✅ pada pesan Anda sebagai tanda upload berhasil.

-   **Mengakhiri Sesi**
    ```
    /mega done
    ```
    Setelah Anda selesai mengirim semua file, kirim perintah ini untuk keluar dari mode sesi. Bot akan memberikan konfirmasi bahwa sesi telah berakhir.

---

## 4. Skenario Penggunaan

Berikut adalah contoh alur kerja lengkap untuk meng-upload 3 file ke Mega.nz.

1.  **Anda memulai sesi:**
    > **/mega start**

2.  **Bot membalas:**
    > ✅ Sesi upload Mega dimulai. Semua file yang Anda kirim sekarang akan diupload ke folder default.\n\nKetik `/mega done` untuk mengakhiri sesi.

3.  **Anda mengirim file pertama:**
    > (Anda mengirim file `foto_liburan.jpg`)

4.  **Bot merespons:**
    > (Bot memberikan reaksi ✅ pada pesan gambar Anda)

5.  **Anda mengirim file kedua dan ketiga:**
    > (Anda mengirim file `video_pantai.mp4` dan `catatan_perjalanan.pdf`)

6.  **Bot merespons:**
    > (Bot memberikan reaksi ✅ pada setiap pesan file tersebut)

7.  **Anda mengakhiri sesi:**
    > **/mega done**

8.  **Bot membalas:**
    > ✅ Sesi upload Mega telah diakhiri.

Ketiga file tersebut sekarang sudah berhasil di-upload ke folder yang Anda tentukan di `.env`.

---

## 5. Troubleshooting

-   **Error: "Failed to login to Mega.nz..."**
    -   **Penyebab:** Email atau password di file `.env` salah.
    -   **Solusi:** Periksa kembali `MEGA_EMAIL` dan `MEGA_PASSWORD` Anda, pastikan tidak ada salah ketik.

-   **Error: "EAGAIN (-3): A temporary congestion..."**
    -   **Penyebab:** Ini adalah error dari server Mega.nz yang menandakan server sedang sibuk atau mengalami gangguan sementara.
    -   **Solusi:** Ini bukan kesalahan pada bot. Coba lagi dalam beberapa menit.

-   **Upload Gagal Tanpa Pesan Error yang Jelas**
    -   **Penyebab:** Bisa jadi karena koneksi internet bot terputus atau file yang Anda kirim rusak (corrupt).
    -   **Solusi:** Pastikan koneksi internet stabil dan coba kirim file lain yang valid.
