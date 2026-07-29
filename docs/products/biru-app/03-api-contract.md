# 🔌 API Contract — BIRU App

> Kontrak API (request/response) untuk **BIRU App** — endpoint autentikasi, baca data replikasi (transaksi, nominatif, nasabah), operasional ETL, administrasi pengguna & jejak audit.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | BIRU App            |
| Jenis Dokumen     | API Contract        |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 30 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Informasi Umum

| Item | Nilai |
|------|-------|
| Base URL (produksi) | `https://<host>` (di belakang reverse proxy; container mendengarkan `8080`, dipetakan default ke `2001`) |
| Base URL (lokal) | `http://localhost:8080` |
| Context Path | *(tidak ada — root)* |
| Versi API data | `v1` (`/api/v1/**`); endpoint `/auth/**` dan `/etl/**` tidak berversi |
| Format | JSON UTF-8 |
| Zona waktu | `Asia/Jakarta` (Jackson & JDBC) |
| Format tanggal | `yyyy-MM-dd`; waktu `yyyy-MM-dd'T'HH:mm:ss` |
| Autentikasi | **Cookie sesi** (browser) **atau** header `X-API-Key` (mesin) — lihat §2.1 |
| CORS | **Tidak dikonfigurasi** — aplikasi dilayani dari origin API-nya sendiri |
| Dokumentasi interaktif | Swagger UI: `/docs` · OpenAPI: `/v3/api-docs` (bisa dimatikan; default **mati** di produksi) |

## 2. Konvensi

### 2.1 Autentikasi — dua jenis kredensial, tidak saling menggantikan

| | Cookie sesi | `X-API-Key` |
|---|---|---|
| Untuk | browser (seorang manusia) | mesin: Prometheus, cron, integrasi |
| Diterbitkan oleh | `POST /auth/login` | konfigurasi `app.api-key` |
| Principal | akun `app_user`, peran `VIEWER`/`OPS`/`ADMIN` | peran `SYSTEM` |
| Dapat dicabut per pengguna | ya (baris `app_session`) | tidak — satu kunci untuk semua |
| Nama di `audit_log` | username | `SYSTEM` |
| Dibatasi per kantor | ya, bila `branch_code` terisi | tidak pernah |

> ⚠️ **Reverse proxy (nginx) maupun proxy pengembangan tidak boleh menempelkan `X-API-Key` ke
> trafik browser.** Bila itu terjadi, setiap pengunjung terautentikasi sebagai `SYSTEM` sebelum
> aplikasi web dimuat: seluruh pemeriksaan peran menjadi tidak berarti, pembatasan kantor tidak
> berlaku, dan `audit_log` mencatat "SYSTEM" alih-alih nama orangnya.

**Cookie sesi:**

| Properti | Nilai |
|---|---|
| Nama | `BIRU_SESSION` (dapat dikonfigurasi) |
| Atribut | `HttpOnly`, `SameSite=Strict`, `Path=/`, `Secure` (default; boleh dimatikan hanya untuk pengembangan lokal) |
| Umur | `Max-Age` = sisa umur sesi (default TTL 12 jam, batas diam 60 menit) |
| Isi | token acak; server hanya menyimpan hash SHA-256-nya |

> Token **tidak pernah** dikembalikan di badan respons. Token di badan respons akan berakhir di
> `localStorage`, dan sejak itu satu XSS di mana pun cukup untuk mengambilnya.

### 2.2 Header

| Header | Wajib | Contoh | Keterangan |
|--------|-------|--------|------------|
| `Content-Type` | pada request ber-body | `application/json` | Seluruh request ber-body memakai JSON |
| `Cookie` | untuk pemanggil browser | `BIRU_SESSION=…` | Dikirim otomatis oleh browser |
| `X-API-Key` | untuk pemanggil mesin | `<64 hex>` | **Jangan** dipasang untuk trafik browser |
| `X-BIRU-Client` | pada request **pengubah data** dari sesi cookie | `web` | Tanpa ini → `403` `CSRF_HEADER_MISSING` |
| `X-Forwarded-For` | opsional (diisi proxy) | `10.0.0.5` | Dipakai sebagai IP pemanggil di jejak audit |

**Aturan `X-BIRU-Client`:** wajib pada metode selain `GET`/`HEAD`/`OPTIONS`/`TRACE` **bila** request
terautentikasi lewat cookie. Pemanggil `X-API-Key` tidak diwajibkan. Ini bekerja *karena* BIRU tidak
punya konfigurasi CORS: pemanggil dari situs lain tidak dapat menambahkan header kustom tanpa
preflight yang akan gagal.

### 2.3 Bentuk respons standar

Sebagian besar endpoint baca memakai selubung berikut:

```json
{
  "status": 200,
  "data": [ /* ... */ ],
  "total": 100,
  "limit": 100,
  "meta": {
    "nextCursor": "912345",
    "hasMore": true,
    "totalReturned": 100,
    "branchCode": "001",
    "dateFrom": "2026-07-01",
    "dateTo": "2026-07-31",
    "totalCount": 4213,
    "totalPages": 43
  }
}
```

