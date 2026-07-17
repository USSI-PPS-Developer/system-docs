# 🔌 API Contract — IBS Onboarding Backend

> Kontrak API (request/response) untuk produk **IBS Onboarding Backend** — endpoint aplikasi onboarding nasabah IBS (registrasi, aktivasi, pengajuan rekening) & back-office admin.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS Onboarding Backend |
| Jenis Dokumen     | API Contract        |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 17 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Informasi Umum

| Item | Nilai |
|------|-------|
| Base URL (Dev)  | `http://<host>:8855` |
| Context Path | *(tidak ada — root)* |
| Versi API | `v1` |
| Format | JSON (UTF-8); sebagian endpoint `multipart/form-data` (upload) |
| Autentikasi (Spring Security) | ⚠️ `permitAll` — semua endpoint publik (lihat §2.4) |
| Autentikasi aplikatif | Login manual (user/admin) + header device; `token` = UUID (tidak diverifikasi) |
| Dokumentasi Interaktif | Swagger UI: `/swagger-ui.html` · OpenAPI: `/v3/api-docs` |

> **Catatan penting:** field `responseData` pada respons **sukses** dikembalikan dalam bentuk
> **terenkripsi** (AES kunci harian) beserta `keyVersion`. Respons **error** dikirim polos
> (tidak terenkripsi). Lihat §2.3 & §2.5.

---

## 2. Konvensi

### 2.1 Header Standar

| Header | Wajib | Contoh | Keterangan |
|--------|-------|--------|------------|
| `Content-Type` | Ya | `application/json` atau `multipart/form-data` | Sesuai jenis endpoint |
| `X-Device-Id` | Kondisional | `abc-123-device` | Identitas perangkat (register, OTP, aktivasi, login) |
| `X-Device-Name` | Kondisional | `Samsung A52` | Nama perangkat (register, OTP, aktivasi) |

> Tidak ada header token/authorization yang diverifikasi server. `token` yang dikembalikan saat
> login berupa `UUID` acak dan **tidak** divalidasi pada request berikutnya (lihat §2.4).

### 2.2 Format Response Standar

Dibangun oleh `ResponseBuilder` (mayoritas controller) — mengembalikan `Map<String,Object>`:

Sukses:
```json
{
  "responseCode": "00",
  "responseMessage": "Berhasil",
  "keyVersion": "2026-07-17",
  "responseData": "<string AES-encrypted (Base64) dari JSON data>"
}
```

Gagal (bisnis / validasi / sistem):
```json
{
  "responseCode": "02",
  "responseMessage": "Password salah",
  "responseData": {}
}
```

> Beberapa endpoint JPA-style & `GlobalExceptionHandler` memakai POJO `ApiResponse`
> (`{ responseCode, responseMessage, responseData }`) tanpa `keyVersion` dan tanpa enkripsi.

### 2.3 Enkripsi Payload (responseData)

- **Respons sukses**: `responseData` = `Base64( AES/ECB/PKCS5( JSON(data), dailyKey ) )`.
- **Kunci harian**: `dailyKey = SHA-256( "IBS-ONBOARD-SECRET-KEY" + <keyVersion> )` diambil
  **32 karakter pertama** (`DailyKeyProvider`). `keyVersion` = tanggal (mis. `2026-07-17`).
- **Klien** mendekripsi dengan menurunkan kunci dari `keyVersion` yang diterima, lalu
  `AES/ECB/PKCS5` decrypt + parse JSON.
- **Respons error tidak dienkripsi**.

> ⚠️ Catatan keamanan: skema AES-ECB dengan kunci turunan tanggal (dan `AESUtil` untuk OTP
> memakai kunci statis) tergolong lemah secara kriptografis. Direkomendasikan peninjauan
> (mode AES-GCM + kunci yang dikelola aman) — lihat SRS NFR-002/NFR-004.

### 2.4 Catatan Keamanan Endpoint (Known Gap)

- `SecurityConfig`: `anyRequest().permitAll()`, CSRF **disabled**, CORS `*` dengan
  `allowCredentials(true)`. **Seluruh endpoint (termasuk admin/CRUD) publik.**
