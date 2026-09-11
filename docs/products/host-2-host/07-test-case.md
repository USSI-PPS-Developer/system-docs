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
| TC-301 | Kredit — tagihan sekuensial | `/pinjaman/tagihan` untuk rekening tidak ditemukan | Tinggi | Negatif |
| TC-302 | Kredit — tagihan sekuensial | Satu angsuran outstanding → `denda=0`, `totalTagihan=pokok+bunga` | Tinggi | Positif |
| TC-303 | Kredit — tagihan sekuensial | Beberapa angsuran telat (overdue) dikembalikan terurut `angsuranKe` dengan total yang benar | Tinggi | Positif |
| TC-304 | Kredit — tagihan sekuensial | Tidak ada tunggakan → `tagihan` kosong, seluruh total nol | Sedang | Positif |
| TC-305 | Kredit — tagihan sekuensial | Regresi: query tunggakan akumulatif lama (`getTunggakanPokok`/`getTunggakanBunga`) tidak lagi dipanggil dari `/tagihan` | Sedang | Positif |
| TC-306 | Kredit — angsuran sekuensial | `POST /transaksi/angsuranPinjaman` membayar angsuran belum lunas paling awal; `pokok`/`bunga` diturunkan server, response berisi `pokok`/`bunga`/`denda`/`totalAngsuran` yang benar | Tinggi | Positif |
| TC-307 | Kredit — angsuran sekuensial | Pinjaman sudah lunas ditolak `95` ("Pinjaman sudah lunas, tidak ada tagihan yang harus dibayar") | Tinggi | Negatif |
| TC-308 | Kredit — angsuran sekuensial | `angsuranKe` yang sudah dibayar ditolak `95` ("Angsuran ke-N sudah dibayar") | Tinggi | Negatif |
| TC-309 | Kredit — angsuran sekuensial | `angsuranKe` melompati angsuran belum lunas paling awal (skip-ahead) ditolak `95` ("Angsuran ke-N harus dibayar terlebih dahulu") | Tinggi | Negatif |
| TC-310 | Kredit — angsuran sekuensial | Guard "Kode kantor tidak sesuai dengan data rekening" tetap berjalan lebih dulu daripada pemeriksaan sekuensial baru | Sedang | Negatif |
| TC-311 | Kredit — angsuran sekuensial | Guard "Tipe transaksi tidak tersedia" tetap berjalan lebih dulu daripada pemeriksaan sekuensial baru | Sedang | Negatif |
| TC-312 | Kredit — angsuran sekuensial | Guard "Kuitansi id duplikat" tetap berjalan lebih dulu daripada pemeriksaan sekuensial baru | Sedang | Negatif |
| TC-313 | Kredit — angsuran sekuensial | Guard "No rekening pinjaman sudah tidak aktif" (pinjaman ditutup) tetap berjalan lebih dulu daripada pemeriksaan sekuensial baru | Sedang | Negatif |
| TC-314 | Kredit — angsuran sekuensial | Guard saldo tidak mencukupi tetap berjalan, diperiksa terhadap total `pokok+bunga` yang diturunkan server (bukan nominal client) | Tinggi | Negatif |
| TC-401 | Kredit — skenario end-to-end (tanpa loan style) | Registrasi kredit legacy (tanpa `loanStyleId`) → `noRekening` baru, jadwal 3 periode ter-generate | Tinggi | Positif |
| TC-402 | Kredit — skenario end-to-end (tanpa loan style) | Pencairan (`C1`, ke tabungan) berhasil untuk rekening hasil TC-401 | Tinggi | Positif |
| TC-403 | Kredit — skenario end-to-end (tanpa loan style) | `POST /pinjaman/jadwal` menampilkan seluruh 3 periode jadwal beserta total pokok/bunga | Sedang | Positif |
| TC-404 | Kredit — skenario end-to-end (tanpa loan style) | `POST /pinjaman/tagihan` pada tanggal jatuh tempo ke-1 menampilkan tagihan yang harus dibayar | Tinggi | Positif |
| TC-405 | Kredit — skenario end-to-end (tanpa loan style) | `POST /transaksi/angsuranPinjaman` melunasi angsuran ke-1 berdasarkan hasil TC-404 | Tinggi | Positif |
| TC-501 | Deposito — On Call | Registrasi `jkw=7` diterima, suku bunga diresolusi **2,50%** dari campaign `api_dep_oncall_rate` (bukan `suku_bunga_default` produk), `tglJt` = tanggal registrasi + 7 hari (regresi bug tanggal jatuh tempo) | Tinggi | Positif |
| TC-502 | Deposito — On Call | Registrasi `jkw=14` diterima, suku bunga diresolusi **3,00%** dari campaign `api_dep_oncall_rate`, `tglJt` = tanggal registrasi + 14 hari | Tinggi | Positif |
| TC-503 | Deposito — On Call | Registrasi dengan `jkw` yang tidak punya baris `api_dep_oncall_rate` aktif untuk tanggal tersebut (mis. `jkw=10`, atau `jkw=7` di luar periode program) ditolak `95`, "Program deposito on call untuk jangka waktu {N} hari tidak tersedia pada tanggal ini"; **tidak ada fallback** ke suku bunga default produk | Tinggi | Negatif |
| TC-504 | Deposito — On Call | Regresi: validasi per-produk lama (`DepositoHelper.validateJkw`) tidak dipanggil untuk produk On Call | Sedang | Positif |

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