| Field | Keterangan |
|-------|------------|
| `status` | Sama dengan status HTTP |
| `data` | Muatan; untuk endpoint daftar berupa array |
| `total` | Jumlah baris pada halaman ini (khusus `/etl/reconcile`: jumlah baris **yang tidak cocok**) |
| `limit` | Batas yang berlaku pada request ini |
| `meta.nextCursor` | Kirim balik apa adanya sebagai `cursor` untuk halaman berikutnya; tidak muncul bila habis |
| `meta.hasMore` | `true` bila masih ada halaman berikutnya |
| `meta.totalReturned` | Jumlah baris pada halaman ini (juga dipakai sebagai jumlah baris di jejak audit) |
| `meta.totalCount` / `totalPages` / `currentPage` | Hanya muncul bila `includeTotal=true` |

Field bernilai `null` pada `meta` **dihilangkan** dari JSON.

Pengecualian bentuk:
- `GET /api/v1/customers` memakai selubung sendiri: `{ "data": [...], "meta": {...} }` (tanpa
  `status`/`total`/`limit`).
- `GET /api/v1/customers/{cif}` mengembalikan objek nasabah langsung, tanpa selubung.
- `/etl/**` POST memakai `{ "responseCode", "responseData", "responseMessage" }`.
- `/auth/**` mengembalikan objek spesifik per endpoint.

### 2.4 Paginasi cursor

1. Request pertama: kirim filter + `limit` (default 100, maksimum 1000). Jangan kirim `cursor`.
2. Bila `meta.hasMore = true`, kirim request berikutnya dengan `cursor = meta.nextCursor` dan
   **filter yang sama**.
3. Ulangi sampai `hasMore = false`.

Isi cursor per endpoint:

| Endpoint | Cursor |
|----------|--------|
| `/api/v1/transactions/saving` | `source_tabtrans_id` baris terakhir (numerik, sebagai string) |
| `/api/v1/transactions/deposit` | `source_deptrans_id` baris terakhir |
| `/api/v1/transactions/loan` | `source_kretrans_id` baris terakhir |
| `/api/v1/nominatif/*` | `accountNumber` baris terakhir |
| `/api/v1/customers` | `cif` baris terakhir |
| `/api/v1/admin/audit` | `id` baris audit terakhir (urutan **menurun**) |

`includeTotal=true` menambah `totalCount` & `totalPages`, tetapi menambah satu query `COUNT` —
jangan dipakai pada setiap halaman sebuah export.

### 2.5 Pembatasan per kantor (`branchCode`)

Berlaku pada seluruh `/api/**` dan `/etl/**` untuk akun yang punya `branch_code`:

| Yang dikirim klien | Perilaku |
|--------------------|----------|
| tidak menyebut `branchCode` | Kantor pemanggil **disuntikkan** oleh server |
| `branchCode=` (kosong) | Dihitung "tidak disebut" → **digantikan** kantor pemanggil |
| `branchCode=<kantor sendiri>` | Diteruskan |
| `branchCode=<kantor lain>` | **`403` `BRANCH_FORBIDDEN`** — bukan penulisan ulang diam-diam; percobaannya tercatat di audit |

`GET /etl/status` dan `GET /etl/reconcile` tidak menerima `branchCode`; keduanya memfilter barisnya
sendiri sesuai kantor pemanggil. Peran `SYSTEM` tidak pernah dibatasi.

### 2.6 Bentuk respons error

Penolakan dari lapisan keamanan dan administrasi:

```json
{ "status": 403, "code": "BRANCH_FORBIDDEN", "message": "Anda hanya boleh mengakses data kantor 001." }
```

| Kode | HTTP | Kapan |
|------|------|-------|
| `UNAUTHENTICATED` | 401 | Tidak ada sesi / sesi berakhir / API key salah |
| `FORBIDDEN` | 403 | Peran tidak berhak atas endpoint itu |
| `PASSWORD_CHANGE_REQUIRED` | 403 | Akun wajib ganti password dan mengakses selain `/auth/me`, `/auth/change-password`, `/auth/logout` |
| `CSRF_HEADER_MISSING` | 403 | Request pengubah data dari cookie tanpa `X-BIRU-Client: web` |
| `BRANCH_FORBIDDEN` | 403 | Meminta kantor selain kantornya |
| `BAD_CREDENTIALS` | 401 | Username tidak ada **atau** password salah (disamakan dengan sengaja) |
| `INACTIVE` | 401 | Akun dinonaktifkan admin |
| `LOCKED` | 423 | Akun terkunci sementara karena gagal login berturut-turut |
| `WEAK_PASSWORD` | 400 | Password baru tidak memenuhi panjang minimum |
| `NOT_FOUND` | 404 | Pengguna yang dimaksud tidak ada (administrasi) |
| `NOT_ALLOWED` | 409 | Penolakan aturan administrasi (mis. ADMIN aktif terakhir) |
| `CONFLICT` | 409 | Pelanggaran keunikan (mis. username sudah dipakai) |
| `BAD_REQUEST` | 400 | Masukan administrasi tidak valid |

Kesalahan validasi `@Valid` pada body dan kesalahan tipe parameter (mis. `date=31-07-2026`)
dikembalikan dalam **format error bawaan Spring Boot** (`timestamp`, `status`, `error`, `path`),
bukan bentuk di atas — tidak ada penangan global yang menyeragamkannya.

### 2.7 Daftar status HTTP

