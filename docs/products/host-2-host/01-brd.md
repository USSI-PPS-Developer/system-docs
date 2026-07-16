# 📄 Business Requirement Document (BRD) — Host 2 Host

> Dokumen kebutuhan bisnis untuk produk **Host 2 Host**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | Host 2 Host     |
| Jenis Dokumen     | Business Requirement Document (BRD)         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 16 Juli 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Latar Belakang

Bank/BPR menjalankan **Core Banking IBS (Integrated Banking System)** sebagai sistem inti
pencatatan seluruh operasional perbankan — nasabah (`nasabah`), tabungan (`tabung`),
pinjaman/kredit (`kredit`), deposito (`deposito`), dan transaksi (`tabtrans`, `deptrans`,
`kretrans`). Kanal-kanal digital (web front-office, mobile, aplikasi kantor kas) serta
aplikasi/partner pihak ketiga membutuhkan akses ke fungsi-fungsi core banking tersebut,
namun **tidak boleh** mengakses database core secara langsung karena alasan keamanan,
integritas data, dan coupling terhadap skema legacy.

Dibutuhkan sebuah **lapisan integrasi Host-to-Host (H2H)** berupa REST API yang berdiri di
depan Core Banking IBS dan menjadi **satu-satunya pintu** bagi seluruh sistem eksternal
untuk:
- melakukan autentikasi terpusat (per-aplikasi/`client_id`) sebelum mengakses layanan core,
- menjalankan operasi bisnis perbankan (registrasi nasabah/rekening, inquiry saldo/tagihan,
  posting transaksi setoran/penarikan/pencairan/angsuran, reversal),
- menjamin **integritas keuangan** (tidak ada dobel-posting, tidak ada saldo minus akibat
  race condition) dan **isolasi antar-kantor** (satu kantor tidak dapat melihat/mengubah
  data kantor lain),
- memberikan jejak audit dan monitoring atas setiap request/response yang melewati H2H.

Produk ini menggantikan pola integrasi langsung-ke-database yang rapuh dengan kontrak API
yang stabil, aman, dan terdokumentasi (OpenAPI/Swagger).

## 2. Tujuan (Business Objectives)

| Kode | Tujuan | Indikator Keberhasilan (KPI) |
|------|--------|------------------------------|
| OBJ-1 | Menyediakan **satu gerbang API terpusat** ke Core Banking IBS untuk seluruh kanal & partner. | 100% integrasi baru menggunakan H2H (bukan akses DB langsung). |
| OBJ-2 | Mengamankan akses melalui **autentikasi per-klien (multi-tenant)** dan otorisasi berbasis token. | 0 insiden akses tanpa `client_id`/token yang valid. |
| OBJ-3 | Menjamin **integritas transaksi keuangan** (idempotensi, penguncian saldo, validasi nominal). | 0 kasus dobel-posting / saldo minus akibat race condition. |
| OBJ-4 | Menerapkan **isolasi data antar-kantor (tenant isolation)** berbasis `kode_kantor`. | 0 kasus cross-office read/write oleh pengguna non-HQ. |
| OBJ-5 | Menyediakan **monitoring & audit** atas seluruh lalu lintas API (request/response ter-mask). | Seluruh request tercatat di `api_log` dengan data sensitif ter-redaksi. |
| OBJ-6 | Menjaga **ketersediaan & kestabilan** layanan pada beban kanal digital. | Uptime ≥ 99,9%; respons inquiry < 2 detik untuk 95% request. |

## 3. Ruang Lingkup (Scope)

### ✅ In Scope
- **Autentikasi**: login (menghasilkan access + refresh token), refresh token (rotasi &
  revokasi), logout, ganti password, dan update data pengguna sendiri.
- **Nasabah**: cek NIK/identitas (termasuk WNA), registrasi, update, portofolio CIF,
  daftar nasabah WNA.
