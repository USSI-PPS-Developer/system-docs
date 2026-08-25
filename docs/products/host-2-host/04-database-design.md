# 🗄️ Desain Database — Host 2 Host

> Rancangan struktur basis data untuk produk **Host 2 Host** (diturunkan dari entity/model JPA & DDL patch).

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | Host 2 Host     |
| Jenis Dokumen     | Desain Database         |
| Versi             | 1.1.0               |
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
| **Primary** (`@Primary`) | `dbcore` | `spring.datasource` | Core Banking IBS: nasabah, tabungan, kredit, deposito, transaksi + tabel infrastruktur H2H (`api_*`) | `models.primary` |
| **Sys** | `dbcore_sys` | `sys.datasource` | Sistem/pengguna: `sys_daftar_user`, `sys_mysysid` | `models.sys` |

> ℹ️ **Nama skema `dbcore` / `dbcore_sys` bersifat generik** — nama database sebenarnya berbeda di
> tiap lembaga dan hanya ditentukan pada `jdbc-url` masing-masing datasource (tidak ada nama
> database yang di-hardcode di dalam kode/query). Di seluruh dokumen ini, `dbcore` = database
> primary/core banking dan `dbcore_sys` = database sistem/pengguna.

Catatan penting:
- **`spring.jpa.hibernate.ddl-auto=none`** — skema **tidak** di-generate Hibernate. DDL
  dikelola eksternal; perubahan dikirim sebagai patch SQL manual di `database/patches/`.
- Tabel dibagi dua kelompok kepemilikan:
  - **Milik H2H** (dibuat oleh produk ini, DDL ada di repo): `api_auth_config`,
    `api_refresh_tokens`, `api_login_log`, `api_log`, `api_transaction_log`,
    `api_integration`, `api_binding_bank`, `api_tab_campaign`, `api_tab_minimum_change`,
    `api_loan_style`.
  - **Milik / berbagi dengan Core Banking IBS (legacy)**: `nasabah`, `tabung`, `tabtrans`,
    `kredit`, `kretrans`, `deposito`, `deptrans`, tabel produk & referensi, serta
    `sys_daftar_user`, `sys_mysysid`. Struktur dikelola IBS — **jangan ubah format kolom**
    (mis. `sys_daftar_user.user_web_password` = SHA1, berbagi dengan aplikasi legacy).
- Redis (bukan tabel) menyimpan state idempotency & rate-limit sementara (TTL), bukan data
  persisten.

## 1. Daftar Tabel

### 1.1 Milik H2H — DB Primary (`dbcore`)
| No | Nama Tabel | Deskripsi |
|----|-----------|-----------|
| 1 | `api_auth_config` | Konfigurasi autentikasi per `client_id` (secret & masa berlaku token). |
| 2 | `api_refresh_tokens` | Penyimpanan refresh token aktif (revokasi & rotasi). |
| 3 | `api_login_log` | Jejak percobaan login (SUKSES/GAGAL/RATE_LIMITED). |
| 4 | `api_log` | Audit request/response API (ter-mask data sensitif). |
| 5 | `api_transaction_log` | Log transaksi (untuk cek status & reversal). |
| 6 | `api_integration` | Referensi tipe integrasi transaksi + pemetaan kode perkiraan. |
| 7 | `api_binding_bank` | Referensi kode binding bank (rekening ABA antar-bank). |
| 8 | `api_tab_campaign` | Master campaign saldo minimum tabungan (mis. bebas saldo minimum = 0). |
| 9 | `api_tab_minimum_change` | Jejak audit perubahan `tabung.minimum` (nilai asal → nilai baru). |
| 10 | `api_loan_style` | Master catalog *loan style* kredit M-Pay (nominal/tenor/suku bunga & persentase provisi/adm/denda yang disetujui bank). |

