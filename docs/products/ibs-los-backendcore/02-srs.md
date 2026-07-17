# 📐 Software Requirements Specification (SRS) — IBS LOS BackEndCore

> Spesifikasi kebutuhan perangkat lunak untuk produk **IBS LOS BackEndCore** (mengacu kaidah IEEE 830).

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS LOS BackEndCore |
| Jenis Dokumen     | Software Requirements Specification (SRS) |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 17 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Pendahuluan

### 1.1 Tujuan
Dokumen ini menjabarkan spesifikasi kebutuhan perangkat lunak untuk **IBS LOS BackEndCore**
(`ibslos4core`) — service REST *standalone* (artefak `ibslos4core-0.0.1-SNAPSHOT.jar`) yang
menjadi gerbang integrasi aman antara **IBS LOS** dan **IBS Core Banking**. SRS ini menjadi
acuan bagi developer, QA, dan tim integrasi IBS LOS dalam membangun, menguji, dan mengonsumsi
layanan. SRS menurunkan kebutuhan bisnis pada [BRD IBS LOS BackEndCore](01-brd.md) menjadi
kebutuhan fungsional (FR) dan non-fungsional (NFR) yang dapat diverifikasi.

### 1.2 Ruang Lingkup Sistem
Service menyediakan API untuk: **health check**, **inquiry riwayat debitur**, **inquiry
detail debitur**, dan **posting pinjaman** (nasabah + kredit + agunan) ke Core Banking.
Seluruh operasi tulis dijalankan atomik dan seluruh request (di luar localhost) diamankan
dengan **request signature HMAC-SHA256**. Service tidak memiliki UI; ia menyediakan kontrak
API stabil sehingga IBS LOS tidak menyentuh database Core secara langsung. Manfaat utama:
keamanan terpusat, integritas posting pinjaman, portabilitas antar-BPR (adaptasi skema), dan
resolusi kode referensi otomatis.

### 1.3 Definisi & Akronim

| Istilah | Penjelasan |
|---------|------------|
| IBS LOS | Loan Origination System — aplikasi front-office pengajuan kredit (konsumen API ini). |
| IBS Core | Core Banking IBS — database MySQL legacy yang menjadi backend service ini. |
| INQ SERVICE | Nama internal produk (service inquiry & posting Core). |
| NIK | Nomor Induk Kependudukan; kolom `no_id` pada tabel `nasabah`; kunci pencarian debitur. |
| CIF / `no_cif` | Customer Information File — identitas nasabah (`nasabah_id`). |
| HMAC | Hash-based Message Authentication Code (SHA-256) untuk tanda tangan request. |
| Canonical string | `METHOD\nURI\nX-Timestamp\nSHA256(body)` — dasar perhitungan signature. |
| Skew | Toleransi selisih waktu antara `X-Timestamp` & waktu server (default 300 detik). |
| Kolektibilitas | Kualitas kredit (1–5 / L, DPK, KL, D, M) — penilaian *track record* debitur. |
| Baki debet | Sisa pokok pinjaman (`pokok_saldo_akhir`). |
| Plafon | Batas/limit pinjaman (`plafond` / `jml_pinjaman`). |
| Agunan | Jaminan kredit (`kre_agunan`). |
| Pejabat | Pengurus/pemegang usaha untuk debitur badan usaha. |

### 1.4 Referensi
- [BRD IBS LOS BackEndCore](01-brd.md)
- [API Contract IBS LOS BackEndCore](03-api-contract.md)
- [Desain Database](04-database-design.md)
- [Deployment Guide](10-deployment-guide.md)
- OpenAPI/Swagger UI: `/core-api/swagger-ui.html`

## 2. Deskripsi Umum

### 2.1 Perspektif Produk
Service adalah lapisan **stateless REST** berbasis Spring Boot 3.4.4 / Java 17 yang berada di
antara IBS LOS dan IBS Core Banking.

```
[IBS LOS]  →  [IBS LOS BackEndCore (ibslos4core)]  →  [IBS Core Banking (MySQL)]
 (shared      - request signature HMAC-SHA256          ├─ DB primary (mis. bprlanggeng)
  secret)     - anti-replay & skew guard               └─ DB sys (mis. bprlanggeng_sys)
              - deteksi skema adaptif (SHOW TABLES)
              - resolve deskripsi → kode referensi
              - post-loan @Transactional
              - Swagger/OpenAPI
```

