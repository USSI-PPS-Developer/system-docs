# ✅ Test Case — Host 2 Host

> Daftar skenario & kasus uji untuk produk **Host 2 Host**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | Host 2 Host     |
| Jenis Dokumen     | Test Case         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 23 Juni 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Ringkasan Test Case

| ID | Modul / Fitur | Judul Test Case | Prioritas | Jenis |
|----|---------------|-----------------|-----------|-------|
| TC-001 | _Fitur_ | _Judul singkat_ | Tinggi | Positif / Negatif |
| TC-101 | Tabungan — campaign saldo minimum | Registrasi saat campaign aktif → saldo minimum sesuai campaign (0) | Tinggi | Positif |
| TC-102 | Tabungan — campaign saldo minimum | Registrasi tanpa campaign aktif → saldo minimum = default produk | Tinggi | Positif |
| TC-103 | Tabungan — update saldo minimum | Aksi `CAMPAIGN` menurunkan saldo minimum & menulis jejak audit | Tinggi | Positif |
| TC-104 | Tabungan — update saldo minimum | Aksi `DEFAULT_PRODUK` mengembalikan saldo minimum ke default produk | Tinggi | Positif |
| TC-105 | Tabungan — update saldo minimum | Nilai sama = no-op (tanpa perubahan & tanpa baris audit) | Sedang | Positif |
| TC-106 | Tabungan — update saldo minimum | User di luar allowlist ditolak 403 | Tinggi | Negatif |
| TC-107 | Tabungan — update saldo minimum | Campaign nonaktif / di luar periode / beda produk / beda kantor ditolak `95` | Tinggi | Negatif |
| TC-108 | Tabungan — update saldo minimum | Rekening kantor lain ditolak 403 (office scope) | Tinggi | Negatif |
| TC-201 | Kredit — loan style (M-Pay) | Registrasi dengan `loanStyleId` menurunkan `typeKredit`/`jmlPinjaman`/`jmlAngsuran`/`sukuBungaPerTahun` & menghitung snapshot provisi/adm/denda | Tinggi | Positif |
| TC-202 | Kredit — loan style (M-Pay) | `loanStyleId` tidak ditemukan ditolak `95` | Tinggi | Negatif |
| TC-203 | Kredit — loan style (M-Pay) | `loanStyleId` nonaktif ditolak `95` | Tinggi | Negatif |
| TC-204 | Kredit — loan style (M-Pay) | `loanStyleId` diisi, client tetap mengirim `kodeProduk`/`sukuBungaPerTahun` → diabaikan, dipakai nilai dari catalog | Tinggi | Positif |
| TC-205 | Kredit — loan style (M-Pay) | `loanStyleId` dengan tenor selain 1/3 ditolak `95` | Tinggi | Negatif |
| TC-215 | Kredit — loan style (M-Pay) | `loanStyleId` merujuk catalog dengan `suku_bunga_per_tahun <= 0` (belum di-backfill) ditolak `95` | Tinggi | Negatif |
| TC-206 | Kredit — registrasi lama (non-M-Pay) | Tanpa `loanStyleId`, alur lama tidak berubah & kolom snapshot tetap NULL | Tinggi | Positif |
| TC-207 | Kredit — registrasi lama (non-M-Pay) | Tanpa `loanStyleId`, `typeKredit` kosong ditolak `95` | Sedang | Negatif |
| TC-208 | Kredit — registrasi lama (non-M-Pay) | Tanpa `loanStyleId`, `jmlPinjaman` kosong ditolak `95` | Sedang | Negatif |
| TC-209 | Kredit — registrasi lama (non-M-Pay) | Tanpa `loanStyleId`, `jmlAngsuran` kosong ditolak `95` | Sedang | Negatif |
| TC-210 | Kredit — registrasi lama (non-M-Pay) | Tanpa `loanStyleId`, `satuanWaktuAngsuran` kosong ditolak `95` | Sedang | Negatif |
| TC-211 | Kredit — registrasi lama (non-M-Pay) | Tanpa `loanStyleId`, `typeKredit` di luar set yang diizinkan ditolak `95` | Sedang | Negatif |
| TC-212 | Kredit — `GET /loan-style` | Filter `kodeProduk` mengembalikan hanya catalog aktif produk tsb, terurut `plafond` menaik | Sedang | Positif |
| TC-213 | Kredit — `GET /loan-style` | `kodeProduk` kosong/tidak dikirim mengembalikan seluruh catalog aktif (semua produk) | Sedang | Positif |
| TC-214 | Kredit — registrasi lama (non-M-Pay) | Tanpa `loanStyleId`, `kodeProduk` kosong ditolak `95` | Sedang | Negatif |
| TC-216 | Kredit — registrasi lama (non-M-Pay) | Tanpa `loanStyleId`, `sukuBungaPerTahun` kosong ditolak `95` | Sedang | Negatif |

