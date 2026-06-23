'use strict';

const { header, footer } = require('./_shared');

module.exports = function sit(productTitle) {
  return `${header({
    docTitle: 'SIT Documentation (System Integration Testing)',
    emoji: '🔗',
    productTitle,
    intro: `Dokumentasi pengujian integrasi sistem untuk produk **${productTitle}**.`,
  })}

## 1. Tujuan & Ruang Lingkup
_Memastikan **${productTitle}** terintegrasi dengan sistem lain secara benar (end-to-end)._

## 2. Sistem yang Terintegrasi

| No | Sistem A | ↔ | Sistem B | Jenis Integrasi |
|----|----------|---|----------|-----------------|
| 1  | ${productTitle} | ↔ | Core Banking (IBS) | API / Host to Host |

## 3. Lingkungan SIT

| Komponen | Detail |
|----------|--------|
| Environment | SIT |
| Endpoint | |
| Versi build | |
| Periode | |

## 4. Skenario Integrasi

| ID | Skenario | Sistem Terlibat | Pre-condition | Hasil Diharapkan |
|----|----------|-----------------|---------------|------------------|
| SIT-001 | _mis. Inquiry saldo dari kanal ke core_ | ${productTitle}, IBS | | _Saldo tampil benar_ |

---

## 5. Hasil Eksekusi

| ID | Skenario | Tgl Uji | Hasil Aktual | Status | Defect |
|----|----------|---------|--------------|--------|--------|
| SIT-001 | | | | ⬜ Pass / ❌ Fail | - |

## 6. Defect Log

| ID Defect | Deskripsi | Severity | Status | Resolusi |
|-----------|-----------|----------|--------|----------|
| DEF-001 | | Critical/High/Medium/Low | Open/Fixed/Closed | |

## 7. Kesimpulan
_Ringkasan hasil SIT & kesiapan lanjut ke UAT._
${footer(productTitle)}`;
};
