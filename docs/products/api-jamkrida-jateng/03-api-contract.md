# 🔌 API Contract — API Jamkrida Jateng

> Kontrak API untuk produk **API Jamkrida Jateng**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | API Jamkrida Jateng     |
| Jenis Dokumen     | API Contract         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 10 Oktober 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Informasi Umum

| Item | Nilai |
|------|-------|
| Base URL (lokal) | `http://localhost:8087/api-jamkrida` |
| Base URL (dev, publik) | `https://api-jamkridadev.bkkjateng.co.id` (hanya `/publik/**`) |
| Base URL (internal) | `http://<host-service>:8087/api-jamkrida` — dari CBS & web CBS |
| Format | JSON UTF-8 (kecuali unggah berkas `multipart/form-data` dan sertifikat `application/pdf`) |
| Autentikasi | Header `X-Api-Key` — dua kunci terpisah (lihat §2.3) |
| Dokumentasi interaktif | `/docs` (Swagger UI) |
| Health | `GET /actuator/health` (tanpa kunci) |

## 2. Konvensi

### 2.1 Header Standar

| Header | Wajib | Berlaku pada | Keterangan |
|--------|-------|--------------|------------|
| `X-Api-Key` | Ya, bila kunci dikonfigurasi | Semua endpoint | Kunci CBS untuk jalur internal, kunci Jamkrida untuk `/publik/**` |
| `X-User-Id` | Disarankan | Jalur internal | ID pengguna CBS; dicatat di audit log & kolom `user_id` |
| `X-Kode-Kantor` | Disarankan | Jalur internal | Kantor pengguna; dicatat di audit log |
| `Content-Type` | Ya (ada body) | POST/PUT | `application/json` atau `multipart/form-data` |

### 2.2 Format Response Standar

```json
{
  "response_code": "00",
  "response_message": "Sukses",
  "response_data": { },
  "trace_id": "…"
}
```

| Field | Keterangan |
|-------|------------|
| `response_code` | Lihat §6 |
| `response_message` | Pesan yang dapat ditampilkan ke pengguna |
| `response_data` | Isi; tidak ada pada error |
| `trace_id` | Hanya pada error dari Jamkrida (`09`) — untuk dicari di audit log |

Daftar berhalaman memakai `PageResponse`:

```json
{ "items": [ … ], "page": 0, "size": 25, "total_elements": 120, "total_pages": 5 }
```

Parameter halaman standar Spring: `page` (mulai 0), `size` (default 25), `sort` (default `id,desc`).

### 2.3 Autentikasi — dua kunci

| Kunci | Properti | Berlaku | Dipegang |
|-------|----------|---------|----------|
| Kunci CBS | `app.security.api-key` | Semua jalur **kecuali** `/publik/**` | CBS (`sys_mysysid.KRE_JAMKRIDA_API_KEY`) & web (`.env JAMKRIDA_API_KEY`) |
| Kunci Jamkrida | `app.security.inbound-key` | **Hanya** `/publik/**` | Jamkrida |

Kunci kosong = jalur tersebut tidak diproteksi (hanya untuk dev). Kunci salah → HTTP 401
`{"response_code":"09","response_message":"API key tidak valid"}`. Perbandingan kunci memakai
waktu konstan.

### 2.4 Konvensi tanggal

- DTO yang meniru dokumentasi Jamkrida (`payload` realisasi/cek IJP) memakai **`yyyymmdd`** (String).
- DTO milik service (bayar IJP, filter `tgl_awal`/`tgl_akhir`) memakai **ISO `yyyy-mm-dd`**.

## 3. Daftar Endpoint

### 3.1 Dipanggil CBS saat alur kredit — `/kredit`

| Method | Path | Fungsi |
|--------|------|--------|
| POST | `/kredit/cek-ijp` | Estimasi IJP (body = payload `/add` Jamkrida) |
| POST | `/kredit/realisasi` | Bentuk `jamkrida_trans` + bukukan premi 101 |

### 3.2 Penjaminan — `/jamkrida/trans`

