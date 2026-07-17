# 📐 Software Requirements Specification (SRS) — IBS Onboarding Admin

> Spesifikasi kebutuhan perangkat lunak untuk **IBS Onboarding Admin** — dashboard back-office (SPA) pengelola onboarding nasabah IBS.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS Onboarding Admin |
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
Mendefinisikan kebutuhan fungsional & non-fungsional aplikasi **IBS Onboarding Admin**, sebuah
frontend SPA yang mengonsumsi API `IBS Onboarding Backend` untuk operasi back-office BPR.

### 1.2 Ruang Lingkup
Aplikasi menangani autentikasi admin, dashboard rekap, dan manajemen: akun user, registrasi
calon nasabah, aktivasi (OTP), pengajuan rekening (tabungan/deposito/kredit), blacklist, dan
banner. Aplikasi **tidak** memiliki basis data & tidak menjalankan logika onboarding (dimiliki
backend).

### 1.3 Definisi & Akronim
| Istilah | Penjelasan |
|---------|------------|
| SPA | Single Page Application (React Router, tanpa reload) |
| Backend | `IBS Onboarding Backend` (`backendonboard`, Spring Boot) |
| `responseData` | Field payload sukses yang **terenkripsi AES** dari backend |
| `keyVersion` | Penanda versi kunci harian untuk derivasi kunci AES |
| CIF | Customer Information File di Core Banking |
| OTP | One-Time Password untuk aktivasi akun |

### 1.4 Referensi
- [BRD — IBS Onboarding Admin](01-brd.md)
- [API Integration / Consumption Reference](03-api-contract.md)
- [Kontrak API kanonik — IBS Onboarding Backend](../ibs-onboarding-backend/03-api-contract.md)

## 2. Deskripsi Umum

### 2.1 Perspektif Produk
Klien murni (browser). Semua data via HTTP ke backend melalui `VITE_BACKEND_URL` (default `/api`,
di-proxy nginx ke container `backend-onboard:8855`). Payload sukses didekripsi di sisi klien.

```
[Browser Admin] ── React SPA (nginx :80/:8080) ── /api ──► [nginx proxy] ──► [backend-onboard:8855] ──► [IBS Core / DB]
```

### 2.2 Fungsi Utama
Login admin · Dashboard rekap · Manajemen Akun · Manajemen Registrasi · Manajemen Aktivasi ·
Pengajuan Rekening (Tabungan/Deposito/Kredit) · Manajemen Blacklist · Manajemen Banner.

### 2.3 Karakteristik Pengguna
| Pengguna | Karakteristik | Kebutuhan |
|----------|---------------|-----------|
| Admin/CS BPR | Non-teknis, operasional harian | UI jelas, alur review cepat, umpan balik eksplisit |
| Supervisor | Memantau volume onboarding | Rekap dashboard |

### 2.4 Batasan Umum
- Env `VITE_*` di-*bake* saat build (Vite) — bukan konfigurasi runtime.
- Tidak ada penyimpanan server-side; hanya `localStorage` (token, user, tema).
- Bergantung penuh pada ketersediaan & kontrak backend.

## 3. Kebutuhan Fungsional

Kode: **FR-xx**. Setiap FR memetakan aksi UI ke endpoint backend (detail di
[03-api-contract.md](03-api-contract.md)).

### 3.1 Autentikasi & Sesi
| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-01 | Login admin | Form username/password → `POST /admin/login`; jika `responseCode="00"`, dekripsi `responseData` → simpan `token` & `user` di `localStorage` + store. |
| FR-02 | Proteksi route | Route `/dashboard` hanya dapat diakses bila ada `token`; jika tidak, redirect ke `/login`. |
| FR-03 | Auto-logout idle | `IdleLogout`/`IdleTimer` menghapus token & mengarahkan ke `/login` setelah periode idle. |
| FR-04 | Logout manual | Tombol logout menampilkan konfirmasi (SweetAlert2) sebelum menghapus sesi. |
| FR-05 | Persistensi sesi | Token & profil bertahan setelah refresh (dibaca dari `localStorage` saat init store). |