### TC-301..TC-314 — Angsuran pinjaman sekuensial, tanpa partial payment (M-Pay)

| Field | Detail |
|-------|--------|
| Modul / Fitur | Kredit — `/pinjaman/tagihan` & `/transaksi/angsuranPinjaman` sekuensial (FR-012, FR-016) |
| Prioritas | Tinggi |
| Pre-condition | Rekening pinjaman `001101000328` terdaftar dengan jadwal angsuran (`kretrans` `my_kode_trans=200`) 3 periode: ke-1 (`2026-09-25`, pokok 1.166.667, bunga 35.000), ke-2 (`2026-10-25`, pokok 1.166.667, bunga 35.000), ke-3 (`2026-11-25`, pokok 1.166.666, bunga 35.000); tidak ada baris `my_kode_trans=300` (belum ada pembayaran); token access valid dengan `kode_kantor` sesuai rekening |
| Test Data | `noRekening=001101000328`, `kodeKantor=001`, `userId=5`; `tglTrans` inquiry `2026-10-26` (melewati jatuh tempo ke-1 & ke-2) untuk skenario tunggakan ganda (TC-303) |

**Langkah Pengujian**

| No | Langkah | Hasil Diharapkan | Hasil Aktual | Status |
|----|---------|------------------|--------------|--------|
| 1 (TC-301) | `POST /pinjaman/tagihan` dengan `noRekening` yang tidak ada | HTTP 400/404 sesuai perilaku "rekening tidak ditemukan" yang sudah ada (tidak berubah) | | ⬜ Belum |
| 2 (TC-302) | `POST /pinjaman/tagihan` dengan `tglTrans=2026-09-25`, hanya angsuran ke-1 yang jatuh tempo & belum dibayar | `00`; `tagihan` berisi 1 baris `angsuranKe=1`, `denda=0`, `totalTagihan=1201667.00` (=pokok+bunga); `totalPokok/totalBunga/totalDenda/totalTagihan` list-level sama dengan baris tsb | | ⬜ Belum |
| 3 (TC-303) | `POST /pinjaman/tagihan` dengan `tglTrans=2026-10-26` (angsuran ke-1 & ke-2 sama-sama telat & belum dibayar) | `00`; `tagihan` berisi 2 baris terurut `angsuranKe: 1, 2`; `totalPokok=2333334.00`, `totalBunga=70000.00`, `totalDenda=0`, `totalTagihan=2403334.00` | | ⬜ Belum |
| 4 (TC-304) | Tandai seluruh 3 angsuran sudah dibayar (ada baris `my_kode_trans=300` untuk tiap `angsuran_ke`), ulangi `/tagihan` | `00`; `tagihan=[]` (array kosong); `totalPokok=totalBunga=totalDenda=totalTagihan=0` | | ⬜ Belum |
| 5 (TC-305) | (Regresi, verifikasi kode/log) Panggil `/tagihan` beberapa kali | Query akumulasi tunggakan lama (`getTunggakanPokok`/`getTunggakanBunga`) **tidak** dieksekusi dari path ini (tetap dipakai `listTransKredit`/riwayat) | | ⬜ Belum |
| 6 (TC-306) | `POST /transaksi/angsuranPinjaman` `{noRekening:001101000328, angsuranKe:1, kuitansi:"KWT-0001", kuitansiId:"K-0001", tipeTrans:"320", kodeKantor:001, userId:5}` (tanpa `pokok`/`bunga`) — angsuran ke-1 memang yang paling awal belum lunas | `00`; posting pokok=1166667.00, bunga=35000.00 (dari jadwal, bukan dari request yang memang tidak mengirimkannya); response `TransKreditAngsuranResponseDTO` berisi `pokok`, `bunga`, `denda=0`, `totalAngsuran=1201667.00` | | ⬜ Belum |
| 7 (TC-307) | Tandai seluruh angsuran sudah dibayar, ulangi `/transaksi/angsuranPinjaman` dengan `angsuranKe` mana pun | HTTP 400 `95`, "Pinjaman sudah lunas, tidak ada tagihan yang harus dibayar"; tidak ada posting | | ⬜ Belum |
| 8 (TC-308) | Angsuran ke-1 sudah dibayar (baris `my_kode_trans=300` ada), kirim `angsuranKe=1` lagi | HTTP 400 `95`, "Angsuran ke-1 sudah dibayar"; tidak ada posting | | ⬜ Belum |
| 9 (TC-309) | Angsuran ke-1 **belum** dibayar, kirim `angsuranKe=2` (melompat) | HTTP 400 `95`, "Angsuran ke-1 harus dibayar terlebih dahulu"; tidak ada posting | | ⬜ Belum |
| 10 (TC-310) | Kirim `kodeKantor` yang tidak sesuai dengan kantor pemilik rekening | HTTP 400 `95`, "Kode kantor tidak sesuai dengan data rekening" — ditolak **sebelum** pemeriksaan sekuensial dijalankan | | ⬜ Belum |
| 11 (TC-311) | Kirim `tipeTrans` yang tidak terdaftar sebagai tipe integrasi angsuran | HTTP 400 `95`, "Tipe transaksi tidak tersedia" — ditolak sebelum pemeriksaan sekuensial | | ⬜ Belum |
| 12 (TC-312) | Kirim `kuitansiId` yang sudah pernah dipakai (duplikat) | HTTP 400 `95`, "Kuitansi id duplikat" — ditolak sebelum pemeriksaan sekuensial | | ⬜ Belum |
| 13 (TC-313) | Rekening pinjaman berstatus tidak aktif/ditutup | HTTP 400 `95`, "No rekening pinjaman sudah tidak aktif" — ditolak sebelum pemeriksaan sekuensial | | ⬜ Belum |
| 14 (TC-314) | Saldo akun debet (kas/tabungan pembayar) tidak mencukupi total `pokok+bunga` angsuran ke-1 yang diturunkan server | HTTP 400 `95`, "Transaksi ditolak: saldo akun debet tidak mencukupi" — diperiksa terhadap total server-derived, bukan nominal client (yang memang sudah tidak dikirim) | | ⬜ Belum |