| Status | Arti di API ini |
|--------|-----------------|
| 200 | Berhasil |
| 201 | Pengguna baru dibuat |
| 202 | Pemicuan ETL diterima dan dijalankan di latar belakang |
| 400 | Parameter/body tidak valid |
| 401 | Belum/tidak terautentikasi |
| 403 | Terautentikasi tetapi tidak berhak (peran, kantor, CSRF, gerbang ganti password) |
| 404 | Data tidak ditemukan |
| 409 | ETL sudah berjalan · penolakan aturan administrasi · konflik keunikan |
| 423 | Akun terkunci sementara |
| 500 | Kesalahan tak terduga |

### 2.8 Auditing

Tidak ada yang perlu dilakukan pemanggil. Server mencatat sendiri:

- setiap request `/api/**` sebagai `QUERY` — **termasuk setiap halaman sebuah export**;
- setiap `POST /etl/**` sebagai `ETL_TRIGGER`, `GET /etl/**` sebagai `QUERY`;
- login berhasil/gagal, logout, ganti password;
- **termasuk percobaan yang ditolak**, beserta status HTTP-nya.

Jumlah baris hasil diambil otomatis dari `meta.totalReturned`.

---

## 3. Endpoint — Autentikasi (`/auth/**`)

### 3.1 `POST /auth/login`

Terbuka tanpa autentikasi.

**Request**

```json
{ "username": "budi.s", "password": "rahasia-yang-panjang" }
```

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `username` | string | ✅ | Tidak boleh kosong |
| `password` | string | ✅ | Tidak boleh kosong |

**Response `200 OK`**

```
Set-Cookie: BIRU_SESSION=<token>; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Strict
```

```json
{
  "username": "budi.s",
  "fullName": "Budi Santoso",
  "role": "VIEWER",
  "branchCode": "001",
  "mustChangePassword": false
}
```

| Field | Keterangan |
|-------|------------|
| `role` | `VIEWER` / `OPS` / `ADMIN` |
| `branchCode` | `null` = semua kantor |
| `mustChangePassword` | `true` → klien **hanya** boleh menampilkan layar ganti password |

**Error**

| HTTP | Body |
|------|------|
| 401 | `{"status":401,"code":"BAD_CREDENTIALS","message":"…"}` |
| 401 | `{"status":401,"code":"INACTIVE","message":"…"}` |
| 423 | `{"status":423,"code":"LOCKED","message":"…"}` |

> Gagal login berturut-turut (default 5×) mengunci akun selama 15 menit. `423` dibedakan dari `401`
> supaya pengguna tahu harus menunggu, bukan mencoba lagi.

### 3.2 `POST /auth/logout`

Butuh sesi. Wajib `X-BIRU-Client: web`.

**Response `200 OK`** — cookie dikosongkan (`Max-Age=0`)

```json
{ "status": 200, "message": "Berhasil keluar" }
```

### 3.3 `GET /auth/me`

Butuh sesi (atau API key). Boleh diakses walau akun sedang wajib ganti password.

**Response `200 OK`** — bentuk sama dengan respons login.

### 3.4 `POST /auth/change-password`

Butuh sesi. Wajib `X-BIRU-Client: web`.

**Request**

```json
{ "oldPassword": "password-lama", "newPassword": "password-baru-yang-panjang" }
```

**Response `200 OK`** — cookie dikosongkan; **semua sesi pengguna itu dicabut**

```json
{ "status": 200, "message": "Password berhasil diganti. Silakan login kembali." }
```

**Error**

| HTTP | Kode | Kapan |
|------|------|-------|
| 401 | `BAD_CREDENTIALS` | Password lama salah |
| 400 | `WEAK_PASSWORD` | Password baru lebih pendek dari minimum (default 12) |
| 403 | `FORBIDDEN` | Pemanggil `X-API-Key` — tidak punya password untuk diganti |

---

## 4. Endpoint — Transaksi (`/api/v1/transactions/**`)

Semua peran yang login boleh membaca; dibatasi kantor sesuai §2.5.

### 4.1 Parameter bersama

| Parameter | Tipe | Wajib | Default | Keterangan |
|-----------|------|-------|---------|------------|
| `branchCode` | string | ❌ | — | Kosong = semua kantor yang diizinkan |
| `accountNumber` | string | ❌ | — | Kosong = semua rekening |
| `dateFrom` | date `yyyy-MM-dd` | ✅ | — | Tanggal transaksi awal (inklusif) |
| `dateTo` | date `yyyy-MM-dd` | ✅ | — | Tanggal transaksi akhir (inklusif) |
| `limit` | int | ❌ | `100` | 1–1000 |
| `cursor` | string | ❌ | — | `meta.nextCursor` halaman sebelumnya |
| `includeTotal` | boolean | ❌ | `false` | Sertakan `totalCount`/`totalPages` |

### 4.2 `GET /api/v1/transactions/saving`

Transaksi tabungan.

```
GET /api/v1/transactions/saving?branchCode=001&dateFrom=2026-07-01&dateTo=2026-07-31&limit=100
```

**Response `200 OK`** — `data[]`:

| Field | Tipe | Keterangan |
|-------|------|------------|
| `id` | string (UUID) | Kunci baris di BIRU |
| `accountNumber` | string | Nomor rekening |
| `accountDestination` | string | Rekening tujuan (transfer), bila ada |
| `transactionDate` | date | Tanggal transaksi |
| `transactionTime` | datetime | Waktu transaksi (bila tersedia di core) |
| `principalAmount` | decimal(18,2) | Nominal pokok |
| `transCode` | string | Kode transaksi core |
| `referenceNumber` | string | Nomor referensi |
| `referenceCode` | string | Kode referensi |
| `channel` | string | Kanal hasil penurunan aturan domain (mis. TELLER/MOBILE) |
| `phoneNumber` | string | Telepon nasabah |
| `customerCif` | string | CIF nasabah |
| `customerFullname` | string | Nama nasabah |
| `receiverFullname` | string | Nama penerima (transfer) |
| `trxDesc` | string | Keterangan transaksi |
| `reversal` | string `Y`/`N` | Penanda pembatalan |
| `branchCode` | string | Kantor |
| `insertDate` | datetime | Waktu baris masuk ke BIRU |
| `sourceModule` | string | Modul sumber di core |
| `sourceLinkId` | number | Id keterkaitan di core |

```json
{
  "status": 200,
  "data": [
    {
      "id": "6f1c7c2e-9a4b-4c7d-8f31-0a5b9d2e1c34",
      "accountNumber": "0010012345678",
      "accountDestination": null,
      "transactionDate": "2026-07-15",
      "transactionTime": "2026-07-15T10:22:41",
      "principalAmount": 2500000.00,
      "transCode": "01",
      "referenceNumber": "TRX-0012345",
      "referenceCode": null,
      "channel": "TELLER",
      "phoneNumber": "08123456789",
      "customerCif": "0000123456",
      "customerFullname": "BUDI SANTOSO",
      "receiverFullname": null,
      "trxDesc": "SETORAN TUNAI",
      "reversal": "N",
      "branchCode": "001",
      "insertDate": "2026-07-15T10:35:02",
      "sourceModule": "TAB",
      "sourceLinkId": 998877
    }
  ],
  "total": 1,
  "limit": 100,
  "meta": { "hasMore": false, "totalReturned": 1, "branchCode": "001",
            "dateFrom": "2026-07-01", "dateTo": "2026-07-31" }
}
```

### 4.3 `GET /api/v1/transactions/deposit`

Transaksi deposito. Field seperti §4.2 tanpa `accountDestination`/`receiverFullname`, ditambah:

| Field | Tipe | Keterangan |
|-------|------|------------|
| `interestAmount` | decimal(18,2) | Nominal bunga |
| `taxAmount` | decimal(18,2) | Pajak bunga |
| `placementDate` | date | Tanggal penempatan |
| `valueDate` | date | Tanggal valuta |
| `maturityDate` | date | Tanggal jatuh tempo |
| `depositPeriod` | int | Jangka waktu (bulan) |
| `interestRate` | decimal(5,2) | Suku bunga |
| `aroFlag` | string `Y`/`N` | Penanda ARO (perpanjangan otomatis) |
| `maturityTreatment` | int | Perlakuan saat jatuh tempo |

### 4.4 `GET /api/v1/transactions/loan`

Transaksi kredit. Field seperti §4.2 (tanpa `accountDestination`/`receiverFullname`), ditambah:

| Field | Tipe | Keterangan |
|-------|------|------------|
| `installmentNumber` | int | Angsuran ke- |
| `interestAmount` | decimal(18,2) | Bunga |
| `penaltyAmount` | decimal(18,2) | Denda |
| `provisionAmount` | decimal(18,2) | Provisi |
| `stampAmount` | decimal(18,2) | Bea materai |
| `insuranceAmount` | decimal(18,2) | Asuransi |
| `notaryAmount` | decimal(18,2) | Notaris |
| `adminAmount` | decimal(18,2) | Biaya administrasi |
| `linkedSavingAccount` | string | Rekening tabungan terkait |

---

## 5. Endpoint — Nominatif (`/api/v1/nominatif/**`)

Snapshot harian posisi rekening. Parameter identik dengan §4.1, kecuali `dateFrom`/`dateTo`
merujuk **tanggal laporan** (`reportDate`) dan `cursor` berisi `accountNumber`.

### 5.1 `GET /api/v1/nominatif/saving` · `GET /api/v1/nominatif/deposit`

`data[]`:

| Field | Tipe | Keterangan |
|-------|------|------------|
| `branchCode` | string | Kantor |
| `reportDate` | date | Tanggal laporan snapshot |
| `accountNumber` | string | Nomor rekening |
| `customerCif` | string | CIF |
| `customerFullname` | string | Nama nasabah |
| `balance` | decimal(18,2) | Saldo |
| `interestRate` | decimal(6,4) | Suku bunga |
| `productCode` | string | Kode produk |
| `accountStatus` | string(1) | Status rekening |
| `insertDate` | datetime | Waktu baris masuk BIRU |

```json
{
  "status": 200,
  "data": [
    { "branchCode": "001", "reportDate": "2026-07-29", "accountNumber": "0010012345678",
      "customerCif": "0000123456", "customerFullname": "BUDI SANTOSO",
      "balance": 15750000.00, "interestRate": 3.0000, "productCode": "TB01",
      "accountStatus": "1", "insertDate": "2026-07-30T00:12:05" }
  ],
  "total": 1, "limit": 100,
  "meta": { "hasMore": false, "totalReturned": 1, "branchCode": "001",
            "dateFrom": "2026-07-29", "dateTo": "2026-07-29" }
}
```

### 5.2 `GET /api/v1/nominatif/loan`

Snapshot kredit aktif. `data[]`:

| Field | Tipe | Keterangan |
|-------|------|------------|
| `branchCode` · `reportDate` · `accountNumber` | | Kunci snapshot |
| `customerCif` · `customerFullname` | string | Nasabah |
| `productCode` | string | Kode produk kredit |
| `loanType` | string | Deskripsi jenis penggunaan (dari tabel kode core) |
| `installmentType` | string | Tipe angsuran |
| `rmName` | string | Nama RM / *account officer* |
| `accountStatus` | string(1) | Status rekening |
| `loanAmount` | decimal(18,2) | Plafon |
| `amountTransferred` | decimal(18,2) | Total pencairan |
| `outstandingBalance` | decimal(18,2) | **Baki debet** |
| `availableDrawdown` | decimal(18,2) | Sisa yang dapat ditarik |
| `principalUnbilled` | decimal(18,2) | Pokok belum tertagih |
| `interestUnbilled` | decimal(18,2) | Bunga belum tertagih |
| `overduePrincipal` | decimal(18,2) | Tunggakan pokok |
| `overdueInterest` | decimal(18,2) | Tunggakan bunga |
| `interestAccrue` | decimal(18,2) | **Bunga akrual** (sumbernya mengikuti `core.flavour`) |
| `interestRate` | decimal(8,4) | Suku bunga |
| `tenor` | int | Tenor (bulan) |
| `startDate` | date | Tanggal mulai |
| `maturityDate` | date | Jatuh tempo |
| `firstInstallmentDate` | date | Angsuran pertama |
| `lastInstallmentDate` | date | Angsuran terakhir |
| `installmentAmount` | decimal(18,2) | Jumlah angsuran |
| `principalBilled` | decimal(18,2) | Pokok tertagih |
| `interestBilled` | decimal(18,2) | Bunga tertagih |
| `tenorBilled` | int | Tenor tertagih |
| `tenorUnbilled` | int | Tenor belum tertagih |
| `principalOverdueDays` | int | Hari tunggakan pokok |
| `interestOverdueDays` | int | Hari tunggakan bunga |
| `overdueDays` | int | Hari tunggakan |
| `tenorOverdue` | int | Tenor tunggakan |
| `insertDate` | datetime | Waktu baris masuk BIRU |

---

## 6. Endpoint — Nasabah (`/api/v1/customers/**`)

### 6.1 `GET /api/v1/customers`

| Parameter | Tipe | Wajib | Default | Keterangan |
|-----------|------|-------|---------|------------|
| `branchCode` | string | ✅ | — | **Wajib.** Untuk akun ber-kantor, nilainya dipaksa server |
| `hasSaving` | boolean | ❌ | — | Filter punya tabungan aktif |
| `hasDeposit` | boolean | ❌ | — | Filter punya deposito aktif |
| `hasLoan` | boolean | ❌ | — | Filter punya kredit aktif |
| `limit` | int | ❌ | `100` | 1–1000 |
| `cursor` | string | ❌ | — | `cif` terakhir halaman sebelumnya |
| `includeTotal` | boolean | ❌ | `false` | Sertakan total |

**Response `200 OK`** — selubung khusus (tanpa `status`/`total`/`limit`):

```json
{
  "data": [
    {
      "cif": "0000123456",
      "branchCode": "001",
      "fullName": "BUDI SANTOSO",
      "idCardNumber": "3204xxxxxxxxxxxx",
      "birthPlace": "BANDUNG",
      "birthDate": "1985-04-12",
      "gender": "L",
      "address": "JL. MERDEKA NO. 10",
      "postalCode": "40111",
      "phoneNumber": "08123456789",
      "email": "budi@example.com",
      "hasSaving": true,
      "hasDeposit": false,
      "hasLoan": true,
      "insertDate": "2026-07-30T00:05:11"
    }
  ],
  "meta": { "nextCursor": "0000123999", "hasMore": true, "totalReturned": 100, "branchCode": "001" }
}
```

> `gender` bernilai `L`, `P`, atau `null`. Nilai lain di core **dinormalisasi menjadi `null`** oleh
> aplikasi — data CORE tidak diubah.

### 6.2 `GET /api/v1/customers/{cif}`

| Parameter | Tipe | Wajib | Keterangan |
|-----------|------|-------|------------|
| `cif` (path) | string | ✅ | CIF nasabah |
| `branchCode` (query) | string | ✅ | Kantor |

**Response `200 OK`** — objek nasabah (bentuk seperti elemen `data` di §6.1), tanpa selubung.
**`404 Not Found`** tanpa body bila kombinasi CIF + kantor tidak ada.

---

## 7. Endpoint — Operasional ETL (`/etl/**`)

Peran: `OPS`, `ADMIN`, `SYSTEM` — **kecuali** `GET /etl/status` yang boleh dibaca setiap pengguna
yang login. Semua `POST` wajib `X-BIRU-Client: web` bila memakai cookie.

### 7.1 Pemicu & backfill

| Method | Path | Keterangan |
|--------|------|------------|
| POST | `/etl/biru-tab-transactions` | Jalankan ETL transaksi tabungan (inkremental, paralel per kantor) |
| POST | `/etl/biru-tab-transactions/backfill?date=yyyy-MM-dd` | Muat ulang transaksi tabungan satu tanggal |
| POST | `/etl/biru-dep-transactions` | Transaksi deposito (inkremental) |
| POST | `/etl/biru-dep-transactions/backfill?date=…` | Backfill transaksi deposito |
| POST | `/etl/biru-krd-transactions` | Transaksi kredit (inkremental) |
| POST | `/etl/biru-krd-transactions/backfill?date=…` | Backfill transaksi kredit |
| POST | `/etl/biru-tab-nominatif` | Snapshot nominatif tabungan |
| POST | `/etl/biru-tab-nominatif/backfill?date=…` | Snapshot nominatif tabungan untuk tanggal tertentu |
| POST | `/etl/biru-dep-nominatif` | Snapshot nominatif deposito |
| POST | `/etl/biru-dep-nominatif/backfill?date=…` | Snapshot nominatif deposito per tanggal |
| POST | `/etl/biru-krd-nominatif` | Snapshot nominatif kredit |
| POST | `/etl/biru-krd-nominatif/backfill?date=…` | Snapshot nominatif kredit per tanggal |