### 3.2 Dashboard
| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-06 | Rekap statistik | Ambil paralel `GET /dashboard/{registrasi-akun, akun-aktif, aktivasi-belum-diproses, registrasi-belum-diproses, blacklist, pengajuan-rekening}` (header `Authorization: Bearer <token>`); dekripsi & tampilkan sebagai kartu. |

### 3.3 Manajemen Akun (User IBS Onboard)
| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-07 | Daftar user | `GET /user`; tabel dengan pencarian (username, nik, cif, nama, no_hp, device_id, device_name, status). |
| FR-08 | Detail user | `GET /user/{id}`. |
| FR-09 | Ubah status | `PATCH /user/{id}/status` body `{status}` (mis. ACTIVE/LOCKED/…), dengan konfirmasi. |
| FR-10 | Reset password | `PATCH /user/{id}/reset-password`. |
| FR-11 | Unblock akun | `PATCH /user/{id}/unblock` (untuk status LOCKED). |
| FR-12 | Hapus user | `DELETE /user/{id}` dengan konfirmasi. |

### 3.4 Manajemen Registrasi (Calon Nasabah)
| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-13 | Daftar registrasi | `GET /register`; status PENDING/APPROVED/REJECTED. |
| FR-14 | Detail + foto | `GET /register/{id}`; tampilkan foto KTP/selfie (URL `{BACKEND}/{foto}`). |
| FR-15 | Approve | `POST /register/{id}/approve` (memicu OTP di backend). |
| FR-16 | Reject | `POST /register/{id}/reject` body `{alasan}` (wajib). |
| FR-17 | Ekspor PDF | Ekspor detail registrasi via jsPDF + autotable. |

### 3.5 Manajemen Aktivasi (Nasabah Existing / OTP)
| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-18 | Daftar antrean | `GET /otp/list`. |
| FR-19 | Preview | `GET /otp/preview?id={id}`. |
| FR-20 | Generate OTP | `POST /otp/generate?id={id}`. |
| FR-21 | Hapus antrean | `DELETE /otp/delete?id={id}`. |

### 3.6 Pengajuan Pembukaan Rekening
Berlaku untuk **Tabungan**, **Deposito**, **Kredit** (pola identik, base path beda).
| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-22 | Daftar pengajuan | `GET /pengajuan-{tabungan\|deposito\|kredit}`. |
| FR-23 | Detail + dokumen | `GET /pengajuan-.../{id}`; tampilkan dokumen (KTP, KK, NPWP, agunan, dll.). |
| FR-24 | Data master approve | Tabungan `GET /tab-produk`; Deposito `GET /dep-produk`; Kredit `GET /kredit-produk`; semua `GET /kode-kantor`. |
| FR-25 | Approve | `PUT /pengajuan-.../{id}/status` body `{status:"APPROVED", ...produk/kantor}` → backend posting ke Core (CIF + no_rekening). |
| FR-26 | Reject | `PUT /pengajuan-.../{id}/status` body `{status:"REJECTED", alasan}`. |
| FR-27 | Ekspor PDF | Ekspor detail pengajuan via jsPDF. |

### 3.7 Manajemen Blacklist
| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-28 | Daftar | `GET /blacklist`. |
| FR-29 | Tambah/Ubah | `POST`/`PUT /blacklist` body form (device/NIK/no HP/username + alasan). |
| FR-30 | Hapus | `DELETE /blacklist/{id}`. |

### 3.8 Manajemen Banner/Promo
| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-31 | Daftar | `GET /banner/all`. |
| FR-32 | Tambah/Ubah | `POST`/`PUT /banner` **multipart/form-data** (title, detail, image, start_date, end_date, status). |
| FR-33 | Hapus | `DELETE /banner/{id}`. |
| FR-34 | Tampilkan gambar | URL gambar `{BACKEND}/{image}`. |

