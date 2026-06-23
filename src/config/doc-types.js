'use strict';

/**
 * Registry tunggal untuk semua jenis dokumen SDLC.
 * Tambah/ubah jenis dokumen cukup di sini — command & README otomatis ikut.
 *
 *  key      : id command (analyst add <key>)
 *  aliases  : alias lain yang diterima command
 *  order    : urutan + prefix nomor file (01-, 02-, ...)
 *  file     : nama file output
 *  label    : label tampil di README (dengan emoji)
 *  short    : nama pendek untuk tabel/list
 *  generate : fungsi(productTitle, productSlug) → isi markdown
 */
const DOC_TYPES = [
  { key: 'brd',              aliases: [],                 order: 1,  short: 'BRD',              label: '📄 BRD — Business Requirement Document', generate: require('../templates/brd') },
  { key: 'srs',              aliases: [],                 order: 2,  short: 'SRS',              label: '📐 SRS — Software Requirements Specification', generate: require('../templates/srs') },
  { key: 'api-contract',     aliases: ['api'],            order: 3,  short: 'API Contract',     label: '🔌 API Contract', generate: require('../templates/api-contract') },
  { key: 'database-design',  aliases: ['db', 'db-design'],order: 4,  short: 'Desain Database',  label: '🗄️ Desain Database', generate: require('../templates/database-design') },
  { key: 'uiux-design',      aliases: ['uiux', 'ui'],     order: 5,  short: 'Desain UI/UX',     label: '🎨 Desain UI/UX', generate: require('../templates/uiux-design') },
  { key: 'test-plan',        aliases: [],                 order: 6,  short: 'Test Plan',        label: '🧪 Test Plan', generate: require('../templates/test-plan') },
  { key: 'test-case',        aliases: ['tc'],             order: 7,  short: 'Test Case',        label: '✅ Test Case', generate: require('../templates/test-case') },
  { key: 'sit',              aliases: [],                 order: 8,  short: 'SIT',              label: '🔗 SIT Documentation', generate: require('../templates/sit') },
  { key: 'uat',              aliases: [],                 order: 9,  short: 'UAT',              label: '🧾 UAT', generate: require('../templates/uat') },
  { key: 'deployment-guide', aliases: ['deploy'],         order: 10, short: 'Deployment Guide', label: '🚀 Deployment Guide', generate: require('../templates/deployment-guide') },
  { key: 'user-manual',      aliases: ['manual'],         order: 11, short: 'User Manual',      label: '📖 User Manual', generate: require('../templates/user-manual') },
];

/** nama file: "01-brd.md" */
function fileNameOf(doc) {
  return `${String(doc.order).padStart(2, '0')}-${doc.key}.md`;
}

/** cari jenis dokumen dari key atau alias (case-insensitive) */
function resolveDocType(input) {
  const k = String(input).toLowerCase().trim();
  return DOC_TYPES.find(
    (d) => d.key === k || d.aliases.includes(k)
  );
}

module.exports = { DOC_TYPES, fileNameOf, resolveDocType };
