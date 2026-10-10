# 📖 User Manual — API Jamkrida Jateng

> Panduan pengguna untuk produk **API Jamkrida Jateng**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | API Jamkrida Jateng     |
| Jenis Dokumen     | User Manual         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 10 Oktober 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Pendahuluan

API Jamkrida Jateng adalah layanan di belakang layar yang menghubungkan IBS Gen II dengan Jamkrida
Online. Pengguna **tidak membuka aplikasi tersendiri** — seluruh pekerjaan dilakukan dari menu CBS
yang sudah dikenal. Manual ini untuk **petugas kredit, teller, dan tim IT BKK** yang menangani
penjaminan kredit Jamkrida.

Manfaatnya bagi pengguna:
- IJP dihitung langsung oleh Jamkrida, bukan diketik.
- Penjaminan terbentuk otomatis saat realisasi — tidak perlu input ulang.
- Sistem mengunci urutan kerja sehingga premi, data, dan pembayaran tidak bisa tertukar urutannya.
- Sertifikat bisa dilihat dan diunduh langsung dari layar.

Ada dua skenario:

| Skenario | Isi | Bedanya |
|----------|-----|---------|
| **Non-Bundling** | Penjaminan kredit saja | Sertifikat terbit seketika |
| **Bundling** | Penjaminan + asuransi jiwa CAR (produk bertanda *JIWA*) | Perlu berkas pendukung; sertifikat menunggu persetujuan CAR; terbit dua sertifikat |

## 2. Persyaratan Akses

| Item | Detail |
|------|--------|
| URL Aplikasi | Aplikasi web CBS (IBS Gen II) |
| Browser yang didukung | Chrome / Edge terbaru |
| Akun / Hak akses | Akun CBS dengan menu Jamkrida pada jabatannya |
| Kantor | Hanya **kantor piloting** (saat ini 000 Pusat dan 001 KC Utama) yang dapat membuat penjaminan baru |

Menu yang dipakai:

| Menu | Untuk |
|------|-------|
| `Master → Master Kredit → Registrasi Kredit` | Cek IJP saat mendaftarkan pinjaman |
| `Master → Master Kredit → Integrasi Jamkrida` | Layar utama: rekon, kirim, cek status, bayar IJP, sertifikat |
| `Master → Master Kredit → Pembayaran Premi Jamkrida` | Setor premi ke rekening Jamkrida (kode 201) |
| `Pembayaran Premi Jamkrida Kolektif` | Tandai & setor premi banyak rekening sekaligus |
| `Master → Master Kredit → Mapping Produk Jamkrida` | (Tim IT) jenis kredit → produk Jamkrida |
| `Master → Master Kredit → Kantor Piloting Jamkrida` | (Tim IT) kantor yang boleh memakai integrasi |
| `Master → Master Kredit → Master Data Jamkrida` | Data acuan dari Jamkrida (hanya lihat) |
| `Master → Master Kredit → Audit Log Jamkrida` | Riwayat komunikasi dengan Jamkrida |

## 3. Cara Login
Login ke CBS seperti biasa. Tidak ada login terpisah untuk Jamkrida.

## 4. Panduan Fitur

**Urutan besar yang tidak boleh dibalik:**

```
Registrasi kredit (Cek IJP) → Realisasi → Rekon premi → Kirim data
   → Setor premi (kode 201) → Bayar IJP → Sertifikat
```

Kalau tombol berwarna abu-abu, **arahkan kursor ke tombolnya** — alasannya muncul sebagai keterangan.

### 4.1 Cek IJP saat registrasi kredit
**Tujuan:** menghitung IJP langsung dari Jamkrida dan memakainya sebagai premi.

1. Isi tab **Data Pinjaman** (plafond, tenor, **Type Kredit**).
2. Tab **Potongan & Status** → Nama Asuransi **001 – JAMKRIDA** → tombol **Cek IJP**.
3. Produk Jamkrida terisi sesuai pemetaan jenis kredit. Lengkapi jenis agunan, sektor usaha, tinggi &
   berat badan, type terjamin, nilai taksasi, **pertanyaan SPAJ 1–4** (sesuai keadaan debitur), dan
   skor kelayakan (≤ Rp 250 juta: 2 indikator; di atasnya 4). Produk bundling juga meminta **Pekerjaan**.
4. Tekan **Hitung IJP** → **Gunakan ke Premi**. Kolom premi terkunci.
5. Simpan registrasi. Registrasi **tidak bisa disimpan** sebelum Cek IJP.

