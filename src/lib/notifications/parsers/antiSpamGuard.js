import { toSafeNumber } from '../../utils'
import { db } from '../../db'

/**
 * Deterministic Anti-Spam & Promo Guardrail
 * Accurately screens out marketing clickbaits, engagement notifications, OTPs, and discounts.
 */
export function isFinancialMutation(title = '', text = '', packageName = '') {
  const rawCombined = `${title} ${text} ${packageName}`
  const combined = rawCombined.toLowerCase()
  if (!combined.trim()) return false

  // 1. Guardrail: Question Marks
  // Legitimate banking ledger receipts are strictly factual assertions, never marketing hook questions.
  if (title.includes('?') || text.includes('?')) {
    return false
  }

  // 2. Guardrail: Marketing / Promo Hype Emojis
  // Filter out marketing hype emojis while allowing common celebratory transaction emojis attached to receipts
  if (/[\u{1F525}\u{1F449}\u{1F911}\u{1F929}\u{1F680}]/u.test(title + ' ' + text)) {
    return false
  }

  // 3. Guardrail: Comprehensive Blacklist of Marketing, Promos, OTP, and Security Alerts
  const promoBlacklist = [
    'cek caranya',
    'cek cara',
    'cek di sini',
    'klik di sini',
    'klaim di sini',
    'promo di sini',
    'buka di sini',
    'bisa terima',
    'terima saldo gratis',
    'saldo gratis',
    'gratis saldo',
    'mau hemat',
    'hemat berkali-kali',
    's/d',
    's.d.',
    'hingga',
    'up to',
    'buruan',
    'jangan lewatkan',
    'khusus hari ini',
    'hanya hari ini',
    'kesempatan emas',
    'raih',
    'menangkan',
    'klaim',
    'klaim hadiah',
    'klaim saldo',
    'bonus saldo',
    'bonus ',
    'dapatkan',
    'ajak teman',
    'undang teman',
    'referral',
    'pesta',
    'flash sale',
    'payday',
    'belanja seru',
    'pinjaman',
    'paylater',
    'limit kredit',
    'aktivasi',
    'ajukan',
    'promo',
    'diskon',
    'voucher',
    'kupon',
    'poin reward',
    'cashback s.d',
    'cashback s/d',
    'cashback hingga',
    'koin',
    'gratis ongkir',
    'live stream',
    'undian',
    'berhadiah',
    'kode otp',
    'otp anda',
    'verifikasi login',
    'peringatan keamanan',
    'perangkat baru terdeteksi',
    'reset pin',
    'ganti password',
    'syarat & ketentuan',
    's&k berlaku',
    'kode rahasia',
    'jangan berikan',
    'kode verifikasi',
    'kode autentikasi',
    'verification code',
    'secret code',
    'one time password',
    'security code',
    'link berikut',
    'tautan berikut',
    'http://',
    'https://',
    'klik link',
    'penawaran kta',
    'kta kilat',
    'dana tunai',
    'pinjaman kilat',
    'bunga ringan',
    'butuh dana',
  ]

  const hasStrongFinancialIndicator = /(?:berhasil|sukses|total\s+bayar|pembayaran\s+sebesar|transfer\s+berhasil|transaksi\s+berhasil|trsf\s+e-banking|kamu\s+menerima|uang\s+masuk|menerima\s+transfer|pembayaran\s+rp)/i.test(combined)
  const receiptTolerantPromoWords = ['promo', 'diskon', 'voucher', 'kupon']
  const effectivePromoBlacklist = hasStrongFinancialIndicator
    ? promoBlacklist.filter((b) => !receiptTolerantPromoWords.includes(b))
    : promoBlacklist

  if (effectivePromoBlacklist.some((b) => combined.includes(b))) {
    return false
  }

  // 4. Guardrail: Reject promotional shorthand suffixes attached to currency (e.g. "Rp1 0rb", "Rp 50rb", "Rp 10k")
  if (/(?:rp|idr)\.?\s*\d+\s*(?:0?rb|k|jt)\b/i.test(rawCombined)) {
    return false
  }

  // 5. Must contain valid monetary pattern (e.g. Rp 10.000, IDR 50.000, or Banking DB/CR format like "TRSF E-BANKING DB 50.000,00")
  let amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
  if (!amtMatch) {
    const bankDbCrMatch = combined.match(/(?:(?:trsf\s+e-banking|transfer)\s+)?(?:db|cr|debet|kredit)\s+([\d.,]+)/i)
    if (bankDbCrMatch) {
      amtMatch = bankDbCrMatch
    }
  }
  if (!amtMatch) return false

  const rawAmount = toSafeNumber(amtMatch[1].replace(/[^0-9]/g, ''))
  // Genuine banking/e-wallet transaction amounts in IDR are at least Rp 100
  if (rawAmount < 100) {
    return false
  }

  // 6. Guardrail: Reject Failed, Cancelled, Expired, Rejected Transactions or Unpaid Reminders
  const negativeOutcomeKeywords = [
    'gagal',
    'tidak berhasil',
    'belum berhasil',
    'dibatalkan',
    'batal',
    'kadaluarsa',
    'kedaluwarsa',
    'ditolak',
    'expired',
    'menunggu pembayaran',
    'selesaikan pembayaran',
    'tagihan telah terbit',
    'pengingat pembayaran',
    'pengingat tagihan',
    'jatuh tempo',
    'segera bayar',
    'transaksi ditolak',
    'transaksi dibatalkan',
    'pembayaran gagal',
    'transfer gagal',
  ]
  if (negativeOutcomeKeywords.some((w) => combined.includes(w))) {
    return false
  }

  // 7. Must contain concrete positive receipt completion confirmation
  const receiptKeywords = [
    'berhasil',
    'sukses',
    'telah berhasil',
    'berhasil dibayar',
    'berhasil ditransfer',
    'berhasil dikirim',
    'telah ditambahkan',
    'berhasil masuk',
    'uang masuk',
    'transfer masuk',
    'kamu menerima',
    'telah menerima',
    'kirim uang diterima',
    'qris berhasil',
    'pembayaran qris',
    'debit rekening',
    'm-transfer berhasil',
    'transaksi berhasil',
    'pembayaran sebesar',
    'pembayaran rp',
    'transfer keluar berhasil',
    'uang keluar:',
    'uang masuk:',
    'top up berhasil',
    'isi saldo berhasil',
    'transaksi rp',
    'transaksi idr',
    'transaksi di',
    'transaksi pada',
    'transaksi kartu',
    'trx kartu',
    'trx rekening',
    'transaksi rekening',
    'telah didebit',
    'telah di-debit',
    'telah didebet',
    'telah di-debet',
    'telah dikredit',
    'telah di-kredit',
    'telah dikreditkan',
    'telah di-kreditkan',
    'dikreditkan',
    'debet rek',
    'kredit rek',
    'debit rek',
    'kredit rekening',
    'notifikasi debet',
    'notifikasi kredit',
    'd-bca db',
    'd-bca cr',
    'trsf e-banking',
    'trsf e-banking db',
    'trsf e-banking cr',
    'gaji',
    'setoran',
    'kartu kredit bca',
    'kartu mandiri',
    'saldo akhir rp',
    'di edc',
    'kamu telah membayar',
    'telah membayar',
    'kirim uang ke',
    'saldo masuk',
    'masuk ke saldo',
    'saldo bertambah',
    'dapat kiriman',
    'kiriman uang',
    'transaksi selesai',
    'telah selesai',
    'dana kaget',
    'dapat dana kaget',
    'terima dana kaget',
    'dana masuk',
    'dana diterima',
    'penerimaan dana',
    'kamu menerima',
    'berhasil kirim uang',
    'berhasil terkirim',
    'terkirim ke',
    'telah dikirim',
    'pengembalian dana',
    'refund',
    'uang kembali',
    'pengembalian saldo',
  ]
  return receiptKeywords.some((w) => combined.includes(w)) || /\bcr\b/i.test(combined)
}

