# 🚀 Deployment Guide — BIRU App

> Panduan pemasangan **BIRU App** di server BPR (staging/production): prasyarat database, konfigurasi, menjalankan container Docker, verifikasi, penyalaan scheduler, operasional harian, update & rollback, serta troubleshooting.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | BIRU App            |
| Jenis Dokumen     | Deployment Guide    |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 30 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 0. Ringkasan Alur

```
[Mesin dev / CI]                    [Server BPR]                       [Database]
      │                                   │                                 │
 1. build JAR ──────scp────────► app/app.jar                                │
                                          │                                 │
 2. upload Dockerfile & compose ─────────►│                                 │
                                          │                                 │
 3.                              config/application.properties              │
                                   (kredensial, core.flavour,               │
                                    api-key, admin pertama)                 │
                                          │                                 │
 0. PRASYARAT DB (sebelum start) ─────────┼────────────────────────────────►│
    · patch kolom CORE per generasi       │        · skema BIRU + 3 unique index
    · tabel login & audit                 │        · seed etl_watermark (7 ETL × kantor)
                                          │                                 │
 4. docker compose build && up -d ───────►│ startup memverifikasi prasyarat │
                                          │ (gagal → menolak jalan)         │
 5. verifikasi: health, /etl/status, backfill 1 hari, reconcile             │
 6. nyalakan scheduler bertahap                                             │
```

**Prinsip deployment:** image Docker hanya berisi JRE. JAR, konfigurasi, dan log di-*mount* sebagai
volume — sehingga **update = upload JAR baru + restart container**, tanpa rebuild image dan tanpa
source code di server.

---

## 1. Prasyarat

### 1.1 Server

| Kebutuhan | Keterangan |
|-----------|------------|
| OS | Linux 64-bit (amd64) |
| Docker | Docker Engine + Compose v2 |
| RAM | Minimal 2 GB tersedia untuk container (`-Xmx1g` default) |
| Disk | Cukup untuk log; database berada di server MySQL |
| Jam sistem | Benar, zona `Asia/Jakarta` (container juga di-set `TZ=Asia/Jakarta`) |
| Jaringan | Dapat menjangkau MySQL CORE & MySQL BIRU |
| Port | Satu port host untuk HTTP (default `2001` → `8080` di container) |

### 1.2 Mesin build / CI

| Kebutuhan | Keterangan |
|-----------|------------|
| JDK 17 + Maven wrapper | Untuk `./mvnw clean package` |
| Alternatif | Build lewat container Maven, atau ambil artifact dari CI |

### 1.3 Akses database dari dalam container

Ini penyebab error paling sering. Di dalam container, `localhost` berarti **container itu sendiri**,
bukan server.

| Lokasi MySQL | Host pada `jdbc-url` |
|--------------|----------------------|
| Di server yang sama (native) | `host.docker.internal` (sudah dipetakan lewat `extra_hosts` pada compose) |
| Di server lain | IP / hostname server tersebut |
| Di container lain | Nama service container-nya, dan keduanya satu Docker network |

Bila memakai `host.docker.internal`, MySQL di host harus:

- `bind-address = 0.0.0.0` (bukan `127.0.0.1`) di `my.cnf`, lalu restart MySQL;
- punya user yang boleh login dari subnet Docker (`172.16.0.0/12`).

### 1.4 User database

```sql
-- MySQL CORE (5.5) — read-only: pagar teknis atas aturan "BIRU tidak pernah menulis ke CORE"
CREATE USER 'biru_ro'@'%' IDENTIFIED BY 'password_kuat';
GRANT SELECT ON bank_core.* TO 'biru_ro'@'%';
FLUSH PRIVILEGES;

-- MySQL BIRU (8)
CREATE USER 'biru'@'%' IDENTIFIED BY 'password_kuat';
GRANT SELECT, INSERT, UPDATE, DELETE ON dbbiru.* TO 'biru'@'%';
FLUSH PRIVILEGES;
```

Ganti `'%'` dengan subnet Docker (`'172.%'`) bila kebijakan bank melarang wildcard penuh.

---

## 2. Arsitektur Deployment

### 2.1 Struktur folder di server

```
/opt/biru/                      ← root deployment (boleh path lain, mis. /home/BIRUDevLuna)
├── docker-compose.yml
├── Dockerfile
├── .env                        ← opsional: BIRU_HTTP_PORT, JAVA_OPTS
├── app/
│   └── app.jar                 ← JAR aplikasi (nama file HARUS app.jar)
├── config/
│   ├── application.properties.example   ← template dari repo
│   └── application.properties           ← konfigurasi aktif (chmod 600)
└── logs/                       ← output log (dibuat otomatis)
```

### 2.2 Volume & port

| Host | Container | Mode | Keterangan |
|------|-----------|------|------------|
| `./app` | `/app/bin` | ro | Di-mount sebagai **direktori**, bukan file — mengganti `app.jar` dengan `scp`/`mv` memberi inode baru, dan bind mount pada *file* akan tetap menyajikan inode lama |
| `./config` | `/config` | ro | Satu-satunya sumber konfigurasi |
| `./logs` | `/app/logs` | rw | Berkas log per ETL |
| Port `${BIRU_HTTP_PORT:-2001}` | `8080` | | HTTP aplikasi |

Container berjalan `restart: unless-stopped` dengan healthcheck ke `/actuator/health`
(interval 30 s, `start_period` 90 s), profil Spring `prod`, dan
`SPRING_CONFIG_LOCATION=file:/config/application.properties`.

> Profil `prod` mematikan pencatatan debug startup yang menampilkan kredensial datasource.

### 2.3 Posisi reverse proxy

```
Browser ──HTTPS──► nginx ──HTTP──► container biru:8080
Prometheus/cron ──(X-API-Key)──► nginx ──► container
```

⚠️ **nginx (dan proxy pengembangan) tidak boleh menempelkan `X-API-Key` ke trafik browser.** Bila
masih ada `proxy_set_header X-API-Key`, setiap pengunjung terautentikasi sebagai `SYSTEM` sebelum
aplikasi web dimuat: halaman login tidak menahan apa pun, seluruh pemeriksaan peran menjadi tidak
berarti, pembatasan kantor tidak berlaku, dan `audit_log` mencatat "SYSTEM" alih-alih nama orangnya.
**Ini hal terpenting yang tidak boleh diperkenalkan kembali.**

