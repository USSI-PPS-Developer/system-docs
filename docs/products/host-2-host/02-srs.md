# 📐 Software Requirements Specification (SRS) — Host 2 Host

> Spesifikasi kebutuhan perangkat lunak untuk produk **Host 2 Host** (mengacu kaidah IEEE 830).

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | Host 2 Host     |
| Jenis Dokumen     | Software Requirements Specification (SRS)         |
| Versi             | 1.1.0               |
| Tanggal Dibuat    | 16 Juli 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Pendahuluan

### 1.1 Tujuan
Dokumen ini menjabarkan spesifikasi kebutuhan perangkat lunak untuk **Host 2 Host (H2H)** —
sebuah microservice REST API (artefak `microservicecore.jar`) yang menjadi gerbang
integrasi ke **Core Banking IBS**. SRS ini menjadi acuan bagi developer, QA, dan integrator
kanal/partner dalam membangun, menguji, dan mengonsumsi layanan H2H. SRS menurunkan
kebutuhan bisnis pada [BRD Host 2 Host](01-brd.md) menjadi kebutuhan fungsional (FR) dan
non-fungsional (NFR) yang dapat diverifikasi.

### 1.2 Ruang Lingkup Sistem
H2H menyediakan API untuk: autentikasi pengguna (login, refresh, logout, ganti password,
update profil), pengelolaan **nasabah**, **tabungan**, **kredit/pinjaman**, dan **deposito**,
serta **pemrosesan transaksi** (setoran/penarikan/transfer tabungan, pencairan & angsuran
pinjaman, setoran deposito, cek status, reversal), ditambah **rekap laporan** (HQ/admin) dan
**monitoring log API**. Sistem tidak mengakses UI pengguna akhir; ia menyediakan kontrak API
yang stabil sehingga kanal (web/mobile/kantor kas) dan partner tidak menyentuh database core
secara langsung. Manfaat utama: keamanan terpusat, integritas transaksi keuangan, isolasi
data antar-kantor, dan audit trail.

### 1.3 Definisi & Akronim

| Istilah | Penjelasan |
|---------|------------|
| H2H | Host to Host — integrasi langsung antar sistem tanpa antarmuka manusia. |
| IBS | Integrated Banking System — core banking yang menjadi backend H2H. |
| JWT | JSON Web Token — token akses/refresh ber-tanda-tangan (HS256). |
| `client_id` | Identitas aplikasi konsumen; menentukan secret & masa berlaku token. |
| `kode_kantor` | Kode kantor/unit kerja pengguna; batas isolasi tenant. |
| Idempotency Key | Nilai unik (`X-IDEMPOTENCY-KEY`) untuk mencegah dobel-proses. |
| Nasabah | Customer. Tabung(an) = savings; Kredit = loan; Deposito = time deposit. |
| Setoran / Penarikan | Deposit / Withdrawal; Saldo = balance; Reversal = pembatalan transaksi. |
| CIF | Customer Information File (identitas nasabah / `nasabahId`). |
| SLA | Service Level Agreement. |
| SHA1 | Algoritma hashing password `user_web_password` (bersama legacy IBS). |

### 1.4 Referensi
- [BRD Host 2 Host](01-brd.md)
- [API Contract Host 2 Host](03-api-contract.md)
- [Desain Database](04-database-design.md)
- OpenAPI/Swagger UI: `/swagger-ui.html`

## 2. Deskripsi Umum

### 2.1 Perspektif Produk
H2H adalah lapisan **stateless REST service** berbasis Spring Boot 3.3.x / Java 17 yang
berada di antara aplikasi konsumen dan Core Banking IBS.

```
[Kanal & Partner]  →  [H2H REST API (microservice-core)]  →  [Core Banking IBS]
   (client_id)          - autentikasi JWT per-klien            ├─ DB primary (cma)
                        - idempotency & rate limit (Redis)     └─ DB sys (cma_sys)
                        - tenant isolation (kode_kantor)
                        - posting transaksi @Transactional
                        - audit/monitoring (api_log)
```

