# 🗄️ Desain Database — Host 2 Host

> Rancangan struktur basis data untuk produk **Host 2 Host** (diturunkan dari entity/model JPA & DDL patch).

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | Host 2 Host     |
| Jenis Dokumen     | Desain Database         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 16 Juli 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 0. Ikhtisar & Konteks

Basis data H2H terdiri dari **dua datasource MySQL terpisah** yang di-wire manual (bukan
single default datasource):

| Datasource | Skema | Prefix config | Isi | Package entity |
|------------|-------|---------------|-----|----------------|
| **Primary** (`@Primary`) | `cma` | `spring.datasource` | Core Banking IBS: nasabah, tabungan, kredit, deposito, transaksi + tabel infrastruktur H2H (`api_*`) | `models.primary` |
| **Sys** | `cma_sys` | `sys.datasource` | Sistem/pengguna: `sys_daftar_user`, `sys_mysysid` | `models.sys` |

Catatan penting:
- **`spring.jpa.hibernate.ddl-auto=none`** — skema **tidak** di-generate Hibernate. DDL
  dikelola eksternal; perubahan dikirim sebagai patch SQL manual di `database/patches/`.
- Tabel dibagi dua kelompok kepemilikan:
  - **Milik H2H** (dibuat oleh produk ini, DDL ada di repo): `api_auth_config`,
    `api_refresh_tokens`, `api_login_log`, `api_log`, `api_transaction_log`,
    `api_integration`, `api_binding_bank`.
  - **Milik / berbagi dengan Core Banking IBS (legacy)**: `nasabah`, `tabung`, `tabtrans`,
    `kredit`, `kretrans`, `deposito`, `deptrans`, tabel produk & referensi, serta
    `sys_daftar_user`, `sys_mysysid`. Struktur dikelola IBS — **jangan ubah format kolom**
    (mis. `sys_daftar_user.user_web_password` = SHA1, berbagi dengan aplikasi legacy).
- Redis (bukan tabel) menyimpan state idempotency & rate-limit sementara (TTL), bukan data
  persisten.

## 1. Daftar Tabel

### 1.1 Milik H2H — DB Primary (`cma`)
| No | Nama Tabel | Deskripsi |
|----|-----------|-----------|
| 1 | `api_auth_config` | Konfigurasi autentikasi per `client_id` (secret & masa berlaku token). |
| 2 | `api_refresh_tokens` | Penyimpanan refresh token aktif (revokasi & rotasi). |
| 3 | `api_login_log` | Jejak percobaan login (SUKSES/GAGAL/RATE_LIMITED). |
| 4 | `api_log` | Audit request/response API (ter-mask data sensitif). |
| 5 | `api_transaction_log` | Log transaksi (untuk cek status & reversal). |
| 6 | `api_integration` | Referensi tipe integrasi transaksi + pemetaan kode perkiraan. |
| 7 | `api_binding_bank` | Referensi kode binding bank (rekening ABA antar-bank). |

### 1.2 Berbagi dengan Core Banking IBS — DB Primary (`cma`)
| No | Nama Tabel | Deskripsi |
|----|-----------|-----------|
| 8 | `nasabah` | Data nasabah (CIF). |
| 9 | `tabung` | Rekening tabungan. |
| 10 | `tabtrans` | Transaksi tabungan (mutasi). |
| 11 | `kredit` | Rekening pinjaman/kredit. |
| 12 | `kretrans` | Transaksi kredit (pencairan/angsuran). |
| 13 | `deposito` | Rekening deposito. |
| 14 | `deptrans` | Transaksi deposito. |
| 15 | `transaksi_master` | Header jurnal GL (ditulis saat posting transaksi). |
| 16 | `transaksi_detail` | Baris jurnal GL (debet/kredit per akun; `master_id`→`transaksi_master`). |
| 17 | `tab_produk` / `kre_produk` / `dep_produk` | Master produk tabungan / kredit / deposito. |
| 18 | `tab_integrasi` / `kre_integrasi` / `dep_integrasi` | Pemetaan kode integrasi per modul ke kode perkiraan GL. |
| 19 | `perkiraan` | Bagan akun (Chart of Accounts / kode perkiraan GL). |
| 20 | `css_jenis_debitur`, `css_kode_agama`, `css_sumber_penghasilan`, `css_pemasukan_per_bulan` | Tabel referensi/lookup untuk validasi registrasi nasabah. |
| 21 | `app_kode_kantor` / `app_kode_kantor_atk` | Master kantor/unit kerja (`kode_kantor` → `nama_kantor`); varian ATK memuat pemetaan akun RAK antar-kantor. |
| 22 | `aba`, `aba_integrasi`, `abatrans` | Rekening & transaksi ABA (antar-bank). |

