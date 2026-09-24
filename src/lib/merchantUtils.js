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
    // Strip AI predicted category tags
    .replace(/\[kategori diprediksi ai\]/gi, '')
    // Remove bank notification app headers
    .replace(/^(?:m-bca|mybca|livin(?:\s*by\s*mandiri)?|wondr(?:\s*by\s*bni)?|brimo|bsi\s*mobile|octo\s*mobile|line\s*bank|seabank|bank\s*jago|blu|jenius|dana|ovo|gopay|shopeepay)\s*[-:]?\s*/i, '')
    .replace(/^m-bca:\s*\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\s+/i, '')
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
    // Remove embedded currency amounts like "Rp 45.000" or "Rp35.000" or "sebesar Rp 100.000"
    .replace(/(?:sebesar\s+)?(?:rp|idr)\.?\s*[\d.,]+/gi, ' ')
    // Remove reference numbers like 2808/FTSCY/WS95011 or 00000012345
    .replace(/\b\d{2,4}\/[A-Z0-9_\-/]+\b/gi, '')
    .replace(/\b(WS|FT|TX|REF)\d+\b/gi, '')
    .replace(/\b\d{10,20}\b/g, '')
    // Remove bank receipt status words
    .replace(/\b(berhasil|sukses|telah berhasil)\b/gi, '')
    // Remove dangling prepositions at start or end
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(ke|di|dari)\s+/i, '')
    .replace(/\s+(ke|di|dari)$/i, '')
    // Remove excess punctuation and spaces
    .replace(/[;:#*~]+/g, ' ')
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
