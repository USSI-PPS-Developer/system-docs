# 🚀 Deployment Guide — API Jamkrida Jateng

> Panduan deployment untuk produk **API Jamkrida Jateng**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | API Jamkrida Jateng     |
| Jenis Dokumen     | Deployment Guide         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 10 Oktober 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Prasyarat (Prerequisites)

| Komponen | Versi / Kebutuhan |
|----------|-------------------|
| Build | JDK 17+, Maven 3.9+ |
| Runtime | Docker (Compose v2 atau v1 — v1 perlu `version: "3.4"`), image `eclipse-temurin:17-jre` |
| Host produksi | CentOS 7 (EOL Juni 2024 — risiko diketahui), Docker 26.1.4, Compose v2.27.1, SELinux Disabled (per 01-10-2026) |
| Database | MySQL 5.5 — `bkkjateng` (read-write) dan `bkkjateng_sys` (read-only) |
| Jaringan keluar | `jamkrida-online.co.id:443` |
| Jaringan masuk | Dari CBS & web CBS (internal); dari Jamkrida hanya `/publik/**` lewat reverse proxy |
| Kredensial | Akun API Jamkrida (dev/prod berbeda), dua kunci API (CBS & Jamkrida), rekening penjaminan |

Tiga komponen harus naik bersama, ditambah perubahan database:

| Komponen | Artefak |
|----------|---------|
| Service | `api-jamkrida-jateng-1.0.0-SNAPSHOT.jar` |
| CBS | `IbsJateng-jar-with-dependencies.jar` (dibangun dari **basis produksi**, bukan cabang dev) |
| Web | Berkas PHP/JS `ptbkkjateng` (daftar di §4.6) |
| Database | Migrasi `jamkrida_*` + patch CBS + patch menu |

## 2. Arsitektur Deployment

```
                Internet
                   │  (hanya /publik/**)
           ┌───────▼────────┐
           │ Reverse proxy  │  location / { return 404; }
           └───────┬────────┘
                   │
┌──────────────────▼───────────────────────────┐
│ Host: /home/APIJamkridaJateng                │
│  container api-jamkrida (USER app, UID 999)  │──► jamkrida-online.co.id
│   /app/lib    ← ./app     (ro)  jar          │
│   /app/config ← ./config  (ro)  secret.yml   │
│   /app/logs   ← ./logs    (rw)               │
│   port 8087, context /api-jamkrida           │
└──────────────┬───────────────────────────────┘
               │ JDBC
     MySQL 5.5 bkkjateng / bkkjateng_sys
               ▲
  CBS IbsJateng (Jetty) ── HTTP internal ──► service
  Web ptbkkjateng (PHP) ── HTTP internal ──► service
```

Pola: **image hanya berisi JRE**; jar dan konfigurasi datang dari bind mount **direktori**
(bind mount file tunggal terikat inode, jar yang di-`scp` ulang tidak terbaca). Rilis rutin cukup
kirim jar + restart.

```
/home/APIJamkridaJateng/
├── Dockerfile  docker-compose.yml  redeploy.sh  .env
├── app/api-jamkrida-jateng.jar
├── config/application-secret.yml   # chmod 600, milik UID 999
└── logs/
```

## 3. Konfigurasi Environment

### 3.1 `config/application-secret.yml` (tidak ikut repo)

Wajib: kredensial dua database, `app.jamkrida.username/password`, `app.security.api-key`,
`app.security.inbound-key`, blok `app.jamkrida.penjaminan` (nama bank, nomor & nama rekening —
tanpa ini Bayar IJP ditolak).

### 3.2 `.env` service

Setiap properti bisa lewat env var **atau** YAML, jangan keduanya (env var menang).

