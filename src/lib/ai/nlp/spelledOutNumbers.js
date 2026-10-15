/**
 * Indonesian Spelled-out Numbers, Fractions, and Slang Suffix Parser
 * Converts verbal numbers like "dua puluh lima ribu", "setengah juta", "50 rebu" to numbers.
 */

const UNIT_MAP = {
  nol: 0,
  kosong: 0,
  satu: 1,
  se: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
}

const SPELLED_OUT_KEYWORDS = new Set([
  'nol', 'kosong', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
  'sepuluh', 'sebelas', 'belas', 'puluh', 'ratus', 'seratus',
  'ribu', 'seribu', 'rebu', 'rebo', 'rbu',
  'juta', 'sejuta', 'jeti',
  'miliar', 'milyar', 'semiliar', 'semilyar',
  'setengah', 'seperempat', 'perempat',
  'koma',
])

/**
 * Parses pure spelled-out words into a single integer number.
 * Supports:
 * - Basic: "satu", "sepuluh", "dua belas", "tujuh puluh lima", "tiga ratus"
 * - Thousands: "seribu", "dua puluh lima ribu", "seratus lima puluh ribu"
 * - Millions & Billions: "sejuta", "dua juta lima ratus ribu", "satu miliar"
 * - Fractions: "setengah juta" (500k), "seperempat juta" (250k), "satu setengah juta" (1.5m)
 * - Verbal Decimals: "dua koma lima juta" (2.5m), "satu koma dua juta" (1.2m)
 * - Regional slang: "50 rebu", "25 rebo", "dua jeti"
 *
 * @param {string} raw - Spelled-out text string
 * @returns {number}
 */
export function parseSpelledOutIndonesianNumber(raw) {
  if (!raw || typeof raw !== 'string') return 0
  const normalized = raw.trim().toLowerCase().replace(/[_-]/g, ' ')
  if (!normalized) return 0

  // Verbal decimals: "[N] koma [M] juta/miliar/ribu" (e.g. "dua koma lima juta" -> 2500000, "1 koma 5 juta" -> 1500000)
  const verbalDecimalMatch = normalized.match(/^([a-z\d]+)\s+koma\s+([a-z\d]+)\s*(juta|jeti|miliar|milyar|ribu|rebu|rebo)?$/)
  if (verbalDecimalMatch) {
    const wholeStr = verbalDecimalMatch[1]
    const fracStr = verbalDecimalMatch[2]
    const unitStr = verbalDecimalMatch[3] || 'juta'

    const wholeNum = UNIT_MAP[wholeStr] !== undefined ? UNIT_MAP[wholeStr] : (parseInt(wholeStr, 10) || 0)
    const fracNum = UNIT_MAP[fracStr] !== undefined ? UNIT_MAP[fracStr] : (parseInt(fracStr, 10) || 0)
    const floatVal = parseFloat(`${wholeNum}.${fracNum}`)

    if (!isNaN(floatVal)) {
      const multiplier =
        unitStr === 'ribu' || unitStr === 'rebu' || unitStr === 'rebo'
          ? 1000
          : unitStr === 'miliar' || unitStr === 'milyar'
          ? 1000000000
          : 1000000
      return Math.round(floatVal * multiplier)
    }
  }

  // 1. Fractions Handling
  if (normalized === 'setengah juta' || normalized === '1/2 juta') return 500000
  if (normalized === 'seperempat juta' || normalized === '1/4 juta') return 250000
  if (normalized === 'tiga perempat juta' || normalized === '3/4 juta') return 750000
  if (normalized === 'satu setengah juta' || normalized === '1.5 juta' || normalized === '1,5 juta') return 1500000
  if (normalized === 'dua setengah juta' || normalized === '2.5 juta' || normalized === '2,5 juta') return 2500000
  if (normalized === 'tiga setengah juta' || normalized === '3.5 juta' || normalized === '3,5 juta') return 3500000
  if (normalized === 'setengah miliar' || normalized === 'setengah milyar') return 500000000
  if (normalized === 'setengah ribu' || normalized === 'setengah rebu' || normalized === 'setengah rebo') return 500

  // Compound fractions: "[N] setengah juta" (e.g. "empat setengah juta" -> 4500000)
  const compoundHalfMillionMatch = normalized.match(/^([a-z]+)\s+setengah\s+(?:juta|jeti)$/)
  if (compoundHalfMillionMatch && UNIT_MAP[compoundHalfMillionMatch[1]] !== undefined) {
    return Math.round((UNIT_MAP[compoundHalfMillionMatch[1]] + 0.5) * 1000000)
  }

  // 2. Standalone exact special words
  if (normalized === 'sepuluh') return 10
  if (normalized === 'sebelas') return 11
  if (normalized === 'seratus') return 100
  if (normalized === 'seribu') return 1000
  if (normalized === 'sejuta' || normalized === 'sejeti') return 1000000
  if (normalized === 'semiliar' || normalized === 'semilyar') return 1000000000

  const tokens = normalized.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0

  // Verify that tokens look like number words
  const isAllNumberWords = tokens.every((t) => SPELLED_OUT_KEYWORDS.has(t) || /^\d+$/.test(t))
  if (!isAllNumberWords) return 0

  let total = 0
  let groupTotal = 0
  let unitVal = 0

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (/^\d+$/.test(token)) {
      unitVal += parseInt(token, 10)
    } else if (token === 'sepuluh') {
      groupTotal += 10
      unitVal = 0
    } else if (token === 'sebelas') {
      groupTotal += 11
      unitVal = 0
    } else if (token === 'seratus') {
      groupTotal += 100
      unitVal = 0
    } else if (token === 'seribu') {
      groupTotal += unitVal
      total += (groupTotal > 0 ? groupTotal : 1) * 1000
      groupTotal = 0
      unitVal = 0
    } else if (token === 'sejuta' || token === 'sejeti') {
      groupTotal += unitVal
      total += (groupTotal > 0 ? groupTotal : 1) * 1000000
      groupTotal = 0
      unitVal = 0
    } else if (token === 'semiliar' || token === 'semilyar') {
      groupTotal += unitVal
      total += (groupTotal > 0 ? groupTotal : 1) * 1000000000
      groupTotal = 0
      unitVal = 0
    } else if (token === 'belas') {
      groupTotal += (unitVal > 0 ? unitVal : 1) + 10
      unitVal = 0
    } else if (token === 'puluh') {
      groupTotal += (unitVal > 0 ? unitVal : 1) * 10
      unitVal = 0
    } else if (token === 'ratus') {
      groupTotal += (unitVal > 0 ? unitVal : 1) * 100
      unitVal = 0
    } else if (token === 'ribu' || token === 'rebu' || token === 'rebo' || token === 'rbu') {
      groupTotal += unitVal
      total += (groupTotal > 0 ? groupTotal : 1) * 1000
      groupTotal = 0
      unitVal = 0
    } else if (token === 'juta' || token === 'jeti') {
      groupTotal += unitVal
      total += (groupTotal > 0 ? groupTotal : 1) * 1000000
      groupTotal = 0
      unitVal = 0
    } else if (token === 'miliar' || token === 'milyar') {
      groupTotal += unitVal
      total += (groupTotal > 0 ? groupTotal : 1) * 1000000000
      groupTotal = 0
      unitVal = 0
    } else if (UNIT_MAP[token] !== undefined) {
      unitVal += UNIT_MAP[token]
    }
  }

  groupTotal += unitVal
  total += groupTotal
  return total
}