---

## 3. Prasyarat Database — WAJIB sebelum start

Aplikasi berjalan `spring.jpa.hibernate.ddl-auto=none`: **tidak ada tabel yang dibuat otomatis**.
Empat hal berikut harus beres sebelum container dinyalakan — kalau tidak, aplikasi gagal start, ETL
diam tanpa data, atau tidak ada seorang pun yang bisa login.

> **Baca bagian *Deployment notes* pada `CHANGELOG.md` repo sebelum instalasi.** Di sana tercatat
> patch DDL & data per generasi core bank.

### 3.1 Patch CORE sesuai generasi core bank

Setiap BPR bisa berbeda versi core. Kolom yang dibaca ETL sengaja sedikit, tetapi beberapa lebih baru
daripada core lama.

- **Kolom yang mungkin belum ada** (IBS Generasi 1): `jam_trans` pada
  `tabtrans`/`deptrans`/`kretrans`, dan `kuitansi_id` pada `deptrans`/`kretrans`.
  ⚠️ `ALTER` pada `tabtrans` berisi jutaan baris di MySQL 5.5 = *table rebuild* → lock lama;
  **jadwalkan di luar jam operasional**.
- **Baris sentinel ber-id ekstrem (mis. `999999999`)** — satu baris saja membuat ETL kantor itu
  berhenti permanen (cursor melompat ke id terbesar). **Wajib dicek dan dihapus** sebelum ETL pertama.
- **Sebaran `nasabah.jenis_kelamin`** (`SELECT jenis_kelamin, COUNT(*) FROM nasabah GROUP BY 1`).
  Nilai selain `L`/`P` dinormalisasi menjadi NULL oleh aplikasi — **jangan** meng-`UPDATE` tabel CORE.

```sql
-- cek kolom wajib
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN ('tabtrans','deptrans','kretrans')
  AND column_name IN ('jam_trans','kuitansi_id','my_kode_trans','kode_trans')
ORDER BY table_name, column_name;
```

### 3.2 Sumber bunga akrual sesuai `core.flavour` *(memblokir startup)*

Aplikasi memeriksanya saat startup dan **menolak jalan** bila tabel/kolomnya tidak ada — supaya
flavour yang salah tidak berujung pada kolom `interest_accrue` yang diam-diam kosong.

```sql
-- bila core.flavour=IBS_GEN1
SHOW COLUMNS FROM kretrans LIKE 'bunga%';   -- harus ada bunga DAN bunga_yad

-- bila core.flavour=IBS_GEN2
SHOW COLUMNS FROM ph_kredit_pyad;           -- harus ada no_rekening, tgl_trans,
                                            -- my_kode_trans, bunga
```

Kalau ragu core ini generasi berapa: jalankan keduanya — yang berhasil itulah flavour-nya.

### 3.3 Tabel kode jenis penggunaan & group1

Query nominatif KRD membaca deskripsi jenis pinjaman lewat `LEFT JOIN` ke tabel kode. Join-nya tahan
terhadap **baris** yang tidak ada, tetapi **tidak** terhadap **tabel/kolom** yang tidak ada — itu
menggagalkan seluruh query, untuk semua kantor.

```sql
SHOW COLUMNS FROM kredit LIKE 'BI_JENIS_PENGGUNAAN';
SHOW COLUMNS FROM kre_kode_jenis_penggunaan;
SHOW COLUMNS FROM kredit LIKE 'kode_group1';
SHOW COLUMNS FROM kre_kode_group1;
```

Kode yang dipakai di `kredit` tetapi tidak terdaftar di tabel kode menghasilkan `loan_type` NULL —
sebaiknya didaftarkan sebelum go-live.

### 3.4 Skema BIRU + unique index *(memblokir startup)*

Aplikasi **menolak start** bila unique index untuk `INSERT IGNORE` tidak ada — tanpa index itu,
proteksi duplikat diam-diam mati dan data transaksi menjadi dobel.

| Tabel | Unique index wajib | Kolom |
|-------|--------------------|-------|
| `t_transaction_tab` | `uq_source_tabtrans` | `source_tabtrans_id`, `branch_code` |
| `t_transaction_dep` | `uq_source_deptrans` | `source_deptrans_id`, `branch_code` |
| `t_transaction_krd` | `uq_source_kretrans` | `source_kretrans_id`, `branch_code` |

```sql
-- verifikasi: harus keluar 3 baris
SELECT table_name, index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS cols
FROM information_schema.statistics
WHERE table_schema = 'dbbiru'
  AND index_name IN ('uq_source_tabtrans','uq_source_deptrans','uq_source_kretrans')
GROUP BY table_name, index_name;

-- bila kurang (contoh TAB)
ALTER TABLE t_transaction_tab
  ADD UNIQUE KEY uq_source_tabtrans (source_tabtrans_id, branch_code);
```

Tabel BIRU lain yang harus ada: `m_cif`, `saving_nominatif`, `deposit_nominatif`, `loan_nominatif`,
`etl_watermark`.

Patch kolom yang wajib dijalankan di DB BIRU:

```sql
-- Kolom jadwal angsuran + billed/unbilled di loan_nominatif. Tanpa ini, setiap run
-- KRD nominatif gagal dengan "Unknown column 'first_installment_date' in 'field list'".
ALTER TABLE dbbiru.loan_nominatif
  ADD COLUMN loan_type              varchar(100)  NULL AFTER product_code,
  ADD COLUMN installment_type       varchar(20)   NULL AFTER loan_type,
  ADD COLUMN rm_name                varchar(100)  NULL AFTER installment_type,
  ADD COLUMN amount_transferred     decimal(18,2) NULL AFTER loan_amount,
  ADD COLUMN available_drawdown     decimal(18,2) NULL AFTER outstanding_balance,
  ADD COLUMN interest_accrue        decimal(18,2) NULL AFTER overdue_interest,
  ADD COLUMN start_date             date          NULL AFTER tenor,
  ADD COLUMN maturity_date          date          NULL AFTER start_date,
  ADD COLUMN first_installment_date date          NULL AFTER maturity_date,
  ADD COLUMN last_installment_date  date          NULL AFTER first_installment_date,
  ADD COLUMN installment_amount     decimal(18,2) NULL AFTER last_installment_date,
  ADD COLUMN principal_billed       decimal(18,2) NULL AFTER installment_amount,
  ADD COLUMN interest_billed        decimal(18,2) NULL AFTER principal_billed,
  ADD COLUMN tenor_billed           int           NULL AFTER interest_billed,
  ADD COLUMN tenor_unbilled         int           NULL AFTER tenor_billed,
  ADD COLUMN tenor_overdue          int           NULL AFTER overdue_days;

-- Rename dua kolom yang isinya angka "unbilled" tetapi namanya "due" (nilai lama tetap).
ALTER TABLE dbbiru.loan_nominatif
  CHANGE COLUMN principal_due principal_unbilled decimal(18,2) NULL,
  CHANGE COLUMN interest_due  interest_unbilled  decimal(18,2) NULL;

-- Lebar kolom NIK: data BPR sering melebihi default.
ALTER TABLE dbbiru.m_cif
  MODIFY COLUMN id_card_number varchar(50) DEFAULT NULL
  COMMENT 'NIK KTP - nasabah.no_id' AFTER full_name;
```

