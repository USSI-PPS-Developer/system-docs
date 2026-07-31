# 📐 Software Requirements Specification (SRS) — Mobile Branchless

> Spesifikasi kebutuhan perangkat lunak untuk **Mobile Branchless** (**IBS BranchlessPro**) — aplikasi mobile petugas lapangan (React Native/Expo) dengan arsitektur *offline-first* dan sinkronisasi latar belakang.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | Mobile Branchless   |
| Jenis Dokumen     | Software Requirements Specification (SRS) |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 31 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Pendahuluan

### 1.1 Tujuan

Mendefinisikan kebutuhan fungsional & non-fungsional aplikasi **Mobile Branchless**, aplikasi
mobile petugas lapangan yang melayani transaksi tabungan & kredit di lokasi nasabah, bekerja
tanpa koneksi, dan menyinkronkan data ke server lembaga saat jaringan tersedia.

### 1.2 Ruang Lingkup

Aplikasi menangani konfigurasi lembaga, autentikasi petugas, siklus kas harian, transaksi
tabungan (setoran, penarikan, rekening koran, reversal), transaksi kredit (angsuran, riwayat,
reversal), pencarian nasabah offline, sinkronisasi transaksi, pencetakan struk thermal, serta
pelaporan harian. Aplikasi **memiliki basis data lokal** (berbeda dari klien mobile murni),
tetapi **tidak** menjalankan pembukuan Core Banking.

### 1.3 Definisi & Akronim

| Istilah | Penjelasan |
|---------|------------|
| Branchless | Layanan keuangan tanpa kantor cabang, dibawa petugas ke lokasi nasabah |
| Expo | Framework/tooling React Native (SDK 54) |
| DB master | Berkas SQLite `dbbranchless_YYMMDD.db` berisi `master_nasabah`, read-only, per tanggal |
| DB lokal | Berkas SQLite `branchless2025.db` berisi `Transaksi`, `LogAktivitas`, `SaldoKas` |
| Kode lembaga | Identitas BPR/koperasi; menentukan `api_url` yang dipakai aplikasi |
| `api_url` | Base URL API spesifik lembaga (disimpan di SecureStore) |
| `DEFAULT_API` | Base URL API pusat (lookup lembaga, OTP, otorisasi, lokasi) |
| `responseData` | Field payload sukses yang **terenkripsi AES** dari server |
| `keyVersion` | Penanda versi kunci harian untuk derivasi kunci AES |
| `isSync` | Penanda transaksi sudah terkirim ke server (`0` = tertunda) |
| `isReversal` | Penanda transaksi telah dibatalkan (tidak dihapus) |
| ESC/POS | Protokol perintah printer thermal |
| RawBT | Aplikasi pihak ketiga sebagai jalur cetak cadangan |
| SecureStore | Penyimpanan terenkripsi perangkat (`expo-secure-store`) |

### 1.4 Referensi

- [BRD — Mobile Branchless](01-brd.md)
- [Deployment Guide — Mobile Branchless](10-deployment-guide.md)
- Repo sumber: `Mobile-Branchless` — lihat `CLAUDE.md` (arsitektur & konvensi) dan
  `FRONTEND.md` (struktur UI) di dalam repo.

## 2. Deskripsi Umum

### 2.1 Perspektif Produk

Aplikasi mobile **stateful** dengan basis data lokal. Berbeda dengan klien mobile murni,
aplikasi ini **dapat beroperasi penuh tanpa jaringan** untuk sebagian besar alur, dan
memperlakukan server sebagai tujuan sinkronisasi, bukan sumber data waktu nyata.

```
                    ┌──────────────────┐
                    │   API Pusat      │  lembaga, OTP, otorisasi, lokasi
                    │  (DEFAULT_API)   │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  API Lembaga     │  login, sync, mutasi, unduh DB
                    │   (api_url)      │
                    └────────┬─────────┘
                             │  ▲
                    unduh DB │  │ POST /transaksi/sync (tiap 10 detik saat online)
                             ▼  │
┌────────────────────────────────────────────────┐
│                  Perangkat Petugas             │
│                                                │
│  dbbranchless_YYMMDD.db   branchless2025.db    │
│  (master_nasabah,          (Transaksi,         │
│   read-only, per hari)      LogAktivitas,      │
│                             SaldoKas)          │
│                                                │
│  SecureStore: sesi, kredensial, config printer │
│  Zustand: device info (in-memory)              │
└────────────────────────────────────────────────┘
                             │ ESC/POS via Bluetooth
                             ▼
                   Printer thermal (58mm / 80mm)
```

