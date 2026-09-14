import { format, subDays } from 'date-fns'
import { sanitizeCategoryPath } from '../categorySanitizer'
import { formatCurrency } from '../utils'

/**
 * Common Indonesian day definitions and typos
 * 0 = Sunday (Minggu), 1 = Monday (Senin), ..., 6 = Saturday (Sabtu)
 */
export const DAY_DEFINITIONS = [
  { dayIndex: 1, canonical: 'senin', nameId: 'Senin', regex: /\b(senin|senen|senn)\b/i },
  { dayIndex: 2, canonical: 'selasa', nameId: 'Selasa', regex: /\b(selasa|slasa)\b/i },
  { dayIndex: 3, canonical: 'rabu', nameId: 'Rabu', regex: /\b(rabu|rbu)\b/i },
  { dayIndex: 4, canonical: 'kamis', nameId: 'Kamis', regex: /\b(kamis|kms)\b/i },
  { dayIndex: 5, canonical: 'jumat', nameId: 'Jumat', regex: /\b(jumat|jum'at|jumwt|jmt|jumatt)\b/i },
  { dayIndex: 6, canonical: 'sabtu', nameId: 'Sabtu', regex: /\b(sabtu|sbtu|sabt|sbt)\b/i },
  { dayIndex: 0, canonical: 'minggu', nameId: 'Minggu', regex: /\b(minggu|mnggu|ahad|mggu)\b/i },
]

/**
 * Common Indonesian merchants, ride-hailing services, and brands
 */
export const KNOWN_MERCHANT_SERVICES = [
  {
    regex: /\b(maxim)\b/i,
    name: 'Maxim',
    category: 'transportasi/ojol',
  },
  {
    regex: /\b(gojek|goride|gocar|gofood|gomart)\b/i,
    name: 'Gojek',
    category: 'transportasi/ojol',
  },
  {
    regex: /\b(grab|grabbike|grabcar|grabfood)\b/i,
    name: 'Grab',
    category: 'transportasi/ojol',
  },
  {
    regex: /\b(indrive|in-drive)\b/i,
    name: 'inDrive',
    category: 'transportasi/ojol',
  },
  {
    regex: /\b(bluebird|blue bird)\b/i,
    name: 'Bluebird',
    category: 'transportasi/taksi',
  },
  {
    regex: /\b(krl|commuter|commuterline)\b/i,
    name: 'KRL Commuter Line',
    category: 'transportasi/kereta',
  },
  {
    regex: /\b(mrt|mrt jakarta)\b/i,
    name: 'MRT Jakarta',
    category: 'transportasi/kereta',
  },
  {
    regex: /\b(lrt|lrt jabodebek)\b/i,
    name: 'LRT',
    category: 'transportasi/kereta',
  },
  {
    regex: /\b(transjakarta|busway|tj)\b/i,
    name: 'TransJakarta',
    category: 'transportasi/bis',
  },
  {
    regex: /\b(damri)\b/i,
    name: 'Damri',
    category: 'transportasi/bis',
  },
  {
    regex: /\b(indomaret|indomart)\b/i,
    name: 'Indomaret',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(alfamart|alfa)\b/i,
    name: 'Alfamart',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(superindo|super indo)\b/i,
    name: 'Super Indo',
    category: 'kebutuhan_harian/belanja_bulanan',
  },
  {
    regex: /\b(starbucks|sbux)\b/i,
    name: 'Starbucks',
    category: 'makanan/kopi',
  },
  {
    regex: /\b(kopi kenangan|kopikenangan)\b/i,
    name: 'Kopi Kenangan',
    category: 'makanan/kopi',
  },
  {
    regex: /\b(janji jiwa|janjijiwa)\b/i,
    name: 'Janji Jiwa',
    category: 'makanan/kopi',
  },
  {
    regex: /\b(mcd|mcdonald|mcdonalds|mcdonald's)\b/i,
    name: "McDonald's",
    category: 'makanan/makan_siang',
  },
  {
    regex: /\b(kfc)\b/i,
    name: 'KFC',
    category: 'makanan/makan_siang',
  },
  {
    regex: /\b(pertamina|spbu)\b/i,
    name: 'Pertamina',
    category: 'transportasi/bensin',
  },
  {
    regex: /\b(shell)\b/i,
    name: 'Shell',
    category: 'transportasi/bensin',
  },
]

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

  // Replace variations of 'masing-masing'
  t = t.replace(/\b(masing\s+masing|masing2|msing\s+msing)\b/gi, 'masing-masing')

  // Replace spending verbs
  t = t.replace(/\b(ngabisin|menghabiskan|keluarin|ngeluarin)\b/gi, 'habisin')

  return t
}

/**
 * Calculates the past calendar date for a day of week relative to reference date.
 * If targetDay matches today:
 *   - if forcePastWeek is true: resolves to exactly 7 days ago.
 *   - if forcePastWeek is false: resolves to today (0 days ago).
 *
 * @param {number} targetDayIndex (0 = Sun, 1 = Mon, ..., 6 = Sat)
 * @param {Date} [refDate=new Date()]
 * @param {boolean} [forcePastWeek=false]
 * @returns {string} YYYY-MM-DD
 */
export function getRecentPastDayDate(targetDayIndex, refDate = new Date(), forcePastWeek = false) {
  const currentDayIndex = refDate.getDay()
  let diff = (currentDayIndex - targetDayIndex + 7) % 7
  if (diff === 0 && forcePastWeek) {
    diff = 7
  }
  const targetDate = new Date(refDate)
  targetDate.setDate(targetDate.getDate() - diff)
  return format(targetDate, 'yyyy-MM-dd')
}

/**
 * Common Indonesian month definitions and regex
 */
export const MONTH_DEFINITIONS = [
  { month: 1, regex: /\b(januari|jan)\b/i, name: 'Januari' },
  { month: 2, regex: /\b(februari|feb)\b/i, name: 'Februari' },
  { month: 3, regex: /\b(maret|mar)\b/i, name: 'Maret' },
  { month: 4, regex: /\b(april|apr)\b/i, name: 'April' },
  { month: 5, regex: /\b(mei|may)\b/i, name: 'Mei' },
  { month: 6, regex: /\b(juni|jun)\b/i, name: 'Juni' },
  { month: 7, regex: /\b(juli|jul)\b/i, name: 'Juli' },
  { month: 8, regex: /\b(agustus|ags|agst|aug)\b/i, name: 'Agustus' },
  { month: 9, regex: /\b(september|sep|sept)\b/i, name: 'September' },
  { month: 10, regex: /\b(oktober|okt|oct)\b/i, name: 'Oktober' },
  { month: 11, regex: /\b(november|nov)\b/i, name: 'November' },
  { month: 12, regex: /\b(desember|des|dec)\b/i, name: 'Desember' },
]

export const MONTH_NAME_REGEX = /\b(januari|jan|februari|feb|maret|mar|april|apr|mei|may|juni|jun|juli|jul|agustus|ags|agst|aug|september|sep|sept|oktober|okt|oct|november|nov|desember|des|dec)\b/i

export function escapeRegExp(string) {
  return String(string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
  // 2. Numeric date: "12/09/2026", "9/9", "25-08-2026"
  t = t.replace(/(?:(?:tgl|tanggal)\s+)?\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/gi, ' ')
  // 3. Relative time expressions: "2 hari lalu", "3 jam lalu", "5 menit lalu"
  t = t.replace(/\b\d{1,2}\s+(?:hari|jam|menit|bulan|tahun)(?:\s+lalu)?\b/gi, ' ')
  // 4. Standalone tanggal/tgl + number: "tanggal 9", "tgl 12"
  t = t.replace(/\b(?:tanggal|tgl)\s+\d{1,2}\b/gi, ' ')
  return t
}

/**
 * Extracts a calendar date, weekday name, or relative day from a phrase
 * @param {string} phrase
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ dateStr: string, matchedText: string, day?: number, month?: number, year?: number } | null}
 */
export function extractDateFromPhrase(phrase, referenceDate = new Date()) {
  if (!phrase || typeof phrase !== 'string') return null
  const lower = phrase.toLowerCase()
  const ref = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date()
  const refYear = ref.getFullYear()

  // 1. Calendar Date with Month Name: "9 september", "12 sep", "tgl 25 agustus 2026", "10 okt"
  const monthDateMatch = lower.match(
    /(?:(?:tgl|tanggal)\s+)?\b(\d{1,2})\s+(januari|jan|februari|feb|maret|mar|april|apr|mei|may|juni|jun|juli|jul|agustus|ags|agst|aug|september|sep|sept|oktober|okt|oct|november|nov|desember|des|dec)(?:\s+(\d{4}))?\b/i
  )
  if (monthDateMatch) {
    const day = parseInt(monthDateMatch[1], 10)
    const monthStr = monthDateMatch[2].toLowerCase()
    const year = monthDateMatch[3] ? parseInt(monthDateMatch[3], 10) : refYear

    const monthDef = MONTH_DEFINITIONS.find((m) => m.regex.test(monthStr))
    if (monthDef && day >= 1 && day <= 31) {
      const dateStr = `${year}-${String(monthDef.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return {
        dateStr,
        matchedText: monthDateMatch[0].trim(),
        day,
        month: monthDef.month,
        year,
      }
    }
  }

  // 2. Numeric Slash/Dash Date: "9/9", "12/09", "12/9/2026", "25-08-2026"
  const numericDateMatch = lower.match(
    /(?:(?:tgl|tanggal)\s+)?\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/i
  )
  if (numericDateMatch) {
    const day = parseInt(numericDateMatch[1], 10)
    const month = parseInt(numericDateMatch[2], 10)
    let year = refYear
    if (numericDateMatch[3]) {
      const rawYear = parseInt(numericDateMatch[3], 10)
      year = rawYear < 100 ? 2000 + rawYear : rawYear
    }
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return {
        dateStr,
        matchedText: numericDateMatch[0].trim(),
        day,
        month,
        year,
      }
    }
  }

  // 3. Day of week name (senin, selasa, rabu, kamis, jumat, sabtu, minggu)
  for (const def of DAY_DEFINITIONS) {
    if (def.regex.test(lower)) {
      const hasPastQualifier =
        new RegExp(`${def.canonical}\\s+(kemarin|lalu|minggu\\s+lalu)`, 'i').test(lower) ||
        new RegExp(`(kemarin|minggu\\s+lalu)\\s+hari\\s+${def.canonical}`, 'i').test(lower)
      const dateStr = getRecentPastDayDate(def.dayIndex, ref, hasPastQualifier)
      const dayWordMatch = lower.match(def.regex)
      return {
        dateStr,
        matchedText: dayWordMatch ? dayWordMatch[0] : def.canonical,
        dayIndex: def.dayIndex,
      }
    }
  }

  // 4. Relative Day: kemarin lusa, 2 hari lalu
  if (/\b(kemarin\s+lusa|2\s+hari\s+lalu)\b/i.test(lower)) {
    const match = lower.match(/\b(kemarin\s+lusa|2\s+hari\s+lalu)\b/i)
    return {
      dateStr: format(subDays(ref, 2), 'yyyy-MM-dd'),
      matchedText: match ? match[0] : 'kemarin lusa',
    }
  }

  // 5. Standalone kemarin, semalam, tadi malam
  if (/\b(kemarin|semalam|tadi\s+malam)\b/i.test(lower)) {
    const match = lower.match(/\b(kemarin|semalam|tadi\s+malam)\b/i)
    return {
      dateStr: format(subDays(ref, 1), 'yyyy-MM-dd'),
      matchedText: match ? match[0] : 'kemarin',
    }
  }

  // 6. Hari ini, tadi pagi, tadi siang, barusan
  if (/\b(hari\s+ini|tadi\s+pagi|tadi\s+siang|barusan)\b/i.test(lower)) {
    const match = lower.match(/\b(hari\s+ini|tadi\s+pagi|tadi\s+siang|barusan)\b/i)
    return {
      dateStr: format(ref, 'yyyy-MM-dd'),
      matchedText: match ? match[0] : 'hari ini',
    }
  }

  return null
}

/**
 * Parses numeric monetary amounts from Indonesian slang or formatted strings
 * e.g. "10k" -> 10000, "1.5jt" -> 1500000, "ceban" -> 10000
 * @param {string} raw
 * @returns {number}
 */
export function parseIndonesianAmount(raw) {
  if (!raw || typeof raw !== 'string') return 0
  const clean = raw.trim().toLowerCase()

  // Indonesian slang nominals
  if (clean === 'seceng') return 1000
  if (clean === 'noceng') return 2000
  if (clean === 'goceng') return 5000
  if (clean === 'ceban') return 10000
  if (clean === 'cenggo') return 15000
  if (clean === 'nocenggo') return 25000
  if (clean === 'gocap') return 50000
  if (clean === 'cepek') return 100000
  if (clean === 'pekgo') return 150000
  if (clean === 'sejeti') return 1000000

  // Suffix checks
  if (clean.endsWith('k') || clean.endsWith('rb') || clean.endsWith('ribu')) {
    const numPart = parseFloat(clean.replace(/(k|rb|ribu)/g, '').replace(',', '.'))
    if (!isNaN(numPart)) return Math.round(numPart * 1000)
  }
  if (clean.endsWith('jt') || clean.endsWith('juta') || clean.endsWith('m')) {
    const numPart = parseFloat(clean.replace(/(jt|juta|m)/g, '').replace(',', '.'))
    if (!isNaN(numPart)) return Math.round(numPart * 1000000)
  }

  // Preceding Rp or bare digits
  const digitsOnly = clean.replace(/[^0-9]/g, '')
  return parseInt(digitsOnly, 10) || 0
}

/**
 * Extracts clean monetary amount from a sentence, guarding against date numbers (e.g. "2 hari lalu", "9 september", "12 sep")
 * @param {string} text
 * @returns {number}
 */
export function extractMonetaryAmountFromText(text) {
  if (!text || typeof text !== 'string') return 0
  const masked = maskDateExpressions(text)
  const lower = masked.toLowerCase()

  // 1. Check for slang nominals first
  const slangMatch = lower.match(/\b(ceban|goceng|gocap|seceng|noceng|cenggo|nocenggo|cepek|pekgo|sejeti)\b/i)
  if (slangMatch && slangMatch[1]) {
    const slangVal = parseIndonesianAmount(slangMatch[1])
    if (slangVal > 0) return slangVal
  }

  // 2. Spending/Receiving-verb bound amounts (e.g. "habisin 10k", "sebesar 25rb", "bayar 15k", "dapet 60k", "uang saku 60k")
  const verbMatch = lower.match(
    /(?:habisin|keluarin|keluar|sebesar|bayar|beli|total|dapet|dapat|terima|masuk|saku|jajan|gaji|sangu)\s*(?:rp\.?\s*)?(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|perak)?)\b/i
  )
  if (verbMatch && verbMatch[1]) {
    const val = parseIndonesianAmount(verbMatch[1])
    if (val > 0) return val
  }

  // 3. Amount with explicit currency suffix or prefix (e.g. "10k", "rp 50000", "25rb", "1.5jt", "60k")
  const suffixMatch = lower.match(/\b(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|perak))\b/i)
  if (suffixMatch && suffixMatch[1]) {
    const val = parseIndonesianAmount(suffixMatch[1])
    if (val > 0) return val
  }

  const prefixMatch = lower.match(/(?:rp\.?\s*)(\d+(?:[.,]\d+)?)\b/i)
  if (prefixMatch && prefixMatch[1]) {
    const val = parseIndonesianAmount(prefixMatch[1])
    if (val > 0) return val
  }

  // 4. Fallback: search for numbers that are NOT dates (not followed by month name, "hari lalu", or preceded by "tanggal")
  const words = lower.split(/\s+/)
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (/^\d+$/.test(w)) {
      const prev = words[i - 1] || ''
      const next = words[i + 1] || ''
      if (prev.includes('tanggal') || prev.includes('tgl')) continue
      if (next.includes('hari') || next.includes('jam') || next.includes('menit') || next.includes('bulan') || next.includes('tahun')) continue
      if (MONTH_NAME_REGEX.test(next) || MONTH_NAME_REGEX.test(prev)) continue
      const num = parseInt(w, 10)
      if (num >= 500) return num
    }
  }

  return 0
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
export function findWalletInText(text, wallets = [], defaultWalletId = 1) {
  if (!wallets || wallets.length === 0) return defaultWalletId
  const cleanText = text.toLowerCase()
  for (const w of wallets) {
    const wName = String(w.name || '').trim().toLowerCase()
    if (!wName) continue
    const escaped = escapeRegExp(wName)
    const regex = new RegExp(`(?:\\(|\\b)${escaped}(?:\\)|\\b)`, 'i')
    if (regex.test(cleanText)) {
      return w.id
    }
    const wType = String(w.institutionType || w.type || '').toLowerCase()
    if (
      (wType === 'cash' || wName.includes('cash') || wName.includes('tunai')) &&
      /\b(cash|tunai)\b/i.test(cleanText)
    ) {
      return w.id
    }
  }
  return defaultWalletId
}

/**
 * Parses multi-clause / multi-segment sentences connecting multiple transactions
 * e.g. "9 september dapet uang saku 60k dan 12 sep 25k buat beli paketan (dana)"
 *
 * @param {string} normalizedText
 * @param {Array} [wallets]
 * @param {string} [defaultCurrency='IDR']
 * @param {Date} [referenceDate=new Date()]
 * @returns {object|null}
 */
export function parseMultiClauseTransactions(
  normalizedText,
  wallets = [],
  defaultCurrency = 'IDR',
  referenceDate = new Date()
) {
  const ref = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date()
  const todayStr = format(ref, 'yyyy-MM-dd')
  const currentTime = format(ref, 'HH:mm')
  const defaultWalletId = wallets[0]?.id || 1

  // Split by conjunctions: dan, lalu, terus, kemudian, serta, ;, \n, or non-decimal comma
  const delimiterRegex = /\s*(?:;|\n+|\s+(?:dan|lalu|terus|kemudian|serta)\s+|(?<!\d),(?!\d)\s*)\s*/i
  const rawClauses = normalizedText.split(delimiterRegex).map((c) => c.trim()).filter(Boolean)

  if (rawClauses.length < 2) return null

  // Ensure this is not a multi-day shared spending scenario (e.g. "sabtu dan jumat masing-masing 10k")
  if (/\b(masing-masing|tiap\s+hari|setiap\s+hari|per\s+hari)\b/i.test(normalizedText)) {
    return null
  }

  const clauseDetails = []
  let previousDateStr = null

  for (const rawClause of rawClauses) {
    const clauseAmt = extractMonetaryAmountFromText(rawClause)
    if (clauseAmt <= 0) continue

    // Extract calendar date or relative date from this clause
    const dateExtraction = extractDateFromPhrase(rawClause, ref)
    let clauseDate = todayStr
    let dateMatchedText = ''

    if (dateExtraction) {
      clauseDate = dateExtraction.dateStr
      dateMatchedText = dateExtraction.matchedText
      previousDateStr = clauseDate
    } else if (previousDateStr) {
      clauseDate = previousDateStr
    }

    // Determine type: income vs expense
    const isIncome =
      /\b(dapet|dapat|terima|diterima|uang\s+saku|uang\s+jajan|sangu|gaji|salary|pemasukan|penghasilan|masuk|kiriman|dikasih|bonus|thr|hadiah|kado|cashback|komisi|cuan|hasil\s+jual|penjualan|freelance|proyek|adsense|dividen)\b/i.test(
        rawClause
      )
    const txType = isIncome ? 'income' : 'expense'

    // Match wallet
    const resolvedWalletId = findWalletInText(rawClause, wallets, defaultWalletId)
    const matchedWallet = wallets.find((w) => String(w.id) === String(resolvedWalletId))
    const txCurrency = matchedWallet?.currency || defaultCurrency

    // Clean notes: remove date, amount, wallet, and leading verbs
    let cleanNotes = rawClause
    if (dateMatchedText) {
      cleanNotes = cleanNotes.replace(new RegExp(`\\b${escapeRegExp(dateMatchedText)}\\b`, 'gi'), ' ')
    }
    if (matchedWallet) {
      cleanNotes = cleanNotes.replace(new RegExp(`\\(?\\b${escapeRegExp(matchedWallet.name)}\\b\\)?`, 'gi'), ' ')
    }
    // Remove standalone parenthesized wallet mentions like (dana) or (cash)
    cleanNotes = cleanNotes.replace(/\([a-zA-Z0-9\s_-]+\)/g, ' ')

    // Remove amount (e.g. 60k, 25k, rp 50000)
    cleanNotes = cleanNotes.replace(/\b\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|perak)?\b/gi, ' ')
    cleanNotes = cleanNotes.replace(/rp\.?\s*/gi, ' ')

    // Remove leading action verbs
    cleanNotes = cleanNotes
      .replace(/[()]/g, ' ')
      .replace(/^(?:dapet|dapat|terima|diterima|buat\s+beli|beli|buat|untuk|bayar|keluar|keluarin)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim()

    // Determine category and merchant
    let category
    let merchant = undefined

    if (txType === 'income') {
      category = sanitizeCategoryPath(cleanNotes || rawClause, 'income')
      merchant = undefined
    } else {
      const extracted = extractMerchantAndCategory(cleanNotes || rawClause)
      category = extracted.category
      if (extracted.merchant && !MONTH_NAME_REGEX.test(extracted.merchant)) {
        merchant = extracted.merchant
      }
    }

    let finalNotes = cleanNotes
    if (!finalNotes) {
      finalNotes = txType === 'income' ? 'Pemasukan' : 'Pengeluaran'
    } else {
      finalNotes = finalNotes
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    }

    clauseDetails.push({
      type: txType,
      amount: clauseAmt,
      category,
      currency: txCurrency,
      walletId: resolvedWalletId,
      date: clauseDate,
      time: currentTime,
      merchant,
      notes: finalNotes,
    })
  }

  if (clauseDetails.length >= 2) {
    const incomeCount = clauseDetails.filter((t) => t.type === 'income').length
    const expenseCount = clauseDetails.filter((t) => t.type === 'expense').length
    const parts = []
    if (incomeCount > 0) parts.push(`${incomeCount} pemasukan`)
    if (expenseCount > 0) parts.push(`${expenseCount} pengeluaran`)
    const summary = `Berhasil mencatat ${clauseDetails.length} transaksi (${parts.join(', ')}).`

    return {
      type: 'transactions',
      action: 'create',
      transactions: clauseDetails,
      merchant: clauseDetails.find((t) => t.merchant)?.merchant,
      currency: defaultCurrency,
      text: summary,
      chips: ['Catat transaksi lain', 'Lihat riwayat', 'Analisis keuangan'],
      isInstant: true,
    }
  }

  return null
}

/**
 * Primary intelligent heuristic NLP parser for Indonesian financial sentences.
 * Resolves:
 * - Multi-day transactions ("sabtu dan jumwt masing-masing 10k buat maxim")
 * - Specific day relative dates relative to referenceDate
 * - Known merchants and ride-hailing services
 * - Single-item fast transactions
 *
 * @param {string} userText
 * @param {Array} [wallets]
 * @param {string} [defaultCurrency='IDR']
 * @param {Date} [referenceDate=new Date()]
 * @returns {object|null}
 */
export function parseIndonesianFinancialText(
  userText,
  wallets = [],
  defaultCurrency = 'IDR',
  referenceDate = new Date()
) {
  if (!userText || typeof userText !== 'string') return null
  const trimmed = userText.trim()
  if (!trimmed || trimmed.length > 250) return null

  const normalized = normalizeIndonesianNlpText(trimmed)
  const lower = normalized.toLowerCase()

  // 1. Guard against non-transaction questions / analytical queries
  const nonTxQuery =
    /kesehatan\s+keuangan|financial\s+health|evaluasi|skor|utang\s+piutang|daftar\s+utang|siapa\s+yang\s+utang|target\s+tabungan|habit\s+harian|laporan\s+keuangan|analisis/i.test(
      lower
    )
  if (nonTxQuery) return null

  const ref = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date()
  const todayStr = format(ref, 'yyyy-MM-dd')
  const currentTime = format(ref, 'HH:mm')
  const defaultWalletId = wallets[0]?.id || 1

  // 1A. PATTERN 0: Multi-clause transactions connecting multiple items (e.g. "9 september dapet uang saku 60k dan 12 sep 25k buat beli paketan (dana)")
  const multiClauseResult = parseMultiClauseTransactions(normalized, wallets, defaultCurrency, ref)
  if (multiClauseResult) {
    return multiClauseResult
  }

  // 2. PATTERN A: Multi-day spending resolution
  // Scan for mentioned days of the week
  const detectedWeekDays = []
  for (const def of DAY_DEFINITIONS) {
    if (def.regex.test(lower)) {
      // Check if user explicitly mentioned past week qualifier (e.g. "senin lalu", "senin kemarin")
      const dayNameInText = def.canonical
      const hasPastQualifier =
        new RegExp(`${dayNameInText}\\s+(kemarin|lalu|minggu\\s+lalu)`, 'i').test(lower) ||
        new RegExp(`(kemarin|minggu\\s+lalu)\\s+hari\\s+${dayNameInText}`, 'i').test(lower)

      const dateStr = getRecentPastDayDate(def.dayIndex, ref, hasPastQualifier)
      detectedWeekDays.push({
        dayIndex: def.dayIndex,
        name: def.nameId,
        dateStr,
      })
    }
  }

  // Also check for relative days (kemarin, kemarin lusa, hari ini) if not already qualifying a day name
  const detectedRelativeDays = []
  if (/\b(kemarin\s+lusa|2\s+hari\s+lalu)\b/i.test(lower)) {
    detectedRelativeDays.push({
      dayIndex: -2,
      name: 'Kemarin Lusa',
      dateStr: format(subDays(ref, 2), 'yyyy-MM-dd'),
    })
  }
  // Standalone kemarin (checked on text with 'kemarin lusa' / '2 hari lalu' removed)
  const withoutLusa = lower.replace(/\b(kemarin\s+lusa|2\s+hari\s+lalu)\b/gi, '')
  if (/\bkemarin\b/i.test(withoutLusa) && detectedWeekDays.length === 0) {
    detectedRelativeDays.push({
      dayIndex: -1,
      name: 'Kemarin',
      dateStr: format(subDays(ref, 1), 'yyyy-MM-dd'),
    })
  }

  // If specific weekdays (>= 2) were already mentioned (e.g. "sabtu dan jumat"), prioritize them
  // over introductory relative phrases like "kemarin 2 hari lalu sabtu dan jumat"
  const allFoundDays = detectedWeekDays.length >= 2 ? [...detectedWeekDays] : [...detectedWeekDays, ...detectedRelativeDays]

  // Check if this is a multi-day transaction scenario
  const hasMultiDayKeywords =
    /\b(masing-masing|tiap\s+hari|setiap\s+hari|per\s+hari)\b/i.test(lower) ||
    /(\bdan\b|\bsama\b|\bserta\b|&|,)/.test(lower)

  if (allFoundDays.length >= 2 && hasMultiDayKeywords) {
    // 2A. Extract merchant and category
    const { merchant, category } = extractMerchantAndCategory(normalized)
    const cleanMerchant = merchant || 'Pengeluaran'
    const cleanNotes = merchant || 'Pengeluaran'

    // Match wallet if mentioned
    let resolvedWalletId = defaultWalletId
    for (const w of wallets) {
      const wName = String(w.name || '').toLowerCase()
      if (lower.includes(wName) || (wName.includes('cash') && lower.includes('tunai'))) {
        resolvedWalletId = w.id
        break
      }
    }

    const matchedWallet = wallets.find((w) => String(w.id) === String(resolvedWalletId))
    const txCurrency = matchedWallet?.currency || defaultCurrency

    // Sort days chronologically descending (latest date first: e.g. Saturday then Friday)
    allFoundDays.sort((a, b) => b.dateStr.localeCompare(a.dateStr))

    // Check if each day has a specific amount (e.g. "sabtu 20k jumat 10k") or a shared amount ("masing-masing 10k")
    const commonAmount = extractMonetaryAmountFromText(lower)

    const transactions = allFoundDays.map((d) => {
      // Check for per-day amount override
      const daySpecificRegex = new RegExp(
        `(?:${d.name}|${d.name.toLowerCase()})[^\\d]{0,15}(\\d+(?:[.,]\\d+)?\\s*(?:k|rb|ribu|jt|juta|m|perak)?)\\b`,
        'i'
      )
      const dayMatch = lower.match(daySpecificRegex)
      let itemAmount = commonAmount
      if (dayMatch && dayMatch[1]) {
        const parsed = parseIndonesianAmount(dayMatch[1])
        if (parsed > 0) itemAmount = parsed
      }

      return {
        type: 'expense',
        amount: itemAmount,
        category,
        currency: txCurrency,
        walletId: resolvedWalletId,
        date: d.dateStr,
        time: currentTime,
        merchant: cleanMerchant,
        notes: cleanNotes,
      }
    })

    const validTxs = transactions.filter((t) => t.amount > 0)
    if (validTxs.length >= 2) {
      const dayNamesStr = allFoundDays.map((d) => d.name).join(' dan ')
      const replyText = `Berhasil mencatat ${validTxs.length} pengeluaran ${cleanMerchant} (${dayNamesStr}).`

      return {
        type: 'transactions',
        action: 'create',
        transactions: validTxs,
        merchant: cleanMerchant,
        currency: txCurrency,
        text: replyText,
        chips: ['Catat transaksi lain', 'Lihat riwayat', 'Analisis keuangan'],
        isInstant: true,
      }
    }

    if (commonAmount <= 0) {
      const dayNamesStr = allFoundDays.map((d) => d.name).join(' dan ')
      return {
        error: true,
        message: `Nominal transaksi belum disebutkan untuk ${dayNamesStr}. Contoh: "kemarin ${allFoundDays[0]?.name.toLowerCase()} dan ${allFoundDays[1]?.name.toLowerCase()} masing-masing 10k buat maxim".`,
      }
    }
  }

  // 3. PATTERN B: Single-day with relative day, weekday name, or calendar date
  const dateResult = extractDateFromPhrase(normalized, ref)
  const resolvedDate = dateResult ? dateResult.dateStr : todayStr

  // 4. PATTERN C: Clean item & amount extraction
  let clean = normalized
  if (dateResult?.matchedText) {
    clean = clean.replace(new RegExp(`\\b${escapeRegExp(dateResult.matchedText)}\\b`, 'gi'), ' ')
  }
  clean = clean
    .replace(/^(kemarin\s+|tadi\s+pagi\s+|tadi\s+siang\s+|tadi\s+malam\s+|hari\s+ini\s+|semalam\s+)/i, '')
    .replace(/^(beli|bayar|catat|tambah|pengeluaran|pemasukan|dapat|dapet|terima|makan|minum)\s+/i, '')
    .trim()

  const match = clean.match(
    /^([a-zA-Z0-9\s\-_]+?)\s+(?:sebesar\s+|rp\.?\s*|\$\s*|€\s*)?(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|perak)?)(?:\s+(.*))?$/i
  )

  if (match) {
    const rawItem = match[1].trim()
    const rawAmt = match[2].trim()
    const rawTail = (match[3] || '').trim()

    if (rawItem && rawItem.length >= 2 && !/\bhabisin\b/i.test(rawItem) && rawItem.split(/\s+/).length <= 4) {
      const numericAmt = parseIndonesianAmount(rawAmt)
      if (numericAmt > 0) {
        const isIncome =
          /\b(gaji|salary|sangu|uang\s+saku|uang\s+jajan|kiriman|bonus|thr|hadiah|kado|cashback|komisi|penjualan|freelance|proyek|adsense|dividen|untung|cuan)\b/i.test(
            rawItem.toLowerCase()
          ) ||
          /\b(dapet|dapat|terima|diterima|masuk|pemasukan)\b/i.test(normalized.toLowerCase())
        const txType = isIncome ? 'income' : 'expense'

        const { merchant, category } = extractMerchantAndCategory(rawTail ? `${rawItem} ${rawTail}` : rawItem)
        const capitalizedItem = merchant || rawItem.charAt(0).toUpperCase() + rawItem.slice(1)

        let resolvedWalletId = defaultWalletId
        const searchTail = `${rawTail} ${rawItem}`.toLowerCase()
        for (const w of wallets) {
          const wName = String(w.name || '').toLowerCase()
          if (searchTail.includes(wName) || (wName.includes('cash') && searchTail.includes('tunai'))) {
            resolvedWalletId = w.id
            break
          }
        }

        const matchedWallet = wallets.find((w) => String(w.id) === String(resolvedWalletId))
        const txCurrency = matchedWallet?.currency || defaultCurrency

        return {
          type: 'transactions',
          action: 'create',
          transactions: [
            {
              type: txType,
              amount: numericAmt,
              category: category || sanitizeCategoryPath(rawItem, txType),
              currency: txCurrency,
              walletId: resolvedWalletId,
              date: resolvedDate,
              time: currentTime,
              merchant: txType === 'expense' ? capitalizedItem : undefined,
              notes: capitalizedItem + (rawTail && !merchant ? ` (${rawTail})` : ''),
            },
          ],
          merchant: txType === 'expense' ? capitalizedItem : undefined,
          currency: txCurrency,
          text: `Berhasil mencatat ${txType === 'income' ? 'pemasukan' : 'pengeluaran'} ${capitalizedItem} sebesar ${formatCurrency(numericAmt, txCurrency)}.`,
          chips: ['Catat transaksi lain', 'Lihat riwayat', 'Analisis keuangan'],
          isInstant: true,
        }
      }
    }
  }

  // 5. Structured fallback for phrases like "habisin 10k buat maxim kemarin"
  const amountMatch =
    normalized.match(
      /(?:habisin|bayar|beli|keluar|sebesar)\s*(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|perak)?)\s+(?:buat|untuk|di|naik)?\s*([a-zA-Z0-9\-_]+)/i
    ) ||
    normalized.match(
      /\b(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|perak))\s+(?:buat|untuk|di|naik)\s+([a-zA-Z0-9\-_]+)/i
    )

  if (amountMatch && amountMatch[1] && amountMatch[2]) {
    const targetWord = amountMatch[2].toLowerCase()
    // Month names are NEVER merchants or transaction targets
    if (!MONTH_NAME_REGEX.test(targetWord)) {
      const amt = parseIndonesianAmount(amountMatch[1])
      if (amt > 0 && targetWord.length >= 3) {
        const { merchant, category } = extractMerchantAndCategory(amountMatch[2])
        const cleanMerchant = merchant || amountMatch[2].charAt(0).toUpperCase() + amountMatch[2].slice(1)
        const matchedWallet = wallets.find((w) => String(w.id) === String(defaultWalletId))
        const txCurrency = matchedWallet?.currency || defaultCurrency

        return {
          type: 'transactions',
          action: 'create',
          transactions: [
            {
              type: 'expense',
              amount: amt,
              category,
              currency: txCurrency,
              walletId: defaultWalletId,
              date: resolvedDate,
              time: currentTime,
              merchant: cleanMerchant,
              notes: cleanMerchant,
            },
          ],
          merchant: cleanMerchant,
          currency: txCurrency,
          text: `Berhasil mencatat pengeluaran ${cleanMerchant} sebesar ${formatCurrency(amt, txCurrency)}.`,
          chips: ['Catat transaksi lain', 'Lihat riwayat', 'Analisis keuangan'],
          isInstant: true,
        }
      }
    }
  }

  // 6. Action verb guard when user clearly attempted to record an expenditure without mentioning amount
  const isQuestion =
    /\?|^(apa|apakah|berapa|bagaimana|gimana|kapan|kenapa|siapa|tolong\s+jelaskan|tolong\s+cek)\b/i.test(lower) ||
    /\b(apa\s+saja|apa\s+aja|berapa\s+total|berapa\s+banyak)\b/i.test(lower)

  if (!isQuestion && !nonTxQuery) {
    const hasExplicitSpendingAction =
      /\b(habisin|habiskan|keluarin|ngeluarin|buat\s+beli|beli|bayar|buat\s+maxim|buat\s+gofood|buat\s+grab)\b/i.test(
        lower
      )
    const totalAmt = extractMonetaryAmountFromText(lower)
    if (hasExplicitSpendingAction && totalAmt <= 0) {
      return {
        error: true,
        message: 'Nominal transaksi belum disebutkan. Silakan sertakan jumlah uangnya (contoh: "beli kopi 20rb" atau "buat maxim 15k").',
      }
    }
  }

  return null
}
