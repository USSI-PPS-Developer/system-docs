# 🔌 API Integration / Consumption Reference — IBS Onboarding Admin

> Peta **konsumsi API**: endpoint backend mana yang di-*fire* tiap halaman dashboard admin.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS Onboarding Admin |
| Jenis Dokumen     | API Integration / Consumption Reference |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 17 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 0. Mengapa bukan "API Contract" penuh?

> **Pertanyaan desain:** *"Admin cuma nembak API — apakah masih perlu API Contract?"*

**Tidak perlu menulis ulang kontrak.** Aplikasi ini adalah **konsumen** API, bukan penyedianya.
Kontrak request/response kanonik (skema field, kode error, aturan enkripsi, header) **dimiliki dan
dipelihara backend** di
**[`ibs-onboarding-backend/03-api-contract.md`](../ibs-onboarding-backend/03-api-contract.md)** —
itulah *single source of truth*. Menduplikasinya di sini justru menimbulkan risiko dokumen
kembar yang saling bertentangan.

Yang **memang dibutuhkan** untuk sisi frontend adalah dokumen **integrasi/konsumsi**: pemetaan
*"halaman/aksi X → memanggil endpoint Y dengan method & body Z"*, plus catatan lintas-potong
(base URL, enkripsi, auth, upload). Itulah isi dokumen ini. Untuk skema payload detail tiap
endpoint, ikuti tautan ke kontrak backend.

## 1. Informasi Umum

| Item | Nilai |
|------|-------|
| Base URL | `import.meta.env.VITE_BACKEND_URL` — default **`/api`** (di-proxy nginx ke `backend-onboard:8855`); alternatif URL publik penuh |
| Format | JSON (UTF-8); Banner memakai `multipart/form-data` |
| Kanonik kontrak | [IBS Onboarding Backend — API Contract](../ibs-onboarding-backend/03-api-contract.md) |
| Klien HTTP | `fetch` bawaan browser |

## 2. Konvensi Lintas-Potong

### 2.1 Enkripsi respons (WAJIB dipahami frontend)
Respons **sukses** backend membungkus data dalam field **`responseData` terenkripsi (AES kunci
harian)** + `keyVersion`. Frontend **mendekripsi** sebelum memakai data:

```
kunci   = SHA256("IBS-ONBOARD-SECRET-KEY" + keyVersion).substring(0,32)   // AES-256
mode    = ECB, padding = PKCS7
plaintext = AES.decrypt(responseData, kunci)  → JSON.parse
```
Implementasi: `src/utils/decrypt.ts` → `decryptPayload()` & helper `decode(res)`.
Respons **error** dikirim polos (tidak terenkripsi).

Bentuk amplop respons (dari backend `ResponseBuilder`):
```json
{ "responseCode": "00", "responseMessage": "Berhasil", "keyVersion": "2026-07-17", "responseData": "<AES-Base64>" }
```

### 2.2 Autentikasi
- Login admin mengembalikan **token (UUID)** di dalam `responseData` terenkripsi → disimpan di
  `localStorage` (`ibs_admin_token`).
- Header `Authorization: Bearer <token>` **dikirim pada endpoint `/dashboard/*`**. Endpoint
  lainnya saat ini dipanggil tanpa header token (mengikuti perilaku `permitAll` backend — lihat
  kontrak backend §2.4). Kontrol akses nyata bergantung pada **pembatasan jaringan/reverse
  proxy**.

### 2.3 File statis (foto/gambar)
Foto & dokumen diakses langsung sebagai file: `{VITE_BACKEND_URL}/{path_relatif}` — mis.
`{BACKEND}/uploads/ktp/xxx.jpg`. Dibangun oleh helper `fotoUrl()` di tiap halaman.

## 3. Peta Konsumsi Endpoint per Halaman

> Path relatif terhadap base URL. Untuk skema field detail → kontrak backend.

### 3.1 Login — `src/stores/auth.ts`
| Aksi | Method | Endpoint | Body | Catatan |
|------|--------|----------|------|---------|
| Login admin | POST | `/admin/login` | `{username, password}` | `responseData` didekripsi → `{token, nama, id, kode_kantor, username}` |

### 3.2 Dashboard — `pages/DashboardHome.tsx`  *(header `Authorization: Bearer`)*
| Aksi | Method | Endpoint |
|------|--------|----------|
| Rekap registrasi akun | GET | `/dashboard/registrasi-akun` |
| Rekap akun aktif | GET | `/dashboard/akun-aktif` |
| Aktivasi belum diproses | GET | `/dashboard/aktivasi-belum-diproses` |
| Registrasi belum diproses | GET | `/dashboard/registrasi-belum-diproses` |
| Rekap blacklist | GET | `/dashboard/blacklist` |
| Rekap pengajuan rekening | GET | `/dashboard/pengajuan-rekening` |

### 3.3 Manajemen Akun — `pages/Account.tsx`
| Aksi | Method | Endpoint | Body |
|------|--------|----------|------|
| Daftar user | GET | `/user` | — |
| Detail user | GET | `/user/{id}` | — |
| Ubah status | PATCH | `/user/{id}/status` | `{status}` |
| Reset password | PATCH | `/user/{id}/reset-password` | — |
| Unblock | PATCH | `/user/{id}/unblock` | — |
| Hapus | DELETE | `/user/{id}` | — |