> **`CIF_SYNC` tidak punya endpoint pemicu manual** — ia hanya berjalan terjadwal.

**Response `202 Accepted`**

```json
{
  "responseCode": "00",
  "responseData": null,
  "responseMessage": "TAB Transaction ETL accepted (incremental watermark-based, parallel per branch)"
}
```

**Response `409 Conflict`** — ETL yang sama masih berjalan:

```json
{ "responseCode": "09", "responseData": null, "responseMessage": "ETL already running, trigger skipped" }
```

| `responseCode` | Arti |
|----------------|------|
| `00` | Diterima; pekerjaan berjalan di latar belakang |
| `09` | Ditolak karena run sebelumnya belum selesai |

> `202` berarti **diterima**, bukan **selesai**. Hasilnya dipantau lewat `GET /etl/status`,
> `GET /etl/reconcile`, dan log. Backfill tidak menggeser cursor watermark.

### 7.2 `GET /etl/status`

Tanpa parameter. Dapat dibaca semua peran yang login; baris difilter sesuai kantor pemanggil.

```json
{
  "status": 200,
  "data": [
    { "etlName": "TAB_TRANSACTION", "branchCode": "001", "lastTrxId": 9912345,
      "lastTrxTime": "2026-07-30T09:58:11", "lastRunAt": "2026-07-30T10:00:03",
      "lastRunBy": "SCHEDULER", "secondsSinceLastRun": 742 }
  ],
  "total": 1
}
```

| Field | Keterangan |
|-------|------------|
| `etlName` | `TAB_TRANSACTION`, `DEP_TRANSACTION`, `KRD_TRANSACTION`, `SAVING_NOMINATIF`, `DEPOSIT_NOMINATIF`, `LOAN_NOMINATIF`, `CIF_SYNC` |
| `branchCode` | Kantor |
| `lastTrxId` | **Cursor** — id baris sumber terakhir yang tersalin. `null` = belum pernah jalan |
| `lastTrxTime` | Waktu transaksi terakhir. **Tampilan saja**, bukan filter |
| `lastRunAt` / `lastRunBy` | Waktu & pemicu run terakhir |
| `secondsSinceLastRun` | Umur data dalam detik — angka yang dipakai menilai pipeline macet |

Diurutkan berdasarkan `etlName` lalu `branchCode`. Metrik serupa tersedia sebagai gauge Prometheus
`biru.etl.watermark.lag.seconds{etl="…"}`.

### 7.3 `GET /etl/reconcile`

Peran `OPS`/`ADMIN`/`SYSTEM`. Terlihat seperti bacaan biasa, tetapi **menjalankan `COUNT` di CORE
untuk setiap kantor** — itulah alasannya tidak dibuka untuk `VIEWER`.

| Parameter | Tipe | Wajib | Keterangan |
|-----------|------|-------|------------|
| `date` | date `yyyy-MM-dd` | ✅ | Tanggal yang direkonsiliasi |
| `domain` | string, boleh berulang | ❌ | `TAB` / `DEP` / `KRD`; kosong = ketiganya |

```json
{
  "status": 200,
  "data": [
    { "domain": "TAB", "branchCode": "001", "date": "2026-07-29",
      "coreCount": 1841, "biruCount": 1841, "diff": 0, "status": "MATCH" },
    { "domain": "TAB", "branchCode": "002", "date": "2026-07-29",
      "coreCount": 902, "biruCount": 897, "diff": 5, "status": "MISSING_IN_BIRU" }
  ],
  "total": 1
}
```

| Field | Keterangan |
|-------|------------|
| `diff` | `coreCount - biruCount` |
| `status` | `MATCH` (0) · `MISSING_IN_BIRU` (>0) · `EXTRA_IN_BIRU` (<0) |
| `total` (selubung) | **Jumlah baris yang tidak cocok**, bukan jumlah baris data |

`400` bila `domain` di luar `TAB`/`DEP`/`KRD`.

---

## 8. Endpoint — Administrasi (`/api/v1/admin/**`, ADMIN)

Prefix ini **harus** dievaluasi sebelum `/api/**`; bila tidak, daftar akun akan terbuka bagi setiap
pengguna yang login. Endpoint administrasi sengaja **tidak** diletakkan di bawah `/auth/**`, karena
`/auth/**` terbuka bagi sesi mana pun — termasuk sesi yang sedang ditahan di gerbang ganti password.

### 8.1 `GET /api/v1/admin/users`

```json
{
  "status": 200,
  "data": [
    { "id": "3f2a…", "username": "budi.s", "fullName": "Budi Santoso", "role": "VIEWER",
      "branchCode": "001", "active": true, "mustChangePassword": false,
      "lockedUntil": null, "lastLoginAt": "2026-07-30T08:10:44",
      "createdAt": "2026-07-01T09:00:00" }
  ],
  "total": 1
}
```

