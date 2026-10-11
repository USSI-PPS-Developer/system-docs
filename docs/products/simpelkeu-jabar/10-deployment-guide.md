# 🚀 Deployment Guide — SimpelkeuJabar

> Panduan instalasi, rilis, verifikasi, dan rollback **SimpelkeuJabar** untuk dua lingkungan: **lokal (Docker)** dan **produksi (cPanel shared hosting, tanpa SSH)**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | SimpelkeuJabar      |
| Jenis Dokumen     | Deployment Guide    |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 11 Oktober 2026     |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Prasyarat (Prerequisites)

### 1.1 Produksi (cPanel)

| Komponen | Kebutuhan |
|----------|-----------|
| Hosting | cPanel dengan **File Manager**, **phpMyAdmin**, **MultiPHP Manager**. Terminal/SSH **tidak wajib**. |
| PHP | **≥ 7.4** (minimal 7.4 karena kode memakai *arrow function* `fn()`; fungsi PHP 8 seperti `str_contains` ditopang `symfony/polyfill-php80`). Produksi saat ini **ea-php74**. 8.1 juga didukung (versi lokal). |
| Ekstensi PHP | `pdo_mysql`, `mbstring`, `gd` (freetype + jpeg), `zip`, `bcmath`, `exif`, `xml`, `dom`, `fileinfo`, `openssl`, `tokenizer`, `ctype`, `json` |
| Database | MySQL / Percona **5.7** (InnoDB) |
| Limit PHP | `upload_max_filesize` & `post_max_size` ≥ **64M**, `memory_limit` ≥ **512M**, `max_execution_time` ≥ **300** (import Excel & render PDF rekap) |
| Domain & TLS | `https://simpelkeu.jabarprov.go.id`, sertifikat SSL aktif |

> ⚠️ **Versi PHP adalah keputusan terbuka.** PHP 7.4 sudah EOL dan Diskominfo menyarankan
> upgrade. Mereka juga menyarankan menghindari 8.1 karena sudah EOL. Sebelum mengganti versi
> di MultiPHP Manager, uji dulu di staging. Lihat §8.

### 1.2 Mesin pembangun paket rilis (laptop developer)

| Komponen | Kebutuhan |
|----------|-----------|
| Composer 2 | Untuk mengisi `vendor/` (server tidak menjalankan Composer) |
| Node.js & NPM | Hanya bila ada perubahan aset Laravel Mix (`npm run prod`). Tema `template/` sudah statis. |
| Akses repo | `git@github.com:USSI-PPS-Developer/SimpelkeuJabar.git` |

### 1.3 Lokal (Docker)

| Komponen | Kebutuhan |
|----------|-----------|
| Docker + Compose v2 | — |
| Container DB eksternal | `percona57` (Percona 5.7) pada network Docker `percona57_default`, port 3306 |
| Database | `simpelkeujabar_simpelku` sudah ter-restore dari dump |

## 2. Arsitektur Deployment

```
                Internet (HTTPS)
                       │
        ┌──────────────▼───────────────────────────────────────┐
        │ Apache (cPanel)  DocumentRoot = ROOT PROJECT          │
        │  .htaccess: rewrite → index.php (root)                │
        │             blokir dotfile, *.env/*.sql/*.log,        │
        │             composer.*, dan /app /config /vendor      │
        │             /storage /routes /resources /database ... │
        │  PHP-FPM / handler ea-php74                           │
        └──────────────┬───────────────────────────────────────┘
                       │
        ┌──────────────▼──────────────┐     ┌───────────────────────────────┐
        │ Laravel 8 (index.php root)  │────►│ MySQL/Percona 5.7 (localhost)  │
        │ sesi & cache: driver FILE   │     │ DB simpelkeujabar_simpelku     │
        └──────────────┬──────────────┘     └───────────────────────────────┘
                       │ tulis
        ┌──────────────▼────────────────────────────────────────────────────┐
        │ Folder writable: storage/, bootstrap/cache/, pdf/,                 │
        │ public/{uploads,kajiandekom,hasilkap,gcg,rups,jamkrida,            │
        │         profil_bank,cms/{banner,berita,produk,logo}}               │
        └────────────────────────────────────────────────────────────────────┘
```