> **Catatan arsitektur penting.** Terdapat **dua basis data SQLite terpisah** dengan modul
> berbeda yang sama-sama mengekspor `getDB()` — `src/db/sqlite.ts` (data transaksi, persisten)
> dan `src/api/nasabahApi.ts` (master nasabah, per tanggal, read-only). Keduanya tidak boleh
> tertukar.

### 2.2 Fungsi Utama

Konfigurasi Lembaga · Login (biasa & biometrik) · Buka/Tutup Kas · Setoran · Penarikan
(OTP & otorisasi) · Angsuran Kredit · Rekening Koran · Reversal · Pencarian Nasabah Offline ·
Pemindaian QR · Sinkronisasi · Cetak Struk · Rekap Harian · Log Aktivitas.

### 2.3 Karakteristik Pengguna

| Pengguna | Karakteristik | Kebutuhan |
|----------|---------------|-----------|
| Petugas lapangan | Bekerja mobile, sering di area sinyal lemah, memegang uang tunai | Alur cepat, dapat offline, bukti cetak, kejelasan saldo kas |
| Supervisor | Menyetujui transaksi berisiko dari back-office | Notifikasi permintaan otorisasi & konteks transaksi |

### 2.4 Batasan Umum

- **Tidak berjalan di Expo Go** — memerlukan *development build* (modul printer BLE native).
- **DB master read-only & per tanggal** — perubahan data nasabah baru terlihat setelah unduh ulang.
- **Penarikan memerlukan koneksi**; setoran & angsuran dapat offline.
- Aplikasi **selalu memakai tema terang**; dark mode belum diaktifkan.
- Orientasi dikunci **portrait**.
- Kunci enkripsi & *encoding* **tertanam di kode** dan harus identik dengan backend.

## 3. Kebutuhan Fungsional

Kode: **FR-xx**. Referensi berkas menunjuk ke repo `Mobile-Branchless`.

### 3.1 Konfigurasi Lembaga & Perangkat

| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-01 | Atur lembaga | Layar `LoginScreen` → modal `setting`: input kode lembaga → `GET /lembaga/kode/{kode}` (`DEFAULT_API`); simpan `kode_lembaga`, `nama_lembaga`, `alamat_lembaga`, `api_url` di SecureStore. |
| FR-02 | Identitas perangkat | `getDeviceInfo()` → `deviceId` (Android ID / iOS IDFV), fallback UUID disimpan sebagai `fallback_device_id`; disimpan juga di store Zustand `useDeviceInfoStore`. |
| FR-03 | Header perangkat | Interceptor axios menyisipkan `X-Device-Id` & `X-Device-Name` pada tiap request. |
| FR-04 | Unduh DB master | `downloadDataFromAPI()` → `GET /db/download/{YYMMDD}` (`api_url`); simpan ke `cacheDirectory` sebagai `dbbranchless_YYMMDD.db`. |
| FR-05 | Validasi berkas DB | Setelah unduh, berkas dibuka & diverifikasi memiliki tabel `master_nasabah`; berkas kosong/korup dihapus dan dilaporkan gagal. |
| FR-06 | Reset instance DB | `resetDBInstance()` dipanggil sebelum mengganti berkas DB agar koneksi lama dilepas. |

### 3.2 Autentikasi & Sesi

| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-07 | Login | `POST /login` (`api_url`) dengan `{username, password, kodeLembaga}`; password di-hash **SHA1(uppercase)** sebelum dikirim. |
| FR-08 | Simpan sesi | Sukses → `user_login` di SecureStore berisi data server + `username`, `password`, `expires` (24 jam). |
| FR-09 | Token otorisasi | Interceptor menyisipkan `Authorization: Bearer <token>` dari `user_login`. |
| FR-10 | Ingat saya | Bila diaktifkan, `user_name` & `user_pass` disimpan di SecureStore. |
| FR-11 | Login biometrik | `expo-local-authentication`; kredensial di `biometric_user` (`passwordEncrypted`); aktif bila perangkat mendukung & `biometric_ready = "true"`. |
| FR-12 | Auto-logout idle | `useIdleLogout`: 5 menit tanpa interaksi → logout otomatis; interaksi dilacak via `onTouchStart` di `HomeScreen`. |
| FR-13 | Logout manual | Konfirmasi → hapus `user_login`, `resetDBInstance()`, `Updates.reloadAsync()` dengan fallback `navigation.reset`. |
| FR-14 | Kedaluwarsa sesi | Saat `HomeScreen` dimuat, `expires` dicek; bila lewat → sesi dihapus & petugas diminta login ulang. |

