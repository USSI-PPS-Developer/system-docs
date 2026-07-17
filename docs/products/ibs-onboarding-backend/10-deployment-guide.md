# 🚀 Deployment Guide — IBS Onboarding Backend

> Panduan deployment & rilis untuk produk **IBS Onboarding Backend** (metode: Docker Compose, atau manual JAR + systemd).

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS Onboarding Backend |
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
| JDK (build/run) | Java 17 (Eclipse Temurin) |
| Maven | 3.9+ (atau via image `maven:3.9-eclipse-temurin-17` di build stage Docker) |
| Docker Engine | ≥ 20.10 |
| Docker Compose | v2 (`docker compose`) |
| Database | MySQL/Percona — DB main (`[database_main]`) + DB sys (`[database_sys]`) |
| RabbitMQ | Opsional (dependency tersedia; fitur messaging) |
| Artifact | `target/backend-0.0.1-SNAPSHOT.jar` (di image menjadi `/app/app.jar`; deploy manual: `backendonboard.jar`) |
| Akses | Kredensial DB main & sys, akses jaringan ke MySQL, akses ke server target |
| Konfigurasi rahasia | `app.ini` produksi (kredensial DB — **tidak** di-commit / tidak masuk image) |

> **Catatan skema DB:** service **tidak** membuat/mengubah skema Core Banking (`nasabah`,
> `tabung`, `deposito`, `kredit`, `*trans`, produk, kantor) maupun stored function generator ID
> (`GENERATE_NASABAH_ID`, `GENERATE_NOREK_SIMPANAN/DEPOSITO/KREDIT`) — dikelola IBS/DBA BPR.
> Tabel onboarding (`obd_*`) harus tersedia di DB main. ⚠️ DDL di repo belum lengkap — sinkronkan
> struktur `obd_*` dengan DB target sebelum deploy (lihat [Desain Database](04-database-design.md)).

## 2. Arsitektur Deployment

Container aplikasi berjalan di Docker dan bergabung ke network Percona/MySQL agar dapat konek
DB memakai **nama container** (bukan IP). Database berada di luar compose (stack Percona).

```
[Aplikasi Nasabah] ─┐   HTTP :8855
[Back-office Admin] ─┘        │
                             ▼
┌──────────── Docker network: percona55_default (external) ────────────┐
│                                                                       │
│   [backend-onboard]  (container backend-onboard)                      │
│     image backend-onboard:latest · port 8855:8855 · restart unless-stopped │
│     volumes:                                                          │
│       ./app.ini   → /app/app.ini   (ro)                               │
│       ./uploads   → /app/uploads   (persisten)                        │
│     ENTRYPOINT: java -jar app.jar                                     │
│                                                                       │
└──────────────┬──────────────────────────────┬───────────────────────┘
               │ JDBC ([database_main])        │ JDBC ([database_sys])
               ▼                               ▼
        [Percona/MySQL: <db_main>]      [Percona/MySQL: <db_sys>]
        (obd_* + Core Banking)          (sys_daftar_user / sys_mysysid)
```

- Network **`percona55_default`** bersifat `external: true` — **sudah dibuat** oleh stack
  Percona; bila belum ada, `docker compose up` gagal dengan error "network not found".
- Karena join network Percona, `host` di `app.ini` cukup memakai **nama container** Percona.

## 3. Konfigurasi Environment

### 3.1 File `app.ini` (di-mount ke `/app/app.ini`, read-only)
Aplikasi membaca konfigurasi dari **`app.ini`** (format INI, via ini4j) — bukan
`application.properties`. Lokasi dapat di-override: `-Dconfig.location=/path/app.ini`.
**Isi kredensial di sini, bukan di dalam image.** Salin dari `app.ini.example`.

| Section | Kunci | Contoh | Keterangan |
|---------|-------|--------|------------|
| `[server]` | `port` | `8855` | Port aplikasi (dipetakan `8855:8855`). |
| `[database_main]` | `host` / `port` | `percona55` / `3306` | DB utama (obd_* + Core). Host = nama container Percona. |
| | `name` / `user` / `password` | `<db_main>` / `***` / `***` | Kredensial DB main. |
| `[database_sys]` | `host` / `port` / `name` | `percona55` / `3306` / `<db_sys>` | DB sys (`sys_mysysid`, `sys_daftar_user`). |
| | `user` / `password` | `***` / `***` | Kredensial DB sys. |
| `[redis]` | `host` / `port` | `localhost` / `6379` | Tersedia di config; **belum** dipakai runtime. |
| `[frontend]` | `origin` | `http://localhost:3000` | Tersedia di config; CORS aktual di-hardcode `*`. |

> ⚠️ **Jangan commit `app.ini`.** File git-ignored & di-exclude dari image (`.dockerignore`),
> lalu di-mount saat runtime bersama folder `uploads/`. Jaga kredensial tetap rahasia.

### 3.2 Catatan port
Bila mengubah `[server] port` di `app.ini`, samakan juga: mapping port di `docker-compose.yml`
(`"PORT:PORT"`) dan `EXPOSE` di `Dockerfile`.

## 4. Langkah Deployment

### 4.1 Deploy via Docker Compose (direkomendasikan)
```bash
# 1. Clone repo
git clone https://github.com/USSI-PPS-Developer/Backend-Onboard.git
cd Backend-Onboard

# 2. Siapkan app.ini dari template lalu isi kredensial PRODUKSI
cp app.ini.example app.ini
nano app.ini

# 3. Pastikan network Percona tersedia (dibuat oleh stack Percona)
docker network inspect percona55_default >/dev/null 2>&1 || echo "⚠️ network percona55_default belum ada"

# 4. Build image & jalankan (detached)
docker compose up -d --build
```
Aplikasi jalan di port **8855** (sesuai `app.ini`).

