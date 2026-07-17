# 📄 Business Requirement Document (BRD) — IBS Onboarding Admin

> Dokumen kebutuhan bisnis untuk produk **IBS Onboarding Admin** — dashboard back-office (frontend) bagi petugas BPR.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS Onboarding Admin |
| Jenis Dokumen     | Business Requirement Document (BRD) |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 17 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Latar Belakang

**IBS Onboarding Admin** adalah **aplikasi dashboard back-office** (Single Page Application) yang
dipakai **petugas/admin BPR** untuk mengelola dan memproses seluruh alur onboarding nasabah IBS:
verifikasi **registrasi calon nasabah**, **aktivasi akun nasabah existing** (OTP), pemrosesan
**pengajuan pembukaan rekening** (tabungan/deposito/kredit), serta pengelolaan **user aplikasi,
blacklist, dan banner/promo**.

Aplikasi ini adalah **konsumen (client) dari API `IBS Onboarding Backend`**. Pada BRD backend,
aplikasi back-office/dashboard admin secara eksplisit ditulis sebagai **Out of Scope** — produk
ini **mengisi gap tersebut**. Admin tidak mengakses Core Banking maupun database onboarding secara
langsung; seluruh aksi dilakukan dengan **menembak endpoint back-office** yang disediakan backend,
dan hasil approval-lah yang kemudian diposting backend ke Core.

Dibangun dengan **React 19 + TypeScript + Vite**, styling **TailwindCSS**, state via **Zustand**,
dan di-*deploy* sebagai aset statis di belakang **nginx** (reverse-proxy `/api` ke container
backend). Payload respons sukses dari backend **terenkripsi (AES kunci harian)** dan **didekripsi
di sisi klien** sebelum ditampilkan.

## 2. Tujuan (Business Objectives)

| Kode | Tujuan | Indikator Keberhasilan (KPI) |
|------|--------|------------------------------|
| OBJ-1 | Menyediakan **antarmuka back-office** tunggal bagi admin BPR untuk seluruh alur onboarding. | Semua aksi review/approve dapat dilakukan dari satu dashboard. |
| OBJ-2 | Mempercepat **verifikasi & pemrosesan** registrasi, aktivasi, & pengajuan rekening. | Registrasi/aktivasi/pengajuan dapat di-approve/reject tanpa akses DB. |
| OBJ-3 | Memberi admin **visibilitas operasional** melalui dashboard rekap. | Jumlah registrasi, akun aktif, antrean belum diproses, & pengajuan tampil real-time. |
| OBJ-4 | Menyediakan **manajemen data pendukung** (user, blacklist, banner) yang mudah. | CRUD user/blacklist/banner berjalan dari UI. |
| OBJ-5 | Menjamin **keamanan sesi** back-office. | Login admin, auto-logout saat idle, & dekripsi payload berjalan benar. |
| OBJ-6 | Menyediakan **UI konsisten & responsif** (desktop & mobile, light/dark). | Dashboard dapat dioperasikan nyaman di berbagai perangkat. |

## 3. Ruang Lingkup (Scope)

### ✅ In Scope
- **Autentikasi admin** — login back-office (`/admin/login`), dekripsi profil + token, simpan sesi
  di `localStorage`, **auto-logout saat idle**, konfirmasi logout manual.
- **Dashboard rekap** — kartu statistik: registrasi akun, akun aktif, aktivasi belum diproses,
  registrasi belum diproses, blacklist, & pengajuan rekening.
- **Manajemen Akun IBS Onboard** — lihat daftar/detail user aplikasi, ubah status, reset password,
  unblock akun terkunci, hapus.
- **Manajemen Registrasi (Calon Nasabah)** — lihat daftar/detail registrasi + foto KTP/selfie,
  **approve** (memicu OTP di backend) / **reject** (dengan alasan), ekspor detail ke PDF.
- **Manajemen Aktivasi Akun (Nasabah Existing)** — daftar antrean OTP, preview, **generate OTP**,
  hapus.
- **Pengajuan Pembukaan Rekening** — Tabungan, Deposito, Kredit: daftar, detail + dokumen,
  **approve** (lengkapi produk/kode kantor → backend posting ke Core) / **reject** (alasan).
- **Manajemen Blacklist** — CRUD data blacklist (device/NIK/no HP/username).
- **Manajemen Banner/Promo** — CRUD banner dengan upload gambar (multipart).
- **UX** — sidebar navigasi (desktop & mobile), breadcrumb, tema light/dark, tabel dengan
  pencarian, modal, notifikasi (SweetAlert2), ekspor PDF (jsPDF).

