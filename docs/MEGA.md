# Panduan Fitur Mega.nz Uploader (Per-Akun Admin)

Dokumen ini menjelaskan cara mengkonfigurasi dan menggunakan fitur upload ke Mega.nz, di mana setiap admin dapat menghubungkan dan menggunakan akun Mega.nz pribadinya masing-masing.

## Daftar Isi
1.  [Konsep Utama](#1-konsep-utama)
2.  [Langkah 1: Konfigurasi Awal (.env)](#2-langkah-1-konfigurasi-awal-env)
3.  [Langkah 2: Menghubungkan Akun Mega](#3-langkah-2-menghubungkan-akun-mega)
4.  [Langkah 3: Cara Menggunakan Fitur Upload](#4-langkah-3-cara-menggunakan-fitur-upload)
5.  [Skenario Penggunaan Lengkap](#5-skenario-penggunaan-lengkap)
6.  [Troubleshooting](#6-troubleshooting)

---

## 1. Konsep Utama

Tidak seperti layanan lain yang menggunakan satu akun terpusat, fitur Mega.nz ini dirancang agar setiap admin dapat meng-upload file ke akun Mega.nz mereka sendiri. Ini memberikan beberapa keuntungan:

-   **Privasi**: File Anda tersimpan di ruang penyimpanan pribadi Anda, bukan di akun bersama.
-   **Manajemen Kuota**: Kuota transfer dan penyimpanan yang digunakan adalah kuota dari akun pribadi Anda, sehingga tidak akan mengganggu admin lain.
-   **Keamanan**: Kredensial Anda disimpan secara terenkripsi dan hanya digunakan saat Anda melakukan perintah upload.

---

## 2. Langkah 1: Konfigurasi Awal (.env)

Langkah pertama dan paling penting adalah menyiapkan "kunci rahasia" (secret key) yang akan digunakan bot untuk mengenkripsi semua password akun Mega. Kunci ini **wajib** diisi.

1.  Buka file `.env` Anda.
2.  Tambahkan baris berikut:

    ```
    MEGA_CREDENTIALS_SECRET=kunci_acak_yang_sangat_panjang_dan_aman
    ```

3.  Ganti `kunci_acak_yang_sangat_panjang_dan_aman` dengan teks acak Anda sendiri. Semakin panjang dan acak, semakin baik.

4.  (Opsional) Anda juga bisa mengatur folder tujuan default di dalam akun Mega Anda:

    ```
    MEGA_UPLOAD_FOLDER=/Root/FolderTujuanBot/
    ```
    Jika tidak diatur, file akan di-upload ke folder root akun Mega Anda.

5.  Simpan file `.env` dan **restart bot**.

---

## 3. Langkah 2: Menghubungkan Akun Mega

Setelah bot di-restart dengan kunci rahasia, setiap admin harus menghubungkan akun Mega mereka masing-masing.

**PENTING:** Perintah-perintah berikut harus dijalankan di **chat pribadi (PC)** dengan bot untuk menjaga keamanan kredensial Anda.

-   **Menghubungkan Akun (`/mega login`)**
    Gunakan perintah ini untuk mendaftarkan email dan password Mega Anda ke bot.
    ```
    /mega login emailanda@contoh.com password_akun_mega_anda
    ```
    Bot akan mengenkripsi password Anda, menyimpannya, dan secara otomatis akan mencoba menghapus pesan Anda yang berisi password tersebut.

-   **Memutus Koneksi Akun (`/mega logout`)**
    Gunakan perintah ini untuk menghapus kredensial Anda dari penyimpanan bot.
    ```
    /mega logout
    ```

-   **Mengecek Akun (`/mega account`)**
    Gunakan perintah ini untuk melihat akun email Mega yang sedang terhubung.
    ```
    /mega account
    ```

---

## 4. Langkah 3: Cara Menggunakan Fitur Upload

Setelah akun Anda terhubung, Anda bisa mulai meng-upload file.

### Upload File Tunggal

Gunakan perintah `/mega` untuk meng-upload satu file saja. File akan di-upload ke akun Mega Anda yang terhubung.

1.  **Dengan Caption**: Kirim file dan sertakan caption `/mega`.
2.  **Dengan Balasan (Reply)**: Balas pesan yang berisi file dengan pesan `/mega`.

### Sesi Multi-Upload

-   **Memulai Sesi (`/mega start`)**
    ```
    /mega start
    ```
    Memulai mode sesi. Semua file yang Anda kirim setelah ini akan otomatis di-upload ke akun Mega Anda.

-   **Mengakhiri Sesi (`/mega done`)**
    ```
    /mega done
    ```
    Mengakhiri mode sesi upload.

---

## 5. Skenario Penggunaan Lengkap

1.  **Admin (di PC dengan bot) menghubungkan akun:**
    > **/mega login email.admin@gmail.com password_rahasia_admin**

2.  **Bot membalas dan menghapus pesan asli:**
    > ✅ Akun Mega.nz Anda telah berhasil terhubung. Kredensial Anda disimpan dalam bentuk terenkripsi.

3.  **Admin memulai sesi upload (bisa di grup atau PC):**
    > **/mega start**

4.  **Bot membalas:**
    > ✅ Sesi upload Mega dimulai. Semua file yang Anda kirim sekarang akan diupload ke akun Mega Anda.\n\nKetik `/mega done` untuk mengakhiri sesi.

5.  **Admin mengirim beberapa file ke chat.** Bot akan memberi reaksi ✅ pada setiap file yang berhasil di-upload ke akun Mega admin tersebut.

6.  **Admin mengakhiri sesi:**
    > **/mega done**

7.  **Bot membalas:**
    > ✅ Sesi upload Mega telah diakhiri.

---

## 6. Troubleshooting

-   **Error: "Gagal login ke Mega.nz. Periksa kembali email dan password Anda..."**
    -   **Penyebab:** Email atau password yang Anda daftarkan melalui `/mega login` salah.
    -   **Solusi:** Jalankan kembali perintah `/mega login` dengan kredensial yang benar.

-   **Error: "Akun Mega.nz Anda belum terhubung..."**
    -   **Penyebab:** Anda mencoba menggunakan fitur upload (`/mega start` atau lainnya) sebelum menghubungkan akun.
    -   **Solusi:** Kirim pesan `/mega login <email> <password>` di chat pribadi dengan bot terlebih dahulu.

-   **Error: "MEGA_CREDENTIALS_SECRET is not defined..."**
    -   **Penyebab:** Anda belum mengatur kunci rahasia di file `.env`.
    -   **Solusi:** Ikuti [Langkah 1: Konfigurasi Awal](#2-langkah-1-konfigurasi-awal-env) dalam dokumentasi ini.
