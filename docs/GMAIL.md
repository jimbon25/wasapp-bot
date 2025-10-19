# Panduan Fitur Notifikasi Gmail (Multi-Akun) - Push Notifications

Dokumen ini menjelaskan cara mengkonfigurasi dan menggunakan fitur notifikasi email dari beberapa akun Gmail secara bersamaan menggunakan sistem *push notifications* real-time melalui Google Cloud Pub/Sub.

## Daftar Isi
1.  [Konsep Utama: Push Notifications](#1-konsep-utama-push-notifications)
2.  [Langkah 1: Konfigurasi Google Cloud Console (Gmail API & Pub/Sub)](#2-langkah-1-konfigurasi-google-cloud-console-gmail-api--pubsub)
3.  [Langkah 2: Konfigurasi Environment Bot (.env)](#3-langkah-2-konfigurasi-environment-bot-env)
4.  [Langkah 3: Otorisasi Setiap Akun & Registrasi Push](#4-langkah-3-otorisasi-setiap-akun--registrasi-push)
5.  [Kontrol Dinamis (Perintah Admin)](#5-kontrol-dinamis-perintah-admin)
6.  [Alur Kerja Teknis](#6-alur-kerja-teknis)
7.  [Troubleshooting](#7-troubleshooting)

---

## 1. Konsep Utama: Push Notifications

Fitur ini memungkinkan bot untuk secara otomatis memeriksa **beberapa akun Gmail** untuk email yang belum dibaca. Berbeda dengan metode *polling* (memeriksa secara berkala), bot kini menggunakan **Google Cloud Pub/Sub** untuk menerima *push notifications* secara real-time dari Gmail.

Ketika email baru ditemukan di salah satu akun, Google akan mengirimkan notifikasi ke Pub/Sub, yang kemudian akan diterima oleh bot. Bot akan mengirimkan notifikasi yang berisi informasi dasar (pengirim, subjek, cuplikan) ke nomor WhatsApp yang telah ditentukan **khusus untuk akun tersebut**.

**Pencegahan Notifikasi Ganda:**
Untuk mencegah notifikasi berulang, bot menggunakan database internal (Redis) untuk mencatat ID setiap email yang notifikasinya telah berhasil dikirim.

Secara default, bot juga akan melakukan dua tindakan pada email yang telah diproses untuk pemeliharaan:
1.  **Menandai sebagai sudah dibaca** (menghapus label `UNREAD`).
2.  **Memberikan label "stempel"** (contoh: `NotifBot-Pribadi`).

**Perilaku ini sekarang dapat diubah.** Jika Anda ingin email tetap dalam status "belum dibaca" di Gmail, Anda dapat mengaturnya melalui file `.env`.

**Keuntungan Push Notifications:**
*   **Real-time:** Notifikasi dikirim hampir seketika setelah email diterima.
*   **Sangat Efisien:** Mengurangi penggunaan kuota API dan sumber daya karena bot tidak perlu lagi melakukan panggilan API secara berkala.
*   **Lebih Andal:** Mengurangi risiko email terlewat karena error koneksi sesaat.

---

## 2. Langkah 1: Konfigurasi Google Cloud Console (Gmail API & Pub/Sub)

Untuk menggunakan fitur ini, Anda perlu mengkonfigurasi Gmail API dan Google Cloud Pub/Sub di Google Cloud Console Anda.

1.  **Buat atau Pilih Proyek** di [Google Cloud Console](https://console.cloud.google.com/).
    *   Catat **Project ID** Anda (misalnya: `your-gcp-project-id`), Anda akan membutuhkannya nanti.

2.  **Aktifkan Gmail API & Cloud Pub/Sub API**:
    *   Di menu **APIs & Services > Library**:
        *   Cari "Google Gmail API" dan klik **Enable**.
        *   Cari "Cloud Pub/Sub API" dan klik **Enable**.

3.  **Konfigurasi OAuth Consent Screen**:
    *   Navigasi ke **APIs & Services > OAuth consent screen**.
    *   Pilih **External** dan klik **Create**.
    *   Isi nama aplikasi (misal: "WhatsApp Bot"), email Anda, dan email developer. Klik **Save and Continue**.
    *   Pada bagian **Scopes**, klik **Add or Remove Scopes**. Cari dan tambahkan scope `.../auth/gmail.modify`. Klik **Update**, lalu **Save and Continue**.
    *   Pada bagian **Test users**, klik **Add Users** dan tambahkan **semua alamat email Google** yang ingin Anda pantau. Ini penting agar Anda bisa melakukan otorisasi. Klik **Save and Continue**.

4.  **Buat Kredensial (OAuth 2.0 Client ID)**:
    *   Navigasi ke **APIs & Services > Credentials**.
    *   Klik **+ Create Credentials** dan pilih **OAuth client ID**.
    *   Pilih **Desktop app** sebagai *Application type*.
    *   Beri nama (misal: "Bot WhatsApp Desktop Client").
    *   Klik **Create**.
    *   Setelah client ID dibuat, sebuah pop-up akan muncul. Klik **DOWNLOAD JSON**.
    *   Ubah nama file yang diunduh menjadi `credentials-gmail-all.json`. **Penting:** File ini akan digunakan untuk semua akun Gmail yang Anda tambahkan.
    *   Pindahkan file `credentials-gmail-all.json` ini ke dalam direktori `src/data/credentials/` pada proyek bot Anda.

5.  **Buat Pub/Sub Topic & Subscription**:
    *   Di menu navigasi, cari dan buka **"Pub/Sub"**.
    *   **Buat Topic:**
        *   Klik **"Create Topic"**.
        *   Berikan **Topic ID**, misalnya: `gmail-realtime-updates`.
        *   Biarkan opsi lain default dan klik **"Create"**.
    *   **Beri Izin pada Gmail untuk Publikasi ke Topic:**
        *   Di halaman *topic* `gmail-realtime-updates` Anda, buka tab **"Permissions"**.
        *   Klik **"ADD PRINCIPAL"**.
        *   Di kolom **"New principals"**, masukkan alamat email layanan khusus Gmail: `gmail-api-push@system.gserviceaccount.com`.
        *   Di kolom **"Assign roles"**, cari dan pilih peran **"Pub/Sub Publisher"**. (Gunakan kotak pencarian jika tidak langsung terlihat).
        *   Klik **"SAVE"**.
    *   **Buat Subscription:**
        *   Masih di halaman Pub/Sub, buka tab **"Subscriptions"**.
        *   Klik **"CREATE SUBSCRIPTION"**.
        *   Berikan **Subscription ID**, misalnya: `wabot-gmail-listener`.
        *   Pilih **Topic** yang tadi Anda buat (`gmail-realtime-updates`).
        *   Biarkan *Delivery type* sebagai **"Pull"**.
        *   Klik **"CREATE"**.

6.  **Buat Service Account Key untuk Bot (Pub/Sub Subscriber)**:
    *   Ini adalah kredensial yang akan digunakan bot Anda untuk *mendengarkan* pesan dari Pub/Sub.
    *   Di menu navigasi, cari **"IAM & Admin"** lalu pilih **"Service Accounts"**.
    *   Klik **"+ CREATE SERVICE ACCOUNT"**.
    *   Berikan **Service account name**, misalnya: `wabot-pubsub-listener`.
    *   Klik **"CREATE AND CONTINUE"**.
    *   Di bagian **"Grant this service account access to project"**:
        *   Di kolom **"Select a role"**, cari dan pilih peran **"Pub/Sub Subscriber"**.
        *   Klik **"CONTINUE"**.
    *   Klik **"DONE"**.
    *   Sekarang, klik pada nama Service Account yang baru Anda buat (`wabot-pubsub-listener`).
    *   Buka tab **"KEYS"**.
    *   Klik **"ADD KEY"** lalu pilih **"Create new key"**.
    *   Pilih **"JSON"** sebagai tipe kunci dan klik **"CREATE"**.
    *   File JSON akan terunduh. Pindahkan file ini ke `src/data/credentials/` dan ganti namanya menjadi `wabot-pubsub-key.json`.

---

## 3. Langkah 2: Konfigurasi Environment Bot (.env)

Buka file `.env` Anda dan isi variabel-variabel umum untuk fitur Gmail dan Pub/Sub.

**Penting:** Konfigurasi untuk setiap akun Gmail (seperti nama, nomor target, dll.) tidak lagi diatur di dalam file `.env`. Pengaturan tersebut kini dikelola secara dinamis melalui skrip interaktif.

```env
# Gmail API Notification Settings
GMAIL_ENABLED=true
# Set to true to prevent the bot from marking emails as read in your Gmail account.
# The bot will use its internal database (Redis) to track notified emails.
GMAIL_LEAVE_AS_UNREAD=true
# Expiry time in days for the list of notified email IDs in Redis.
GMAIL_NOTIFIED_ID_EXPIRY_DAYS=30

# Google Cloud Pub/Sub Configuration
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GMAIL_PUBSUB_TOPIC_NAME=projects/your-gcp-project-id/topics/gmail-realtime-updates
GMAIL_PUBSUB_SUBSCRIPTION_NAME=projects/your-gcp-project-id/subscriptions/wabot-gmail-listener
GOOGLE_APPLICATION_CREDENTIALS=src/data/credentials/wabot-pubsub-key.json
```

**Penjelasan Variabel:**
*   `GMAIL_LEAVE_AS_UNREAD`: Atur ke `true` jika Anda tidak ingin bot menandai email sebagai "telah dibaca".
*   `GMAIL_NOTIFIED_ID_EXPIRY_DAYS`: (Opsional) Berapa lama (dalam hari) ID email yang sudah dinotifikasi akan disimpan di Redis sebelum dihapus. Defaultnya adalah 30 hari.
*   `GOOGLE_CLOUD_PROJECT_ID`: ID proyek Google Cloud Anda.
*   `GMAIL_PUBSUB_TOPIC_NAME`: Nama lengkap *topic* Pub/Sub Anda (termasuk `projects/your-gcp-project-id/topics/`).
*   `GMAIL_PUBSUB_SUBSCRIPTION_NAME`: Nama lengkap *subscription* Pub/Sub Anda (termasuk `projects/your-gcp-project-id/subscriptions/`).
*   `GOOGLE_APPLICATION_CREDENTIALS`: Path ke file JSON Service Account Key yang Anda unduh di langkah sebelumnya. Ini digunakan oleh library Pub/Sub untuk otentikasi.

---

## 4. Langkah 3: Menambah dan Mengotorisasi Akun Gmail

Manajemen dan otorisasi akun Gmail kini dilakukan melalui skrip interaktif yang menyimpan konfigurasi dalam file `src/data/static/gmail_accounts.json`.

1.  **Jalankan Skrip Setup:**
    Di terminal, jalankan perintah:
    ```bash
    node scripts/setup-gmail.js
    ```

2.  **Menu Manajemen Akun:**
    Anda akan melihat menu untuk mengelola akun Gmail:
    ```
    --- Manajemen Akun Gmail --- 
    Pilih akun untuk diotorisasi atau tambahkan akun baru:
    1: Pribadi ("✔ Linked")
    2: Kantor ("✘ Not Linked")
    -----------------------------------
    A: Tambah Akun Baru
    Q: Keluar
    Pilihan Anda: 
    ```

3.  **Menambah Akun Baru:**
    *   Pilih `A` untuk menambahkan akun baru.
    *   Masukkan **nama pendek** untuk akun tersebut (misal: `Pribadi`, `Kantor`).
    *   Masukkan **nomor WhatsApp target** untuk notifikasi. Anda bisa memasukkan nomor biasa (contoh: `0812...`) dan skrip akan memformatnya secara otomatis. Pisahkan dengan koma jika lebih dari satu.
    *   Konfirmasi detailnya. Akun akan ditambahkan ke konfigurasi.

4.  **Mengotorisasi Akun:**
    *   Dari menu utama, pilih nomor akun yang ingin Anda otorisasi (misalnya, `2` untuk `Kantor`).
    *   Salin **URL otorisasi** yang muncul di terminal dan buka di browser.
    *   Login dengan akun Google yang sesuai.
    *   Izinkan akses yang diminta oleh aplikasi.
    *   Salin **kode otorisasi** yang ditampilkan di halaman browser.
    *   Tempel kode tersebut kembali ke terminal dan tekan Enter.

5.  **Proses Selesai:**
    *   Skrip akan membuat file token (misal: `token-gmail-kantor.json`) di `src/data/credentials/`.
    *   Akun tersebut juga akan secara otomatis terdaftar untuk menerima *push notifications*.
    *   Ulangi proses ini untuk semua akun yang ingin Anda pantau.

6.  **Selesai & Restart Otomatis:**
    Setelah Anda selesai menambah, menghapus, atau mengotorisasi akun, bot akan secara otomatis mendeteksi perubahan tersebut. Dalam beberapa detik, bot akan me-restart dirinya sendiri untuk menerapkan konfigurasi baru. **Anda tidak perlu lagi me-restart bot secara manual.**

---

## 5. Kontrol Dinamis (Perintah Admin)

Anda dapat mengelola fitur notifikasi Gmail secara dinamis melalui perintah WhatsApp tanpa perlu me-restart bot. Perintah ini hanya bisa digunakan oleh admin.

-   `/gmail on`
    Mengaktifkan kembali layanan notifikasi Gmail.

-   `/gmail off`
    Menonaktifkan layanan notifikasi Gmail. Bot akan berhenti memeriksa email baru.

-   `/gmail status`
    Mengecek status layanan saat ini (apakah sedang aktif atau tidak).

-   `/gmail download [nomor]` (hanya dengan me-reply notifikasi)
    Mengunduh lampiran dari email yang notifikasinya Anda balas. Jika email memiliki lebih dari satu lampiran, sertakan nomor lampiran yang ingin diunduh.

Status on/off ini akan tersimpan, bahkan jika bot di-restart. Status default saat pertama kali dijalankan akan mengikuti nilai `GMAIL_ENABLED` di file `.env` Anda.

---

## 6. Alur Kerja Teknis

1.  Saat bot dimulai, ia akan memeriksa `GMAIL_ENABLED` dan menginisialisasi sebuah klien API untuk **setiap akun** yang memiliki file token yang valid.
2.  Bot akan menginisialisasi klien Google Cloud Pub/Sub menggunakan **Service Account Key** yang telah dikonfigurasi.
3.  Bot akan mulai *mendengarkan* (subscribe) pesan dari *subscription* Pub/Sub yang telah ditentukan.
4.  Ketika email baru masuk ke salah satu akun Gmail yang terdaftar, Gmail API akan mengirimkan notifikasi ke *topic* Pub/Sub Anda.
5.  Bot akan menerima notifikasi dari *subscription* Pub/Sub.
6.  Untuk setiap notifikasi, bot akan mengambil `historyId` terbaru dan membandingkannya dengan `historyId` terakhir yang diketahui untuk akun tersebut (disimpan di Redis).
7.  Bot akan meminta daftar perubahan (email baru) dari Gmail API berdasarkan `historyId` tersebut.
8.  Untuk setiap email baru yang terdeteksi dan belum dibaca, bot akan:
    a. Memeriksa di Redis apakah ID email ini sudah pernah dinotifikasi sebelumnya.
    b. Jika sudah, email akan diabaikan.
    c. Jika belum, bot akan mengambil detail pengirim, subjek, dan cuplikan.
9.  Mengirim notifikasi ke semua nomor di `TARGET_NUMBERS` yang **spesifik untuk akun tersebut**.
10. Setelah mengirim notifikasi, bot akan **menyimpan ID email tersebut ke Redis** untuk mencegah notifikasi ganda di masa depan.
11. Terakhir, bot akan menambahkan label "stempel" (misal: `NotifBot-Pribadi`). Jika `GMAIL_LEAVE_AS_UNREAD` tidak diatur ke `true`, bot juga akan **menandai email sebagai sudah dibaca**.

---

## Disclaimer

This feature integrates with the official Gmail API and is intended for personal notification purposes only. The author of this software is not responsible for any of the following:

*   **Misuse of the feature:** You are solely responsible for how you use this notification feature. Any use for spamming, unauthorized surveillance, or any other activity that violates Gmail's terms of service is strictly prohibited.
*   **Account Suspension:** Exceeding API rate limits, sending unsolicited messages, or other violations of platform policies may result in the suspension of your Google or WhatsApp account. Use this feature responsibly.
*   **Data Privacy:** While the bot is designed to be secure, you are responsible for securing the server and environment where the bot is running. The author is not liable for any data breaches or privacy violations that may occur.

By using this feature, you agree to assume all risks and responsibilities associated with its use.

---

## 7. Troubleshooting

-   **Error: `Could not load the default credentials` (saat bot start atau Pub/Sub error)**
    *   **Penyebab:** Library Pub/Sub tidak dapat menemukan kredensial untuk mengautentikasi ke Google Cloud.
    *   **Solusi:** Pastikan Anda telah membuat **Service Account Key** dengan peran **"Pub/Sub Subscriber"** dan menempatkan file JSON-nya di `src/data/credentials/wabot-pubsub-key.json`. Pastikan juga variabel `GOOGLE_APPLICATION_CREDENTIALS` di `.env` mengarah ke file tersebut.

-   **Error: `User not authorized to perform this action.` (saat bot mencoba mendengarkan Pub/Sub)**
    *   **Penyebab:** Service Account Anda (`wabot-pubsub-listener`) tidak memiliki izin yang cukup untuk *mendengarkan* (subscribe) pesan dari Pub/Sub.
    *   **Solusi:** Pastikan Anda telah memberikan peran **"Pub/Sub Subscriber"** kepada Service Account Anda (`wabot-pubsub-listener@your-gcp-project-id.iam.gserviceaccount.com`) di *subscription* Pub/Sub Anda (`wabot-gmail-listener`).

-   **Pesan `Gmail notifications are disabled, skipping processing.` di log bot.**
    *   **Penyebab:** Fitur notifikasi Gmail secara keseluruhan dinonaktifkan.
    *   **Solusi:** Jalankan perintah `/gmail on` di WhatsApp untuk mengaktifkannya.

-   **Pesan `No previous historyId found for [Nama Akun]. Storing current one and processing next time.` di log bot.**
    *   **Penyebab:** Ini adalah notifikasi *push* pertama yang diterima bot untuk akun tersebut setelah migrasi ke Pub/Sub. Bot belum memiliki `historyId` sebelumnya untuk membandingkan perubahan.
    *   **Solusi:** Ini adalah perilaku normal. Email yang memicu pesan ini tidak akan diproses saat ini, tetapi semua email baru yang masuk setelahnya akan diproses dengan normal. Kirim email tes baru untuk memverifikasi.

-   **Salah satu akun saya tidak muncul saat menjalankan `setup-gmail.js`?**
    *   **Penyebab:** Konfigurasi akun disimpan di `src/data/static/gmail_accounts.json`. Jika file ini rusak atau akun tidak terdaftar dengan benar, ia tidak akan muncul.
    *   **Solusi:** Coba tambahkan kembali akun melalui menu "Tambah Akun Baru" di dalam skrip `setup-gmail.js`. Jika masalah berlanjut, periksa file `src/data/static/gmail_accounts.json` secara manual.

-   **Notifikasi tidak muncul untuk salah satu akun?**
    *   Pastikan `GMAIL_ENABLED=true` di file `.env`.
    *   Jalankan `node scripts/setup-gmail.js` dan pastikan akun yang dimaksud memiliki status `✔ Linked`. Jika tidak, lakukan otorisasi ulang.
    *   Periksa file `src/data/static/gmail_accounts.json` dan pastikan `targetNumbers` untuk akun tersebut sudah benar.
    *   Pastikan file kredensial utama (`credentials-gmail-all.json`) dan file token spesifik akun (`token-gmail-namaakun.json`) ada di direktori `src/data/credentials/`.

-   **Kenapa email saya tetap belum dibaca padahal notifikasi sudah masuk?**
    *   **Penyebab:** Ini adalah perilaku baru yang bisa dikonfigurasi. Kemungkinan Anda mengaktifkan `GMAIL_LEAVE_AS_UNREAD=true` di file `.env` Anda.
    *   **Solusi:** Ini adalah perilaku yang diharapkan jika setelan tersebut aktif. Bot sekarang menggunakan database internalnya (Redis) untuk melacak email yang sudah dinotifikasi, sehingga tidak perlu lagi mengubah status email Anda di Gmail. Jika Anda ingin kembali ke perilaku lama (menandai sebagai telah dibaca), ubah nilainya menjadi `false` atau hapus baris tersebut dari file `.env` Anda.