### 3.3 Kas Harian

| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-15 | Paksa buka kas | Bila `kas_opened_<YYYY-MM-DD>` belum ada dan `kas_closed_<tgl>` juga belum ada → `HomeScreen` masuk mode `bukaKas`. |
| FR-16 | Buka kas | Input saldo awal (validasi numerik ≥ 0) → simpan `kas_opened_<tgl>` + catat ke `SaldoKas` sebagai `setoran`. |
| FR-17 | Buku kas berjalan | `updateSaldoKas()` menambah baris tiap transaksi: `setoran`/`angsuran` menambah saldo, `penarikan` mengurangi. Tabel bersifat *append-only*. |
| FR-18 | Saldo kas terakhir | `getSaldoKasTerakhir()` mengambil baris `id` terbesar milik `userId`. |
| FR-19 | Validasi tutup kas | `getAllTransaksiUnSync()` dicek lebih dulu; bila > 0 → **tutup kas ditolak** dengan pesan jumlah transaksi tertunda. |
| FR-20 | Tutup kas | Konfirmasi → catat penarikan sebesar saldo akhir, hapus `kas_opened_<tgl>`, set `kas_closed_<tgl>`, lalu **logout otomatis**. |

### 3.4 Pencarian Nasabah

| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-21 | Cari nasabah offline | `cariNasabah(query)` pada DB master: `no_rekening LIKE ? OR nama_nasabah LIKE ?`, `status = '1'`, `saldo_akhir > 0`, `LIMIT 5`. |
| FR-22 | Filter wilayah kerja | Query ditambah filter dinamis `kode_group1`, `kode_group2`, `kode_group3`, `kode_kantor` dari `user_login`. |
| FR-23 | Dekode kolom nasabah | Kolom `no_rekening`, `nama`, `alamat` di-*decode* sebelum ditampilkan. |
| FR-24 | Debounce & retry | Pencarian di-*debounce* (`NasabahSearchBox`); error `prepareAsync`/`NullPointerException` memicu reset instance DB dan satu kali percobaan ulang. |
| FR-25 | Pindai QR | `expo-camera` via `QRScannerModal`; hasil scan mengisi nomor rekening. |

### 3.5 Transaksi Tabungan

| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-26 | Setoran (offline-first) | `mockSetoranApi()` menulis transaksi ke DB lokal dengan `isSync: 0`, `tipe: "setoran"`; sinkronisasi menyusul. |
| FR-27 | Penarikan (online-first) | `mockPenarikanApi()` memanggil `POST /transaksi/penarikan` **lebih dulu**; hanya bila sukses transaksi ditulis lokal dengan `isSync: 1`. Gagal → `Promise.reject` agar layar menampilkan error. |
| FR-28 | OTP nasabah | `requestOtpApi()` → `POST /transaksi/otp-request` (`DEFAULT_API`) dengan `{rekening, nominal, userId, apiUrl}`. |
| FR-29 | Permintaan otorisasi | `requestOtorisasiApi()` → `POST /transaksi/otorisasi-request` dengan `{rekening, nominal, tipe, userId, detail, apiUrl, lembaga}` → `requestId`. |
| FR-30 | Cek status otorisasi | `checkOtorisasiStatusApi()` → `GET /transaksi/otorisasi-check?request_id=` → `pending`/`approved`/`rejected`. |
| FR-31 | Rekening koran | `rekeningKoranAPI()` → `GET /mutasi/koran?no_rekening=`. |
| FR-32 | Reversal tabungan | `updateTransaksiReversal(id)` menandai `isReversal = 1` (tidak menghapus) & mencatat log aktivitas. |
| FR-33 | Nomor referensi | `generateNoRef()` → `BRP` + timestamp base36 + 4 karakter acak, maksimum 20 karakter. |

### 3.6 Transaksi Kredit

| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-34 | Angsuran kredit | `mockAngsuranApi()` menulis transaksi `tipe: "angsuran"` ke DB lokal (`isSync: 0`). |
| FR-35 | Riwayat kredit | `RiwayatKreditScreen` — **saat ini masih memakai data contoh** (`mockKreditHistoryApi`). |
| FR-36 | Reversal kredit | `ReversalKreditScreen`; mekanisme penandaan sama dengan FR-32. |

### 3.7 Sinkronisasi

| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-37 | Sinkronisasi otomatis | `GlobalAutoSync` memasang interval **10 detik** saat `AppState` kembali `active`; interval dihentikan saat aplikasi ke latar belakang. |
| FR-38 | Deteksi konektivitas | `NetInfo.fetch()` dicek sebelum tiap upaya sinkronisasi. |
| FR-39 | Kirim batch | `POST /transaksi/sync` dengan `{ transaksi: [...] }` berisi seluruh transaksi `isSync = 0`. |
| FR-40 | Tanda tangan permintaan | Header `X-Timestamp` & `X-Signature` = `SHA1(JSON(payload) + timestamp + ENCRYPT_KEY)`. |
| FR-41 | Normalisasi tanggal/jam | Format `dd/mm/yyyy hh.mm.ss` dinormalkan ke `YYYY-MM-DD` + `HH:mm:ss`; fallback jam `00:00:00`. |
| FR-42 | Tandai tersinkron | Sukses → `updateTransaksiSync(id)` untuk tiap transaksi. |
| FR-43 | Lewati sesi kedaluwarsa | Bila `user_login.expires` terlampaui, sinkronisasi dilewati. |
| FR-44 | Sinkronisasi manual | `SyncTransaksiScreen` (tab **sync**) untuk memicu pengiriman ulang. |
| FR-45 | Ambil mutasi server | `fetchMutasiFromServer(from, to, userName)` → `GET /mutasi`. |

### 3.8 Pencetakan Struk

| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-46 | Bangun struk ESC/POS | `buildSlip()` menyusun header lembaga, judul, `noRef`, detail, area tanda tangan, & footer. |
| FR-47 | Lebar kertas | 32 karakter (58mm) atau 48 karakter (80mm) dari `printer_width`. |
| FR-48 | Mask nomor rekening | `maskRekening()` — 4 digit depan + `X` + 4 digit belakang; berlaku juga di dalam teks keterangan. |
| FR-49 | Cetak via BLE | Driver `internal`: `BLEPrinter.init()` + `connectPrinter(printer_address)` + `printText()`; logo opsional via `printImage()`. |
| FR-50 | Cetak via RawBT | Driver `rawbt`: deep link `rawbt:base64,<payload>`; bila aplikasi tidak terpasang, tawarkan buka Play Store. |
| FR-51 | Pratinjau struk | `StrukPreviewModal` menampilkan bukti transaksi sebelum dicetak. |
| FR-52 | Cetak otomatis | Preferensi `auto_print_struk` mencetak langsung setelah transaksi berhasil. |
| FR-53 | Cetak ulang | `CetakStrukScreen` menampilkan daftar transaksi & memungkinkan cetak ulang. |

### 3.9 Pelaporan & Audit

| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-54 | Rekap harian | `LaporanRekapScreen` merangkum transaksi hari berjalan. |
| FR-55 | Daftar transaksi | `getAllTransaksi()` diurut `tanggal DESC`, disaring per `userId`. |
| FR-56 | Log aktivitas | `insertLog(aktivitas, detail)` dipanggil pada insert transaksi & reversal; `detail` di-*encode*. |
| FR-57 | Backup & reset harian | `backupAndResetHarian()` menyalin `Transaksi`/`LogAktivitas`/`SaldoKas` ke tabel `*Backup` lalu mengosongkan tabel utama. |
| FR-58 | Pembersihan backup | `cleanOldBackup()` menghapus data backup lebih dari 7 hari. |

### 3.10 Umum / Lintas-Potong

| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-59 | Izin perangkat | `App.tsx` meminta izin Bluetooth (connect/scan), lokasi (fine/coarse), & kamera saat aplikasi dimulai. |
| FR-60 | Inisialisasi tabel | `initTransaksiTable()`, `initLogTable()`, `initSaldoKasTable()` dijalankan saat aplikasi dimulai. |
| FR-61 | Pemantauan lokasi | `useSendLocation` mengirim `POST /devices/user/location` (`DEFAULT_API`) tiap **60 detik** berisi `{username, lat, lng, waktu, deviceId}`. |
| FR-62 | Dekripsi payload | `decryptPayload(keyVersion, responseData)` (AES-ECB/PKCS7) sebelum data dipakai. |
| FR-63 | Enkode data lokal | Kolom `rekening`, `nama`, `nominal`, `noRef`, `keteranganTrx` di-*encode* sebelum disimpan; query berbasis rekening memakai nilai ter-*encode* sebagai parameter. |
| FR-64 | Alert global | `AlertProvider` (`useAlert()`) menyediakan `showAlert` & `showConfirm`. |
| FR-65 | Isolasi antar petugas | Seluruh query transaksi/log/kas disaring `userId` dari `user_login`. |