/**
 * Scans existing transactions for suspect promo/spam mutations that were previously auto-recorded.
 * Matches transactions from notification_listener or notes starting with [Auto:
 * that contain known promotional marketing keywords.
 */
export async function scanSuspectPromoTransactions() {
  const allTxs = await db.transactions.toArray()
  const promoKeywords = [
    'gratis',
    'saldo gratis',
    'promo',
    'hemat',
    's/d',
    's.d.',
    'hingga',
    'cek caranya',
    'bisa terima',
    'voucher',
    'diskon',
    'cashback s',
    'undian',
    'hadiah',
    'klaim',
    'ajak teman',
    'di sini',
    '\u{1F525}',
    '\u{1F449}',
  ]

  return allTxs.filter((tx) => {
    if (tx.deletedAt) return false
    const isAuto = tx.source === 'notification_listener' || (typeof tx.notes === 'string' && tx.notes.startsWith('[Auto:'))
    if (!isAuto) return false

    const text = `${tx.notes || ''} ${tx.category || ''}`.toLowerCase()
    return promoKeywords.some((k) => text.includes(k))
  })
}

/**
 * Cleans suspect promo transactions by ID, safely restoring wallet balances and ledger states.
 */
export async function cleanSuspectPromoTransactions(txIds = []) {
  if (!Array.isArray(txIds) || txIds.length === 0) return { deletedCount: 0 }
  const { deleteTransaction } = await import('../../../services/transactionService')

  let deletedCount = 0
  for (const id of txIds) {
    try {
      await deleteTransaction(id)
      deletedCount++
    } catch (err) {
      console.error('[cleanSuspectPromoTransactions] Failed to delete tx', id, err)
    }
  }
  return { deletedCount }
}