### 1.3 DB Sys (`cma_sys`)
| No | Nama Tabel | Deskripsi |
|----|-----------|-----------|
| 23 | `sys_daftar_user` | Data pengguna (kredensial SHA1, `unit_kerja` → `kode_kantor`). |
| 24 | `sys_mysysid` | Parameter sistem key-value (mis. setting registrasi/limit modul MCS). |

---

## 2. Detail Tabel

### 2.1 Tabel milik H2H (kolom lengkap)

#### Tabel: `api_auth_config` *(diakses via raw `JdbcTemplate`, bukan entity JPA)*
> Konfigurasi kredензial JWT per aplikasi konsumen (`client_id`). Sumber secret & expiry token.

| No | Kolom | Tipe Data | Null | Keterangan |
|----|-------|-----------|------|------------|
| 1 | `client_id` | `VARCHAR(100)` | NOT NULL | **PK**. Identitas aplikasi konsumen (header `X-CLIENT-ID`). |
| 2 | `base64_secret` | `TEXT` | NULL | Secret HS256 (Base64) untuk sign/verify token klien ini. |
| 3 | `access_token_exp` | `BIGINT` | NULL | Masa berlaku access token (ms). |
| 4 | `refresh_token_exp` | `BIGINT` | NULL | Masa berlaku refresh token (ms). |

**Primary Key:** `client_id`

#### Tabel: `api_refresh_tokens` (entity `RefreshToken`)
> Refresh token aktif; dipakai untuk revokasi (logout) & rotasi (refresh).

| No | Kolom | Tipe Data | Null | Default | Keterangan |
|----|-------|-----------|------|---------|------------|
| 1 | `id` | `BIGINT` | NOT NULL | AUTO_INCREMENT | **PK**. |
| 2 | `username` | `VARCHAR(100)` | NOT NULL | | Pemilik token. |
| 3 | `token` | `TEXT` | NOT NULL | | Nilai refresh token JWT. |
| 4 | `expiry_date` | `TIMESTAMP` | NOT NULL | `CURRENT_TIMESTAMP` | Kedaluwarsa (dicek DB-side saat refresh). |

**Primary Key:** `id` · **Aturan:** satu token per username (login `deleteByUsername` → save).

#### Tabel: `api_login_log` (entity `ApiLoginLog`)
> Jejak login untuk audit & throttling brute-force.

| No | Kolom | Tipe Data | Null | Default | Keterangan |
|----|-------|-----------|------|---------|------------|
| 1 | `id` | `BIGINT` | NOT NULL | AUTO_INCREMENT | **PK**. |
| 2 | `user_name` | `VARCHAR(100)` | NULL | | Username percobaan login. |
| 3 | `status` | `VARCHAR(20)` | NULL | | `SUKSES` / `GAGAL` / `RATE_LIMITED` (≤ 20 char). |
| 4 | `login_time` | `TIMESTAMP` | NOT NULL | `CURRENT_TIMESTAMP` | Waktu (read-only di entity). |
| 5 | `ip_address` | `VARCHAR(50)` | NULL | | IP asal request. |

> ⚠️ DDL awal `status` = `VARCHAR(10)`; **wajib** diperlebar ke `VARCHAR(20)` via
> `patch_api_login_log_status_widen.sql` agar `RATE_LIMITED` (12 char) muat (jika tidak,
> insert throttle 500 karena data truncation).

#### Tabel: `api_log` (entity `ApiLog`)
> Audit setiap request/response API; body sudah **ter-mask** (`SensitiveDataMasker`) lalu
> di-truncate ≤ 2000 char sebelum simpan. Dibaca dashboard monitoring.

