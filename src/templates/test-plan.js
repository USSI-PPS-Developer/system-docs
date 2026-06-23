'use strict';

const { header, footer } = require('./_shared');

module.exports = function testPlan(productTitle) {
  return `${header({
    docTitle: 'Test Plan',
    emoji: '🧪',
    productTitle,
    intro: `Rencana pengujian untuk produk **${productTitle}**.`,
  })}

## 1. Tujuan & Ruang Lingkup Pengujian
_Apa yang diuji dan tidak diuji._

## 2. Strategi & Pendekatan Pengujian
_mis. manual + otomatis, berbasis risiko, dll._

## 3. Jenis Pengujian

| Jenis | Dilakukan? | Keterangan |
|-------|-----------|------------|
| Unit Testing | ✅ / ❌ | |
| Functional Testing | ✅ | |
| Integration Testing (SIT) | ✅ | lihat [SIT](08-sit.md) |
| User Acceptance (UAT) | ✅ | lihat [UAT](09-uat.md) |
| Performance Testing | | |
| Security Testing | | |

## 4. Lingkungan Pengujian

| Komponen | Spesifikasi |
|----------|-------------|
| Environment | Dev / SIT / UAT |
| URL / Server | |
| Database | |
| Data uji | |

## 5. Kriteria Masuk & Keluar

### Entry Criteria
- _Build tersedia, environment siap, test case approved_

### Exit Criteria
- _100% test case dieksekusi, 0 defect Critical/High terbuka_

## 6. Jadwal Pengujian

| Aktivitas | Mulai | Selesai | PIC |
|-----------|-------|---------|-----|
| Persiapan test case | | | |
| Eksekusi SIT | | | |
| Eksekusi UAT | | | |

## 7. Peran & Tanggung Jawab

| Peran | Nama | Tanggung Jawab |
|-------|------|----------------|
| Test Lead | | |
| Tester | | |

## 8. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| | | |

## 9. Deliverable Pengujian
- [Test Case](07-test-case.md)
- Laporan hasil uji (SIT/UAT)
- Defect log
${footer(productTitle)}`;
};
