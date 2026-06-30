# 📐 Software Requirements Specification (SRS) — FDS BKK Jateng

> Spesifikasi kebutuhan perangkat lunak untuk produk **FDS BKK Jateng** (mengacu kaidah IEEE 830).

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | FDS BKK Jateng     |
| Jenis Dokumen     | Software Requirements Specification (SRS)         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 30 Juni 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Pendahuluan

### 1.1 Tujuan Dokumen
Dokumen ini menjabarkan spesifikasi perangkat lunak modul ETL Fraud Detection System:
kebutuhan fungsional, antarmuka, model data, aturan transformasi, parameter konfigurasi,
serta kebutuhan non-fungsional — sebagai acuan pengembangan, pengujian, dan pemeliharaan.

### 1.2 Lingkup Produk
Aplikasi Spring Boot yang menjalankan proses ETL (Extract–Transform–Load) untuk memindahkan
transaksi tabungan dari database **core banking (NGS/IBS)** ke database **Fraud Detection
System (FDS)** dalam skema ternormalisasi & ter-enrich, secara terjadwal maupun manual.
Algoritma deteksi fraud berada **di luar lingkup** modul ini.

### 1.3 Definisi & Istilah
| Istilah | Keterangan |
|---------|-----------|
| ETL | Extract, Transform, Load |
| CORE | Database core banking sumber (MySQL 5.5, read-only, `bkkjateng`) |
| FDS | Database tujuan Fraud Detection System (MySQL 8, `db_fraudsystem`) |
| Kantor | Cabang/branch bank, diidentifikasi `kode_kantor` |
| Watermark | Penanda posisi transaksi terakhir yang berhasil diproses per kantor |
| Feature Code | Kategori jenis transaksi hasil klasifikasi (mis. `NGS_CASH_IN`) |
| Backfill | Pemrosesan ulang transaksi untuk tanggal tertentu (recovery) |
| Idle Window | Rentang waktu di mana ETL terjadwal ditangguhkan |

### 1.4 Teknologi
- **Bahasa/Runtime:** Java 17
- **Framework:** Spring Boot 3.3.5 (Web, Data JPA/Hibernate, Quartz, Validation)
- **Database:** MySQL 5.5 (core, read-only) & MySQL 8 (FDS)
- **Lainnya:** Lombok, springdoc-openapi (Swagger UI), HikariCP
- **Build/Deploy:** Maven (`mvnw`), Dockerfile, docker-compose

## 2. Deskripsi Umum

### 2.1 Arsitektur Komponen
```
                    ┌─────────────────────────────────────────────┐
                    │           ETL Layer (Spring Boot)            │
  ┌───────────┐     │                                              │     ┌───────────┐
  │   CORE    │     │  TransactionFraudService  (scheduler)        │     │    FDS     │
  │ MySQL 5.5 │◄────┤        │                                     │     │  MySQL 8   │
  │ read-only │ JPA │        ▼                                     │ JPA │            │
  │           │     │  TransactionFraudETL  (orchestrator)         │────►│ t_transaction_mapping
  │ tabtrans  │     │        │                                     │     │ etl_watermark_kantor
  │ tabung    │     │        ▼ per kantor                          │     │            │
  │ nasabah   │     │  TransactionFraudWorker (extract+map+load)   │     └───────────┘
  │ geoloc.   │     │        │           ▲                         │
  └───────────┘     │        ▼           │                         │
                    │  TransactionFraudHelper (transform rules)    │
                    │  ETLController (manual trigger / backfill)   │
                    └─────────────────────────────────────────────┘
```