| Variabel | Nilai produksi | Bila dilewatkan |
|----------|----------------|-----------------|
| `APP_PROFILE` | `prod` | Jatuh ke `dev`: base-url `devapi` **dan** migrasi menyala — service tetap sehat tanpa tanda apa pun |
| `JAMKRIDA_BASE_URL` | kosong (profil `prod` = `https://jamkrida-online.co.id/api/ussi/public`) | — |
| `JAMKRIDA_MIGRATION_ENABLED` | `true` (cara A) atau kosong (cara B) | Tabel tidak dibuat |
| `JAMKRIDA_API_KEY` | Kunci CBS/web | Jalur internal terbuka |
| `JAMKRIDA_INBOUND_KEY` | Kunci Jamkrida (**berbeda** dari kunci CBS) | `/publik/**` terbuka |
| `JAMKRIDA_SYNC_ENABLED` / `JAMKRIDA_SYNC_CRON` | `true` / `0 15 1 * * *` | |
| `HOST_PORT`, `DNS_UTAMA`, `DNS_CADANGAN` | Sesuai infra (default DNS `8.8.8.8`/`1.1.1.1`) | |

| Env var | Properti YAML |
|---------|---------------|
| `BKKJATENG_DB_URL/_USER/_PASSWORD` | `app.datasource.primary.*` |
| `SYS_DB_URL/_USER/_PASSWORD` | `app.datasource.sys.*` |
| `JAMKRIDA_USERNAME/_PASSWORD` | `app.jamkrida.username/password` |
| `JAMKRIDA_BANK_NAMA/_NOREK/_NAMAREK` | `app.jamkrida.penjaminan.*` |

### 3.3 Setting CBS (`bkkjateng_sys.sys_mysysid`)

| Key | Isi |
|-----|-----|
| `KRE_USING_JAMKRIDA_API` | `YA` — saklar induk; `TIDAK` = semua kantor kembali ke alur lama |
| `KRE_JAMKRIDA_API_URL` | Base URL service |
| `KRE_JAMKRIDA_API_KEY` | = `app.security.api-key` |
| `KRE_JAMKRIDA_REK_PREMI` | Rekening tabungan Jamkrida tujuan setoran premi |

### 3.4 `.env` web

```
JAMKRIDA_API_KEY=<sama dengan app.security.api-key>
URL_JAMKRIDA=http://<host-service>:8087/api-jamkrida
MODUL_JAMKRIDA=ya
MODUL_NOTARIS_ESCROW=tidak
MODUL_KODE_PROMO=tidak
```

Kunci `MODUL_*` yang tidak ada dianggap **mati**. Kunci API ada di dua tempat (CBS & web) — mengisi
satu saja membuat separuh layar menolak "API key tidak valid".

## 4. Langkah Deployment

| # | Langkah | Verifikasi |
|---|---------|------------|
| 1 | Backup `bkkjateng` & `bkkjateng_sys` (minimal `premitrans`, `sys_modul`, `sys_rmodul`, `sys_mysysid`) | Berkas dump tidak kosong |
| 2 | Migrasi `jamkrida_*` (§4.2) | `SHOW TABLES LIKE 'jamkrida_%'` → 10 tabel + `jamkrida_schema_history` |
| 3 | Patch `bkkjateng` (§4.3) | Kolom & tabel baru ada |
| 4 | Patch menu `bkkjateng_sys` (§4.4) | 5 menu di `sys_modul` |
| 5 | Setting manual (§3.3), kantor piloting | `SELECT * FROM sys_mysysid WHERE keyname LIKE 'KRE_%JAMKRIDA%'` |
| 6 | Konfigurasi service (§3.1–3.2), izin berkas | Secret terbaca dari dalam container |
| 7 | Deploy jar service (§4.5) | Log `Started JamkridaApplication`, health `UP` |
| 8 | Deploy jar CBS | CBS jalan normal |
| 9 | Unggah berkas web (§4.6) | Menu terbuka |
| 10 | `POST /jamkrida/referensi/sync` | Layar Master Data terisi |
| 11 | Periksa pemetaan produk | Sesuai kesepakatan BPR–Jamkrida |

> **Urutan penting: migrasi sebelum CBS.** CBS membaca `jamkrida_kantor_pilot`; bila tabel belum
> ada, semua kantor dianggap tidak ikut piloting.

### 4.1 Build artifact

```bash
mvn -B clean package -DskipTests   # selalu clean — build incremental pernah lolos dengan kode lama
```

### 4.2 Migrasi `jamkrida_*` — pilih satu cara

