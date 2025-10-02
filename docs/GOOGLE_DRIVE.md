# Panduan Lengkap Integrasi Google Drive

Dokumen ini menjelaskan cara mengkonfigurasi dan menggunakan fitur integrasi Google Drive pada bot WhatsApp dari awal hingga akhir.

## Daftar Isi
1.  [Prasyarat](#1-prasyarat)
2.  [Langkah 1: Konfigurasi Google Cloud Console](#2-langkah-1-konfigurasi-google-cloud-console)
3.  [Langkah 2: Konfigurasi Environment Bot](#3-langkah-2-konfigurasi-environment-bot)
4.  [Langkah 3: Otorisasi Bot](#4-langkah-3-otorisasi-bot)
5.  [Langkah 4: Referensi Perintah](#5-langkah-4-referensi-perintah)
6.  [Detail Teknis (Untuk Developer)](#6-detail-teknis-untuk-developer)

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
    -   Pada bagian **Test users**, klik **Add Users** dan tambahkan alamat email Google Anda. Ini penting agar Anda bisa melakukan otorisasi. Klik **Save and Continue**.

4.  **Buat Kredensial (OAuth 2.0 Client ID):**
    -   Navigasi ke **APIs & Services > Credentials**.
    -   Klik **+ Create Credentials** dan pilih **OAuth client ID**.
    -   Pilih **Desktop app** sebagai *Application type*.
    -   Beri nama (misal: "Bot WhatsApp Desktop Client").
    -   Klik **Create**.

5.  **Unduh File Kredensial:**
    -   Setelah client ID dibuat, sebuah pop-up akan muncul. Klik **DOWNLOAD JSON**.
    -   Ubah nama file yang diunduh menjadi `credentials.json`.
    -   Pindahkan file `credentials.json` ini ke dalam direktori `src/data/credentials/` pada proyek bot Anda.

---

## 3. Langkah 2: Konfigurasi Environment Bot

Buka file `.env` Anda dan isi variabel-variabel berikut sesuai dengan konfigurasi Anda.

| Variabel | Deskripsi | Contoh |
| :--- | :--- | :--- |
| `GOOGLE_DRIVE_CLIENT_ID` | Client ID dari file `credentials.json`. | `xxxxxxxx.apps.googleusercontent.com` |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Client Secret dari file `credentials.json`. | `GOCSPX-xxxxxxxx` |
| `GOOGLE_DRIVE_REDIRECT_URI` | Redirect URI dari file `credentials.json`. | `http://localhost` |
| `GOOGLE_DRIVE_FOLDER_ID` | ID folder utama di Google Drive tempat file akan diunggah jika tidak ada sesi folder. | `1a2b3c4d5e6f7g8h9i0j` |
| `GOOGLE_DRIVE_TOKEN_PATH` | Path ke file token. **Biarkan default**. | `src/data/credentials/token.json` |
| `GOOGLE_DRIVE_CREDENTIALS_PATH`| Path ke file kredensial. **Biarkan default**. | `src/data/credentials/credentials.json` |

**Catatan:** Untuk mendapatkan `GOOGLE_DRIVE_FOLDER_ID`, buka folder di Google Drive Anda dan salin bagian terakhir dari URL. Contoh: `https://drive.google.com/drive/folders/THIS_IS_THE_ID`.

---

## 4. Langkah 3: Otorisasi Bot

Setelah `credentials.json` ditempatkan dan file `.env` dikonfigurasi, jalankan skrip setup untuk mendapatkan token otorisasi.

1.  **Jalankan Skrip:**
    Di terminal, jalankan perintah berikut dari direktori root proyek:
    ```bash
    node scripts/setup-google-drive.js
    ```

2.  **Proses Otorisasi:**
    -   Terminal akan menampilkan sebuah URL. Salin URL tersebut dan buka di browser.
    -   Login dengan akun Google yang Anda tambahkan sebagai *test user* pada langkah sebelumnya.
    -   Izinkan akses yang diminta oleh aplikasi.
    -   Setelah itu, Anda akan diarahkan ke halaman yang menampilkan sebuah kode otorisasi. Salin kode tersebut.

3.  **Masukkan Kode:**
    -   Kembali ke terminal dan tempel (paste) kode yang sudah Anda salin, lalu tekan Enter.

4.  **Selesai:**
    -   Skrip akan membuat file `token.json` di `src/data/credentials/`. File ini digunakan oleh bot untuk mengakses Google Drive Anda.
    -   Sekarang fitur Google Drive siap digunakan.

---

## 5. Langkah 4: Referensi Perintah

| Command | Deskripsi |
|---|---|
| `/gdrive [caption]` | Mengunggah file (reply atau kirim dengan caption) ke folder Drive utama. |
| `/gdrive -folder [nama]` | Membuat folder baru dan memulai sesi upload ke folder tersebut. |
| `/gdrive folder [nama]` | Melanjutkan sesi upload ke folder yang sudah ada. |
| `/gdrive folders` | Melihat daftar 10 folder terakhir yang digunakan. |
| `/gdrive rename [lama] [baru]` | Mengganti nama folder yang tersimpan di riwayat. |
| `/gdrive done` | Mengakhiri sesi upload. |
| `/gdrive status` | Melihat status sesi upload yang sedang berjalan. |

---

## 6. Detail Teknis (Untuk Developer)

-   **Mode Upload:** Fitur ini mendukung dua mode:
    1.  **Single Upload:** Mengirim file dengan caption `/gdrive` akan langsung mengunggahnya ke folder utama (`GOOGLE_DRIVE_FOLDER_ID`).
    2.  **Multi-upload (Sesi):** Menggunakan `/gdrive -folder` atau `/gdrive folder` akan memulai sebuah sesi. Semua file yang dikirim setelah itu akan masuk ke folder sesi tersebut hingga diakhiri dengan `/gdrive done`.

-   **Manajemen Sesi & Riwayat:**
    -   Sesi upload aktif disimpan di Redis dengan kunci `gdrive_session:<userId>`.
    -   Riwayat folder yang pernah digunakan disimpan di Redis dengan kunci `drive:folders:<userId>`.
    -   Lihat `docs/REDIS_KEYS.md` untuk detail lebih lanjut.