| No | Kolom | Tipe Data | Null | Default | Keterangan |
|----|-------|-----------|------|---------|------------|
| 1 | `id` | `BIGINT` | NOT NULL | AUTO_INCREMENT | **PK**. |
| 2 | `endpoint` | `VARCHAR(255)` | NULL | | Path endpoint. |
| 3 | `request` | `TEXT` | NULL | | Body request (ter-mask). |
| 4 | `response` | `TEXT` | NULL | | Body response (ter-mask). |
| 5 | `status` | `VARCHAR(20)` | NULL | | Status hasil. |
| 6 | `ip_addr` | `VARCHAR(150)` | NULL | | IP asal. |
| 7 | `created_at` | `TIMESTAMP` | NOT NULL | `CURRENT_TIMESTAMP` | Waktu (read-only). |

#### Tabel: `api_transaction_log` (entity `ApiTransactionLog`)
> Ringkasan transaksi untuk cek status (`/transaksi/status`) & isolasi office reversal.

| No | Kolom | Tipe Data | Null | Keterangan |
|----|-------|-----------|------|------------|
| 1 | `id` | `INT` | NOT NULL AUTO_INCREMENT | **PK**. |
| 2 | `tgl_trans` | `DATE` | NULL | Tanggal transaksi (indexed). |
| 3 | `jam_trans` | `TIME` | NULL | Jam transaksi. |
| 4 | `kuitansi` | `VARCHAR(75)` | NULL | No. referensi/kuitansi (indexed). |
| 5 | `tipe_trans` | `VARCHAR(12)` | NULL | Tipe transaksi (D1..T4, C1..C3, E1..E3, L2). |
| 6 | `modul_trans` | `VARCHAR(50)` | NULL | Modul (TAB/KRE/DEP). |
| 7 | `kuitansi_id` | `VARCHAR(75)` | NULL | ID kuitansi (indexed; dasar derivasi reversal `+"R"`). |
| 8 | `kode_kantor` | `VARCHAR(5)` | NULL | Kantor pemilik (indexed; dipakai tenant guard). |
| 9 | `akun_debet` | `VARCHAR(35)` | NULL | Akun debet. |
| 10 | `akun_kredit` | `VARCHAR(35)` | NULL | Akun kredit. |
| 11 | `nominal` | `DECIMAL(18,2)` | NULL | Nominal transaksi. |
| 12 | `adm` | `DECIMAL(18,2)` | NULL | Biaya administrasi. |
| 13 | `keterangan` | `VARCHAR(255)` | NULL | Keterangan. |
| 14 | `create_at` | `TIMESTAMP` | NULL `CURRENT_TIMESTAMP` | Waktu buat. |
| 15 | `status` | `TINYINT(1)` | DEFAULT 0 | Status (Integer, 1 digit). |

**Index:** `tgl_trans`, `kuitansi_id`, `kuitansi`, `kode_kantor`.

#### Tabel: `api_integration` (entity `ApiIntegration`)
> Referensi tipe integrasi transaksi + pemetaan ke kode perkiraan (GL). Endpoint `/transaksi/tipe`.

| No | Kolom | Tipe Data | Null | Keterangan |
|----|-------|-----------|------|------------|
| 1 | `kode_integrasi` | `VARCHAR(12)` | NOT NULL | **PK**. Kode tipe (C1/D1/E1/T1/L2...). |
| 2 | `deskripsi_integrasi` | `VARCHAR(255)` | NULL | Deskripsi (mis. "Setoran Tabungan Tunai"). |
| 3-7 | `kode_perk1..5` | `VARCHAR(35)` | NULL | Pemetaan kode perkiraan (GL) per skenario. |

#### Tabel: `api_binding_bank` (entity `ApiBindingBank`)
> Referensi kode binding bank untuk transaksi antar-bank (rekening ABA). Endpoint `/transaksi/bindingBank`.

