# 🚀 Deployment Guide — Mobile Branchless

> Panduan build, distribusi, & penggelaran **Mobile Branchless** (**IBS BranchlessPro**) — aplikasi React Native/Expo via **EAS Build**, termasuk penyiapan perangkat petugas di lapangan.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | Mobile Branchless   |
| Jenis Dokumen     | Deployment Guide    |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 31 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Arsitektur Distribusi

Aplikasi mobile **tidak di-deploy ke server**; artefak APK di-*build* oleh **EAS** lalu
**didistribusikan** ke perangkat petugas. Yang khas pada produk ini: **satu artefak melayani
banyak lembaga** — endpoint API ditentukan **saat runtime** dari kode lembaga yang dimasukkan
petugas, bukan di-*bake* saat build.

```
[Kode Mobile-Branchless] ──► [EAS Build (cloud)] ──► APK
                                                     │
                                    distribusi internal (tautan/QR)
                                                     ▼
                                        [Perangkat Petugas]
                                                     │
                    kode lembaga ──► API Pusat ──► api_url lembaga
                                                     │
                                        ┌────────────┴────────────┐
                                        ▼                         ▼
                                  API Lembaga            Printer Bluetooth
                            (login, sync, unduh DB)         (ESC/POS)
```

> **Implikasi operasional:** menambah lembaga baru **tidak memerlukan rebuild**. Cukup
> daftarkan lembaga beserta `api_url`-nya di API pusat, lalu petugas memasukkan kode lembaga
> di aplikasi.

## 2. Prasyarat

| Item | Keterangan |
|------|-----------|
| Node.js 20+ & npm | `engines.node >= 20` di `package.json` |
| EAS CLI | `>= 16.20.1` (lihat `eas.json` `cli.version`) |
| Akun Expo (EAS) | Owner **`azharzakiyr`**, `projectId` `0587e351-6e37-44df-b776-3129817d575e` |
| Android SDK | Hanya untuk build native lokal (`expo run:android`) |
| Xcode + CocoaPods | Hanya untuk build iOS lokal (macOS) |
| Kredensial signing | Dikelola EAS (Android keystore) |

> [!IMPORTANT]
> Aplikasi **tidak berjalan di Expo Go**. Terdapat modul native di luar Expo Go
> (`react-native-ble-plx`, `@haroldtran/react-native-thermal-printer`, `expo-dev-client`),
> sehingga pengembangan wajib memakai **development build**.

## 3. Konfigurasi

### 3.1 Identitas Aplikasi (`app.json`)

| Field | Nilai |
|-------|-------|
| `name` | `IBS BranchlessPro` |
| `slug` | `mobile-branchless-app` |
| `owner` | `azharzakiyr` |
| `scheme` | `mobilebranchless` |
| `version` | `1.0.0` |
| Android `package` / iOS `bundleIdentifier` | **`com.lt4.mobilebranchless`** |
| `orientation` | `portrait` |
| `android.usesCleartextTraffic` | **`true`** |
| Plugin | `expo-font`, `expo-dev-client`, `expo-secure-store`, `expo-sqlite` |

Izin Android yang dideklarasikan: `CAMERA`, `BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_SCAN`,
`BLUETOOTH_CONNECT`, `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`.

> **Catatan keamanan:** `usesCleartextTraffic: true` diaktifkan karena sebagian endpoint
> lembaga belum HTTPS. Ini melemahkan perlindungan lalu lintas — targetkan seluruh `api_url`
> memakai HTTPS agar flag ini dapat dimatikan.

### 3.2 Konfigurasi Runtime (bukan build-time)

Berbeda dari produk mobile lain, **tidak ada berkas `.env`** dan **tidak ada blok `env` di
`eas.json`**. Konfigurasi disimpan di **SecureStore** dan diisi dari dalam aplikasi:

| Kunci SecureStore | Sumber | Keterangan |
|-------------------|--------|-----------|
| `kode_lembaga`, `nama_lembaga`, `alamat_lembaga` | `GET /lembaga/kode/{kode}` | Identitas lembaga |
| `api_url` | Respons lembaga | **Base URL API lembaga** — dipakai hampir seluruh operasi transaksi |
| `printer_driver` | Pengaturan | `internal` (BLE) atau `rawbt` |
| `printer_address` | Pengaturan | Alamat MAC printer |
| `printer_width` | Pengaturan | `32` (58mm) atau `48` (80mm) |
| `auto_print_struk` | Pengaturan | `true`/`false` |

Satu-satunya nilai yang **tertanam di kode** adalah base URL API pusat:

```ts
// src/utils/APIConfig.ts
export const DEFAULT_API = "https://apibranchless.ppsrnd.cloud/api";
```

Mengubah host pusat **memerlukan rebuild**.

> **Penting:** `BASE_KEY = "IBS-ONBOARD-SECRET-KEY"` (enkripsi payload AES, di
> `src/utils/decryptResponse.ts`) dan `ENCRYPT_KEY = "branchless2025"` (*encoding* data lokal
> & tanda tangan, di `src/utils/authUtils.ts`) tertanam di kode dan **harus identik dengan
> backend**. Bila backend mengganti salah satunya, aplikasi wajib disesuaikan & di-rebuild.

## 4. Profil Build (`eas.json`)

| Profil | Distribusi | Output | Catatan |
|--------|-----------|--------|---------|
| `development` | internal | APK | `developmentClient: true` — untuk pengembangan |
| `preview` | internal | APK | Build uji/QA & distribusi ke petugas |
| `production` | (default store) | AAB | `autoIncrement: true` |

`cli.appVersionSource` = **`remote`** (versi dikelola EAS). Tidak ada blok `env` per profil —
konsisten dengan konfigurasi runtime di Bagian 3.2.

## 5. Build & Jalankan

### 5.1 Dev lokal

```sh
npm install

# iOS saja
bundle install
bundle exec pod install --project-directory=ios

npm run android          # expo run:android — bangun & pasang dev build
npm run ios              # expo run:ios
npm start                # Metro (expo start --lan) untuk sesi berikutnya
```

### 5.2 Build EAS

```sh
# APK internal untuk QA / petugas
npx eas build --profile preview --platform android

# Dev client
npx eas build --profile development --platform android

# Produksi
npx eas build --profile production --platform android
```

### 5.3 Pemeriksaan sebelum build

```sh
npx tsc --noEmit         # type check
```

> **Catatan kondisi repo saat ini:** berkas `__tests__/App.test.tsx` **gagal dijalankan**
> karena `react-test-renderer` tidak terpasang, dan tidak ada skrip `test` di `package.json`.
> Linting juga tidak berjalan (`.eslintrc.js` merujuk `@react-native` yang tidak terpasang).
> Gerbang kualitas otomatis praktis hanya `tsc`. Perbaiki keduanya sebelum menjadikan CI
> sebagai syarat rilis.

## 6. Distribusi & Penyiapan Perangkat Petugas

### 6.1 Distribusi artefak

- Profil `preview`/`development` → **APK** dibagikan via tautan/QR dari EAS.
- Petugas perlu mengizinkan **"Instal dari sumber tak dikenal"** di Android.
- Perangkat sebaiknya **didaftarkan** lebih dulu — `X-Device-Id` dikirim tiap permintaan dan
  dapat disaring backend.

### 6.2 Penyiapan tiap perangkat (wajib, sekali)

| # | Langkah | Verifikasi |
|---|---------|-----------|
| 1 | Pasang APK | Aplikasi terbuka ke layar Login |
| 2 | Berikan izin kamera, Bluetooth, & lokasi | Dialog izin muncul saat pertama dibuka |
| 3 | **Setting → input kode lembaga** | Nama lembaga tampil di kartu layar login |
| 4 | **Unduh DB** master nasabah | Muncul pesan "Data database berhasil diunduh" |
| 5 | Login dengan akun petugas | Masuk ke layar Buka Kas |
| 6 | Pasangkan **printer Bluetooth** di pengaturan Android | Printer terlihat saat dipilih di aplikasi |
| 7 | **Setting → pilih printer, driver, & lebar kertas** | Cetak uji menghasilkan struk |
| 8 | (Opsional) Aktifkan **biometrik** & cetak otomatis | Tombol biometrik muncul di layar login |

