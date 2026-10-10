# 📄 Business Requirement Document (BRD) — API Jamkrida Jateng

> Dokumen kebutuhan bisnis untuk produk **API Jamkrida Jateng**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | API Jamkrida Jateng     |
| Jenis Dokumen     | Business Requirement Document (BRD)         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 10 Oktober 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Latar Belakang

PT BPR BKK Jateng (Perseroda) menjaminkan sebagian kreditnya ke **PT Jamkrida Jateng** (Jaminan
Kredit Daerah). Setiap kredit yang dijaminkan dikenai **IJP (Imbal Jasa Penjaminan)**, yang dipungut
dari debitur sebagai premi saat realisasi kredit, lalu disetor dan dilaporkan ke Jamkrida sampai
**sertifikat penjaminan** terbit.

Sebelum produk ini ada, alur penjaminan di Core Banking (CBS IbsJateng) berjalan dengan pola:

- Saat realisasi kredit, CBS melakukan `INSERT` langsung ke tabel datar `kre_jamkrida`
  (`CHARSET=latin1`), tanpa pemisahan antara data registrasi, premi, pembayaran, dan sertifikat.
- Tidak ada pencatatan atas setiap pemanggilan ke Jamkrida Online, sehingga kegagalan kirim,
  sengketa nilai IJP, atau permintaan audit dari Jamkrida/OJK sulit ditelusuri.
- Tidak ada jaminan bahwa **premi yang dipotong dari debitur sama dengan IJP yang dihitung
  Jamkrida** — selisih baru ketahuan setelah sertifikat terbit.
- Produk **bundling** (penjaminan + asuransi jiwa dari CAR) tidak didukung sama sekali.

Dibutuhkan sebuah **service integrasi** yang berdiri di samping CBS dan menjadi **satu-satunya
pintu** komunikasi ke Jamkrida Online — lengkap dengan audit log per pemanggilan, rekonsiliasi
premi sebelum kirim, dukungan bundling, dan jalur baca terbatas bagi Jamkrida untuk memastikan
premi sudah disetor sebelum mencetak sertifikat.

## 2. Tujuan (Business Objectives)

| Kode | Tujuan | Indikator Keberhasilan (KPI) |
|------|--------|------------------------------|
| OBJ-1 | Menyediakan **satu pintu integrasi** CBS ↔ Jamkrida Online. | 100% panggilan ke Jamkrida lewat service ini; tidak ada panggilan langsung dari CBS/web. |
| OBJ-2 | Menjamin **premi yang dipungut = IJP Jamkrida** sebelum data dikirim. | 0 penjaminan terkirim dengan premi tidak cocok di ketiga sumber pembukuan. |
| OBJ-3 | Menyediakan **jejak audit** seluruh komunikasi dengan Jamkrida. | 100% panggilan (sukses, gagal, timeout) tercatat di `jamkrida_audit_log` dengan data pribadi ter-mask. |
| OBJ-4 | Mendukung produk **bundling** (penjaminan + jiwa CAR) end-to-end. | Bundling terkirim lewat `/addbundling` beserta 3 berkas pendukung; dua sertifikat dapat diunduh. |
| OBJ-5 | Memastikan **urutan proses tidak bisa dibalik** (rekon → kirim → setor premi → bayar IJP). | 0 laporan bayar IJP ke Jamkrida sebelum premi benar-benar disetor di CBS. |
| OBJ-6 | Memberi Jamkrida **bukti setor premi** tanpa membuka rekening koran CBS. | Jamkrida dapat mengecek status premi via `/publik/premi/status`; tidak ada saldo/mutasi rekening yang terekspos. |
| OBJ-7 | Peluncuran **bertahap per kantor** (piloting). | Hanya kantor terdaftar yang dapat membuat penjaminan baru; perluasan tanpa rilis ulang. |

## 3. Ruang Lingkup (Scope)

### ✅ In Scope
- **Estimasi IJP** saat registrasi kredit (`/cekijp`), dengan daftar produk Jamkrida yang disaring
  sesuai **pemetaan type kredit → produk Jamkrida**.
- **Penitipan data SPAJ** saat registrasi dan pembentukan data penjaminan (`jamkrida_trans`) saat
  realisasi kredit, sekaligus **pembebanan premi** ke ledger `premitrans`.
- **Rekonsiliasi premi**: IJP Jamkrida dibandingkan dengan premi di `premitrans`, `kredit.premi`, dan
  `kretrans.premi`; pengiriman dikunci sampai cocok.
