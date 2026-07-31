# 📄 Business Requirement Document (BRD) — Mobile Branchless

> Dokumen kebutuhan bisnis untuk produk **Mobile Branchless** (**IBS BranchlessPro**) — aplikasi mobile petugas lapangan untuk layanan keuangan *branchless* (tanpa kantor cabang) BPR & koperasi.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | Mobile Branchless   |
| Jenis Dokumen     | Business Requirement Document (BRD) |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 31 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Latar Belakang

**IBS BranchlessPro** adalah **aplikasi mobile petugas** (bukan aplikasi nasabah) yang
memindahkan layanan teller ke lapangan. Petugas BPR/koperasi membawa perangkat Android ke
pasar, ke rumah nasabah, atau ke pos-pos layanan; membuka **kas harian**, melayani
**setoran & penarikan tabungan** serta **angsuran kredit**, mencetak **struk** lewat
printer thermal Bluetooth di tempat, lalu **menutup kas** di akhir hari.

Perbedaan mendasar dengan produk mobile lain di portofolio (mis. `IBS Onboarding Mobile`
yang dipakai nasabah): aplikasi ini dipakai **pegawai yang memegang uang tunai**, sehingga
kebutuhan intinya adalah **akuntabilitas kas**, **jejak audit**, dan **kemampuan bekerja
tanpa sinyal**.

Sinyal di lapangan tidak dapat diandalkan. Karena itu aplikasi dirancang **offline-first**:
data master nasabah diunduh sekali sebagai **berkas SQLite** dari server lembaga, transaksi
ditulis ke **basis data lokal** terlebih dahulu, dan **sinkronisasi berjalan otomatis di
latar belakang** begitu jaringan tersedia. Aplikasi bersifat **multi-lembaga** — satu
aplikasi melayani banyak BPR/koperasi, dengan endpoint API ditentukan dinamis dari
**kode lembaga** yang dimasukkan petugas saat konfigurasi awal.

Dibangun dengan **React Native 0.81 + Expo SDK 54**, **React Navigation 7**, state via
**Zustand**, HTTP via **axios**, basis data lokal **expo-sqlite**, penyimpanan kredensial
**expo-secure-store**. Payload respons dari server **terenkripsi AES (kunci harian)** dan
didekripsi di klien. Distribusi via **EAS Build** (APK internal).

## 2. Tujuan (Business Objectives)

| Kode | Tujuan | Indikator Keberhasilan (KPI) |
|------|--------|------------------------------|
| OBJ-1 | Memperluas jangkauan layanan tanpa menambah kantor cabang. | Transaksi dapat dilayani di lokasi nasabah. |
| OBJ-2 | Memastikan layanan **tetap berjalan saat tidak ada sinyal**. | Setoran & angsuran dapat diselesaikan offline dan tersinkron kemudian. |
| OBJ-3 | Menjaga **akuntabilitas kas petugas** secara harian. | Buka kas, buku kas berjalan, dan tutup kas tercatat tiap hari. |
| OBJ-4 | Mencegah **selisih kas** akibat transaksi belum tersinkron. | Tutup kas ditolak selama masih ada transaksi tertunda. |
| OBJ-5 | Memberi nasabah **bukti transaksi sah** di tempat. | Struk tercetak dari printer thermal saat transaksi selesai. |
| OBJ-6 | Melindungi **data & uang** pada perangkat yang dibawa keluar kantor. | Auto-logout idle, sesi terbatas, data lokal ter-*encode*, lokasi petugas terpantau. |
| OBJ-7 | Melayani **banyak lembaga** dari satu basis kode. | Endpoint & identitas lembaga ditentukan dari kode lembaga. |

## 3. Ruang Lingkup (Scope)

### ✅ In Scope

- **Konfigurasi lembaga** — input kode lembaga → ambil nama, alamat, & base URL API lembaga
  dari server pusat.
- **Autentikasi petugas** — login (password di-hash SHA1), login **biometrik**, opsi
  "ingat saya", sesi 24 jam, **auto-logout idle 5 menit**.
- **Kas harian** — buka kas dengan saldo awal, **buku kas berjalan** (tabel `SaldoKas`),
  tutup kas dengan validasi transaksi tertunda, logout otomatis setelah tutup kas.
- **Transaksi tabungan** — setoran, penarikan (dengan **OTP nasabah** & **otorisasi
  supervisor**), rekening koran, reversal.
- **Transaksi kredit** — angsuran, riwayat, reversal.
- **Data nasabah offline** — unduh basis data master (SQLite) per tanggal, pencarian
  nasabah offline yang **difilter otomatis menurut unit kerja & kode group petugas**.
- **Pemindaian QR** nomor rekening lewat kamera.
- **Sinkronisasi** — otomatis tiap 10 detik saat aplikasi aktif & online, plus layar
  sinkronisasi manual.