- **Cara A (service):** `JAMKRIDA_MIGRATION_ENABLED=true`; log `Migrasi skema jamkrida_* selesai`.
- **Cara B (DBA):** jalankan `V1`..`V16` berurutan di `bkkjateng`. Semua idempotent.

Jangan dicampur: cara B membuat `jamkrida_schema_history` kosong, sehingga menyalakan flag
belakangan menjalankan ulang semuanya (aman, tapi menyulitkan penelusuran).

### 4.3 Patch CBS (`bkkjateng`, tidak lewat Flyway)

```sql
SELECT table_schema, table_name, table_rows
FROM information_schema.tables WHERE table_name = 'premitrans';
```

| Hasil | Tindakan |
|-------|----------|
| `premitrans` ada | `mysql bkkjateng < db/patch/premitrans_kolom_pembayaran.sql` (5 kolom nullable). MySQL 5.5 merebuild tabel → siapkan jendela pemeliharaan bila besar |
| `premitrans` tidak ada | Buat dari struktur dev (`mysqldump --no-data --skip-add-drop-table`), **lewati** patch kolom |
| Selalu | `mysql bkkjateng < db/patch/kre_hapus_realisasi_log.sql` |

> ⚠️ **`premitrans.id` harus `AUTO_INCREMENT`.** Sejak 05-10-2026 (commit *Serahkan nomor premitrans
> ke AUTO_INCREMENT*) service tidak lagi mengisi `id` baris 101 dan membacanya dari generated keys.
> `DEPLOY-PRODUCTION.md` §3c di repo service masih menyarankan membuang `AUTO_INCREMENT` — saran itu
> **sudah tidak berlaku** dan perlu diperbarui di repo tersebut.

### 4.4 Patch menu (`bkkjateng_sys` — database berbeda!)

```bash
for f in menu_pembayaran_premi_jamkrida menu_mapping_produk_jamkrida \
         menu_referensi_jamkrida menu_audit_log_jamkrida menu_kantor_pilot_jamkrida; do
    mysql -u root -p bkkjateng_sys < db/patch/$f.sql
done
```

```sql
SELECT SYSMODUL_KODE, SYSMODUL_NAMA FROM sys_modul
WHERE SYSMODUL_KODE IN ('TRXPREMIJK','MAPJKPRD','REFJKRD','AUDITJKR','PILOTJK');
```

Ada juga `menu_pembayaran_premi_kolektif_jamkrida.sql` untuk layar setoran kolektif.

### 4.5 Kirim jar & jalankan

Pertama kali (di server):

```bash
cd /home/APIJamkridaJateng
docker run --rm --entrypoint id api-jamkrida-jateng:local   # pastikan UID user app (mis. 999)
chmod 600 .env config/application-secret.yml
chown 999:999 config/application-secret.yml && chown -R 999:999 logs
chmod +x redeploy.sh
./redeploy.sh build
```

Rilis berikutnya (dari laptop):

| Skrip | Lingkungan | Perilaku |
|-------|-----------|----------|
| `./deploy/kirim-jar.sh` | Dev | Build clean, backup jar lama, kirim, restart |
| `./deploy/kirim-jar-prod.sh` | Produksi | Minta konfirmasi `YA`, **menolak bila `APP_PROFILE≠prod`**, cek izin dari dalam container, backup & cetak perintah rollback |

Opsi: `--tanpa-build`, `--hanya-kirim` (dev), `--build-image` (prod).

| Mode `redeploy.sh` | Kapan |
|--------------------|-------|
| `restart` (default) | Jar baru |
| `up` | `.env` / compose berubah — `restart` **tidak** membaca ulang `.env` |
| `build` | Dockerfile berubah |
| `status` | Lihat kondisi + 30 baris log |

### 4.6 Berkas web yang diunggah

Unggah `application/helpers/utility_helper.php` **lebih dulu** (berisi `modul_aktif()` &
`header_jamkrida()`), lalu:

```
controllers: c_dm_jamkrida, c_dm_jamkrida_mapping, c_dm_jamkrida_referensi,
             c_dm_jamkrida_audit, c_dm_jamkrida_pilot, c_premitrans
models:      curl_model
views/master: _jamkrida_pilot, v_dm_jamkrida, v_dm_jamkrida_mapping, v_dm_jamkrida_referensi,
             v_dm_jamkrida_audit, v_dm_jamkrida_pilot, modalCekIjp, v_dm_kredit, v_dm_kredit_koreksi
views/master/js: v_dm_jamkrida, v_dm_jamkrida_mapping, v_dm_jamkrida_referensi,
             v_dm_jamkrida_audit, v_dm_jamkrida_pilot, jamkrida_ijp, v_dm_kredit, v_dm_kredit_koreksi
views/transaksi: v_pembayaran_premitrans (+ js)
```

## 5. Verifikasi Pasca-Deploy

```bash
curl -s localhost:8087/api-jamkrida/actuator/health          # {"status":"UP"}
docker exec api-jamkrida printenv | grep -E 'APP_PROFILE|JAMKRIDA_BASE_URL'
docker exec api-jamkrida getent hosts jamkrida-online.co.id
```

| Uji | Diharapkan |
|-----|------------|
| Kunci Jamkrida ke jalur internal / kunci CBS ke `/publik/**` | 401 |
| Kantor di luar piloting membuka Integrasi Jamkrida | Ditolak dengan nama kantor |
| Kantor piloting / pusat | Layar tampil; pusat dapat memilih semua kantor |
| Sinkron referensi | 5 tipe terisi (produksi 01-10-2026: produk 7, agunan 23, sektor 32, cabang 29, pekerjaan 418) |
| Registrasi → Cek IJP → realisasi → rekon | Rekon cocok |
| **Audit log** setelah transaksi pertama | `request_url` menunjuk `…/api/ussi/public`, bukan `devapi` |
| Kirim, setor premi 201, bayar IJP, sertifikat | Sesuai [UAT](09-uat.md) |

**Gejala yang menyesatkan:**

| Terlihat | Sebenarnya |
|----------|------------|
| Realisasi sukses, dashboard kosong | `KRE_USING_JAMKRIDA_API≠YA` atau kantor bukan piloting |
| Semua kantor ditolak | Jar CBS naik sebelum migrasi (`jamkrida_kantor_pilot` belum ada) |
| Referensi tidak pernah terisi, log bersih | Base URL kurang `/public` → HTTP 404 hanya terlihat di respons sync |
| Cek IJP jalan, Kirim gagal | Pemetaan produk belum diisi |
| Jamkrida tidak menerima apa pun | `JAMKRIDA_BASE_URL`/profil masih `devapi` |
| `Permission denied` pada secret | Pemilik berkas bukan UID container |
| Layar kredit loader menggantung | Field khusus dev dibaca di produksi — periksa saklar `MODUL_*` |

## 6. Rollback Plan

| Tingkat | Langkah |
|---------|---------|
| Service | `cp app/api-jamkrida-jateng.jar.<timestamp> app/api-jamkrida-jateng.jar && ./redeploy.sh` |
| Menyeluruh | `UPDATE sys_mysysid SET keyvalue='TIDAK' WHERE keyname='KRE_USING_JAMKRIDA_API';` — CBS kembali ke alur lama; data `jamkrida_*` tetap tersimpan dan dapat dilanjutkan |
| Database | Tabel `jamkrida_*` berdiri sendiri, tidak perlu di-drop. Patch `premitrans` hanya menambah kolom nullable |
| Per kantor | Nonaktifkan lewat menu Kantor Piloting Jamkrida |

## 7. Kontak & Eskalasi

| Masalah | Pihak |
|---------|-------|
| Service, CBS, web | PT USSI Pinbuk Prima Software (pengembang) |
| Infrastruktur, DB, reverse proxy, kantor piloting | Tim IT BKK Jateng |
| API Jamkrida, status bundling, sertifikat | Tim pengembang PT Jamkrida Jateng (sertakan `trace_id`, jam kejadian, nomor rekening) |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 10 Oktober 2026 | | Dokumen dibuat dari DEPLOY.md, DEPLOY-PRODUCTION.md, dan catatan rilis produksi 01-10-2026 |

---

*[← Kembali ke API Jamkrida Jateng](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