### 1.2 Berbagi dengan Core Banking IBS — DB Primary (`dbcore`)
| No | Nama Tabel | Deskripsi |
|----|-----------|-----------|
| 11 | `nasabah` | Data nasabah (CIF). |
| 12 | `tabung` | Rekening tabungan. |
| 13 | `tabtrans` | Transaksi tabungan (mutasi). |
| 14 | `kredit` | Rekening pinjaman/kredit. |
| 15 | `kretrans` | Transaksi kredit (pencairan/angsuran). |
| 16 | `deposito` | Rekening deposito. |
| 17 | `deptrans` | Transaksi deposito. |
| 18 | `transaksi_master` | Header jurnal GL (ditulis saat posting transaksi). |
| 19 | `transaksi_detail` | Baris jurnal GL (debet/kredit per akun; `master_id`→`transaksi_master`). |
| 20 | `tab_produk` / `kre_produk` / `dep_produk` | Master produk tabungan / kredit / deposito. |
| 21 | `tab_integrasi` / `kre_integrasi` / `dep_integrasi` | Pemetaan kode integrasi per modul ke kode perkiraan GL. |
| 22 | `perkiraan` | Bagan akun (Chart of Accounts / kode perkiraan GL). |
| 23 | `css_jenis_debitur`, `css_kode_agama`, `css_sumber_penghasilan`, `css_pemasukan_per_bulan` | Tabel referensi/lookup untuk validasi registrasi nasabah. |
| 24 | `app_kode_kantor` / `app_kode_kantor_atk` | Master kantor/unit kerja (`kode_kantor` → `nama_kantor`); varian ATK memuat pemetaan akun RAK antar-kantor. |
| 25 | `aba`, `aba_integrasi`, `abatrans` | Rekening & transaksi ABA (antar-bank). |

### 1.3 DB Sys (`dbcore_sys`)
| No | Nama Tabel | Deskripsi |
|----|-----------|-----------|
| 26 | `sys_daftar_user` | Data pengguna (kredensial SHA1, `unit_kerja` → `kode_kantor`). |
| 27 | `sys_mysysid` | Parameter sistem key-value (mis. setting registrasi/limit modul MCS). |

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

#### Tabel: `api_tab_campaign` (entity `ApiTabCampaign`)
> Master campaign saldo minimum tabungan — **satu-satunya sumber** nilai yang boleh menimpa
> `tab_produk.saldo_minimum_default`. Nilai saldo minimum tidak pernah berasal dari payload API
> (BR-020); konsumen hanya merujuk campaign yang sudah disetujui bank.

| No | Kolom | Tipe Data | Null | Default | Keterangan |
|----|-------|-----------|------|---------|------------|
| 1 | `kode_campaign` | `VARCHAR(20)` | NOT NULL | | **PK**. Dirujuk payload `kodeCampaign`. |
| 2 | `nama_campaign` | `VARCHAR(100)` | NOT NULL | | Nama campaign. |
| 3 | `kode_produk` | `VARCHAR(3)` | NOT NULL | | Produk tabungan yang dicakup (`tab_produk`). |
| 4 | `kode_kantor` | `VARCHAR(4)` | NULL | | **NULL = semua kantor**; baris per-kantor menang atas baris NULL. |
| 5 | `saldo_minimum` | `DECIMAL(18,2)` | NOT NULL | | Nilai yang dipakai sebagai `tabung.minimum` (0 = bebas saldo minimum). |
| 6 | `tgl_mulai` | `DATE` | NOT NULL | | Awal periode berlaku. |
| 7 | `tgl_akhir` | `DATE` | NOT NULL | | Akhir periode berlaku (registrasi otomatis kembali ke default setelah lewat). |
| 8 | `is_active` | `TINYINT(1)` | NOT NULL | `1` | Nonaktif = tidak dipakai walau periodenya masih berlaku. |
| 9 | `no_memo` | `VARCHAR(50)` | NULL | | Referensi memo/SK persetujuan BPR — jejak dasar campaign. |
| 10 | `dibuat_oleh` | `VARCHAR(20)` | NOT NULL | | Pembuat campaign — `user_id` **atau** nama/inisial unit pembuat (teks bebas, mis. `USSI`). |
| 11 | `disetujui_oleh` | `VARCHAR(20)` | NULL | | Pejabat yang menyetujui — `user_id` **atau** nama pejabat (mis. `B Eko Prasetyo`). Pilih satu gaya dan pakai konsisten per lembaga. |
| 12 | `created_at` | `DATETIME` | NOT NULL | `CURRENT_TIMESTAMP` | Waktu buat. |

**Index:** `idx_campaign_lookup` (`kode_produk`, `kode_kantor`, `is_active`, `tgl_mulai`, `tgl_akhir`).

#### Tabel: `api_tab_minimum_change` (entity `ApiTabMinimumChange`)
> Jejak audit setiap perubahan `tabung.minimum` via `POST /api/v1/tabungan/update-saldo-minimum`
> (BR-021). Alur API **tanpa maker-checker** (keputusan BPR), sehingga tabel ini adalah kontrol
> penggantinya: `minimum_lama` (nilai asal) membuat perubahan dapat dibuktikan ke pemeriksa dan
> dibalikkan. Baris ditulis **dalam transaksi yang sama** dengan UPDATE `tabung`, dan bersifat
> **append-only** (pengembalian ke default produk menambah baris, tidak menimpa baris lama).