- **Pengiriman data penjaminan** ke Jamkrida: `/add` (non-bundling, JSON) dan `/addbundling`
  (bundling, multipart + berkas KTP/SPAJ/RIPLAY).
- **Cek status** kepesertaan (`/no_rekening/{no_rekening}`) dan status bundling (`/statusbundling`).
- **Tanda bayar premi** sebelum setoran kolektif, dan pencabutannya.
- **Laporan pembayaran IJP** ke Jamkrida (`/bayarijp`) dengan pengisian otomatis dari setoran premi CBS.
- **Sertifikat**: ambil tautan (`/linksertifikat`), proksi PDF untuk pratinjau/unduh, dukungan dua
  sertifikat pada bundling.
- **Master data Jamkrida** (produk, jenis agunan, sektor usaha, cabang, pekerjaan): sinkronisasi
  harian + manual, layar telusur.
- **Pemeliharaan**: pemetaan produk, daftar kantor piloting.
- **Audit log** seluruh pemanggilan ke Jamkrida + layar telusur.
- **Jalur publik** untuk Jamkrida: `GET /publik/premi/status`.

### ❌ Out of Scope
- Modul login/user sendiri — otorisasi tetap milik CBS (identitas dikirim lewat header).
- Proses registrasi & keputusan approval kredit itu sendiri.
- Transaksi **setoran premi** ke rekening Jamkrida (kode 201) beserta jurnalnya — dikerjakan CBS
  (`HandlerTransPremiKredit`, apiconn `020252`); service ini hanya membaca hasilnya.
- **Pembatalan penjaminan** — belum tersedia di API Jamkrida yang didokumentasikan.
- Jurnal akunting pendamping pembebanan premi & pembayaran IJP (lihat §8 RB-005).
- Migrasi data historis `kre_jamkrida` (± 79 ribu baris) ke skema baru.
- Desain UI layar CBS — layar dashboard berada di aplikasi web CBS (`ptbkkjateng`) dan
  didokumentasikan di repo tersebut.

## 4. Stakeholder

| Pihak | Peran | Kepentingan |
|-------|-------|-------------|
| PT BPR BKK Jateng — Divisi Kredit | Business owner | Penjaminan kredit tertib, premi tepat, sertifikat terbit |
| Admin kredit / petugas cabang | Pengguna harian | Cek IJP, kirim data, bayar IJP, unduh sertifikat |
| Teller / back office | Pengguna | Setoran premi (kode 201), termasuk kolektif |
| Tim IT BKK Jateng | Operator | Kantor piloting, pemetaan produk, pemantauan audit log |
| PT Jamkrida Jateng | Mitra penjamin | Menerima data penjaminan & laporan IJP; memeriksa status premi |
| PT Asuransi CAR | Penanggung jiwa (bundling) | Memutuskan persetujuan pertanggungan jiwa |
| PT USSI Pinbuk Prima Software | Pengembang | Membangun & memelihara service + perubahan CBS |
| Compliance / Audit internal | Pengawas | Jejak audit, perlindungan data pribadi (NIK, data kesehatan) |

## 5. Kebutuhan Bisnis

