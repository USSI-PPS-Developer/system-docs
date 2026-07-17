# 📄 Business Requirement Document (BRD) — IBS Onboarding Backend

> Dokumen kebutuhan bisnis untuk produk **IBS Onboarding Backend** (NEXT IBS Onboard Service).

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS Onboarding Backend |
| Jenis Dokumen     | Business Requirement Document (BRD) |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 17 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Latar Belakang

**IBS Onboarding Backend** adalah *backend service* untuk aplikasi **Onboarding nasabah IBS** —
kanal digital (mobile/web) tempat calon nasabah maupun nasabah eksisting sebuah BPR dapat
melakukan **registrasi**, **aktivasi akun**, dan **pengajuan pembukaan rekening** (tabungan,
deposito, kredit) secara mandiri tanpa harus datang ke kantor. Data inti perbankan tersimpan
pada **IBS Core Banking** (database MySQL legacy: nasabah `nasabah`, rekening `tabung`/
`deposito`/`kredit`, transaksi `tabtrans`/`deptrans`/`kretrans`, produk `tab_produk`/
`dep_produk`/`kre_produk`, dan tabel referensi kantor).

Proses onboarding membutuhkan orkestrasi antara **data aplikasi onboarding** (registrasi,
OTP/aktivasi, pengajuan, user aplikasi, blacklist, banner) dan **data Core Banking** (verifikasi
nasabah, pembuatan CIF & rekening saat pengajuan disetujui). Bila aplikasi mobile mengakses
Core Banking langsung, kredensial DB tersebar dan tidak ada titik kontrol. Karena itu dibutuhkan
sebuah *backend* tunggal yang:
- menyediakan **API untuk aplikasi klien** (registrasi, OTP, login, pengajuan, cek saldo/mutasi,
  produk, banner, info kantor),
- menyediakan **API back-office** bagi admin BPR untuk mereview & memproses registrasi/aktivasi/
  pengajuan, mengelola user, blacklist, dan banner,
- **memposting** hasil pengajuan yang disetujui ke Core Banking (membuat CIF nasabah baru bila
  perlu, membuat rekening tabungan/deposito/kredit) memakai generator ID Core,
- menerapkan **kontrol penyalahgunaan** (blacklist device/NIK/no HP, rate-limit OTP, lockout
  login, deteksi double-submit),
- menjaga **kerahasiaan data** melalui enkripsi payload respons (AES kunci harian) dan enkripsi
  OTP saat disimpan.

Produk ini dikenal internal sebagai **"NEXT IBS Onboard Service"**, dibangun dengan **Spring Boot 3
/ Java 17** dan terhubung ke **MySQL multi-datasource** (DB utama Core + DB sys parameter sistem).

## 2. Tujuan (Business Objectives)

| Kode | Tujuan | Indikator Keberhasilan (KPI) |
|------|--------|------------------------------|
| OBJ-1 | Menyediakan kanal **onboarding mandiri** (registrasi → aktivasi → pengajuan rekening) bagi nasabah BPR. | Nasabah dapat menyelesaikan pembukaan rekening tanpa datang ke kantor. |
| OBJ-2 | Menjadi **backend tunggal** yang menjembatani aplikasi onboarding dengan IBS Core Banking. | 100% akses aplikasi ke Core melewati service ini, bukan koneksi DB langsung. |
| OBJ-3 | Menyediakan **back-office** untuk verifikasi & pemrosesan pengajuan oleh admin BPR. | Registrasi/aktivasi/pengajuan dapat di-approve/reject dari dashboard admin. |
| OBJ-4 | Menjamin **posting rekening ke Core** saat pengajuan disetujui (CIF + rekening ter-generate). | Approval pengajuan menghasilkan `cif` & `no_rekening` yang konsisten di Core. |
| OBJ-5 | Menerapkan **kontrol keamanan & anti-abuse** (blacklist, rate-limit OTP, lockout login). | Percobaan onboarding oleh entitas ter-blacklist / abusive ditolak. |
| OBJ-6 | Melindungi **kerahasiaan payload** melalui enkripsi respons (AES harian) & OTP terenkripsi. | Payload data sukses terenkripsi; OTP tidak tersimpan dalam bentuk plaintext. |
| OBJ-7 | Menyediakan **dokumentasi API interaktif** (OpenAPI/Swagger) bagi tim frontend & integrasi. | Seluruh endpoint tampil & dapat dicoba di Swagger UI. |