**Hasil Akhir:** ⬜ Pass / ⬜ Fail
**Catatan:** Mengikuti `services/JadwalKreditServiceTest$GetTagihanKredit` (5 kasus: TC-301..TC-305)
dan `services/KretransServiceTest$TransKreditAngsuran` (9 kasus: TC-306..TC-314) di repo
`microservice-core`. Kasus usang `TransactionAmountValidationTest.angsuranPokokBunga` **dihapus**
dari suite karena memvalidasi `@DecimalMin` pada field `pokok`/`bunga` yang sudah tidak ada lagi
pada `TransKreditAngsuranRequestDTO`. `denda` tetap placeholder `0` pada kedua endpoint — belum
ada perhitungan/posting denda keterlambatan pada perubahan ini (lihat catatan TC-201..TC-216).

### TC-401..TC-405 — Skenario end-to-end: registrasi (tanpa loan style) → pencairan → jadwal → tagihan → angsuran

| Field | Detail |
|-------|--------|
| Modul / Fitur | Kredit — alur lengkap registrasi legacy s.d. pembayaran angsuran pertama (FR-012, FR-016) |
| Prioritas | Tinggi |
| Pre-condition | Nasabah `NSB001` sudah terdaftar & terverifikasi di kantor `001`; token access valid dengan `kode_kantor=001`; rekening tabungan pencairan `0010001` (kantor `001`) sudah ada & aktif; produk kredit `710` (`type_kredit=100`, flat) tersedia di `kred_produk` |
| Test Data | `kodeKantor=001`, `userId=5`, `nasabahId=NSB001`, `noSpk=SPK-002`, `kodeProduk=710`, `typeKredit=100`, `jmlPinjaman=3500000`, `jmlAngsuran=3`, `satuanWaktuAngsuran=B`, `sukuBungaPerTahun=12`, `tglRealisasi=2026-08-25` — **`loanStyleId` sengaja tidak disertakan** (jalur registrasi lama/non-M-Pay, lihat §4.11.1 di `03-api-contract.md`) |

