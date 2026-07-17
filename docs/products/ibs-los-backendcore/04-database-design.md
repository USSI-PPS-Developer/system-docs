# 🗄️ Desain Database — IBS LOS BackEndCore

> Rancangan struktur basis data untuk produk **IBS LOS BackEndCore** (diturunkan dari SQL raw `JdbcTemplate` pada `CoreService` & service generator).

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS LOS BackEndCore |
| Jenis Dokumen     | Desain Database     |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 17 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 0. Ikhtisar & Konteks

Service **tidak memiliki tabel sendiri** — ia membaca & menulis langsung ke skema **Core
Banking IBS (legacy)** milik masing-masing BPR. Ada **dua koneksi database**:

| Koneksi | Skema (contoh) | Config (`app.ini`) | Isi | Cara akses |
|---------|----------------|--------------------|-----|------------|
| **Primary** | `bprlanggeng` / `balidananiaga` | `[database]` | Data operasional Core: nasabah, kredit, agunan, riwayat, & tabel referensi | `JdbcTemplate` (Spring datasource) |
| **Sys** | `<db>_sys` (mis. `bprlanggeng_sys`) | `[database_sys]` | Parameter sistem key-value (`sys_mysysid`) untuk template generator ID | Koneksi manual `ConnectionPoolSys` (`DriverManager`) |
| **Riwayat (opsional)** | `<db>_re` (mis. `bprlanggeng_re`) | (diturunkan) | Tabel riwayat kredit tahunan `kredit_2xxx` (fallback GEN1 bila tak ada `kredit_history`) | `JdbcTemplate` (cross-schema) |

Catatan penting:
- **Skema dikelola oleh IBS/DBA BPR** — service ini **tidak** membuat/mengubah struktur
  (tidak ada DDL milik produk, tidak ada Hibernate/JPA; semua raw SQL).
- **Skema bervariasi antar-BPR.** Service beradaptasi runtime lewat `SHOW TABLES LIKE` /
  `SHOW COLUMNS LIKE` / `SHOW DATABASES LIKE` (hasil di-cache):
  - `kredit_history` ada → query riwayat **GEN2**; jika tidak → cari schema `<db>_re` +
    tabel `kredit_2%` terbaru → query **GEN1**.
  - `css_kode_kelurahan` ada → detail & posting me-resolve kode kelurahan/kecamatan; jika
    tidak → simpan/tampilkan deskripsi apa adanya.
  - kolom `no_ktp_pasangan` pada `nasabah` → varian `INSERT nasabah` dengan/ tanpa kolom itu.
  - kolom `hub_penjamin` pada `kredit` → varian `INSERT kredit` dengan/ tanpa kolom itu.
- **ID di-generate** via stored function MySQL (`GENERATE_NASABAH_ID`, fungsi template
  no_rekening) + template dari `sys_mysysid`, dengan fallback acak bila gagal.

## 1. Daftar Tabel

### 1.1 Tabel Data Utama — DB Primary
| No | Nama Tabel | Deskripsi | Operasi |
|----|-----------|-----------|---------|
| 1 | `nasabah` | Data nasabah / CIF. | READ (details/history), INSERT (posting) |
| 2 | `kredit` | Rekening pinjaman/kredit. | READ (history/count), INSERT (posting) |
| 3 | `kredit_history` | Snapshot riwayat kolektibilitas & baki debet per rekening (GEN2). | READ |
| 4 | `kredit_2xxx` | Tabel riwayat kredit tahunan di schema `<db>_re` (fallback GEN1). | READ |
| 5 | `kre_agunan` | Data agunan/jaminan kredit. | INSERT (posting) |
| 6 | `kre_agunan_relasi` | Relasi agunan ↔ rekening kredit. | INSERT (posting) |