- Login membandingkan password **plaintext** terhadap kolom DB; `token` login = `UUID.randomUUID()`.
- **Rekomendasi operasional**: batasi akses jaringan ke service (reverse proxy + allowlist/VPN),
  dan rencanakan penguatan AuthN/AuthZ. Dokumen ini mencatat perilaku **apa adanya**.

### 2.5 Kode Response (`ResponseCode`)

| Kode | Arti umum |
|------|-----------|
| `00` | Berhasil |
| `01` | Input tidak valid / kredensial salah *(ad-hoc per endpoint)* |
| `02` | Data tidak ditemukan / password salah / duplikasi *(ad-hoc)* |
| `03` | User tidak aktif / blacklist *(ad-hoc)* |
| `04` | Data tidak ditemukan *(ad-hoc)* |
| `05` | Data sudah ada |
| `06` | Request tidak valid |
| `07` | Sudah login / username tidak terdaftar *(ad-hoc)* |
| `08` | Device diblokir *(ad-hoc)* |
| `96` | Token tidak valid |
| `97` | Network error |
| `98` | Database error / data tidak ditemukan |
| `99` | System error |

> **Kode `01`–`12` dipakai ad-hoc** per endpoint dan tidak selalu konsisten dengan makna
> konstanta di atas. Andalkan `responseMessage` + konteks endpoint, bukan hanya kode.

---

## 3. Daftar Endpoint

| # | Method | Endpoint | Deskripsi | Auth |
|---|--------|----------|-----------|------|
| 1 | POST | `/api/register` | Registrasi nasabah baru (multipart) | Publik |
| 2 | GET | `/api/register` | List registrasi | Admin |
| 3 | GET | `/api/register/{id}` | Detail registrasi | Admin |
| 4 | POST | `/api/register/{id}/approve` | Approve registrasi (→ OTP) | Admin |
| 5 | POST | `/api/register/{id}/reject` | Reject registrasi | Admin |
| 6 | POST | `/api/otp/request` | Request OTP (multipart) | Publik |
| 7 | GET | `/api/otp/list` | List OTP (filter nik/no_hp) | Admin |
| 8 | GET | `/api/otp/preview` | Detail OTP by id | Admin |
| 9 | DELETE | `/api/otp/delete` | Hapus OTP by id | Admin |
| 10 | POST | `/api/otp/generate` | Generate/update OTP by id | Admin |
| 11 | POST | `/api/aktivasi` | Aktivasi akun dengan OTP | Publik |
| 12 | POST | `/api/login` | Login user aplikasi | Publik |
| 13 | POST | `/api/admin/login` | Login admin back-office | Publik |
| 14 | POST | `/api/password/change` | Ganti password | Publik |
| 15 | POST | `/api/pengajuan-tabungan` | Submit pengajuan tabungan (multipart) | Publik |
| 16 | GET | `/api/pengajuan-tabungan` | List pengajuan tabungan | Admin |
| 17 | GET | `/api/pengajuan-tabungan/{id}` | Preview pengajuan tabungan | Admin |
| 18 | PUT | `/api/pengajuan-tabungan/{id}/status` | Update status (approve → posting Core) | Admin |
| 19 | POST | `/api/pengajuan-deposito` | Submit pengajuan deposito (multipart) | Publik |
| 20 | GET | `/api/pengajuan-deposito` | List pengajuan deposito | Admin |
| 21 | GET | `/api/pengajuan-deposito/{id}` | Preview pengajuan deposito | Admin |
| 22 | PUT | `/api/pengajuan-deposito/{id}/status` | Update status (approve → posting Core) | Admin |
| 23 | POST | `/api/pengajuan-kredit` | Submit pengajuan kredit (multipart) | Publik |
| 24 | GET | `/api/pengajuan-kredit` | List pengajuan kredit | Admin |
| 25 | GET | `/api/pengajuan-kredit/{id}` | Preview pengajuan kredit | Admin |
| 26 | PUT | `/api/pengajuan-kredit/{id}/status` | Update status (approve → posting Core) | Admin |
| 27 | GET | `/api/pengajuan/cekstatus/{user_id}` | Status gabungan pengajuan per user | Publik |
| 28 | GET | `/api/pengajuan/detail` | Detail pengajuan (jenis + no_pengajuan) | Publik |
| 29 | POST | `/api/saldo/cek` | Cek saldo banyak akun | Publik |
| 30 | POST | `/api/saldo` | Cek saldo satu akun | Publik |
| 31 | POST | `/api/mutasi` | Mutasi rekening | Publik |
| 32 | POST | `/api/analisa` | Analisa finansial bulanan | Publik |
| 33 | GET | `/api/tab-produk` · `/{kodeProduk}` | Produk tabungan (list/detail) | Publik |
| 34 | GET | `/api/dep-produk` · `/{kodeProduk}` | Produk deposito (list/detail) | Publik |
| 35 | GET | `/api/kredit-produk` · `/{kodeProduk}` | Produk kredit (list/detail) | Publik |
| 36 | GET | `/api/kode-kantor` | List kode kantor | Publik |
| 37 | GET | `/api/info-kantor` | Info & lokasi kantor | Publik |
| 38 | GET | `/api/banner` · `/all` · `/{id}` | Banner (aktif/semua/detail) | Publik |
| 39 | POST/PUT/DELETE | `/api/banner` · `/{id}` | Kelola banner (multipart) | Admin |
| 40 | GET/POST/PUT/DELETE | `/api/blacklist` · `/{id}` | Kelola blacklist | Admin |
| 41 | GET/PUT/PATCH/DELETE | `/api/user` · `/{id}` · … | Manajemen user | Admin |
| 42 | GET | `/api/dashboard/*` | Rekap dashboard | Admin |
| 43 | GET | `/api/uploads/{filename}` | Serve file upload | Publik |

