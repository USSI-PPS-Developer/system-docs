'use strict';

const { tanggalID } = require('../utils/helpers');

/**
 * Header standar tiap dokumen: judul + blockquote + tabel metadata kendali dokumen.
 *
 * @param {object} o
 * @param {string} o.docTitle   - mis. "Business Requirement Document (BRD)"
 * @param {string} o.emoji      - emoji dokumen
 * @param {string} o.productTitle
 * @param {string} o.intro      - kalimat pengantar 1 baris
 */
function header({ docTitle, emoji, productTitle, intro }) {
  const now = tanggalID();
  return `# ${emoji} ${docTitle} — ${productTitle}

> ${intro}

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | ${productTitle}     |
| Jenis Dokumen     | ${docTitle}         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | ${now}              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---
`;
}

/**
 * Footer navigasi balik ke README produk.
 */
function footer(productTitle) {
  return `
---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | ${tanggalID()} | | Dokumen dibuat |

---

*[← Kembali ke ${productTitle}](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
`;
}

module.exports = { header, footer };
