# 🗄️ Desain Database — IBS Onboarding Backend

> Rancangan struktur basis data untuk produk **IBS Onboarding Backend** (diturunkan dari DDL repo, migration, entity JPA, & SQL raw `JdbcTemplate` pada controller/service).

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS Onboarding Backend |
| Jenis Dokumen     | Desain Database     |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 17 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 0. Ikhtisar & Konteks

Sistem memakai **dua koneksi database MySQL** (HikariCP, driver `com.mysql.cj.jdbc.Driver`,
`serverTimezone=Asia/Jakarta`, maxPool 50 / minIdle 10):

| Koneksi | Config (`app.ini`) | Bean | Isi | Dipakai oleh |
|---------|--------------------|------|-----|--------------|
| **Main** (`@Primary`) | `[database_main]` | `mainJdbc` | Tabel **onboarding** (`obd_*`) + tabel **Core Banking** (nasabah, rekening, transaksi, produk, kantor) | Mayoritas controller/service |
| **Sys** | `[database_sys]` | `sysJdbc` | Parameter sistem (`sys_mysysid`) & user admin (`sys_daftar_user`) | `AdminLoginController`, `GenerateIDUtil` |

Catatan penting:
- **Akses data via raw JDBC** (`JdbcTemplate`) — JPA **dinonaktifkan** runtime (`ddl-auto: none`;
  `HibernateJpaAutoConfiguration`, `DataSourceTransactionManagerAutoConfiguration`,
  `JpaRepositoriesAutoConfiguration` di-exclude). Hanya entity `TabProduk` yang terdefinisi JPA
  (repository tidak aktif di-scan).
- **Dua kelompok tabel** di DB main: (a) tabel milik onboarding (`obd_*`) yang dibuat/dipakai
  produk ini; (b) tabel **Core Banking legacy** (nasabah, tabung, deposito, kredit, `*trans`,
  produk, kantor) yang **dikelola IBS/DBA BPR** — produk ini membaca & menulis, tidak membuat skema.
- **Generator ID** memakai stored function Core + template `sys_mysysid`.
- ⚠️ **DDL di repo belum lengkap/tertinggal** dari skema aktual. Beberapa tabel (`obd_user`,
  `obd_aktivasi`, `obd_blacklist`, `obd_pengajuan_dep`, `obd_pengajuan_kredit`) dan kolom
  (`updated_at`, `alasan`, `status`, `device_id`, `device_name`) **tidak** ada di DDL repo namun
  dipakai kode — struktur di bawah sebagian **direkonstruksi dari query** dan perlu dikonfirmasi
  ke DB produksi.

---

## 1. Daftar Tabel

### 1.1 Tabel Onboarding — DB Main (`obd_*`)
| No | Tabel | Deskripsi | Sumber definisi |
|----|-------|-----------|-----------------|
| 1 | `obd_register` | Data registrasi calon nasabah (+foto). | DDL repo (parsial) |
| 2 | `obd_aktivasi` | Data OTP & aktivasi akun (OTP ter-AES). | Rekonstruksi query |
| 3 | `obd_user` | Akun user aplikasi (kredensial, status, lockout, `cif`). | Rekonstruksi query |
| 4 | `obd_blacklist` | Daftar entitas diblokir (device/NIK/no HP/username). | Rekonstruksi query |
| 5 | `obd_banner` | Banner/berita aplikasi. | DDL repo |
| 6 | `obd_pengajuan_tab` | Pengajuan tabungan. | DDL repo (parsial) |
| 7 | `obd_pengajuan_dep` | Pengajuan deposito. | Rekonstruksi query |
| 8 | `obd_pengajuan_kredit` | Pengajuan kredit (+dokumen agunan/KK/NPWP). | Rekonstruksi query |
| 9 | `obd_pengajuan` *(legacy)* | Struktur lama; **tidak** dipakai controller aktif. | DDL repo |
| 10 | `pengajuan_tabungan` *(legacy)* | Struktur lama; tidak dipakai. | DDL repo |
| 11 | `otp_request` *(migration, tidak terpakai)* | Tabel Flyway `V1`; service memakai `obd_aktivasi`. | Migration |

