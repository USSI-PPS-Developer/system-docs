# 📄 Business Requirement Document (BRD) — BIRU App

> Dokumen kebutuhan bisnis untuk produk **BIRU App** (*Banking Integration and Replication Utility*) — layanan replikasi data core banking BPR ke database pelaporan beserta API bacanya.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | BIRU App            |
| Jenis Dokumen     | Business Requirement Document (BRD) |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 30 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Latar Belakang

**BIRU App** (*Banking Integration and Replication Utility*) adalah layanan **ETL + REST API**
yang menyalin data operasional dari **database core banking BPR (IBS)** ke sebuah **database
pelaporan** milik BPR, lalu menyediakannya kembali lewat API baca yang aman dan terjejak.

Persoalan yang dijawabnya berangkat dari kondisi lapangan di BPR:

- **Core banking adalah sistem yang dipakai bertransaksi setiap hari.** Menjalankan query
  pelaporan langsung di sana — rekap nominatif, tarikan mutasi setahun, export nasabah — berarti
  membebani database yang sedang dipakai teller dan kasir. Query berat di jam kerja terasa
  langsung oleh nasabah di loket.
- **Core banking BPR umumnya MySQL 5.5 dan berbeda-beda antar BPR.** Versi core tidak seragam:
  ada kolom yang ada di satu BPR dan tidak ada di BPR lain, dan ada figur yang sama tetapi
  disimpan di tabel berbeda antar generasi core. Setiap konsumen data yang menulis query sendiri
  ke core akan pecah di BPR berikutnya.
- **Akses langsung ke core tidak bisa dipertanggungjawabkan.** Kalau setiap aplikasi pelaporan,
  dashboard, atau tim mendapat kredensial database core, tidak ada satu pun catatan tentang siapa
  membaca data nasabah, kapan, dan sebanyak apa — sementara itu justru pertanyaan pertama saat
  audit atau saat ada dugaan kebocoran data.
- **Angka pelaporan harus konsisten dan dapat direkonsiliasi.** Laporan yang dihitung ulang di
  hilir menghasilkan angka kedua yang harus dicocokkan dengan angka core. Yang dibutuhkan adalah
  **salinan** angka core, bukan perhitungan baru.

BIRU App menempati posisi di antara keduanya: ia **membaca core secara read-only dan
inkremental**, menyimpan hasilnya ke database pelaporan (BIRU) dalam bentuk yang stabil dan
bernama seragam, lalu **hanya database pelaporan itulah** yang dibuka ke konsumen — lewat REST API
dengan login per pengguna, pembatasan per kantor, dan jejak audit setiap pembacaan.

Dibangun dengan **Spring Boot 3.3 / Java 17**, dijalankan sebagai container Docker di server BPR,
menghubungkan **dua database MySQL terpisah**: CORE (sumber, read-only) dan BIRU (tujuan,
read/write).

## 2. Tujuan (Business Objectives)

| Kode | Tujuan | Indikator Keberhasilan (KPI) |
|------|--------|------------------------------|
| OBJ-1 | Memindahkan beban query pelaporan **keluar dari core banking**. | Tidak ada lagi konsumen pelaporan yang memegang kredensial database CORE; query pelaporan berjalan di DB BIRU. |
| OBJ-2 | Menyediakan **replika data transaksi** (tabungan, deposito, kredit) yang lengkap dan tidak dobel. | Rekonsiliasi jumlah baris CORE↔BIRU per kantor per tanggal menunjukkan `diff = 0`. |
| OBJ-3 | Menyediakan **snapshot harian posisi rekening** (nominatif) untuk tabungan, deposito, dan kredit. | Snapshot per tanggal laporan tersedia untuk seluruh kantor dan bisa diambil lewat API. |
| OBJ-4 | Menyediakan **data nasabah (CIF)** terkonsolidasi beserta penanda kepemilikan produk. | Data CIF per kantor tersedia dengan penanda `has_saving` / `has_deposit` / `has_loan`. |
| OBJ-5 | Menjamin **CORE tidak pernah ditulis** oleh BIRU. | User database CORE hanya ber-`GRANT SELECT`; tidak ada operasi tulis dari aplikasi ke CORE. |
| OBJ-6 | Memastikan setiap pembacaan data nasabah **tercatat atas nama orang**, bukan atas nama sistem. | `audit_log` memuat username, filter, jumlah baris, status, dan IP untuk setiap request baca — termasuk setiap halaman sebuah export. |
| OBJ-7 | Membatasi akses data **per kantor** untuk pegawai kantor cabang. | Akun ber-`branch_code` hanya pernah menerima data kantornya; percobaan mengubah `branchCode` di URL menghasilkan `403` dan tercatat. |
| OBJ-8 | Membuat **kesegaran data terlihat** tanpa harus membaca log. | `GET /etl/status` menampilkan cursor & umur data per kantor; gauge Prometheus `biru.etl.watermark.lag.seconds` tersedia. |
| OBJ-9 | Dapat dipasang di **BPR dengan generasi core yang berbeda** tanpa perubahan kode. | Instalasi hanya menyetel `core.flavour` (`IBS_GEN1`/`IBS_GEN2`) dan menjalankan patch DDL prasyarat. |