| Method | Path | Fungsi |
|--------|------|--------|
| GET | `/jamkrida/trans` | Daftar penjaminan (berhalaman) |
| GET | `/jamkrida/trans/{id}` | Detail tersimpan |
| GET | `/jamkrida/trans/{id}/payload` | Payload kirim tersimpan |
| POST | `/jamkrida/trans/{id}/premi` | Rekonsiliasi premi |
| POST | `/jamkrida/trans/{id}/send` | Kirim ke Jamkrida (`/add` / `/addbundling`) |
| GET | `/jamkrida/trans/{no_rekening}/detail` | Detail langsung dari Jamkrida |
| POST | `/jamkrida/trans/{id}/cek-status` | Cek status kepesertaan (+ `/statusbundling`) |
| GET | `/jamkrida/trans/{id}/berkas` | Daftar slot berkas bundling |
| POST | `/jamkrida/trans/{id}/berkas` | Unggah berkas (multipart) |
| DELETE | `/jamkrida/trans/{id}/berkas/{jenis}` | Hapus berkas |
| POST | `/jamkrida/trans/{id}/flag-premi` | Tandai premi dibayar (sebelum setoran kolektif) |
| POST | `/jamkrida/trans/{id}/flag-premi/batal` | Cabut tanda bayar |
| GET | `/jamkrida/trans/{id}/premi-bayar` | Data setoran premi CBS untuk form Bayar IJP |
| POST | `/jamkrida/trans/{id}/bayar-ijp` | Laporkan pembayaran IJP |
| GET | `/jamkrida/trans/{id}/pembayaran` | Riwayat pembayaran IJP |
| GET | `/jamkrida/trans/{id}/sertifikat/daftar` | Daftar berkas sertifikat |
| GET | `/jamkrida/trans/{id}/sertifikat` | Proksi PDF sertifikat |
| POST | `/jamkrida/trans/{no_rekening}/link-sertifikat` | Ambil ulang tautan sertifikat |

### 3.3 Master data — `/jamkrida/referensi`

| Method | Path | Fungsi |
|--------|------|--------|
| GET | `/jamkrida/referensi/{tipe}` | `produk`, `jenis_agunan`, `sektor_usaha`, `cabang`, `pekerjaan` |
| GET | `/jamkrida/referensi/ringkasan` | Jumlah baris & waktu sinkron terakhir per tipe |
| POST | `/jamkrida/referensi/sync` | Paksa sinkronisasi |

### 3.4 Pemeliharaan

| Method | Path | Fungsi |
|--------|------|--------|
| GET | `/jamkrida/produk-mapping` | Daftar pemetaan (termasuk nonaktif) |
| POST | `/jamkrida/produk-mapping` | Tambah |
| PUT | `/jamkrida/produk-mapping/{id}` | Ubah |
| DELETE | `/jamkrida/produk-mapping/{id}` | Hapus |
| GET | `/jamkrida/kantor-pilot` | Daftar kantor piloting |
| GET | `/jamkrida/kantor-pilot/{kode_kantor}/izin` | Cek izin satu kantor |
| PUT | `/jamkrida/kantor-pilot/{kode_kantor}` | Aktifkan/nonaktifkan |
| DELETE | `/jamkrida/kantor-pilot/{kode_kantor}` | Hapus dari daftar |

### 3.5 Audit log — `/jamkrida/audit-log`

| Method | Path | Fungsi |
|--------|------|--------|
| GET | `/jamkrida/audit-log` | Cari (tanpa payload) |
| GET | `/jamkrida/audit-log/endpoint` | Daftar endpoint yang pernah tercatat |
| GET | `/jamkrida/audit-log/{id}` | Detail + payload ter-mask |

### 3.6 Jalur publik (dipanggil Jamkrida)

| Method | Path | Fungsi |
|--------|------|--------|
| GET | `/publik/premi/status` | Status pembayaran premi penjaminan |

## 4. Detail Endpoint

### 4.1 `POST /kredit/cek-ijp`

Body = payload Jamkrida (§4.2 `payload`). Diteruskan ke `POST /cekijp`. Response `response_data`
berisi data polis Jamkrida: `ijp_gross`, `diskon`, `ijp_net`, `ijp`, `usia`, `produk`, dst.

> Jamkrida mengembalikan `data` sebagai **objek** (bukan array seperti di dokumennya); client
> menerima kedua bentuk.

### 4.2 `POST /kredit/realisasi`

**Request**

