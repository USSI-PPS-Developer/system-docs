# 📐 Software Requirements Specification (SRS) — API Jamkrida Jateng

> Spesifikasi kebutuhan perangkat lunak untuk produk **API Jamkrida Jateng**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | API Jamkrida Jateng     |
| Jenis Dokumen     | Software Requirements Specification (SRS)         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 10 Oktober 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Pendahuluan

### 1.1 Tujuan

Dokumen ini menjabarkan kebutuhan fungsional dan non-fungsional **API Jamkrida Jateng**, service
integrasi penjaminan kredit antara CBS BPR BKK Jateng (IbsJateng) dan Jamkrida Online. Kebutuhan
bisnis yang mendasarinya ada di [BRD](01-brd.md).

### 1.2 Ruang Lingkup Sistem

Service backend (Spring Boot, tanpa UI sendiri) yang:
- dipanggil **CBS** (servlet Java IbsJateng) saat registrasi/realisasi kredit,
- dipanggil **web CBS** (`ptbkkjateng`, PHP) untuk layar dashboard & pemeliharaan Jamkrida,
- memanggil **Jamkrida Online** API untuk seluruh operasi penjaminan,
- dipanggil **Jamkrida** pada satu jalur publik untuk memeriksa status premi.

### 1.3 Definisi & Akronim

| Istilah | Arti |
|---------|------|
| CBS | Core Banking System IbsJateng (servlet Java, Jetty) |
| Web CBS | Aplikasi web `ptbkkjateng` (PHP/CodeIgniter) |
| IJP | Imbal Jasa Penjaminan; `ijp_gross`, `diskon`, `ijp_net` |
| Premi | Nilai yang dipotong dari debitur saat realisasi untuk membayar IJP |
| SPAJ | Surat Pengajuan Asuransi Jiwa — 4 pertanyaan kesehatan + deskripsi |
| Bundling | Produk penjaminan + asuransi jiwa CAR, dikirim lewat `/addbundling` |
| CAR | PT Asuransi CAR, penanggung jiwa produk bundling |
| Rekon | Rekonsiliasi IJP Jamkrida vs premi di tiga sumber pembukuan |
| `premitrans` | Ledger premi CBS. `my_kode_trans=101` beban premi, `201` setoran premi |
| PENDING BUNDLING | Status bundling yang menunggu keputusan CAR |
| Kantor piloting | Kantor yang diizinkan membuat penjaminan baru |

### 1.4 Referensi

- PRD Integrasi & Renewal API Jamkrida Jateng v1.1
- Dokumentasi API Jamkrida Jateng — POJK11 non-bundling & bundling CAR (September 2026, termasuk revisi)
- API Contract — Cek Status Pembayaran Premi (BKK Jateng ke Jamkrida) v1.1
- Daftar Pertanyaan & Temuan Integrasi — BKK Jateng ke Jamkrida (30-09-2026)
- [API Contract](03-api-contract.md) · [Desain Database](04-database-design.md)

## 2. Deskripsi Umum

### 2.1 Perspektif Produk

```
CBS IbsJateng (Jetty)              Web CBS ptbkkjateng (PHP)
  │ registrasi/realisasi             │ dashboard, mapping, piloting,
  │ (apiconn 020201, 020207)         │ master data, audit log
  ▼                                  ▼
┌───────────────────────────────────────────────┐         Jamkrida Online
│ API Jamkrida Jateng (Spring Boot 3, :8087)    │──────►  /authenticate /cekijp /add
│ context-path /api-jamkrida                    │         /addbundling /statusbundling
│  ├ JamkridaApiClient (token, retry, audit)    │         /no_rekening/{no} /bayarijp
│  ├ AuditRecorder (async, masking)             │         /linksertifikat /produk ...
│  └ Scheduler sinkronisasi referensi (01:15)   │
└───────────────┬───────────────────┬───────────┘
                │                   │            ◄── Jamkrida: GET /publik/premi/status
     DB primary bkkjateng   DB sys bkkjateng_sys
     (jamkrida_*, premitrans,   (read-only: nama user
      kredit, kretrans, ...)     untuk audit log)
```

### 2.2 Fungsi Utama Produk

