# 📐 Software Requirements Specification (SRS) — SimpelkeuJabar

> Spesifikasi kebutuhan perangkat lunak untuk **SimpelkeuJabar** (**Sistem Pelaporan Keuangan Jawa Barat**) — aplikasi web Laravel untuk import data keuangan, pelaporan PDF/Excel, dokumen tata kelola, dashboard, dan CMS portal publik.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | SimpelkeuJabar      |
| Jenis Dokumen     | Software Requirements Specification (SRS) |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 11 Oktober 2026     |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Pendahuluan

### 1.1 Tujuan

Mendefinisikan kebutuhan fungsional & non-fungsional **SimpelkeuJabar** sebagai acuan
penyusunan dokumen turunan (User Manual, Test Case, UAT) oleh technical writer & QA.

### 1.2 Ruang Lingkup

Aplikasi terdiri dari dua bagian dalam satu basis kode:

1. **Portal publik** (tanpa login) — landing page multi-halaman yang kontennya dikelola CMS.
2. **Panel aplikasi** (wajib login) — import data keuangan & dokumen, laporan, dashboard,
   master profil lembaga, CMS, dan administrasi akun.

Aplikasi **tidak** melakukan pembukuan, tidak terintegrasi dengan sistem eksternal (OJK /
core banking), dan tidak memiliki API publik.

### 1.3 Definisi & Akronim

| Istilah | Penjelasan |
|---------|------------|
| BUMD | Badan Usaha Milik Daerah |
| BPR | Bank Perkreditan Rakyat (jenis lembaga `1`) |
| LKM | Lembaga Keuangan Mikro (jenis lembaga `2`) |
| Jamkrida | Penjaminan Kredit Daerah (jenis lembaga `3`) |
| Bank Umum | Jenis lembaga `4` |
| Lembaga | Entitas pelapor; diidentifikasi **sandi lembaga** (`m_lembaga.sandi`, 6 karakter) |
| Sandi kantor | Sandi lembaga pemilik baris data transaksi (`t_*.sandi_kantor`) |
| Sandi (COA) | Kode pos akun laporan (mis. `1000000000` = Aktiva) — master di tabel `m_*` |
| Realisasi | Data keuangan aktual per akhir bulan (tabel `t_*`) |
| Rencana / Target | Data RBB per tahun (tabel `t_*_ren`) |
| RBB | Rencana Bisnis Bank |
| Neraca | Laporan posisi keuangan (Aktiva, Kewajiban, Ekuitas) |
| Administratif | Rekening administratif (*off-balance sheet*) |
| TKS | Tingkat Kesehatan (rasio kesehatan lembaga) |
| KAP (Publikasi OJK) | Kualitas Aset Produktif & Rasio dari Laporan Publikasi OJK (tabel `t_kap_rasio`) |
| Hasil KAP (dokumen) | Laporan hasil audit **Kantor Akuntan Publik** (PDF) — beda dengan KAP di atas |
| Kolektibilitas | Kualitas kredit: L (Lancar), DPK (Dalam Perhatian Khusus), KL (Kurang Lancar), D (Diragukan), M (Macet) |
| NPL | *Non Performing Loan* — kredit KL + D + M |
| Jenis penggunaan kredit | `10` Modal Kerja, `20` Investasi, `39` Konsumtif |
| Sektor kredit | PDG Perdagangan, PTN Pertanian, PKN Perikanan, PKB Perkebunan, INF Infrastruktur, KSM Konsumtif, MKJ Modal Kerja, IVS Investasi, ASN, NAS Non-ASN |
| Dekom | Dewan Komisaris |
| GCG | *Good Corporate Governance* |
| RUPS | Rapat Umum Pemegang Saham |
| Super-admin | Akun yang **tidak terikat lembaga**; `is_admin = 1` di sesi |
| CMS | *Content Management System* modul "Kelola Website" |

### 1.4 Referensi

- [BRD — SimpelkeuJabar](01-brd.md)
- Repo sumber: `CLAUDE.md`, `CHANGELOG.md`, `AUDIT.md`, `DEPLOY_CPANEL.md`,
  `DEPLOY_CHECKLIST.md`, `routes/web.php`.
- Surat Diskominfo Jabar No. 4057/KOM.03.01.08/APTIKA (18 Sep 2026) — rekomendasi keamanan.

## 2. Deskripsi Umum

### 2.1 Perspektif Produk

