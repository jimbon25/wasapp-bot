# Changelog

## [2.1.4] - 2025-10-26

### Fixed
- Memperbaiki crash saat startup yang disebabkan oleh `ReferenceError: config is not defined` di `uploadSessionService.js`.
- Menghilangkan hardcoded path untuk file `gmail_accounts.json` dan `credentials.json` di skrip setup, sekarang menggunakan path terpusat dari `config.js`.
- Memperkuat logika pembuatan label di `gmailService.js` untuk menangani potensi *race condition* dengan lebih baik.

### Changed
- Durasi timeout untuk sesi upload Google Drive sekarang dapat dikonfigurasi melalui variabel `.env` (`GDRIVE_SESSION_TIMEOUT_SECONDS`).
- Pesan error saat mengirim email (Gmail) dan mengupload file (Google Drive) dibuat lebih spesifik untuk mempermudah *troubleshooting*.

## [2.1.3] - 2025-10-24

### Added
- Sistem Health Check Otomatis
  - Pengecekan kesehatan akun setiap 6 jam
  - Deteksi otomatis masalah token dan otorisasi
  - Notifikasi proaktif untuk akun bermasalah
  - Saran tindakan perbaikan

- Perintah `/healthcheck` untuk monitoring kesehatan akun
  - Pengecekan status token dan otorisasi
  - Notifikasi akun yang bermasalah
  - Saran tindakan yang perlu diambil

### Changed
- Restrukturisasi penyimpanan token
  - Pemisahan token Gmail dan Google Drive ke folder terpisah
  - Peningkatan keamanan dengan enkripsi token
  - Path token yang lebih terorganisir

### Fixed
- Perbaikan proses penghapusan akun Gmail dan Google Drive
- Perbaikan path token yang tidak konsisten
- Perbaikan error handling pada health check

## [2.1.2] - 2025-10-24

### Added
- Fitur manajemen akun melalui WhatsApp untuk Gmail dan Google Drive
  - Perintah `/gmail add-account` dan `/gdrive add-account` untuk menambah akun baru
  - Perintah `/gmail remove-account` dan `/gdrive remove-account` untuk menghapus akun
  - Konfirmasi penghapusan dengan keyword "CONFIRM"
  - Pembersihan file token otomatis
  - Penanganan error yang aman

### Changed
- Perbaikan struktur kode pada handlers Gmail
- Peningkatan modularitas dengan exported functions

## [2.1.1] - 2025-10-24

### Added
- Fitur setup Gmail langsung dari WhatsApp melalui perintah `/gmail add-account`
- Peningkatan keamanan pengelolaan label Gmail dengan pengecekan case-insensitive
- Penanganan timeout yang lebih baik untuk interaksi setup Gmail

### Changed
- Peningkatan UX dalam proses setup Gmail:
  - Instruksi yang lebih jelas untuk otorisasi manual
  - Waktu timeout yang lebih lama (5 menit) untuk proses otorisasi
  - Pesan konfirmasi yang lebih informatif
- Penanganan label Gmail yang lebih robust dan toleran terhadap perbedaan kapitalisasi

### Fixed
- Perbaikan bug pada proses pembuatan label Gmail
- Perbaikan masalah pesan konfirmasi yang tidak terkirim saat setup Gmail
- Perbaikan penanganan race condition saat pembuatan label Gmail

## [2.1.0] - 2025-10-24

### Added
- Otomatisasi proses otorisasi Gmail dan Google Drive
  - Browser terbuka secara otomatis saat melakukan otorisasi
  - Token ditangkap dan disimpan secara otomatis
  - Tampilan sukses yang lebih informatif
- Auto-download lampiran email dari Gmail ke WhatsApp
  - Lampiran diunduh dan dikirim secara otomatis
  - Batasan ukuran file 10MB untuk keamanan
  - Notifikasi status pengunduhan lampiran

### Changed
- Peningkatan UX pada proses setup Gmail dan Google Drive
- Perubahan format pesan notifikasi Gmail untuk mencerminkan fitur auto-download
- Optimisasi penanganan error saat pengunduhan lampiran

### Fixed
- Perbaikan masalah format pengiriman file di WhatsApp
- Perbaikan masalah kompatibilitas ES Modules dengan CommonJS modules

## [2.0.0] - 2025-10-23

[Versi sebelumnya...]