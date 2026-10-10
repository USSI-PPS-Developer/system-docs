# ✅ Test Case — API Jamkrida Jateng

> Daftar skenario & kasus uji untuk produk **API Jamkrida Jateng**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | API Jamkrida Jateng     |
| Jenis Dokumen     | Test Case         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 10 Oktober 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Ringkasan Test Case

| ID | Modul / Fitur | Judul Test Case | Prioritas | Jenis |
|----|---------------|-----------------|-----------|-------|
| TC-001 | Keamanan | Request tanpa / dengan `X-Api-Key` salah ditolak 401 `09` | Tinggi | Negatif |
| TC-002 | Keamanan | Kunci CBS ditolak di `/publik/**`; kunci Jamkrida ditolak di jalur internal | Tinggi | Negatif |
| TC-003 | Keamanan | `/actuator/health` & `/docs` dapat diakses tanpa kunci | Rendah | Positif |
| TC-004 | Error handling | Endpoint tak dikenal → 404 `07`; method salah → 405 `07`; body rusak → 400 `07` | Sedang | Negatif |
| TC-005 | Error handling | Sertifikat diminta dengan `Accept: application/json` → 406 `07` | Rendah | Negatif |
| TC-101 | Cek IJP | `POST /kredit/cek-ijp` payload valid → IJP gross/diskon/net | Tinggi | Positif |
| TC-102 | Cek IJP | Referensi produk `?type_kredit=100` hanya menampilkan 3933, 3934, 4768, 4912 + flag bundling | Tinggi | Positif |
| TC-103 | Cek IJP | `?type_kredit` tanpa pemetaan → daftar kosong | Tinggi | Negatif |
| TC-104 | Cek IJP | `data` Jamkrida berbentuk objek maupun array diterima | Sedang | Positif |
| TC-201 | Realisasi | Kantor piloting → `jamkrida_trans` status 0 + `premitrans` 101 = `ijp_net` | Tinggi | Positif |
| TC-202 | Realisasi | Kantor non-piloting ditolak | Tinggi | Negatif |
| TC-203 | Realisasi | Realisasi ulang rekening yang belum terkirim menimpa; yang sudah terkirim → 409 | Sedang | Negatif |
| TC-204 | Realisasi | `payload` kosong → 400 `07` | Sedang | Negatif |
| TC-205 | Realisasi | NIK tersimpan ter-mask di `no_identitas_masked` | Tinggi | Positif |
| TC-301 | Rekon | Ketiga sumber sama → `boleh_kirim=true`, `premi_rekon_at` terisi | Tinggi | Positif |
| TC-302 | Rekon | `kredit.premi` diubah → `beda_di=["kredit"]`, `premi_rekon_at` dikosongkan | Tinggi | Negatif |
| TC-303 | Rekon | Sesudah terkirim, sumber IJP = `detail` | Sedang | Positif |
| TC-304 | Rekon | Flag `bundling` dihitung ulang dari pemetaan | Sedang | Positif |
| TC-401 | Kirim | Kirim sebelum rekon cocok → 400 `07` | Tinggi | Negatif |
| TC-402 | Kirim | Non-bundling sukses → `status_kirim=1`, sertifikat terbit, `inforce` | Tinggi | Positif |
| TC-403 | Kirim | Field penentu IJP (tenor) diubah di modal → ditolak, rekon direset | Tinggi | Negatif |
| TC-404 | Kirim | Dua kirim bersamaan → satu `/add`, satu 409 | Tinggi | Negatif |
| TC-405 | Kirim | Kirim ulang yang sudah terkirim → 409 | Tinggi | Negatif |
| TC-406 | Kirim | Jamkrida error → 502 `09` + `trace_id`, `status_kirim=2`, `kirim_last_error` terisi | Tinggi | Negatif |
| TC-501 | Bundling | Berkas kurang → ditolak sebelum diklaim, menyebut berkas yang kurang | Tinggi | Negatif |
| TC-502 | Bundling | `pekerjaan` / `sumber_penghasilan` kosong → ditolak `07` | Tinggi | Negatif |
| TC-503 | Bundling | Berkas > 5 MB / format salah ditolak | Sedang | Negatif |
| TC-504 | Bundling | Kirim lengkap → `/addbundling` multipart sukses, `sertifikat_pending=true`, no sertifikat tidak berisi teks PENDING | Tinggi | Positif |
| TC-505 | Bundling | Cek status PENDING → `/no_rekening` + `/statusbundling` dipanggil | Tinggi | Positif |
| TC-506 | Bundling | `/statusbundling` gagal → cek status tetap `00`, keterangan menyebut status bundling tidak terbaca | Sedang | Negatif |
| TC-507 | Bundling | Setelah disetujui → nomor sertifikat & sertifikat jiwa terisi | Tinggi | Positif |
| TC-508 | Bundling | Payload lama berfield `kode_pekerjaan` tetap terbaca | Sedang | Positif |
| TC-601 | Premi | Tanda bayar → mutasi status 1, `premitrans_id` NULL; ulang aman | Sedang | Positif |
| TC-602 | Premi | Tanda bayar saat PENDING BUNDLING ditolak | Tinggi | Negatif |
| TC-603 | Premi | Cabut tanda setelah IJP dilaporkan ditolak | Tinggi | Negatif |
| TC-604 | Premi | Cabut tanda setelah setoran 201 ditolak | Sedang | Negatif |
| TC-701 | Bayar IJP | Sebelum premi disetor/ditandai → 400 `07` | Tinggi | Negatif |
| TC-702 | Bayar IJP | Premi sudah disetor → form terisi otomatis dari `premi-bayar`; `/bayarijp` sukses, `ijp_dibayar_at` terisi | Tinggi | Positif |
| TC-703 | Bayar IJP | Pembayaran sukses kedua → 409 | Tinggi | Negatif |
| TC-704 | Bayar IJP | `nilai_hf` kosong → 400 | Sedang | Negatif |
| TC-705 | Bayar IJP | Rekening penjaminan tidak dikonfigurasi & tidak diisi → 400 menyebut properti | Sedang | Negatif |
| TC-706 | Bayar IJP | Jamkrida menolak → baris `failed` tercatat dengan `error_message` | Sedang | Negatif |
| TC-707 | Bayar IJP | Tanggal dikirim ke Jamkrida dalam format `yyyymmdd` | Sedang | Positif |
| TC-801 | Sertifikat | Non-bundling: 4 tautan kembar → 1 berkas di daftar | Sedang | Positif |
| TC-802 | Sertifikat | Bundling → 2 berkas (penjaminan + jiwa), nama unduhan berbeda | Tinggi | Positif |
| TC-803 | Sertifikat | Tautan kedaluwarsa (HTML 200) → tidak disajikan sebagai PDF | Sedang | Negatif |
| TC-804 | Sertifikat | Respons proksi `application/pdf`, `Cache-Control: no-store` | Rendah | Positif |
| TC-901 | Publik | Premi disetor → `sudah_dibayar=true` + tgl, nominal, kode_reff, rekening Jamkrida | Tinggi | Positif |
| TC-902 | Publik | Belum dibayar / tidak dikenal → HTTP 200 `00`, `sudah_dibayar=false` | Tinggi | Positif |
| TC-903 | Publik | Tanpa parameter → 400 `07` | Sedang | Negatif |
| TC-904 | Publik | Urutan kunci `no_sertifikat` → `no_pinjaman` → `no_rekening` | Sedang | Positif |
| TC-905 | Publik | Premi ditandai (belum disetor) terbaca `sudah_dibayar=true`; tanda dicabut → `false` | Tinggi | Positif |
| TC-1001 | Referensi | Sinkron manual mengisi 5 tipe; ringkasan menampilkan jumlah & waktu | Sedang | Positif |
| TC-1002 | Referensi | Baris yang ditarik Jamkrida jadi nonaktif, tampil hanya dengan `semua=true` | Rendah | Positif |
| TC-1101 | Mapping | Tambah pasangan dobel → 400 menyebut kedua kode | Sedang | Negatif |
| TC-1102 | Piloting | Nonaktifkan kantor → realisasi baru ditolak; perilaku penyelesaian penjaminan lama sesuai keputusan BR-014 | Tinggi | Negatif |
| TC-1201 | Audit | Setiap panggilan (sukses, HTTP error, timeout) tercatat dengan latensi & aktor | Tinggi | Positif |
| TC-1202 | Audit | Filter `no_rekening`, `endpoint`, `is_success`, tanggal; daftar tanpa payload | Sedang | Positif |
| TC-U01..U05 | Unit — masking | Lihat §2 | Tinggi | Otomatis |
| TC-U06..U13 | Unit — token & retry | Lihat §2 | Tinggi | Otomatis |

