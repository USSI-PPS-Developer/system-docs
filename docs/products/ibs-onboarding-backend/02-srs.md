# 📐 Software Requirements Specification (SRS) — IBS Onboarding Backend

> Spesifikasi kebutuhan perangkat lunak untuk produk **IBS Onboarding Backend** (mengacu kaidah IEEE 830).

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS Onboarding Backend |
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
Dokumen ini menjabarkan spesifikasi kebutuhan perangkat lunak untuk **IBS Onboarding Backend**
(`backendonboard`, "NEXT IBS Onboard Service") — *backend* REST berbasis Spring Boot 3.3.4 /
Java 17 yang melayani aplikasi onboarding nasabah IBS (registrasi, aktivasi, pengajuan
rekening) sekaligus back-office admin BPR, serta memposting hasil pengajuan ke IBS Core Banking.
SRS ini menjadi acuan bagi developer, QA, dan tim integrasi frontend dalam membangun, menguji,
dan mengonsumsi layanan, dengan menurunkan kebutuhan bisnis pada
[BRD IBS Onboarding Backend](01-brd.md) menjadi kebutuhan fungsional (FR) dan non-fungsional (NFR)
yang dapat diverifikasi.

### 1.2 Ruang Lingkup Sistem
Service menyediakan API untuk: **registrasi & approval**, **OTP & aktivasi**, **autentikasi**
(user & admin, ganti/reset password), **pengajuan** tabungan/deposito/kredit beserta approval
& posting ke Core, **cek status/detail pengajuan**, **cek saldo/mutasi/analisa finansial**,
serta **master/referensi** (produk, kode kantor, info kantor, banner) dan **manajemen**
(user, blacklist, dashboard). Service tidak memiliki UI; ia menyediakan kontrak API JSON dan
menyajikan file upload. Payload data pada respons sukses **dienkripsi (AES kunci harian)** dan
OTP disimpan **terenkripsi**. Manfaat utama: kanal onboarding mandiri, backend tunggal ke Core
Banking, kontrol anti-abuse, dan kerahasiaan data.

### 1.3 Definisi & Akronim

| Istilah | Penjelasan |
|---------|------------|
| Onboarding | Proses masuknya nasabah baru: registrasi → aktivasi → pengajuan rekening. |
| IBS Core | Core Banking IBS — database MySQL legacy (nasabah, rekening, transaksi, produk). |
| NIK | Nomor Induk Kependudukan; kolom `no_id` pada `nasabah`; kunci identitas nasabah. |
| CIF / `cif` | Customer Information File — identitas nasabah (`nasabah_id`). |
| OTP | One-Time Password 6 digit; disimpan terenkripsi (AES) pada `obd_aktivasi`. |
| Device Id/Name | Identitas perangkat klien via header `X-Device-Id` / `X-Device-Name`. |
| Blacklist | Daftar entitas yang diblokir (device/NIK/no HP/username/ALL) pada `obd_blacklist`. |
| Lockout | Penguncian akun setelah 3× gagal login (15 menit). |
| keyVersion | Penanda versi kunci harian untuk dekripsi `responseData` di sisi klien. |
| DB main / DB sys | Datasource utama (data Core & onboarding) / datasource parameter sistem & admin. |
| TAB / DEP / KRE | Kode jenis produk/rekening: Tabungan / Deposito / Kredit. |

### 1.4 Referensi
- [BRD IBS Onboarding Backend](01-brd.md)
- [API Contract IBS Onboarding Backend](03-api-contract.md)
- [Desain Database](04-database-design.md)
- [Deployment Guide](10-deployment-guide.md)
- OpenAPI/Swagger UI: `/swagger-ui.html`

## 2. Deskripsi Umum

### 2.1 Perspektif Produk
Service adalah lapisan **REST** berbasis Spring Boot 3.3.4 / Java 17 yang berada di antara
aplikasi klien onboarding (mobile/web) & back-office admin dengan IBS Core Banking.