Karakteristik arsitektural penting:
- **Konfigurasi via `app.ini`** (INI): `MainApp` membaca section `[server] [database]
  [database_sys] [security]` lalu men-set System property Spring sebelum boot.
- **Dua koneksi DB**: datasource utama (`spring.datasource`, via `JdbcTemplate`) ke DB core;
  koneksi manual `ConnectionPoolSys` ke `database_sys` untuk membaca setting `sys_mysysid`.
- **Adaptif skema**: query dipilih runtime berdasar ketersediaan tabel/kolom.
- **Tanpa DTO**: payload `Map<String,Object>`, query raw `JdbcTemplate`.
- Kontrak response seragam berbasis field `success` (bukan HTTP status kode bisnis).

### 2.2 Fungsi Utama Produk
- Health check service.
- Inquiry riwayat kredit debitur + ringkasan (plafon, baki debet, kolektibilitas, blacklist).
- Inquiry detail identitas debitur (termasuk pasangan, pemegang usaha, pejabat).
- Posting pinjaman atomik (registrasi nasabah baru + rekening kredit + agunan).
- Generator otomatis `no_cif`, `no_rekening`, `agunan_id`.
- Resolusi deskripsi → kode master referensi (fuzzy lookup + cache).
- Adaptasi skema Core antar-BPR.
- Keamanan request signature (HMAC-SHA256) + anti-replay + skew guard.

### 2.3 Karakteristik Pengguna

| Tipe Pengguna | Hak Akses | Keterangan |
|---------------|-----------|------------|
| IBS LOS (konsumen API) | Seluruh endpoint via signature valid | Pemegang `client_id` + shared secret. |
| Developer lokal | Seluruh endpoint tanpa signature | Hanya dari `127.0.0.1`/`::1` (mode dev). |
| Operator / DevOps | Health probe & Swagger | Monitoring & verifikasi deploy. |
| DBA / Tim IBS Core | (tidak langsung) | Menyediakan & mengelola skema DB Core. |

### 2.4 Batasan & Asumsi
- Bahasa/platform: **Java 17**, **Spring Boot 3.4.4**, Maven; JSON via Jackson; SpringDoc OpenAPI 2.8.9.
- Datastore: **MySQL** (DB core + DB `_sys`); koneksi via `JdbcTemplate` & `DriverManager`.
- Konfigurasi runtime dari **`app.ini`** (`-Dconfig.location`); `application.properties`
  hanya untuk nilai non-rahasia/default.
- **Tanpa DTO**; payload `Map<String,Object>`; raw SQL.
- Skema Core dikelola eksternal (IBS/DBA); service **tidak** membuat/mengubah skema.
- Domain berbahasa Indonesia (identifier & pesan). Nominal disimpan sebagai `DECIMAL`/angka Core.

## 3. Kebutuhan Fungsional

