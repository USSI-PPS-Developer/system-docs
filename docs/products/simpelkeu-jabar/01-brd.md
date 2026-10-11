# 📄 Business Requirement Document (BRD) — SimpelkeuJabar

> Dokumen kebutuhan bisnis untuk produk **SimpelkeuJabar** (**Sistem Pelaporan Keuangan Jawa Barat**) — aplikasi web pelaporan keuangan & tata kelola BUMD sektor keuangan milik Pemerintah Provinsi Jawa Barat, beserta portal informasi publik.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | SimpelkeuJabar      |
| Jenis Dokumen     | Business Requirement Document (BRD) |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 11 Oktober 2026     |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Latar Belakang

Pemerintah Provinsi Jawa Barat memiliki penyertaan modal pada sejumlah **BUMD sektor
keuangan**: Bank Perkreditan Rakyat (**BPR**), Lembaga Keuangan Mikro (**LKM**), lembaga
penjaminan kredit daerah (**Jamkrida**), dan **Bank Umum**. Data lokal saat ini memuat
±32 lembaga (16 BPR, 14 LKM, 1 Jamkrida, 1 Bank Umum). Sebagai pemegang saham dan
pembina, Pemprov perlu memantau **kinerja keuangan** (neraca, laba rugi, arus kas,
kesehatan, kredit) dan **kepatuhan tata kelola** (GCG, RUPS, hasil audit KAP, kajian
Dewan Komisaris) setiap lembaga secara berkala.

Tanpa sistem terpusat, laporan dikirim dalam format dan jadwal yang beragam, sulit
dikonsolidasi menjadi angka **gabungan provinsi**, dan sulit dibandingkan dengan
**Rencana Bisnis Bank (RBB)** yang telah disetujui.

**SimpelkeuJabar** menjawab kebutuhan tersebut dengan:

1. **Template Excel standar** yang diunggah tiap lembaga setiap bulan (realisasi) dan
   setiap tahun (rencana/target), divalidasi otomatis (neraca harus *balance*).
2. **Laporan siap cetak** (PDF & Excel) per lembaga maupun **gabungan seluruh lembaga**,
   termasuk perbandingan realisasi vs target.
3. **Repositori dokumen tata kelola** (PDF) dengan pemantauan lembaga mana yang sudah /
   belum mengirim.
4. **Dashboard** ringkas untuk pimpinan.
5. **Portal publik** (landing page) yang dikelola sendiri oleh admin provinsi — menggantikan
   situs WordPress lama yang menjadi sasaran insiden *web defacement / SEO poisoning*
   (surat Diskominfo Jabar No. 4057/KOM.03.01.08/APTIKA, 18 Sep 2026).

Aplikasi dibangun di atas **Laravel 8 (PHP)**, MySQL/Percona 5.7, panel admin berbasis
tema **Metronic**, dan landing publik berbasis tema **Porto**.

## 2. Tujuan (Business Objectives)

| Kode | Tujuan | Indikator Keberhasilan (KPI) |
|------|--------|------------------------------|
| OBJ-1 | Menstandarkan pengumpulan data keuangan seluruh BUMD keuangan. | Seluruh lembaga mengunggah realisasi bulanan via template yang sama. |
| OBJ-2 | Menjamin **kualitas & konsistensi** data yang masuk. | Data yang tidak *balance* (Aktiva ≠ Pasiva, atau laba neraca ≠ laba rugi) ditolak otomatis; tidak ada data parsial. |
| OBJ-3 | Menyediakan **konsolidasi provinsi** tanpa olah manual. | Laporan gabungan & rekap per lembaga dapat dihasilkan untuk periode apa pun dalam hitungan detik–menit. |
| OBJ-4 | Memantau capaian terhadap **RBB**. | Laporan Rencana vs Realisasi + % capaian per pos tersedia untuk tiap lembaga. |
| OBJ-5 | Memantau **kepatuhan dokumen tata kelola**. | Status kirim Kajian Dekom, Hasil KAP, GCG, RUPS, Jamkrida terlihat per lembaga per periode. |
| OBJ-6 | Memantau **masa jabatan pengurus**. | Alert otomatis untuk direksi/komisaris dengan sisa masa jabatan ≤ 90 hari. |
| OBJ-7 | Menyediakan **informasi publik** yang aman & dikelola mandiri. | Landing page dapat diperbarui admin tanpa developer; tidak ada fitur rawan (komentar publik, AMP). |
| OBJ-8 | Menjaga **kerahasiaan data antar lembaga**. | Operator lembaga hanya dapat melihat/mengubah data lembaganya sendiri. |