| No | Kolom | Tipe Data | Null | Keterangan |
|----|-------|-----------|------|------------|
| 1 | `id` | `BIGINT` | NOT NULL | **PK**, AUTO_INCREMENT. |
| 2 | `no_rekening` | `VARCHAR(20)` | NOT NULL | Rekening tabungan yang diubah. |
| 3 | `kode_kantor` | `VARCHAR(4)` | NULL | Kantor pemilik rekening (saat perubahan). |
| 4 | `kode_produk` | `VARCHAR(3)` | NULL | Produk rekening (saat perubahan). |
| 5 | `kode_campaign` | `VARCHAR(20)` | NULL | Dasar campaign; NULL untuk aksi `DEFAULT_PRODUK`. |
| 6 | `aksi` | `VARCHAR(20)` | NOT NULL | `CAMPAIGN` / `DEFAULT_PRODUK`. |
| 7 | `minimum_lama` | `DECIMAL(18,2)` | NOT NULL | **Nilai asal** (before-image). |
| 8 | `minimum_baru` | `DECIMAL(18,2)` | NOT NULL | Nilai setelah perubahan. |
| 9 | `alasan` | `VARCHAR(255)` | NOT NULL | Alasan dari pemohon (wajib). |
| 10 | `user_id` | `VARCHAR(20)` | NOT NULL | Pelaku (dari klaim token). |
| 11 | `idempotency_key` | `VARCHAR(64)` | NULL | `X-IDEMPOTENCY-KEY` request. |
| 12 | `created_at` | `DATETIME` | NOT NULL | Waktu perubahan (WIB). |

**Index:** `idx_minimum_change_rek` (`no_rekening`), `idx_minimum_change_tgl` (`created_at`).

#### Tabel: `api_loan_style` (entity `ApiLoanStyle`)
> Master catalog kredit "*loan style*" untuk M-Pay — **satu-satunya sumber** `kode_produk`,
> `type_kredit`, `plafond` (jml pinjaman), `tenor` (jml angsuran), `suku_bunga_per_tahun`, serta
> persentase provisi/adm/denda yang boleh dipakai saat registrasi kredit lewat `loanStyleId`.
> Nilai-nilai ini tidak pernah berasal dari payload client — client hanya merujuk baris catalog
> yang sudah disetujui bank (`no_memo`/`disetujui_oleh`), pola yang sama dengan
> `api_tab_campaign` untuk campaign saldo minimum tabungan. **Belum ada baris yang di-seed
> dengan nilai final** — nilai `perc_provisi`/`perc_adm`/`perc_denda`/`type_kredit`/
> `suku_bunga_per_tahun` per nominal tier menunggu konfirmasi BPR (lihat catatan di bawah).

| No | Kolom | Tipe Data | Null | Default | Keterangan |
|----|-------|-----------|------|---------|------------|
| 1 | `id` | `BIGINT` | NOT NULL | AUTO_INCREMENT | **PK**. |
| 2 | `kode_produk` | `VARCHAR(5)` | NOT NULL | | Produk kredit yang dicakup (`kre_produk`). |
| 3 | `nama_loan_style` | `VARCHAR(100)` | NOT NULL | | Nama deskriptif (mis. "Pinjaman Rp2.000.000 - 1 Bulan"). |
| 4 | `plafond` | `DECIMAL(18,2)` | NOT NULL | | Nominal pinjaman tetap — satu dari 6 pilihan dropdown M-Pay. |
| 5 | `tenor` | `INT` | NOT NULL | | Jumlah angsuran (bulan); divalidasi aplikasi hanya **1** atau **3**. |
| 6 | `type_kredit` | `VARCHAR(3)` | NOT NULL | | Menentukan skema angsuran (flat/dst.); divalidasi terhadap set yang diizinkan (`100/200/300/310/350/700/710`). |
| 7 | `perc_provisi` | `DECIMAL(6,3)` | NOT NULL | `0` | % biaya provisi; dikonversi ke nominal saat registrasi (`plafond × perc_provisi / 100`) → `kredit.provisi`. |
| 8 | `perc_adm` | `DECIMAL(6,3)` | NOT NULL | `0` | % biaya admin; dikonversi ke nominal saat registrasi (`plafond × perc_adm / 100`) → `kredit.adm_lainnya`. |
| 9 | `perc_denda` | `DECIMAL(6,3)` | NOT NULL | `0` | % denda keterlambatan per hari (mis. `0.300` = 0,3%/hari). **Hanya disimpan** — belum ada logic yang menghitung/memposting denda pada alur angsuran/pembayaran. |
| 10 | `suku_bunga_per_tahun` | `DECIMAL(7,4)` | NOT NULL | `0` | Suku bunga per tahun (%) → `kredit.suku_bunga_per_tahun` saat registrasi via `loanStyleId`. Kolom ditambahkan belakangan (`patch_api_loan_style_suku_bunga.sql`, `ALTER ... DEFAULT 0`) — baris yang belum di-`UPDATE` manual (`= 0`) ditolak aplikasi ("Suku bunga loan style belum diisi"), lihat aturan data #12. |
| 11 | `is_active` | `TINYINT(1)` | NOT NULL | `1` | Nonaktif = tidak dapat dirujuk `loanStyleId`. |
| 12 | `no_memo` | `VARCHAR(50)` | NULL | | Referensi memo/SK persetujuan BPR — jejak dasar persetujuan *loan style*. |
| 13 | `dibuat_oleh` | `VARCHAR(20)` | NOT NULL | | Pembuat baris catalog. |
| 14 | `disetujui_oleh` | `VARCHAR(20)` | NULL | | Pejabat yang menyetujui. |
| 15 | `created_at` | `DATETIME` | NOT NULL | `CURRENT_TIMESTAMP` | Waktu buat. |

