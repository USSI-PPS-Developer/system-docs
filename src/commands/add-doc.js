'use strict';

const fs    = require('fs-extra');
const path  = require('path');
const chalk = require('chalk');
const { toSlug, toTitle, getProductDir } = require('../utils/helpers');
const { DOC_TYPES, fileNameOf, resolveDocType } = require('../config/doc-types');
const { writeProductReadme, updateMainReadme } = require('../utils/readme');

/**
 * analyst add <jenis> -p "Host 2 Host" [--force]
 * Generate / regenerate satu dokumen untuk produk.
 */
module.exports = async function addDoc(jenis, opts = {}) {
  const doc = resolveDocType(jenis);
  if (!doc) {
    console.log(chalk.red(`❌ Jenis dokumen "${jenis}" tidak dikenal.`));
    console.log(chalk.gray('   Pilihan:'));
    for (const d of DOC_TYPES) {
      const alias = d.aliases.length ? ` (alias: ${d.aliases.join(', ')})` : '';
      console.log(chalk.gray(`   • ${d.key}${alias} — ${d.short}`));
    }
    return;
  }

  const nama = Array.isArray(opts.produk) ? opts.produk.join(' ') : opts.produk;
  const slug  = toSlug(nama);
  const title = toTitle(nama);
  const dir   = getProductDir(slug);

  if (!await fs.pathExists(dir)) {
    console.log(chalk.yellow(`📁 Produk "${title}" belum ada — membuat folder produk dulu...`));
    await fs.ensureDir(dir);
  }

  const outFile = path.join(dir, fileNameOf(doc));
  if (await fs.pathExists(outFile) && !opts.force) {
    console.log(chalk.yellow(`⚠️  ${fileNameOf(doc)} (${doc.short}) sudah ada untuk "${title}".`));
    console.log(chalk.gray(`   Path: docs/products/${slug}/${fileNameOf(doc)}`));
    console.log(chalk.gray('   Gunakan --force untuk menimpa.'));
    return;
  }

  await fs.writeFile(outFile, doc.generate(title, slug), 'utf8');
  await writeProductReadme(slug, title);
  await updateMainReadme();

  const aksi = opts.force ? 'di-generate ulang' : 'dibuat';
  console.log(chalk.green(`✅ ${doc.short} ${aksi} untuk "${title}"!`));
  console.log(chalk.gray(`   📄 docs/products/${slug}/${fileNameOf(doc)}`));
  console.log(chalk.gray(`   📋 docs/products/${slug}/README.md → diupdate`));
};