### 1.2 Tabel Core Banking — DB Main *(dikelola IBS/DBA; READ + INSERT saat approval)*
| No | Tabel | Deskripsi | Operasi |
|----|-------|-----------|---------|
| 12 | `nasabah` | Data nasabah / CIF. | READ, INSERT (approval) |
| 13 | `tabung` | Rekening tabungan. | READ, INSERT (approval) |
| 14 | `deposito` | Rekening deposito. | READ, INSERT (approval) |
| 15 | `kredit` | Rekening kredit. | READ, INSERT (approval) |
| 16 | `tabtrans` | Transaksi tabungan. | READ (mutasi/saldo/analisa) |
| 17 | `deptrans` | Transaksi deposito. | READ (mutasi/saldo) |
| 18 | `kretrans` | Transaksi kredit. | READ (mutasi/saldo) |
| 19 | `tab_produk` | Master produk tabungan. | READ *(entity JPA `TabProduk`)* |
| 20 | `dep_produk` | Master produk deposito. | READ |
| 21 | `kre_produk` | Master produk kredit. | READ |
| 22 | `app_kode_kantor` | Master kode & nama kantor. | READ |
| 23 | `lbi_2018_00_4` | Data kantor (koordinat, alamat, telepon). | READ |

### 1.3 DB Sys
| No | Tabel | Deskripsi |
|----|-------|-----------|
| 24 | `sys_daftar_user` | Master user admin back-office. |
| 25 | `sys_mysysid` | Parameter sistem key-value (template generator ID). |

---

## 2. Detail Tabel Onboarding

### 2.1 `obd_register` — registrasi *(PK `id`)*
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | INT AI PK | |
| `nik` | VARCHAR(32) NOT NULL | NIK calon nasabah |
| `nama` | VARCHAR(128) NOT NULL | |
| `tempat_lahir` | VARCHAR(64) | |
| `tgl_lahir` | DATE | |
| `jenis_kelamin` | VARCHAR(8) | |
| `no_hp` | VARCHAR(32) NOT NULL | |
| `email` | VARCHAR(128) | |
| `alamat` | VARCHAR(255) | |
| `nama_ibu` | VARCHAR(128) | |
| `foto_selfie` | TEXT | Path/base64 |
| `foto_ktp` | TEXT | Path/base64 |
| `created_at` | TIMESTAMP | |
| `status` | VARCHAR *(dipakai kode)* | `PENDING`/`APPROVED`/`REJECTED` — **tidak di DDL repo** |
| `device_id`, `device_name` | VARCHAR *(dipakai kode)* | **tidak di DDL repo** |

### 2.2 `obd_aktivasi` — OTP & aktivasi *(rekonstruksi; PK `id`)*
| Kolom | Keterangan |
|-------|------------|
| `id` | PK |
| `nik`, `no_hp` | Identitas |
| `foto_ktp`, `foto_selfie` | Dokumen |
| `device_id`, `device_name` | Identitas perangkat |
| `otp` | OTP 6 digit **ter-AES** (`AESUtil`) |
| `status` | `PENDING` / `DONE` / `APPROVED` |
| `cif`, `nama` | Diisi/propagasi saat approval pengajuan |
| `created_at` | |

### 2.3 `obd_user` — akun user aplikasi *(rekonstruksi; PK `id`)*
| Kolom | Keterangan |
|-------|------------|
| `id` | PK |
| `username` | Unik |
| `password` | Kredensial (⚠️ dibandingkan plaintext saat login; reset → SHA-256 salted) |
| `nik`, `no_hp` | Identitas |
| `device_id`, `device_name` | Perangkat terikat |
| `status` | `ACTIVE` / `INACTIVE` / `LOCKED` |
| `login_attempt`, `last_failed_login`, `is_locked` | Kontrol lockout (3× → kunci 15 menit) |
| `reset_pass` | Flag wajib ganti password |
| `cif` | CIF Core (kosong sebelum punya rekening) |
| `nama` | |
| `created_at`, `updated_at`, `last_login` | |