| ID | Kebutuhan Fungsional | Deskripsi | Prioritas | Ref. BRD |
|----|----------------------|-----------|-----------|----------|
| FR-001 | Health check | Mengembalikan status service (`success`, `message: OK`, `service: ibslos4core`). | Wajib | — |
| FR-002 | Validasi request signature | Memvalidasi `X-Client-Id`/`X-Timestamp`/`X-Signature` (HMAC-SHA256) sebelum controller; localhost dikecualikan. | Wajib | BR-001, BR-002 |
| FR-003 | Anti-replay & skew guard | Menolak request kedaluwarsa (skew > 300s) & request berulang (replay). | Wajib | BR-003 |
| FR-004 | Inquiry riwayat debitur | Mengembalikan daftar riwayat kredit + ringkasan (total pinjaman, plafon, baki debet, kolektibilitas terburuk, blacklist) per NIK. | Wajib | BR-004 |
| FR-005 | Inquiry detail debitur | Mengembalikan detail identitas debitur (alamat, pekerjaan, pasangan, pemegang usaha, pejabat, `pinjaman_ke`) per NIK. | Wajib | BR-005 |
| FR-006 | Posting pinjaman (atomik) | Menyimpan nasabah (bila BARU) + kredit + agunan dalam satu transaksi; mengembalikan `no_cif`, `no_rekening`, `agunan_id`. | Wajib | BR-006 |
| FR-007 | Generate no_cif | Membuat `nasabah_id` unik untuk nasabah baru (retry bila duplikat). | Wajib | BR-007 |
| FR-008 | Generate no_rekening | Membuat nomor rekening kredit berbasis template/stored function; fallback bila gagal. | Wajib | BR-008 |
| FR-009 | Generate agunan_id | Membuat ID agunan berbasis template/stored function; fallback bila gagal. | Wajib | BR-008 |
| FR-010 | Resolusi kode referensi | Mengubah deskripsi (wilayah, pekerjaan, jabatan, badan/bidang usaha, tujuan kredit, jenis agunan) menjadi kode master via fuzzy `LIKE` + cache. | Tinggi | BR-009 |
| FR-011 | Adaptasi skema | Memilih varian SQL/argumen berdasar ketersediaan tabel/kolom (`kredit_history` vs `kredit_2xxx`, `css_kode_kelurahan`, `no_ktp_pasangan`, `hub_penjamin`). | Wajib | BR-010 |
| FR-012 | Penanganan error bisnis | Selalu HTTP 200 + `success:false` + pesan untuk kegagalan bisnis/DB; `401` hanya untuk signature. | Wajib | BR-011 |
| FR-013 | Masking detail error | Menyertakan detail penyebab error hanya untuk request localhost. | Wajib | BR-012 |
| FR-014 | Dokumentasi OpenAPI | Menyajikan Swagger UI & `/v3/api-docs`. | Sedang | BR-013 |
| FR-015 | Default nilai posting | Mengisi default `product_id=00`, `unit_code=000`, `tgltrans=hari ini`, agunan "KREDIT TANPA AGUNAN" bila kosong. | Sedang | BR-006 |

### Detail FR-002 (Validasi Request Signature)
- **Pemicu:** setiap request non-OPTIONS di luar path Swagger/`/error`.
- **Input:** header `X-Client-Id`, `X-Timestamp`, `X-Signature`, method, URI, body.
- **Proses:** `SignatureAuthenticationFilter` men-*cache* body → `RequestSignatureValidator`:
  bila ketiga header kosong & request localhost → lolos; else cek header lengkap
  (`Missing security headers.`) → `client_id` == config (`Client tidak valid.`) → timestamp
  numeric (`Timestamp tidak valid.`) → skew ≤ 300s (`Request expired.`) → anti-replay
  (`Replay detected.`) → susun canonical `METHOD\nURI\nX-Timestamp\nSHA256hex(body)` →
  bandingkan `Base64(HMAC-SHA256(secret, canonical))` konstan-waktu (`Signature tidak valid.`).
- **Output:** lanjut ke controller (valid) atau `401` `{success:false, message:<pesan>}`.
- **Aturan validasi:** timestamp ≤ 10 digit dianggap detik (×1000); >10 digit milidetik.

### Detail FR-004 (Inquiry Riwayat Debitur)
- **Pemicu:** `GET /core/debtor-history/{nik}`.
- **Input:** path `nik` (String).
- **Proses:** bila `nik` kosong → `success:false` "data nasabah tidak ditemukan". Bila tabel
  `kredit_history` ada → query GEN2. Bila tidak → resolusi schema `<db>_re` + tabel
  `kredit_2xxx` terbaru → query GEN1. Bangun ringkasan: `total_pinjaman` = jumlah baris,
  `total_plafon`/`total_bakidebet` = penjumlahan, `worst_kolektibilitas` = rank tertinggi
  (L/1..M/5), `status_blacklist` dari `flag_backlist`.
- **Output:** `{ success:true, nik, nama, summary:{...}, history:[...] }`.
- **Aturan validasi:** kolektibilitas dipetakan ke catatan (Lancar/Kurang Lancar/Diragukan/Macet).

### Detail FR-006 (Posting Pinjaman)
- **Pemicu:** `POST /core/post-loan` (Bearer signature + body JSON).
- **Input:** `Map<String,Object>` — identitas produk/kantor/tanggal/user, data nasabah,
  data pasangan & darurat, plafon/tenor/suku bunga, `pejabat_json[]`, `agunan_json[]`.
- **Proses (`@Transactional`):** normalisasi + default → generate `no_rekening` → tentukan/
  generate `agunan_id` → tentukan/generate `no_cif` (jika BARU) → resolve `tujuan_kredit`
  → bila nasabah baru: resolve kode wilayah + bucket pengeluaran → `INSERT nasabah`
  (retry regenerate CIF bila `DuplicateKeyException`, maks 5×) → `INSERT kredit` →
  untuk tiap agunan: `INSERT kre_agunan` (retry ID) + `INSERT kre_agunan_relasi`.
