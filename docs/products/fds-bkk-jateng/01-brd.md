# 📄 Business Requirement Document (BRD) — FDS BKK Jateng

> Dokumen kebutuhan bisnis untuk produk **FDS BKK Jateng**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | FDS BKK Jateng     |
| Jenis Dokumen     | Business Requirement Document (BRD)         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 30 Juni 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Latar Belakang

Bank/BPR menjalankan core banking IBS (NGS) yang mencatat seluruh transaksi nasabah pada
tabel `tabtrans`. Untuk mendeteksi indikasi fraud, data transaksi tersebut perlu
dipindahkan ke sistem Fraud Detection System (FDS) dalam format yang sudah ternormalisasi
dan diperkaya (enriched).

Karena database core (MySQL 5.5) bersifat **read-only** dan kritikal, ekstraksi data tidak
boleh membebani atau mengubah data sumber. Dibutuhkan sebuah **ETL Layer** terpisah yang:
- mengambil transaksi baru secara berkala dan inkremental,
- mentransformasikannya ke skema fraud detection,
- memuatnya ke database FDS (MySQL 8) untuk dianalisis oleh engine deteksi fraud.

## 2. Tujuan (Business Objectives)

| Kode | Tujuan |
|------|--------|
| OBJ-1 | Menyediakan aliran data transaksi dari core banking ke FDS secara **near-real-time** (interval default 1 menit). |
| OBJ-2 | Memastikan **tidak ada transaksi yang terlewat maupun terduplikasi** melalui mekanisme watermark per kantor. |
| OBJ-3 | Menstandarkan data transaksi mentah menjadi skema fraud (kategorisasi jenis transaksi, channel, merchant, reversal, dsb.). |
| OBJ-4 | Memperkaya transaksi dengan data nasabah (pengirim & penerima) dan lokasi (geolocation) untuk kebutuhan analisis fraud. |
| OBJ-5 | Menyediakan kemampuan **recovery / reprocessing** (backfill) per tanggal bila terjadi kegagalan. |
| OBJ-6 | Tidak mengganggu beban kerja core banking pada jam sibuk melalui **idle window**. |

## 3. Ruang Lingkup (Scope)

### 3.1 In Scope
- Ekstraksi transaksi tabungan (`tabtrans`, modul `TAB`) dari core banking.
- Enrichment data nasabah pengirim, penerima, dan geolocation (opsional).
- Transformasi & mapping ke tabel `t_transaction_mapping` pada DB FDS.
- Penjadwalan otomatis berbasis interval + idle window + catch-up.
- Trigger manual dan backfill via REST API.
- Pelacakan progres ETL melalui tabel watermark per kantor.

### 3.2 Out of Scope
- Algoritma/scoring deteksi fraud itu sendiri (dikonsumsi oleh sistem lain dari tabel hasil).
- UI/dashboard untuk analis fraud.
- Transaksi di luar modul tabungan (`TAB`).
- Penulisan balik (write-back) ke database core banking.

## 4. Stakeholders

| Peran | Kepentingan |
|-------|-------------|
| Tim Fraud / Compliance | Konsumen data hasil ETL untuk analisis & deteksi fraud. |
| Tim Operasional IT Bank | Memantau jalannya job ETL dan ketersediaan data. |
| DBA Core Banking | Memastikan ETL tidak membebani DB core (read-only). |
| Developer / Maintainer (USSI) | Pengembangan dan pemeliharaan sistem. |

## 5. Kebutuhan Bisnis (Business Requirements)

### 5.1 Ekstraksi Data Inkremental
- **BR-1.1** Sistem mengambil transaksi **per kantor (branch)** berdasarkan daftar yang
  terdaftar pada tabel watermark dengan `etl_name = TABTRANS_FRAUD`.
- **BR-1.2** Sistem hanya mengambil transaksi **baru** sejak posisi terakhir, menggunakan
  watermark gabungan `(last_trx_time, last_trx_id)` agar transaksi pada detik yang sama
  tidak terlewat maupun ganda.
- **BR-1.3** Hasil ekstraksi diurutkan kronologis `jam_trans` lalu `tabtrans_id` (ascending).
- **BR-1.4** Setelah batch berhasil dimuat, watermark kantor diperbarui ke transaksi
  terakhir yang diproses, beserta `last_run_at` dan `last_run_by`.

### 5.2 Enrichment Data
- **BR-2.1** Setiap transaksi diperkaya dengan data **nasabah pengirim** (CIF, nama, no. HP)
  melalui relasi rekening → tabungan → nasabah.
- **BR-2.2** Bila ada rekening lawan (`no_rekening_vs`), sistem menambahkan **nama penerima**.
- **BR-2.3** Enrichment **geolocation** (latitude, longitude) bersifat **opsional**,
  dikendalikan flag `scheduler.fraud-transaction-using-geo` (default `false`).

### 5.3 Transformasi & Kategorisasi
- **BR-3.1** Setiap transaksi diklasifikasikan ke dalam **feature code** berdasarkan kode
  transaksi (`kode_trans`):
  `NGS_CASH_IN`, `NGS_CASH_OUT`, `NGS_TRANSFER_OUT`, `NGS_PAYMENT`, `NGS_REVERSAL`,
  `NGS_SYSTEM`, atau `NGS_UNKNOWN` bila tidak dikenali.