1. Estimasi IJP dan penyaringan produk Jamkrida sesuai pemetaan type kredit.
2. Pembentukan data penjaminan + pembebanan premi saat realisasi.
3. Rekonsiliasi premi dan penguncian pengiriman.
4. Pengiriman data penjaminan (non-bundling/bundling) beserta berkas pendukung.
5. Cek status kepesertaan & status bundling.
6. Tanda bayar premi, laporan bayar IJP, riwayat pembayaran.
7. Sertifikat (tautan, proksi PDF, multi-berkas).
8. Master data, pemetaan produk, kantor piloting.
9. Audit log & jalur publik status premi.

### 2.3 Karakteristik Pengguna

| Pengguna | Lewat | Kebutuhan |
|----------|-------|-----------|
| Admin kredit cabang | Layar CBS | Cek IJP, rekon, kirim, cek status, bayar IJP, sertifikat |
| Teller / back office | Layar CBS | Setoran premi (dibaca service), tanda bayar kolektif |
| Admin pusat (`user_code=4`) | Layar CBS | Akses lintas kantor |
| Tim IT BKK | Layar CBS | Mapping produk, kantor piloting, master data, audit log |
| Sistem CBS | HTTP internal | `/kredit/cek-ijp`, `/kredit/realisasi` |
| Sistem Jamkrida | HTTPS publik | `/publik/premi/status` |

### 2.4 Batasan & Asumsi

- Java 17, Spring Boot 3, MySQL Connector/J; DB server MySQL 5.5.
- `spring.jpa.hibernate.ddl-auto=none`; autoconfig Flyway dimatikan, migrasi hanya lewat
  `JamkridaSchemaMigrator` (riwayat di `jamkrida_schema_history`) bila `app.migration.enabled=true`.
- Kolom `created_at`/`updated_at` diisi aplikasi (`@PrePersist`/`@PreUpdate`).
- Zona waktu `Asia/Jakarta` di JVM, Hibernate, dan container.
- Tidak ada modul user sendiri; identitas dari header `X-User-Id`, `X-Kode-Kantor`.

## 3. Kebutuhan Fungsional

| Kode | Kebutuhan | Endpoint | Prioritas |
|------|-----------|----------|-----------|
| FR-001 | Estimasi IJP — meneruskan payload `/add` ke `/cekijp` dan mengembalikan `ijp_gross`, `diskon`, `ijp_net`, usia | `POST /kredit/cek-ijp` | Tinggi |
| FR-002 | Realisasi — membentuk `jamkrida_trans` (status 0), membukukan premi 101 ke `premitrans`, menyimpan payload untuk kirim ulang | `POST /kredit/realisasi` | Tinggi |
| FR-003 | Daftar penjaminan dengan filter (`cari`, `status_kirim`, `kode_kantor`, `cabang`, `no_rekening`, rentang tanggal), paginasi | `GET /jamkrida/trans` | Tinggi |
| FR-004 | Detail penjaminan & payload kirim | `GET /jamkrida/trans/{id}`, `/{id}/payload` | Tinggi |
| FR-005 | Rekonsiliasi premi 3 sumber | `POST /jamkrida/trans/{id}/premi` | Tinggi |
| FR-006 | Kirim ke Jamkrida (`/add` atau `/addbundling`) | `POST /jamkrida/trans/{id}/send` | Tinggi |
| FR-007 | Berkas pendukung bundling (unggah, daftar, hapus) | `/jamkrida/trans/{id}/berkas` | Tinggi |
| FR-008 | Cek status (detail + `/statusbundling` untuk bundling) | `POST /jamkrida/trans/{id}/cek-status`, `GET /{no_rekening}/detail` | Tinggi |
| FR-009 | Tanda bayar premi & pencabutannya | `POST /{id}/flag-premi`, `/{id}/flag-premi/batal` | Sedang |
| FR-010 | Data setoran premi untuk mengisi form Bayar IJP | `GET /{id}/premi-bayar` | Sedang |
| FR-011 | Bayar IJP & riwayatnya | `POST /{id}/bayar-ijp`, `GET /{id}/pembayaran` | Tinggi |
| FR-012 | Sertifikat: daftar berkas, proksi PDF, ambil ulang tautan | `GET /{id}/sertifikat/daftar`, `GET /{id}/sertifikat`, `POST /{no_rekening}/link-sertifikat` | Tinggi |
| FR-013 | Master data: per tipe, ringkasan, sinkron manual; sinkron otomatis terjadwal | `/jamkrida/referensi/**` | Sedang |
| FR-014 | Pemetaan type kredit → produk Jamkrida (CRUD) | `/jamkrida/produk-mapping/**` | Tinggi |
| FR-015 | Kantor piloting (daftar, cek izin, aktif/nonaktif, hapus) | `/jamkrida/kantor-pilot/**` | Tinggi |
| FR-016 | Audit log: cari, daftar endpoint, detail + payload | `/jamkrida/audit-log/**` | Tinggi |
| FR-017 | Status premi untuk Jamkrida | `GET /publik/premi/status` | Tinggi |
| FR-018 | Manajemen token Jamkrida (cache, refresh sebelum kedaluwarsa, authenticate ulang saat ditolak) | internal | Tinggi |