## 2. Detail Test Case

### TC-U01..TC-U13 — Unit test otomatis (`mvn test`)

| ID | Kelas | Test | Hasil diharapkan |
|----|-------|------|------------------|
| TC-U01 | `SensitiveDataMaskerTest` | `passwordDanTokenTidakTersimpanUtuh` | `password`→`***`, token hanya 8 karakter terakhir |
| TC-U02 | `SensitiveDataMaskerTest` | `nikDiMaskSebagian` | `3322120101902901` → `3322********2901` |
| TC-U03 | `SensitiveDataMaskerTest` | `dataKesehatanDiRedact` | `q2_desc` dst → `[REDACTED]` |
| TC-U04 | `SensitiveDataMaskerTest` | `maskingJugaJalanDiDalamArrayDanObjekBersarang` | Field bersarang ikut ter-mask |
| TC-U05 | `SensitiveDataMaskerTest` | `bodyNonJsonTetapDiMask` | Body form/teks juga ter-mask |
| TC-U06 | `JamkridaTokenManagerTest` | `tokenMasihBerlakuTidakMemicuAuthenticateUlang` | Tidak ada `/authenticate` |
| TC-U07 | `JamkridaTokenManagerTest` | `tokenYangHampirKadaluarsaDiperbaruiLebihDulu` | Refresh bila sisa < skew |
| TC-U08 | `JamkridaTokenManagerTest` | `invalidateMemaksaAuthenticateUlang` | Authenticate ulang |
| TC-U09 | `JamkridaApiClientTokenTest` | `tokenKedaluwarsaDikenaliMeskipunHttp200` | Penolakan token di body HTTP 200 dikenali |
| TC-U10 | `JamkridaApiClientTokenTest` | `http401DianggapTokenDitolak` | 401 → token ditolak |
| TC-U11 | `JamkridaApiClientTokenTest` | `errorBisnisBiasaTidakMemicuAuthenticateUlang` | Error bisnis tidak memicu authenticate |
| TC-U12 | `JamkridaApiClientTokenTest` | `responseSuksesTidakMemicuAuthenticateUlang` | Sukses tidak memicu authenticate |
| TC-U13 | `JamkridaApiClientRetryTest` | `tokenBasiMemicuAuthenticateUlangDanRequestDiulang` | Token basi → authenticate → request diulang sekali |

