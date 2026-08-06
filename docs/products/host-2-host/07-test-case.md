# ✅ Test Case — Host 2 Host

> Daftar skenario & kasus uji untuk produk **Host 2 Host**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | Host 2 Host     |
| Jenis Dokumen     | Test Case         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 23 Juni 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Ringkasan Test Case

| ID | Modul / Fitur | Judul Test Case | Prioritas | Jenis |
|----|---------------|-----------------|-----------|-------|
| TC-001 | _Fitur_ | _Judul singkat_ | Tinggi | Positif / Negatif |
| TC-101 | Tabungan — campaign saldo minimum | Registrasi saat campaign aktif → saldo minimum sesuai campaign (0) | Tinggi | Positif |
| TC-102 | Tabungan — campaign saldo minimum | Registrasi tanpa campaign aktif → saldo minimum = default produk | Tinggi | Positif |
| TC-103 | Tabungan — update saldo minimum | Aksi `CAMPAIGN` menurunkan saldo minimum & menulis jejak audit | Tinggi | Positif |
| TC-104 | Tabungan — update saldo minimum | Aksi `DEFAULT_PRODUK` mengembalikan saldo minimum ke default produk | Tinggi | Positif |
| TC-105 | Tabungan — update saldo minimum | Nilai sama = no-op (tanpa perubahan & tanpa baris audit) | Sedang | Positif |
| TC-106 | Tabungan — update saldo minimum | User di luar allowlist ditolak 403 | Tinggi | Negatif |
| TC-107 | Tabungan — update saldo minimum | Campaign nonaktif / di luar periode / beda produk / beda kantor ditolak `95` | Tinggi | Negatif |
| TC-108 | Tabungan — update saldo minimum | Rekening kantor lain ditolak 403 (office scope) | Tinggi | Negatif |

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

### TC-101..TC-108 — Campaign saldo minimum tabungan

| Field | Detail |
|-------|--------|
| Modul / Fitur | Tabungan — campaign bebas saldo minimum (FR-011, FR-011a) |
| Prioritas | Tinggi |
| Pre-condition | Patch `patch_tab_campaign_saldo_minimum.sql` sudah dijalankan; ada baris `api_tab_campaign` (`CMP-NOMIN`, produk `201`, `kode_kantor` NULL, `saldo_minimum` 0, periode mencakup hari ini, `is_active=1`); `tab_produk` `201` punya `saldo_minimum_default` 50.000; `tabung.minimum-editor-user-ids` memuat user uji (mis. `199`); token access valid dengan `kode_kantor` = kantor rekening |
| Test Data | Rekening `0010001` (produk `201`, kantor `001`, `minimum` 50.000); rekening kantor lain `0020001` |

| No | Langkah | Hasil Diharapkan | Hasil Aktual | Status |
|----|---------|------------------|--------------|--------|
| 1 (TC-101) | `POST /tabungan/registrasi` produk `201`, kantor `001` (payload **tanpa** field tambahan) | `00`; rekening baru punya `minimum = 0` | | ⬜ Belum |
| 2 (TC-102) | Set `is_active=0` pada campaign, ulangi registrasi | `00`; rekening baru punya `minimum = 50000` (default produk) | | ⬜ Belum |
| 3 (TC-103) | `POST /tabungan/update-saldo-minimum` `{noRekening:0010001, aksi:CAMPAIGN, kodeCampaign:CMP-NOMIN, alasan:"...", userId:199}` | `00`, `berubah=true`, `minimumLama=50000`, `minimumBaru=0`; `tabung.minimum=0`; **satu** baris `api_tab_minimum_change` berisi nilai asal/baru, `aksi`, `kode_campaign`, `alasan`, `user_id`, `created_at` | | ⬜ Belum |
| 4 (TC-104) | Ulangi dengan `aksi=DEFAULT_PRODUK` | `00`, `berubah=true`, `minimumBaru=50000`; baris audit **baru** dengan `kode_campaign` NULL (baris lama tetap ada — append-only) | | ⬜ Belum |
| 5 (TC-105) | Ulangi `aksi=DEFAULT_PRODUK` sekali lagi (idempotency key baru) | `00`, `berubah=false`, pesan "sudah sesuai"; jumlah baris audit **tidak bertambah** | | ⬜ Belum |
| 6 (TC-106) | Panggil dengan token user yang tidak ada di `tabung.minimum-editor-user-ids` | HTTP 403, `99`, "User tidak berwenang mengubah saldo minimum"; `tabung` tidak berubah | | ⬜ Belum |
| 7 (TC-107) | Panggil `aksi=CAMPAIGN` dengan campaign nonaktif / di luar periode / `kode_produk` lain / `kode_kantor` lain, dan dengan `kodeCampaign` kosong | HTTP 400 `95` dengan pesan sesuai; `tabung.minimum` **tidak** berubah dan tidak ada baris audit | | ⬜ Belum |
| 8 (TC-108) | Panggil untuk rekening `0020001` (kantor lain) dengan token kantor `001` non-HQ | HTTP 403, `99`; tidak ada perubahan | | ⬜ Belum |
| 9 | Uji header: tanpa `X-IDEMPOTENCY-KEY`, lalu ulang request dengan key yang sama, lalu > 5 request/60s | `97` (400) · `93` (409) · `94` (429) | | ⬜ Belum |

**Hasil Akhir:** ⬜ Pass / ⬜ Fail
**Catatan:** Verifikasi jejak audit dengan `SELECT * FROM api_tab_minimum_change WHERE no_rekening='0010001' ORDER BY created_at DESC;`

## 3. Rekapitulasi

| Status | Jumlah |
|--------|--------|
| ✅ Pass | 0 |
| ❌ Fail | 0 |
| ⬜ Belum diuji | 0 |
| **Total** | **0** |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 23 Juni 2026 | | Dokumen dibuat |
| 1.1.0 | 5 Agustus 2026 | | Tambah TC-101..TC-108: campaign bebas saldo minimum tabungan (registrasi & update rekening existing, jejak audit, allowlist, office scope, guard header). |

---

*[← Kembali ke Host 2 Host](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