| No | Kolom | Tipe Data | Null | Default | Keterangan |
|----|-------|-----------|------|---------|------------|
| 1 | `id` | `BIGINT` | NOT NULL | AUTO_INCREMENT | **PK**. |
| 2 | `kode_binding` | `VARCHAR(30)` | NOT NULL | | **UNIQUE** (`uk_api_binding_bank_kode`). |
| 3 | `nama_bank` | `VARCHAR(100)` | NOT NULL | | Nama bank. |
| 4 | `aba_account` | `VARCHAR(30)` | NOT NULL | | No. rekening ABA. |
| 5 | `kode_kantor` | `VARCHAR(10)` | NULL | | Kantor pemilik. |
| 6 | `is_active` | `TINYINT(1)` | NULL | `1` | Aktif (dropdown hanya yang aktif). |
| 7 | `created_at` | `TIMESTAMP` | NOT NULL | `CURRENT_TIMESTAMP` | Waktu buat. |

### 2.2 Tabel Core Banking IBS (kolom kunci — struktur dikelola IBS)

> Tabel-tabel berikut **milik/berbagi dengan Core Banking IBS**; H2H hanya membaca/menulis
> melalui entity JPA-nya. Ditampilkan kolom kunci relevan bagi H2H (bukan seluruh kolom
> legacy).

#### `nasabah` (entity `Nasabah`) — PK `nasabah_id` `VARCHAR(20)`
Kolom kunci: `nama_nasabah`, `alamat`, `hp`, `jenis_kelamin`(L/P), `tempatlahir`, `tgllahir`,
`jenis_id`, `no_id`(NIK 16 digit), `kode_agama`, `verifikasi`, `tgl_register`,
`nama_ibu_kandung`, `jenis_debitur`, **`kode_kantor`** (kunci tenant), `alamat_ktp`,
`propinsi`, `kota_kab`, `kecamatan`, `desa`, `kodepos`, `email`, `negara_domisili`,
`status_marital`, `slik_kode_negara`, `kode_group1..3`, `npwp`, `mata_uang`,
`status_tempat_tinggal`, `alamat_surat`, `kode_sumber_penghasilan`,
`kode_pemasukan_per_bulan`, `nama_kantor`, `alamat_kantor`. *(patch: `patch_nasabah_table.sql`
menambah `mata_uang` & `status_tempat_tinggal`.)*

#### `tabung` (entity `Tabung`) — PK `no_rekening` `VARCHAR(20)`
Kolom kunci: `nasabah_id` (FK→`nasabah`), `kode_produk` (→`tab_produk`), `suku_bunga`,
`persen_pph`, `tgl_register`, `minimum`, `setoran_minimum`, **`saldo_akhir`** (dikunci saat
posting), `verifikasi`, **`kode_kantor`**, `kode_integrasi`, `userid`, `status`.

#### `tabtrans` (entity `Tabtrans`) — PK `tabtrans_id` `VARCHAR(11)`
Mutasi tabungan: `tgl_trans`, `no_rekening` (→`tabung`), `kode_trans`, `my_kode_trans`,
`pokok`, `adm`, `kuitansi`, `userid`, `keterangan`, `no_rekening_vs` (rekening lawan),
`no_rekening_aba`, **`kode_kantor`**, `jam`, `kuitansi_id`, `trans_id_source`, `modul_id_source`.

#### `kredit` (entity `Kredit`) — PK `no_rekening` `VARCHAR(25)`
Kolom kunci: `nasabah_id` (FK→`nasabah`), `jml_pinjaman`, `suku_bunga_per_tahun`,
`satuan_waktu_angsuran`(H/M/B), `periode_angsuran`, `jml_angsuran`, `kode_integrasi`,
`type_kredit`, `tgl_realisasi`, `tgl_jatuh_tempo`, **`kode_kantor`**, `kode_produk`,
`no_spk`, `status`, `pokok_saldo_akhir`.

#### `kretrans` (entity `Kretrans`) — PK `kretrans_id` `VARCHAR(11)`
Transaksi kredit: `tgl_trans`, **`kode_kantor`**, `no_rekening` (→`kredit`), `kode_trans`,
`pokok`, `bunga`, `angsuran_ke`, `no_rekening_tabungan`, `no_rekening_aba`, `suku_bunga`,
`jkw`, `kuitansi`, `kuitansi_id`, `userid`, `jam`.