## 3. Ruang Lingkup (Scope)

### ✅ In Scope

**A. Portal Publik (tanpa login)**
- **Beranda** — banner slide, running text, sambutan + tombol Login, daftar bank/lembaga,
  tab Jenis Layanan & Produk BUMD.
- **Sejarah BUMD** — timeline peristiwa per tahun.
- **Berita** — daftar & detail berita (konten WYSIWYG, penghitung tayang).
- **Detail Bank** — per lembaga: tab Profil & Keuangan, Pengurus, Penyertaan Modal.
- **Sitemap XML & robots.txt** — hanya memuat URL publik yang sah.

**B. Autentikasi & Akun**
- Login email + password, logout, cek sesi.
- Ganti password sendiri dengan kebijakan kata sandi kuat.
- Reset password pengguna lain (khusus super-admin), dapat diekspor PDF.
- Profil pengguna (lihat/ubah data akun).

**C. Import Data Keuangan (Excel)**
- **Realisasi** (bulanan) — 1 file 6 sheet: Neraca, Administratif, Laba Rugi, TKS, Arus Kas,
  Kredit. Wajib *balance*.
- **Rencana / Target** (tahunan, RBB) — struktur 6 sheet yang sama; hanya sekali per tahun.
- **Laporan Publikasi OJK** — sheet `KapRasio` (Kualitas Aset Produktif & Rasio).

**D. Upload Dokumen Tata Kelola (PDF)**
- Kajian Dewan Komisaris, Hasil Audit KAP, GCG, RUPS, Laporan Jamkrida.
- **Tinjau Dokumen** — pratinjau/unduh dokumen yang sudah dikirim beserta status per lembaga.
- **Status Pelaporan** — riwayat & status upload data keuangan per lembaga per periode.

**E. Laporan (PDF & Excel)**
- Per lembaga — realisasi: Neraca, Administratif, Laba Rugi, TKS, Arus Kas, Rekapitulasi
  Kredit, Rekapitulasi Kredit per Sektor.
- Per lembaga — target: versi target dari ketujuh laporan di atas.
- Laporan Publikasi OJK (KAP & Rasio).
- **Laporan RBB** — Rencana vs Realisasi + % capaian (Neraca & Laba Rugi).
- **Gabungan provinsi** (admin): Rekap Keuangan, Neraca, Laba Rugi, Administratif, Arus
  Kas, Kredit per Kolektibilitas, Kredit per Jenis Penggunaan.
- **Rekap per lembaga** (admin): Neraca, Laba Rugi, TKS, Kredit — lembaga sebagai kolom.

**F. Dashboard**
- Dashboard utama: tren laba & tren NPL BPR/LKM tahun berjalan (dengan drill-down per
  bulan), Top 10 lembaga laba terbesar, posisi persentase saham, tren modal Pemprov Jabar,
  baris KPI ringkas.
- Dashboard Rekap (admin): ekuitas, aset & kewajiban, pendapatan & biaya, laba rugi
  (12 bulan terakhir), rekapitulasi kredit per kolektibilitas & per jenis penggunaan.

**G. Master & Profil Lembaga (admin)**
- Profil Bank — CRUD data lembaga, logo, ringkasan modal/aset/pendapatan/beban/laba.
- Pengurus — CRUD direksi & komisaris + masa jabatan + badge alert ≤ 90 hari.
- Kepemilikan Saham / Penyertaan Modal — CRUD pemegang saham per bank.