| Kode | Kebutuhan | Prioritas |
|------|-----------|-----------|
| BR-001 | IJP wajib dihitung Jamkrida (`/cekijp`) saat registrasi; registrasi kredit berasuransi Jamkrida tidak bisa disimpan sebelum Cek IJP. | Tinggi |
| BR-002 | Produk Jamkrida yang boleh dipilih ditentukan **pemetaan type kredit** yang disepakati BPR–Jamkrida, bukan dipilih bebas. Type kredit tanpa pemetaan = daftar produk kosong. | Tinggi |
| BR-003 | Data SPAJ & scoring dari form registrasi dititipkan, dan data penjaminan baru dibentuk saat **realisasi** (titik data final). Rekening yang batal sebelum realisasi tidak menghasilkan penjaminan. | Tinggi |
| BR-004 | Premi dibebankan ke `premitrans` (`my_kode_trans=101`) saat realisasi senilai IJP hasil `cekijp`. | Tinggi |
| BR-005 | Data **tidak boleh dikirim** ke Jamkrida sebelum rekon premi cocok di ketiga sumber (`premitrans`, `kredit.premi`, `kretrans.premi`). Rekon wajib diulang tiap kali sebelum kirim. | Tinggi |
| BR-006 | Field penentu IJP (produk, tenor, nilai pinjaman, tanggal lahir, score) **dikunci** saat kirim; perubahan membatalkan rekon. | Tinggi |
| BR-007 | Satu penjaminan hanya boleh terkirim **sekali** walaupun tombol diklik bersamaan. | Tinggi |
| BR-008 | Produk bundling dikirim lewat `/addbundling` dan wajib melengkapi pekerjaan, sumber penghasilan, serta berkas KTP, SPAJ, RIPLAY (maks 5 MB/berkas). Tidak ada jalur turun ke `/add` untuk produk bundling. | Tinggi |
| BR-009 | Selama status bundling **PENDING BUNDLING**, premi tidak boleh disetor. | Tinggi |
| BR-010 | Laporan **Bayar IJP** ke Jamkrida hanya boleh setelah premi disetor (atau ditandai dibayar sesuai PKS). Pembayaran sukses kedua ditolak; percobaan gagal tetap dicatat. | Tinggi |
| BR-011 | Premi boleh **ditandai dibayar** sebelum setoran kolektif sore hari (kesepakatan PKS); tanda dapat dicabut selama IJP belum dilaporkan. | Sedang |
| BR-012 | Jamkrida dapat memeriksa status pembayaran premi via jalur publik, tanpa melihat saldo/rekening koran/jurnal. "Belum dibayar" adalah jawaban sah (`00`), bukan error. | Tinggi |
| BR-013 | Setiap pemanggilan ke Jamkrida tercatat di audit log dengan NIK ter-mask, password/token tersamar, data kesehatan ter-redact. | Tinggi |
| BR-014 | Integrasi digelar bertahap: hanya kantor dalam daftar piloting yang dapat membuat penjaminan baru. Mencabut izin tidak menghapus penjaminan yang sudah ada. ⚠️ *Perlu keputusan:* README service menyatakan penyelesaiannya tetap boleh, tetapi implementasi saat ini juga menolak kirim, tanda bayar, dan bayar IJP untuk kantor yang dinonaktifkan. | Tinggi |
| BR-015 | Sertifikat selalu diambil dengan tautan baru (tautan Jamkrida dapat kedaluwarsa); bundling menghasilkan dua sertifikat (penjaminan Jamkrida + jiwa CAR). | Sedang |
| BR-016 | Master data Jamkrida tersinkron otomatis tiap hari; layar telusurnya hanya-baca. | Sedang |
| BR-017 | Kunci API CBS dan kunci Jamkrida **terpisah**; hanya `/publik/**` yang boleh terbuka dari internet. | Tinggi |

## 6. Proses Bisnis

### 6.1 Kondisi Saat Ini (As-Is)

1. Admin kredit registrasi kredit dan memilih asuransi Jamkrida; nilai premi dapat diketik manual.
2. Saat realisasi, CBS `INSERT` ke `kre_jamkrida`.
3. Pengiriman ke Jamkrida lewat service lama tanpa audit log; tidak ada rekonsiliasi premi.
4. Pembayaran IJP & sertifikat ditangani terpisah, tanpa penguncian urutan.

### 6.2 Kondisi Diharapkan (To-Be)

```
Registrasi kredit ──(Cek IJP)──► titipan SPAJ (jamkrida_spaj_draft)
        │
Realisasi kredit ──► jamkrida_trans (Belum Kirim) + premitrans 101 (beban premi)
        │
Get IJP/Premi (rekon 3 sumber) ── tidak cocok ─► kirim dikunci
        │ cocok
Kirim ke Jamkrida ── non-bundling: /add ──► sertifikat terbit
        │          └ bundling: /addbundling ──► PENDING BUNDLING ──(Cek Status)──► APPROVED
        │
Setor premi kode 201 (CBS, 3 set jurnal) ── atau ── tanda bayar → setoran kolektif
        │
Bayar IJP (/bayarijp) ──► Status Bayar = Sudah
        │
Sertifikat (pratinjau/unduh; bundling 2 berkas)

Jamkrida ──GET /publik/premi/status──► sudah_dibayar? → cetak sertifikat
```

## 7. Asumsi & Batasan

- Service berbagi database dengan CBS: primary `bkkjateng` (data bisnis + `jamkrida_*`), secondary
  `bkkjateng_sys` (read-only, nama pengguna untuk audit log).
- Server database **MySQL 5.5** — DDL harus kompatibel (tanpa `DATETIME DEFAULT CURRENT_TIMESTAMP`,
  tanpa `ADD INDEX IF NOT EXISTS`).
