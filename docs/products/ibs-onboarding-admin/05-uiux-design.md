# 🎨 Desain UI/UX — IBS Onboarding Admin

> Panduan rancangan antarmuka & pengalaman pengguna untuk **IBS Onboarding Admin** (dashboard back-office).

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS Onboarding Admin |
| Jenis Dokumen     | Desain UI/UX         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 17 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Prinsip Desain
- **Task-oriented**: setiap halaman fokus pada satu domain onboarding (registrasi, aktivasi, dll.).
- **Konsisten**: pola tabel → detail → aksi (approve/reject) seragam di semua modul.
- **Umpan balik eksplisit**: konfirmasi sebelum aksi berdampak; notifikasi sukses/gagal jelas.
- **Responsif**: berfungsi di desktop (sidebar tetap) & mobile (sidebar slide-in).
- **Adaptif tema**: mendukung light & dark, mengikuti preferensi sistem/pengguna.

## 2. User Persona

| Persona | Kebutuhan | Pain Point |
|---------|-----------|------------|
| **Admin/CS BPR** | Memproses antrean registrasi/aktivasi/pengajuan cepat & akurat | Data tersebar; sulit lihat foto/dokumen; takut salah approve |
| **Supervisor Operasional** | Memantau volume & antrean belum diproses | Tidak ada ringkasan sekilas |

## 3. User Flow

```
[Login] → [Dashboard (rekap)] → pilih menu sidebar
   ├─ Manajemen Akun ────────► [Tabel User] → [Detail] → status / reset pw / unblock / hapus
   ├─ Manajemen Registrasi ──► [Tabel] → [Detail + foto] → Approve (→OTP) / Reject (alasan) / PDF
   ├─ Manajemen Aktivasi ────► [Antrean OTP] → Preview → Generate OTP / Hapus
   ├─ Pengajuan Rekening ────► [Tab/Dep/Kredit] → [Detail + dokumen] → pilih produk & kantor → Approve / Reject
   ├─ Blacklist ─────────────► [Tabel] → Tambah / Ubah / Hapus
   └─ Banner ────────────────► [Tabel] → Form (upload gambar) → Simpan / Hapus
[Idle timeout] atau [Logout] → kembali ke [Login]
```

## 4. Daftar Halaman / Screen

| No | Nama Screen | Komponen | Deskripsi |
|----|-------------|----------|-----------|
| 1 | Login | `Login.tsx` | Form masuk admin + CAPTCHA input; floating label |
| 2 | Dashboard Home | `pages/DashboardHome.tsx` | 6 kartu rekap (StatCard) + ringkasan |
| 3 | Manajemen Akun | `pages/Account.tsx` | Tabel user + modal detail & aksi |
| 4 | Manajemen Registrasi | `pages/RegisterAccount.tsx` | Tabel + detail foto + approve/reject + PDF |
| 5 | Manajemen Aktivasi | `pages/AktivasiAccount.tsx` | Antrean OTP + generate |
| 6 | Rekening Tabungan | `RekeningTabungan.tsx` / `…Detail.tsx` | Daftar + detail + approve/reject |
| 7 | Rekening Deposito | `RekeningDeposito.tsx` / `…Detail.tsx` | idem |
| 8 | Rekening Kredit | `RekeningKredit.tsx` / `…Detail.tsx` | idem |
| 9 | Blacklist | `pages/Blacklist.tsx` | CRUD blacklist |
| 10 | Banner/Promo | `pages/Banner.tsx` / `BannerForm.tsx` | CRUD + upload gambar + rich text (jodit) |

## 5. Wireframe / Mockup

> Layout aktual berbasis kode (belum ada Figma). Struktur utama:

```
┌───────────────────────────────────────────────────────────┐
│ [≡]  IBS Admin Onboarding                        [☀/🌙] [⎋] │  ← top bar (mobile) / header
├───────────┬───────────────────────────────────────────────┤
│ Sidebar   │  Breadcrumbs                                    │
│ • Dashboard│  ┌──────── Konten Halaman (PageContent) ─────┐ │
│ • Akun     │  │  Kartu rekap / DataTable / Detail / Form   │ │
│ • Registrasi│ │                                            │ │
│ • Aktivasi │  └────────────────────────────────────────────┘ │
│ • Pengajuan▸  (Tabungan / Deposito / Kredit)                  │
│ • Blacklist│                                                  │
│ • Banner   │                                                  │
└───────────┴───────────────────────────────────────────────┘
```
> Lampirkan mockup Figma bila tersedia: `![Mockup Dashboard](assets/mockup-dashboard.png)`

## 6. Komponen UI

| Komponen | Berkas | Penggunaan |
|----------|--------|-----------|
| Sidebar / MobileSidebar | `components/Sidebar.tsx`, `MobileSidebar.tsx` | Navigasi utama + submenu Pengajuan |
| Breadcrumbs | `components/Breadcrumbs.tsx` | Konteks lokasi halaman |
| StatCard | `components/StatCard.tsx` | Kartu rekap dashboard |
| DataTable | `components/ui/DataTable.tsx` | Tabel + pencarian + render kolom kustom |
| Modal | `components/ui/Modal.tsx` | Detail & form |
| FloatingInput | `components/FloatingInput.tsx` | Input form dengan floating label |
| CaptchaInput | `components/CaptchaInput.tsx` | Verifikasi manusia di Login |
| IdleTimer / IdleLogout | `components/IdleTimer.tsx`, `IdleLogout.tsx` | Auto-logout saat idle |
| AppLogo | `components/AppLogo.tsx` | Branding |
| Notifikasi | SweetAlert2 | Konfirmasi/sukses/error |
| Rich text editor | jodit-react | Isi banner/promo |
| Ekspor PDF | jsPDF + autotable | Ekspor detail registrasi/pengajuan |
| Chart | recharts | Visualisasi rekap (bila dipakai) |

## 7. Style Guide

### Warna (status & tema)
| Token | Kelas/Hex | Penggunaan |
|-------|-----------|------------|
| Background app | `#f4f5f6` / `slate-900` (dark) | Kanvas |
| Status ACTIVE / APPROVED | hijau (`green-600/100`) | Sukses/aktif |
| Status LOCKED / REJECTED | merah (`red-600/100`) | Terkunci/ditolak |
| Status PENDING | kuning (`yellow-700/100`) | Menunggu |
| Teks | `slate-800` / `slate-200` (dark) | Konten |

> Palet mengikuti utilitas **TailwindCSS**; mode gelap via kelas `dark`.

### Tipografi
| Elemen | Sumber | Catatan |
|--------|--------|---------|
| Font | Default Tailwind (system UI stack) | — |
| Heading | `font-semibold`/`font-bold` | Judul halaman & kartu |
| Body | ukuran `text-sm`/`text-xs` | Tabel & label |

## 8. Pedoman Aksesibilitas
- Kontras status memakai pasangan warna + teks (bukan warna saja).
- Semua aksi destruktif (hapus, reject) melalui **dialog konfirmasi**.
- Target sentuh memadai di mobile; sidebar dapat ditutup.
- Tema gelap untuk kenyamanan mata pada penggunaan lama.
- **Rekomendasi lanjutan**: label `aria-*` pada tombol ikon & fokus keyboard pada modal.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dokumen dibuat dari struktur komponen `admin-onboard`. |

---

*[← Kembali ke IBS Onboarding Admin](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
