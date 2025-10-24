# Panduan Fitur Baru v2.1.3

## 1. Health Check System

### Monitoring Kesehatan Akun
- Perintah `/healthcheck` untuk memeriksa status semua akun
- Deteksi otomatis akun yang bermasalah
- Saran tindakan yang perlu diambil
- Notifikasi ke admin untuk masalah serius

### Format Laporan Health Check:
```
*📊 Status Kesehatan Akun*

*✅ Akun Sehat:*
- GMAIL: [nama_akun]
- DRIVE: [nama_akun]

*❌ Akun Bermasalah:*
- GMAIL: [nama_akun]
  Masalah: [deskripsi_masalah]
- DRIVE: [nama_akun]
  Masalah: [deskripsi_masalah]

Total Akun: XX
Sehat: XX
Bermasalah: XX
```

## 2. Manajemen Akun Terintegrasi

### Perintah Baru:
- `/gmail add-account [nama]` - Tambah akun Gmail
- `/gmail remove-account [nama]` - Hapus akun Gmail
- `/gdrive add-account [nama]` - Tambah akun Drive
- `/gdrive remove-account [nama]` - Hapus akun Drive
- `/reauth [tipe] [nama]` - Otorisasi ulang akun

### Fitur Keamanan:
- Konfirmasi penghapusan dengan keyword "CONFIRM"
- Backup token otomatis sebelum penghapusan
- Enkripsi token yang disimpan
- Validasi nama akun dan input

## 3. Otomatisasi Proses Otorisasi

### Gmail dan Google Drive
- Browser terbuka otomatis saat proses otorisasi
- Tidak perlu lagi menyalin-tempel kode otorisasi
- Token tersimpan otomatis setelah otorisasi berhasil
- Tampilan halaman sukses yang informatif

### Cara Menggunakan:
1. Jalankan script setup:
   ```bash
   # Untuk Gmail
   node scripts/setup-gmail.js
   
   # Untuk Google Drive
   node scripts/setup-google-drive.js
   ```
2. Pilih opsi untuk menambah akun baru atau otorisasi akun yang ada
3. Browser akan terbuka otomatis
4. Login dan berikan izin yang diperlukan
5. Setelah selesai, kembali ke terminal

## 2. Auto-Download Lampiran Gmail

### Fitur Baru:
- Lampiran email diunduh dan dikirim otomatis ke WhatsApp
- Batasan ukuran file 10MB untuk keamanan
- Notifikasi status pengunduhan setiap lampiran
- Penanganan error yang lebih baik

### Format Notifikasi Baru:
```
*GMAIL NOTIFICATION*
━━━━━━━━━━━━━

*Akun:* _[Nama Akun]_
*Waktu:* [Timestamp]
*Dari:* [Pengirim]

*Subjek:* [Subjek Email]

*Pesan:* [Preview Isi Email]

*Lampiran:*
1. file1.pdf (xxx KB)
2. file2.jpg (xxx KB)

Sedang mengunduh lampiran secara otomatis...

*Lihat Pesan:* [URL Email]
```

### Status Lampiran:
- ✓ Berhasil dikirim
- ⚠️ File terlalu besar (>10MB)
- ❌ Gagal mengunduh/mengirim

## 3. Peningkatan Performa dan Stabilitas

### Optimisasi:
- Penanganan format file yang lebih baik
- Kompatibilitas ES Modules dan CommonJS
- Penanganan error yang lebih robust

### Tips Penggunaan:
- Pastikan koneksi internet stabil
- Monitor penggunaan melalui log di `logs/wabot-error.log`
- Gunakan perintah `/status` untuk melihat status layanan

## 4. Troubleshooting

### Masalah Umum:
1. **Otorisasi Gagal**
   - Pastikan akun Google sudah ditambahkan sebagai test user
   - Coba hapus cache browser dan ulangi proses

2. **Lampiran Tidak Terkirim**
   - Cek ukuran file (<10MB)
   - Periksa log error
   - Pastikan format file didukung

3. **Bot Tidak Merespon**
   - Restart bot
   - Periksa status koneksi
   - Verifikasi konfigurasi di `.env`

### Kontak Support:
Jika mengalami masalah, silakan:
1. Cek dokumentasi lengkap di `/docs`
2. Periksa log error
3. Buat issue di repository dengan detail masalah