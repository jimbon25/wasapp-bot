# Panduan Fitur Notifikasi Gmail (Multi-Akun)

Dokumen ini menjelaskan cara mengkonfigurasi dan menggunakan fitur notifikasi email dari beberapa akun Gmail secara bersamaan.

## Daftar Isi
1.  [Konsep Utama](#1-konsep-utama)
2.  [Langkah 1: Konfigurasi Google Cloud Console](#2-langkah-1-konfigurasi-google-cloud-console)
3.  [Langkah 2: Konfigurasi Environment Bot (.env)](#3-langkah-2-konfigurasi-environment-bot-env)
4.  [Langkah 3: Otorisasi Setiap Akun](#4-langkah-3-otorisasi-setiap-akun)
5.  [Alur Kerja Teknis](#5-alur-kerja-teknis)
6.  [Troubleshooting](#6-troubleshooting)

---

## 1. Konsep Utama

Fitur ini memungkinkan bot untuk secara otomatis memeriksa **beberapa akun Gmail** untuk email yang belum dibaca. Ketika email baru ditemukan di salah satu akun, bot akan mengirimkan notifikasi yang berisi informasi dasar (pengirim, subjek, cuplikan) ke nomor WhatsApp yang telah ditentukan **khusus untuk akun tersebut**.

Untuk mencegah notifikasi berulang secara permanen, bot akan melakukan dua tindakan pada email yang telah diproses:
1.  **Menandai sebagai sudah dibaca** (menghapus label `UNREAD`).
2.  **Memberikan label "stempel"** (contoh: `NotifBot-Pribadi`) sebagai penanda tambahan.

---

## 2. Langkah 1: Konfigurasi Google Cloud Console

Langkah-langkah di Google Cloud Console sebagian besar tetap sama.

1.  **Buat atau Pilih Proyek** di [Google Cloud Console](https://console.cloud.google.com/).
2.  **Aktifkan Gmail API** melalui menu **APIs & Services > Library**.
3.  **Konfigurasi OAuth Consent Screen**:
    *   Pilih **External**.
    *   Isi nama aplikasi dan email.
    *   Pada bagian **Test users**, klik **+ ADD USERS** dan tambahkan **semua alamat email Google** yang ingin Anda pantau. Jika Anda ingin memantau 3 akun, tambahkan ketiganya di sini.

4.  **Buat Kredensial (OAuth 2.0 Client ID)**:
    *   Pilih **Desktop app** sebagai tipe aplikasi.
    *   Setelah dibuat, klik **DOWNLOAD JSON**.

5.  **Siapkan File Kredensial**:
    *   File yang Anda unduh (biasanya bernama `client_secret_....json` atau `credentials.json`) adalah "KTP" untuk aplikasi Anda.
    *   **Poin Penting:** Anda hanya perlu **satu file** ini. Nanti, Anda akan menyalin dan mengganti nama file ini untuk setiap akun yang Anda konfigurasikan di langkah berikutnya.

---

## 3. Langkah 2: Konfigurasi Environment Bot (.env)

Buka file `.env` Anda dan gunakan format berurutan untuk setiap akun Gmail.

```env
# Gmail API Notification Settings
GMAIL_ENABLED=true
GMAIL_POLLING_INTERVAL_SECONDS=60

# --- Akun Gmail Pertama ---
GMAIL_ACCOUNT_1_NAME="Pribadi"
GMAIL_ACCOUNT_1_CREDENTIALS_PATH="src/data/credentials/credentials-gmail-pribadi.json"
GMAIL_ACCOUNT_1_TOKEN_PATH="src/data/credentials/token-gmail-pribadi.json"
GMAIL_ACCOUNT_1_TARGET_NUMBERS="62812xxxx@c.us"
GMAIL_ACCOUNT_1_PROCESSED_LABEL="NotifBot-Pribadi"

# --- Akun Gmail Kedua (Opsional) ---
GMAIL_ACCOUNT_2_NAME="Kerja"
GMAIL_ACCOUNT_2_CREDENTIALS_PATH="src/data/credentials/credentials-gmail-kerja.json"
GMAIL_ACCOUNT_2_TOKEN_PATH="src/data/credentials/token-gmail-kerja.json"
GMAIL_ACCOUNT_2_TARGET_NUMBERS="62857xxxx@c.us,62813xxxx@c.us"
GMAIL_ACCOUNT_2_PROCESSED_LABEL="NotifBot-Kerja"

# --- Akun Gmail Ketiga (Opsional) ---
GMAIL_ACCOUNT_3_NAME="Project"
GMAIL_ACCOUNT_3_CREDENTIALS_PATH="src/data/credentials/credentials-gmail-project.json"
GMAIL_ACCOUNT_3_TOKEN_PATH="src/data/credentials/token-gmail-project.json"
GMAIL_ACCOUNT_3_TARGET_NUMBERS="62899xxxx@c.us"
GMAIL_ACCOUNT_3_PROCESSED_LABEL="NotifBot-Project"
```

**Penjelasan Variabel:**
- `GMAIL_ENABLED`: Saklar utama untuk mengaktifkan/menonaktifkan semua notifikasi Gmail.
- `GMAIL_ACCOUNT_1_NAME`: Nama panggilan unik untuk akun (akan muncul saat setup).
- `GMAIL_ACCOUNT_1_CREDENTIALS_PATH`: Path ke file kredensial. Salin file JSON yang Anda unduh dari Google dan ganti namanya sesuai path ini.
- `GMAIL_ACCOUNT_1_TOKEN_PATH`: Path tempat token otorisasi akan disimpan. **Harus unik** untuk setiap akun.
- `GMAIL_ACCOUNT_1_TARGET_NUMBERS`: Nomor WhatsApp tujuan notifikasi **khusus untuk akun ini**.
- `GMAIL_ACCOUNT_1_PROCESSED_LABEL`: Nama label unik yang akan dibuat di akun Gmail ini.

---

## 4. Langkah 3: Otorisasi Setiap Akun

Skrip otorisasi sekarang bersifat interaktif. Anda perlu menjalankan proses ini untuk setiap akun yang Anda tambahkan.

1.  **Jalankan Skrip:**
    Di terminal, jalankan perintah:
    ```bash
    node scripts/setup-gmail.js
    ```

2.  **Pilih Akun:**
    Terminal akan menampilkan daftar akun yang Anda konfigurasi di `.env`. Masukkan nomor yang sesuai dengan akun yang ingin Anda otorisasi (misal: `1` untuk "Pribadi").

3.  **Proses Otorisasi di Browser:**
    *   Salin URL yang muncul di terminal dan buka di browser.
    *   Login dengan akun Google yang benar (pastikan sesuai dengan yang Anda pilih).
    *   Izinkan akses yang diminta.
    *   Salin kode otorisasi yang ditampilkan.

4.  **Masukkan Kode ke Terminal:**
    *   Tempel kode tersebut di terminal dan tekan Enter.
    *   Skrip akan membuat file token yang sesuai (misal: `token-gmail-pribadi.json`).

5.  **Ulangi untuk Akun Lain:**
    Jalankan kembali `node scripts/setup-gmail.js` dan pilih akun lain (misal: `2` untuk "Kerja") untuk mengotorisasinya. Lakukan ini sampai semua akun Anda memiliki file token-nya masing-masing.

6.  **Restart Bot:** Setelah semua akun diotorisasi, restart bot Anda.

---

## 5. Alur Kerja Teknis

1.  Saat bot dimulai, ia akan memeriksa `GMAIL_ENABLED` dan menginisialisasi sebuah klien API untuk **setiap akun** yang memiliki file token yang valid.
2.  Bot memulai *polling* (pemeriksaan berkala) setiap `GMAIL_POLLING_INTERVAL_SECONDS`.
3.  Setiap kali pemeriksaan, bot akan melakukan loop untuk **setiap akun yang aktif**:
    a.  Meminta daftar email dengan kriteria: `is:unread` DAN `TIDAK memiliki label` yang ditentukan.
    b.  Untuk setiap email, bot mengambil detail pengirim, subjek, dan cuplikan.
    c.  Mengirim notifikasi ke semua nomor di `TARGET_NUMBERS` yang **spesifik untuk akun tersebut**.
    d.  **Menandai email sebagai sudah dibaca** (menghapus label `UNREAD`) dan **menambahkan label stempel** (misal: `NotifBot-Pribadi`) untuk memastikan tidak ada notifikasi ganda.

---

## 6. Troubleshooting

-   **Salah satu akun saya tidak muncul saat menjalankan `setup-gmail.js`?**
    *   **Penyebab:** Kemungkinan besar ada kesalahan penomoran pada nama variabel di file `.env`.
    *   **Solusi:** Periksa kembali file `.env` Anda. Pastikan Anda menggunakan awalan `GMAIL_ACCOUNT_1_...`, `GMAIL_ACCOUNT_2_...`, `GMAIL_ACCOUNT_3_...`, dan seterusnya secara berurutan tanpa ada nomor yang terlewat atau terduplikasi.

-   **Notifikasi tidak muncul untuk salah satu akun?**
    *   Pastikan `GMAIL_ENABLED=true`.
    *   Pastikan `GMAIL_ACCOUNT_X_TARGET_NUMBERS` untuk akun tersebut sudah diisi dengan benar.
    *   Pastikan file `credentials-gmail-namaakun.json` dan `token-gmail-namaakun.json` ada di direktori yang benar dan sudah diotorisasi.

-   **Kenapa email saya ditandai sudah dibaca?**
    *   Ini adalah perilaku normal dari sistem perbaikan bug terbaru untuk mencegah notifikasi berulang. Dengan menandainya sebagai sudah dibaca, bot secara pasti tidak akan mengambilnya lagi di siklus berikutnya.