### 6.3 Rutinitas harian petugas

```
Pagi   : buka aplikasi ─► Unduh DB (data nasabah hari ini) ─► login ─► Buka Kas
Siang  : melayani transaksi (sinkronisasi berjalan sendiri saat ada sinyal)
Sore   : pastikan tab Sync bersih ─► Tutup Kas ─► logout otomatis
```

> **DB master bernama per tanggal** (`dbbranchless_YYMMDD.db`). Berkas kemarin tidak dipakai
> hari ini — unduh ulang setiap pagi adalah bagian dari prosedur operasional, bukan opsional.

## 7. Ketergantungan Sisi Server

Repositori `Mobile-Branchless` adalah **murni aplikasi mobile** — tidak ada komponen server
yang perlu di-deploy dari repo ini. Sebelum aplikasi dapat dipakai di lapangan, sisi server
berikut harus sudah siap dan dikelola tim backend:

| Layanan | Tanggung jawab | Dipakai untuk |
|---------|----------------|---------------|
| **API Pusat** (`DEFAULT_API`) | Tim USSI | Lookup lembaga, OTP, otorisasi, lapor lokasi petugas |
| **API Lembaga** (`api_url`) | Tim USSI / lembaga | Login, sinkronisasi transaksi, penarikan, mutasi |
| **Pembangkit DB master** | Sisi server lembaga | Menyediakan `dbbranchless_YYMMDD.db` untuk `GET /db/download/{YYMMDD}` |

Aplikasi hanya **memicu** pembangkitan lewat `GET /worker/generate-master-nasabah` dan
**mengunduh** hasilnya; proses pembangkitan berjalan di server.

### Daftar periksa kesiapan server sebelum rollout

- [ ] Lembaga terdaftar di API pusat beserta `api_url`-nya (uji: `GET /lembaga/kode/{kode}`).
- [ ] Berkas DB master untuk **tanggal hari ini** tersedia di `GET /db/download/{YYMMDD}`
      dan memuat tabel `master_nasabah`.
- [ ] Endpoint `POST /transaksi/sync` dan `POST /transaksi/penarikan` aktif di API lembaga.
- [ ] Skema enkripsi (`keyVersion` / AES) & hashing di server **identik** dengan aplikasi.
- [ ] Akun petugas terdaftar dengan `kode_group1..3` & `unit_kerja` yang benar — nilai ini
      menentukan nasabah mana yang terlihat oleh petugas.

> **Catatan riwayat:** hingga versi 1.0.0 repo ini menyertakan folder `backend/` berisi
> layanan Express pendamping untuk membangkitkan berkas SQLite master dari MySQL. Folder
> tersebut **sudah dihapus** karena fungsinya kini sepenuhnya ditangani sisi server lembaga.

## 8. Verifikasi Pasca-Build

1. **Instalasi** — APK terpasang, aplikasi terbuka ke Login, dialog izin muncul.
2. **Konfigurasi lembaga** — kode lembaga valid mengembalikan nama lembaga (bukti API pusat OK).
3. **Login** — sukses masuk ke Buka Kas (bukti API lembaga + dekripsi payload OK).
4. **Unduh DB** — pencarian nasabah mengembalikan hasil (bukti berkas SQLite valid).
5. **Filter wilayah** — nasabah di luar unit kerja petugas **tidak** muncul.
6. **Uji offline** — matikan data seluler → **setoran tetap berhasil**, tersimpan lokal.
7. **Uji sinkronisasi** — hidupkan kembali data → transaksi berpindah ke status tersinkron
   dalam ±10 detik.
