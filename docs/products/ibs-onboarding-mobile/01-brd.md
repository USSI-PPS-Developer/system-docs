# 📄 Business Requirement Document (BRD) — IBS Onboarding Mobile

> Dokumen kebutuhan bisnis untuk produk **IBS Onboarding Mobile** (**Digit By IBS**) — aplikasi mobile nasabah untuk onboarding & self-service perbankan BPR.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS Onboarding Mobile |
| Jenis Dokumen     | Business Requirement Document (BRD) |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 17 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Latar Belakang

**Digit By IBS** adalah **aplikasi mobile nasabah** (Android & iOS) yang menjadi **kanal
self-service & onboarding** bagi nasabah/calon nasabah BPR. Melalui aplikasi ini, calon nasabah
dapat **mendaftar (registrasi)** dengan foto KTP & selfie, **mengaktivasi akun** via OTP,
kemudian sebagai nasabah dapat **membuka rekening** (tabungan/deposito/kredit), **mengecek saldo
& mutasi**, melihat **analisa finansial**, serta **info kantor** BPR.

Aplikasi ini adalah **konsumen (client) dari API `IBS Onboarding Backend`** — API yang sama yang
dikonsumsi dashboard back-office **`IBS Onboarding Admin`**. Alur end-to-end-nya berpasangan:
nasabah mengirim registrasi/pengajuan dari aplikasi mobile ini, lalu **petugas BPR memverifikasi
& menyetujui** dari dashboard admin, dan backend yang memposting hasilnya ke Core Banking.
Aplikasi mobile **tidak** memiliki basis data dan **tidak** menjalankan logika onboarding — semua
proses ada di backend.

Dibangun dengan **React Native + Expo SDK 54** (New Architecture, React Compiler),
**expo-router** (typed routes), state via **Zustand**, HTTP via **axios**, kamera & OCR via
**expo-camera** + **Google Cloud Vision**. Payload respons sukses dari backend **terenkripsi (AES
kunci harian)** dan **didekripsi di sisi klien**; kredensial (password) **di-hash SHA-256** sebelum
dikirim. Distribusi via **EAS Build** (APK internal & AAB produksi).

## 2. Tujuan (Business Objectives)

| Kode | Tujuan | Indikator Keberhasilan (KPI) |
|------|--------|------------------------------|
| OBJ-1 | Menyediakan **kanal onboarding mandiri** bagi calon nasabah tanpa datang ke kantor. | Registrasi + aktivasi dapat diselesaikan dari aplikasi. |
| OBJ-2 | Mempermudah **pembukaan rekening** (tabungan/deposito/kredit) secara digital. | Pengajuan terkirim beserta dokumen pendukung. |
| OBJ-3 | Memberi nasabah **akses self-service** ke informasi rekening. | Saldo, mutasi, & analisa finansial dapat dilihat kapan saja. |
| OBJ-4 | Menjamin **keamanan data & sesi** nasabah di perangkat. | Password di-hash, payload terenkripsi, auto-logout idle berjalan. |
| OBJ-5 | Menyederhanakan **input data** dengan bantuan OCR KTP & kamera terpandu. | Field data diri terisi otomatis dari hasil OCR KTP. |
| OBJ-6 | Menyediakan aplikasi **lintas platform** (Android & iOS) dengan UX konsisten. | Satu basis kode Expo untuk kedua platform. |

## 3. Ruang Lingkup (Scope)

### ✅ In Scope
- **Registrasi calon nasabah** — input data diri (NIK, nama, tempat/tgl lahir, jenis kelamin,
  no HP, email, alamat, nama ibu kandung) + **foto KTP & selfie**; bantuan **OCR KTP** (Vision).
- **Aktivasi akun** — permintaan/verifikasi **OTP** & penetapan **username + password**.
- **Autentikasi nasabah** — login (password di-hash SHA-256), ganti password, **auto-logout idle**,
  force login saat app dibuka kembali.
- **Beranda / self-service** — dashboard saldo (carousel), daftar rekening, banner/berita,
  menu cepat.
- **Pembukaan rekening** — pengajuan **Tabungan**, **Deposito**, **Kredit** (wizard multi-langkah,
  unggah dokumen: KTP, selfie, KK, NPWP, agunan 1–5).
- **Status pengajuan** — cek status & detail pengajuan per nasabah.
- **Informasi rekening** — saldo & mutasi (rentang tanggal) per rekening.
- **Analisa finansial** — ringkasan/analisa finansial bulanan (grafik).
- **Info kantor** — daftar kantor/cabang BPR.
- **Profil** — data nasabah & tautan website/kontak.