### Detail FR-002 (Realisasi)

- **Pemicu:** CBS setelah `addTransRealisasi` sukses (`HandlerTransKredit`, apiconn `020207`)
  mengirim titipan SPAJ dari `jamkrida_spaj_draft`; draft dihapus CBS setelah sukses.
- **Validasi:** `payload` wajib; kantor harus diizinkan piloting.
- **Proses:** simpan `jamkrida_trans` (`status_kirim=0`, NIK hanya ter-mask di kolom
  `no_identitas_masked`, payload lengkap di `request_payload`), tentukan flag `bundling`
  (flag dari CBS → pemetaan lokal → `meta_json` referensi), bukukan `premitrans`:
  `kode_asuransi=001`, `kode_trans=101`, `my_kode_trans=101`, `nominal=ijp_net`, keterangan
  `Premi IJP Jamkrida No Rekening … a.n …` (maks 255 karakter), `id` dari `AUTO_INCREMENT`.
- **Gagal bukukan premi** dicatat di `premitrans_error` tanpa membatalkan penjaminan.
- Bila titipan tidak ada (rekening lama / non-Jamkrida), CBS melewati langkah ini dan realisasi tetap sukses.

### Detail FR-005 (Rekonsiliasi premi)

- Sumber IJP: `/cekijp` bila belum dikirim; `/no_rekening/{no}` (detail) bila sertifikat sudah
  terbit. Disebut di `sumber_ijp`.
- Dibandingkan dengan `premitrans.nominal` (101), `kredit.premi`, `kretrans.premi`
  (`my_kode_trans=100`).
- Semua sama → `premi_rekon_at` & `premi_rekon_ijp` diisi, `boleh_kirim=true`.
  Ada beda → `premi_rekon_at` dikosongkan, `beda_di` menyebut sumbernya.
- Flag `bundling` dihitung ulang dari pemetaan setiap rekon.
- Payload Cek IJP yang tidak lengkap ditolak (bukan dianggap cocok).

### Detail FR-006 (Kirim)

1. Penjaminan harus milik kantor piloting dan belum terkirim (`status_kirim≠1`, else `409`).
2. `premi_rekon_at` harus terisi; field penentu IJP (produk, tenor, nilai pinjaman, tanggal lahir,
   score1–4) yang berbeda dari saat rekon → rekon direset dan kirim ditolak dengan nama field.
3. Bundling: `pekerjaan`, `sumber_penghasilan` (1 Gaji/2 Usaha), dan berkas KTP/SPAJ/RIPLAY wajib —
   diperiksa **sebelum** baris diklaim.
4. Baris diklaim lewat satu `UPDATE` atomik (idempotensi) → kirim `/add` (JSON) atau
   `/addbundling` (`multipart/form-data`).
5. Sukses → `status_kirim=1`, `kirim_at`, nomor & tanggal sertifikat, status kepesertaan, IJP.
   Kalimat penanda (`PENDING BUNDLING`, `Cek statusbundling`) **tidak pernah** disimpan sebagai nomor
   sertifikat. Gagal → `status_kirim=2`, `kirim_attempt++`, `kirim_last_error`.

### Detail FR-008 (Cek status)

