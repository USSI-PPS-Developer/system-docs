# 📄 Business Requirement Document (BRD) — Host 2 Host

> Dokumen kebutuhan bisnis untuk produk **Host 2 Host**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | Host 2 Host     |
| Jenis Dokumen     | Business Requirement Document (BRD)         |
| Versi             | 1.1.0               |
| Tanggal Dibuat    | 16 Juli 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Latar Belakang

Bank/BPR menjalankan **Core Banking IBS (Integrated Banking System)** sebagai sistem inti
pencatatan seluruh operasional perbankan — nasabah (`nasabah`), tabungan (`tabung`),
pinjaman/kredit (`kredit`), deposito (`deposito`), dan transaksi (`tabtrans`, `deptrans`,
`kretrans`). Kanal-kanal digital (web front-office, mobile, aplikasi kantor kas) serta
aplikasi/partner pihak ketiga membutuhkan akses ke fungsi-fungsi core banking tersebut,
namun **tidak boleh** mengakses database core secara langsung karena alasan keamanan,
integritas data, dan coupling terhadap skema legacy.

Dibutuhkan sebuah **lapisan integrasi Host-to-Host (H2H)** berupa REST API yang berdiri di
depan Core Banking IBS dan menjadi **satu-satunya pintu** bagi seluruh sistem eksternal
untuk:
- melakukan autentikasi terpusat (per-aplikasi/`client_id`) sebelum mengakses layanan core,
- menjalankan operasi bisnis perbankan (registrasi nasabah/rekening, inquiry saldo/tagihan,
  posting transaksi setoran/penarikan/pencairan/angsuran, reversal),
- menjamin **integritas keuangan** (tidak ada dobel-posting, tidak ada saldo minus akibat
  race condition) dan **isolasi antar-kantor** (satu kantor tidak dapat melihat/mengubah
  data kantor lain),
- memberikan jejak audit dan monitoring atas setiap request/response yang melewati H2H.

Produk ini menggantikan pola integrasi langsung-ke-database yang rapuh dengan kontrak API
yang stabil, aman, dan terdokumentasi (OpenAPI/Swagger).

## 2. Tujuan (Business Objectives)

| Kode | Tujuan | Indikator Keberhasilan (KPI) |
|------|--------|------------------------------|
| OBJ-1 | Menyediakan **satu gerbang API terpusat** ke Core Banking IBS untuk seluruh kanal & partner. | 100% integrasi baru menggunakan H2H (bukan akses DB langsung). |
| OBJ-2 | Mengamankan akses melalui **autentikasi per-klien (multi-tenant)** dan otorisasi berbasis token. | 0 insiden akses tanpa `client_id`/token yang valid. |
| OBJ-3 | Menjamin **integritas transaksi keuangan** (idempotensi, penguncian saldo, validasi nominal). | 0 kasus dobel-posting / saldo minus akibat race condition. |
| OBJ-4 | Menerapkan **isolasi data antar-kantor (tenant isolation)** berbasis `kode_kantor`. | 0 kasus cross-office read/write oleh pengguna non-HQ. |
| OBJ-5 | Menyediakan **monitoring & audit** atas seluruh lalu lintas API (request/response ter-mask). | Seluruh request tercatat di `api_log` dengan data sensitif ter-redaksi. |
| OBJ-6 | Menjaga **ketersediaan & kestabilan** layanan pada beban kanal digital. | Uptime ≥ 99,9%; respons inquiry < 2 detik untuk 95% request. |

## 3. Ruang Lingkup (Scope)

### ✅ In Scope
- **Autentikasi**: login (menghasilkan access + refresh token), refresh token (rotasi &
  revokasi), logout, ganti password, dan update data pengguna sendiri.
- **Nasabah**: cek NIK/identitas (termasuk WNA), registrasi, update, portofolio CIF,
  daftar nasabah WNA.
- **Batch onboarding partner channeling** (mis. Akulaku): submit kumpulan record nasabah+kredit
  sekaligus sebagai job *asynchronous* (bukan satu-per-satu), dengan polling status job & detail
  per-baris.
- **Tabungan**: registrasi rekening, pencarian, inquiry saldo, dan daftar rekening.
- **Pinjaman/Kredit**: registrasi, jadwal angsuran, tagihan, saldo, dan daftar pinjaman.
- **Deposito**: registrasi (termasuk produk *special rate* dengan suku bunga kustom dan produk **On Call** bertenor harian), inquiry saldo, dan daftar produk *special rate*.
- **Transaksi (money-path)**: transaksi tabungan (setoran/penarikan/transfer), pencairan
  pinjaman, angsuran pinjaman, setoran deposito, cek status transaksi, dan reversal.