### 1.2 Tabel Referensi / Lookup — DB Primary
| No | Nama Tabel | Kolom kode | Kolom deskripsi | Dipakai untuk |
|----|-----------|-----------|-----------------|---------------|
| 7 | `css_kode_kelurahan` | `kode_kelurahan` | `deskripsi_kode_kelurahan` | Resolusi kelurahan (`desa`) |
| 8 | `css_kode_kecamatan` | `kode_kecamatan` | `deskripsi_kode_kecamatan` | Resolusi kecamatan |
| 9 | `css_kode_dati` | `kode_dati` | `deskripsi_kode_dati` | Resolusi kota/kabupaten (`kota_kab`) |
| 10 | `css_kode_propvinsi` | `kode_provinsi` | `nama_provinsi` | Resolusi provinsi (`propinsi`) |
| 11 | `slik_ref07_pekerjaan` | `kode_pekerjaan` | `deskripsi_pekerjaan` | Tampil pekerjaan (details) |
| 12 | `slik_ref13_jabatan` | `kode_jabatan` | `deskripsi_jabatan` | Tampil jabatan (details) |
| 13 | `slik_ref10_badan_usaha` | `kode_badan_usaha` | `deskripsi_badan_usaha` | Resolusi badan usaha |
| 14 | `slik_ref18_jenis_penggunaan` | `kode_jenis_penggunaan` | `deskripsi_jenis_penggunaan` | Resolusi `tujuan_kredit` |
| 15 | `sid_ref_sektor_ekonomi` | `Desc1` | `Desc2` | Resolusi bidang usaha / sektor ekonomi |
| 16 | `kre_kode_jenis_agunan` | `kode_jenis_agunan` | `deskripsi_jenis_agunan` (+ `persen_default`) | Resolusi jenis agunan & persen default |

> Catatan ejaan mengikuti skema Core apa adanya: `css_kode_propvinsi` (bukan "provinsi") dan
> `flag_backlist` (bukan "blacklist") memang demikian di database legacy.

### 1.3 DB Sys (`<db>_sys`)
| No | Nama Tabel | Deskripsi |
|----|-----------|-----------|
| 17 | `sys_mysysid` | Parameter sistem key-value (`KeyName`, `KeyValue`, `Group_ID`) — sumber template generator (mis. `KRE_TEMPLATE_NO_REKENING`). |

---

## 2. Detail Tabel (kolom kunci — struktur dikelola IBS)

> Hanya kolom yang **disentuh service** yang didokumentasikan. Struktur lengkap dikelola
> oleh IBS Core Banking.

### 2.1 `nasabah` — nasabah / CIF *(PK `nasabah_id`)*
| Kolom | Peran di service | Keterangan |
|-------|------------------|------------|
| `nasabah_id` | READ/INSERT (`no_cif`) | CIF; di-generate untuk nasabah baru. |
| `no_id` | READ (kunci NIK), INSERT | NIK debitur — kunci pencarian history/details. |
| `jenis_id` | INSERT (=`2`) | Jenis identitas. |
| `jenis_debitur`, `nama_nasabah`, `hp`, `tempatlahir`, `tgllahir`, `nama_ibu_kandung`, `jumlah_tanggungan` | INSERT/READ | Identitas dasar. |
| `alamat`, `desa`, `kecamatan`, `kota_kab`, `propinsi`, `kodepos`, `alamat_ktp` | INSERT/READ | Alamat (kolom `desa`/`kecamatan`/`kota_kab`/`propinsi` berisi **kode** hasil resolusi). |
| `slik_npwp`, `slik_kode_pekerjaan`, `id_jabatan` | READ | NPWP & referensi pekerjaan/jabatan. |
| `tempat_bekerja`, `alamat_kantor`, `telpon_kantor`, `penghasilan_utama`, `kode_pengeluaran_per_bulan` | INSERT | Data pekerjaan/ekonomi (`kode_pengeluaran_per_bulan` di-bucket 1–5). |
| `nama_suami_atau_istri`, `no_id_pasangan`, `no_ktp_pasangan` | INSERT/READ | Data pasangan (`no_ktp_pasangan` kondisional — lihat §0). |
| `penjamin_nama`, `penjamin_telpon` | INSERT | Kontak darurat/penjamin. |
| `kode_kantor` | INSERT | Kode kantor/unit. |
| `nama_lengkap_pemegang_usaha`, `jenis_id_pemegang_usaha` (=`2`), `no_id_pemegang_usaha` | INSERT/READ | Data pemegang usaha (badan usaha). |
| `tgl_akte_awal`, `no_akte_awal`, `tgl_akte_akhir`, `no_akte_akhir` | INSERT/READ | Data akte badan usaha. |
| `kode_badan_usaha`, `bidang_usaha` | INSERT/READ | Kode hasil resolusi badan/bidang usaha. |
| `nama_pejabat1..2`, `nama_alias_pejabat1..2`, `tempatlahir_pejabat1..2`, `tgllahir_pejabat1..2`, `alamat_pejabat1..2`, `kota_pejabat1..2`, `no_telp_pejabat1..2`, `no_hp_pejabat1..2`, `alamat_domisili_pejabat1..2` | INSERT/READ | Maks. 2 pejabat (dari `pejabat_json[]`). |
| `flag_backlist` | READ | `1` → blacklist "YA". |