- **BR-3.2** **Channel** ditentukan otomatis: `MOBILE` bila ada `device_id`, selain itu `TELLER`.
- **BR-3.3** **Merchant code** diekstrak dari keterangan untuk transaksi QRIS
  (format `QRIS_<NAMA_MERCHANT>`, dibersihkan & dipotong maks. 50 karakter).
- **BR-3.4** **Reference number** diisi dari `kuitansi_id`; bila kosong, digenerate dari
  `kodeKantor-tabtransId` (harus unik).
- **BR-3.5** **Flag reversal** = `Y` bila `kuitansi_id` berakhiran huruf `R`, selain itu `N`.
- **BR-3.6** **Amount** disimpan sebagai nilai absolut, dipisah bagian bulat dan desimal.
- **BR-3.7** Setiap record diberi identitas unik (UUID biner) dan jejak audit
  (`insert_by = ETL`, `insert_date`, `source_tabtrans_id`).

### 5.4 Penjadwalan & Idle Window
- **BR-4.1** ETL berjalan otomatis sesuai interval konfigurasi
  (`scheduler.fraud-transaction-interval`, default `1m`).
- **BR-4.2** Sistem **menunda eksekusi** selama **idle window**
  (`idle-start` s.d. `idle-end`, default `23:00–23:20`), termasuk yang melewati tengah malam.
- **BR-4.3** Tepat di akhir idle window, sistem menjalankan **catch-up** otomatis agar
  transaksi yang tertunda langsung diproses tanpa menunggu interval berikutnya.

### 5.5 Trigger Manual & Recovery
- **BR-5.1** Tersedia endpoint untuk **memicu ETL inkremental secara manual**:
  `POST /etl/etl/fraud-transactions`.
- **BR-5.2** Tersedia endpoint **backfill per tanggal** untuk recovery/reprocessing:
  `POST /etl/etl/fraud-transactions/backfill?date=YYYY-MM-DD` (memproses seluruh kantor
  pada tanggal tersebut).

### 5.6 Ketahanan & Audit
- **BR-6.1** Pemrosesan setiap kantor bersifat **transaksional** (rollback bila gagal);
  kegagalan satu kantor **tidak menghentikan** pemrosesan kantor lain.
- **BR-6.2** Seluruh tahapan ETL dicatat pada log (mulai, jumlah baris, sukses, gagal).

## 6. Kebutuhan Non-Fungsional (NFR)

| Kode | Kategori | Kebutuhan |
|------|----------|-----------|
| NFR-1 | Performa | Latensi data near-real-time (default interval 1 menit). |
| NFR-2 | Keamanan Data | Koneksi ke DB core bersifat **read-only**; tidak ada perubahan data sumber. |
| NFR-3 | Skalabilitas | Pemrosesan per kantor, pool koneksi core dibatasi (max 10, idle 2). |
| NFR-4 | Keandalan | Watermark menjamin idempotensi; transaksional per kantor. |
| NFR-5 | Observability | Logging terstruktur ke file (`logs/transaction-etl.log`). |
| NFR-6 | Lokalisasi | Zona waktu `Asia/Jakarta` konsisten di aplikasi & JDBC. |
| NFR-7 | Dokumentasi | API terdokumentasi via OpenAPI/Swagger UI. |

## 7. Arsitektur Data (Ringkas)

**Sumber (CORE — MySQL 5.5, read-only, `bkkjateng`)**
- `tabtrans` — transaksi tabungan
- `tabung` — data rekening tabungan
- `nasabah` — data nasabah
- `branchless_geolocation_trans` — lokasi transaksi (modul `TAB`)

**Tujuan (FDS — MySQL 8, `db_fraudsystem`)**
- `t_transaction_mapping` — transaksi ternormalisasi & enriched (output utama)
- `etl_watermark_kantor` — posisi watermark ETL per kantor

**Alur:**
`tabtrans (per kantor, > watermark)` → `enrich (nasabah + geo)` → `transform (feature/channel/merchant/reversal)` → `t_transaction_mapping` → `update watermark`

## 8. Asumsi & Ketergantungan
- Daftar kantor yang diproses sudah ter-seed di `etl_watermark_kantor` dengan `etl_name = TABTRANS_FRAUD`.
- Skema kedua database sudah ada (`ddl-auto=none`, aplikasi tidak membuat tabel).
- Engine deteksi fraud (di luar scope) membaca dari `t_transaction_mapping`.
- Kode transaksi (`kode_trans`) mengikuti pemetaan NGS yang terdefinisi di `FeatureCodeMapping`.

## 9. Risiko & Mitigasi
| Risiko | Mitigasi |
|--------|----------|
| `kode_trans` baru belum terpetakan | Jatuh ke `NGS_UNKNOWN` (perlu pemantauan & update mapping). |
| Lonjakan transaksi pada satu interval | Pemrosesan terurut + watermark; idle window menghindari jam sibuk. |
| Kegagalan koneksi DB di tengah batch | Transaksional → rollback, watermark tidak maju, batch diulang di run berikutnya. |
| Data tertinggal akibat downtime | Endpoint backfill per tanggal. |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 30 Juni 2026 | | Dokumen dibuat |

---

*[← Kembali ke FDS BKK Jateng](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