```sql
-- cek kolom loan_nominatif: harus keluar 18 baris
SELECT column_name, column_type
FROM information_schema.columns
WHERE table_schema = 'dbbiru' AND table_name = 'loan_nominatif'
  AND column_name IN ('loan_type','installment_type','rm_name',
                      'amount_transferred','available_drawdown','interest_accrue',
                      'start_date','maturity_date','first_installment_date',
                      'last_installment_date','installment_amount','principal_billed',
                      'interest_billed','tenor_billed','tenor_unbilled','tenor_overdue',
                      'principal_unbilled','interest_unbilled');
```

Kalau masih muncul `principal_due`/`interest_due`, rename-nya belum dijalankan.

### 3.5 Seed `etl_watermark` — daftar kantor + titik mulai

**`etl_watermark` adalah sumber daftar cabang.** Bila kosong, semua ETL berjalan tanpa error tetapi
**tidak memproses apa pun**. Isinya satu baris per kombinasi `(etl_name, branch_code)` untuk 7 ETL:

```
TAB_TRANSACTION    DEP_TRANSACTION    KRD_TRANSACTION
SAVING_NOMINATIF   DEPOSIT_NOMINATIF  LOAN_NOMINATIF
CIF_SYNC
```

```sql
INSERT INTO etl_watermark (etl_name, branch_code, last_trx_time, last_trx_id)
SELECT e.etl_name, k.branch_code, '2026-07-01 00:00:00', NULL
FROM (
      SELECT 'TAB_TRANSACTION'   AS etl_name
      UNION ALL SELECT 'DEP_TRANSACTION'
      UNION ALL SELECT 'KRD_TRANSACTION'
      UNION ALL SELECT 'SAVING_NOMINATIF'
      UNION ALL SELECT 'DEPOSIT_NOMINATIF'
      UNION ALL SELECT 'LOAN_NOMINATIF'
      UNION ALL SELECT 'CIF_SYNC'
     ) e
CROSS JOIN (
      SELECT '001' AS branch_code
      UNION ALL SELECT '002'
      -- tambahkan semua kode kantor BPR di sini
     ) k;
```

Aturan cutoff:

- `last_trx_time` = tanggal mulai replikasi, `last_trx_id` = NULL → aplikasi otomatis mencari batas
  id yang setara pada run pertama (log: `🔰 <ETL> kantor=… seeding cursor from last_trx_time=…`).
- **Jangan biarkan keduanya NULL.** Itu berarti mulai dari id 0 = **replay seluruh sejarah** (bisa
  belasan tahun data); aplikasi hanya memberi peringatan.
- `last_trx_time` `NOT NULL`, jadi harus selalu diisi.
- Data historis dimuat terpisah lewat endpoint backfill, yang tidak menyentuh watermark.

### 3.6 Tabel login & audit *(memblokir startup)*

**Aplikasi menolak start bila salah satu tabelnya belum ada** — tanpa penolakan itu aplikasi tetap
hidup dan tampak sehat, tetapi tidak ada seorang pun yang bisa masuk, dan itu baru ditemukan oleh
pengguna.

Jalankan di **database BIRU**, bukan CORE. Salinan resminya ada di repo:
`src/main/resources/db/auth_schema.sql` — berkas itulah yang dijalankan pengujian integrasi terhadap
MySQL 8 sungguhan, jadi bila berbeda dengan kutipan di dokumen ini, **percayai berkasnya**.

```sql
CREATE TABLE app_user (
  id                   BINARY(16)   NOT NULL,
  username             VARCHAR(64)  NOT NULL,
  password_hash        VARCHAR(72)  NOT NULL COMMENT 'BCrypt',
  full_name            VARCHAR(128) NOT NULL,
  role                 VARCHAR(16)  NOT NULL COMMENT 'VIEWER | OPS | ADMIN',
  branch_code          VARCHAR(8)   NULL     COMMENT 'NULL = semua kantor',
  is_active            TINYINT(1)   NOT NULL DEFAULT 1,
  must_change_password TINYINT(1)   NOT NULL DEFAULT 1,
  failed_attempts      INT          NOT NULL DEFAULT 0,
  locked_until         DATETIME     NULL,
  last_login_at        DATETIME     NULL,
  created_at           DATETIME     NOT NULL,
  updated_at           DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_app_user_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE app_session (
  token_hash   BINARY(32)   NOT NULL COMMENT 'SHA-256 dari token cookie',
  user_id      BINARY(16)   NOT NULL,
  issued_at    DATETIME     NOT NULL,
  expires_at   DATETIME     NOT NULL,
  last_seen_at DATETIME     NOT NULL,
  revoked_at   DATETIME     NULL,
  ip           VARCHAR(45)  NULL,
  user_agent   VARCHAR(255) NULL,
  PRIMARY KEY (token_hash),
  KEY idx_session_user (user_id),
  KEY idx_session_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_log (
  id        BIGINT       NOT NULL AUTO_INCREMENT,
  at        DATETIME(3)  NOT NULL,
  user_id   BINARY(16)   NULL,
  username  VARCHAR(64)  NOT NULL COMMENT 'Salinan, sengaja tanpa FK',
  action    VARCHAR(32)  NOT NULL COMMENT 'LOGIN_OK|LOGIN_FAIL|LOGOUT|PASSWORD_CHANGED|QUERY|ETL_TRIGGER',
  target    VARCHAR(160) NULL,
  params    VARCHAR(2000) NULL COMMENT 'Query string mentah, bukan JSON',
  row_count INT          NULL,
  status    VARCHAR(16)  NULL,
  ip        VARCHAR(45)  NULL,
  PRIMARY KEY (id),
  KEY idx_audit_at (at),
  KEY idx_audit_user_at (username, at),
  KEY idx_audit_action_at (action, at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

```sql
-- verifikasi: harus keluar 3 baris
SELECT table_name FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_name IN ('app_user','app_session','audit_log');
```

---

## 4. Build JAR

Semua opsi menghasilkan berkas yang sama: `target/BIRU.jar`.

**4a. Mesin dev punya JDK 17**

```bash
cd /path/ke/BIRU
git pull
./mvnw test                      # wajib untuk rilis production
./mvnw clean package -DskipTests
ls -lh target/BIRU.jar
```

**4b. Tanpa Java/Maven — build lewat Docker**

```bash
docker run --rm -v "$PWD":/src -w /src \
  maven:3.9-eclipse-temurin-17 \
  mvn -B --no-transfer-progress clean package -DskipTests