Karakteristik arsitektural penting:
- **Dual datasource**: DB **primary** (`cma`, core banking, `@Primary`) dan DB **sys**
  (`cma_sys`, sistem/user). Satu transaksi DB tidak melintasi kedua datasource.
- **Multi-tenant signing**: tidak ada satu secret JWT global; secret & expiry diambil per
  `client_id` dari tabel `api_auth_config`.
- **Redis** untuk idempotency & rate limiting (fail-closed bila down).
- Kontrak response seragam `ApiResponse<T>` = `{responseCode, responseData, responseMessage}`.

### 2.2 Fungsi Utama Produk
- Autentikasi & manajemen sesi (login, refresh token dengan rotasi & revokasi, logout).
- Manajemen kredensial & profil pengguna (ganti password, update user — self-service).
- Manajemen nasabah (cek NIK/identitas termasuk WNA, registrasi, update, portofolio, list WNA).
- Manajemen produk simpanan & pinjaman (registrasi & inquiry tabungan, kredit, deposito).
- Pemrosesan transaksi keuangan (tabungan, pencairan/angsuran pinjaman, setoran deposito,
  cek status, reversal) dengan idempotensi & penguncian saldo.
- Referensi (tipe integrasi transaksi, kode binding bank).
- Rekap laporan (HQ/admin) & monitoring log API.

### 2.3 Karakteristik Pengguna

| Tipe Pengguna | Hak Akses | Keterangan |
|---------------|-----------|------------|
| Aplikasi Konsumen (`client_id`) | Login & pakai seluruh API sesuai token | Web/mobile/kantor kas/partner terdaftar di `api_auth_config`. |
| Pengguna Kantor (non-HQ) | Operasi terbatas pada `kode_kantor` sendiri | Teller/CS/marketing; isolasi via `TenantGuard`. |
| Pengguna HQ | Lintas-kantor (bypass tenant guard) | `user_id` ada di `isolation.hq-user-ids`. |
| Admin Rekap | Akses endpoint `/rekap/**` | `user_id` ada di `rekap.admin-user-ids` (fail-closed). |
| Operator Monitoring | Akses `/api/monitoring/**` | Via `X-MONITORING-KEY`; dashboard `health-ui-mcs`. |

### 2.4 Batasan & Asumsi
- Bahasa/platform: **Java 17**, **Spring Boot 3.3.13**, Maven; JWT via `jjwt` 0.11.5 (HS256).
- Datastore: **MySQL** (dual datasource primary `cma` & sys `cma_sys`), **Redis**.
- `spring.jpa.hibernate.ddl-auto=none` — skema dikelola eksternal via patch SQL manual.
- `user_web_password` tetap **SHA1** (dibagi dengan legacy IBS — tidak boleh diubah).
- Otorisasi berbasis kepemilikan diri (`user_id`) + allowlist HQ/admin; belum ada RBAC penuh.
- Domain berbahasa Indonesia (identifier & pesan). Regulasi perbankan OJK/BI diasumsikan
  ditangani pada level bisnis/kanal, di luar cakupan teknis H2H.

## 3. Kebutuhan Fungsional

