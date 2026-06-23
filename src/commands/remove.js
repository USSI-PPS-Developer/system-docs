'use strict';

const fs    = require('fs-extra');
const chalk = require('chalk');
const { toSlug, toTitle, getProductDir } = require('../utils/helpers');
const { updateMainReadme } = require('../utils/readme');

/**
 * analyst remove product "Host 2 Host"
 * Hapus seluruh folder dokumentasi produk.
 */
module.exports = async function removeProduct(nama) {
  const slug  = toSlug(nama);
  const title = toTitle(nama);
  const dir   = getProductDir(slug);

  if (!await fs.pathExists(dir)) {
    console.log(chalk.yellow(`⚠️  Produk "${title}" tidak ditemukan di docs/products/${slug}/`));
    return;
  }

  await fs.remove(dir);
  await updateMainReadme();

  console.log(chalk.green(`🗑️  Produk "${title}" dihapus (docs/products/${slug}/).`));
  console.log(chalk.gray('   📋 docs/README.md → diupdate'));
};