8. **Uji penarikan** — dengan jaringan mati, penarikan **harus gagal** dengan pesan jelas dan
   **tidak** tersimpan lokal.
9. **Cetak struk** — struk tercetak, nomor rekening ter-*mask*, lebar kertas sesuai.
10. **Fallback RawBT** — ganti driver ke `rawbt`, pastikan deep link membuka RawBT.
11. **Blokir tutup kas** — dengan transaksi tertunda, Tutup Kas **harus ditolak**.
12. **Auto-logout** — diamkan 5 menit → aplikasi logout sendiri.

## 9. Rilis & Rollback

- **Rilis**: build profil `preview` (APK) → uji sesuai Bagian 8 → bagikan tautan/QR ke petugas.
- **Rollback**: bagikan kembali APK versi sebelumnya dari riwayat build EAS. Karena distribusi
  internal (bukan store), rollback cepat dan tidak menunggu peninjauan.
- **Kompatibilitas data**: perubahan skema tabel lokal berisiko pada perangkat yang masih
  menyimpan transaksi tertunda. **Pastikan seluruh petugas tutup kas dengan bersih sebelum
  memasang versi yang mengubah skema `Transaksi`.**
- **OTA**: `expo-updates` terpasang dan dipakai untuk `reloadAsync()` saat logout, **tetapi
  EAS Update belum dikonfigurasi** — perbaikan JS masih memerlukan rebuild & pemasangan ulang.

## 10. Troubleshooting

| Gejala | Kemungkinan Penyebab | Solusi |
|--------|----------------------|--------|
| "API URL belum diatur" | Kode lembaga belum disimpan | Setting → input kode lembaga hingga nama lembaga tampil |
| Pencarian nasabah kosong | DB master belum diunduh / tanggal berbeda | Unduh DB hari ini; nama berkas mengikuti `YYMMDD` |
| Nasabah ada tapi tak muncul | Filter wilayah kerja (`kode_group`/`kode_kantor`) | Cek profil `user_login`; pastikan nasabah dalam unit kerja petugas |
| Nasabah tak muncul walau benar | Query mensyaratkan `status = '1'` & `saldo_akhir > 0` | Verifikasi data di Core |
| Data kosong walau respons sukses | Gagal dekripsi (`BASE_KEY`/`keyVersion` beda) | Sinkronkan kunci & algoritme dengan backend, lalu rebuild |
| Login selalu gagal | Skema hash berbeda dengan backend | Selaraskan hashing SHA1 di `authUtils.ts` |
| Transaksi tidak tersinkron | Tidak ada sinyal / sesi kedaluwarsa | Cek NetInfo & `user_login.expires`; sinkronisasi dilewati bila sesi habis |
| Tutup kas selalu ditolak | Masih ada transaksi `isSync = 0` | Buka tab Sync, kirim ulang hingga bersih |
| Printer tidak terhubung | Belum dipasangkan / izin Bluetooth ditolak | Pasangkan di pengaturan Android; berikan izin `BLUETOOTH_CONNECT` & `BLUETOOTH_SCAN` |
| Struk terpotong | `printer_width` tidak sesuai kertas | Ganti antara 32 (58mm) & 48 (80mm) |
| "Modul printer tidak tersedia" | Build tanpa modul native (mis. Expo Go) | Pakai development build / APK EAS |
| RawBT tidak terbuka | Aplikasi RawBT belum terpasang | Pasang dari Play Store |
| Aplikasi logout sendiri | Idle 5 menit atau sesi 24 jam habis | Perilaku by design |
| Error `prepareAsync`/NullPointer | Instance DB basi setelah berkas diganti | Sudah ada retry otomatis; bila berulang, tutup & buka ulang aplikasi |
| Build EAS gagal (versi CLI) | CLI < `16.20.1` | Perbarui `eas-cli` |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 31 Juli 2026 | | Dibuat dari `app.json`, `eas.json`, `package.json`, & kode sumber repo `Mobile-Branchless`. |

---

*[← Kembali ke Mobile Branchless](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
