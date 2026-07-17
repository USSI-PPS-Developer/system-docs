# 📦 IBS Onboarding Admin

> Dokumentasi lengkap produk **IBS Onboarding Admin** — dashboard back-office (frontend) untuk operator BPR mengelola onboarding nasabah IBS.

| Field           | Detail            |
|-----------------|-------------------|
| Produk          | IBS Onboarding Admin |
| Slug            | `ibs-onboarding-admin` |
| Repo            | `admin-onboard` (React + TypeScript + Vite) |
| Backend terkait | [IBS Onboarding Backend](../ibs-onboarding-backend/README.md) |
| Kelengkapan Dok | 6/11 (55%) |
| Terakhir update | 17 Juli 2026    |

---

## 📚 Daftar Dokumen

| No | Dokumen | Status |
|----|---------|--------|
| 01 | [📄 BRD — Business Requirement Document](01-brd.md) | 🟡 Draft |
| 02 | [📐 SRS — Software Requirements Specification](02-srs.md) | 🟡 Draft |
| 03 | [🔌 API Integration / Consumption Reference](03-api-contract.md) | 🟡 Draft |
| 04 | 🗄️ Desain Database | ➖ N/A (SPA, tanpa DB) |
| 05 | [🎨 Desain UI/UX](05-uiux-design.md) | 🟡 Draft |
| 06 | 🧪 Test Plan | ⬜ Belum dibuat |
| 07 | ✅ Test Case | ⬜ Belum dibuat |
| 08 | 🔗 SIT Documentation | ⬜ Belum dibuat |
| 09 | 🧾 UAT | ⬜ Belum dibuat |
| 10 | [🚀 Deployment Guide](10-deployment-guide.md) | 🟡 Draft |
| 11 | [📖 User Manual](11-user-manual.md) | 🟡 Draft |

> **Catatan pemilihan dokumen.** Produk ini adalah **frontend SPA** yang mengonsumsi API
> `ibs-onboarding-backend`, sehingga:
> - **04 — Desain Database** ditandai **N/A**: aplikasi tidak punya basis data sendiri;
>   state disimpan di **Zustand + `localStorage`**, seluruh data berasal dari API backend.
> - **03 — API Contract** di-*reframe* menjadi **API Integration / Consumption Reference**:
>   kontrak request/response kanonik dimiliki backend
>   ([lihat kontrak backend](../ibs-onboarding-backend/03-api-contract.md)); dokumen di sini
>   memetakan **endpoint mana yang di-*fire* tiap halaman admin**.
>
> Dokumen tanpa tautan belum dibuat. Generate dengan:
> `analyst add <jenis> -p "IBS Onboarding Admin"`

---

*[← Kembali ke Daftar Produk](../../README.md)*

*Dikelola oleh **Analyst CLI**.*