---

## 2. Detail Test Case

### TC-001 — _Judul Test Case_

| Field | Detail |
|-------|--------|
| ID | TC-001 |
| Modul / Fitur | |
| Prioritas | Tinggi / Sedang / Rendah |
| Pre-condition | _Kondisi awal sebelum uji_ |
| Test Data | _Data yang dipakai_ |

**Langkah Pengujian**

| No | Langkah | Hasil Diharapkan | Hasil Aktual | Status |
|----|---------|------------------|--------------|--------|
| 1  | _Buka halaman ..._ | _Halaman tampil_ | | ⬜ Belum |
| 2  | _Isi form & submit_ | _Muncul notifikasi sukses_ | | ⬜ Belum |

**Hasil Akhir:** ⬜ Pass / ⬜ Fail
**Catatan:** _..._

---

> Salin blok **TC-XXX** di atas untuk setiap kasus uji baru.

### TC-101..TC-108 — Campaign saldo minimum tabungan

| Field | Detail |
|-------|--------|
| Modul / Fitur | Tabungan — campaign bebas saldo minimum (FR-011, FR-011a) |
| Prioritas | Tinggi |
| Pre-condition | Patch `patch_tab_campaign_saldo_minimum.sql` sudah dijalankan; ada baris `api_tab_campaign` (`CMP-NOMIN`, produk `201`, `kode_kantor` NULL, `saldo_minimum` 0, periode mencakup hari ini, `is_active=1`); `tab_produk` `201` punya `saldo_minimum_default` 50.000; `tabung.minimum-editor-user-ids` memuat user uji (mis. `199`); token access valid dengan `kode_kantor` = kantor rekening |
| Test Data | Rekening `0010001` (produk `201`, kantor `001`, `minimum` 50.000); rekening kantor lain `0020001` |

| No | Langkah | Hasil Diharapkan | Hasil Aktual | Status |
|----|---------|------------------|--------------|--------|
| 1 (TC-101) | `POST /tabungan/registrasi` produk `201`, kantor `001` (payload **tanpa** field tambahan) | `00`; rekening baru punya `minimum = 0` | | ⬜ Belum |
| 2 (TC-102) | Set `is_active=0` pada campaign, ulangi registrasi | `00`; rekening baru punya `minimum = 50000` (default produk) | | ⬜ Belum |
| 3 (TC-103) | `POST /tabungan/update-saldo-minimum` `{noRekening:0010001, aksi:CAMPAIGN, kodeCampaign:CMP-NOMIN, alasan:"...", userId:199}` | `00`, `berubah=true`, `minimumLama=50000`, `minimumBaru=0`; `tabung.minimum=0`; **satu** baris `api_tab_minimum_change` berisi nilai asal/baru, `aksi`, `kode_campaign`, `alasan`, `user_id`, `created_at` | | ⬜ Belum |
| 4 (TC-104) | Ulangi dengan `aksi=DEFAULT_PRODUK` | `00`, `berubah=true`, `minimumBaru=50000`; baris audit **baru** dengan `kode_campaign` NULL (baris lama tetap ada — append-only) | | ⬜ Belum |
| 5 (TC-105) | Ulangi `aksi=DEFAULT_PRODUK` sekali lagi (idempotency key baru) | `00`, `berubah=false`, pesan "sudah sesuai"; jumlah baris audit **tidak bertambah** | | ⬜ Belum |
| 6 (TC-106) | Panggil dengan token user yang tidak ada di `tabung.minimum-editor-user-ids` | HTTP 403, `99`, "User tidak berwenang mengubah saldo minimum"; `tabung` tidak berubah | | ⬜ Belum |
| 7 (TC-107) | Panggil `aksi=CAMPAIGN` dengan campaign nonaktif / di luar periode / `kode_produk` lain / `kode_kantor` lain, dan dengan `kodeCampaign` kosong | HTTP 400 `95` dengan pesan sesuai; `tabung.minimum` **tidak** berubah dan tidak ada baris audit | | ⬜ Belum |
| 8 (TC-108) | Panggil untuk rekening `0020001` (kantor lain) dengan token kantor `001` non-HQ | HTTP 403, `99`; tidak ada perubahan | | ⬜ Belum |
| 9 | Uji header: tanpa `X-IDEMPOTENCY-KEY`, lalu ulang request dengan key yang sama, lalu > 5 request/60s | `97` (400) · `93` (409) · `94` (429) | | ⬜ Belum |

