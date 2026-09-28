import { WebPlugin, registerPlugin, Capacitor } from '@capacitor/core'
import { format } from 'date-fns'
import { db } from './db'
import { toSafeNumber } from './utils'
import { matchCategoryFromDescription, cleanMutationMerchant, maskFinancialAccountNumbers } from './merchantUtils'
import { invalidateWalletBalance } from './balanceEngine'
import { getRememberedCategory, enrichPendingMutationsWithAi } from './ai/merchantCategorizer'

class FinTrackNotificationWeb extends WebPlugin {
  async isPermissionGranted() {
    return { granted: false }
  }
  async requestPermission() {
    return { success: true }
  }
  async checkSmsPermission() {
    return { receiveGranted: false, readGranted: false }
  }
  async requestSmsPermission() {
    return { success: true }
  }
  async scanHistoricalSms() {
    return { mutations: [] }
  }
  async drainQueuedMutations() {
    return { mutations: [] }
  }
  async getQueuedMutations() {
    return { mutations: [] }
  }
  async clearQueuedMutations() {
    return { success: true }
  }
  async getSupportedInstitutions() {
    return { institutions: [] }
  }
  async updateWidgetData() {
    return { success: true }
  }
}

// Register Native Capacitor Plugin with fallback for Web preview
export const FinTrackNotificationPlugin = registerPlugin('FinTrackNotification', {
  web: () => new FinTrackNotificationWeb(),
})

export function getNotificationTimestamp(val) {
  if (!val) return Date.now()
  const num = Number(val)
  if (Number.isFinite(num) && num > 0) return num
  const d = new Date(val).getTime()
  return Number.isFinite(d) && d > 0 ? d : Date.now()
}

export function parseAmountFromRegexMatch(matchedStr = '') {
  if (!matchedStr) return 0
  const trimmed = String(matchedStr).trim().replace(/[^\d]+$/, '')
  const cleanSen = trimmed.replace(/[,.]00$/, '')
  return toSafeNumber(cleanSen.replace(/[^0-9]/g, ''))
}

/**
 * TIER 1: Deterministic Bank-Specific Regex Parsers (0ms offline, ultra-low battery)
 */