### ❌ Out of Scope
- **Logika bisnis onboarding & posting ke Core Banking** — dimiliki `IBS Onboarding Backend`.
- **Basis data** — aplikasi tidak menyimpan data di DB sendiri (semua via API).
- **Aplikasi nasabah (mobile/web)** — kanal end-user, bukan produk ini.
- **Penerbitan/kebijakan skema kontrak API** — kanonik di dokumen backend.
- **Pengelolaan enkripsi kunci** — skema kunci ditetapkan backend; frontend hanya menurunkan
  kunci harian yang sama untuk dekripsi.

## 4. Stakeholder

| Peran | Nama / Unit | Tanggung Jawab |
|-------|-------------|----------------|
| Sponsor | Manajemen TI BPR / USSI | Menyetujui pengadaan dashboard back-office. |
| Business Owner | Operasional / Unit Dana & Kredit BPR | Menetapkan alur review & kewenangan admin. |
| Product Owner | Tim Produk USSI | Memprioritaskan fitur dashboard. |
| Pengguna (Admin BPR / CS) | Petugas back-office BPR | Memverifikasi & memproses onboarding via dashboard. |
| Tim Backend | Tim USSI (`backendonboard`) | Menyediakan & memelihara API yang dikonsumsi. |
| Developer / Maintainer | Tim Frontend USSI | Pengembangan & pemeliharaan `admin-onboard`. |

## 5. Kebutuhan Bisnis

| ID | Kebutuhan Bisnis | Prioritas | Catatan |
|----|------------------|-----------|---------|
| BR-001 | Admin dapat **login** back-office dengan aman. | Wajib | `/admin/login`; token & profil dari `responseData` terenkripsi. |
| BR-002 | Sesi admin **auto-logout saat idle** & bisa logout manual dengan konfirmasi. | Wajib | `IdleLogout`/`IdleTimer`; token dibersihkan dari `localStorage`. |
| BR-003 | Admin melihat **rekap operasional** di dashboard. | Tinggi | 6 kartu statistik dari `/dashboard/*`. |
| BR-004 | Admin dapat **mengelola user** aplikasi (lihat, status, reset password, unblock, hapus). | Wajib | Halaman Manajemen Akun. |
| BR-005 | Admin dapat **mereview registrasi** & approve/reject dengan alasan. | Wajib | Approve memicu OTP di backend; reject wajib alasan. |
| BR-006 | Admin dapat **memproses aktivasi** (generate OTP) nasabah existing. | Wajib | Halaman Aktivasi; preview + generate + hapus. |
| BR-007 | Admin dapat **memproses pengajuan** tabungan/deposito/kredit (approve/reject). | Wajib | Approve melengkapi produk & kode kantor → backend posting ke Core. |
| BR-008 | Admin dapat **mengelola blacklist** (tambah/ubah/hapus). | Tinggi | Device/NIK/no HP/username. |
| BR-009 | Admin dapat **mengelola banner/promo** termasuk unggah gambar. | Sedang | Multipart upload; tampil/aktif per tanggal. |
| BR-010 | Admin dapat **melihat dokumen/foto** nasabah (KTP, selfie, agunan, dll.). | Tinggi | Disajikan backend sebagai file statis. |
| BR-011 | Admin dapat **mengekspor detail** registrasi/pengajuan ke PDF. | Sedang | jsPDF + autotable. |
| BR-012 | UI **responsif & mendukung tema** light/dark. | Sedang | Sidebar desktop/mobile; preferensi tersimpan. |

## 6. Proses Bisnis

### 6.1 Kondisi Saat Ini (As-Is)
Sebelum ada dashboard, verifikasi onboarding memerlukan akses langsung ke data/DB atau tools
teknis, sehingga hanya bisa dilakukan tim IT, lambat, dan rawan kesalahan operasional. Backend
menyediakan endpoint back-office, tetapi tanpa antarmuka, petugas non-teknis tidak dapat
memakainya.

### 6.2 Kondisi Diharapkan (To-Be)
Petugas BPR login ke dashboard, melihat antrean & rekap, membuka detail beserta foto/dokumen,
lalu menyetujui/menolak. Setiap aksi menembak endpoint back-office; backend yang menjalankan
logika (buat OTP, posting CIF & rekening ke Core). Dashboard cukup menampilkan hasil (yang
didekripsi di sisi klien) dan memberi umpan balik.