**Hal yang berbeda dari Laravel standar (wajib dipahami):**

| Hal | Penjelasan |
|-----|------------|
| DocumentRoot = **root project** | Bukan `public/`. Front controller adalah `index.php` di root. Akibatnya aset di `public/` diakses dengan prefix **`/public/...`**, sedangkan tema di `/template/...`. |
| Pengamanan via `.htaccess` | Karena seluruh project bisa dijangkau dari web, `.htaccess` root **wajib ikut** terunggah. Tanpa file itu, `.env` dan kode sumber bisa diunduh siapa saja. |
| Skema DB tanpa migration | Tabel domain dibuat dari dump; perubahan dirilis sebagai **patch SQL aditif**. **Jangan** menjalankan `php artisan migrate` penuh. |
| Tanpa queue/cron/Redis | `QUEUE_CONNECTION=sync`, `CACHE_DRIVER=file`, `SESSION_DRIVER=file`. Tidak ada scheduler yang perlu dipasang. |
| Email | Tidak dipakai fitur apa pun. Konfigurasi `MAIL_*` boleh dibiarkan default. |

## 3. Konfigurasi Environment

### 3.1 `.env` produksi (dibuat manual di server, tidak ikut paket)

```ini
APP_NAME=SimpelkeuJabar
APP_ENV=production
APP_KEY=base64:...                 # salin dari .env produksi lama; JANGAN dibuat ulang
APP_DEBUG=false                    # WAJIB false
APP_URL=https://simpelkeu.jabarprov.go.id
ASSET_URL=https://simpelkeu.jabarprov.go.id
FORCE_HTTPS=true
APP_LOCALE=id

LOG_CHANNEL=stack
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=<nama_db_cpanel>
DB_USERNAME=<user_db_cpanel>       # disarankan user khusus aplikasi, bukan root
DB_PASSWORD=<password_db_cpanel>

CACHE_DRIVER=file
SESSION_DRIVER=file
SESSION_LIFETIME=120
SESSION_SECURE_COOKIE=true
QUEUE_CONNECTION=sync
# SESSION_NAME=simpelku            # opsional; default 'simpelku'. Bila diisi harus konsisten.
```

| Variabel | Catatan |
|----------|---------|
| `APP_KEY` | Mengganti nilai ini membuat seluruh sesi aktif tidak berlaku. Isi baru hanya untuk instalasi pertama (`php artisan key:generate` bila ada Terminal). |
| `APP_DEBUG` | `false` agar stack trace tidak bocor **dan** halaman error ber-branding tampil. |
| `APP_URL` | Dipakai untuk URL absolut di `/sitemap.xml`. Salah domain berarti sitemap salah. |
| `FORCE_HTTPS` | `true` memaksa skema URL https (dibaca via `config('app.force_https')`). |
| `LOG_LEVEL` | Bawaan `.env.example` adalah `debug`. Untuk produksi disarankan `error`. |

### 3.2 `.env` lokal (Docker)

Variabel di `docker-compose.yml` **menimpa** `.env` (`APP_ENV=local`, `APP_DEBUG=true`,
`APP_URL=http://localhost:8080`, koneksi ke host `percona57`). Bila `.env` belum ada,
entrypoint menyalin `.env.example` dan menjalankan `key:generate`.

### 3.3 Konfigurasi PHP

- **Lokal:** `docker/php.ini` → upload 64M, memori 512M, eksekusi 300 detik.
- **Produksi:** atur nilai setara lewat cPanel **MultiPHP INI Editor**.

## 4. Langkah Deployment

### 4.0 Pilih jalur