- **Cetak struk** — ESC/POS ke printer thermal Bluetooth (58mm & 80mm), fallback ke
  aplikasi **RawBT**, pratinjau sebelum cetak, opsi cetak otomatis.
- **Laporan** — rekap harian, daftar transaksi, cetak ulang struk, **log aktivitas**.
- **Pemantauan petugas** — pengiriman koordinat lokasi tiap 60 detik selama aplikasi aktif.

### ❌ Out of Scope

- **Core Banking & pembukuan akhir** — dimiliki sistem inti (IBS Core); aplikasi hanya
  mengirim transaksi untuk diposting.
- **Persetujuan/otorisasi supervisor** — aplikasi hanya *meminta* dan *mengecek status*;
  keputusan dibuat di sistem back-office.
- **Pembukaan rekening & onboarding nasabah** — dilayani produk `IBS Onboarding Mobile`.
- **Aplikasi untuk nasabah** — produk ini khusus petugas.
- **Pembangkitan berkas SQLite master** — dilakukan sisi server lembaga; aplikasi hanya
  memicu (`/worker/generate-master-nasabah`) dan mengunduh hasilnya.
- **Manajemen pengguna & hak akses** — dikelola di sistem lembaga.

## 4. Stakeholder

| Peran | Nama / Unit | Tanggung Jawab |
|-------|-------------|----------------|
| Sponsor | Manajemen TI BPR / USSI | Menyetujui pengadaan aplikasi layanan lapangan. |
| Business Owner | Unit Operasional / Dana & Kredit BPR | Menetapkan kebijakan kas, limit, & alur otorisasi. |
| Product Owner | Tim Produk USSI | Memprioritaskan fitur aplikasi. |
| Pengguna Utama | **Petugas lapangan / kolektor** BPR & koperasi | Melayani transaksi di lokasi nasabah. |
| Pengguna Pendukung | **Supervisor / Kepala Unit** | Menyetujui permintaan otorisasi transaksi. |
| Penerima Manfaat | Nasabah BPR/koperasi | Menerima layanan & bukti transaksi di tempat. |
| Tim Backend | Tim USSI (API lembaga & pusat) | Menyediakan endpoint sinkronisasi & berkas DB master. |
| Developer / Maintainer | Tim Mobile USSI | Pengembangan & pemeliharaan `Mobile-Branchless`. |

## 5. Kebutuhan Bisnis

| ID | Kebutuhan Bisnis | Prioritas | Catatan |
|----|------------------|-----------|---------|
| BR-001 | Petugas dapat **mengatur lembaga** lewat kode lembaga. | Wajib | `GET /lembaga/kode/{kode}` (API pusat) → simpan `api_url` lembaga. |
| BR-002 | Petugas dapat **login** dengan aman, termasuk **biometrik**. | Wajib | `POST /login`; password di-hash SHA1; sesi 24 jam. |
| BR-003 | Sesi **auto-logout saat idle** 5 menit. | Wajib | Perangkat dibawa keluar kantor — risiko akses tak sah. |
| BR-004 | Petugas **wajib membuka kas** sebelum bertransaksi. | Wajib | Dikunci per tanggal; tanpa buka kas, menu transaksi tidak dapat diakses. |
| BR-005 | Sistem mencatat **buku kas berjalan** tiap transaksi. | Wajib | Tabel `SaldoKas` bersifat *append-only*. |
| BR-006 | **Tutup kas ditolak** bila masih ada transaksi belum tersinkron. | Wajib | Mencegah selisih kas & kehilangan data transaksi. |
| BR-007 | Petugas dapat melayani **setoran tabungan secara offline**. | Wajib | Uang masuk ke petugas — aman ditulis lokal dulu. |
| BR-008 | **Penarikan wajib divalidasi server** sebelum uang diserahkan. | Wajib | Uang keluar & saldo nasabah harus dipastikan mencukupi. |
| BR-009 | Penarikan dapat memerlukan **OTP nasabah** dan/atau **otorisasi supervisor**. | Tinggi | `POST /transaksi/otp-request`, `/transaksi/otorisasi-request`. |
| BR-010 | Petugas dapat melayani **angsuran kredit**. | Wajib | Alur serupa setoran. |
| BR-011 | Petugas dapat melakukan **reversal** transaksi keliru. | Tinggi | Ditandai `isReversal`, bukan dihapus — jejak audit terjaga. |
| BR-012 | Petugas dapat **mencari nasabah tanpa koneksi**. | Wajib | Dari berkas SQLite master yang diunduh. |
| BR-013 | Pencarian nasabah **dibatasi wilayah kerja petugas**. | Wajib | Filter `kode_group1..3` & `kode_kantor` dari profil login. |
| BR-014 | Transaksi tertunda **tersinkron otomatis** saat online. | Wajib | Interval 10 detik + deteksi konektivitas. |
| BR-015 | Nasabah menerima **struk tercetak** sebagai bukti sah. | Wajib | ESC/POS Bluetooth; nomor rekening di-*mask*. |
| BR-016 | Tersedia **jalur cetak cadangan** bila modul printer gagal. | Sedang | Deep link ke aplikasi RawBT. |
| BR-017 | Tersedia **laporan rekap harian & log aktivitas**. | Tinggi | Untuk rekonsiliasi dan audit. |
| BR-018 | **Lokasi petugas** terpantau selama bertugas. | Sedang | `POST /devices/user/location` tiap 60 detik. |
| BR-019 | **Identitas perangkat** dikirim tiap permintaan. | Wajib | Header `X-Device-Id`, `X-Device-Name` (kendali perangkat). |
| BR-020 | Data sensitif di perangkat **tidak tersimpan polos**. | Wajib | Kolom transaksi & nasabah di-*encode* sebelum disimpan. |