### 3.4 Manajemen Registrasi — `pages/RegisterAccount.tsx`
| Aksi | Method | Endpoint | Body |
|------|--------|----------|------|
| Daftar registrasi | GET | `/register` | — |
| Detail registrasi | GET | `/register/{id}` | — |
| Approve | POST | `/register/{id}/approve` | — |
| Reject | POST | `/register/{id}/reject` | `{alasan}` |
| Foto KTP/selfie | GET | `{BACKEND}/{foto}` | — |

### 3.5 Manajemen Aktivasi (OTP) — `pages/AktivasiAccount.tsx`
| Aksi | Method | Endpoint |
|------|--------|----------|
| Daftar antrean | GET | `/otp/list` |
| Preview | GET | `/otp/preview?id={id}` |
| Generate OTP | POST | `/otp/generate?id={id}` |
| Hapus | DELETE | `/otp/delete?id={id}` |
| Foto | GET | `{BACKEND}/{foto}` |

### 3.6 Pengajuan Rekening — Tabungan / Deposito / Kredit
`pages/RekeningTabungan(+Detail).tsx`, `RekeningDeposito(+Detail).tsx`, `RekeningKredit(+Detail).tsx`,
`ApprovePengajuan{Tab,Deposito,Kredit}Form.tsx`.

| Aksi | Method | Endpoint (Tabungan) | Endpoint (Deposito) | Endpoint (Kredit) | Body |
|------|--------|---------------------|---------------------|-------------------|------|
| Daftar | GET | `/pengajuan-tabungan` | `/pengajuan-deposito` | `/pengajuan-kredit` | — |
| Detail | GET | `/pengajuan-tabungan/{id}` | `/pengajuan-deposito/{id}` | `/pengajuan-kredit/{id}` | — |
| Approve | PUT | `/pengajuan-tabungan/{id}/status` | `/pengajuan-deposito/{id}/status` | `/pengajuan-kredit/{id}/status` | `{status:"APPROVED", ...data produk/kantor}` |
| Reject | PUT | `…/{id}/status` | `…/{id}/status` | `…/{id}/status` | `{status:"REJECTED", alasan}` |
| Master produk | GET | `/tab-produk` | `/dep-produk` | `/kredit-produk` | — |
| Master kantor | GET | `/kode-kantor` | `/kode-kantor` | `/kode-kantor` | — |
| Dokumen | GET | `{BACKEND}/{foto}` | `{BACKEND}/{foto}` | `{BACKEND}/{foto}` | — |

> Approve pengajuan → backend meng-*generate* CIF (bila nasabah baru) + `no_rekening` dan
> **memposting rekening ke Core Banking**. Frontend hanya mengirim keputusan + data pelengkap.

### 3.7 Manajemen Blacklist — `pages/Blacklist.tsx`
| Aksi | Method | Endpoint | Body |
|------|--------|----------|------|
| Daftar | GET | `/blacklist` | — |
| Tambah/Ubah | POST / PUT | `/blacklist` (`/blacklist/{id}` untuk ubah) | `{...form}` (device/NIK/no HP/username + alasan) |
| Hapus | DELETE | `/blacklist/{id}` | — |

### 3.8 Manajemen Banner — `pages/Banner.tsx`, `BannerForm.tsx`
| Aksi | Method | Endpoint | Body |
|------|--------|----------|------|
| Daftar | GET | `/banner/all` | — |
| Tambah/Ubah | POST / PUT | `/banner` (`/banner/{id}` untuk ubah) | `multipart/form-data`: `title, detail, image(File), start_date, end_date, status` |
| Hapus | DELETE | `/banner/{id}` | — |
| Gambar | GET | `{BACKEND}/{image}` | — |

## 4. Ringkasan Endpoint yang Dikonsumsi

`/admin/login` · `/dashboard/*` (6) · `/user`, `/user/{id}[/status|/reset-password|/unblock]` ·
`/register`, `/register/{id}[/approve|/reject]` · `/otp/{list,preview,generate,delete}` ·
`/pengajuan-{tabungan,deposito,kredit}[/{id}[/status]]` · `/tab-produk`, `/dep-produk`,
`/kredit-produk`, `/kode-kantor` · `/blacklist[/{id}]` · `/banner/all`, `/banner[/{id}]` ·
serve file `{BACKEND}/{path}`.

## 5. Catatan Verifikasi (untuk diselaraskan dengan tim backend)

- Method **Tambah/Ubah** Blacklist & Banner disimpulkan dari pola UI (create vs update) —
  konfirmasi POST vs PUT & path `{id}` pada kontrak backend.
- Endpoint non-`/dashboard` saat ini dipanggil **tanpa** header `Authorization`; bila backend
  memperketat AuthZ, frontend perlu menambahkan header pada semua request.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dibuat dari pemetaan pemanggilan `fetch` di kode `admin-onboard`. |

---

*[← Kembali ke IBS Onboarding Admin](README.md)* · *[Kontrak API Backend](../ibs-onboarding-backend/03-api-contract.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