```json
{
  "trans_id_source": 998877,
  "kode_kantor": "001",
  "bundling": null,
  "ijp_gross": 3750000,
  "diskon": 0,
  "ijp_net": 3750000,
  "auto_kirim": false,
  "payload": {
    "produk": "3933", "no_rekening": "1234565", "no_pinjaman": "167/tesapi/2021",
    "nama_lengkap": "TESTING BPR", "tempat_lahir": "SEMARANG", "tanggal_lahir": "19900101",
    "jenis_kelamin": "P", "no_identitas": "3322120101902901", "agama": 1,
    "kelurahan": "X", "kecamatan": "Y", "kota": "SEMARANG", "provinsi": "JAWA TENGAH",
    "tanggal_pinjaman": "20211101", "tenor": 12, "nilai_pinjaman": 50000000,
    "jenis_agunan": "JA.2", "nilai_taksasi": 0, "sektor_usaha": "SU.4",
    "tinggi_badan": 170, "berat_badan": 65,
    "pertanyaan1": "T", "pertanyaan2": "T", "pertanyaan3": "T", "pertanyaan4": "T",
    "cabang": "PUSAT", "alamat": "JL. TEST NO 1", "type_terjamin": "P",
    "agunan": "TANAH + BANGUNAN", "score1": 1, "score2": 2, "nama_ibu": "IBU TEST",
    "pekerjaan": 7, "sumber_penghasilan": 1
  }
}
```

| Field | Wajib | Keterangan |
|-------|-------|------------|
| `trans_id_source` | Tidak | ID transaksi realisasi di CBS |
| `kode_kantor` | Ya (praktis) | Diperiksa terhadap daftar piloting |
| `bundling` | Tidak | Kosong → ditentukan dari pemetaan lokal, lalu `meta_json` referensi |
| `ijp_gross`, `diskon`, `ijp_net` | Ya (praktis) | Hasil Cek IJP; `ijp_net` menjadi nominal `premitrans` 101 |
| `auto_kirim` | Tidak | Langsung kirim setelah disimpan |
| `payload` | **Ya** | Nama field persis dokumentasi Jamkrida; tanggal `yyyymmdd` |

Catatan field `payload`:
- `jenis_kelamin`: kode Jamkrida `P`=Pria, `W`=Wanita (CBS memetakan `L→P`, `P→W`).
- `agama`: kode Jamkrida (Hindu `4`, Buddha `5` — tertukar dibanding kode CBS).
- `pekerjaan`: **bukan** `kode_pekerjaan` seperti di dokumen Jamkrida; `kode_pekerjaan` tetap
  diterima saat membaca (alias) untuk payload lama.
- `q2_desc`..`q5b_desc`: deskripsi SPAJ, wajib bila pertanyaannya dijawab `Y` (bundling).
- Field opsional yang kosong tidak dikirim ke Jamkrida (`NON_NULL`).

**Response** `00` → `TransResponse` (§4.3). Realisasi ulang untuk pasangan `no_rekening` +
`no_pinjaman` yang **sudah terkirim** ditolak HTTP 409 `07`; yang belum terkirim ditimpa.
Kantor di luar piloting ditolak `07`.

### 4.3 `GET /jamkrida/trans`

| Query | Keterangan |
|-------|------------|
| `cari` | Sebagian nomor rekening **atau** nama debitur |
| `status_kirim` | `0` belum, `1` terkirim, `2` gagal |
| `kode_kantor`, `cabang`, `no_rekening`, `no_sertifikat` | Filter persis |
| `tgl_awal`, `tgl_akhir` | ISO `yyyy-mm-dd`, terhadap `tgl_trans` |
| `page`, `size`, `sort` | Paginasi |

Field utama `TransResponse`: `id`, `trans_id_source`, `no_rekening`, `no_pinjaman`, `kode_kantor`,
`cabang`, `produk_kode`, `bundling`, `nama_debitur`, `no_identitas_masked`, `no_sertifikat`,
`sertifikat_pending`, `tanggal_sertifikat`, `nama_perusahaan`, `nomor_pks`,
`tanggal_akad_pinjaman`, `tanggal_akhir_pinjaman`, `tenor_pinjaman`, `nilai_pinjaman`, `ijp_gross`,
`diskon`, `ijp_net`, `status_kepesertaan`, `status_cek_at`, `status_kirim`, `status_kirim_label`,
`kirim_attempt`, `kirim_last_error`, `kirim_at`, `url_sertifikat`, `premitrans_id`,
`premitrans_error`, `premi_rekon_at`, `premi_rekon_ijp`, `ijp_dibayar_at`, `ijp_no_referensi`,
`ijp_sudah_dibayar`, `premi_sudah_dibayar`, `boleh_kirim`, `tgl_trans`, `user_id`.