### 2.2 `kredit` — rekening kredit *(PK `no_rekening`)*
| Kolom | Peran | Keterangan |
|-------|-------|------------|
| `no_rekening` | INSERT/READ | Nomor rekening kredit; di-generate. |
| `nasabah_id` | INSERT/READ | FK logis → `nasabah.nasabah_id`. |
| `kode_produk`, `kode_integrasi` | INSERT/READ | Diisi dari `product_id`. |
| `jml_pinjaman` | INSERT/READ | Plafon pinjaman. |
| `jml_angsuran` | INSERT | Tenor (bulan). |
| `suku_bunga_per_tahun` | INSERT | Suku bunga (%/tahun). |
| `slik_kode_jenis_penggunaan` | INSERT | Hasil resolusi `tujuan_kredit`. |
| `kode_kantor` | INSERT/READ | Kode kantor. |
| `keterangan` | INSERT | Catatan. |
| `nama_pasangan`, `no_id_pasangan`, `pekerjaan_pasangan` | INSERT/READ | Data pasangan pada konteks kredit. |
| `penjamin`, `hubungan_penjamin` | INSERT | Penjamin (`hubungan_penjamin` kondisional — lihat §0). |
| `pokok_saldo_akhir` | READ | Baki debet (history). |
| `tgl_realisasi`, `tgl_lunas` | READ | Tanggal mulai/lunas (history). |

### 2.3 `kredit_history` — riwayat kolektibilitas (GEN2)
| Kolom | Keterangan |
|-------|------------|
| `no_rekening` | FK logis → `kredit.no_rekening`. |
| `tanggal` | Tanggal snapshot (ambil `MAX(tanggal)` per rekening). |
| `kolektibilitas` | Kode kolektibilitas (`L`, `DPK`, `DP`, `KL`, `D`, `M`). |
| `my_kolek_number` | Kolektibilitas numerik (1–5). |
| `baki_debet`, `plafond` | Nilai baki debet & plafon historis. |

> **Varian GEN1** (`kredit_2xxx` di `<db>_re`): kolom yang dipakai `no_rekening`,
> `kolektibilitas`, `my_kolek_number`, `baki_debet`, `plafond` (tanpa agregasi `MAX(tanggal)`).

### 2.4 `kre_agunan` — agunan *(PK `agunan_id`)*
| Kolom | Keterangan |
|-------|------------|
| `agunan_id` | ID agunan; di-generate (retry bila duplikat). |
| `deskripsi_ringkas` | Deskripsi agunan (default "KREDIT TANPA AGUNAN"). |
| `nilai_agunan`, `nilai_taksasi_detail` | Nilai agunan (keduanya diisi dari `nilai`). |
| `persen_dijaminkan_detail` | Persentase dijaminkan (eksplisit → `persen_default` master → default 100/0). |
| `kode_jenis_agunan` | Kode jenis agunan (eksplisit atau resolusi dari `jenis`). |
| `no_rekening_agunan` | Rekening kredit terkait. |
| `kode_kantor` | Kode kantor. |

### 2.5 `kre_agunan_relasi` — relasi agunan ↔ rekening
| Kolom | Keterangan |
|-------|------------|
| `agunan_id` | FK logis → `kre_agunan.agunan_id`. |
| `no_rekening` | FK logis → `kredit.no_rekening`. |
| `kode_kantor` | Kode kantor. |

### 2.6 `sys_mysysid` — parameter sistem (DB Sys)
| Kolom | Keterangan |
|-------|------------|
| `KeyName` | Nama parameter (mis. `KRE_TEMPLATE_NO_REKENING`, `KRE_TEMPLATE_CD_NO_REKENING`). |
| `KeyValue` | Nilai/template (mis. `###XX[000000]`). |
| `Group_ID` | Pengelompokan parameter. |

## 3. Generator ID