### ❌ Out of Scope
- **Logika bisnis onboarding, approval, & posting ke Core Banking** — dimiliki `IBS Onboarding Backend`.
- **Verifikasi/approval petugas** — dilakukan di `IBS Onboarding Admin` (dashboard back-office).
- **Basis data / penyimpanan server-side** — aplikasi hanya menyimpan `deviceId` di `SecureStore`.
- **Penerbitan/kebijakan skema kontrak API & kunci enkripsi** — kanonik di backend.
- **Transaksi finansial (transfer, pembayaran)** — di luar cakupan onboarding & informasi.

## 4. Stakeholder

| Peran | Nama / Unit | Tanggung Jawab |
|-------|-------------|----------------|
| Sponsor | Manajemen TI BPR / USSI | Menyetujui pengadaan aplikasi mobile nasabah. |
| Business Owner | Operasional / Unit Dana & Kredit BPR | Menetapkan alur onboarding & produk yang ditawarkan. |
| Product Owner | Tim Produk USSI | Memprioritaskan fitur aplikasi. |
| Pengguna (Nasabah) | Nasabah & calon nasabah BPR | Melakukan onboarding & self-service via aplikasi. |
| Tim Backend | Tim USSI (`backendonboard`) | Menyediakan & memelihara API yang dikonsumsi. |
| Tim Admin/Back-office | Petugas BPR (`admin-onboard`) | Memverifikasi & memproses pengajuan nasabah. |
| Developer / Maintainer | Tim Mobile USSI | Pengembangan & pemeliharaan `ibs-onboard`. |

## 5. Kebutuhan Bisnis

| ID | Kebutuhan Bisnis | Prioritas | Catatan |
|----|------------------|-----------|---------|
| BR-001 | Calon nasabah dapat **registrasi** dengan data diri + foto KTP & selfie. | Wajib | `POST /register` (multipart); OCR KTP membantu isi field. |
| BR-002 | Nasabah dapat **aktivasi akun** via OTP & menetapkan kredensial. | Wajib | `/otp/request`, `/aktivasi`; password di-hash klien. |
| BR-003 | Nasabah dapat **login** dengan aman & **ganti password**. | Wajib | `/login`, `/password/change`; SHA-256 kredensial. |
| BR-004 | Sesi **auto-logout saat idle** & login ulang saat app dibuka. | Wajib | Idle ±10 menit; sesi tidak dipersistkan. |
| BR-005 | Nasabah dapat **melihat saldo & mutasi** rekening. | Tinggi | `/saldo`, `/mutasi` (rentang tanggal). |
| BR-006 | Nasabah dapat **mengajukan pembukaan rekening** (tabungan/deposito/kredit). | Wajib | `/pengajuan-{tabungan,deposito,kredit}` (multipart dokumen). |
| BR-007 | Nasabah dapat **melihat status & detail pengajuan**. | Tinggi | `/pengajuan/cekstatus/{user_id}`, `/pengajuan/detail`. |
| BR-008 | Nasabah dapat **melihat analisa finansial**. | Sedang | `/analisa`; ditampilkan sebagai grafik. |
| BR-009 | Nasabah dapat **melihat info kantor & banner/berita**. | Sedang | `/info-kantor`, `/banner`. |
| BR-010 | Aplikasi mengirim **identitas perangkat** tiap request. | Wajib | Header `X-Device-Id`, `X-Device-Name` (anti-fraud/blacklist device). |
| BR-011 | Aplikasi mendukung **Android & iOS** dari satu basis kode. | Wajib | Expo (New Architecture). |
| BR-012 | Aplikasi memiliki **failover** bila salah satu host API bermasalah. | Sedang | `API_BASE_URLS` multi-host dengan rotasi. |

## 6. Proses Bisnis

### 6.1 Kondisi Saat Ini (As-Is)
Onboarding & pembukaan rekening umumnya mengharuskan nasabah datang ke kantor BPR, mengisi
formulir kertas, dan menyerahkan fotokopi dokumen. Proses lambat, menyita waktu petugas, dan
menyulitkan nasabah di lokasi jauh.

### 6.2 Kondisi Diharapkan (To-Be)
Calon nasabah mengunduh **Digit By IBS**, mendaftar dengan foto KTP & selfie (dibantu OCR),
menunggu verifikasi petugas, lalu mengaktivasi akun via OTP. Sebagai nasabah, ia dapat membuka
rekening dan memantau saldo/mutasi langsung dari ponsel. Aplikasi hanya menembak endpoint
backend; verifikasi dilakukan petugas via dashboard admin, dan backend memposting hasilnya ke Core.

