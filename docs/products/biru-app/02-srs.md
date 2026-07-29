# 📐 Software Requirements Specification (SRS) — BIRU App

> Spesifikasi kebutuhan perangkat lunak untuk **BIRU App** — layanan ETL Spring Boot dua-datasource (CORE → BIRU) beserta REST API baca, autentikasi per pengguna, dan jejak audit.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | BIRU App            |
| Jenis Dokumen     | Software Requirements Specification (SRS) |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 30 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Pendahuluan

### 1.1 Tujuan Dokumen

Dokumen ini menjabarkan kebutuhan fungsional dan non-fungsional **BIRU App** pada tingkat yang
cukup untuk implementasi, pengujian, dan penerimaan (UAT). Pembacanya: developer, QA, tim
deployment/DBA BPR, dan reviewer keamanan.

Kebutuhan bisnis dan alasannya ada di [BRD](01-brd.md). Kontrak endpoint rinci ada di
[API Contract](03-api-contract.md), struktur tabel di [Desain Database](04-database-design.md), dan
prosedur pemasangan di [Deployment Guide](10-deployment-guide.md).

### 1.2 Ruang Lingkup Sistem

BIRU App adalah satu aplikasi Spring Boot yang menjalankan dua tanggung jawab sekaligus:

1. **ETL terjadwal** yang menyalin data dari database **CORE** (core banking BPR, read-only) ke
   database **BIRU** (database pelaporan, read/write).
2. **REST API baca** atas database BIRU, dengan login per pengguna, pembatasan per kantor, dan
   audit setiap pembacaan.

Tiga domain data direplikasi: **TAB** (tabungan), **DEP** (deposito), **KRD** (kredit), masing-masing
dalam dua bentuk (transaksi inkremental & snapshot nominatif harian), ditambah **CIF** (nasabah).

Di luar lingkup: antarmuka pengguna, penulisan ke CORE, pembuatan skema CORE, pelaporan regulator,
dan replikasi real-time.

### 1.3 Definisi & Akronim

| Istilah | Penjelasan |
|---------|------------|
| CORE | Database core banking BPR (IBS), MySQL 5.5, **read-only**. |
| BIRU | Database pelaporan tujuan, MySQL 8, read/write. |
| ETL | Pipeline Extract–Transform–Load; ada 7 di produk ini. |
| Watermark | Baris `etl_watermark` per `(etl_name, branch_code)`; menyimpan cursor & waktu run. |
| Cursor | `last_trx_id` — id baris sumber terakhir yang sudah tersalin untuk kantor itu. |
| Nominatif | Snapshot posisi rekening per tanggal laporan. |
| Backfill | Pemuatan manual data satu tanggal; tidak menggeser cursor. |
| Kantor / `branch_code` | Cabang BPR. |
| `core.flavour` | Generasi core bank tujuan: `IBS_GEN1` atau `IBS_GEN2`. |
| Principal | Identitas pemanggil: `AppUser` (orang) atau `SYSTEM` (API key). |
| Idempoten | Dijalankan berulang, hasil akhirnya sama. |

### 1.4 Referensi

- BRD BIRU App — [`01-brd.md`](01-brd.md)
- API Contract — [`03-api-contract.md`](03-api-contract.md)
- Desain Database — [`04-database-design.md`](04-database-design.md)
- Deployment Guide — [`10-deployment-guide.md`](10-deployment-guide.md)
- Repo: `CLAUDE.md` (aturan arsitektur), `CHANGELOG.md` (riwayat + *deployment notes* per generasi core), `DEPLOY.md`, `AUDIT.md`
- `src/main/resources/db/auth_schema.sql` — DDL resmi tabel login & audit

## 2. Deskripsi Umum

### 2.1 Perspektif Produk & Arsitektur

```
                    ┌──────────────────────────────────────────────┐
   Browser  ───────►│  nginx / reverse proxy (satu origin)         │
   (pengguna)       └───────────────────┬──────────────────────────┘
                                        │  cookie sesi BIRU_SESSION
   Prometheus / cron ───────────────────┤  X-API-Key
   (mesin)                              ▼
        ┌───────────────────────────────────────────────────────────────┐
        │                    BIRU App (Spring Boot 3.3 / Java 17)       │
        │                                                               │
        │  Security filter chain                                        │
        │   SessionAuthentication → Audit → CsrfHeader →                │
        │   PasswordChangeGate → BranchScope → Authorization            │
        │                                                               │
        │  Controller  ── /auth/**  /api/v1/**  /etl/**  /actuator/**   │
        │                                                               │
        │  Service (@Scheduled) → ETL (fan-out per kantor)              │
        │                            → Worker (@Transactional BIRU)     │
        │                                 → Helper (aturan domain)      │
        └───────┬───────────────────────────────────────────┬───────────┘
                │ SELECT saja                                │ read/write
                ▼                                            ▼
     ┌─────────────────────────┐                 ┌───────────────────────────┐
     │  CORE  (MySQL 5.5)      │                 │  BIRU  (MySQL 8)          │
     │  tabtrans, deptrans,    │                 │  t_transaction_tab/dep/krd│
     │  kretrans, tabung,      │                 │  saving/deposit/loan_     │
     │  deposito, kredit,      │                 │  nominatif, m_cif,        │
     │  nasabah, tabel kode    │                 │  etl_watermark, app_user, │
     │                         │                 │  app_session, audit_log   │
     └─────────────────────────┘                 └───────────────────────────┘
```