> Kolom "Auth" bersifat **peran fungsional** (klien vs back-office); secara teknis semua
> endpoint `permitAll` (lihat §2.4).

---

## 4. Detail Endpoint (Utama)

### 4.1 Registrasi & Approval

#### `POST /api/register` — Registrasi nasabah *(multipart/form-data)*
**Form fields:** `nik`, `nama`, `tempat_lahir`, `tgl_lahir`, `jenis_kelamin`, `no_hp`, `email`,
`alamat`, `nama_ibu`, file `foto_selfie`, file `foto_ktp`. **Header:** `X-Device-Id`, `X-Device-Name`.

Validasi: blacklist device/NIK; cek device/NIK/no HP sudah aktif di `obd_user`; cek nasabah
existing. Sukses → insert `obd_register` status `PENDING`.

**Response sukses (`00`)** — `responseData` (terenkripsi) berisi id registrasi.
**Error:** `01` (input), `02`, `06`, `08` (device blocked), `98`, `99`.

#### `POST /api/register/{id}/approve` — Approve registrasi
Ambil data register → insert `obd_aktivasi` status `DONE` dengan OTP acak (di-AES) → update
register `APPROVED`. **Response:** `{ id, otp }` (OTP plaintext untuk disampaikan ke nasabah).

#### `POST /api/register/{id}/reject` — Reject registrasi
Update status `REJECTED`.

#### `GET /api/register` · `GET /api/register/{id}`
List / detail data registrasi (back-office).

### 4.2 OTP

#### `POST /api/otp/request` — Request OTP *(multipart/form-data)*
**Form fields:** `nik`, `no_hp`, file `foto_ktp` (opsional), file `foto_selfie` (opsional).
**Header:** `X-Device-Id`, `X-Device-Name`.
Validasi: device/nik/no_hp sudah terdaftar, blacklist, **foto wajib**, **rate-limit 3×/hari**,
**double-submit 24 jam**, verifikasi nasabah → insert `obd_aktivasi` status `PENDING`.
**Response:** `{ otp: null, device_id }`.

#### `GET /api/otp/list` — List OTP
Query param opsional: `nik`, `no_hp`.

#### `GET /api/otp/preview?id=` · `DELETE /api/otp/delete?id=`
Detail / hapus OTP by query param `id`.