**Hasil Akhir:** ⬜ Pass / ⬜ Fail
**Catatan:** Verifikasi jejak audit dengan `SELECT * FROM api_tab_minimum_change WHERE no_rekening='0010001' ORDER BY created_at DESC;`

### TC-201..TC-211, TC-214..TC-216 — Registrasi kredit via loan style (M-Pay)

| Field | Detail |
|-------|--------|
| Modul / Fitur | Kredit — registrasi via *loan style* M-Pay (FR-012a) |
| Prioritas | Tinggi |
| Pre-condition | Patch `patch_kredit_loan_style.sql` **dan** `patch_api_loan_style_suku_bunga.sql` sudah dijalankan; ada baris `api_loan_style` id `1` (`kode_produk=710`, `plafond=2000000`, `tenor=1`, `type_kredit=100`, `suku_bunga_per_tahun=24.0000`, `perc_provisi=1.000`, `perc_adm=0.500`, `perc_denda=0.300`, `is_active=1`) dan id `98` (identik id `1` tapi `suku_bunga_per_tahun=0`, belum di-backfill — untuk TC-215); `kode_kantor 001`, `nasabah NSB001` terverifikasi terdaftar |
| Test Data | `CreateKreditRequestDTO` dasar: `kodeKantor=001`, `userId=5`, `nasabahId=NSB001`, `tglRealisasi=2026-01-10`, `noSpk=SPK-001`. **`kodeProduk`/`sukuBungaPerTahun` sengaja TIDAK disertakan** pada request `loanStyleId` (TC-201..TC-205, TC-215) — M-Pay tidak mengirimnya; keduanya dipakai hanya pada jalur legacy (TC-206..TC-211, TC-214, TC-216, dengan `sukuBungaPerTahun=12`) |

