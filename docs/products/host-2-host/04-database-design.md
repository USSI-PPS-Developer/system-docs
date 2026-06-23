# 🗄️ Desain Database — Host 2 Host

> Rancangan struktur basis data untuk produk **Host 2 Host**.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | Host 2 Host     |
| Jenis Dokumen     | Desain Database         |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 23 Juni 2026              |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---


## 1. Daftar Tabel

| No | Nama Tabel | Deskripsi |
|----|-----------|-----------|
| 1  | `nama_tabel` | _Deskripsi tabel_ |

---

## 2. Detail Tabel

### Tabel: `nama_tabel`

> _Deskripsi singkat fungsi tabel ini._

| No | Kolom | Tipe Data | Null | Default | Keterangan |
|----|-------|-----------|------|---------|------------|
| 1  | `id` | `BIGINT UNSIGNED` | NOT NULL | AUTO_INCREMENT | Primary Key |
| 2  | `created_at` | `TIMESTAMP` | NOT NULL | `CURRENT_TIMESTAMP` | Waktu dibuat |
| 3  | `updated_at` | `TIMESTAMP` | NOT NULL | `CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` | Waktu diupdate |
| 4  | `deleted_at` | `TIMESTAMP` | NULL | `NULL` | Soft delete |

**Primary Key:** `id`

**Index:**
| Nama Index | Kolom | Tipe |
|------------|-------|------|
| `PRIMARY` | `id` | PRIMARY |

**Foreign Key:**
| Kolom | References | On Delete | On Update |
|-------|-----------|-----------|-----------|
| `foreign_id` | `tabel_lain(id)` | CASCADE | CASCADE |

---

## 3. Entity Relationship Diagram (ERD)

```
[nama_tabel] 1 ──────── N [nama_tabel_lain]
```

> Lampirkan file ERD: `![ERD Host 2 Host](assets/erd.png)`

## 4. Aturan Bisnis Terkait Data
1. _Tuliskan aturan bisnis yang berdampak ke struktur database._

## 5. DDL

```sql
CREATE TABLE nama_tabel (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 23 Juni 2026 | | Dokumen dibuat |

---

*[← Kembali ke Host 2 Host](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