#### `POST /api/otp/generate?id=` — Generate/update OTP
Set status `DONE`, OTP baru (di-AES). **Response:** `{ otp, device_id }`.

### 4.3 Aktivasi

#### `POST /api/aktivasi` — Aktivasi akun
**Body JSON:** `otp`, `nik`, `noHp`, `username`, `password`. **Header:** `X-Device-Id`, `X-Device-Name`.
Validasi: blacklist, double-submit 24 jam, unik `username`/`nik`/`device`, verifikasi OTP dari
`obd_aktivasi` (status DONE, OTP di-AES) → insert `obd_user` status `ACTIVE`.
**Error:** `01`–`10`, `99`.

### 4.4 Autentikasi

#### `POST /api/login` — Login user
**Body JSON:** `username`, `password`. **Header opsional:** `X-Device-Id`.

**Response sukses (`00`)** — `responseData` (terenkripsi) contoh struktur:
```json
{
  "user_id": 12,
  "username": "budi",
  "fullName": "BUDI SANTOSO",
  "email": "budi@mail.com",
  "hp": "081234567890",
  "alamat": "JL. MERDEKA NO. 1",
  "nik": "3201010101010001",
  "tempatLahir": "BANDUNG",
  "tglLahir": "19850510",
  "nama_ibu_kandung": "SITI AMINAH",
  "device_id": "abc-123",
  "device_name": "Samsung A52",
  "foto_ktp": "<path/base64>",
  "foto_selfie": "<path/base64>",
  "accounts": [ { "no_rekening": "001...", "jenis": "TAB", "...": "..." } ],
  "products": [ { "kode_produk": "01", "jenis": "TAB", "...": "..." } ],
  "token": "<uuid>",
  "reset_pass": 0,
  "isLoggedIn": true
}
```
**Error:** `01` (input), `02` (password salah), `03` (blacklist), `04` (inactive/locked),
`05` (terkunci 15 menit), `06` (terkunci 3× gagal), `07` (username tak terdaftar),
`08` (device blocked), `99`.

#### `POST /api/admin/login` — Login admin *(DB sys)*
**Body JSON:** `username`, `password`. Query `sys_daftar_user` (username BINARY case-sensitive,
cek `user_web_password`). **Response sukses:** `{ id, username, nama, kode_kantor, token(uuid), isLoggedIn }`.
**Error:** `01` (input kosong), `02` (password salah), `07` (tak terdaftar), `99`.

#### `POST /api/password/change` — Ganti password
**Body JSON:** `username`, `old_password`, `new_password`. Validasi password lama, set `reset_pass=0`.
**Error:** `01`, `02`, `03`, `04`, `99`.

### 4.5 Pengajuan Rekening

> Semua submit memakai `multipart/form-data`; nomor pengajuan = `<PREFIX>` + `yyyyMMdd` + `NNN`
> (`TAB`/`DEP`/`KRE`). Submit ditolak (`02`) bila sudah ada pengajuan **PENDING** untuk user.

#### `POST /api/pengajuan-tabungan`
**Form fields:** `produk`, `setoranAwal`, `nik`, `hp`, `user_id`, file `fotoKtp`, file `fotoSelfie`.

#### `POST /api/pengajuan-deposito`
**Form fields:** `jangkaWaktu`, `setoranAwal` (→ `nominal_penempatan`), `nik`, `hp`, `user_id`,
file `fotoKtp`, file `fotoSelfie`.

#### `POST /api/pengajuan-kredit`
**Form fields:** `tujuan`, `jangkaWaktu`, `nominalPinjaman`, `penghasilan`, `pendidikan`,
`tempatKerja`, `alamatKerja`, `nominalLain` (opsional), `jenisAgunan`, `deskripsiAgunan`,
`nik`, `hp`, `user_id`; file (opsional): `fotoAgunan1..5`, `fotoKK`, `fotoKtp`, `fotoSelfie`, `fotoNpwp`.

#### `GET /api/pengajuan-{jenis}` · `GET /api/pengajuan-{jenis}/{id}`
List / preview pengajuan (back-office).

