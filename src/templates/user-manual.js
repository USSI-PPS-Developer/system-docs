'use strict';

const { header, footer } = require('./_shared');

module.exports = function userManual(productTitle) {
  return `${header({
    docTitle: 'User Manual',
    emoji: '📖',
    productTitle,
    intro: `Panduan penggunaan produk **${productTitle}** untuk pengguna akhir.`,
  })}

## 1. Pendahuluan
_Penjelasan singkat tentang **${productTitle}** dan manfaatnya bagi pengguna._

## 2. Persyaratan Akses

| Item | Detail |
|------|--------|
| URL Aplikasi | |
| Browser yang didukung | _mis. Chrome, Edge terbaru_ |
| Akun / Hak akses | _cara mendapatkan akun_ |

## 3. Cara Login
1. Buka URL aplikasi.
2. Masukkan **username** dan **password**.
3. Klik **Masuk**.

> _Lampirkan tangkapan layar:_ \`![Login](assets/login.png)\`

## 4. Panduan Fitur

### 4.1 _Nama Fitur_
**Tujuan:** _untuk apa fitur ini._

**Langkah-langkah:**
1. _Klik menu ..._
2. _Isi data ..._
3. _Klik tombol ..._

**Hasil:** _yang terjadi setelahnya._

> _Lampirkan tangkapan layar tiap langkah._

---

## 5. FAQ (Pertanyaan Umum)

| Pertanyaan | Jawaban |
|------------|---------|
| _Lupa password?_ | _Hubungi admin / fitur reset_ |

## 6. Troubleshooting

| Masalah | Kemungkinan Penyebab | Solusi |
|---------|----------------------|--------|
| Tidak bisa login | Password salah | Reset password |
| Halaman error | Sesi habis | Login ulang |

## 7. Glosarium

| Istilah | Penjelasan |
|---------|------------|
| | |

## 8. Bantuan & Dukungan
- **Helpdesk:** _email / nomor_
- **Jam layanan:** _..._
${footer(productTitle)}`;
};