#### `deposito` (entity `Deposito`) — PK `no_rekening` `VARCHAR(20)`
Kolom kunci: `nasabah_id` (FK→`nasabah`), `kode_integrasi`, `suku_bunga`, `persen_pph`,
`tgl_registrasi`, `tgl_jt`, `jkw`, `aro`, `jml_deposito`, `tgl_mulai`, **`kode_kantor`**,
`kode_produk`, `no_alternatif_rek`, `no_rekening_tabungan`, `status_aktif`, `saldo_akhir_pokok`.

#### `deptrans` (entity `Deptrans`) — PK `deptrans_id`
Transaksi deposito: `tgl_trans`, `no_rekening` (→`deposito`), `kode_trans`, `my_kode_trans`,
`kuitansi`, `userid`, `pokok_trans`, `keterangan`, **`kode_kantor`**, `norek_tabungan`,
`no_rekening_aba`, `jam`, `kuitansi_id`.

#### Jurnal GL — `transaksi_master` / `transaksi_detail`
> Ditulis saat posting transaksi (bagian dari atomicity money-path).
- `transaksi_master` (PK `trans_id` `INT`) — header jurnal: `kode_jurnal`, `no_bukti`,
  `tgl_trans`, `uraian`, `modul_id_source`, `trans_id_source`, `userid`, `kode_kantor`,
  `verifikasi`, `kuitansi_id`.
- `transaksi_detail` (PK `trans_id` `INT`) — baris jurnal: `master_id` (→`transaksi_master`),
  `kode_perk` (→`perkiraan`), `debet` `DECIMAL(20,2)`, `kredit` `DECIMAL(20,2)`, `keterangan`,
  `kode_kantor_detail`. (Relasi `master_id` bersifat logis — kolom skalar, tanpa FK fisik.)

#### Master & referensi
- `tab_produk` (PK `kode_produk` V3), `kre_produk` (PK `kode_produk` V5), `dep_produk`
  (PK `kode_produk` V3) — master produk (suku bunga & PPh default, dll).
- `perkiraan` (PK `kode_perk` V20) — Chart of Accounts (GL); `nama_perk`, `flag_blokir`.
- `css_jenis_debitur` (PK `kode_jenis_debitur` V1), `css_kode_agama` (PK `kode_agama`),
  `css_sumber_penghasilan`, `css_pemasukan_per_bulan` — lookup validasi registrasi nasabah.
- `app_kode_kantor` (PK `kode_kantor` V4) — `nama_kantor`; dipakai saat login untuk melengkapi
  data kantor dari `unit_kerja`.

### 2.3 Tabel DB Sys (`cma_sys`)

#### Tabel: `sys_daftar_user` (entity `SysDaftarUser`) — PK `user_id` `VARCHAR(11)`
| No | Kolom | Tipe Data | Keterangan |
|----|-------|-----------|------------|
| 1 | `user_id` | `VARCHAR(11)` | **PK**. Dipakai sebagai klaim `user_id` token. |
| 2 | `user_name` | `VARCHAR(20)` | Username login. |
| 3 | `nama_lengkap` | `VARCHAR(50)` | Nama lengkap. |
| 4 | `user_web_password` | `VARCHAR(40)` | **SHA1(password)** — berbagi dengan legacy IBS, **jangan ubah format**. |
| 5 | `unit_kerja` | `VARCHAR(4)` | Kantor pengguna → klaim `kode_kantor` (batas tenant). |
| 6 | `kode_perk_kas` | `VARCHAR(20)` | Kode perkiraan kas. |
| 7 | `pengeluaran_tab` | `DECIMAL(18,2)` | Batas/akumulasi pengeluaran tabungan. |

#### Tabel: `sys_mysysid` (entity `SysMySysId`) — PK `keyname` `VARCHAR(60)`
> Parameter sistem key-value. `keyvalue` `VARCHAR(100)`. Contoh grup `MCS`:
> `MCS_TAB_KODE_PRODUK_REGISTER`, `MCS_TAB_VALIDASI_REGISTER`, `MCS_TAB_VALIDASI_TRANS_LIMIT`,
> `MCS_TAB_SETTING_KETERANGAN_DEFAULT` (lihat `patch_sys_mysysid_table.sql`).