```
[Nasabah / Mobile App]                 [IBS Onboarding Backend]              [IBS Onboarding Admin]
   │ registrasi (KTP+selfie) ─POST /register─► simpan (PENDING) ───────────────► antre verifikasi
   │                                              ◄───────────────── approve/reject (petugas)
   │ minta OTP ───────────── /otp/request ─────► kirim/verifikasi OTP
   │ aktivasi (set kredensial) /aktivasi ──────► akun aktif
   │ login ───────────────── /login (hash) ────► token + profil (AES)
   │ ajukan rekening ─── /pengajuan-* (multipart)► simpan (PENDING) ──────────► antre approve
   │                                                                            (approve → CIF+rekening ke Core)
   │ cek saldo/mutasi/status  /saldo /mutasi ──► data (AES) ──► render
   ▼
 self-service selesai
```

## 7. Asumsi & Batasan

- **Asumsi:**
  - **API `IBS Onboarding Backend` tersedia** & dapat dijangkau via salah satu host di `API_BASE_URLS`.
  - Skema **enkripsi AES kunci harian** & **hashing password** aplikasi **identik** dengan backend
    (`BASE_KEY = "IBS-ONBOARD-SECRET-KEY"`; `SECRET password = "IBS_DIGIT2025"`).
  - Perangkat memiliki **kamera** & (opsional) sensor biometrik; koneksi internet aktif.
  - **Google Cloud Vision** aktif & `VISION_API_KEY` valid untuk fitur OCR KTP.
- **Batasan:**
  - Platform: **React Native + Expo SDK 54** (New Architecture); distribusi via **EAS**.
  - **Env di-*bake* saat build** (via `app.config.js` `extra` / profil `eas.json`) — ubah = rebuild.
  - **Tidak ada basis data**; state sesi **in-memory (Zustand)**, hanya `deviceId` di `SecureStore`.
  - **Sesi tidak dipersistkan** — nasabah harus login ulang setiap membuka aplikasi (by design).
  - Verifikasi/approval **bukan** tanggung jawab aplikasi; bergantung pada petugas & backend.

## 8. Risiko Bisnis

| ID | Risiko | Dampak | Mitigasi |
|----|--------|--------|----------|
| RB-001 | Foto KTP/selfie buram atau tidak sesuai | Registrasi ditolak, onboarding tertunda | Kamera terpandu (KTP/selfie), OCR memeriksa keterbacaan, kompresi terkontrol. |
| RB-002 | `BASE_KEY`/`SECRET` tertanam di bundel aplikasi | Dapat diekstrak dari APK/IPA | Setara obfuscation; roadmap: pindah rahasia kuat & AuthZ ke server; batasi `VISION_API_KEY`. |
| RB-003 | Beda versi skema enkripsi/hashing app↔backend | Login gagal / payload gagal didekripsi | Sinkronkan `keyVersion`/algoritme; uji lintas versi tiap rilis. |
| RB-004 | Host API tunggal down | Aplikasi tidak dapat transaksi | `API_BASE_URLS` multi-host dengan **rotasi/failover**. |
| RB-005 | Sesi dibiarkan terbuka di perangkat | Akses tidak sah | Auto-logout idle + force login saat app dibuka. |
| RB-006 | Perangkat/nasabah masuk blacklist | Penyalahgunaan identitas/device | Header `X-Device-Id`/`X-Device-Name` dikirim tiap request untuk penyaringan backend. |
| RB-007 | Salah kirim data pengajuan | Proses onboarding keliru | Wizard multi-langkah + ringkasan konfirmasi sebelum submit. |

## 9. Kriteria Penerimaan (Acceptance Criteria)

- Calon nasabah dapat menyelesaikan **registrasi** (data diri + foto KTP & selfie) dan menerima
  umpan balik sukses/gagal.
- OCR KTP mengisi otomatis sebagian field data diri dari foto KTP.
- Nasabah dapat **aktivasi** (OTP) & menetapkan username/password, lalu **login** berhasil
  (password di-hash sebelum dikirim; profil terbaca dari `responseData` terenkripsi).
- Nasabah dapat **membuka rekening** tabungan/deposito/kredit dengan mengunggah dokumen, dan
  melihat **status/detail** pengajuan.
- **Saldo, mutasi, analisa finansial, info kantor, & banner** tampil dari data backend.
- Sesi **auto-logout** saat idle; membuka ulang aplikasi meminta login.
- Aplikasi berjalan di **Android & iOS**; bila satu host API gagal, aplikasi mencoba host lain.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dokumen dibuat berdasarkan implementasi repo `ibs-onboard` (React Native/Expo) & kontrak `ibs-onboarding-backend`. |

---

*[← Kembali ke IBS Onboarding Mobile](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
