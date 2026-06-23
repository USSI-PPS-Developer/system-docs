'use strict';

const { header, footer } = require('./_shared');

module.exports = function deploymentGuide(productTitle) {
  return `${header({
    docTitle: 'Deployment Guide',
    emoji: '🚀',
    productTitle,
    intro: `Panduan deployment & rilis untuk produk **${productTitle}**.`,
  })}

## 1. Prasyarat (Prerequisites)

| Item | Versi / Detail |
|------|----------------|
| Runtime | _mis. Java 17 / Node 18_ |
| Database | _mis. MySQL 8 / Oracle_ |
| Dependency lain | _mis. Redis, message broker_ |
| Akses | _kredensial server, VPN, dll_ |

## 2. Arsitektur Deployment

\`\`\`
[Client] → [Load Balancer] → [App Server ${productTitle}] → [Database]
                                       ↘ [Core Banking / Service lain]
\`\`\`

## 3. Konfigurasi Environment

| Variabel | Contoh | Keterangan |
|----------|--------|------------|
| \`APP_PORT\` | \`8080\` | Port aplikasi |
| \`DB_HOST\` | \`10.0.0.5\` | Host database |
| \`DB_USER\` | | |
| \`DB_PASS\` | \`***\` | Disimpan di secret manager |

## 4. Langkah Deployment

\`\`\`bash
# 1. Ambil artifact / source
git pull origin main

# 2. Build
# (sesuaikan dengan stack)

# 3. Migrasi database
# (jalankan script DDL/migration)

# 4. Deploy & start service
\`\`\`

## 5. Verifikasi Pasca-Deploy
- [ ] Service berjalan (health check OK)
- [ ] Koneksi database OK
- [ ] Integrasi ke sistem lain OK
- [ ] Smoke test transaksi utama OK

## 6. Rollback Plan
_Langkah mengembalikan ke versi sebelumnya bila deploy gagal._

\`\`\`bash
# contoh
git checkout <tag-versi-sebelumnya>
# restore database bila perlu
\`\`\`

## 7. Kontak & Eskalasi

| Peran | Nama | Kontak |
|-------|------|--------|
| DevOps | | |
| DBA | | |
| On-call | | |
${footer(productTitle)}`;
};