**H. CMS "Kelola Website" (admin)**
- Banner Slide, Running Text, Sejarah (Timeline), Berita, Layanan & Produk, Pengaturan
  Umum (identitas situs, kontak, logo).

### ❌ Out of Scope

- **Input data keuangan manual per pos** lewat form — seluruh data keuangan masuk via
  template Excel.
- **Pembukuan / Core Banking** — aplikasi hanya menerima angka hasil pembukuan lembaga.
- **Integrasi otomatis dengan OJK (APOLO/SLIK)** atau sistem core lembaga — tidak ada API
  pertukaran data; data diunggah manual.
- **Alur persetujuan (approval workflow)** atas data yang diunggah — data langsung berlaku
  setelah lolos validasi.
- **Registrasi mandiri pengguna** — akun dibuat oleh admin (di luar aplikasi / langsung DB).
  *(Konfirmasi: apakah pembuatan akun perlu masuk scope berikutnya?)*
- **Notifikasi email / WhatsApp** (pengingat batas waktu pelaporan, alert masa jabatan).
- **Komentar publik, keanggotaan publik, atau AMP** di portal publik (sengaja ditiadakan
  demi keamanan).
- **Aplikasi mobile native.**
- **Multi-bahasa** — seluruh antarmuka Bahasa Indonesia.

## 4. Stakeholder

| Stakeholder | Peran | Kepentingan |
|-------------|-------|-------------|
| Pemprov Jawa Barat (unit pembina BUMD) | Pemilik bisnis / sponsor | Pemantauan kinerja & kepatuhan BUMD, laporan pimpinan. |
| Admin Provinsi (super-admin) | Pengguna utama sisi provinsi | Rekap gabungan, kelola master, kelola website, kelola akun. |
| Operator Lembaga (BPR / LKM / Jamkrida / Bank) | Pengguna sisi lembaga | Mengunggah data & dokumen tepat waktu, mencetak laporan lembaganya. |
| Tamu (*Guest*) | Pengguna baca-saja | Melihat dashboard & laporan tanpa hak import. |
| Masyarakat umum | Pengunjung portal publik | Informasi profil BUMD, berita, sejarah, layanan. |
| Diskominfo Jabar | Pengawas keamanan TI pemerintah daerah | Kepatuhan rekomendasi keamanan (password, throttle, hardening). |
| Tim Pengembang (vendor) | Pembangun & pemelihara | Kejelasan scope, perubahan terdokumentasi (CHANGELOG). |

## 5. Kebutuhan Bisnis

| Kode | Kebutuhan | Prioritas | Objektif |
|------|-----------|-----------|----------|
| BR-01 | Lembaga dapat mengunggah data realisasi bulanan dalam satu file Excel standar. | Tinggi | OBJ-1 |
| BR-02 | Sistem menolak data yang tidak *balance* dan tidak meninggalkan data parsial. | Tinggi | OBJ-2 |
| BR-03 | Unggah ulang periode yang sama menggantikan data lama (koreksi), tanpa menghapus data lama bila unggahan baru gagal. | Tinggi | OBJ-2 |
| BR-04 | Lembaga dapat mengunggah rencana/target tahunan (RBB) satu kali per tahun. | Tinggi | OBJ-4 |
| BR-05 | Lembaga dapat mengunggah Laporan Publikasi OJK (KAP & Rasio). | Sedang | OBJ-1 |
| BR-06 | Lembaga dapat mengunggah dokumen tata kelola (PDF) per periode. | Tinggi | OBJ-5 |
| BR-07 | Admin dapat melihat status kirim data & dokumen seluruh lembaga per periode. | Tinggi | OBJ-5 |
| BR-08 | Pengguna dapat mencetak laporan keuangan per lembaga dalam PDF & Excel. | Tinggi | OBJ-3 |
| BR-09 | Admin dapat mencetak laporan gabungan provinsi & rekap per lembaga. | Tinggi | OBJ-3 |
| BR-10 | Pengguna dapat melihat perbandingan realisasi vs rencana + % capaian. | Tinggi | OBJ-4 |
| BR-11 | Pimpinan dapat melihat dashboard kinerja ringkas. | Sedang | OBJ-3 |
| BR-12 | Admin dapat mengelola profil lembaga, pengurus, dan kepemilikan saham. | Sedang | OBJ-6 |
| BR-13 | Sistem menandai pengurus yang masa jabatannya berakhir ≤ 90 hari. | Sedang | OBJ-6 |
| BR-14 | Admin dapat mengelola seluruh konten portal publik tanpa developer. | Tinggi | OBJ-7 |
| BR-15 | Operator lembaga hanya dapat mengakses data lembaganya sendiri. | Tinggi | OBJ-8 |
| BR-16 | Akses aplikasi dilindungi login dengan kata sandi kuat & pembatasan percobaan login. | Tinggi | OBJ-8 |
| BR-17 | Setiap perubahan aplikasi tercatat Before / After / Alasan untuk laporan ke Pemprov. | Tinggi | — |

