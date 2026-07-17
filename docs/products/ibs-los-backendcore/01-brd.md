# 📄 Business Requirement Document (BRD) — IBS LOS BackEndCore

> Dokumen kebutuhan bisnis untuk produk **IBS LOS BackEndCore**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS LOS BackEndCore |
| Jenis Dokumen     | Business Requirement Document (BRD) |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 17 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Latar Belakang

**IBS LOS** (Loan Origination System) adalah aplikasi front-office tempat petugas BPR/bank
memproses pengajuan kredit — mulai dari input data debitur, analisa kelayakan, hingga
persetujuan. Data inti perbankan sendiri tersimpan di **IBS Core Banking** (database MySQL
legacy: nasabah `nasabah`, kredit `kredit`, agunan `kre_agunan`, riwayat `kredit_history`,
dan puluhan tabel referensi).

Selama proses originasi, IBS LOS membutuhkan dua hal dari Core Banking:
1. **Membaca** data debitur — riwayat kredit historis (untuk penilaian kolektibilitas/
   *track record*) dan detail identitas nasabah (untuk verifikasi & pre-fill formulir).
2. **Menulis** — memposting pengajuan pinjaman yang sudah disetujui ke Core Banking
   (membuat CIF nasabah baru bila perlu, membuat rekening kredit, dan mencatat agunan).

Mengizinkan IBS LOS mengakses database Core secara langsung berisiko: kredensial DB tersebar,
tidak ada kontrol akses terpusat, dan setiap perubahan skema Core (yang berbeda antar-BPR)
dapat merusak integrasi. Skema Core juga **bervariasi antar-instalasi** (ada BPR memakai
`kredit_history`, ada yang memakai tabel tahunan `kredit_2xxx`; ada yang punya tabel kode
kelurahan/kecamatan, ada yang tidak).

Dibutuhkan sebuah **service integrasi** yang berdiri di depan IBS Core Banking dan menjadi
**satu-satunya pintu** bagi IBS LOS untuk membaca & menulis data Core, dengan:
- **autentikasi request** berbasis tanda tangan (HMAC-SHA256) sehingga hanya IBS LOS yang
  memegang *shared secret* yang dapat memanggil,
- **adaptasi otomatis** terhadap variasi skema Core antar-BPR sehingga satu artefak dapat
  dipasang di banyak instalasi,
- **integritas posting pinjaman** (nasabah + kredit + agunan tersimpan atomik dalam satu
  transaksi),
- kontrak API yang stabil & terdokumentasi (OpenAPI/Swagger).

Produk ini dikenal internal sebagai **"INQ SERVICE"** (service inquiry & posting Core).

## 2. Tujuan (Business Objectives)

| Kode | Tujuan | Indikator Keberhasilan (KPI) |
|------|--------|------------------------------|
| OBJ-1 | Menyediakan **gerbang integrasi tunggal** dari IBS LOS ke IBS Core Banking (inquiry + posting). | 100% akses LOS→Core melewati service ini, bukan koneksi DB langsung. |
| OBJ-2 | Mengamankan akses melalui **request signature (HMAC-SHA256)** per shared secret. | 0 insiden pemanggilan tanpa signature valid (di luar localhost). |
| OBJ-3 | Menjamin **integritas posting pinjaman** — nasabah, kredit, & agunan tersimpan atomik. | 0 kasus data pinjaman tersimpan sebagian (partial write). |
| OBJ-4 | **Portabilitas antar-BPR** — satu artefak beradaptasi dengan variasi skema Core. | Service jalan tanpa perubahan kode pada BPR dengan skema berbeda (mis. `bprlanggeng`, `balidananiaga`). |
| OBJ-5 | Menyajikan **riwayat & detail debitur** untuk mendukung analisa kredit di LOS. | Data history & details tampil akurat berdasarkan NIK. |
| OBJ-6 | Menyediakan **dokumentasi API** yang interaktif bagi tim integrasi LOS. | Seluruh endpoint tampil & dapat dicoba di Swagger UI. |

