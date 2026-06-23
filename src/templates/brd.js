'use strict';

const { header, footer } = require('./_shared');

module.exports = function brd(productTitle) {
  return `${header({
    docTitle: 'Business Requirement Document (BRD)',
    emoji: '📄',
    productTitle,
    intro: `Dokumen kebutuhan bisnis untuk produk **${productTitle}**.`,
  })}

## 1. Latar Belakang

_Jelaskan kondisi/permasalahan bisnis yang melatarbelakangi kebutuhan produk **${productTitle}**._

## 2. Tujuan & Sasaran Bisnis

| No | Tujuan Bisnis | Indikator Keberhasilan (KPI) |
|----|---------------|------------------------------|
| 1  | _Tujuan 1_    | _mis. transaksi naik 20%_    |

## 3. Ruang Lingkup

### ✅ In Scope
- _Hal yang termasuk dalam proyek_

### ❌ Out of Scope
- _Hal yang TIDAK termasuk_

## 4. Stakeholder

| Peran | Nama / Unit | Tanggung Jawab |
|-------|-------------|----------------|
| Sponsor | | |
| Business Owner | | |
| Product Owner | | |
| End User | | |

## 5. Kebutuhan Bisnis

| ID | Kebutuhan Bisnis | Prioritas | Catatan |
|----|------------------|-----------|---------|
| BR-001 | _Deskripsi kebutuhan_ | Wajib / Tinggi / Sedang / Rendah | |

## 6. Proses Bisnis

### 6.1 Kondisi Saat Ini (As-Is)
_Gambarkan alur proses berjalan saat ini._

### 6.2 Kondisi Diharapkan (To-Be)
_Gambarkan alur proses setelah produk diterapkan._

\`\`\`
[Aktor] → [Aktivitas 1] → [Aktivitas 2] → [Selesai]
\`\`\`

## 7. Asumsi & Batasan

- **Asumsi:** _..._
- **Batasan:** _mis. harus terintegrasi dengan core banking IBS_

## 8. Risiko Bisnis

| ID | Risiko | Dampak | Mitigasi |
|----|--------|--------|----------|
| RB-001 | | | |

## 9. Kriteria Penerimaan (Acceptance Criteria)

- _Produk dianggap berhasil bila..._
${footer(productTitle)}`;
};
