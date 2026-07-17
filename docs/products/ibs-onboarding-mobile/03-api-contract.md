# 🔌 API Integration / Consumption Reference — IBS Onboarding Mobile

> Peta **konsumsi API**: endpoint backend mana yang di-*fire* tiap layar aplikasi mobile, plus konvensi lintas-potong (enkripsi, header device, hashing, upload).

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS Onboarding Mobile |
| Jenis Dokumen     | API Integration / Consumption Reference |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 17 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 0. Mengapa bukan "API Contract" penuh?

> **Pertanyaan desain:** *"Aplikasi mobile cuma nembak API — apakah masih perlu API Contract?"*

**Tidak perlu menulis ulang kontrak.** Aplikasi ini adalah **konsumen** API, bukan penyedianya.
Kontrak request/response kanonik (skema field, kode error, aturan enkripsi, header) **dimiliki dan
dipelihara backend** di
**[`ibs-onboarding-backend/03-api-contract.md`](../ibs-onboarding-backend/03-api-contract.md)** —
itulah *single source of truth*. Dokumen di sini adalah **integrasi/konsumsi**: pemetaan
*"layar/aksi X → memanggil endpoint Y dengan method & body Z"*, ditambah catatan lintas-potong
(base URL & failover, enkripsi, header device, hashing kredensial, upload multipart).

Seluruh integrasi terpusat di **`utils/api.ts`**. Untuk skema payload detail tiap endpoint,
ikuti tautan ke kontrak backend.

## 1. Informasi Umum

| Item | Nilai |
|------|-------|
| Base URL | `Constants.expoConfig.extra.API_BASE_URLS` — **daftar host** dipisah koma (mis. `https://apionboarding.ppsrnd.cloud/api`) |
| Failover | Tiap fungsi **iterasi** daftar host; pindah host bila error jaringan, **berhenti** bila ada `err.response` (error server = final) |
| Format | JSON (UTF-8); upload foto memakai `multipart/form-data` |
| Klien HTTP | `axios` (instance per host, `utils/api.ts` → `getApiInstance`) |
| Kanonik kontrak | [IBS Onboarding Backend — API Contract](../ibs-onboarding-backend/03-api-contract.md) |

## 2. Konvensi Lintas-Potong

### 2.1 Header perangkat (WAJIB, disuntik tiap request)
Interceptor `getApiInstance()` menambahkan pada **semua** request:
```
X-Device-Id:   <deviceId>      // IDFV (iOS) / Android ID / UUID, dari SecureStore
X-Device-Name: <brand> <model> // mis. "samsung SM-A125F"
Accept: application/json
```
Sumber: `useDeviceInfoStore` (diisi `getDeviceInfo()` saat app start). Dipakai backend untuk
penyaringan/blacklist perangkat.

### 2.2 Enkripsi respons (WAJIB dipahami klien)
Respons **sukses** membungkus data dalam field **`responseData` terenkripsi (AES kunci harian)** +
`keyVersion`. Klien **mendekripsi** sebelum memakai data:
```
kunci   = SHA256("IBS-ONBOARD-SECRET-KEY" + keyVersion).substring(0,32)   // AES-256
mode    = ECB, padding = PKCS7
plaintext = AES.decrypt(responseData, kunci)  → JSON.parse
```
Implementasi: `utils/decryptResponse.ts` → `decryptPayload()`; dipanggil oleh `parseApiResponse()`.
Respons **error** dikirim polos (tidak terenkripsi).

Bentuk amplop & parsing (`parseApiResponse` di `utils/api.ts`):
```json
{ "responseCode": "00", "responseMessage": "Berhasil", "keyVersion": "2026-07-17", "responseData": "<AES-Base64>" }
```
→ `{ success: responseCode === "00", data, code, message, raw }`.

### 2.3 Hashing kredensial (sebelum kirim)
Password **tidak pernah** dikirim polos. Di-hash via `expo-crypto`:
```
hash = SHA256( password + ":" + username + ":" + "IBS_DIGIT2025" )   // login / aktivasi / ganti pw
```
> Catatan: pada `registerAktivasi` & `loginUser`, salt disusun `password:username` lalu
> `+ ":" + SECRET`; pada `changePassword`, `password:username:SECRET`. Skema ini **harus identik
> dengan backend** — konfirmasikan urutan salt saat integrasi.

### 2.4 Upload berkas
Foto (KTP, selfie, KK, NPWP, agunan) dikirim sebagai `multipart/form-data` dengan objek
`{ uri, name, type: 'image/jpeg' }`. Dikompres via `expo-image-manipulator` sebelum unggah.

## 3. Peta Konsumsi Endpoint per Layar

> Semua fungsi ada di **`utils/api.ts`**. Path relatif terhadap base URL. Detail skema field → kontrak backend.

### 3.1 Registrasi — `app/Register.tsx`
| Aksi | Fungsi | Method | Endpoint | Body |
|------|--------|--------|----------|------|
| Kirim registrasi | `registerUser` | POST | `/register` | multipart: `nik, nama, tempat_lahir, tgl_lahir, jenis_kelamin, no_hp, email, alamat, nama_ibu, foto_selfie, foto_ktp` |
| OCR KTP | `ocrKtp` | POST | Google Vision `images:annotate` | `{ image, features:[TEXT_DETECTION] }` (bukan endpoint backend) |

