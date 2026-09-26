/**
 * Semantic Slot Filler & Fuzzy Token Matcher
 *
 * Decomposes natural language financial text into semantic roles:
 * - Temporal Slot (date & clock time)
 * - Monetary Slot (amount & currency)
 * - Account Slot (wallet & payment method)
 * - Venue Slot (store, outlet, or merchant)
 * - Action Slot (intent & transaction type)
 * - Subject Entity Slot (clean, normalized Title-Case notes)
 */

/**
 * Calculates Levenshtein Distance between two strings.
 * Used for dynamic, non-hardcoded typo tolerance.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshteinDistance(a, b) {
  if (!a || !b) return (a || b || '').length
  const str1 = a.toLowerCase()
  const str2 = b.toLowerCase()

  const len1 = str1.length
  const len2 = str2.length

  let prevRow = new Array(len2 + 1)
  let currRow = new Array(len2 + 1)

  for (let j = 0; j <= len2; j++) {
    prevRow[j] = j
  }

  for (let i = 1; i <= len1; i++) {
    currRow[0] = i
    const char1 = str1[i - 1]

    for (let j = 1; j <= len2; j++) {
      const char2 = str2[j - 1]
      const cost = char1 === char2 ? 0 : 1
      currRow[j] = Math.min(
        prevRow[j] + 1, // deletion
        currRow[j - 1] + 1, // insertion
        prevRow[j - 1] + cost // substitution
      )
    }

    // Swap rows
    const temp = prevRow
    prevRow = currRow
    currRow = temp
  }

  return prevRow[len2]
}

/**
 * Calculates similarity ratio between two strings (0.0 to 1.0)
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function fuzzySimilarity(a, b) {
  if (!a && !b) return 1.0
  if (!a || !b) return 0.0
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1.0
  const dist = levenshteinDistance(a, b)
  return Math.max(0, (maxLen - dist) / maxLen)
}

/**
 * Finds best match from a list of candidates using Levenshtein distance
 *
 * @param {string} token
 * @param {Array<string>} candidates
 * @param {number} [threshold=0.8]
 * @returns {{ match: string, score: number, index: number } | null}
 */
export function fuzzyFindBestMatch(token, candidates = [], threshold = 0.8) {
  if (!token || candidates.length === 0) return null
  const cleanToken = token.trim().toLowerCase()
  let best = null
  let maxScore = -1
  let bestIndex = -1

  for (let i = 0; i < candidates.length; i++) {
    const cand = String(candidates[i]).trim().toLowerCase()
    if (cand === cleanToken) {
      return { match: candidates[i], score: 1.0, index: i }
    }
    const score = fuzzySimilarity(cleanToken, cand)
    if (score > maxScore) {
      maxScore = score
      best = candidates[i]
      bestIndex = i
    }
  }

  if (maxScore >= threshold) {
    return { match: best, score: maxScore, index: bestIndex }
  }
  return null
}

/**
 * Formats 2-digit hour and minute into HH:mm
 */
function padTime(n) {
  return String(n).padStart(2, '0')
}

/**
 * Extracts clock time and colloquial temporal periods from natural language.
 *
 * Examples:
 * - "jam 5" (in afternoon context) -> 17:00
 * - "jam 5 sore" -> 17:00
 * - "jam 7 pagi" -> 07:00
 * - "jam 8 malam" -> 20:00
 * - "jam 17.30" -> 17:30
 * - "pukul 14:15" -> 14:15
 * - "jam setengah 6" -> 17:30 (or 05:30)
 * - "jam 5 kurang 15" -> 16:45
 * - "tadi sore" -> 17:00
 * - "tadi siang" -> 12:30
 * - "tadi pagi" -> 07:30
 * - "tadi malam" -> 20:00
 * - "subuh" -> 05:00
 *
 * @param {string} text
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ timeStr: string, matchedText: string } | null}
 */
