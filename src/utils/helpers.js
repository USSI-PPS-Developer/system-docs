'use strict';

const path = require('path');

/**
 * "Host 2 Host" → "host-2-host"
 */
function toSlug(nama) {
  return String(nama)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * "host 2 host" / "host-2-host" → "Host 2 Host"
 */
function toTitle(nama) {
  return String(nama)
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Tanggal Indonesia: "23 Juni 2026"
 */
function tanggalID() {
  return new Date().toLocaleDateString('id-ID', { dateStyle: 'long' });
}

function getProjectRoot()  { return process.cwd(); }
function getDocsRoot()     { return path.join(getProjectRoot(), 'docs'); }
function getProductsRoot() { return path.join(getDocsRoot(), 'products'); }

/**
 * getProductDir('h2h') → docs/products/h2h/
 */
function getProductDir(productSlug) {
  return path.join(getProductsRoot(), productSlug);
}

module.exports = {
  toSlug,
  toTitle,
  tanggalID,
  getProjectRoot,
  getDocsRoot,
  getProductsRoot,
  getProductDir,
};