**Dua datasource yang terpisah penuh** adalah batasan arsitektur utamanya: dua `DataSource`, dua
`EntityManagerFactory`, dua `TransactionManager`, dan pemisahan paket entity/repository
(`model/core`, `repository/core` vs `model/biru`, `repository/biru`). Setiap transaksi menyebut
manajer transaksinya secara eksplisit.

**Rantai empat lapis per domain ETL:**

| Lapis | Tanggung jawab |
|-------|----------------|
| **Service** | Satu metode `@Scheduled` per ETL; memanggil ETL dan mencatat hasil/kegagalan. |
| **ETL** | Orkestrator: memuat daftar kantor dari `etl_watermark`, fan-out satu tugas per kantor ke thread pool, menjaga agar run tidak saling tumpang tindih, menangkap kegagalan per kantor. |
| **Worker** | Pekerjaan sebenarnya di dalam transaksi database BIRU: baca CORE, petakan ke entitas BIRU, simpan dengan proteksi duplikat, majukan cursor. |
| **Helper** | Aturan domain murni (penentuan channel, nomor referensi, penanda reversal, normalisasi nilai). |

### 2.2 Fungsi Utama Produk

| # | Fungsi |
|---|--------|
| 1 | Replikasi inkremental transaksi tabungan, deposito, kredit — paralel per kantor. |
| 2 | Snapshot harian nominatif tabungan, deposito, kredit per kantor. |
| 3 | Sinkronisasi data nasabah (CIF) + penanda kepemilikan produk. |
| 4 | Penjadwalan per ETL yang dapat dikonfigurasi dan dimatikan satu per satu. |
| 5 | Pemicu manual & backfill per tanggal untuk setiap ETL transaksi/nominatif. |
| 6 | Status watermark per kantor + metrik keterlambatan (Prometheus). |
| 7 | Rekonsiliasi jumlah baris CORE↔BIRU per domain, kantor, dan tanggal. |
| 8 | REST API baca: transaksi, nominatif, dan nasabah dengan paginasi cursor. |
| 9 | Login per pengguna berbasis cookie sesi + peran; API key untuk pemanggil mesin. |
| 10 | Pembatasan data per kantor yang dipaksa di lapisan request. |
| 11 | Administrasi pengguna (peran, kantor, reset password, penguncian, nonaktif). |
| 12 | Jejak audit lengkap + retensi otomatis. |
| 13 | Verifikasi prasyarat skema saat startup (menolak boot bila belum beres). |
| 14 | Dokumentasi API interaktif (Swagger UI / OpenAPI). |

### 2.3 Karakteristik Pengguna

| Pengguna | Peran teknis | Kebutuhan |
|----------|--------------|-----------|
| Staf pelaporan / analis | `VIEWER` | Membaca nominatif, mutasi, dan data nasabah; perlu tahu kesegaran data. |
| Kepala cabang / staf cabang | `VIEWER` + `branch_code` | Hanya data kantornya. |
| Operator TI BPR | `OPS` | Menjalankan/backfill ETL, rekonsiliasi, memantau status. |
| Admin TI BPR | `ADMIN` | Semua di atas + akun/peran, jejak audit, metrik. |
| Sistem lain | `SYSTEM` (API key) | Scraping metrik, pemicu terjadwal dari luar, integrasi. |
| DBA / IBS | — (akses DB) | Menjalankan DDL prasyarat, menyediakan user read-only CORE. |

### 2.4 Batasan & Asumsi

- Aplikasi berjalan dengan `spring.jpa.hibernate.ddl-auto=none`: **tidak ada tabel yang dibuat
  otomatis**; seluruh skema BIRU disiapkan DBA.
- **CORE tidak pernah ditulis.** Pagar tekniknya: user database CORE hanya `SELECT`, dan
  datasource CORE dikonfigurasi read-only.
- Entity CORE **hanya memetakan kolom yang dibaca ETL**, bukan cermin skema — karena kolom lokal
  antar BPR berbeda. Menyalin ulang seluruh definisi tabel dari core satu BPR akan menggagalkan
  domain itu di BPR lain.
- Zona waktu aplikasi, JDBC, dan JSON adalah `Asia/Jakarta`.
- Nilai uang bertipe desimal dengan 2 angka desimal (pembulatan HALF_UP).
- Primary key tabel transaksi BIRU berupa UUID biner 16 byte.
- Tidak ada konfigurasi CORS: aplikasi dilayani dari origin API-nya sendiri. Ini yang membuat
  pertahanan CSRF berbasis header berlaku.

## 3. Kebutuhan Fungsional