- Non-bundling: `GET /no_rekening/{no_rekening}`.
- Bundling: `/no_rekening` untuk data deskriptif + `POST /statusbundling` untuk status & nomor
  sertifikat (`no_sertifikat_jamkrida`, `no_sertifikat_bundling`). Kegagalan `/statusbundling` tidak
  menggagalkan pengecekan; keterangan menyebut status bundling tidak terbaca.
- Nomor sertifikat & `status_cek_at` diperbarui; respons membawa `status_sebelumnya`,
  `sertifikat_terbit`, `sertifikat_pending`, dan `detail` mentah dari Jamkrida.

### Detail FR-009 (Tanda bayar premi)

| Keadaan | `jamkrida_premi_mutasi` | `premi_dibayar_at` | Terbaca Jamkrida |
|---------|------------------------|--------------------|------------------|
| Belum apa-apa | tidak ada | NULL | belum dibayar |
| Ditandai | status 1, `premitrans_id` NULL, `flag_at` terisi | NULL (tetap di daftar setoran) | sudah dibayar |
| Disetor (CBS 020252) | baris yang sama dilengkapi `premitrans_id`, kuitansi, tanggal, nominal | terisi | sudah dibayar |
| Tanda dicabut | status 0 | NULL | belum dibayar |

Menandai ulang aman (idempotent). Penandaan ditolak bila status bundling masih menunggu CAR, atau
tidak ada saldo premi yang belum disetor (101 − 201 ≤ 0). Pencabutan ditolak bila IJP sudah
dilaporkan atau setoran sudah menyusul.

### Detail FR-011 (Bayar IJP)

- `/bayarijp` **melaporkan** transfer yang sudah terjadi; tidak membuat jurnal.
- Syarat: sudah terkirim, punya `no_sertifikat` final, premi sudah disetor/ditandai, dan belum ada
  pembayaran sukses.
- Wajib: `no_referensi_pembayaran`, `tgl_referensi_pembayaran` (ISO `yyyy-mm-dd`),
  `deskripsi_pembayaran`, `nilai_hf` (0 bila tidak ada). `nilai_ijp` kosong → pakai `ijp_net`.
- Rekening tujuan default dari konfigurasi `app.jamkrida.penjaminan.*`; form boleh menimpa. Kosong di
  keduanya → ditolak menyebut properti yang belum diisi.
- Setiap percobaan dicatat di `jamkrida_pembayaran_ijp` (`success`/`failed` + `error_message`);
  sukses mengisi `jamkrida_trans.ijp_dibayar_at` & `ijp_no_referensi`.

### Detail FR-012 (Sertifikat)

- Tautan selalu diminta ulang lewat `/linksertifikat`; tautan kembar dibuang (non-bundling mengirim
  `url_sertifikat1..4` yang identik). Bundling: `url_sertifikat1` + `url_sertifikat_car`.
- Proksi memeriksa isi diawali `%PDF` (Jamkrida membalas HTML 200 saat tautan kedaluwarsa), lalu
  menyajikan `application/pdf` inline (atau attachment bila `unduh=true`) dengan
  `Cache-Control: no-store` dan nama berkas = nomor sertifikat (`…-jiwa.pdf` untuk CAR).

### Detail FR-017 (Status premi publik)

- Hanya menerima `X-Api-Key` = `app.security.inbound-key`; kunci CBS ditolak di jalur ini.
- Kunci pencarian: `no_sertifikat` → `no_pinjaman` → `no_rekening`.
- Sumber hanya `jamkrida_premi_mutasi` (status 1). Tidak ditemukan / belum dibayar →
  `00` + `sudah_dibayar=false`.

## 4. Kebutuhan Non-Fungsional