## 3. Ruang Lingkup (Scope)

### ✅ In Scope
- **Health check** service (`GET /core/health`).
- **Inquiry riwayat debitur** berdasarkan NIK — ringkasan (total pinjaman, plafon, baki debet,
  kolektibilitas terburuk, status blacklist) + daftar riwayat kredit historis.
- **Inquiry detail debitur** berdasarkan NIK — identitas lengkap, alamat, pekerjaan,
  pasangan, data pemegang usaha & pejabat.
- **Posting pinjaman** (`POST /core/post-loan`) — dalam satu transaksi: registrasi nasabah
  baru (bila `status_nasabah = BARU`), pembuatan rekening kredit, dan pencatatan agunan
  (satu atau lebih; default "KREDIT TANPA AGUNAN" bila kosong).
- **Generator ID otomatis** — `no_rekening`, `no_cif` (nasabah_id), dan `agunan_id`
  berbasis template/stored function Core Banking bila tidak dikirim klien.
- **Resolusi kode referensi** — mengubah deskripsi (kelurahan, kecamatan, kota, provinsi,
  pekerjaan, jabatan, badan usaha, bidang usaha, tujuan kredit, jenis agunan) menjadi kode
  master Core secara otomatis (fuzzy lookup + cache).
- **Adaptasi skema** — deteksi otomatis ketersediaan tabel/kolom (`kredit_history` vs
  `kredit_2xxx`, `css_kode_kelurahan`, `no_ktp_pasangan`, `hub_penjamin`).
- **Keamanan request signature** (HMAC-SHA256) + anti-replay + toleransi skew waktu.
- **Dokumentasi OpenAPI/Swagger**.

### ❌ Out of Scope
- Aplikasi IBS LOS itu sendiri (front-office originasi kredit) — produk ini hanya API backend.
- Pembuatan/perubahan skema database Core Banking IBS — skema dikelola oleh IBS/DBA BPR.
- Proses persetujuan/scoring kredit (business rule analisa) — dilakukan di IBS LOS.
- Modul Core Banking di luar nasabah/kredit/agunan (mis. tabungan, deposito, GL, akuntansi).
- Manajemen user/role — service ini diautentikasi per *shared secret*, bukan per pengguna.
- Integrasi ke biro kredit eksternal (SLIK OJK) — data history bersumber dari DB Core internal.

## 4. Stakeholder

| Peran | Nama / Unit | Tanggung Jawab |
|-------|-------------|----------------|
| Sponsor | Manajemen TI BPR / USSI | Menyetujui inisiatif integrasi LOS–Core. |
| Business Owner | Unit Kredit / Operasional BPR | Menetapkan aturan data nasabah, kredit, & agunan. |
| Product Owner | Tim Produk USSI | Memprioritaskan endpoint & roadmap service. |
| Konsumen Sistem | Tim/Developer IBS LOS | Mengintegrasikan LOS ke API service ini (pemegang shared secret). |
| DBA / Tim IBS Core | Pengelola Core Banking BPR | Menjaga skema Core & menyediakan kredensial DB. |
| End User (tidak langsung) | Analis Kredit / CS / Teller | Mengonsumsi data & posting via IBS LOS. |
| Developer / Maintainer | Tim USSI | Pengembangan & pemeliharaan service `ibslos4core`. |

## 5. Kebutuhan Bisnis

