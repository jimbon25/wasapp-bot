# Panduan Lengkap Integrasi Google Drive

Dokumen ini menjelaskan cara mengkonfigurasi dan menggunakan fitur integrasi Google Drive pada bot WhatsApp dari awal hingga akhir.

## Daftar Isi
1.  [Prasyarat](#1-prasyarat)
2.  [Langkah 1: Konfigurasi Google Cloud Console](#2-langkah-1-konfigurasi-google-cloud-console)
3.  [Langkah 2: Menjalankan Skrip Setup Interaktif](#3-langkah-2-menjalankan-skrip-setup-interaktif)
4.  [Langkah 3: Referensi Perintah](#4-langkah-3-referensi-perintah)
5.  [Detail Teknis (Untuk Developer)](#5-detail-teknis-untuk-developer)

---

## 1. Prasyarat

-   Akun Google yang aktif.
-   Bot sudah terinstal dan berjalan.

---

## 2. Langkah 1: Konfigurasi Google Cloud Console

Untuk menggunakan Google Drive API, Anda perlu membuat kredensial dari Google Cloud Console.

1.  **Buat Proyek Baru:**
    -   Buka [Google Cloud Console](https://console.cloud.google.com/).
    -   Buat proyek baru (atau gunakan proyek yang sudah ada).

2.  **Aktifkan Google Drive API:**
    -   Di sidebar kiri, navigasi ke **APIs & Services > Library**.
    -   Cari "Google Drive API" dan klik **Enable**.

3.  **Konfigurasi OAuth Consent Screen:**
    -   Navigasi ke **APIs & Services > OAuth consent screen**.
    -   Pilih **External** dan klik **Create**.
    -   Isi nama aplikasi (misal: "WhatsApp Bot"), email Anda, dan email developer. Klik **Save and Continue**.
    -   Pada bagian **Scopes**, klik **Add or Remove Scopes**. Cari dan tambahkan scope `.../auth/drive.file`. Klik **Update**, lalu **Save and Continue**.
    -   Pada bagian **Test users**, klik **Add Users** dan tambahkan alamat email Google yang ingin Anda gunakan untuk otorisasi. Ini penting agar Anda bisa melakukan otorisasi.

4.  **Buat Kredensial (OAuth 2.0 Client ID):**
    -   Navigasi ke **APIs & Services > Credentials**.
    -   Klik **+ Create Credentials** dan pilih **OAuth client ID**.
    -   Pilih **Desktop app** sebagai *Application type*.
    -   Beri nama (misal: "Bot WhatsApp Desktop Client").
    -   Klik **Create**.

5.  **Unduh dan Tempatkan File Kredensial:**
    -   Setelah client ID dibuat, sebuah pop-up akan muncul. Klik **DOWNLOAD JSON**.
    -   Ubah nama file yang diunduh menjadi `credentials.json`.
    -   Pindahkan file `credentials.json` ini ke dalam direktori `src/data/credentials/` pada proyek bot Anda.

---

## 3. Langkah 2: Menjalankan Skrip Setup Interaktif

Setelah file `credentials.json` ditempatkan, proses otorisasi dan konfigurasi menjadi sangat mudah. Anda tidak perlu lagi mengubah file `.env`.

1.  **Jalankan Skrip:**
    Di terminal, jalankan perintah berikut dari direktori root proyek:
    ```bash
    node scripts/setup-google-drive.js
    ```

2.  **Gunakan Menu Manajemen:**
    Skrip akan menampilkan menu untuk mengelola akun Google Drive Anda.
    - **Untuk Pertama Kali:** Pilih **[A] Tambah Akun**.
        - Masukkan nama untuk akun tersebut (misal: "Drive Utama").
        - Masukkan ID folder Google Drive default tempat file akan diunggah. Untuk mendapatkan ID ini, buka folder di Google Drive, dan salin bagian akhir dari URL (contoh: `https://drive.google.com/drive/folders/INI_ADALAH_ID_FOLDER`).
    - **Otorisasi Akun:**
        - Setelah akun ditambahkan, pilih akun tersebut dari menu.
        - Salin **URL otorisasi** yang muncul di terminal dan buka di browser.
        - Login dengan akun Google yang benar dan izinkan akses.
        - Salin **kode otorisasi** yang Anda dapatkan dari browser.
        - Tempel kode tersebut kembali ke terminal dan tekan Enter.

3.  **Selesai:**
    -   Skrip akan menyimpan token dan menyelesaikan proses. Fitur Google Drive sekarang siap digunakan.
    -   Anda bisa menjalankan skrip ini lagi kapan saja untuk menambah akun lain, menghapus, atau mengotorisasi ulang akun yang sudah ada.

---

## 4. Langkah 3: Referensi Perintah

| Command | Deskripsi |
|---|---|
| `/gdrive [caption]` | Mengunggah file (reply atau kirim dengan caption) ke folder Drive utama. |
| `/gdrive -folder [nama]` | Membuat folder baru dan memulai sesi upload ke folder tersebut. |
| `/gdrive folder [nama]` | Melanjutkan sesi upload ke folder yang sudah ada. |
| `/gdrive folders` | Melihat daftar 10 folder terakhir yang digunakan. |
| `/gdrive rename [lama] [baru]` | Mengganti nama folder yang tersimpan di riwayat. |
| `/gdrive done` | Mengakhiri sesi upload. |
| `/gdrive status` | Melihat status sesi upload yang sedang berjalan. |
| `/gdrive accounts` | (Admin) Melihat daftar akun Google Drive yang terkonfigurasi dan akun yang sedang aktif. |
| `/gdrive set-account [nama_akun]` | (Admin) Mengganti akun Google Drive yang aktif untuk bot. *Nama akun tidak masalah huruf besar/kecil.* |

---

## 5. Detail Teknis (Untuk Developer)

-   **Konfigurasi:** Pengaturan otentikasi (path kredensial, path token, dan ID folder) kini dikelola dalam file `src/data/credentials/gdrive_config.json`, yang berisi sebuah array (daftar) objek konfigurasi akun.
-   **Akun Aktif:** Bot akan menggunakan akun yang diatur sebagai aktif melalui perintah `/gdrive set-account`. Jika belum diatur, bot akan menggunakan akun pertama dalam daftar `gdrive_config.json` sebagai default.
-   **Manajemen Sesi & Riwayat:**
    -   Sesi upload aktif disimpan di Redis dengan kunci `gdrive_session:<userId>:<accountName>`.
    -   Riwayat folder yang pernah digunakan disimpan di Redis dengan kunci `drive:folders:<userId>:<accountName>`.
    -   Lihat `docs/REDIS_KEYS.md` untuk detail lebih lanjut.