Skenario ini adalah "cerita asal" rekening `001101000328` beserta jadwal 3 periode
(pokok 1.166.667/1.166.667/1.166.666, bunga 35.000/periode) yang menjadi pre-condition di
TC-301..TC-314 (angsuran sekuensial) — flat, 3 bulan, plafond 3.500.000, suku bunga 12%/tahun
menghasilkan angka yang identik (`3.500.000 × 12% ÷ 12 = 35.000` per periode).

**Langkah Pengujian**

| No | Langkah | Hasil Diharapkan | Hasil Aktual | Status |
|----|---------|------------------|--------------|--------|
| 1 (TC-401) | `POST /pinjaman/registrasi` dengan Test Data di atas, **tanpa** `loanStyleId` — body: `{"kodeKantor":"001","userId":"5","nasabahId":"NSB001","kodeProduk":"710","jmlPinjaman":3500000,"jmlAngsuran":3,"satuanWaktuAngsuran":"B","typeKredit":"100","sukuBungaPerTahun":12,"tglRealisasi":"2026-08-25","noSpk":"SPK-002"}` | `00`; `responseData={"noRekening":"001101000328"}` (contoh); `kredit` tersimpan dengan field persis sesuai payload (`loanStyleId`/`provisi`/`admLainnya`/`percDenda` NULL, jalur legacy); jadwal angsuran 3 periode langsung ter-generate ke `kretrans` (`my_kode_trans=200`) saat registrasi — **belum** menunggu pencairan | | ⬜ Belum |
| 2 (TC-402) | `POST /transaksi/pencairanPinjaman` — body: `{"tglTrans":"2026-08-25","kuitansi":"KW-P001","kuitansiId":"KWID-P001","tipeTrans":"C1","kodeKantor":"001","noRekening":"001101000328","nominal":3500000,"keterangan":"Pencairan pinjaman","userId":"5","noRekeningTabungan":"0010001"}` (nominal = `jmlPinjaman` — wajib sama, validator `ValidNominalHarusSamaDenganPinjaman`) | `00`; dana 3.500.000 masuk ke rekening tabungan `0010001`; `kredit` status aktif; jadwal (TC-401) tidak berubah — pencairan tidak menyentuh `my_kode_trans=200` | | ⬜ Belum |
| 3 (TC-403) | `POST /pinjaman/jadwal` — body: `{"noRekening":"001101000328","userId":"5"}` | `00`; `responseData.jadwal` berisi 3 baris: `angsuranKe 1` (`tglTrans=2026-09-25`, `pokok=1166667.00`, `bunga=35000.00`), `angsuranKe 2` (`2026-10-25`, `1166667.00`/`35000.00`), `angsuranKe 3` (`2026-11-25`, `1166666.00`/`35000.00`); `totalPokok=3500000.00`, `totalBunga=105000.00` (lihat §4.11.2 `03-api-contract.md` untuk bentuk lengkap) | | ⬜ Belum |
| 4 (TC-404) | `POST /pinjaman/tagihan` — body: `{"noRekening":"001101000328","tglTrans":"2026-09-25","userId":"5"}` (tanggal jatuh tempo angsuran ke-1, belum ada pembayaran sama sekali) | `00`; `responseData.tagihan` berisi 1 baris `angsuranKe=1`, `pokok=1166667.00`, `bunga=35000.00`, `denda=0`, `totalTagihan=1201667.00`; total list-level sama dengan baris tsb (lihat §4.11.3) | | ⬜ Belum |
| 5 (TC-405) | `POST /transaksi/angsuranPinjaman` — body: `{"tglTrans":"2026-09-25","angsuranKe":1,"kuitansi":"KWT-0001","kuitansiId":"K-0001","tipeTrans":"320","kodeKantor":"001","noRekening":"001101000328","keterangan":"Angsuran ke-1","userId":"5"}` (angsuranKe diambil dari hasil TC-404; **tanpa** `pokok`/`bunga` — field tsb sudah dihapus dari request, lihat §4.15) | `00`; posting `pokok=1166667.00`, `bunga=35000.00` (diturunkan server dari jadwal, sama persis dengan TC-404, bukan dikirim client); `responseData` berisi `pokok`,`bunga`,`denda=0`,`totalAngsuran=1201667.00`; mengulang `POST /pinjaman/tagihan` sesudahnya untuk `tglTrans=2026-09-25` mengembalikan `tagihan=[]` (angsuran ke-1 sudah lunas, angsuran ke-2 belum jatuh tempo) | | ⬜ Belum |

