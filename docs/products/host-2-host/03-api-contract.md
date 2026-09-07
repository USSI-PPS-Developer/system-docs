# 🔌 API Contract — Host 2 Host

> Kontrak API (request/response) untuk produk **Host 2 Host**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | Host 2 Host     |
| Jenis Dokumen     | API Contract         |
| Versi             | 1.1.0               |
| Tanggal Dibuat    | 16 Juli 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Informasi Umum

| Item | Nilai |
|------|-------|
| Base URL (Dev)  | `https://dev.example.com` |
| Base URL (Prod) | `https://api.example.com` |
| Prefix API | `/api/v1` (bisnis) · `/api/monitoring` (monitoring) |
| Format | JSON (UTF-8) |
| Autentikasi | JWT Bearer (HS256, per-`client_id`) + header `X-CLIENT-ID` saat login/refresh |
| Dokumentasi interaktif | `/swagger-ui.html` |
| Health probe | `GET /actuator/health` (anonim: status saja; dengan `X-MONITORING-KEY`: + blok `components`) |

## 2. Konvensi

### 2.1 Header Standar

| Header | Wajib | Berlaku pada | Contoh |
|--------|-------|--------------|--------|
| `Authorization` | Ya (kecuali login) | Seluruh endpoint bisnis | `Bearer eyJhbGciOiJIUzI1NiI...` |
| `Content-Type` | Ya (untuk body) | POST/PUT | `application/json` |
| `X-CLIENT-ID` | Ya | `/login`, `/refresh` | `bpr-abc` |
| `X-IDEMPOTENCY-KEY` | Ya | Login, refresh, & seluruh endpoint transaksional/CRUD POST | `7f9e2c30-1b45-4ad0-9c02-123456789abc` (UUID) |
| `X-MONITORING-KEY` | Ya | `/api/monitoring/**` | `<shared-secret>` (atau query `monitoringKey`) |

> **Catatan idempotency:** endpoint transaksional memakai reservasi atomik (`SET NX`). Retry
> dengan key yang sama sebelum TTL habis dibalas `409` (`93`). Endpoint GET WNA, Rekap,
> produk deposito *special rate*, Monitoring, dan Default tidak memerlukan `X-IDEMPOTENCY-KEY`.

### 2.2 Format Response Standar
Seluruh endpoint bisnis mengembalikan envelope `ApiResponse<T>`:

```json
{
  "responseCode": "00",
  "responseData": {},
  "responseMessage": "Success"
}
```

| Field | Tipe | Keterangan |
|-------|------|------------|
| `responseCode` | string | Kode hasil (lihat §6). `"00"` = sukses. |
| `responseData` | object/array/null | Payload hasil (bentuk sesuai endpoint). |
| `responseMessage` | string | Pesan ringkas (aman ditampilkan; error internal digeneralisasi). |

### 2.3 Autentikasi & Token
- **Login** memerlukan `X-CLIENT-ID`; secret & masa berlaku token diambil per klien dari
  `api_auth_config`. Password dikirim klien dalam bentuk **SHA1** (dicocokkan DB-side).
- Token JWT (HS256) membawa klaim: `sub` (username), `user_id`, `client_id`, `kode_kantor`,
  `token_use` (`access`/`refresh`), `iat`, `exp`. Token bersifat opaque bagi klien.
- **Refresh** hanya menerima token dengan `token_use=refresh` yang masih tersimpan (belum
  dicabut/rotasi). Setiap refresh **merotasi** (token lama dihapus, token baru diterbitkan).
- Endpoint bisnis menegakkan `userId` di body == klaim `user_id` token, dan **tenant isolation**
  berdasarkan klaim `kode_kantor` (kecuali pengguna HQ).

## 3. Daftar Endpoint

### 3.1 Autentikasi Pengguna — `/api/v1/autentikasi`
| No | Method | Endpoint | Deskripsi |
|----|--------|----------|-----------|
| 1 | `POST` | `/login` | Login & terbitkan access + refresh token. |
| 2 | `POST` | `/refresh` | Rotasi token (refresh token di header). |
| 3 | `POST` | `/logout` | Cabut refresh token. |
| 4 | `POST` | `/ganti-password` | Ganti password sendiri. |
| 5 | `PUT`  | `/update-user` | Update profil sendiri. |

### 3.2 Nasabah — `/api/v1/nasabah`
| No | Method | Endpoint | Deskripsi |
|----|--------|----------|-----------|
| 6 | `POST` | `/cekNik` | Validasi keberadaan nasabah via NIK. |
| 7 | `POST` | `/registrasi` | Registrasi nasabah (CIF) baru. |
| 8 | `POST` | `/update` | Update data nasabah. |
| 9 | `POST` | `/portofolio` | Portofolio nasabah (TAB/DEP/KRE). |
| 10 | `POST` | `/cek-identitas` | Validasi identitas nasabah. |
| 11 | `POST` | `/wna/cek-identitas` | Validasi identitas nasabah WNA. |
| 12 | `GET`  | `/wna/{nasabahId}` | Detail nasabah WNA. |
| 13 | `GET`  | `/wna/list` | Daftar nasabah WNA (paged, office-scoped). |
| 13a | `POST` | `/upload-media` | Upload foto & tanda tangan nasabah (base64 → LONGBLOB). |

### 3.3 Tabungan — `/api/v1/tabungan`
| No | Method | Endpoint | Deskripsi |
|----|--------|----------|-----------|
| 14 | `POST` | `/registrasi` | Registrasi rekening tabungan. |
| 15 | `POST` | `/pencarian` | Pencarian data tabungan. |
| 16 | `POST` | `/saldo` | Inquiry saldo tabungan. |
| 17 | `POST` | `/list` | Daftar mutasi rekening tabungan. |
| 17a | `POST` | `/update-saldo-minimum` | Ubah saldo minimum rekening existing (campaign bebas saldo minimum / kembali ke default produk). |

### 3.4 Pinjaman/Kredit — `/api/v1/pinjaman`
| No | Method | Endpoint | Deskripsi |
|----|--------|----------|-----------|
| 18 | `POST` | `/registrasi` | Registrasi kredit baru. |
| 19 | `POST` | `/jadwal` | Jadwal angsuran kredit. |
| 20 | `POST` | `/tagihan` | Tagihan kredit. |
| 21 | `POST` | `/saldo` | Saldo kredit. |
| 22 | `POST` | `/list` | Daftar kredit. |

### 3.5 Deposito — `/api/v1/deposito`
| No | Method | Endpoint | Deskripsi |
|----|--------|----------|-----------|
| 23 | `POST` | `/registrasi` | Registrasi deposito baru (mendukung produk *special rate*). |
| 24 | `POST` | `/saldo` | Inquiry saldo deposito. |
| 25 | `GET`  | `/produk-spesial-rate` | Daftar produk deposito ber-*custom rate* (`is_custom_rate=1`). |

### 3.6 Transaksi — `/api/v1/transaksi`
| No | Method | Endpoint | Deskripsi |
|----|--------|----------|-----------|
| 26 | `POST` | `/tipe` | Daftar tipe integrasi transaksi. |
| 27 | `POST` | `/bindingBank` | Daftar kode binding bank. |
| 28 | `POST` | `/tabungan` | Transaksi tabungan (setor/tarik/transfer). |
| 29 | `POST` | `/pencairanPinjaman` | Pencairan pinjaman. |
| 30 | `POST` | `/angsuranPinjaman` | Angsuran pinjaman. |
| 31 | `POST` | `/setoranDeposito` | Setoran deposito. |
| 32 | `POST` | `/status` | Cek status transaksi. |
| 33 | `POST` | `/reversal` | Reversal transaksi. |

