# 🚀 Deployment Guide — Host 2 Host

> Panduan deployment & rilis untuk produk **Host 2 Host** (metode: Docker + Docker Compose).

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | Host 2 Host     |
| Jenis Dokumen     | Deployment Guide         |
| Versi             | 1.1.0               |
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
| Database | MySQL — **dua database**: `cma` (primary/core) & `cma_sys` (sys/user) |
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
        [MySQL: cma]                    [MySQL: cma_sys]
     (Core Banking IBS)                (user / sistem)
```

- **Dashboard monitoring** (`health-ui-mcs`) adalah aplikasi terpisah yang memanggil
  `/api/monitoring/**` dengan `X-MONITORING-KEY`. Deploy-nya di luar cakupan dokumen ini.

## 3. Konfigurasi Environment

### 3.1 File `application.properties` (di-mount ke `/config/application.properties`)
Container dijalankan dengan `--spring.config.location=classpath:/,file:/config/application.properties`,
sehingga file eksternal menimpa nilai default. **Isi secret di sini, bukan di dalam image.**

| Grup | Kunci | Contoh | Keterangan |
|------|-------|--------|------------|
| DB Primary (`cma`) | `spring.datasource.jdbc-url` | `jdbc:mysql://<db-host>:3306/cma` | Core banking IBS. |
| | `spring.datasource.username` / `password` | `***` | Kredensial DB core. |
| | `spring.datasource.driver-class-name` | `com.mysql.cj.jdbc.Driver` | |
| DB Sys (`cma_sys`) | `sys.datasource.jdbc-url` | `jdbc:mysql://<db-host>:3306/cma_sys` | DB user/sistem. |
| | `sys.datasource.username` / `password` | `***` | Kredensial DB sys. |
| Redis | `spring.data.redis.host` | `redis` | **Nama service compose**, bukan `localhost`. |
| | `spring.data.redis.port` | `6379` | |
| Server | (port aplikasi) | `8080` | Dipetakan `8080:8080` oleh compose. |
| | `server.forward-headers-strategy` | `framework` | Agar HTTPS/HSTS dikenali di belakang proxy. |
| Monitoring | `monitoring.api-key` | `***` | **Wajib diisi** — bila kosong `/api/monitoring/**` ditolak (fail-closed). Harus sama dengan `API_MONITORING_KEY` di dashboard `health-ui-mcs`. |
| Rekap | `rekap.admin-user-ids` | `U001,U050` | Allowlist user_id HQ/admin. Kosong = semua akses rekap ditolak. |
| Isolasi | `isolation.hq-user-ids` | `U001` | Allowlist user_id yang bypass tenant isolation. Kosong = tidak ada HQ. |
| Aktuator | `management.endpoints.web.exposure.include` | `health` | Hanya `health` yang diekspos. |
| | `management.endpoint.health.show-details` | `when-authorized` | Jangan set `always` pada probe publik. |
| Log | `logging.file.name` | `logs/microservicecore.log` | Volume `./logs` di-mount ke `/app/logs`. |

> ⚠️ **Jangan commit kredensial asli.** Di dev, secret di-import dari `application-local.properties`
> via `spring.config.import`; di produksi, disuplai lewat file `application.properties` yang
> di-mount (tidak masuk image / VCS).

### 3.2 Environment variable container
| Variabel | Contoh | Keterangan |
|----------|--------|------------|
| `TZ` | `Asia/Jakarta` | Timezone container (disetel di compose). |

## 4. Langkah Deployment

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
#    Isi kredensial DB (cma & cma_sys), redis.host=redis, monitoring.api-key,
#    rekap.admin-user-ids, isolation.hq-user-ids.
cp application.properties.example application.properties   # lalu edit
# Pastikan folder ./logs ada (akan di-mount ke /app/logs)
mkdir -p logs

# 4. Jalankan patch skema DB (WAJIB — ddl-auto=none) pada DB core/sys yang sesuai:
#    - patch_api_login_log_status_widen.sql  (WAJIB: kolom status VARCHAR(20))
#    - patch_dep_produk_is_custom_rate.sql   (WAJIB bila memakai deposito special rate: kolom is_custom_rate)
#    - patch_get_next_id_atomic.sql          (disarankan; perlu review IBS lebih dulu)
mysql -h <db-host> -u <user> -p cma < database/patches/patch_api_login_log_status_widen.sql
mysql -h <db-host> -u <user> -p cma < database/patches/patch_dep_produk_is_custom_rate.sql
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

## 5. Verifikasi Pasca-Deploy

- [ ] Container `microservicecore` & `redis_service` status `Up` (`docker compose ps`).
- [ ] Health check OK: `curl -s http://localhost:8080/actuator/health` → `{"status":"UP"}`.
- [ ] Root greeting: `curl -s http://localhost:8080/` → pesan "MicroService Core ... running 🚀".
- [ ] Swagger UI dapat diakses: `http://<host>:8080/swagger-ui.html`.
- [ ] Koneksi DB primary & sys OK (tidak ada error datasource di log; login mengembalikan token).
- [ ] Koneksi Redis OK (endpoint transaksional tidak balas `503`/`90`).
- [ ] Patch `patch_api_login_log_status_widen.sql` sudah diterapkan (login rate-limit tidak 500).
- [ ] Patch `patch_dep_produk_is_custom_rate.sql` sudah diterapkan (registrasi deposito special rate & `GET /deposito/produk-spesial-rate` tidak 500).
- [ ] `monitoring.api-key` terisi & cocok dengan dashboard `health-ui-mcs`.
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

---

*[← Kembali ke Host 2 Host](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