### 2.2 Komponen Perangkat Lunak
| Komponen | Tanggung jawab |
|----------|----------------|
| `TransactionFraudService` | Entry point terjadwal (`@Scheduled`), evaluasi idle window & catch-up. |
| `TransactionFraudETL` | Orkestrasi: iterasi watermark per kantor untuk run normal & backfill. |
| `TransactionFraudWorker` | Extract (query incremental), map, load (`saveAll`), update watermark — transaksional. |
| `TransactionFraudHelper` | Aturan transformasi: feature code, channel, merchant, reference number, reversal. |
| `ETLController` | REST endpoint untuk trigger manual & backfill. |
| `TransactionFraudSchedulerConfig` | Membangun ekspresi cron dari interval & cron catch-up idle-end. |
| `SchedulerProperties` | Binding konfigurasi `scheduler.*` (tervalidasi). |
| `CoreTabtransRepository` | Query ekstraksi dari CORE (incremental & by-date, dengan/ tanpa geo). |
| `FraudTransactionRepository` | Persist ke `t_transaction_mapping`. |
| `EtlWatermarkKantorRepository` | Baca daftar kantor & update watermark. |
| `Core/FdsDataSourceConfig` | Konfigurasi dua datasource + transaction manager terpisah. |

### 2.3 Asumsi & Ketergantungan
- `etl_watermark_kantor` ter-seed untuk setiap kantor dengan `etl_name = 'TABTRANS_FRAUD'`.
- Skema kedua DB sudah ada (`spring.jpa.hibernate.ddl-auto=none`).
- Konektivitas jaringan ke kedua database tersedia.
- Zona waktu sistem & DB diselaraskan ke `Asia/Jakarta`.

## 3. Kebutuhan Fungsional

### FR-1 — Penjadwalan ETL Inkremental
- **FR-1.1** Sistem menjalankan ETL secara periodik dengan cron yang diturunkan dari
  `scheduler.fraud-transaction-interval` (mis. `1m`, `5m`, `1h`) via `CronUtil.fromInterval`.
- **FR-1.2** Sebelum eksekusi, sistem mengevaluasi idle window. Bila waktu sekarang berada
  dalam `[idle-start, idle-end)`, eksekusi **di-skip** dan dicatat ke log.
- **FR-1.3** Logika idle window mendukung rentang yang **melewati tengah malam**
  (mis. `23:50–00:10`).
- **FR-1.4** Bila `idle-start`/`idle-end` kosong/blank → idle window dianggap nonaktif.

### FR-2 — Idle Catch-up
- **FR-2.1** Sistem mendaftarkan job cron tambahan yang fire **tepat di `idle-end`**
  (format cron `0 <menit> <jam> * * *`) untuk langsung memproses transaksi tertunda.
- **FR-2.2** Bila `idle-end` tidak dikonfigurasi, cron catch-up bernilai `"-"` (Spring: disabled).

### FR-3 — Ekstraksi Inkremental Berbasis Watermark
- **FR-3.1** Sistem mengambil seluruh baris `etl_watermark_kantor` dengan
  `etl_name = 'TABTRANS_FRAUD'`, lalu memproses **per kantor**.
- **FR-3.2** Untuk tiap kantor, query mengambil transaksi dengan kondisi keyset:
  `jam_trans > lastTime` **ATAU** (`jam_trans = lastTime` **DAN** `tabtrans_id > lastId`),
  diurutkan `jam_trans ASC, tabtrans_id ASC`.
- **FR-3.3** Jika `scheduler.fraud-transaction-using-geo = true`, query menyertakan
  enrichment geolocation; jika `false`, latitude/longitude diisi `null`.
- **FR-3.4** Bila tidak ada baris baru, kantor dilewati tanpa perubahan watermark.

### FR-4 — Enrichment Data
- **FR-4.1** Setiap transaksi di-JOIN ke `tabung` → `nasabah` (pengirim): CIF, nama, no. HP.
- **FR-4.2** Bila `no_rekening_vs` ada, LEFT JOIN ke rekening/nasabah lawan untuk nama penerima.
- **FR-4.3** Geolocation di-LEFT JOIN dari `branchless_geolocation_trans`
  (`trans_id = tabtrans_id` AND `modul = 'TAB'`).