> Daftar produk kosong berarti type kredit itu belum dipetakan — hubungi Tim IT, jangan memilih produk lain.

### 4.2 Realisasi kredit
Jalankan realisasi seperti biasa. Premi Jamkrida ikut terpotong dari pencairan, dan penjaminan muncul
otomatis di **Integrasi Jamkrida** dengan status **Belum Kirim**.

### 4.3 Layar Integrasi Jamkrida
Atur **Tgl Realisasi**, ketik sebagian nomor rekening atau nama debitur di **Cari**, tekan **Cari**.

| Kolom | Arti |
|-------|------|
| IJP (cekijp) | IJP hasil hitung Jamkrida |
| Premi Ledger | Nomor transaksi premi; merah = belum terbukukan |
| Rekon | Belum / Cocok / Tidak cocok |
| Status Kirim | Belum Kirim / Terkirim / Gagal |
| Status Bayar | `-` belum dikirim, Belum Bayar, Sudah Bayar |
| Jenis | Bundling / Non-Bundling |
| No Sertifikat | Kuning = belum terbit (mis. PENDING BUNDLING) |

| Tombol (kolom Aksi) | Fungsi | Aktif bila |
|---------------------|--------|-----------|
| Oranye (panah memutar) | Get IJP / Premi (rekon) | Selalu |
| Hijau | Kirim data | Rekon cocok **di sesi ini** & belum dikirim |
| Biru (uang) | Bayar IJP | Terkirim, premi sudah disetor/ditandai, IJP belum dibayar |
| Putih (PDF) | Sertifikat | Terkirim |
| Hitam / biru (i) | Cek status | Terkirim — biru bila bundling masih menunggu |

Petugas cabang hanya melihat kantornya; kantor pusat dapat memilih semua kantor.

### 4.4 Rekon premi
Tekan **Get IJP / Premi**. Jendela membandingkan IJP Jamkrida dengan premi di tiga tempat pembukuan.
**Cocok** → tombol Kirim terbuka. **Tidak cocok** → jendela menyebut sumber yang berbeda; telusuri
penyebabnya, jangan dipaksa. Rekon wajib diulang **setiap kali sebelum kirim**.

### 4.5 Kirim data ke Jamkrida
Tekan **Kirim**, periksa isi jendela (nama, NIK, tanggal lahir, nilai pinjaman), lalu
**Kirim ke Jamkrida**. Produk, tenor, nilai pinjaman, tanggal lahir, dan skor **terkunci**; identitas,
alamat, cabang, agunan, sektor usaha, dan taksasi boleh diperbaiki.

> Sertifikat yang sudah terbit **tidak bisa dibatalkan** lewat sistem.

**Tambahan untuk Bundling** — jendela kirim memuat:

| Bagian | Isi |
|--------|-----|
| Data Bundling | **Pekerjaan**, **Sumber Penghasilan** (1 Gaji / 2 Usaha), penjelasan SPAJ untuk pertanyaan yang dijawab Ya |
| Berkas Pendukung | Scan **KTP** (PDF/JPG), **SPAJ** (PDF), **RIPLAY** (PDF) — maks 5 MB, unggah lewat tombol **Ganti** |

Hasil kirim bundling: No Sertifikat **PENDING BUNDLING** (kuning) — menunggu keputusan CAR. Tekan
**Cek Status** berkala sampai status berubah (mis. **APPROVED**) dan muncul dua nomor: sertifikat
penjaminan (Jamkrida) dan sertifikat jiwa (CAR).

### 4.6 Setor premi (kode 201)
Menu **Pembayaran Premi Jamkrida** → Kode Transaksi **201** → cari rekening kredit → **Transaksi**.
Rekening tujuan, nominal, dan keterangan terisi otomatis; kuitansi dibuat sistem. Terbentuk tiga set
jurnal (cabang asal, pusat, kantor tabungan Jamkrida) dengan satu nomor bukti.

Selama bundling masih **PENDING BUNDLING**, setoran ditolak.

**Setoran kolektif:** di layar kolektif premi boleh **ditandai dibayar** lebih dulu supaya sertifikat
tidak menunggu sore; setoran sore hari melengkapinya. Tanda yang belum disetor terlihat di kolom
**Tanda Bayar**. Bila satu setoran timeout, perulangan berhenti — **periksa dulu** sebelum mengulang.