- **Tabungan**: registrasi rekening, pencarian, inquiry saldo, dan daftar rekening.
- **Pinjaman/Kredit**: registrasi, jadwal angsuran, tagihan, saldo, dan daftar pinjaman.
- **Deposito**: registrasi dan inquiry saldo.
- **Transaksi (money-path)**: transaksi tabungan (setoran/penarikan/transfer), pencairan
  pinjaman, angsuran pinjaman, setoran deposito, cek status transaksi, dan reversal.
- **Referensi transaksi**: daftar tipe integrasi transaksi & kode binding bank.
- **Rekap/Laporan** (HQ/admin): rekap setoran & penarikan tabungan per marketing.
- **Monitoring**: daftar/detail/ekspor CSV log API (dashboard terpisah `health-ui-mcs`).
- Mekanisme lintas-cutting: idempotency, rate limiting, penguncian saldo, tenant isolation,
  masking data sensitif, dan global exception handling.

### ❌ Out of Scope
- Aplikasi/kanal front-end pengguna (web/mobile) itu sendiri — H2H hanya menyediakan API.
- Pembuatan/perubahan skema database Core Banking IBS (`ddl-auto=none`; skema dikelola IBS).
- Modul core banking di luar tabungan/kredit/deposito/nasabah (mis. akuntansi GL penuh,
  kliring, RTGS) selain yang tersentuh oleh posting transaksi.
- Model peran/role management penuh — otorisasi saat ini berbasis kepemilikan diri sendiri
  (`user_id`), allowlist HQ, dan allowlist admin rekap.
- Migrasi format hashing password (`user_web_password` tetap SHA1 karena dibagi dengan
  aplikasi legacy IBS — lihat Asumsi & Batasan).

## 4. Stakeholder

| Peran | Nama / Unit | Tanggung Jawab |
|-------|-------------|----------------|
| Sponsor | Manajemen TI Bank/BPR | Menyetujui inisiatif & anggaran integrasi H2H. |
| Business Owner | Unit Operasional / Layanan | Menetapkan aturan bisnis transaksi & nasabah. |
| Product Owner | Tim Produk USSI | Memprioritaskan endpoint & roadmap H2H. |
| End User (tidak langsung) | Teller, CS, Marketing, nasabah via kanal | Mengonsumsi layanan melalui kanal yang terintegrasi H2H. |
| Konsumen Sistem | Developer kanal/partner (`client_id`) | Mengintegrasikan aplikasinya ke API H2H. |
| DBA / Tim IBS | Pengelola Core Banking IBS | Menjaga skema core & kompatibilitas tabel bersama. |
| Tim Keamanan / Audit | Compliance | Meninjau kontrol keamanan, isolasi, dan audit log. |
| Developer / Maintainer | Tim USSI | Pengembangan & pemeliharaan microservice-core. |

## 5. Kebutuhan Bisnis