| Situasi | Jalur |
|---------|-------|
| Pengembangan / uji lokal | §4.1 Docker |
| **Rilis ke produksi (DB live sudah berisi laporan lembaga)** | §4.2 → §4.5 |
| Instalasi baru dari nol (server kosong) | §4.2 → §4.5, tetapi pada §4.3 pakai **impor penuh** |

### 4.1 Lokal (Docker)

```bash
# Pastikan container percona57 sudah jalan & DB simpelkeujabar_simpelku ada
docker compose up -d --build          # app di http://localhost:8080
docker compose logs -f app            # pantau; entrypoint menjalankan composer install bila vendor/ kosong
docker compose exec app php artisan optimize:clear
```

Entrypoint otomatis: `composer install --ignore-platform-reqs` (bila `vendor/` belum ada),
membuat `.env` bila belum ada, menyiapkan folder `storage/` & `bootstrap/cache/` beserta izinnya.

> `--ignore-platform-reqs` diperlukan karena paket lama `webpatser/laravel-uuid` menyatakan
> `php ^7.0`, padahal runtime-nya kompatibel dengan PHP 8.

### 4.2 Pra-deploy produksi (WAJIB)

1. **Umumkan jendela maintenance singkat.** Lembaga mengirim laporan hampir setiap hari.
2. **Backup DB:** phpMyAdmin → pilih DB → **Export** → *Quick* → SQL. Atau bila ada Terminal:
   ```bash
   mysqldump -u <user> -p --single-transaction --routines <db> > backup_$(date +%F_%H%M).sql
   ```
3. **Backup berkas:** `.env` produksi + folder dokumen `public/{uploads,kajiandekom,hasilkap,gcg,rups,jamkrida,profil_bank,cms}`.
4. **Backup kode yang berjalan.** Zip docroot saat ini (lewati folder dokumen besar) dan catat commit yang sedang dirilis.

### 4.3 Database

> 🚫 **JANGAN mengimpor dump penuh ke DB produksi.** Dump lokal akan **menimpa seluruh
> laporan** yang dikirim lembaga sejak dump itu dibuat. Rilis ke DB live bersifat
> **aditif saja**.

Jalankan di phpMyAdmin (tab **SQL**). Hanya skrip yang belum pernah diterapkan perlu dijalankan.

| Urutan | Berkas | Isi | Sifat |
|-------:|--------|-----|-------|
| 1 | `database/sql/2026_deploy_cms_pengurus.sql` | Membuat 7 tabel `cms_*` + `profile_bank_pengurus` (`CREATE TABLE IF NOT EXISTS`), lalu memindahkan data direksi lama ke tabel pengurus (dengan *guard* anti-dobel) | Aditif, **aman diulang** |
| 2 | *(manual, bila belum ada)* `m_pemegang_saham`, `t_kepemilikan_saham` | Tabel kepemilikan saham. DDL ada di `04-database-design.md` / CHANGELOG | Aditif |
| 3 | `database/sql/2026_07_19_perf_indexes.sql` | Index performa tabel transaksi & CMS | Aditif, **idempoten**, ONLINE, reversibel |

> Gunakan `2026_07_19_perf_indexes.sql` (idempoten). Berkas `2026_07_19_add_performance_indexes.sql`
> adalah versi lama yang **tidak idempoten**: error "Duplicate key name" bila dijalankan
> ulang. Jangan menjalankan keduanya, dan jangan juga menjalankan migration index-nya.

**Konten awal CMS** (hanya bila tabel `cms_*` baru & kosong):
- Dengan Terminal: `php artisan db:seed --class=CmsBannerSeeder` lalu
  `php artisan db:seed --class=CmsTimelineSeeder`.
- ⚠️ `CmsTimelineSeeder` menjalankan **TRUNCATE**. Jangan dijalankan bila timeline sudah diisi manual.
- Tanpa Terminal: admin mengisi konten melalui menu **Kelola Website**.

**Instalasi baru dari nol** (bukan DB live): buat DB + user di **MySQL® Databases**, lalu
impor penuh dump di phpMyAdmin. Dump yang sudah ber-index tidak perlu patch tambahan.