### 4.7 Bayar IJP
Tekan **Bayar IJP**. Form terisi otomatis dari setoran premi (no referensi, tanggal, nilai,
deskripsi). Isi **Nilai Feebase** (0 bila tidak ada). Kosongkan Nilai IJP untuk memakai nilai
sertifikat. Tekan **Kirim Pembayaran** → Status Bayar menjadi **Sudah Bayar**. Premi yang baru
ditandai belum punya kuitansi — no referensi & deskripsi diisi manual.

### 4.8 Sertifikat
Tekan **PDF** untuk pratinjau dan unduh. Bundling menampilkan **dua tab** (Penjaminan & Jiwa). Bila
pratinjau kosong, tekan **Ambil Ulang Link**.

### 4.9 Pemeliharaan (Tim IT)
- **Mapping Produk Jamkrida** — tambah/ubah/hapus pasangan type kredit ↔ produk Jamkrida, termasuk
  tanda bundling. Pasangan dobel ditolak.
- **Kantor Piloting Jamkrida** — seluruh kantor CBS tampil dengan statusnya; aktifkan/nonaktifkan.
- **Master Data Jamkrida** — hanya lihat; tombol **Sinkron** menarik ulang dari Jamkrida (otomatis
  tiap 01:15). Data yang ditarik Jamkrida ditandai **Ditarik**.
- **Audit Log Jamkrida** — filter tanggal, endpoint, rekening, hasil; klik baris untuk payload (data
  pribadi sudah tersamar).

## 5. FAQ (Pertanyaan Umum)

| Pertanyaan | Jawaban |
|------------|---------|
| Kenapa tombol Kirim terkunci padahal kemarin sudah rekon? | Rekon harus diulang setiap kali sebelum kirim. |
| Kenapa Bayar IJP terkunci? | Premi belum disetor (kode 201) atau belum ditandai dibayar. |
| Kenapa sertifikat bundling belum terbit? | Menunggu keputusan CAR. Cek Status berkala. |
| Bisakah premi bundling disetor sambil menunggu? | Tidak — bila CAR menolak, tiga jurnal harus dikoreksi. |
| Kantor saya tidak bisa membuka Integrasi Jamkrida | Kantor belum ikut piloting; hubungi kantor pusat. |

## 6. Troubleshooting

| Masalah | Langkah |
|---------|---------|
| Rekon tidak cocok | Biasanya premi diubah manual setelah Cek IJP atau produk berubah. Telusuri, jangan kirim |
| Kirim/bayar gagal | Buka **Audit Log Jamkrida**, pastikan permintaan sebelumnya tidak sampai sebelum mengulang |
| Kirim bundling ditolak "berkas kurang" | Lengkapi KTP, SPAJ, RIPLAY dan Pekerjaan/Sumber Penghasilan |
| Pratinjau sertifikat kosong | **Ambil Ulang Link** |
| Data debitur salah setelah sertifikat terbit | Hubungi Jamkrida — tidak bisa dibatalkan lewat sistem |

## 7. Glosarium

| Istilah | Arti |
|---------|------|
| IJP | Imbal Jasa Penjaminan, biaya penjaminan ke Jamkrida |
| Premi | Potongan dari debitur saat realisasi untuk membayar IJP |
| Rekon | Pencocokan IJP Jamkrida dengan premi di pembukuan |
| SPAJ | Surat Pengajuan Asuransi Jiwa — pertanyaan kesehatan |
| RIPLAY | Ringkasan Informasi Produk dan Layanan (format dari CAR) |
| Bundling | Penjaminan + asuransi jiwa CAR |
| CAR | PT Asuransi CAR, penanggung jiwa |
| Kantor piloting | Kantor yang sudah diizinkan memakai integrasi |

## 8. Bantuan & Dukungan

| Kebutuhan | Hubungi |
|-----------|---------|
| Hak akses, kantor piloting, pemetaan produk | Tim IT BKK Jateng |
| Error aplikasi | Tim IT BKK → PT USSI Pinbuk Prima Software |
| Status penjaminan/sertifikat di sisi Jamkrida | Jamkrida, sebutkan nomor rekening kredit |

Panduan bergambar lengkap: *Panduan Pengguna — Integrasi Penjaminan Jamkrida* (30 September 2026).

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 10 Oktober 2026 | | Dokumen dibuat |

---

*[← Kembali ke API Jamkrida Jateng](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