export function parseWithBankRegex(title = '', text = '', packageName = '') {
  const combined = `${title} ${text}`.trim()
  const lowerPkg = (packageName || '').toLowerCase()

  // 1. BCA / myBCA / SMS BCA (excluding Blu by BCA Digital)
  if (((lowerPkg.includes('bca') && !lowerPkg.includes('blu')) || /\b(?:62)?69888\b|d-bca|m-bca|mybca|bank\s*bca/i.test(combined) || /^(?:bank\s*)?bca\b/i.test(title.trim()) || /^bca[:\s]/i.test(text.trim())) && !/blu\b/i.test(combined)) {
    // Expense e.g.: "m-Transfer Berhasil. Transfer Rp 50.000 ke 1234567890 Bpk Budi Santoso", "BCA: Transaksi Rp 120.000 dengan Kartu Kredit"
    // Income e.g.: "Transfer Masuk Rp 1.500.000 dari PT ABC", "BCA: CR 123456 Rp 5.000.000", "27/09 09:15 CR 9876543210 Rp 7.500.000,00 GAJI"
    const isIncome = /(?:masuk|cr\b|terima|(?<!kartu\s+)kredit|setoran)/i.test(combined) && !/(?:debet|db\b|keluar|kartu\s+kredit|pembayaran|transfer\s+ke|d-bca\s+db)/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'BCA',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 2. Mandiri / Livin / SMS Mandiri
  if (lowerPkg.includes('mandiri') || /\b(?:62)?83355\b|livin|bank\s*mandiri/i.test(combined) || /^(?:bank\s*)?mandiri\b/i.test(title.trim()) || /^mandiri[:\s]/i.test(text.trim())) {
    // "Pembayaran Berhasil Rp 45.000 di Kopi Kenangan", "Trx Kartu Mandiri berakhir 1234 sebesar IDR 75.000"
    // "Transfer Masuk Rp 500.000", "Kredit Rek. 123456 sebesar IDR 1.000.000"
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|diterima)/i.test(combined) && !/(?:trx\s+kartu|debet\s+rek|db\b|keluar|transfer\s+ke|pembayaran)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Mandiri Livin',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 3. BRImo / BRI SMS
  if (lowerPkg.includes('bri') || /\b(?:62)?3355\b|brimo|bank\s*bri|bri-info/i.test(combined) || /^(?:bank\s*)?bri(?:-info)?\b/i.test(title.trim()) || /^bri[:\s]/i.test(text.trim())) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|setoran|dikreditkan)/i.test(combined) && !/(?:trx\s+rekening|debet|db\b|keluar|didebet|transfer\s+ke|pembayaran)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'BRImo',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 4. BNI / Wondr / BNI SMS
  if (((lowerPkg.includes('bni') && !lowerPkg.includes('cimb')) || /\b(?:62)?3300\b|wondr|bank\s*bni/i.test(combined) || /^(?:bank\s*)?bni\b/i.test(title.trim()) || /^bni[:\s]/i.test(text.trim())) && !/cimb/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|dikredit)/i.test(combined) && !/(?:debet|db\b|keluar|didebet|kartu\s+kredit|transfer\s+ke|pembayaran)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'BNI',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 5. GoPay / Gojek
  if (lowerPkg.includes('gojek') || lowerPkg.includes('gopay') || /gopay/i.test(combined)) {
    // "Pembayaran Rp35.000 ke Solaria berhasil"
    // "Kamu menerima transfer Rp100.000 dari Andi"
    const isIncome = /menerima|top up|cashback|masuk/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'GoPay',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.95,
        tier: 1,
      }
    }
  }

  // 6. OVO
  if (lowerPkg.includes('ovo') || /ovo/i.test(combined)) {
    const isIncome = /top up|menerima|cashback/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'OVO',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.95,
        tier: 1,
      }
    }
  }

  // 7. DANA
  if (((lowerPkg.includes('dana') && !lowerPkg.includes('danamon')) || /\bdana\b/i.test(combined)) && !/danamon/i.test(combined)) {
    const isExplicitOutgoing = /(?:kirim uang(?!\s+diterima)|transfer ke|pembayaran|bayar|kamu telah membayar|telah membayar|berhasil dikirim(?:\s+ke)?|berhasil ditransfer(?:\s+ke)?|berhasil terkirim|terkirim(?:\s+ke)?|telah dikirim|uang keluar|kirim dana kaget)/i.test(combined)
    const isExplicitIncoming = /(?:kirim uang diterima|isi saldo|saldo bertambah|dapat kiriman|kiriman uang|kamu menerima|menerima saldo|menerima kiriman|saldo masuk|dana masuk|dana diterima|penerimaan dana|dana kaget|dapat dana kaget|terima dana kaget|masuk ke saldo(?!\s*(?:ke\s+)?penerima)|top\s*up|cashback|saldo ditambahkan)/i.test(combined) ||
      (/(?:uang masuk)/i.test(combined) && !/(?:uang masuk ke saldo penerima|uang masuk ke rekening penerima|uang masuk ke tujuan)/i.test(combined))
    const isIncome = !isExplicitOutgoing && isExplicitIncoming
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'DANA',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.95,
        tier: 1,
      }
    }
  }

  // 8. ShopeePay
  if (lowerPkg.includes('shopee') || /shopeepay/i.test(combined)) {
    const isIncome = /(?:isi saldo|menerima transfer|terima saldo|saldo masuk|top\s*up|cashback)/i.test(combined) &&
      !/(?:pembayaran|bayar|transfer ke|kirim ke)/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'ShopeePay',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.95,
        tier: 1,
      }
    }
  }

  // 9. Seabank
  if (lowerPkg.includes('seabank') || /seabank|sea bank/i.test(combined)) {
    const isIncome = /(?:masuk|cr|terima|kredit|top\s*up)/i.test(combined) &&
      !/(?:keluar|transfer keluar|pembayaran|debit)/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Seabank',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 10. Bank Jago
  if (lowerPkg.includes('jago') || /bank jago|kantong jago/i.test(combined)) {
    const isIncome = /(?:uang masuk|masuk|menerima|terima|kredit|bertambah)/i.test(combined) &&
      !/(?:uang\s+keluar|keluar|berkurang|pembayaran|transfer\s+ke|debit)/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Bank Jago',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 11. Blu by BCA Digital
  if (lowerPkg.includes('blu') || /blu by bca digital|\bblu\b/i.test(combined)) {
    const isIncome = /(?:masuk|cr|terima|kredit)/i.test(combined) &&
      !/(?:pembayaran|transfer\s+ke|qris|keluar)/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Blu',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 12. Jenius (BTPN)
  if (lowerPkg.includes('jenius') || /jenius|btpn/i.test(combined)) {
    const isIncome = /(?:uang masuk|masuk|inflow|terima)/i.test(combined) &&
      !/(?:money out|uang keluar|keluar|bayar|transfer\s+ke)/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Jenius',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 13. Bank Syariah Indonesia (BSI)
  if (lowerPkg.includes('bsi') || /bsi\s*mobile|bank syariah indonesia/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|kredit|setoran|terima|diterima)/i.test(combined) &&
      !/(?:keluar|pembayaran|transfer\s+ke|kirim\s+uang(?!\s+diterima)|qris|debit)/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'BSI',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 14. CIMB Niaga (OCTO Mobile / SMS CIMB)
  if (lowerPkg.includes('cimb') || lowerPkg.includes('octo') || /\b(?:62)?3346\b|octo\s*mobile|cimb\s*niaga|\bcimb\b/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|terima|diterima|dikredit)/i.test(combined) &&
      !/(?:keluar|pembayaran|transfer\s+ke|qris|debit|debet|didebit|kartu\s+kredit)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'CIMB Niaga',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 15. LINE Bank (PT Bank KEB Hana)
  if (lowerPkg.includes('linebank') || /line\s*bank|keb\s*hana/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|terima)/i.test(combined) &&
      !/(?:keluar|pembayaran|transfer\s+ke|qris|kartu\s+kredit)/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'LINE Bank',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 16. Permata / PermataBank SMS
  if (lowerPkg.includes('permata') || /\b(?:62)?1418\b|permatabank|bank\s*permata|\bpermata\b/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|terima|dikredit)/i.test(combined) &&
      !/(?:keluar|pembayaran|debit|debet|didebit|kartu\s+kredit|transfer\s+ke)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Permata',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 17. Danamon SMS
  if (lowerPkg.includes('danamon') || /\b(?:62)?3399\b|d-bank|bank\s*danamon|\bdanamon\b/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|terima|dikredit)/i.test(combined) &&
      !/(?:keluar|pembayaran|debit|debet|didebit|kartu\s+kredit|transfer\s+ke)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Danamon',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 18. Bank Mega SMS
  if (lowerPkg.includes('mega') || /\b(?:62)?3377\b|m-smile|bank\s*mega|\bmega\b/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|terima|dikredit)/i.test(combined) &&
      !/(?:keluar|pembayaran|debit|debet|didebit|kartu\s+kredit|transfer\s+ke)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Bank Mega',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 19. Citibank SMS
  if (lowerPkg.includes('citi') || /citibank|\bciti\b/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|terima|dikredit)/i.test(combined) &&
      !/(?:keluar|pembayaran|debit|debet|didebit|kartu\s+kredit|transfer\s+ke)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Citibank',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 20. HSBC SMS
  if (lowerPkg.includes('hsbc') || /bank\s*hsbc|\bhsbc\b/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|terima|dikredit)/i.test(combined) &&
      !/(?:keluar|pembayaran|debit|debet|didebit|kartu\s+kredit|transfer\s+ke)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'HSBC',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  return null
}

export const INSTITUTION_ALIASES = {
  BCA: ['bca', 'bank bca', 'mybca', 'm-bca', 'klikbca', 'bca digital', '69888', '6269888'],
  'Mandiri Livin': ['mandiri', 'livin', 'bank mandiri', 'livin by mandiri', '83355', '6283355'],
  BRImo: ['bri', 'brimo', 'bank bri', 'bank rakyat indonesia', 'bri-info', '3355', '623355'],
  BNI: ['bni', 'wondr', 'bank bni', 'bank negara indonesia', '3300', '623300'],
  GoPay: ['gopay', 'gojek', 'go-pay', 'pt dompet anak bangsa'],
  OVO: ['ovo', 'ovo cash', 'pt visionet'],
  DANA: ['dana', 'dompet dana', 'pt espay debit indonesia'],
  ShopeePay: ['shopee', 'shopeepay', 'spay'],
  Seabank: ['seabank', 'sea bank', 'sea bank indonesia'],
  'Bank Jago': ['jago', 'bank jago', 'pt bank jago'],
  BSI: ['bsi', 'bank syariah indonesia', 'bsimobile', 'bsi mobile'],
  'CIMB Niaga': ['cimb', 'cimb niaga', 'octo', 'octomobile', 'octo mobile', 'pt bank cimb niaga', '3346', '623346'],
  'LINE Bank': ['line bank', 'linebank', 'hana bank', 'keb hana'],
  Blu: ['blu', 'blu by bca digital', 'bca digital'],
  Jenius: ['jenius', 'btpn', 'bank btpn'],
  Permata: ['permata', 'permatabank', 'bank permata', 'permata mobile', '1418', '621418'],
  Danamon: ['danamon', 'bank danamon', 'd-bank', 'd bank', '3399', '623399'],
  'Bank Mega': ['mega', 'bank mega', 'm-smile', '3377', '623377'],
  Citibank: ['citibank', 'citi'],
  HSBC: ['hsbc', 'bank hsbc'],
}

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
  if (promoBlacklist.some((b) => combined.includes(b))) {
    return false
  }

  // 4. Guardrail: Reject promotional shorthand suffixes attached to currency (e.g. "Rp1 0rb", "Rp 50rb", "Rp 10k")
  if (/(?:rp|idr)\.?\s*\d+\s*(?:0?rb|k|jt)\b/i.test(rawCombined)) {
    return false
  }

  // 5. Must contain valid monetary pattern (e.g. Rp 10.000, IDR 50.000)
  const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
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
  ]
  return receiptKeywords.some((w) => combined.includes(w)) || /\bcr\b/i.test(combined)
}

/**
 * Fuzzy Wallet Matcher
 * Finds the exact or best matching wallet for a bank/e-wallet institution.
 */
export function findBestMatchingWallet(institution = '', availableWallets = [], rawText = '') {
  if (!Array.isArray(availableWallets) || availableWallets.length === 0) {
    return { wallet: null, matches: [], isAmbiguous: false }
  }

  const instClean = (institution || '').trim().toLowerCase()
  const aliases = (INSTITUTION_ALIASES[institution] || [instClean]).map((a) => a.toLowerCase())

  // Check 1: 4-digit Account Number matching if present in rawText
  const accMatch = (rawText || '').match(/(?:rekening|rek|acc|no\.?|kartu)\s*(?:[x*]*\s*)?(\d{4})/i)
  if (accMatch) {
    const accSuffix = accMatch[1]
    const accMatched = availableWallets.filter((w) => {
      const wAcc = (w.accountNumber || '').replace(/\D/g, '')
      return wAcc.endsWith(accSuffix)
    })
    if (accMatched.length === 1) {
      return { wallet: accMatched[0], matches: accMatched, isAmbiguous: false }
    }
    if (accMatched.length > 1) {
      return { wallet: null, matches: accMatched, isAmbiguous: true }
    }
  }

  // Check 2: Fuzzy / Alias matching on wallet name & institutionName
  const matchedWallets = availableWallets.filter((w) => {
    const wName = (w.name || '').trim().toLowerCase()
    const wInst = (w.institutionName || '').trim().toLowerCase()

    const matchesAlias = aliases.some((alias) => {
      if (!alias) return false
      return (
        (wName && (wName === alias || wName.includes(alias) || (wName.length >= 3 && alias.includes(wName)))) ||
        (wInst && (wInst === alias || wInst.includes(alias) || (wInst.length >= 3 && alias.includes(wInst))))
      )
    })

    return matchesAlias
  })

  if (matchedWallets.length === 1) {
    return { wallet: matchedWallets[0], matches: matchedWallets, isAmbiguous: false }
  }

  if (matchedWallets.length > 1) {
    return { wallet: null, matches: matchedWallets, isAmbiguous: true }
  }

  // Unmatched: do NOT guess across different institutions or e-wallet brands
  return { wallet: null, matches: [], isAmbiguous: false }
}

/**
 * Correlates dual debit/credit mutations within 120s into a single Transfer (Pindah Dana)
 */
export function correlateInternalTransfers(parsedMutations = [], availableWallets = [], options = {}) {
  if (!Array.isArray(parsedMutations) || parsedMutations.length < 2) {
    return { correlated: parsedMutations, transfersCreated: 0 }
  }

  const notificationAutoApprove =
    typeof options === 'boolean' ? options : Boolean(options?.notificationAutoApprove)

  const result = []
  const consumedIndices = new Set()
  let transfersCreated = 0

  for (let i = 0; i < parsedMutations.length; i++) {
    if (consumedIndices.has(i)) continue

    const current = parsedMutations[i]
    let pairedIndex = -1

    for (let j = i + 1; j < parsedMutations.length; j++) {
      if (consumedIndices.has(j)) continue
      const candidate = parsedMutations[j]

      // Criteria: Opposite types (one expense, one income), same amount
      const isOppositeType =
        (current.type === 'expense' && candidate.type === 'income') ||
        (current.type === 'income' && candidate.type === 'expense')

      const isSameAmount = Math.abs(toSafeNumber(current.amount) - toSafeNumber(candidate.amount)) < 0.01

      // Within 120 seconds time difference
      const timeI = getNotificationTimestamp(current.createdAt || current.timestamp)
      const timeJ = getNotificationTimestamp(candidate.createdAt || candidate.timestamp)
      const isWithinWindow = Math.abs(timeI - timeJ) <= 120000

      if (isOppositeType && isSameAmount && isWithinWindow) {
        pairedIndex = j
        break
      }
    }

    if (pairedIndex !== -1) {
      const candidate = parsedMutations[pairedIndex]
      consumedIndices.add(i)
      consumedIndices.add(pairedIndex)
      transfersCreated++

      const fromMutation = current.type === 'expense' ? current : candidate
      const toMutation = current.type === 'income' ? current : candidate

      const fromMatch = findBestMatchingWallet(fromMutation.institution, availableWallets, fromMutation.rawDescription)
      const toMatch = findBestMatchingWallet(toMutation.institution, availableWallets, toMutation.rawDescription)

      const isSameResolvedWallet =
        Boolean(fromMatch.wallet?.id) &&
        Boolean(toMatch.wallet?.id) &&
        String(fromMatch.wallet.id) === String(toMatch.wallet.id)

      result.push({
        type: 'transfer',
        amount: fromMutation.amount,
        currency: fromMutation.currency || 'IDR',
        date: fromMutation.date,
        createdAt: fromMutation.createdAt,
        walletId: fromMatch.wallet?.id || undefined,
        targetWalletId: toMatch.wallet?.id || undefined,
        category: 'transfer',
        notes: `[Pindah Dana] ${fromMutation.institution} -> ${toMutation.institution}`,
        cleanMerchant: `Pindah Dana: ${fromMutation.institution} -> ${toMutation.institution}`,
        isPendingReview:
          !notificationAutoApprove ||
          fromMatch.isAmbiguous ||
          toMatch.isAmbiguous ||
          !fromMatch.wallet ||
          !toMatch.wallet ||
          isSameResolvedWallet,
        source: 'notification_listener_transfer',
      })
    } else {
      result.push(current)
    }
  }

  return { correlated: result, transfersCreated }
}

/**
 * TIER 2: Token Boundary & General Currency Extractor (Fallback for other financial apps)
 */
export function parseWithTokenBoundary(title = '', text = '') {
  const combined = `${title} ${text}`.trim()
  const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)

  if (!amtMatch) return null

  const amount = parseAmountFromRegexMatch(amtMatch[1])
  if (amount <= 0) return null

  const isIncome = /(masuk|terima|diterima|inflow|cr|kredit|top\s*up|cashback|refund)/i.test(combined)

  return {
    institution: 'Bank / E-Wallet',
    amount,
    type: isIncome ? 'income' : 'expense',
    rawDescription: combined,
    confidence: 0.8,
    tier: 2,
  }
}

