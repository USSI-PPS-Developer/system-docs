# 🧾 UAT — API Jamkrida Jateng

> Dokumen User Acceptance Testing untuk produk **API Jamkrida Jateng**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | API Jamkrida Jateng     |
| Jenis Dokumen     | UAT         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 10 Oktober 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Tujuan
Memastikan integrasi penjaminan Jamkrida memenuhi kebutuhan bisnis PT BPR BKK Jateng dan dapat
dipakai petugas kredit dan teller tanpa bantuan teknis. Karena produk ini backend, UAT dijalankan
lewat **layar CBS** yang memanggilnya (Registrasi Kredit, Integrasi Jamkrida, Pembayaran Premi
Jamkrida, dan layar pemeliharaan).

## 2. Peserta UAT

| Nama | Unit / Jabatan | Peran dalam UAT |
|------|----------------|-----------------|
| | Divisi Kredit — penanggung jawab kredit | Approver |
| | Admin kredit KC Utama (001) | Penguji |
| | Teller / back office KC Utama | Penguji |
| | Tim IT BKK Jateng | Penguji (pemeliharaan) & pendamping |
| | PT USSI Pinbuk Prima Software | Pendamping teknis |

## 3. Lingkungan & Periode

| Item | Detail |
|------|--------|
| Environment | Produksi terbatas (kantor piloting 001) — data uji tidak dibuat di produksi, memakai kredit nyata bernilai kecil |
| URL | Aplikasi web CBS (IBS Gen II) |
| Periode | Mulai 5 Oktober 2026 (tahap registrasi → rekon); kelanjutan menunggu kredit nyata |

## 4. Skenario UAT (Berbasis Proses Bisnis)

| ID | Skenario Bisnis | Pre-condition | Hasil Diharapkan |
|----|-----------------|---------------|------------------|
| UAT-001 | Admin kredit menghitung IJP saat registrasi kredit | Asuransi = 001 JAMKRIDA, type kredit terpetakan | IJP dari Jamkrida tampil, masuk ke Premi, kolom terkunci |
| UAT-002 | Simpan registrasi tanpa Cek IJP | — | Ditolak |
| UAT-003 | Realisasi kredit memotong premi | UAT-001 | Premi terpotong tepat sebesar IJP; jumlah diterima debitur benar |
| UAT-004 | Penjaminan muncul otomatis di dashboard | UAT-003 | Baris Belum Kirim, IJP & Premi Ledger terisi, Jenis benar |
| UAT-005 | Rekon premi | UAT-004 | Empat nilai sama, Rekon = Cocok, tombol Kirim terbuka |
| UAT-006 | Kirim data non-bundling | Rekon cocok | Sertifikat terbit seketika, Status Kirim = Terkirim |
| UAT-007 | Kirim data bundling | Rekon cocok, berkas KTP/SPAJ/RIPLAY | Diterima Jamkrida, No Sertifikat = PENDING BUNDLING (kuning) |
| UAT-008 | Setor premi selama PENDING BUNDLING | UAT-007 | Ditolak dengan keterangan |
| UAT-009 | Cek status sampai disetujui | UAT-007 | Nomor sertifikat & sertifikat jiwa terisi, status APPROVED |
| UAT-010 | Bayar IJP sebelum premi disetor | UAT-006 | Tombol terkunci, alasan terbaca |
| UAT-011 | Setor premi kode 201 | UAT-006 / UAT-009 | Tiga set jurnal, satu nomor bukti |
| UAT-012 | Setoran premi kolektif dengan tanda bayar | Beberapa realisasi hari ini | Premi dapat ditandai lebih dulu; setoran sore melengkapi tanda |
| UAT-013 | Bayar IJP | UAT-011 / UAT-012 | Form terisi otomatis; Status Bayar = Sudah Bayar |
| UAT-014 | Lihat & unduh sertifikat | UAT-013 | PDF tampil; bundling dua tab |
| UAT-015 | Petugas kantor non-piloting membuka Integrasi Jamkrida | — | Ditolak dengan keterangan kantor |
| UAT-016 | Tim IT mengubah pemetaan produk & kantor piloting | Hak akses | Perubahan berlaku tanpa rilis |
| UAT-017 | Menelusuri kegagalan di Audit Log | Ada panggilan gagal | Payload tampil ter-mask, penyebab terbaca |

---

## 5. Hasil Eksekusi

| ID | Skenario | Tgl | Hasil Aktual | Status | Penguji |
|----|----------|-----|--------------|--------|---------|
| UAT-001 | Hitung IJP | 05-10-2026 | IJP Rp 150.000 (gross 150.000, diskon 0) | ✅ Diterima | USSI (Super EDP) |
| UAT-002 | Wajib Cek IJP | | | ⬜ | |
| UAT-003 | Realisasi | 05-10-2026 | Premi −150.000; diterima 9.650.000 sesuai hitungan | ✅ Diterima | USSI (Super EDP) |
| UAT-004 | Dashboard | 05-10-2026 | Baris terbentuk, Jenis = Bundling | ✅ Diterima | USSI (Super EDP) |
| UAT-005 | Rekon | 05-10-2026 | Empat nilai 150.000, Rekon = Cocok | ✅ Diterima | USSI (Super EDP) |
| UAT-006..017 | | | | ⬜ Belum | |

## 6. Defect / Temuan

| ID | Temuan | Severity | Status |
|----|--------|----------|--------|
| UAT-F01 | No Pinjaman data uji tidak berpola nomor SPK — perlu dipastikan sebelum kirim (ikut tercetak di sertifikat) | Medium | Open |
| UAT-F02 | Nilai Taksasi 0 untuk agunan kendaraan — perlu konfirmasi syarat Jamkrida | Low | Open |
| UAT-F03 | Redaksi pertanyaan SPAJ belum tersedia; layar hanya menampilkan nomor pertanyaan | Medium | Open (menunggu Jamkrida/CAR) |
| UAT-F04 | Perlakuan premi bila CAR menolak bundling belum ditetapkan | High | Open (menunggu Jamkrida) |
| UAT-F05 | PDF dari `dlsertifikat` produksi belum sama dengan contoh sertifikat Jamkrida | Medium | Open (konfirmasi Jamkrida) |
| UAT-F06 | Penyelesaian penjaminan lama setelah izin piloting dicabut (lihat BRD BR-014) | Medium | Open (keputusan BPR) |

## 7. Kesimpulan & Rekomendasi
Bagian alur yang paling rawan selisih — perpindahan nilai IJP dari Jamkrida ke pembukuan bank —
terbukti benar di produksi. Rekomendasi: lanjutkan UAT-006 s.d. UAT-017 pada kredit nyata berikutnya
di KC Utama sebelum perluasan piloting, dan tutup UAT-F04 bersama Jamkrida sebelum produk bundling
dipakai luas.

## 8. Berita Acara Persetujuan (Sign-Off)

> Dengan ini menyatakan bahwa produk **API Jamkrida Jateng** telah diuji dan **DITERIMA / DITOLAK** untuk dilanjutkan ke tahap implementasi.

| Peran | Nama | Tanda Tangan | Tanggal |
|-------|------|--------------|---------|
| Business Owner (Divisi Kredit) | | | |
| Tim IT BKK Jateng | | | |
| Pengembang (USSI) | | | |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 10 Oktober 2026 | | Dokumen dibuat |

---

*[← Kembali ke API Jamkrida Jateng](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