```
[Aplikasi Nasabah] ─┐
                    ├─►  [IBS Onboarding Backend (backendonboard)]  ─►  [IBS Core Banking (MySQL)]
[Back-office Admin] ─┘      - registrasi / OTP / aktivasi                ├─ DB main  (nasabah, tabung,
                           - login user (lockout) & admin                │           deposito, kredit,
                           - pengajuan + approval → posting Core         │           *trans, produk, kantor,
                           - saldo / mutasi / analisa                    │           obd_* onboarding)
                           - blacklist / rate-limit OTP                  └─ DB sys   (sys_mysysid template,
                           - enkripsi respons (AES harian) + OTP AES                 sys_daftar_user admin)
                           - upload/serve file (uploads/)
                           - Swagger/OpenAPI
```

Karakteristik arsitektural penting:
- **Konfigurasi via `app.ini`** (INI, ini4j): `AppConfigLoader` membaca section `[server]
  [database_main] [database_sys] [redis] [frontend]`; path dari `-Dconfig.location`.
- **Dua datasource HikariCP**: `mainDataSource` (`@Primary`, bean `mainJdbc`) & `sysDataSource`
  (bean `sysJdbc`); driver `com.mysql.cj.jdbc.Driver`, timezone `Asia/Jakarta`, maxPool 50.
- **Raw JDBC**: mayoritas controller memakai `JdbcTemplate` + payload `Map<String,Object>`;
  hanya `TabProduk` yang memiliki entity JPA (JPA dinonaktifkan runtime).
- **Kontrak respons** memakai `responseCode`/`responseMessage`/`responseData`; `responseData`
  pada respons **sukses dienkripsi** (AES kunci harian) & disertai `keyVersion`.
- **Generator ID** rekening/CIF via stored function Core + template `sys_mysysid`.

### 2.2 Fungsi Utama Produk
- Registrasi nasabah + review (approve/reject) admin.
- Request/generate OTP (rate-limit, foto wajib, blacklist) & aktivasi akun.
- Login user aplikasi (lockout) & login admin back-office; ganti & reset password.
- Pengajuan tabungan/deposito/kredit (multipart) + approval → posting nasabah/rekening ke Core.
- Cek status & detail pengajuan.
- Cek saldo (single/multi), mutasi rekening, analisa finansial bulanan.
- Master/referensi: produk (TAB/DEP/KRE), kode kantor, info kantor (lokasi), banner.
- Manajemen user (CRUD, status, unblock, reset password), blacklist, dashboard rekap.
- Upload & serve file (foto KTP/selfie/KK/NPWP/agunan).
- Enkripsi payload respons (AES kunci harian) & OTP terenkripsi.

### 2.3 Karakteristik Pengguna

| Tipe Pengguna | Hak Akses | Keterangan |
|---------------|-----------|------------|
| Nasabah (aplikasi klien) | Registrasi, OTP/aktivasi, login, pengajuan, saldo/mutasi/analisa, produk/banner | Konsumen API mobile/web. |
| Admin BPR (back-office) | Review & proses registrasi/aktivasi/pengajuan, CRUD user/blacklist/banner, dashboard | Login via `sys_daftar_user`. |
| Developer Frontend | Seluruh endpoint (integrasi) | Menyusun request/dekripsi respons. |
| Operator / DevOps | Health/monitoring & Swagger | Verifikasi deploy. |
| DBA / Tim IBS Core | (tidak langsung) | Menyediakan & mengelola skema DB Core & stored function. |

### 2.4 Batasan & Asumsi
- Bahasa/platform: **Java 17**, **Spring Boot 3.3.4**, Maven; JSON via Jackson; SpringDoc
  OpenAPI 2.3.0; Guava 33 (hashing kunci harian); ini4j 0.5.4; commons-pool2; (RabbitMQ &
  WebSocket starter tersedia sebagai dependency).
- Datastore: **MySQL** multi-datasource (`[database_main]` & `[database_sys]`) via HikariCP +
  `JdbcTemplate`.
- Konfigurasi runtime dari **`app.ini`** (`-Dconfig.location`); `application.properties`/
  `application.yml` untuk nilai default/non-rahasia (matikan banner, exclude autoconfig JPA,
  multipart maks 20MB).
- **Raw SQL** & payload `Map<String,Object>`; JPA praktis dimatikan (`ddl-auto: none`).
- File upload disimpan di path **relatif `./uploads/`**.
- Skema Core dikelola eksternal (IBS/DBA); sebagian tabel onboarding belum ber-DDL lengkap di repo.
- Domain berbahasa Indonesia (identifier & pesan).