### 3.7 Rekap (HQ/admin) — `/api/v1/rekap`
| No | Method | Endpoint | Deskripsi |
|----|--------|----------|-----------|
| 34 | `GET` | `/setoran-tab-marketing` | Rekap setoran tabungan per marketing. |
| 35 | `GET` | `/penarikan-tab-marketing` | Rekap penarikan tabungan per marketing. |

### 3.8 Monitoring — `/api/monitoring/logs`
| No | Method | Endpoint | Deskripsi |
|----|--------|----------|-----------|
| 36 | `GET` | `` (base) | Daftar log API (paged, filter). |
| 37 | `GET` | `/{id}` | Detail log API. |
| 38 | `GET` | `/export` | Ekspor log API ke CSV. |

### 3.9 Default
| No | Method | Endpoint | Deskripsi |
|----|--------|----------|-----------|
| 39 | `GET` | `/` | Health/greeting service. |

---

## 4. Detail Endpoint

### 4.1 `POST /api/v1/autentikasi/login`

> Autentikasi pengguna & menerbitkan token. Header wajib: `X-CLIENT-ID`, `X-IDEMPOTENCY-KEY`.
> **Tanpa** `Authorization`.

**Request Body**
```json
{
  "userName": "teller01",
  "password": "5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8"
}
```

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `userName` | string | Ya | Username pengguna. |
| `password` | string | Ya | **SHA1(password)** (klien meng-hash sebelum kirim). |

**Response — 200 OK**
```json
{
  "responseCode": "00",
  "responseData": {
    "user": {
      "userName": "teller01",
      "unitKerja": "001",
      "kodeKantor": "001",
      "namaKantor": "KANTOR PUSAT",
      "userId": "U001",
      "namaLengkap": "Teller Satu",
      "kodePerkKas": "K01"
    },
    "access_token": "eyJhbGciOiJIUzI1NiI...",
    "refresh_token": "eyJhbGciOiJIUzI1NiI..."
  },
  "responseMessage": "Login sukses."
}
```

**Kemungkinan Error**
| HTTP | responseCode | Arti |
|------|--------------|------|
| 200 | 97 | `X-CLIENT-ID` / `X-IDEMPOTENCY-KEY` tidak ada di header. |
| 200 | 92 | `X-CLIENT-ID` tidak terdaftar/aktif. |
| 200 | 01 | Username atau password salah. |
| 200/429 | 94 | Terlalu banyak percobaan login / request. |
| 409 | 93 | Request duplikat (idempotency). |

---

### 4.2 `POST /api/v1/autentikasi/refresh`

> Merotasi token. Refresh token dikirim di `Authorization: Bearer <refresh_token>`. Header
> wajib: `X-CLIENT-ID`, `X-IDEMPOTENCY-KEY`. Tanpa body.

**Response — 200 OK**
```json
{
  "responseCode": "00",
  "responseData": {
    "access_token": "eyJ...baru",
    "refresh_token": "eyJ...baru"
  },
  "responseMessage": "Token berhasil diperbarui"
}
```

**Kemungkinan Error**
| HTTP | responseCode | Arti |
|------|--------------|------|
| 401 | 99 | Refresh token tidak ada di header. |
| 401 | 98 | Token tidak valid/kedaluwarsa, bukan refresh token, atau sudah dicabut. |
| 200 | 92 / 97 | `X-CLIENT-ID` tidak terdaftar / header tidak lengkap. |
| 409 | 93 | Request duplikat. |
| 429 | 94 | Terlalu banyak request. |

---

### 4.3 `POST /api/v1/autentikasi/logout`

**Request Body**
```json
{ "refresh_token": "eyJhbGciOiJIUzI1NiI..." }
```

**Response — 200 OK**
```json
{ "responseCode": "00", "responseData": null, "responseMessage": "Logout berhasil. Refresh token dihapus." }
```

---

### 4.4 `POST /api/v1/autentikasi/ganti-password`

> Header wajib: `Authorization`. Hanya boleh mengganti password milik sendiri.

**Request Body**
```json
{
  "userId": "U001",
  "passwordLama": "old-plain",
  "passwordBaru": "new-plain",
  "konfirmasiPasswordBaru": "new-plain"
}
```

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `userId` | string | Ya | Harus == `user_id` pada token. |
| `passwordLama` | string | Ya | Password lama (dicocokkan DB-side `SHA1()`). |
| `passwordBaru` | string | Ya | Password baru. |
| `konfirmasiPasswordBaru` | string | Ya | Harus sama dengan `passwordBaru`. |

**Kemungkinan Error:** `98` (token invalid), `99` (userId ≠ token), `02` (konfirmasi tidak sama),
`01` (password lama salah).

---

### 4.5 `PUT /api/v1/autentikasi/update-user`

> Header wajib: `Authorization`. Hanya boleh update record milik sendiri.

**Request Body**
```json
{ "userId": "U001", "userName": "teller01", "namaLengkap": "Teller Satu", "unitKerja": "001" }
```

Semua field `@NotBlank`. Error: `98`, `99`, `01` (user tidak ditemukan).

---

### 4.6 `POST /api/v1/nasabah/registrasi`

> Header wajib: `Authorization`, `X-IDEMPOTENCY-KEY`. `userId==token` + `assertOffice(kodeKantor)`.

**Request Body (ringkas — seluruh field `@NotBlank` kecuali dinyatakan)**
```json
{
  "jenisDebitur": "1",
  "namaNasabah": "Budi Santoso",
  "alamat": "Jl. Merdeka 1",
  "hp": "081234567890",
  "jenisKelamin": "L",
  "tempatlahir": "Bandung",
  "tgllahir": "1990-01-31",
  "noId": "3273010101900001",
  "kodeAgama": "1",
  "namaIbuKandung": "Siti",
  "kodeKantor": "001",
  "alamatKtp": "Jl. Merdeka 1",
  "propinsi": "32", "kotaKab": "3273", "kecamatan": "327301", "desa": "3273011001",
  "kodepos": "40111",
  "email": "budi@example.com",
  "statusMarital": "1",
  "kodeGroup1": "G1", "kodeGroup2": "G2", "kodeGroup3": "G3",
  "npwp": "091234567890000",
  "mataUang": "IDR",
  "statusTempatTinggal": "MILIK SENDIRI",
  "alamatSurat": "Jl. Merdeka 1",
  "kodeSumberPenghasilan": "1",
  "kodePemasukanPerBulan": "2",
  "namaKantor": "PT ABC",
  "alamatKantor": "Jl. Industri 5",
  "userId": "U001"
}
```

| Field kunci | Tipe | Validasi |
|-------------|------|----------|
| `jenisKelamin` | string | `^[LP]$` |
| `noId` | string | `^\d{16}$` (16 digit) |
| `tgllahir` | date | `yyyy-MM-dd`, `@NotNull` |
| `email` | string | format email valid |
| `tempatlahir` | string | ≤ 100 karakter |
| `kodepos` | string | ≤ 5 karakter |
| `kodeGroup1/2/3`, `npwp`, `namaIbuKandung` | string | dibatasi panjang (5/20/100) |
| `namaKantor`, `alamatKantor` | string | opsional |