```
                 ┌──────────────────────────── Browser ───────────────────────────┐
  Publik ───────►│ Portal publik (Blade + tema Porto / Bootstrap 3)               │
                 │   /  /sejarah  /berita  /berita/{id}  /bank/{id}  /sitemap.xml │
  Pengguna ─────►│ Panel aplikasi (Blade + Metronic, AJAX + jQuery DataTables)     │
  terdaftar      │   /login → /home → modul dimuat via /loadModule/...             │
                 └───────────────┬────────────────────────────────────────────────┘
                                 │ HTTP(S), sesi cookie + CSRF
                 ┌───────────────▼────────────────────────────────────────────────┐
                 │ Laravel 8 (PHP 7.4 produksi / 8.1 Docker)                       │
                 │  Auth & sesi │ Import (maatwebsite/excel) │ PDF (dompdf)         │
                 │  Laporan & Excel export │ Dashboard │ Profil Bank │ CMS          │
                 └───────┬───────────────────────────────┬────────────────────────┘
                         │                               │
              ┌──────────▼──────────┐        ┌───────────▼────────────────────────┐
              │ MySQL / Percona 5.7 │        │ Filesystem (public/)               │
              │ m_*, t_*, t_*_ren,  │        │ kajiandekom/ hasilkap/ gcg/ rups/  │
              │ t_log*, sys_*, cms_*│        │ jamkrida/ profil_bank/ cms/ pdf/   │
              └─────────────────────┘        └────────────────────────────────────┘
```

Panel aplikasi berupa *single shell* (`/home`) yang memuat modul ke area konten via AJAX
(`loadModule`). Laporan PDF dirender ke berkas di folder `pdf/` lalu ditampilkan sebagai
pratinjau; Excel diunduh langsung.

### 2.2 Fungsi Utama

1. Portal publik terkelola CMS.
2. Autentikasi, sesi, dan kebijakan kata sandi.
3. Import data keuangan Excel (Realisasi, Rencana, Publikasi OJK) dengan validasi.
4. Upload & tinjau dokumen tata kelola PDF.
5. Laporan per lembaga, realisasi vs target, RBB, gabungan, dan rekap per lembaga (PDF & Excel).
6. Dashboard kinerja.
7. Master profil lembaga, pengurus, kepemilikan saham.
8. Administrasi akun pengguna.

### 2.3 Karakteristik Pengguna

| Peran (`sys_role`) | Kode | Terikat lembaga? | Hak akses (menu) |
|--------------------|------|------------------|------------------|
| Administrator | `00` | Tidak (super-admin) | Seluruh menu: Dashboard + Dashboard Rekap, Import, Laporan (Gabungan, Rekap Lembaga, Realisasi/Target per lembaga, Publikasi OJK, RBB), Tinjau Dokumen, Profil Bank, Kelola Website, Status Pelaporan, Reset Password Pengguna. |
| Provinsi | `01` | Umumnya tidak (super-admin) *(konfirmasi)* | Sama dengan Administrator bila akun tanpa lembaga. |
| Bank | `02` | Ya | Dashboard, Import, Laporan lembaga sendiri (realisasi, target, Publikasi OJK, RBB), Tinjau Dokumen, Status Pelaporan. |
| LKM | `03` | Ya | Sama dengan Bank. |
| Jamkrida | `04` | Ya | Sama dengan Bank (termasuk upload Laporan Jamkrida). |
| Guest | `05` | — | Seperti peran di atas **tanpa menu Import Data** (baca-saja). |

> **Aturan inti:** status super-admin ditentukan dari **ada/tidaknya lembaga** pada akun
> (`sys_user.sandi` kosong ⇒ `is_admin = 1`), bukan dari kode peran.

### 2.4 Batasan Umum

- Bahasa antarmuka: Bahasa Indonesia; format angka Indonesia (`1.234.567,89`).
- Browser modern desktop (panel admin dioptimalkan untuk desktop; landing responsif).
- Hosting produksi cPanel: DocumentRoot = root project → aset `public/` diakses dengan
  prefix `/public/...`.
- Template Excel wajib mengikuti nama sheet & posisi kolom yang ditetapkan (§3.3).
- Batas unggah 64 MB, memori 512 MB, waktu eksekusi 300 detik (konfigurasi Docker; produksi menyesuaikan cPanel).

## 3. Kebutuhan Fungsional

