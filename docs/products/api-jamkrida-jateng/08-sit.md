# 🔗 SIT Documentation — API Jamkrida Jateng

> Dokumentasi System Integration Testing untuk produk **API Jamkrida Jateng**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | API Jamkrida Jateng     |
| Jenis Dokumen     | SIT Documentation         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 10 Oktober 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Tujuan & Ruang Lingkup
Memastikan **API Jamkrida Jateng** terintegrasi benar secara end-to-end dengan CBS IbsJateng, web CBS
`ptbkkjateng`, dan Jamkrida Online — untuk skenario non-bundling dan bundling.

## 2. Sistem yang Terintegrasi

| No | Sistem A | ↔ | Sistem B | Jenis Integrasi |
|----|----------|---|----------|-----------------|
| 1 | CBS IbsJateng (020201 registrasi) | → | DB `jamkrida_spaj_draft` | Tulis langsung DB |
| 2 | CBS IbsJateng (020207 realisasi) | → | API Jamkrida Jateng `/kredit/realisasi` | REST JSON, `X-Api-Key` |
| 3 | Web CBS (dashboard & pemeliharaan) | → | API Jamkrida Jateng `/jamkrida/**` | REST JSON/PDF/multipart |
| 4 | CBS IbsJateng (020252 setoran premi) | → | DB `premitrans`, `jamkrida_premi_mutasi`, `jamkrida_trans` | Tulis langsung DB (satu transaksi) |
| 5 | API Jamkrida Jateng | → | Jamkrida Online | REST JSON / multipart, header `Token` |
| 6 | Jamkrida | → | API Jamkrida Jateng `/publik/premi/status` | REST JSON, kunci terpisah |

## 3. Lingkungan SIT

| Komponen | Detail |
|----------|--------|
| Environment | Dev (server Docker), Jamkrida `devapi/v3/public` |
| Endpoint publik | `https://api-jamkridadev.bkkjateng.co.id/publik/**` |
| Versi build | `api-jamkrida-jateng-1.0.0-SNAPSHOT` |
| Periode | 18–30 September 2026 |
| Rekening uji | Non-bundling `001136000001` (sertifikat `JT.P01-1813.26.0076851`); bundling `003138000003` (sertifikat `JT.P01-1813.26.0076868`) |

## 4. Skenario Integrasi

| ID | Skenario | Sistem Terlibat | Pre-condition | Hasil Diharapkan |
|----|----------|-----------------|---------------|------------------|
| SIT-001 | Authenticate + cache token | Service, Jamkrida | Kredensial dev | Token tersimpan; password `***` & token 8 karakter di audit log |
| SIT-002 | Sinkronisasi referensi | Service, Jamkrida | — | 5 tipe terisi di `jamkrida_referensi` |
| SIT-003 | Cek IJP dari layar registrasi | Web, Service, Jamkrida | Pemetaan produk terisi | IJP tampil, dapat dipakai ke premi |
| SIT-004 | Registrasi → titipan SPAJ | CBS, DB | Kantor piloting | Baris `jamkrida_spaj_draft` |
| SIT-005 | Wajib Cek IJP sebelum simpan | Web | — | Simpan ditolak bila belum Cek IJP |
| SIT-006 | Realisasi → `jamkrida_trans` + `premitrans` 101 | CBS, Service, DB | SIT-004 | Baris terbentuk, draft terhapus |
| SIT-007 | Rekon premi 3 sumber | Web, Service, DB, Jamkrida | SIT-006 | Cocok di `premitrans`/`kredit.premi`/`kretrans.premi` |
| SIT-008 | Kirim sebelum rekon | Web, Service | — | `/send` ditolak |
| SIT-009 | `/add` non-bundling | Service, Jamkrida | Rekon cocok | Sertifikat terbit, `inforce` |
| SIT-010 | Detail `/no_rekening/{no}` | Service, Jamkrida | SIT-009 | Data tampil |
| SIT-011 | Setoran premi 201 → bayar IJP | CBS, Service, Jamkrida | SIT-009 | `/bayarijp` sukses, tercatat |
| SIT-012 | `/linksertifikat` + proksi PDF | Web, Service, Jamkrida | SIT-011 | PDF tampil di pratinjau |
| SIT-013 | `/addbundling` multipart + 3 berkas | Service, Jamkrida | Produk bundling, berkas lengkap | `code 00` |
| SIT-014 | `/statusbundling` via Cek Status | Web, Service, Jamkrida | SIT-013 | Status & nomor sertifikat terbaca |
| SIT-015 | Dua sertifikat bundling | Web, Service, Jamkrida | Bundling disetujui | Tab penjaminan & jiwa, keduanya bisa diunduh |
| SIT-016 | Status premi publik | Jamkrida, Service | SIT-011 | `sudah_dibayar=true` |
| SIT-017 | Piloting — kantor non-piloting | CBS, Web, Service | Kantor di luar daftar | Layar menolak; penjaminan tidak terbentuk |

---

## 5. Hasil Eksekusi