**Response — 200 OK**
```json
{ "responseCode": "00", "responseData": { "nasabahId": "N0001" }, "responseMessage": "..." }
```

> `POST /update` memakai `UpdateNasabahRequestDTO` (sama seperti registrasi + `nasabahId`
> di depan; `tempatlahir` maks 50). Guard: `assertNasabahOffice(nasabahId)` + `assertOffice(kodeKantor)`.

---

### 4.7 `POST /api/v1/nasabah/cekNik` · `/cek-identitas` · `/wna/cek-identitas`

| Endpoint | Request | Field |
|----------|---------|-------|
| `/cekNik` | `CheckNikRequestDTO` | `noId` (NotBlank), `userId` (NotBlank) |
| `/cek-identitas` & `/wna/cek-identitas` | `CheckIdentitasRequestDTO` | `jenisDebitur`, `nomorIdentitas` (NotBlank), `userId` (NotBlank) |

Guard: `assertNasabahOfficeByNoId` / `assertNasabahOfficeByIdentity`. Response: projeksi/DTO
data nasabah (`CheckNikProjection` / `CheckIdentitasProjection` / `CheckIdentitasWnaResponseDTO`
— WNA memuat `photo` & `tandatangan` base64).

---

### 4.8 `POST /api/v1/nasabah/portofolio`

**Request Body**
```json
{ "nasabahId": "N0001", "tglTrans": "2026-07-16", "userId": "U001", "tipeModul": "TAB" }
```
`tipeModul` ∈ `DEP|TAB|KRE`. Guard: `assertNasabahOffice(nasabahId)`.

---

### 4.9 `GET /api/v1/nasabah/wna/{nasabahId}` · `GET /api/v1/nasabah/wna/list`

- **Detail:** path `nasabahId`; header `Authorization`; response `NasabahWnaDetailResponseDTO`
  (termasuk `photo`, `tandatangan` base64). Guard: `assertNasabahOffice(nasabahId)`.
- **List:** query `startDate`, `endDate` (ISO date), `page` (default 0), `size` (default 20);
  response `Page<NasabahWnaListResponseDTO>` (tanpa foto/ttd). Scope: `officeScopeForList(token)`
  (kantor sendiri; HQ = semua; token tanpa office = ditolak). *(Tidak perlu idempotency.)*

---

### 4.9a `POST /api/v1/nasabah/upload-media`

Menyimpan **foto** dan/atau **tanda tangan** nasabah existing (by `nasabahId`) ke kolom LONGBLOB
legacy core. Payload dikirim sebagai base64.

**Request Body**
```json
{ "nasabahId": "N0001", "photo": "<base64>", "tandatangan": "<base64>", "userId": "U001" }
```

- `photo` dan `tandatangan` **opsional secara individual, tetapi minimal salah satu harus diisi**
  (jika keduanya kosong → `95` / `BUSINESS_EXCEPTION`, "Minimal salah satu dari photo atau tandatangan harus diisi").
- Field yang **tidak dikirim tidak menimpa** data existing (upload foto saja mempertahankan ttd lama).
- base64 tidak valid → `95` / `BUSINESS_EXCEPTION` ("Format base64 tidak valid untuk photo|tandatangan").
- Ukuran maksimal **2 MB** per media (photo & tandatangan); lebih besar → `02` / `VALIDATION_ERROR`.
- Header: `Authorization` (Bearer), `X-IDEMPOTENCY-KEY` (wajib). Rate limit 5/60s.
- Guard: `assertNasabahOffice(nasabahId)` — office-scoped (media KYC bersifat sensitif).
- **Response** `ApiResponse<{ nasabahId }>`, kode `00` "Upload photo & tanda tangan nasabah sukses".

> Foto/ttd dibaca kembali dalam bentuk base64 via `GET /wna/{nasabahId}` (`NasabahWnaDetailResponseDTO`).

---

### 4.10 `POST /api/v1/tabungan/*`

| Endpoint | Request DTO | Field | Guard |
|----------|-------------|-------|-------|
| `/registrasi` | `CreateTabungRequestDTO` | `kodeKantor`, `userId`, `nasabahId`, `kodeProduk` (semua NotBlank) | `assertOffice(kodeKantor)` |
| `/pencarian` | `InquiryTabungRequestDTO` | `kodeKantor`, `userId`, `search` | `assertOffice(kodeKantor)` |
| `/saldo` | `InquirySaldoRequestDTO` | `tglTrans`, `noRekening`, `userId` | `assertTabungOffice(noRekening)` |
| `/list` | `ListTabungRequestDTO` | `kodeKantor`, `noRekening`, `tglAwal`, `tglAkhir` (date), `userId` | `assertOffice(kodeKantor)` |
| `/update-saldo-minimum` | `UpdateSaldoMinimumRequestDTO` | `noRekening`, `aksi`, `kodeCampaign?`, `alasan`, `userId` | allowlist `tabung.minimum-editor-user-ids` + `assertTabungOffice(noRekening)` |

> **Registrasi & saldo minimum.** `/registrasi` **tidak berubah** kontraknya. Nilai
> `tabung.minimum` diambil dari campaign yang berlaku untuk kombinasi `kodeProduk` + `kodeKantor`
> pada tanggal registrasi (`api_tab_campaign`, mis. campaign bebas saldo minimum → 0); bila tidak ada
> campaign aktif dipakai `tab_produk.saldo_minimum_default`. Campaign khusus kantor menang atas
> campaign semua-kantor (`kode_kantor` NULL). Konsumen **tidak** mengirim flag/nominal apa pun.

**Contoh Response `/saldo`**
```json
{
  "responseCode": "00",
  "responseData": [{
    "noRekening": "0010001", "namaNasabah": "Budi Santoso", "deskripsiProduk": "TABUNGAN UMUM",
    "tglRegister": "2025-01-01", "sukuBunga": 3.0, "kodeProduk": "TAB01", "status": 1,
    "saldoAkhir": 1500000, "saldoBlokir": 0, "saldoMinimum": 50000, "saldoEfektif": 1450000
  }],
  "responseMessage": "..."
}
```

---

### 4.10a `POST /api/v1/tabungan/update-saldo-minimum`

Mengubah **saldo minimum rekening tabungan existing** — dipakai untuk campaign bebas saldo minimum
dan untuk mengembalikannya ke default produk setelah campaign selesai.

**Request Body**
```json
{
  "noRekening": "0010001",
  "aksi": "CAMPAIGN",
  "kodeCampaign": "CMP-NOMIN-2026",
  "alasan": "Campaign bebas saldo minimum 2026",
  "userId": "199"
}
```

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| `noRekening` | string | ✅ | Rekening tabungan yang diubah. |
| `aksi` | string | ✅ | `CAMPAIGN` (nilai dari master campaign) atau `DEFAULT_PRODUK` (kembali ke `tab_produk.saldo_minimum_default`). Nilai lain → `02`. |
| `kodeCampaign` | string (≤20) | ⬜ | **Wajib bila `aksi=CAMPAIGN`**; diabaikan bila `DEFAULT_PRODUK`. |
| `alasan` | string (≤255) | ✅ | Ikut direkam pada jejak audit. |
| `userId` | string | ✅ | Harus sama dengan `user_id` pada token. |

> ⚠️ **Tidak ada field nominal.** Nilai saldo minimum selalu diturunkan sistem dari master campaign
> atau default produk, sehingga endpoint ini **tidak dapat** dipakai menetapkan angka sembarang —
> hanya mendaftarkan rekening ke campaign yang sudah disetujui bank, atau mengembalikan default.

