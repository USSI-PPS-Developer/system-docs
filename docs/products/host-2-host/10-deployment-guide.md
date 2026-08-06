# 🚀 Deployment Guide — Host 2 Host

> Panduan deployment & rilis untuk produk **Host 2 Host** (metode: Docker + Docker Compose).

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | Host 2 Host     |
| Jenis Dokumen     | Deployment Guide         |
| Versi             | 1.3.0               |
| Tanggal Dibuat    | 16 Juli 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Prasyarat (Prerequisites)

| Item | Versi / Detail |
|------|----------------|
| JDK (build) | Java 17 (Eclipse Temurin) — untuk `./mvnw clean install` |
| Docker Engine | ≥ 20.10 |
| Docker Compose | v2 (`docker compose`) atau v1 (`docker-compose`) |
| Database | MySQL — **dua database**: `dbcore` (primary/core) & `dbcore_sys` (sys/user) — nama generik, sesuaikan dengan nama database di lembaga masing-masing |
| Cache | Redis 6.2 (disediakan oleh compose sebagai service `redis`) |
| Artifact | `target/microservicecore.jar` (hasil build Maven) |
| Akses | Kredensial DB core & sys, akses jaringan ke MySQL, kredensial registry (bila push image), VPN ke server target |
| Konfigurasi rahasia | `application.properties` produksi (secret **tidak** di-commit ke repo) |

> **Catatan skema DB:** `spring.jpa.hibernate.ddl-auto=none` — skema **tidak** dibuat otomatis
> oleh Hibernate. Perubahan skema dikirim sebagai patch SQL manual di `database/patches/` dan
> **wajib** dijalankan sebelum men-deploy build yang cocok (lihat §5).

## 2. Arsitektur Deployment

Semua komponen berjalan sebagai container dalam satu Docker network (`app_net`). MySQL berada
di luar compose (managed/host DB core banking IBS).

```
[Client / Kanal]
      │  HTTPS
      ▼
[Reverse Proxy / TLS termination]         (server.forward-headers-strategy=framework → HSTS)
      │  HTTP (8080)
      ▼
┌───────────────── Docker network: app_net ─────────────────┐
│                                                            │
│   [microservicecore]  ──────►  [redis:6.2]  (redis_service)│
│    container: microservicecore                              │
│    port 8080:8080                                           │
│    volumes:                                                 │
│      ./logs                → /app/logs                      │
│      ./application.properties → /config/application.properties
│                                                            │
└──────────────┬──────────────────────────────┬─────────────┘
               │ JDBC (primary)                │ JDBC (sys)
               ▼                               ▼
        [MySQL: dbcore]                    [MySQL: dbcore_sys]
     (Core Banking IBS)                (user / sistem)
```

- **Dashboard monitoring** (`health-ui-mcs`) adalah aplikasi terpisah yang memanggil
  `/api/monitoring/**` dengan `X-MONITORING-KEY`. Deploy-nya di luar cakupan dokumen ini, tetapi
  **key-nya harus sama** dengan `monitoring.api-key` di sini. Di dashboard, key dibaca dari
  `window.__APP_CONFIG__.API_MONITORING_KEY` pada file `/config.js` yang **di-generate saat container
  start** dari environment variable `MONITORING_API_KEY` (entrypoint `docker/40-render-app-config.sh`,
  nilainya dari file `.env` di samping `docker-compose.yml` dashboard). Jadi: key tidak pernah masuk
  git maupun image, satu image dipakai semua environment, dan rotasi key = ubah kedua sisi lalu
  restart (tanpa rebuild dashboard). ⚠️ Karena dashboard adalah SPA browser, key ini **selalu**
  terbaca di DevTools — ia hanya menghilangkan akses anonim; pembatasan jaringan (VPN / IP allowlist /
  Cloudflare Access) tetap kontrol utamanya.
- **Key yang sama juga membuka detail health.** `/actuator/health` tetap bisa diakses anonim (probe
  LB/Kubernetes tidak boleh ditolak), tetapi blok `components` (db / redis / diskSpace) hanya muncul
  untuk pemanggil yang mengirim `X-MONITORING-KEY` valid — filter monitoring mengautentikasi request
  itu dengan role `MONITORING` sehingga `management.endpoint.health.show-details=when-authorized`
  membukanya. Kartu DB/Redis/Disk pada dashboard bergantung pada ini. Bila kartu-kartu itu `UNKNOWN`,
  perbaiki key-nya — **jangan** menyetel `show-details=always` (itu membuka internal ke publik).

