# 🚀 Deployment Guide — IBS Onboarding Mobile

> Panduan build & distribusi **IBS Onboarding Mobile** (**Digit By IBS**) — aplikasi React Native/Expo, via **EAS Build** (Android & iOS).

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS Onboarding Mobile |
| Jenis Dokumen     | Deployment Guide     |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 17 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Arsitektur Distribusi

Berbeda dari produk web, mobile **tidak di-deploy ke server**; artefak (APK/AAB/IPA) di-*build*
oleh **EAS** lalu **didistribusikan** (internal/App Store/Play Store). Aplikasi berjalan di
perangkat nasabah dan memanggil API backend langsung via HTTPS.

```
[Kode ibs-onboard] ──► [EAS Build (cloud)] ──► artefak APK/AAB/IPA
                                                     │
                              distribusi internal / store
                                                     ▼
                        [Perangkat Nasabah] ──HTTPS──► API_BASE_URLS (backend onboarding)
```

## 2. Prasyarat

| Item | Keterangan |
|------|-----------|
| Node.js 20+ & npm | Build/dev lokal |
| Expo CLI / EAS CLI | `>= 16.27.0` (lihat `eas.json` `cli.version`) |
| Akun Expo (EAS) | Proyek `@azharzakiyr/ibs-onboard`, `projectId` di `app.config.js` |
| Android SDK / Xcode | Hanya untuk build native lokal (`expo run:*`) |
| Kredensial signing | Dikelola EAS (Android keystore / iOS certs) |

## 3. Konfigurasi Environment

Env dibaca via **`expo-constants`** (`Constants.expoConfig.extra.*`) yang di-*wire* di
**`app.config.js`** dari `process.env`. **Di-*bake* saat build** — mengubahnya **mengharuskan
rebuild**. Untuk EAS, nilai di-*inject* per profil di **`eas.json`** (`build.<profil>.env`);
untuk dev lokal via file **`.env`** (`dotenv/config`).

| Variabel | Contoh | Keterangan |
|----------|--------|-----------|
| `API_BASE_URLS` | `https://apionboarding.ppsrnd.cloud/api` | **Daftar host** API dipisah koma (failover) |
| `VISION_API_KEY` | `AIza…` | Kunci Google Cloud Vision (OCR KTP) |
| `APP_NAME` | `Digit By IBS` | Nama aplikasi |
| `WEBSITE_URL` | `https://www.ussi-software.com` | Tautan website di Profil |
| `KONTAK_URL` | `https://wa.me/62…` | Tautan kontak |
| `PRIMARY_COLOR`, `PRIMARY_DARK`, `TEXT_COLOR`, `SUBTEXT_COLOR`, `BG_*`, `CARD_COLOR`, `SPLASH_COLOR_*`, `GLASS_COLOR` | — | Tema warna (white-label) |

Identitas aplikasi (`app.config.js`): `name = "Digit By IBS"`, `slug = "ibs-onboard"`,
`scheme = "ibsonboard"`, Android `package`/iOS `bundleIdentifier` = **`com.lt4.ibsonboard`**,
`newArchEnabled = true`, `experiments.reactCompiler = true`, `typedRoutes = true`.

> **Penting:** `BASE_KEY = "IBS-ONBOARD-SECRET-KEY"` (enkripsi) & `SECRET = "IBS_DIGIT2025"`
> (hash password) tertanam di kode dan **harus identik dengan backend**. Bila backend menggantinya,
> aplikasi wajib disesuaikan (`utils/decryptResponse.ts` / `utils/api.ts`) & di-rebuild.

## 4. Profil Build (`eas.json`)

| Profil | Distribusi | Output Android | Catatan |
|--------|-----------|----------------|---------|
| `development` | internal | **APK** | `developmentClient: true` (dev build) |
| `preview` | internal | **APK** | Build uji/QA; dipakai `npm run build:android` |
| `production` | store | **AAB** (`app-bundle`) | `autoIncrement: true` (naikkan versionCode otomatis) |

Ketiga profil membawa blok `env` sendiri (nilai identik pada konfigurasi saat ini). `appVersionSource`
= **remote** (versi dikelola EAS).

## 5. Build & Jalankan

### 5.1 Dev lokal
```sh
npm install
npm start                 # Metro (Expo)
npm run start:tunnel      # tunnel untuk device di jaringan berbeda
npm run android           # build & jalankan native di emulator/device (dev)
npm run ios               # native iOS (perlu macOS/Xcode)
```

### 5.2 Build EAS
```sh
# APK internal (QA / uji lapangan)
eas build -p android --profile preview      # == npm run build:android

# Dev client
eas build -p android --profile development

# Produksi (AAB untuk Play Store)
eas build -p android --profile production
eas build -p ios --profile production       # iOS (perlu kredensial Apple)
```

### 5.3 Submit ke store (opsional)
```sh
eas submit -p android --profile production   # blok submit.production.android di eas.json
```

## 6. Distribusi

- **`development`/`preview`** → **APK** dibagikan via tautan EAS/QR (install manual, "sumber tak
  dikenal" di Android).
- **`production`** → **AAB** diunggah ke **Google Play**; iOS via **App Store Connect**.
- Pastikan **`API_BASE_URLS` mengarah ke host yang benar** per lingkungan sebelum build (dev/uji vs
  produksi).

## 7. Verifikasi Pasca-Build

1. Install artefak → aplikasi terbuka ke **Splash** lalu **Login**.
2. **Registrasi** uji: kamera KTP/selfie berfungsi, OCR mengisi field (butuh `VISION_API_KEY` valid).
3. **Login** uji: sukses → beranda menampilkan saldo/rekening (bukti API + dekripsi payload OK).
4. Cek **failover**: bila host pertama di `API_BASE_URLS` mati, aplikasi mencoba host berikutnya.
5. Uji **auto-logout idle** & **force login** saat app dibuka kembali.

## 8. Rilis & Rollback

- **Rilis**: build profil `production` (versionCode auto-increment) → submit ke store.
- **Rollback**: rilis ulang build/versi sebelumnya di store (Play/App Store), atau bagikan APK
  versi lama untuk kanal internal.
- **OTA (opsional)**: bila mengaktifkan EAS Update, perbaikan JS dapat didorong tanpa rebuild
  native (belum dikonfigurasi pada proyek ini).

## 9. Troubleshooting

| Gejala | Kemungkinan Penyebab | Solusi |
|--------|----------------------|--------|
| Semua request gagal | `API_BASE_URLS` salah / host down | Verifikasi env build; cek failover host |
| Data kosong walau sukses | Gagal dekripsi (`BASE_KEY`/`keyVersion` beda) | Sinkronkan kunci/algoritme dengan backend, rebuild |
| Login selalu gagal | Skema/urutan salt hash beda dengan backend | Selaraskan hashing (`utils/api.ts`) dengan backend |
| OCR KTP tidak jalan | `VISION_API_KEY` invalid/kena batas | Periksa kunci & kuota di Google Cloud Console |
| Env tidak berubah | Nilai di-bake saat build | Ubah `.env`/`eas.json` lalu **rebuild** |
| Build EAS gagal (versi CLI) | CLI < `16.27.0` | Perbarui `eas-cli` |
| Kamera/izin ditolak | Izin belum diberikan | Cek `infoPlist` (iOS) & izin Android; minta ulang izin |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dibuat dari `app.config.js`, `eas.json`, & skrip `package.json`. |

---

*[← Kembali ke IBS Onboarding Mobile](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
