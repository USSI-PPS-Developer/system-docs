'use strict';

const { header, footer } = require('./_shared');

module.exports = function srs(productTitle) {
  return `${header({
    docTitle: 'Software Requirements Specification (SRS)',
    emoji: '📐',
    productTitle,
    intro: `Spesifikasi kebutuhan perangkat lunak untuk produk **${productTitle}** (mengacu kaidah IEEE 830).`,
  })}

## 1. Pendahuluan

### 1.1 Tujuan
_Tujuan dokumen SRS ini._

### 1.2 Ruang Lingkup Sistem
_Apa yang dilakukan sistem **${productTitle}**, manfaat, dan tujuannya._

### 1.3 Definisi & Akronim

| Istilah | Penjelasan |
|---------|------------|
| H2H | Host to Host |
| SLA | Service Level Agreement |

### 1.4 Referensi
- [BRD ${productTitle}](01-brd.md)

## 2. Deskripsi Umum

### 2.1 Perspektif Produk
_Posisi produk dalam ekosistem (integrasi dengan core banking, kanal, dll)._

### 2.2 Fungsi Utama Produk
- _Fungsi 1_
- _Fungsi 2_

### 2.3 Karakteristik Pengguna

| Tipe Pengguna | Hak Akses | Keterangan |
|---------------|-----------|------------|
| Admin | | |
| Operator | | |

### 2.4 Batasan & Asumsi
- _mis. bahasa pemrograman, platform, regulasi OJK/BI_

## 3. Kebutuhan Fungsional

| ID | Kebutuhan Fungsional | Deskripsi | Prioritas | Ref. BRD |
|----|----------------------|-----------|-----------|----------|
| FR-001 | _Nama fungsi_ | _Sistem harus..._ | Wajib | BR-001 |

### Detail FR-001
- **Pemicu:** _..._
- **Input:** _..._
- **Proses:** _..._
- **Output:** _..._
- **Aturan validasi:** _..._

## 4. Kebutuhan Non-Fungsional

| ID | Kategori | Kebutuhan |
|----|----------|-----------|
| NFR-001 | Performa | _mis. respon < 2 detik untuk 95% request_ |
| NFR-002 | Keamanan | _mis. enkripsi data sensitif, audit log_ |
| NFR-003 | Ketersediaan | _mis. uptime 99,9%_ |
| NFR-004 | Skalabilitas | |
| NFR-005 | Kompatibilitas | |

## 5. Use Case Utama

\`\`\`
Aktor: [Pengguna]
Use Case: [Nama]
Pre-condition: ...
Main Flow:
  1. ...
  2. ...
Post-condition: ...
Alternative/Exception Flow: ...
\`\`\`

## 6. Antarmuka Eksternal
- **Antarmuka Pengguna:** lihat [Desain UI/UX](05-uiux-design.md)
- **Antarmuka Sistem/API:** lihat [API Contract](03-api-contract.md)
- **Antarmuka Data:** lihat [Desain Database](04-database-design.md)
${footer(productTitle)}`;
};