### TC-201 — Realisasi kredit di kantor piloting

| Item | Detail |
|------|--------|
| **Pre-condition** | Kantor `001` aktif di `jamkrida_kantor_pilot`; `KRE_USING_JAMKRIDA_API=YA`; titipan SPAJ ada |
| **Langkah** | 1. Registrasi kredit + Cek IJP + Gunakan ke Premi. 2. Realisasi kredit di CBS |
| **Data uji** | Plafond Rp 10.000.000, tenor 12, produk 3934, IJP Rp 150.000 |
| **Hasil diharapkan** | Baris `jamkrida_trans` (status 0, bundling=1) terbentuk; `premitrans` 101 nominal 150.000 tertaut di `premitrans_id`; titipan SPAJ terhapus; potongan premi di realisasi = 150.000 |

### TC-301 / TC-302 — Rekonsiliasi premi

| Item | Detail |
|------|--------|
| **Pre-condition** | TC-201 lulus |
| **Langkah** | 1. `POST /jamkrida/trans/{id}/premi`. 2. Ubah `kredit.premi` di DB dev, ulangi |
| **Hasil diharapkan** | (1) empat nilai 150.000, `boleh_kirim=true`. (2) `beda_di` memuat `kredit`, `boleh_kirim=false`, `premi_rekon_at` NULL, `/send` ditolak |