| ID | Kebutuhan Bisnis | Prioritas | Catatan |
|----|------------------|-----------|---------|
| BR-001 | Setiap aplikasi konsumen harus terautentikasi per `client_id` sebelum mengakses layanan. | Wajib | Header `X-CLIENT-ID`; secret/expiry per klien dari tabel `api_auth_config`. |
| BR-002 | Sistem menghasilkan **access token** & **refresh token** ber-JWT dengan masa berlaku per klien. | Wajib | Token membawa klaim `user_id`, `client_id`, `kode_kantor`, `token_use`. |
| BR-003 | Refresh token bersifat **dapat dicabut & dirotasi**; logout membuat token tidak dapat dipakai lagi. | Wajib | Disimpan di `api_refresh_tokens`; rotasi saat refresh. |
| BR-004 | Percobaan login yang gagal harus **dibatasi** untuk mencegah brute-force. | Wajib | Maks. 5 percobaan / 60 detik per (username+IP). |
| BR-005 | Pengguna hanya boleh mengubah/melihat **data miliknya sendiri** (password, profil). | Wajib | `user_id` token == `userId` body, jika tidak → ditolak. |
| BR-006 | Semua operasi transaksional harus **idempoten** — retry tidak boleh menghasilkan dobel-posting. | Wajib | Header `X-IDEMPOTENCY-KEY` wajib; reservasi atomik (SET NX). |
| BR-007 | Endpoint transaksional harus dibatasi lajunya (rate limit) per pengguna. | Wajib | Maks. 5 request / 60 detik per user & jenis operasi. |
| BR-008 | Posting transaksi harus **atomik** (semua berhasil atau seluruhnya batal). | Wajib | Satu `@Transactional` pada DB primer; saldo + jurnal + trans + log. |
| BR-009 | Nominal transaksi harus **> 0** (biaya/adm ≥ 0); nominal negatif/nol ditolak. | Wajib | Validasi DTO `@DecimalMin` + guard `signum()` di service. |
| BR-010 | Saldo yang di-debit/di-kredit harus **dikunci** agar tidak terjadi lost-update/overdraft. | Wajib | Pessimistic lock; multi-akun dikunci urut `no_rekening` (anti-deadlock). |
| BR-011 | Reversal transaksi harus dijaga dari **dobel-reversal**. | Wajib | Guard `kuitansi_id + "R"`. |
| BR-012 | Data hanya dapat diakses/diubah oleh **kantor pemiliknya** (`kode_kantor`), kecuali HQ. | Wajib | `TenantGuard` per endpoint; allowlist `isolation.hq-user-ids`. |
| BR-013 | Endpoint rekap/laporan hanya untuk **HQ/admin**. | Tinggi | Allowlist `rekap.admin-user-ids` (fail-closed bila kosong). |
| BR-014 | Endpoint monitoring log harus **dilindungi kunci** (bukan anonim). | Tinggi | Header `X-MONITORING-KEY` / query `monitoringKey`; fail-closed. |
| BR-015 | Data sensitif (password, token) harus **ter-mask** sebelum disimpan ke log. | Wajib | `SensitiveDataMasker`; mask dulu, baru truncate. |
| BR-016 | Kegagalan Redis (idempotency/rate-limit) harus **fail-closed** (tolak, jangan lolos). | Wajib | → HTTP 503, ditolak sebelum posting uang. |
| BR-017 | Kesalahan internal **tidak boleh membocorkan** detail DB/SQL ke klien. | Wajib | Pesan generik ke klien; detail hanya di log server. |
| BR-018 | Seluruh endpoint harus terdokumentasi (OpenAPI/Swagger). | Sedang | `/swagger-ui.html`. |

## 6. Proses Bisnis

### 6.1 Kondisi Saat Ini (As-Is)
Kanal dan aplikasi partner mengakses data core banking dengan pola yang tidak seragam —
sebagian melalui koneksi database langsung atau integrasi ad-hoc. Akibatnya: kontrol
keamanan tidak konsisten, tidak ada isolasi antar-kantor yang tegas, integritas transaksi
bergantung pada masing-masing aplikasi, serta minim audit trail terpusat. Perubahan skema
IBS berisiko merusak banyak integrasi sekaligus.

### 6.2 Kondisi Diharapkan (To-Be)
Seluruh akses ke Core Banking IBS dilewatkan melalui **API Host-to-Host** dengan kontrak
yang stabil. Setiap request melewati rantai kontrol yang seragam sebelum menyentuh data
uang.

```
[Client App] → [Login /autentikasi/login (X-CLIENT-ID)] → terima access+refresh token
      │
      ▼
[Request bisnis + Bearer token + X-IDEMPOTENCY-KEY]
      │
      ▼
[H2H API] → validasi token → cek user_id == token → idempotency (SET NX)
          → rate limit → tenant guard (kode_kantor) → [Service: lock saldo + posting @Transactional]
          → [Core Banking IBS DB] → response {responseCode, responseData, responseMessage}
      │
      ▼
[api_log: request/response ter-mask untuk monitoring & audit]
```

## 7. Asumsi & Batasan