## 6. Proses Bisnis

### 6.1 Kondisi Saat Ini (As-Is)

Nasabah harus datang ke kantor untuk menabung, menarik, atau membayar angsuran. Bagi nasabah
mikro di pasar dan pedesaan, ongkos serta waktu perjalanan sering lebih besar daripada
nominal transaksinya, sehingga frekuensi menabung rendah dan angsuran menunggak.

Bila petugas menjemput setoran secara manual, pencatatan memakai **buku/kuitansi kertas**,
lalu diinput ulang di kantor pada sore hari. Akibatnya: rawan salah input, selisih kas baru
ketahuan di akhir hari, bukti bagi nasabah lemah, dan tidak ada jejak digital.

### 6.2 Kondisi Diharapkan (To-Be)

Petugas membuka kas di aplikasi setiap pagi dengan menyatakan saldo awal. Sepanjang hari ia
melayani transaksi langsung di lokasi nasabah — data nasabah dicari dari basis data lokal
sehingga **tidak butuh sinyal**, dan struk dicetak di tempat. Setiap transaksi memperbarui
buku kas secara otomatis. Begitu perangkat mendapat sinyal, transaksi terkirim sendiri ke
server. Di akhir hari petugas menutup kas; sistem **menolak** penutupan bila masih ada
transaksi tertunda, sehingga selisih kas tercegah sejak awal.

```
[Pagi]                    [Lapangan]                        [Sore]
   │                          │                                │
Buka kas ──► saldo awal   Cari nasabah (SQLite lokal)      Tutup kas
   │                          │                                │
   │                     ┌────┴─────┐                    cek transaksi
   │                     │          │                     belum sync
   │              Setoran/Angsuran  Penarikan                  │
   │                     │          │                    ┌─────┴─────┐
   │              tulis lokal   POST /transaksi/penarikan │           │
   │              (isSync=0)        │                  masih ada    bersih
   │                     │      ┌───┴────┐                │           │
   │                     │   sukses   gagal            ✋ ditolak   ✅ tutup
   │                     │      │        │                            │
   │                     │  tulis lokal  batal                    logout
   │                     │  (isSync=1)
   │                     └────┬───┘
   │                     cetak struk (ESC/POS Bluetooth)
   │                          │
   └──────────► sinkronisasi otomatis tiap 10 detik saat online
                POST /transaksi/sync ──► server lembaga ──► Core Banking
```

### 6.3 Alur Konfigurasi Awal (Sekali per Perangkat)

```
[Petugas] ─ input kode lembaga ─► GET /lembaga/kode/{kode} (API pusat)
                                        │
                                  nama, alamat, api_url lembaga
                                        ▼
                                  simpan di SecureStore
                                        │
           ─ unduh DB ──► GET /db/download/{YYMMDD} (API lembaga)
                                        │
                             dbbranchless_YYMMDD.db (master nasabah)
                                        ▼
                                  siap bertransaksi
```

## 7. Asumsi & Batasan

- **Asumsi:**
  - Petugas memakai **perangkat Android** yang disediakan/terdaftar lembaga.
  - Tersedia **printer thermal Bluetooth** (58mm atau 80mm) yang telah dipasangkan.
  - Perangkat mendapat **sinyal setidaknya sesekali** dalam sehari agar sinkronisasi selesai
    sebelum tutup kas.
  - **Server lembaga** menyediakan berkas SQLite master harian dan endpoint sinkronisasi.
  - Skema **enkripsi AES kunci harian** & *encoding* data lokal **identik** dengan backend
    (`BASE_KEY = "IBS-ONBOARD-SECRET-KEY"`).
  - Petugas mengunduh **DB master setiap hari** — berkas bernama per tanggal.
