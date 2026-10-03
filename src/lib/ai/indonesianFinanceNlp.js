import { format, subDays, addDays } from 'date-fns'
import { sanitizeCategoryPath } from '../categorySanitizer'
import { formatCurrency } from '../utils'
import { evaluateExpression } from '../calcParser'
import useSettingsStore from '../../store/useSettingsStore'
import {
  extractTimeSlot,
  extractVenueSlot,
  extractCleanSubjectEntity,
} from './semanticSlotFiller'
import { predictOmissionSuggestion } from './entityMemory'

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
  {
    regex: /\b(kulo)\b/i,
    name: 'Kulo',
    category: 'makanan/kopi',
  },
  {
    regex: /\b(fore|fore coffee)\b/i,
    name: 'Fore Coffee',
    category: 'makanan/kopi',
  },
  {
    regex: /\b(mixue)\b/i,
    name: 'Mixue',
    category: 'makanan/minuman',
  },
  {
    regex: /\b(point coffee|pointcoffee)\b/i,
    name: 'Point Coffee',
    category: 'makanan/kopi',
  },
  {
    regex: /\b(tomoro|tomoro coffee)\b/i,
    name: 'Tomoro Coffee',
    category: 'makanan/kopi',
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
  const targetDate = subDays(refDate, diff)
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
  // (guarding against decimal quantities like "2.5 kg" or "10.5 liter")
  const numericDateMatch = lower.match(
    /(?:(tgl|tanggal)\s+)?\b(\d{1,2})([/.-])(\d{1,2})(?:([/.-])(\d{2,4}))?(?!\s*(?:kg|gram|g|l|liter|ml|pcs|buah|meter|m|km|ons|butir|pax|box|dus|k|rb|ribu|jt|juta|miliar|milyar|b|billion|million|perak))\b/i
  )
  if (numericDateMatch) {
    const hasPrefix = Boolean(numericDateMatch[1])
    const sep = numericDateMatch[3]
    const hasYear = Boolean(numericDateMatch[5])

    // If dot separator without prefix and without explicit year, treat as decimal number, not a date
    const isDecimalNumber = sep === '.' && !hasPrefix && !hasYear
    if (!isDecimalNumber) {
      const day = parseInt(numericDateMatch[2], 10)
      const month = parseInt(numericDateMatch[4], 10)
      let year = refYear
      if (numericDateMatch[6]) {
        const rawYear = parseInt(numericDateMatch[6], 10)
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
  }

  // 2.5. Standalone Day of Current Month: "tanggal 25", "tgl 1"
  const standaloneDayMatch = lower.match(/\b(?:tanggal|tgl)\s+(\d{1,2})\b/i)
  if (standaloneDayMatch) {
    const day = parseInt(standaloneDayMatch[1], 10)
    if (day >= 1 && day <= 31) {
      const month = ref.getMonth() + 1
      const year = refYear
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return {
        dateStr,
        matchedText: standaloneDayMatch[0].trim(),
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

  // 3.5. Relative Future: besok lusa, lusa, 2 hari lagi
  if (/\b(besok\s+lusa|\blusa\b|2\s+hari\s+lagi)\b/i.test(lower)) {
    const match = lower.match(/\b(besok\s+lusa|\blusa\b|2\s+hari\s+lagi)\b/i)
    return {
      dateStr: format(addDays(ref, 2), 'yyyy-MM-dd'),
      matchedText: match ? match[0] : 'lusa',
    }
  }

  // 3.6. Standalone besok, bsk, besok pagi/siang/sore/malam
  if (/\b(besok|bsk)\b/i.test(lower)) {
    const match = lower.match(/\b(besok|bsk)(?:\s+(?:pagi|siang|sore|malam))?\b/i)
    return {
      dateStr: format(addDays(ref, 1), 'yyyy-MM-dd'),
      matchedText: match ? match[0] : 'besok',
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

  // 6. Hari ini, tadi pagi, tadi siang, tadi sore, barusan, tadi
  if (/\b(hari\s+ini|tadi\s+pagi|tadi\s+siang|tadi\s+sore|barusan|\btadi\b)/i.test(lower)) {
    const match = lower.match(/\b(hari\s+ini|tadi\s+pagi|tadi\s+siang|tadi\s+sore|barusan|\btadi\b)/i)
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
  const clean = raw.trim().toLowerCase().replace(/\s*(rupiah|idr|rp\.?)\s*$/i, '')

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
  if (clean.endsWith('miliar') || clean.endsWith('milyar') || clean.endsWith('b')) {
    const numPart = parseFloat(clean.replace(/(miliar|milyar|b)/g, '').replace(',', '.'))
    if (!isNaN(numPart)) return Math.round(numPart * 1000000000)
  }
  if (clean.endsWith('jt') || clean.endsWith('juta') || clean.endsWith('m')) {
    const numPart = parseFloat(clean.replace(/(jt|juta|m)/g, '').replace(',', '.'))
    if (!isNaN(numPart)) return Math.round(numPart * 1000000)
  }

  // Preceding Rp or bare digits
  const trimmed = clean.replace(/[^\d]+$/, '')
  // Support trailing sen: e.g. ,00, ,000, ,50, or .00, .50 (1-2 digits decimal, or 3 zero decimals after comma)
  const decimalMatch = trimmed.match(/^(.*?)(?:,(000)|[,.]([\d]{1,2}))$/)
  if (decimalMatch) {
    const intDigits = decimalMatch[1].replace(/[^\d]/g, '')
    const decDigits = decimalMatch[2] ? '0' : decimalMatch[3]
    const intNum = parseInt(intDigits, 10) || 0
    const decNum = Number(`0.${decDigits}`)
    return Math.round(intNum + (Number.isFinite(decNum) ? decNum : 0))
  }

  const digitsOnly = clean.replace(/[^0-9]/g, '')
  return parseInt(digitsOnly, 10) || 0
}

/**
 * Detects currency code from Indonesian text or symbols ($, €, S$, £, ¥, RM, etc.).
 * @param {string} text
 * @param {string} [defaultCurrency='IDR']
 * @returns {string} 3-letter currency code (IDR, USD, EUR, SGD, MYR, GBP, JPY)
 */
export function extractCurrencyFromText(text, defaultCurrency = 'IDR') {
  if (!text || typeof text !== 'string') return defaultCurrency
  const lower = text.toLowerCase()
  if (/(s\$|\bsgd\b)/i.test(lower) || /s\$\s*\d+/i.test(lower)) return 'SGD'
  if (/(€|\beur\b)/i.test(lower) || /€\s*\d+/i.test(lower)) return 'EUR'
  if (/(£|\bgbp\b)/i.test(lower) || /£\s*\d+/i.test(lower)) return 'GBP'
  if (/(¥|\bjpy\b)/i.test(lower) || /¥\s*\d+/i.test(lower)) return 'JPY'
  if (/(rm\s*\d+|\bmyr\b|\brm\b)/i.test(lower)) return 'MYR'
  if (/(^|[^a-z])\$(\s*\d+|(?![a-z]))/i.test(lower) || /\busd\b/i.test(lower)) return 'USD'
  if (/\b(rp|idr)\b/i.test(lower)) return 'IDR'
  return defaultCurrency
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

  // 0. Arithmetic expressions: e.g. "35k + 5k", "120k / 4", "50k - 10k", "20000 + 15000"
  const arithmeticMatch = lower.match(
    /\b(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|miliar|milyar|b)?)\s*([+\-*/])\s*(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|miliar|milyar|b)?)\b/i
  )
  if (arithmeticMatch) {
    const expr = arithmeticMatch[0]
    const evalRes = evaluateExpression(expr, 'IDR')
    if (evalRes && evalRes.isValid && evalRes.result > 0) {
      return evalRes.result
    }
  }

  // 0.5. Multiplier expressions: e.g. "2 @ 25k", "3x 20rb", "2 cup per 15k", "2 porsi @ 30k"
  const multiplierMatch = lower.match(
    /\b(\d+)\s*(?:cup|porsi|pax|lusin|pcs|pc|gelas|piring|butir|bungkus)?\s*(?:@|per|satuan|x|masing-masing)\s*(?:rp\.?\s*|\$\s*|€\s*)?(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|miliar|milyar|b)?)\b/i
  )
  if (multiplierMatch) {
    const qty = parseInt(multiplierMatch[1], 10)
    const unitPrice = parseIndonesianAmount(multiplierMatch[2])
    if (qty > 0 && unitPrice > 0) {
      return qty * unitPrice
    }
  }

  // 0.7. Foreign currency symbols (e.g. "$15", "$5", "€20", "S$12", "15 USD", "20 EUR")
  const foreignMatch = lower.match(/(?:[$€£¥]|s\$|rm)\s*(\d+(?:[.,]\d+)?)\b/i) ||
    lower.match(/\b(\d+(?:[.,]\d+)?)\s*(?:usd|eur|sgd|myr|jpy|gbp)\b/i)
  if (foreignMatch && foreignMatch[1]) {
    const foreignVal = parseFloat(foreignMatch[1].replace(',', '.'))
    if (foreignVal > 0) return foreignVal
  }

  // 1. Check for slang nominals first
  const slangMatch = lower.match(/\b(ceban|goceng|gocap|seceng|noceng|cenggo|nocenggo|cepek|pekgo|sejeti)\b/i)
  if (slangMatch && slangMatch[1]) {
    const slangVal = parseIndonesianAmount(slangMatch[1])
    if (slangVal > 0) return slangVal
  }

  // 2. Spending/Receiving-verb bound amounts (e.g. "habisin 10k", "sebesar 25rb", "bayar 15k", "dapet 60k", "uang saku 60k")
  const verbMatch = lower.match(
    /(?:habisin|keluarin|keluar|sebesar|bayar|beli|total|dapet|dapat|terima|masuk|saku|jajan|gaji|sangu)\s*(?:rp\.?\s*)?(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|miliar|milyar|b|perak)?)\b/i
  )
  if (verbMatch && verbMatch[1]) {
    const val = parseIndonesianAmount(verbMatch[1])
    if (val > 0) return val
  }

  // 3. Amount with explicit currency suffix or prefix (e.g. "10k", "rp 50000", "25rb", "1.5jt", "60k")
  const suffixMatch = lower.match(/\b(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|miliar|milyar|b|perak))\b/i)
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

/**
 * Intelligent heuristic parser for Indonesian balance transfers, top-ups, and cash withdrawals.
 * Recognizes keywords: transfer, pindah saldo, tarik tunai, top up
 *
 * @param {string} normalizedText
 * @param {Array} [wallets]
 * @param {string} [defaultCurrency='IDR']
 * @param {Date} [referenceDate=new Date()]
 * @returns {object|null}
 */
export function parseTransferTransaction(
  normalizedText,
  wallets = [],
  defaultCurrency = 'IDR',
  referenceDate = new Date()
) {
  if (!normalizedText || typeof normalizedText !== 'string') return null
  const lower = normalizedText.toLowerCase()

  const isTransfer = /\b(transfer|tf|trf|pindah\s+saldo|pindahkan\s+saldo|geser\s+saldo)\b/i.test(lower)
  const isTarikTunai = /\b(tarik\s+tunai|tariktunai|ambil\s+tunai|tarik\s+uang|ambil\s+uang\s+di\s+atm)\b/i.test(lower)
  const isTopUp = /\b(top\s*up|topup|isi\s+saldo)\b/i.test(lower)

  if (!isTransfer && !isTarikTunai && !isTopUp) {
    return null
  }

  // Guard against analytical questions / explanations
  const isQuestion =
    /\?|^(apa|apakah|bagaimana|gimana|kenapa|mengapa|kapan|siapa|cara)\b/i.test(lower) ||
    /\b(cara\s+transfer|cara\s+tarik|cara\s+top\s*up)\b/i.test(lower)
  if (isQuestion) return null

  const ref = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date()
  const todayStr = format(ref, 'yyyy-MM-dd')
  const currentTime = format(ref, 'HH:mm')
  const timeSlot = extractTimeSlot(normalizedText, ref)
  const resolvedTime = timeSlot ? timeSlot.timeStr : currentTime
  const defaultWalletId = useSettingsStore.getState?.().defaultWalletId || wallets[0]?.id || 1

  const amt = extractMonetaryAmountFromText(lower)
  if (amt <= 0) {
    return {
      error: true,
      message:
        'Nominal transfer belum disebutkan. Silakan sertakan jumlah uangnya (contoh: "transfer 50rb dari bca ke gopay" atau "tarik tunai 100k dari bca").',
    }
  }

  if (wallets.length < 2) {
    return {
      error: true,
      message: 'Transfer saldo membutuhkan minimal 2 dompet aktif. Silakan buat dompet tujuan terlebih dahulu.',
    }
  }

  let sourceWalletId = null
  let targetWalletId = null

  if (isTarikTunai) {
    // Tarik tunai: target is physical cash
    const cashWallet =
      wallets.find(
        (w) =>
          String(w.institutionType || w.type || '').toLowerCase() === 'cash' ||
          String(w.name || '').toLowerCase().includes('cash') ||
          String(w.name || '').toLowerCase().includes('tunai')
      ) || wallets[1] || wallets[0]
    targetWalletId = cashWallet?.id || wallets[1]?.id

    // Source is the debit bank/e-wallet
    const cleanForSource = lower.replace(/\b(tarik\s+tunai|tariktunai|ambil\s+tunai|tarik\s+uang|cash|tunai)\b/gi, ' ')
    const dariMatch = cleanForSource.match(/\bdari\s+([a-zA-Z0-9_\-\s]+)/i)
    const sourceSnippet = dariMatch ? dariMatch[1] : cleanForSource
    sourceWalletId = findWalletInText(sourceSnippet, wallets, null)

    if (!sourceWalletId || String(sourceWalletId) === String(targetWalletId)) {
      const nonCash = wallets.find((w) => String(w.id) !== String(targetWalletId))
      sourceWalletId = nonCash ? nonCash.id : defaultWalletId
    }
  } else if (isTopUp) {
    // 1. Source is the funding wallet (dari/pakai/lewat/menggunakan/via)
    const dariMatch =
      lower.match(/\b(?:dari|pakai|lewat|menggunakan|via)\s+([a-zA-Z0-9_\s-]+?)(?:\s+(?:ke|sebesar|sejumlah|\d)|$)/i) ||
      lower.match(/\b(?:dari|pakai|lewat|menggunakan|via)\s+([a-zA-Z0-9_\s-]+)/i)
    if (dariMatch) {
      sourceWalletId = findWalletInText(dariMatch[1], wallets, null)
    }

    // 2. Target is destination e-wallet/account
    const cleanForTarget = lower.replace(/\b(?:dari|pakai|lewat|menggunakan|via)\s+([a-zA-Z0-9_\s-]+)/i, ' ')
    const keMatch =
      cleanForTarget.match(/\bke\s+([a-zA-Z0-9_\s-]+?)(?:\s+(?:sebesar|sejumlah|\d)|$)/i) ||
      cleanForTarget.match(/\bke\s+([a-zA-Z0-9_\s-]+)/i)
    if (keMatch) {
      targetWalletId = findWalletInText(keMatch[1], wallets, null)
    }
    if (!targetWalletId) {
      const afterTopUpMatch = cleanForTarget.match(
        /\b(?:top\s*up|topup|isi\s+saldo)\s+(?:saldo\s+)?([a-zA-Z0-9_\s-]+?)(?:\s+(?:sebesar|sejumlah|\d)|$)/i
      )
      if (afterTopUpMatch) {
        targetWalletId = findWalletInText(afterTopUpMatch[1], wallets, null)
      }
    }
    if (!targetWalletId) {
      targetWalletId = findWalletInText(cleanForTarget, wallets, null)
    }

    if (!sourceWalletId || String(sourceWalletId) === String(targetWalletId)) {
      const fallbackSource = wallets.find((w) => String(w.id) !== String(targetWalletId))
      sourceWalletId = fallbackSource ? fallbackSource.id : defaultWalletId
    }
  } else {
    // Standard transfer / pindah saldo
    const dariKeMatch = lower.match(/\bdari\s+([a-zA-Z0-9_\s-]+?)\s+ke\s+([a-zA-Z0-9_\s-]+)/i)
    const keDariMatch = lower.match(/\bke\s+([a-zA-Z0-9_\s-]+?)\s+dari\s+([a-zA-Z0-9_\s-]+)/i)

    if (dariKeMatch) {
      sourceWalletId = findWalletInText(dariKeMatch[1], wallets, null)
      targetWalletId = findWalletInText(dariKeMatch[2], wallets, null)
    } else if (keDariMatch) {
      targetWalletId = findWalletInText(keDariMatch[1], wallets, null)
      sourceWalletId = findWalletInText(keDariMatch[2], wallets, null)
    } else {
      const keOnlyMatch = lower.match(/\bke\s+([a-zA-Z0-9_\s-]+)/i)
      if (keOnlyMatch) {
        targetWalletId = findWalletInText(keOnlyMatch[1], wallets, null)
      }
      const dariOnlyMatch = lower.match(/\bdari\s+([a-zA-Z0-9_\s-]+)/i)
      if (dariOnlyMatch) {
        sourceWalletId = findWalletInText(dariOnlyMatch[1], wallets, null)
      }
      if (!sourceWalletId || !targetWalletId) {
        const simpleKeMatch =
          lower.match(/([a-zA-Z0-9_\s-]+?)\s+ke\s+([a-zA-Z0-9_\s-]+?)(?:\s+(?:sebesar|sejumlah|\d)|$)/i) ||
          lower.match(/([a-zA-Z0-9_-]+)\s+ke\s+([a-zA-Z0-9_-]+)/i)
        if (simpleKeMatch) {
          sourceWalletId = sourceWalletId || findWalletInText(simpleKeMatch[1], wallets, null)
          targetWalletId = targetWalletId || findWalletInText(simpleKeMatch[2], wallets, null)
        }
      }
    }

    if (!sourceWalletId && wallets.length > 0) {
      const configured = wallets.find((w) => w.id === defaultWalletId)
      sourceWalletId = configured ? configured.id : wallets[0].id
    }
    if (!targetWalletId) {
      const other = wallets.find((w) => String(w.id) !== String(sourceWalletId))
      targetWalletId = other ? other.id : wallets[1]?.id || defaultWalletId
    }
  }

  // Ensure source and target are not the exact same wallet
  if (String(sourceWalletId) === String(targetWalletId)) {
    const alternative = wallets.find((w) => String(w.id) !== String(sourceWalletId))
    if (alternative) {
      targetWalletId = alternative.id
    }
  }

  const dateResult = extractDateFromPhrase(normalizedText, ref)
  const resolvedDate = dateResult ? dateResult.dateStr : todayStr

  const sourceWallet = wallets.find((w) => String(w.id) === String(sourceWalletId))
  const destWallet = wallets.find((w) => String(w.id) === String(targetWalletId))
  const txCurrency = sourceWallet?.currency || defaultCurrency
  const srcName = sourceWallet?.name || 'Dompet Asal'
  const dstName = destWallet?.name || 'Dompet Tujuan'

  return {
    type: 'transactions',
    action: 'create',
    transactions: [
      {
        type: 'transfer',
        amount: amt,
        category: 'transfer/umum',
        currency: txCurrency,
        walletId: sourceWalletId,
        targetWalletId: targetWalletId,
        date: resolvedDate,
        time: resolvedTime,
        notes: `Transfer ${srcName} ke ${dstName}`,
      },
    ],
    currency: txCurrency,
    text: `Berhasil mencatat transfer sebesar ${formatCurrency(amt, txCurrency)} dari ${srcName} ke ${dstName}.`,
    chips: ['Catat transaksi lain', 'Lihat riwayat', 'Analisis keuangan'],
    isInstant: true,
  }
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
  const defaultWalletId = useSettingsStore.getState?.().defaultWalletId || wallets[0]?.id || 1

  // Split by conjunctions: dan, lalu, terus, kemudian, serta, sama, &, ;, \n, or non-decimal comma
  const delimiterRegex = /\s*(?:;|\n+|\s+(?:dan|lalu|terus|kemudian|serta|sama|&)\s+|(?<!\d),(?!\d)\s*)\s*/i
  const rawClauses = normalizedText.split(delimiterRegex).map((c) => c.trim()).filter(Boolean)

  if (rawClauses.length < 2) return null

  // Ensure this is not a multi-day shared spending scenario (e.g. "sabtu dan jumat masing-masing 10k")
  if (/\b(masing-masing|tiap\s+hari|setiap\s+hari|per\s+hari)\b/i.test(normalizedText)) {
    return null
  }

  const clauseDetails = []
  let previousDateStr = null

  const sentenceTimeSlot = extractTimeSlot(normalizedText, ref)

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

    const clauseTimeSlot = extractTimeSlot(rawClause, ref) || sentenceTimeSlot
    const clauseTime = clauseTimeSlot ? clauseTimeSlot.timeStr : currentTime

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

    // Semantic slot filling for subject entity and venue
    const cleanNotes = extractCleanSubjectEntity(rawClause, {
      txType,
      dateMatchedText,
      walletName: matchedWallet?.name,
    })
    const venueSlot = extractVenueSlot(rawClause, KNOWN_MERCHANT_SERVICES)

    // Determine category and merchant
    let category
    let merchant = undefined

    if (venueSlot) {
      merchant = venueSlot.venue
    }

    if (txType === 'income') {
      category = sanitizeCategoryPath(cleanNotes || rawClause, 'income')
      merchant = undefined
    } else {
      const extracted = extractMerchantAndCategory(cleanNotes || rawClause)
      category = extracted.category
      if (!merchant && extracted.merchant && !MONTH_NAME_REGEX.test(extracted.merchant)) {
        merchant = extracted.merchant
      }
    }

    let finalNotes = cleanNotes
    if (!finalNotes) {
      finalNotes = txType === 'income' ? 'Pemasukan' : 'Pengeluaran'
    }

    clauseDetails.push({
      type: txType,
      amount: clauseAmt,
      category,
      currency: txCurrency,
      walletId: resolvedWalletId,
      date: clauseDate,
      time: clauseTime,
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
  const timeSlot = extractTimeSlot(normalized, ref)
  const resolvedTime = timeSlot ? timeSlot.timeStr : currentTime
  const defaultWalletId = useSettingsStore.getState?.().defaultWalletId || wallets[0]?.id || 1

  // 1A. PATTERN 0: Multi-clause transactions connecting multiple items (e.g. "9 september dapet uang saku 60k dan 12 sep 25k buat beli paketan (dana)")
  const multiClauseResult = parseMultiClauseTransactions(normalized, wallets, defaultCurrency, ref)
  if (multiClauseResult) {
    return multiClauseResult
  }

  // 1B. PATTERN TRANSFER: Transfer / pindah saldo / tarik tunai / top up
  const transferResult = parseTransferTransaction(normalized, wallets, defaultCurrency, ref)
  if (transferResult) {
    return transferResult
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
    const resolvedWalletId = findWalletInText(normalized, wallets, defaultWalletId)

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
        time: resolvedTime,
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
  if (timeSlot?.matchedText) {
    clean = clean.replace(new RegExp(`\\b${escapeRegExp(timeSlot.matchedText)}\\b`, 'gi'), ' ')
  }
  clean = clean
    .replace(/^(kemarin\s+|tadi\s+pagi\s+|tadi\s+siang\s+|tadi\s+sore\s+|tadi\s+malam\s+|hari\s+ini\s+|semalam\s+|tadi\s+|barusan\s+)/i, '')
    .replace(/^(beli|bayar|catat|tambah|pengeluaran|pemasukan|dapat|dapet|terima|makan(?!\s+(?:siang|pagi|malam))|minum)\s+/i, '')
    .trim()

  if (/[@+\-*/]/.test(clean)) {
    const mathAmt = extractMonetaryAmountFromText(clean)
    if (mathAmt > 0) {
      const cleanSub = extractCleanSubjectEntity(clean, {
        txType: 'expense',
        dateMatchedText: dateResult?.matchedText,
        timeMatchedText: timeSlot?.matchedText,
      })
      const cleanSubject = typeof cleanSub === 'string' && cleanSub !== 'Pengeluaran' ? cleanSub : 'Pengeluaran'
      const venueSlot = extractVenueSlot(normalized, KNOWN_MERCHANT_SERVICES)
      const cleanMerchant = venueSlot?.venue || undefined
      const detectedCurrency = extractCurrencyFromText(normalized, defaultCurrency)
      let resolvedWalletId = findWalletInText(normalized, wallets, defaultWalletId)
      if (detectedCurrency && detectedCurrency !== defaultCurrency) {
        const currencyWallet = wallets.find((w) => (w.currency || '').toUpperCase() === detectedCurrency.toUpperCase())
        if (currencyWallet) {
          resolvedWalletId = currencyWallet.id
        }
      }
      const matchedWallet = wallets.find((w) => String(w.id) === String(resolvedWalletId))
      const txCurrency = detectedCurrency || matchedWallet?.currency || defaultCurrency

      const isIncome =
        /\b(gaji|salary|sangu|uang\s+saku|uang\s+jajan|kiriman|bonus|thr|hadiah|kado|cashback|komisi|penjualan|freelance|proyek|adsense|dividen|untung|cuan)\b/i.test(
          cleanSubject.toLowerCase()
        ) ||
        /\b(dapet|dapat|terima|diterima|masuk|pemasukan)\b/i.test(normalized.toLowerCase())
      const txType = isIncome ? 'income' : 'expense'

      return {
        type: 'transactions',
        action: 'create',
        transactions: [
          {
            type: txType,
            amount: mathAmt,
            category: sanitizeCategoryPath(cleanSubject, txType),
            currency: txCurrency,
            walletId: resolvedWalletId,
            date: resolvedDate,
            time: resolvedTime,
            merchant: cleanMerchant,
            notes: cleanSubject,
          },
        ],
        merchant: cleanMerchant,
        currency: txCurrency,
        text: `Berhasil mencatat ${txType === 'income' ? 'pemasukan' : 'pengeluaran'} ${cleanSubject} sebesar ${formatCurrency(mathAmt, txCurrency)}.`,
        chips: ['Catat transaksi lain', 'Lihat riwayat', 'Analisis keuangan'],
        isInstant: true,
      }
    }
  }

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
        // Extract clean subject entity and venue using semantic slot filler
        const venueSlot = extractVenueSlot(`${rawItem} ${rawTail} ${normalized}`, KNOWN_MERCHANT_SERVICES)
        const cleanSub = extractCleanSubjectEntity(rawItem, {
          txType: 'expense',
          dateMatchedText: dateResult?.matchedText,
          timeMatchedText: timeSlot?.matchedText,
          merchant: venueSlot?.venue,
        })
        const cleanSubject = typeof cleanSub === 'string' && cleanSub !== 'Pengeluaran'
          ? cleanSub
          : (rawItem.charAt(0).toUpperCase() + rawItem.slice(1))

        const isIncome =
          /\b(gaji|salary|sangu|uang\s+saku|uang\s+jajan|kiriman|bonus|thr|hadiah|kado|cashback|komisi|penjualan|freelance|proyek|adsense|dividen|untung|cuan)\b/i.test(
            cleanSubject.toLowerCase()
          ) ||
          /\b(dapet|dapat|terima|diterima|masuk|pemasukan)\b/i.test(normalized.toLowerCase())
        const txType = isIncome ? 'income' : 'expense'

        const { merchant: legacyMerchant, category: legacyCategory } = extractMerchantAndCategory(rawTail ? `${rawItem} ${rawTail}` : rawItem)
        const finalMerchant = venueSlot?.venue || (txType === 'expense' ? legacyMerchant : undefined)

        const searchTarget = rawTail ? `${rawTail} ${rawItem} ${normalized}` : `${rawItem} ${normalized}`
        const detectedCurrency = extractCurrencyFromText(`${rawItem} ${rawAmt} ${rawTail} ${normalized}`, defaultCurrency)
        let resolvedWalletId = findWalletInText(searchTarget, wallets, defaultWalletId)
        if (detectedCurrency && detectedCurrency !== defaultCurrency) {
          const currencyWallet = wallets.find((w) => (w.currency || '').toUpperCase() === detectedCurrency.toUpperCase())
          if (currencyWallet) {
            resolvedWalletId = currencyWallet.id
          }
        }

        const matchedWallet = wallets.find((w) => String(w.id) === String(resolvedWalletId))
        const txCurrency = detectedCurrency || matchedWallet?.currency || defaultCurrency

        let finalNotes = cleanSubject
        if (rawTail && !venueSlot && !legacyMerchant) {
          finalNotes += rawTail.startsWith('(') ? ` ${rawTail}` : ` (${rawTail})`
        }

        return {
          type: 'transactions',
          action: 'create',
          transactions: [
            {
              type: txType,
              amount: numericAmt,
              category: legacyCategory || sanitizeCategoryPath(cleanSubject, txType),
              currency: txCurrency,
              walletId: resolvedWalletId,
              date: resolvedDate,
              time: resolvedTime,
              merchant: finalMerchant,
              notes: finalNotes,
            },
          ],
          merchant: finalMerchant,
          currency: txCurrency,
          text: `Berhasil mencatat ${txType === 'income' ? 'pemasukan' : 'pengeluaran'} ${finalNotes} sebesar ${formatCurrency(numericAmt, txCurrency)}.`,
          chips: ['Catat transaksi lain', 'Lihat riwayat', 'Analisis keuangan'],
          isInstant: true,
        }
      }
    }
  }

  // 4B. Semantic slot extraction fallback when regex boundary doesn't match clean word order
  const fallbackAmt = extractMonetaryAmountFromText(clean)
  if (fallbackAmt > 0) {
    const cleanSub = extractCleanSubjectEntity(clean, {
      txType: 'expense',
      dateMatchedText: dateResult?.matchedText,
      timeMatchedText: timeSlot?.matchedText,
    })
    const cleanSubject = typeof cleanSub === 'string' && cleanSub !== 'Pengeluaran' ? cleanSub : ''
    if (
      cleanSubject &&
      cleanSubject.length >= 2 &&
      !MONTH_NAME_REGEX.test(cleanSubject.toLowerCase()) &&
      !/\b(habisin|keluarin)\b/i.test(cleanSubject)
    ) {
      const venueSlot = extractVenueSlot(normalized, KNOWN_MERCHANT_SERVICES)
      const isIncome =
        /\b(gaji|salary|sangu|uang\s+saku|uang\s+jajan|kiriman|bonus|thr|hadiah|kado|cashback|komisi|penjualan|freelance|proyek|adsense|dividen|untung|cuan)\b/i.test(
          cleanSubject.toLowerCase()
        ) ||
        /\b(dapet|dapat|terima|diterima|masuk|pemasukan)\b/i.test(normalized.toLowerCase())
      const txType = isIncome ? 'income' : 'expense'
      const cleanMerchant = venueSlot?.venue || undefined

      const detectedCurrency = extractCurrencyFromText(normalized, defaultCurrency)
      let resolvedWalletId = findWalletInText(normalized, wallets, defaultWalletId)
      if (detectedCurrency && detectedCurrency !== defaultCurrency) {
        const currencyWallet = wallets.find((w) => (w.currency || '').toUpperCase() === detectedCurrency.toUpperCase())
        if (currencyWallet) {
          resolvedWalletId = currencyWallet.id
        }
      }

      const matchedWallet = wallets.find((w) => String(w.id) === String(resolvedWalletId))
      const txCurrency = detectedCurrency || matchedWallet?.currency || defaultCurrency

      return {
        type: 'transactions',
        action: 'create',
        transactions: [
          {
            type: txType,
            amount: fallbackAmt,
            category: sanitizeCategoryPath(cleanSubject, txType),
            currency: txCurrency,
            walletId: resolvedWalletId,
            date: resolvedDate,
            time: resolvedTime,
            merchant: cleanMerchant,
            notes: cleanSubject,
          },
        ],
        merchant: cleanMerchant,
        currency: txCurrency,
        text: `Berhasil mencatat ${txType === 'income' ? 'pemasukan' : 'pengeluaran'} ${cleanSubject} sebesar ${formatCurrency(fallbackAmt, txCurrency)}.`,
        chips: ['Catat transaksi lain', 'Lihat riwayat', 'Analisis keuangan'],
        isInstant: true,
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
        const resolvedWalletId = findWalletInText(normalized, wallets, defaultWalletId)
        const matchedWallet = wallets.find((w) => String(w.id) === String(resolvedWalletId))
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
              walletId: resolvedWalletId,
              date: resolvedDate,
              time: resolvedTime,
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
      /\b(habisin|habiskan|keluarin|ngeluarin|buat\s+beli|beli|bayar|makan|sarapan|jajan|ngopi|bensin|buat\s+maxim|buat\s+gofood|buat\s+grab)\b/i.test(
        lower
      )
    const hasExplicitIncomeAction =
      /\b(gaji|terima\s+uang|dapat\s+kiriman|uang\s+saku|dapet\s+kiriman|dapat\s+transferan|dapet\s+transferan|terima\s+transferan|terima\s+gaji|dapat\s+uang|dapet\s+uang)\b/i.test(
        lower
      )
    const totalAmt = extractMonetaryAmountFromText(lower)
    if ((hasExplicitSpendingAction || hasExplicitIncomeAction) && totalAmt <= 0) {
      const omission = predictOmissionSuggestion(normalized, wallets, defaultCurrency, 'id')
      const cleanSub = extractCleanSubjectEntity(normalized, {
        txType: hasExplicitIncomeAction ? 'income' : 'expense',
      })
      const cleanName = typeof cleanSub === 'string' && cleanSub !== 'Pengeluaran' && cleanSub !== 'Pemasukan' ? cleanSub : ''

      if (omission && omission.found && omission.message) {
        return {
          error: true,
          type: 'omission_clarification',
          pendingFrame: {
            notes: omission.entity?.name || cleanName,
            category: omission.suggestedCategory || (hasExplicitIncomeAction ? 'pendapatan/gaji' : 'makanan/makan_siang'),
            walletId: omission.suggestedWalletId || defaultWalletId,
            type: hasExplicitIncomeAction ? 'income' : 'expense',
            date: resolvedDate,
            time: resolvedTime,
          },
          suggestedAmount: omission.suggestedAmount || null,
          message: `Nominal transaksi belum disebutkan untuk ${omission.entity?.name || 'transaksi ini'}. ${omission.message}`,
          chips: omission.chips,
        }
      }
      return {
        error: true,
        type: 'omission_clarification',
        pendingFrame: cleanName ? {
          notes: cleanName,
          category: hasExplicitIncomeAction ? 'pendapatan/gaji' : 'makanan/makan_siang',
          walletId: defaultWalletId,
          type: hasExplicitIncomeAction ? 'income' : 'expense',
          date: resolvedDate,
          time: resolvedTime,
        } : null,
        message: cleanName
          ? `Nominal transaksi belum disebutkan untuk ${cleanName}. Silakan sertakan jumlah uangnya (contoh: "${cleanName} 20rb").`
          : 'Nominal transaksi belum disebutkan. Silakan sertakan jumlah uangnya (contoh: "makan siang 30rb" atau "terima gaji 5jt").',
        chips: cleanName ? ['10k', '20k', '50k', '100k'] : ['Catat 20rb', 'Catat 50rb', 'Batal'],
      }
    }
  }

  return null
}
