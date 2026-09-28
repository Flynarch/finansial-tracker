/**
 * Pure JavaScript utility functions for cleaning merchant names and categorizing descriptions.
 * Zero external dependencies (avoids pulling in PDF.js or PapaParse into root bundle).
 */

/**
 * Masks sensitive bank account and credit card numbers for zero-knowledge data privacy.
 * Example: "Debit Rek. 1234567890 Rp 50.000" -> "Debit Rek. ****7890 Rp 50.000"
 * @param {string} text
 * @returns {string}
 */
export function maskFinancialAccountNumbers(text = '') {
  if (!text) return ''
  return String(text)
    // 16-digit credit/debit card numbers with optional dashes/spaces
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?(\d{4})\b/g, '****-****-****-$1')
    // 10 to 14 digit bank account numbers
    .replace(/\b(?:\d{2,4})[-]?\d{4,8}[-](\d{4})\b/g, '****$1')
    .replace(/\b\d{6,14}(\d{4})\b/g, '****$1')
}

/**
 * Cleans cryptic bank transfer/teller codes and extracts readable merchant name.
 * Example: "TRSF E-BANKING DB 2808/FTSCY/WS95011 KOPI KENANGAN JAKARTA" -> "Kopi Kenangan Jakarta"
 * @param {string} rawText
 * @returns {string}
 */
