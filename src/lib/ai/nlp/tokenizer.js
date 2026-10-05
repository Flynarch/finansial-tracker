import { sanitizeCategoryPath } from '../../categorySanitizer'
import useSettingsStore from '../../../store/useSettingsStore'
import { KNOWN_MERCHANT_SERVICES } from './lexicon'

/**
 * Escapes regex special characters in a string
 * @param {string} string
 * @returns {string}
 */
export function escapeRegExp(string) {
  return String(string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Normalizes colloquial Indonesian spelling, chat abbreviations, and typos
 * @param {string} text
 * @returns {string}
 */
export function normalizeIndonesianNlpText(text) {
  if (!text || typeof text !== 'string') return ''
  let t = text.trim()

  // Replace typos for 'hari'
  t = t.replace(/\b(hwri|hri|hrii)\b/gi, 'hari')

  // Replace typos for 'jumat'
  t = t.replace(/\b(jumwt|jum'at|jmt|jumatt)\b/gi, 'jumat')

  // Replace typos for 'sabtu'
  t = t.replace(/\b(sbtu|sabt|sbt)\b/gi, 'sabtu')

  // Replace typos for 'minggu'
  t = t.replace(/\b(mnggu|mggu|ahad)\b/gi, 'minggu')

  // Replace typos for 'senin'
  t = t.replace(/\b(senen|senn)\b/gi, 'senin')

  // Replace typos for 'selasa'
  t = t.replace(/\b(slasa)\b/gi, 'selasa')

  // Replace typos for 'rabu'
  t = t.replace(/\b(rbu)\b/gi, 'rabu')

  // Replace typos for 'kamis'
  t = t.replace(/\b(kms)\b/gi, 'kamis')

  // Replace typos for 'kemarin'
  t = t.replace(/\b(kmrn|kmarin|kemaren|kmren)\b/gi, 'kemarin')

  // Replace typos for 'semalam'
  t = t.replace(/\b(smlm|semalem)\b/gi, 'semalam')

  // Replace slang for 'transfer'
  t = t.replace(/\b(tf|trf)\b/gi, 'transfer')

  // Replace slang for 'besok'
  t = t.replace(/\b(bsk|beso|besokk)\b/gi, 'besok')

  // Replace slang for common drinks
  t = t.replace(/\b(kopsu|kopisusu)\b/gi, 'kopi susu')

  // Replace variations of 'masing-masing'
  t = t.replace(/\b(masing\s+masing|masing2|msing\s+msing)\b/gi, 'masing-masing')

  // Replace spending verbs
  t = t.replace(/\b(ngabisin|menghabiskan|keluarin|ngeluarin)\b/gi, 'habisin')

  return t
}

/**
 * Masks date strings and relative time expressions so date numbers are never captured as monetary amounts
 * @param {string} text
 * @returns {string}
 */
export function maskDateExpressions(text) {
  if (!text || typeof text !== 'string') return ''
  let t = text
  // 1. Day + Month Name: "9 september", "12 sep 2026", "tgl 25 agustus", "10 okt"
  t = t.replace(/(?:(?:tgl|tanggal)\s+)?\b\d{1,2}\s+(?:januari|jan|februari|feb|maret|mar|april|apr|mei|may|juni|jun|juli|jul|agustus|ags|agst|aug|september|sep|sept|oktober|okt|oct|november|nov|desember|des|dec)(?:\s+\d{4})?\b/gi, ' ')
  // 2. Numeric date: "12/09/2026", "9/9", "25-08-2026" (guarding against decimal amounts like "1.2 miliar" and quantities like "2.5 kg")
  t = t.replace(/(?:(?:tgl|tanggal)\s+)?\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?(?!\s*(?:k|rb|ribu|jt|juta|m|miliar|milyar|b|billion|million|perak|kg|gram|g|l|liter|ml|pcs|buah|meter|m|km|ons|butir|pax|box|dus))\b/gi, ' ')
  // 3. Relative time expressions: "2 hari lalu", "3 jam lalu", "5 menit lalu"
  t = t.replace(/\b\d{1,2}\s+(?:hari|jam|menit|bulan|tahun)(?:\s+lalu)?\b/gi, ' ')
  // 4. Standalone tanggal/tgl + number: "tanggal 9", "tgl 12"
  t = t.replace(/\b(?:tanggal|tgl)\s+\d{1,2}\b/gi, ' ')
  // 5. Clock times & time-of-day phrases: "jam 5", "jam 5 sore", "pukul 17:00", "jam setengah 6", "17:00"
  t = t.replace(/\b(?:pukul|jam)\s+(?:setengah\s+)?\d{1,2}(?:[.:]\d{2})?(?:\s*(?:pagi|siang|sore|malam))?\b/gi, ' ')
  t = t.replace(/\b(?:pukul|jam)\s+\d{1,2}\s+(?:kurang|lewat)\s+\d{1,2}(?:\s*menit)?\b/gi, ' ')
  t = t.replace(/\b\d{1,2}[.:]\d{2}(?:\s*(?:wib|wita|wit))?\b/gi, ' ')
  return t
}

/**
 * Extracts a clean merchant name and category from an Indonesian phrase
 * e.g. "buat maxim" -> { merchant: "Maxim", category: "transportasi/ojol" }
 * @param {string} text
 * @returns {{ merchant: string, category: string, cleanNotes: string }}
 */
export function extractMerchantAndCategory(text) {
  if (!text || typeof text !== 'string') {
    return { merchant: '', category: 'lainnya_kategori/umum', cleanNotes: '' }
  }

  // 1. Check known merchant brands
  for (const item of KNOWN_MERCHANT_SERVICES) {
    if (item.regex.test(text)) {
      return {
        merchant: item.name,
        category: item.category,
        cleanNotes: item.name,
      }
    }
  }

  // 2. Check for prepositional targets: "buat [x]", "untuk [x]", "naik [x]", "di [x]", "beli [x]"
  const prepMatch = text.match(/(?:buat|untuk|naik|di|beli|bayar)\s+([a-zA-Z0-9\s\-_]+)/i)
  if (prepMatch && prepMatch[1]) {
    const rawTarget = prepMatch[1].trim()
    const firstWordOrTwo = rawTarget.split(/\s+/).slice(0, 2).join(' ')
    const capitalized = firstWordOrTwo.charAt(0).toUpperCase() + firstWordOrTwo.slice(1)
    const cat = sanitizeCategoryPath(firstWordOrTwo, 'expense')
    return {
      merchant: capitalized,
      category: cat,
      cleanNotes: capitalized,
    }
  }

  return {
    merchant: '',
    category: sanitizeCategoryPath(text, 'expense'),
    cleanNotes: text.trim(),
  }
}

/**
 * Finds a matching wallet by name or type in text
 * @param {string} text
 * @param {Array} wallets
 * @param {number|string} defaultWalletId
 * @returns {number|string}
 */
export function findWalletInText(text, wallets = [], defaultWalletId = undefined) {
  const fallbackWalletId = defaultWalletId !== undefined
    ? defaultWalletId
    : (useSettingsStore.getState?.().defaultWalletId || wallets[0]?.id || 1)
  if (!wallets || wallets.length === 0) return fallbackWalletId
  const cleanText = text.toLowerCase()

  // Sort wallets by name length descending to prevent shorter names from shadowing longer ones
  // (e.g. "BCA" matching before "BCA Syariah")
  const sortedWallets = [...wallets].sort((a, b) =>
    (b.name || '').length - (a.name || '').length
  )

  // 1. Exact full-name match first
  for (const w of sortedWallets) {
    const wName = String(w.name || '').trim().toLowerCase()
    if (!wName) continue
    const escaped = escapeRegExp(wName)
    const lookahead = wName === 'dana' ? '(?!\\s+(?:darurat|pensiun|cadangan|abadi|hibah|pendidikan|sosial|desa|alokasi))' : ''
    const regex = new RegExp(`(?:\\(|\\b)${escaped}${lookahead}(?:\\)|\\b)`, 'i')
    if (regex.test(cleanText)) {
      return w.id
    }
  }

  // 2. Token-based matching for compound names (tokens >= 3 chars, e.g. "BCA", "Jago", "Mandiri", "BRI", "BNI")
  const STOP_WORDS = new Set(['bank', 'rekening', 'akun', 'dompet', 'wallet', 'tabungan', 'utama', 'pribadi'])
  for (const w of sortedWallets) {
    const wName = String(w.name || '').trim().toLowerCase()
    if (!wName) continue
    const tokens = wName.split(/[\s_\-/]+/).filter((t) => t.length >= 3 && !STOP_WORDS.has(t))
    for (const token of tokens) {
      const escapedToken = escapeRegExp(token)
      const lookahead = token === 'dana' ? '(?!\\s+(?:darurat|pensiun|cadangan|abadi|hibah|pendidikan|sosial|desa|alokasi))' : ''
      const tokenRegex = new RegExp(`(?:\\(|\\b)${escapedToken}${lookahead}(?:\\)|\\b)`, 'i')
      if (tokenRegex.test(cleanText)) {
        return w.id
      }
    }
  }

  // 3. Cash / Tunai type matching
  for (const w of sortedWallets) {
    const wName = String(w.name || '').trim().toLowerCase()
    const wType = String(w.institutionType || w.type || '').toLowerCase()
    if (
      (wType === 'cash' || wName.includes('cash') || wName.includes('tunai')) &&
      /\b(cash|tunai)\b/i.test(cleanText)
    ) {
      return w.id
    }
  }

  return fallbackWalletId
}
