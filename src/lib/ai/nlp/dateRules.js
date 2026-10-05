import { format, subDays, addDays } from 'date-fns'
import {
  DAY_DEFINITIONS,
  MONTH_DEFINITIONS,
} from './lexicon'

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
export function getRecentPastDayDate(targetDayIndex, refDate = new Date(), options = false) {
  const currentDayIndex = refDate.getDay()
  let diff = (currentDayIndex - targetDayIndex + 7) % 7

  const forcePastWeek = typeof options === 'boolean' ? options : Boolean(options?.forcePastWeek)
  const isExplicitPastWeek = typeof options === 'object' ? Boolean(options?.isExplicitPastWeek) : false

  if (isExplicitPastWeek) {
    diff = diff === 0 ? 7 : diff + 7
  } else if (forcePastWeek && diff === 0) {
    diff = 7
  }

  const targetDate = subDays(refDate, diff)
  return format(targetDate, 'yyyy-MM-dd')
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
    if (monthDef) {
      const maxDays = new Date(year, monthDef.month, 0).getDate()
      if (day >= 1 && day <= maxDays) {
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
      if (month >= 1 && month <= 12) {
        const maxDays = new Date(year, month, 0).getDate()
        if (day >= 1 && day <= maxDays) {
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
  }

  // 2.5. Standalone Day of Current Month: "tanggal 25", "tgl 1"
  const standaloneDayMatch = lower.match(/\b(?:tanggal|tgl)\s+(\d{1,2})\b/i)
  if (standaloneDayMatch) {
    const day = parseInt(standaloneDayMatch[1], 10)
    const month = ref.getMonth() + 1
    const year = refYear
    const maxDays = new Date(year, month, 0).getDate()
    if (day >= 1 && day <= maxDays) {
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
      const hasPastWeekQualifier =
        new RegExp(`${def.canonical}\\s+(?:lalu|minggu\\s+lalu)|(?:minggu\\s+lalu)\\s+(?:hari\\s+)?${def.canonical}`, 'i').test(lower)
      const hasKemarinQualifier =
        new RegExp(`${def.canonical}\\s+kemarin|kemarin\\s+(?:hari\\s+)?${def.canonical}`, 'i').test(lower)

      const dateStr = getRecentPastDayDate(def.dayIndex, ref, {
        forcePastWeek: hasKemarinQualifier || hasPastWeekQualifier,
        isExplicitPastWeek: hasPastWeekQualifier,
      })
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

  // 5.5. Relative Future: besok lusa, lusa, 2 hari lagi
  if (/\b(besok\s+lusa|\blusa\b|2\s+hari\s+lagi)\b/i.test(lower)) {
    const match = lower.match(/\b(besok\s+lusa|\blusa\b|2\s+hari\s+lagi)\b/i)
    return {
      dateStr: format(addDays(ref, 2), 'yyyy-MM-dd'),
      matchedText: match ? match[0] : 'lusa',
    }
  }

  // 5.6. Standalone besok, bsk, besok pagi/siang/sore/malam
  if (/\b(besok|bsk)\b/i.test(lower)) {
    const match = lower.match(/\b(besok|bsk)(?:\s+(?:pagi|siang|sore|malam))?\b/i)
    return {
      dateStr: format(addDays(ref, 1), 'yyyy-MM-dd'),
      matchedText: match ? match[0] : 'besok',
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