**Index:** `idx_loan_style_lookup` (`kode_produk`, `is_active`).

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
`kode_pemasukan_per_bulan`, `nama_kantor`, `alamat_kantor`, serta media KYC
**`photo`** & **`tandatangan`** (`LONGBLOB`, legacy IBS). *(patch: `patch_nasabah_table.sql`
menambah `mata_uang` & `status_tempat_tinggal`.)*
> **Konvensi media LONGBLOB.** `photo`/`tandatangan` dipertukarkan dengan client dalam bentuk
> **base64**: di-*decode* saat tulis (`POST /nasabah/upload-media`) dan di-*encode* saat baca
> (`GET /nasabah/wna/{nasabahId}`). Format penyimpanan LONGBLOB tidak diubah (coupling legacy IBS).
> Kolom sudah ada di skema — tidak ada patch DB baru untuk fitur upload media.

#### `tabung` (entity `Tabung`) — PK `no_rekening` `VARCHAR(20)`
Kolom kunci: `nasabah_id` (FK→`nasabah`), `kode_produk` (→`tab_produk`), `suku_bunga`,
`persen_pph`, `tgl_register`, `minimum`, `setoran_minimum`, **`saldo_akhir`** (dikunci saat
posting), `verifikasi`, **`kode_kantor`**, `kode_integrasi`, `userid`, `status`.

> ⚠️ **`minimum` adalah kolom bernilai uang**, bukan kosmetik: ikut menentukan saldo efektif
> (`saldo_akhir − saldo_blokir − minimum`) yang dipakai saat validasi penarikan, sehingga
> menurunkannya menaikkan dana yang dapat ditarik. Nilainya diisi saat registrasi dari campaign yang
> berlaku (`api_tab_campaign`) atau `tab_produk.saldo_minimum_default`, dan hanya boleh diubah
> melalui `POST /api/v1/tabungan/update-saldo-minimum` — yang selalu meninggalkan jejak
> `api_tab_minimum_change` dalam transaksi yang sama (BR-021). **Struktur tabel `tabung` tidak
> diubah** oleh fitur campaign (tidak ada patch pada tabel legacy ini).

#### `tabtrans` (entity `Tabtrans`) — PK `tabtrans_id` `VARCHAR(11)`
Mutasi tabungan: `tgl_trans`, `no_rekening` (→`tabung`), `kode_trans`, `my_kode_trans`,
`pokok`, `adm`, `kuitansi`, `userid`, `keterangan`, `no_rekening_vs` (rekening lawan),
`no_rekening_aba`, **`kode_kantor`**, `jam`, `kuitansi_id`, `trans_id_source`, `modul_id_source`.

#### `kredit` (entity `Kredit`) — PK `no_rekening` `VARCHAR(25)`
Kolom kunci: `nasabah_id` (FK→`nasabah`), `jml_pinjaman`, `suku_bunga_per_tahun`,
`satuan_waktu_angsuran`(H/M/B), `periode_angsuran`, `jml_angsuran`, `kode_integrasi`,
`type_kredit`, `tgl_realisasi`, `tgl_jatuh_tempo`, **`kode_kantor`**, `kode_produk`,
`no_spk`, `status`, `pokok_saldo_akhir`, `provisi` (`DECIMAL(18,2)`), `adm_lainnya`
(`DECIMAL(18,2)`), `perc_denda` (`DECIMAL(6,3)`) — ketiganya **sudah ada sebelumnya** di
`kredit` legacy, serta satu kolom **nullable BARU** untuk M-Pay: `loan_style_id` (`BIGINT`,
referensi `api_loan_style.id` — tanpa FK constraint, konsisten dengan `nasabah_id`).
*(patch: `patch_kredit_loan_style.sql` — hanya menambah `loan_style_id`.)*

