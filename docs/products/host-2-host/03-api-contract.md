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
| Health probe | `GET /actuator/health` |

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

### 3.3 Tabungan — `/api/v1/tabungan`
| No | Method | Endpoint | Deskripsi |
|----|--------|----------|-----------|
| 14 | `POST` | `/registrasi` | Registrasi rekening tabungan. |
| 15 | `POST` | `/pencarian` | Pencarian data tabungan. |
| 16 | `POST` | `/saldo` | Inquiry saldo tabungan. |
| 17 | `POST` | `/list` | Daftar mutasi rekening tabungan. |

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

### 4.10 `POST /api/v1/tabungan/*`

| Endpoint | Request DTO | Field | Guard |
|----------|-------------|-------|-------|
| `/registrasi` | `CreateTabungRequestDTO` | `kodeKantor`, `userId`, `nasabahId`, `kodeProduk` (semua NotBlank) | `assertOffice(kodeKantor)` |
| `/pencarian` | `InquiryTabungRequestDTO` | `kodeKantor`, `userId`, `search` | `assertOffice(kodeKantor)` |
| `/saldo` | `InquirySaldoRequestDTO` | `tglTrans`, `noRekening`, `userId` | `assertTabungOffice(noRekening)` |
| `/list` | `ListTabungRequestDTO` | `kodeKantor`, `noRekening`, `tglAwal`, `tglAkhir` (date), `userId` | `assertOffice(kodeKantor)` |

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

### 4.11 `POST /api/v1/pinjaman/*`

| Endpoint | Request DTO | Field kunci | Guard |
|----------|-------------|-------------|-------|
| `/registrasi` | `CreateKreditRequestDTO` | `kodeKantor`,`userId`,`nasabahId`,`kodeProduk`,`jmlPinjaman`,`jmlAngsuran`,`satuanWaktuAngsuran`(`[HMB]`),`tglRealisasi`,`noSpk`,`typeKredit`(`100/200/300/310/350/700/710`),`sukuBungaPerTahun` | `assertOffice(kodeKantor)` |
| `/jadwal` | `InquiryJadwalKreditRequestDTO` | `noRekening`,`userId` | `assertKreditOffice(noRekening)` |
| `/tagihan` | `InquiryTagihanKreditRequestDTO` | `noRekening`,`tglTrans`(date),`userId` | `assertKreditOffice(noRekening)` |
| `/saldo` | `InquirySaldoRequestDTO` | `tglTrans`,`noRekening`,`userId` | `assertKreditOffice(noRekening)` |
| `/list` | `ListKreditRequestDTO` | `kodeKantor`,`noRekening`,`tglHitung`(date),`userId` | `assertOffice(kodeKantor)` |

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
| **Special rate** (`is_custom_rate=1`) | **Wajib**, `> 0` | Hanya **6** atau **12** | Dari payload (`sukuBunga`) |
| **Non-special** (`is_custom_rate=0`) | Diabaikan (opsional) | Sesuai aturan produk (`JKW_RULES`) | Default produk (`dep_produk`) |

- `sukuBunga` tidak diisi / `≤ 0` pada produk special rate → **`03`** (`SPECIAL_RATE_REQUIRED`, HTTP 400).
- `jkw` bukan 6/12 pada produk special rate → **`95`** (`BUSINESS_EXCEPTION`, HTTP 400).
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

**Request Body**
```json
{
  "tglTrans": "2026-07-16", "angsuranKe": 1, "kuitansi": "KW0003", "kuitansiId": "KWID0003",
  "tipeTrans": "K1", "kodeKantor": "001", "noRekening": "0020001",
  "pokok": 400000, "bunga": 50000, "keterangan": "Angsuran ke-1", "userId": "U001"
}
```
`pokok` & `bunga` ≥ 0; `kuitansiId` ≤ 18 karakter. Guard: `assertOffice(kodeKantor)`.
Response: `TransKreditAngsuranResponseDTO`.

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

---

*[← Kembali ke Host 2 Host](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