## 3. Ruang Lingkup (Scope)

### ✅ In Scope

**Replikasi data (ETL) — 7 pipeline:**

- **Transaksi tabungan** (`TAB_TRANSACTION`) — inkremental, berbasis watermark per kantor.
- **Transaksi deposito** (`DEP_TRANSACTION`) — inkremental.
- **Transaksi kredit** (`KRD_TRANSACTION`) — inkremental.
- **Nominatif tabungan** (`SAVING_NOMINATIF`) — snapshot harian posisi rekening.
- **Nominatif deposito** (`DEPOSIT_NOMINATIF`) — snapshot harian.
- **Nominatif kredit** (`LOAN_NOMINATIF`) — snapshot harian, termasuk baki debet, tunggakan,
  jadwal angsuran, dan bunga akrual.
- **Sinkronisasi nasabah** (`CIF_SYNC`) — data CIF + penanda kepemilikan produk.

**Operasional ETL:**

- Penjadwalan otomatis per pipeline dengan interval yang bisa dikonfigurasi (`30m`, `6h`, …) dan
  bisa dinyalakan/dimatikan satu per satu.
- Pemicu manual per pipeline, dan **backfill per tanggal** untuk memuat data historis.
- Paralelisasi **per kantor (cabang)**, dengan retry + backoff per kantor.
- Proteksi duplikat (idempotensi) sehingga run ulang tidak menggandakan data.
- Pemantauan: status watermark per kantor, rekonsiliasi jumlah baris CORE↔BIRU per tanggal,
  metrik Prometheus, dan health check.

**API baca (REST):**

- Transaksi tabungan / deposito / kredit dengan filter kantor, rekening, dan rentang tanggal.
- Nominatif tabungan / deposito / kredit per tanggal laporan.
- Nasabah (CIF): daftar per kantor dan detail per CIF.
- Paginasi cursor, dengan opsi menyertakan total.

**Keamanan, pengguna, dan audit:**

- Login per pengguna (cookie sesi `HttpOnly`), peran `VIEWER` / `OPS` / `ADMIN`.
- `X-API-Key` khusus pemanggil mesin (Prometheus, cron, integrasi) dengan peran `SYSTEM`.
- Pembatasan data per kantor yang dipaksa di sisi server.
- Administrasi pengguna (buat, ubah peran/kantor, reset password, buka penguncian, nonaktifkan).
- Jejak audit: login berhasil/gagal, logout, ganti password, setiap pembacaan `/api/**`
  (termasuk export), dan setiap pemicuan ETL — beserta retensi otomatis.

**Deployment & dokumentasi:**

- Deployment Docker (JAR + config + logs sebagai volume), update tanpa rebuild image.
- Verifikasi skema saat startup yang **menolak boot** kalau prasyarat database belum beres.
- Dokumentasi API interaktif (Swagger UI / OpenAPI).

### ❌ Out of Scope

- **Antarmuka pengguna (frontend/dashboard)** — produk ini menyediakan API; aplikasi web
  pembacanya adalah produk tersendiri.
- **Menulis ke core banking.** BIRU tidak pernah mengubah data CORE dalam bentuk apa pun.
- **Modul core banking di luar tabungan/deposito/kredit/nasabah** (GL, akuntansi, kliring,
  teller, dsb.).
- **Pembuatan atau pemeliharaan skema core banking** — dikelola oleh IBS/DBA BPR. BIRU hanya
  mendaftarkan patch DDL yang menjadi prasyaratnya.