**Header:** `Authorization` (Bearer access token), `X-IDEMPOTENCY-KEY` (wajib). Rate limit 5/60s.

**Otorisasi:** `user_id` token harus terdaftar pada allowlist `tabung.minimum-editor-user-ids`
(kosong = semua ditolak) **dan** rekening harus milik kantor token (`assertTabungOffice`).
Berbeda dengan backoffice CBS, alur ini **tanpa maker-checker** (keputusan BPR); kontrol
penggantinya adalah allowlist di atas + jejak audit di bawah.

**Response `00`**
```json
{
  "responseCode": "00",
  "responseData": {
    "noRekening": "0010001",
    "kodeCampaign": "CMP-NOMIN-2026",
    "minimumLama": 50000,
    "minimumBaru": 0,
    "berubah": true
  },
  "responseMessage": "Saldo minimum rekening tabungan berhasil diubah"
}
```

- `berubah = false` → nilai lama sudah sama dengan nilai baru: **tidak ada perubahan dan tidak ada
  baris audit** (aman untuk retry), pesan "Saldo minimum rekening tabungan sudah sesuai, tidak ada perubahan".
- Setiap perubahan menulis satu baris `api_tab_minimum_change` (nilai asal, nilai baru, aksi,
  campaign, alasan, pelaku, waktu, idempotency key) **dalam transaksi yang sama** dengan UPDATE-nya.

**Kode error khusus**

| Kode | HTTP | Kondisi |
|------|------|---------|
| `02` | 400 | `aksi` di luar `CAMPAIGN`/`DEFAULT_PRODUK`, `alasan`/`noRekening` kosong, `kodeCampaign` > 20 karakter. |
| `95` | 400 | "Rekening tabungan tidak ditemukan" · "Kode campaign harus diisi untuk aksi CAMPAIGN" · "Campaign tidak ditemukan" · "Campaign tidak aktif" · "Campaign di luar periode berlaku" · "Campaign tidak berlaku untuk produk rekening ini" · "Campaign tidak berlaku untuk kantor rekening ini" · "Setting produk tabungan tidak ditemukan". Rekening **tidak** diubah. |
| `99` | 403 | `userId` ≠ `user_id` token, **atau** user tidak terdaftar pada `tabung.minimum-editor-user-ids` ("User tidak berwenang mengubah saldo minimum"), **atau** rekening milik kantor lain. |
| `93` | 409 | `X-IDEMPOTENCY-KEY` sudah pernah dipakai. |
| `94` | 429 | Melebihi 5 request / 60 detik. |

---

### 4.11 `POST /api/v1/pinjaman/*` · `GET /api/v1/pinjaman/loan-style`

| Endpoint | Request DTO | Field kunci | Guard |
|----------|-------------|-------------|-------|
| `GET /loan-style` | — (`Authorization` + query opsional `kodeProduk`) | — | — (tabel referensi global, tanpa tenant guard) |
| `/registrasi` | `CreateKreditRequestDTO` | `kodeKantor`,`userId`,`nasabahId`,`tglRealisasi`,`noSpk`,`loanStyleId`(opsional — catalog `api_loan_style`, lihat §4.11.1) — `kodeProduk`,`jmlPinjaman`,`jmlAngsuran`,`satuanWaktuAngsuran`(`[HMB]`),`typeKredit`(`100/200/300/310/350/700/710`),`sukuBungaPerTahun` wajib **hanya** bila `loanStyleId` kosong | `assertOffice(kodeKantor)` |
| `/jadwal` | `InquiryJadwalKreditRequestDTO` | `noRekening`,`userId` | `assertKreditOffice(noRekening)` — response berubah bentuk, lihat §4.11.2 |
| `/tagihan` | `InquiryTagihanKreditRequestDTO` | `noRekening`,`tglTrans`(date),`userId` | `assertKreditOffice(noRekening)` — response berubah bentuk, lihat §4.11.3 |
| `/saldo` | `InquirySaldoRequestDTO` | `tglTrans`,`noRekening`,`userId` | `assertKreditOffice(noRekening)` |
| `/list` | `ListKreditRequestDTO` | `kodeKantor`,`noRekening`,`tglHitung`(date),`userId` | `assertOffice(kodeKantor)` |

**`GET /loan-style` — Response 200 OK**
```json
{
  "responseCode": "00",
  "responseData": [
    {
      "loanStyleId": 1,
      "kodeProduk": "710",
      "namaLoanStyle": "Pinjaman Rp1.000.000 - 1 Bulan",
      "plafond": 1000000.00,
      "tenor": 1,
      "sukuBungaPerTahun": 24.0000,
      "percProvisi": 1.000,
      "percAdm": 0.500,
      "percDenda": 0.300
    }
  ],
  "responseMessage": "Daftar loan style berhasil ditemukan"
}
```

> Endpoint GET ini bersifat referensi (read-only), **tanpa** `X-IDEMPOTENCY-KEY` — sama pola
> dengan `GET /deposito/produk-spesial-rate`. Mengembalikan hanya baris `api_loan_style` yang
> `is_active=1`, terurut `plafond` menaik. Query `kodeProduk` opsional: diisi → filter satu
> produk; kosong/tidak dikirim → seluruh catalog aktif (semua produk). Dipakai M-Pay untuk
> menampilkan pilihan dropdown (termasuk `sukuBungaPerTahun`/`percProvisi`/`percAdm`/`percDenda`
> supaya bunga & biaya bisa ditampilkan ke nasabah sebelum submit) **sebelum** mengirim
> `loanStyleId` terpilih ke `/registrasi` (§4.11.1).

#### 4.11.1 Aturan *loan style* M-Pay (`/registrasi`)

CR BPR — UI M-Pay (aplikasi terpisah, di luar cakupan dokumen ini) mengganti input nominal
pinjaman bebas menjadi **dropdown nominal tetap** (Rp1.000.000 / 2.000.000 / 3.500.000 /
5.000.000 / 7.500.000 / 10.000.000), masing-masing dengan tenor dibatasi **1 atau 3 bulan**.
`/registrasi` menerima field baru **opsional** `loanStyleId` (`Long`) yang merujuk catalog
`api_loan_style`. **Kontrak lama tidak berubah** — endpoint ini juga melayani tipe kredit
non-M-Pay (`typeKredit` 200/300/310/350/700/710), jadi ini bukan perubahan yang breaking.
M-Pay **tidak perlu dan tidak boleh mengirim `kodeProduk`** — kode produk internal ini juga
diturunkan dari catalog, client cukup tahu `loanStyleId` (dari `GET /loan-style`, §4.11). Suku
bunga (`sukuBungaPerTahun`) juga diturunkan dari catalog untuk alasan yang sama.

| Kondisi | `kodeProduk`/`typeKredit`/`jmlPinjaman`/`jmlAngsuran`/`satuanWaktuAngsuran`/`sukuBungaPerTahun` (payload) | Sumber nilai tersimpan |
|---------|---------------------------------------------------------------------|-------------------------|
| **`loanStyleId` diisi** | Diabaikan sepenuhnya (termasuk bila client tetap mengirim salah satunya — tidak divalidasi terhadap catalog, langsung ditimpa) | Diturunkan dari `api_loan_style`: `kode_produk`, `type_kredit`, `plafond`→`jmlPinjaman`, `tenor`→`jmlAngsuran`, `satuanWaktuAngsuran` selalu `"B"`, `suku_bunga_per_tahun`→`sukuBungaPerTahun` |
| **`loanStyleId` kosong** | Wajib diisi client, seperti sebelumnya (termasuk `kodeProduk` dan `sukuBungaPerTahun`) | Dari payload (perilaku tidak berubah) |