## 3. Kebutuhan Fungsional

| ID | Kebutuhan Fungsional | Deskripsi | Prioritas | Ref. BRD |
|----|----------------------|-----------|-----------|----------|
| FR-001 | Registrasi nasabah | Submit data diri + foto KTP/selfie (multipart) → simpan `obd_register` status PENDING; validasi blacklist device/NIK & cek device/NIK/no HP sudah aktif. | Wajib | BR-001, BR-011 |
| FR-002 | Approval registrasi | Approve → insert `obd_aktivasi` status DONE + OTP acak (AES), update register APPROVED; Reject → status REJECTED. | Wajib | BR-002 |
| FR-003 | Request OTP | Multipart (`nik`, `no_hp`, foto opsional) → cek device/nik/no_hp terdaftar, blacklist, foto wajib, rate-limit 3×/hari, double-submit 24 jam → insert `obd_aktivasi` PENDING. | Wajib | BR-004, BR-011 |
| FR-004 | Kelola OTP (admin) | List/preview/hapus OTP; generate/update OTP manual (status DONE, OTP baru di-AES). | Tinggi | BR-004 |
| FR-005 | Aktivasi akun | Verifikasi OTP (`obd_aktivasi` status DONE) + unik username/NIK/device → insert `obd_user` status ACTIVE. | Wajib | BR-003 |
| FR-006 | Login user | Validasi username+password, cek blacklist username/device, status akun, lockout 3× (15 menit); sukses → profil + `accounts[]` + `products[]` + `token`. | Wajib | BR-005, BR-011 |
| FR-007 | Login admin | Validasi `sys_daftar_user` (DB sys, username BINARY case-sensitive) → data admin + `token`. | Wajib | BR-006 |
| FR-008 | Ganti/reset password | `change` (validasi password lama, set `reset_pass=0`); admin `reset-password` (default `onboard456`, SHA-256 salted, `reset_pass=1`). | Tinggi | BR-005 |
| FR-009 | Pengajuan tabungan | Submit multipart → nomor `TAB`+yyyyMMdd+NNN, cek tidak ada PENDING; list/preview; update status. | Wajib | BR-007, BR-009 |
| FR-010 | Pengajuan deposito | Submit multipart → nomor `DEP`+yyyyMMdd+NNN; list/preview; update status. | Wajib | BR-007, BR-009 |
| FR-011 | Pengajuan kredit | Submit multipart (dokumen agunan/KK/NPWP) → nomor `KRE`+yyyyMMdd+NNN; list/preview; update status. | Wajib | BR-007, BR-009 |
| FR-012 | Posting rekening ke Core | Saat APPROVED: buat `nasabah` bila belum ada `cif` (`GENERATE_NASABAH_ID`), generate `no_rekening` (stored function per jenis), insert `tabung`/`deposito`/`kredit`, update `cif` ke `obd_user`/`obd_aktivasi`. | Wajib | BR-008 |
| FR-013 | Cek status & detail pengajuan | Gabungan status TAB+DEP+KRE per `user_id`; detail per `jenis` + `no_pengajuan`. | Tinggi | BR-009 |
| FR-014 | Cek saldo | Multi-akun (`/saldo/cek`, coba tabung→deposito→kredit) & single (`/saldo`, per jenis). | Tinggi | BR-010 |
| FR-015 | Mutasi rekening | Mutasi per rekening & jenis (TAB→`tabtrans`, DEP→`deptrans`, KRE→`kretrans`) dengan saldo awal/akhir. | Tinggi | BR-010 |
| FR-016 | Analisa finansial | Rekap income/expense bulanan dari `tabtrans` (klasifikasi via `floor(my_kode_trans/100)`) + persentase. | Sedang | BR-010 |
| FR-017 | Master & referensi | Produk TAB/DEP/KRE (list & detail), kode kantor, info kantor (lokasi+koordinat), banner (list/CRUD). | Sedang | BR-014 |
| FR-018 | Manajemen user | List/detail/update/hapus, ubah status (ACTIVE/INACTIVE/LOCKED), unblock, reset password. | Tinggi | BR-012 |
| FR-019 | Manajemen blacklist | CRUD entri blacklist (value, type, reason). | Tinggi | BR-011, BR-012 |
| FR-020 | Dashboard rekap | COUNT registrasi/akun aktif/aktivasi/blacklist & rekap pengajuan (tabungan/deposito/kredit). | Sedang | BR-012 |
| FR-021 | Upload & serve file | Simpan file ke `uploads/`; sajikan via `/api/uploads/{filename}`. | Wajib | BR-001, BR-007 |
| FR-022 | Enkripsi payload respons | `responseData` respons sukses dienkripsi AES kunci harian + `keyVersion`; respons error polos. | Wajib | BR-013 |
| FR-023 | Dokumentasi OpenAPI | Menyajikan Swagger UI & OpenAPI (annotation `@Tag`/`@Operation`). | Sedang | BR-015 |