## 3. Ruang Lingkup (Scope)

### ✅ In Scope
- **Registrasi nasabah** (`/api/register`) — submit data + foto KTP/selfie, review admin
  (approve/reject); approve membuat entri aktivasi + OTP.
- **OTP & Aktivasi** (`/api/otp`, `/api/aktivasi`) — request OTP (dengan cek blacklist,
  rate-limit, foto wajib), generate OTP admin, aktivasi akun user memakai OTP.
- **Autentikasi** — login user aplikasi (`/api/login`) dengan lockout, login admin
  back-office (`/api/admin/login`), ganti password (`/api/password/change`).
- **Pengajuan rekening** — tabungan (`/api/pengajuan-tabungan`), deposito
  (`/api/pengajuan-deposito`), kredit (`/api/pengajuan-kredit`): submit dari klien + review
  & approval admin; approval memposting nasabah/rekening ke Core.
- **Cek status & detail pengajuan** (`/api/pengajuan`).
- **Informasi keuangan** — cek saldo (`/api/saldo`), mutasi rekening (`/api/mutasi`),
  analisa finansial bulanan (`/api/analisa`).
- **Master & referensi** — produk tabungan/deposito/kredit, kode kantor, info kantor
  (lokasi), banner/berita aplikasi.
- **Manajemen** — user (`/api/user`), blacklist (`/api/blacklist`), dashboard rekap admin.
- **Keamanan** — blacklist device/NIK/no HP/username, rate-limit OTP, lockout login 3×,
  enkripsi respons (AES kunci harian) & OTP terenkripsi.
- **File upload/serve** — penyimpanan & penyajian foto (KTP, selfie, KK, NPWP, agunan).
- **Dokumentasi OpenAPI/Swagger**.

### ❌ Out of Scope
- Aplikasi klien (mobile/web) onboarding itu sendiri — produk ini hanya API backend.
- Aplikasi back-office/dashboard admin (frontend) — hanya API yang disediakan.
- Modul Core Banking di luar nasabah/rekening/transaksi/produk (mis. GL, akuntansi, kliring).
- Pembuatan/perubahan skema Core Banking IBS — dikelola oleh IBS/DBA BPR.
- Integrasi biro kredit eksternal (SLIK OJK) & e-KYC/verifikasi biometrik pihak ketiga.
- *Payment gateway* / transaksi finansial real-time (produk ini tidak memindahkan dana).

## 4. Stakeholder

| Peran | Nama / Unit | Tanggung Jawab |
|-------|-------------|----------------|
| Sponsor | Manajemen TI BPR / USSI | Menyetujui inisiatif kanal onboarding digital. |
| Business Owner | Unit Dana & Kredit / Operasional BPR | Menetapkan aturan produk, syarat pembukaan rekening & pengajuan. |
| Product Owner | Tim Produk USSI | Memprioritaskan fitur & roadmap onboarding. |
| Konsumen API (Klien) | Tim Developer Frontend (mobile/web) | Mengintegrasikan aplikasi nasabah ke API. |
| Konsumen API (Admin) | Tim Developer Back-office | Mengintegrasikan dashboard admin BPR. |
| Admin BPR / CS | Petugas back-office BPR | Memverifikasi & memproses registrasi/aktivasi/pengajuan. |
| DBA / Tim IBS Core | Pengelola Core Banking BPR | Menjaga skema Core & menyediakan kredensial DB. |
| End User | Calon nasabah / Nasabah eksisting | Melakukan registrasi, aktivasi, & pengajuan rekening. |
| Developer / Maintainer | Tim USSI | Pengembangan & pemeliharaan service `backendonboard`. |

## 5. Kebutuhan Bisnis