| ID | Skenario | Tgl Uji | Hasil Aktual | Status | Defect |
|----|----------|---------|--------------|--------|--------|
| SIT-001 | Authenticate | 30-09-2026 | OK, masking sesuai | ✅ Pass | - |
| SIT-002 | Sinkron referensi | 30-09-2026 | produk 7, jenis agunan 22, sektor usaha 28, cabang 29, pekerjaan 418 | ✅ Pass | - |
| SIT-003 | Cek IJP | 30-09-2026 | OK | ✅ Pass | - |
| SIT-004 | Titipan SPAJ | 30-09-2026 | OK | ✅ Pass | - |
| SIT-005 | Wajib Cek IJP | 30-09-2026 | Simpan ditolak bila belum | ✅ Pass | - |
| SIT-006 | Realisasi | 30-09-2026 | OK, draft terhapus | ✅ Pass | - |
| SIT-007 | Rekon 3 sumber | 30-09-2026 | Cocok | ✅ Pass | - |
| SIT-008 | Proteksi kirim | 30-09-2026 | `/send` ditolak | ✅ Pass | - |
| SIT-009 | `/add` | 30-09-2026 | Sertifikat terbit, `inforce` | ✅ Pass | - |
| SIT-010 | Detail | 30-09-2026 | OK | ✅ Pass | - |
| SIT-011 | Bayar IJP | 30-09-2026 | Tercatat di `jamkrida_pembayaran_ijp` | ✅ Pass | - |
| SIT-012 | Sertifikat | 30-09-2026 | OK; bundling `url_sertifikat1` + `url_sertifikat_car` | ✅ Pass | - |
| SIT-013 | `/addbundling` | 30-09-2026 | `code 00`, status PENDING BUNDLING | ✅ Pass | DEF-001, DEF-002, DEF-004 |
| SIT-014 | `/statusbundling` | 30-09-2026 | OK | ✅ Pass | DEF-005 |
| SIT-015 | Dua sertifikat bundling | 30-09-2026 | Pratinjau & unduh OK | ✅ Pass | - |
| SIT-016 | Status premi publik | | | ⬜ Belum (menunggu jadwal uji bersama Jamkrida) | - |
| SIT-017 | Piloting | | | ⬜ Belum formal | - |

> **Belum teramati:** peralihan status bundling dari `PENDING BUNDLING` ke status final di sisi
> Jamkrida/CAR dalam kondisi nyata.

## 6. Defect Log

| ID Defect | Deskripsi | Severity | Status | Resolusi |
|-----------|-----------|----------|--------|----------|
| DEF-001 | `/addbundling` HTTP 500 body kosong | High | Closed | Penyebab: nama field — dokumen Jamkrida menulis `kode_pekerjaan`, yang benar `pekerjaan` (dikonfirmasi Jamkrida 30-09-2026). DTO diperbaiki, `kode_pekerjaan` tetap diterima sebagai alias |
| DEF-002 | `/addbundling` menuntut berkas KTP yang tidak ada di dokumentasi (`code 05 File KTP kosong`) | High | Closed | Revisi dokumentasi Jamkrida: `file_ktp`, `file_spaj`, `file_riplay`, `sumber_penghasilan`; dikirim multipart; tabel `jamkrida_berkas` + layar unggah |
| DEF-003 | Response `/cekijp` mengembalikan `data` sebagai objek, bukan array seperti di dokumen | Low | Closed | Client menerima kedua bentuk |
| DEF-004 | Kalimat `PENDING BUNDLING` tersimpan seolah nomor sertifikat | Medium | Closed | `sertifikatMasihPending()` menolak teks penanda; kolom No Sertifikat diberi warna kuning |
| DEF-005 | `/no_rekening` untuk bundling membalas "Cek statusbundling" | Medium | Closed | Integrasi `/statusbundling` (tidak berdokumentasi) dengan DTO tersendiri |
| DEF-006 | Jamkrida membalas token kedaluwarsa dengan HTTP 200 | Medium | Closed | Penolakan token di body dikenali → authenticate ulang |
| DEF-007 | Sertifikat Jamkrida dikirim `text/html` + attachment → tidak bisa dipratinjau | Medium | Closed | Proksi PDF di service dengan pemeriksaan `%PDF` |
| DEF-008 | `UnknownHostException` ~19 menit (21-09-2026) dari container | Medium | Closed | Resolver DNS container dipatok di compose |
| DEF-009 | 404/405/400 tertelan menjadi `01` generik | Low | Closed | Dilaporkan `07` dengan penyebab |
| DEF-010 | Rekon lolos saat payload Cek IJP tidak lengkap | High | Closed | Rekon kini menolak payload tidak lengkap |

## 7. Kesimpulan

Jalur non-bundling dan bundling **tersambung penuh** di lingkungan dev per 30-09-2026: daftar, bayar
IJP, dan sertifikat (termasuk dua sertifikat bundling) berhasil. Skenario yang tersisa — status
premi publik bersama Jamkrida dan transisi akhir PENDING BUNDLING — tidak menghalangi UAT, tetapi
wajib dieksekusi sebelum perluasan piloting.

### Lampiran — Uji produksi terbatas (05-10-2026)

| Item | Nilai |
|------|-------|
| Lingkungan | Produksi IBS Gen II, kantor 001 — KC Utama |
| Skenario | Bundling, produk 3934, plafond Rp 10.000.000, tenor 12, IJP Rp 150.000 |
| Hasil | 7 dari 7 langkah lulus (Cek IJP → simpan registrasi → agunan → realisasi → dashboard → rekon → status Cocok) |
| Belum dijalankan | Kirim, cek status bundling, setor premi 201, bayar IJP, sertifikat |
| Temuan | Format No Pinjaman tidak berpola SPK; nilai taksasi 0 untuk agunan kendaraan — perlu konfirmasi sebelum kirim |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 10 Oktober 2026 | | Dokumen dibuat |

---

*[← Kembali ke API Jamkrida Jateng](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
