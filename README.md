# 🔷 Analyst CLI

> Scaffolding tool untuk **Sistem Analis** — generate paket dokumentasi **SDLC lengkap per produk** dalam Markdown, auto-update README index dengan hyperlink, siap push ke GitHub.

Setiap **produk** (mis. Host 2 Host, Aplikasi Onboarding, Aplikasi LOS) langsung mendapat **11 dokumen standar**:

| # | Dokumen | # | Dokumen |
|---|---------|---|---------|
| 01 | BRD — Business Requirement Document | 07 | Test Case |
| 02 | SRS — Software Requirements Specification | 08 | SIT Documentation |
| 03 | API Contract | 09 | UAT |
| 04 | Desain Database | 10 | Deployment Guide |
| 05 | Desain UI/UX | 11 | User Manual |
| 06 | Test Plan | | |

---

## 📦 Instalasi

```bash
cd analyst-cli
npm install
npm install -g .       # daftarkan command `analyst` global
```

---

## 🚀 Quick Start

```bash
# Masuk ke folder repo dokumentasi
cd my-project-docs/

# 1. Buat produk + scaffold 11 dokumen sekaligus
analyst new product "Host 2 Host"
analyst new product "Aplikasi Onboarding"
analyst new product "Aplikasi LOS"

# 2. Regenerate satu dokumen (mis. setelah template diupdate)
analyst add api-contract -p "Host 2 Host" --force

# 3. Lihat semua produk & kelengkapan dokumen
analyst list
analyst list "Host 2 Host"      # detail per dokumen

# 4. Push ke GitHub
git add . && git commit -m "docs: add Host 2 Host" && git push
```

---

## 📋 Daftar Command

| Command | Deskripsi |
|---------|-----------|
| `analyst new product <nama>` | Buat produk + scaffold 11 dokumen SDLC |
| `analyst new product <nama> --force` | Timpa dokumen produk yang sudah ada |
| `analyst add <jenis> -p <produk>` | Generate satu dokumen |
| `analyst add <jenis> -p <produk> --force` | Generate ulang (timpa) satu dokumen |
| `analyst list [produk]` | Lihat semua produk / detail satu produk |
| `analyst remove product <nama>` | Hapus seluruh dokumentasi produk |
| `analyst docs` | Tampilkan daftar jenis dokumen yang didukung |

### Jenis dokumen (`<jenis>`) & alias

`brd` · `srs` · `api-contract` (`api`) · `database-design` (`db`, `db-design`) · `uiux-design` (`uiux`, `ui`) · `test-plan` · `test-case` (`tc`) · `sit` · `uat` · `deployment-guide` (`deploy`) · `user-manual` (`manual`)

---

## 📁 Struktur Output

```
docs/
├── README.md                          ← Index semua produk + kelengkapan (auto-generate)
└── products/
    └── host-2-host/
        ├── README.md                  ← Index produk + status tiap dokumen (auto-generate)
        ├── 01-brd.md
        ├── 02-srs.md
        ├── 03-api-contract.md
        ├── 04-database-design.md
        ├── 05-uiux-design.md
        ├── 06-test-plan.md
        ├── 07-test-case.md
        ├── 08-sit.md
        ├── 09-uat.md
        ├── 10-deployment-guide.md
        └── 11-user-manual.md
```

Semua README index di-generate ulang otomatis (scan folder) setiap kali ada perubahan, jadi link & status kelengkapan selalu sinkron. Hyperlink bisa diklik langsung di GitHub. ✅

---

## 🧩 Menambah / mengubah jenis dokumen

Semua jenis dokumen didefinisikan di satu tempat: **`src/config/doc-types.js`**.
Untuk menambah jenis dokumen baru:

1. Buat template di `src/templates/<nama>.js` (lihat `src/templates/_shared.js` untuk header/footer standar).
2. Tambahkan satu baris entry di `src/config/doc-types.js`.

Command `add`, `list`, dan README otomatis ikut mengenali dokumen baru — tidak perlu ubah file lain.

---

## 🏗️ Arsitektur

```
src/
├── index.js                 ← CLI (commander)
├── config/doc-types.js      ← registry tunggal 11 jenis dokumen
├── templates/               ← 1 file template per jenis dokumen + _shared.js
├── commands/                ← new-product, add-doc, list, remove
└── utils/
    ├── helpers.js           ← slug, title, path
    └── readme.js            ← generator README produk & index utama
```

---

*Made for Sistem Analis — push ke GitHub, biarkan tim tinggal klik.*