### FR-5 — Transformasi & Mapping
Setiap `TabTrans` dipetakan ke entity `TransactionMapping` dengan aturan:

| Field tujuan | Aturan |
|---|---|
| `id` | UUID v-random → 16 byte (`BINARY(16)`) |
| `mapping_type` | konstanta `"TRANSACTION"` |
| `account_number` | `no_rekening` (pengirim) |
| `account_destination` | `no_rekening_vs` (bila ada) |
| `transaction_date` | `jam_trans` |
| `amount` | `\|pokok\|` dibulatkan ke bilangan bulat (HALF_UP); `0` bila null |
| `amount_decimal` | bagian desimal dari `\|pokok\|`; `0` bila null |
| `feature_code` | hasil `FeatureCodeMapping.resolve(kode_trans)` (lihat FR-6) |
| `merchant_code` | nama merchant QRIS bila feature `NGS_PAYMENT`/`NGS_DIGITAL_IN` (lihat FR-7) |
| `reference_number` | `kuitansi_id`; bila null → `<kodeKantor>-<tabtransId>` (unik) |
| `response_code` | konstanta `"00"` |
| `source_type` | konstanta `"NGS"` |
| `channel` | `MOBILE` bila `device_id` ada, selain itu `TELLER` |
| `trkey` | `kode_trans` |
| `trx_desc` | `keterangan` |
| `device_id`, `ip_address` | dari sumber |
| `customer_cif`, `customer_fullname`, `phone_number` | dari nasabah pengirim |
| `receiver_fullname` | dari nasabah penerima (bila `no_rekening_vs` ada) |
| `teller_id` | `user_id` |
| `authorizer_id` | `otorisasi` |
| `source_tabtrans_id` | `tabtrans_id` (jejak ke sumber) |
| `latitude`, `longitude` | dari geolocation (bila geo aktif) |
| `reversal` | `Y`/`N` (lihat FR-8) |
| `insert_date` | waktu proses (`now`) |
| `insert_by` | konstanta `"ETL"` |

### FR-6 — Klasifikasi Feature Code
- **FR-6.1** `kode_trans` dinormalisasi (trim + uppercase).
- **FR-6.2** Bila numerik, dicocokkan ke himpunan kode angka tiap kategori; bila string,
  dicocokkan ke himpunan kode string. Kategori:

  | Feature Code | Contoh kode angka | Kode string |
  |---|---|---|
  | `NGS_CASH_IN` | 100–123, 132, 141–143, 150, 152, 160, 170, 180, 182, 244, 335, 338, 701–702 | `DEP` |
  | `NGS_CASH_OUT` | 200–250, 270, 280, 282, 336–337, 378, 601–602 | `WD` |
  | `NGS_TRANSFER_OUT` | 271–273, 315–320, 330, 332–333 | `TRF` |
  | `NGS_PAYMENT` | 140, 274–275, 290, 301–310, 321–323, 327, 334, 339–341, 358, 363 | `QRIS`, `BILL`, `PMT`, `TOPUP` |
  | `NGS_REVERSAL` | 176–179, 199, 251, 253, 276–279, 324, 328, 342 | `REV` |
  | `NGS_SYSTEM` | 20, 109, 299, 325, 326, 900 | `SYS` |

- **FR-6.3** `kode_trans` kosong/null → `NGS_UNKNOWN`; tidak cocok manapun → `NGS_UNKNOWN`.

### FR-7 — Ekstraksi Merchant QRIS
- **FR-7.1** Hanya untuk feature `NGS_PAYMENT` atau `NGS_DIGITAL_IN`; selainnya `null`.
- **FR-7.2** Bila `keterangan` mengandung `QRIS`, ambil teks setelah `QRIS`, uppercase,
  buang karakter selain `[A-Z0-9 ]`, ganti spasi dengan `_`, potong maks. 50 karakter,
  beri prefix → `QRIS_<NAMA>`. Bila kosong → `null`.