## 3. Konfigurasi Environment

### 3.1 File `application.properties` (di-mount ke `/config/application.properties`)
Container dijalankan dengan `--spring.config.location=classpath:/,file:/config/application.properties`,
sehingga file eksternal menimpa nilai default. **Isi secret di sini, bukan di dalam image.**

> ℹ️ **Nama database.** `dbcore` / `dbcore_sys` pada tabel di bawah adalah **nama generik**; nama
> database sebenarnya berbeda di tiap lembaga. Sesuaikan pada kedua `jdbc-url` (dan pada perintah
> `mysql ... < patch.sql` di §5). Tidak ada nama database yang di-hardcode di dalam aplikasi.

| Grup | Kunci | Contoh | Keterangan |
|------|-------|--------|------------|
| DB Primary (`dbcore`) | `spring.datasource.jdbc-url` | `jdbc:mysql://<db-host>:3306/dbcore?connectionTimeZone=Asia/Jakarta` | Core banking IBS. `connectionTimeZone` wajib — lihat §3.3. |
| | `spring.datasource.username` / `password` | `***` | Kredensial DB core. |
| | `spring.datasource.driver-class-name` | `com.mysql.cj.jdbc.Driver` | |
| DB Sys (`dbcore_sys`) | `sys.datasource.jdbc-url` | `jdbc:mysql://<db-host>:3306/dbcore_sys?connectionTimeZone=Asia/Jakarta` | DB user/sistem. |
| | `sys.datasource.username` / `password` | `***` | Kredensial DB sys. |
| Redis | `spring.data.redis.host` | `redis` | **Nama service compose**, bukan `localhost`. |
| | `spring.data.redis.port` | `6379` | |
| Server | (port aplikasi) | `8080` | Dipetakan `8080:8080` oleh compose. |
| | `server.forward-headers-strategy` | `framework` | Agar HTTPS/HSTS dikenali di belakang proxy. |
| Monitoring | `monitoring.api-key` | `***` | **Wajib diisi** — bila kosong `/api/monitoring/**` ditolak (fail-closed). Harus sama dengan `API_MONITORING_KEY` di dashboard `health-ui-mcs`. |
| Rekap | `rekap.admin-user-ids` | `U001,U050` | Allowlist user_id HQ/admin. Kosong = semua akses rekap ditolak. |
| Isolasi | `isolation.hq-user-ids` | `U001` | Allowlist user_id yang bypass tenant isolation. Kosong = tidak ada HQ. |
| Tabungan | `tabung.minimum-editor-user-ids` | `U001,U050` | Allowlist user_id yang boleh mengubah saldo minimum (`POST /api/v1/tabungan/update-saldo-minimum`). **Kosong = semua ditolak** (fail-closed). Alur ini tanpa maker-checker, jadi allowlist ini + jejak audit `api_tab_minimum_change` adalah kontrolnya. |
| Timezone | `app.timezone` | `Asia/Jakarta` | Timezone default JVM (WIB). Menentukan tanggal transaksi. Zona tidak valid = aplikasi **gagal start**. Lihat §3.3. |
| | `spring.jackson.time-zone` | `Asia/Jakarta` | Serialisasi tanggal di response JSON. |
| | `spring.jpa.properties.hibernate.jdbc.time_zone` | `Asia/Jakarta` | Zona timestamp JDBC dari Hibernate. |
| Aktuator | `management.endpoints.web.exposure.include` | `health` | Hanya `health` yang diekspos. |
| | `management.endpoint.health.show-details` | `when-authorized` | Jangan set `always` pada probe publik. |
| | `management.endpoint.health.roles` | `MONITORING` | Role yang boleh melihat blok `components`. Diberikan oleh filter monitoring saat `X-MONITORING-KEY` valid — harus sinkron dengan authority `ROLE_MONITORING` di kode. |
| Log | `logging.file.name` | `logs/microservicecore.log` | Volume `./logs` di-mount ke `/app/logs`. |

