'use strict';

const fs    = require('fs-extra');
const path  = require('path');
const chalk = require('chalk');
const { toSlug, toTitle, getProductDir } = require('../utils/helpers');
const { DOC_TYPES, fileNameOf } = require('../config/doc-types');
const { writeProductReadme, updateMainReadme } = require('../utils/readme');

/**
 * analyst new product "Host 2 Host" [--force]
 * Scaffold folder produk + 11 dokumen SDLC + README index.
 */
module.exports = async function newProduct(nama, opts = {}) {
  const slug  = toSlug(nama);
  const title = toTitle(nama);

  if (!slug) {
    console.log(chalk.red('❌ Nama produk tidak valid.'));
    return;
  }

  const dir = getProductDir(slug);
  const sudahAda = await fs.pathExists(dir);

  if (sudahAda && !opts.force) {
    console.log(chalk.yellow(`⚠️  Produk "${title}" sudah ada di docs/products/${slug}/`));
    console.log(chalk.gray('   Gunakan --force untuk menimpa dokumen yang belum diubah, atau'));
    console.log(chalk.gray(`   tambah dokumen tertentu: analyst add <jenis> -p "${nama}"`));
    return;
  }

  await fs.ensureDir(dir);

  let dibuat = 0;
  let dilewati = 0;
  for (const doc of DOC_TYPES) {
    const outFile = path.join(dir, fileNameOf(doc));
    if (await fs.pathExists(outFile) && !opts.force) {
      dilewati += 1;
      continue;
    }
    await fs.writeFile(outFile, doc.generate(title, slug), 'utf8');
    dibuat += 1;
  }

  await writeProductReadme(slug, title);
  await updateMainReadme();

  console.log(chalk.green(`\n✅ Produk "${title}" siap! (${dibuat} dokumen dibuat${dilewati ? `, ${dilewati} dilewati` : ''})`));
  console.log(chalk.gray(`   📁 docs/products/${slug}/`));
  for (const doc of DOC_TYPES) {
    console.log(chalk.gray(`   📄 ${fileNameOf(doc)}  ${chalk.dim('— ' + doc.short)}`));
  }
  console.log('');
  console.log(chalk.cyan('💡 Selanjutnya:'));
  console.log(chalk.white(`   • Isi tiap template di docs/products/${slug}/`));
  console.log(chalk.white(`   • Regenerate 1 dokumen: analyst add api-contract -p "${nama}" --force`));
  console.log(chalk.white('   • Lihat semua produk: analyst list'));
  console.log('');
};