| ID | Kebutuhan Bisnis | Prioritas | Catatan |
|----|------------------|-----------|---------|
| BR-001 | Calon nasabah dapat **registrasi** dengan data diri + foto KTP & selfie. | Wajib | Endpoint `/api/register`; status awal PENDING. |
| BR-002 | Admin dapat **approve/reject** registrasi; approve memicu pembuatan **OTP aktivasi**. | Wajib | Approve → insert `obd_aktivasi` (OTP di-AES). |
| BR-003 | User dapat **aktivasi akun** memakai OTP untuk membuat kredensial login. | Wajib | Endpoint `/api/aktivasi`; verifikasi OTP + unik username/NIK/device. |
| BR-004 | Sistem harus mengirim/menyediakan **OTP** dengan **rate-limit** & foto wajib. | Wajib | Maks 3×/hari; double-submit 24 jam ditolak. |
| BR-005 | User dapat **login** dengan mekanisme **lockout** anti brute-force. | Wajib | 3× gagal → terkunci 15 menit (`is_locked`). |
| BR-006 | Admin back-office dapat **login** terpisah dari user aplikasi. | Wajib | Endpoint `/api/admin/login` (DB sys `sys_daftar_user`). |
| BR-007 | Nasabah dapat **mengajukan** pembukaan tabungan / deposito / kredit beserta dokumen. | Wajib | Multipart upload; tidak boleh ada pengajuan PENDING ganda. |
| BR-008 | Admin dapat **memproses pengajuan** (approve/reject); approve **memposting ke Core**. | Wajib | Approve → generate CIF (bila baru) + `no_rekening` + insert rekening Core. |
| BR-009 | Nasabah dapat melihat **status & detail pengajuan** miliknya. | Tinggi | Endpoint `/api/pengajuan/cekstatus/{user_id}` & `/detail`. |
| BR-010 | Nasabah dapat **cek saldo**, **mutasi**, & **analisa finansial** rekening. | Tinggi | Endpoint `/api/saldo`, `/api/mutasi`, `/api/analisa`. |
| BR-011 | Sistem menolak entitas **ter-blacklist** (device/NIK/no HP/username) pada alur onboarding. | Wajib | Tabel `obd_blacklist`; dicek saat register/OTP/login. |
| BR-012 | Admin dapat mengelola **user, blacklist, banner**, & melihat **dashboard rekap**. | Tinggi | CRUD + endpoint `/api/dashboard/*`. |
| BR-013 | Payload **data respons sukses harus dienkripsi**; **OTP disimpan terenkripsi**. | Wajib | AES kunci harian + `keyVersion`; OTP via `AESUtil`. |
| BR-014 | Aplikasi menyajikan **produk, kode kantor, info lokasi kantor, & banner**. | Sedang | Endpoint master/referensi. |
| BR-015 | Seluruh endpoint terdokumentasi (OpenAPI/Swagger). | Sedang | `/swagger-ui.html`. |

## 6. Proses Bisnis

### 6.1 Kondisi Saat Ini (As-Is)
Pembukaan rekening & aktivasi layanan digital dilakukan secara manual di kantor cabang:
calon nasabah datang, mengisi formulir kertas, dan petugas menginput ke Core Banking.
Tidak ada kanal mandiri, sehingga proses lambat, rawan antrean, dan tidak ada jejak digital
yang terverifikasi (foto KTP/selfie, device).

### 6.2 Kondisi Diharapkan (To-Be)
Calon nasabah melakukan onboarding mandiri melalui aplikasi. Backend memvalidasi (blacklist,
rate-limit, kelengkapan dokumen), mencatat registrasi/pengajuan, dan menyediakan alur review
bagi admin. Saat admin menyetujui, backend memposting nasabah & rekening ke Core Banking
secara otomatis dengan CIF & nomor rekening yang di-generate.

```
[Aplikasi Nasabah]                      [Back-office Admin]
   │ register (data+foto)                   │ review & approve/reject
   ▼                                         ▼
[IBS Onboarding Backend]  ── validasi (blacklist, rate-limit, foto) ──►  obd_register / obd_aktivasi
   │  OTP (AES) ── aktivasi ──► obd_user (ACTIVE)                         obd_pengajuan_{tab,dep,kredit}
   │  login (lockout) ── pengajuan (multipart) ──► review admin
   │                                         │ APPROVE
   ▼                                         ▼
[IBS Core Banking (MySQL)]  ◄── generate CIF + no_rekening → INSERT nasabah / tabung|deposito|kredit
   ▲  (DB sys: sys_mysysid template, sys_daftar_user admin)
   └── cek saldo / mutasi / analisa finansial (tabung/deposito/kredit + *trans)
```

## 7. Asumsi & Batasan

- **Asumsi:**
  - Database **Core Banking BPR** tersedia beserta tabel `nasabah`, `tabung`, `deposito`,
    `kredit`, `*trans`, produk, & kantor, serta **stored function generator ID**
    (`GENERATE_NASABAH_ID`, `GENERATE_NOREK_SIMPANAN`, `GENERATE_NOREK_DEPOSITO`,
    `GENERATE_NOREK_KREDIT`).
  - Database **sys** (`[database_sys]`) tersedia untuk template generator (`sys_mysysid`) &
    daftar user admin (`sys_daftar_user`).
  - Aplikasi klien mengirim header identitas device (`X-Device-Id`, `X-Device-Name`).
  - Klien mampu **mendekripsi** payload respons dari `keyVersion` (skema AES kunci harian).