Bila `loanStyleId` diisi, registrasi juga menulis **snapshot** biaya pada `kredit` (tidak
diekspos pada response body — `noRekening` tetap satu-satunya field response):
`provisi = plafond × perc_provisi / 100`, `adm_lainnya = plafond × perc_adm / 100`,
`perc_denda` = salinan `api_loan_style.perc_denda` (0,3%/hari) pada baris catalog.

> ⚠️ **Denda keterlambatan belum diterapkan.** `perc_denda` pada perubahan ini **hanya
> disimpan** sebagai data (`api_loan_style.perc_denda` & snapshot `kredit.perc_denda`); alur
> angsuran/pembayaran **belum** menghitung atau memposting denda. Metode angsuran tetap
> **flat** (pokok+bunga tetap per periode), tanpa penalti pelunasan dipercepat.
>
> ⚠️ **Catalog dengan suku bunga belum di-backfill ditolak.** `api_loan_style.suku_bunga_per_tahun`
> ditambahkan lewat `ALTER ... DEFAULT 0` setelah tabel sudah punya baris — baris yang belum
> di-`UPDATE` manual punya `suku_bunga_per_tahun = 0`. `loanStyleId` yang merujuk baris seperti
> itu ditolak (kode `95`, "Suku bunga loan style belum diisi") supaya tidak ada kredit
> ter-registrasi dengan bunga 0% secara tidak sengaja.

**Kode error khusus (`loanStyleId`)**

| Kode | HTTP | Kondisi |
|------|------|---------|
| `95` | 400 | "Loan style tidak ditemukan" · "Loan style sudah tidak aktif" · "Tenor loan style tidak valid: {n}" · "Suku bunga loan style belum diisi" · (jalur `loanStyleId` kosong) "Kode produk harus diisi" · "Tipe kredit harus diisi" · "Jumlah pinjaman harus diisi" · "Jumlah angsuran harus diisi" · "Satuan waktu angsuran harus diisi" · "Suku bunga pinjaman pertahun diisi". Kredit **tidak** dibuat. |

#### 4.11.2 Bentuk response `/jadwal` (bug fix — perubahan kontrak)

**Sebelum perubahan ini**, `/jadwal` mengembalikan **seluruh** baris `kretrans` milik
`no_rekening` tanpa filter — termasuk baris pencairan (`my_kode_trans=100`), sehingga item
pertama response sering kali adalah baris pencairan (`angsuranKe: 0`, `pokok` = plafond penuh,
`bunga: 0`) yang **bukan** bagian dari jadwal angsuran, muncul mendahului baris `angsuranKe`
1..N yang sebenarnya.

**Sesudah perubahan ini:** `/jadwal` hanya mengembalikan baris jadwal angsuran murni
(`my_kode_trans=200`) — baris pencairan dan pembayaran aktual tidak pernah ikut. `responseData`
juga berubah bentuk dari **array** menjadi **objek** yang membungkus array tsb plus ringkasan
total:

```json
{
  "responseCode": "00",
  "responseData": {
    "jadwal": [
      { "tglTrans": "2026-09-25", "kodeKantor": "001", "noRekening": "001101000328", "angsuranKe": 1, "pokok": 1166667.00, "bunga": 35000.00, "keterangan": "Tagihan ke 1" },
      { "tglTrans": "2026-10-25", "kodeKantor": "001", "noRekening": "001101000328", "angsuranKe": 2, "pokok": 1166667.00, "bunga": 35000.00, "keterangan": "Tagihan ke 2" },
      { "tglTrans": "2026-11-25", "kodeKantor": "001", "noRekening": "001101000328", "angsuranKe": 3, "pokok": 1166666.00, "bunga": 35000.00, "keterangan": "Tagihan ke 3" }
    ],
    "totalPokok": 3500000.00,
    "totalBunga": 105000.00
  },
  "responseMessage": "Informasi jadwal kredit berhasil ditemukan"
}
```

> ⚠️ **Perubahan kontrak (breaking).** Field di dalam `jadwal[]` tidak berubah nama/tipe —
> hanya dibungkus satu level lebih dalam. Client yang sebelumnya mem-parse `responseData`
> langsung sebagai array **wajib** diperbarui untuk membaca `responseData.jadwal`. `totalPokok`/
> `totalBunga` adalah jumlah `pokok`/`bunga` seluruh baris jadwal (setelah baris pencairan
> dikecualikan) — ditambahkan supaya client tidak perlu menjumlahkan array sendiri.

#### 4.11.3 Bentuk response `/tagihan` (perubahan kontrak breaking — 2026-09-01)

**Sebelum perubahan ini**, `/tagihan` mengembalikan **satu baris** yang cocok persis dengan
`tglTrans` yang diminta, sehingga nasabah yang terlambat lebih dari satu periode tidak pernah
melihat angsuran sebelumnya yang juga masih tertunggak.

**Sesudah perubahan ini:** `/tagihan` mengembalikan **seluruh angsuran belum lunas** yang jatuh
tempo pada atau sebelum `tglTrans`, terurut `angsuranKe` menaik — rekening yang telat satu bulan
akan menampilkan `angsuranKe: 1` **dan** `angsuranKe: 2` sekaligus bila keduanya belum dibayar.
`responseData` berubah bentuk dari **array** menjadi **objek** yang membungkus array tersebut
plus ringkasan total (pola yang sama dengan perubahan `/jadwal` di §4.11.2):

```json
{
  "responseCode": "00",
  "responseData": {
    "tagihan": [
      {
        "tglTrans": "2026-09-25",
        "kodeKantor": "001",
        "noRekening": "001101000328",
        "angsuranKe": 1,
        "pokok": 1166667.00,
        "bunga": 35000.00,
        "denda": 0,
        "totalTagihan": 1201667.00,
        "keterangan": "Tagihan ke 1"
      }
    ],
    "totalPokok": 1166667.00,
    "totalBunga": 35000.00,
    "totalDenda": 0,
    "totalTagihan": 1201667.00
  },
  "responseMessage": "Informasi tagihan kredit berhasil ditemukan"
}
```

> ⚠️ **Perubahan kontrak (breaking).** Request body **tidak berubah**
> (`{ noRekening, tglTrans, userId }`). Client yang sebelumnya mem-parse `responseData`
> langsung sebagai satu baris/array **wajib** diperbarui untuk membaca `responseData.tagihan[]`
> (bisa berisi lebih dari satu baris) beserta `responseData.totalPokok`/`totalBunga`/`totalDenda`/
> `totalTagihan`. Setiap baris `tagihan[]` bertambah field baru `denda` (placeholder `0`,
> lihat §4.11.1) dan `totalTagihan` (= `pokok+bunga+denda`); field lama `tunggakanPokok`/
> `tunggakanBunga` (akumulasi tunggakan level akun) **dihapus** — sudah tidak relevan karena
> setiap baris kini mewakili satu angsuran spesifik yang belum lunas, dan `totalPokok`/
> `totalBunga` level-list di atas menggantikan fungsi ringkasannya.

---