**Hasil Akhir:** ⬜ Pass / ⬜ Fail
**Catatan:** Skenario ini menautkan alur **registrasi kredit legacy** (§4.11.1, jalur tanpa
`loanStyleId` — tetap dipakai channel non-M-Pay) dengan alur **pencairan → jadwal → tagihan →
angsuran** dari TC-301..TC-314, sebagai satu jalur pengujian penuh (bukan per-endpoint terisolasi).
Berguna untuk SIT/UAT sebagai naskah demo end-to-end. Tidak menambah kasus unit test baru di
`microservice-core` — setiap langkah sudah tercakup oleh test unit yang ada per endpoint
(`KreditServiceTest$LegacyPath`, `services/JadwalKreditServiceTest`, `services/KretransServiceTest`);
blok ini murni menyusun urutannya sebagai skenario bisnis yang bisa langsung dieksekusi manual
di lingkungan SIT/UAT.

### TC-501..TC-504 — Registrasi deposito On Call (tenor harian)

| Field | Detail |
|-------|--------|
| Modul / Fitur | Deposito — registrasi produk On Call (FR-013) |
| Prioritas | Tinggi |
| Pre-condition | Patch `patch_dep_produk_kode_jenis.sql`, `patch_dep_oncall_rate.sql`, dan seeder `seed_dep_oncall_rate.sql` sudah dijalankan; `dep_produk` `kodeProduk=311` ("Deposito On Call") punya `kode_jenis='2'`, `is_custom_rate=0`; `api_dep_oncall_rate` punya baris aktif `kodeProduk=311`/`jkw=7`/`suku_bunga=2.50` dan `kodeProduk=311`/`jkw=14`/`suku_bunga=3.00`, periode 2026-09-01 s/d 2026-09-30; `kode_kantor 001`, `nasabah NSB001` terverifikasi terdaftar |
| Test Data | `CreateDepositoRequestDTO` dasar: `kodeKantor=001`, `userId=5`, `nasabahId=NSB001`, `kodeProduk=311`, `tglRegistrasi=2026-09-11`, `jmlDeposito=5000000`, `kodeAro=1`, `perlakuanBunga=1` (tanpa `sukuBunga` — tidak diterima dari client untuk produk ini) |

| No | Langkah | Hasil Diharapkan | Hasil Aktual | Status |
|----|---------|------------------|--------------|--------|
| 1 (TC-501) | `POST /deposito/registrasi` dengan `jkw=7` | `00`; deposito tersimpan dengan `tglJt = 2026-09-18` (tglRegistrasi + **7 hari**, bukan 7 bulan); `sukuBunga = 2.50` diresolusi dari baris aktif `api_dep_oncall_rate` (`jkw=7`) — **bukan** `dep_produk.suku_bunga_default` | | ⬜ Belum |
| 2 (TC-502) | Ulangi dengan `jkw=14` | `00`; `tglJt = 2026-09-25` (tglRegistrasi + **14 hari**); `sukuBunga = 3.00` diresolusi dari baris aktif `api_dep_oncall_rate` (`jkw=14`) | | ⬜ Belum |
| 3 (TC-503) | Ulangi dengan `jkw=10` (tidak punya baris `api_dep_oncall_rate` aktif untuk produk ini pada tanggal registrasi) — variasi: `jkw=7` dengan `tglRegistrasi` di luar periode 1–30 September 2026 memberi hasil yang sama | HTTP 400 `95`, "Program deposito on call untuk jangka waktu 10 hari tidak tersedia pada tanggal ini"; deposito tidak dibuat; **tidak** jatuh ke `suku_bunga_default` | | ⬜ Belum |
| 4 (TC-504) | (Regresi, verifikasi kode/log) Registrasi `jkw=7`/`jkw=14` pada produk `311` | Validasi per-produk lama (`DepositoHelper.validateJkw`, `JKW_RULES`) **tidak** dipanggil untuk produk On Call | | ⬜ Belum |