### FR-8 — Flag Reversal
- **FR-8.1** `kuitansi_id` null → `N`.
- **FR-8.2** `kuitansi_id` (trim+upper) berakhiran `R` → `Y`; selainnya `N`.

### FR-9 — Pemuatan & Update Watermark
- **FR-9.1** Hasil mapping disimpan batch via `saveAll` ke `t_transaction_mapping`.
- **FR-9.2** Setelah sukses, watermark kantor di-update ke transaksi terakhir
  (`last_trx_time`, `last_trx_id`), beserta `last_run_at = CURRENT_TIMESTAMP` dan
  `last_run_by = 'SCHEDULER'`.

### FR-10 — Trigger Manual & Backfill (REST API)
- **FR-10.1** `POST /etl/etl/fraud-transactions` → memicu ETL inkremental; respons `202 Accepted`.
- **FR-10.2** `POST /etl/etl/fraud-transactions/backfill?date=YYYY-MM-DD` → memproses ulang
  seluruh kantor untuk tanggal tersebut (filter `tgl_trans = :date`, **tanpa** update
  watermark); respons `202 Accepted`.

### FR-11 — Ketahanan & Logging
- **FR-11.1** Pemrosesan tiap kantor dibungkus `@Transactional` (manager `fdsTransactionManager`,
  `rollbackFor = Exception.class`).
- **FR-11.2** Exception pada satu kantor **tidak menghentikan** kantor lain (di-catch & di-log).
- **FR-11.3** Setiap tahap dicatat ke log (start, geo on/off, jumlah baris, sukses, gagal)
  ke file `logs/transaction-etl.log` (logback).

## 4. Antarmuka Eksternal

### 4.1 Antarmuka API
| Method | Path | Query | Body | Sukses | Keterangan |
|--------|------|-------|------|--------|------------|
| POST | `/etl/etl/fraud-transactions` | — | — | `202 Accepted` + teks | ETL inkremental watermark-based |
| POST | `/etl/etl/fraud-transactions/backfill` | `date` (ISO `YYYY-MM-DD`, wajib) | — | `202 Accepted` + teks | Backfill per tanggal |
| GET | `/swagger-ui` / `/v3/api-docs` | — | — | `200` | Dokumentasi OpenAPI |

### 4.2 Antarmuka Database
- **CORE (read-only):** baca `tabtrans`, `tabung`, `nasabah`, `branchless_geolocation_trans`.
- **FDS:** baca/tulis `t_transaction_mapping`; baca/update `etl_watermark_kantor`.

## 5. Model Data

### 5.1 Output — `t_transaction_mapping` (FDS)
Kolom utama: `id BINARY(16)` (PK), `mapping_type`, `account_number`, `account_destination`,
`transaction_date`, `amount`, `amount_decimal`, `feature_code`, `reference_number` (**unique**),
`trkey`, `channel`, `merchant_code`, `response_code`, `ip_address`, `device_id`,
`phone_number`, `latitude`, `longitude`, `customer_cif`, `customer_fullname`,
`receiver_fullname`, `teller_id`, `authorizer_id`, `trx_desc`, `source_type`,
`insert_date`, `insert_by`, `reversal`, `source_tabtrans_id`.

### 5.2 Kontrol — `etl_watermark_kantor` (FDS)
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `etl_name` + `kode_kantor` | composite PK (`EtlWatermarkKantorId`) | Identitas watermark per kantor per job |
| `last_trx_time` | datetime | Waktu transaksi terakhir diproses |
| `last_trx_id` | bigint | ID transaksi terakhir diproses |
| `last_run_at` | datetime | Waktu eksekusi terakhir |
| `last_run_by` | varchar | `SCHEDULER` / sumber pemicu |

### 5.3 DTO Transfer — `TabTransNasabahDTO`
Membawa hasil query gabungan: `TabTrans`, `nasabahId`, `namaNasabah`, `hp`,
`receiverNama`, `latitude`, `longitude`.