| ID | Kebutuhan Bisnis | Prioritas | Catatan |
|----|------------------|-----------|---------|
| BR-001 | Setiap pemanggilan dari IBS LOS harus **terautentikasi** via request signature sebelum diproses. | Wajib | Header `X-Client-Id`, `X-Timestamp`, `X-Signature` (HMAC-SHA256). |
| BR-002 | Request dari **localhost** boleh tanpa signature untuk keperluan development/health probe. | Sedang | `127.0.0.1` / `::1` dikecualikan. |
| BR-003 | Signature harus tahan terhadap **replay** dan request yang **kedaluwarsa**. | Wajib | Anti-replay per (clientId+timestamp+signature); toleransi skew 300 detik. |
| BR-004 | Service harus menyajikan **riwayat kredit debitur** beserta ringkasan penilaian. | Wajib | Total pinjaman, plafon, baki debet, kolektibilitas terburuk, status blacklist. |
| BR-005 | Service harus menyajikan **detail identitas debitur** untuk verifikasi & pre-fill. | Wajib | Termasuk data pasangan, pemegang usaha, & pejabat. |
| BR-006 | Posting pinjaman harus **atomik** — nasabah, kredit, & agunan tersimpan seluruhnya atau tidak sama sekali. | Wajib | Satu `@Transactional`. |
| BR-007 | Nasabah baru harus mendapat **CIF (nasabah_id) unik** yang di-generate otomatis. | Wajib | Retry regenerate bila terjadi duplikasi. |
| BR-008 | `no_rekening` kredit & `agunan_id` harus di-generate otomatis bila tidak dikirim. | Wajib | Berbasis template/stored function Core; ada fallback. |
| BR-009 | Data referensi (wilayah, pekerjaan, badan usaha, dll.) boleh dikirim sebagai **deskripsi** dan otomatis di-resolve ke kode Core. | Tinggi | Fuzzy `LIKE` + cache; bila sudah berupa kode, dipakai apa adanya. |
| BR-010 | Service harus **beradaptasi dengan variasi skema Core** antar-BPR tanpa perubahan kode. | Wajib | Deteksi tabel/kolom via `SHOW TABLES/COLUMNS`. |
| BR-011 | Kegagalan bisnis (data tidak ditemukan / gagal DB) tidak boleh membuat integrasi LOS *error* keras. | Wajib | Selalu HTTP 200 + `success:false` + pesan; `401` hanya untuk signature. |
| BR-012 | Detail penyebab error **tidak boleh** bocor ke pemanggil non-lokal. | Wajib | Pesan detail (`: <cause>`) hanya ditambahkan untuk request localhost. |
| BR-013 | Seluruh endpoint harus terdokumentasi (OpenAPI/Swagger). | Sedang | `/core-api/swagger-ui.html`. |

## 6. Proses Bisnis

### 6.1 Kondisi Saat Ini (As-Is)
IBS LOS mengambil data Core dan/atau menulis pengajuan pinjaman melalui koneksi database
langsung atau integrasi ad-hoc. Akibatnya kredensial DB tersebar ke aplikasi front-office,
tidak ada titik kontrol keamanan terpusat, dan setiap perbedaan skema Core antar-BPR
menuntut penyesuaian manual yang rawan kesalahan.

### 6.2 Kondisi Diharapkan (To-Be)
Seluruh akses LOS ke Core Banking dilewatkan melalui **IBS LOS BackEndCore**. LOS
menandatangani setiap request dengan shared secret; service memvalidasi tanda tangan,
beradaptasi dengan skema Core yang terpasang, lalu menjalankan operasi baca/tulis secara aman.

```
[IBS LOS]
   │  Susun canonical string: METHOD\nURI\nX-Timestamp\nSHA256(body)
   │  X-Signature = Base64(HMAC-SHA256(shared_secret, canonical))
   ▼
[IBS LOS BackEndCore]  → validasi signature (client_id, skew, anti-replay)
                        → deteksi skema Core (SHOW TABLES/COLUMNS)
                        → resolve deskripsi → kode referensi (cache)
                        → inquiry (history/details)  ATAU
                        → post-loan @Transactional (nasabah → kredit → agunan)
   ▼
[IBS Core Banking DB (MySQL)]  → response { success, ... }
```

## 7. Asumsi & Batasan