> ⚠️ Fitur loan style M-Pay memetakan `provisi`/`adm_lainnya`/`perc_denda` di atas sebagai
> snapshot (`plafond × perc_provisi/perc_adm / 100`, dan salinan `perc_denda` catalog) saat
> registrasi via `loanStyleId` — tapi ketiga kolom **sudah ada di `kredit` sebelum perubahan
> ini** (bukan kolom baru); patch DB hanya menambah `loan_style_id`. Keempat field ini hanya
> diisi oleh service ini untuk kredit yang diregistrasi lewat `loanStyleId`
> (`POST /pinjaman/registrasi`); rekening kredit lama/non-M-Pay yang didaftarkan lewat jalur
> lama tetap **NULL** di `loan_style_id` (`provisi`/`adm_lainnya`/`perc_denda` tidak disentuh
> oleh jalur lama). Nilai loan-style adalah **snapshot saat registrasi** — perubahan pada
> `api_loan_style` belakangan tidak berlaku retroaktif ke kredit yang sudah terdaftar.
> `perc_denda` di sini **hanya disimpan**; belum ada logic penerapan denda keterlambatan pada
> alur angsuran (lihat FR-012a di SRS). `suku_bunga_per_tahun` (kolom kredit yang sudah ada
> sejak awal, di atas) juga ikut diturunkan dari `api_loan_style.suku_bunga_per_tahun` pada
> jalur `loanStyleId` — bukan kolom baru, tapi cara pengisiannya berubah untuk jalur ini.

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
  (PK `kode_produk` V3) — master produk (suku bunga & PPh default, dll). `dep_produk`
  memiliki `is_custom_rate` `TINYINT(1)` `NOT NULL DEFAULT 0` — bila `1`, produk deposito
  memakai *special/custom rate* (registrasi mewajibkan `sukuBunga` dari payload & membatasi
  `jkw` ke 1/3/6/12). Ditambahkan via `patch_dep_produk_is_custom_rate.sql`.
- `perkiraan` (PK `kode_perk` V20) — Chart of Accounts (GL); `nama_perk`, `flag_blokir`.
- `css_jenis_debitur` (PK `kode_jenis_debitur` V1), `css_kode_agama` (PK `kode_agama`),
  `css_sumber_penghasilan`, `css_pemasukan_per_bulan` — lookup validasi registrasi nasabah.
- `app_kode_kantor` (PK `kode_kantor` V4) — `nama_kantor`; dipakai saat login untuk melengkapi
  data kantor dari `unit_kerja`.

### 2.3 Tabel DB Sys (`dbcore_sys`)

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
8. **Saldo minimum & campaign** — `tabung.minimum` diisi saat registrasi dari campaign aktif
   (`api_tab_campaign`, cocok `kode_produk` + `kode_kantor` + periode; baris per-kantor menang atas
   baris `kode_kantor IS NULL`), jika tidak ada dari `tab_produk.saldo_minimum_default`. Nilainya
   **tidak pernah** berasal dari payload API.
9. **Audit perubahan data bernilai uang** — setiap perubahan `tabung.minimum` menulis satu baris
   `api_tab_minimum_change` (nilai asal → nilai baru, pelaku, waktu, alasan, dasar campaign) di
   dalam **satu transaksi** dengan UPDATE-nya; baris audit *append-only*. Baris audit tidak dibuat
   bila nilai lama = nilai baru (no-op). Pola yang sama wajib dipakai untuk perubahan kolom
   bernilai uang lain pada rekening existing.
10. **Loan style & catalog M-Pay** — `kredit.loan_style_id` (kolom baru) serta `provisi`/
    `adm_lainnya`/`perc_denda`/`suku_bunga_per_tahun` (kolom **yang sudah ada sebelumnya** di
    `kredit`, kini dipetakan & diisi oleh fitur ini) diisi saat registrasi dari `api_loan_style`
    (bila `loanStyleId` dikirim); nilai `kodeProduk`/`typeKredit`/`jmlPinjaman` (`plafond`)/
    `jmlAngsuran` (`tenor`)/`sukuBungaPerTahun` **tidak pernah** berasal langsung dari payload
    pada alur ini — hanya referensi ke baris catalog yang sudah disetujui bank, pola yang sama
    dengan aturan #8 untuk campaign saldo minimum. Alur registrasi lama (tanpa `loanStyleId`)
    tidak berubah.