### Detail FR-005 (Aktivasi Akun)
- **Pemicu:** `POST /api/aktivasi` (body `otp`, `nik`, `noHp`, `username`, `password`; header device).
- **Proses (`AktivasiService`):** validasi blacklist → cek double-submit 24 jam → cek unik
  `username`/`nik`/`device` → verifikasi OTP terhadap `obd_aktivasi` (status DONE, OTP di-AES,
  cocokkan hasil dekripsi) → insert `obd_user` status ACTIVE (kredensial baru).
- **Output:** `responseCode 00` (sukses) atau kode error `01–10`/`99`.
- **Aturan validasi:** OTP dibandingkan setelah dekripsi AES; kombinasi identitas harus unik.

### Detail FR-006 (Login User)
- **Pemicu:** `POST /api/login` (body `username`, `password`; header opsional `X-Device-Id`).
- **Proses:** username ada? → cek blacklist username & device → ambil user (+join `nasabah`)
  → cek status (INACTIVE/LOCKED) → cek lockout (`is_locked`, kunci 15 menit sejak
  `last_failed_login`) → bandingkan password → sukses: reset `login_attempt`, susun profil
  (dari `obd_register` bila `cif` kosong, atau `nasabah`+foto `obd_aktivasi` bila ada `cif`),
  kumpulkan `accounts[]` (tabung/deposito/kredit aktif) & `products[]`, terbitkan `token` (UUID).
- **Output:** `responseCode 00` + payload profil terenkripsi, atau `01/02/03/04/05/06/07/08/99`.
- **Aturan validasi:** 3× gagal berturut → `is_locked=1`; terkunci menolak login 15 menit.

### Detail FR-012 (Posting Rekening ke Core saat Approval)
- **Pemicu:** `PUT /api/pengajuan-{tabungan|deposito|kredit}/{id}/status` dengan `status=APPROVED`.
- **Input:** field profil nasabah + parameter produk (kode produk, setoran/nominal/plafon,
  jangka waktu, suku bunga, kode kantor, dll).
- **Proses:** bila nasabah belum punya `cif` → `GENERATE_NASABAH_ID` + insert `nasabah`,
  propagasi `cif` ke `obd_user`/`obd_aktivasi` → generate `no_rekening`
  (`GENERATE_NOREK_SIMPANAN`/`_DEPOSITO`/`_KREDIT`) → insert `tabung`/`deposito`/`kredit`
  (deposito: hitung `tgl_jt`; kredit: ambil `type_kredit_default` dari `kre_produk`, hitung
  `tgl_jatuh_tempo`/`tgl_tagihan`) → set pengajuan APPROVED.
- **Output:** `responseCode 00` + `cif` & `no_rekening`.
- **Aturan validasi:** status wajib APPROVED/REJECTED/PENDING; REJECTED menyimpan `alasan`.

## 4. Kebutuhan Non-Fungsional

