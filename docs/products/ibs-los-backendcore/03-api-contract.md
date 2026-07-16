# 🔌 API Contract — IBS LOS BackEndCore

> Kontrak API (request/response) untuk produk **IBS LOS BackEndCore** — endpoint integrasi IBS LOS 4 Core (Core Banking) yang diamankan dengan request signature (HMAC).

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS LOS BackEndCore |
| Jenis Dokumen     | API Contract        |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 16 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Informasi Umum

| Item | Nilai |
|------|-------|
| Base URL (Dev)  | `http://<host>:7071/core-api` |
| Context Path | `/core-api` |
| Prefix Controller | `/core` |
| Versi API | `v1` |
| Format | JSON (UTF-8) |
| Autentikasi | Request Signature — HMAC-SHA256 via header (`X-Client-Id`, `X-Timestamp`, `X-Signature`) |
| Dokumentasi Interaktif | Swagger UI: `/swagger-ui.html` · OpenAPI: `/v3/api-docs` |

> **Catatan penting:** semua endpoint mengembalikan **HTTP 200 OK** meskipun operasi gagal secara bisnis. Sukses/gagal ditentukan oleh field `success` (`true`/`false`) di body, bukan oleh HTTP status. HTTP `401` hanya muncul saat validasi signature gagal (ditolak filter sebelum masuk controller).

---

## 2. Konvensi

### 2.1 Header Standar

| Header | Wajib | Contoh | Keterangan |
|--------|-------|--------|------------|
| `Content-Type` | Ya (untuk POST) | `application/json` | |
| `X-Client-Id` | Ya | `ibs-los` | Identitas client (dari `security.client_id`) |
| `X-Timestamp` | Ya | `1752624000` | Unix timestamp detik atau milidetik |
| `X-Signature` | Ya | `Base64(HMAC-SHA256(...))` | Tanda tangan request |

> Request dari **localhost** (`127.0.0.1` / `::1`) diperbolehkan tanpa header signature (mode development). Path Swagger (`/swagger-ui**`, `/v3/api-docs**`) dan `/error` dikecualikan dari validasi.

### 2.2 Skema Tanda Tangan (Signature)

Signature dihitung dari **canonical string** berikut (dipisah newline `\n`):

```
<HTTP_METHOD>
<REQUEST_URI>
<X-Timestamp>
<SHA256_HEX(body)>
```

- `SHA256_HEX(body)` = hex SHA-256 dari raw request body (untuk GET, body kosong `""`).
- `X-Signature` = `Base64( HMAC_SHA256( shared_secret, canonical_string ) )`.

**Aturan validasi:**

| Aturan | Nilai | Pesan jika gagal |
|--------|-------|------------------|
| Header lengkap | 3 header wajib | `Missing security headers.` |
| Client ID cocok | `security.client_id` | `Client tidak valid.` |
| Timestamp valid | numeric (detik/ms) | `Timestamp tidak valid.` |
| Toleransi waktu (skew) | `300` detik | `Request expired.` |
| Anti-replay | 1x per (clientId+timestamp+signature) | `Replay detected.` |
| Signature cocok | HMAC-SHA256 | `Signature tidak valid.` |

### 2.3 Format Response Standar

Sukses:
```json
{ "success": true, "...": "..." }
```

Gagal (bisnis / database):
```json
{ "success": false, "message": "<pesan>" }
```

Gagal (autentikasi, HTTP 401):
```json
{ "success": false, "message": "Signature tidak valid." }
```

---

## 3. Daftar Endpoint

| No | Method | Endpoint | Deskripsi |
|----|--------|----------|-----------|
| 1  | `GET`  | `/core/health` | Health check service |
| 2  | `GET`  | `/core/debtor-history/{nik}` | Riwayat kredit debitur berdasarkan NIK |
| 3  | `GET`  | `/core/debtor-details/{nik}` | Detail data debitur berdasarkan NIK |
| 4  | `POST` | `/core/post-loan` | Posting data pinjaman (nasabah + kredit + agunan) ke Core |

> Endpoint juga dapat diakses via prefix alternatif `/core-api/core/...` sesuai konfigurasi mapping controller.

---

## 4. Detail Endpoint

### 4.1 `GET /core/health`

> Mengecek apakah service IBS LOS 4 Core berjalan.

**Response — 200 OK**
```json
{
  "success": true,
  "message": "OK",
  "service": "ibslos4core"
}
```

---

### 4.2 `GET /core/debtor-history/{nik}`

> Mengembalikan riwayat kredit historis debitur berdasarkan NIK.

**Path Parameter**

| Param | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `nik` | string | Ya | Nomor Induk Kependudukan debitur |

**Response — Sukses (HTTP 200)**
```json
{
  "success": true,
  "nik": "3201010101010001",
  "nama": "BUDI SANTOSO",
  "summary": {
    "total_pinjaman": 2,
    "total_plafon": 50000000,
    "total_bakidebet": 12000000,
    "worst_kolektibilitas": 1,
    "status_blacklist": "TIDAK"
  },
  "history": [
    {
      "no_rekening": "0012345678",
      "produk": "KUR",
      "plafon": 25000000,
      "bakidebet": 6000000,
      "status": "AKTIF",
      "tgl_mulai": "2023-01-15",
      "tgl_selesai": null,
      "kolektibilitas": "1",
      "catatan": "Pembayaran Lancar"
    }
  ]
}
```