/**
 * 3-TIER INGESTION PARSER PIPELINE
 */
export function parseFinancialNotification(notif = {}) {
  const { title = '', text = '', packageName = '', timestamp = Date.now() } = notif

  if (!isFinancialMutation(title, text, packageName)) {
    return null
  }

  // Tier 1: Deterministic Bank Regex
  const tier1 = parseWithBankRegex(title, text, packageName)
  if (tier1) {
    return formatParsedNotification(tier1, timestamp)
  }

  // Tier 2: Token Boundary Extractor
  const tier2 = parseWithTokenBoundary(title, text)
  if (tier2) {
    return formatParsedNotification(tier2, timestamp)
  }

  return null
}

function formatParsedNotification(parsed, timestamp) {
  const cleanMerchant = cleanMutationMerchant(parsed.rawDescription)
  const rememberedCategory = getRememberedCategory(cleanMerchant, parsed.type)
  const matchedCategory = rememberedCategory || matchCategoryFromDescription(cleanMerchant, parsed.type)
  const defaultCategory = parsed.type === 'income' ? 'lainnya/umum' : 'lainnya_kategori/umum'
  const category = matchedCategory || defaultCategory

  return {
    ...parsed,
    cleanMerchant,
    category,
    date: format(new Date(timestamp), 'yyyy-MM-dd'),
    createdAt: Number(timestamp) || Date.now(),
    notes: cleanMerchant,
  }
}