---

## 3. Entity Relationship Diagram (ERD)

```
                                  app_kode_kantor
                                  (kode_kantor)
                                       ▲ (kode_kantor / unit_kerja)
        sys_daftar_user ──────────────┘
        (user_id, unit_kerja)

  nasabah (nasabah_id) 1 ──── N tabung   (no_rekening) 1 ──── N tabtrans (tabtrans_id)
                       1 ──── N kredit   (no_rekening) 1 ──── N kretrans (kretrans_id)
                       1 ──── N deposito (no_rekening) 1 ──── N deptrans (deptrans_id)

  tab_produk/kre_produk/dep_produk (kode_produk) 1 ──── N tabung/kredit/deposito
  transaksi_master (trans_id) 1 ──── N transaksi_detail (master_id)   [jurnal GL saat posting]
  perkiraan (kode_perk) ◄── transaksi_detail.kode_perk / api_integration.kode_perk1..5 (pemetaan GL)
  css_* (referensi) ◄── validasi registrasi nasabah

  --- Infrastruktur H2H (tanpa FK fisik; relasi logis) ---
  api_auth_config (client_id) ──► token JWT ──► api_refresh_tokens (username)
  api_login_log · api_log · api_transaction_log (audit/monitoring)
  api_integration · api_binding_bank (referensi transaksi)
```

> Catatan: banyak relasi bersifat **logis** (tanpa FK fisik) karena skema legacy IBS.
> Lampirkan diagram detail bila tersedia: `![ERD Host 2 Host](assets/erd.png)`

## 4. Aturan Bisnis Terkait Data

1. **Isolasi tenant** — hampir setiap tabel domain punya `kode_kantor`; akses non-HQ dibatasi
   ke office pada klaim token (`TenantGuard`). `api_transaction_log.kode_kantor` diindeks
   untuk pengecekan office pada cek-status & reversal.
2. **Integritas saldo** — `tabung.saldo_akhir` / `deposito.saldo_akhir_pokok` /
   `kredit.pokok_saldo_akhir` di-repost saat transaksi; baris dikunci (pessimistic lock)
   sebelum dihitung ulang. Multi-akun dikunci urut `no_rekening` asc (anti-deadlock).
3. **Idempotensi & reversal** — `kuitansi_id` menjadi dasar derivasi reversal (`+"R"`);
   guard `existsByKuitansiId(...+"R")` mencegah dobel-reversal. (Disarankan menambah UNIQUE
   pada `kuitansi_id` sebagai backstop DB — perlu koordinasi IBS.)
4. **Nominal** — kolom nominal `DECIMAL(18,2)`; aturan bisnis menolak nilai ≤ 0 (validasi
   di DTO + guard service, bukan constraint DB).
5. **Kredensial** — `sys_daftar_user.user_web_password` tetap **SHA1(40 char)**; format tidak
   boleh diubah (berbagi dengan legacy IBS).
6. **Refresh token** — satu baris aktif per `username`; login menimpa, refresh merotasi,
   logout menghapus.
7. **`ddl-auto=none`** — semua perubahan skema via patch SQL manual di `database/patches/`,
   diterapkan sebelum deploy build yang cocok.

## 5. DDL (tabel milik H2H)

> DDL berikut adalah tabel yang dibuat oleh produk H2H (dari `database/patches/add_*.sql`).
> Tabel domain (`nasabah`, `tabung`, dll.) dikelola oleh Core Banking IBS.

```sql
-- Konfigurasi auth per client
CREATE TABLE `api_auth_config` (
    `client_id`         VARCHAR(100) NOT NULL,
    `base64_secret`     TEXT,
    `access_token_exp`  BIGINT DEFAULT NULL,
    `refresh_token_exp` BIGINT DEFAULT NULL,
    PRIMARY KEY (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Refresh token store (revokasi & rotasi)
CREATE TABLE `api_refresh_tokens` (
    `id`          BIGINT NOT NULL AUTO_INCREMENT,
    `username`    VARCHAR(100) NOT NULL,
    `token`       TEXT NOT NULL,
    `expiry_date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Log login (status VARCHAR(20) setelah patch widen)