## 4. Kebutuhan Non-Fungsional

| ID | Kategori | Kebutuhan |
|----|----------|-----------|
| NFR-01 | **Ketersediaan offline** | Setoran, angsuran, pencarian nasabah, & pencetakan struk **wajib berfungsi tanpa jaringan**. Penarikan dikecualikan (butuh validasi server). |
| NFR-02 | **Integritas kas** | Tutup kas diblokir bila ada transaksi `isSync = 0`. Reversal menandai, tidak menghapus. `SaldoKas` *append-only* sehingga jejak saldo dapat ditelusuri. |
| NFR-03 | Keamanan sesi | Password di-hash SHA1 sebelum dikirim; sesi 24 jam; auto-logout idle 5 menit; biometrik opsional. |
| NFR-04 | Keamanan data | Payload sukses terenkripsi AES (kunci harian dari `keyVersion`); kolom sensitif DB lokal di-*encode*; tanda tangan `X-Signature` per permintaan. |
| NFR-05 | Keamanan (catatan) | Kunci AES (`IBS-ONBOARD-SECRET-KEY`) & kunci *encoding* (`branchless2025`) **tertanam di bundel** → bukan rahasia kuat. `encrypt()` berbasis base64 adalah **obfuskasi**, bukan enkripsi. Kredensial "ingat saya" & password di `user_login` tersimpan polos. Roadmap: pindahkan rahasia & otorisasi ke server. |
| NFR-06 | Kendali perangkat | `X-Device-Id` & `X-Device-Name` dikirim tiap permintaan untuk penyaringan/blacklist perangkat di backend. |
| NFR-07 | Ketertelusuran | Log aktivitas per petugas; pemantauan lokasi tiap 60 detik; `noRef` unik per transaksi. |
| NFR-08 | Kompatibilitas | Android (utama) & iOS; Expo SDK 54, React Native 0.81.5; orientasi portrait; `usesCleartextTraffic: true` (endpoint lembaga belum seluruhnya HTTPS). |
| NFR-09 | Kinerja | Pencarian nasabah `LIMIT 5` + debounce; DB master dibuka sebagai instance tunggal; timeout HTTP 15 detik. |
| NFR-10 | Ketahanan | Modul native opsional (`expo-updates`, `expo-location`, `expo-camera`, printer BLE) di-`require` dalam `try/catch` agar aplikasi tetap jalan bila modul tak tersedia; retry sekali pada error DB. |
| NFR-11 | Ketergunaan | Antarmuka & pesan **Bahasa Indonesia**; format uang `id-ID`; keypad numerik dengan nominal cepat; penjagaan `loading` mencegah kiriman ganda. |
| NFR-12 | Keterpeliharaan | TypeScript `strict`; util enkripsi/printer/API terpusat; peta menu tunggal di `menuRoutes.ts`. |
| NFR-13 | Konfigurasi | Tidak memakai berkas `.env` — konfigurasi runtime lewat SecureStore (kode lembaga → `api_url`), sehingga **satu APK melayani banyak lembaga**. |
| NFR-14 | Privasi & izin | Izin kamera, Bluetooth, & lokasi diminta di awal dengan penjelasan penggunaan. |

## 5. Antarmuka Eksternal

### 5.1 Antarmuka API

Seluruh permintaan melalui `getApiInstance(baseURL)` — instance axios dengan timeout 15 detik
dan interceptor header perangkat + token. Respons dianggap sukses bila `responseCode === '00'`.

| Endpoint | Metode | Base | Fungsi |
|----------|--------|------|--------|
| `/lembaga/kode/{kode}` | GET | Pusat | Detail lembaga + `api_url` |
| `/login` | POST | Lembaga | Login petugas |
| `/db/download/{YYMMDD}` | GET | Lembaga | Unduh berkas SQLite master |
| `/worker/generate-master-nasabah` | GET | Lembaga | Picu pembangkitan DB master |
| `/transaksi/sync` | POST | Lembaga | Sinkronisasi batch transaksi |
| `/transaksi/penarikan` | POST | Lembaga | Penarikan (validasi online) |
| `/transaksi/otp-request` | POST | Pusat | Kirim OTP ke nasabah |
| `/transaksi/otorisasi-request` | POST | Pusat | Minta otorisasi supervisor |
| `/transaksi/otorisasi-check` | GET | Pusat | Cek status otorisasi |
| `/mutasi/koran` | GET | Lembaga | Rekening koran |
| `/mutasi` | GET | Lembaga | Mutasi rentang tanggal |
| `/devices/user/location` | POST | Pusat | Lapor lokasi petugas |