| ID | Kategori | Kebutuhan |
|----|----------|-----------|
| NFR-001 | Performa | Endpoint inquiry (saldo/mutasi/produk) responsif pada beban normal; HikariCP maxPool 50 / minIdle 10; timezone `Asia/Jakarta`. |
| NFR-002 | Keamanan — Kerahasiaan | `responseData` respons sukses dienkripsi AES kunci harian (`DailyKeyProvider`: `SHA-256(BASE_KEY+tanggal)[0:32]`) + `keyVersion`; OTP disimpan ter-AES (`AESUtil`). |
| NFR-003 | Keamanan — Anti-abuse | Blacklist (device/NIK/no HP/username/ALL), rate-limit OTP 3×/hari + double-submit 24 jam, lockout login 3× (15 menit). |
| NFR-004 | Keamanan — Akses | ⚠️ *Known gap*: Spring Security `anyRequest().permitAll()` (semua endpoint publik), `token` login berupa UUID non-fungsional, login membandingkan password **plaintext**. Direkomendasikan: perkuat AuthN/AuthZ (token terverifikasi), hashing password konsisten, batasi akses jaringan via reverse proxy/allowlist. |
| NFR-005 | Integritas Data | Cek pengajuan PENDING ganda; propagasi `cif` konsisten ke `obd_user`/`obd_aktivasi`; generator ID via stored function Core. |
| NFR-006 | Portabilitas | Konfigurasi per-BPR via `app.ini`; multi-datasource dapat diarahkan ke DB Core masing-masing instalasi. |
| NFR-007 | Ketersediaan | Deploy via Docker Compose / systemd; volume `uploads/` & `app.ini` persisten; `Restart=on-failure`. |
| NFR-008 | Skalabilitas | Service sebagian besar stateless (kecuali file lokal `uploads/` & counter rate-limit di DB); dapat di belakang reverse proxy. |
| NFR-009 | Kompatibilitas | Kompatibel skema legacy IBS (raw SQL); konfigurasi INI gaya backend lama. |
| NFR-010 | Observability | Middleware `RequestResponseLogger` (skip multipart, truncate >5KB); logging SLF4J (root ERROR, package aplikasi DEBUG). |
| NFR-011 | Dokumentasi | Seluruh endpoint terdokumentasi OpenAPI/Swagger. |
| NFR-012 | Lokalisasi | Domain & pesan berbahasa Indonesia; tanggal `serverTimezone=Asia/Jakarta`. |
| NFR-013 | Kapasitas | Ukuran upload maksimum 20MB (`spring.servlet.multipart`); foto disimpan di filesystem `uploads/`. |

## 5. Use Case Utama

```
Aktor: Nasabah (aplikasi klien) & Admin BPR (back-office)
Use Case: Pembukaan Rekening Tabungan via Onboarding
Pre-condition:
  - Nasabah sudah teregistrasi & akun ter-aktivasi (user ACTIVE) atau minimal dapat login.
  - NIK/device/no HP tidak ter-blacklist.
Main Flow:
  1. Nasabah login (POST /api/login) → memperoleh profil & token.
  2. Nasabah submit pengajuan (POST /api/pengajuan-tabungan, multipart: produk, setoran, foto).
  3. Backend memvalidasi tidak ada pengajuan PENDING existing lalu simpan (nomor TAB+yyyyMMdd+NNN).
  4. Admin login back-office (POST /api/admin/login) & mereview daftar pengajuan.
  5. Admin approve (PUT /api/pengajuan-tabungan/{id}/status, status=APPROVED + data profil/produk).
  6. Backend membuat nasabah (bila belum ada cif) → generate no_rekening → insert tabung.
  7. Backend mengembalikan cif & no_rekening; status pengajuan menjadi APPROVED.
Post-condition:
  - Nasabah (bila baru) & rekening tabungan tercatat konsisten di Core Banking.
  - cif dipropagasi ke obd_user/obd_aktivasi; nasabah dapat cek saldo/mutasi.
Alternative/Exception Flow:
  - Sudah ada pengajuan PENDING → ditolak (kode 02).
  - Entitas ter-blacklist / device diblokir → ditolak.
  - Admin reject → status REJECTED + alasan (tanpa posting ke Core).
  - Kegagalan DB / stored function → responseCode 98/99, tanpa rekening tersimpan sebagian.
```

## 6. Antarmuka Eksternal
- **Antarmuka Pengguna:** tidak ada UI langsung; Swagger UI untuk eksplorasi API.
- **Antarmuka Sistem/API:** lihat [API Contract](03-api-contract.md) — seluruh endpoint REST.
- **Antarmuka Data:** lihat [Desain Database](04-database-design.md) — DB main & DB sys MySQL,
  serta stored function generator ID.
- **Antarmuka File:** penyimpanan lokal `./uploads/` disajikan via `/api/uploads/{filename}`.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dokumen dibuat berdasarkan implementasi service `backendonboard`. |

---

*[← Kembali ke IBS Onboarding Backend](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