- **Referensi transaksi**: daftar tipe integrasi transaksi & kode binding bank.
- **Rekap/Laporan** (HQ/admin): rekap setoran & penarikan tabungan per marketing.
- **Monitoring**: daftar/detail/ekspor CSV log API (dashboard terpisah `health-ui-mcs`).
- Mekanisme lintas-cutting: idempotency, rate limiting, penguncian saldo, tenant isolation,
  masking data sensitif, dan global exception handling.

### ❌ Out of Scope
- Aplikasi/kanal front-end pengguna (web/mobile) itu sendiri — H2H hanya menyediakan API.
- Pembuatan/perubahan skema database Core Banking IBS (`ddl-auto=none`; skema dikelola IBS).
- Modul core banking di luar tabungan/kredit/deposito/nasabah (mis. akuntansi GL penuh,
  kliring, RTGS) selain yang tersentuh oleh posting transaksi.
- Model peran/role management penuh — otorisasi saat ini berbasis kepemilikan diri sendiri
  (`user_id`), allowlist HQ, dan allowlist admin rekap.
- Migrasi format hashing password (`user_web_password` tetap SHA1 karena dibagi dengan
  aplikasi legacy IBS — lihat Asumsi & Batasan).

## 4. Stakeholder

| Peran | Nama / Unit | Tanggung Jawab |
|-------|-------------|----------------|
| Sponsor | Manajemen TI Bank/BPR | Menyetujui inisiatif & anggaran integrasi H2H. |
| Business Owner | Unit Operasional / Layanan | Menetapkan aturan bisnis transaksi & nasabah. |
| Product Owner | Tim Produk USSI | Memprioritaskan endpoint & roadmap H2H. |
| End User (tidak langsung) | Teller, CS, Marketing, nasabah via kanal | Mengonsumsi layanan melalui kanal yang terintegrasi H2H. |
| Konsumen Sistem | Developer kanal/partner (`client_id`) | Mengintegrasikan aplikasinya ke API H2H. |
| DBA / Tim IBS | Pengelola Core Banking IBS | Menjaga skema core & kompatibilitas tabel bersama. |
| Tim Keamanan / Audit | Compliance | Meninjau kontrol keamanan, isolasi, dan audit log. |
| Developer / Maintainer | Tim USSI | Pengembangan & pemeliharaan microservice-core. |

## 5. Kebutuhan Bisnis