- **Perhitungan ulang angka perbankan.** Figur diambil dari pembukuan core; BIRU tidak menghitung
  bunga, kolektibilitas, atau CKPN sendiri.
- **Pelaporan regulator (LBBPR/SLIK/APOLO)** — BIRU menyediakan datanya, bukan format laporannya.
- **Replikasi real-time (CDC / streaming).** Replikasi bersifat batch inkremental dengan interval
  menit/jam.
- **Multi-kantor per akun.** Satu akun terikat satu kantor atau semua kantor.

## 4. Stakeholder

| Peran | Nama / Unit | Tanggung Jawab |
|-------|-------------|----------------|
| Sponsor | Manajemen TI BPR / PT USSI Pinbuk Prima Software | Menyetujui inisiatif pemisahan beban pelaporan dari core. |
| Business Owner | Unit Pelaporan / Operasional BPR | Menetapkan figur yang harus tersedia dan definisinya. |
| Product Owner | Tim Produk USSI | Prioritas fitur, urutan domain (TAB → DEP → KRD → CIF). |
| Konsumen data | Tim Pelaporan, Analis Kredit, Kepala Cabang | Memakai API/aplikasi baca untuk nominatif, mutasi, dan data nasabah. |
| Konsumen mesin | Prometheus, cron, aplikasi integrasi | Memanggil endpoint status/metrik dan pemicu ETL terjadwal. |
| Operator (`OPS`) | Petugas TI BPR | Menjalankan/backfill ETL, memantau kesegaran data, rekonsiliasi. |
| Administrator (`ADMIN`) | Admin TI BPR | Mengelola akun & peran, membaca jejak audit, memantau metrik. |
| DBA / Tim IBS Core | Pengelola core banking BPR | Menjalankan patch DDL prasyarat, menyediakan user read-only CORE. |
| Auditor Internal / Kepatuhan | SKAI / Kepatuhan BPR | Menelusuri siapa mengakses data nasabah dan kapan. |
| Developer / Maintainer | Tim USSI | Pengembangan & pemeliharaan layanan BIRU. |

## 5. Kebutuhan Bisnis