### 3.2 Aktivasi — `app/Aktivasi.tsx`
| Aksi | Fungsi | Method | Endpoint | Body |
|------|--------|--------|----------|------|
| Minta OTP | `requestOtp` | POST | `/otp/request` | multipart: `nik, no_hp, foto_ktp, foto_selfie` |
| Aktivasi akun | `registerAktivasi` | POST | `/aktivasi` | `{ nik, noHp, otp, username, password(hash) }` |

### 3.3 Autentikasi — `app/Login.tsx` / `loginform.tsx`, Profil
| Aksi | Fungsi | Method | Endpoint | Body |
|------|--------|--------|----------|------|
| Login | `loginUser` | POST | `/login` | `{ username, password(hash) }` → `responseData`: profil, `user_id`, `token`, `accounts`, `products`, `reset_pass` |
| Ganti password | `changePassword` | POST | `/password/change` | `{ username, old_password(hash), new_password(hash) }` |

### 3.4 Beranda — `app/(app)/home/index.tsx`
| Aksi | Fungsi | Method | Endpoint |
|------|--------|--------|----------|
| Banner/berita | `getBannerList` | GET | `/banner` |
| Saldo (carousel) | `getSaldo` | POST | `/saldo` |

### 3.5 Rekening (Saldo & Mutasi) — `app/(app)/home/rekening.tsx`
| Aksi | Fungsi | Method | Endpoint | Body |
|------|--------|--------|----------|------|
| Saldo | `getSaldo` | POST | `/saldo` | `{ no_rekening, jenis }` |
| Mutasi | `getMutasi` | POST | `/mutasi` | `{ no_rekening, jenis, start_date, end_date }` |

### 3.6 Pembukaan Rekening — `app/(app)/home/buka-rekening.tsx`
| Aksi | Fungsi | Method | Endpoint | Body (multipart) |
|------|--------|--------|----------|------------------|
| Ajukan Tabungan | `submitTabunganPengajuan` | POST | `/pengajuan-tabungan` | `produk, setoranAwal, nik, hp, user_id, fotoKtp, fotoSelfie` |
| Ajukan Deposito | `submitDepositoPengajuan` | POST | `/pengajuan-deposito` | `jangkaWaktu, setoranAwal, nik, hp, user_id, fotoKtp, fotoSelfie` |
| Ajukan Kredit | `submitKreditPengajuan` | POST | `/pengajuan-kredit` | `tujuan, jangkaWaktu, nominalPinjaman, penghasilan, pendidikan, tempatKerja, alamatKerja, nominalLain, jenisAgunan, deskripsiAgunan, nik, hp, user_id, fotoAgunan1–5, fotoKK, fotoNpwp, fotoKtp, fotoSelfie` |
| Cek status | `getStatusPengajuanByUserId` | GET | `/pengajuan/cekstatus/{user_id}` | — |
| Detail pengajuan | `getDetailPengajuan` | GET | `/pengajuan/detail?jenis={}&no_pengajuan={}` | — |

### 3.7 Analisa Finansial — `app/(app)/home/analisa-finansial.tsx`
| Aksi | Fungsi | Method | Endpoint | Body |
|------|--------|--------|----------|------|
| Analisa bulanan | `getAnalisaFinansial` | POST | `/analisa` | `{ nik, no_hp, period }` |

### 3.8 Info Kantor — `app/(app)/home/info-kantor.tsx`
| Aksi | Fungsi | Method | Endpoint |
|------|--------|--------|----------|
| Daftar kantor | `getKantorList` | GET | `/info-kantor` |

## 4. Ringkasan Endpoint yang Dikonsumsi

`/register` · `/otp/request` · `/aktivasi` · `/login` · `/password/change` · `/saldo` ·
`/mutasi` · `/banner` · `/analisa` · `/info-kantor` · `/pengajuan-tabungan` ·
`/pengajuan-deposito` · `/pengajuan-kredit` · `/pengajuan/cekstatus/{user_id}` ·
`/pengajuan/detail` · *(eksternal)* Google Vision `images:annotate`.

## 5. Catatan Verifikasi (untuk diselaraskan dengan tim backend)

- **Urutan salt hashing** berbeda antar-fungsi (`password:username:SECRET` vs
  `password:username` lalu `:SECRET`) — konfirmasi ke backend agar login/aktivasi/ganti-pw konsisten.
- **`success = responseCode === "00"`** — pastikan seluruh endpoint memakai konvensi kode yang sama.
- Beberapa endpoint memakai body **camelCase** (`setoranAwal`, `jangkaWaktu`, `fotoKtp`) & lainnya
  **snake_case** (`no_rekening`, `foto_ktp`) — verifikasi penamaan field per endpoint di kontrak backend.
- Aplikasi mengirim `X-Device-Id`/`X-Device-Name` tetapi **tidak** mengirim `Authorization` token
  pada request setelah login — konfirmasi kebijakan AuthZ backend (mengikuti perilaku `permitAll`).

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dibuat dari pemetaan pemanggilan axios di `utils/api.ts` (`ibs-onboard`). |

---

*[← Kembali ke IBS Onboarding Mobile](README.md)* · *[Kontrak API Backend](../ibs-onboarding-backend/03-api-contract.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