> **Dockerfile** (multi-stage): Stage 1 `maven:3.9-eclipse-temurin-17` → `mvn clean package
> -DskipTests` (fat jar `target/*.jar`). Stage 2 `eclipse-temurin:17-jre` → `COPY app.jar`,
> `EXPOSE 8855`, `ENTRYPOINT java -jar app.jar`. `app.ini` **tidak** disalin ke image (di-mount).

**Perintah berguna**
```bash
docker compose logs -f      # log realtime
docker compose ps           # status container
docker compose restart      # restart
docker compose down         # stop & hapus container
```

**Update / redeploy**
```bash
git pull
docker compose up -d --build   # rebuild image & restart otomatis
```
> `app.ini` & folder `uploads/` aman (di-mount sebagai volume, tidak ikut ke image).

### 4.2 Deploy Manual (tanpa Docker)
Cukup **2 file**: `backendonboard.jar` (hasil `./mvnw clean package`) + `app.ini` (kredensial produksi).

```bash
# 1. Build JAR di lokal
./mvnw clean package -DskipTests

# 2. Siapkan folder deploy di server
sudo mkdir -p /opt/backend-onboard

# 3. Copy artifact + konfigurasi
scp target/backend-*.jar user@SERVER:/opt/backend-onboard/backendonboard.jar
scp app.ini             user@SERVER:/opt/backend-onboard/app.ini

# 4. Pastikan JDK 17 di server
java -version   # harus 17.x

# 5. Jalankan DARI folder deploy (uploads/ & app.ini relatif ke working dir)
cd /opt/backend-onboard
java -jar backendonboard.jar
```

> ⚠️ **Working directory penting:** aplikasi menyimpan/melayani upload dari path relatif
> `./uploads/` dan membaca `app.ini` dari direktori kerja. Selalu jalankan dari folder yang
> sama tempat `app.ini` berada.

**Menjalankan sebagai service (systemd) — direkomendasikan**
```ini
# /etc/systemd/system/backend-onboard.service
[Unit]
Description=NEXT IBS Onboard Service
After=network.target mysql.service

[Service]
Type=simple
User=appuser
WorkingDirectory=/opt/backend-onboard
ExecStart=/usr/bin/java -jar /opt/backend-onboard/backendonboard.jar
SuccessExitStatus=143
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable backend-onboard
sudo systemctl start backend-onboard
sudo systemctl status backend-onboard
sudo journalctl -u backend-onboard -f
```

## 5. Verifikasi Pasca-Deploy

- [ ] Container `backend-onboard` status `Up` (`docker compose ps`) / service `active (running)`.
- [ ] Startup banner (port, IP server, koneksi DB) muncul di log tanpa error datasource.
- [ ] Swagger UI dapat diakses: `http://<host>:8855/swagger-ui.html`.
- [ ] Koneksi DB main OK: `GET http://<host>:8855/api/banner` atau `GET /api/tab-produk`
      mengembalikan `responseCode 00`.
- [ ] Koneksi DB sys OK: `POST /api/admin/login` dengan user admin uji → `00`.
- [ ] Alur onboarding: `POST /api/register` (multipart) → `POST /api/register/{id}/approve`
      menghasilkan OTP → `POST /api/aktivasi` membuat user ACTIVE.
- [ ] Posting Core: approve pengajuan uji (`PUT /api/pengajuan-tabungan/{id}/status`
      status=APPROVED) menghasilkan `cif` & `no_rekening` (generator jalan).
- [ ] Upload/serve file: file yang di-upload muncul via `GET /api/uploads/{filename}`.
- [ ] Enkripsi respons: `responseData` pada respons sukses terenkripsi + ada `keyVersion`.

## 6. Rollback Plan

```bash
# Docker: kembalikan ke commit/tag sebelumnya lalu rebuild
git checkout <tag-versi-sebelumnya>
docker compose up -d --build
# atau jalankan ulang image lama tanpa rebuild:
docker compose down && docker compose up -d

# Manual/systemd: copy JAR versi sebelumnya lalu restart
scp target/backend-<versi-lama>.jar user@SERVER:/opt/backend-onboard/backendonboard.jar
sudo systemctl restart backend-onboard
```

- **Konfigurasi:** `app.ini` di-mount/di-copy dari host — simpan versi sebelumnya
  (mis. `app.ini.bak`) untuk pemulihan cepat.
- **File upload:** folder `uploads/` persisten (volume) — tidak ikut ditimpa saat redeploy.
- **Database:** service tidak melakukan migrasi skema Core; tidak ada rollback DDL dari sisi
  service. Untuk nasabah/rekening yang terlanjur ter-posting ke Core, koordinasikan koreksi
  dengan tim IBS Core.

## 7. Kontak & Eskalasi

| Peran | Nama | Kontak |
|-------|------|--------|
| DevOps / Deployer | | |
| DBA Core Banking (IBS) | | |
| Tim Frontend (konsumen API) | | |
| Developer / Maintainer (USSI) | Nur Fadhillah Chaerul Akbar | |
| On-call | | |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dokumen dibuat (Docker Compose + Dockerfile multi-stage; config via `app.ini`; alternatif manual/systemd). |

---

*[← Kembali ke IBS Onboarding Backend](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