| Field | Tipe | Keterangan |
|-------|------|------------|
| `success` | boolean | Status keberhasilan |
| `nik` | string | NIK yang diminta |
| `nama` | string | Nama debitur |
| `summary.total_pinjaman` | number | Jumlah kredit |
| `summary.total_plafon` | number | Total plafon |
| `summary.total_bakidebet` | number | Total baki debet |
| `summary.worst_kolektibilitas` | number | Kolektibilitas terburuk (1–5) |
| `summary.status_blacklist` | string | `YA` / `TIDAK` |
| `history[]` | array | Daftar riwayat kredit (lihat contoh) |

**Response — Data tidak ditemukan / NIK kosong (HTTP 200)**
```json
{ "success": false, "nik": "3201010101010001", "message": "data nasabah tidak ditemukan" }
```

**Response — Gagal koneksi database (HTTP 200)**
```json
{ "success": false, "nik": "3201010101010001", "message": "Koneksi database gagal" }
```

---

### 4.3 `GET /core/debtor-details/{nik}`

> Mengembalikan detail data debitur berdasarkan NIK.

**Path Parameter**

| Param | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `nik` | string | Ya | Nomor Induk Kependudukan debitur |

**Response — Sukses (HTTP 200)**
```json
{
  "success": true,
  "nik": "3201010101010001",
  "details": {
    "nama": "BUDI SANTOSO",
    "tempat_lahir": "BANDUNG",
    "tanggal_lahir": "1985-05-10",
    "nama_ibu": "SITI AMINAH",
    "no_hp": "081234567890",
    "alamat": "JL. MERDEKA NO. 1",
    "npwp": "091234567890000",
    "provinsi": "JAWA BARAT",
    "kota": "KOTA BANDUNG",
    "kecamatan": "COBLONG",
    "kelurahan": "DAGO",
    "kodepos": "40135",
    "pekerjaan": "WIRASWASTA",
    "nama_perusahaan": "CV MAJU JAYA",
    "jabatan": "PEMILIK",
    "alamat_kantor": "JL. ASIA AFRIKA NO. 10",
    "telepon_kantor": "022123456",
    "no_cif": "0001234567",
    "nik": "3201010101010001",
    "nama_pasangan": "DEWI LESTARI",
    "nik_pasangan": "3201010101010002",
    "pekerjaan_pasangan": "IBU RUMAH TANGGA",
    "jumlah_tanggungan": 2,
    "pinjaman_ke": 3,
    "pejabat_json": [
      {
        "nama_pejabat": "BUDI SANTOSO",
        "tempatlahir_pejabat": "BANDUNG",
        "tgllahir_pejabat": "1985-05-10",
        "alamat_pejabat": "JL. MERDEKA NO. 1",
        "no_hp_pejabat": "081234567890"
      }
    ]
  }
}
```

**Response — Data tidak ditemukan / NIK kosong (HTTP 200)**
```json
{ "success": false, "nik": "3201010101010001", "message": "ID tidak ditemukan" }
```

---

### 4.4 `POST /core/post-loan`

> Memposting data pinjaman ke Core Banking System. Dalam satu transaksi menyimpan **nasabah** (jika baru), **kredit**, dan **agunan**. Menghasilkan `no_rekening`, `no_cif`, dan `agunan_id` secara otomatis bila tidak dikirim.

**Request Body**
```json
{
  "status_nasabah": "BARU",
  "product_id": "01",
  "unit_code": "001",
  "tgltrans": "2026-07-16",
  "userid": "TELLER01",
  "tujuan_kredit": "Modal Kerja",

  "jenis_debitur": "1",
  "nama": "BUDI SANTOSO",
  "nik": "3201010101010001",
  "no_hp": "081234567890",
  "tempat_lahir": "BANDUNG",
  "tanggal_lahir": "1985-05-10",
  "nama_ibu": "SITI AMINAH",
  "jumlah_tanggungan": 2,
  "alamat": "JL. MERDEKA NO. 1",
  "kelurahan": "DAGO",
  "kecamatan": "COBLONG",
  "kota": "KOTA BANDUNG",
  "provinsi": "JAWA BARAT",
  "kodepos": "40135",
  "alamat_domisili": "JL. MERDEKA NO. 1",
  "nama_perusahaan": "CV MAJU JAYA",
  "alamat_kantor": "JL. ASIA AFRIKA NO. 10",
  "telepon_kantor": "022123456",
  "penghasilan": 8000000,
  "pengeluaran": 4000000,

  "nama_pasangan": "DEWI LESTARI",
  "nik_pasangan": "3201010101010002",
  "pekerjaan_pasangan": "IBU RUMAH TANGGA",
  "nama_darurat": "AGUS",
  "no_hp_darurat": "081200000000",
  "hubungan_darurat": "SAUDARA",

  "plafon": 25000000,
  "tenor": 12,
  "suku_bunga": 18.0,
  "catatan": "Pengajuan kredit modal kerja",

  "badan_usaha": "PERSEORANGAN",
  "bidang_usaha": "PERDAGANGAN ECERAN",
  "nama_lengkap_pemegang_usaha": "BUDI SANTOSO",
  "nik_pemegang_usaha": "3201010101010001",
  "tgl_akte_awal": "2020-01-01",
  "no_akte_awal": "AK-001",
  "tgl_akte_akhir": "2025-01-01",
  "no_akte_akhir": "AK-002",

  "pejabat_json": [
    { "nama_pejabat": "BUDI SANTOSO", "tempatlahir_pejabat": "BANDUNG", "tgllahir_pejabat": "1985-05-10", "alamat_pejabat": "JL. MERDEKA NO. 1", "no_hp_pejabat": "081234567890" }
  ],

  "agunan_json": [
    { "deskripsi": "TANAH & BANGUNAN SHM 123", "kode_jenis_agunan": "1", "nilai": 100000000, "persen_dijaminkan_detail": 80 }
  ]
}
```