> ⚠️ **Jangan commit kredensial asli.** Di dev, secret di-import dari `application-local.properties`
> via `spring.config.import`; di produksi, disuplai lewat file `application.properties` yang
> di-mount (tidak masuk image / VCS).

### 3.2 Environment variable container
| Variabel | Contoh | Keterangan |
|----------|--------|------------|
| `TZ` | `Asia/Jakarta` | Timezone container (disetel di compose). Jam log & OS. |

### 3.3 Timezone (WIB) — wajib seragam

Seluruh tanggal/jam bisnis (`tgl_trans`, `tgl_register`, `api_log.created_at`) dibentuk dari waktu
lokal JVM, **bukan** UTC. Kalau JVM berjalan di UTC, transaksi pukul 06:00 WIB tercatat pada
**tanggal sebelumnya** (H-1) dan jam di log/`api_log` tidak sama dengan jam MySQL.

Aplikasi menyetel sendiri timezone default JVM dari properti `app.timezone` pada saat startup
(sebelum koneksi DB dibuat), jadi tidak lagi bergantung pada `TZ` / `-Duser.timezone` yang mudah
terlupa. Nilai zona yang salah tulis membuat aplikasi **gagal start** — bukan diam-diam memakai GMT.

**Aturan:** empat nilai berikut harus memakai zona yang sama (`Asia/Jakarta`):

| Tempat | Nilai |
|--------|-------|
| `application.properties` | `app.timezone=Asia/Jakarta` |
| `application.properties` | `spring.jpa.properties.hibernate.jdbc.time_zone=Asia/Jakarta` |
| `jdbc-url` (primary **dan** sys) | `?connectionTimeZone=Asia/Jakarta` |
| compose | `TZ=Asia/Jakarta` (+ `-Duser.timezone=Asia/Jakarta` pada `command`) |

Bila salah satu berbeda → jam bergeser tepat 7 jam (konversi ganda) atau tanggal transaksi meleset.
Pastikan juga server MySQL berjalan di WIB: `SELECT NOW(), @@global.time_zone;`.
Verifikasi container: `docker compose exec app sh -c 'date'` → harus menunjukkan waktu WIB (+07).

## 4. Langkah Deployment

Ada dua metode yang didukung:

| Metode | Kapan dipakai | Yang dibutuhkan di server |
|--------|---------------|---------------------------|
| **A — build di server** (§4.1–§4.3) | Server punya JDK/Maven + source code (mis. staging internal) | JDK 17, Maven/wrapper, source, Docker |
| **B — build lokal, server run-only** (§4.4) | **Deploy produksi ke server BPR** (default) | Hanya Docker + Docker Compose |

> Panduan operasional lengkap untuk Metode B (langkah per langkah, isi file, rollback,
> troubleshooting) ada di **`DEPLOY.md`** pada repo `microservice-core`.

### 4.1 Build artifact
```bash
# 1. Ambil source terbaru
git pull origin main

# 2. Build jar (skip tests) — menghasilkan target/microservicecore.jar
make build
# setara: ./mvnw clean install -DskipTests

# (opsional) jalankan test offline dulu
make test
```

