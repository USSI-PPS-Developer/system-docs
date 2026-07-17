# 📦 IBS Onboarding Mobile

> Dokumentasi lengkap produk **IBS Onboarding Mobile** — aplikasi mobile **nasabah** (front-end) untuk onboarding & self-service perbankan IBS: registrasi, aktivasi (OTP), buka rekening (tabungan/deposito/kredit), cek saldo/mutasi, dan analisa finansial.

| Field           | Detail            |
|-----------------|-------------------|
| Produk          | IBS Onboarding Mobile |
| Slug            | `ibs-onboarding-mobile` |
| Nama Aplikasi   | **Digit By IBS** |
| Repo            | `ibs-onboard` (React Native + Expo + expo-router) |
| Platform        | Android & iOS (Expo, New Architecture) |
| Backend terkait | [IBS Onboarding Backend](../ibs-onboarding-backend/README.md) |
| Admin terkait   | [IBS Onboarding Admin](../ibs-onboarding-admin/README.md) |
| Kelengkapan Dok | 6/11 (55%) |
| Terakhir update | 17 Juli 2026    |

---

## 📚 Daftar Dokumen

| No | Dokumen | Status |
|----|---------|--------|
| 01 | [📄 BRD — Business Requirement Document](01-brd.md) | 🟡 Draft |
| 02 | [📐 SRS — Software Requirements Specification](02-srs.md) | 🟡 Draft |
| 03 | [🔌 API Integration / Consumption Reference](03-api-contract.md) | 🟡 Draft |
| 04 | 🗄️ Desain Database | ➖ N/A (mobile client, tanpa DB) |
| 05 | [🎨 Desain UI/UX](05-uiux-design.md) | 🟡 Draft |
| 06 | 🧪 Test Plan | ⬜ Belum dibuat |
| 07 | ✅ Test Case | ⬜ Belum dibuat |
| 08 | 🔗 SIT Documentation | ⬜ Belum dibuat |
| 09 | 🧾 UAT | ⬜ Belum dibuat |
| 10 | [🚀 Deployment Guide](10-deployment-guide.md) | 🟡 Draft |
| 11 | [📖 User Manual](11-user-manual.md) | 🟡 Draft |

> **Catatan pemilihan dokumen.** Produk ini adalah **mobile client (React Native/Expo)** yang
> mengonsumsi API `ibs-onboarding-backend`, sehingga:
> - **04 — Desain Database** ditandai **N/A**: aplikasi tidak punya basis data sendiri. State
>   sesi disimpan di **Zustand (in-memory)**; hanya `deviceId` yang dipersistkan via
>   **`expo-secure-store`**. Seluruh data bisnis berasal dari API backend.
> - **03 — API Contract** di-*reframe* menjadi **API Integration / Consumption Reference**:
>   kontrak request/response kanonik dimiliki backend
>   ([lihat kontrak backend](../ibs-onboarding-backend/03-api-contract.md)); dokumen di sini
>   memetakan **endpoint mana yang di-*fire* tiap layar mobile**, plus skema enkripsi payload,
>   header device, dan hashing kredensial.
> - **10 — Deployment Guide** berbentuk **build & distribusi EAS** (bukan deploy server):
>   profil `development` / `preview` (APK internal) & `production` (AAB, auto-increment).
>
> Dokumen tanpa tautan belum dibuat. Generate dengan:
> `analyst add <jenis> -p "IBS Onboarding Mobile"`

---

## 🔎 Ringkasan Teknis (hasil scan repo `ibs-onboard`)

**Stack.** React 19 · React Native 0.81 · Expo SDK 54 (New Architecture, React Compiler) ·
expo-router 6 (typed routes) · TypeScript · Zustand (state) · axios (HTTP) ·
crypto-js + expo-crypto (enkripsi/hashing) · lucide-react-native + @expo/vector-icons (ikon) ·
@gorhom/bottom-sheet & portal · react-native-reanimated · react-native-chart-kit (chart) ·
expo-camera / expo-image-picker / expo-image-manipulator (KTP & selfie) ·
Google Cloud Vision API (OCR KTP) · expo-local-authentication (Face ID/biometrik).

**Fitur utama.**
- **Onboarding**: `Register` (data diri + foto KTP & selfie) → `requestOtp` → `Aktivasi`
  (set username/password) → `Login`.
- **Home / self-service** (grup `(app)/home`): dashboard saldo (`BalanceCarousel`), daftar
  rekening, buka rekening (tabungan/deposito/kredit), info kantor, analisa finansial, profil.
- **Pengajuan**: tabungan, deposito, kredit (multipart upload beberapa foto: KTP, selfie, KK,
  NPWP, agunan 1–5) + cek status & detail pengajuan.

**Integrasi API** (`utils/api.ts`).
- Base URL dari env `API_BASE_URLS` (comma-separated) dengan **rotasi/failover** antar host.
- Setiap request mengirim header **`X-Device-Id`** & **`X-Device-Name`** dari device store.
- Respons sukses (`responseCode === '00'`) membungkus data di `responseData` **terenkripsi AES**
  → didekripsi `decryptPayload(keyVersion, responseData)`.
- Endpoint yang dipakai: `/register`, `/otp/request`, `/aktivasi`, `/login`, `/saldo`,
  `/mutasi`, `/password/change`, `/info-kantor`, `/banner`, `/analisa`,
  `/pengajuan-tabungan`, `/pengajuan-deposito`, `/pengajuan-kredit`,
  `/pengajuan/cekstatus/{user_id}`, `/pengajuan/detail`.

**Keamanan.**
- Password di-hash **SHA-256** sisi klien sebelum dikirim: `SHA256(password:username:SECRET)`
  dengan `SECRET = "IBS_DIGIT2025"`.
- Enkripsi payload: `key = SHA256("IBS-ONBOARD-SECRET-KEY" + keyVersion).slice(0,32)`,
  AES mode **ECB**, padding **PKCS7** — **harus identik dengan backend**.
- **Auto-logout idle** (~10 menit) di layout `(app)`; sesi wajib login ulang saat app dibuka.

---

*[← Kembali ke Daftar Produk](../../README.md)*

*Dikelola oleh **Analyst CLI**.*