sudo chown $USER target/BIRU.jar     # owner bisa jadi root
```

**4c. Ambil artifact dari CI** *(paling aman untuk production — JAR berasal dari commit yang
test-nya hijau, bukan dari working directory seseorang)*

```bash
gh run list --workflow=ci.yml --limit 5
gh run download <run-id> -n BIRU-jar -D ./dist
```

> Catat commit hash yang dirilis: `git rev-parse --short HEAD`.

---

## 5. Menyiapkan Server (instalasi pertama)

Di **mesin dev**:

```bash
ssh user@server-bpr "mkdir -p /opt/biru/{app,config,logs}"

# infrastruktur (sekali saja)
scp Dockerfile                             user@server-bpr:/opt/biru/
scp docker-compose.yml                     user@server-bpr:/opt/biru/
scp config/application.properties.example  user@server-bpr:/opt/biru/config/

# JAR
scp target/BIRU.jar                        user@server-bpr:/opt/biru/app/app.jar
```

Di **server**:

```bash
cd /opt/biru
cp config/application.properties.example config/application.properties
chmod 600 config/application.properties
openssl rand -hex 32              # untuk app.api-key
nano config/application.properties
```

> **Nama berkas JAR di server harus persis `app/app.jar`.** Container menjalankan
> `/app/bin/app.jar` dari folder `./app` yang di-mount. Bila folder `app/` kosong atau namanya
> berbeda, container exit dengan `Unable to access jarfile`.

---

## 6. Konfigurasi (`config/application.properties`)

Berkas ini adalah **satu-satunya sumber konfigurasi** — JAR sengaja tidak membawa
`application.properties` di dalamnya, dan compose menyetel
`SPRING_CONFIG_LOCATION=file:/config/application.properties`. Bila berkas hilang atau salah path,
aplikasi gagal start dengan `Config data resource … does not exist` — disengaja, supaya tidak
diam-diam jalan dengan konfigurasi default.

### 6.1 Yang wajib diganti

```properties
# --- BIRU (MySQL 8, read/write) ---
spring.datasource.hikari.jdbc-url=jdbc:mysql://host.docker.internal:3308/dbbiru?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Jakarta&characterEncoding=UTF-8
spring.datasource.hikari.username=biru
spring.datasource.hikari.password=<password>

# --- CORE (MySQL 5.5, read-only) ---
core.datasource.hikari.jdbc-url=jdbc:mysql://host.docker.internal:3306/bank_core?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Jakarta&characterEncoding=UTF-8
core.datasource.hikari.username=biru_ro
core.datasource.hikari.password=<password>
core.datasource.hikari.read-only=true

# --- Generasi core bank: WAJIB, tidak ada default ---
core.flavour=IBS_GEN1

# --- API key untuk pemanggil MESIN saja (openssl rand -hex 32) ---
app.api-key=<key_hasil_generate>

