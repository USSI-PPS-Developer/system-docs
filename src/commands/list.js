'use strict';

const fs    = require('fs-extra');
const path  = require('path');
const chalk = require('chalk');
const { getProductsRoot } = require('../utils/helpers');
const { DOC_TYPES, fileNameOf } = require('../config/doc-types');

/**
 * analyst list            → daftar semua produk + kelengkapan
 * analyst list <produk>   → detail dokumen satu produk
 */
module.exports = async function list(filterSlug) {
  const root = getProductsRoot();
  if (!await fs.pathExists(root)) {
    console.log(chalk.yellow('Belum ada produk. Buat dengan: analyst new product "Nama Produk"'));
    return;
  }

  const slugs = (await fs.readdir(root)).sort();
  const total = DOC_TYPES.length;
  let adaProduk = false;

  for (const slug of slugs) {
    const dir = path.join(root, slug);
    if (!(await fs.stat(dir)).isDirectory()) continue;
    if (filterSlug && slug !== filterSlug) continue;
    adaProduk = true;

    let done = 0;
    const detail = [];
    for (const doc of DOC_TYPES) {
      const exists = await fs.pathExists(path.join(dir, fileNameOf(doc)));
      if (exists) done += 1;
      detail.push({ doc, exists });
    }

    const pct = Math.round((done / total) * 100);
    const warna = done === total ? chalk.green : done === 0 ? chalk.gray : chalk.yellow;
    console.log(warna.bold(`\n📦 ${slug}  ${chalk.reset.dim(`(${done}/${total} · ${pct}%)`)}`));

    if (filterSlug) {
      for (const { doc, exists } of detail) {
        const mark = exists ? chalk.green('✔') : chalk.gray('–');
        const name = exists ? doc.short : chalk.gray(doc.short);
        console.log(`   ${mark} ${name.padEnd(exists ? 20 : 30)} ${chalk.dim(fileNameOf(doc))}`);
      }
    }
  }

  if (!adaProduk) {
    if (filterSlug) console.log(chalk.yellow(`Produk "${filterSlug}" tidak ditemukan.`));
    else console.log(chalk.yellow('Belum ada produk. Buat dengan: analyst new product "Nama Produk"'));
  }
  console.log('');
};
