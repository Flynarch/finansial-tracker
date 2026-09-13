/**
 * Pure JavaScript utility functions for cleaning merchant names and categorizing descriptions.
 * Zero external dependencies (avoids pulling in PDF.js or PapaParse into root bundle).
 */

/**
 * Cleans cryptic bank transfer/teller codes and extracts readable merchant name.
 * Example: "TRSF E-BANKING DB 2808/FTSCY/WS95011 KOPI KENANGAN JAKARTA" -> "Kopi Kenangan Jakarta"
 * @param {string} rawText
 * @returns {string}
 */
export function cleanMutationMerchant(rawText = '') {
  if (!rawText) return 'Transaksi'

  let cleaned = String(rawText)
    // Remove bank prefix boilerplate
    .replace(/^TRSF\s+E-BANKING\s+(DB|CR)/i, '')
    .replace(/^TRSF\s+KE\s+REK\s*\d*/i, '')
    .replace(/^TRANSFER\s+KE\s+REK\s*\d*/i, '')
    .replace(/^TRANSFER\s+(KE|DARI)\s*\d*/i, '')
    .replace(/^BIAYA\s+ADM(IN)?\s*/i, 'Biaya Admin ')
    .replace(/^SWITCHING\s+(DB|CR)/i, '')
    .replace(/^BI-FAST\s+(DB|CR)/i, '')
    .replace(/^QRIS\s+(PEMBAYARAN|PURCHASE)/i, '')
    .replace(/^TOP\s*UP\s+/i, 'Top Up ')
    .replace(/^M-BCA\s+/i, '')
    .replace(/^MANDIRI\s+ONLINE\s+/i, '')
    .replace(/^QR\s+PAYMENT\s+/i, '')
    // Remove reference numbers like 2808/FTSCY/WS95011 or 00000012345
    .replace(/\b\d{2,4}\/[A-Z0-9_\-/]+\b/gi, '')
    .replace(/\b(WS|FT|TX|REF)\d+\b/gi, '')
    .replace(/\b\d{10,20}\b/g, '')
    // Remove excess punctuation and spaces
    .replace(/[;:#*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned || cleaned.length < 2) {
    return rawText.slice(0, 40)
  }

  // Capitalize words nicely
  return cleaned
    .split(' ')
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

/**
 * Smart automatic category determination from mutation description.
 * @param {string} cleanDescription
 * @param {'expense'|'income'} type
 * @returns {string}
 */
export function matchCategoryFromDescription(cleanDescription = '', type = 'expense') {
  const norm = cleanDescription.toLowerCase()

  if (type === 'income') {
    if (norm.includes('gaji') || norm.includes('salary') || norm.includes('payroll')) return 'gaji/gaji_pokok'
    if (norm.includes('bonus') || norm.includes('insentif')) return 'gaji/bonus'
    if (norm.includes('bunga') || norm.includes('interest')) return 'investasi/bunga'
    if (norm.includes('dividen')) return 'investasi/dividen'
    if (norm.includes('freelance') || norm.includes('proyek')) return 'bisnis/freelance'
    if (norm.includes('jual') || norm.includes('penjualan')) return 'bisnis/penjualan'
    return 'lainnya/pemasukan_lain'
  }

  // Expense matching
  if (norm.includes('kopi') || norm.includes('starbucks') || norm.includes('kenangan') || norm.includes('cafe') || norm.includes('fore')) {
    return 'makanMinum/kopi'
  }
  if (norm.includes('resto') || norm.includes('makan') || norm.includes('gofood') || norm.includes('grabfood') || norm.includes('shopeefood') || norm.includes('bakso') || norm.includes('ayam')) {
    return 'makanMinum/restoran'
  }
  if (norm.includes('indomaret') || norm.includes('alfamart') || norm.includes('supermarket') || norm.includes('hypermart') || norm.includes('pasar')) {
    return 'belanja/kebutuhan_pokok'
  }
  if (norm.includes('pln') || norm.includes('listrik')) return 'tagihan/listrik'
  if (norm.includes('pdam') || norm.includes('air')) return 'tagihan/air'
  if (norm.includes('indihome') || norm.includes('wifi') || norm.includes('internet') || norm.includes('biznet') || norm.includes('myrepublic')) return 'tagihan/internet'
  if (norm.includes('pulsa') || norm.includes('telkomsel') || norm.includes('indosat') || norm.includes('xl')) return 'tagihan/pulsa'
  if (norm.includes('bensin') || norm.includes('pertamina') || norm.includes('shell') || norm.includes('spbu')) return 'transportasi/bensin'
  if (norm.includes('grab') || norm.includes('gojek') || norm.includes('maxim') || norm.includes('taxi')) return 'transportasi/transportasi_online'
  if (norm.includes('biaya admin') || norm.includes('adm')) return 'keuangan/biaya_admin'
  if (norm.includes('sewa') || norm.includes('kost') || norm.includes('kontrakan')) return 'tempatTinggal/sewa'
  if (norm.includes('netflix') || norm.includes('spotify') || norm.includes('bioskop') || norm.includes('xxi')) return 'hiburan/langganan'

  return 'lainnya/pengeluaran_lain'
}