Kode: `FR-<modul>-<no>`.

### 3.1 Portal Publik

| Kode | Kebutuhan |
|------|-----------|
| FR-PUB-01 | Beranda `/` menampilkan banner slide aktif, running text aktif, sambutan + tombol Login, daftar bank aktif (kartu), dan tab Layanan & Produk BUMD. |
| FR-PUB-02 | `/sejarah` menampilkan timeline Sejarah BUMD terurut tahun. |
| FR-PUB-03 | `/berita` menampilkan daftar berita terbit (status aktif) dengan paginasi; `/berita/{id}` menampilkan detail dan menambah jumlah tayang. |
| FR-PUB-04 | `/bank/{id}` menampilkan detail bank dalam tab: **Profil & Keuangan**, **Pengurus**, **Penyertaan Modal**. |
| FR-PUB-05 | `/sitemap.xml` membangkitkan sitemap berisi hanya: beranda, sejarah, daftar berita, setiap berita terbit, setiap bank aktif. `robots.txt` menunjuk ke sitemap. |
| FR-PUB-06 | Identitas situs (nama, kontak, logo, footer) diambil dari Pengaturan Umum CMS. |
| FR-PUB-07 | Konten berita ditampilkan setelah disanitasi (tanpa script/event handler). |
| FR-PUB-08 | Halaman error (404/403/419/429/500/503) ber-branding aplikasi, tanpa informasi teknis. |

### 3.2 Autentikasi, Sesi & Akun

| Kode | Kebutuhan |
|------|-----------|
| FR-AUT-01 | Login di `/login` dengan email + password; password diverifikasi bcrypt. |
| FR-AUT-02 | Maksimal **5 percobaan gagal** per kombinasi email+IP; setelahnya dikunci **60 detik** dengan pesan sisa waktu. |
| FR-AUT-03 | Sesi menyimpan: id user, nama/kode peran, sandi & nama lembaga, jenis lembaga, Dati II, email, nama lengkap, `is_admin`. Masa sesi default 120 menit. |
| FR-AUT-04 | Seluruh route non-publik wajib sesi; tanpa sesi → GET diarahkan ke `/login`, AJAX/POST menerima HTTP 401 JSON "Sesi berakhir atau belum login". |
| FR-AUT-05 | Logout menghapus sesi dan kembali ke `/login`. |
| FR-AUT-06 | Ganti password: wajib password lama benar; password baru ≥ **12 karakter** dengan huruf kapital, huruf kecil, angka, dan karakter spesial (divalidasi di server). |
| FR-AUT-07 | Reset password pengguna lain hanya oleh super-admin; sistem membangkitkan password acak kuat (≥12, CSPRNG) dan menampilkannya sekali ke admin; daftar dapat diekspor PDF. |
| FR-AUT-08 | Profil pengguna: user biasa hanya dapat mengubah akunnya sendiri; super-admin dapat mengubah akun mana pun. |

### 3.3 Import Data Keuangan (Excel)

| Kode | Kebutuhan |
|------|-----------|
| FR-IMP-01 | **Import Realisasi**: input lembaga (super-admin memilih; user lembaga otomatis lembaganya), periode (bulan → dinormalisasi ke akhir bulan), file `.xlsx/.xls`. |
| FR-IMP-02 | Sheet yang dibaca: `Neraca`, `Administratif`, `Laba Rugi`, `TKS`, `Arus Kas`, `Kredit`. Baris data mulai baris 2; nilai formula dihitung. |
| FR-IMP-03 | Sheet keuangan (Neraca, Administratif, Laba Rugi, TKS, Arus Kas): kolom A = sandi COA, kolom C = nominal (dibulatkan 2 desimal). |
| FR-IMP-04 | Sheet Kredit: kolom A kolektibilitas, B jenis penggunaan, C sektor ekonomi, D nominal, E jumlah debitur; sel kolektibilitas/jenis kosong mewarisi baris di atasnya (format *merged cell*). |
| FR-IMP-05 | Data periode+lembaga yang sama **diganti** (hapus lalu tulis ulang). |
| FR-IMP-06 | **Validasi balance** sebelum simpan permanen: Aktiva (`1000000000`) = Kewajiban (`2000000000`) + Ekuitas (`3000000000`), dan Laba Rugi tahun berjalan (`3104040400`) = pos laba di Neraca (`3105020000`); toleransi 0,01. |
| FR-IMP-07 | Seluruh import dalam **satu transaksi DB**: gagal validasi/error ⇒ *rollback*, data lama utuh, file sementara dihapus. |
| FR-IMP-08 | Sukses ⇒ catat log upload (tipe, periode, lembaga) yang menjadi sumber Status Pelaporan. |
| FR-IMP-09 | **Import Rencana/Target**: struktur 6 sheet sama; sebelum unggah, sistem memeriksa apakah rencana tahun berjalan sudah ada — bila ada, proses ditolak ("DATA RENCANA SUDAH TERSEDIA"). Tanpa validasi balance. |
| FR-IMP-10 | **Import Laporan Publikasi OJK**: sheet `KapRasio`; transaksional. |
| FR-IMP-11 | UI: dropzone drag-and-drop, konfirmasi SweetAlert2 sebelum menimpa data, pesan kesalahan dari server ditampilkan. |