/**
 * Searches for and extracts a spelled-out nominal or fraction inside an arbitrary Indonesian sentence.
 *
 * @param {string} text
 * @returns {{ amount: number, matchedText: string } | null}
 */
export function extractSpelledOutAmountFromText(text) {
  if (!text || typeof text !== 'string') return null
  const lower = text.toLowerCase()

  // 1. Check for fraction expressions first (e.g. "satu setengah juta", "setengah juta", "seperempat juta")
  const fractionMatch = lower.match(
    /\b((?:(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|\d+)\s+)?(?:setengah|seperempat|tiga\s+perempat)\s+(?:juta|jeti|miliar|milyar|ribu|rebu|rebo))\b/i
  )
  if (fractionMatch && fractionMatch[1]) {
    const val = parseSpelledOutIndonesianNumber(fractionMatch[1])
    if (val > 0) {
      return {
        amount: val,
        matchedText: fractionMatch[1].trim(),
      }
    }
  }

  // 2. Check for spelled-out numbers ending in ribu/rebu/rebo/juta/jeti/miliar
  // e.g. "dua puluh lima ribu", "lima puluh rebu", "dua juta lima ratus ribu"
  const spelledRegex =
    /\b((?:(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|seratus|seribu|sejuta|\d+)(?:\s+(?:belas|puluh|ratus|ribu|rebu|rebo|rbu|juta|jeti|miliar|milyar|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan))+))\b/i

  const match = lower.match(spelledRegex)
  if (match && match[1]) {
    const candidate = match[1].trim()
    const val = parseSpelledOutIndonesianNumber(candidate)
    if (val > 0) {
      return {
        amount: val,
        matchedText: candidate,
      }
    }
  }

  return null
}