### 2.4 `obd_blacklist` — blacklist *(rekonstruksi; PK `id`)*
| Kolom | Keterangan |
|-------|------------|
| `id` | PK |
| `value` | Nilai yang diblokir |
| `type` | `DEVICE_ID` / `NIK` / `NO_HP` / `USERNAME` / `ALL` |
| `reason` | Alasan |
| `created_at` | |

### 2.5 `obd_banner` — banner *(PK `id`)*
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | INT AI PK | |
| `title` | VARCHAR(255) NOT NULL | |
| `detail` | TEXT | |
| `image` | VARCHAR(255) | Path file di `uploads/` |
| `start_date`, `end_date` | DATE | Rentang tayang |
| `status` | ENUM(`ACTIVE`,`INACTIVE`) DEFAULT `ACTIVE` | |
| `created_at` | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | |

### 2.6 `obd_pengajuan_tab` — pengajuan tabungan *(PK `id`, UNIQUE `no_pengajuan`)*
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | INT AI PK | |
| `no_pengajuan` | VARCHAR(32) NOT NULL UNIQUE | `TAB`+yyyyMMdd+NNN |
| `id_user` | INT NOT NULL | → `obd_user.id` |
| `produk` | VARCHAR(64) | Kode/nama produk |
| `setoran_awal` | VARCHAR(32) | |
| `foto_ktp`, `foto_selfie` | LONGTEXT | |
| `nik`, `hp` | VARCHAR(32) | |
| `status` | VARCHAR(32) | `PENDING`/`APPROVED`/`REJECTED` |
| `created_at` | TIMESTAMP | |
| `updated_at`, `alasan` | *(dipakai kode)* | **tidak di DDL repo** |

### 2.7 `obd_pengajuan_dep` — pengajuan deposito *(rekonstruksi)*
Kolom: `id`, `no_pengajuan` (`DEP`+yyyyMMdd+NNN), `id_user`, `jangka_waktu`,
`nominal_penempatan`, `foto_ktp`, `foto_selfie`, `nik`, `hp`, `status`, `alasan`,
`created_at`, `updated_at`.

### 2.8 `obd_pengajuan_kredit` — pengajuan kredit *(rekonstruksi)*
Kolom: `id`, `no_pengajuan` (`KRE`+yyyyMMdd+NNN), `id_user`, `tujuan`, `jangka_waktu`,
`nominal_pinjaman`, `penghasilan`, `pendidikan`, `tempat_kerja`, `alamat_kerja`, `nominal_lain`,
`jenis_agunan`, `deskripsi_agunan`, `foto_agunan1..5`, `foto_kk`, `foto_ktp`, `foto_selfie`,
`foto_npwp`, `nik`, `hp`, `status`, `alasan`, `created_at`, `updated_at`.

### 2.9 Tabel legacy & migration (tidak dipakai runtime)
- **`obd_pengajuan`** (DDL repo): `id` PK, `no_pengajuan` UNIQUE, `id_user`, `produk`,
  `setoran_awal`, `foto_ktp`/`foto_selfie` LONGTEXT, `nik`, `hp`, `status`, `created_at`.
  Digantikan oleh `obd_pengajuan_tab`.
- **`pengajuan_tabungan`** (DDL repo): struktur lama tanpa `no_pengajuan`/`id_user`.
- **`otp_request`** (Flyway `V1`): `id` BIGINT PK, `nik`, `no_hp`, `foto_ktp`, `foto_selfie`,
  `device_id`, `otp`, `created_at`. Service OTP menulis ke `obd_aktivasi`, bukan tabel ini.

---

## 3. Detail Tabel Core Banking (kolom yang disentuh service)

> Struktur lengkap dikelola IBS Core Banking; hanya kolom yang dipakai yang didokumentasikan.