- **Batasan:**
  - Platform: **Java 17**, **Spring Boot 3.3.4**; artefak `backend-0.0.1-SNAPSHOT.jar`
    (di-deploy sebagai `backendonboard.jar`).
  - Konfigurasi runtime dibaca dari **`app.ini`** (format INI, via ini4j) menggunakan system
    property `config.location`, bukan hanya `application.properties`.
  - **Multi-datasource MySQL**: `[database_main]` (data Core & onboarding) dan
    `[database_sys]` (parameter sistem & admin).
  - Akses data memakai **raw JDBC (`JdbcTemplate`)** dengan payload `Map<String,Object>`;
    JPA praktis dinonaktifkan (`ddl-auto: none`, autoconfig JPA di-exclude).
  - File upload disimpan di direktori **relatif `./uploads/`** — aplikasi harus dijalankan
    dari direktori kerja yang konsisten.
  - Skema Core dikelola eksternal; sebagian tabel onboarding belum memiliki DDL lengkap di repo.

## 8. Risiko Bisnis

| ID | Risiko | Dampak | Mitigasi |
|----|--------|--------|----------|
| RB-001 | Onboarding fiktif / identitas palsu | Pembukaan rekening tidak sah | Foto KTP+selfie wajib; review admin manual; blacklist NIK/device. |
| RB-002 | Abuse OTP (spam/enumerasi) | Beban SMS & percobaan brute-force | Rate-limit 3×/hari + double-submit 24 jam + blacklist. |
| RB-003 | Brute-force login | Pengambilalihan akun | Lockout 3× gagal (15 menit) + blacklist device/username. |
| RB-004 | Pengajuan ganda / duplikasi | Rekening dobel di Core | Cek pengajuan PENDING existing; approval memakai generator ID + verifikasi CIF. |
| RB-005 | Kebocoran payload sensitif (data nasabah/foto) | Pelanggaran kerahasiaan | Enkripsi `responseData` (AES kunci harian) + OTP terenkripsi; `uploads/` di-exclude git. |
| RB-006 | Kredensial DB / secret bocor | Akses ilegal ke Core | `app.ini` git-ignored & tidak masuk image; dikelola per environment. |
| RB-007 | Kegagalan posting ke Core saat approve | Data onboarding & Core tidak sinkron | Generate ID + insert rekening tervalidasi; koordinasi koreksi dengan tim Core bila gagal. |
| RB-008 | Endpoint tanpa proteksi layer keamanan (permitAll) | Akses tak-berwenang ke API admin/CRUD | Batasi akses jaringan (reverse proxy/allowlist); rencana perkuat AuthN/AuthZ (lihat SRS NFR). |

## 9. Kriteria Penerimaan (Acceptance Criteria)

- Registrasi dengan data & foto lengkap tercatat status **PENDING**; NIK/device/no HP yang
  sudah aktif atau ter-blacklist **ditolak** dengan pesan sesuai.
- Approve registrasi menghasilkan **OTP** (tersimpan terenkripsi) & entri aktivasi; aktivasi
  dengan OTP valid membuat **user ACTIVE** yang bisa login.
- Request OTP ke-4 dalam sehari **ditolak** (rate-limit); OTP tersimpan **tidak** dalam bentuk
  plaintext.
- Login gagal 3× **mengunci** akun 15 menit; login sukses mengembalikan profil user, daftar
  `accounts`/`products`, dan `token`.
- Submit pengajuan (tabungan/deposito/kredit) dengan pengajuan PENDING existing **ditolak**;
  approval admin memposting **nasabah (bila baru) + rekening** ke Core dan mengembalikan `cif`
  & `no_rekening`.
- Cek saldo/mutasi/analisa mengembalikan data yang benar untuk rekening TAB/DEP/KRE yang ada.
- Payload `responseData` pada respons **sukses terenkripsi** dan disertai `keyVersion`.
- Seluruh endpoint tampil & dapat dicoba melalui Swagger UI.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dokumen dibuat berdasarkan implementasi controller, service, & lapisan keamanan `backendonboard`. |

---

*[← Kembali ke IBS Onboarding Backend](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
