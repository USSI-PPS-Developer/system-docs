# 🚀 Deployment Guide — IBS LOS BackEndCore

> Panduan deployment & rilis untuk produk **IBS LOS BackEndCore** (metode: Docker + Docker Compose).

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS LOS BackEndCore |
| Jenis Dokumen     | Deployment Guide    |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 17 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Prasyarat (Prerequisites)

| Item | Versi / Detail |
|------|----------------|
| JDK (build) | Java 17 (Eclipse Temurin) — untuk `mvn clean package` |
| Maven | 3.9+ (atau via image `maven:3.9-eclipse-temurin-17` di build stage Docker) |
| Docker Engine | ≥ 20.10 |
| Docker Compose | v2 (`docker compose`) |
| Database | MySQL — DB Core Banking IBS (mis. `bprlanggeng`) + DB sys (`<db>_sys`) |
| Artifact | `target/ibslos4core-0.0.1-SNAPSHOT.jar` (hasil build Maven; di image menjadi `/app/app.jar`) |
| Akses | Kredensial DB Core & sys, akses jaringan ke MySQL, VPN ke server target |
| Konfigurasi rahasia | `app.ini` produksi (berisi kredensial DB & shared secret — **tidak** di-commit / masuk image) |

> **Catatan skema DB:** service **tidak** membuat/mengubah skema. Skema Core Banking dikelola
> oleh IBS/DBA BPR. Pastikan tabel `nasabah`, `kredit`, `kre_agunan`, tabel referensi, dan
> stored function generator ID sudah tersedia pada DB target sebelum deploy.

## 2. Arsitektur Deployment

Container aplikasi berjalan dalam beberapa Docker network agar dapat menjangkau DB (Percona/
MySQL) dan diakses reverse proxy. MySQL/Percona umumnya berada di luar compose (host/managed).

```
[IBS LOS]
      │  HTTPS (X-Client-Id, X-Timestamp, X-Signature)
      ▼
[nginx reverse proxy]  (network: ibs-los)
      │  HTTP :7071
      ▼
┌──────────── Docker networks: default · percona55 · ibs-los ────────────┐
│                                                                        │
│   [ibs-los-backendcore]  (container ibs-los-backendcore)               │
│     port 7071:7071                                                     │
│     volumes:                                                           │
│       ./src/main/resources/app.ini → /app/config/app.ini  (ro)        │
│       ./logs                        → /app/logs                        │
│     env: CONFIG_LOCATION=/app/config/app.ini                          │
│                                                                        │
└──────────────┬─────────────────────────────┬─────────────────────────┘
               │ JDBC ([database])            │ JDBC ([database_sys])
               ▼                              ▼
        [MySQL/Percona: <db>]          [MySQL/Percona: <db>_sys]
        (Core Banking IBS)             (sys_mysysid / template ID)
```

- Network `percona55` (external `percona55_default`) menghubungkan app ke container DB Percona.
- Network `ibs-los` (external) menghubungkan reverse proxy nginx ke app.
- Service `mysql` di compose bersifat **opsional** (profile `local-db`) untuk pengembangan lokal.

## 3. Konfigurasi Environment

### 3.1 File `app.ini` (di-mount ke `/app/config/app.ini`)
Container dijalankan dengan `-Dconfig.location=$CONFIG_LOCATION`. `MainApp` membaca file INI
ini lalu men-set System property Spring sebelum boot. **Isi kredensial & secret di sini,
bukan di dalam image.** Salin dari `app.ini.example` lalu isi nilai riil.

| Section | Kunci | Contoh | Keterangan |
|---------|-------|--------|------------|
| `[server]` | `port` | `7071` | Port aplikasi (dipetakan `7071:7071`). |
| | `servlet.context-path` | `/core-api` | Prefix context path. |
| `[database]` | `host` / `port` | `192.168.x.x` / `3306` | DB Core Banking (primary). |
| | `name` | `bprlanggeng` | Nama schema Core. |
| | `user` / `password` | `***` | Kredensial DB Core. |
| `[database_sys]` | `host` / `port` / `name` | `...` / `3306` / `bprlanggeng_sys` | DB sys (`sys_mysysid`). Default mengikuti `[database]` bila kosong. |
| | `user` / `password` | `***` | Kredensial DB sys. |
| `[security]` | `client_id` | `ibs-los` | Harus sama dengan `X-Client-Id` yang dikirim IBS LOS. |
| | `shared_secret` | `***` | Secret HMAC-SHA256 — **wajib diganti** dari `CHANGE_ME_CORE_SECRET`. |
| | `allowed_skew_seconds` | `300` | Toleransi selisih waktu request. |
| `[cors]` | `allowed_origins` | `http://localhost:5173,...` | Daftar origin yang diizinkan. |
| `[redis]` | `host` / `port` | `localhost` / `6379` | Disediakan untuk kompatibilitas config (opsional). |

> ⚠️ **Jangan commit `app.ini`.** File ini git-ignored & tidak masuk image (di-exclude via
> `.dockerignore`); di-mount saat runtime. Jaga `shared_secret` tetap rahasia & rotasi berkala.

