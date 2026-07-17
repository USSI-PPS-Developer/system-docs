# 📐 Software Requirements Specification (SRS) — IBS Onboarding Mobile

> Spesifikasi kebutuhan perangkat lunak untuk **IBS Onboarding Mobile** (**Digit By IBS**) — aplikasi mobile nasabah (React Native/Expo) pengonsumsi API onboarding IBS.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS Onboarding Mobile |
| Jenis Dokumen     | Software Requirements Specification (SRS) |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 17 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Pendahuluan

### 1.1 Tujuan
Mendefinisikan kebutuhan fungsional & non-fungsional aplikasi **IBS Onboarding Mobile**, sebuah
aplikasi mobile lintas platform (Android/iOS) yang mengonsumsi API `IBS Onboarding Backend`
untuk onboarding & self-service nasabah BPR.

### 1.2 Ruang Lingkup
Aplikasi menangani registrasi calon nasabah, aktivasi (OTP), autentikasi, beranda self-service,
pembukaan rekening (tabungan/deposito/kredit), status pengajuan, saldo & mutasi, analisa
finansial, info kantor, dan profil. Aplikasi **tidak** memiliki basis data & **tidak** menjalankan
logika onboarding (dimiliki backend).

### 1.3 Definisi & Akronim
| Istilah | Penjelasan |
|---------|------------|
| Expo | Framework/tooling React Native (SDK 54, New Architecture) |
| expo-router | Routing berbasis file (folder `app/`) dengan typed routes |
| Backend | `IBS Onboarding Backend` (`backendonboard`, Spring Boot) |
| `responseData` | Field payload sukses yang **terenkripsi AES** dari backend |
| `keyVersion` | Penanda versi kunci harian untuk derivasi kunci AES |
| OTP | One-Time Password untuk aktivasi akun |
| OCR | Optical Character Recognition (ekstraksi teks KTP via Google Vision) |
| CIF | Customer Information File di Core Banking |
| SecureStore | Penyimpanan terenkripsi perangkat (`expo-secure-store`) |

### 1.4 Referensi
- [BRD — IBS Onboarding Mobile](01-brd.md)
- [API Integration / Consumption Reference](03-api-contract.md)
- [Kontrak API kanonik — IBS Onboarding Backend](../ibs-onboarding-backend/03-api-contract.md)

## 2. Deskripsi Umum

### 2.1 Perspektif Produk
Klien mobile murni. Semua data via HTTP (axios) ke backend melalui salah satu host di
`API_BASE_URLS` (dengan rotasi/failover). Payload sukses didekripsi di sisi klien; password
di-hash sebelum dikirim.

```
[Android / iOS App (Expo)] ── axios/HTTPS ──► [IBS Onboarding Backend] ──► [IBS Core / DB]
        │  X-Device-Id / X-Device-Name (tiap request)
        │  AES decrypt responseData (sisi klien)
        └─ SecureStore: deviceId  ·  Zustand: sesi in-memory
```

### 2.2 Fungsi Utama
Registrasi · Aktivasi (OTP) · Login/Ganti Password · Beranda (saldo, banner, menu) ·
Pembukaan Rekening (Tabungan/Deposito/Kredit) · Status Pengajuan · Saldo & Mutasi ·
Analisa Finansial · Info Kantor · Profil.

### 2.3 Karakteristik Pengguna
| Pengguna | Karakteristik | Kebutuhan |
|----------|---------------|-----------|
| Calon nasabah | Awam teknologi, ingin daftar tanpa ke kantor | Alur registrasi sederhana, kamera terpandu |
| Nasabah aktif | Ingin cek saldo/mutasi & ajukan rekening | Akses cepat, informasi jelas, aman |

### 2.4 Batasan Umum
- Env di-*bake* saat build (`app.config.js` `extra` / `eas.json`) — bukan konfigurasi runtime.
- Tidak ada penyimpanan server-side; hanya `deviceId` di SecureStore, sisanya in-memory.
- Sesi **tidak** dipersistkan — login ulang tiap membuka aplikasi.
- Bergantung penuh pada ketersediaan & kontrak backend, serta Google Vision (OCR).

## 3. Kebutuhan Fungsional

Kode: **FR-xx**. Setiap FR memetakan aksi UI ke endpoint backend (detail di
[03-api-contract.md](03-api-contract.md)).

