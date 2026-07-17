# 📖 User Manual — IBS Onboarding Admin

> Panduan penggunaan dashboard **IBS Onboarding Admin** untuk petugas/admin BPR.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS Onboarding Admin |
| Jenis Dokumen     | User Manual         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 17 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Pendahuluan
**IBS Onboarding Admin** adalah dashboard back-office untuk memproses onboarding nasabah BPR:
memverifikasi registrasi calon nasabah, mengaktivasi akun (OTP), memproses pengajuan pembukaan
rekening (tabungan/deposito/kredit), serta mengelola user, blacklist, dan banner. Seluruh aksi
Anda diteruskan ke sistem backend yang menjalankan prosesnya (termasuk pembuatan rekening di Core
Banking).

## 2. Persyaratan Akses

| Item | Detail |
|------|--------|
| URL Aplikasi | `http://<host>:8080` (atau domain yang ditentukan) |
| Browser | Chrome / Edge versi terbaru |
| Akun / Hak akses | Akun admin back-office (dibuat/diberikan oleh administrator sistem) |

## 3. Cara Login
1. Buka URL aplikasi → halaman **Login**.
2. Masukkan **username** dan **password**.
3. Isi **kode verifikasi (CAPTCHA)** bila diminta.
4. Klik **Masuk**. Bila berhasil, Anda diarahkan ke **Dashboard**.

> Sesi akan **otomatis logout** bila tidak ada aktivitas beberapa waktu (idle). Untuk keluar
> manual, klik **Logout** di sidebar lalu konfirmasi.

> _Lampirkan tangkapan layar:_ `![Login](assets/login.png)`

## 4. Panduan Fitur

### 4.1 Dashboard (Ringkasan)
**Tujuan:** melihat rekap operasional sekilas.
**Isi:** kartu — Registrasi Akun, Akun Aktif, Aktivasi Belum Diproses, Registrasi Belum Diproses,
Blacklist, Pengajuan Rekening. Gunakan sebagai titik awal untuk melihat antrean yang perlu
diproses.

### 4.2 Manajemen Akun IBS Onboard
**Tujuan:** mengelola user aplikasi nasabah.
**Langkah:**
1. Buka menu **Manajemen Akun**.
2. Cari user via kolom pencarian (username, NIK, CIF, nama, no HP, dll.).
3. Klik baris untuk melihat **Detail**.
4. Aksi tersedia: **Ubah Status**, **Reset Password**, **Unblock** (untuk akun LOCKED),
   **Hapus** (dengan konfirmasi).
**Hasil:** status/kredensial user diperbarui di sistem.

### 4.3 Manajemen Registrasi (Calon Nasabah)
**Tujuan:** memverifikasi pendaftaran calon nasabah baru.
**Langkah:**
1. Buka **Manajemen Registrasi**. Perhatikan status: **PENDING / APPROVED / REJECTED**.
2. Klik data **PENDING** → periksa **detail & foto KTP/selfie**.
3. Pilih **Approve** (sistem membuat **OTP aktivasi**) atau **Reject** (**wajib isi alasan**).
4. Opsional: **Ekspor PDF** detail registrasi.
**Hasil:** approve memicu proses aktivasi; reject menutup pengajuan dengan alasan.

### 4.4 Manajemen Aktivasi Akun (Nasabah Existing)
**Tujuan:** menerbitkan OTP aktivasi bagi nasabah existing.
**Langkah:**
1. Buka **Manajemen Aktivasi**.
2. Pilih antrean → **Preview** untuk memeriksa data/foto.
3. Klik **Generate OTP**. Hapus antrean bila perlu.
**Hasil:** OTP dibuat sistem untuk dipakai nasabah menyelesaikan aktivasi.

### 4.5 Pengajuan Pembukaan Rekening (Tabungan / Deposito / Kredit)
**Tujuan:** memproses pengajuan rekening dari nasabah.
**Langkah:**
1. Buka submenu **Pengajuan Rekening** → pilih **Tabungan**, **Deposito**, atau **Kredit**.
2. Klik pengajuan untuk membuka **detail & dokumen** (KTP, KK, NPWP, agunan, dll.).
3. Untuk **Approve**: pilih **produk** & **kode kantor** yang sesuai, lalu setujui — sistem akan
   membuat CIF (bila nasabah baru) & nomor rekening di Core Banking.
4. Untuk **Reject**: isi **alasan**.
5. Opsional: **Ekspor PDF**.
**Hasil:** rekening terbentuk di Core (jika approve) atau pengajuan ditolak dengan alasan.

### 4.6 Manajemen Blacklist
**Tujuan:** memblokir entitas yang mencurigakan (device/NIK/no HP/username).
**Langkah:** buka **Blacklist** → **Tambah** (isi data + alasan) / **Ubah** / **Hapus**.
**Hasil:** entitas ter-blacklist akan ditolak sistem saat onboarding.

### 4.7 Manajemen Banner/Promo
**Tujuan:** mengelola banner/berita di aplikasi nasabah.
**Langkah:** buka **Banner** → **Tambah/Ubah**: isi judul, detail (editor teks), **unggah
gambar**, tanggal mulai/selesai, status → **Simpan**. **Hapus** bila tidak dipakai.
**Hasil:** banner tampil di aplikasi nasabah sesuai status & rentang tanggal.

### 4.8 Tema & Navigasi
- Ganti **tema terang/gelap** via tombol matahari/bulan.
- Navigasi lewat **sidebar** (desktop) atau menu **≡** (mobile).

---

## 5. FAQ (Pertanyaan Umum)

| Pertanyaan | Jawaban |
|------------|---------|
| Kenapa saya tiba-tiba ter-logout? | Sesi idle otomatis berakhir demi keamanan. Login kembali. |
| Approve registrasi apakah langsung buat rekening? | Tidak. Approve **registrasi** membuat **OTP aktivasi**. Pembuatan rekening terjadi saat **approve pengajuan rekening**. |
| Kenapa reject harus isi alasan? | Alasan tercatat sebagai jejak keputusan dan info bagi nasabah. |
| Data tampil kosong padahal koneksi ada | Kemungkinan gagal dekripsi respons; hubungi tim IT (sinkronisasi kunci). |

## 6. Troubleshooting

| Masalah | Kemungkinan Penyebab | Solusi |
|---------|----------------------|--------|
| Tidak bisa login | Username/password salah atau akun terkunci | Cek kredensial; hubungi administrator |
| Halaman error / data tidak muncul | Sesi habis atau backend bermasalah | Login ulang; laporkan ke IT |
| Foto/dokumen tidak tampil | File belum tersedia di server | Muat ulang; laporkan bila menetap |
| Upload gambar banner gagal | Ukuran file terlalu besar | Perkecil gambar (< 25 MB) |

## 7. Glosarium

| Istilah | Penjelasan |
|---------|------------|
| OTP | Kode sekali pakai untuk aktivasi akun nasabah |
| CIF | Nomor identitas nasabah di Core Banking |
| Blacklist | Daftar entitas yang diblokir dari onboarding |
| PENDING/APPROVED/REJECTED | Status proses: menunggu / disetujui / ditolak |

## 8. Bantuan & Dukungan
- **Helpdesk / IT BPR:** _isi email / nomor_
- **Vendor (USSI):** _kontak tim pemeliharaan_
- **Jam layanan:** _..._

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dokumen dibuat berdasarkan fitur `admin-onboard`. |

---

*[← Kembali ke IBS Onboarding Admin](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