### 3.2 Environment variable container
| Variabel | Contoh | Keterangan |
|----------|--------|------------|
| `CONFIG_LOCATION` | `/app/config/app.ini` | Lokasi file INI (disetel di Dockerfile). |
| `JAVA_OPTS` | `-XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom` | Opsi JVM. |
| `APP_PORT` | `7071` | Port host yang dipetakan ke `7071` container (compose). |

## 4. Langkah Deployment

### 4.1 Build artifact (opsional bila pakai Docker multi-stage)
```bash
# 1. Ambil source terbaru
git pull origin main

# 2. Build fat jar → target/ibslos4core-0.0.1-SNAPSHOT.jar
mvn clean package
# (Dockerfile build stage juga menjalankan `mvn clean package -DskipTests` sendiri,
#  jadi langkah ini opsional bila deploy via `docker compose up --build`.)
```

### 4.2 Siapkan konfigurasi
```bash
# 3. Siapkan app.ini produksi dari template
cp src/main/resources/app.ini.example src/main/resources/app.ini
#    lalu isi: [database], [database_sys], [security] (client_id + shared_secret), [server]

# 4. Pastikan folder logs ada (di-mount ke /app/logs)
mkdir -p logs

# 5. Pastikan network eksternal tersedia (bila dipakai reverse proxy / Percona)
docker network create ibs-los            2>/dev/null || true
#    percona55_default biasanya sudah dibuat oleh stack Percona.
```

### 4.3 Build image & start service
```bash
# 6. Build image + jalankan secara detached (multi-stage: build jar → JRE runtime)
docker compose up -d --build
#    - container: ibs-los-backendcore, port 7071:7071

# 7. Cek status & log
docker compose ps
docker compose logs -f app
```

> **Dockerfile** (ringkas): Stage 1 `maven:3.9-eclipse-temurin-17` build fat jar; Stage 2
> `eclipse-temurin:17-jre-jammy` menjalankan `/app/app.jar` sebagai user non-root `app`,
> `EXPOSE 7071`, `ENTRYPOINT` = `java $JAVA_OPTS -Dconfig.location=$CONFIG_LOCATION -jar /app/app.jar`.
> `app.ini` **tidak** disalin ke image (di-exclude `.dockerignore`) — di-mount saat runtime.

### 4.4 Menjalankan tanpa Docker (alternatif)
```bash
java -Dconfig.location=/path/to/app.ini -jar target/ibslos4core-0.0.1-SNAPSHOT.jar
```

## 5. Verifikasi Pasca-Deploy

- [ ] Container `ibs-los-backendcore` status `Up (healthy)` (`docker compose ps`).
- [ ] Health check OK: `curl -s http://localhost:7071/core-api/health` →
      `{"success":true,"message":"OK","service":"ibslos4core"}`.
- [ ] Banner startup "RND LT4 / INQ SERVICE" muncul di log dengan `Client ID` & `Server Port` benar.
- [ ] Swagger UI dapat diakses: `http://<host>:7071/core-api/swagger-ui.html`.
- [ ] Koneksi DB Core OK: `GET /core/debtor-details/{nik}` untuk NIK uji → `success:true`
      (atau `success:false "ID tidak ditemukan"` bila NIK memang tidak ada — bukan error DB).
- [ ] Koneksi DB sys OK: posting uji menghasilkan `no_rekening`/`no_cif` (generator jalan).
- [ ] Signature bekerja: request non-localhost tanpa header ditolak `401`
      `"Missing security headers."`; request dengan signature valid dari IBS LOS → `200`.
- [ ] Smoke test posting: `POST /core/post-loan` (signed) untuk debitur uji → `success:true`
      dengan `no_cif`, `no_rekening`, `agunan_id`; verifikasi data masuk konsisten di Core.

## 6. Rollback Plan

Bila deploy gagal atau ada regresi:

```bash
# 1. Kembalikan ke commit/tag versi sebelumnya lalu rebuild
git checkout <tag-versi-sebelumnya>
docker compose up -d --build

# atau, bila image lama masih ada, jalankan ulang tanpa rebuild:
docker compose down
docker compose up -d
```

- **Konfigurasi:** `app.ini` di-mount dari host — simpan versi sebelumnya (mis.
  `app.ini.bak`) untuk pemulihan cepat.
- **Database:** service **tidak** melakukan migrasi skema; tidak ada rollback DDL yang perlu
  dilakukan dari sisi service. Untuk data yang terlanjur ter-posting, koordinasikan koreksi
  dengan tim IBS Core.
- **Shared secret:** bila rotasi secret menyebabkan LOS gagal auth, kembalikan `shared_secret`
  ke nilai sebelumnya di `app.ini` lalu restart container.

## 7. Kontak & Eskalasi

| Peran | Nama | Kontak |
|-------|------|--------|
| DevOps / Deployer | | |
| DBA Core Banking (IBS) | | |
| Tim IBS LOS (konsumen API) | | |
| Developer / Maintainer (USSI) | | |
| On-call | | |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dokumen dibuat (metode Docker Compose + Dockerfile multi-stage; config via `app.ini`). |

---

*[← Kembali ke IBS LOS BackEndCore](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