### 3.1 Registrasi & Onboarding
| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-01 | Input data diri | Layar `Register`: NIK, nama, tempat/tgl lahir, jenis kelamin, no HP, email, alamat, nama ibu kandung. |
| FR-02 | Ambil foto KTP | `KTPCamera`/`GlobalCamera` (expo-camera); simpan URI. |
| FR-03 | OCR KTP | `ocrKtp(uri)` → Google Vision `TEXT_DETECTION`; isi otomatis sebagian field. |
| FR-04 | Ambil foto selfie | `SelfieCamera` (kamera depan). |
| FR-05 | Kirim registrasi | `POST /register` **multipart/form-data** (data diri + `foto_ktp` + `foto_selfie`). |

### 3.2 Aktivasi Akun (OTP)
| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-06 | Minta OTP | `POST /otp/request` **multipart** (`nik`, `no_hp`, `foto_ktp`, `foto_selfie`). |
| FR-07 | Aktivasi | Layar `Aktivasi`: input OTP + `username` + `password` → `POST /aktivasi` (`{nik, noHp, otp, username, password}`; password **di-hash** klien). |

### 3.3 Autentikasi & Sesi
| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-08 | Login | Layar `Login`/`loginform`: `POST /login` (`{username, password-hash}`); sukses → simpan profil, `token`, `accounts`, `products` di `useAuthStore`. |
| FR-09 | Hash kredensial | Password di-hash `SHA256(password:username:"IBS_DIGIT2025")` via `expo-crypto` sebelum dikirim. |
| FR-10 | Ganti password | `POST /password/change` (`old`/`new` di-hash). |
| FR-11 | Auto-logout idle | Layout `(app)` me-reset timer pada interaksi; idle ±10 menit → alert → `logout()` + redirect `/Login`. |
| FR-12 | Force login | Saat `AppState` kembali `active` & `!isLoggedIn` → redirect `/Login`. Sesi in-memory (tidak persist). |

### 3.4 Beranda / Self-Service
| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-13 | Dashboard saldo | `home/index`: `BalanceCarousel` menampilkan rekening & saldo (`/saldo`). |
| FR-14 | Daftar rekening | `AccountList` dari `useAuthStore.accounts`. |
| FR-15 | Banner/berita | `NewsCarousel` dari `GET /banner`. |
| FR-16 | Menu cepat | `QuickItem` menuju fitur (buka rekening, rekening, analisa, info kantor, profil). |

### 3.5 Informasi Rekening
| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-17 | Saldo | `home/rekening`: `POST /saldo` (`{no_rekening, jenis}`). |
| FR-18 | Mutasi | `POST /mutasi` (`{no_rekening, jenis, start_date, end_date}`); daftar transaksi per rentang tanggal. |

### 3.6 Pembukaan Rekening (Pengajuan)
| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-19 | Pengajuan Tabungan | `POST /pengajuan-tabungan` multipart (`produk, setoranAwal, nik, hp, user_id, fotoKtp, fotoSelfie`). |
| FR-20 | Pengajuan Deposito | `POST /pengajuan-deposito` multipart (`jangkaWaktu, setoranAwal, …, fotoKtp, fotoSelfie`). |
| FR-21 | Pengajuan Kredit | `POST /pengajuan-kredit` multipart (tujuan, jangkaWaktu, nominal, penghasilan, pendidikan, tempat/alamat kerja, agunan + **fotoAgunan1–5**, fotoKK, fotoNpwp, fotoKtp, fotoSelfie). |
| FR-22 | Wizard multi-langkah | `usePengajuanTabungan` (step, produk, fotoKtp, fotoSelfie, next/back/reset). |
| FR-23 | Cek status pengajuan | `GET /pengajuan/cekstatus/{user_id}` (tabungan/deposito/kredit). |
| FR-24 | Detail pengajuan | `GET /pengajuan/detail?jenis=&no_pengajuan=`. |

### 3.7 Analisa Finansial & Info
| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-25 | Analisa finansial | `home/analisa-finansial`: `POST /analisa` (`{nik, no_hp, period}`); ditampilkan sebagai grafik (`react-native-chart-kit`). |
| FR-26 | Info kantor | `home/info-kantor`: `GET /info-kantor`. |
| FR-27 | Profil | `home/profil`: data nasabah dari `useAuthStore`; tautan `WEBSITE_URL`/`KONTAK_URL`; ganti password & logout. |