### 3.4 Dokumen Tata Kelola (PDF)

| Kode | Kebutuhan |
|------|-----------|
| FR-DOK-01 | Upload PDF per lembaga + periode untuk: **Kajian Dewan Komisaris**, **Hasil Audit KAP**, **GCG**, **RUPS**, **Laporan Jamkrida**. Disimpan di folder masing-masing dengan nama hash MD5. |
| FR-DOK-02 | Setiap upload tercatat di tabel log jenis dokumennya (`t_logkajian`, `t_loghasilkap`, `t_loggcg`, `t_logrups`, `t_logjamkrida`). |
| FR-DOK-03 | **Tinjau Dokumen** (5 halaman preview): daftar lembaga × periode dengan status kirim/belum, filter status, ringkasan hitungan, dan tautan pratinjau PDF. |
| FR-DOK-04 | **Status Pelaporan**: daftar status upload data keuangan (realisasi/rencana) per lembaga per periode, dengan filter & ringkasan. |

### 3.5 Laporan

Semua laporan: input lembaga (otomatis untuk user lembaga) + periode; keluaran **Preview
PDF** dan **Download Excel**. Judul sheet Excel ≤ 31 karakter.

| Kode | Laporan | Isi | Akses |
|------|---------|-----|-------|
| FR-LAP-01 | Neraca | Posisi neraca per pos COA | Semua |
| FR-LAP-02 | Administratif | Rekening administratif | Semua |
| FR-LAP-03 | Laba Rugi | Pendapatan, beban, laba | Semua |
| FR-LAP-04 | TKS | Rasio tingkat kesehatan | Semua |
| FR-LAP-05 | Arus Kas | Arus kas | Semua |
| FR-LAP-06 | Rekapitulasi Kredit | Kredit per kolektibilitas × jenis penggunaan | Semua |
| FR-LAP-07 | Rekapitulasi Kredit Sektor | Kredit per sektor ekonomi | Semua |
| FR-LAP-08 | Versi **Target** dari FR-LAP-01…07 | Sumber tabel `t_*_ren` | Semua |
| FR-LAP-09 | Laporan Publikasi OJK | KAP & Rasio | Semua |
| FR-LAP-10 | **Laporan RBB** | Neraca & Laba Rugi: target (rencana 31 Des tahun terpilih) vs realisasi (bulan terpilih) + % capaian | Semua |
| FR-LAP-11 | Rekap Keuangan / Neraca / Laba Rugi / Administratif / Arus Kas **Gabungan** | Penjumlahan seluruh lembaga | Super-admin |
| FR-LAP-12 | Rekap Kredit per Kolektibilitas / per Jenis Penggunaan (gabungan) | | Super-admin |
| FR-LAP-13 | Rekap **Per Lembaga**: Neraca, Laba Rugi, TKS, Kredit | Lembaga sebagai kolom | Super-admin |

### 3.6 Dashboard

| Kode | Kebutuhan |
|------|-----------|
| FR-DSB-01 | Dashboard utama: baris KPI, **Tren Laba BPR & LKM** tahun berjalan (klik bulan → detail per lembaga), **Tren NPL BPR & LKM** (klik bulan → detail), **Top 10 Lembaga Laba Terbesar** (periode terakhir), **Posisi Prosentase Saham**, **Tren Modal Pemprov Jabar**. |
| FR-DSB-02 | Dashboard per lembaga: ekuitas, aset & kewajiban, pendapatan & biaya, laba rugi, TKS, kredit, kredit per jenis penggunaan. |
| FR-DSB-03 | **Dashboard Rekap** (super-admin): ekuitas, aset & kewajiban, pendapatan & biaya, laba rugi (12 bulan terakhir); rekap kredit per kolektibilitas dan per jenis penggunaan (konsumtif / modal kerja / investasi). |
| FR-DSB-04 | Pembagian nol (NPL, komposisi saham) ditangani tanpa error. |