> Penguncian kode kantor ke kantor pengguna (kecuali pusat) dilakukan di controller web CBS.

### 4.4 `POST /jamkrida/trans/{id}/premi` — Rekonsiliasi

**Response**

```json
{
  "response_code": "00",
  "response_message": "Premi cocok dengan IJP Jamkrida, data boleh dikirim",
  "response_data": {
    "trans_id": 12, "no_rekening": "001137000010", "nama_debitur": "…",
    "no_sertifikat": null, "premitrans_id": 195063046,
    "ijp_jamkrida": 150000.00, "sumber_ijp": "cekijp", "ijp_saat_realisasi": 150000.00,
    "premi_premitrans": 150000.00, "premi_kredit": 150000.00, "premi_kretrans": 150000.00,
    "beda_di": [], "boleh_kirim": true, "rekon_at": "2026-10-05T10:21:33"
  }
}
```

`sumber_ijp`: `cekijp` (belum terkirim) atau `detail` (sertifikat sudah terbit). `beda_di` berisi
nama sumber yang tidak cocok; bila tidak kosong `boleh_kirim=false` dan izin kirim lama dibatalkan.
Payload Cek IJP yang tidak lengkap ditolak `07`.

### 4.5 `POST /jamkrida/trans/{id}/send`

Body opsional: payload hasil tinjauan di modal kirim (field identitas/alamat/cabang/agunan/sektor/
taksasi boleh dikoreksi; field penentu IJP dikunci).

| Kondisi | HTTP | Code |
|---------|------|------|
| Sukses | 200 | `00` (`TransResponse` dengan sertifikat) |
| Kantor bukan piloting | 400 | `07` |
| Rekon belum cocok / field penentu IJP berubah | 400 | `07` (menyebut field) |
| Bundling: pekerjaan / sumber penghasilan / berkas kurang | 400 | `07` (menyebut kekurangan) |
| Sudah terkirim (`status_kirim=1`) atau sedang dikirim | 409 | `07` |
| Jamkrida menolak / gagal | 502 | `09` + `trace_id` |

Bundling dikirim `multipart/form-data` dengan part teks + `file_ktp`, `file_spaj`, `file_riplay`.
Untuk bundling, `no_sertifikat` & `status_kepesertaan` dapat berisi `PENDING BUNDLING`; nilai itu
tidak disimpan sebagai nomor sertifikat (`sertifikat_pending=true`).

### 4.6 `POST /jamkrida/trans/{id}/cek-status`

```json
{
  "trans_id": 31, "no_rekening": "003138000003",
  "no_sertifikat": "JT.P01-1813.26.0076868", "no_sertifikat_sebelumnya": null,
  "sertifikat_terbit": true, "sertifikat_pending": false,
  "status_sebelumnya": "PENDING BUNDLING", "status_kepesertaan": "APPROVED",
  "usia": 33, "tanggal_akhir_pinjaman": "2027-09-30", "dicek_pada": "2026-10-01T09:12:00",
  "detail": { "…": "apa adanya dari Jamkrida" },
  "keterangan": "…"
}
```

Untuk bundling, kegagalan `/statusbundling` tidak menggagalkan respons; keterangannya menyebut
status bundling tidak terbaca.

### 4.7 Berkas bundling — `/jamkrida/trans/{id}/berkas`

**Unggah** `POST` multipart: `jenis` (`KTP` | `SPAJ` | `RIPLAY`) + `file`.

| Jenis | Format | Batas |
|-------|--------|-------|
| `KTP` | `.jpg` / `.pdf` | 5 MB |
| `SPAJ` | `.pdf` (format CAR) | 5 MB |
| `RIPLAY` | `.pdf` (format CAR) | 5 MB |

Unggah ulang menimpa. **Daftar** `GET` mengembalikan seluruh slot (termasuk yang kosong):
`jenis`, `nama_file`, `content_type`, `ukuran`, `sudah_ada`, `keterangan_tipe`, `diunggah_pada`.
**Hapus** `DELETE /berkas/{jenis}`.

### 4.8 Tanda bayar premi