### 4.2 Siapkan konfigurasi & data
```bash
# 3. Siapkan application.properties produksi di direktori kerja (sejajar docker-compose.yml)
#    Isi kredensial DB (dbcore & dbcore_sys), redis.host=redis, monitoring.api-key,
#    rekap.admin-user-ids, isolation.hq-user-ids, tabung.minimum-editor-user-ids.
cp application.properties.example application.properties   # lalu edit
# Pastikan folder ./logs ada (akan di-mount ke /app/logs)
mkdir -p logs

# 4. Jalankan patch skema DB (WAJIB — ddl-auto=none) pada DB core/sys yang sesuai:
#    - patch_api_login_log_status_widen.sql  (WAJIB: kolom status VARCHAR(20))
#    - patch_dep_produk_is_custom_rate.sql   (WAJIB bila memakai deposito special rate: kolom is_custom_rate)
#    - patch_tab_campaign_saldo_minimum.sql  (WAJIB build 5 Agu 2026+: tabel api_tab_campaign & api_tab_minimum_change)
#    - patch_get_next_id_atomic.sql          (disarankan; perlu review IBS lebih dulu)
mysql -h <db-host> -u <user> -p dbcore < database/patches/patch_api_login_log_status_widen.sql
mysql -h <db-host> -u <user> -p dbcore < database/patches/patch_dep_produk_is_custom_rate.sql
mysql -h <db-host> -u <user> -p dbcore < database/patches/patch_tab_campaign_saldo_minimum.sql

# 4b. Isi minimal satu baris campaign bila fitur bebas saldo minimum dipakai (produk, kantor,
#     saldo_minimum, periode, no_memo persetujuan BPR). Tanpa campaign aktif, registrasi tabungan
#     tetap memakai default produk dan aksi CAMPAIGN ditolak ("Campaign tidak ditemukan").
#     Seeder siap pakai (produk 201-204, saldo_minimum 0, semua kantor, 2026-08-01 s/d 2026-09-30,
#     dibuat_oleh USSI / disetujui_oleh B Eko Prasetyo) — GANTI no_memo placeholder dengan nomor
#     memo/SK persetujuan BPR yang asli sebelum dijalankan. Idempotent, aman dijalankan ulang.
mysql -h <db-host> -u <user> -p dbcore < database/patches/seed_api_tab_campaign.sql
#     Contoh INSERT generik tersedia sebagai komentar di akhir file patch-nya.
#     Menghentikan campaign lebih awal: UPDATE api_tab_campaign SET is_active = 0 WHERE ... (jangan DELETE —
#     api_tab_minimum_change.kode_campaign merujuk baris ini).
```

### 4.3 Build image & start service
```bash
# 5. Build image + jalankan (app + redis) secara detached
docker compose up -d --build
#    - service redis (redis:6.2, container: redis_service)
#    - service microservicecore-app (container: microservicecore), port 8080:8080

# 6. Cek status & log
docker compose ps
docker compose logs -f microservicecore-app
```

> **Dockerfile** (ringkas): `FROM eclipse-temurin:17-jdk-alpine`, menyalin
> `target/microservicecore.jar` → `app.jar`, `ENTRYPOINT` menjalankan jar dengan
> `--spring.config.location=classpath:/,file:/config/application.properties`.
> Karena image menyalin jar dari `target/`, **build Maven (§4.1) harus dijalankan lebih dulu**
> sebelum `docker compose up --build`.

### 4.4 Metode B — build lokal, server run-only (produksi BPR)

Jar dibangun di mesin developer lalu dikirim ke server; server **tidak** melakukan build image
(tidak perlu JDK, Maven, source, maupun `docker compose build`). Container memakai image resmi
`eclipse-temurin:17-jre-alpine` dengan jar & konfigurasi **di-mount** dari host.

**Struktur direktori server** (contoh user `apih2h`):

```
/home/apih2h/
├── docker-compose.yml           # tanpa "build:" — hanya image + volumes
├── application.properties       # secret produksi (chmod 600) → /config/application.properties
├── app/
│   ├── app.jar                  # jar yang sedang berjalan
│   └── releases/app-<STAMP>.jar # arsip per rilis untuk rollback
└── logs/                        # → /app/logs
```

**Inti `docker-compose.yml` server:**

```yaml
services:
  redis:
    image: redis:6.2
    container_name: apih2h-redis
    networks: [app_net]
    restart: always
  app:
    image: eclipse-temurin:17-jre-alpine
    container_name: apih2h-app
    working_dir: /app
    environment: [TZ=Asia/Jakarta]
    command: ["java","-XX:MaxRAMPercentage=75.0","-jar","/app/app.jar",
              "--spring.config.location=classpath:/,file:/config/application.properties"]
    volumes:
      - ./app/app.jar:/app/app.jar:ro
      - ./application.properties:/config/application.properties:ro
      - ./logs:/app/logs
    ports: ["8080:8080"]
    depends_on: [redis]
    extra_hosts: ["host.docker.internal:host-gateway"]
    restart: always
    networks: [app_net]
networks:
  app_net: { driver: bridge }
```

**Alur rilis:**

