# 🚀 Deployment Guide — IBS Onboarding Admin

> Panduan build & deploy **IBS Onboarding Admin** (SPA React) di belakang nginx dengan proxy ke backend.

| Field             | Detail              |
|-------------------|---------------------|
| Produk            | IBS Onboarding Admin |
| Jenis Dokumen     | Deployment Guide     |
| Versi             | 1.0.0               |
| Tanggal Dibuat    | 17 Juli 2026        |
| Status            | 🟡 Draft            |
| Disusun oleh      |                     |
| Direview oleh     |                     |
| Disetujui oleh    |                     |

---

## 1. Arsitektur Deployment

```
[Browser Admin] ──HTTP──► [Container admin-onboard : nginx :80 → host :8080]
                                   │  serve aset statis (React build)
                                   │  location /api/ → proxy_pass
                                   ▼
                          [Container backend-onboard : 8855]  (Docker network: onboard-net)
                                   ▼
                          [IBS Core Banking / MySQL]
```

Frontend & backend berbagi **Docker network eksternal `onboard-net`**. Browser hanya memanggil
**satu origin**; nginx meneruskan `/api/*` ke container backend (`backend-onboard:8855`) memakai
DNS internal Docker.

## 2. Prasyarat

| Item | Keterangan |
|------|-----------|
| Docker & Docker Compose | Untuk build & run container |
| Node.js 20 (opsional) | Hanya untuk build/dev lokal tanpa Docker |
| Container backend | `backend-onboard` berjalan & tersambung ke `onboard-net` |
| Docker network | `onboard-net` sudah dibuat (lihat §5) |

## 3. Konfigurasi Environment

Variabel `VITE_*` **di-*bake* saat BUILD** (Vite meng-inline nilai ke bundel). Mengubahnya
**mengharuskan rebuild**.

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `VITE_APP_NAME` | `IBS Admin Onboarding` | Nama app (title/header) |
| `VITE_APP_DESCRIPTION` | `Dashboard admin untuk aplikasi IBS Onboard` | Deskripsi |
| `VITE_BACKEND_URL` | `/api` | Path/URL API. `/api` = via proxy nginx (disarankan). Alternatif: `https://api-onboard.<domain>/api` (langsung, tanpa proxy) |

Buat `.env` (lihat `.env.example`):
```env
VITE_APP_NAME=IBS Admin Onboarding
VITE_APP_DESCRIPTION=Dashboard admin untuk aplikasi IBS Onboard
VITE_BACKEND_URL=/api
```

> **Penting:** enkripsi payload frontend memakai `BASE_KEY = "IBS-ONBOARD-SECRET-KEY"` yang
> **harus identik** dengan backend. Bila backend mengganti kunci/algoritme, frontend wajib
> disesuaikan (`src/utils/decrypt.ts`) & di-rebuild.

## 4. Build

### 4.1 Lokal (tanpa Docker)
```sh
npm ci
npm run build          # tsc -b && vite build → output ke dist/
npm run preview        # pratinjau hasil build
```

### 4.2 Docker (multi-stage)
`Dockerfile`: Stage 1 `node:20-alpine` build → Stage 2 `nginx:1.27-alpine` serve `dist/`.
Env `VITE_*` diteruskan sebagai `ARG` saat build.

```sh
docker build \
  --build-arg VITE_APP_NAME="IBS Admin Onboarding" \
  --build-arg VITE_APP_DESCRIPTION="Dashboard admin untuk aplikasi IBS Onboard" \
  --build-arg VITE_BACKEND_URL="/api" \
  -t admin-onboard:latest .
```

## 5. Deploy dengan Docker Compose

### 5.1 Siapkan network bersama (sekali saja)
```sh
docker network create onboard-net    # jika belum ada
# pastikan container backend juga join: docker network connect onboard-net backend-onboard
```

### 5.2 Jalankan
`docker-compose.yml` membaca `VITE_*` dari `.env` saat build, memetakan **host :8080 → container :80**,
`restart: unless-stopped`, join network eksternal `onboard-net`.
```sh
docker compose up -d --build
```
Akses: `http://<host>:8080`.

## 6. Konfigurasi nginx (ringkasan `nginx.conf`)

| Bagian | Fungsi |
|--------|--------|
| `client_max_body_size 25m` | Mendukung upload foto/dokumen/banner |
| `gzip on` | Kompresi transfer |
| `location /api/` | Proxy ke `backend-onboard:8855` via resolver Docker `127.0.0.11` |
| `location /` | SPA fallback → `index.html` (React Router) |
| `location /assets/` | Cache aset ber-hash Vite `1y` immutable |
| `location = /index.html` | `no-cache` agar rilis baru langsung terbaca |

## 7. Verifikasi Pasca-Deploy

1. Buka `http://<host>:8080` → halaman **Login** tampil.
2. Login admin valid → redirect ke Dashboard; 6 kartu rekap terisi (bukti `/api/dashboard/*` OK).
3. Cek Network tab: request `/api/...` berstatus 200; `responseData` terenkripsi & konten
   terdekripsi tampil benar.
4. Uji buka detail registrasi → foto termuat (`/api/uploads/...`).
5. Uji satu aksi non-destruktif (mis. buka detail pengajuan) tanpa error.

## 8. Rollback & Update

- **Update**: rebuild image (`docker compose up -d --build`); `index.html` no-cache memastikan
  klien mengambil bundel baru.
- **Rollback**: deploy tag image sebelumnya (mis. `admin-onboard:<versi-lama>`).
- Karena tanpa DB, rollback frontend **tidak berisiko data** — cukup ganti aset statis.

## 9. Troubleshooting

| Gejala | Kemungkinan Penyebab | Solusi |
|--------|----------------------|--------|
| 502/504 saat panggil `/api` | Backend mati / tidak di `onboard-net` | Cek container backend & keanggotaan network |
| Halaman putih setelah refresh di sub-route | SPA fallback tidak aktif | Pastikan `try_files … /index.html` |
| Data kosong walau 200 | Gagal dekripsi (`BASE_KEY`/`keyVersion` beda) | Sinkronkan kunci/algoritme dengan backend, rebuild |
| Upload gambar gagal (413) | Body terlalu besar | Naikkan `client_max_body_size` |
| Env tidak berubah | `VITE_*` di-bake saat build | Rebuild dengan `--build-arg` yang benar |

---

## 📑 Riwayat Revisi

| Versi | Tanggal | Penyusun | Deskripsi Perubahan |
|-------|---------|----------|---------------------|
| 1.0.0 | 17 Juli 2026 | | Dibuat dari `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `.env.example`. |

---

*[← Kembali ke IBS Onboarding Admin](README.md)* · *[Daftar Produk](../../README.md)*

*Dibuat otomatis oleh **Analyst CLI**.*