export function extractTimeSlot(text, referenceDate = new Date()) {
  if (!text || typeof text !== 'string') return null
  const lower = text.toLowerCase()
  const ref = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date()
  const currentHour = ref.getHours()

  // 1. Indonesian colloquial math: "jam setengah (\d+)" (e.g. "jam setengah 6" = 05:30 / 17:30)
  const setMatch = lower.match(/(?:jam|pukul)\s+setengah\s+(\d{1,2})(?:\s*(pagi|siang|sore|malam))?/i)
  if (setMatch) {
    const rawTargetHour = parseInt(setMatch[1], 10)
    const modifier = setMatch[2] || ''
    if (rawTargetHour >= 1 && rawTargetHour <= 12) {
      // In ID language, "setengah 6" is 30 minutes before 6 = 5:30
      let baseHour = rawTargetHour - 1
      if (baseHour === 0) baseHour = 12

      let resolvedHour = baseHour
      if (modifier === 'sore' || modifier === 'malam' || (!modifier && currentHour >= 12 && baseHour <= 11)) {
        resolvedHour = baseHour < 12 ? baseHour + 12 : baseHour
      } else if (modifier === 'siang') {
        resolvedHour = baseHour < 12 ? (baseHour === 11 ? 11 : baseHour + 12) : baseHour
      }
      return {
        timeStr: `${padTime(resolvedHour)}:30`,
        matchedText: setMatch[0],
      }
    }
  }

  // 2. Indonesian colloquial math: "jam (\d+) kurang (\d+|seperempat)" (e.g. "jam 5 kurang 15" = 16:45)
  const kurangMatch = lower.match(/(?:jam|pukul)\s+(\d{1,2})\s+kurang\s+(\d+|seperempat)(?:\s*menit)?(?:\s*(pagi|siang|sore|malam))?/i)
  if (kurangMatch) {
    const rawHour = parseInt(kurangMatch[1], 10)
    const rawSub = kurangMatch[2] === 'seperempat' ? 15 : parseInt(kurangMatch[2], 10)
    const modifier = kurangMatch[3] || ''
    if (rawHour >= 1 && rawHour <= 24 && rawSub > 0 && rawSub < 60) {
      let resolvedHour = rawHour - 1
      let resolvedMinute = 60 - rawSub

      if (rawHour <= 12) {
        if (modifier === 'sore' || modifier === 'malam' || (!modifier && currentHour >= 12 && resolvedHour < 12)) {
          resolvedHour = resolvedHour < 12 ? resolvedHour + 12 : resolvedHour
        }
      }
      return {
        timeStr: `${padTime(resolvedHour)}:${padTime(resolvedMinute)}`,
        matchedText: kurangMatch[0],
      }
    }
  }

  // 3. Explicit 24-hr timestamps with clock prefix or standalone (e.g. "jam 17:30", "17.00", "pukul 08:45")
  const standardTimeMatch = lower.match(/(?:(?:jam|pukul)\s+)?\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/i)
  if (standardTimeMatch) {
    const h = parseInt(standardTimeMatch[1], 10)
    const m = parseInt(standardTimeMatch[2], 10)
    // Guard against date formats like 12.09 if not preceded by jam/pukul and followed by month
    const isClockPrefix = /(?:jam|pukul)\s+/i.test(standardTimeMatch[0])
    if (isClockPrefix || (h <= 23 && m <= 59)) {
      return {
        timeStr: `${padTime(h)}:${padTime(m)}`,
        matchedText: standardTimeMatch[0],
      }
    }
  }

  // 4. Word-prefixed hours: "jam 5", "jam 5 sore", "pukul 7 pagi", "jam 8 malam"
  const hourMatch = lower.match(/(?:jam|pukul)\s+(\d{1,2})(?:\s*(pagi|siang|sore|malam))?\b/i)
  if (hourMatch) {
    const rawHour = parseInt(hourMatch[1], 10)
    const modifier = hourMatch[2] || ''

    if (rawHour >= 0 && rawHour <= 24) {
      let resolvedHour = rawHour
      if (rawHour <= 12) {
        if (modifier === 'sore') {
          resolvedHour = rawHour < 12 ? rawHour + 12 : 12
        } else if (modifier === 'malam') {
          resolvedHour = rawHour < 12 ? rawHour + 12 : 0
        } else if (modifier === 'pagi') {
          resolvedHour = rawHour === 12 ? 0 : rawHour
        } else if (modifier === 'siang') {
          resolvedHour = rawHour < 11 ? rawHour + 12 : rawHour
        } else {
          // Unspecified modifier: disambiguate using current hour and contextual keywords
          const hasTadi = /\btadi\b/i.test(lower)
          const hasSemalam = /\b(semalam|kemarin\s+malam)\b/i.test(lower)
          if (hasSemalam) {
            resolvedHour = rawHour < 12 ? rawHour + 12 : rawHour
          } else if (hasTadi) {
            // "tadi jam 5" when now is >= 12:00 -> afternoon (17:00).
            // "tadi jam 1" when now is 15:00 -> 13:00.
            if (currentHour >= 12 && rawHour < 12) {
              resolvedHour = rawHour + 12
            }
          } else if (currentHour >= 12 && rawHour <= 6) {
            // If now is evening/afternoon and user says "jam 5", infer 17:00
            resolvedHour = rawHour + 12
          }
        }
      }
      return {
        timeStr: `${padTime(resolvedHour)}:00`,
        matchedText: hourMatch[0],
      }
    }
  }

  // 5. Colloquial daily period expressions when no specific number was spoken:
  // "tadi sore" -> 17:00, "tadi siang" -> 12:30, "tadi pagi" -> 07:30, "semalam/tadi malam" -> 20:00
  if (/\b(tadi\s+sore|sore\s+hari|pas\s+sore)\b/i.test(lower)) {
    return { timeStr: '17:00', matchedText: 'tadi sore' }
  }
  if (/\b(tadi\s+siang|siang\s+hari|pas\s+siang)\b/i.test(lower)) {
    return { timeStr: '12:30', matchedText: 'tadi siang' }
  }
  if (/\b(tadi\s+pagi|pagi\s+hari|pas\s+pagi)\b/i.test(lower)) {
    return { timeStr: '07:30', matchedText: 'tadi pagi' }
  }
  if (/\b(tadi\s+malam|semalam|malam\s+hari|pas\s+malam)\b/i.test(lower)) {
    return { timeStr: '20:00', matchedText: 'tadi malam' }
  }
  if (/\b(subuh)\b/i.test(lower)) {
    return { timeStr: '05:00', matchedText: 'subuh' }
  }

  return null
}