| ID | Kebutuhan Bisnis | Prioritas | Catatan |
|----|------------------|-----------|---------|
| BR-001 | Data transaksi **tabungan** tersalin dari core ke DB pelaporan secara berkala. | Wajib | ETL `TAB_TRANSACTION`, inkremental per kantor. |
| BR-002 | Data transaksi **deposito** tersalin dari core ke DB pelaporan secara berkala. | Wajib | ETL `DEP_TRANSACTION`. |
| BR-003 | Data transaksi **kredit** tersalin dari core ke DB pelaporan secara berkala. | Wajib | ETL `KRD_TRANSACTION`. |
| BR-004 | Tersedia **snapshot harian nominatif** tabungan, deposito, dan kredit per kantor. | Wajib | Kunci snapshot: (kantor, tanggal laporan, rekening). |
| BR-005 | Nominatif kredit memuat figur kredit yang dipakai pelaporan: baki debet, tunggakan pokok/bunga, hari tunggakan, jadwal & jumlah angsuran, plafon, pencairan, sisa penarikan, **bunga akrual**. | Wajib | Bunga akrual diambil dari pembukuan core sesuai generasinya. |
| BR-006 | Data **nasabah (CIF)** tersedia per kantor beserta penanda kepemilikan tabungan/deposito/kredit. | Wajib | ETL `CIF_SYNC`. |
| BR-007 | Menjalankan ulang ETL **tidak boleh menggandakan** data transaksi. | Wajib | Proteksi lewat unique index + `INSERT IGNORE`; run ulang aman. |
| BR-008 | Replikasi **tidak boleh kehilangan baris**, termasuk saat jadwal terlewat atau aplikasi mati. | Wajib | Cursor berbasis id sumber per kantor; backlog dikejar bertahap. |
| BR-009 | Data historis dapat dimuat **per tanggal** tanpa mengganggu replikasi berjalan. | Wajib | Endpoint backfill; tidak menggeser cursor. |
| BR-010 | Operator dapat melihat **kesegaran data per kantor** dan menemukan pipeline yang macet. | Wajib | `GET /etl/status` + gauge Prometheus. |
| BR-011 | Selisih jumlah baris CORE↔BIRU dapat **direkonsiliasi per tanggal dan per kantor**. | Wajib | `GET /etl/reconcile`; status `MATCH` / `MISSING_IN_BIRU` / `EXTRA_IN_BIRU`. |
| BR-012 | Konsumen mengambil data lewat **API baca** dengan filter kantor, rekening, dan rentang tanggal. | Wajib | Paginasi cursor, batas 1.000 baris per request. |
| BR-013 | Setiap orang punya **akun sendiri** dengan peran yang membatasi apa yang boleh dilakukannya. | Wajib | `VIEWER` / `OPS` / `ADMIN`; satu akun per orang. |
| BR-014 | Pegawai kantor cabang **hanya boleh membaca data kantornya**, dipaksa server. | Wajib | `app_user.branch_code`; melanggar → `403` + tercatat. |
| BR-015 | Setiap pembacaan data nasabah — **termasuk setiap halaman export** — tercatat atas nama pengguna. | Wajib | `audit_log` aksi `QUERY`; filter, jumlah baris, status, IP. |
| BR-016 | Akses seseorang dapat **dicabut segera** saat ia resign atau berpindah tugas. | Wajib | Sesi berupa baris DB; nonaktifkan akun → sesi dicabut saat itu. |
| BR-017 | Admin dapat mengelola akun tanpa perlu `UPDATE` manual di database produksi. | Tinggi | Menu administrasi pengguna; guard menolak aksi yang mematikan akses. |
| BR-018 | Pemanggil mesin (Prometheus/cron) dapat mengakses tanpa akun manusia, dan **dapat dibedakan** di jejak audit. | Tinggi | `X-API-Key` → peran `SYSTEM`. |
| BR-019 | Instalasi di BPR dengan **generasi core berbeda** tidak memerlukan perubahan kode. | Wajib | `core.flavour=IBS_GEN1\|IBS_GEN2`. |
| BR-020 | Kalau prasyarat database belum beres, aplikasi harus **gagal start dengan pesan jelas**, bukan jalan tanpa data. | Wajib | Verifikasi skema saat startup (unique index, tabel auth, sumber bunga akrual). |
| BR-021 | Update versi aplikasi dilakukan **tanpa rebuild image** dan dapat di-rollback. | Tinggi | Ganti JAR di volume + restart container; simpan JAR versi sebelumnya. |
| BR-022 | Ukuran jejak audit tidak boleh tumbuh tanpa batas. | Sedang | Retensi otomatis (default 400 hari). |

## 6. Proses Bisnis

### 6.1 Alur replikasi transaksi (inkremental)

```
[Scheduler]                              (interval, mis. tiap 30 menit)
     │
     ▼
Baca daftar kantor dari etl_watermark   (tabel ini adalah sumber daftar cabang)
     │
     ├── kantor 001 ─┐
     ├── kantor 002 ─┼── berjalan paralel (thread pool)
     └── kantor 00n ─┘
              │
              ▼
   Ambil batch transaksi CORE dengan id sumber > cursor kantor itu
              │
              ▼
   Simpan ke DB BIRU (duplikat diabaikan, bukan digagalkan)
              │
              ▼
   Majukan cursor kantor ke id terakhir yang tersimpan
              │
              ▼
   Ulangi sampai backlog habis / batas batch tercapai
```

Kalau satu kantor gagal, kantor itu di-retry; kegagalannya **tidak** menghentikan kantor lain dan
tidak menggagalkan seluruh run.

### 6.2 Alur snapshot nominatif (harian)

```
[Scheduler / pemicu manual] → untuk tanggal laporan T
     │
     ▼
Untuk setiap kantor: hitung posisi rekening di CORE per tanggal T
     │
     ▼
Simpan sebagai satu baris per (kantor, tanggal T, rekening) di DB BIRU
```

Snapshot tidak memakai cursor: menjalankan ulang untuk tanggal yang sama menghasilkan snapshot
tanggal itu lagi, bukan data ganda.

### 6.3 Alur konsumsi data oleh pengguna

```
Pengguna → login (username & password)
     │           └─ gagal berturut-turut → akun terkunci sementara
     ▼
Cookie sesi (HttpOnly) diterbitkan; sesi tercatat sebagai baris DB
     │
     ├─ wajib ganti password? → hanya boleh ganti password dulu
     ▼
Request baca data (mis. nominatif kredit kantor 001, Juli 2026)
     │
     ├─ punya branch_code? → filter kantor dipaksa server
     ├─ minta kantor lain?  → 403, dan percobaannya tercatat
     ▼
Data dikembalikan  →  satu baris audit: siapa, filter apa, berapa baris, status, IP
```

