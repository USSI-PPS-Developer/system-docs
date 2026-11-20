# 🗄️ Desain Database — Mobile Branchless

> Rancangan struktur basis data untuk produk **Mobile Branchless** — mencakup ketiga lapis penyimpanan: SQLite lokal di perangkat petugas, database API pusat, dan database Core Banking lembaga.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | Mobile Branchless     |
| Jenis Dokumen     | Desain Database         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 16 November 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 0. Ikhtisar & Konteks

Data Mobile Branchless tersebar di **tiga lapis** yang dimiliki tiga repositori berbeda.
Tidak ada satu database tunggal; data berpindah antar-lapis lewat API (bukan koneksi DB langsung
dari perangkat).

| Lapis | Mesin | Basis data | Pemilik (repo) | Isi |
|-------|-------|------------|----------------|-----|
| **A. Perangkat petugas** | SQLite (`expo-sqlite`) | `branchless2025.db` | `Mobile-Branchless` | Transaksi harian, log aktivitas, saldo kas — ditulis aplikasi (offline-first). |
| | SQLite | `dbbranchless_YYMMDD.db` | dibangkitkan `backend-client-branchless`, diunduh mobile | `master_nasabah` — salinan *read-only* rekening tabungan, satu berkas per tanggal. |
| **B. API pusat** | MySQL 8.0 | `branchless` | `backend-branchless` | Lembaga, device, user dashboard, log kas harian, lokasi petugas, approval device. |
| **C. API lembaga / Core Banking** | MySQL 5.5 | `dbcore` | `backend-client-branchless` + Core Banking IBS | Tabel integrasi `branchless_transaksi` + tabel core (`tabung`, `tabtrans`, jurnal GL, `app_otorisasi`). |
| | MySQL 5.5 | `dbcore_sys` | Core Banking IBS | `sys_daftar_user` (petugas, limit, otorisator). |

> ℹ️ **`dbcore` / `dbcore_sys` adalah nama generik.** Nama database sebenarnya berbeda per lembaga
> dan ditentukan di `app.ini` backend lembaga (`[database_main]`, `[database_sys]`). Satu API pusat
> melayani banyak lembaga; tiap lembaga punya instance `backend-client-branchless` dan core sendiri.

Catatan penting:

- **Skema pada dokumen ini diambil dari `information_schema` instance development** (16 November
  2026) dan dicocokkan dengan kode. Di beberapa tempat skema aktual **berbeda dari berkas DDL di
  repo** — lihat [§6](#6-selisih-ddl-repo-vs-skema-aktual).
- **Tidak ada auto-migrate.** Kedua backend memakai JDBC mentah (`JdbcTemplate`/`PreparedStatement`),
  JPA dimatikan, dan Flyway **tidak terpasang**. Berkas `db/migration/V*.sql` dijalankan manual
  oleh tim deploy. Mobile membuat tabelnya sendiri (`CREATE TABLE IF NOT EXISTS`) saat aplikasi mulai.
- **Kepemilikan tabel core:** tabel Core Banking IBS (`tabung`, `nasabah`, `tabtrans`,
  `transaksi_master/detail`, `app_otorisasi`, `sys_daftar_user`, dll.) dikelola tim core —
  **jangan ubah struktur/format kolomnya** dari sisi branchless. Dokumen ini hanya mencatat kolom
  yang disentuh branchless.
- Di luar basis data, perangkat juga menyimpan state di **SecureStore** (sesi, kunci kas harian,
  konfigurasi printer) — daftar kuncinya ada di [SRS](02-srs.md), bukan cakupan dokumen ini.
- OTP penarikan **tidak disimpan di tabel**: backend lembaga menyimpannya di cache memori proses.

### Alur data antar-lapis

```
 PERANGKAT (SQLite)                 API LEMBAGA (dbcore)                    CORE BANKING
 ─────────────────                  ────────────────────                    ────────────
 master_nasabah  ◄── unduh harian ── WorkerDB 01:00 ◄─ tabung+nasabah+tab_produk
 Transaksi ──── POST /transaksi/sync ──► branchless_transaksi
   (isSync 0→1)  POST /transaksi/penarikan      │ worker tiap 5 detik
                                                ├──► tabtrans            (mutasi tabungan)
                                                └──► transaksi_master/detail (jurnal GL)
 OtorisasiModal ─ /transaksi/otorisasi-* ──► app_otorisasi ◄── otorisator menyetujui di core
 Login ───────── POST /login ──────────────► sys_daftar_user (dbcore_sys)

 PERANGKAT                          API PUSAT (branchless)
 SaldoKas (buka/tutup) ─ POST /devices/kas ──────► device_kas_log
 lokasi tiap 60 dtk ──── POST /devices/user/location ► user_device_location
 kode lembaga ────────── GET /lembaga/kode/:kode ──► lembaga
 (cek device saat login, via API lembaga) ─────────► devices
```

---

## 1. Daftar Tabel

### 1.1 Lapis A — SQLite di perangkat

| No | Basis data | Nama Tabel | Deskripsi |
|----|-----------|-----------|-----------|
| 1 | `branchless2025.db` | `Transaksi` | Transaksi setoran/penarikan/angsuran petugas, dengan status sync & reversal. |
| 2 | `branchless2025.db` | `LogAktivitas` | Jejak audit aktivitas di perangkat. |
| 3 | `branchless2025.db` | `SaldoKas` | Buku saldo kas petugas, *append-only* (saldo berjalan). |
| 4 | `branchless2025.db` | `TransaksiBackup`, `LogAktivitasBackup`, `SaldoKasBackup` | Salinan tabel 1–3 untuk backup harian (lihat catatan §2.1). |
| 5 | `dbbranchless_YYMMDD.db` | `master_nasabah` | Master rekening tabungan aktif, *read-only*, diunduh per tanggal. |

### 1.2 Lapis B — Database API pusat (`branchless`)

| No | Nama Tabel | Deskripsi |
|----|-----------|-----------|
| 6 | `lembaga` | Master lembaga (BPR/koperasi) + `api_url` backend lembaga & setting per lembaga. |
| 7 | `devices` | Perangkat petugas terdaftar per lembaga, terikat ke satu user core. |
| 8 | `users` | Pengguna **dashboard admin** (Admin USSI / admin lembaga) — bukan petugas lapangan. |
| 9 | `admin_session` | Sesi login dashboard (hanya hash token). |
| 10 | `device_approval_request` | Log pengajuan & keputusan registrasi/penghapusan device. |
| 11 | `device_user_history` | Riwayat audit penggantian user pada device. |
| 12 | `device_kas_log` | Log buka/tutup/buka-ulang kas harian per device. |
| 13 | `user_device_location` | Lokasi petugas (3 hari terakhir). |
| 14 | `user_device_location_YYYYMMDD` | Arsip lokasi harian, dibuat otomatis oleh job rotasi. |
| 15 | `otorisasi_transaksi` | ⚠️ **Legacy** — otorisasi versi lama via dashboard; sudah digantikan `app_otorisasi` core. |

### 1.3 Lapis C — Database lembaga (`dbcore`, `dbcore_sys`)

| No | Skema | Nama Tabel | Pemilik | Deskripsi |
|----|-------|-----------|---------|-----------|
| 16 | `dbcore` | `branchless_transaksi` | **Branchless** | Tabel integrasi: transaksi dari perangkat sebelum diposting ke core. |
| 17 | `dbcore` | `app_otorisasi` | Core | Permintaan otorisasi; branchless menulis & membaca status. |
| 18 | `dbcore` | `tabung` | Core | Rekening tabungan (sumber master nasabah, saldo tertahan, kode integrasi). |
| 19 | `dbcore` | `nasabah` | Core | Data nasabah (nama, alamat, HP untuk OTP). |
| 20 | `dbcore` | `tab_produk` | Core | Master produk tabungan. |
| 21 | `dbcore` | `tabtrans` | Core | Mutasi tabungan — ditulis worker posting. |
| 22 | `dbcore` | `transaksi_master`, `transaksi_detail` | Core | Jurnal GL (header + baris debet/kredit) — ditulis worker posting. |
| 23 | `dbcore` | `tab_integrasi` | Core | Pemetaan kode integrasi tabungan → kode perkiraan GL. |
| 24 | `dbcore` | `app_kode_kantor` | Core | Master kantor (nama & alamat untuk struk). |
| 25 | `dbcore_sys` | `sys_daftar_user` | Core | User core: kredensial petugas, limit, izin login branchless, kewenangan otorisator. |

> Di `dbcore` juga terdapat tabel `branchless_geolocation_trans`, tetapi **tidak dirujuk kode
> branchless saat ini** (kemungkinan dipakai modul core lain) — di luar cakupan dokumen ini.

---

## 2. Detail Tabel

### 2.1 Lapis A — `branchless2025.db` (ditulis aplikasi)

Lokasi: direktori SQLite standar aplikasi. Dibuat oleh `src/db/sqlite.ts` saat `App.tsx` mulai.
SQLite tidak menegakkan panjang kolom; tipe di bawah adalah *type affinity*.

Kolom bertanda 🔒 disimpan **ter-encode** dengan `encrypt()` di `src/utils/authUtils.ts`
(`base64(teks + salt)`) — ini **obfuskasi, bukan enkripsi**. Karena deterministik, pencarian
dilakukan dengan `WHERE rekening = encrypt(?)`.

#### Tabel: `Transaksi`
> Setiap transaksi yang dilakukan petugas. Setoran & angsuran ditulis lokal dulu (`isSync = 0`);
> penarikan baru ditulis setelah server membalas sukses (`isSync = 1`).

| No | Kolom | Tipe | Null | Keterangan |
|----|-------|------|------|------------|
| 1 | `id` | `TEXT` | NOT NULL | **PK**. `"TRX" + epoch ms + 6 karakter acak`, dibuat di perangkat. |
| 2 | `rekening` | `TEXT` | NULL | 🔒 Nomor rekening nasabah. |
| 3 | `nama` | `TEXT` | NULL | 🔒 Nama nasabah. |
| 4 | `nominal` | `TEXT` | NULL | 🔒 Nominal (string angka bulat rupiah). |
| 5 | `noRef` | `TEXT` | NULL | 🔒 Nomor referensi struk; menjadi `no_ref` di server & `KUITANSI`/`NO_BUKTI` di core. |
| 6 | `produk` | `TEXT` | NULL | Nama produk (dari `master_nasabah.nama_produk`). |
| 7 | `tanggal` | `TEXT` | NULL | Tanggal transaksi (waktu lokal perangkat); dinormalisasi ke `YYYY-MM-DD` saat sync. |
| 8 | `jam` | `TEXT` | NULL | Jam transaksi; dinormalisasi ke `HH:mm:ss` saat sync. |
| 9 | `keteranganTrx` | `TEXT` | NULL | 🔒 Keterangan bebas. |
| 10 | `tipe` | `TEXT` | NULL | `setoran` / `penarikan` / `angsuran`. |
| 11 | `isSync` | `INTEGER` | NULL | `0` = belum terkirim, `1` = sudah diterima server. |
| 12 | `isReversal` | `INTEGER` | NULL | `1` = transaksi sudah di-reversal. |
| 13 | `userId` | `TEXT` | NULL | `user_id` petugas (= `sys_daftar_user.USER_ID`). Semua query disaring per `userId`. |

**Primary Key:** `id` · **Index:** tidak ada selain PK.

#### Tabel: `LogAktivitas`
| No | Kolom | Tipe | Null | Keterangan |
|----|-------|------|------|------------|
| 1 | `id` | `INTEGER` | NOT NULL | **PK** AUTOINCREMENT. |
| 2 | `waktu` | `TEXT` | NULL | `toLocaleString("id-ID")` → `dd/mm/yyyy hh.mm.ss`. |
| 3 | `aktivitas` | `TEXT` | NULL | Mis. `Insert Transaksi`, `Reversal Transaksi`. |
| 4 | `detail` | `TEXT` | NULL | 🔒 Rincian aktivitas. |
| 5 | `userId` | `TEXT` | NULL | Petugas pelaku. |

#### Tabel: `SaldoKas`
> Buku kas *append-only*. Tiap baris menyimpan mutasi **dan** saldo berjalan; baris tidak pernah
> di-update. Saldo kas saat ini = `saldo` pada baris ber-`id` terbesar milik `userId`.

| No | Kolom | Tipe | Null | Keterangan |
|----|-------|------|------|------------|
| 1 | `id` | `INTEGER` | NOT NULL | **PK** AUTOINCREMENT. |
| 2 | `waktu` | `TEXT` | NULL | `dd/mm/yyyy hh.mm.ss` (locale `id-ID`). |
| 3 | `aktivitas` | `TEXT` | NULL | Tipe mutasi: `setoran` / `angsuran` (kas masuk), `penarikan` (kas keluar). Saldo awal buka kas dicatat lewat fungsi yang sama. |
| 4 | `nominal` | `INTEGER` | NULL | Mutasi bertanda: positif = masuk, negatif = keluar. |
| 5 | `saldo` | `INTEGER` | NULL | Saldo setelah mutasi. |
| 6 | `userId` | `TEXT` | NULL | Pemilik kas. |

#### Tabel: `TransaksiBackup`, `LogAktivitasBackup`, `SaldoKasBackup`
Dibuat dengan `CREATE TABLE IF NOT EXISTS … AS SELECT * FROM <tabel>` — kolom sama dengan tabel
asal, **tanpa** PK/AUTOINCREMENT.

> ⚠️ **Status saat ini:** `backupAndResetHarian()` dan `cleanOldBackup()` tersedia di
> `src/db/sqlite.ts` tetapi **tidak dipanggil** (hanya di-*import* di `App.tsx`). Tabel `*Backup`
> karenanya tidak terbentuk pada instalasi baru. Selain itu `CREATE … IF NOT EXISTS AS SELECT`
> hanya menyalin data pada pemanggilan pertama, dan pembersihan > 7 hari membandingkan kolom
> berformat `dd/mm/yyyy` dengan tanggal ISO. Perlu dibenahi sebelum fitur backup diaktifkan.

### 2.2 Lapis A — `dbbranchless_YYMMDD.db` (diunduh, read-only)

Lokasi: `<cacheDirectory>/dbbranchless_YYMMDD.db`. Dibangkitkan backend lembaga (`WorkerDB`)
tiap hari pukul **01:00** atau manual lewat `GET /worker/generate-master-nasabah`, lalu diunduh
mobile via `GET /db/download/:YYMMDD`. Berkas kemarin tidak dipakai hari ini; login ditolak bila
berkas hari ini belum ada. Bila device punya `devices.kode_kantor`, lembaga membangkitkan
`dbbranchless_YYMMDD_<kantor>.db` sesuai permintaan (hanya `tabung.kode_kantor` tersebut);
berkas cron 01:00 tetap berisi semua kantor. Di perangkat berkas selalu disimpan sebagai
`dbbranchless_YYMMDD.db`.

#### Tabel: `master_nasabah`
> Sumber: `tabung ⨝ nasabah ⨝ tab_produk` dengan syarat `tabung.status IN (0,1)` dan
> `saldo_akhir > 0`.

| No | Kolom | Tipe | Sumber di core | Keterangan |
|----|-------|------|----------------|------------|
| 1 | `no_rekening` | `TEXT` | `tabung.no_rekening` | **PK**. |
| 2 | `kode_produk` | `TEXT` | `tabung.kode_produk` | |
| 3 | `nama_produk` | `TEXT` | `tab_produk.deskripsi_produk` | |
| 4 | `nama_nasabah` | `TEXT` | `nasabah.nama_nasabah` | Dicari dengan `LIKE`. |
| 5 | `alamat` | `TEXT` | `nasabah.alamat` | |
| 6 | `kode_kantor` | `TEXT` | `tabung.kode_kantor` | Filter kantor petugas. |
| 7 | `kode_group1` | `TEXT` | `tabung.kode_group1` | Filter wilayah/kolektor sesuai setting device. |
| 8 | `kode_group2` | `TEXT` | `tabung.kode_group2` | |
| 9 | `kode_group3` | `TEXT` | `tabung.kode_group3` | |
| 10 | `saldo_akhir` | `REAL` | `tabung.saldo_akhir` | Saldo saat berkas dibangkitkan (bukan saldo real-time). Ditambahkan belakangan — berkas lama tidak memilikinya. |

Data **tidak di-encode** (teks biasa). Ukuran contoh di dev: ± 468 ribu baris.

### 2.3 Lapis B — Database API pusat (`branchless`)

MySQL 8.0, InnoDB, `utf8mb4_0900_ai_ci`.

#### Tabel: `lembaga`
| No | Kolom | Tipe Data | Null | Default | Keterangan |
|----|-------|-----------|------|---------|------------|
| 1 | `id` | `BIGINT` | NOT NULL | AUTO_INCREMENT | **PK**. |
| 2 | `kode_lembaga` | `VARCHAR(20)` | NOT NULL | | **UNIQUE**. Kode yang dimasukkan petugas di aplikasi. |
| 3 | `nama_lembaga` | `VARCHAR(150)` | NOT NULL | | |
| 4 | `alamat` | `VARCHAR(255)` | NULL | | |
| 5 | `kota` | `VARCHAR(100)` | NULL | | |
| 6 | `provinsi` | `VARCHAR(100)` | NULL | | |
| 7 | `no_telp` | `VARCHAR(30)` | NULL | | |
| 8 | `email` | `VARCHAR(150)` | NULL | | |
| 9 | `api_url` | `VARCHAR(255)` | NULL | | Base URL backend lembaga; dikirim ke mobile & dipakai pusat untuk proxy. |
| 10 | `client_key` | `VARCHAR(128)` | NULL | | Kunci service-to-service (header `X-Client-Key`). **Tidak pernah diekspos lewat API**; diisi tim deploy. |
| 11 | `wajib_buka_kas` | `TINYINT(1)` | NOT NULL | `1` | `0` = buka kas dilewati di mobile. |
| 12 | `status_aktif` | `TINYINT(1)` | NOT NULL | `1` | Lembaga nonaktif → lookup kode & login device ditolak. |
| 13 | `created_at` | `TIMESTAMP` | NULL | `CURRENT_TIMESTAMP` | |
| 14 | `updated_at` | `TIMESTAMP` | NULL | `CURRENT_TIMESTAMP ON UPDATE` | |

**Index:** `PRIMARY (id)`, `UNIQUE kode_lembaga (kode_lembaga)`.

#### Tabel: `devices`
> Satu baris per perangkat. Login mobile hanya lolos bila ada baris dengan kombinasi
> `device_uuid` + lembaga + `user_name` yang aktif dan `approval_status` ∈ (`APPROVED`, `PENDING_DELETE`).

| No | Kolom | Tipe Data | Null | Default | Keterangan |
|----|-------|-----------|------|---------|------------|
| 1 | `id` | `BIGINT` | NOT NULL | AUTO_INCREMENT | **PK**. |
| 2 | `lembaga_id` | `BIGINT` | NOT NULL | | **FK** → `lembaga.id`. |
| 3 | `device_uuid` | `VARCHAR(200)` | NOT NULL | | ID perangkat (header `X-Device-Id`). Tidak ada constraint unik. |
| 4 | `device_name` | `VARCHAR(150)` | NULL | | |
| 5 | `user_name` | `VARCHAR(255)` | NULL | | `USER_NAME` core yang terikat ke device. Hanya diubah lewat *ganti user* (tercatat di `device_user_history`). |
| 6 | `os_version` | `VARCHAR(50)` | NULL | | |
| 7 | `app_version` | `VARCHAR(50)` | NULL | | |
| 8 | `last_login_at` | `DATETIME` | NULL | | Diperbarui backend lembaga saat login sukses. |
| 9 | `is_active` | `TINYINT(1)` | NULL | `1` | |
| 10–14 | `kode_group1` … `kode_group5` | `VARCHAR(10)` | NULL | | Filter nasabah untuk device ini (mobile memakai 1–3). |
| 15 | `limit_setoran` | `DECIMAL(18,2)` | NOT NULL | `0.00` | **Cadangan** — dipakai hanya bila kolom limit core tidak ada. |
| 16 | `limit_penarikan` | `DECIMAL(18,2)` | NOT NULL | `0.00` | Idem. |
| 17 | `created_at` | `TIMESTAMP` | NULL | `CURRENT_TIMESTAMP` | |
| 18 | `updated_at` | `TIMESTAMP` | NULL | `CURRENT_TIMESTAMP ON UPDATE` | |
| 19 | `approval_status` | `VARCHAR(20)` | NOT NULL | `APPROVED` | `APPROVED` / `PENDING_REGISTER` / `PENDING_DELETE` / `REJECTED`. |
| 20 | `kode_kantor` | `VARCHAR(10)` | NULL | | `KODE_KANTOR` core (`app_kode_kantor`). Membatasi isi DB master yang diunduh device ke nasabah kantor ini; NULL = semua kantor. Migrasi `V9`. |

**Index:** `PRIMARY (id)`, `fk_device_lembaga (lembaga_id)` · **FK:** `fk_device_lembaga`: `lembaga_id` → `lembaga(id)`.

#### Tabel: `users`
> Akun dashboard admin. Petugas lapangan **tidak** ada di sini (mereka user core).

| No | Kolom | Tipe Data | Null | Default | Keterangan |
|----|-------|-----------|------|---------|------------|
| 1 | `id` | `BIGINT` | NOT NULL | AUTO_INCREMENT | **PK**. |
| 2 | `lembaga_id` | `BIGINT` | NULL | | **FK** → `lembaga.id`. `NULL` = Admin USSI (lintas lembaga). |
| 3 | `username` | `VARCHAR(100)` | NOT NULL | | **UNIQUE**; login membandingkan `BINARY` (case-sensitive). |
| 4 | `password` | `VARCHAR(255)` | NOT NULL | | ⚠️ Dibandingkan langsung dengan nilai kiriman klien (tanpa hash di server). |
| 5 | `full_name` | `VARCHAR(150)` | NOT NULL | | |
| 6 | `role` | `VARCHAR(50)` | NOT NULL | | Role dashboard (admin pusat / lembaga). |
| 7 | `is_active` | `TINYINT(1)` | NULL | `1` | Menonaktifkan user langsung memutus sesinya. |
| 8 | `last_login_at` | `DATETIME` | NULL | | |
| 9 | `created_at` | `TIMESTAMP` | NULL | `CURRENT_TIMESTAMP` | |
| 10 | `updated_at` | `TIMESTAMP` | NULL | `CURRENT_TIMESTAMP ON UPDATE` | |

**Index:** `PRIMARY (id)`, `UNIQUE username`, `fk_user_lembaga (lembaga_id)` · **FK:** `lembaga_id` → `lembaga(id)`.

#### Tabel: `admin_session`
| No | Kolom | Tipe Data | Null | Default | Keterangan |
|----|-------|-----------|------|---------|------------|
| 1 | `token_hash` | `CHAR(64)` | NOT NULL | | **PK**. SHA-256 dari token; token asli hanya ada di browser. |
| 2 | `user_id` | `BIGINT` | NOT NULL | | → `users.id` (tanpa FK). |
| 3 | `created_at` | `DATETIME` | NOT NULL | `CURRENT_TIMESTAMP` | |
| 4 | `expires_at` | `DATETIME` | NOT NULL | | `NOW() + [admin] session_hours`. Baris kedaluwarsa dihapus saat login berikutnya. |

**Index:** `PRIMARY (token_hash)`, `idx_admin_session_user (user_id)`, `idx_admin_session_expires (expires_at)`.

#### Tabel: `device_approval_request`
> Log pengajuan registrasi/penghapusan device oleh lembaga dan keputusan Admin USSI. Dasar rekap
> tagihan per device. Data device **disalin** agar jejak tetap terbaca setelah device dihapus.

| No | Kolom | Tipe Data | Null | Default | Keterangan |
|----|-------|-----------|------|---------|------------|
| 1 | `id` | `BIGINT` | NOT NULL | AUTO_INCREMENT | **PK**. |
| 2 | `device_id` | `BIGINT` | NOT NULL | | `devices.id` saat pengajuan (tanpa FK). |
| 3 | `device_uuid` | `VARCHAR(200)` | NOT NULL | | Salinan. |
| 4 | `device_name` | `VARCHAR(200)` | NULL | | Salinan. |
| 5 | `user_name` | `VARCHAR(100)` | NULL | | Salinan. |
| 6 | `lembaga_id` | `BIGINT` | NOT NULL | | |
| 7 | `action` | `VARCHAR(20)` | NOT NULL | | `REGISTER` / `DELETE`. |
| 8 | `status` | `VARCHAR(20)` | NOT NULL | `PENDING` | `PENDING` / `APPROVED` / `REJECTED` / `CANCELLED`. |
| 9 | `alasan` | `VARCHAR(255)` | NULL | | |
| 10 | `requested_by` | `VARCHAR(100)` | NOT NULL | | |
| 11 | `requested_by_role` | `VARCHAR(50)` | NULL | | |
| 12 | `requested_at` | `TIMESTAMP` | NOT NULL | `CURRENT_TIMESTAMP` | |
| 13 | `reviewed_by` | `VARCHAR(100)` | NULL | | |
| 14 | `reviewed_at` | `TIMESTAMP` | NULL | | |
| 15 | `catatan_review` | `VARCHAR(255)` | NULL | | |

**Index:** `PRIMARY (id)`, `idx_dar_status (status, requested_at)`, `idx_dar_lembaga (lembaga_id, requested_at)`, `idx_dar_device (device_id)`.

#### Tabel: `device_user_history`
| No | Kolom | Tipe Data | Null | Default | Keterangan |
|----|-------|-----------|------|---------|------------|
| 1 | `id` | `BIGINT` | NOT NULL | AUTO_INCREMENT | **PK**. |
| 2 | `device_id` | `BIGINT` | NOT NULL | | |
| 3 | `device_uuid` | `VARCHAR(200)` | NOT NULL | | Salinan. |
| 4 | `lembaga_id` | `BIGINT` | NOT NULL | | Salinan. |
| 5 | `old_user_name` | `VARCHAR(100)` | NULL | | |
| 6 | `new_user_name` | `VARCHAR(100)` | NOT NULL | | |
| 7 | `alasan` | `VARCHAR(255)` | NOT NULL | | Wajib diisi. |
| 8 | `changed_by` | `VARCHAR(100)` | NOT NULL | | |
| 9 | `changed_by_role` | `VARCHAR(50)` | NULL | | |
| 10 | `created_at` | `TIMESTAMP` | NOT NULL | `CURRENT_TIMESTAMP` | |

**Index:** `PRIMARY (id)`, `idx_duh_device (device_id, created_at)`, `idx_duh_lembaga (lembaga_id, created_at)` · *Append-only.*

#### Tabel: `device_kas_log`
> Log event kas harian per device, *append-only*. **Status kas suatu device pada suatu tanggal =
> event terakhir (id terbesar)** untuk `(device_uuid, tanggal)`.

| No | Kolom | Tipe Data | Null | Default | Keterangan |
|----|-------|-----------|------|---------|------------|
| 1 | `id` | `BIGINT` | NOT NULL | AUTO_INCREMENT | **PK**. |
| 2 | `device_uuid` | `VARCHAR(200)` | NOT NULL | | |
| 3 | `lembaga_id` | `BIGINT` | NOT NULL | | |
| 4 | `user_name` | `VARCHAR(100)` | NULL | | Petugas. |
| 5 | `tanggal` | `DATE` | NOT NULL | | Tanggal kas (lokal perangkat). |
| 6 | `event` | `VARCHAR(10)` | NOT NULL | | `BUKA` / `TUTUP` (dari mobile), `REOPEN` (dari dashboard). |
| 7 | `saldo` | `DECIMAL(18,2)` | NULL | | Saldo kas saat event. |
| 8 | `alasan` | `VARCHAR(255)` | NULL | | Alasan buka ulang. |
| 9 | `actor` | `VARCHAR(100)` | NULL | | Admin yang membuka ulang. |
| 10 | `actor_role` | `VARCHAR(50)` | NULL | | |
| 11 | `created_at` | `TIMESTAMP` | NOT NULL | `CURRENT_TIMESTAMP` | |

**Index:** `PRIMARY (id)`, `idx_dkl_device_tgl (device_uuid, tanggal, id)`, `idx_dkl_lembaga_tgl (lembaga_id, tanggal)`.

#### Tabel: `user_device_location` dan `user_device_location_YYYYMMDD`
| No | Kolom | Tipe Data | Null | Default | Keterangan |
|----|-------|-----------|------|---------|------------|
| 1 | `id` | `BIGINT` | NOT NULL | AUTO_INCREMENT | **PK**. |
| 2 | `username` | `VARCHAR(100)` | NOT NULL | | Petugas. |
| 3 | `lat` | `DOUBLE` | NOT NULL | | |
| 4 | `lng` | `DOUBLE` | NOT NULL | | |
| 5 | `waktu` | `TIMESTAMP` | NOT NULL | | Waktu dari perangkat. |
| 6 | `device_id` | `VARCHAR(200)` | NULL | | Berisi **`devices.device_uuid`** (bukan `devices.id`). |
| 7 | `created_at` | `TIMESTAMP` | NULL | `CURRENT_TIMESTAMP` | Waktu server (UTC; query dashboard mengonversi ke +07:00). |

**Index:** hanya `PRIMARY (id)`.

Job `RotateLogLocation` (tiap hari **00:30**) memindahkan baris berumur ≥ 3 hari ke tabel
`user_device_location_YYYYMMDD` (`CREATE TABLE … LIKE` tabel induk), lalu menghapusnya dari induk.

#### Tabel: `otorisasi_transaksi` ⚠️ Legacy
> Otorisasi versi lama (disetujui dari dashboard branchless). **Sudah digantikan** `app_otorisasi`
> core; mobile tidak lagi memakainya dan menu approval dashboard sudah dihapus. Endpoint lamanya
> masih ada di `backend-branchless` dan tabel dibuat *on-the-fly* (`CREATE TABLE IF NOT EXISTS` +
> `ALTER` di dalam kode). Kandidat dihapus.

| No | Kolom | Tipe Data | Null | Default | Keterangan |
|----|-------|-----------|------|---------|------------|
| 1 | `id` | `VARCHAR(50)` | NOT NULL | | **PK**. `REQ` + epoch ms + 3 digit acak. |
| 2 | `rekening` | `VARCHAR(30)` | NOT NULL | | |
| 3 | `nominal` | `DECIMAL(18,2)` | NOT NULL | | |
| 4 | `tipe` | `VARCHAR(20)` | NOT NULL | | |
| 5 | `user_id` | `VARCHAR(50)` | NOT NULL | | |
| 6 | `detail` | `TEXT` | NULL | | |
| 7 | `status` | `VARCHAR(20)` | NULL | `pending` | `pending` / `approved` / `rejected`. |
| 8 | `created_at` | `TIMESTAMP` | NULL | `CURRENT_TIMESTAMP` | |
| 9 | `updated_at` | `TIMESTAMP` | NULL | `CURRENT_TIMESTAMP ON UPDATE` | |
| 10 | `lembaga` | `VARCHAR(100)` | NULL | | |
| 11 | `authorized_by` | `VARCHAR(100)` | NULL | | |
| 12 | `authorized_at` | `TIMESTAMP` | NULL | | |

### 2.4 Lapis C — Tabel milik Branchless di `dbcore`

MySQL 5.5, InnoDB.

#### Tabel: `branchless_transaksi`
> Tabel integrasi (staging). Transaksi dari perangkat mendarat di sini, lalu worker
> (`WorkerTransaksiChecker`, jeda 5 detik) mempostingnya ke `tabtrans` + jurnal GL dan menandai
> `is_posted = 1`. Collation `utf8_general_ci` (berbeda dari tabel core yang `latin1`).

| No | Kolom | Tipe Data | Null | Default | Keterangan |
|----|-------|-----------|------|---------|------------|
| 1 | `id` | `BIGINT(20)` | NOT NULL | AUTO_INCREMENT | **PK**. |
| 2 | `rekening` | `VARCHAR(30)` | NOT NULL | | → `tabung.no_rekening` (tanpa FK). |
| 3 | `nama` | `VARCHAR(150)` | NULL | | Nama nasabah (salinan dari perangkat). |
| 4 | `nominal` | `DECIMAL(18,2)` | NOT NULL | `0.00` | |
| 5 | `no_ref` | `VARCHAR(50)` | NULL | | `Transaksi.noRef`. **Kunci idempotensi**: `no_ref` yang sudah ada ditolak/dilewati. Tidak ada constraint UNIQUE — dijaga di kode. |
| 6 | `produk` | `VARCHAR(50)` | NULL | | |
| 7 | `tanggal` | `DATE` | NOT NULL | | Tanggal transaksi dari perangkat. |
| 8 | `jam` | `TIME` | NOT NULL | | |
| 9 | `keterangan_trx` | `VARCHAR(255)` | NULL | | |
| 10 | `tipe` | `VARCHAR(20)` | NULL | | `setoran` / `penarikan` / `angsuran`. |
| 11 | `is_reversal` | `TINYINT(1)` | NOT NULL | `0` | |
| 12 | `user_id` | `VARCHAR(50)` | NULL | | `sys_daftar_user.USER_ID` petugas. |
| 13 | `created_at` | `TIMESTAMP` | NOT NULL | `CURRENT_TIMESTAMP` | Waktu diterima server. |
| 14 | `posted_at` | `VARCHAR(50)` | NULL | | Waktu posting (string). `NULL`/kosong = antre posting. |
| 15 | `is_posted` | `TINYINT(1)` | NULL | `0` | `1` = sudah masuk `tabtrans`. Dipakai hitung saldo efektif penarikan. |

**Index:** `PRIMARY (id)`, `idx_no_ref (no_ref)`, `idx_rekening (rekening)`, `idx_tanggal (tanggal)`, `idx_user_id (user_id)`.

### 2.5 Lapis C — Tabel Core Banking yang disentuh Branchless

Hanya kolom yang dibaca/ditulis branchless yang dicantumkan (jumlah kolom total di dalam kurung).
Charset `latin1_swedish_ci`.

#### `sys_daftar_user` — `dbcore_sys` (83 kolom) · akses: **baca**
| Kolom | Tipe Data | Dipakai untuk |
|-------|-----------|---------------|
| `USER_ID` | `INT(11)` **PK** | Identitas petugas → `user_login.user_id`, `Transaksi.userId`, `branchless_transaksi.user_id`. |
| `USER_NAME` | `CHAR(20)` | Username login (dibandingkan `BINARY`); dicocokkan dengan `devices.user_name`. |
| `user_web_password` | `CHAR(40)` | Verifikasi login — format dikelola core, **jangan diubah**. |
| `NAMA_LENGKAP` | `CHAR(50)` | Nama petugas / otorisator. |
| `UNIT_KERJA` | `CHAR(4)` | Kantor petugas → `app_kode_kantor.KODE_KANTOR`; penentu jenis jurnal & filter otorisator. |
| `user_code` | `CHAR(2)` | Role core; otorisator = `user_code` ∈ `[otorisasi] role_otorisator` di `app.ini`. |
| `penerimaan_tab` | `DECIMAL(18,2)` default `0.00` | Limit setoran petugas **dan** kewenangan otorisator setoran. |
| `pengeluaran_tab` | `DECIMAL(18,2)` default `0.00` | Limit penarikan petugas **dan** kewenangan otorisator penarikan. |
| `penerimaan_kre` | `DECIMAL(18,2)` default `0.00` | Kewenangan otorisator angsuran. |
| `branchless_login_flag` | `TINYINT(1)` default `0` | Hanya nilai `1` yang boleh login branchless (kode tolak `17`). |
| `KODE_PERK_KAS` | `CHAR(20)` | Akun kas petugas untuk jurnal GL. |
| `kode_wilayah` | `VARCHAR(150)` | Perluasan cakupan kantor otorisator. |

> Kolom `penerimaan_tab`, `pengeluaran_tab`, `branchless_login_flag`, `kode_wilayah` bersifat
> **opsional**: backend memeriksa keberadaannya lewat `information_schema` karena tidak semua
> versi core memilikinya.

#### `app_otorisasi` — `dbcore` (17 kolom) · akses: **tulis + baca status**
| Kolom | Tipe Data | Dipakai untuk |
|-------|-----------|---------------|
| `id_otorisasi` | `INT(11)` **PK** AUTO_INCREMENT | Urutan; status dibaca dari baris terbaru. |
| `user_id` | `CHAR(25)` | Petugas pemohon. |
| `id_otorisator` | `CHAR(25)` | Otorisator yang dipilih petugas. |
| `tgl_otorisator` | `DATE` | Tanggal permintaan. |
| `keterangan` | `LONGTEXT` | `"[BRANCHLESS] " + keterangan` (maks 250 karakter). |
| `status` | `INT(1)` | `0` menunggu · `1` disetujui · `2` dibatalkan · `3` ditolak. |
| `identifier` | `CHAR(40)` | `"ID" + idOtorisator + epoch detik` — kunci polling dari mobile. |
| `TYPE_TRANS` | `VARCHAR(100)` | `"Branchless " + tipe` (kolom opsional). |
| `password` | `CHAR(25)` | Milik core. **Tidak pernah dibaca/dikeluarkan** oleh branchless. |

Kolom lain (`jml_transaksi`, `token_code`, `trans_master_id`, `trans_detail`, `response_code`,
`gambar`, `jam`, `flag`) tidak diisi branchless.

#### `tabung` — `dbcore` (149 kolom) · akses: **baca**
| Kolom | Tipe Data | Dipakai untuk |
|-------|-----------|---------------|
| `no_rekening` | `CHAR(20)` **PK** | Kunci rekening. |
| `nasabah_id` | `CHAR(20)` | → `nasabah.nasabah_id`. |
| `kode_produk` | `CHAR(3)` | → `tab_produk.KODE_PRODUK`. |
| `kode_kantor` | `CHAR(4)` | Kantor rekening; dibanding `UNIT_KERJA` petugas → jurnal `NONATK` (sama) / `ATK` (antar-kantor). |
| `kode_group1..3` | `CHAR(6)` | Filter nasabah per device. |
| `saldo_akhir` | `DECIMAL(18,2)` | Syarat master (`> 0`) & kolom `master_nasabah.saldo_akhir`. |
| `status` | `SMALLINT(1)` | Hanya `0`/`1` yang ikut master & boleh OTP. |
| `minimum`, `saldo_blokir` | `DECIMAL(18,2)` | Saldo tertahan pada validasi penarikan. |
| `kode_integrasi` | `CHAR(3)` | → `tab_integrasi.KODE_INTEGRASI`. |

#### `nasabah` (159 kolom) · `tab_produk` (47) · `app_kode_kantor` (72) · `tab_integrasi` (42) — akses: **baca**
| Tabel | Kolom | Tipe Data | Dipakai untuk |
|-------|-------|-----------|---------------|
| `nasabah` | `nasabah_id` | `VARCHAR(20)` **PK** | Join dari `tabung`. |
| | `nama_nasabah` | `CHAR(100)` | Master nasabah, rekening koran. |
| | `alamat` | `CHAR(200)` | Master nasabah. |
| | `hp` | `CHAR(50)` | Tujuan OTP WhatsApp penarikan. |
| `tab_produk` | `KODE_PRODUK` | `CHAR(3)` **PK** | |
| | `DESKRIPSI_PRODUK` | `CHAR(40)` | Nama produk. |
| `app_kode_kantor` | `KODE_KANTOR` | `CHAR(4)` **PK** | |
| | `NAMA_KANTOR`, `ALAMAT_KANTOR` | `CHAR(40)`, `CHAR(200)` | Kop struk (dikirim saat login). |
| `tab_integrasi` | `KODE_INTEGRASI` | `CHAR(3)` | |
| | `KODE_PERK_HUTANG_POKOK` | `CHAR(20)` | Akun tabungan untuk jurnal GL. |

#### `tabtrans` — `dbcore` (65 kolom) · akses: **tulis (worker) + baca (mutasi/saldo)**
| Kolom | Tipe Data | Nilai yang ditulis branchless |
|-------|-----------|-------------------------------|
| `tabtrans_id` | `INT(11)` **PK** (bersama `kode_kantor`) | Dari fungsi `get_next_id()` core. |
| `TGL_TRANS` | `DATE` | `branchless_transaksi.tanggal`. |
| `NO_REKENING` | `CHAR(20)` | Rekening. |
| `KODE_TRANS` | `CHAR(3)` | `150` setoran · `250` penarikan · `151`/`251` reversalnya. |
| `MY_KODE_TRANS` | `SMALLINT(6)` | `100` setoran · `200` penarikan · `101`/`201` reversalnya. `FLOOR(x/100)`: 1 = kredit saldo, 2 = debet saldo. |
| `POKOK` | `DECIMAL(18,4)` | Nominal. |
| `USERID` | `INT(11)` | Petugas. |
| `KETERANGAN` | `CHAR(250)` | Keterangan transaksi. |
| `KUITANSI` | `CHAR(20)` | `no_ref` — baris lama dengan kuitansi sama **dihapus dulu** (posting ulang idempoten). |
| `kode_kantor` | `CHAR(4)` | Kantor rekening. |
| `jam` | `TIME` | Jam transaksi. |
| `VERIFIKASI` | `CHAR(1)` | `1`. |
| `TOB` | `CHAR(1)` | `T`. |
| `MODUL_ID_SOURCE`, `TRANS_ID_SOURCE` | `CHAR(3)`, `INT(11)` | `NULL`. |

Saldo rekening dihitung dari `tabtrans`: `Σ POKOK (kode 1xx) − Σ POKOK (kode 2xx)`.

#### `transaksi_master` (19 kolom) & `transaksi_detail` (11 kolom) — akses: **tulis (worker)**
| Tabel | Kolom | Tipe Data | Nilai yang ditulis branchless |
|-------|-------|-----------|-------------------------------|
| `transaksi_master` | `trans_id` | `INT(11)` **PK** (+`kode_kantor`) | `get_next_id()`. |
| | `KODE_JURNAL` | `CHAR(3)` | `TAB`. |
| | `NO_BUKTI` | `CHAR(30)` | `no_ref` — jurnal lama dengan `NO_BUKTI` + `TGL_TRANS` sama dihapus dulu. |
| | `TGL_TRANS` | `DATE` | Tanggal transaksi. |
| | `uraian` | `CHAR(250)` | Keterangan. |
| | `TRANS_ID_SOURCE` | `INT(11)` | `tabtrans_id` terkait. |
| | `USERID` | `INT(11)` | Petugas. |
| | `kode_kantor` | `CHAR(4)` | Kantor rekening. |
| | `verifikasi` | `TINYINT(1)` | `1`. |
| | `MODUL_ID_SOURCE`, `IS_BANK`, `transfer`, `kode_kas`, `online_kk`, `online_id`, `otorisasi` | | `NULL`. |
| `transaksi_detail` | `trans_id` | `INT(11)` **PK** (+`kode_kantor_detail`) | `get_next_id()`. |
| | `MASTER_ID` | `INT(11)` | → `transaksi_master.trans_id`. |
| | `KODE_PERK` | `CHAR(20)` | Akun kas petugas / akun tabungan. |
| | `DEBET`, `KREDIT` | `DECIMAL(20,2)` | Dua baris per transaksi: satu debet, satu kredit. |
| | `KETERANGAN` | `CHAR(250)` | Keterangan. |
| | `kode_kantor_detail` | `CHAR(4)` | Kantor. |

Pasangan jurnal: **setoran** → Debet kas petugas (`KODE_PERK_KAS`), Kredit tabungan
(`KODE_PERK_HUTANG_POKOK`); **penarikan** → kebalikannya. Bila salah satu akun belum dipetakan,
jurnal di-*rollback* (mutasi `tabtrans` tetap tercatat).

---

## 3. Entity Relationship Diagram (ERD)

Relasi **antar-lapis bersifat logis** (lewat API, bukan foreign key). FK fisik hanya ada dua:
`devices.lembaga_id` dan `users.lembaga_id`.

```
LAPIS B — branchless (API pusat)
[lembaga] 1 ──FK── N [devices] 1 ╌╌╌ N [device_approval_request]
    │                    │ 1 ╌╌╌╌╌╌╌╌ N [device_user_history]
    │                    │ 1 ╌(device_uuid)╌ N [device_kas_log]
    │                    └ 1 ╌(device_uuid)╌ N [user_device_location] ─rotasi─► [user_device_location_YYYYMMDD]
    └── 1 ──FK── N [users] 1 ╌╌╌ N [admin_session]

LAPIS C — dbcore / dbcore_sys (lembaga)
[nasabah] 1 ─── N [tabung] N ─── 1 [tab_produk]
                    │  N ─── 1 [tab_integrasi]
                    │ 1 ─── N [tabtrans] 1 ─── 1 [transaksi_master] 1 ─── 2 [transaksi_detail]
                    │ 1 ╌╌╌ N [branchless_transaksi] ──worker posting──► [tabtrans]
[sys_daftar_user] 1 ╌╌╌ N [branchless_transaksi]          (user_id)
[sys_daftar_user] 1 ╌╌╌ N [app_otorisasi]                 (user_id, id_otorisator)
[sys_daftar_user] N ─── 1 [app_kode_kantor]               (UNIT_KERJA)

LAPIS A — perangkat
[master_nasabah]  ◄── snapshot harian ── [tabung ⨝ nasabah ⨝ tab_produk]
[Transaksi] ── noRef = no_ref ──► [branchless_transaksi]
[Transaksi] 1 ─── 1 [SaldoKas] (tiap transaksi menambah satu baris kas)
[SaldoKas]  ── buka/tutup ──► [device_kas_log]

LINTAS LAPIS
[devices].user_name   ═ [sys_daftar_user].USER_NAME
[devices].kode_group* ═ filter [master_nasabah].kode_group*

──FK──  foreign key fisik      ───  relasi dalam satu DB (tanpa FK)      ╌╌╌  relasi logis
```

---

## 4. Aturan Bisnis Terkait Data

1. **Setoran & angsuran offline-first; penarikan online-first.** Setoran/angsuran masuk
   `Transaksi` dengan `isSync = 0` dan dikirim belakangan. Penarikan harus sukses di server dulu,
   baru ditulis lokal dengan `isSync = 1`.
2. **Idempotensi sync lewat `no_ref`.** Server menolak/melewati `no_ref` yang sudah ada di
   `branchless_transaksi`; mobile hanya menandai `isSync = 1` untuk baris yang dibalas `success`.
   Posting ke core juga idempoten: `tabtrans` dihapus per `KUITANSI`, jurnal per `NO_BUKTI` + tanggal.
3. **Saldo efektif penarikan** = saldo `tabtrans` s.d. tanggal transaksi + mutasi
   `branchless_transaksi` yang belum diposting (`is_posted = 0`) − (`tabung.minimum` +
   `tabung.saldo_blokir`). Tanpa komponen kedua, penarikan beruntun bisa lolos dua kali.
4. **`SaldoKas` append-only.** Tidak ada update/hapus; saldo terakhir = baris `id` terbesar per `userId`.
5. **Semua data lokal dipisah per `userId`.** Satu perangkat bisa dipakai bergantian; query selalu
   menyaring `userId` petugas yang login.
6. **Kolom sensitif di SQLite lokal hanya di-obfuskasi**, bukan dienkripsi. `master_nasabah`
   tersimpan teks biasa. Perlindungan mengandalkan sandbox aplikasi.
7. **DB master berlaku satu hari.** Nama berkas memuat tanggal; berkas kemarin diabaikan, dan login
   ditolak sampai berkas hari ini diunduh. `saldo_akhir` di dalamnya adalah snapshot pukul 01:00.
8. **Master hanya memuat rekening `status IN (0,1)` dengan `saldo_akhir > 0`.** Rekening baru
   bersaldo nol tidak muncul di pencarian petugas sampai ada saldo.
9. **Satu user core hanya boleh terikat ke satu device per lembaga** (dijaga di kode saat *ganti
   user*, bukan constraint DB); penggantian user wajib lewat *ganti user* agar tercatat di
   `device_user_history`.
10. **Status kas harian = event terakhir** di `device_kas_log` per `(device_uuid, tanggal)`.
    `TUTUP` mengunci login; `REOPEN` dari dashboard membukanya kembali.
11. **Limit & izin petugas bersumber dari core** (`sys_daftar_user`). `NULL` dianggap `0` → setiap
    transaksi butuh otorisasi. Limit di `devices` hanya cadangan.
12. **Keputusan otorisasi ada di core.** Branchless hanya menulis permintaan (`status = 0`),
    mem-*poll* status, dan mengubah ke `2` saat dibatalkan. Kolom `password` tidak pernah disentuh.
13. **Log audit menyalin data, bukan hanya merujuk.** `device_approval_request` dan
    `device_user_history` menyimpan salinan `device_uuid`/nama agar tetap terbaca setelah device dihapus.
14. **Lokasi petugas dirotasi harian.** Tabel induk hanya menyimpan ± 3 hari; sisanya di tabel
    arsip per tanggal.

---

## 5. DDL

### 5.1 SQLite perangkat — `branchless2025.db` (dari `src/db/sqlite.ts`)

```sql
CREATE TABLE IF NOT EXISTS Transaksi (
  id TEXT PRIMARY KEY NOT NULL,
  rekening TEXT, nama TEXT, nominal TEXT, noRef TEXT,
  produk TEXT, tanggal TEXT, jam TEXT, keteranganTrx TEXT,
  tipe TEXT, isSync INTEGER, isReversal INTEGER, userId TEXT
);

CREATE TABLE IF NOT EXISTS LogAktivitas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  waktu TEXT, aktivitas TEXT, detail TEXT, userId TEXT
);

CREATE TABLE IF NOT EXISTS SaldoKas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  waktu TEXT, aktivitas TEXT, nominal INTEGER, saldo INTEGER, userId TEXT
);
```

### 5.2 SQLite master — `dbbranchless_YYMMDD.db` (dari `WorkerDB.java`)

```sql
CREATE TABLE master_nasabah (
  no_rekening TEXT PRIMARY KEY,
  kode_produk TEXT, nama_produk TEXT, nama_nasabah TEXT, alamat TEXT,
  kode_kantor TEXT, kode_group1 TEXT, kode_group2 TEXT, kode_group3 TEXT,
  saldo_akhir REAL
);
```

### 5.3 Database API pusat — `branchless`

Tabel dasar `lembaga`, `devices`, `users` **tidak punya berkas migrasi di repo**; DDL berikut
direkonstruksi dari skema aktual (sudah termasuk perubahan V4, V6, V7).

```sql
CREATE TABLE lembaga (
  id BIGINT NOT NULL AUTO_INCREMENT,
  kode_lembaga VARCHAR(20) NOT NULL,
  nama_lembaga VARCHAR(150) NOT NULL,
  alamat VARCHAR(255) NULL,
  kota VARCHAR(100) NULL,
  provinsi VARCHAR(100) NULL,
  no_telp VARCHAR(30) NULL,
  email VARCHAR(150) NULL,
  api_url VARCHAR(255) NULL,
  client_key VARCHAR(128) NULL,
  wajib_buka_kas TINYINT(1) NOT NULL DEFAULT 1,
  status_aktif TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY kode_lembaga (kode_lembaga)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE devices (
  id BIGINT NOT NULL AUTO_INCREMENT,
  lembaga_id BIGINT NOT NULL,
  device_uuid VARCHAR(200) NOT NULL,
  device_name VARCHAR(150) NULL,
  user_name VARCHAR(255) NULL,
  os_version VARCHAR(50) NULL,
  app_version VARCHAR(50) NULL,
  last_login_at DATETIME NULL,
  is_active TINYINT(1) DEFAULT 1,
  kode_group1 VARCHAR(10) NULL,
  kode_group2 VARCHAR(10) NULL,
  kode_group3 VARCHAR(10) NULL,
  kode_group4 VARCHAR(10) NULL,
  kode_group5 VARCHAR(10) NULL,
  kode_kantor VARCHAR(10) NULL,
  limit_setoran DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  limit_penarikan DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
  PRIMARY KEY (id),
  KEY fk_device_lembaga (lembaga_id),
  CONSTRAINT fk_device_lembaga FOREIGN KEY (lembaga_id) REFERENCES lembaga (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE users (
  id BIGINT NOT NULL AUTO_INCREMENT,
  lembaga_id BIGINT NULL,
  username VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  role VARCHAR(50) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY username (username),
  KEY fk_user_lembaga (lembaga_id),
  CONSTRAINT fk_user_lembaga FOREIGN KEY (lembaga_id) REFERENCES lembaga (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Tabel lainnya memakai berkas migrasi di
`backend-branchless/src/main/resources/db/migration/` apa adanya:

| Berkas | Isi |
|--------|-----|
| `V2__create_user_device_location_table.sql` | `user_device_location` |
| `V3__create_device_user_history_table.sql` | `device_user_history` |
| `V4__device_approval.sql` | `devices.approval_status` + `device_approval_request` |
| `V5__create_device_kas_log_table.sql` | `device_kas_log` |
| `V6__add_wajib_buka_kas_lembaga.sql` | `lembaga.wajib_buka_kas` |
| `V7__add_client_key_lembaga.sql` | `lembaga.client_key` |
| `V8__create_admin_session_table.sql` | `admin_session` |

### 5.4 Database lembaga — `branchless_transaksi` (skema aktual)

```sql
CREATE TABLE branchless_transaksi (
  id BIGINT(20) NOT NULL AUTO_INCREMENT,
  rekening VARCHAR(30) NOT NULL,
  nama VARCHAR(150) NULL,
  nominal DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  no_ref VARCHAR(50) NULL,
  produk VARCHAR(50) NULL,
  tanggal DATE NOT NULL,
  jam TIME NOT NULL,
  keterangan_trx VARCHAR(255) NULL,
  tipe VARCHAR(20) NULL,
  is_reversal TINYINT(1) NOT NULL DEFAULT 0,
  user_id VARCHAR(50) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  posted_at VARCHAR(50) NULL,
  is_posted TINYINT(1) DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_no_ref (no_ref),
  KEY idx_rekening (rekening),
  KEY idx_tanggal (tanggal),
  KEY idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
```

Prasyarat di core (bukan DDL branchless): fungsi `get_next_id()` di `dbcore`, serta kolom
`sys_daftar_user.branchless_login_flag` bila pembatasan login branchless ingin diaktifkan.

---

## 6. Selisih DDL Repo vs Skema Aktual

Temuan saat mencocokkan berkas di repo dengan database development. Perlu ditindaklanjuti agar
instalasi lembaga baru tidak berbeda dari yang berjalan.

| # | Objek | Di repo | Aktual | Tindak lanjut |
|---|-------|---------|--------|---------------|
| 1 | `branchless_transaksi` | `mysql_transaksi_ddl.sql`: `id INT`, `jam VARCHAR(16)`, kolom `NOT NULL`, index `idx_posted_status`, tanpa `created_at` | `id BIGINT`, `jam TIME`, ada `created_at`, index `idx_rekening` & `idx_user_id`, **tanpa** index pada `is_posted` | Perbarui berkas DDL repo ke §5.4. Pertimbangkan index `(is_posted)` / `(rekening, is_posted)` — worker & cek saldo menyaring kolom ini tiap 5 detik. |
| 2 | `otp_request` | `V1__create_otp_request_table.sql` ada di **kedua** backend | Tabel **tidak ada** di DB mana pun; OTP disimpan di cache memori | Hapus berkas migrasi (peninggalan template Onboarding) atau tandai tidak dipakai. |
| 3 | `obd_user`, `obd_aktivasi`, `obd_blacklist` | Dirujuk `AktivasiService` / `OtpService` di kedua backend | Tabel tidak ada | Kode mati peninggalan IBS Onboarding — kandidat dihapus. |
| 4 | `lembaga`, `devices`, `users` | Tidak ada berkas `CREATE TABLE` | Ada | Tambahkan migrasi dasar (§5.3) agar instalasi baru bisa direproduksi. |
| 5 | `otorisasi_transaksi` | Dibuat & di-`ALTER` dari dalam kode endpoint | Ada, 1 baris | Legacy — hapus endpoint + tabel setelah dipastikan tidak ada pemakai. |
| 6 | `master_nasabah.saldo_akhir` | Ada di `WorkerDB.java` | Berkas contoh lama di repo (`db/dbbranchless_260519.db`) belum memilikinya | Tidak ada tindakan; berkas dibangkitkan ulang tiap hari. |
| 7 | `devices.device_uuid` | — | Tanpa index/constraint unik, padahal dipakai di `WHERE` login & join lokasi | Pertimbangkan index `(device_uuid)`. |
| 8 | `user_device_location` | — | Hanya PK; query dashboard menyaring `username`, `device_id`, `DATE(created_at)` | Pertimbangkan index `(device_id, created_at)`. |
| 9 | `tabtrans` untuk tipe `angsuran` | Worker memetakan semua tipe selain `setoran` ke kode `250/200` (penarikan) | — | **Perlu konfirmasi:** worker tidak menyaring `tipe`, dan sync mobile mengirim semua baris `isSync = 0` — angsuran yang tersinkron akan terposting sebagai penarikan tabungan. Saat ini pencarian nasabah kredit di mobile masih data dummy. |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 16 November 2026 | | Dokumen dibuat dari kode `Mobile-Branchless`, `backend-branchless`, `backend-client-branchless` dan `information_schema` database development (pusat, core, core_sys). |
| 1.0.1 | 20 November 2026 | | `devices.kode_kantor` (migrasi V9); DB master per kantor di §2.2. |

---

*[← Kembali ke Mobile Branchless](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