/**
 * Extracts venue/merchant slot from text.
 * Detects patterns like:
 * - "di starbucks" -> { merchant: "Starbucks", matchedText: "di starbucks" }
 * - "di kulo" -> { merchant: "Kulo", matchedText: "di kulo" }
 * - "outlet indomaret" -> { merchant: "Indomaret", matchedText: "outlet indomaret" }
 *
 * @param {string} text
 * @param {Array<{ regex: RegExp, name: string }>} [knownMerchants=[]]
 * @returns {{ merchant: string, matchedText: string } | null}
 */
export function extractVenueSlot(text, knownMerchants = []) {
  if (!text || typeof text !== 'string') return null
  const lower = text.toLowerCase()

  // 1. Check known brand regexes first
  for (const km of knownMerchants) {
    if (km.regex && km.regex.test(lower)) {
      const match = lower.match(km.regex)
      return {
        venue: km.name,
        merchant: km.name,
        matchedText: match ? match[0] : km.name.toLowerCase(),
      }
    }
  }

  // 2. Prepositional venue anchor: "di [X]", "outlet [X]", "cabang [X]"
  const venueMatch = text.match(
    /\b(?:di|outlet|cabang|toko)\s+([a-zA-Z&'.-]+(?:\s+[a-zA-Z&'.-]+)?)/i
  )

  if (venueMatch && venueMatch[1]) {
    const candidateWords = venueMatch[1].trim().split(/\s+/)
    const validWords = []
    for (const w of candidateWords) {
      if (/^(beli|bayar|pesan|order|jajan|makan|minum|habisin|keluarin|buat|untuk|sebesar|seharga|rp|bca|bri|bni|mandiri|jago|dana|gopay|ovo|cash|tunai|pakai|pake|via|sama|dan|jam|pukul|tadi|kemarin|hari|\d+[a-z]*)$/i.test(w)) {
        break
      }
      if (!/^(rumah|jalan|kantor|sini|sana|luar|situ)$/i.test(w)) {
        validWords.push(w)
      }
    }
    if (validWords.length > 0) {
      const candidate = validWords.join(' ')
      const capitalized = validWords
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
      return {
        venue: capitalized,
        merchant: capitalized,
        matchedText: `di ${candidate}`,
      }
    }
  }

  return null
}

/**
 * Extracts quantity and unit specifications if present in text
 * Examples:
 * - "2 matcha" -> { qty: 2, itemClean: "matcha", matchedText: "2" }
 * - "matcha 2 cup" -> { qty: 2, unit: "cup", itemClean: "matcha", matchedText: "2 cup" }
 * - "bensin 3 liter" -> { qty: 3, unit: "liter", itemClean: "bensin", matchedText: "3 liter" }
 *
 * @param {string} text
 * @returns {{ qty: number, unit?: string, matchedText?: string } | null}
 */
