# Panduan Fitur Notifikasi Gmail

Dokumen ini menjelaskan cara mengkonfigurasi dan menggunakan fitur notifikasi email baru dari Gmail.

## Daftar Isi
1.  [Konsep Utama](#1-konsep-utama)
2.  [Langkah 1: Konfigurasi Google Cloud Console](#2-langkah-1-konfigurasi-google-cloud-console)
3.  [Langkah 2: Konfigurasi Environment Bot](#3-langkah-2-konfigurasi-environment-bot)
4.  [Langkah 3: Otorisasi Bot](#4-langkah-3-otorisasi-bot)
5.  [Alur Kerja Teknis](#5-alur-kerja-teknis)
6.  [Troubleshooting](#6-troubleshooting)

---

## 1. Konsep Utama

Fitur ini memungkinkan bot untuk secara otomatis memeriksa akun Gmail tertentu untuk email yang belum dibaca. Ketika email baru ditemukan, bot akan mengirimkan notifikasi yang berisi informasi dasar (pengirim, subjek, dan cuplikan) ke satu atau beberapa nomor WhatsApp yang telah ditentukan.

Untuk mencegah notifikasi berulang, bot akan secara otomatis **memberikan sebuah label (stempel)** ke email tersebut setelah notifikasi berhasil dikirim. Dengan cara ini, email akan tetap dalam status "belum dibaca" di inbox Anda, namun tidak akan dinotifikasikan lagi oleh bot.

---

## 2. Langkah 1: Konfigurasi Google Cloud Console

Untuk menggunakan Gmail API, Anda perlu membuat kredensial dari Google Cloud Console.

1.  **Buat atau Pilih Proyek:**
    *   Buka [Google Cloud Console](https://console.cloud.google.com/) dan pilih proyek yang ingin Anda gunakan.

2.  **Aktifkan Gmail API:**
    *   Di sidebar kiri, navigasi ke **APIs & Services > Library**.
    *   Cari "Gmail API" dan klik **Enable**.

3.  **Konfigurasi OAuth Consent Screen:**
    *   Navigasi ke **APIs & Services > OAuth consent screen**.
    *   Pilih **External** dan klik **Create**.
    *   Isi nama aplikasi (misal: "Bot Notifikasi WhatsApp"), email Anda, dan email developer. Klik **Save and Continue**.
    *   Pada bagian **Scopes**, lewati saja untuk saat ini. Klik **Save and Continue**.
    *   Pada bagian **Test users**, klik **+ ADD USERS** dan tambahkan alamat email Google Anda (akun yang emailnya akan dipantau). Ini penting agar Anda bisa melakukan otorisasi.

4.  **Buat Kredensial (OAuth 2.0 Client ID):**
    *   Navigasi ke **APIs & Services > Credentials**.
    *   Klik **+ CREATE CREDENTIALS** dan pilih **OAuth client ID**.
    *   Pilih **Desktop app** sebagai *Application type*.
    *   Beri nama (misal: "Bot WhatsApp Client").
    *   Klik **Create**.

5.  **Unduh File Kredensial:**
    *   Setelah client ID dibuat, sebuah pop-up akan muncul. Klik **DOWNLOAD JSON**.
    *   **PENTING:** Ganti nama file yang diunduh menjadi `credentials-gmail.json`.
    *   Pindahkan file `credentials-gmail.json` ini ke dalam direktori `src/data/credentials/` pada proyek bot Anda.

---

## 3. Langkah 2: Konfigurasi Environment Bot

Buka file `.env` Anda dan pastikan variabel-variabel berikut ada dan sudah diisi dengan benar.

```env
# Gmail API Notification Settings
GMAIL_NOTIFICATION_ENABLED=true
GMAIL_TARGET_NUMBERS=62812xxxx@c.us,62857xxxx@c.us
GMAIL_POLLING_INTERVAL_SECONDS=60
GMAIL_CREDENTIALS_PATH=src/data/credentials/credentials-gmail.json
GMAIL_TOKEN_PATH=src/data/credentials/token-gmail.json
GMAIL_PROCESSED_LABEL=Notif-Bot
```

-   `GMAIL_NOTIFICATION_ENABLED`: Atur ke `true` untuk mengaktifkan fitur.
-   `GMAIL_TARGET_NUMBERS`: Isi dengan nomor WhatsApp tujuan notifikasi. Jika lebih dari satu, pisahkan dengan koma.
-   `GMAIL_POLLING_INTERVAL_SECONDS`: Seberapa sering bot memeriksa email baru (dalam detik). `60` berarti setiap 1 menit.
-   `GMAIL_PROCESSED_LABEL`: Nama label yang akan digunakan bot sebagai "stempel" untuk menandai email yang sudah dinotifikasikan. Anda tidak perlu membuat label ini manual, bot akan membuatnya secara otomatis jika belum ada.
-   `GMAIL_CREDENTIALS_PATH` dan `GMAIL_TOKEN_PATH`: Sebaiknya biarkan default, pastikan path ini sesuai dengan struktur proyek Anda.

---

## 4. Langkah 3: Otorisasi Bot

Setelah `credentials-gmail.json` ditempatkan dan file `.env` dikonfigurasi, jalankan skrip setup untuk mendapatkan token otorisasi.

1.  **Jalankan Skrip:**
    Di terminal, jalankan perintah berikut dari direktori root proyek:
    ```bash
    node scripts/setup-gmail.js
    ```

2.  **Proses Otorisasi di Browser:**
    -   Terminal akan menampilkan sebuah URL. Salin URL tersebut dan buka di browser.
    -   Login dengan akun Google yang Anda tambahkan sebagai *test user*.
    -   Izinkan akses yang diminta oleh aplikasi.
    -   Setelah itu, Anda akan diarahkan ke halaman yang menampilkan sebuah kode otorisasi. Salin kode tersebut.

3.  **Masukkan Kode ke Terminal:**
    -   Kembali ke terminal dan tempel (paste) kode yang sudah Anda salin, lalu tekan Enter.

4.  **Selesai:**
    -   Skrip akan membuat file `token-gmail.json` di `src/data/credentials/`. File ini digunakan oleh bot untuk mengakses Gmail Anda.
    -   Fitur notifikasi Gmail siap digunakan setelah Anda me-restart bot.

---

## 5. Alur Kerja Teknis

1.  Saat bot dimulai, ia akan memeriksa apakah `GMAIL_NOTIFICATION_ENABLED` aktif.
2.  Jika aktif, bot akan memastikan label yang didefinisikan di `GMAIL_PROCESSED_LABEL` ada di akun Gmail Anda. Jika tidak ada, bot akan membuatnya secara otomatis.
3.  Bot akan memulai *polling* (pemeriksaan berkala) setiap `GMAIL_POLLING_INTERVAL_SECONDS`.
4.  Setiap kali pemeriksaan, bot akan:
    a.  Meminta daftar email dengan kriteria: `is:unread` DAN `TIDAK memiliki label` yang ditentukan.
    b.  Untuk setiap email, bot mengambil detail pengirim, subjek, dan cuplikan.
    c.  Mengirim notifikasi ke semua nomor di `GMAIL_TARGET_NUMBERS`.
    d.  **Memberikan label (stempel)** ke email tersebut untuk memastikan tidak ada notifikasi ganda di masa depan.

---

## 6. Troubleshooting

-   **Notifikasi tidak muncul?**
    -   Pastikan `GMAIL_NOTIFICATION_ENABLED=true` di file `.env`.
    -   Pastikan `GMAIL_TARGET_NUMBERS` sudah diisi dengan benar.
    -   Pastikan file `credentials-gmail.json` dan `token-gmail.json` ada di direktori yang benar.
    -   Periksa log bot untuk pesan error terkait "Gmail service".

-   **Error saat menjalankan `node scripts/setup-gmail.js`?**
    -   Pastikan file `credentials-gmail.json` sudah ada di `src/data/credentials/` sebelum menjalankan skrip.

-   **Kenapa ada label baru (misal: "Notif-Bot") di akun Gmail saya?**
    -   Ini adalah perilaku normal dari sistem "stempel". Bot membuat dan menggunakan label ini untuk menandai email mana yang sudah dikirim notifikasinya, agar tidak mengirim notifikasi yang sama berulang kali. Email Anda tetap dalam status `unread`.