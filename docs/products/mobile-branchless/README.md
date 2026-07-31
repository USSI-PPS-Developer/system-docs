# 📦 Mobile Branchless

> Dokumentasi lengkap produk **Mobile Branchless** — aplikasi mobile **petugas lapangan** (front-end) untuk layanan keuangan *branchless* BPR & koperasi: buka/tutup kas harian, setoran & penarikan tabungan, angsuran kredit, cetak struk thermal, dan sinkronisasi offline-first.

| Field           | Detail            |
|-----------------|-------------------|
| Produk          | Mobile Branchless |
| Slug            | `mobile-branchless` |
| Nama Aplikasi   | **IBS BranchlessPro** |
| Repo            | `Mobile-Branchless` (React Native + Expo + React Navigation) |
| Platform        | Android (utama) & iOS — Expo SDK 54 |
| Package / Bundle | `com.lt4.mobilebranchless` |
| Pengguna        | **Petugas lapangan / kolektor** (bukan nasabah) |
| Produk terkait  | [IBS Onboarding Mobile](../ibs-onboarding-mobile/README.md) — aplikasi sisi nasabah |
| Kelengkapan Dok | 3/11 (27%) |
| Terakhir update | 31 Juli 2026    |

---

## 📚 Daftar Dokumen

| No | Dokumen | Status |
|----|---------|--------|
| 01 | [📄 BRD — Business Requirement Document](01-brd.md) | 🟡 Draft |
| 02 | [📐 SRS — Software Requirements Specification](02-srs.md) | 🟡 Draft |
| 03 | 🔌 API Contract | ⬜ Belum dibuat |
| 04 | 🗄️ Desain Database | ⬜ Belum dibuat |
| 05 | 🎨 Desain UI/UX | ⬜ Belum dibuat |
| 06 | 🧪 Test Plan | ⬜ Belum dibuat |
| 07 | ✅ Test Case | ⬜ Belum dibuat |
| 08 | 🔗 SIT Documentation | ⬜ Belum dibuat |
| 09 | 🧾 UAT | ⬜ Belum dibuat |
| 10 | [🚀 Deployment Guide](10-deployment-guide.md) | 🟡 Draft |
| 11 | 📖 User Manual | ⬜ Belum dibuat |

> **Catatan pemilihan dokumen.** Produk ini adalah **mobile client petugas** dengan
> karakteristik yang membedakannya dari klien mobile lain di portofolio:
> - **04 — Desain Database** **relevan dan perlu dibuat** (berbeda dari `IBS Onboarding
>   Mobile` yang N/A). Aplikasi ini **punya basis data lokal**: `branchless2025.db`
>   (`Transaksi`, `LogAktivitas`, `SaldoKas` + tabel `*Backup`) ditulis aplikasi, ditambah
>   `dbbranchless_YYMMDD.db` (`master_nasabah`) yang diunduh per tanggal dan bersifat
>   read-only. Skema ringkasnya sudah tercantum di [SRS §5.5](02-srs.md).
> - **10 — Deployment Guide** berbentuk **build & distribusi EAS**, bukan deploy server —
>   plus **prosedur penyiapan perangkat petugas** (kode lembaga, unduh DB, pasangkan printer)
>   yang wajib dilakukan sebelum perangkat dipakai di lapangan.
> - **Konfigurasi bersifat runtime, bukan build-time.** Tidak ada `.env` maupun blok `env`
>   di `eas.json`; endpoint lembaga ditentukan dari **kode lembaga** yang dimasukkan petugas.
>   Satu APK melayani banyak lembaga, dan menambah lembaga **tidak memerlukan rebuild**.
>
> Dokumen tanpa tautan belum dibuat. Generate dengan:
> `analyst add <jenis> -p "Mobile Branchless"`

---

## 🔗 Sumber Kebenaran (Source of Truth)

Dokumen di sini disusun dari kode sumber repositori:

```
/Users/azharzakiyramadhan/Documents/Development/Mobile-Branchless
```

Repositori tersebut memuat dokumentasi teknis yang lebih rinci dan **harus dijaga tetap
selaras** dengan dokumen SDLC di folder ini:

| Berkas di repo | Isi | Dokumen SDLC terkait |
|----------------|-----|----------------------|
| `CLAUDE.md` | Arsitektur, kontrak API, skema enkripsi, konvensi | [SRS](02-srs.md) |
| `FRONTEND.md` | Struktur UI, navigasi, katalog komponen | Desain UI/UX (belum dibuat) |
| `CHANGELOG.md` | Riwayat rilis & utang teknis | [BRD](01-brd.md), [Deployment Guide](10-deployment-guide.md) |
| `README.md` | Ringkasan produk & cara menjalankan | [Deployment Guide](10-deployment-guide.md) |

> ⚠️ **Bila kode berubah, perbarui kedua sisi.** Perubahan endpoint, skema tabel, kunci
> enkripsi, alur kas, atau profil build **wajib** tercermin di dokumen ini — lihat tabel
> pemetaan di `CLAUDE.md` bagian *Dokumentasi Eksternal*.

---

*[← Kembali ke Daftar Produk](../../README.md)*

*Dikelola oleh **Analyst CLI**.*