**Hasil Akhir:** ⬜ Pass / ⬜ Fail
**Catatan:** Mengikuti `services/DepositoServiceTest$OnCall` (4 kasus) di repo `microservice-core`
— suite bertambah dari 156 menjadi 160 kasus. TC-501/TC-502 adalah kasus regresi utama yang
membuktikan bug perhitungan `tglJt` (sebelumnya selalu `+bulan`, termasuk untuk tenor harian)
sudah diperbaiki — sebelum perbaikan ini, deposit 7 hari akan jatuh tempo 7 bulan kemudian —
dan sekaligus membuktikan suku bunga per-tenor (2,50%/3,00%) diresolusi dari master
`api_dep_oncall_rate`, bukan `suku_bunga_default` produk (koreksi atas asumsi rilis awal fitur
ini). TC-503 tidak lagi menguji sebuah set hardcoded `{7,14}` — ia menguji ketiadaan baris
campaign aktif, yang juga mencakup kasus periode program berakhir. Tidak ada perubahan skema
request/response — lihat §4.12 `03-api-contract.md`.

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
| 1.3.0 | 1 September 2026 | | Tambah TC-301..TC-314: pembayaran angsuran pinjaman sekuensial tanpa partial payment (keputusan BPR/M-Pay) — `/pinjaman/tagihan` mengembalikan seluruh angsuran belum lunas (bukan satu baris); `/transaksi/angsuranPinjaman` menolak pembayaran sebagian/melompat dan menurunkan `pokok`/`bunga` dari jadwal server-side. Mengikuti `services/JadwalKreditServiceTest$GetTagihanKredit` (5 kasus) & `services/KretransServiceTest$TransKreditAngsuran` (9 kasus). Kasus usang `TransactionAmountValidationTest.angsuranPokokBunga` dihapus (field `pokok`/`bunga` tidak lagi ada pada request DTO). |
| 1.3.1 | 1 September 2026 | | Tambah TC-401..TC-405: skenario end-to-end registrasi kredit **tanpa** `loanStyleId` (jalur legacy/non-M-Pay) → pencairan → inquiry jadwal → cek tagihan → pembayaran angsuran ke-1, menautkan §4.11.1/§4.14/§4.11.2/§4.11.3/§4.15 sebagai satu naskah uji manual SIT/UAT yang juga menghasilkan data pre-condition yang identik dengan TC-301..TC-314. Tidak menambah unit test baru — murni menyusun urutan skenario bisnis dari test unit yang sudah ada. |
| 1.4.0 | 11 September 2026 | | Tambah TC-501..TC-504: registrasi deposito produk **On Call** (`kodeProduk=311`, tenor harian 7/14) — `jkw` di luar {7,14} ditolak `95`, dan regresi bug tanggal jatuh tempo (`tglJt` kini `+hari` untuk On Call, sebelumnya selalu `+bulan`). Mengikuti `services/DepositoServiceTest$OnCall` (4 kasus). Tidak ada perubahan kontrak request/response. |
| 1.5.0 | 11 September 2026 | | **Koreksi TC-501..TC-503** — memo BPR sebenarnya menetapkan suku bunga **per-tenor** (7 hari = 2,5% p.a, 14 hari = 3% p.a), bukan `suku_bunga_default` seperti dicatat pada versi 1.4.0; TC-501/TC-502 kini menegaskan suku bunga diresolusi dari master baru `api_dep_oncall_rate`. TC-503 dikoreksi dari "`jkw` di luar {7,14}" (set hardcoded) menjadi "`jkw` tanpa baris `api_dep_oncall_rate` aktif" (juga mencakup kasus periode program berakhir), dengan pesan penolakan baru "Program deposito on call untuk jangka waktu {N} hari tidak tersedia pada tanggal ini" — **tanpa fallback** ke default produk. Pre-condition menambahkan patch `patch_dep_oncall_rate.sql` & seeder `seed_dep_oncall_rate.sql`. TC-504 tidak berubah. |

---

*[← Kembali ke Host 2 Host](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