```bash
# [LAPTOP]
make test && make build                       # → target/microservicecore.jar
STAMP=$(date +%Y%m%d-%H%M)
shasum -a 256 target/microservicecore.jar
scp target/microservicecore.jar apih2h@<ip-server>:/home/apih2h/app/releases/app-$STAMP.jar

# [SERVER]
cd /home/apih2h
sha256sum app/releases/app-$STAMP.jar          # cocokkan dengan checksum di laptop
# jalankan patch DB baru (bila ada) lebih dulu — lihat §4.2/§5
cp app/releases/app-$STAMP.jar app/app.jar
docker compose restart app                     # downtime ± 20–40 detik
curl -s http://localhost:8080/actuator/health
```

**Catatan penting:**
- Promosi jar memakai `cp`, **bukan symlink** — symlink pada bind mount tidak terbaca dari dalam container.
- `spring.data.redis.host` **wajib** `redis` (nama service compose), bukan `localhost`.
- `<db-host>` tidak boleh `localhost`/`127.0.0.1` (itu menunjuk ke dalam container) — pakai IP DB
  atau `host.docker.internal` (disediakan lewat `extra_hosts`).
- **Rollback** = kembalikan jar lama: `cp app/releases/app-<STAMP-LAMA>.jar app/app.jar && docker compose restart app`.
- Bila hanya konfigurasi yang berubah: edit `application.properties` → `docker compose restart app`.

## 5. Verifikasi Pasca-Deploy

- [ ] Container `microservicecore` & `redis_service` status `Up` (`docker compose ps`).
- [ ] Health check OK: `curl -s http://localhost:8080/actuator/health` → `{"status":"UP"}`.
- [ ] Root greeting: `curl -s http://localhost:8080/` → pesan "MicroService Core ... running 🚀".
- [ ] Swagger UI dapat diakses: `http://<host>:8080/swagger-ui.html`.
- [ ] Koneksi DB primary & sys OK (tidak ada error datasource di log; login mengembalikan token).
- [ ] Koneksi Redis OK (endpoint transaksional tidak balas `503`/`90`).
- [ ] Patch `patch_api_login_log_status_widen.sql` sudah diterapkan (login rate-limit tidak 500).
- [ ] Patch `patch_dep_produk_is_custom_rate.sql` sudah diterapkan (registrasi deposito special rate & `GET /deposito/produk-spesial-rate` tidak 500).
- [ ] Patch `patch_tab_campaign_saldo_minimum.sql` sudah diterapkan (`SHOW TABLES LIKE 'api_tab_%';` menampilkan `api_tab_campaign` & `api_tab_minimum_change`) dan — bila fitur dipakai — `api_tab_campaign` sudah berisi campaign aktif.
- [ ] Seeder `seed_api_tab_campaign.sql` sudah dijalankan bila campaign bebas saldo minimum dipakai — 4 baris `CMP-NOMIN-201-2026` … `CMP-NOMIN-204-2026` aktif hari ini (`SELECT kode_campaign, kode_produk, saldo_minimum, tgl_mulai, tgl_akhir, is_active FROM api_tab_campaign;`) dan `no_memo` sudah memakai nomor memo BPR yang asli (bukan placeholder).
- [ ] `tabung.minimum-editor-user-ids` terisi bila fitur update saldo minimum dipakai (kosong = endpoint selalu 403).
- [ ] `monitoring.api-key` terisi & cocok dengan dashboard `health-ui-mcs` — verifikasi dari sisi dashboard: `curl -s https://<host-dashboard>/config.js` menampilkan `API_MONITORING_KEY` yang sama (bukan kosong / bukan field yang hilang), dan `curl -s -H "X-MONITORING-KEY: <key>" https://<host-api>/api/monitoring/logs?page=0&size=1` mengembalikan 200.
- [ ] Timezone WIB (§3.3): `docker compose exec app sh -c 'date'` menunjukkan +07, timestamp di
      `logs/microservicecore.log` sesuai jam setempat, dan `api_log.created_at` untuk request uji
      sama dengan jam transaksi (tidak bergeser 7 jam / tidak jatuh ke H-1).
- [ ] Smoke test: `POST /api/v1/autentikasi/login` (dengan `X-CLIENT-ID`) → `00`, lalu satu
      inquiry saldo & satu transaksi tabungan kecil di kantor uji → `00`.

## 6. Rollback Plan

Bila deploy gagal atau ada regresi:

```bash
# 1. Kembalikan ke image/build versi sebelumnya
git checkout <tag-versi-sebelumnya>
make build
docker compose up -d --build

# atau, bila image lama masih ada, cukup jalankan ulang tanpa rebuild:
docker compose down
docker compose up -d
```