# --- Admin pertama: hanya dipakai bila app_user masih kosong ---
app.auth.bootstrap-username=admin
app.auth.bootstrap-password=<password_sementara_min_12_karakter>
```

| Properti | Nilai | Catatan |
|----------|-------|---------|
| `core.flavour` | `IBS_GEN1` butuh kolom `kretrans.bunga_yad` · `IBS_GEN2` butuh tabel `ph_kredit_pyad` | **Wajib, tanpa default.** Salah nilai = angka bunga salah, jadi bukan sesuatu yang boleh ditebak. Aplikasi menolak start bila kosong maupun bila sumbernya tidak terbaca |
| `app.api-key` | `openssl rand -hex 32` | **Bukan lagi kredensial browser.** Khusus pemanggil non-browser |
| `app.auth.cookie-secure` | default `true` | Cookie hanya dikirim lewat HTTPS. Tanpa TLS gejalanya khas: **login tampak berhasil lalu langsung logout**. Menyetel `false` (uji coba LAN saja) membuat password & cookie terbaca siapa pun di jaringan yang sama; aplikasi mencatat WARN saat boot |
| `springdoc.*.enabled` | `false` di template | Swagger `/docs` & `/v3/api-docs` disajikan tanpa API key — biarkan mati di production |
| `scheduler.*-enabled` | semua `false` di template | Nyalakan setelah verifikasi (§9) supaya boot pertama tidak langsung menarik data |

### 6.2 Parameter JDBC

| Parameter | Alasan |
|-----------|--------|
| `useSSL=false&allowPublicKeyRetrieval=true` | Connector/J 8 menghadapi MySQL 5.5 lama |
| `serverTimezone=Asia/Jakarta` | Mencegah pergeseran jam pada `transaction_time` |
| `characterEncoding=UTF-8` | Nama nasabah & keterangan transaksi |

Nilai port `3306`/`3308` hanya contoh — samakan dengan port MySQL di server.

### 6.3 Properti dengan default yang wajar

| Properti | Default | Arti |
|----------|---------|------|
| `scheduler.biru-{tab,dep,krd}-transaction-interval` | `30m` | Interval ETL transaksi |
| `scheduler.biru-{tab,dep,krd}-nominatif-interval` | `6h` | Interval snapshot |
| `scheduler.biru-cif-sync-interval` | `6h` | Interval sinkronisasi CIF |
| `scheduler.biru-etl-parallel-threads` | `4` | Jumlah kantor diproses serentak |
| `scheduler.biru-etl-batch-size` | `2000` | Baris per batch |
| `scheduler.biru-etl-max-drain-batches` | `50` | Batas batch berurutan per kantor per run |
| `scheduler.biru-etl-max-retries` / `retry-backoff-ms` | `2` / `1000` | Retry per kantor + backoff eksponensial |
| `scheduler.biru-watermark-lag-refresh-ms` | `30000` | Frekuensi hitung ulang gauge keterlambatan |
| `app.auth.session-ttl` / `idle-timeout` | `12h` / `60m` | Umur absolut sesi & batas diam |
| `app.auth.max-failed-attempts` / `lockout-duration` | `5` / `15m` | Penguncian sementara (0 = mati) |
| `app.auth.min-password-length` | `12` | Panjang minimum password |
| `app.auth.audit-queries` | `true` | **Ini yang membuat export tercatat.** Mematikannya melepas alasan utama login ada |
| `app.auth.audit-retention` | `400d` | Retensi jejak audit |

### 6.4 Port HTTP & memori JVM

Tanpa mengedit compose — buat `.env` di sebelah `docker-compose.yml`:

```bash
BIRU_HTTP_PORT=2001
JAVA_OPTS=-Xms256m -Xmx1g
```

---

## 7. Menjalankan

```bash
cd /opt/biru
docker compose build      # ±1 menit: hanya pull base JRE + install curl
docker compose up -d
docker compose ps
docker compose logs -f
```

`build` **tidak menjalankan Maven** — image hanya berisi JRE, dan JAR masuk lewat volume. Jadi build
di server aman, cepat, dan tidak butuh source code.

Log boot yang sehat:

```
✅ core flavour check | IBS_GEN1 | interest-accrue source reachable
✅ schema check | auth tables present: [app_user, app_session, audit_log]
✅ schema check | unique index uq_source_tabtrans present on t_transaction_tab
✅ schema check | unique index uq_source_deptrans present on t_transaction_dep
✅ schema check | unique index uq_source_kretrans present on t_transaction_krd
Started BIRUApplication in ... seconds
```

Setiap penolakan startup menyebut prasyarat yang kurang — kembalikan ke §3 yang sesuai.

---

## 8. Verifikasi Pasca-Deploy

```bash
KEY=<api_key>
BASE=http://localhost:2001
```

**1. Health**

```bash
curl -s $BASE/actuator/health
# {"status":"UP"}
```

`DOWN` biasanya berarti salah satu datasource tidak dapat dihubungi.

**2. Status watermark — pastikan daftar kantor terbaca**

```bash
curl -s -H "X-API-Key: $KEY" $BASE/etl/status | head -40
```

Harus memuat seluruh kombinasi ETL × kantor hasil seeding. Kosong → `etl_watermark` belum di-seed.

**3. Backfill satu hari yang datanya sudah diketahui**

```bash
curl -s -X POST -H "X-API-Key: $KEY" \
  "$BASE/etl/biru-tab-transactions/backfill?date=2026-07-15"
```

Endpoint backfill tersedia per domain:

```
POST /etl/biru-tab-transactions/backfill?date=yyyy-MM-dd
POST /etl/biru-dep-transactions/backfill?date=yyyy-MM-dd
POST /etl/biru-krd-transactions/backfill?date=yyyy-MM-dd
POST /etl/biru-tab-nominatif/backfill?date=yyyy-MM-dd
POST /etl/biru-dep-nominatif/backfill?date=yyyy-MM-dd
POST /etl/biru-krd-nominatif/backfill?date=yyyy-MM-dd
```

Pemicu inkremental memakai path yang sama **tanpa** `/backfill`.

**4. Rekonsiliasi jumlah baris CORE ↔ BIRU**

```bash
curl -s -H "X-API-Key: $KEY" "$BASE/etl/reconcile?date=2026-07-15&domain=TAB"
```

`coreCount` dan `biruCount` harus sama (`status: MATCH`). Bila BIRU lebih sedikit, periksa log kantor
yang gagal.

**5. Pemicu inkremental sekali secara manual**

```bash
curl -s -X POST -H "X-API-Key: $KEY" $BASE/etl/biru-tab-transactions
docker compose logs --tail=100 | grep TAB
```

Lalu `/etl/status` lagi — `lastTrxId` per kantor harus naik.

**6. Metrik**

```bash
curl -s -H "X-API-Key: $KEY" $BASE/actuator/prometheus | grep watermark_lag
```

`biru_etl_watermark_lag_seconds` harus **turun** setelah ETL jalan, bukan naik terus.

**7. Login & peran** (wajib sebelum diserahkan ke BPR)

```bash
# login sebagai admin bootstrap
curl -i -c c.txt -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<password_bootstrap>"}'
# respons memuat mustChangePassword: true → ganti password
curl -b c.txt -X POST $BASE/auth/change-password \
  -H 'Content-Type: application/json' -H 'X-BIRU-Client: web' \
  -d '{"oldPassword":"<lama>","newPassword":"<baru_min_12>"}'
