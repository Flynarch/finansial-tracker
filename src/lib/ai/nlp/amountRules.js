import { evaluateExpression } from '../../calcParser'
import { MONTH_NAME_REGEX } from './lexicon'
import { maskDateExpressions } from './tokenizer'
import {
  parseSpelledOutIndonesianNumber,
  extractSpelledOutAmountFromText,
} from './spelledOutNumbers'

/**
 * Parses numeric monetary amounts from Indonesian slang or formatted strings
 * e.g. "10k" -> 10000, "1.5jt" -> 1500000, "ceban" -> 10000
 * @param {string} raw
 * @returns {number}
 */
export function parseIndonesianAmount(raw) {
  if (!raw || typeof raw !== 'string') return 0
  const clean = raw
    .trim()
    .toLowerCase()
    .replace(/^\s*(?:rp\.?|idr)\s*/i, '')
    .replace(/\s*(?:rupiah|idr|rp\.?)\s*$/i, '')

  // Indonesian slang nominals
  if (clean === 'seceng') return 1000
  if (clean === 'seceng go' || clean === 'secenggo') return 1500
  if (clean === 'noceng') return 2000
  if (clean === 'goceng') return 5000
  if (clean === 'ceban') return 10000
  if (clean === 'cenggo') return 15000
  if (clean === 'nocenggo') return 25000
  if (clean === 'gocap' || clean === 'goban') return 50000
  if (clean === 'cepek') return 100000
  if (clean === 'pekgo') return 150000
  if (clean === 'gopit' || clean === 'gotia') return 500000
  if (clean === 'sejeti') return 1000000

  // Suffix checks (thousands: k, rb, ribu, rebu, rebo, rbu)
  if (clean.endsWith('k') || clean.endsWith('rb') || clean.endsWith('ribu') || clean.endsWith('rebu') || clean.endsWith('rebo') || clean.endsWith('rbu')) {
    const numPart = parseFloat(clean.replace(/(k|rb|ribu|rebu|rebo|rbu)/g, '').replace(',', '.'))
    if (!isNaN(numPart)) return Math.round(numPart * 1000)
  }
  // Billions (miliar, milyar, b)
  if (clean.endsWith('miliar') || clean.endsWith('milyar') || clean.endsWith('b')) {
    const numPart = parseFloat(clean.replace(/(miliar|milyar|b)/g, '').replace(',', '.'))
    if (!isNaN(numPart)) return Math.round(numPart * 1000000000)
  }
  // Millions (jt, juta, jeti, m)
  if (clean.endsWith('jt') || clean.endsWith('juta') || clean.endsWith('jeti') || clean.endsWith('m')) {
    const numPart = parseFloat(clean.replace(/(jt|juta|jeti|m)/g, '').replace(',', '.'))
    if (!isNaN(numPart)) return Math.round(numPart * 1000000)
  }

  // Preceding Rp or bare digits
  const trimmed = clean.replace(/[^\d]+$/, '')

  // 1. Thousand-grouped integer (e.g. "50,000", "150,000", "1.500.000", "2,500,000")
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(trimmed)) {
    return parseInt(trimmed.replace(/[.,]/g, ''), 10) || 0
  }

  // 2. Thousand-grouped with trailing 1-2 digit cents (e.g. "50.000,00", "50,000.50")
  const groupedCentsMatch = trimmed.match(/^(\d{1,3}(?:[.,]\d{3})+)[,.]([\d]{1,2})$/)
  if (groupedCentsMatch) {
    const whole = parseInt(groupedCentsMatch[1].replace(/[.,]/g, ''), 10) || 0
    const cents = Number(`0.${groupedCentsMatch[2]}`)
    return Math.round(whole + (Number.isFinite(cents) ? cents : 0))
  }

  // 3. Simple decimal (e.g. "12,50", "15.5", "50,00")
  const simpleDecimalMatch = trimmed.match(/^(\d+)[,.]([\d]{1,2})$/)
  if (simpleDecimalMatch) {
    const whole = parseInt(simpleDecimalMatch[1], 10) || 0
    const cents = Number(`0.${simpleDecimalMatch[2]}`)
    return Math.round(whole + (Number.isFinite(cents) ? cents : 0))
  }

  const digitsOnly = clean.replace(/[^0-9]/g, '')
  const parsedDigits = parseInt(digitsOnly, 10) || 0
  if (parsedDigits > 0) return parsedDigits

  // Spelled-out words fallback (e.g. "dua puluh lima ribu", "setengah juta")
  return parseSpelledOutIndonesianNumber(clean)
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
 * Applies financial modifiers (discounts, cashback, surcharges/ongkir, tax/PPN) to a base monetary amount.
 * @param {number} baseAmt
 * @param {string} text
 * @returns {number}
 */