| Kode | Kategori | Kebutuhan |
|------|----------|-----------|
| NFR-001 | Keamanan | Dua kunci `X-Api-Key` terpisah: `api-key` (CBS/web, semua kecuali `/publik/**`) dan `inbound-key` (Jamkrida, hanya `/publik/**`). Reverse proxy hanya membuka `/publik/**`. |
| NFR-002 | Keamanan | Kredensial DB, akun Jamkrida, kunci API, rekening penjaminan di `config/application-secret.yml` / env var; tidak ada di repo. |
| NFR-003 | Privasi | Audit log: `password`→`***`, `token`→8 karakter terakhir, `no_identitas`/`nama_ibu` ter-mask, `q2_desc`,`q3_desc`,`q4_desc`,`q5b_desc`→`[REDACTED]`. Isi berkas tidak dicatat (hanya nama part, nama berkas, ukuran). |
| NFR-004 | Audit | Setiap panggilan Jamkrida (sukses/HTTP error/timeout) tercatat dengan `trace_id`, latensi, aktor, kantor; ditulis async. Payload dipotong maks 60.000 karakter. |
| NFR-005 | Ketahanan | Connect timeout 10 dtk, read timeout 60 dtk; token di-refresh bila sisa < 1 jam; HTTP 401/403 **atau** penolakan token pada HTTP 200 memicu authenticate ulang sekali. |
| NFR-006 | Integritas | Kirim idempoten (klaim atomik). Pembayaran IJP sukses maksimum satu per penjaminan. |
| NFR-007 | Kompatibilitas | DDL kompatibel MySQL 5.5 dan idempotent (`IF NOT EXISTS`, cek `information_schema` + `PREPARE`). |
| NFR-008 | Pelaporan error | Envelope seragam; 404/405/400 body tak terbaca/406 dilaporkan `07` dengan penyebab, bukan `01` generik. Error Jamkrida `09` membawa `trace_id`. |
| NFR-009 | Operasional | Health di `/actuator/health`; Swagger di `/docs`; log stdout dengan rotasi container. |
| NFR-010 | Ukuran berkas | Maks 5 MB per berkas, 20 MB per request multipart. |

## 5. Use Case Utama

| ID | Use Case | Aktor | Ringkasan |
|----|----------|-------|-----------|
| UC-01 | Hitung IJP saat registrasi | Admin kredit, CBS | Pilih produk sesuai pemetaan → Hitung IJP → Gunakan ke Premi |
| UC-02 | Realisasi kredit berpenjaminan | CBS | Titipan SPAJ → `jamkrida_trans` + `premitrans` 101 |
| UC-03 | Rekon & kirim non-bundling | Admin kredit | Get IJP/Premi → Kirim → sertifikat terbit |
| UC-04 | Kirim bundling | Admin kredit | Lengkapi data & berkas → `/addbundling` → PENDING → Cek Status |
| UC-05 | Setor/tanda bayar premi | Teller | Kode 201 (CBS) atau tanda bayar → setoran kolektif |
| UC-06 | Bayar IJP | Admin kredit | Form terisi otomatis → `/bayarijp` |
| UC-07 | Lihat/unduh sertifikat | Admin kredit | Proksi PDF, 2 tab untuk bundling |
| UC-08 | Cek status premi | Jamkrida | `GET /publik/premi/status` sebelum cetak |
| UC-09 | Kelola piloting & pemetaan | Tim IT BKK | Layar Kantor Piloting / Mapping Produk |
| UC-10 | Telusuri kegagalan | Tim IT / admin | Audit Log Jamkrida |

## 6. Antarmuka Eksternal

| Sistem | Arah | Protokol | Keterangan |
|--------|------|----------|------------|
| Jamkrida Online (dev) | keluar | HTTPS JSON/multipart, header `Token` | `https://jamkrida-online.co.id/devapi/v3/public` |
| Jamkrida Online (prod) | keluar | idem | `https://jamkrida-online.co.id/api/ussi/public` |
| CBS IbsJateng | masuk | HTTP JSON, `X-Api-Key` (CBS) | Base URL dari `sys_mysysid.KRE_JAMKRIDA_API_URL`, kunci dari `KRE_JAMKRIDA_API_KEY` |
| Web CBS | masuk | HTTP JSON/PDF, `X-Api-Key` (CBS) | `.env` web: `URL_JAMKRIDA`, `JAMKRIDA_API_KEY` |
| Jamkrida (inbound) | masuk | HTTPS JSON, `X-Api-Key` (Jamkrida) | Hanya `/publik/**` |
| MySQL `bkkjateng` | — | JDBC | Read-write |
| MySQL `bkkjateng_sys` | — | JDBC | Read-only |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 10 Oktober 2026 | | Dokumen dibuat |

---

*[← Kembali ke API Jamkrida Jateng](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