### TC-404 — Idempotensi kirim

| Item | Detail |
|------|--------|
| **Langkah** | Kirim dua `POST /{id}/send` paralel untuk baris yang rekonnya cocok |
| **Hasil diharapkan** | Audit log hanya memuat satu `add`; satu respons `00`, satu 409 "sedang/sudah diproses oleh permintaan lain" |

### TC-504..TC-507 — Siklus bundling

| Item | Detail |
|------|--------|
| **Pre-condition** | Produk bundling (mis. 3934), rekon cocok, berkas KTP/SPAJ/RIPLAY diunggah, pekerjaan & sumber penghasilan diisi |
| **Langkah** | 1. Kirim. 2. Cek Status berkala. 3. Setelah disetujui CAR: setor premi 201, Bayar IJP, buka sertifikat |
| **Hasil diharapkan** | (1) `code 00`, `PENDING BUNDLING`, `sertifikat_pending=true`, `no_sertifikat` kosong. (2) Audit log berisi `detail` + `statusbundling`. Setoran premi ditolak selama PENDING. (3) Nomor sertifikat terisi, status APPROVED, dua tab sertifikat |

### TC-701 / TC-702 — Bayar IJP

| Item | Detail |
|------|--------|
| **Pre-condition** | Penjaminan terkirim dengan sertifikat |
| **Langkah** | 1. `POST /{id}/bayar-ijp` sebelum setoran. 2. Setor premi kode 201 di CBS. 3. `GET /{id}/premi-bayar`, lalu `POST /{id}/bayar-ijp` dengan `nilai_hf=0` |
| **Hasil diharapkan** | (1) 400 "Premi … belum dibayar di CBS…". (3) Form terisi kuitansi/tanggal/nominal/deskripsi; respons `00`; `ijp_dibayar_at` & `ijp_no_referensi` terisi; Status Bayar = Sudah Bayar |

### TC-901..TC-905 — Status premi publik

| Item | Detail |
|------|--------|
| **Langkah** | `curl -H 'X-Api-Key: <kunci Jamkrida>' '…/publik/premi/status?no_sertifikat=…'` untuk premi disetor, belum dibayar, tanpa parameter, dan dengan kunci CBS |
| **Hasil diharapkan** | Sesuai tabel ringkasan; jawaban tidak pernah memuat saldo/mutasi/jurnal |

### TC-1102 — Pencabutan izin piloting

| Item | Detail |
|------|--------|
| **Langkah** | 1. Nonaktifkan kantor X. 2. Coba realisasi baru di kantor X. 3. Lanjutkan Bayar IJP untuk penjaminan kantor X yang sudah terkirim |
| **Hasil diharapkan** | (2) tidak terbentuk penjaminan. (3) **Implementasi saat ini menolak** dengan pesan "Integrasi Jamkrida belum bisa digunakan di kantor X…", karena `pastikanDiizinkan` dipanggil juga pada kirim, tanda bayar, dan bayar IJP. README service menyatakan sebaliknya — hasil diharapkan ditetapkan setelah keputusan BR-014 |

## 3. Rekapitulasi

| Modul | Jumlah TC | Lulus | Gagal | Belum |
|-------|-----------|-------|-------|-------|
| Unit test otomatis | 13 | 13 | 0 | 0 |
| Keamanan & error handling | 5 | | | 5 |
| Cek IJP & realisasi | 9 | | | 9 |
| Rekon & kirim | 10 | | | 10 |
| Bundling | 8 | | | 8 |
| Premi & bayar IJP | 11 | | | 11 |
| Sertifikat | 4 | | | 4 |
| Publik | 5 | | | 5 |
| Referensi, mapping, piloting, audit | 6 | | | 6 |

> Hasil verifikasi end-to-end di dev (30-09-2026) dan uji produksi (05-10-2026) dicatat di
> [SIT](08-sit.md). Kolom hasil di atas diisi saat eksekusi formal.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 10 Oktober 2026 | | Dokumen dibuat |

---

*[← Kembali ke API Jamkrida Jateng](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