export function applyFinancialModifiers(baseAmt, text) {
  if (baseAmt <= 0 || !text || typeof text !== 'string') return baseAmt
  const lower = text.toLowerCase()
  if (!/\b(diskon|disc|potongan|ppn|pajak|tax|ongkir|ongkos\s+kirim|biaya\s+kirim|service|layanan|biaya\s+layanan|pb1|cashback|promo)\b/i.test(lower)) {
    return baseAmt
  }

  let amt = baseAmt

  // 1. Percentage discount: e.g. "diskon 20%", "disc 10%", "potongan 50%"
  const discPctMatch = lower.match(/\b(?:diskon|disc|potongan|promo)\s*(\d+(?:[.,]\d+)?)\s*%/i)
  if (discPctMatch) {
    const pct = parseFloat(discPctMatch[1].replace(',', '.'))
    if (pct > 0 && pct <= 100) {
      amt = Math.round(amt * (1 - pct / 100))
    }
  } else {
    // 2. Fixed amount discount / promo: e.g. "diskon 10k", "potongan 15rb", "dapet promo 10k"
    const discNomMatch = lower.match(
      /\b(?:(?:dapet\s+)?(?:diskon|disc|potongan|promo))\s*(?:sebesar\s*)?(?:rp\.?\s*)?(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|rebu|rebo|rbu|jt|juta)?)\b/i
    )
    if (discNomMatch && discNomMatch[1]) {
      const discAmt = parseIndonesianAmount(discNomMatch[1])
      if (discAmt > 0 && discAmt < amt) {
        amt = amt - discAmt
      }
    }
  }

  // 2.5. Cashback net deduction: e.g. "dapet cashback 20rb", "cashback 20k"
  const cashbackMatch = lower.match(
    /\b(?:(?:dapet\s+)?cashback)\s*(?:sebesar\s*)?(?:rp\.?\s*)?(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|rebu|rebo|rbu|jt|juta)?)\b/i
  )
  if (cashbackMatch && cashbackMatch[1]) {
    const cbAmt = parseIndonesianAmount(cashbackMatch[1])
    if (cbAmt > 0 && cbAmt < amt) {
      amt = amt - cbAmt
    }
  }

  // 3. Tax / PPN percentage: e.g. "ppn 11%", "pajak 10%", "plus pajak 10%", "pb1 10%"
  const taxPctMatch = lower.match(/\b(?:(?:plus\s+)?pajak|ppn|tax|pb1)\s*(\d+(?:[.,]\d+)?)\s*%/i)
  if (taxPctMatch) {
    const taxPct = parseFloat(taxPctMatch[1].replace(',', '.'))
    if (taxPct > 0 && taxPct <= 100) {
      amt = Math.round(amt * (1 + taxPct / 100))
    }
  }

  // 4. Fixed Surcharges / Ongkir / Delivery / Service: e.g. "plus ongkir 15rb", "ongkir 10k", "biaya kirim 15k", "service 10k"
  const surchargeNomMatch = lower.match(
    /\b(?:(?:plus\s+|tambah\s+|\+\s*)?(?:ongkir|ongkos\s+kirim|biaya\s+kirim|service|layanan|biaya\s+layanan))\s*(?:sebesar\s*)?(?:rp\.?\s*)?(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|rebu|rebo|rbu|jt|juta)?)\b/i
  )
  if (surchargeNomMatch && surchargeNomMatch[1]) {
    const surchargeAmt = parseIndonesianAmount(surchargeNomMatch[1])
    if (surchargeAmt > 0) {
      amt = amt + surchargeAmt
    }
  }

  return amt
}