```

Setelah itu **hapus baris `app.auth.bootstrap-password`** dari konfigurasi.

---

## 9. Menyalakan Scheduler

Setelah verifikasi lolos, nyalakan **bertahap** — jangan tujuh-tujuhnya sekaligus, supaya bila ada
masalah mudah dilacak domain/kantor mana.

```bash
nano config/application.properties
# scheduler.biru-tab-transaction-enabled=true   ← mulai dari satu domain
docker compose restart
docker compose logs -f
```

Interval dibaca **saat startup** — setiap perubahan `scheduler.*` memerlukan
`docker compose restart`. Nilai `enabled=false` membuat cron menjadi `"-"` (tidak pernah memicu),
tetapi endpoint manual tetap dapat dipanggil.

Urutan yang disarankan: `TAB_TRANSACTION` → pantau 1 siklus → `DEP` / `KRD` → `CIF_SYNC` → tiga
nominatif.

---

## 10. Manajemen Pengguna

### 10.1 Admin pertama

Telur-dan-ayam: aplikasi butuh akun agar bisa dipakai, dan akun dibuat dari dalam aplikasi. Karena
itu satu admin dibuat **hanya bila `app_user` masih kosong**:

```properties
app.auth.bootstrap-username=admin
app.auth.bootstrap-password=GANTI_DENGAN_PASSWORD_SEMENTARA_MIN_12_KARAKTER
```

- **Bila `app_user` sudah berisi, kedua properti ini diabaikan sepenuhnya.** Mengubahnya tidak dapat
  dipakai menyuntikkan admin baru ke instalasi yang sudah jalan — dan di server BPR,
  `application.properties` tidak dijaga seketat database.
- **`app_user` kosong + password tidak diisi = aplikasi menolak start.** Aplikasi hidup tanpa satu
  pun akun tidak bisa dipakai siapa pun; lebih baik gagal di depan orang yang sedang memasang.
- Admin itu dibuat dengan status wajib ganti password. **Setelah ganti password, hapus baris
  `app.auth.bootstrap-password` dari konfigurasi.**

### 10.2 Menambah pengguna berikutnya — lewat aplikasi

**Tidak perlu SQL.** Login sebagai ADMIN → menu **Administrasi › Pengguna**: membuat akun, mengubah
peran & kantor, membuka akun terkunci, mereset password, dan menonaktifkan.

- **Satu akun per orang.** Akun yang dipakai bertiga membuat `audit_log` tidak bisa menjawab siapa
  yang mengakses apa — dan itu satu-satunya alasan tabel itu ada.
- Password yang dibuat/direset admin **selalu wajib diganti** pemiliknya saat login, dan semua sesi
  orang itu langsung diakhiri.
- **Mengubah peran atau kantor seseorang mencabut sesinya.** Disengaja: cookie yang sudah ada masih
  membawa peran dan kantor lama sampai kedaluwarsa.
- Beberapa hal ditolak aplikasi, dan penolakannya benar: menonaktifkan/menurunkan **ADMIN aktif
  terakhir**, serta mengubah peran, menonaktifkan, atau memperluas kantor **akun sendiri**. Minta
  admin lain. Tanpa penjagaan itu, jalan keluar dari satu salah klik adalah `UPDATE` manual di
  database produksi.

| Peran | Boleh |
|-------|-------|
| `VIEWER` | Baca data nasabah (`/api/**`) + melihat kesegaran data (`GET /etl/status`) |
| `OPS` | VIEWER + menjalankan/backfill ETL + rekonsiliasi |
| `ADMIN` | OPS + metrik (`/actuator/**`) + administrasi pengguna & jejak audit |

### 10.3 Pembatasan per kantor (`branch_code`)

| `branch_code` | Artinya |
|---------------|---------|
| kosong (NULL) | Semua kantor. Untuk admin dan staf kantor pusat |
| terisi, mis. `0001` | **Hanya kantor itu.** Dipaksa server, tidak bisa dilewati dari URL |

- Mengubah `?branchCode=` di URL menghasilkan `403`, dan percobaannya tercatat di `audit_log`.
- Berlaku juga untuk `/etl/status` dan `/etl/reconcile`.
- Satu akun = satu kantor. Untuk kepala wilayah dengan beberapa cabang: satu akun per cabang, atau
  `branch_code` kosong (semua kantor). Dukungan multi-kantor belum ada.

### 10.4 Jejak audit

Menu **Administrasi › Jejak Audit** (ADMIN), dapat difilter per periode, aksi, dan username. Yang
tercatat: login berhasil/gagal, logout, ganti password, **setiap pembacaan data — termasuk setiap
halaman sebuah export** — dan setiap pemicuan ETL, masing-masing dengan filter yang dipakai, jumlah
baris, status HTTP, dan IP. Percobaan yang **ditolak** juga tercatat; biasanya itu yang paling dicari.

```sql
-- pantau ukuran pada BPR bervolume besar
SELECT COUNT(*) AS rows_now, MIN(at) AS oldest FROM audit_log;
```

Pembersihan otomatis mengikuti `app.auth.audit-retention` (default 400 hari).

---

## 11. Operasional Harian

```bash
# Status & resource
docker compose ps
docker stats biru --no-stream

# Log realtime (semua)
docker compose logs -f

# Log per ETL (berkas, dari host)
tail -f logs/tab-transaction-etl.log
tail -f logs/krd-nominatif-etl.log

# Restart (setelah ubah config atau ganti JAR)
docker compose restart

# Stop / start
docker compose down
docker compose up -d
```

Pemeriksaan rutin yang disarankan:

| Frekuensi | Yang diperiksa |
|-----------|----------------|
| Harian | `GET /etl/status` — `secondsSinceLastRun` masih dalam batas interval; container `healthy` |
| Harian | Snapshot nominatif tanggal sebelumnya sudah ada |
| Mingguan | `GET /etl/reconcile` untuk satu tanggal sampel per domain |
| Mingguan | Ukuran `logs/` dan `audit_log` |
| Bulanan | Backup config & DB BIRU teruji dapat dipulihkan |

### 11.1 Rotasi log

Log ditulis tanpa rolling — berkas `logs/*.log` **tumbuh terus**. Pasang logrotate di host:

```bash
cat >/etc/logrotate.d/biru <<'EOF'
/opt/biru/logs/*.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
    copytruncate
}
EOF
```

`copytruncate` dipakai karena aplikasi memegang file handle-nya (tidak ada sinyal reopen).

Batasi juga log stdout Docker bila perlu:

```yaml
    logging:
      driver: json-file
      options: { max-size: "50m", max-file: "5" }
```

### 11.2 Backup

| Objek | Alasan |
|-------|--------|
| `config/application.properties` | Berisi kredensial + API key. Backup terenkripsi, **jangan masuk git** |
| Database BIRU | Backup rutin. Data bisa dibangun ulang dari CORE lewat backfill, tetapi lama dan membebani core |
| `etl_watermark` | **Paling penting** — ini posisi cursor. Kehilangannya berarti seeding ulang |
| `app/app.jar.bak` | JAR versi sebelumnya, untuk rollback instan |

---

## 12. Update Versi Aplikasi

Cukup ganti JAR; image tidak perlu di-rebuild.

```bash
# 1. Build JAR baru di mesin dev / ambil dari CI (§4)
./mvnw clean package -DskipTests

# 2. Simpan versi lama untuk rollback, lalu upload
ssh user@server-bpr "cp /opt/biru/app/app.jar /opt/biru/app/app.jar.bak"
scp target/BIRU.jar user@server-bpr:/opt/biru/app/app.jar

# 3. Restart
ssh user@server-bpr "cd /opt/biru && docker compose restart && docker compose logs -f"
```

Yang perlu dicek pada setiap update:

- **Properti baru pada rilis:**
  `diff config/application.properties.example config/application.properties`
  (upload dulu template versi baru bila berubah).
- **Prasyarat DDL baru:** baca bagian **Deployment notes** pada `CHANGELOG.md` — beberapa rilis
  memerlukan `ALTER` di CORE atau BIRU lebih dulu.
- **`Dockerfile` / `docker-compose.yml` berubah?** Baru perlu upload ulang keduanya dan
  `docker compose up -d --build`. Untuk update JAR biasa, tidak perlu.

---

## 13. Rollback Plan

| Skenario | Tindakan |
|----------|----------|
| Aplikasi versi baru bermasalah | `cp app/app.jar.bak app/app.jar && docker compose restart` |
| Konfigurasi baru bermasalah | Pulihkan salinan `application.properties` sebelumnya, lalu restart |
| ETL menghasilkan data salah untuk satu tanggal | Hapus baris tanggal itu di tabel BIRU terkait, jalankan backfill tanggal tersebut kembali (operasi idempoten) |
| Cursor kantor melompat terlalu jauh | Setel ulang `etl_watermark.last_trx_id` kantor itu ke nilai yang benar, hapus baris `t_transaction_*` yang keliru, lalu jalankan ulang |
| Patch DDL BIRU perlu dibatalkan | Kolom tambahan bersifat NULL-able → dapat di-`DROP`; **rename `principal_due`/`interest_due` harus dibalik manual** bila kembali ke versi lama |

```bash
# rollback JAR
cd /opt/biru
cp app/app.jar.bak app/app.jar
docker compose restart
docker compose logs -f
```

> Rollback JAR **tidak** membatalkan patch DDL yang sudah dijalankan. Bila rilis baru menambah kolom,
> versi lama tetap dapat jalan (kolom tambahan diabaikan) — kecuali untuk kolom yang di-*rename*.

---

## 14. Troubleshooting

| Gejala | Penyebab & solusi |
|--------|-------------------|
| Container exit, `Unable to access jarfile /app/bin/app.jar` | Folder `app/` kosong atau nama berkas salah. Harus persis `app/app.jar` |
| Container exit, `Property 'core.flavour' is required` | Isi `core.flavour=IBS_GEN1` atau `IBS_GEN2` (§6.1) |
| Container exit, `core.flavour=… but its interest-accrue source is not readable on CORE` | Flavour salah, atau tabel/kolomnya belum ada (§3.2). Pesan errornya menyebut objek yang hilang |
| Container exit, `Missing required UNIQUE index(es)` | Unique index `uq_source_*` belum ada (§3.4). Sengaja fail-fast supaya data tidak dobel |
| Container exit, `Missing auth table(s) [...]` | `app_user`/`app_session`/`audit_log` belum dibuat (§3.6) |
| Container exit, `app_user is empty and app.auth.bootstrap-password is not set` | Instalasi baru tanpa admin pertama (§10.1) |
| `Config data resource … does not exist` | `config/application.properties` belum dibuat (yang ada baru berkas `.example`) |
| JAR sudah diganti tetapi aplikasi masih versi lama | Belum `docker compose restart` |
| `Communications link failure` / `Connection refused` | `jdbc-url` menunjuk `localhost` → ganti `host.docker.internal` atau IP server. Cek `bind-address` MySQL & firewall. Tes dari dalam container: `docker compose exec biru bash -c "</dev/tcp/host.docker.internal/3306 && echo OK"` |
| `Access denied for user` | Grant belum mengizinkan login dari subnet Docker (`172.x`). Buat user dengan host `'%'` atau `'172.%'` |
| `Public Key Retrieval is not allowed` | Tambahkan `allowPublicKeyRetrieval=true` pada `jdbc-url` |
| `Unknown column 'xxx' in 'field list'` | Kolom belum ada → jalankan `ALTER` (§3.1 untuk CORE, §3.4 untuk `loan_nominatif`) |
| Log ETL `⏭️ No new …` terus padahal ada transaksi baru | Cursor melompat karena baris sentinel ber-id ekstrem pernah ter-ingest. Hapus baris di CORE, setel ulang `last_trx_id` kantor itu, hapus baris `t_transaction_*` terkait |
| ETL menarik data bertahun-tahun / sangat lambat | `last_trx_time` **dan** `last_trx_id` sama-sama NULL saat seeding → replay dari id 0. Setel cutoff-nya (§3.5) |
| `/etl/status` kosong | `etl_watermark` belum di-seed — ini sumber daftar kantor, bukan sekadar cursor |
| `⚠️ CIF_SYNC dropped N unrecognised jenis_kelamin value(s)` | Core memakai kode gender lain (`M`/`F`, `1`/`2`). Bukan error fatal (menjadi NULL), tetapi laporkan ke tim dev agar pemetaannya diperluas — **jangan** `UPDATE` tabel CORE |
| **Login "berhasil" lalu langsung logout** | Gejala khas cookie `Secure` di atas HTTP polos: browser menerima respons login tetapi menolak menyimpan cookie-nya. Aktifkan TLS, atau `app.auth.cookie-secure=false` untuk uji coba LAN (password menjadi terbaca di jaringan) |
| Halaman login tidak pernah muncul, langsung masuk aplikasi | nginx masih menempelkan `proxy_set_header X-API-Key`. Setiap pengunjung terautentikasi sebagai `SYSTEM`. **Hapus baris itu** |
| `403 CSRF_HEADER_MISSING` | Request pengubah data tanpa header `X-BIRU-Client: web`. Biasanya berarti dipanggil dari `curl` tanpa header, atau ada proxy yang membuang header kustom |
| `403 BRANCH_FORBIDDEN` | Akun terikat satu kantor meminta kantor lain. Ini perilaku yang benar; ubah akunnya bila memang perlu akses lebih luas |
| `409 ETL already running` | Run sebelumnya belum selesai. Tunggu, atau periksa log kantor yang menggantung |
| Jejak audit kosong padahal ada aktivitas | Cek log untuk `‼️ audit_log write failed`; pastikan `app.auth.audit-queries=true` |
| Nominatif KRD gagal dengan `not functionally dependent` | Ada join tabel lookup pada query yang mengagregasi (`ONLY_FULL_GROUP_BY`). Ini bug aplikasi — laporkan ke tim dev, jangan melonggarkan `sql_mode` core |
| Angka baki debet/pencairan **berlipat** | Tabel kode memuat baris ganda untuk kode yang sama pada query yang mengagregasi. Tidak memunculkan error — periksa duplikasi baris tabel kode dan laporkan |

---

## 15. Checklist Go-Live

**Database (DBA)**

- [ ] Backup CORE & BIRU sudah diambil
- [ ] `ALTER` kolom CORE sesuai generasi core (`jam_trans`, `kuitansi_id`) — di luar jam kerja
- [ ] Baris sentinel ber-id ekstrem dicek & dihapus di `tabtrans`/`deptrans`/`kretrans`
- [ ] Skema BIRU lengkap: `t_transaction_tab/dep/krd`, `m_cif`, `*_nominatif`, `etl_watermark`
- [ ] 3 unique index `uq_source_*` terverifikasi ada
- [ ] `m_cif.id_card_number` sudah `varchar(50)`
- [ ] `loan_nominatif`: kolom baru ada, `principal_due`/`interest_due` sudah di-rename `*_unbilled`
- [ ] `etl_watermark` di-seed: 7 ETL × semua kantor, `last_trx_time` = tanggal cutoff
- [ ] Tabel login/audit dibuat: `app_user`, `app_session`, `audit_log`
- [ ] User DB: CORE `SELECT`-only, BIRU read/write, bisa login dari subnet Docker

**Build (Dev)**

- [ ] `./mvnw test` hijau untuk commit yang dirilis
- [ ] `target/BIRU.jar` dibuild dari commit itu; hash commit dicatat

**Server (Ops)**

- [ ] Docker + Compose v2 terpasang, jam host benar
- [ ] `Dockerfile`, `docker-compose.yml`, template config ter-upload
- [ ] `app/app.jar` ter-upload (nama berkas persis)
- [ ] `config/application.properties` diisi, `chmod 600`
- [ ] `core.flavour` sesuai generasi core, prasyarat tabel/kolomnya sudah dicek
- [ ] `app.api-key` diganti hasil `openssl rand -hex 32` (bukan default)
- [ ] `springdoc.*.enabled=false`
- [ ] Semua `scheduler.*-enabled=false` saat boot pertama

**Login & akses (Ops) — wajib sebelum diserahkan ke BPR**

- [ ] Login sebagai admin bootstrap berhasil, **password sudah diganti**
- [ ] `app.auth.bootstrap-password` **dihapus** dari konfigurasi sesudahnya
- [ ] TLS aktif di nginx dan `app.auth.cookie-secure=true`. Bila `false`, catat alasannya
- [ ] nginx **tidak** lagi punya `proxy_set_header X-API-Key`
- [ ] Akun per orang dibuat lewat **Administrasi › Pengguna** dengan peran yang tepat — tidak ada akun bersama
- [ ] `branch_code` diisi untuk staf cabang, dikosongkan untuk kantor pusat/admin
- [ ] `app.auth.audit-queries=true`
- [ ] Uji: login sebagai `VIEWER` → `POST /etl/*` ditolak
- [ ] Uji: login sebagai staf cabang, ubah `?branchCode=` ke kantor lain → `403`, dan percobaannya muncul di jejak audit
- [ ] Jejak audit terisi untuk aktivitas yang baru dilakukan

**Verifikasi & penyalaan**

- [ ] `docker compose build && up -d` sukses, health `UP`
- [ ] `/etl/status` menampilkan semua kantor
- [ ] Backfill 1 hari + `/etl/reconcile` cocok (`MATCH`)
- [ ] Scheduler dinyalakan bertahap; `lastTrxId` naik, gauge keterlambatan turun
- [ ] logrotate terpasang; backup config & `etl_watermark` terjadwal

---

## 16. Lampiran — Server Tanpa Internet

Server tetap membutuhkan base image `eclipse-temurin:17-jre-jammy` sekali. Bila tidak bisa pull:

```bash
# di mesin ber-internet — HARUS arsitektur amd64 seperti server
docker pull --platform linux/amd64 eclipse-temurin:17-jre-jammy
docker save eclipse-temurin:17-jre-jammy | gzip > temurin17-jre.tar.gz
scp temurin17-jre.tar.gz user@server-bpr:/opt/biru/

# di server
docker load < temurin17-jre.tar.gz
cd /opt/biru && docker compose build && docker compose up -d
```

`docker compose build` juga menjalankan `apt-get install curl`, yang butuh internet. Bila apt pun
diblokir: hapus blok `RUN apt-get …` dari `Dockerfile` (sisakan `mkdir -p /app/bin /app/logs /config`)
dan ganti healthcheck menjadi cek TCP tanpa dependensi:

```yaml
    healthcheck:
      test: ["CMD", "bash", "-c", "exec 3<>/dev/tcp/localhost/8080"]
```

Alternatif paling ringkas — kirim image jadi:

```bash
# mesin ber-internet (amd64)
docker compose build
docker save biru-etl:latest | gzip > biru-etl.tar.gz
scp biru-etl.tar.gz user@server-bpr:/opt/biru/

# server
docker load < biru-etl.tar.gz && docker compose up -d      # tidak perlu build
```

---

## 17. Kontak & Eskalasi

| Tingkat | Peran | Lingkup |
|---------|-------|---------|
| L1 | Ops TI BPR | Restart container, cek `/etl/status`, backfill tanggal tertinggal, rotasi log |
| L2 | DBA BPR / Tim IBS Core | Patch DDL, kinerja query CORE, hak akses database |
| L3 | Tim Developer USSI | Kegagalan startup yang tidak tercakup §14, ketidakcocokan angka, kebutuhan kolom/figur baru |

Yang perlu disertakan saat eskalasi:

1. Potongan log yang relevan (`docker compose logs --tail=200`, dan `logs/<etl>.log`).
2. Keluaran `GET /etl/status` serta `GET /etl/reconcile` untuk tanggal yang dipersoalkan.
3. Versi JAR / commit hash yang berjalan, dan nilai `core.flavour`.
4. Apakah prasyarat DDL rilis tersebut sudah dijalankan.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 30 Juli 2026 | | Dokumen dibuat |

---

*[← Kembali ke BIRU App](README.md)* · *[Daftar Produk](../../README.md)*

*Dikelola dengan **Analyst CLI**.*