| Field | Keterangan |
|-------|------------|
| `branchCode` | `null` = semua kantor |
| `lockedUntil` | Terisi & masih di masa depan = terkunci karena gagal login berturut-turut |

### 8.2 `POST /api/v1/admin/users`

```json
{
  "username": "siti.a",
  "fullName": "Siti Aminah",
  "role": "OPS",
  "branchCode": "002",
  "password": "password-awal-min-12"
}
```

| Field | Tipe | Wajib | Aturan |
|-------|------|-------|--------|
| `username` | string | ✅ | 3–64 karakter; hanya huruf, angka, `.`, `_`, `-` |
| `fullName` | string | ✅ | Maks 128 |
| `role` | enum | ✅ | `VIEWER` / `OPS` / `ADMIN` |
| `branchCode` | string | ❌ | Maks 8; kosong = semua kantor |
| `password` | string | ✅ | Memenuhi panjang minimum |

**`201 Created`** — badan berbentuk seperti elemen §8.1. Akun baru selalu `mustChangePassword=true`.

**Error**: `400` (validasi) · `409 CONFLICT` (username sudah ada).

### 8.3 `PATCH /api/v1/admin/users/{id}`

Field yang **tidak dikirim tidak diubah**.

```json
{ "fullName": "Siti Aminah", "role": "VIEWER", "branchCode": "003",
  "clearBranch": false, "active": true, "unlock": true }
```

| Field | Tipe | Keterangan |
|-------|------|------------|
| `fullName` | string | Ganti nama (**tidak** mencabut sesi) |
| `role` | enum | Ganti peran (mencabut sesi) |
| `branchCode` | string | Ganti kantor (mencabut sesi) |
| `clearBranch` | boolean | `true` = jadikan "semua kantor". Harus **disebut**, tidak disimpulkan dari kantor kosong, karena melonggarkan akses |
| `active` | boolean | `false` = nonaktifkan (mencabut sesi) |
| `unlock` | boolean | `true` = buka penguncian & reset penghitung gagal |

**`200 OK`** — akun setelah perubahan.

**Penolakan yang benar (`409 NOT_ALLOWED`)**: menonaktifkan/menurunkan **ADMIN aktif terakhir**;
mengubah peran sendiri; menonaktifkan diri sendiri; memperluas kantor sendiri.
`404 NOT_FOUND` bila id tidak ada.

### 8.4 `POST /api/v1/admin/users/{id}/reset-password`

```json
{ "newPassword": "password-sementara-min-12" }
```

**`200 OK`**

```json
{ "status": 200, "message": "Password siti.a berhasil direset. Pengguna wajib menggantinya saat login." }
```

Selalu memaksa ganti password saat login berikutnya, dan **mencabut seluruh sesi** pengguna itu.

### 8.5 `GET /api/v1/admin/audit`

| Parameter | Tipe | Wajib | Default | Keterangan |
|-----------|------|-------|---------|------------|
| `dateFrom` | date | ❌ | — | Awal periode (mulai 00:00:00) |
| `dateTo` | date | ❌ | — | Akhir periode (sampai 23:59:59.999) |
| `action` | string | ❌ | — | `LOGIN_OK`, `LOGIN_FAIL`, `LOGOUT`, `PASSWORD_CHANGED`, `QUERY`, `ETL_TRIGGER` |
| `username` | string | ❌ | — | Pencocokan **sebagian** |
| `cursor` | number | ❌ | — | `id` terakhir halaman sebelumnya (urutan menurun) |
| `limit` | int | ❌ | `100` | 1–**500** |
| `includeTotal` | boolean | ❌ | `false` | Sertakan `totalCount` |

```json
{
  "status": 200,
  "data": [
    { "id": 918273, "at": "2026-07-30T09:41:02.317", "username": "budi.s", "action": "QUERY",
      "target": "GET /api/v1/nominatif/loan",
      "params": "dateFrom=2026-07-01&dateTo=2026-07-31&limit=1000 | scope=001",
      "rowCount": 1000, "status": "200", "ip": "10.20.30.40" }
  ],
  "total": 1, "limit": 100,
  "meta": { "nextCursor": "918100", "hasMore": true, "totalReturned": 1,
            "dateFrom": "2026-07-30", "dateTo": "2026-07-30" }
}
```

| Field | Keterangan |
|-------|------------|
| `id` | Juga cursor halaman berikutnya |
| `params` | Query string yang diminta + keterangan pembatasan kantor bila ada (`scope=…`, `deniedBranch=…`) |
| `rowCount` | Jumlah baris yang dikembalikan ke pemanggil |
| `status` | Status HTTP request tersebut — termasuk `403` untuk percobaan yang ditolak |

`400` bila `action` tidak dikenal (badan menyebut nilai yang tersedia) atau `limit` di luar 1–500.

---

## 9. Endpoint — Operasional Platform

| Method | Path | Akses | Keterangan |
|--------|------|-------|------------|
| GET | `/actuator/health` | **Terbuka** | Health check container/LB. `{"status":"UP"}` |
| GET | `/actuator/info` | ADMIN, SYSTEM | Info aplikasi |
| GET | `/actuator/metrics` | ADMIN, SYSTEM | Metrik Micrometer |
| GET | `/actuator/prometheus` | ADMIN, SYSTEM | Scrape Prometheus — termasuk `biru.etl.watermark.lag.seconds{etl}` |
| GET | `/docs` | **Terbuka** | Swagger UI (dapat dimatikan; default mati di produksi) |
| GET | `/v3/api-docs` | **Terbuka** | Spesifikasi OpenAPI (idem) |