## 6. Parameter Konfigurasi (`application.properties`)
| Properti | Default | Keterangan |
|----------|---------|-----------|
| `scheduler.fraud-transaction-interval` | `1m` | Interval ETL (**wajib**, `@NotBlank`) |
| `scheduler.fraud-transaction-using-geo` | `false` | Aktifkan enrichment geolocation |
| `scheduler.fraud-transaction-idle-start` | `23:00` | Awal idle window (`HH:mm`, opsional) |
| `scheduler.fraud-transaction-idle-end` | `23:20` | Akhir idle window + pemicu catch-up |
| `spring.datasource.hikari.*` | — | Koneksi FDS (MySQL 8) |
| `core.datasource.hikari.*` | pool 10/2, **read-only** | Koneksi CORE (MySQL 5.5) |
| `spring.jackson.time-zone` / `hibernate.jdbc.time_zone` | `Asia/Jakarta` | Konsistensi zona waktu |
| `spring.jpa.hibernate.ddl-auto` | `none` | Skema tidak dikelola aplikasi |

## 7. Kebutuhan Non-Fungsional
| Kode | Kategori | Spesifikasi |
|------|----------|-------------|
| NFR-1 | Performa | Near-real-time; interval default 1 menit; ekstraksi keyset (terindeks `jam_trans`,`tabtrans_id`). |
| NFR-2 | Keamanan data | Datasource CORE `read-only = true`; tidak ada write-back ke core. |
| NFR-3 | Keandalan/Idempotensi | Watermark gabungan mencegah duplikasi/kehilangan; transaksional per kantor. |
| NFR-4 | Isolasi kegagalan | Gagal satu kantor tidak menggagalkan kantor lain. |
| NFR-5 | Skalabilitas | Pool koneksi CORE max 10 / min idle 2; pemrosesan per kantor. |
| NFR-6 | Observability | Logging terstruktur ke file; penanda status emoji untuk keterbacaan operasional. |
| NFR-7 | Maintainability | Pemisahan lapisan service/orchestrator/worker/helper; mapping terpusat di enum. |
| NFR-8 | Portabilitas | Dapat dijalankan via Docker/Compose; konfigurasi eksternal `optional:file:/config/application.properties`. |
| NFR-9 | Dokumentasi | OpenAPI/Swagger UI tersedia. |

## 8. Penanganan Error & Edge Case
| Kondisi | Perilaku |
|---------|----------|
| Tidak ada transaksi baru | Kantor dilewati, watermark tidak berubah (FR-3.4). |
| Exception saat proses kantor | Rollback transaksi FDS, log error, lanjut kantor berikutnya (FR-11). |
| `kode_trans` tak dikenal | `feature_code = NGS_UNKNOWN`. |
| `pokok` null | `amount` & `amount_decimal` = 0. |
| `kuitansi_id` null | `reference_number` digenerate `kodeKantor-tabtransId`. |
| Idle window aktif | Run terjadwal di-skip; catch-up di idle-end. |
| Idle window kosong | Tidak ada penundaan; cron catch-up disabled. |

## 9. Pengujian (Acuan Verifikasi)
- **Watermark idempotency:** dua run berurutan tanpa transaksi baru tidak menghasilkan duplikat.
- **Keyset boundary:** transaksi dengan `jam_trans` sama tetapi `tabtrans_id` lebih besar ikut terambil.
- **Feature mapping:** uji representatif tiap kategori + `NGS_UNKNOWN`.
- **Idle window:** uji rentang normal & lintas tengah malam; uji skip + catch-up.
- **Backfill:** memproses tanggal tertentu tanpa menggeser watermark.
- **Geo toggle:** on/off menghasilkan latitude/longitude terisi/`null`.
- **Reference uniqueness:** constraint unik `reference_number` tidak terlanggar.


---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 30 Juni 2026 | | Dokumen dibuat |

---

*[← Kembali ke FDS BKK Jateng](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