### 3.7 Profil Bank, Pengurus & Saham (super-admin)

| Kode | Kebutuhan |
|------|-----------|
| FR-PRF-01 | CRUD Profil Bank: identitas, logo (JPG/PNG; opsional saat edit), ringkasan modal/aset/pendapatan/beban/laba rugi, status aktif (menentukan tampil di portal). |
| FR-PRF-02 | CRUD Pengurus per bank: tipe (direksi/komisaris), jabatan, nama, tanggal mulai & berakhir masa jabatan, status. |
| FR-PRF-03 | **Alert masa jabatan**: daftar pengurus aktif dengan tanggal berakhir ≤ hari ini + **90 hari**, beserta sisa hari dan penanda kedaluwarsa; tampil sebagai badge. |
| FR-PRF-04 | CRUD Kepemilikan Saham / Penyertaan Modal per bank (pemegang saham dari master, nilai/porsi). Data ini dipakai tab Penyertaan Modal portal & chart saham dashboard. |

### 3.8 CMS "Kelola Website" (super-admin)

| Kode | Kebutuhan |
|------|-----------|
| FR-CMS-01 | Banner Slide: CRUD judul, caption, gambar (JPG/JPEG/PNG/WEBP), tautan, urutan, status aktif. |
| FR-CMS-02 | Running Text: CRUD teks, urutan, status aktif. |
| FR-CMS-03 | Sejarah (Timeline): CRUD tahun, judul, deskripsi, urutan, status. |
| FR-CMS-04 | Berita: CRUD judul, ringkasan, konten WYSIWYG (CKEditor self-hosted), gambar sampul, tanggal terbit, status terbit; konten disanitasi HTMLPurifier saat simpan. |
| FR-CMS-05 | Layanan & Produk: CRUD judul, deskripsi, gambar, urutan, status, dengan kategori `LAYANAN` / `PRODUK_BUMD`. |
| FR-CMS-06 | Pengaturan Umum: pasangan kunci–nilai identitas situs (nama, kontak, alamat, logo JPG/PNG/WEBP/SVG). |
| FR-CMS-07 | Gambar lama dihapus dari disk saat diganti/dihapus; pratinjau gambar *lightbox* di admin. |

### 3.9 Umum / Lintas-Modul

| Kode | Kebutuhan |
|------|-----------|
| FR-UMM-01 | **Tenant isolation**: untuk non-super-admin, sandi lembaga pada setiap query laporan/import/dashboard **dipaksa dari sesi**, input request diabaikan. Super-admin boleh memilih lembaga atau "semua". |
| FR-UMM-02 | Format respons AJAX seragam: `response_code` (`00` sukses / `01` gagal), `response_message`, `response_data`. |
| FR-UMM-03 | Tabel data memakai DataTables dengan kolom **Aksi di sisi kiri** berlabel. |
| FR-UMM-04 | Referensi dropdown (lembaga, master) disediakan endpoint `reference` / `getLembaga`. |

## 4. Kebutuhan Non-Fungsional

| Kode | Kategori | Kebutuhan |
|------|----------|-----------|
| NFR-01 | Keamanan | Seluruh route non-publik dilindungi middleware sesi (`auth.session`). |
| NFR-02 | Keamanan | CSRF aktif untuk semua form POST; cookie sesi `http_only` + `same_site`. |
| NFR-03 | Keamanan | Query memakai parameter binding / sanitasi kode — tanpa perangkaian input mentah ke SQL. |
| NFR-04 | Keamanan | Password bcrypt; kebijakan ≥12 karakter kompleks; rate-limit login. |
| NFR-05 | Keamanan | Direktori internal framework (`/app`, `/config`, `/vendor`, `/storage`, dotfile, `.sql`, `composer.*`) diblokir 403 via `.htaccess`/konfigurasi Apache. |
| NFR-06 | Keamanan | Produksi `APP_DEBUG=false`, `APP_ENV=production`, HTTPS dipaksa (`FORCE_HTTPS`). |
| NFR-07 | Integritas | Import transaksional; tidak ada data parsial. |
| NFR-08 | Kerahasiaan | Folder dokumen upload tidak di-commit ke git. |
| NFR-09 | Performa | Index komposit pada tabel transaksi `(sandi_kantor, periode, sandi)`; setting CMS di-cache. |
| NFR-10 | Kapasitas | Upload ≤ 64 MB; pembuatan PDF/Excel rekap ≤ 300 detik dengan memori 512 MB. |
| NFR-11 | Ketertelusuran | Setiap perubahan dicatat di `CHANGELOG.md` (Before / After / Alasan). |
| NFR-12 | Usabilitas | UI konsisten Metronic (`card-flush`, badge `badge-light-*`, konfirmasi aksi destruktif). |
| NFR-13 | SEO/Keamanan publik | Tidak ada komentar publik, AMP, atau halaman bawaan CMS pihak ketiga. |