`POST /{id}/flag-premi` → `PremiFlagResponse`:
`jamkrida_trans_id`, `no_rekening`, `no_sertifikat`, `tgl_bayar`, `flag_at`, `sudah_disetor`.
Aman diulang. Ditolak `07` bila bundling masih menunggu CAR atau tidak ada saldo premi belum disetor.

`POST /{id}/flag-premi/batal` → ditolak `07` bila sudah disetor di CBS atau IJP sudah dilaporkan;
`404` bila belum pernah ditandai.

### 4.9 `GET /jamkrida/trans/{id}/premi-bayar`

Untuk mengisi form Bayar IJP: `sudah_dibayar`, `no_referensi` (kuitansi), `tgl_bayar`, `nominal`,
`deskripsi` (keterangan baris pembayaran di `premitrans`). Premi yang baru ditandai belum punya kuitansi/keterangan.

### 4.10 `POST /jamkrida/trans/{id}/bayar-ijp`

**Request**

```json
{
  "nilai_ijp": 150000,
  "no_referensi_pembayaran": "1002609290015",
  "tgl_referensi_pembayaran": "2026-09-29",
  "deskripsi_pembayaran": "Premi IJP Jamkrida No Rekening …",
  "nama_bank": null, "no_rekening_penjaminan": null, "nama_rekening_penjaminan": null,
  "nilai_hf": 0,
  "deskripsi_pembayaran_hf": null, "no_referensi_hf": null, "tgl_pembayaran_hf": null
}
```

| Field | Wajib | Keterangan |
|-------|-------|------------|
| `nilai_ijp` | Tidak | Kosong → `ijp_net` penjaminan |
| `no_referensi_pembayaran` | Ya | |
| `tgl_referensi_pembayaran` | Ya | ISO `yyyy-mm-dd`; dipadatkan ke `yyyymmdd` saat dikirim |
| `deskripsi_pembayaran` | Ya | |
| `nama_bank`, `no_rekening_penjaminan`, `nama_rekening_penjaminan` | Tidak | Default dari `app.jamkrida.penjaminan.*` |
| `nilai_hf` | Ya | Feebase; isi `0` bila tidak ada |
| `*_hf` lainnya | Tidak | Dikirim hanya bila diisi |

| Kondisi | HTTP | Code |
|---------|------|------|
| Sukses | 200 | `00` (`PembayaranResponse`) |
| Belum terkirim / belum ada sertifikat | 400 | `07` |
| Premi belum disetor dan belum ditandai | 400 | `07` |
| Rekening tujuan belum dikonfigurasi & tidak diisi | 400 | `07` |
| Sudah ada pembayaran sukses | 409 | `07` |
| Jamkrida menolak | 502 | `09` (percobaan tercatat `failed`) |

`PembayaranResponse`: `id`, `jamkrida_trans_id`, `no_rekening`, `no_sertifikat`, `nilai_ijp`,
`nilai_hf`, `no_referensi_pembayaran`, `tgl_referensi_pembayaran`, `url_sertifikat`,
`url_sertifikat_car`, `status`, `error_message`, `created_at`.

### 4.11 Sertifikat

- `GET /{id}/sertifikat/daftar` → `[{ "kode": "…", "label": "Sertifikat Penjaminan" }, …]`;
  bundling menghasilkan dua (penjaminan Jamkrida + asuransi jiwa CAR).
- `GET /{id}/sertifikat?kode=&unduh=false` → `application/pdf`. `kode` kosong = berkas pertama;
  `unduh=true` → `Content-Disposition: attachment`. Header `Cache-Control: no-store`.
  Panggil dengan `Accept: application/pdf` (Accept JSON → 406 / `07`).
- `POST /{no_rekening}/link-sertifikat` → tautan baru dari Jamkrida. Memakai **no_rekening**, bukan id.

### 4.12 `GET /jamkrida/referensi/{tipe}`

| Query | Keterangan |
|-------|------------|
| `type_kredit` | Hanya untuk `produk`: saring sesuai pemetaan & isi flag `bundling`. Type tanpa pemetaan → daftar kosong |
| `semua` | `true` ikut menampilkan baris yang sudah ditarik Jamkrida (layar telusur) |

### 4.13 Pemetaan produk

**Request** `POST`/`PUT`:

```json
{ "type_kredit": "100", "produk_jamkrida": "3934", "bundling": true, "is_active": true }
```