`/actuator/health` sengaja terbuka: health check container tidak membawa kredensial. Rincian
kesehatan tidak ditampilkan (`show-details=never`).

---

## 10. Contoh Pemakaian

### 10.1 Alur browser (aplikasi web)

```bash
# 1. Login — simpan cookie
curl -i -c cookies.txt -X POST https://biru.bpr.local/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"budi.s","password":"…"}'

# 2. Baca nominatif kredit (cookie dikirim otomatis)
curl -b cookies.txt \
  'https://biru.bpr.local/api/v1/nominatif/loan?dateFrom=2026-07-29&dateTo=2026-07-29&limit=1000'

# 3. Halaman berikutnya
curl -b cookies.txt \
  'https://biru.bpr.local/api/v1/nominatif/loan?dateFrom=2026-07-29&dateTo=2026-07-29&limit=1000&cursor=0010019999999'

# 4. Ganti password (request pengubah data → header wajib)
curl -b cookies.txt -X POST https://biru.bpr.local/auth/change-password \
  -H 'Content-Type: application/json' -H 'X-BIRU-Client: web' \
  -d '{"oldPassword":"…","newPassword":"…"}'

# 5. Logout
curl -b cookies.txt -X POST https://biru.bpr.local/auth/logout -H 'X-BIRU-Client: web'
```

### 10.2 Alur mesin (cron / monitoring)

```bash
# Pemicu ETL dari cron luar
curl -X POST https://biru.bpr.local/etl/biru-tab-transactions \
  -H "X-API-Key: $BIRU_API_KEY"

# Backfill satu tanggal
curl -X POST 'https://biru.bpr.local/etl/biru-krd-nominatif/backfill?date=2026-07-29' \
  -H "X-API-Key: $BIRU_API_KEY"

# Rekonsiliasi
curl 'https://biru.bpr.local/etl/reconcile?date=2026-07-29&domain=TAB&domain=KRD' \
  -H "X-API-Key: $BIRU_API_KEY"

# Scrape Prometheus
curl https://biru.bpr.local/actuator/prometheus -H "X-API-Key: $BIRU_API_KEY"
```

### 10.3 Menarik seluruh transaksi satu bulan (export bertahap)

```
1. GET …/transactions/saving?dateFrom=2026-07-01&dateTo=2026-07-31&limit=1000
2. selama meta.hasMore == true:
      GET … + &cursor=<meta.nextCursor>
3. Setiap halaman tercatat sebagai satu baris QUERY di audit_log.
```

---

## 11. Ringkasan Endpoint

| # | Method | Path | Akses | Keterangan |
|---|--------|------|-------|------------|
| 1 | POST | `/auth/login` | Terbuka | Login, terbitkan cookie sesi |
| 2 | POST | `/auth/logout` | Login | Cabut sesi |
| 3 | GET | `/auth/me` | Login | Identitas sesi |
| 4 | POST | `/auth/change-password` | Login | Ganti password sendiri |
| 5 | GET | `/api/v1/transactions/saving` | Login (dibatasi kantor) | Transaksi tabungan |
| 6 | GET | `/api/v1/transactions/deposit` | Login | Transaksi deposito |
| 7 | GET | `/api/v1/transactions/loan` | Login | Transaksi kredit |
| 8 | GET | `/api/v1/nominatif/saving` | Login | Nominatif tabungan |
| 9 | GET | `/api/v1/nominatif/deposit` | Login | Nominatif deposito |
| 10 | GET | `/api/v1/nominatif/loan` | Login | Nominatif kredit |
| 11 | GET | `/api/v1/customers` | Login | Daftar nasabah per kantor |
| 12 | GET | `/api/v1/customers/{cif}` | Login | Detail nasabah |
| 13–24 | POST | `/etl/biru-{tab,dep,krd}-{transactions,nominatif}[/backfill]` | OPS/ADMIN/SYSTEM | 6 pemicu + 6 backfill |
| 25 | GET | `/etl/status` | Login | Status watermark & kesegaran data |
| 26 | GET | `/etl/reconcile` | OPS/ADMIN/SYSTEM | Rekonsiliasi CORE↔BIRU |
| 27 | GET | `/api/v1/admin/users` | ADMIN | Daftar akun |
| 28 | POST | `/api/v1/admin/users` | ADMIN | Buat akun |
| 29 | PATCH | `/api/v1/admin/users/{id}` | ADMIN | Ubah akun |
| 30 | POST | `/api/v1/admin/users/{id}/reset-password` | ADMIN | Reset password |
| 31 | GET | `/api/v1/admin/audit` | ADMIN | Jejak audit |
| 32 | GET | `/actuator/health` | Terbuka | Health check |
| 33 | GET | `/actuator/{info,metrics,prometheus}` | ADMIN/SYSTEM | Metrik |
| 34 | GET | `/docs`, `/v3/api-docs` | Terbuka (dapat dimatikan) | Dokumentasi API |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 30 Juli 2026 | | Dokumen dibuat |

---

*[← Kembali ke BIRU App](README.md)* · *[Daftar Produk](../../README.md)*

*Dikelola dengan **Analyst CLI**.*