- **Asumsi:**
  - Setiap aplikasi konsumen sudah terdaftar di `api_auth_config` (punya `client_id`,
    secret Base64, dan masa berlaku token).
  - Data pengguna (`sys_daftar_user`) beserta `unit_kerja` (→ `kode_kantor`) sudah tersedia
    di sistem IBS; office/klaim diambil dari sana saat login.
  - Redis tersedia untuk idempotency & rate limiting; MySQL core & sys tersedia.
- **Batasan:**
  - Harus terintegrasi dengan **Core Banking IBS** melalui **dua datasource** terpisah
    (`primary` = `cma`, `sys` = `cma_sys`); satu transaksi DB tidak boleh melintasi kedua
    datasource.
  - `spring.jpa.hibernate.ddl-auto=none` — perubahan skema DB dikirim sebagai patch SQL
    manual, bukan auto-generate.
  - **Password `user_web_password` tetap SHA1** karena kolom dibagi dengan aplikasi legacy
    IBS; format hash tidak boleh diubah di layanan ini (risiko diterima — audit B-2).
  - Belum ada model role penuh; otorisasi berbasis kepemilikan diri + allowlist HQ/admin.
  - Platform: Java 17, Spring Boot 3.3.x; artefak `microservicecore.jar`.

## 8. Risiko Bisnis

| ID | Risiko | Dampak | Mitigasi |
|----|--------|--------|----------|
| RB-001 | Dobel-posting akibat retry/klien mengulang request | Saldo/jurnal ganda, kerugian finansial | `X-IDEMPOTENCY-KEY` + reservasi atomik `reserveIfFirst` (409 bila bukan pertama). |
| RB-002 | Lost-update / overdraft saat transaksi konkuren ke rekening sama | Saldo salah / minus | Pessimistic lock kedua sisi akun; urutan kunci `no_rekening` asc (anti-deadlock). |
| RB-003 | Cross-office access (IDOR antar-kantor) | Kebocoran/perubahan data kantor lain | `TenantGuard` per endpoint berbasis klaim `kode_kantor`; token opaque bagi klien. |
| RB-004 | Kredensial/token bocor via log | Pengambilalihan akun | `SensitiveDataMasker` (mask-before-truncate); monitoring key-gated. |
| RB-005 | Redis down → guard idempotency/rate-limit tidak jalan | Potensi dobel-posting bila fail-open | **Fail-closed**: Redis error → HTTP 503, request ditolak sebelum posting. |
| RB-006 | Kebocoran detail internal (SQL/tabel) via pesan error | Information disclosure | Handler mengembalikan pesan generik; detail hanya di log server. |
| RB-007 | Perubahan skema IBS merusak integrasi | Downtime layanan | Kontrak API stabil + patch SQL manual yang di-review IBS lebih dulu. |
| RB-008 | Brute-force login | Pengambilalihan akun | Throttle 5x/60s per (username+IP) sebelum verifikasi password. |

## 9. Kriteria Penerimaan (Acceptance Criteria)

- Aplikasi konsumen dapat login dengan `X-CLIENT-ID` yang valid dan menerima access +
  refresh token; `client_id` tak dikenal ditolak (`92`).
- Seluruh endpoint transaksional menolak request tanpa `X-IDEMPOTENCY-KEY` (`97`) dan
  menolak retry duplikat (`93`).
- Dua request setor konkuren ke rekening yang sama tidak menghasilkan saldo yang salah
  (tidak ada lost-update), dan transfer A→B / B→A konkuren tidak deadlock.
- Pengguna non-HQ tidak dapat membaca/menulis data kantor lain (403, `USER_MISMATCH`).
- Nominal ≤ 0 ditolak; reversal kedua atas transaksi yang sama ditolak.
- Kegagalan Redis mengembalikan HTTP 503 dan tidak ada posting uang yang terjadi.
- Log `api_log` tidak memuat nilai password/token dalam bentuk plaintext.
- Seluruh endpoint tampil & dapat dicoba melalui Swagger UI.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 16 Juli 2026 | | Dokumen dibuat |

---

*[← Kembali ke Host 2 Host](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