/**
 * Ingests all queued mutations from Android SharedPreferences into Dexie IndexedDB.
 */
export async function syncNotificationQueue(options = {}) {
  const { defaultWalletId, defaultCurrency = 'IDR', notificationAutoApprove = false } = options

  if (!Capacitor.isNativePlatform()) {
    return { syncedCount: 0, skippedDuplicates: 0 }
  }

  try {
    const res = await (FinTrackNotificationPlugin.drainQueuedMutations
      ? FinTrackNotificationPlugin.drainQueuedMutations()
      : FinTrackNotificationPlugin.getQueuedMutations())
    const queuedItems = res?.mutations || []

    if (queuedItems.length === 0) {
      return { syncedCount: 0, skippedDuplicates: 0 }
    }

    let syncedCount = 0
    let skippedDuplicates = 0

    // Fetch existing transactions from recent 7 days to deduplicate
    const recentDate = format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd')
    const recentTransactions = (await db.transactions
      .where('date')
      .aboveOrEqual(recentDate)
      .toArray()).filter((tx) => !tx.deletedAt)

    const availableWallets = await db.wallets.toArray()

    // 1. Parse all valid financial mutations & deduplicate within batch
    const parsedList = []
    const seenInBatch = new Set()

    for (const notif of queuedItems) {
      const parsed = parseFinancialNotification(notif)
      if (!parsed || parsed.amount <= 0) continue

      const merchantKey = (parsed.cleanMerchant || parsed.notes || '').toLowerCase().trim()
      const timeBucket = Math.floor((parsed.createdAt || Date.now()) / (60 * 1000))
      const batchKey = `${parsed.date}_${parsed.type}_${parsed.amount}_${parsed.institution}_${merchantKey}_${timeBucket}`
      if (seenInBatch.has(batchKey)) {
        skippedDuplicates++
        continue
      }

      // Deduplication check: Same date, same amount, same type, matching merchant/time window
      const isDuplicate = recentTransactions.some((existing) => {
        if (
          existing.date !== parsed.date ||
          existing.type !== parsed.type ||
          Math.abs(toSafeNumber(existing.amount) - toSafeNumber(parsed.amount)) >= 0.01
        ) {
          return false
        }

        const parsedTime = getNotificationTimestamp(parsed.createdAt)
        const existingTime = getNotificationTimestamp(existing.createdAt)
        const hasTimeWindow = parsedTime > 0 && existingTime > 0
        const isCloseInTime = hasTimeWindow && Math.abs(parsedTime - existingTime) <= 5 * 60 * 1000

        const parsedText = (parsed.cleanMerchant || parsed.notes || '').toLowerCase().trim()
        const existingText = (existing.cleanMerchant || existing.notes || existing.description || '').toLowerCase().trim()

        const isSameMerchant = parsedText && existingText && (
          parsedText === existingText ||
          parsedText.includes(existingText) ||
          existingText.includes(parsedText)
        )

        // If both have timestamps and they are more than 5 minutes apart, legitimate separate transaction
        if (hasTimeWindow && !isCloseInTime) {
          return false
        }

        // If both have distinct merchant names that do not match, legitimate separate transaction
        if (parsedText && existingText && !isSameMerchant) {
          return false
        }

        return true
      })

      if (isDuplicate) {
        skippedDuplicates++
        continue
      }

      seenInBatch.add(batchKey)
      parsedList.push(parsed)
    }

    // 2. Correlate internal transfers (e.g. BCA to GoPay in <= 120s)
    const { correlated } = correlateInternalTransfers(parsedList, availableWallets, { notificationAutoApprove })

    // 3. Match individual wallets & prepare insertion payload
    const toInsert = []
    const walletBalanceDeltas = new Map()

    for (const item of correlated) {
      if (item.type === 'transfer') {
        toInsert.push(item)
        syncedCount++

        // If fromWallet & toWallet are defined and not pending review, adjust balances
        if (!item.isPendingReview) {
          if (item.walletId) {
            const prev = walletBalanceDeltas.get(item.walletId) || 0
            walletBalanceDeltas.set(item.walletId, prev - item.amount)
          }
          if (item.targetWalletId) {
            const prev = walletBalanceDeltas.get(item.targetWalletId) || 0
            walletBalanceDeltas.set(item.targetWalletId, prev + item.amount)
          }
        }
        continue
      }

      // Single mutation: match best wallet
      const matchResult = findBestMatchingWallet(item.institution, availableWallets, item.rawDescription)
      const fallbackWallet = defaultWalletId ? availableWallets.find((w) => Number(w.id) === Number(defaultWalletId)) : null
      const matchedWallet = matchResult.wallet || fallbackWallet
      let resolvedWalletId = matchedWallet?.id ? Number(matchedWallet.id) : undefined

      // SAFE STAGING MODE:
      // By default (notificationAutoApprove = false), ALL auto-ingested transactions enter
      // the Staging Review Inbox (isPendingReview = true) so user balances are never altered without consent.
      // Even if notificationAutoApprove is enabled, require review if wallet is not an exact match or confidence < 0.95.
      const isExactMatch = Boolean(matchResult.wallet) && !matchResult.isAmbiguous
      const isPendingReview = !notificationAutoApprove || !isExactMatch || (item.confidence || 0) < 0.95
      const resolvedCurrency = matchedWallet?.currency || defaultCurrency

      toInsert.push({
        date: item.date,
        type: item.type,
        category: item.category,
        amount: item.amount,
        currency: resolvedCurrency,
        walletId: resolvedWalletId,
        notes: `[Auto: ${item.institution}] ${item.notes}`,
        source: 'notification_listener',
        createdAt: item.createdAt,
        isPendingReview: isPendingReview,
        suggestedInstitution: item.institution,
        cleanMerchant: item.cleanMerchant || item.notes || '',
      })

      if (resolvedWalletId && !isPendingReview) {
        const prev = walletBalanceDeltas.get(resolvedWalletId) || 0
        const delta = item.type === 'income' ? item.amount : -item.amount
        walletBalanceDeltas.set(resolvedWalletId, prev + delta)
      }

      syncedCount++
    }

    if (toInsert.length > 0) {
      const insertedIds = await db.transactions.bulkAdd(toInsert, { allKeys: true })

      // Invalidate balance cache so dynamic computeWalletBalance immediately reflects inserted transactions
      const affectedWalletIds = Array.from(walletBalanceDeltas.keys()).map(Number).filter(Boolean)
      if (affectedWalletIds.length > 0) {
        await invalidateWalletBalance(affectedWalletIds)
      }

      if (typeof window !== 'undefined') {
        import('../store/useSettingsStore').then((m) => {
          m.default.getState().incrementUnviewedMutations(syncedCount)
        })
        window.dispatchEvent(
          new CustomEvent('ft-show-toast', {
            detail: {
              title: 'Mutasi Bank Diterima',
              message: `${syncedCount} transaksi baru dicatat dan siap ditinjau.`,
              route: '/transactions',
              type: 'recurring',
            },
          })
        )
      }

      // Asynchronously trigger AI background enrichment for unclassified mutations
      if (Array.isArray(insertedIds) && insertedIds.length > 0) {
        enrichPendingMutationsWithAi(insertedIds).catch((err) =>
          console.warn('[syncNotificationQueue:enrichPendingMutationsWithAi]', err)
        )
      }
    }

    // Safely fallback to clearing native queue if drainQueuedMutations was not available
    if (!FinTrackNotificationPlugin.drainQueuedMutations) {
      await FinTrackNotificationPlugin.clearQueuedMutations?.()
    }

    return { syncedCount, skippedDuplicates }
  } catch (err) {
    console.error('Error syncing notification queue:', err)
    return { syncedCount: 0, skippedDuplicates: 0, error: err.message }
  }
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
  const { deleteTransaction } = await import('../services/transactionService')

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

/**
 * Scans historical SMS inbox for banking transactions and streams them to staging review inbox.
 */
export async function syncHistoricalSms(options = {}) {
  const { days = 30 } = options

  if (!Capacitor.isNativePlatform() && !options.force && !options.mockMutations) {
    return { syncedCount: 0, skippedDuplicates: 0 }
  }

  try {
    let items = options.mockMutations || []
    if (!options.mockMutations && FinTrackNotificationPlugin.scanHistoricalSms) {
      const res = await FinTrackNotificationPlugin.scanHistoricalSms({ days })
      items = res?.mutations || []
    }

    if (items.length === 0) {
      return { syncedCount: 0, skippedDuplicates: 0 }
    }

    let skippedDuplicates = 0

    const cutoffDate = format(new Date(Date.now() - days * 86400000), 'yyyy-MM-dd')
    const existingTransactions = (await db.transactions
      .where('date')
      .aboveOrEqual(cutoffDate)
      .toArray()).filter((tx) => !tx.deletedAt)

    const availableWallets = await db.wallets.toArray()
    const toInsert = []

    for (const item of items) {
      const parsed = (item.institution && item.amount) ? item : parseFinancialNotification(item)
      if (!parsed || parsed.amount <= 0) continue

      const parsedDate = parsed.date || (item.date ? String(item.date).slice(0, 10) : format(new Date(item.createdAt || item.timestamp || Date.now()), 'yyyy-MM-dd'))

      // Deduplication check: handle dates with mixed formats using (tx.date || '').slice(0, 10) === parsedDate
      const isAlreadyInTx = existingTransactions.some((tx) =>
        (tx.date || '').slice(0, 10) === parsedDate &&
        tx.type === parsed.type &&
        Math.abs(toSafeNumber(tx.amount) - toSafeNumber(parsed.amount)) < 0.01
      )
      const isAlreadyInBatch = toInsert.some((b) =>
        (b.date || '').slice(0, 10) === parsedDate &&
        b.type === parsed.type &&
        Math.abs(toSafeNumber(b.amount) - toSafeNumber(parsed.amount)) < 0.01
      )

      if (isAlreadyInTx || isAlreadyInBatch) {
        skippedDuplicates++
        continue
      }

      const institution = item.institution || parsed.institution || ''
      const notesText = item.notes || parsed.notes || parsed.cleanMerchant || ''
      const cleanMerchant = item.cleanMerchant || parsed.cleanMerchant || notesText || ''
      const rawDescription = item.rawDescription || parsed.rawDescription || (item.text ? `${item.title || ''} ${item.text}` : '')

      const matchResult = findBestMatchingWallet(institution, availableWallets, rawDescription)
      const resolvedWalletId = matchResult?.wallet?.id ? Number(matchResult.wallet.id) : undefined
      const resolvedCurrency = matchResult?.wallet?.currency || parsed.currency || 'IDR'

      toInsert.push({
        date: parsedDate,
        type: parsed.type,
        category: parsed.category,
        amount: parsed.amount,
        currency: resolvedCurrency,
        walletId: resolvedWalletId,
        notes: `[SMS: ${institution}] ${notesText}`.trim(),
        source: 'sms_history',
        createdAt: parsed.createdAt || item.createdAt || item.timestamp || Date.now(),
        isPendingReview: true,
        suggestedInstitution: institution,
        cleanMerchant: cleanMerchant,
      })
    }

    let syncedCount = 0
    if (toInsert.length > 0) {
      const insertedIds = await db.transactions.bulkAdd(toInsert, { allKeys: true })
      syncedCount = toInsert.length

      try {
        const { default: useSettingsStore } = await import('../store/useSettingsStore')
        useSettingsStore.getState().incrementUnviewedMutations(syncedCount)
      } catch (storeErr) {
        console.error('[syncHistoricalSms:incrementUnviewedMutations]', storeErr)
      }

      if (Array.isArray(insertedIds) && insertedIds.length > 0) {
        enrichPendingMutationsWithAi(insertedIds).catch((aiErr) =>
          console.warn('[syncHistoricalSms:enrichPendingMutationsWithAi]', aiErr)
        )
      }
    }

    return { syncedCount, skippedDuplicates }
  } catch (err) {
    console.error('[syncHistoricalSms]', err)
    return { syncedCount: 0, skippedDuplicates: 0, error: err.message }
  }
}