### 4.12 `POST /api/v1/deposito/*` · `GET /api/v1/deposito/produk-spesial-rate`

| Endpoint | Request DTO | Field kunci | Guard |
|----------|-------------|-------------|-------|
| `POST /registrasi` | `CreateDepositoRequestDTO` | `kodeKantor`,`userId`,`nasabahId`,`kodeProduk`,`tglRegistrasi`,`jkw`,`jmlDeposito`,`noAlternatifRek`,`kodeAro`,`perlakuanBunga`,`noRekeningTabungan`(opsional),`sukuBunga`(kondisional — lihat *special rate*) | `assertOffice(kodeKantor)` |
| `POST /saldo` | `InquirySaldoRequestDTO` | `tglTrans`,`noRekening`,`userId` | `assertDepositoOffice(noRekening)` |
| `GET /produk-spesial-rate` | — (hanya `Authorization`) | — | — (tabel referensi global, tanpa tenant guard) |

#### Aturan produk *special rate* (registrasi)

Produk ditandai *special/custom rate* bila `dep_produk.is_custom_rate = 1` (lihat daftarnya
via `GET /produk-spesial-rate`). Perilaku registrasi bercabang berdasarkan flag ini:

| Kondisi | `sukuBunga` (payload) | `jkw` yang diperbolehkan | Sumber suku bunga tersimpan |
|---------|-----------------------|--------------------------|-----------------------------|
| **Special rate** (`is_custom_rate=1`) | **Wajib**, `> 0` | Hanya **1**, **3**, **6**, atau **12** | Dari payload (`sukuBunga`) |
| **Non-special** (`is_custom_rate=0`) | Diabaikan (opsional) | Sesuai aturan produk (`JKW_RULES`) | Default produk (`dep_produk`) |

- `sukuBunga` tidak diisi / `≤ 0` pada produk special rate → **`03`** (`SPECIAL_RATE_REQUIRED`, HTTP 400).
- `jkw` bukan 1/3/6/12 pada produk special rate → **`95`** (`BUSINESS_EXCEPTION`, HTTP 400).
- Field selain suku bunga tetap memakai default produk (mis. `persen_pph`) pada kedua cabang.

**`GET /produk-spesial-rate` — Response 200 OK**
```json
{
  "responseCode": "00",
  "responseData": [
    { "kodeProduk": "399", "deskripsiProduk": "Deposito Lain-lain" }
  ],
  "responseMessage": "Daftar produk deposito spesial rate berhasil ditemukan"
}
```

> Endpoint GET ini bersifat referensi (read-only), **tanpa** `X-IDEMPOTENCY-KEY`. Hanya
> mengembalikan `kodeProduk` + `deskripsiProduk` (flag `is_custom_rate` tidak diekspos).

---

### 4.13 `POST /api/v1/transaksi/tabungan`

> Money-path. Header wajib: `Authorization`, `X-IDEMPOTENCY-KEY`. Guard: `assertOffice(kodeKantor)`.

**Request Body**
```json
{
  "tglTrans": "2026-07-16",
  "kuitansi": "KW0001",
  "kuitansiId": "KWID0001",
  "tipeTrans": "D1",
  "kodeKantor": "001",
  "akunDebet": "0010001",
  "akunKredit": "1010001",
  "nominal": 100000,
  "adm": 0,
  "kodeBindingBank": null,
  "keterangan": "Setoran tunai",
  "userId": "U001"
}
```

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `tglTrans` | string | Ya | Tanggal transaksi. |
| `kuitansi` | string | Ya | ≤ 25 karakter. |
| `kuitansiId` | string | Ya | ≤ 25 karakter; dasar derivasi reversal. |
| `tipeTrans` | string | Ya | `D1|D2|D3|T1|T2|T3|T4`. |
| `kodeKantor` | string | Ya | Harus == office token. |
| `akunDebet` / `akunKredit` | string | Kondisional | Salah satu wajib ada (validator). |
| `nominal` | number | Ya | **> 0** (`@DecimalMin` inclusive=false). |
| `adm` | number | Ya | **≥ 0**. |
| `kodeBindingBank` | string | Tidak | Untuk transaksi antar-bank (validator binding). |
| `keterangan` | string | Ya | Deskripsi. |
| `userId` | string | Ya | Harus == `user_id` token. |

**Response — 200 OK**
```json
{
  "responseCode": "00",
  "responseData": {
    "transId": 12345,
    "kuitansi": "KW0001",
    "kuitansi_id": "KWID0001",
    "akunDebet": "0010001", "namaAkunDebet": "Kas",
    "akunKredit": "1010001", "namaAkunKredit": "Budi Santoso",
    "tglTrans": "2026-07-16", "jamTrans": "10:15:03"
  },
  "responseMessage": "Transaksi tabungan sukses"
}
```

---

### 4.14 `POST /api/v1/transaksi/pencairanPinjaman`

**Request Body**
```json
{
  "tglTrans": "2026-07-16", "kuitansi": "KW0002", "kuitansiId": "KWID0002",
  "tipeTrans": "C1", "kodeKantor": "001", "noRekening": "0020001",
  "nominal": 5000000, "keterangan": "Pencairan pinjaman",
  "userId": "U001", "noRekeningTabungan": "0010001", "kodeBindingBank": null
}
```
`tipeTrans` ∈ `C1|C2|C3`; `nominal` > 0 (dan harus sama dengan jumlah pinjaman — validator).
Guard: `assertOffice(kodeKantor)`. Response: `TransKreditPencairanResponseDTO`.

---

### 4.15 `POST /api/v1/transaksi/angsuranPinjaman`

> ⚠️ **Perubahan kontrak (breaking) — 2026-09-01.** BPR/M-Pay menghapus dukungan pembayaran
> sebagian (partial payment): nasabah hanya dapat membayar **satu angsuran penuh** atau tidak
> sama sekali ("mirip fintech"), dan hanya angsuran **belum lunas paling awal** yang boleh
> dibayar (tidak boleh melompati angsuran yang masih tertunggak). Field `pokok`/`bunga` pada
> request **dihapus** — nominal yang diposting selalu diturunkan sistem dari jadwal angsuran
> (`kretrans`), tidak pernah dipercaya dari client.

**Request Body**
```json
{
  "tglTrans": "2026-09-25",
  "angsuranKe": 1,
  "kuitansi": "KWT-0001",
  "kuitansiId": "K-0001",
  "tipeTrans": "320",
  "kodeKantor": "001",
  "noRekening": "001101000328",
  "keterangan": "Angsuran ke-1",
  "userId": "5"
}
```

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `angsuranKe` | number | Ya | Angsuran yang ingin dibayar (dari hasil `/pinjaman/tagihan`, §4.11.3); server **memvalidasi** ini harus == angsuran belum lunas paling awal, tidak lagi sekadar dicatat. |
| `pokok` / `bunga` | — | **Dihapus** | ⚠️ Sebelumnya dikirim client dan dipercaya langsung; sekarang **tidak ada lagi** pada request — nilai selalu dihitung server dari jadwal (`kretrans` `my_kode_trans=200`). |
| `kuitansiId` | string | Ya | ≤ 18 karakter. |
| lainnya (`tglTrans`,`kuitansi`,`tipeTrans`,`kodeKantor`,`noRekening`,`keterangan`,`userId`) | | Ya | Tidak berubah dari sebelumnya. |

