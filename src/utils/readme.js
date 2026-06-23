'use strict';

const fs   = require('fs-extra');
const path = require('path');
const { DOC_TYPES, fileNameOf } = require('../config/doc-types');
const {
  tanggalID,
  getDocsRoot,
  getProductsRoot,
  getProductDir,
} = require('./helpers');

/**
 * Generate ulang README index produk berdasarkan dokumen yang BENAR-BENAR ada.
 * Dipanggil tiap kali produk dibuat / dokumen ditambah.
 */
async function writeProductReadme(productSlug, productTitle) {
  const dir = getProductDir(productSlug);
  await fs.ensureDir(dir);

  let done = 0;
  const rows = [];
  for (const doc of DOC_TYPES) {
    const file = fileNameOf(doc);
    const exists = await fs.pathExists(path.join(dir, file));
    if (exists) done += 1;
    const status = exists ? '🟡 Draft' : '⬜ Belum dibuat';
    const cell = exists ? `[${doc.label}](${file})` : doc.label;
    rows.push(`| ${String(doc.order).padStart(2, '0')} | ${cell} | ${status} |`);
  }

  const total = DOC_TYPES.length;
  const pct = Math.round((done / total) * 100);

  const content = `# 📦 ${productTitle}

> Dokumentasi lengkap produk **${productTitle}**.

| Field           | Detail            |
|-----------------|-------------------|
| Produk          | ${productTitle}   |
| Slug            | \`${productSlug}\` |
| Kelengkapan Dok | ${done}/${total} (${pct}%) |
| Terakhir update | ${tanggalID()}    |

---

## 📚 Daftar Dokumen

| No | Dokumen | Status |
|----|---------|--------|
${rows.join('\n')}

> Dokumen tanpa tautan belum dibuat. Generate dengan:
> \`analyst add <jenis> -p "${productTitle}"\`

---

*[← Kembali ke Daftar Produk](../../README.md)*

*Dikelola oleh **Analyst CLI**.*
`;

  await fs.writeFile(path.join(dir, 'README.md'), content, 'utf8');
}

/**
 * Generate ulang README utama (docs/README.md) dengan men-scan folder products/.
 */
async function updateMainReadme() {
  const docsRoot     = getDocsRoot();
  const productsRoot = getProductsRoot();
  await fs.ensureDir(productsRoot);

  const entries = await fs.readdir(productsRoot);
  const products = [];
  for (const slug of entries.sort()) {
    const dir = path.join(productsRoot, slug);
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) continue;

    let title = slug;
    let done = 0;
    for (const doc of DOC_TYPES) {
      if (await fs.pathExists(path.join(dir, fileNameOf(doc)))) done += 1;
    }
    // ambil judul dari README produk bila ada
    const readme = path.join(dir, 'README.md');
    if (await fs.pathExists(readme)) {
      const head = (await fs.readFile(readme, 'utf8')).split('\n')[0];
      const m = head.match(/^#\s+📦\s+(.+)$/);
      if (m) title = m[1].trim();
    }
    products.push({ slug, title, done });
  }

  const total = DOC_TYPES.length;
  const rows = products.length
    ? products
        .map(
          (p) =>
            `| [${p.title}](products/${p.slug}/README.md) | ${p.done}/${total} | ${
              p.done === total ? '✅ Lengkap' : '🟡 Berjalan'
            } |`
        )
        .join('\n')
    : '| _Belum ada produk_ | - | - |';

  const content = `# 📋 Dokumentasi Sistem Analis

> Pusat dokumentasi seluruh produk. Di-generate & dikelola dengan **Analyst CLI**.

---

## 🗂️ Daftar Produk

| Produk | Kelengkapan | Status |
|--------|-------------|--------|
${rows}

---

### ➕ Tambah produk baru
\`\`\`bash
analyst new product "Nama Produk"
\`\`\`

*Terakhir diperbarui: ${tanggalID()}*
`;

  await fs.ensureDir(docsRoot);
  await fs.writeFile(path.join(docsRoot, 'README.md'), content, 'utf8');
}

module.exports = { writeProductReadme, updateMainReadme };
