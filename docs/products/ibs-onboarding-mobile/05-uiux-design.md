# 🎨 Desain UI/UX — IBS Onboarding Mobile

> Panduan rancangan antarmuka & pengalaman pengguna untuk **IBS Onboarding Mobile** (**Digit By IBS**) — aplikasi mobile nasabah.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS Onboarding Mobile |
| Jenis Dokumen     | Desain UI/UX         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 17 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Prinsip Desain
- **Mobile-first & terpandu**: alur onboarding dipecah langkah-per-langkah; kamera KTP/selfie
  memberi bingkai & instruksi jelas.
- **Minim input manual**: OCR KTP mengisi field otomatis untuk mengurangi kesalahan ketik.
- **Umpan balik eksplisit**: alert global untuk sukses/gagal/konfirmasi (`GlobalAlert`).
- **Aman terasa**: auto-logout idle, konfirmasi logout, indikator proses saat unggah.
- **Konsisten & ber-brand**: warna & nama aplikasi dari environment (white-label per BPR).

## 2. User Persona

| Persona | Kebutuhan | Pain Point |
|---------|-----------|------------|
| **Calon Nasabah** | Daftar & aktivasi tanpa ke kantor | Bingung foto KTP/selfie; takut salah isi data |
| **Nasabah Aktif** | Cek saldo/mutasi & ajukan rekening cepat | Ingin akses ringkas di ponsel, informasi jelas |

## 3. User Flow

```
[Splash] → [Login]
   │ belum punya akun → [Register] (data diri + foto KTP → OCR → selfie) → kirim → tunggu verifikasi petugas
   │                     → [Aktivasi] (minta OTP → input OTP + set username/password) → [Login]
   ▼ (login sukses)
[Beranda (app)/home]  ── saldo (carousel) · daftar rekening · banner · menu cepat
   ├─ Rekening ─────────► Saldo + Mutasi (pilih rentang tanggal)
   ├─ Buka Rekening ────► pilih produk (Tabungan/Deposito/Kredit) → wizard → unggah dokumen → kirim → cek status/detail
   ├─ Analisa Finansial ► grafik analisa per periode
   ├─ Info Kantor ──────► daftar kantor/cabang
   └─ Profil ───────────► data diri · ganti password · website/kontak · logout
[Idle ±10 mnt] atau [Logout] atau [buka ulang app] → kembali ke [Login]
```

## 4. Daftar Halaman / Screen

| No | Nama Screen | Berkas | Deskripsi |
|----|-------------|--------|-----------|
| 1 | Splash | `app/Splash.tsx` | Layar pembuka; init device info |
| 2 | Login | `app/Login.tsx`, `loginform.tsx`, `components/LoginCard.tsx` | Masuk dengan username/password |
| 3 | Register | `app/Register.tsx` | Input data diri + foto KTP (OCR) + selfie |
| 4 | Aktivasi | `app/Aktivasi.tsx` | Minta OTP + input OTP + set kredensial |
| 5 | Privacy | `app/privacy.tsx` | Kebijakan privasi |
| 6 | Beranda | `app/(app)/home/index.tsx` | Saldo carousel, daftar rekening, banner, menu |
| 7 | Rekening | `app/(app)/home/rekening.tsx` | Saldo & mutasi |
| 8 | Buka Rekening | `app/(app)/home/buka-rekening.tsx` | Wizard pengajuan tabungan/deposito/kredit |
| 9 | Analisa Finansial | `app/(app)/home/analisa-finansial.tsx` | Grafik analisa finansial |
| 10 | Info Kantor | `app/(app)/home/info-kantor.tsx` | Daftar kantor/cabang |
| 11 | Profil | `app/(app)/home/profil.tsx` | Data nasabah, ganti password, logout |

## 5. Wireframe / Mockup

> Layout aktual berbasis kode (belum ada Figma). Struktur utama beranda:

```
┌─────────────────────────────┐
│  Digit By IBS      [profil]  │  ← header
│  ┌───── Saldo Carousel ────┐ │
│  │  Rek A  Rp•••  ›         │ │  ← BalanceCarousel
│  └─────────────────────────┘ │
│  Rekening Saya               │
│  • Tabungan   ...            │  ← AccountList
│  Menu:                       │
│  [Buka] [Mutasi] [Analisa]   │  ← QuickItem grid
│  [Kantor] [Profil]           │
│  ┌───── Banner/Berita ─────┐ │
│  │  «  promo ...  »         │ │  ← NewsCarousel
│  └─────────────────────────┘ │
└─────────────────────────────┘
```
Alur kamera KTP (terpandu):
```
┌─────────────────────────────┐
│  Posisikan KTP dalam bingkai │
│  ┌───────────────────────┐   │  ← KTPCamera overlay
│  │        [ KTP ]         │   │
│  └───────────────────────┘   │
│         ( Ambil Foto )       │
└─────────────────────────────┘
```
> Lampirkan mockup Figma bila tersedia: `![Mockup Beranda](assets/mockup-home.png)`

## 6. Komponen UI

| Komponen | Berkas | Penggunaan |
|----------|--------|-----------|
| KTPCamera / SelfieCamera / GlobalCamera | `components/KTPCamera.tsx`, `SelfieCamera.tsx`, `GlobalCamera.tsx` | Pengambilan foto terpandu (expo-camera) |
| BalanceCarousel | `components/BalanceCarousel.tsx` | Kartu saldo geser di beranda |
| AccountList | `components/AccountList.tsx` | Daftar rekening nasabah |
| NewsCarousel | `components/NewsCarousel.tsx` | Banner/berita (reanimated-carousel) |
| QuickItem | `components/QuickItem.tsx` | Tombol menu cepat |
| GlobalAlert / CustomAlert | `components/GlobalAlert.tsx`, `CustomAlert.tsx` | Notifikasi & konfirmasi (via `useAlertStore` + portal) |
| ConfirmLogoutModal | `components/ConfirmLogoutModal.tsx` | Konfirmasi logout |
| SimpleDropDown | `components/SimpleDropDown.tsx` | Pilihan produk/jangka waktu |
| EmptyStateCard | `components/EmptyStateCard.tsx` | Placeholder data kosong |
| LoginCard | `components/LoginCard.tsx` | Kartu form login |
| ThemedText / ThemedView | `components/themed-text.tsx`, `themed-view.tsx` | Teks/kontainer adaptif tema |
| BottomSheet | `@gorhom/bottom-sheet` + `portal` | Panel pilihan/aksi |
| Chart | `react-native-chart-kit` | Grafik analisa finansial |

## 7. Style Guide

### Warna (dari environment — white-label)
| Token (env) | Contoh nilai | Penggunaan |
|-------------|--------------|------------|
| `PRIMARY_COLOR` | `#2563EB` | Warna utama (tombol, aksen) |
| `PRIMARY_DARK` | `#1E3A8A` | Aksen gelap/tekanan |
| `BG_COLOR` | `#F9FAFB` | Latar layar |
| `CARD_COLOR` | `#FFFFFF` | Kartu |
| `TEXT_COLOR` | `#111827` | Teks utama |
| `SUBTEXT_COLOR` | `#6B7280` | Teks sekunder |
| `SPLASH_COLOR_1/2` | `#1e3c72`/`#2a5298` | Gradien splash |
| `BG_GRADIENT_1/2` | `#0f172a`/`#1e293b` | Gradien latar |
| `GLASS_COLOR` | `rgba(255,255,255,0.15)` | Efek kaca (blur) |

> Warna di-*inject* saat build (`app.config.js` `extra` / `eas.json`), memungkinkan **tema per
> BPR** tanpa ubah kode. `constants/theme.ts` menyimpan token warna/ font sistem tambahan.

### Tipografi
| Elemen | Sumber | Catatan |
|--------|--------|---------|
| Font utama | **Inter** & **Nunito** (`@expo-google-fonts`) | Dimuat via `expo-font` |
| Heading | bobot semibold/bold | Judul layar & kartu |
| Body | ukuran sedang/kecil | Konten & label |

## 8. Pedoman Aksesibilitas
- Kamera KTP/selfie memberi **panduan visual** (bingkai + instruksi) untuk mengurangi kegagalan.
- Aksi berdampak (logout, kirim pengajuan) melalui **konfirmasi**.
- Target sentuh memadai; orientasi portrait terkunci untuk konsistensi.
- Dukungan **haptics** (`expo-haptics`) untuk umpan balik interaksi.
- **Rekomendasi lanjutan**: label aksesibilitas pada tombol ikon, dukungan ukuran font sistem,
  serta kontras teks pada latar gradien.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dokumen dibuat dari struktur layar & komponen `ibs-onboard`. |

---

*[← Kembali ke IBS Onboarding Mobile](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