**Field Utama**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `status_nasabah` | string | Kondisional | `BARU` → generate CIF & insert nasabah baru. Kosong + tanpa CIF juga dianggap baru |
| `product_id` (alias `produk_id`) | string | Ya | Kode produk. Default `00` bila kosong |
| `unit_code` | string | Ya | Kode kantor. Default `000` bila kosong |
| `tgltrans` (alias `tanggal_transaksi`) | string (date) | Tidak | Default tanggal hari ini |
| `userid` (alias `user_id`, `userName`) | string | Tidak | User pembuat |
| `no_cif` (alias `cif`, `nasabah_id`, `noCif`) | string | Kondisional | Wajib untuk nasabah lama; di-generate jika `BARU` |
| `tujuan_kredit` | string | Tidak | Dipetakan ke kode jenis penggunaan (fuzzy lookup) |
| `plafon` | number | Ya | Jumlah pinjaman |
| `tenor` | number | Ya | Jangka waktu angsuran (bulan) |
| `suku_bunga` | number | Ya | Suku bunga per tahun (%) |
| `pejabat_json` | array/string | Tidak | Maks. 2 pejabat (boleh array atau string JSON) |
| `agunan_json` | array/string | Tidak | Daftar agunan; default "KREDIT TANPA AGUNAN" bila kosong |

> Kolom referensi (`kelurahan`, `kecamatan`, `kota`, `provinsi`, `badan_usaha`, `bidang_usaha`, `tujuan_kredit`) dikirim sebagai **deskripsi** dan otomatis di-resolve ke kode master oleh sistem (jika sudah berupa kode, dipakai apa adanya).

**Item `agunan_json[]`**

| Field | Tipe | Keterangan |
|-------|------|------------|
| `deskripsi` | string | Deskripsi ringkas agunan |
| `kode_jenis_agunan` | string | Kode jenis agunan (atau kirim `jenis_agunan` deskriptif untuk di-resolve) |
| `nilai` | number | Nilai agunan / taksasi |
| `persen_dijaminkan_detail` | number | Persentase dijaminkan (default dari master jenis agunan) |

**Response — Sukses (HTTP 200)**
```json
{
  "success": true,
  "no_cif": "0001234567",
  "agunan_id": "AGU-2026-000123",
  "no_rekening": "0012345678",
  "message": "Loan posted successfully to Core Banking System"
}
```

**Response — Gagal insert database (HTTP 200)**
```json
{
  "success": false,
  "no_cif": "0001234567",
  "agunan_id": "AGU-2026-000123",
  "no_rekening": "0012345678",
  "message": "Gagal insert data ke database"
}
```

**Response — Error internal (HTTP 200)**
```json
{
  "success": false,
  "no_cif": "",
  "agunan_id": "",
  "no_rekening": "",
  "message": "Terjadi kesalahan internal saat memproses post loan"
}
```

> Pada request lokal, pesan error dapat menyertakan detail penyebab (`: <root cause>`) untuk memudahkan debugging.

---

## 5. Kode Status & Pesan

Sistem tidak memakai `responseCode` numerik; status ditentukan oleh field `success` + HTTP status.

| HTTP | success | Konteks | Contoh pesan |
|------|---------|---------|--------------|
| 200 | `true`  | Operasi berhasil | `Loan posted successfully to Core Banking System` |
| 200 | `false` | Data tidak ditemukan | `data nasabah tidak ditemukan` · `ID tidak ditemukan` |
| 200 | `false` | Gagal database | `Koneksi database gagal` · `Gagal insert data ke database` |
| 200 | `false` | Error tak terduga | `Terjadi kesalahan internal saat memproses post loan` |
| 401 | `false` | Autentikasi signature gagal | `Signature tidak valid.` · `Request expired.` · `Replay detected.` · `Client tidak valid.` · `Missing security headers.` |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 16 Juli 2026 | | Dokumen dibuat berdasarkan implementasi `CoreController` & `CoreService` |

---

*[← Kembali ke IBS LOS BackEndCore](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