### 3.1 Modul ETL — Replikasi transaksi

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| FR-001 | Sistem menjalankan ETL transaksi **TAB**, **DEP**, dan **KRD** secara terjadwal, masing-masing dengan interval sendiri (format `Ns`/`Nm`/`Nh`, mis. `30m`). | Wajib |
| FR-002 | Setiap ETL memuat daftar kantor **dari tabel `etl_watermark`**; tidak ada sumber daftar cabang lain. | Wajib |
| FR-003 | Pemrosesan kantor berjalan **paralel** pada thread pool berukuran `scheduler.biru-etl-parallel-threads` (default 4). | Wajib |
| FR-004 | Satu ETL tidak boleh berjalan tumpang tindih dengan dirinya sendiri; pemicu saat masih berjalan **ditolak** dengan penanda "sudah berjalan". | Wajib |
| FR-005 | Data diambil dari CORE dalam batch berukuran `scheduler.biru-etl-batch-size` (default 2000), dengan filter `id sumber > cursor kantor`. | Wajib |
| FR-006 | Sistem **menguras (drain)** backlog satu kantor: ulangi batch hingga batch tidak penuh (backlog habis) atau batas `scheduler.biru-etl-max-drain-batches` (default 50) tercapai. | Wajib |
| FR-007 | Setiap batch tersimpan dalam **transaksi tersendiri**, dan cursor dimajukan ke id baris terakhir batch itu. Kegagalan batch ke-n tidak membatalkan batch sebelumnya. | Wajib |
| FR-008 | Kegagalan per kantor di-retry sampai `scheduler.biru-etl-max-retries` (default 2) dengan **backoff eksponensial** dari `scheduler.biru-etl-retry-backoff-ms` (default 1000 ms). | Wajib |
| FR-009 | Kegagalan satu kantor **dicatat dan tidak menggagalkan** kantor lain maupun keseluruhan run. | Wajib |
| FR-010 | Penyimpanan bersifat **idempoten**: baris sumber yang sudah ada diabaikan (dihitung sebagai *skipped*), bukan menimbulkan error atau duplikat. | Wajib |
| FR-011 | Cursor difilter **hanya berdasarkan id sumber**, bukan waktu transaksi. Waktu transaksi terakhir disimpan untuk tampilan status, bukan sebagai filter. | Wajib |
| FR-012 | Bila watermark kantor punya waktu mulai tetapi cursor masih kosong, sistem **menerjemahkan waktu mulai itu menjadi batas id** pada run pertama, lalu menyimpannya — sehingga pencarian itu hanya sekali per kantor. | Wajib |
| FR-013 | Bila watermark kantor tidak punya cursor maupun acuan lain, sistem mulai dari id 0 dan **mencatat peringatan keras** (artinya seluruh sejarah akan direplikasi). | Wajib |
| FR-014 | Setiap ETL transaksi menyediakan **pemicu manual** dan **backfill per tanggal** lewat REST API. | Wajib |
| FR-015 | Backfill per tanggal **tidak menggeser cursor**, sehingga tidak mengganggu replikasi berjalan. | Wajib |
| FR-016 | Setiap run mencatat waktu run terakhir dan pemicunya (`last_run_at`, `last_run_by`) pada watermark kantor. | Tinggi |

### 3.2 Modul ETL — Snapshot nominatif

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| FR-020 | Sistem menghasilkan snapshot nominatif **tabungan**, **deposito**, dan **kredit** untuk satu tanggal laporan, terjadwal (default interval `6h`) maupun manual per tanggal. | Wajib |
| FR-021 | Nominatif membaca `etl_watermark` **hanya untuk mengetahui daftar kantor**; tidak memajukan cursor. | Wajib |
| FR-022 | Satu baris snapshot per **(kantor, tanggal laporan, nomor rekening)**. | Wajib |
| FR-023 | Nominatif tabungan & deposito memuat: CIF, nama nasabah, saldo, suku bunga, kode produk, status rekening. | Wajib |
| FR-024 | Nominatif kredit memuat: kode & jenis produk, tipe angsuran, nama RM, status, plafon, jumlah pencairan, baki debet, sisa penarikan, pokok & bunga belum tertagih, tunggakan pokok & bunga, **bunga akrual**, suku bunga, tenor, tanggal mulai/jatuh tempo/angsuran pertama & terakhir, jumlah angsuran, pokok & bunga tertagih, tenor tertagih/belum tertagih, hari tunggakan pokok/bunga, hari tunggakan, dan tenor tunggakan. | Wajib |
| FR-025 | **Sumber bunga akrual mengikuti `core.flavour`**: `IBS_GEN1` menghitungnya dari tabel transaksi kredit, `IBS_GEN2` dari tabel penampung bunga yang akan diterima. Tidak ada nilai default untuk properti ini. | Wajib |
| FR-026 | Query nominatif yang **mengagregasi** transaksi tidak boleh menyertakan join ke tabel kode/lookup. Data deskriptif dari tabel kode diambil pada batch terpisah yang tidak mengagregasi transaksi, dan aman terhadap baris kode ganda. | Wajib |
| FR-027 | Menjalankan ulang nominatif untuk tanggal yang sama menghasilkan snapshot tanggal itu, bukan data ganda. | Wajib |

### 3.3 Modul ETL — Sinkronisasi nasabah (CIF)

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| FR-030 | Sistem menyinkronkan data nasabah per kantor (`CIF_SYNC`), terjadwal (default `6h`). | Wajib |
| FR-031 | Data CIF memuat: CIF, kantor, nama, NIK, tempat & tanggal lahir, jenis kelamin, alamat, kode pos, telepon, email. | Wajib |
| FR-032 | Setiap CIF diberi penanda kepemilikan produk aktif: `has_saving`, `has_deposit`, `has_loan`. | Wajib |
| FR-033 | Nilai jenis kelamin di luar `L`/`P` **dinormalisasi menjadi kosong oleh aplikasi**, bukan dengan mengubah data CORE. | Tinggi |
| FR-034 | CIF sync tidak memiliki endpoint pemicu manual; ia berjalan terjadwal. | Sedang |

### 3.4 Modul Penjadwalan & Konfigurasi

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| FR-040 | Interval setiap ETL dikonfigurasi lewat properti (`scheduler.biru-*-interval`) dalam format `Ns`/`Nm`/`Nh`, dan diterjemahkan menjadi ekspresi cron saat startup. | Wajib |
| FR-041 | Setiap ETL dapat **dimatikan sendiri-sendiri** (`scheduler.biru-*-enabled=false`); yang dimatikan tidak pernah dijalankan penjadwal. | Wajib |
| FR-042 | Interval yang tidak valid harus gagal dengan pesan yang bisa dipahami, bukan crash yang tidak jelas. | Tinggi |
| FR-043 | Semua properti dibaca dari satu berkas konfigurasi di luar JAR, sehingga perubahan konfigurasi tidak memerlukan build ulang. | Wajib |