11. **Denda keterlambatan belum diterapkan** — `api_loan_style.perc_denda` / `kredit.perc_denda`
    (0,3%/hari) pada perubahan ini baru berupa kolom data; belum ada logic yang
    menghitung/memposting denda pada alur angsuran/pembayaran. Metode angsuran tetap **flat**,
    tanpa penalti pelunasan dipercepat.
12. **Suku bunga catalog wajib di-backfill sebelum dipakai** — `api_loan_style.suku_bunga_per_tahun`
    ditambahkan lewat `ALTER ... DEFAULT 0` (`patch_api_loan_style_suku_bunga.sql`) setelah tabel
    sudah punya baris dari `patch_kredit_loan_style.sql`. `0` bukan suku bunga bisnis yang valid,
    jadi aplikasi menolak (`BusinessException` "Suku bunga loan style belum diisi") registrasi
    lewat `loanStyleId` manapun yang masih `suku_bunga_per_tahun <= 0` — mencegah kredit
    ter-registrasi dengan bunga 0% karena baris catalog belum sempat di-`UPDATE`.

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

-- Master campaign saldo minimum tabungan (patch_tab_campaign_saldo_minimum.sql)
CREATE TABLE `api_tab_campaign` (
    `kode_campaign`  VARCHAR(20)   NOT NULL,
    `nama_campaign`  VARCHAR(100)  NOT NULL,
    `kode_produk`    VARCHAR(3)    NOT NULL,
    `kode_kantor`    VARCHAR(4)             DEFAULT NULL,  -- NULL = semua kantor
    `saldo_minimum`  DECIMAL(18,2) NOT NULL,               -- 0 = bebas saldo minimum
    `tgl_mulai`      DATE          NOT NULL,
    `tgl_akhir`      DATE          NOT NULL,
    `is_active`      TINYINT(1)    NOT NULL DEFAULT 1,
    `no_memo`        VARCHAR(50)            DEFAULT NULL,  -- referensi persetujuan BPR
    `dibuat_oleh`    VARCHAR(20)   NOT NULL,
    `disetujui_oleh` VARCHAR(20)            DEFAULT NULL,
    `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`kode_campaign`),
    KEY `idx_campaign_lookup` (`kode_produk`, `kode_kantor`, `is_active`, `tgl_mulai`, `tgl_akhir`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Jejak audit perubahan tabung.minimum (append-only; ditulis satu transaksi dengan UPDATE tabung)
CREATE TABLE `api_tab_minimum_change` (
    `id`              BIGINT        NOT NULL AUTO_INCREMENT,
    `no_rekening`     VARCHAR(20)   NOT NULL,
    `kode_kantor`     VARCHAR(4)             DEFAULT NULL,
    `kode_produk`     VARCHAR(3)             DEFAULT NULL,
    `kode_campaign`   VARCHAR(20)            DEFAULT NULL, -- NULL untuk aksi DEFAULT_PRODUK
    `aksi`            VARCHAR(20)   NOT NULL,              -- CAMPAIGN | DEFAULT_PRODUK
    `minimum_lama`    DECIMAL(18,2) NOT NULL,              -- nilai asal (before-image)
    `minimum_baru`    DECIMAL(18,2) NOT NULL,
    `alasan`          VARCHAR(255)  NOT NULL,
    `user_id`         VARCHAR(20)   NOT NULL,
    `idempotency_key` VARCHAR(64)            DEFAULT NULL,
    `created_at`      DATETIME      NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_minimum_change_rek` (`no_rekening`),
    KEY `idx_minimum_change_tgl` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Master catalog loan style kredit M-Pay (patch_kredit_loan_style.sql)
CREATE TABLE `api_loan_style` (
    `id`              BIGINT        NOT NULL AUTO_INCREMENT,
    `kode_produk`     VARCHAR(5)    NOT NULL,
    `nama_loan_style` VARCHAR(100)  NOT NULL,
    `plafond`         DECIMAL(18,2) NOT NULL,
    `tenor`           INT           NOT NULL,              -- divalidasi aplikasi: hanya 1 atau 3
    `type_kredit`     VARCHAR(3)    NOT NULL,               -- divalidasi terhadap set typeKredit yang diizinkan
    `perc_provisi`    DECIMAL(6,3)  NOT NULL DEFAULT 0,
    `perc_adm`        DECIMAL(6,3)  NOT NULL DEFAULT 0,
    `perc_denda`      DECIMAL(6,3)  NOT NULL DEFAULT 0,    -- %/hari; belum ada logic penerapan
    `is_active`       TINYINT(1)    NOT NULL DEFAULT 1,
    `no_memo`         VARCHAR(50)            DEFAULT NULL, -- referensi persetujuan BPR
    `dibuat_oleh`     VARCHAR(20)   NOT NULL,
    `disetujui_oleh`  VARCHAR(20)            DEFAULT NULL,
    `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_loan_style_lookup` (`kode_produk`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Referensi loan style M-Pay pada kredit: nullable, hanya terisi untuk registrasi via loanStyleId.
-- kredit.provisi/adm_lainnya/perc_denda TIDAK ditambahkan di sini — kolom tsb SUDAH ADA
-- sebelumnya di kredit legacy (DECIMAL(18,2)/DECIMAL(18,2)/DECIMAL(6,3), cocok persis); fitur
-- loan style hanya memetakan & mengisinya saat registrasi via loanStyleId, tanpa patch DB.
ALTER TABLE `kredit`
    ADD COLUMN `loan_style_id` BIGINT DEFAULT NULL;

-- Suku bunga per tahun catalog (patch_api_loan_style_suku_bunga.sql — ditambahkan SETELAH
-- patch_kredit_loan_style.sql di atas, karena api_loan_style sudah punya baris live saat itu).
-- ⚠️ DEFAULT 0 bukan suku bunga bisnis yang valid — baris existing WAJIB di-UPDATE manual
-- (lihat contoh di akhir file patch); aplikasi menolak loanStyleId dengan nilai <= 0.
ALTER TABLE `api_loan_style`
    ADD COLUMN `suku_bunga_per_tahun` DECIMAL(7,4) NOT NULL DEFAULT 0;
-- UPDATE `api_loan_style` SET `suku_bunga_per_tahun` = 24.0000 WHERE `id` IN (1,2,3,4,5,6); -- contoh

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

**Seed `api_tab_campaign` (campaign bebas saldo minimum — `seed_api_tab_campaign.sql`):** empat
campaign untuk produk tabungan **201, 202, 203, 204** dengan `saldo_minimum = 0.00`,
`kode_kantor = NULL` (semua kantor), `is_active = 1`, `dibuat_oleh = 'USSI'`,
`disetujui_oleh = 'B Eko Prasetyo'`.

| `kode_campaign` | `nama_campaign` | `kode_produk` | `saldo_minimum` | Periode |
|-----------------|-----------------|---------------|-----------------|---------|
| `CMP-NOMIN-201-2026` | Bebas Saldo Minimum Produk 201 | `201` | `0.00` | 2026-08-01 … 2026-09-30 |
| `CMP-NOMIN-202-2026` | Bebas Saldo Minimum Produk 202 | `202` | `0.00` | 2026-08-01 … 2026-09-30 |
| `CMP-NOMIN-203-2026` | Bebas Saldo Minimum Produk 203 | `203` | `0.00` | 2026-08-01 … 2026-09-30 |
| `CMP-NOMIN-204-2026` | Bebas Saldo Minimum Produk 204 | `204` | `0.00` | 2026-08-01 … 2026-09-30 |

Catatan:
- `no_memo` pada file seeder masih **placeholder** (`MEMO/BPR/VIII/2026/001`) — ganti dengan nomor
  memo/SK persetujuan BPR yang asli sebelum dijalankan di produksi (kolom ini adalah jejak dasar
  persetujuan campaign).
- Periode dievaluasi **inklusif** (`tanggal BETWEEN tgl_mulai AND tgl_akhir`), jadi 2026-09-30 masih
  aktif dan campaign berakhir sendiri pada 2026-10-01 tanpa perubahan kode/deploy.
- Seeder **idempotent** (`INSERT … ON DUPLICATE KEY UPDATE`) sehingga aman dijalankan ulang.
- Menghentikan campaign lebih awal dilakukan dengan `is_active = 0`; **jangan `DELETE`** baris
  campaign karena `api_tab_minimum_change.kode_campaign` merujuknya (jejak audit harus tetap dapat
  ditelusuri).

**Catalog `api_loan_style` (*loan style* M-Pay) — belum ada baris seed dengan nilai final.**
Berbeda dengan `api_tab_campaign`, tabel ini **belum diisi data final** saat patch dijalankan:
BPR belum mengonfirmasi angka final `perc_provisi`/`perc_adm`/`perc_denda`/`type_kredit`/
`suku_bunga_per_tahun` per nominal tier (Rp1.000.000 / 2.000.000 / 3.500.000 / 5.000.000 /
7.500.000 / 10.000.000, tenor 1 atau 3 bulan). `patch_kredit_loan_style.sql` hanya menyertakan
contoh `INSERT` yang di-*comment* sebagai referensi struktur. Seeder resmi
(`seed_api_loan_style.sql`, mengikuti konvensi `seed_` yang sama dengan
`seed_api_tab_campaign.sql`, idempotent) menyusul setelah BPR mengonfirmasi nilainya.

> ⚠️ Jika baris `api_loan_style` **sudah** dibuat (mis. lingkungan dev/staging yang sudah
> lanjut ke tahap integrasi M-Pay) sebelum `patch_api_loan_style_suku_bunga.sql` dijalankan,
> baris-baris tsb otomatis mendapat `suku_bunga_per_tahun = 0` dari `DEFAULT 0` ALTER-nya —
> **wajib** di-`UPDATE` manual dengan suku bunga riil sebelum `loanStyleId`-nya bisa dipakai
> untuk registrasi (lihat aturan data #12 di atas dan contoh `UPDATE` di §5).

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 16 Juli 2026 | | Dokumen dibuat (dari entity JPA & DDL patch) |
| 1.1.0 | 16 Juli 2026 | | Tambah kolom `dep_produk.is_custom_rate` (`TINYINT(1) NOT NULL DEFAULT 0`) — flag produk deposito *special rate*; patch `patch_dep_produk_is_custom_rate.sql`. |
| 1.1.1 | 17 Juli 2026 | | Catatan aturan `jkw` produk *special rate* diperbarui `6/12` → 1/3/6/12 (tanpa perubahan skema). |
| 1.2.0 | 5 Agustus 2026 | | Nama database dibuat generik: `cma`/`cma_sys` → **`dbcore`/`dbcore_sys`** (nama skema spesifik lembaga tidak dipakai di dokumen yang di-deliver ke klien). Tambah tabel milik H2H `api_tab_campaign` (master campaign saldo minimum) & `api_tab_minimum_change` (jejak audit perubahan `tabung.minimum`) + DDL-nya; patch `patch_tab_campaign_saldo_minimum.sql`. Catatan `tabung.minimum` sebagai kolom bernilai uang & aturan data #8/#9. Tabel legacy `tabung` **tidak** diubah. |
| 1.2.1 | 6 Agustus 2026 | | Tambah bagian **Seed `api_tab_campaign`** (`seed_api_tab_campaign.sql`): 4 campaign bebas saldo minimum produk 201–204, `saldo_minimum` 0, semua kantor, 2026-08-01 s/d 2026-09-30, `dibuat_oleh` USSI / `disetujui_oleh` B Eko Prasetyo, seeder idempotent, penghentian campaign via `is_active = 0` (bukan `DELETE`). Keterangan kolom `dibuat_oleh`/`disetujui_oleh` diperjelas: boleh `user_id` maupun nama. Tanpa perubahan skema. |
| 1.3.0 | 25 Agustus 2026 | | CR BPR — pinjaman M-Pay: tambah tabel milik H2H `api_loan_style` (master catalog *loan style*: nominal/tenor & persentase provisi/adm/denda) + DDL-nya; patch `patch_kredit_loan_style.sql` menambah **1 kolom nullable baru** pada `kredit` (`loan_style_id`). `kredit.provisi`/`adm_lainnya`/`perc_denda` **sudah ada sebelumnya** di tabel legacy ini (`DECIMAL(18,2)`/`DECIMAL(18,2)`/`DECIMAL(6,3)`, cocok persis) — fitur ini hanya memetakan & mengisinya sebagai snapshot saat registrasi via `loanStyleId`, **tidak** menambahnya lewat patch. Daftar Tabel §1 dirapikan ulang nomornya (10→27). Aturan data #10/#11 ditambah. **Belum ada seed** `api_loan_style` — menunggu konfirmasi angka BPR; **denda keterlambatan (`perc_denda`) belum diterapkan**, hanya kolom data. |
| 1.3.1 | 25 Agustus 2026 | | Tambah kolom `api_loan_style.suku_bunga_per_tahun` (`DECIMAL(7,4)`, patch **baru** `patch_api_loan_style_suku_bunga.sql`, `ALTER ... DEFAULT 0` karena tabel sudah punya baris live dari patch sebelumnya) — `kredit.suku_bunga_per_tahun` (kolom lama, bukan baru) sekarang juga diturunkan dari catalog pada jalur `loanStyleId`. Aturan data #12 baru: baris catalog dengan suku bunga `<= 0` (mis. belum di-backfill setelah `ALTER`) ditolak aplikasi. |

---

*[← Kembali ke Host 2 Host](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