export function extractQuantitySlot(text) {
  if (!text || typeof text !== 'string') return null

  // Quantity with unit: "3 liter", "2 cup", "5 pcs", "1 kg", "2 porsi", "2 botol", "2 bungkus", "2 box", etc.
  const unitMatch = text.match(/\b(\d+)\s*(liter|cup|pcs|pc|kg|gram|porsi|botol|bungkus|box|biji|butir|paket|pax|orang|lusin|lembar|dus|karton|kaleng|mangkok|piring|gelas|sachet|pack)\b/i)
  if (unitMatch) {
    const qty = parseInt(unitMatch[1], 10)
    if (qty > 0 && qty <= 100) {
      return {
        qty,
        unit: unitMatch[2].toLowerCase(),
        matchedText: unitMatch[0],
      }
    }
  }

  // Multiplier with @: "2 @ 25k", "kopi 2 @ 25k"
  const atMatch = text.match(/\b(\d+)\s*@(?:\s*|$)/i)
  if (atMatch) {
    const qty = parseInt(atMatch[1], 10)
    if (qty > 0 && qty <= 100) {
      return {
        qty,
        unit: 'x',
        matchedText: atMatch[0].trim(),
      }
    }
  }

  // Multiplier prefix: "2x matcha", "3x kopi"
  const multMatch = text.match(/\b(\d+)\s*x\b/i)
  if (multMatch) {
    const qty = parseInt(multMatch[1], 10)
    if (qty > 0 && qty <= 50) {
      return {
        qty,
        matchedText: multMatch[0],
      }
    }
  }

  return null
}

/**
 * Normalizes colloquial Indonesian slang, chat abbreviations, and common typos.
 * Uses dynamic regex and clean replacements.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeSlangText(text) {
  if (!text || typeof text !== 'string') return ''
  let t = text.trim()

  // Common food & drink abbreviations
  t = t.replace(/\bkopsu\b/gi, 'kopi susu')
  t = t.replace(/\bnasgor\b/gi, 'nasi goreng')
  t = t.replace(/\bmieay\b/gi, 'mie ayam')
  t = t.replace(/\btf\b/gi, 'transfer')

  // Day & time abbreviations
  t = t.replace(/\b(hwri|hri|hrii)\b/gi, 'hari')
  t = t.replace(/\b(jumwt|jum'at|jmt|jumatt)\b/gi, 'jumat')
  t = t.replace(/\b(sbtu|sabt|sbt)\b/gi, 'sabtu')
  t = t.replace(/\b(mnggu|mggu|ahad)\b/gi, 'minggu')
  t = t.replace(/\b(senen|senn)\b/gi, 'senin')
  t = t.replace(/\b(slasa)\b/gi, 'selasa')
  t = t.replace(/\b(rbu)\b/gi, 'rabu')
  t = t.replace(/\b(kms)\b/gi, 'kamis')
  t = t.replace(/\b(kmrn|kmarin|kemaren|kmren|kmrin)\b/gi, 'kemarin')
  t = t.replace(/\b(bapuk|tdi)\b/gi, 'tadi')

  return t
}

/**
 * Extracts clean, title-cased subject entity notes by systematically stripping
 * all other identified slots (temporal, venue, monetary, action, wallet).
 *
 * Example:
 * - "tadi jam 5 beli matcha di kulo 20k pakai gopay"
 *   -> "Matcha"
 * - "beli 2 matcha 40k"
 *   -> "Matcha (2x)"
 * - "makan siang 35rb"
 *   -> "Makan Siang"
 * - "dikasih uang saku sama mama 100k"
 *   -> "Uang Saku (Mama)"
 *
 * @param {string} rawText
 * @param {object} [options={}]
 * @param {string} [options.txType='expense']
 * @param {string} [options.merchant='']
 * @param {string} [options.timeMatchedText='']
 * @param {string} [options.dateMatchedText='']
 * @param {string} [options.walletName='']
 * @returns {string}
 */