### 6.4 Alur operasional harian (OPS)

1. Cek `GET /etl/status` — apakah ada kantor yang cursornya tidak bergerak / umur datanya menua.
2. Bila ada selisih yang dicurigai, jalankan `GET /etl/reconcile?date=…` per domain.
3. Bila ada baris yang belum masuk, jalankan backfill tanggal tersebut.
4. Bila pipeline macet, periksa log per ETL dan status container.

## 7. Asumsi

| ID | Asumsi |
|----|--------|
| AS-1 | Database core banking BPR dapat diakses dari server BIRU dengan user **read-only**. |
| AS-2 | Tabel core (`tabtrans`, `deptrans`, `kretrans`, `tabung`, `deposito`, `kredit`, `nasabah`) memakai penamaan IBS dan memiliki id numerik yang menaik per baris baru. |
| AS-3 | Daftar kantor BPR bersifat relatif stabil dan disediakan saat instalasi (seed `etl_watermark`). |
| AS-4 | Database pelaporan (BIRU) disiapkan oleh DBA BPR; aplikasi berjalan dengan `ddl-auto=none` dan tidak membuat tabel sendiri. |
| AS-5 | Server BPR menyediakan Docker dan zona waktu `Asia/Jakarta`. |
| AS-6 | Akses ke aplikasi dari browser dilewatkan reverse proxy (nginx) pada satu origin yang sama dengan API. |
| AS-7 | Terdapat satu tanggung jawab manusia untuk administrasi akun (ADMIN) di setiap instalasi. |

## 8. Batasan (Constraints)

| ID | Batasan | Implikasi Bisnis |
|----|---------|------------------|
| C-1 | **CORE read-only.** | Setiap kebutuhan yang mensyaratkan penulisan ke core berada di luar produk ini. |
| C-2 | Data BIRU **selalu tertinggal** sebesar interval penjadwalan. | Angka BIRU bukan angka real-time; kesegarannya harus terlihat (lihat BR-010). |
| C-3 | Kolom yang dibaca dari core sengaja **sedikit dan tetap**. | Menambah figur baru berarti menambah prasyarat DDL & penyesuaian di semua deployment. |
| C-4 | Beberapa figur berada di **tabel berbeda antar generasi core**. | Instalasi wajib menyatakan generasi core (`core.flavour`); salah nilai → aplikasi menolak start. |
| C-5 | Satu akun terikat **satu kantor** atau semua kantor. | Kepala wilayah dengan beberapa cabang: satu akun per cabang, atau akses semua kantor. |
| C-6 | `X-API-Key` **satu untuk semua** pemanggil mesin dan tidak bisa dicabut per pemanggil. | Kunci ini tidak boleh dipakai trafik browser; rotasinya berdampak ke seluruh integrasi. |
| C-7 | Batas 1.000 baris per request pada API baca. | Export besar dilakukan bertahap; setiap halaman tetap tercatat di audit. |
| C-8 | `audit_log` hanya bertambah. | Perlu retensi & pemantauan ukuran pada BPR bervolume besar. |

## 9. Risiko & Mitigasi