| ID | Kebutuhan Fungsional | Deskripsi | Prioritas | Ref. BRD |
|----|----------------------|-----------|-----------|----------|
| FR-001 | Login pengguna | Sistem mengautentikasi (username + SHA1 password) per `X-CLIENT-ID`, mengeluarkan access+refresh token. | Wajib | BR-001, BR-002 |
| FR-002 | Throttle login | Membatasi percobaan login gagal 5x/60s per (username+IP) sebelum verifikasi password. | Wajib | BR-004 |
| FR-003 | Refresh token | Merotasi token; menolak non-refresh token, token dicabut, atau kedaluwarsa. | Wajib | BR-003 |
| FR-004 | Logout | Menghapus refresh token tersimpan sehingga tidak dapat dipakai lagi. | Wajib | BR-003 |
| FR-005 | Ganti password (self) | Mengganti password milik sendiri setelah verifikasi password lama. | Wajib | BR-005 |
| FR-006 | Update profil (self) | Memperbarui `user_name`, `nama_lengkap`, `unit_kerja` milik sendiri. | Wajib | BR-005 |
| FR-007 | Cek NIK / identitas nasabah | Memvalidasi keberadaan nasabah berdasarkan NIK/identitas (termasuk WNA). | Wajib | BR-012 |
| FR-008 | Registrasi nasabah | Membuat CIF nasabah baru dengan validasi lengkap (NIK 16 digit, email, dsb.). | Wajib | BR-012 |
| FR-009 | Update & portofolio nasabah | Memperbarui data nasabah & menampilkan portofolio (TAB/DEP/KRE). | Tinggi | BR-012 |
| FR-010 | Daftar & detail nasabah WNA | Mengambil daftar (paged) & detail nasabah WNA sesuai office scope. | Sedang | BR-012 |
| FR-010a | Upload foto & tanda tangan nasabah | Menyimpan foto dan/atau tanda tangan nasabah existing (`POST /nasabah/upload-media`); payload base64 → kolom LONGBLOB, minimal satu media, field kosong tidak menimpa data lama, office-scoped. | Sedang | BR-012 |
| FR-011 | Registrasi & inquiry tabungan | Registrasi rekening, pencarian, inquiry saldo, daftar mutasi. | Wajib | BR-012 |
| FR-012 | Registrasi & inquiry kredit | Registrasi pinjaman, jadwal angsuran, tagihan, saldo, daftar. | Wajib | BR-012 |
| FR-013 | Registrasi & inquiry deposito | Registrasi deposito (termasuk produk *special rate*: `sukuBunga` wajib & `jkw` 1/3/6/12), inquiry saldo, dan daftar produk *special rate* (`GET /deposito/produk-spesial-rate`). | Wajib | BR-012 |
| FR-014 | Transaksi tabungan | Posting setoran/penarikan/transfer (tipe D1–D3, T1–T4). | Wajib | BR-006..BR-010 |
| FR-015 | Pencairan pinjaman | Posting pencairan pinjaman (C1–C3) ke tabungan/tunai. | Wajib | BR-006..BR-010 |
| FR-016 | Angsuran pinjaman | Posting angsuran (pokok + bunga). | Wajib | BR-006..BR-010 |
| FR-017 | Setoran deposito | Posting setoran deposito (E1–E3). | Wajib | BR-006..BR-010 |
| FR-018 | Cek status transaksi | Mengambil status transaksi berdasarkan `kuitansi`. | Tinggi | BR-012 |
| FR-019 | Reversal transaksi | Membatalkan transaksi dengan guard anti dobel-reversal. | Wajib | BR-011 |
| FR-020 | Referensi transaksi | Daftar tipe integrasi & kode binding bank. | Sedang | — |
| FR-021 | Rekap laporan (HQ/admin) | Rekap setoran & penarikan tabungan per marketing. | Sedang | BR-013 |
| FR-022 | Monitoring log API | Daftar/detail/ekspor CSV log API, key-gated. | Sedang | BR-014, BR-015 |
| FR-023 | Idempotency & rate limit | Menegakkan `X-IDEMPOTENCY-KEY` (reservasi atomik) & batas laju. | Wajib | BR-006, BR-007, BR-016 |
| FR-024 | Tenant isolation | Menegakkan `kode_kantor` pada setiap endpoint tenant-scoped. | Wajib | BR-012 |