## 5. Antarmuka Eksternal

### 5.1 Antarmuka Endpoint Internal

Seluruh endpoint dipanggil oleh halaman aplikasi sendiri (AJAX, `POST` + token CSRF).
Ringkasan kelompok (rincian di dokumen 03 bila dibuat):

| Kelompok | Contoh endpoint | Proteksi |
|----------|-----------------|----------|
| Publik | `GET /`, `/sejarah`, `/berita`, `/berita/{id}`, `/bank/{id}`, `/sitemap.xml`, `/login`, `POST /verifyLogin`, `/logout`, `/cekSession` | Tanpa login |
| Akun | `/changePassword`, `/resetPasswordHash`, `/getListUser`, `/updateUser` | Sesi |
| Import | `/importRealisasi`, `/importRencana`, `/checkIfExistRencana`, `/importKapRasio`, `/importKajianDekom`, `/importHasilKap`, `/importGCG`, `/importRUPS`, `/importJamkrida` | Sesi |
| Laporan | `/laporan<Nama>` (PDF) dan `/laporan<Nama>Excel` — ±27 pasang | Sesi |
| Log/Status | `/getLogUpload*`, `/loadLogDetail` | Sesi |
| Dashboard | `/getDashboard*`, `/getLabaRugiTren`, `/getNPLTren`, `/getLabaRanking`, `/getSaham`, `/getTrenModalBumd` | Sesi |
| Profil Bank | `/getProfilBank`, `/addProfilBank`, `/updateDataBank`, `/deleteDataBank`, `*Pengurus*`, `*Saham*` | Sesi |
| CMS | `get/add/update/delete` + `Banner`, `RunningText`, `Timeline`, `Berita`, `Produk`; `getSetting`, `saveSetting` | Sesi |
| Shell | `/home`, `/loadModule/{path}` | Sesi |

### 5.2 Antarmuka Pengguna

- **Portal publik**: tema Porto (Bootstrap 3), responsif.
- **Panel**: tema Metronic (Bootstrap 5), sidebar biru: Dashboard · Dashboard Rekap ·
  Import Data · Laporan · Tinjau Dokumen · Profil Bank · Kelola Website · Status Pelaporan ·
  Reset Password Pengguna (visibilitas sesuai §2.3).

### 5.3 Antarmuka Berkas

| Berkas | Arah | Format |
|--------|------|--------|
| Template Realisasi / Rencana | Masuk | Excel 6 sheet (§3.3) |
| Template Publikasi OJK | Masuk | Excel sheet `KapRasio` |
| Dokumen tata kelola | Masuk | PDF |
| Gambar CMS / logo bank | Masuk | JPG/JPEG/PNG/WEBP (+SVG untuk logo situs) |
| Laporan | Keluar | PDF (A4) & XLSX |

### 5.4 Ketergantungan Perangkat Lunak

| Komponen | Versi / Library |
|----------|-----------------|
| Framework | Laravel 8 (PHP ^7.3 / 8.1) |
| Database | MySQL / Percona 5.7 |
| Excel | `maatwebsite/excel` ^3.1 (PhpSpreadsheet) |
| PDF | `barryvdh/laravel-dompdf` ^0.9 |
| DataTables | `yajra/laravel-datatables-oracle` ~9.0 |
| Sanitasi HTML | HTMLPurifier |
| UI | Metronic, Porto, jQuery, SweetAlert2, CKEditor (self-hosted) |
| Build aset | Laravel Mix (Webpack) |