- DDL tabel `jamkrida_*` boleh dijalankan DBA atau oleh service (Flyway terbatas); tabel CBS tidak
  pernah diubah oleh service.
- Login & hak akses milik CBS; service mempercayai header `X-User-Id`/`X-Kode-Kantor` dari CBS di
  jaringan internal yang dilindungi `X-Api-Key`.
- Sebagian perilaku Jamkrida diketahui dari percakapan, bukan dokumen (mis. `/statusbundling`, nama
  field `pekerjaan`).
- Rekening tabungan Jamkrida untuk setoran premi berada di satu kantor (saat ini `001`).

## 8. Risiko Bisnis

| Kode | Risiko | Dampak | Mitigasi |
|------|--------|--------|----------|
| RB-001 | Premi dipotong tidak sama dengan IJP Jamkrida | Sengketa nilai, koreksi jurnal | Rekon 3 sumber wajib sebelum kirim; field penentu IJP dikunci |
| RB-002 | Data debitur salah terkirim | Sertifikat salah, tidak bisa dibatalkan lewat sistem | Modal tinjau sebelum kirim; peringatan di panduan pengguna |
| RB-003 | **CAR menolak** penjaminan bundling setelah premi terpotong | Perlakuan uang debitur belum jelas | Setoran premi dikunci selama PENDING; perlakuan penolakan **masih menunggu jawaban Jamkrida** |
| RB-004 | Status akhir `PENDING BUNDLING` belum pernah teramati | Perilaku setelah persetujuan/penolakan belum teruji di produksi | Cek status manual; daftar nilai `status_pengajuan` diminta ke Jamkrida |
| RB-005 | Pembebanan premi & pembayaran IJP belum dijurnal | Pencatatan akuntansi tidak lengkap | Dicatat sebagai pekerjaan lanjutan |
| RB-006 | Payload `jamkrida_trans.request_payload` & `jamkrida_spaj_draft.payload` menyimpan NIK dan jawaban kesehatan apa adanya | Paparan data pribadi | Akses DB terbatas; kebijakan retensi/enkripsi menunggu keputusan compliance |
| RB-007 | Profil `prod` terlewat → penjaminan produksi terkirim ke `devapi` Jamkrida | Penjaminan tidak sah | Skrip deploy produksi menolak jalan bila `APP_PROFILE≠prod`; audit log diperiksa setelah transaksi pertama |
| RB-008 | Timeout saat setoran kolektif | Setoran ganda bila diulang | Perulangan berhenti di transaksi timeout; status diperiksa sebelum diulang |
| RB-009 | Kunci API bocor | Akses tidak sah | Dua kunci terpisah; reverse proxy hanya membuka `/publik/**` |

## 9. Kriteria Penerimaan (Acceptance Criteria)

- [ ] Registrasi kredit berasuransi Jamkrida tidak dapat disimpan sebelum Cek IJP.
- [ ] Daftar produk di modal Cek IJP sesuai pemetaan type kredit; type tanpa pemetaan menampilkan daftar kosong + peringatan.
- [ ] Realisasi kredit di kantor piloting membentuk `jamkrida_trans` (Belum Kirim) dan `premitrans` 101; titipan SPAJ terhapus.
- [ ] Realisasi di kantor non-piloting tidak membentuk penjaminan.
- [ ] Kirim ditolak bila rekon belum/tidak cocok; menyebut sumber yang berbeda.
- [ ] Dua klik kirim bersamaan hanya menghasilkan satu `/add`.
- [ ] Bundling: kirim ditolak bila pekerjaan/sumber penghasilan/berkas kurang, dengan pesan yang menyebut kekurangannya.
- [ ] Bundling PENDING: setoran premi ditolak; Cek Status memperbarui nomor sertifikat setelah disetujui.
- [ ] Bayar IJP ditolak sebelum premi disetor/ditandai; pembayaran sukses kedua ditolak.
- [ ] `/publik/premi/status` menjawab `sudah_dibayar` dengan benar dan hanya menerima kunci Jamkrida.
- [ ] Audit log mencatat seluruh panggilan dengan field sensitif ter-mask.
- [ ] Sertifikat dapat dipratinjau & diunduh; bundling menampilkan dua tab.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 10 Oktober 2026 | | Dokumen dibuat dari PRD v1.1, README service, dan hasil rilis produksi pertama (01-10-2026). |

---

*[← Kembali ke API Jamkrida Jateng](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
