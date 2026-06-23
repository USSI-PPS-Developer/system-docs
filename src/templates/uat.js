'use strict';

const { header, footer } = require('./_shared');

module.exports = function uat(productTitle) {
  return `${header({
    docTitle: 'User Acceptance Testing (UAT)',
    emoji: '🧾',
    productTitle,
    intro: `Dokumentasi uji penerimaan pengguna untuk produk **${productTitle}**.`,
  })}

## 1. Tujuan
_Memastikan **${productTitle}** memenuhi kebutuhan bisnis dan diterima oleh pengguna._

## 2. Peserta UAT

| Nama | Unit / Jabatan | Peran dalam UAT |
|------|----------------|-----------------|
| | | Penguji / Approver |

## 3. Lingkungan & Periode

| Item | Detail |
|------|--------|
| Environment | UAT |
| URL | |
| Periode | |

## 4. Skenario UAT (Berbasis Proses Bisnis)

| ID | Skenario Bisnis | Pre-condition | Hasil Diharapkan |
|----|-----------------|---------------|------------------|
| UAT-001 | _mis. Operator melakukan transfer H2H_ | | _Transaksi berhasil & tercatat_ |

---

## 5. Hasil Eksekusi

| ID | Skenario | Tgl | Hasil Aktual | Status | Penguji |
|----|----------|-----|--------------|--------|---------|
| UAT-001 | | | | ⬜ Diterima / ❌ Ditolak | |

## 6. Defect / Temuan

| ID | Temuan | Severity | Status |
|----|--------|----------|--------|
| | | | |

## 7. Kesimpulan & Rekomendasi
_Apakah produk layak go-live?_

## 8. Berita Acara Persetujuan (Sign-Off)

> Dengan ini menyatakan bahwa produk **${productTitle}** telah diuji dan **DITERIMA / DITOLAK** untuk dilanjutkan ke tahap implementasi.

| Peran | Nama | Tanda Tangan | Tanggal |
|-------|------|--------------|---------|
| Business Owner | | | |
| Project Manager | | | |
| QA Lead | | | |
${footer(productTitle)}`;
};