export function cleanMutationMerchant(rawText = '') {
  if (!rawText) return 'Transaksi'

  let cleaned = String(rawText)
    // Strip AI predicted category tags
    .replace(/\[kategori diprediksi ai\]/gi, '')
    // Strip trailing balance info e.g. " Saldo Akhir Rp 2.500.000"
    .replace(/\s+saldo\s+akhir.*$/i, '')

  // Multi-pass loop: strip leading shortcodes, headers, timestamps, and mutation markers
  for (let pass = 0; pass < 3; pass++) {
    cleaned = cleaned
      // Strip leading shortcodes e.g. '69888: ', '83355 ', '+6269888 '
      .replace(/^(?:\+?62)?(?:69888|83355|3355|3300|3346|1418|3399|3377)\s*[-:]?\s*/i, '')
      // Strip leading timestamps e.g. '27/09 18:30 ' or '27/09 ' or '27/09/2026 18:30:00 '
      .replace(/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s+\d{2}:\d{2}(?::\d{2})?)?\s*[-:]?\s*/i, '')
      // Strip bank notification & SMS headers
      .replace(/^(?:m-bca|mybca|bank\s*bca|bca|livin(?:\s*by\s*mandiri)?|bank\s*mandiri|mandiri|wondr(?:\s*by\s*bni)?|bank\s*bni|bni|brimo|bank\s*bri|bri(?:-info)?|bsi\s*mobile|bank\s*syariah\s*indonesia|bsi|octo\s*mobile|octo\s*card|cimb\s*niaga|cimb|line\s*bank|seabank|bank\s*jago|blu|jenius|permatabank|permata|danamon|bank\s*mega|mega|citibank|hsbc|dana|ovo|gopay|shopeepay)\s*[-:]?\s*/i, '')
      .replace(/^d-bca\s+(?:db|cr)\s+/i, '')
      .replace(/^m-bca:\s*\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\s+/i, '')
      .replace(/^(?:sms\s+)?notifikasi\s*(?:debet|kredit|transaksi)?\s*[-:]?\s*/i, '')
      .replace(/^(?:trx|transaksi)\s+(?:kartu(?:\s+(?:kredit|debit|mandiri|bca|bri|bni|mega))?\s*(?:\d{4})?|rekening\s*(?:\d+)?|rek\s*(?:\d+)?)?\s*(?:berakhir\s+\d+)?\s*[-:]?\s*/i, '')
      .replace(/^(?:debit|debet|kredit|cr|db)\s+(?:rekening\s*(?:\d+)?\s*|rek\s*(?:\d+)?\s*)?/i, '')
      .trim()
  }

  cleaned = cleaned
    // Remove bank & mutation prefix boilerplate
    .replace(/^TRSF\s+E-BANKING\s+(DB|CR)/i, '')
    .replace(/^TRSF\s+KE\s+REK\s*\d*/i, '')
    .replace(/^TRANSFER\s+KE\s+REK\s*\d*/i, '')
    .replace(/^TRANSFER\s+(KE|DARI)\s*\d*/i, '')
    .replace(/^TRANSFER\s+(MASUK|KELUAR)\s*/i, '')
    .replace(/^BIAYA\s+ADM(IN)?\s*/i, 'Biaya Admin ')
    .replace(/^SWITCHING\s+(DB|CR)/i, '')
    .replace(/^BI-FAST\s+(DB|CR)/i, '')
    .replace(/^QRIS\s+(PEMBAYARAN|PURCHASE)/i, '')
    .replace(/^PEMBAYARAN\s+(QRIS|TAGIHAN)?\s*/i, '')
    .replace(/^TOP\s*UP\s+(SALDO\s+)?/i, 'Top Up ')
    .replace(/^ISI\s+SALDO\s+/i, 'Isi Saldo ')
    .replace(/^M-BCA\s+/i, '')
    .replace(/^M-TRANSFER\s+(BERHASIL\.?\s*)?(TRANSFER\s+)?/i, '')
    .replace(/^MANDIRI\s+ONLINE\s+/i, '')
    .replace(/^QR\s+PAYMENT\s+/i, '')
    .replace(/^KAMU\s+MENERIMA\s+(TRANSFER\s+)?(DANA\s+)?/i, '')
    .replace(/^KAMU\s+(TELAH\s+BERHASIL|TELAH|BERHASIL)?\s*(TRANSFER|MENGIRIM|BAYAR|MEMBAYAR|KIRIM)\s+(KE|DI)?\s*/i, '')
    .replace(/^KANTONG\s+UTAMA\s+(BERKURANG\s+UNTUK\s+PEMBAYARAN\s+DI|BERTAMBAH\s+DARI)\s*/i, '')
    .replace(/^(UANG\s+MASUK|UANG\s+KELUAR|MONEY\s+OUT)\s*:\s*/i, '')
    .replace(/\bberakhir\s+\d+\b/gi, '')
    .replace(/\brek(?:ening)?\s*\d*\b/gi, '')
    .replace(/\bkartu\s+(?:(?:kredit|debit)\s+)?(?:mega|bca|mandiri|bni|bri)?\s*\d*\b/gi, '')
    .replace(/\btelah\s+di-(?:debet|kredit|debit|debitkan|kreditkan)\b/gi, '')
    .replace(/\btelah\s+(?:didebet|dikredit|didebit|didebitkan|dikreditkan)\b/gi, '')
    .replace(/\buntuk\s+transaksi\s+(?:di|ke)\b/gi, ' ')
    .replace(/\buntuk\s+transaksi\b/gi, ' ')
    // Remove dates inside text like "Tgl 27/09/26 14:20" or "pada 27/09"
    .replace(/\b(?:tgl\.?|pada|tanggal)\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s+\d{2}:\d{2}(?::\d{2})?)?\b/gi, '')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, '')
    .replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, '')
    // Remove embedded currency amounts like "Rp 45.000" or "Rp35.000" or "sebesar Rp 100.000"
    .replace(/(?:sebesar\s+)?(?:rp|idr)\.?\s*[\d.,]+/gi, ' ')
    // Remove masked account numbers (e.g. ****7890 or ****-****-****-1234)
    .replace(/\*{2,}[-\s]?\d+/g, '')
    .replace(/\b\*{4,}\b/g, '')
    // Remove reference numbers like 2808/FTSCY/WS95011 or 00000012345
    .replace(/\b\d{2,4}\/[A-Z0-9_\-/]+\b/gi, '')
    .replace(/\b(WS|FT|TX|REF)\d+\b/gi, '')
    .replace(/\b\d{8,20}\b/g, '')
    // Remove bank receipt status words
    .replace(/\b(berhasil|sukses|telah berhasil|telah selesai)\b/gi, '')
    // Remove excess punctuation and spaces BEFORE preposition stripping
    .replace(/[;:#*~=]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Remove dangling prepositions at start or end
    .replace(/^(?:ke|di|dari|pada)\s+/i, '')
    .replace(/\s+(?:ke|di|dari|pada)$/i, '')
    .trim()

  if (!cleaned || cleaned.length < 2) {
    return rawText.slice(0, 40)
  }

  // Capitalize words nicely
  return cleaned
    .split(' ')
    .map((w) => (w.length >= 2 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

/**
 * Smart automatic category determination strictly adhering to EXPENSE_TREE and INCOME_TREE schema.
 * @param {string} cleanDescription
 * @param {'expense'|'income'} type
 * @returns {string} Hierarchical category string "parentId/childId"
 */
export function matchCategoryFromDescription(cleanDescription = '', type = 'expense') {
  const norm = cleanDescription.toLowerCase()

  if (type === 'income') {
    if (norm.includes('gaji') || norm.includes('salary') || norm.includes('payroll')) return 'gaji/gaji_pokok'
    if (norm.includes('bonus') || norm.includes('insentif') || norm.includes('thr')) return 'bonus/thr'
    if (norm.includes('cashback') || norm.includes('refund') || norm.includes('pengembalian')) return 'bonus/cashback'
    if (norm.includes('hadiah') || norm.includes('kado')) return 'bonus/hadiah'
    if (norm.includes('bunga') || norm.includes('interest')) return 'investasi/bunga_bank'
    if (norm.includes('dividen')) return 'investasi/dividen'
    if (norm.includes('freelance') || norm.includes('proyek') || norm.includes('honor')) return 'bisnis/freelance'
    if (norm.includes('jual') || norm.includes('penjualan') || norm.includes('omset') || norm.includes('toko')) return 'bisnis/penjualan'
    if (norm.includes('komisi')) return 'bisnis/komisi'
    return 'lainnya/umum'
  }

  // Expense matching strictly to EXPENSE_TREE
  if (
    norm.includes('kopi') ||
    norm.includes('starbucks') ||
    norm.includes('kenangan') ||
    norm.includes('cafe') ||
    norm.includes('fore') ||
    norm.includes('chatime') ||
    norm.includes('mixue') ||
    norm.includes('janji jiwa') ||
    norm.includes('point coffee')
  ) {
    return 'makanan/kopi'
  }
  if (
    norm.includes('resto') ||
    norm.includes('makan') ||
    norm.includes('gofood') ||
    norm.includes('grabfood') ||
    norm.includes('shopeefood') ||
    norm.includes('bakso') ||
    norm.includes('ayam') ||
    norm.includes('solaria') ||
    norm.includes('mcdonald') ||
    norm.includes('mcd') ||
    norm.includes('kfc') ||
    norm.includes('burger') ||
    norm.includes('pizza') ||
    norm.includes('hokben') ||
    norm.includes('mie') ||
    norm.includes('warung') ||
    norm.includes('warteg') ||
    norm.includes('dapur') ||
    norm.includes('sate') ||
    norm.includes('roti')
  ) {
    return 'makanan/makan_diluar'
  }
  if (
    norm.includes('indomaret') ||
    norm.includes('alfamart') ||
    norm.includes('supermarket') ||
    norm.includes('hypermart') ||
    norm.includes('pasar') ||
    norm.includes('superindo') ||
    norm.includes('lotte') ||
    norm.includes('sayur') ||
    norm.includes('tokopedia') ||
    norm.includes('shopee') ||
    norm.includes('lazada') ||
    norm.includes('blibli') ||
    norm.includes('tiktok shop')
  ) {
    return 'kebutuhan_harian/belanja_bulanan'
  }
  if (norm.includes('pln') || norm.includes('listrik')) return 'tagihan/listrik'
  if (norm.includes('pdam') || norm.includes('air')) return 'tagihan/air'
  if (
    norm.includes('indihome') ||
    norm.includes('wifi') ||
    norm.includes('internet') ||
    norm.includes('biznet') ||
    norm.includes('myrepublic') ||
    norm.includes('first media')
  ) {
    return 'tagihan/internet'
  }
  if (
    norm.includes('pulsa') ||
    norm.includes('paket data') ||
    norm.includes('telkomsel') ||
    norm.includes('indosat') ||
    norm.includes('xl') ||
    norm.includes('smartfren') ||
    norm.includes('tri') ||
    norm.includes('by.u')
  ) {
    return 'tagihan/paket_data'
  }
  if (
    norm.includes('netflix') ||
    norm.includes('spotify') ||
    norm.includes('youtube') ||
    norm.includes('langganan') ||
    norm.includes('icloud') ||
    norm.includes('chatgpt')
  ) {
    return 'tagihan/langganan'
  }
  if (norm.includes('asuransi') || norm.includes('bpjs')) return 'tagihan/asuransi'
  if (norm.includes('cicilan') || norm.includes('paylater') || norm.includes('pinjaman') || norm.includes('sewa') || norm.includes('kost')) {
    return 'tagihan/cicilan'
  }
  if (norm.includes('bensin') || norm.includes('pertamina') || norm.includes('shell') || norm.includes('spbu') || norm.includes('bp akr')) {
    return 'transportasi/bensin'
  }
  if (norm.includes('grab') || norm.includes('gojek') || norm.includes('maxim') || norm.includes('ride') || norm.includes('ojol')) {
    return 'transportasi/ojol'
  }
  if (norm.includes('taxi') || norm.includes('bluebird')) {
    return 'transportasi/taksi'
  }
  if (norm.includes('parkir') || norm.includes('parking')) {
    return 'transportasi/parkir'
  }
  if (norm.includes('tol') || norm.includes('e-toll')) {
    return 'transportasi/tol'
  }
  if (norm.includes('kai') || norm.includes('kereta') || norm.includes('krl') || norm.includes('mrt') || norm.includes('lrt')) {
    return 'transportasi/kereta'
  }
  if (norm.includes('tiket.com') || norm.includes('traveloka') || norm.includes('bus') || norm.includes('bis')) {
    return 'transportasi/bis'
  }
  if (
    norm.includes('apotek') ||
    norm.includes('kimia farma') ||
    norm.includes('guardian') ||
    norm.includes('watsons') ||
    norm.includes('halodoc') ||
    norm.includes('alodokter') ||
    norm.includes('obat')
  ) {
    return 'kesehatan/obat'
  }
  if (norm.includes('dokter') || norm.includes('klinik') || norm.includes('rumah sakit')) {
    return 'kesehatan/dokter'
  }
  if (norm.includes('bioskop') || norm.includes('xxi') || norm.includes('cgv') || norm.includes('cinema')) {
    return 'kultur/bioskop'
  }
  if (norm.includes('steam') || norm.includes('playstation') || norm.includes('games') || norm.includes('nintendo')) {
    return 'kultur/games'
  }
  if (norm.includes('baju') || norm.includes('celana') || norm.includes('sepatu') || norm.includes('zalora')) {
    return 'pakaian/baju'
  }
  if (norm.includes('skincare') || norm.includes('salon') || norm.includes('barbershop') || norm.includes('makeup')) {
    return 'kecantikan/skincare'
  }
  if (norm.includes('laundry') || norm.includes('cuci baju')) {
    return 'kebutuhan_harian/laundry'
  }
  if (norm.includes('sedekah') || norm.includes('donasi') || norm.includes('zakat') || norm.includes('infaq') || norm.includes('kitabisa')) {
    return 'kehidupan_sosial/amal_donasi'
  }
  if (norm.includes('biaya admin') || norm.includes('adm') || norm.includes('pajak')) {
    return 'lainnya_kategori/pajak'
  }

  return 'lainnya_kategori/umum'
}