### 4.4 Paket kode & unggah

**a. Bangun paket di laptop**
```bash
git checkout main && git pull
composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --ignore-platform-reqs
# npm ci && npm run prod      # hanya bila ada perubahan aset Mix
php artisan optimize:clear     # pastikan tidak ada cache lokal yang terbawa
```

> Bangun `vendor/` dengan versi PHP yang **sama** dengan server (7.4 untuk produksi saat ini).
> Ini mencegah paket hasil resolusi PHP 8 tidak berjalan di server.

**b. Zip.** Isinya seluruh project, **termasuk `vendor/` dan `template/`**, dengan pengecualian berikut:

| Kecualikan | Alasan |
|------------|--------|
| `.git/`, `node_modules/` | Tidak dipakai runtime |
| `.env` lokal | Kredensial lokal; produksi memakai `.env` sendiri |
| `bootstrap/cache/*.php`, `storage/framework/views/*.php`, `storage/logs/*` | Cache/log lokal yang basi dan bisa mengunci path lokal |
| `Dockerfile`, `docker-compose.yml`, `docker/` | Khusus lokal |
| `pdf/*` | PDF laporan hasil generate |
| Isi folder dokumen `public/{uploads,kajiandekom,hasilkap,gcg,rups,jamkrida,profil_bank,cms/*}` | Data sensitif. **Jangan menimpa dokumen produksi.** Pertahankan `.gitkeep`. |
| `*.docx` surat, `error_log`, berkas Blade nyasar di root | Bukan bagian aplikasi |

**c. Unggah**
1. cPanel **File Manager** → docroot domain → **Settings → Show Hidden Files** (supaya `.htaccess` terlihat).
2. Unggah zip → **Extract** di docroot (`index.php` dan `.htaccess` harus berada langsung di docroot) → hapus zip.
3. Pastikan `.env` produksi masih ada dan tidak tertimpa.
4. Periksa baris handler PHP di akhir `.htaccess` (`ea-php74`). Isinya harus sesuai versi PHP
   yang dipilih di MultiPHP Manager; MultiPHP Manager akan menulis ulang baris ini bila versi diganti.

### 4.5 Finalisasi

1. **Kosongkan cache basi:** isi `bootstrap/cache/*.php` dan `storage/framework/views/*.php`.
   Dengan Terminal: `php artisan optimize:clear`.
2. *(Opsional, dengan Terminal)* bangun cache produksi:
   ```bash
   php artisan config:cache && php artisan route:cache && php artisan view:cache
   ```
   Langkah ini aman karena `SESSION_NAME` & `FORCE_HTTPS` dibaca via `config()`. Ingat untuk
   mengulang `config:cache` setiap kali `.env` diubah.
3. **Izin tulis** (File Manager → Permissions): folder `storage/`, `bootstrap/cache/`, `pdf/`,
   `public/uploads/`, dan folder dokumen/CMS. Umumnya **755** sudah cukup; gunakan **775**
   bila muncul *Permission denied*.
4. **Jangan** menjalankan `php artisan migrate` (tanpa `--path`).

## 5. Verifikasi Pasca-Deploy

### 5.1 Publik
- [ ] `/`, `/sejarah`, `/berita`, `/berita/{id}`, `/bank/{id}` tampil normal, gambar banner/logo tidak 404.
- [ ] `/sitemap.xml` → XML dengan domain `https://simpelkeu.jabarprov.go.id`; `/robots.txt` memuat baris `Sitemap:`.
- [ ] URL ngawur (mis. `/xyz`) → halaman **404 ber-branding**.

### 5.2 Keamanan
- [ ] `/.env`, `/composer.json`, `/.git/config` → **403/404**.
- [ ] `/vendor/autoload.php`, `/config/app.php`, `/storage/logs/laravel.log`, `/app/` → **403**.
- [ ] `/enc` dan `POST /referenceSql` → **404** (endpoint debug/berbahaya sudah dihapus).
- [ ] Tanpa login: `POST /laporanNeraca`, `GET /getListUser` → **401** atau redirect ke `/login`.
- [ ] Salah password 5× → terkunci ± 60 detik.