| ID | Kebutuhan Bisnis | Prioritas | Catatan |
|----|------------------|-----------|---------|
| BR-001 | Setiap aplikasi konsumen harus terautentikasi per `client_id` sebelum mengakses layanan. | Wajib | Header `X-CLIENT-ID`; secret/expiry per klien dari tabel `api_auth_config`. |
| BR-002 | Sistem menghasilkan **access token** & **refresh token** ber-JWT dengan masa berlaku per klien. | Wajib | Token membawa klaim `user_id`, `client_id`, `kode_kantor`, `token_use`. |
| BR-003 | Refresh token bersifat **dapat dicabut & dirotasi**; logout membuat token tidak dapat dipakai lagi. | Wajib | Disimpan di `api_refresh_tokens`; rotasi saat refresh. |
| BR-004 | Percobaan login yang gagal harus **dibatasi** untuk mencegah brute-force. | Wajib | Maks. 5 percobaan / 60 detik per (username+IP). |
| BR-005 | Pengguna hanya boleh mengubah/melihat **data miliknya sendiri** (password, profil). | Wajib | `user_id` token == `userId` body, jika tidak → ditolak. |
| BR-006 | Semua operasi transaksional harus **idempoten** — retry tidak boleh menghasilkan dobel-posting. | Wajib | Header `X-IDEMPOTENCY-KEY` wajib; reservasi atomik (SET NX). |
| BR-007 | Endpoint transaksional harus dibatasi lajunya (rate limit) per pengguna. | Wajib | Maks. 5 request / 60 detik per user & jenis operasi. |
| BR-008 | Posting transaksi harus **atomik** (semua berhasil atau seluruhnya batal). | Wajib | Satu `@Transactional` pada DB primer; saldo + jurnal + trans + log. |
| BR-009 | Nominal transaksi harus **> 0** (biaya/adm ≥ 0); nominal negatif/nol ditolak. | Wajib | Validasi DTO `@DecimalMin` + guard `signum()` di service. |
| BR-010 | Saldo yang di-debit/di-kredit harus **dikunci** agar tidak terjadi lost-update/overdraft. | Wajib | Pessimistic lock; multi-akun dikunci urut `no_rekening` (anti-deadlock). |
| BR-011 | Reversal transaksi harus dijaga dari **dobel-reversal**. | Wajib | Guard `kuitansi_id + "R"`. |
| BR-011a | Reversal **tidak boleh membuat saldo rekening nasabah menjadi negatif**. Reversal adalah posting kompensasi, bukan pembatalan baris asli — bila transaksi asli mengkredit rekening, reversal-nya mendebet, dan dana tersebut bisa saja sudah terpakai. | Wajib | Setiap leg reversal yang mendebet divalidasi dengan aturan sama persis dengan posting normal: `saldo_akhir - saldo_blokir - minimum >= pokok`. Tidak cukup → ditolak, tanpa jalur force/override. |
| BR-012 | Data hanya dapat diakses/diubah oleh **kantor pemiliknya** (`kode_kantor`), kecuali HQ. | Wajib | `TenantGuard` per endpoint; allowlist `isolation.hq-user-ids`. |
| BR-013 | Endpoint rekap/laporan hanya untuk **HQ/admin**. | Tinggi | Allowlist `rekap.admin-user-ids` (fail-closed bila kosong). |
| BR-014 | Endpoint monitoring log harus **dilindungi kunci** (bukan anonim). | Tinggi | Header `X-MONITORING-KEY` / query `monitoringKey`; fail-closed. |
| BR-015 | Data sensitif (password, token) harus **ter-mask** sebelum disimpan ke log. | Wajib | `SensitiveDataMasker`; mask dulu, baru truncate. |
| BR-016 | Kegagalan Redis (idempotency/rate-limit) harus **fail-closed** (tolak, jangan lolos). | Wajib | → HTTP 503, ditolak sebelum posting uang. |
| BR-017 | Kesalahan internal **tidak boleh membocorkan** detail DB/SQL ke klien. | Wajib | Pesan generik ke klien; detail hanya di log server. |
| BR-018 | Seluruh endpoint harus terdokumentasi (OpenAPI/Swagger). | Sedang | `/swagger-ui.html`. |
| BR-019 | Saldo minimum rekening tabungan dapat mengikuti **campaign** (mis. bebas saldo minimum = 0) menggantikan default produk. | Wajib | Campaign adalah **master data yang disetujui bank** (`api_tab_campaign`: produk, kantor, periode, `no_memo` persetujuan) — **bukan** flag pada payload. Berlaku untuk rekening baru maupun existing. |
| BR-020 | Nilai saldo minimum **tidak boleh ditentukan oleh aplikasi konsumen**. | Wajib | Nilai selalu diturunkan sistem dari campaign atau default produk; payload tidak memiliki field nominal. Konsumen hanya merujuk campaign yang sudah disetujui. |
| BR-021 | Setiap perubahan saldo minimum rekening wajib meninggalkan **jejak audit lengkap** (nilai asal → nilai baru, pelaku, waktu, alasan, dasar campaign). | Wajib | Ditulis ke `api_tab_minimum_change` dalam **satu transaksi** dengan perubahan rekeningnya, bersifat *append-only* → perubahan selalu dapat dibuktikan dan dibalikkan. |
| BR-022 | Perubahan saldo minimum via API hanya boleh dilakukan **pejabat/supervisor yang ditunjuk**. | Wajib | Keputusan BPR: alur API **tanpa maker-checker** (berbeda dengan otorisasi backoffice CBS); kontrol pengganti = allowlist `tabung.minimum-editor-user-ids` (fail-closed bila kosong) + jejak audit BR-021. |
| BR-023 | Pembayaran angsuran pinjaman via API **tidak boleh sebagian** (partial payment) — nasabah hanya dapat membayar satu angsuran penuh atau tidak membayar sama sekali. | Wajib | Keputusan BPR/M-Pay ("mirip fintech"); nominal pokok/bunga tidak lagi diterima dari aplikasi konsumen, selalu diturunkan sistem dari jadwal angsuran. |
| BR-024 | Angsuran hanya boleh dibayar **berurutan mulai dari yang paling awal belum lunas** — tidak boleh melompati angsuran yang masih tertunggak, meskipun nasabah terlambat lebih dari satu periode. | Wajib | `POST /transaksi/angsuranPinjaman` menolak `angsuranKe` selain angsuran belum lunas paling awal; `POST /pinjaman/tagihan` menampilkan seluruh angsuran tertunggak agar kanal tahu urutan yang harus dibayar. |
| BR-025 | Deposito **On Call** memakai tenor **harian** (7 atau 14 hari), bukan bulanan seperti produk deposito lainnya, dengan suku bunga **per-tenor** sesuai memo BPR (bukan default produk) — 7 hari = 2,5% p.a, 14 hari = 3% p.a, berlaku 1–30 September 2026. | Wajib | Klasifikasi produk (`dep_produk.kode_jenis`) diturunkan sistem dari master produk berdasarkan `kodeProduk`, **tidak pernah** dari payload; berlaku untuk `kodeProduk=311` ("Deposito On Call"). Suku bunga & tenor yang berlaku diturunkan dari master campaign `api_dep_oncall_rate` (per `kodeProduk`+`jkw`+periode), **bukan** `dep_produk.suku_bunga_default` — satu baris `dep_produk` tidak dapat menyimpan dua suku bunga berbeda untuk tenor yang berbeda. |
| BR-026 | Registrasi deposito On Call yang tidak punya baris campaign aktif untuk `jkw` yang diminta (tenor tidak pernah ditawarkan, atau periode program sudah berakhir) harus **ditolak**, bukan jatuh ke default produk. | Wajib | `api_dep_oncall_rate` **tidak punya fallback** ke `dep_produk.suku_bunga_default` (berbeda dengan campaign saldo minimum tabungan yang punya fallback ke default produk) — nilai default bukan suku bunga program ini, sehingga fallback berisiko mengenakan bunga yang salah. |
| BR-027 | Ruang lingkup API untuk deposito On Call **hanya** mencakup pembuatan rekening dengan `suku_bunga` & `tgl_jt` yang benar. Akrual bunga harian dan perlakuan ARO/rollover saat jatuh tempo adalah tanggung jawab **backoffice CBS**, di luar cakupan layanan ini. | Wajib | Ketentuan memo #3 (tanpa cash back), #5 (segmen retail/korporasi), #6 (hanya dana baru/*fresh fund*) bersifat prosedural/teller side — **tidak ada enforcement di level API**, karena tidak ada field pada endpoint ini yang dapat memvalidasinya. |
| BR-028 | Sistem harus mendukung onboarding nasabah+kredit dari partner *channeling* (mis. Akulaku) secara **batch** (banyak record dalam satu submit), bukan satu record per request. | Wajib | Permintaan eksplisit klien — API satu-record-per-request ditolak. Diproses sebagai job *asynchronous*: submit mengembalikan `jobId` segera, hasil dicek lewat polling status. |
| BR-029 | Setiap baris dalam batch harus memakai alur registrasi & pencairan yang **sama persis** dengan endpoint interaktif yang sudah ada (registrasi nasabah, registrasi kredit, pencairan pinjaman) — bukan logic posting baru. | Wajib | Kredit partner *channeling* ini selalu bertipe **flat** (`typeKredit=100`, tetap/*hardcoded*) dan langsung di-*disburse* otomatis (setara channel `C3`) tanpa langkah pencairan manual terpisah. |
| BR-030 | Kegagalan pemrosesan satu baris dalam batch **tidak boleh** menggagalkan baris lain dalam batch yang sama. | Wajib | Isolasi per-baris; job tetap berstatus `COMPLETED` walau sebagian baris gagal, dengan penghitung sukses/gagal/skip yang akurat dihitung ulang dari data per-baris. |
| BR-031 | Baris batch yang referensi pinjamannya **sudah pernah diproses** harus dapat dikirim ulang (resubmit) dengan aman tanpa memproses ulang baris tersebut. | Wajib | Deduplikasi berbasis referensi pinjaman partner (`kredit.no_alternatif`) — baris yang sudah pernah berhasil diregistrasi otomatis dilewati (tidak ada layanan registrasi/pencairan yang dipanggil ulang), sehingga batch yang sama boleh dikirim ulang setelah sebagian baris diperbaiki. |
| BR-032 | Pengiriman batch onboarding hanya boleh dilakukan oleh **operator/proses yang berwenang**, bukan sembarang pengguna terautentikasi. | Wajib | Allowlist `akulaku.batch-operator-user-ids` (fail-closed bila kosong) — satu submit dapat men-disburse dana sungguhan ke ratusan rekening sekaligus. |
| BR-033 | Ruang lingkup awal (MVP) batch onboarding Akulaku dibatasi pada subset record pinjaman yang memiliki **data nasabah yang cocok** pada ekspor data partner. | Wajib | Keputusan bisnis BPR: ± 850 nasabah / 860 kredit yang datanya cocok, dari total ± 50.000 lebih record pinjaman pada ekspor Akulaku (± 98% di antaranya tidak punya data nasabah yang cocok — masalah kualitas data di sisi partner, bukan sesuatu yang dapat diperbaiki API ini). Sisanya di luar cakupan hingga ekspor data partner diperbaiki. |
| BR-034 | Transaksi yang menyentuh rekening milik **kantor lain** harus membentuk jurnal **antar kantor (ATK)** pada buku masing-masing kantor pemilik kaki transaksi, dihubungkan rekening antar kantor (RAK). | Wajib | Buku kantor pemilik kaki debet: perkiraan debet riil vs RAK; buku kantor pemilik kaki kredit: RAK vs perkiraan kredit riil. Di buku kantor pusat dipakai RAK **aktiva** milik kantor cabang lawan; di buku cabang selalu RAK **pasiva** pusat — sebuah cabang tidak pernah punya RAK langsung ke cabang lain. |
| BR-035 | Kantor pusat hanya berperan sebagai **perantara** (jurnal ketiga) bila **kedua** kantor yang bertransaksi bukan kantor pusat. | Wajib | Bila salah satu kaki sudah berada di kantor pusat, dua jurnal pada BR-034 sudah menutup hubungan antar kantornya; jurnal ketiga hanya akan menjadi jurnal ganda. Temuan bug 22 September 2026: transaksi dari cabang ke rekening pusat membentuk 3 head jurnal. |
| BR-036 | Baris jurnal **tanpa kode perkiraan tidak boleh tersimpan** — transaksinya ditolak. | Wajib | Baris jurnal tanpa perkiraan tidak punya arti akuntansi dan tidak akan pernah muncul di buku besar/neraca. Berlaku fail-closed juga untuk setting kantor pusat yang kosong dan RAK kantor yang belum didaftarkan. |

## 6. Proses Bisnis

### 6.1 Kondisi Saat Ini (As-Is)
Kanal dan aplikasi partner mengakses data core banking dengan pola yang tidak seragam —
sebagian melalui koneksi database langsung atau integrasi ad-hoc. Akibatnya: kontrol
keamanan tidak konsisten, tidak ada isolasi antar-kantor yang tegas, integritas transaksi
bergantung pada masing-masing aplikasi, serta minim audit trail terpusat. Perubahan skema
IBS berisiko merusak banyak integrasi sekaligus.

### 6.2 Kondisi Diharapkan (To-Be)
Seluruh akses ke Core Banking IBS dilewatkan melalui **API Host-to-Host** dengan kontrak
yang stabil. Setiap request melewati rantai kontrol yang seragam sebelum menyentuh data
uang.

```
[Client App] → [Login /autentikasi/login (X-CLIENT-ID)] → terima access+refresh token
      │
      ▼
[Request bisnis + Bearer token + X-IDEMPOTENCY-KEY]
      │
      ▼
[H2H API] → validasi token → cek user_id == token → idempotency (SET NX)
          → rate limit → tenant guard (kode_kantor) → [Service: lock saldo + posting @Transactional]
          → [Core Banking IBS DB] → response {responseCode, responseData, responseMessage}
      │
      ▼
[api_log: request/response ter-mask untuk monitoring & audit]
```

## 7. Asumsi & Batasan

- **Asumsi:**
  - Setiap aplikasi konsumen sudah terdaftar di `api_auth_config` (punya `client_id`,
    secret Base64, dan masa berlaku token).
  - Data pengguna (`sys_daftar_user`) beserta `unit_kerja` (→ `kode_kantor`) sudah tersedia
    di sistem IBS; office/klaim diambil dari sana saat login.
  - Redis tersedia untuk idempotency & rate limiting; MySQL core & sys tersedia.
- **Batasan:**
  - Harus terintegrasi dengan **Core Banking IBS** melalui **dua datasource** terpisah
    (`primary` = `dbcore`, `sys` = `dbcore_sys`); satu transaksi DB tidak boleh melintasi kedua
    datasource.
  - `spring.jpa.hibernate.ddl-auto=none` — perubahan skema DB dikirim sebagai patch SQL
    manual, bukan auto-generate.
  - **Password `user_web_password` tetap SHA1** karena kolom dibagi dengan aplikasi legacy
    IBS; format hash tidak boleh diubah di layanan ini (risiko diterima — audit B-2).
  - Belum ada model role penuh; otorisasi berbasis kepemilikan diri + allowlist HQ/admin.
  - Platform: Java 17, Spring Boot 3.3.x; artefak `microservicecore.jar`.

## 8. Risiko Bisnis

| ID | Risiko | Dampak | Mitigasi |
|----|--------|--------|----------|
| RB-001 | Dobel-posting akibat retry/klien mengulang request | Saldo/jurnal ganda, kerugian finansial | `X-IDEMPOTENCY-KEY` + reservasi atomik `reserveIfFirst` (409 bila bukan pertama). |
| RB-002 | Lost-update / overdraft saat transaksi konkuren ke rekening sama | Saldo salah / minus | Pessimistic lock kedua sisi akun; urutan kunci `no_rekening` asc (anti-deadlock). |
| RB-003 | Cross-office access (IDOR antar-kantor) | Kebocoran/perubahan data kantor lain | `TenantGuard` per endpoint berbasis klaim `kode_kantor`; token opaque bagi klien. |
| RB-004 | Kredensial/token bocor via log | Pengambilalihan akun | `SensitiveDataMasker` (mask-before-truncate); monitoring key-gated. |
| RB-005 | Redis down → guard idempotency/rate-limit tidak jalan | Potensi dobel-posting bila fail-open | **Fail-closed**: Redis error → HTTP 503, request ditolak sebelum posting. |
| RB-006 | Kebocoran detail internal (SQL/tabel) via pesan error | Information disclosure | Handler mengembalikan pesan generik; detail hanya di log server. |
| RB-007 | Perubahan skema IBS merusak integrasi | Downtime layanan | Kontrak API stabil + patch SQL manual yang di-review IBS lebih dulu. |
| RB-008 | Brute-force login | Pengambilalihan akun | Throttle 5x/60s per (username+IP) sebelum verifikasi password. |
| RB-009 | Saldo minimum diturunkan tanpa dasar/otorisasi (alur API tanpa maker-checker) → dana yang dapat ditarik naik | Kerugian finansial, temuan audit | Nilai hanya dari campaign yang disetujui (bukan dari payload) + allowlist `tabung.minimum-editor-user-ids` (fail-closed) + jejak audit `api_tab_minimum_change` dalam satu transaksi (dapat dibuktikan & dibalikkan) + office scope `assertTabungOffice`. |
| RB-010 | Campaign kedaluwarsa tetapi rekening tetap bebas saldo minimum | Pendapatan/kebijakan produk tidak tertagih | Campaign punya `tgl_mulai`/`tgl_akhir` (registrasi otomatis kembali ke default setelah periode habis); rekening existing dikembalikan dengan aksi `DEFAULT_PRODUK` — nilai asal tersimpan di `api_tab_minimum_change.minimum_lama`. |
| RB-011 | Nasabah/kanal mencoba membayar sebagian atau melompati angsuran yang tertunggak | Rekonsiliasi jadwal kacau, saldo pinjaman tidak sinkron dengan jadwal | Server menolak (`95`) pembayaran selain angsuran belum lunas paling awal; nominal yang diposting selalu diturunkan dari jadwal, bukan dari client (BR-023, BR-024). |
| RB-012 | Satuan tenor produk deposito (bulan vs hari) tidak dibedakan saat menghitung tanggal jatuh tempo, berisiko pada produk bertenor harian seperti On Call | Tanggal jatuh tempo salah (mis. tercatat bulan alih-alih hari), berdampak pada pencairan/perlakuan bunga | Perhitungan tanggal jatuh tempo kini bercabang menurut klasifikasi produk (`dep_produk.kode_jenis`): `+hari` untuk On Call, `+bulan` untuk produk lain; ditemukan & diperbaiki sebelum produk On Call pernah dipakai di produksi (belum ada nasabah yang terdampak). |
| RB-013 | Registrasi On Call memakai suku bunga default produk alih-alih suku bunga per-tenor sesuai memo BPR (kesalahan asumsi desain awal, dikoreksi sebelum implementasi final) | Nasabah dikenakan/dijanjikan bunga yang salah (2,5%/3% p.a keliru tercatat sebagai `suku_bunga_default` produk) | Suku bunga kini diturunkan dari master `api_dep_oncall_rate` per `(kodeProduk, jkw, tanggal)`, bukan `dep_produk.suku_bunga_default`; tanpa baris campaign aktif yang cocok, registrasi **ditolak** (tidak ada fallback) — lihat BR-025/BR-026. Dikoreksi sebelum produk ini pernah dipakai di produksi. |
| RB-014 | Batch yang sama dikirim ulang (mis. setelah memperbaiki sebagian baris gagal) memproses ulang baris yang sudah pernah berhasil, menyebabkan dobel-registrasi nasabah/kredit dan dobel-pencairan dana | Kerugian finansial, data nasabah/kredit ganda | Dedup berbasis `kredit.no_alternatif` sebelum baris diproses — baris yang referensi pinjamannya sudah tercatat otomatis di-skip (tidak ada layanan registrasi/pencairan yang dipanggil); baris yang sebelumnya gagal (belum sempat membuat baris kredit) tetap dapat diproses ulang setelah datanya diperbaiki (BR-031). |
| RB-015 | Submit batch onboarding tanpa kontrol otorisasi dapat men-disburse dana ke banyak rekening sekaligus oleh pengguna yang tidak berwenang | Kerugian finansial berskala batch (ratusan rekening dalam satu submit) | Allowlist `akulaku.batch-operator-user-ids` (fail-closed bila kosong) ditambah rantai guard standar (kepemilikan `userId`, idempotency, rate limit, isolasi kantor via `TenantGuard`) — BR-032. |

## 9. Kriteria Penerimaan (Acceptance Criteria)

- Aplikasi konsumen dapat login dengan `X-CLIENT-ID` yang valid dan menerima access +
  refresh token; `client_id` tak dikenal ditolak (`92`).
- Seluruh endpoint transaksional menolak request tanpa `X-IDEMPOTENCY-KEY` (`97`) dan
  menolak retry duplikat (`93`).
- Dua request setor konkuren ke rekening yang sama tidak menghasilkan saldo yang salah
  (tidak ada lost-update), dan transfer A→B / B→A konkuren tidak deadlock.
- Pengguna non-HQ tidak dapat membaca/menulis data kantor lain (403, `USER_MISMATCH`).
- Nominal ≤ 0 ditolak; reversal kedua atas transaksi yang sama ditolak.
- Reversal setoran / reversal sisi penerima transfer yang saldonya sudah tidak mencukupi
  ditolak, dan **tidak ada** rekening yang berakhir dengan saldo negatif.
- Kegagalan Redis mengembalikan HTTP 503 dan tidak ada posting uang yang terjadi.
- Log `api_log` tidak memuat nilai password/token dalam bentuk plaintext.
- Seluruh endpoint tampil & dapat dicoba melalui Swagger UI.
- Registrasi tabungan pada periode campaign aktif menghasilkan rekening dengan saldo minimum
  sesuai campaign (mis. 0) **tanpa perubahan payload** dari aplikasi konsumen; di luar periode
  campaign kembali memakai default produk.
- Setiap perubahan saldo minimum rekening existing menghasilkan tepat satu baris
  `api_tab_minimum_change` berisi nilai asal, nilai baru, pelaku, waktu, alasan, dan dasar
  campaign; request dengan nilai yang sama tidak menghasilkan baris audit.
- Pengguna di luar allowlist `tabung.minimum-editor-user-ids` ditolak (403) saat mencoba
  mengubah saldo minimum; allowlist kosong = semua ditolak.
- Permintaan `POST /transaksi/angsuranPinjaman` dengan `angsuranKe` selain angsuran belum lunas
  paling awal ditolak (`95`), begitu pula bila seluruh angsuran sudah lunas; nominal yang
  diposting selalu sama dengan jadwal (`kretrans`), tidak pernah diambil dari body request.
- `POST /pinjaman/tagihan` menampilkan seluruh angsuran belum lunas yang jatuh tempo hingga
  tanggal inquiry (bukan hanya satu baris), sehingga nasabah yang telat lebih dari satu periode
  tetap melihat seluruh tunggakannya.
- Registrasi deposito produk **On Call** (`kodeProduk=311`) hanya menerima `jkw` yang punya baris
  campaign aktif di `api_dep_oncall_rate` untuk tanggal registrasi tersebut (saat ini 7 hari @2,5%
  p.a dan 14 hari @3% p.a, periode 1–30 September 2026); `jkw` lain atau di luar periode ditolak
  (`95`) dengan pesan "Program deposito on call untuk jangka waktu {N} hari tidak tersedia pada
  tanggal ini" — **tanpa fallback** ke suku bunga default produk. Tanggal jatuh tempo dihitung
  sebagai tanggal registrasi + jumlah **hari** (bukan bulan) untuk produk ini.
- Akrual bunga harian dan proses ARO/rollover saat jatuh tempo deposito On Call **tidak**
  dilakukan oleh API ini — tetap menjadi proses backoffice CBS.
- Submit batch onboarding partner (Akulaku) mengembalikan `jobId` **segera** (tanpa menunggu
  seluruh baris selesai diproses); status job berkembang `PENDING` → `PROCESSING` → `COMPLETED`
  dan dapat dipantau lewat polling.
- Baris batch dengan referensi pinjaman (`noAlternatif`) yang sudah pernah diproses **dilewati**
  (ditandai `SKIPPED_DUPLICATE`) tanpa memanggil layanan registrasi/pencairan apa pun — batch
  yang sama aman dikirim ulang.
- Kegagalan pada satu baris batch (validasi maupun aturan bisnis) **tidak** menggagalkan baris
  lain; job tetap mencapai status `COMPLETED` dengan jumlah sukses/gagal/skip yang akurat.
- Pengguna di luar allowlist `akulaku.batch-operator-user-ids` ditolak (403) saat mencoba submit
  batch; allowlist kosong = semua ditolak.

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.6.0 | 22 September 2026 | | **BR-011a baru** (temuan bug produksi): reversal tidak boleh membuat saldo rekening nasabah negatif. Reversal adalah posting kompensasi, bukan pembatalan baris asli — reversal atas transaksi yang dulu mengkredit rekening akan mendebetnya, dan dana itu bisa sudah terpakai. Setiap leg reversal yang mendebet kini divalidasi dengan aturan sama persis dengan posting normal; tidak cukup → ditolak, tanpa jalur force/override (keputusan BPR). Kriteria penerimaan terkait ditambahkan. |
| 1.7.0 | 22 September 2026 | | **BR-034..BR-036 baru** (temuan bug saat pengujian): aturan pembentukan jurnal antar kantor (ATK). Transaksi dari cabang ke rekening kantor pusat sebelumnya membentuk **3 head jurnal** (satu di antaranya ganda) dan seluruh baris jurnalnya tersimpan **tanpa kode perkiraan**; arah sebaliknya sudah benar. BR-034 menetapkan bentuk jurnal ATK (dua buku kantor dihubungkan RAK, RAK aktiva di buku pusat vs RAK pasiva pusat di buku cabang), BR-035 menetapkan pusat hanya menjadi perantara bila kedua kantor bukan pusat, BR-036 menetapkan baris jurnal tanpa kode perkiraan harus ditolak (fail-closed). |
| 1.0.0 | 16 Juli 2026 | | Dokumen dibuat |
| 1.1.0 | 16 Juli 2026 | | Ruang lingkup deposito diperluas: produk *special rate* (suku bunga kustom) & daftar produknya. |
| 1.2.0 | 5 Agustus 2026 | | Nama database dibuat generik: `cma`/`cma_sys` → **`dbcore`/`dbcore_sys`** (nama skema spesifik lembaga tidak dipakai di dokumen yang di-deliver ke klien). Campaign **bebas saldo minimum** tabungan (permintaan BPR Sentosa): BR-019..BR-022 (campaign sebagai master data yang disetujui, nilai tidak dari payload, jejak audit wajib, allowlist pengganti maker-checker), risiko RB-009/RB-010, dan kriteria penerimaan terkait. |
| 1.3.0 | 1 September 2026 | | BR-023/BR-024 baru (keputusan BPR/M-Pay): pembayaran angsuran pinjaman tidak boleh sebagian (partial payment) dan hanya angsuran belum lunas paling awal yang boleh dibayar (tidak boleh melompat). RB-011 baru & kriteria penerimaan terkait ditambahkan. |
| 1.4.0 | 11 September 2026 | | BR-025 baru — produk deposito **On Call** (`kodeProduk=311`) bertenor harian (7/14 hari) memakai suku bunga default produk, bukan suku bunga kustom. RB-012 baru mencatat mitigasi bug tanggal jatuh tempo (perhitungan kini membedakan satuan hari vs bulan menurut klasifikasi produk), ditemukan & diperbaiki sebelum produk ini pernah dipakai di produksi. Kriteria penerimaan terkait ditambahkan. |
| 1.5.0 | 11 September 2026 | | **Koreksi BR-025** — memo BPR asli "Program Deposito On Call" ternyata menetapkan suku bunga **berbeda per tenor** (7 hari = 2,5% p.a, 14 hari = 3% p.a, periode 1–30 September 2026), bukan suku bunga default produk seperti diasumsikan pada versi 1.4.0. BR-026 baru (registrasi ditolak tanpa fallback bila tidak ada campaign aktif yang cocok) dan BR-027 baru (cakupan API hanya pembuatan rekening — akrual bunga & ARO/rollover adalah tanggung jawab backoffice CBS; ketentuan memo #3/#5/#6 tidak di-enforce di level API). RB-013 baru mencatat koreksi asumsi desain ini (ditemukan & dikoreksi sebelum produk dipakai di produksi). Kriteria penerimaan terkait dikoreksi. |
| 1.6.0 | 19 September 2026 | | **Kapabilitas bisnis baru — batch onboarding partner *channeling* (Akulaku), job asynchronous.** BPR menjalin kerja sama *channeling* dengan Akulaku, yang mengirim data nasabah+kredit secara massal (ratusan record sekaligus); klien secara eksplisit menolak API satu-record-per-request. BR-028..BR-033 baru: dukungan submit batch sebagai job async (BR-028), setiap baris memakai alur registrasi/pencairan yang sudah ada tanpa logic posting baru — kredit selalu flat & auto-disburse (BR-029), isolasi kegagalan per-baris (BR-030), deduplikasi aman untuk resubmit berbasis referensi pinjaman partner (BR-031), allowlist operator (BR-032), dan **keputusan ruang lingkup MVP**: hanya ± 850 nasabah/860 kredit yang datanya cocok pada ekspor Akulaku (dari ± 50.000 lebih total record pinjaman, ± 98% tanpa data nasabah yang cocok — masalah kualitas data di sisi partner) yang diproses; sisanya menunggu perbaikan ekspor data partner (BR-033). Ruang lingkup §3 diperluas. RB-014 (risiko dobel-proses saat resubmit) dan RB-015 (risiko disbursement massal tanpa otorisasi) baru. Kriteria penerimaan terkait ditambahkan. |

---

*[← Kembali ke Host 2 Host](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