## 6. Proses Bisnis

### 6.1 Kondisi Saat Ini (As-Is, sebelum sistem)

1. Lembaga menyusun laporan keuangan di format masing-masing.
2. Laporan dikirim via email/fisik ke Pemprov dengan jadwal tidak seragam.
3. Staf provinsi merekap manual ke spreadsheet untuk angka gabungan.
4. Perbandingan dengan RBB dan pemantauan dokumen tata kelola dilakukan ad-hoc.
5. Situs informasi publik berbasis WordPress, rawan diretas & sulit dikelola.

### 6.2 Kondisi Diharapkan (To-Be)

```
[Operator Lembaga]
  Login → Import Data → pilih periode → unggah Excel
        → Sistem validasi (struktur + balance)
            ├─ Gagal  → ditolak, data lama tetap utuh, pesan kesalahan
            └─ Sukses → data tersimpan, log upload tercatat
  Login → Import Data → unggah PDF tata kelola (Dekom/KAP/GCG/RUPS/Jamkrida)
  Login → Laporan → pilih jenis & periode → Preview PDF / Download Excel

[Admin Provinsi]
  Login → Status Pelaporan / Tinjau Dokumen → pantau siapa yang belum kirim
  Login → Laporan Gabungan / Rekap Lembaga → cetak konsolidasi provinsi
  Login → Dashboard / Dashboard Rekap → pantau tren
  Login → Profil Bank → perbarui profil, pengurus, saham → cek alert masa jabatan
  Login → Kelola Website → perbarui banner, berita, timeline, produk, pengaturan

[Publik]
  Buka simpelkeu.jabarprov.go.id → beranda / sejarah / berita / detail bank
```

### 6.3 Siklus Pelaporan

| Siklus | Aktivitas | Pelaku |
|--------|-----------|--------|
| Tahunan (awal tahun) | Unggah Rencana/Target (RBB) tahun berjalan | Operator lembaga |
| Bulanan | Unggah Realisasi periode akhir bulan | Operator lembaga |
| Periodik | Unggah Laporan Publikasi OJK | Operator lembaga |
| Sesuai jadwal tata kelola | Unggah Kajian Dekom, Hasil KAP, GCG, RUPS, Laporan Jamkrida | Operator lembaga |
| Bulanan / sesuai kebutuhan | Pantau status, cetak gabungan, tinjau dashboard | Admin provinsi |
| Sesuai kebutuhan | Perbarui konten portal publik & data pengurus | Admin provinsi |

> *Konfirmasi ke Pemprov:* batas waktu (tanggal) pelaporan bulanan & tata kelola belum
> diatur di aplikasi — saat ini aplikasi tidak menegakkan tenggat.

## 7. Asumsi & Batasan

**Asumsi**
- Setiap lembaga memakai **template Excel resmi** dengan nama sheet & urutan kolom yang
  tidak diubah; kode pos (sandi COA) mengikuti master aplikasi.
- Periode pelaporan selalu dinormalisasi ke **tanggal akhir bulan**.
- Satu akun pengguna terikat ke **paling banyak satu lembaga**; akun tanpa lembaga
  diperlakukan sebagai super-admin.