CREATE TABLE `api_login_log` (
    `id`         BIGINT NOT NULL AUTO_INCREMENT,
    `user_name`  VARCHAR(100) DEFAULT NULL,
    `status`     VARCHAR(20)  DEFAULT NULL,   -- widen dari VARCHAR(10)
    `login_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `ip_address` VARCHAR(50)  DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Audit request/response API
CREATE TABLE `api_log` (
    `id`         BIGINT NOT NULL AUTO_INCREMENT,
    `endpoint`   VARCHAR(255) DEFAULT NULL,
    `request`    TEXT,
    `response`   TEXT,
    `status`     VARCHAR(20)  DEFAULT NULL,
    `ip_addr`    VARCHAR(150) DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Log transaksi (cek status & reversal)
CREATE TABLE `api_transaction_log` (
    `id`          INT NOT NULL AUTO_INCREMENT,
    `tgl_trans`   DATE           DEFAULT NULL,
    `jam_trans`   TIME           DEFAULT NULL,
    `kuitansi`    VARCHAR(75)    DEFAULT NULL,
    `tipe_trans`  VARCHAR(12)    DEFAULT NULL,
    `modul_trans` VARCHAR(50)    DEFAULT NULL,
    `kuitansi_id` VARCHAR(75)    DEFAULT NULL,
    `kode_kantor` VARCHAR(5)     DEFAULT NULL,
    `akun_debet`  VARCHAR(35)    DEFAULT NULL,
    `akun_kredit` VARCHAR(35)    DEFAULT NULL,
    `nominal`     DECIMAL(18,2)  DEFAULT NULL,
    `adm`         DECIMAL(18,2)  DEFAULT NULL,
    `keterangan`  VARCHAR(255)   DEFAULT NULL,
    `create_at`   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    `status`      TINYINT(1)     DEFAULT '0',
    PRIMARY KEY (`id`),
    KEY `tgl_trans` (`tgl_trans`),
    KEY `receipt_number` (`kuitansi_id`),
    KEY `trx_reference` (`kuitansi`),
    KEY `branch_code` (`kode_kantor`)
) ENGINE=InnoDB;

-- Referensi kode binding bank (ABA)
CREATE TABLE `api_binding_bank` (
    `id`           BIGINT NOT NULL AUTO_INCREMENT,
    `kode_binding` VARCHAR(30)  NOT NULL,
    `nama_bank`    VARCHAR(100) NOT NULL,
    `aba_account`  VARCHAR(30)  NOT NULL,
    `kode_kantor`  VARCHAR(10)  DEFAULT NULL,
    `is_active`    TINYINT(1)   DEFAULT '1',
    `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `kode_binding` (`kode_binding`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Referensi tipe integrasi transaksi (kolom kode_perk1..5 = pemetaan GL)
CREATE TABLE `api_integration` (
    `kode_integrasi`      VARCHAR(12) NOT NULL,
    `deskripsi_integrasi` VARCHAR(255) DEFAULT NULL,
    `kode_perk1`          VARCHAR(35) DEFAULT NULL,
    `kode_perk2`          VARCHAR(35) DEFAULT NULL,
    `kode_perk3`          VARCHAR(35) DEFAULT NULL,
    `kode_perk4`          VARCHAR(35) DEFAULT NULL,
    `kode_perk5`          VARCHAR(35) DEFAULT NULL,
    PRIMARY KEY (`kode_integrasi`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
```

**Seed `api_integration` (tipe transaksi):** `C1/C2/C3` (Pencairan Pinjaman ke Tabungan/ABA/CoA),
`D1/D2/D3` (Setoran Tabungan Tunai/Via Bank/Via CoA), `E1/E2/E3` (Setoran Deposito dari
Tabungan/ABA/CoA), `L2` (Pembayaran Angsuran), `T1/T2/T3` (Transfer Antar Tabungan / Penarikan
via ABA / via CoA).

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 16 Juli 2026 | | Dokumen dibuat (dari entity JPA & DDL patch) |

---

*[← Kembali ke Host 2 Host](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