### 5.3 Fungsional per peran
- [ ] **Operator lembaga:** login → laporan hanya menampilkan data lembaga sendiri, walau `sandi_kantor` dimanipulasi lewat dev tools.
- [ ] **Operator lembaga:** import Realisasi yang *balance* → sukses; file *tidak balance* → ditolak **dan data lama utuh**.
- [ ] **Super-admin:** pilih lembaga apa pun; Rekap Per Lembaga tampil; Download Excel rekap berhasil (judul sheet ≤ 31 karakter).
- [ ] **Super-admin:** Kelola Website (tambah/edit berita/banner) dan Reset Password berjalan.
- [ ] Preview PDF & Download Excel minimal satu laporan per kelompok.
- [ ] Dashboard: KPI dan grafik terisi.

### 5.4 Pemantauan
- Pantau `storage/logs/laravel.log` dan `error_log` di docroot selama beberapa jam pertama.
- AJAX yang menerima **401** (sesi habis) harus mengarahkan pengguna ke login.

## 6. Rollback Plan

| Komponen | Cara balik | Risiko data |
|----------|------------|-------------|
| Kode | Ekstrak kembali zip docroot dari §4.2, lalu kosongkan `bootstrap/cache/*.php` & `storage/framework/views/*.php` | Tidak ada |
| Index DB | Jalankan `database/sql/2026_07_19_perf_indexes_rollback.sql` (hanya `DROP INDEX`) | Tidak ada |
| Tabel baru `cms_*` / pengurus | Biarkan saja; kode lama tidak memakainya | Tidak ada |
| Config cache | `php artisan optimize:clear` atau kosongkan `bootstrap/cache/*.php` | Tidak ada |
| **Data laporan** | Restore dari backup §4.2 **hanya sebagai upaya terakhir**: data yang masuk setelah backup akan hilang | **Tinggi** |

Semua patch rilis bersifat aditif, jadi rollback kode tidak memerlukan rollback data.

## 7. Kontak & Eskalasi

| Peran | Nama | Kontak |
|-------|------|--------|
| PIC Aplikasi (vendor) | | |
| Admin server / cPanel (Diskominfo Jabar) | | |
| PIC bisnis Pemprov Jabar | | |

## 8. Catatan Terbuka

| No | Catatan |
|----|---------|
| 1 | **Versi PHP produksi.** Masih 7.4 (EOL). `DEPLOY_CPANEL.md` di repo menyarankan 8.1, sementara Diskominfo menyarankan menghindari 8.1. Tentukan target versi yang didukung (mis. 8.2/8.3), lalu uji di staging. Laravel 8 resmi hanya mendukung sampai PHP 8.1, jadi target di atasnya mensyaratkan upgrade framework. |
| 2 | **Laravel 8 EOL.** Upgrade ke Laravel 10/11 adalah proyek terpisah. |
| 3 | **Kredensial DB.** Gunakan user DB khusus aplikasi dengan hak terbatas (bukan root) dan rotasi password yang pernah tercatat di repo. |
| 4 | **Belum ada staging.** Disarankan subdomain staging dengan salinan DB yang dianonimkan. |
| 5 | **DocumentRoot ke `public/`.** Pemindahan ini akan menghapus ketergantungan pada aturan `.htaccess`, tetapi memerlukan penyesuaian URL aset `/public/...` dan `template/`. |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Perubahan | Oleh |
|-------|---------|-----------|------|
| 1.0.0 | 11 Okt 2026 | Draft awal, dirangkum dari `DEPLOY_CPANEL.md`, `DEPLOY_CHECKLIST.md`, `database/sql/README_patch_db.md`, `Dockerfile`, dan `.htaccess`. | |

*[← Kembali ke README produk](README.md)*