### 3.5 Modul Pemantauan & Rekonsiliasi

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| FR-050 | `GET /etl/status` menampilkan per (ETL, kantor): cursor id, waktu transaksi terakhir, waktu run terakhir, pemicu terakhir, dan **umur data dalam detik**. | Wajib |
| FR-051 | `GET /etl/status` dapat dibaca **setiap pengguna yang login**, termasuk `VIEWER` — pembaca nominatif perlu tahu snapshot-nya basi atau belum. | Wajib |
| FR-052 | `GET /etl/reconcile?date=…[&domain=TAB\|DEP\|KRD]` membandingkan jumlah baris CORE vs BIRU per (domain, kantor) untuk tanggal itu, dan menandai setiap baris `MATCH` / `MISSING_IN_BIRU` / `EXTRA_IN_BIRU`. | Wajib |
| FR-053 | Rekonsiliasi mengembalikan **jumlah baris yang tidak cocok** sebagai ringkasan, dan mencatat setiap ketidakcocokan di log. | Tinggi |
| FR-054 | Sistem mengekspor gauge Prometheus `biru.etl.watermark.lag.seconds` bertanda `etl`, dihitung ulang berkala (`scheduler.biru-watermark-lag-refresh-ms`, default 30 s), dengan kardinalitas dibatasi per ETL (bukan per kantor). | Tinggi |
| FR-055 | Endpoint kesehatan (`/actuator/health`) terbuka tanpa autentikasi untuk health check container/LB; metrik dan Prometheus tidak. | Wajib |
| FR-056 | `GET /etl/status` dan `GET /etl/reconcile` **memfilter barisnya sendiri** sesuai kantor pemanggil, karena keduanya tidak menerima parameter kantor. | Wajib |

### 3.6 Modul API baca

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| FR-060 | API menyediakan transaksi **tabungan**, **deposito**, dan **kredit** dengan filter kantor (opsional), nomor rekening (opsional), serta **rentang tanggal (wajib)**. | Wajib |
| FR-061 | API menyediakan nominatif **tabungan**, **deposito**, dan **kredit** dengan filter kantor, rekening, dan rentang tanggal laporan. | Wajib |
| FR-062 | API menyediakan daftar nasabah per kantor (kantor **wajib**), dengan filter kepemilikan produk, dan detail nasabah per CIF. | Wajib |
| FR-063 | Paginasi memakai **cursor**: `limit` (default 100, maksimum 1000) dan `cursor` dari halaman sebelumnya; respons memuat `nextCursor` dan `hasMore`. | Wajib |
| FR-064 | Total jumlah baris hanya dihitung bila diminta (`includeTotal=true`), karena perhitungannya mahal. | Tinggi |
| FR-065 | Semua endpoint baca mengembalikan bentuk respons yang seragam (status, data, total, limit, meta). | Wajib |
| FR-066 | Detail nasabah yang tidak ditemukan mengembalikan `404`. | Wajib |
| FR-067 | `limit` di luar rentang yang diizinkan ditolak sebagai kesalahan permintaan (`400`). | Wajib |

### 3.7 Modul Autentikasi & Otorisasi

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| FR-070 | Pengguna login dengan username & password; sistem menerbitkan **cookie sesi `HttpOnly`, `SameSite=Strict`**, dan `Secure` sesuai konfigurasi. Token **tidak pernah** dikirim di badan respons. | Wajib |
| FR-071 | Password disimpan sebagai **hash BCrypt**, tidak pernah dalam bentuk yang bisa dibalik. | Wajib |
| FR-072 | Sesi disimpan sebagai **baris database** (`app_session`) berisi **hash SHA-256 token**, bukan tokennya. Sesi dapat dicabut kapan pun. | Wajib |
| FR-073 | Sesi punya **umur absolut** (`app.auth.session-ttl`, default 12 jam) dan **batas diam** (`app.auth.idle-timeout`, default 60 menit). | Wajib |
| FR-074 | `last_seen_at` tidak ditulis setiap request, hanya bila lebih tua dari `app.auth.last-seen-write-interval` (default 60 s). | Sedang |
| FR-075 | Gagal login berturut-turut sebanyak `app.auth.max-failed-attempts` (default 5) **mengunci akun** selama `app.auth.lockout-duration` (default 15 menit). Penghitung gagal **harus tetap tersimpan** walau login gagal. | Wajib |
| FR-076 | Akun terkunci menghasilkan status **423 Locked**, dibedakan dari kredensial salah (**401**), supaya pengguna tahu harus menunggu. | Tinggi |
| FR-077 | Pengguna dapat mengganti passwordnya sendiri; panjang minimum `app.auth.min-password-length` (default 12). Setelah ganti password, **semua sesinya dicabut**. | Wajib |
| FR-078 | Akun dengan penanda *wajib ganti password* **hanya boleh** mengakses `/auth/me`, `/auth/change-password`, dan `/auth/logout`; sisanya ditolak `403` dengan kode `PASSWORD_CHANGE_REQUIRED`. | Wajib |
| FR-079 | Pemanggil mesin memakai header `X-API-Key` dengan **pembandingan waktu-konstan**, dan mendapat peran `SYSTEM`. | Wajib |
| FR-080 | Peran `SYSTEM` **tidak pernah** ada di tabel pengguna, dan dibedakan dari `ADMIN` di jejak audit. | Wajib |
| FR-081 | Otorisasi bersifat **terpusat berbasis path**, bukan anotasi per controller; aturan terakhir mewajibkan autentikasi untuk **setiap** request yang tidak terdaftar (gagal tertutup). | Wajib |
| FR-082 | Urutan aturan otorisasi: `/api/v1/admin/**` (ADMIN) **harus di atas** `/api/**` (semua peran login). | Wajib |
| FR-083 | Path terbuka tanpa autentikasi hanya: `/auth/login`, Swagger UI & OpenAPI, `/docs`, `/favicon.ico`, `/error`, `/actuator/health`. | Wajib |
| FR-084 | Request yang mengubah data dari sesi cookie wajib menyertakan header `X-BIRU-Client: web`; tanpa itu ditolak `403` kode `CSRF_HEADER_MISSING`. Metode aman (GET/HEAD/OPTIONS/TRACE) dan pemanggil API key dikecualikan. | Wajib |
| FR-085 | Aplikasi tidak menyimpan sesi servlet (stateless) dan tidak menyediakan form login maupun basic auth. | Wajib |
| FR-086 | Menjalankan aplikasi dengan cookie non-`Secure` harus memunculkan **peringatan startup** yang jelas. | Sedang |