#### `PUT /api/pengajuan-{jenis}/{id}/status` — Update status
**Body JSON (umum):** `status` (`APPROVED`/`REJECTED`/`PENDING`, wajib), `alasan`, `kode_produk`,
`fullName`, `id_user`, `alamat`, `tglLahir`, `tempatLahir`, `email`, `tgl_register`, `hp`, `nik`,
`nama_ibu_kandung`, `kode_kantor`, dan field khusus jenis:
- **Tabungan:** `setoran_awal`.
- **Deposito:** `suku_bunga`, `nominal_penempatan`, `jangka_waktu`.
- **Kredit:** `suku_bunga`, `nominal_pinjaman`, `jangka_waktu`, `no_pengajuan`.

Bila `APPROVED`: buat `nasabah` (bila belum ada `cif`, via `GENERATE_NASABAH_ID`) → propagasi
`cif` ke `obd_user`/`obd_aktivasi` → generate `no_rekening` (stored function per jenis) → insert
`tabung`/`deposito`/`kredit`. **Response sukses:** dapat berisi `cif`, `no_rekening`.

#### `GET /api/pengajuan/cekstatus/{user_id}`
Gabungan status TAB+DEP+KRE. **Response array:** `{ jenis, id, no_pengajuan, status, created_at, updated_at }`.

#### `GET /api/pengajuan/detail?jenis=&no_pengajuan=`
`jenis` = `TABUNGAN`/`DEPOSITO`/`KREDIT`. **Error:** `01`, `04`, `99`.

### 4.6 Saldo, Mutasi & Analisa

#### `POST /api/saldo/cek` — Cek saldo multi-akun
**Body JSON:** `{ "accounts": [ { "no": "001234" }, ... ] }`. Tiap norek dicoba
`tabung`→`deposito`→`kredit`. **Response array:** `{ no, saldo, tipe }` (tipe `TAB`/`DEP`/`KRE`/
`TIDAK_DITEMUKAN`/`ERROR`).

#### `POST /api/saldo` — Cek saldo satu akun
**Body JSON:** `no_rekening`, `jenis` (`TAB`/`DEP`/`KRE`). **Response:** `{ no_rekening, jenis, saldo }`.
**Error:** `01`, `02`, `03`, `99`.

#### `POST /api/mutasi` — Mutasi rekening
**Body JSON:** `no_rekening`, `jenis` (`TAB`/`DEP`/`KRE`), `start_date`, `end_date`.
Mapping: TAB→`tabtrans` (`pokok`), DEP→`deptrans` (`pokok_trans`), KRE→`kretrans` (`pokok`).
**Response:** `{ mutasi: [ { tgl_trans, kode, keterangan, kredit, debit } ], saldo_awal, saldo_akhir }`.
**Error:** `01`, `02`, `99`.

#### `POST /api/analisa` — Analisa finansial bulanan
**Body JSON:** `nik`, `no_hp`, `period` (`YYYY-MM`). Ambil `cif` dari `nasabah`, rekening dari
`tabung`, agregasi `tabtrans` (income/expense via `floor(my_kode_trans/100)`).
**Response:** `{ month, year, totalIncome, totalExpense, balance, incomePercentage, expensePercentage, transactions[] }`.
**Error:** `01`, `02`, `99`.

### 4.7 Master & Referensi

| Endpoint | Deskripsi | Response utama |
|----------|-----------|----------------|
| `GET /api/tab-produk` · `/{kodeProduk}` | Produk tabungan | `kode_produk, deskripsi_produk, suku_bunga_default, ...` |
| `GET /api/dep-produk` · `/{kodeProduk}` | Produk deposito | `kode_produk, deskripsi_produk, suku_bunga_default, jkw_default` |
| `GET /api/kredit-produk` · `/{kodeProduk}` | Produk kredit | `kode_produk, deskripsi_produk, suku_bunga_default, type_kredit_default` |
| `GET /api/kode-kantor` | List kantor | `kode_kantor, nama_kantor` |
| `GET /api/info-kantor` | Info & lokasi kantor | `id, name, latitude, longitude, address, phone` |

Detail produk mengembalikan error `01` bila kode tidak ditemukan.

