'use strict';

const { header, footer } = require('./_shared');

module.exports = function uiuxDesign(productTitle) {
  return `${header({
    docTitle: 'Desain UI/UX',
    emoji: '🎨',
    productTitle,
    intro: `Panduan rancangan antarmuka & pengalaman pengguna untuk produk **${productTitle}**.`,
  })}

## 1. Prinsip Desain
- _mis. Konsisten, sederhana, accessible, mobile-first_

## 2. User Persona

| Persona | Kebutuhan | Pain Point |
|---------|-----------|------------|
| _Nama persona_ | | |

## 3. User Flow

\`\`\`
[Login] → [Dashboard] → [Pilih Menu] → [Aksi] → [Konfirmasi] → [Selesai]
\`\`\`

## 4. Daftar Halaman / Screen

| No | Nama Screen | Deskripsi | Link Mockup |
|----|-------------|-----------|-------------|
| 1  | _Login_ | _Halaman masuk_ | _Figma/URL_ |

## 5. Wireframe / Mockup

> Lampirkan tautan Figma atau gambar:
> \`![Mockup Dashboard](assets/mockup-dashboard.png)\`

## 6. Komponen UI

| Komponen | Penggunaan | Catatan |
|----------|-----------|---------|
| Button Primary | Aksi utama | |
| Input Field | Form | |
| Tabel Data | Daftar transaksi | |

## 7. Style Guide

### Warna
| Token | Hex | Penggunaan |
|-------|-----|------------|
| Primary | \`#0B5FFF\` | Tombol utama |
| Success | \`#1FA05D\` | Status sukses |
| Danger  | \`#E5484D\` | Error / gagal |

### Tipografi
| Elemen | Font | Ukuran | Weight |
|--------|------|--------|--------|
| Heading 1 | Inter | 24px | 700 |
| Body | Inter | 14px | 400 |

## 8. Pedoman Aksesibilitas
- _Kontras warna minimal WCAG AA, label form, navigasi keyboard, dll._
${footer(productTitle)}`;
};
