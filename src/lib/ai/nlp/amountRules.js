import { evaluateExpression } from '../../calcParser'
import { MONTH_NAME_REGEX } from './lexicon'
import { maskDateExpressions } from './tokenizer'

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
