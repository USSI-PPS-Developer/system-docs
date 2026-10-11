# 📦 SimpelkeuJabar

> Dokumentasi produk **SimpelkeuJabar (Sistem Pelaporan Keuangan Jawa Barat)** — aplikasi web milik Pemerintah Provinsi Jawa Barat untuk **mengumpulkan, mengkonsolidasi, menganalisis, dan melaporkan data keuangan** BUMD sektor keuangan (BPR, LKM, Jamkrida, dan Bank Umum) yang sahamnya dimiliki Pemprov Jabar, dilengkapi **portal publik (CMS landing page)**.

| Field           | Detail            |
|-----------------|-------------------|
| Produk          | SimpelkeuJabar |
| Slug            | `simpelkeu-jabar` |
| Nama Aplikasi   | **SIMPELKEU Jabar** — Sistem Pelaporan Keuangan Jawa Barat |
| URL Produksi    | `https://simpelkeu.jabarprov.go.id` |
| Repo            | `SimpelkeuJabar` (`git@github.com:USSI-PPS-Developer/SimpelkeuJabar.git`) |
| Platform        | Web (Laravel 8 + Blade, panel admin Metronic, landing publik tema Porto) |
| Pemilik Bisnis  | Pemerintah Provinsi Jawa Barat — unit pembina BUMD *(nama unit kerja: konfirmasi)* |
| Pengguna        | Admin Provinsi, operator lembaga (BPR / LKM / Jamkrida / Bank), tamu (*guest*), dan **publik** (landing page) |
| Kelengkapan Dok | 4/11 (36%) |
| Terakhir update | 11 Oktober 2026 |

---

## 📚 Daftar Dokumen

| No | Dokumen | Status |
|----|---------|--------|
| 01 | [📄 BRD — Business Requirement Document](01-brd.md) | 🟡 Draft |
| 02 | [📐 SRS — Software Requirements Specification](02-srs.md) | 🟡 Draft |
| 03 | 🔌 API Contract | ⬜ Belum dibuat |
| 04 | [🗄️ Desain Database](04-database-design.md) | 🟡 Draft |
| 05 | 🎨 Desain UI/UX | ⬜ Belum dibuat |
| 06 | 🧪 Test Plan | ⬜ Belum dibuat |
| 07 | ✅ Test Case | ⬜ Belum dibuat |
| 08 | 🔗 SIT Documentation | ⬜ Belum dibuat |
| 09 | 🧾 UAT | ⬜ Belum dibuat |
| 10 | [🚀 Deployment Guide](10-deployment-guide.md) | 🟡 Draft |
| 11 | 📖 User Manual | ⬜ Belum dibuat |

> **Catatan untuk technical writer.**
> - **Dokumen ini adalah dokumen *scope*** — fokus pada *apa* yang dicakup aplikasi
>   (BRD) dan *bagaimana perilakunya* (SRS). Detail teknis per endpoint, skema tabel, dan
>   langkah deploy sengaja dipisah ke dokumen 03/04/10.
> - **03 — API Contract** di produk ini **bukan API publik**. Seluruh endpoint adalah
>   endpoint AJAX internal (form POST + CSRF + sesi) yang dipanggil oleh halaman Blade itu
>   sendiri; tidak ada konsumen pihak ketiga. Jika dibuat, cukup berupa *katalog endpoint*.
> - **04 — Desain Database** relevan: skema domain (`t_*`, `m_*`, `cms_*`) **tidak dikelola
>   migration Laravel** (hanya tabel bawaan + index performa), sehingga dokumen DB menjadi
>   satu-satunya rujukan skema.
> - **11 — User Manual** paling bernilai untuk dua persona: **operator lembaga** (import &
>   cetak laporan) dan **admin provinsi** (rekap, kelola website, kelola user).
> - Istilah keuangan mengikuti Pedoman Akuntansi BPR / OJK — lihat glosarium di [SRS §1.3](02-srs.md#13-definisi--akronim).
>
> Dokumen tanpa tautan belum dibuat. Generate dengan:
> `analyst add <jenis> -p "SimpelkeuJabar"`

---

## 🧭 Ringkasan Scope (1 menit)

| Area | Isi |
|------|-----|
| **Portal publik** | Beranda (banner, running text, daftar bank, layanan & produk BUMD), Sejarah BUMD (timeline), Berita, Detail per Bank (profil, pengurus, penyertaan modal), sitemap. |
| **Pengumpulan data** | Import Excel **Realisasi** bulanan & **Rencana/Target (RBB)** tahunan (6 sheet: Neraca, Administratif, Laba Rugi, TKS, Arus Kas, Kredit) + **Laporan Publikasi OJK** (KAP & Rasio). Validasi neraca balance. |
| **Dokumen tata kelola** | Upload PDF: Kajian Dewan Komisaris, Hasil Audit KAP, GCG, RUPS, Laporan Jamkrida; pemantauan status kirim per lembaga. |
| **Pelaporan** | ±27 laporan (per lembaga, realisasi vs target, gabungan provinsi, rekap per lembaga, RBB) → **PDF** & **Excel**. |
| **Dashboard** | Dashboard utama (tren laba, NPL, top-10 laba, komposisi saham, modal Pemprov) & Dashboard Rekap (admin). |
| **Master & profil** | Profil Bank (data keuangan ringkas, logo), Pengurus (direksi/komisaris + alert masa jabatan), Kepemilikan Saham. |
| **Administrasi** | Login, ganti password, reset password pengguna, profil pengguna, CMS "Kelola Website". |

---

## 🔗 Sumber Kebenaran (Source of Truth)

Dokumen di sini disusun dari kode sumber repositori:

```
/Users/azharzakiyramadhan/Documents/Development/docker/appsimpelkeujabar
```

Repositori tersebut memuat dokumentasi teknis yang lebih rinci dan **harus dijaga tetap
selaras** dengan dokumen SDLC di folder ini:

| Berkas di repo | Isi | Dokumen SDLC terkait |
|----------------|-----|----------------------|
| `CLAUDE.md` | Arsitektur, konvensi, subsistem, gotcha | [SRS](02-srs.md) |
| `README.md` | Ringkasan produk & instalasi | [BRD](01-brd.md), [Deployment Guide](10-deployment-guide.md) |
| `CHANGELOG.md` | Riwayat perubahan format **Before / After / Alasan** (dasar laporan ke Pemprov) | [BRD](01-brd.md) |
| `AUDIT.md` | Audit keamanan/kualitas 2026-07-19 + status remediasi | [SRS §4](02-srs.md#4-kebutuhan-non-fungsional) |
| `DEPLOY_CPANEL.md`, `DEPLOY_CHECKLIST.md` | Prosedur rilis ke hosting cPanel | [Deployment Guide](10-deployment-guide.md) |
| `database/sql/*.sql` | Patch skema `cms_*`, `profile_bank_pengurus`, index performa | [Desain Database](04-database-design.md) |
| `routes/web.php` | Daftar route publik vs terproteksi | [SRS §5.1](02-srs.md#51-antarmuka-endpoint-internal) |

> ⚠️ **Bila kode berubah, perbarui kedua sisi.** Penambahan laporan, menu, sheet import,
> peran pengguna, atau halaman publik **wajib** tercermin di dokumen ini dan di `CHANGELOG.md`.

---

*[← Kembali ke Daftar Produk](../../README.md)*

*Dikelola oleh **Analyst CLI**.*