### 5.5 Kelompok Data (ringkas)

| Kelompok | Tabel |
|----------|-------|
| Master COA & referensi | `m_neraca`, `m_labarugi`, `m_administratif`, `m_aruskas`, `m_tks`, `m_kap_rasio`, `m_rekap`, `r_kolek`, `r_jenis_penggunaan`, `r_sektor_ekonomi`, `m_dati` |
| Lembaga & saham | `m_lembaga`, `profile_bank`, `profile_bank_pengurus`, `m_pemegang_saham`, `m_saham`, `t_kepemilikan_saham`, `t_modal_bumd` |
| Realisasi | `t_neraca`, `t_labarugi`, `t_administratif`, `t_aruskas`, `t_tks`, `t_kredit`, `t_kap_rasio` |
| Rencana | `t_neraca_ren`, `t_labarugi_ren`, `t_administratif_ren`, `t_aruskas_ren`, `t_tks_ren`, `t_kredit_ren` |
| Log | `t_logupload`, `t_logkajian`, `t_loghasilkap`, `t_loggcg`, `t_logrups`, `t_logjamkrida` |
| Akun | `sys_user`, `sys_role` |
| CMS | `cms_setting`, `cms_banner`, `cms_running_text`, `cms_timeline`, `cms_section`, `cms_produk`, `cms_berita` |

## 6. Matriks Ketertelusuran (Ringkas)

| Kebutuhan Bisnis (BRD) | Kebutuhan Fungsional |
|------------------------|----------------------|
| BR-01 | FR-IMP-01…05, FR-IMP-11 |
| BR-02, BR-03 | FR-IMP-05…07 |
| BR-04 | FR-IMP-09 |
| BR-05 | FR-IMP-10 |
| BR-06 | FR-DOK-01, FR-DOK-02 |
| BR-07 | FR-DOK-03, FR-DOK-04, FR-IMP-08 |
| BR-08 | FR-LAP-01…09 |
| BR-09 | FR-LAP-11…13 |
| BR-10 | FR-LAP-08, FR-LAP-10 |
| BR-11 | FR-DSB-01…04 |
| BR-12 | FR-PRF-01, FR-PRF-02, FR-PRF-04 |
| BR-13 | FR-PRF-03 |
| BR-14 | FR-CMS-01…07, FR-PUB-01…06 |
| BR-15 | FR-UMM-01 |
| BR-16 | FR-AUT-01…08, NFR-01…06 |
| BR-17 | NFR-11 |

## 7. Catatan Terbuka & Gap (perlu konfirmasi)

Temuan dari pembacaan kode yang perlu diputuskan/diperjelas sebelum dokumen final:

| No | Catatan |
|----|---------|
| 1 | **Pembatasan peran hanya di sisi menu.** Menu Profil Bank, Kelola Website, dan Dashboard Rekap disembunyikan untuk non-admin, dan menu Import disembunyikan untuk Guest, tetapi endpoint CRUD/import terkait **belum memeriksa peran di server** (hanya cek sesi). Rekomendasi: tambahkan guard super-admin/peran di server. |
| 2 | **Pembuatan akun pengguna** tidak tersedia di UI (hanya ubah & reset). Konfirmasi apakah masuk scope. |
| 3 | Peran `01 Provinsi` vs `00 Administrator` tidak dibedakan oleh aplikasi (keduanya super-admin bila tanpa lembaga). Konfirmasi kebutuhan pembedaan. |
| 4 | Pengecekan "rencana sudah ada" memakai **tahun berjalan sistem**, bukan tahun dari periode yang dipilih — unggah rencana tahun depan di akhir tahun perlu diverifikasi perilakunya. |
| 5 | Label chart Dashboard Rekap untuk kode jenis penggunaan perlu diverifikasi (kode `10` = Modal Kerja, `20` = Investasi, `39` = Konsumtif). |
| 6 | Upload dokumen PDF belum memvalidasi tipe berkas di server. |
| 7 | Tenggat pelaporan & notifikasi pengingat belum ada (lihat BRD §6.3). |
| 8 | Platform EOL: Laravel 8 & PHP 7.4 produksi — rencana upgrade di luar scope dokumen ini. |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Perubahan | Oleh |
|-------|---------|-----------|------|
| 1.0.0 | 11 Okt 2026 | Draft awal disusun dari kode sumber. | |

*[← Kembali ke README produk](README.md)*