export function extractCleanSubjectEntity(rawText, options = {}) {
  if (!rawText || typeof rawText !== 'string') {
    return options.txType === 'income' ? 'Pemasukan' : 'Pengeluaran'
  }

  let text = normalizeSlangText(rawText)

  // 1. Strip explicit time slot string if provided
  if (options.timeMatchedText) {
    text = text.replace(new RegExp(`\\b${escapeRegExp(options.timeMatchedText)}\\b`, 'gi'), ' ')
  }

  // 2. Strip explicit date slot string if provided
  if (options.dateMatchedText) {
    text = text.replace(new RegExp(`\\b${escapeRegExp(options.dateMatchedText)}\\b`, 'gi'), ' ')
  }

  // 2.5 Strip calendar dates: "9 september", "12 sep 2026", "25 agustus", "10 okt"
  text = text.replace(/(?:(?:tgl|tanggal)\s+)?\b\d{1,2}\s+(?:januari|jan|februari|feb|maret|mar|april|apr|mei|may|juni|jun|juli|jul|agustus|ags|agst|aug|september|sep|sept|oktober|okt|oct|november|nov|desember|des|dec)(?:\s+\d{4})?\b/gi, ' ')
  text = text.replace(/(?:(?:tgl|tanggal)\s+)?\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/gi, ' ')
  text = text.replace(/\b(?:tanggal|tgl)\s+\d{1,2}\b/gi, ' ')

  // 3. Strip general clock patterns: "jam \d+[:.]?\d*", "pukul \d+[:.]?\d*", "setengah \d+", etc.
  text = text.replace(/(?:(?:jam|pukul)\s+setengah\s+\d{1,2}(?:\s*(?:pagi|siang|sore|malam))?)/gi, ' ')
  text = text.replace(/(?:(?:jam|pukul)\s+\d{1,2}\s+kurang\s+(?:\d+|seperempat)(?:\s*menit)?(?:\s*(?:pagi|siang|sore|malam))?)/gi, ' ')
  text = text.replace(/(?:(?:jam|pukul)\s+)?\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/gi, ' ')
  text = text.replace(/(?:(?:jam|pukul)\s+\d{1,2}(?:\s*(?:pagi|siang|sore|malam))?)\b/gi, ' ')

  // 4. Strip relative time markers while protecting compound meals like "makan siang", "makan malam", "makan pagi"
  text = text.replace(/\b(kemarin\s+lusa|kemarin|semalam|hari\s+ini|tadi\s+malam|tadi\s+pagi|tadi\s+siang|tadi\s+sore|tadi|barusan|pas|waktu|saat|sekarang|habis|baru\s+saja)\b/gi, ' ')
  text = text.replace(/(?<!makan\s+)\b(sore|siang|pagi|malam)\b(?!\s+(?:siang|pagi|malam))/gi, ' ')

  // 5. Strip venue mentions (e.g. "di starbucks", "outlet kulo")
  if (options.merchant) {
    text = text.replace(new RegExp(`(?:di|ke|outlet|cabang|toko)?\\s*\\b${escapeRegExp(options.merchant)}\\b`, 'gi'), ' ')
  }
  text = text.replace(/\b(?:di|outlet|cabang|toko)\s+[a-zA-Z0-9&'.-]+(?:\s+[a-zA-Z0-9&'.-]+)?\b/gi, ' ')

  // 6. Extract quantity before stripping numbers
  const qtySlot = extractQuantitySlot(text)
  if (qtySlot && qtySlot.matchedText) {
    text = text.replace(new RegExp(`\\b${escapeRegExp(qtySlot.matchedText)}(?:\\b|\\s|$)`, 'gi'), ' ')
  }

  // 6.5. Strip arithmetic and multiplier expressions: "35k + 5k", "120k / 4", "2 @ 25k"
  text = text.replace(/\b\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta)?\s*([+\-*/])\s*\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta)?\b/gi, ' ')
  text = text.replace(/\b\d+\s*@\s*\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta)?\b/gi, ' ')

  // 7. Strip amounts and currency markers (20k, 50rb, 100000, rp 50000, ceban, goceng, etc.)
  text = text.replace(/\brp\.?\s*/gi, ' ')
  text = text.replace(/[$€£¥]\s*/g, ' ')
  text = text.replace(/\b(?:usd|eur|sgd|myr|gbp|jpy)\b/gi, ' ')
  text = text.replace(/\b(ceban|goceng|gocap|seceng|noceng|cenggo|nocenggo|cepek|pekgo|sejeti)\b/gi, ' ')
  text = text.replace(/\b\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|perak)\b/gi, ' ')
  text = text.replace(/\b\d{4,}(?:[.,]\d+)?\b/g, ' ')
  text = text.replace(/[@+\-*/]\s*/g, ' ')

  // 8. Strip wallet & payment method mentions
  if (options.walletName) {
    text = text.replace(new RegExp(`\\(?\\b${escapeRegExp(options.walletName)}\\b\\)?`, 'gi'), ' ')
  }
  text = text.replace(/\b(?:pakai|pake|via|lewat|dari|ke)?\s*(?:bca|bri|bni|mandiri|jago|dana|gopay|ovo|shopeepay|cash|tunai|bank|rekening|dompet|qris)\b/gi, ' ')
  text = text.replace(/\(\s*(?:dana|cash|tunai|gopay|ovo|bca|bri|bni|mandiri|jago|qris)\s*\)/gi, ' ')

  // 9. Strip action verbs while preserving compound meal words ("makan siang", "makan malam", "makan pagi")
  text = text.replace(/\b(?:beli|membeli|buat\s+beli|bayar|membayar|buat\s+bayar|jajan|pesen|pesan|order|checkout|co|habisin|habiskan|ngeluarin|keluarin|dapet|dapat|terima|diterima|masuk|kiriman|minum|dikasih|diberi|kasih|beri)\b/gi, ' ')
  text = text.replace(/\bmakan(?!\s+(?:siang|pagi|malam))\b/gi, ' ')

  // 10. Extract sender or recipient: "dikasih uang saku sama mama" -> "Uang Saku (Mama)"
  let senderSuffix = ''
  const senderMatch = text.match(/\b(?:sama|dari|oleh)\s+([a-zA-Z]+)\b/i)
  if (senderMatch && senderMatch[1]) {
    const sName = senderMatch[1].trim()
    if (!/^(gopay|ovo|dana|bca|mandiri|cash|tunai|bank|qris)$/i.test(sName)) {
      senderSuffix = ` (${sName.charAt(0).toUpperCase() + sName.slice(1).toLowerCase()})`
      text = text.replace(senderMatch[0], ' ')
    }
  }

  // 11. Strip filler prepositions, conjunctions, and connective words
  text = text.replace(/\b(?:buat|untuk|sebesar|seharga|dengan|guna|dan|plus|juga|serta|sama|pakai|pake|via|lewat)\b/gi, ' ')

  // Clean excess punctuation & spaces
  let cleaned = text
    .replace(/[,\-_:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Format to Title Case
  if (cleaned.length >= 2) {
    const words = cleaned.split(/\s+/).map((w) => {
      if (w.startsWith('(') && w.length > 1) {
        return '(' + w.charAt(1).toUpperCase() + w.slice(2).toLowerCase()
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    cleaned = words.join(' ')
  }

  // Attach quantity if present
  if (qtySlot && cleaned) {
    const qLabel = qtySlot.unit && qtySlot.unit !== 'x' ? `${qtySlot.qty} ${qtySlot.unit.charAt(0).toUpperCase() + qtySlot.unit.slice(1)}` : `${qtySlot.qty}x`
    if (!cleaned.toLowerCase().includes(qLabel.toLowerCase())) {
      cleaned = `${cleaned} (${qLabel})`
    }
  } else if (senderSuffix && cleaned && !cleaned.includes('(')) {
    cleaned = `${cleaned}${senderSuffix}`
  }

  // Fallbacks if string was stripped to empty
  if (!cleaned || cleaned.length < 2) {
    if (options.merchant) return options.merchant
    if (/\b(makan(?:\s+siang|\s+malam|\s+pagi)?)\b/i.test(rawText)) return 'Makan'
    return options.txType === 'income' ? 'Pemasukan' : 'Pengeluaran'
  }

  return cleaned
}

/**
 * Splits conversational text into multi-item purchase segments if multiple
 * amount tokens are connected by conjunctions (sama, dan, plus, serta, koma).
 *
 * Example:
 * "tadi beli matcha 25k sama donat 12k di starbucks"
 * -> ["beli matcha 25k", "donat 12k di starbucks"]
 *
 * @param {string} text
 * @returns {Array<string> | null}
 */
export function splitMultiItemSegments(text) {
  if (!text || typeof text !== 'string') return null

  // Check if text has at least two monetary amounts
  const amountMatches = text.match(/\b\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|perak)?\b/gi)
  if (!amountMatches || amountMatches.length < 2) return null

  // Split on conjunctions: "sama", "dan", "plus", "serta", or comma
  const rawParts = text.split(/\s+(?:sama|dan|plus|serta)\s+|,/i)
  const validParts = rawParts.map((p) => p.trim()).filter(Boolean)

  if (validParts.length >= 2) {
    const hasAmount = (str) => /\b\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|perak)?\b/i.test(str)
    const partsWithAmount = validParts.filter(hasAmount)
    if (partsWithAmount.length >= 2) {
      return validParts
    }
  }

  return null
}

/**
 * Escapes characters for dynamic RegExp construction
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