```
[Admin BPR]                         [IBS Onboarding Admin (SPA)]              [IBS Onboarding Backend]
   │ login                                │ POST /admin/login  ───────────────────► verifikasi, kirim token+profil (AES)
   │ lihat rekap                          │ GET /dashboard/*  ────────────────────► rekap (AES) ──► render kartu
   │ review registrasi/pengajuan          │ GET list & detail ────────────────────► data + URL foto
   │ approve / reject (+alasan)           │ POST/PUT approve|reject|status ───────► proses + posting ke Core
   ▼                                       ▼                                          ▼
 keputusan tercatat                    umpan balik (SweetAlert2)                 OTP / CIF / no_rekening
```

## 7. Asumsi & Batasan

- **Asumsi:**
  - **API `IBS Onboarding Backend` tersedia & dapat dijangkau** (via nginx proxy `/api` atau URL
    publik `VITE_BACKEND_URL`).
  - Skema **enkripsi AES kunci harian** frontend **identik** dengan backend
    (`BASE_KEY = "IBS-ONBOARD-SECRET-KEY"`, `SHA256(BASE_KEY + keyVersion)` → 32 char, mode ECB).
  - Foto/dokumen nasabah disajikan backend sebagai file statis relatif terhadap base URL.
- **Batasan:**
  - Platform: **React 19 + TypeScript + Vite**; build statis di-serve **nginx**.
  - **Env `VITE_*` di-*bake* saat build** (bukan runtime) — perubahan URL backend butuh rebuild.
  - **Tidak ada basis data** pada aplikasi ini; state hanya di memori (Zustand) & `localStorage`.
  - **Token tidak diverifikasi ketat oleh backend** (UUID; lihat kontrak backend §2.4) — kontrol
    akses bergantung pada pembatasan jaringan/reverse proxy.
  - Batas unggah gambar diatur nginx (`client_max_body_size 25m`).

## 8. Risiko Bisnis

| ID | Risiko | Dampak | Mitigasi |
|----|--------|--------|----------|
| RB-001 | Sesi admin dibiarkan terbuka | Akses tidak sah ke back-office | Auto-logout idle + konfirmasi logout. |
| RB-002 | `BASE_KEY` enkripsi tertanam di bundel frontend | Kunci dapat diekstrak dari JS publik | Batasi akses jaringan dashboard; roadmap: pindah rahasia & AuthZ ke backend. |
| RB-003 | Beda versi skema enkripsi frontend↔backend | Payload gagal didekripsi (data kosong) | Sinkronkan `keyVersion`/algoritme; uji lintas versi saat rilis. |
| RB-004 | Salah approve/reject | Pembukaan rekening keliru di Core | Dialog konfirmasi + tampilkan detail/foto sebelum aksi; reject wajib alasan. |
| RB-005 | URL backend salah saat build | Dashboard tidak dapat memanggil API | `VITE_BACKEND_URL` diverifikasi di CI/deploy; default `/api` via proxy. |
| RB-006 | Endpoint back-office tanpa AuthZ ketat | Aksi sensitif bisa dipanggil langsung | Reverse-proxy/allowlist jaringan; koordinasi hardening dengan tim backend. |

## 9. Kriteria Penerimaan (Acceptance Criteria)

- Admin berhasil **login**; token & profil (nama, kode kantor) terbaca dari `responseData`
  terenkripsi dan sesi bertahan setelah refresh.
- Dashboard menampilkan **6 kartu rekap** dengan angka dari `/dashboard/*`.
- Registrasi PENDING dapat di-**approve** (backend membuat OTP) & di-**reject** dengan alasan;
  detail + foto tampil sebelum aksi.
- Aktivasi: admin dapat **generate OTP**, preview, & hapus antrean.
- Pengajuan tabungan/deposito/kredit dapat di-**approve** (memilih produk & kode kantor) atau
  di-**reject** (alasan); umpan balik sukses/gagal tampil.
- CRUD **user, blacklist, banner** (termasuk upload gambar) berfungsi.
- Sesi **auto-logout** saat idle; logout manual meminta konfirmasi.
- UI berjalan **responsif** dan mendukung **light/dark**.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dokumen dibuat berdasarkan implementasi repo `admin-onboard` (React/TS/Vite) & kontrak `ibs-onboarding-backend`. |

---

*[← Kembali ke IBS Onboarding Admin](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