### 4.8 Banner *(back-office; multipart untuk create/update)*

| Method | Endpoint | Fields |
|--------|----------|--------|
| GET | `/api/banner` | Banner AKTIF (status ACTIVE + rentang tanggal) |
| GET | `/api/banner/all` | Semua banner |
| GET | `/api/banner/{id}` | Detail by id |
| POST | `/api/banner` | `title`, `detail`, `start_date`?, `end_date`?, `status`(def ACTIVE), file `image`? |
| PUT | `/api/banner/{id}` | Sama seperti create |
| DELETE | `/api/banner/{id}` | Hapus |

**Error umum:** `98` (tidak ditemukan/gagal), `99`.

### 4.9 Blacklist *(back-office)*

| Method | Endpoint | Body |
|--------|----------|------|
| GET | `/api/blacklist` · `/{id}` | List / detail |
| POST | `/api/blacklist` | `value`, `type` (`DEVICE_ID`/`NIK`/`NO_HP`/`USERNAME`/`ALL`), `reason` |
| PUT | `/api/blacklist/{id}` | `value`, `type`, `reason` |
| DELETE | `/api/blacklist/{id}` | Hapus |

**Error:** `01` (validasi), `98`, `99`.

### 4.10 Manajemen User *(back-office)*

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/user` · `/{id}` | List / detail |
| PUT | `/api/user/{id}` | Update `username`, `nik`, `no_hp`, `device_id`, `device_name` |
| PATCH | `/api/user/{id}/status` | Ubah `status` (`ACTIVE`/`INACTIVE`/`LOCKED`) |
| DELETE | `/api/user/{id}` | Hapus |
| PATCH | `/api/user/{id}/unblock` | Reset `login_attempt=0`, `last_failed_login=NULL`, `is_locked=0` |
| PATCH | `/api/user/{id}/reset-password` | Reset ke default `onboard456` (SHA-256 salted), `reset_pass=1`; response berisi password default |

### 4.11 Dashboard *(back-office)*

| Endpoint | Response |
|----------|----------|
| `GET /api/dashboard/registrasi-akun` | `{ total }` — COUNT `obd_user` |
| `GET /api/dashboard/akun-aktif` | `{ total }` — `obd_user` ACTIVE |
| `GET /api/dashboard/aktivasi-belum-diproses` | `{ total }` — `obd_aktivasi` PENDING |
| `GET /api/dashboard/registrasi-belum-diproses` | `{ total }` — `obd_register` PENDING |
| `GET /api/dashboard/aktivasi-akun/done` | `{ total }` — `obd_aktivasi` APPROVED |
| `GET /api/dashboard/blacklist` | `{ total }` — COUNT `obd_blacklist` |
| `GET /api/dashboard/pengajuan-rekening` | `{ tabungan, deposito, kredit }` — PENDING per jenis |

### 4.12 File

#### `GET /api/uploads/{filename:.+}`
Menyajikan file biner dari folder `uploads/` (inline). Bila tidak ditemukan → JSON
`{ responseCode: "99", ... }` (HTTP 200, bukan format terenkripsi).

---

## 5. Kode Status & Pesan

| HTTP | responseCode | Konteks | Contoh |
|------|--------------|---------|--------|
| 200 | `00` | Operasi berhasil | Login sukses, pengajuan tersimpan (`responseData` terenkripsi) |
| 200 | `01`–`08` | Kegagalan bisnis/validasi (ad-hoc) | `Password salah`, `Username tidak terdaftar`, `Device diblokir`, `Sudah ada pengajuan PENDING` |
| 200 | `98` | Database error / data tidak ditemukan | `Data tidak ditemukan` |
| 200 | `99` | System error | `Terjadi kesalahan sistem` |

> Seluruh respons memakai **HTTP 200**; status sukses/gagal ditentukan oleh `responseCode`.
> `GlobalExceptionHandler` mengembalikan `ApiResponse.error("01"/"99", ...)` untuk exception.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dokumen dibuat berdasarkan implementasi controller, `ResponseBuilder`, & `SecurityConfig`. |

---

*[← Kembali ke IBS Onboarding Backend](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
