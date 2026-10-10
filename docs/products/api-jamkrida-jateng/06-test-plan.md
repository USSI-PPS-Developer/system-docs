# 🧪 Test Plan — API Jamkrida Jateng

> Rencana pengujian untuk produk **API Jamkrida Jateng**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | API Jamkrida Jateng     |
| Jenis Dokumen     | Test Plan         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 10 Oktober 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Tujuan & Ruang Lingkup Pengujian

Memastikan service integrasi Jamkrida:
- menghitung, membukukan, dan merekonsiliasi premi IJP dengan benar,
- mengirim data penjaminan non-bundling dan bundling ke Jamkrida dengan urutan yang terkunci,
- melaporkan pembayaran IJP hanya setelah premi disetor/ditandai,
- mencatat seluruh komunikasi dengan data pribadi ter-mask,
- membatasi akses (dua kunci API, kantor piloting).

**Diuji:** seluruh endpoint di [API Contract](03-api-contract.md), integrasi CBS (020201, 020207,
020252) dan web CBS, integrasi Jamkrida Online dev & produksi.

**Tidak diuji di sini:** logika jurnal setoran premi kode 201 di CBS (diuji di produk CBS), tampilan
layar web CBS selain sebagai sarana uji end-to-end, performa beban tinggi.

## 2. Strategi & Pendekatan Pengujian

- **Berbasis risiko.** Prioritas tertinggi pada jalur uang dan data yang tidak bisa ditarik kembali:
  rekon premi, kirim (sertifikat tidak bisa dibatalkan), bayar IJP, status premi publik.
- **Unit test otomatis** (JUnit, `mvn test`) untuk komponen yang perilakunya bisa diisolasi: masking
  audit, manajemen token, retry authenticate.
- **Uji fungsional manual** lewat Swagger/curl dan layar CBS terhadap Jamkrida **dev**.
- **SIT end-to-end** CBS → service → Jamkrida dengan rekening nyata di dev, dua skenario
  (non-bundling & bundling).
- **Uji produksi terbatas** (smoke + satu kredit nyata bernilai kecil) setelah deploy.
- Setiap kegagalan ditelusuri lewat `jamkrida_audit_log` (`trace_id`).

## 3. Jenis Pengujian

| Jenis | Dilakukan? | Keterangan |
|-------|-----------|------------|
| Unit Testing | ✅ | 13 test: `SensitiveDataMaskerTest` (5), `JamkridaTokenManagerTest` (3), `JamkridaApiClientTokenTest` (4), `JamkridaApiClientRetryTest` (1) |
| Functional Testing | ✅ | Per endpoint, positif & negatif — lihat [Test Case](07-test-case.md) |
| Integration Testing (SIT) | ✅ | lihat [SIT](08-sit.md) |
| User Acceptance (UAT) | ✅ | lihat [UAT](09-uat.md) |
| Smoke test produksi | ✅ | Checklist pasca-deploy di [Deployment Guide](10-deployment-guide.md) §5 |
| Performance Testing | ❌ | Volume rendah (per realisasi kredit); tidak dijadwalkan |
| Security Testing | ✅ (terbatas) | Pemisahan kunci API, reverse proxy hanya `/publik/**`, masking audit log |

## 4. Lingkungan Pengujian

| Komponen | Dev / SIT | Produksi (smoke) |
|----------|-----------|------------------|
| Service | Docker di server dev, profil `dev` | Docker di host CentOS 7, profil `prod` |
| URL publik | `https://api-jamkridadev.bkkjateng.co.id` | Menyusul |
| Jamkrida | `https://jamkrida-online.co.id/devapi/v3/public` | `https://jamkrida-online.co.id/api/ussi/public` |
| Database | MySQL 5.5 `bkkjateng` / `bkkjateng_sys` (staging) | MySQL 5.5 produksi |
| CBS / Web | IbsJatengDev + `ptbkkjateng` dev | IBS Gen II produksi |
| Data uji | Rekening kredit uji, berkas KTP/SPAJ/RIPLAY dummy (PDF) | Satu kredit nyata bernilai kecil di kantor piloting |

## 5. Kriteria Masuk & Keluar

### Entry Criteria
- Build lolos `mvn clean package` (bukan kompilasi incremental) dan seluruh unit test hijau.
- Migrasi `jamkrida_*` sampai V16 terpasang; patch CBS & menu terpasang.
- Master data tersinkron; pemetaan produk terisi; kantor uji terdaftar di piloting.
- Kredensial akun API Jamkrida lingkungan terkait tersedia.

### Exit Criteria
- Seluruh test case prioritas Tinggi lulus.
- Tidak ada defect Critical/High terbuka.
- Satu siklus penuh non-bundling dan satu siklus bundling (sampai sertifikat) lulus di dev.
- Audit log memperlihatkan URL lingkungan yang benar dan field sensitif ter-mask.

## 6. Jadwal Pengujian

| Tahap | Periode | Status |
|-------|---------|--------|
| Unit & fungsional (dev) | 18–30 September 2026 | Selesai |
| SIT non-bundling & bundling (dev), verifikasi end-to-end terakhir | 30 September 2026 | Selesai (`/addbundling` pertama berhasil hari ini) |
| Rilis produksi pertama + smoke | 1 Oktober 2026 | Selesai |
| Uji produksi registrasi → rekon (bundling) | 5 Oktober 2026 | Selesai, 7/7 lulus |
| Uji produksi kirim → sertifikat | Menunggu kredit nyata | Belum |
| UAT bisnis | Menyusul | Belum |

## 7. Peran & Tanggung Jawab

| Peran | Pihak | Tanggung Jawab |
|-------|-------|----------------|
| Developer | PT USSI Pinbuk Prima Software | Unit test, uji fungsional, perbaikan defect |
| Penguji SIT | Developer + Tim IT BKK | Eksekusi skenario end-to-end |
| Penguji UAT | Divisi Kredit, admin kredit KC Utama | Penerimaan alur bisnis |
| Mitra | Tim pengembang Jamkrida | Konfirmasi perilaku API, log server, status bundling |
| Approver | Penanggung jawab kredit, manajemen | Sign-off |

## 8. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Perilaku Jamkrida berbeda dari dokumentasi (nama field, bentuk `data`, endpoint tak berdokumentasi) | Daftar temuan tertulis ke Jamkrida; client toleran terhadap dua bentuk; uji terhadap respons nyata |
| Status akhir bundling (setelah PENDING) belum pernah teramati | Skenario disiapkan, dieksekusi saat CAR memutuskan; tombol Cek Status sebagai pemantau |
| Data uji di produksi tidak boleh dibuat | Uji produksi memakai kredit nyata bernilai kecil; langkah dihentikan di titik aman |
| Profil salah di produksi (`devapi`) | Skrip deploy menolak `APP_PROFILE≠prod`; audit log diperiksa |
| Build incremental lolos dengan kode lama | Wajib `mvn clean package` sebelum deploy/uji |

## 9. Deliverable Pengujian

- Laporan unit test (`target/surefire-reports`)
- [Test Case](07-test-case.md) beserta hasil
- [SIT Documentation](08-sit.md)
- Laporan *Skenario Test Produksi — Integrasi Jamkrida* (5 Oktober 2026)
- [UAT](09-uat.md) + berita acara

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 10 Oktober 2026 | | Dokumen dibuat |

---

*[← Kembali ke API Jamkrida Jateng](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