| ID | Risiko | Dampak | Mitigasi |
|----|--------|--------|----------|
| R-1 | Watermark tidak di-seed → semua ETL jalan tanpa memproses apa pun. | Data tidak pernah masuk, tapi aplikasi tampak sehat. | Seed `etl_watermark` menjadi bagian wajib instalasi; kesegaran data terlihat di `/etl/status`. |
| R-2 | Watermark di-seed kosong seluruhnya → replikasi mengulang seluruh sejarah. | Beban berat di core, bisa belasan tahun data. | Aturan seeding memaksa menyebut titik mulai; aplikasi memberi peringatan keras. |
| R-3 | Unique index proteksi duplikat hilang. | Data transaksi dobel tanpa error → angka pelaporan salah. | Verifikasi saat startup: aplikasi **menolak** jalan tanpa index tersebut. |
| R-4 | `core.flavour` disetel salah. | Kolom bunga akrual diam-diam kosong / salah tabel. | Diperiksa saat startup dengan query ke sumbernya; salah → gagal start dengan pesan jelas. |
| R-5 | Reverse proxy menempelkan `X-API-Key` ke trafik browser. | Setiap pengunjung terautentikasi sebagai `SYSTEM`; halaman login jadi hiasan, audit kehilangan nama orang. | Larangan eksplisit di konfigurasi & dokumentasi deployment; audit membedakan `SYSTEM` dari pengguna. |
| R-6 | Baris sentinel ber-id ekstrem di tabel core. | Cursor kantor melompat ke id terbesar → replikasi kantor itu berhenti permanen. | Pemeriksaan prasyarat sebelum ETL pertama (bagian prasyarat database). |
| R-7 | Query pelaporan berat di core saat jam kerja (mis. backfill salah tanggal). | Layanan loket melambat. | Backfill dibatasi peran `OPS`/`ADMIN` dan tercatat di audit; dijadwalkan di luar jam sibuk. |
| R-8 | Akun dipakai bersama beberapa orang. | Jejak audit tidak bisa menjawab siapa mengakses apa. | Kebijakan satu akun per orang; admin dapat membuat akun tanpa SQL. |
| R-9 | `audit_log` tumbuh besar di BPR bervolume tinggi. | Ruang disk & query audit melambat. | Retensi otomatis + pemantauan jumlah baris. |
| R-10 | Cookie sesi dikirim lewat HTTP tanpa TLS. | Password & sesi dapat dibaca di jaringan yang sama. | Cookie default `Secure`; menonaktifkannya memicu peringatan startup dan hanya untuk pengembangan lokal. |

## 10. Kriteria Keberhasilan (Definition of Success)

1. Tujuh pipeline ETL berjalan terjadwal untuk seluruh kantor BPR, dan `GET /etl/status`
   menunjukkan cursor bergerak dengan umur data dalam batas interval yang disepakati.
2. Rekonsiliasi CORE↔BIRU untuk tanggal uji menghasilkan `diff = 0` pada TAB, DEP, dan KRD di
   seluruh kantor.
3. Nominatif tabungan, deposito, dan kredit untuk tanggal laporan dapat diambil lewat API dan
   figurnya cocok dengan laporan core untuk sampel yang diuji.
4. Tidak ada konsumen pelaporan yang masih memegang kredensial database CORE.
5. Setiap pengguna punya akun sendiri; pegawai cabang hanya menerima data kantornya, dan
   percobaan melewatinya menghasilkan `403` yang tercatat.
6. `audit_log` dapat menjawab "siapa mengakses/meng-export data nasabah pada tanggal X" untuk
   periode retensi yang berlaku.
7. Update versi aplikasi dapat dilakukan dan di-rollback dalam satu jendela pemeliharaan singkat.

## 11. Definisi & Istilah

| Istilah | Penjelasan |
|---------|------------|
| **BIRU** | *Banking Integration and Replication Utility* — produk ini. Juga nama database tujuan. |
| **CORE** | Database core banking BPR (IBS), sumber data, diakses read-only. |
| **ETL** | *Extract, Transform, Load* — proses menyalin data dari CORE ke BIRU. |
| **Nominatif** | Snapshot posisi seluruh rekening pada satu tanggal laporan. |
| **Watermark** | Penanda batas data yang sudah tersalin per (pipeline, kantor). |
| **Backfill** | Pemuatan data historis untuk tanggal tertentu secara manual. |
| **Rekonsiliasi** | Pembandingan jumlah baris CORE vs BIRU untuk tanggal & kantor tertentu. |
| **Kantor / cabang** | Unit kerja BPR; di CORE disebut *kantor*, di BIRU `branch_code`. |
| **CIF** | *Customer Information File* — identitas nasabah. |
| **Baki debet** | Saldo pokok kredit yang masih terutang (`outstanding_balance`). |
| **Bunga akrual** | Bunga yang sudah menjadi hak bank tetapi belum jatuh tempo/tertagih. |
| **Idempoten** | Sifat operasi yang menghasilkan keadaan sama walau dijalankan berulang. |
| **VIEWER / OPS / ADMIN / SYSTEM** | Peran akses: baca data · baca + jalankan ETL · penuh + administrasi · pemanggil mesin ber-API key. |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 30 Juli 2026 | | Dokumen dibuat |

---

*[← Kembali ke BIRU App](README.md)* · *[Daftar Produk](../../README.md)*

*Dikelola dengan **Analyst CLI**.*
