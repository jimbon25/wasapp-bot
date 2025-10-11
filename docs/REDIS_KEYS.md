# Dokumentasi Kunci-Kunci Redis (Redis Keys)

Dokumen ini merinci semua kunci (keys) yang digunakan oleh aplikasi di dalam database Redis. Memahami struktur kunci ini penting untuk proses *debugging*, pemantauan, dan manajemen data.

Struktur kunci umumnya mengikuti pola `kategori:sub-kategori:id_unik`.

---

## 1. Manajemen Sesi & Otentikasi

Kunci-kunci ini terkait dengan penyimpanan sesi login WhatsApp untuk menghindari scan QR code berulang.

| Kunci / Pola | Tipe Data | Deskripsi | Contoh |
| :--- | :--- | :--- | :--- |
| `session:<clientId>` | `STRING` | Menyimpan data sesi login WhatsApp dalam format JSON. `clientId` biasanya adalah `default-session`. | `session:default-session` |
| `session:<clientId>:timestamp` | `STRING` | Menyimpan *Unix timestamp* kapan backup sesi terakhir kali dilakukan. | `session:default-session:timestamp` |

---

## 2. Moderasi & Keamanan

Kunci-kunci ini digunakan untuk fitur keamanan, moderasi grup, dan pembatasan pengguna.

| Kunci / Pola | Tipe Data | Deskripsi | Contoh |
| :--- | :--- | :--- | :--- |
| `blacklist:users` | `SET` | Menyimpan daftar ID pengguna (`userId`) yang diblokir karena terdeteksi mengirim virtex atau spam. | `blacklist:users` |
| `moderation:forbidden_words` | `SET` | Menyimpan daftar kata-kata terlarang yang akan otomatis dihapus jika muncul dalam chat grup. | `moderation:forbidden_words` |
| `moderation:warnings:<groupId>:<userId>` | `STRING` (Counter) | Menghitung jumlah peringatan yang diterima seorang pengguna di dalam grup tertentu. | `moderation:warnings:123@g.us:456@c.us` |
| `moderation:muted_users:<groupId>:<userId>` | `STRING` | Penanda bahwa seorang pengguna sedang dalam status *mute* (tidak bisa mengirim pesan) di grup. Kunci ini memiliki masa berlaku (TTL). | `moderation:muted_users:123@g.us:456@c.us` |

---

## 3. Konfigurasi & Fitur

Kunci-kunci ini menyimpan data dan konfigurasi untuk berbagai fitur bot.

| Kunci / Pola | Tipe Data | Deskripsi | Contoh |
| :--- | :--- | :--- | :--- |
| `autoreply:global` | `HASH` | Menyimpan aturan auto-reply global. | `autoreply:global` |
| `autoreply:group:<groupId>` | `HASH` | Menyimpan aturan auto-reply khusus untuk grup tertentu. | `autoreply:group:123@g.us` |
| `autoreply:user:<userId>` | `HASH` | Menyimpan aturan auto-reply yang spesifik untuk pengguna perorangan. | `autoreply:user:456@c.us` |
| `welcome_messages` | `HASH` | Menyimpan pesan selamat datang untuk setiap grup. *Field* adalah ID grup (`groupId`), dan *value* adalah pesan selamat datangnya. | `welcome_messages` |
| `chat_history:<userId>` | `LIST` | Menyimpan riwayat percakapan dengan AI (Gemini) untuk setiap pengguna, memungkinkan AI mengingat konteks. | `chat_history:628123@c.us` |
| `gdrive_session:<userId>` | `STRING` | Menyimpan status sesi multi-upload Google Drive yang sedang aktif untuk seorang pengguna. Kunci ini memiliki masa berlaku (TTL). | `gdrive_session:628123@c.us` |
| `drive:folders:<userId>` | `STRING` | Menyimpan riwayat folder Google Drive yang pernah dibuat atau digunakan oleh pengguna dalam format JSON. | `drive:folders:628123@c.us` |
| `mega_credentials` | `HASH` | Menyimpan kredensial (email & password terenkripsi) akun Mega.nz untuk setiap admin. | `mega_credentials` |
| `mega_session:<userId>` | `STRING` | Penanda bahwa seorang admin sedang dalam sesi upload Mega.nz. Kunci ini memiliki masa berlaku (TTL). | `mega_session:628123@c.us` |
| `location:<userId>` | `STRING` | Menyimpan data lokasi terakhir yang dikirim oleh pengguna untuk digunakan oleh fitur `/maps`. Kunci ini memiliki masa berlaku (TTL). | `location:628123@c.us` |
| `instagram:account:<username>` | `STRING` | Menyimpan status akun Instagram (cooldown, percobaan gagal) untuk fitur downloader. Kunci ini memiliki masa berlaku (TTL). | `instagram:account:my_ig_user` |

---

## 4. Caching

Kunci-kunci ini digunakan untuk menyimpan sementara hasil dari permintaan API atau data yang sering diakses untuk mempercepat respons. Semua kunci cache memiliki masa berlaku (TTL).

| Kunci / Pola | Tipe Data | Deskripsi | Contoh |
| :--- | :--- | :--- | :--- |
| `cache:anime:<query>` | `STRING` | Menyimpan hasil pencarian data anime dari Jikan API. | `cache:anime:one piece` |
| `cache:translate:<...>` | `STRING` | Menyimpan hasil terjemahan dari fitur `/translate`. | `cache:translate:auto:id:Hello` |
| `cache:prayer_<cityCode>_<date>` | `STRING` | Menyimpan jadwal sholat untuk sebuah kota pada tanggal tertentu. | `cache:prayer_1609_2025-09-29` |

---

## 5. Sistem Internal

Kunci-kunci ini digunakan untuk operasional internal bot, seperti *rate limiting* dan monitoring.

| Kunci / Pola | Tipe Data | Deskripsi | Contoh |
| :--- | :--- | :--- | :--- |
| `ratelimit:<identifier>` | `STRING` (Counter) | Menghitung jumlah permintaan dari seorang pengguna atau IP dalam rentang waktu tertentu untuk fitur *rate limiting*. | `ratelimit:628123@c.us` |
| `fallback:config` | `STRING` | Menyimpan konfigurasi *fallback* jika terjadi masalah pada sistem. | `fallback:config` |
| `performance:<instanceId>:<metric>` | `SORTED SET` | Menyimpan data metrik performa sistem seperti penggunaan CPU dan memori dari waktu ke waktu. | `performance:server1:1234:cpu` |