### 3.9 Umum / UX
| ID | Kebutuhan | Detail |
|----|-----------|--------|
| FR-35 | Navigasi | Sidebar (desktop) & MobileSidebar dengan submenu Pengajuan; breadcrumb. |
| FR-36 | Tema | Toggle light/dark; auto-deteksi `prefers-color-scheme`; simpan `ibs:theme`. |
| FR-37 | Tabel data | Komponen `DataTable` reusable dengan pencarian & render kolom kustom. |
| FR-38 | Notifikasi | SweetAlert2 untuk konfirmasi, sukses, & error. |
| FR-39 | Dekripsi payload | `decode()`/`decryptPayload()` mendekripsi `responseData` sebelum render. |

## 4. Kebutuhan Non-Fungsional

| ID | Kategori | Kebutuhan |
|----|----------|-----------|
| NFR-01 | Keamanan | Route terproteksi token; auto-logout idle; reject registrasi/pengajuan wajib alasan; dialog konfirmasi untuk aksi destruktif. |
| NFR-02 | Keamanan (catatan) | `BASE_KEY` AES tertanam di bundel klien & token backend tidak diverifikasi ketat → **wajib** batasi akses jaringan (reverse proxy/allowlist). Roadmap: pindahkan rahasia/AuthZ ke sisi server. |
| NFR-03 | Kompatibilitas | Browser modern (Chrome/Edge terbaru); responsif desktop & mobile. |
| NFR-04 | Kinerja | Aset ber-hash Vite di-cache immutable; gzip via nginx; `index.html` no-cache agar rilis langsung terbaca. |
| NFR-05 | Ketergunaan | UI konsisten (Tailwind), umpan balik jelas, dukungan light/dark. |
| NFR-06 | Keterpeliharaan | TypeScript strict, ESLint; struktur `components/pages` per domain; util enkripsi terpusat. |
| NFR-07 | Konfigurasi | `VITE_APP_NAME`, `VITE_APP_DESCRIPTION`, `VITE_BACKEND_URL` (di-*bake* saat build). |
| NFR-08 | Batas unggah | nginx `client_max_body_size 25m` untuk upload gambar/dokumen. |
| NFR-09 | Ketersediaan | Bergantung pada backend & Docker network bersama (`onboard-net`). |

## 5. Antarmuka Eksternal

### 5.1 Antarmuka API
Seluruh interaksi via REST ke backend (lihat [03-api-contract.md](03-api-contract.md)). Base URL:
`VITE_BACKEND_URL` (default `/api`). Header `Authorization: Bearer <token>` dikirim pada endpoint
dashboard; endpoint lain saat ini dipanggil tanpa header khusus (mengikuti perilaku backend).

### 5.2 Antarmuka Pengguna
Halaman: Login, Dashboard (Home + submenu). Navigasi via sidebar; konten dirender `PageContent`
berdasarkan `pageId`.

### 5.3 Ketergantungan Perangkat Lunak
React 19, React Router 7, Zustand, TailwindCSS 3, lucide-react, recharts, sweetalert2, jsPDF +
autotable, jodit-react (rich text), crypto-js/js-sha1 (dekripsi). Build: Vite 7, TypeScript 5.9.

## 6. Matriks Ketertelusuran (Ringkas)

| Kebutuhan Bisnis (BRD) | FR terkait |
|------------------------|-----------|
| BR-001, BR-002 | FR-01 … FR-05 |
| BR-003 | FR-06 |
| BR-004 | FR-07 … FR-12 |
| BR-005 | FR-13 … FR-17 |
| BR-006 | FR-18 … FR-21 |
| BR-007 | FR-22 … FR-27 |
| BR-008 | FR-28 … FR-30 |
| BR-009 | FR-31 … FR-34 |
| BR-010 | FR-14, FR-23, FR-34 |
| BR-011 | FR-17, FR-27 |
| BR-012 | FR-35, FR-36 |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dokumen dibuat berdasarkan kode sumber `admin-onboard`. |

---

*[← Kembali ke IBS Onboarding Admin](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