| No | Langkah | Hasil Diharapkan | Hasil Aktual | Status |
|----|---------|------------------|--------------|--------|
| 1 (TC-201) | `POST /pinjaman/registrasi` dengan `loanStyleId=1`, **tanpa** `kodeProduk`/`typeKredit`/`jmlPinjaman`/`jmlAngsuran`/`satuanWaktuAngsuran`/`sukuBungaPerTahun` | `00`; `kredit.kodeProduk=710`, `typeKredit=100`, `jmlPinjaman=2000000`, `jmlAngsuran=1`, `satuanWaktuAngsuran=B`, `sukuBungaPerTahun=24.0000`, `loanStyleId=1`; `provisi=20000` (2.000.000×1,000%), `admLainnya=10000` (2.000.000×0,500%), `percDenda=0.300`; `tglJatuhTempo=2026-02-10` | | ⬜ Belum |
| 2 (TC-202) | Ulangi dengan `loanStyleId=99` (tidak ada di `api_loan_style`) | HTTP 400 `95`, "Loan style tidak ditemukan"; kredit tidak dibuat | | ⬜ Belum |
| 3 (TC-203) | `loanStyleId` merujuk baris dengan `is_active=0` | HTTP 400 `95`, "Loan style sudah tidak aktif" | | ⬜ Belum |
| 4 (TC-204) | `loanStyleId=1` **dan** client tetap mengirim `kodeProduk=999`, `sukuBungaPerTahun=99` (nilai sembarang/keliru) | `00`; `kredit.kodeProduk=710`, `sukuBungaPerTahun=24.0000` (dari catalog, BUKAN `999`/`99`) — nilai client diabaikan sepenuhnya, tidak ada pengecekan kecocokan | | ⬜ Belum |
| 5 (TC-205) | `loanStyleId` merujuk baris dengan `tenor=6` (di luar {1,3}) | HTTP 400 `95`, "Tenor loan style tidak valid: 6" | | ⬜ Belum |
| 6 (TC-206) | `POST /pinjaman/registrasi` **tanpa** `loanStyleId`, dengan `kodeProduk=710`, `typeKredit=700`, `jmlPinjaman=2000000`, `jmlAngsuran=6`, `satuanWaktuAngsuran=B`, `sukuBungaPerTahun=12` diisi langsung | `00`; `kredit.kodeProduk=710`, `typeKredit=700`, `jmlPinjaman=2000000`, `jmlAngsuran=6`, `sukuBungaPerTahun=12` sesuai payload; `loanStyleId`/`provisi`/`admLainnya`/`percDenda` **NULL**; `api_loan_style` tidak diquery | | ⬜ Belum |
| 7 (TC-207) | Tanpa `loanStyleId`, `typeKredit` kosong | HTTP 400 `95`, "Tipe kredit harus diisi" | | ⬜ Belum |
| 8 (TC-208) | Tanpa `loanStyleId`, `jmlPinjaman` kosong | HTTP 400 `95`, "Jumlah pinjaman harus diisi" | | ⬜ Belum |
| 9 (TC-209) | Tanpa `loanStyleId`, `jmlAngsuran` kosong | HTTP 400 `95`, "Jumlah angsuran harus diisi" | | ⬜ Belum |
| 10 (TC-210) | Tanpa `loanStyleId`, `satuanWaktuAngsuran` kosong | HTTP 400 `95`, "Satuan waktu angsuran harus diisi" | | ⬜ Belum |
| 11 (TC-211) | Tanpa `loanStyleId`, `typeKredit=999` (di luar `100/200/300/310/350/700/710`) | HTTP 400 `95`, "Tipe kredit tidak valid: 999" | | ⬜ Belum |
| 12 (TC-214) | Tanpa `loanStyleId`, `kodeProduk` kosong | HTTP 400 `95`, "Kode produk harus diisi" | | ⬜ Belum |
| 13 (TC-215) | `loanStyleId=98` (`suku_bunga_per_tahun=0`, belum di-backfill) | HTTP 400 `95`, "Suku bunga loan style belum diisi"; kredit tidak dibuat | | ⬜ Belum |
| 14 (TC-216) | Tanpa `loanStyleId`, `sukuBungaPerTahun` kosong | HTTP 400 `95`, "Suku bunga pinjaman pertahun diisi" | | ⬜ Belum |

**Hasil Akhir:** ⬜ Pass / ⬜ Fail
**Catatan:** Denda keterlambatan (`perc_denda`/0,3% per hari) **belum diimplementasikan** pada
perubahan ini — kolomnya tersimpan tapi tidak ada test case penerapan denda di angsuran/pembayaran
(menyusul di perubahan terpisah). Response `/pinjaman/registrasi` tetap `{noRekening}` untuk semua
kasus positif — snapshot `provisi`/`adm_lainnya`/`perc_denda` diverifikasi langsung di `kredit`, bukan
di response body. TC-204 direvisi (25 Agustus 2026): skenario lama "loan style beda kode produk"
sudah tidak berlaku sejak `kodeProduk` diturunkan dari catalog, bukan dicocokkan terhadap payload;
TC-215/TC-216 ditambah pada tanggal yang sama untuk cakupan `sukuBungaPerTahun`.

### TC-212..TC-213 — `GET /pinjaman/loan-style`