Guard: rantai standar (§5) lalu `assertOffice(kodeKantor)`, kemudian tiga pemeriksaan urutan
pembayaran (lihat tabel kode error di bawah) dijalankan **di dalam** lock pessimistic-write
kredit, sebelum pengecekan saldo cukup.

**Response — 200 OK**
```json
{
  "responseCode": "00",
  "responseData": {
    "transId": 123456,
    "kuitansi": "KWT-0001",
    "kuitansi_id": "K-0001",
    "noRekening": "001101000328",
    "tglTrans": "2026-09-25",
    "jamTrans": "10:15:30",
    "pokok": 1166667.00,
    "bunga": 35000.00,
    "denda": 0,
    "totalAngsuran": 1201667.00
  },
  "responseMessage": "Angsuran pinjaman sukses"
}
```

> `pokok`/`bunga`/`totalAngsuran` pada response adalah nilai **yang benar-benar diposting**
> (diturunkan server dari jadwal), bukan echo dari request. `denda` adalah placeholder `0` —
> perhitungan denda keterlambatan 0,3%/hari masih belum diimplementasikan (lihat §4.11.1).

**Kode error khusus (pembayaran sekuensial)**

| Kode | HTTP | Kondisi |
|------|------|---------|
| `95` | 400 | "Pinjaman sudah lunas, tidak ada tagihan yang harus dibayar" — tidak ada angsuran belum lunas tersisa. |
| `95` | 400 | "Angsuran ke-{N} sudah dibayar" — `angsuranKe` yang diminta lebih awal dari angsuran belum lunas paling awal (sudah lunas). |
| `95` | 400 | "Angsuran ke-{N} harus dibayar terlebih dahulu" — `angsuranKe` yang diminta melompati angsuran belum lunas paling awal; `{N}` = angsuran yang harus dibayar lebih dulu. |
| `95` | 400 | "Data jadwal angsuran tidak valid" — guard integritas data jadwal (kondisi langka, seharusnya tidak terjadi pada operasi normal). |

Guard-guard lama tetap berjalan lebih dulu dan tidak berubah urutannya: "Kode kantor tidak
sesuai dengan data rekening" → "Tipe transaksi tidak tersedia" → "Kuitansi id duplikat" → "No
rekening pinjaman sudah tidak aktif" → *(baru setelah itu)* tiga pemeriksaan sekuensial di atas
→ "Transaksi ditolak: saldo akun debet tidak mencukupi" (sekarang dicek terhadap total yang
diturunkan server, bukan nominal kiriman client).

---

### 4.16 `POST /api/v1/transaksi/setoranDeposito`

**Request Body**
```json
{
  "tglTrans": "2026-07-16", "tipeTrans": "E1", "noRekening": "0030001",
  "kuitansi": "KW0004", "kuitansiId": "KWID0004", "nominal": 10000000,
  "keterangan": "Setoran deposito", "kodeKantor": "001",
  "noRekeningTabungan": "0010001", "kodeBindingBank": null, "userId": "U001"
}
```
`tipeTrans` ∈ `E1|E2|E3`; `nominal` > 0 (harus sama dengan jumlah deposito — validator).
Guard: `assertOffice(kodeKantor)`. Response: `TransSetoranDepositoResponseDTO`.

---

### 4.17 `POST /api/v1/transaksi/status` · `/reversal`

| Endpoint | Request | Guard | Response |
|----------|---------|-------|----------|
| `/status` | `{ "kuitansi": "KW0001", "userId": "U001" }` | `assertKuitansiOffice(kuitansi)` | `List<ApiTransactionLog>` |
| `/reversal` | `{ "kuitansi": "KW0001", "tipeTrans": "D1", "userId": "U001" }` | `assertKuitansiOffice(kuitansi)` | `TransReverseResponseDTO` |

Reversal dijaga anti dobel-reversal (`existsByKuitansiId(kuitansiId + "R")`).

**Response `/reversal` — 200 OK**
```json
{
  "responseCode": "00",
  "responseData": { "transId": 12399, "kuitansi": "KW0001", "kuitansi_id": "KWID0001R",
                    "tglTrans": "2026-07-16", "jamTrans": "10:20:11" },
  "responseMessage": "Transaksi reversal sukses"
}
```

---

### 4.18 `POST /api/v1/transaksi/tipe` · `/bindingBank`

Keduanya memakai request `{ "userId": "U001" }` (+ Authorization + `X-IDEMPOTENCY-KEY`).
Response berupa daftar referensi (`List<ApiIntegration>` / `List<BindingBankView>`). Tidak
ada tenant guard.

---

### 4.19 `GET /api/v1/rekap/setoran-tab-marketing` · `/penarikan-tab-marketing`

> **HQ/admin-only** (allowlist `rekap.admin-user-ids`). Header `Authorization` (Bearer).

**Query params:** `startDate`, `endDate` (ISO date `yyyy-MM-dd`), `kodeGroup`.

**Response — 200 OK:** `ApiResponse<List<Rekap...Projection>>`, code `"00"`.
**Error:** `403` `99` — "Akses ditolak: rekap hanya untuk pengguna HQ/admin."

---

### 4.20 `GET /api/monitoring/logs`

> Key-gated via `X-MONITORING-KEY` (header) atau `monitoringKey` (query). Dikonsumsi dashboard
> `health-ui-mcs`. Fail-closed bila key tidak diset di server.

#### 4.20.1 `GET /actuator/health` — dua bentuk respons

Endpoint ini **selalu dapat diakses anonim** (probe LB/Kubernetes tidak boleh ditolak), tetapi
tingkat detailnya bergantung pada key monitoring (`management.endpoint.health.show-details=when-authorized`):

| Pemanggil | Contoh respons | Catatan |
|-----------|----------------|---------|
| Anonim / key salah | `{"status":"UP","groups":["liveness","readiness"]}` | Tanpa blok `components` — internal DB/Redis/disk/versi tidak dibocorkan. Key salah **tidak** menghasilkan 401 di path ini |
| `X-MONITORING-KEY: <key>` valid | `{"status":"UP","components":{"db":{...},"redis":{...},"diskSpace":{"details":{"free":...,"total":...}},...}}` | Request diautentikasi dengan role `MONITORING`; ini yang dipakai kartu DB / Redis / Disk pada dashboard |

Status HTTP: `200` bila `status` = `UP`, `503` bila `DOWN` (berlaku untuk kedua bentuk).

| Endpoint | Params | Response |
|----------|--------|----------|
| `GET /` | `from`,`to` (`yyyy-MM-dd HH:mm`, opsional), `page`(0), `size`(10), `status`, `keyword` | `Page<ApiLogListDTO>` |
| `GET /{id}` | path `id` (Long) | `ApiLogDetailDTO` |
| `GET /export` | `status`,`keyword`,`from`,`to` (ISO date-time) | CSV (`Time,Endpoint,Request,Response,Status,IP`) |

`ApiLogListDTO`: `id`, `endpoint`, `status`, `ipAddr`, `createdAt`.
`ApiLogDetailDTO`: + `request`, `response` (sudah ter-mask data sensitif).

---

## 5. Aturan Lintas-Cutting (berlaku pada endpoint transaksional)

Urutan guard yang dijalankan setiap endpoint transaksional/CRUD POST:

```
1. Validasi Bearer token          → gagal: 401 (98)
2. userId body == klaim user_id   → gagal: 403 (99)
3. Header X-IDEMPOTENCY-KEY ada?  → tidak: 400 (97)
4. reserveIfFirst (SET NX)         → bukan pertama: 409 (93)
5. isRequestLimited (rate limit)   → lewat batas: 429 (94)
6. TenantGuard.assert*             → beda kantor: 403 (99)
7. Service (@Transactional, lock)  → sukses: 200 (00)
```
Kegagalan Redis pada langkah 4/5 → **HTTP 503 (90)** (fail-closed, sebelum posting).

## 6. Kode Response Global

Sumber: `constants/AppConstants.ResponseCodes`.

| responseCode | Arti | HTTP tipikal |
|--------------|------|--------------|
| `00` | Sukses (`SUCCESS`) | 200 |
| `01` | Data tidak ditemukan (`NOT_FOUND`) | 200/404 |
| `02` | Validasi gagal (`VALIDATION_ERROR`) | 400 |
| `03` | Produk *special rate* wajib mengisi `sukuBunga` (`SPECIAL_RATE_REQUIRED`) | 400 |
| `90` | Layanan tidak tersedia (`SERVICE_UNAVAILABLE`, mis. Redis down) | 503 |
| `91` | Data duplikat (`DUPLICATE_DATA`) | 400 |
| `92` | `client_id` tidak ditemukan/aktif (`CLIENT_ID_NOT_FOUND`) | 200 |
| `93` | Request duplikat / idempotency (`DUPLICATE_REQUEST`) | 409 |
| `94` | Terlalu banyak request (`TOO_MANY_REQUESTS`) | 429 |
| `95` | Pelanggaran aturan bisnis (`BUSINESS_EXCEPTION`) | 400 |
| `96` | Kesalahan sistem (`ERROR`) | 500 |
| `97` | Bad request / header wajib hilang (`BAD_REQUEST`) | 400 |
| `98` | Token tidak valid/kedaluwarsa (`TOKEN_INVALID`) | 401 |
| `99` | User/tenant tidak cocok (`USER_MISMATCH`) | 403 |

> Pesan pada error internal (`96`) selalu **generik** — detail DB/SQL hanya dicatat di log server.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 16 Juli 2026 | | Dokumen dibuat |
| 1.1.0 | 16 Juli 2026 | | Tambah `GET /deposito/produk-spesial-rate`; registrasi deposito mendukung produk *special rate* (`sukuBunga` wajib, `jkw` 6/12); response code baru `03` (`SPECIAL_RATE_REQUIRED`). |
| 1.1.1 | 17 Juli 2026 | | Aturan `jkw` produk *special rate* diperluas dari `6/12` menjadi **1/3/6/12** (permintaan BPR). |
| 1.2.1 | 6 Agustus 2026 | | Tambah §4.20.1 — dua bentuk respons `GET /actuator/health`: anonim (status saja, tanpa `components`) vs pemanggil dengan `X-MONITORING-KEY` valid (dengan `components` db/redis/diskSpace, role `MONITORING`); key salah tidak menghasilkan 401 pada path ini. Tidak ada perubahan pada endpoint bisnis. |
| 1.2.0 | 5 Agustus 2026 | | Tambah `POST /tabungan/update-saldo-minimum` (§4.10a) untuk campaign bebas saldo minimum rekening existing + catatan resolusi campaign pada `/tabungan/registrasi` (kontrak registrasi tidak berubah). Tidak ada kode response baru. |
| 1.3.0 | 25 Agustus 2026 | | Tambah §4.11.1 — aturan *loan style* M-Pay (CR BPR): `POST /pinjaman/registrasi` menerima field opsional baru `loanStyleId` merujuk catalog `api_loan_style` (dropdown nominal M-Pay: 1jt/2jt/3,5jt/5jt/7,5jt/10jt, tenor 1/3 bulan); bila diisi, `typeKredit`/`jmlPinjaman`/`jmlAngsuran`/`satuanWaktuAngsuran` diturunkan server-side dan nilai kiriman client diabaikan; bila kosong, kontrak lama tidak berubah. Response `/registrasi` tidak berubah. Kode error khusus `95` untuk `loanStyleId` tidak ditemukan/nonaktif/produk tidak cocok/tenor tidak valid. Dicatat eksplisit: denda keterlambatan 0,3%/hari belum diterapkan pada perubahan ini. |
| 1.3.1 | 25 Agustus 2026 | | Tambah `GET /pinjaman/loan-style` (§4.11) — daftar catalog `api_loan_style` aktif (opsional filter `kodeProduk`), dipakai M-Pay untuk memuat pilihan dropdown sebelum mengirim `loanStyleId` ke `/registrasi`. JWT-only, tanpa `X-IDEMPOTENCY-KEY`/tenant guard (referensi global), pola sama dengan `GET /deposito/produk-spesial-rate`. Tidak ada kode response baru. |
| 1.3.2 | 25 Agustus 2026 | | §4.11.1 diperluas: `kodeProduk` sekarang juga diturunkan dari `api_loan_style` bila `loanStyleId` diisi (M-Pay tidak perlu/tidak boleh mengirim `kodeProduk`) — sebelumnya field ini tetap wajib di kedua jalur. Pengecekan "loan style tidak berlaku untuk kode produk tersebut" dihapus (tidak relevan lagi, tidak ada nilai client untuk dicocokkan); daftar kode error `95` diperbarui. |
| 1.3.3 | 25 Agustus 2026 | | §4.11 & §4.11.1 diperluas: `sukuBungaPerTahun` sekarang juga diturunkan dari `api_loan_style.suku_bunga_per_tahun` (kolom baru) bila `loanStyleId` diisi — M-Pay tidak perlu/tidak boleh mengirim suku bunga. `GET /loan-style` menambahkan `sukuBungaPerTahun` pada response. Kode error `95` baru: "Suku bunga loan style belum diisi" (catalog dengan suku bunga `<= 0`, mis. baris lama yang belum di-backfill setelah `ALTER ... DEFAULT 0`, ditolak). |
| 1.4.0 | 27 Agustus 2026 | | Bug fix + **perubahan kontrak breaking**: `/jadwal` tidak lagi mengembalikan baris pencairan (`my_kode_trans=100`) tercampur dalam jadwal angsuran (§4.11.2 baru). `responseData` berubah dari array menjadi objek `{ jadwal: [...], totalPokok, totalBunga }` — field di dalam `jadwal[]` tidak berubah, client wajib membaca `responseData.jadwal`. |
| 1.5.0 | 1 September 2026 | | **Perubahan kontrak breaking** pada dua endpoint kredit (keputusan BPR/M-Pay — angsuran pinjaman sekuensial, tanpa partial payment): `/pinjaman/tagihan` sekarang mengembalikan seluruh angsuran belum lunas terurut `angsuranKe` (§4.11.3 baru), bukan satu baris; `/transaksi/angsuranPinjaman` tidak lagi menerima `pokok`/`bunga` dari client (nilai diturunkan server dari jadwal) dan hanya menerima `angsuranKe` yang merupakan angsuran belum lunas paling awal (§4.15) — response-nya bertambah `pokok`/`bunga`/`denda`/`totalAngsuran`. Kode error baru (tetap `95`): "Pinjaman sudah lunas, tidak ada tagihan yang harus dibayar" · "Angsuran ke-N sudah dibayar" · "Angsuran ke-N harus dibayar terlebih dahulu" · "Data jadwal angsuran tidak valid". Tidak ada kode response baru maupun perubahan skema DB. |

---

*[← Kembali ke Host 2 Host](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