function extractRawAmount(lower) {
  // 0. Arithmetic expressions: e.g. "35k + 5k", "120k / 4", "50k - 10k", "18k + 7k + 5k", "25rb * 2", "150k / 3"
  const arithmeticMatch = lower.match(
    /(?:(?:^|\s)(?:rp\.?\s*)?)(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|miliar|milyar|b)?(?:\s*[+\-*/×÷]\s*(?:rp\.?\s*)?\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|miliar|milyar|b)?)+)/i
  )
  if (arithmeticMatch && arithmeticMatch[1]) {
    const cleanExpr = arithmeticMatch[1].replace(/rp\.?\s*/gi, '')
    const evalRes = evaluateExpression(cleanExpr, 'IDR')
    if (evalRes && evalRes.isValid && evalRes.result > 0) {
      return evalRes.result
    }
  }

  // 0.5. Multiplier expressions: e.g. "2 @ 25k", "3x 20rb", "2 cup per 15k", "2 porsi @ 30k", "2 porsi nasi goreng @ 20k"
  const multiplierMatch = lower.match(
    /\b(\d+)\s*(?:cup|porsi|pax|lusin|pcs|pc|gelas|piring|butir|bungkus)?(?:\s+[a-zA-Z\-_]+){0,3}\s*(?:@|per|satuan|x|masing-masing)\s*(?:rp\.?\s*|\$\s*|€\s*)?(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|rebu|rebo|rbu|jt|juta|jeti|m|miliar|milyar|b)?)\b/i
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
  const slangMatch = lower.match(/\b(ceban|goceng|gocap|goban|seceng|noceng|cenggo|nocenggo|cepek|pekgo|gopit|gotia|sejeti)\b/i)
  if (slangMatch && slangMatch[1]) {
    const slangVal = parseIndonesianAmount(slangMatch[1])
    if (slangVal > 0) return slangVal
  }

  // 2. Spending/Receiving-verb bound amounts (e.g. "habisin 10k", "sebesar 25rb", "bayar 15k", "dapet 60k", "uang saku 60k")
  const verbMatch = lower.match(
    /(?:habisin|keluarin|keluar|sebesar|bayar|beli|total|dapet|dapat|terima|masuk|saku|jajan|gaji|sangu)\s*(?:rp\.?\s*)?(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|rebu|rebo|rbu|jt|juta|jeti|m|miliar|milyar|b|perak)?)\b/i
  )
  if (verbMatch && verbMatch[1]) {
    const val = parseIndonesianAmount(verbMatch[1])
    if (val > 0) return val
  }

  // 3. Amount with explicit currency suffix or prefix (e.g. "10k", "rp 50000", "25rb", "1.5jt", "60k", "50 rebu")
  const suffixMatch = lower.match(/\b(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|rebu|rebo|rbu|jt|juta|jeti|m|miliar|milyar|b|perak))\b/i)
  if (suffixMatch && suffixMatch[1]) {
    const val = parseIndonesianAmount(suffixMatch[1])
    if (val > 0) return val
  }

  const prefixMatch = lower.match(/(?:rp\.?\s*)(\d+(?:[.,]\d+)?)\b/i)
  if (prefixMatch && prefixMatch[1]) {
    const val = parseIndonesianAmount(prefixMatch[1])
    if (val > 0) return val
  }

  // 3.5 Spelled-out Indonesian amounts and fractions (e.g. "dua puluh lima ribu", "satu setengah juta", "lima puluh rebu")
  const spelledMatch = extractSpelledOutAmountFromText(lower)
  if (spelledMatch && spelledMatch.amount > 0) {
    return spelledMatch.amount
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
 * Extracts clean monetary amount from a sentence, guarding against date numbers (e.g. "2 hari lalu", "9 september", "12 sep")
 * and automatically applies financial modifiers like discounts and tax/PPN.
 * @param {string} text
 * @returns {number}
 */
export function extractMonetaryAmountFromText(text) {
  if (!text || typeof text !== 'string') return 0
  const masked = maskDateExpressions(text)
  const lower = masked.toLowerCase()
  const rawAmt = extractRawAmount(lower)
  return applyFinancialModifiers(rawAmt, lower)
}