- **Batasan:**
  - Platform **React Native + Expo SDK 54**; **tidak berjalan di Expo Go** (butuh
    *development build* karena modul printer BLE native).
  - Basis data master bersifat **read-only & per tanggal**; data nasabah yang berubah di
    Core baru terlihat setelah unduh ulang.
  - Saldo nasabah yang ditampilkan saat offline adalah **kondisi saat DB diunduh**, bukan
    saldo waktu nyata.
  - **Penarikan tidak dapat dilakukan offline** — memerlukan validasi server.
  - Fitur **kredit sebagian masih memakai data contoh** pada versi saat ini.
  - Distribusi **APK internal**, bukan melalui Play Store.

## 8. Risiko Bisnis

| ID | Risiko | Dampak | Mitigasi |
|----|--------|--------|----------|
| RB-001 | Petugas menutup kas dengan transaksi belum tersinkron | Selisih kas, transaksi hilang | Tutup kas **diblokir** hingga seluruh transaksi tersinkron. |
| RB-002 | Perangkat hilang/dicuri saat membawa data nasabah | Kebocoran data nasabah | Auto-logout idle 5 menit, sesi 24 jam, data lokal ter-*encode*, `deviceId` terdaftar. |
| RB-003 | Penarikan dilayani padahal saldo nasabah tidak cukup | Kerugian lembaga | Penarikan **wajib divalidasi server** sebelum uang diserahkan. |
| RB-004 | Petugas menyalahgunakan uang setoran nasabah | Fraud, kerugian & reputasi | Buku kas berjalan, log aktivitas, struk untuk nasabah, pemantauan lokasi. |
| RB-005 | DB master usang (tidak diunduh ulang) | Nasabah baru tidak ditemukan, data keliru | Nama berkas per tanggal memaksa unduh harian; tombol Unduh DB di layar login. |
| RB-006 | Perangkat tanpa sinyal seharian | Antrean sinkronisasi menumpuk, tutup kas tertahan | Sinkronisasi otomatis saat sinyal kembali + layar sinkronisasi manual. |
| RB-007 | Printer gagal/kehabisan baterai | Nasabah tidak menerima bukti | Fallback **RawBT**; struk dapat dicetak ulang dari daftar transaksi. |
| RB-008 | Transaksi ganda akibat petugas menekan dua kali | Selisih pembukuan | Penjagaan `loading` di tiap handler; `noRef` unik per transaksi. |
| RB-009 | Kunci enkripsi tertanam di dalam APK | Dapat diekstrak dari berkas aplikasi | Setara obfuscation; roadmap: pindahkan rahasia & otorisasi ke sisi server. |
| RB-010 | Beda versi skema enkripsi aplikasi ↔ backend | Login gagal / payload gagal didekripsi | Sinkronkan `keyVersion` & algoritme; uji lintas versi tiap rilis. |
| RB-011 | Reversal disalahgunakan untuk menutupi transaksi | Manipulasi pembukuan | Reversal **menandai**, tidak menghapus; tercatat di log aktivitas. |
| RB-012 | Kredensial "ingat saya" tersimpan polos di perangkat | Akses tak sah bila perangkat dibuka | Utang teknis diketahui; roadmap: hapus penyimpanan password polos. |

## 9. Kriteria Penerimaan (Acceptance Criteria)

- Petugas dapat **mengatur lembaga** dari kode lembaga dan mengunduh **DB master** harian.
- Petugas dapat **login** (biasa & biometrik); sesi berakhir otomatis setelah 24 jam atau
  5 menit tanpa aktivitas.
- Aplikasi **memaksa buka kas** sebelum transaksi hari itu dapat dilakukan.
- **Setoran & angsuran** berhasil diselesaikan **dalam kondisi tanpa sinyal**, tersimpan
  lokal, dan **tersinkron otomatis** saat sinyal kembali.
- **Penarikan gagal ditolak dengan pesan jelas** bila server tidak menyetujui, dan **tidak**
  tersimpan sebagai transaksi lokal.
- Alur **OTP nasabah** dan **otorisasi supervisor** berfungsi untuk penarikan.
- **Pencarian nasabah** berjalan offline dan hanya menampilkan nasabah dalam wilayah kerja
  petugas yang login.
- **Struk tercetak** dari printer Bluetooth dengan nomor rekening ter-*mask*; jalur **RawBT**
  berfungsi sebagai cadangan.
- **Tutup kas ditolak** selama masih ada transaksi belum tersinkron, dan berhasil
  (diikuti logout) ketika seluruh transaksi bersih.
- **Rekap harian & log aktivitas** menampilkan seluruh transaksi hari itu untuk rekonsiliasi.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 31 Juli 2026 | | Dokumen dibuat berdasarkan implementasi repo `Mobile-Branchless` (React Native/Expo SDK 54). |

---

*[← Kembali ke Mobile Branchless](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