### 3.1 `nasabah` *(PK `nasabah_id` = CIF)*
`nasabah_id` (CIF, di-generate), `no_id` (NIK — kunci pencarian), `nama_nasabah`, `hp`, `email`,
`alamat`, `tempatlahir`, `tgllahir`, `nama_ibu_kandung`, `kode_kantor`, `tgl_register`, `verifikasi`.

### 3.2 `tabung` *(PK `no_rekening`)*
`no_rekening` (di-generate), `nasabah_id`, `kode_integrasi`, `kode_produk`, `tgl_register`,
`setoran_awal`, `status`, `kode_kantor`, `suku_bunga`, `persen_pph`, `setoran_minimum`,
`minimum`, `adm_per_bln`, `verifikasi`, `saldo_blokir`.

### 3.3 `deposito` *(PK `no_rekening`)*
`no_rekening`, `nasabah_id`, `kode_integrasi`, `kode_produk`, `tgl_registrasi`, `kode_jenis`,
`status_aktif`, `kode_kantor`, `suku_bunga`, `persen_pph`, `jml_deposito`, `jkw`, `tgl_jt`
(= `tgl_register` + `jangka_waktu` bulan), `tgl_mulai`, `verifikasi`.

### 3.4 `kredit` *(PK `no_rekening`)*
`no_rekening`, `nasabah_id`, `kode_integrasi`, `kode_produk`, `tgl_realisasi`, `type_kredit`
(dari `kre_produk.type_kredit_default`), `status`, `kode_kantor`, `suku_bunga_per_tahun`,
`jml_pinjaman`, `jml_angsuran`, `tgl_jatuh_tempo`, `verifikasi`, `satuan_waktu_angsuran`,
`tgl_tagihan`, `is_advance`, `type_kolek`, `no_pengajuan`.

### 3.5 `tabtrans` / `deptrans` / `kretrans`
`no_rekening`, `tgl_trans`, `my_kode_trans`, `keterangan`, `pokok` (tab/kre) / `pokok_trans` (dep).
> Analisa finansial mengklasifikasi income/expense via `floor(my_kode_trans/100)`.

### 3.6 Master produk & kantor
- `tab_produk` *(entity JPA `TabProduk`, PK `KODE_PRODUK` VARCHAR(3))* — `deskripsi_produk`,
  `suku_bunga_default`, `pph_default`, `setoran_minimum_default`, `saldo_minimum_default`,
  `adm_per_bulan`, `type_bunga`, `kode_perk_*`, dst. (~40 kolom).
- `dep_produk` — `kode_produk`, `deskripsi_produk`, `suku_bunga_default`, `jkw_default`, `pph_default`.
- `kre_produk` — `kode_produk`, `deskripsi_produk`, `suku_bunga_default`, `type_kredit_default`.
- `app_kode_kantor` — `kode_kantor`, `nama_kantor`.
- `lbi_2018_00_4` — `kode_kantor`, `nama_kantor`, `koordinat_kantor` (lat/long), `alamat_kantor`, `no_telepon`.

## 4. Detail Tabel DB Sys

### 4.1 `sys_daftar_user` — admin back-office
`user_id`, `user_name` (BINARY case-sensitive), `nama_lengkap`, `unit_kerja`,
`user_web_password`, `user_code`.

### 4.2 `sys_mysysid` — parameter sistem key-value
`keyname`, `keyvalue` — template generator: `CSS_TEMPLATE_NASABAH_ID`,
`TAB_TEMPLATE_NO_REKENING`, `DEP_TEMPLATE_NO_REKENING`, `KRE_TEMPLATE_NO_REKENING`, dll.

## 5. Generator ID (`GenerateIDUtil`)

| ID | Sumber template (DB sys) | Stored function (DB main) |
|----|--------------------------|---------------------------|
| `nasabah_id` (CIF) | `sys_mysysid` (`CSS_TEMPLATE_NASABAH_ID`) | `GENERATE_NASABAH_ID` |
| `no_rekening` tabungan | `sys_mysysid` (`TAB_TEMPLATE_NO_REKENING`) | `GENERATE_NOREK_SIMPANAN` |
| `no_rekening` deposito | `sys_mysysid` (`DEP_TEMPLATE_NO_REKENING`) | `GENERATE_NOREK_DEPOSITO` |
| `no_rekening` kredit | `sys_mysysid` (`KRE_TEMPLATE_NO_REKENING`) | `GENERATE_NOREK_KREDIT` |