| Field | Detail |
|-------|--------|
| Modul / Fitur | Kredit — daftar *loan style* untuk dropdown M-Pay (FR-012a) |
| Prioritas | Sedang |
| Pre-condition | Sama seperti TC-201..TC-211, ditambah baris `api_loan_style` id `2` (`kode_produk=711`, `plafond=1000000`, `tenor=1`, `suku_bunga_per_tahun=24.0000`, `is_active=1`) untuk membedakan filter produk |
| Test Data | Query param `kodeProduk` (opsional) pada `GET /pinjaman/loan-style` |

| No | Langkah | Hasil Diharapkan | Hasil Aktual | Status |
|----|---------|------------------|--------------|--------|
| 1 (TC-212) | `GET /pinjaman/loan-style?kodeProduk=710` | `00`; hanya baris `kode_produk=710` yang `is_active=1`, terurut `plafond` menaik; setiap item memuat `loanStyleId`,`kodeProduk`,`namaLoanStyle`,`plafond`,`tenor`,`sukuBungaPerTahun`,`percProvisi`,`percAdm`,`percDenda` | | ⬜ Belum |
| 2 (TC-213) | `GET /pinjaman/loan-style` (tanpa query `kodeProduk`) | `00`; seluruh baris aktif dari semua produk (termasuk id `1` dan id `2`), terurut `plafond` menaik | | ⬜ Belum |

**Hasil Akhir:** ⬜ Pass / ⬜ Fail
**Catatan:** Endpoint read-only, tanpa `X-IDEMPOTENCY-KEY`/rate limit/tenant guard (referensi
global, sama pola dengan `GET /deposito/produk-spesial-rate`).

## 3. Rekapitulasi

| Status | Jumlah |
|--------|--------|
| ✅ Pass | 0 |
| ❌ Fail | 0 |
| ⬜ Belum diuji | 0 |
| **Total** | **0** |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 23 Juni 2026 | | Dokumen dibuat |
| 1.1.0 | 5 Agustus 2026 | | Tambah TC-101..TC-108: campaign bebas saldo minimum tabungan (registrasi & update rekening existing, jejak audit, allowlist, office scope, guard header). |
| 1.2.0 | 25 Agustus 2026 | | Tambah TC-201..TC-211: registrasi kredit via *loan style* M-Pay (CR BPR) — happy path derive `typeKredit`/`jmlPinjaman`/`jmlAngsuran` + snapshot provisi/adm/denda, loan style tidak ditemukan/nonaktif/beda produk/tenor tidak valid, dan alur registrasi lama (tanpa `loanStyleId`) tidak berubah + validasi field wajibnya. Mengikuti `services/KreditServiceTest` (11 kasus). |
| 1.2.1 | 25 Agustus 2026 | | Tambah TC-212..TC-213: `GET /pinjaman/loan-style` — filter `kodeProduk` vs seluruh catalog aktif. Mengikuti `services/KreditServiceTest$GetLoanStyle` (2 kasus). |
| 1.2.2 | 25 Agustus 2026 | | TC-204 direvisi: `kodeProduk` sekarang diturunkan dari `api_loan_style` (bukan dicocokkan), jadi skenario "loan style beda kode produk" diganti jadi "kodeProduk kiriman client diabaikan" (Positif, bukan Negatif). Tambah TC-214: `kodeProduk` kosong pada jalur legacy ditolak `95`. Mengikuti `KreditServiceTest$LoanStylePath.ignoresClientSentKodeProduk` + `LegacyPath.missingKodeProduk`. |
| 1.2.3 | 25 Agustus 2026 | | TC-204 diperluas mencakup `sukuBungaPerTahun` juga diabaikan (bukan cuma `kodeProduk`). Tambah TC-215: `loanStyleId` dengan `suku_bunga_per_tahun<=0` (belum di-backfill) ditolak `95`. Tambah TC-216: `sukuBungaPerTahun` kosong pada jalur legacy ditolak `95`. TC-212 diperbarui: response `GET /loan-style` sekarang memuat `sukuBungaPerTahun`. Mengikuti `KreditServiceTest$LoanStylePath.ignoresClientSentKodeProdukAndSukuBunga`/`sukuBungaNotSet` + `LegacyPath.missingSukuBunga`. |

---

*[← Kembali ke Host 2 Host](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