- **Output:** `{ success:true, no_cif, agunan_id, no_rekening, message }`.
- **Aturan validasi:** `DataAccessException` → rollback + `success:false` "Gagal insert data
  ke database"; error lain → "Terjadi kesalahan internal saat memproses post loan".

## 4. Kebutuhan Non-Fungsional

| ID | Kategori | Kebutuhan |
|----|----------|-----------|
| NFR-001 | Performa | Inquiry (history/details) < 2 detik untuk 95% request pada beban normal; cache tabel/kolom & kode referensi untuk mengurangi query berulang. |
| NFR-002 | Keamanan — AuthN | Request signature HMAC-SHA256 per shared secret; perbandingan signature konstan-waktu (`MessageDigest.isEqual`). |
| NFR-003 | Keamanan — Anti-abuse | Anti-replay guard (map in-memory dengan pembersihan) + toleransi skew 300 detik. |
| NFR-004 | Keamanan — Data | Detail error (SQL/tabel) hanya untuk localhost; pesan generik untuk pemanggil non-lokal. |
| NFR-005 | Integritas Transaksi | Posting nasabah+kredit+agunan atomik (`@Transactional`); retry regenerate ID pada duplikasi. |
| NFR-006 | Portabilitas | Satu artefak beradaptasi dengan variasi skema Core antar-BPR (deteksi tabel/kolom). |
| NFR-007 | Ketersediaan | Health check `/core/health`; healthcheck Docker; timeout JDBC (connect 5s, socket 30s). |
| NFR-008 | Skalabilitas | Service stateless (kecuali guard replay in-memory); dapat di-scale di belakang reverse proxy. |
| NFR-009 | Kompatibilitas | Kompatibel dengan skema legacy IBS; konfigurasi INI kompatibel gaya backend lama. |
| NFR-010 | Observability | Logging SLF4J ke console & `./logs`; log durasi tiap langkah `postLoan` (step timing). |
| NFR-011 | Dokumentasi | Seluruh endpoint terdokumentasi OpenAPI/Swagger. |
| NFR-012 | Lokalisasi | Domain & pesan berbahasa Indonesia; tanggal format ISO (`serverTimezone=Asia/Jakarta`). |

## 5. Use Case Utama

```
Aktor: IBS LOS (Aplikasi Loan Origination System)
Use Case: Posting Pinjaman ke Core Banking
Pre-condition:
  - IBS LOS memegang client_id & shared secret yang valid.
  - Pengajuan kredit sudah disetujui di LOS; data debitur, kredit, & agunan lengkap.
Main Flow:
  1. LOS menyusun canonical string & X-Signature (HMAC-SHA256) lalu POST /core/post-loan.
  2. Filter memvalidasi signature (client_id, skew, anti-replay, HMAC).
  3. Service menentukan default & meng-generate no_rekening, agunan_id, dan no_cif (bila BARU).
  4. Service me-resolve deskripsi referensi (wilayah, tujuan kredit, badan/bidang usaha) → kode.
  5. Dalam satu @Transactional: INSERT nasabah (bila baru) → INSERT kredit → INSERT agunan + relasi.
  6. Service mengembalikan success:true beserta no_cif, no_rekening, agunan_id.
Post-condition:
  - Nasabah (bila baru), rekening kredit, & agunan tercatat konsisten di Core Banking.
Alternative/Exception Flow:
  - Signature invalid → 401 (pesan sesuai). 
  - Duplikasi nasabah_id/agunan_id → regenerate & retry (maks 5×).
  - Kegagalan DB → rollback, HTTP 200 success:false "Gagal insert data ke database".
  - Error tak terduga → HTTP 200 success:false "Terjadi kesalahan internal saat memproses post loan".
```

## 6. Antarmuka Eksternal
- **Antarmuka Pengguna:** tidak ada UI langsung; hanya Swagger UI untuk eksplorasi API.
- **Antarmuka Sistem/API:** lihat [API Contract](03-api-contract.md) — seluruh endpoint REST.
- **Antarmuka Data:** lihat [Desain Database](04-database-design.md) — DB core MySQL + DB `_sys`.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dokumen dibuat berdasarkan implementasi service. |

---

*[← Kembali ke IBS LOS BackEndCore](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