- **Konfigurasi:** `application.properties` di-mount dari host — simpan versi sebelumnya
  (mis. `application.properties.bak`) untuk dipulihkan cepat.
- **Database:** patch SQL bersifat forward-only pada skema bersama IBS. Rollback skema harus
  dikoordinasikan dengan tim IBS (siapkan skrip revert & backup sebelum menerapkan patch).
- **Redis:** aman dihentikan/di-restart — hanya menyimpan state idempotency/rate-limit
  sementara (TTL), bukan data transaksi.

## 7. Kontak & Eskalasi

| Peran | Nama | Kontak |
|-------|------|--------|
| DevOps / Deployer | | |
| DBA Core Banking (IBS) | | |
| Developer / Maintainer (USSI) | | |
| On-call | | |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 16 Juli 2026 | | Dokumen dibuat (metode Docker Compose + Dockerfile) |
| 1.1.0 | 16 Juli 2026 | | Tambah patch wajib `patch_dep_produk_is_custom_rate.sql` (deposito special rate) ke langkah patch DB & checklist. |
| 1.4.3 | 6 Agustus 2026 | | Detail health di-gate dengan key monitoring: `/actuator/health` tetap anonim-accessible (status saja) sementara blok `components` (db/redis/diskSpace) hanya untuk pemanggil ber-`X-MONITORING-KEY` (role `MONITORING`); properti baru `management.endpoint.health.roles=MONITORING` pada tabel konfigurasi + catatan §2 (kartu dashboard `UNKNOWN` = perbaiki key, bukan `show-details=always`). |
| 1.4.2 | 6 Agustus 2026 | | §2 diperjelas: `API_MONITORING_KEY` dashboard `health-ui-mcs` sekarang di-*generate* ke `/config.js` saat container start dari env `MONITORING_API_KEY` (bukan file yang di-commit) — key tidak masuk git/image, rotasi = restart tanpa rebuild; ditegaskan kembali bahwa key SPA selalu terbaca di DevTools sehingga pembatasan jaringan tetap kontrol utama. Checklist `monitoring.api-key` dilengkapi perintah verifikasi dari sisi dashboard & API. |
| 1.4.1 | 6 Agustus 2026 | | Langkah 4b memakai seeder siap pakai `seed_api_tab_campaign.sql` (campaign bebas saldo minimum produk 201–204, `saldo_minimum` 0, semua kantor, 2026-08-01 s/d 2026-09-30, `dibuat_oleh` USSI / `disetujui_oleh` B Eko Prasetyo; idempotent, `no_memo` placeholder harus diganti memo BPR asli) + cara menghentikan campaign (`is_active = 0`, bukan `DELETE`) dan satu item checklist verifikasi baris campaign. |
| 1.4.0 | 5 Agustus 2026 | | Nama database dibuat generik: `cma`/`cma_sys` → **`dbcore`/`dbcore_sys`** + catatan bahwa nama tersebut placeholder per lembaga (§1, §3.1). Tambah patch wajib `patch_tab_campaign_saldo_minimum.sql` (tabel `api_tab_campaign` & `api_tab_minimum_change`) + langkah pengisian baris campaign, properti baru `tabung.minimum-editor-user-ids` (fail-closed) pada tabel konfigurasi, dan dua item checklist verifikasi. |
| 1.3.0 | 4 Agustus 2026 | | Tambah §3.3 Timezone (WIB) — properti `app.timezone` (default `Asia/Jakarta`) disetel aplikasi saat startup, `spring.jackson.time-zone` & `hibernate.jdbc.time_zone`, serta `connectionTimeZone` pada kedua `jdbc-url`; aturan "empat nilai harus seragam", checklist verifikasi timezone. Zona tidak valid = gagal start. |
| 1.2.0 | 30 Juli 2026 | | Tambah Metode B — build lokal, server run-only (jar & config di-mount ke image `eclipse-temurin:17-jre-alpine`, tanpa build di server) beserta struktur `/home/apih2h`, alur rilis, dan rollback via arsip `app/releases/`. Rujukan detail: `DEPLOY.md` di repo `microservice-core`. |

---

*[← Kembali ke Host 2 Host](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