Matriks otorisasi (urutan sesuai evaluasi):

| Path | VIEWER | OPS | ADMIN | SYSTEM | Tanpa login |
|------|--------|-----|-------|--------|-------------|
| `/auth/login`, `/docs`, `/v3/api-docs/**`, `/actuator/health` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/auth/**` (me, logout, change-password) | ✅ | ✅ | ✅ | ✅ | ❌ |
| `GET /etl/status` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/etl/**` lainnya (pemicu, backfill, reconcile) | ❌ | ✅ | ✅ | ✅ | ❌ |
| `/api/v1/admin/**` | ❌ | ❌ | ✅ | ❌ | ❌ |
| `/api/**` (data, dibatasi kantor) | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/actuator/**` selain health | ❌ | ❌ | ✅ | ✅ | ❌ |
| endpoint baru yang belum didaftarkan | wajib login | wajib login | wajib login | wajib login | ❌ |

### 3.8 Modul Pembatasan per kantor

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| FR-090 | Akun dengan `branch_code` terisi **hanya boleh** membaca data kantor itu; `branch_code` kosong berarti semua kantor. | Wajib |
| FR-091 | Pembatasan dikerjakan **di lapisan request**, bukan di controller: parameter `branchCode` request ditulis ulang menjadi kantor yang diizinkan, sehingga endpoint baru otomatis ikut terbatas. | Wajib |
| FR-092 | Pemanggil yang **tidak menyebut** kantor → kantornya disuntikkan. | Wajib |
| FR-093 | Pemanggil yang menyebut **kantor lain** → `403` kode `BRANCH_FORBIDDEN`, **bukan** penulisan ulang diam-diam. | Wajib |
| FR-094 | `branchCode` kosong (`branchCode=`) dihitung sebagai "tidak disebut" dan **digantikan**, bukan diteruskan. | Wajib |
| FR-095 | Peran `SYSTEM` tidak pernah dibatasi kantor — ETL memang lintas kantor. | Wajib |
| FR-096 | Percobaan melewati pembatasan dicatat di log dan diberi keterangan pada baris audit. | Tinggi |

### 3.9 Modul Administrasi Pengguna

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| FR-100 | ADMIN dapat melihat daftar akun beserta peran, kantor, status aktif, status terkunci, login terakhir. | Wajib |
| FR-101 | ADMIN dapat membuat akun baru (username, nama, peran, kantor opsional, password awal). Akun baru **wajib ganti password** saat login pertama. | Wajib |
| FR-102 | ADMIN dapat mengubah nama, peran, kantor, status aktif, dan membuka penguncian. Field yang tidak dikirim tidak berubah. | Wajib |
| FR-103 | Menjadikan akun "semua kantor" harus **disebut eksplisit** (bukan disimpulkan dari kantor kosong), karena itu melonggarkan akses. | Wajib |
| FR-104 | ADMIN dapat mereset password akun lain; hasilnya **selalu** wajib diganti saat login berikutnya. | Wajib |
| FR-105 | Sistem **menolak**: menonaktifkan/menurunkan peran **ADMIN aktif terakhir**; mengubah peran sendiri; menonaktifkan diri sendiri; memperluas kantor sendiri. | Wajib |
| FR-106 | Pemeriksaan "ADMIN aktif terakhir" dihitung dari database, sehingga dua perubahan bersamaan tidak dapat menghapus admin terakhir bersama-sama. | Wajib |
| FR-107 | Perubahan yang mengubah hak akses (peran, kantor, nonaktif, reset password) **mencabut seluruh sesi** pengguna itu. Mengubah nama saja tidak. | Wajib |
| FR-108 | Penolakan administrasi dikembalikan sebagai JSON yang bisa dibaca operator (`404` tidak ditemukan, `409` tidak diizinkan/konflik, `400` masukan tidak valid) — dan penanganan ini **hanya berlaku pada controller administrasi**, agar kesalahan program di tempat lain tidak ikut disamarkan menjadi 400. | Wajib |
| FR-109 | Saat tabel pengguna masih kosong, sistem membuat **satu admin awal** dari konfigurasi bootstrap, dengan status wajib ganti password. Bila tabel sudah berisi, properti bootstrap **diabaikan sepenuhnya**. | Wajib |
| FR-110 | Bila tabel pengguna kosong **dan** password bootstrap tidak diisi, aplikasi **menolak start** — aplikasi tanpa satu pun akun tidak bisa dipakai siapa pun. | Wajib |

### 3.10 Modul Audit

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| FR-120 | Sistem mencatat: `LOGIN_OK`, `LOGIN_FAIL`, `LOGOUT`, `PASSWORD_CHANGED`, `QUERY`, `ETL_TRIGGER`. | Wajib |
| FR-121 | Setiap request baca `/api/**` tercatat sebagai `QUERY` — **termasuk setiap halaman sebuah export**, tanpa frontend perlu melaporkan apa pun. | Wajib |
| FR-122 | Setiap `POST /etl/**` tercatat sebagai `ETL_TRIGGER`; `GET /etl/**` tercatat sebagai `QUERY`. | Wajib |
| FR-123 | Baris audit memuat: waktu, username, aksi, target, parameter (query string), jumlah baris hasil, status HTTP, dan IP. | Wajib |
| FR-124 | **Percobaan yang ditolak juga tercatat**, beserta status HTTP-nya. | Wajib |
| FR-125 | Jumlah baris hasil diambil otomatis dari respons berformat standar; endpoint baru tidak perlu melaporkannya sendiri. | Tinggi |
| FR-126 | Pencatatan audit tidak boleh menggagalkan request yang sedang dilayani. | Wajib |
| FR-127 | ADMIN dapat mencari jejak audit dengan filter rentang tanggal, aksi, dan username (pencocokan sebagian), paginasi cursor menurun, `limit` maksimum 500. | Wajib |
| FR-128 | Aksi yang tidak dikenal pada filter audit ditolak `400` dengan menyebut nilai yang tersedia. | Sedang |
| FR-129 | Pencatatan `QUERY` dapat dimatikan lewat konfigurasi (`app.auth.audit-queries`), dengan konsekuensi yang dinyatakan jelas di dokumentasi. | Sedang |
| FR-130 | Sesi kedaluwarsa dan baris audit yang lebih tua dari `app.auth.audit-retention` (default 400 hari) dibersihkan otomatis **sekali sejam**, dan kegagalan pembersihan tidak boleh mematikan jadwalnya. | Wajib |

### 3.11 Modul Verifikasi Startup

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| FR-140 | Saat startup, sistem memverifikasi **unique index** yang menjadi dasar proteksi duplikat pada tiga tabel transaksi BIRU, dan **menolak start** bila ada yang tidak ada. | Wajib |
| FR-141 | Saat startup, sistem memverifikasi **tabel login & audit** ada di database BIRU, dan menolak start bila tidak. | Wajib |
| FR-142 | Saat startup, sistem menjalankan query bentuk-tanpa-baris ke **sumber bunga akrual sesuai `core.flavour`**, dan menolak start bila tabel/kolomnya tidak terbaca — agar flavour salah tidak berakhir sebagai kolom yang diam-diam kosong. | Wajib |
| FR-143 | Setiap penolakan startup harus menyebut **apa yang kurang dan di mana perbaikannya**, bukan sekadar stack trace. | Wajib |

### 3.12 Modul Dokumentasi API

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| FR-150 | Sistem menyediakan Swagger UI pada `/docs` dan spesifikasi OpenAPI pada `/v3/api-docs`, dengan judul/kontak/versi dari konfigurasi. | Tinggi |
| FR-151 | Keduanya **dapat dimatikan lewat konfigurasi**, dan dimatikan secara default pada template konfigurasi produksi, karena disajikan tanpa autentikasi. | Wajib |

## 4. Kebutuhan Non-Fungsional

| ID | Kategori | Kebutuhan |
|----|----------|-----------|
| NFR-001 | **Keamanan — kredensial** | Password ber-hash BCrypt; token sesi hanya disimpan sebagai hash SHA-256; API key dibandingkan dengan waktu konstan; kredensial database berada di berkas konfigurasi ber-permission ketat di luar image. |
| NFR-002 | **Keamanan — pengiriman** | Cookie sesi `HttpOnly` + `SameSite=Strict` + `Secure` (default). Instalasi produksi harus di belakang TLS. |
| NFR-003 | **Keamanan — jangan pernah** | Reverse proxy maupun proxy pengembangan **tidak boleh** menempelkan `X-API-Key` ke trafik browser; bila dilakukan, setiap pengunjung terautentikasi sebagai `SYSTEM`, seluruh pemeriksaan peran menjadi tidak berarti, dan audit kehilangan nama orang. |
| NFR-004 | **Keamanan — gagal tertutup** | Endpoint yang tidak terdaftar tetap mewajibkan autentikasi; pembatasan kantor berlaku di lapisan request sehingga endpoint baru tidak bisa lupa dibatasi. |
| NFR-005 | **Kerahasiaan data** | Tidak ada data nasabah di log aplikasi pada tingkat normal; startup di profil produksi tidak menuliskan kredensial datasource. |
| NFR-006 | **Integritas data** | Proteksi duplikat bersandar pada unique constraint database, diverifikasi saat startup; nilai uang memakai desimal 2 angka dengan pembulatan HALF_UP; zona waktu tunggal `Asia/Jakarta` untuk menghindari selisih tanggal. |
| NFR-007 | **Ketahanan** | Kegagalan per kantor di-retry dengan backoff dan tidak menjatuhkan run; batch yang sudah tersimpan tidak dibatalkan oleh kegagalan batch berikutnya; kegagalan pembersihan terjadwal tidak mematikan jadwal. |
| NFR-008 | **Kinerja — CORE** | Query ke CORE hanya memilih kolom yang dibutuhkan (proyeksi skalar, bukan entitas); ukuran batch dan jumlah thread dibatasi konfigurasi; pool koneksi CORE dibatasi (default maksimum 10). |
| NFR-009 | **Kinerja — API** | Paginasi cursor (bukan offset) agar halaman jauh tidak melambat; total baris hanya dihitung bila diminta; batas 1.000 baris per request. |
| NFR-010 | **Skalabilitas** | Penambahan kantor cukup dengan menambah baris watermark; paralelisme diatur konfigurasi tanpa perubahan kode. |
| NFR-011 | **Ketersediaan** | Container `restart: unless-stopped` + health check; ETL yang gagal pada satu siklus akan mengejar backlog pada siklus berikutnya tanpa intervensi. |
| NFR-012 | **Observabilitas** | Log per ETL ke berkas, status watermark lewat API, gauge keterlambatan lewat Prometheus, endpoint kesehatan untuk container/LB. |
| NFR-013 | **Auditabilitas** | Setiap pembacaan data nasabah dan setiap pemicuan ETL tercatat atas nama pemanggil, termasuk percobaan yang ditolak; retensi jejak audit default 400 hari agar satu siklus audit tahunan penuh selalu tersedia. |
| NFR-014 | **Portabilitas antar BPR** | Kolom CORE yang dibaca sengaja minimal; perbedaan generasi core dinyatakan lewat satu properti; prasyarat DDL per generasi didokumentasikan. |
| NFR-015 | **Kompatibilitas SQL** | Query ke CORE harus valid pada `sql_mode` bawaan MySQL 5.7/8 (termasuk `ONLY_FULL_GROUP_BY`) — bukan hanya pada mode yang dilonggarkan. |
| NFR-016 | **Kemudahan operasi** | Update aplikasi = ganti JAR + restart container, tanpa rebuild image; konfigurasi terbaca ulang saat restart; rollback dengan menyimpan JAR versi sebelumnya. |
| NFR-017 | **Kemudahan pemasangan** | Prasyarat yang belum beres harus menghentikan startup dengan pesan yang menyebut perbaikannya, bukan berjalan dan tampak sehat tanpa data. |
| NFR-018 | **Keterpeliharaan** | Setiap domain mengikuti rantai empat lapis yang sama; aturan domain berada di helper, bukan di pemetaan worker; konfigurasi keamanan berada di satu berkas. |
| NFR-019 | **Kualitas & pengujian** | Terdapat pengujian unit untuk helper/util, pengujian controller & rantai keamanan, serta pengujian integrasi terhadap MySQL sungguhan untuk DDL auth dan jalur tulis idempoten. Perilaku yang hanya muncul di database sungguhan diuji di sana, bukan dengan repository tiruan. |
| NFR-020 | **Lingkungan** | Java 17, Spring Boot 3.3.x, MySQL 5.5 (CORE) & MySQL 8 (BIRU), Docker; zona waktu container `Asia/Jakarta`. |

## 5. Use Case Utama

### UC-01 — Replikasi transaksi terjadwal

| | |
|---|---|
| **Aktor** | Penjadwal (sistem) |
| **Prakondisi** | ETL aktif; `etl_watermark` terisi untuk ETL & kantor; CORE dan BIRU dapat dihubungi. |
| **Alur** | 1. Penjadwal memanggil ETL sesuai interval. 2. ETL menolak jalan bila run sebelumnya belum selesai. 3. Daftar kantor dimuat dari watermark. 4. Setiap kantor diproses paralel: ambil batch id > cursor → simpan (duplikat diabaikan) → majukan cursor → ulangi sampai backlog habis atau batas batch tercapai. 5. Kegagalan kantor di-retry dengan backoff; bila tetap gagal, dicatat. |
| **Pascakondisi** | Baris baru tersimpan di BIRU; cursor & waktu run kantor diperbarui. |
| **Alternatif** | Cursor kosong → titik mulai diturunkan dari waktu mulai watermark dan disimpan. Cursor & acuan kosong → mulai dari 0 dengan peringatan keras. |

### UC-02 — Backfill data historis satu tanggal

| | |
|---|---|
| **Aktor** | Operator (`OPS`/`ADMIN`) |
| **Prakondisi** | Login; tanggal diketahui. |
| **Alur** | 1. Operator memanggil endpoint backfill domain dengan `date`. 2. Sistem menerima permintaan (`202`) dan memprosesnya di latar belakang, paralel per kantor. 3. Baris yang sudah ada diabaikan. 4. Pemicuan tercatat di audit sebagai `ETL_TRIGGER`. |
| **Pascakondisi** | Data tanggal itu lengkap di BIRU; **cursor tidak berubah**. |
| **Alternatif** | ETL sedang berjalan → `409` dengan pesan "sudah berjalan"; format tanggal salah → `400`. |

### UC-03 — Pengguna cabang membaca nominatif kredit

| | |
|---|---|
| **Aktor** | Pengguna `VIEWER` dengan `branch_code = 001` |
| **Prakondisi** | Login berhasil; password tidak dalam status wajib ganti. |
| **Alur** | 1. Pengguna meminta nominatif kredit untuk rentang tanggal. 2. Filter kantor dipaksa menjadi `001` di lapisan request. 3. Data dikembalikan dengan paginasi cursor. 4. Satu baris audit `QUERY` tercatat: username, filter, jumlah baris, status, IP. |
| **Pascakondisi** | Pengguna menerima hanya data kantor `001`. |
| **Alternatif** | Menyebut kantor lain → `403` `BRANCH_FORBIDDEN` dan percobaannya tercatat. Wajib ganti password → `403` `PASSWORD_CHANGE_REQUIRED`. |

### UC-04 — Operator menelusuri data yang tampak kurang

| | |
|---|---|
| **Aktor** | Operator (`OPS`) |
| **Alur** | 1. Buka `GET /etl/status`; temukan kantor dengan umur data menua atau cursor tidak bergerak. 2. Jalankan `GET /etl/reconcile?date=…&domain=TAB`. 3. Baris berstatus `MISSING_IN_BIRU` menunjukkan kantor & jumlah selisih. 4. Jalankan backfill tanggal itu. 5. Ulangi rekonsiliasi hingga `MATCH`. |
| **Pascakondisi** | Selisih tertutup dan terbukti lewat rekonsiliasi. |

### UC-05 — Admin mencabut akses pegawai yang resign

| | |
|---|---|
| **Aktor** | `ADMIN` |
| **Alur** | 1. Buka daftar pengguna. 2. Nonaktifkan akun orang tersebut. 3. Sistem mencabut seluruh sesinya saat itu juga. |
| **Pascakondisi** | Cookie yang masih dipegang orang itu tidak lagi berlaku. |
| **Alternatif** | Bila akun itu **ADMIN aktif terakhir** → ditolak `409`; harus ada admin lain terlebih dahulu. |

### UC-06 — Auditor menelusuri export data nasabah

| | |
|---|---|
| **Aktor** | `ADMIN` (atas permintaan auditor) |
| **Alur** | 1. Buka jejak audit dengan filter tanggal & aksi `QUERY`. 2. Telusuri per username; setiap halaman export tampak sebagai baris tersendiri dengan filter dan jumlah baris. 3. Percobaan yang ditolak tampak dengan status HTTP-nya. |
| **Pascakondisi** | Pertanyaan "siapa mengakses apa, kapan, sebanyak apa" terjawab dari catatan server. |

### UC-07 — Pemasangan di BPR baru

| | |
|---|---|
| **Aktor** | Tim deployment + DBA BPR |
| **Alur** | 1. Jalankan patch DDL prasyarat di CORE sesuai generasi core, dan skema/patch di BIRU. 2. Siapkan tabel login & audit. 3. Seed `etl_watermark` untuk 7 ETL × seluruh kantor dengan titik mulai. 4. Isi konfigurasi termasuk `core.flavour` dan admin awal. 5. Jalankan container dengan seluruh ETL dimatikan; pastikan startup lolos verifikasi skema. 6. Nyalakan ETL satu per satu sambil memantau `/etl/status`. |
| **Pascakondisi** | Replikasi berjalan untuk seluruh kantor; login berfungsi. |
| **Alternatif** | Verifikasi startup gagal → aplikasi menolak jalan dengan pesan yang menyebut prasyarat yang kurang. |

## 6. Antarmuka Eksternal

### 6.1 Antarmuka pengguna

Tidak ada di produk ini selain Swagger UI (`/docs`). Konsumen berupa aplikasi web terpisah dan
pemanggil mesin.

### 6.2 Antarmuka perangkat lunak

| Sistem | Arah | Protokol | Keterangan |
|--------|------|----------|------------|
| CORE (core banking IBS) | BIRU → CORE | JDBC MySQL | **SELECT saja**, pool terbatas, read-only. |
| BIRU (DB pelaporan) | BIRU ↔ BIRU DB | JDBC MySQL | Read/write; tidak membuat skema. |
| Konsumen data (aplikasi web, integrasi) | Konsumen → BIRU | HTTPS/REST JSON | Cookie sesi (browser) atau `X-API-Key` (mesin). |
| Prometheus | Prometheus → BIRU | HTTP `/actuator/prometheus` | Memakai `X-API-Key`. |
| Load balancer / Docker | LB → BIRU | HTTP `/actuator/health` | Terbuka tanpa autentikasi. |

### 6.3 Antarmuka komunikasi

- HTTP/1.1, JSON UTF-8; tanggal `yyyy-MM-dd`, waktu zona `Asia/Jakarta`.
- Port aplikasi di dalam container `8080`, dipetakan ke port host (default `2001`).
- Tidak ada CORS; browser dan API berada pada satu origin lewat reverse proxy.

## 7. Ketertelusuran Kebutuhan (BRD → SRS)

| Kebutuhan Bisnis | Kebutuhan Fungsional/Non-Fungsional |
|------------------|-------------------------------------|
| BR-001 · BR-002 · BR-003 | FR-001 … FR-016 |
| BR-004 | FR-020 … FR-023, FR-027 |
| BR-005 | FR-024, FR-025, FR-026, NFR-015 |
| BR-006 | FR-030 … FR-034 |
| BR-007 | FR-010, FR-140, NFR-006 |
| BR-008 | FR-005 … FR-013, NFR-007 |
| BR-009 | FR-014, FR-015 |
| BR-010 | FR-050, FR-051, FR-054, FR-055 |
| BR-011 | FR-052, FR-053, FR-056 |
| BR-012 | FR-060 … FR-067, NFR-009 |
| BR-013 | FR-070 … FR-078, FR-081, FR-082 |
| BR-014 | FR-090 … FR-096, NFR-004 |
| BR-015 | FR-120 … FR-126, NFR-013 |
| BR-016 | FR-072, FR-107 |
| BR-017 | FR-100 … FR-108 |
| BR-018 | FR-079, FR-080, NFR-003 |
| BR-019 | FR-025, FR-142, NFR-014 |
| BR-020 | FR-140 … FR-143, FR-110, NFR-017 |
| BR-021 | NFR-016 |
| BR-022 | FR-130 |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 30 Juli 2026 | | Dokumen dibuat |

---

*[← Kembali ke BIRU App](README.md)* · *[Daftar Produk](../../README.md)*

*Dikelola dengan **Analyst CLI**.*