- **Asumsi:**
  - IBS LOS & service berbagi **shared secret** dan `client_id` yang sama (`app.ini`
    section `[security]`).
  - Database Core Banking BPR sudah tersedia beserta tabel nasabah/kredit/agunan/referensi
    dan stored function generator ID (`GENERATE_NASABAH_ID`, dll.).
  - DB `database_sys` (`<db>_sys`) tersedia untuk membaca template setting di `sys_mysysid`.
  - NIK (`no_id`) menjadi kunci pencarian debitur.
- **Batasan:**
  - Terhubung ke **Core Banking IBS legacy** melalui datasource MySQL; skema tidak dibuat/
    diubah oleh service ini.
  - Konfigurasi runtime dibaca dari **`app.ini`** (format INI) via `-Dconfig.location`,
    bukan hanya `application.properties`.
  - Skema Core **bervariasi antar-BPR** — service beradaptasi otomatis, namun mengasumsikan
    nama tabel/kolom inti mengikuti konvensi IBS.
  - **Tanpa DTO**: payload diterima sebagai `Map<String,Object>` dan query memakai raw
    `JdbcTemplate`.
  - Platform: Java 17, Spring Boot 3.4.4; artefak `ibslos4core-0.0.1-SNAPSHOT.jar`.

## 8. Risiko Bisnis

| ID | Risiko | Dampak | Mitigasi |
|----|--------|--------|----------|
| RB-001 | Shared secret bocor | Pihak lain dapat memposting pinjaman palsu ke Core | Simpan secret di `app.ini` (git-ignored); rotasi berkala; batasi jaringan ke service. |
| RB-002 | Replay request posting | Dobel-posting pinjaman | Anti-replay guard (clientId+timestamp+signature) + toleransi skew 300s. |
| RB-003 | Perbedaan skema Core antar-BPR | Query gagal / kolom tidak ditemukan | Deteksi tabel/kolom adaptif + varian SQL fallback. |
| RB-004 | Posting sebagian (nasabah dibuat tapi kredit gagal) | Data Core tidak konsisten | Seluruh posting dalam satu `@Transactional` (rollback bila gagal). |
| RB-005 | Duplikasi ID (nasabah_id / agunan_id) | Insert gagal | Generate ulang + retry hingga 5x sebelum menyerah. |
| RB-006 | Kebocoran detail error (SQL/tabel) ke pemanggil | Information disclosure | Pesan generik untuk non-lokal; detail hanya untuk localhost. |
| RB-007 | Resolusi kode referensi salah (fuzzy LIKE) | Data master pinjaman keliru | Kirim kode langsung bila tersedia; kurasi tabel referensi; cache hasil. |

## 9. Kriteria Penerimaan (Acceptance Criteria)

- Request tanpa/dengan signature salah dari non-localhost ditolak `401` dengan pesan yang sesuai
  (`Missing security headers.`, `Signature tidak valid.`, `Request expired.`, `Replay detected.`,
  `Client tidak valid.`).
- `GET /core/debtor-history/{nik}` mengembalikan ringkasan + daftar riwayat untuk NIK yang ada,
  dan `success:false` "data nasabah tidak ditemukan" untuk NIK yang tidak ada.
- `GET /core/debtor-details/{nik}` mengembalikan detail identitas untuk NIK yang ada, dan
  `success:false` "ID tidak ditemukan" bila tidak ada.
- `POST /core/post-loan` menyimpan nasabah (bila BARU) + kredit + agunan secara atomik dan
  mengembalikan `no_cif`, `no_rekening`, `agunan_id`; kegagalan DB → `success:false` tanpa
  data tersimpan sebagian.
- Service yang sama berjalan pada dua BPR dengan skema Core berbeda tanpa perubahan kode.
- Seluruh endpoint tampil & dapat dicoba melalui Swagger UI.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dokumen dibuat berdasarkan implementasi `CoreController`, `CoreService`, & lapisan security. |

---

*[← Kembali ke IBS LOS BackEndCore](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