### 3.8 Umum / Lintas-Potong
| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-28 | Identitas perangkat | `getDeviceInfo()` → `deviceId` (IDFV/Android ID, fallback UUID, disimpan di SecureStore); header `X-Device-Id` & `X-Device-Name` disuntik tiap request. |
| FR-29 | Dekripsi payload | `decryptPayload(keyVersion, responseData)` (AES-ECB/PKCS7) sebelum data dipakai. |
| FR-30 | Rotasi/failover host | Tiap fungsi API iterasi `API_BASE_URLS`; lanjut host berikut bila error jaringan, berhenti bila ada `response` server. |
| FR-31 | Alert global | `useAlertStore` + `GlobalAlert`/`CustomAlert` untuk notifikasi & konfirmasi. |
| FR-32 | Privasi | Layar `privacy` (kebijakan privasi). |
| FR-33 | Biometrik (opsional) | `expo-local-authentication` (Face ID/sidik jari) — izin dideklarasikan di `app.config.js`. |

## 4. Kebutuhan Non-Fungsional

| ID | Kategori | Kebutuhan |
|----|----------|-----------|
| NFR-01 | Keamanan | Password di-hash SHA-256 sebelum kirim; payload sukses terenkripsi AES; `deviceId` di SecureStore; auto-logout idle; force login saat resume. |
| NFR-02 | Keamanan (catatan) | `BASE_KEY` AES, `SECRET` hash, & `VISION_API_KEY` **tertanam di bundel** → bukan rahasia kuat. Batasi `VISION_API_KEY` (restriction/quota); roadmap: pindah rahasia/AuthZ ke server. |
| NFR-03 | Kompatibilitas | Android & iOS; Expo SDK 54, New Architecture; orientasi portrait. |
| NFR-04 | Kinerja | Foto dikompres (`expo-image-manipulator`) sebelum unggah; splash ditahan ~1.5s untuk init device info. |
| NFR-05 | Ketersediaan | Multi-host `API_BASE_URLS` dengan rotasi/failover; timeout ke host berikutnya bila error jaringan. |
| NFR-06 | Ketergunaan | Kamera terpandu (KTP/selfie), OCR mengurangi input manual, umpan balik alert jelas, tema warna dari env. |
| NFR-07 | Keterpeliharaan | TypeScript, ESLint (`expo lint`); util API/enkripsi/device terpusat; state Zustand per domain. |
| NFR-08 | Konfigurasi | Env via `expo-constants` (`extra`) dari `app.config.js` / profil `eas.json`; ubah = rebuild. |
| NFR-09 | Privasi & izin | Izin kamera, galeri, lokasi, & Face ID dideklarasikan (`infoPlist`/Android). |

## 5. Antarmuka Eksternal

### 5.1 Antarmuka API
Seluruh interaksi via REST ke backend (lihat [03-api-contract.md](03-api-contract.md)). Base URL:
`API_BASE_URLS` (comma-separated, rotasi). Header `X-Device-Id` & `X-Device-Name` dikirim tiap
request; upload foto memakai `multipart/form-data`.

### 5.2 Antarmuka Pengguna
Layar publik: `Splash`, `Login`/`loginform`, `Register`, `Aktivasi`, `privacy`. Area terproteksi
grup `(app)/`: `home/{index, rekening, buka-rekening, analisa-finansial, info-kantor, profil}`.
Navigasi via `expo-router` (Stack, `headerShown:false`).

### 5.3 Ketergantungan Perangkat Lunak
React 19, React Native 0.81, Expo SDK 54, expo-router 6, Zustand, axios, crypto-js, expo-crypto,
expo-camera, expo-image-picker, expo-image-manipulator, expo-secure-store, expo-local-authentication,
lucide-react-native, @gorhom/bottom-sheet + portal, react-native-reanimated, react-native-chart-kit.
Layanan eksternal: **Google Cloud Vision API** (OCR KTP).

## 6. Matriks Ketertelusuran (Ringkas)

| Kebutuhan Bisnis (BRD) | FR terkait |
|------------------------|-----------|
| BR-001 | FR-01 … FR-05 |
| BR-002 | FR-06, FR-07 |
| BR-003 | FR-08, FR-09, FR-10 |
| BR-004 | FR-11, FR-12 |
| BR-005 | FR-17, FR-18 |
| BR-006 | FR-19 … FR-22 |
| BR-007 | FR-23, FR-24 |
| BR-008 | FR-25 |
| BR-009 | FR-15, FR-26 |
| BR-010 | FR-28 |
| BR-011 | NFR-03 |
| BR-012 | FR-30, NFR-05 |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dokumen dibuat berdasarkan kode sumber `ibs-onboard`. |

---

*[← Kembali ke IBS Onboarding Mobile](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