`type_kredit` & `produk_jamkrida` wajib. Pasangan dobel ditolak `07` dengan pesan yang menyebut keduanya.

### 4.14 Kantor piloting

`PUT /jamkrida/kantor-pilot/{kode_kantor}` body `{ "aktif": true, "catatan": "…" }`
(`catatan` maks 255). `GET …/{kode_kantor}/izin` →
`{ "kode_kantor": "001", "diizinkan": true, "pesan": "" }` (`pesan` berisi alasan penolakan bila tidak diizinkan).

### 4.15 `GET /jamkrida/audit-log`

Query: `no_rekening`, `endpoint`, `is_success`, `tgl_awal`, `tgl_akhir` (ISO), paginasi (default 25).
Daftar tidak memuat payload; `GET /{id}` memuat `request_payload` & `response_payload` yang sudah ter-mask.

### 4.16 `GET /publik/premi/status`

Kontrak ini diserahkan ke Jamkrida sebagai dokumen terpisah
(*API Contract — Cek Status Pembayaran Premi* v1.1).

| Query | Keterangan |
|-------|------------|
| `no_sertifikat` | Disarankan |
| `no_pinjaman` | |
| `no_rekening` | Rekening kredit |

Isi salah satu; bila lebih dari satu, urutan `no_sertifikat` → `no_pinjaman` → `no_rekening`.

**Response — sudah dibayar**

```json
{
  "response_code": "00",
  "response_message": "Premi sudah dibayar",
  "response_data": {
    "no_sertifikat": "JT.P01-1813.26.0076865",
    "no_pinjaman": "1919200839182",
    "no_rekening": "001136000003",
    "no_rekening_jamkrida": "001202000901",
    "nama_rekening_jamkrida": "PT JAMKRIDA JATENG",
    "sudah_dibayar": true,
    "tgl_bayar": "2026-09-29",
    "nominal": 171000.00,
    "kode_reff": "1002609290015",
    "keterangan": "Premi sudah dibayar"
  }
}
```

**Belum dibayar / tidak dikenal** → HTTP 200, `00`, `sudah_dibayar: false`.
**Parameter kosong** → 400 `07`. **Kunci salah** → 401 `09`.

## 5. Endpoint Jamkrida Online yang Dipanggil

| Endpoint Jamkrida | Method | Dipanggil oleh | `endpoint` di audit log |
|-------------------|--------|----------------|-------------------------|
| `/authenticate` | POST | Token habis / ditolak | `authenticate` |
| `/cekijp` | POST | Cek IJP, rekon (belum terkirim) | `cekijp` |
| `/add` | POST JSON | Kirim non-bundling | `add` |
| `/addbundling` | POST multipart | Kirim bundling | `addbundling` |
| `/no_rekening/{no_rekening}` | GET | Detail, cek status, rekon (terkirim) | `detail` |
| `/statusbundling` | POST | Cek status bundling (tidak berdokumentasi) | `statusbundling` |
| `/bayarijp` | POST | Bayar IJP | `bayarijp` |
| `/linksertifikat` | POST | Tautan sertifikat | `linksertifikat` |
| tautan `dlsertifikat` | GET | Proksi PDF | — |
| `/produk`, `/jenisagunan`, `/sektorusaha`, `/cabang`, `/listpekerjaan` | GET | Sinkron referensi | `sync_*` |

Token dikirim di header `Token` (`app.jamkrida.token-header`), di-cache dan di-refresh 1 jam sebelum
kedaluwarsa. HTTP 401/403 atau penolakan token pada HTTP 200 → authenticate ulang lalu ulangi sekali.

## 6. Kode Response Global

| `response_code` | HTTP | Arti |
|-----------------|------|------|
| `00` | 200 | Sukses |
| `07` | 400 | Parameter/state tidak valid, validasi gagal, body tak terbaca |
| `07` | 404 | Data/endpoint tidak ditemukan |
| `07` | 405 | Method salah |
| `07` | 406 | Jenis isi (`Accept`) tidak tersedia |
| `07` | 409 | Konflik state (sudah terkirim, sudah dibayar) |
| `09` | 401 | `X-Api-Key` tidak valid |
| `09` | 502 | Error dari Jamkrida (disertai `trace_id`) |
| `01` | 500 | Kesalahan tak terduga di server |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 10 Oktober 2026 | | Dokumen dibuat |

---

*[← Kembali ke API Jamkrida Jateng](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
