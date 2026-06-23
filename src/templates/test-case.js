'use strict';

const { header, footer } = require('./_shared');

module.exports = function testCase(productTitle) {
  return `${header({
    docTitle: 'Test Case',
    emoji: '✅',
    productTitle,
    intro: `Daftar skenario & kasus uji untuk produk **${productTitle}**.`,
  })}

## 1. Ringkasan Test Case

| ID | Modul / Fitur | Judul Test Case | Prioritas | Jenis |
|----|---------------|-----------------|-----------|-------|
| TC-001 | _Fitur_ | _Judul singkat_ | Tinggi | Positif / Negatif |

---

## 2. Detail Test Case

### TC-001 — _Judul Test Case_

| Field | Detail |
|-------|--------|
| ID | TC-001 |
| Modul / Fitur | |
| Prioritas | Tinggi / Sedang / Rendah |
| Pre-condition | _Kondisi awal sebelum uji_ |
| Test Data | _Data yang dipakai_ |

**Langkah Pengujian**

| No | Langkah | Hasil Diharapkan | Hasil Aktual | Status |
|----|---------|------------------|--------------|--------|
| 1  | _Buka halaman ..._ | _Halaman tampil_ | | ⬜ Belum |
| 2  | _Isi form & submit_ | _Muncul notifikasi sukses_ | | ⬜ Belum |

**Hasil Akhir:** ⬜ Pass / ⬜ Fail
**Catatan:** _..._

---

> Salin blok **TC-XXX** di atas untuk setiap kasus uji baru.

## 3. Rekapitulasi

| Status | Jumlah |
|--------|--------|
| ✅ Pass | 0 |
| ❌ Fail | 0 |
| ⬜ Belum diuji | 0 |
| **Total** | **0** |
${footer(productTitle)}`;
};