### Detail FR-014 (Transaksi Tabungan — money-path)
- **Pemicu:** `POST /api/v1/transaksi/tabungan` dengan Bearer access token + `X-IDEMPOTENCY-KEY`.
- **Input:** `TransTabungRequestDTO` — `tglTrans`, `kuitansi` (≤25), `kuitansiId` (≤25),
  `tipeTrans` (`D1|D2|D3|T1|T2|T3|T4`), `kodeKantor`, `akunDebet`, `akunKredit`,
  `nominal` (>0), `adm` (≥0), `kodeBindingBank`, `keterangan`, `userId`.
- **Proses:** validasi token → `userId` == klaim token (else 403) → wajib `X-IDEMPOTENCY-KEY`
  (else 400) → `reserveIfFirst` (else 409) → rate limit 5/60s (else 429) →
  `TenantGuard.assertOffice(token, kodeKantor)` (else 403) → `TabtransService.transTabung`
  dalam satu `@Transactional` pada DB primary: kunci akun (kedua sisi untuk deposit; pasangan
  transfer dikunci urut `no_rekening` asc), validasi `signum()` nominal, hitung ulang & tulis
  saldo, jurnal, trans record, dan log.
- **Output:** `TransTabungResponseDTO` — `transId`, `kuitansi`, `kuitansi_id`, `akunDebet`,
  `namaAkunDebet`, `akunKredit`, `namaAkunKredit`, `tglTrans`, `jamTrans`; envelope `00`.
- **Aturan validasi:** nominal harus > 0 dan `adm` ≥ 0 (DTO `@DecimalMin` + guard `signum()`);
  tipe transaksi harus sesuai pola; kantor pada body harus == office token.

### Detail FR-001 (Login)
- **Pemicu:** `POST /api/v1/autentikasi/login` dengan header `X-CLIENT-ID` & `X-IDEMPOTENCY-KEY`.
- **Input:** `LoginRequestDTO` — `userName`, `password` (SHA1 dari sisi klien).
- **Proses:** validasi `X-CLIENT-ID` (else `92`) → cek `X-IDEMPOTENCY-KEY` (else `97`) →
  throttle brute-force (else `94`) → verifikasi kredensial DB-side → idempotency & rate limit →
  ambil `unit_kerja` sebagai `kode_kantor` → generate access+refresh token → simpan/rotasi
  refresh token di `api_refresh_tokens` → catat `api_login_log`.
- **Output:** `{ user: LoginResponseDTO, access_token, refresh_token }`, envelope `00`.
- **Aturan validasi:** `client_id` harus terdaftar/aktif; kredensial cocok; header wajib ada.

### Detail FR-019 (Reversal)
- **Pemicu:** `POST /api/v1/transaksi/reversal` (Bearer + `X-IDEMPOTENCY-KEY`).
- **Input:** `TransReverseRequestDTO` — `kuitansi`, `tipeTrans`, `userId`.
- **Proses:** rantai guard standar → `TenantGuard.assertKuitansiOffice(token, kuitansi)` →
  `TransService.transReverse`, dengan guard `existsByKuitansiId(kuitansiId + "R")` untuk
  mencegah dobel-reversal; posting reversal derivatif dari `kuitansiId` asli.
- **Output:** `TransReverseResponseDTO` — `transId`, `kuitansi`, `kuitansi_id`, `tglTrans`, `jamTrans`.
- **Aturan validasi:** transaksi belum pernah di-reverse; office pemilik == office token.

## 4. Kebutuhan Non-Fungsional