> `GenerateIDUtil` membaca template dari **DB sys** lalu memanggil stored function di **DB main**.

## 6. Entity Relationship Diagram (ERD)

```
[DB SYS]  sys_daftar_user (admin)      sys_mysysid (KeyName→template)
                                              │ (baca template)
                                              ▼
                                        [Generator ID]  ──► stored function @ DB main
[DB MAIN — Onboarding]                        │
  obd_register (id, nik) ──approve──► obd_aktivasi (id, otp AES, status)
        │                                   │ aktivasi
        ▼                                   ▼
  obd_user (id, username, cif) ◄── propagasi cif ──┐
        │ 1                                          │
        │ N                                          │
  obd_pengajuan_tab / _dep / _kredit (id_user)  ─approve─► (posting Core)
                                                            │
[DB MAIN — Core Banking]                                    ▼
  nasabah (nasabah_id=cif, no_id=NIK) 1 ── N tabung / deposito / kredit (no_rekening, nasabah_id)
        │                                          │ 1
        │                                          └── N tabtrans / deptrans / kretrans (no_rekening)
        │
  tab_produk / dep_produk / kre_produk (kode_produk)   app_kode_kantor / lbi_2018_00_4 (kode_kantor)

  obd_blacklist (value,type) ── dicek saat register / OTP / login
  obd_banner (id, status, start/end_date) ── konten aplikasi
```

> Seluruh relasi bersifat **logis** (tanpa FK fisik yang dijamin service) mengikuti pola skema
> legacy IBS + raw JDBC. Lampirkan diagram detail bila tersedia: `![ERD](assets/erd.png)`.

## 7. Aturan Bisnis Terkait Data

1. **Kunci identitas** — nasabah Core dicari via `nasabah.no_id` (NIK); user aplikasi via
   `obd_user.username`; propagasi `cif` menghubungkan user onboarding ↔ nasabah Core.
2. **Nomor pengajuan** — `<PREFIX>`+`yyyyMMdd`+`NNN` (`TAB`/`DEP`/`KRE`), berurut per hari.
3. **Anti-duplikasi pengajuan** — submit ditolak bila masih ada pengajuan `PENDING` untuk user.
4. **Posting saat approval** — `APPROVED` memicu: buat `nasabah` bila `cif` kosong
   (`GENERATE_NASABAH_ID`) → generate `no_rekening` (stored function per jenis) → insert
   `tabung`/`deposito`/`kredit`; deposito menghitung `tgl_jt`, kredit menghitung
   `tgl_jatuh_tempo`/`tgl_tagihan` & mengambil `type_kredit_default`.
5. **OTP terenkripsi** — OTP disimpan ter-AES (`AESUtil`, kunci statis) di `obd_aktivasi`;
   verifikasi via dekripsi.
6. **Enkripsi respons** — `responseData` sukses dienkripsi AES kunci harian
   (`SHA-256("IBS-ONBOARD-SECRET-KEY"+tanggal)[0:32]`) + `keyVersion`.
7. **Kontrol abuse** — blacklist (device/NIK/no HP/username/ALL); rate-limit OTP 3×/hari +
   double-submit 24 jam; lockout login 3× (15 menit).
8. **Klasifikasi transaksi** — analisa finansial memisah income/expense via
   `floor(my_kode_trans/100)`.
9. **Skema Core tidak dikelola service** — perubahan struktur tabel Core dilakukan tim IBS Core;
   ⚠️ DDL onboarding di repo perlu disinkronkan dengan DB produksi (lihat §0).

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dokumen dibuat berdasarkan DDL repo, migration, entity, & SQL raw pada controller/service. |

---

*[← Kembali ke IBS Onboarding Backend](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