| Generator | Sumber angka | Mekanisme | Fallback |
|-----------|--------------|-----------|----------|
| `no_rekening` (`GeneratorRekeningService`) | `MAX(no_rekening)` per prefix pada `kredit` | Template dari `sys_mysysid` + stored function MySQL | `CORE-<tahun>-<6 digit acak>` |
| `agunan_id` (`GeneratorAgunanId`) | `MAX(agunan_id)` / `COUNT(*)` pada `kre_agunan` | Template + increment | `AGU-<tahun>-<6 digit acak>` |
| `nasabah_id` / `no_cif` (`GeneratorNasabahIdService`) | `MAX(nasabah_id)` / `COUNT(*)` pada `nasabah` | Stored function `GENERATE_NASABAH_ID('<template>', <pad>)` | — (retry regenerate saat duplikat) |

## 4. Entity Relationship Diagram (ERD)

```
                         sys_mysysid (KeyName)        [DB _sys — template generator]
                              │ (baca template no_rekening / nasabah_id)
                              ▼
                        [Generator ID]

  nasabah (nasabah_id, no_id=NIK)
      │ 1
      │        ┌──────── N kredit (no_rekening, nasabah_id)
      └────────┤              │ 1
               │              └──── N kredit_history (no_rekening)        [GEN2]
               │                       ~ atau kredit_2xxx @ <db>_re       [GEN1 fallback]
               │
               └─ (posting) ─► kre_agunan (agunan_id) 1 ─ N kre_agunan_relasi (agunan_id, no_rekening)

  Resolusi deskripsi → kode (fuzzy LIKE, cache):
    css_kode_kelurahan / css_kode_kecamatan / css_kode_dati / css_kode_propvinsi
    slik_ref07_pekerjaan / slik_ref13_jabatan / slik_ref10_badan_usaha
    slik_ref18_jenis_penggunaan / sid_ref_sektor_ekonomi / kre_kode_jenis_agunan
        ◄── dipakai saat details (tampil) & post-loan (isi kode di nasabah/kredit/agunan)
```

> Catatan: seluruh relasi bersifat **logis** (tanpa FK fisik yang dijamin service) karena
> skema legacy IBS. Lampirkan diagram detail bila tersedia: `![ERD](assets/erd.png)`.

## 5. Aturan Bisnis Terkait Data

1. **Kunci pencarian** — debitur dicari via `nasabah.no_id` (NIK), bukan `nasabah_id`.
2. **Posting atomik** — `INSERT nasabah` (bila baru) + `INSERT kredit` + `INSERT kre_agunan`
   & `kre_agunan_relasi` berjalan dalam satu `@Transactional`; gagal salah satu → rollback.
3. **ID unik + retry** — `nasabah_id` & `agunan_id` di-regenerate lalu di-insert ulang
   (maks 5×) saat `DuplicateKeyException`.
4. **Resolusi referensi** — nilai yang cocok pola kode (`^[A-Za-z]*\d+[A-Za-z\d]*$`) dipakai
   apa adanya; selain itu di-resolve via `LIKE '%deskripsi%'` (hasil di-cache in-memory).
5. **Bucket pengeluaran** — `pengeluaran` dipetakan ke `kode_pengeluaran_per_bulan`:
   `<1jt→1`, `≤2jt→2`, `≤5jt→3`, `≤10jt→4`, `>10jt→5`.
6. **Kolektibilitas** — dipetakan ke rank 1–5 (`L/1→1`, `DPK/DP/2→2`, `KL/3→3`, `D/4→4`,
   `M/MACET/5→5`); `worst_kolektibilitas` = rank tertinggi antar-riwayat.
7. **Adaptasi skema** — pemilihan tabel/kolom via `SHOW TABLES/COLUMNS/DATABASES` (di-cache);
   nama tabel/schema divalidasi `[A-Za-z0-9_]+` sebelum diinterpolasi ke SQL (anti-injeksi).
8. **Timeout JDBC** — koneksi memakai `connectTimeout=5000` & `socketTimeout=30000`,
   `serverTimezone=Asia/Jakarta`, `useSSL=false`.
9. **Skema tidak dikelola service** — tidak ada DDL/patch milik produk; perubahan struktur
   dilakukan oleh tim IBS Core.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dokumen dibuat berdasarkan SQL raw pada `CoreService` & service generator. |

---

*[← Kembali ke IBS LOS BackEndCore](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
