# Changelog

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