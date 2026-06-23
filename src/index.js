#!/usr/bin/env node

'use strict';

const { program } = require('commander');
const chalk = require('chalk');
const newProduct = require('./commands/new-product');
const addDoc     = require('./commands/add-doc');
const list       = require('./commands/list');
const removeProduct = require('./commands/remove');
const { DOC_TYPES } = require('./config/doc-types');
const { toSlug } = require('./utils/helpers');

console.log(chalk.cyan.bold('\n🔷 Analyst CLI — Dokumentasi SDLC per Produk\n'));

program
  .name('analyst')
  .description('Generate dokumentasi SDLC (BRD, SRS, API, dll) per produk dalam Markdown')
  .version('2.0.0');

// ── analyst new product "Host 2 Host" ───────────────────────────
const cmdNew = program.command('new').description('Buat resource baru');

cmdNew
  .command('product <nama...>')
  .description('Buat produk baru + scaffold 11 dokumen SDLC')
  .option('-f, --force', 'Timpa dokumen yang sudah ada')
  .action((parts, opts) => newProduct(parts.join(' '), opts));

// ── analyst add <jenis> -p "Host 2 Host" ────────────────────────
const daftarJenis = DOC_TYPES.map((d) => d.key).join(', ');
program
  .command('add <jenis>')
  .description(`Generate/regenerate satu dokumen. Jenis: ${daftarJenis}`)
  .requiredOption('-p, --produk <nama...>', 'Nama produk')
  .option('-f, --force', 'Timpa dokumen yang sudah ada')
  .action((jenis, opts) => addDoc(jenis, opts));

// ── analyst list [produk] ───────────────────────────────────────
program
  .command('list [produk...]')
  .description('Lihat semua produk & kelengkapan dokumen')
  .action((parts) => list(parts && parts.length ? toSlug(parts.join(' ')) : undefined));

// ── analyst remove product "Host 2 Host" ────────────────────────
const cmdRemove = program.command('remove').alias('rm').description('Hapus resource');
cmdRemove
  .command('product <nama...>')
  .description('Hapus seluruh dokumentasi produk')
  .action((parts) => removeProduct(parts.join(' ')));

// ── analyst docs : daftar jenis dokumen yang tersedia ───────────
program
  .command('docs')
  .description('Tampilkan daftar jenis dokumen yang didukung')
  .action(() => {
    console.log(chalk.bold('📚 Jenis dokumen yang didukung:\n'));
    for (const d of DOC_TYPES) {
      const alias = d.aliases.length ? chalk.dim(` (alias: ${d.aliases.join(', ')})`) : '';
      console.log(`   ${chalk.cyan(String(d.order).padStart(2, '0'))}  ${chalk.white(d.key)}${alias}`);
      console.log(`       ${chalk.gray(d.short)}`);
    }
    console.log('');
  });

program.parse(process.argv);