| ID | Kategori | Kebutuhan |
|----|----------|-----------|
| NFR-001 | Performa | Respons inquiry (saldo/status) < 2 detik untuk 95% request pada beban normal. |
| NFR-002 | Keamanan — AuthN | JWT HS256 dengan secret per-klien; whitelist `HS256` (tolak `alg=none`/confusion). |
| NFR-003 | Keamanan — AuthZ | Kepemilikan diri (`userId==token`), tenant isolation (`kode_kantor`), allowlist HQ/admin. |
| NFR-004 | Keamanan — Data | Masking data sensitif sebelum log (mask-before-truncate); pesan error generik ke klien. |
| NFR-005 | Integritas Transaksi | Idempotensi atomik (SET NX), pessimistic lock, lock ordering anti-deadlock, atomik `@Transactional`. |
| NFR-006 | Ketahanan | Redis fail-closed (→ HTTP 503) sebelum posting; kegagalan tidak boleh fail-open. |
| NFR-007 | Ketersediaan | Target uptime ≥ 99,9%; probe `/actuator/health`. |
| NFR-008 | Skalabilitas | Stateless service; rate limit per pengguna/operasi; horizontally scalable di belakang LB/proxy. |
| NFR-009 | Kompatibilitas | Kontrak `ApiResponse<T>` stabil; kompatibel dengan skema legacy IBS (dual datasource, SHA1). |
| NFR-010 | Observability | Logging SLF4J ke `logs/microservicecore.log`; audit request/response di `api_log`. |
| NFR-011 | Dokumentasi | Seluruh endpoint terdokumentasi OpenAPI/Swagger; SQL `show-sql` aktif untuk trace. |
| NFR-012 | Lokalisasi | Domain & pesan berbahasa Indonesia; format tanggal ISO. |

## 5. Use Case Utama

```
Aktor: Teller (Pengguna Kantor via Aplikasi Konsumen)
Use Case: Setoran Tabungan
Pre-condition:
  - Aplikasi sudah login (punya access token valid dengan kode_kantor sesuai).
  - Rekening tujuan milik kantor yang sama dengan token.
Main Flow:
  1. Aplikasi mengirim POST /api/v1/transaksi/tabungan (Bearer token, X-IDEMPOTENCY-KEY, body TransTabung).
  2. H2H memvalidasi token dan mencocokkan userId == klaim token.
  3. H2H memeriksa X-IDEMPOTENCY-KEY dan mereservasi secara atomik (reserveIfFirst).
  4. H2H menegakkan rate limit lalu TenantGuard.assertOffice(token, kodeKantor).
  5. Service mengunci saldo, memvalidasi nominal > 0, memposting saldo+jurnal+trans+log dalam satu transaksi.
  6. H2H mengembalikan responseCode "00" beserta TransTabungResponseDTO.
Post-condition:
  - Saldo terbarui, jurnal & log tercatat, transaksi tercermin di cek status.
Alternative/Exception Flow:
  - Token invalid → 401 (98). userId mismatch / cross-office → 403 (99).
  - X-IDEMPOTENCY-KEY tidak ada → 400 (97). Retry duplikat → 409 (93). Rate limit → 429 (94).
  - Nominal ≤ 0 / validasi gagal → 400 (02). Saldo tidak cukup / aturan bisnis → 400 (95).
  - Redis down → 503 (90); tidak ada posting yang terjadi.
```

## 6. Antarmuka Eksternal
- **Antarmuka Pengguna:** lihat [Desain UI/UX](05-uiux-design.md) — H2H tidak memiliki UI
  langsung; dashboard monitoring adalah aplikasi terpisah (`health-ui-mcs`).
- **Antarmuka Sistem/API:** lihat [API Contract](03-api-contract.md) — seluruh endpoint REST.
- **Antarmuka Data:** lihat [Desain Database](04-database-design.md) — dual datasource MySQL
  (`cma`, `cma_sys`) + Redis.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 16 Juli 2026 | | Dokumen dibuat |
| 1.1.0 | 16 Juli 2026 | | FR-013 diperluas: registrasi deposito produk *special rate* (`sukuBunga` wajib, `jkw` 6/12) & endpoint daftar produk *special rate*. |
| 1.1.1 | 17 Juli 2026 | | FR-013: aturan `jkw` produk *special rate* diperluas dari `6/12` menjadi 1/3/6/12 (permintaan BPR). |

---

*[← Kembali ke Host 2 Host](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
