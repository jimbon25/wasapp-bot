# Panduan Fitur Auto-Reply

Fitur Auto-Reply memungkinkan bot untuk membalas pesan secara otomatis berdasarkan kata kunci yang telah dikonfigurasi. Fitur ini mendukung balasan berupa teks, gambar, stiker, dan lokasi, serta memiliki sistem cakupan (scope) yang fleksibel.

## Konsep Utama: Cakupan (Scope)

Fitur auto-reply kini memiliki 3 level cakupan dengan urutan prioritas dari yang paling spesifik ke yang paling umum:

1.  **Pengguna (Prioritas #1):** Aturan yang dibuat khusus untuk seorang pengguna dan **hanya akan aktif untuk pengguna tersebut** di chat pribadi.
2.  **Grup (Prioritas #2):** Aturan yang dibuat di dalam sebuah grup **hanya akan aktif di grup tersebut**.
3.  **Global (Prioritas #3):** Aturan yang berlaku di **semua percakapan**, kecuali jika ditimpa oleh aturan yang lebih spesifik (Pengguna atau Grup).

### Bagaimana Prioritas Bekerja?

Saat sebuah pesan masuk, bot akan memeriksa aturan dengan urutan:
1.  Apakah ada aturan **Pengguna** yang cocok? Jika ya, gunakan dan berhenti.
2.  Jika di dalam grup, apakah ada aturan **Grup** yang cocok? Jika ya, gunakan dan berhenti.
3.  Jika tidak, apakah ada aturan **Global** yang cocok? Jika ya, gunakan.

## Format Perintah

Semua perintah auto-reply hanya bisa dijalankan oleh **Admin**.

### 1. Menambah atau Memperbarui Aturan (`/addreply`)

**Sintaks Dasar:**
`/addreply [--scope] [kata_kunci] | [balasan]`

**Contoh Penggunaan:**

-   **Membuat Aturan Grup (Default di Grup):**
    Jalankan perintah ini di dalam grup target.
    ```
    /addreply info | Ini adalah info khusus untuk grup ini.
    ```

-   **Membuat Aturan Global:**
    Gunakan flag `--global` atau jalankan perintah di chat pribadi dengan bot.
    ```
    /addreply --global status | Bot selalu online dan siap membantu.
    ```

-   **Membuat Aturan Pengguna:**
    Gunakan flag `--user` diikuti dengan nomor WhatsApp pengguna.
    ```
    /addreply --user=628123456789 halo | Halo Budi, ada yang bisa saya bantu?
    ```

-   **Membuat Balasan Media:**
    Balas (reply) sebuah gambar, stiker, atau lokasi dengan perintah `/addreply`.
    ```
    /addreply logo | Ini adalah logo perusahaan kita.
    ```

### 2. Menghapus Aturan (`/delreply`)

**Sintaks Dasar:**
`/delreply [--scope] [kata_kunci_utama]`

**Contoh Penggunaan:**

-   **Menghapus Aturan Grup:**
    Jalankan di dalam grup yang bersangkutan.
    ```
    /delreply info
    ```

-   **Menghapus Aturan Global:**
    Gunakan flag `--global`.
    ```
    /delreply --global status
    ```

-   **Menghapus Aturan Pengguna:**
    Gunakan flag `--user`.
    ```
    /delreply --user=628123456789 halo
    ```

### 3. Melihat Daftar Aturan (`/listreply`)

**Sintaks Dasar:**
`/listreply [--scope]`

**Contoh Penggunaan:**

-   **Melihat Aturan Grup:**
    Jalankan di dalam grup yang bersangkutan.
    ```
    /listreply
    ```

-   **Melihat Aturan Global:**
    Gunakan flag `--global`.
    ```
    /listreply --global
    ```

-   **Melihat Aturan Pengguna:**
    Gunakan flag `--user`.
    ```
    /listreply --user=628123456789
    ```

## Struktur Data di Redis (Untuk Developer)

Aturan auto-reply disimpan di Redis menggunakan struktur HASH dengan kunci yang mengikuti pola berikut:

-   **Global:** `autoreply:global`
-   **Grup:** `autoreply:group:<groupId>`
-   **Pengguna:** `autoreply:user:<userId>`

## Migrasi dari Versi Lama

Jika Anda baru saja melakukan pembaruan, jangan khawatir. Semua aturan auto-reply Anda yang lama telah **secara otomatis dimigrasikan** dan dijadikan sebagai aturan **Global**. Anda tidak perlu membuat ulang aturan tersebut.

## Contoh Skenario Penggunaan Lengkap

Mari kita lihat bagaimana aturan auto-reply dengan cakupan berbeda berinteraksi dalam sebuah skenario:

**Tujuan:** Menunjukkan bagaimana prioritas aturan bekerja.
**Karakter:** Admin (Anda), Pengguna A (ID: `6281211112222@c.us`), Pengguna B (ID: `6281233334444@c.us`).
**Grup:** "Grup Diskusi Bot" (ID: `1234567890-123456@g.us`).
**Kata Kunci yang Digunakan:** `halo`

---

### Langkah 1: Membuat Aturan Global

*   **Admin (di chat pribadi dengan bot):**
    ```
    /addreply halo | Halo! Ada yang bisa saya bantu?
    ```
    *Penjelasan:* Ini adalah sapaan default untuk semua orang.

*   **Admin (di chat pribadi dengan bot):**
    ```
    /listreply --global
    ```
    *Output:* Akan menampilkan aturan `halo` Global.

---

### Langkah 2: Membuat Aturan Grup

*   **Admin (di dalam "Grup Diskusi Bot"):**
    ```
    /addreply halo | Halo teman-teman Grup Diskusi! Selamat datang.
    ```
    *Penjelasan:* Aturan ini akan menimpa aturan Global hanya di dalam grup ini.

*   **Admin (di dalam "Grup Diskusi Bot"):**
    ```
    /listreply
    ```
    *Output:* Akan menampilkan aturan `halo` khusus untuk "Grup Diskusi Bot".

---

### Langkah 3: Membuat Aturan Pengguna

*   **Admin (di chat pribadi dengan bot):**
    ```
    /addreply --user=6281211112222 halo | Halo Pengguna A, ada pesan khusus untukmu!
    ```
    *Penjelasan:* Aturan ini akan menimpa aturan Grup dan Global hanya untuk Pengguna A.

*   **Admin (di chat pribadi dengan bot):**
    ```
    /listreply --user=6281211112222
    ```
    *Output:* Akan menampilkan aturan `halo` khusus untuk Pengguna A.

---

### Langkah 4: Demonstrasi Interaksi (Prioritas)

*   **Pengguna B (di chat pribadi dengan bot) mengetik `halo`:**
    *Output:* `Halo! Ada yang bisa saya bantu?` (Aturan Global)
    *Penjelasan:* Tidak ada aturan Pengguna atau Grup yang berlaku di sini.

*   **Pengguna B (di "Grup Diskusi Bot") mengetik `halo`:**
    *Output:* `Halo teman-teman Grup Diskusi! Selamat datang.` (Aturan Grup)
    *Penjelasan:* Aturan Grup lebih prioritas daripada Global di dalam grup.

*   **Pengguna A (di chat pribadi dengan bot) mengetik `halo`:**
    *Output:* `Halo Pengguna A, ada pesan khusus untukmu!` (Aturan Pengguna)
    *Penjelasan:* Aturan Pengguna adalah prioritas tertinggi.

*   **Pengguna A (di "Grup Diskusi Bot") mengetik `halo`:**
    *Output:* `Halo Pengguna A, ada pesan khusus untukmu!` (Aturan Pengguna)
    *Penjelasan:* Aturan Pengguna tetap prioritas tertinggi, bahkan di dalam grup.

---

### Langkah 5: Menghapus Aturan Grup

*   **Admin (di dalam "Grup Diskusi Bot"):**
    ```
    /delreply halo
    ```
    *Penjelasan:* Menghapus aturan `halo` yang spesifik untuk "Grup Diskusi Bot".

*   **Pengguna B (di "Grup Diskusi Bot") mengetik `halo` lagi:**
    *Output:* `Halo! Ada yang bisa saya bantu?` (Aturan Global)
    *Penjelasan:* Karena aturan Grup sudah dihapus, bot kembali menggunakan aturan Global.

---