### 5.2 Antarmuka Pengguna

Stack navigator hanya memiliki dua route: `Login` dan `Home`. Layar transaksi **tidak
didaftarkan sebagai route** — dirender sebagai overlay beranimasi dari peta `menuRoutes`,
dan menerima prop `onBack`. `HomeScreen` mengatur mode layar (`main`/`bukaKas`/`tutupKas`)
serta tab (`home`/`sync`/`setting`).

### 5.3 Antarmuka Perangkat Keras

| Perangkat | Keperluan |
|-----------|-----------|
| Printer thermal Bluetooth | Cetak struk ESC/POS (58mm/80mm) via `react-native-ble-plx` + `@haroldtran/react-native-thermal-printer` |
| Kamera | Pemindaian QR nomor rekening (`expo-camera`) |
| Sensor biometrik | Login sidik jari/wajah (`expo-local-authentication`) |
| GPS | Pemantauan lokasi petugas (`expo-location`) |

### 5.4 Ketergantungan Perangkat Lunak

React 19.1, React Native 0.81.5, Expo SDK 54, React Navigation 7 (native-stack), Zustand,
axios, crypto-js, expo-crypto, expo-sqlite, expo-secure-store, expo-camera, expo-location,
expo-local-authentication, expo-file-system, expo-print, expo-updates, `@react-native-community/netinfo`,
`react-native-ble-plx`, `@haroldtran/react-native-thermal-printer`, `react-native-qrcode-svg`,
lodash. Layanan eksternal: aplikasi **RawBT** (opsional, jalur cetak cadangan).

### 5.5 Basis Data Lokal

**`branchless2025.db`** — ditulis aplikasi:

| Tabel | Kolom Utama | Keterangan |
|-------|-------------|------------|
| `Transaksi` | `id` (PK), `rekening`*, `nama`*, `nominal`*, `noRef`*, `produk`, `tanggal`, `jam`, `keteranganTrx`*, `tipe`, `isSync`, `isReversal`, `userId` | `*` = kolom ter-*encode* |
| `LogAktivitas` | `id` (AUTOINCREMENT), `waktu`, `aktivitas`, `detail`*, `userId` | Jejak audit |
| `SaldoKas` | `id` (AUTOINCREMENT), `waktu`, `aktivitas`, `nominal`, `saldo`, `userId` | *Append-only* |
| `TransaksiBackup`, `LogAktivitasBackup`, `SaldoKasBackup` | — | Salinan harian, dibersihkan > 7 hari |

**`dbbranchless_YYMMDD.db`** — diunduh dari server, read-only: tabel `master_nasabah`
(`no_rekening`, `nama_nasabah`, `alamat`, `nama_produk`, `saldo_akhir`, `status`,
`kode_group1..3`, `kode_kantor`).

## 6. Matriks Ketertelusuran (Ringkas)

| Kebutuhan Bisnis (BRD) | FR / NFR terkait |
|------------------------|------------------|
| BR-001 | FR-01 |
| BR-002 | FR-07 … FR-11 |
| BR-003 | FR-12, NFR-03 |
| BR-004 | FR-15, FR-16 |
| BR-005 | FR-17, FR-18 |
| BR-006 | FR-19, FR-20, NFR-02 |
| BR-007 | FR-26, NFR-01 |
| BR-008 | FR-27 |
| BR-009 | FR-28, FR-29, FR-30 |
| BR-010 | FR-34 |
| BR-011 | FR-32, FR-36, NFR-02 |
| BR-012 | FR-04, FR-05, FR-21 |
| BR-013 | FR-22 |
| BR-014 | FR-37 … FR-44 |
| BR-015 | FR-46 … FR-49, FR-51 |
| BR-016 | FR-50 |
| BR-017 | FR-54, FR-55, FR-56 |
| BR-018 | FR-61, NFR-07 |
| BR-019 | FR-02, FR-03, NFR-06 |
| BR-020 | FR-62, FR-63, NFR-04, NFR-05 |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 31 Juli 2026 | | Dokumen dibuat berdasarkan kode sumber repo `Mobile-Branchless`. |

---

*[← Kembali ke Mobile Branchless](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
