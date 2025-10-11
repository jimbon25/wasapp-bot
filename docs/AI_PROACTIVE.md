# Panduan Fitur AI Proaktif

Dokumen ini menjelaskan cara kerja, konfigurasi, dan kustomisasi fitur AI Proaktif yang memungkinkan bot untuk merespons pesan secara cerdas tanpa memerlukan perintah khusus.

## Daftar Isi
1.  [Konsep Utama](#1-konsep-utama)
2.  [Cara Kerja & Pemicu Respons](#2-cara-kerja--pemicu-respons)
    -   [Di Chat Grup](#di-chat-grup)
    -   [Di Chat Pribadi (PC)](#di-chat-pribadi-pc)
3.  [Konfigurasi (.env)](#3-konfigurasi-env)
4.  [Kustomisasi Kepribadian AI](#4-kustomisasi-kepribadian-ai)
5.  [Alur Kerja Teknis](#5-alur-kerja-teknis)
6.  [Perbedaan dengan Fitur Lain](#6-perbedaan-dengan-fitur-lain)
7.  [Troubleshooting](#7-troubleshooting)

---

## 1. Konsep Utama

Fitur AI Proaktif mengubah bot dari sekadar alat yang merespons perintah menjadi asisten virtual yang lebih interaktif. Tujuannya adalah agar bot dapat "merasakan" kapan harus ikut serta dalam percakapan, seperti saat disapa, ditanya, atau saat memulai percakapan baru.

Fitur ini **tidak mengganggu** perintah yang sudah ada (`/talk`, `/ask`, `/menu`, dll.) maupun sistem `autoreply`. Ia bekerja sebagai lapisan kecerdasan tambahan yang berjalan pertama kali saat pesan masuk.

---

## 2. Cara Kerja & Pemicu Respons

Logika utama fitur ini berada di `src/handlers/proactiveAiHandler.js`. AI hanya akan merespons jika salah satu kondisi berikut terpenuhi:

### Di Chat Grup

Untuk menghindari spam dan gangguan, AI Proaktif di grup memiliki aturan yang sangat ketat:
-   **Hanya aktif jika bot di-mention langsung.**
    > Contoh: `@NamaBot ada fitur apa saja ya?`

Jika bot tidak di-mention, ia akan mengabaikan semua percakapan di grup (kecuali untuk perintah atau `autoreply`).

### Di Chat Pribadi (PC)

Di chat pribadi, AI lebih aktif dan akan merespons dalam skenario berikut:

1.  **Percakapan Baru atau "Dingin" (Idle)**
    Jika seorang pengguna mengirim pesan pertama kali, atau setelah tidak ada percakapan selama durasi tertentu (diatur di `.env`), AI akan menganggap ini sebagai awal percakapan baru dan akan merespons.
    > Contoh: Pengguna mengirim "Pagi" setelah 30 menit tidak aktif.

2.  **Pesan Berupa Pertanyaan**
    Jika pesan dari pengguna terdeteksi sebagai sebuah pertanyaan.
    > Contoh: `botnya bisa buat stiker ga?`

3.  **Pesan Berupa Sapaan**
    Jika pesan dari pengguna adalah sebuah sapaan umum.
    > Contoh: `halo` atau `assalamualaikum`

Jika tidak ada kondisi di atas yang terpenuhi dalam sebuah percakapan yang sedang aktif, AI akan tetap diam.

---

## 3. Konfigurasi (.env)

Anda dapat mengontrol fitur ini melalui file `.env`.

```env
# Proactive AI Chatbot Mode
AI_PROACTIVE_MODE_ENABLED=true
AI_PROACTIVE_IDLE_TIMEOUT_MINUTES=15
```

-   `AI_PROACTIVE_MODE_ENABLED`
    -   Mengaktifkan (`true`) atau menonaktifkan (`false`) fitur ini secara keseluruhan.

-   `AI_PROACTIVE_IDLE_TIMEOUT_MINUTES`
    -   Menentukan berapa lama (dalam menit) sebuah percakapan harus "diam" sebelum AI menganggap pesan berikutnya sebagai awal percakapan baru.

**Penting:** Setelah mengubah nilai ini, restart bot agar perubahan diterapkan.

---

## 4. Kustomisasi Kepribadian AI

Inilah cara Anda "melatih" AI proaktif. Kepribadiannya didefinisikan secara terpisah dan tidak akan memengaruhi `/talk` atau `/ask`.

1.  Buka file `src/utils/common/prompts.js`.
2.  Cari bagian `[CHAT_MODES.PROACTIVE]`.
3.  Ubah `system prompt` di dalamnya sesuai keinginan Anda.

**Contoh Blok Konfigurasi:**
```javascript
// src/utils/common/prompts.js

// ... (mode TALK dan ASK)

    [CHAT_MODES.PROACTIVE]: {
        // <-- Ubah bagian "system" di bawah ini untuk mengubah kepribadian inti AI Proaktif
        system: `You are a proactive AI assistant for a WhatsApp bot. Your primary goal is to be helpful when a user asks a question, greets you, or re-engages after a period of inactivity. 
        - When greeted, greet back warmly and ask how you can help.
        - When asked a question, answer it clearly and concisely.
        - Do not be overly chatty, but be friendly. 
        - Always make it clear you are an AI assistant.`,
        examples: [
            // ... (contoh-contoh interaksi)
        ]
    }
```

Anda bisa mengubah instruksi `system` menjadi apa pun, misalnya:
-   Memberi nama pada bot Anda.
-   Mengatur agar selalu menjawab dalam bahasa tertentu.
-   Menjadikannya asisten penjualan yang menjelaskan fitur produk.

---

## 5. Alur Kerja Teknis

Untuk pemahaman developer, berikut adalah alur logika saat pesan masuk:

1.  Pesan diterima di `client.on('message', ...)` dalam `src/startup/clientSetup.js`.
2.  Bot melakukan pengecekan moderasi kata terlarang.
3.  **Logika Baru**: Bot memanggil `proactiveAiHandler.shouldTrigger(message)`.
4.  **Jika `shouldTrigger` mengembalikan `true`**:
    -   `aiChatHandler` dipanggil dengan mode `PROACTIVE`.
    -   AI merespons, dan proses untuk pesan tersebut berhenti di sini.
5.  **Jika `shouldTrigger` mengembalikan `false`**:
    -   Bot melanjutkan alur kerja normal:
        -   Mengecek apakah pesan adalah perintah (dimulai dengan `/`).
        -   Jika bukan perintah, mengecek apakah pesan memicu `autoreply`.

---

## 6. Perbedaan dengan Fitur Lain

| Fitur | Pemicu | Kepribadian AI | Jenis Respons |
| :--- | :--- | :--- | :--- |
| **AI Proaktif** | Konteks (sapaan, pertanyaan, mention, idle) | `PROACTIVE` | Dinamis & Generatif |
| **/talk** | Perintah eksplisit `/talk` | `TALK` (Santai) | Dinamis & Generatif |
| **/ask** | Perintah eksplisit `/ask` | `ASK` (Akademis) | Dinamis & Generatif |
| **Autoreply** | Kata kunci spesifik | Tidak ada (N/A) | Statis & Telah Ditentukan |

---

## 7. Troubleshooting

-   **AI tidak merespons padahal seharusnya?**
    -   Pastikan `AI_PROACTIVE_MODE_ENABLED=true` di file `.env` Anda.
    -   Periksa logika `idle time`. Mungkin percakapan Anda masih dianggap "aktif". Tunggu beberapa menit lalu coba lagi.
    -   Periksa log bot untuk melihat apakah ada error saat memanggil `proactiveAiHandler`.

-   **AI terlalu sering merespons (terlalu "cerewet")?**
    -   Naikkan nilai `AI_PROACTIVE_IDLE_TIMEOUT_MINUTES` di `.env` Anda (misalnya menjadi `30` atau `60`).

-   **Jawaban AI tidak sesuai dengan yang saya inginkan?**
    -   Ini adalah masalah "prompt engineering". Kembali ke [Langkah 4](#4-kustomisasi-kepribadian-ai) dan perbaiki instruksi `system` untuk mode `PROACTIVE` agar lebih spesifik dan sesuai dengan keinginan Anda.
