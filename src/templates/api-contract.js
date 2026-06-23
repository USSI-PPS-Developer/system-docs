'use strict';

const { header, footer } = require('./_shared');

module.exports = function apiContract(productTitle) {
  return `${header({
    docTitle: 'API Contract',
    emoji: '🔌',
    productTitle,
    intro: `Kontrak API (request/response) untuk produk **${productTitle}**.`,
  })}

## 1. Informasi Umum

| Item | Nilai |
|------|-------|
| Base URL (Dev)  | \`https://dev.example.com/api\` |
| Base URL (Prod) | \`https://api.example.com\` |
| Versi API | \`v1\` |
| Format | JSON (UTF-8) |
| Autentikasi | _mis. Bearer Token / API Key / OAuth2 / mTLS_ |

## 2. Konvensi

### 2.1 Header Standar
| Header | Wajib | Contoh |
|--------|-------|--------|
| \`Authorization\` | Ya | \`Bearer <token>\` |
| \`Content-Type\` | Ya | \`application/json\` |
| \`X-Request-ID\` | Ya | \`uuid-v4\` |

### 2.2 Format Response Standar
\`\`\`json
{
  "responseCode": "00",
  "responseMessage": "Success",
  "data": {}
}
\`\`\`

## 3. Daftar Endpoint

| No | Method | Endpoint | Deskripsi |
|----|--------|----------|-----------|
| 1  | \`POST\` | \`/v1/...\` | _..._ |

---

## 4. Detail Endpoint

### 4.1 \`POST /v1/...\`

> _Deskripsi singkat endpoint._

**Request Body**
\`\`\`json
{
  "field1": "string",
  "amount": 100000
}
\`\`\`

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| \`field1\` | string | Ya | |
| \`amount\` | number | Ya | |

**Response — 200 OK**
\`\`\`json
{
  "responseCode": "00",
  "responseMessage": "Success",
  "data": { "referenceNo": "TRX123" }
}
\`\`\`

**Kemungkinan Error**
| HTTP | responseCode | Arti |
|------|--------------|------|
| 400 | 01 | Bad Request / validasi gagal |
| 401 | 02 | Tidak terautentikasi |
| 500 | 99 | Kesalahan server |

## 5. Kode Response Global

| responseCode | Arti |
|--------------|------|
| 00 | Sukses |
| 01 | Permintaan tidak valid |
| 02 | Autentikasi gagal |
| 03 | Tidak diizinkan |
| 99 | Kesalahan sistem |
${footer(productTitle)}`;
};