- Akun pengguna dibuat oleh admin/pengembang (tidak ada registrasi mandiri).

**Batasan**
- Framework **Laravel 8** sudah *end-of-life*; PHP produksi pada hosting cPanel masih 7.4
  (EOL). Upgrade direncanakan terpisah.
- Hosting produksi berupa **cPanel shared hosting** — DocumentRoot = root project, deploy
  via unggah berkas (tanpa SSH), sehingga pengamanan direktori mengandalkan `.htaccess`.
- Skema tabel domain **tidak dikelola migration**; perubahan skema dirilis sebagai patch SQL.
- Pembuatan PDF & Excel untuk rekap besar membutuhkan memori/timeout server yang memadai.

## 8. Risiko Bisnis

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Lembaga mengubah struktur template Excel | Import gagal / angka salah pos | Validasi balance; template resmi; pesan kesalahan jelas. *(Rekomendasi: validasi struktur sheet.)* |
| Sel non-angka di Excel dibaca sebagai 0 | Data keliru tanpa disadari | Validasi balance menangkap sebagian; rekomendasi validasi sel. |
| Kebocoran data antar lembaga | Pelanggaran kerahasiaan | Sandi lembaga dipaksa dari sesi untuk non-admin (tenant isolation). |
| Situs publik diretas (riwayat WordPress) | Reputasi Pemprov, subdomain dinonaktifkan | CMS native tanpa komentar/AMP, sanitasi HTML berita, blokir direktori internal, sitemap tertutup. |
| Pengambilalihan akun | Akses ilegal data keuangan | Kebijakan password ≥12 karakter kompleks, rate-limit login (5x / 60 detik), bcrypt. |
| Platform EOL (Laravel 8 / PHP 7.4) | Tidak ada patch keamanan | Rencana upgrade terjadwal. |
| Pengurus melewati masa jabatan tanpa diketahui | Pelanggaran tata kelola | Alert badge ≤ 90 hari. |

## 9. Kriteria Penerimaan (Acceptance Criteria)

| Kode | Kriteria |
|------|----------|
| AC-01 | Operator lembaga berhasil mengunggah file Realisasi yang *balance* dan menerima pesan "IMPORT DATA REALISASI SUKSES"; status periode tersebut tampil di Status Pelaporan. |
| AC-02 | File Realisasi yang tidak *balance* ditolak dengan pesan "NERACA LABA RUGI TIDAK BALANCE" dan data periode sebelumnya tetap utuh. |
| AC-03 | Unggah Rencana kedua kalinya pada tahun yang sama ditolak ("DATA RENCANA SUDAH TERSEDIA"). |
| AC-04 | Operator lembaga A tidak dapat menampilkan laporan lembaga B meskipun memanipulasi parameter permintaan. |
| AC-05 | Setiap laporan per lembaga dapat dipratinjau sebagai PDF dan diunduh sebagai Excel tanpa error. |
| AC-06 | Admin dapat menghasilkan laporan gabungan & rekap per lembaga untuk seluruh lembaga. |
| AC-07 | Laporan RBB menampilkan target, realisasi, dan % capaian per pos Neraca & Laba Rugi. |
| AC-08 | Dokumen PDF tata kelola yang diunggah dapat dipratinjau di menu Tinjau Dokumen beserta status kirim per lembaga. |
| AC-09 | Pengurus dengan sisa masa jabatan ≤ 90 hari tampil dengan badge peringatan. |
| AC-10 | Perubahan konten di Kelola Website langsung tampil di portal publik. |
| AC-11 | Halaman terproteksi tidak dapat diakses tanpa login (diarahkan ke `/login` atau HTTP 401). |
| AC-12 | Login gagal 5 kali berturut-turut mengunci percobaan selama 60 detik; password baru yang lemah ditolak. |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Perubahan | Oleh |
|-------|---------|-----------|------|
| 1.0.0 | 11 Okt 2026 | Draft awal disusun dari kode sumber (scope untuk technical writer). | |

*[← Kembali ke README produk](README.md)*
