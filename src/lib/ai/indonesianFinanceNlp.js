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
 * Extracts clean monetary amount from a sentence, guarding against date numbers (e.g. "2 hari lalu", "tanggal 12")
 * @param {string} text
 * @returns {number}
 */
export function extractMonetaryAmountFromText(text) {
  if (!text || typeof text !== 'string') return 0
  const lower = text.toLowerCase()

  // 1. Check for slang nominals first
  const slangMatch = lower.match(/\b(ceban|goceng|gocap|seceng|noceng|cenggo|nocenggo|cepek|pekgo|sejeti)\b/i)
  if (slangMatch && slangMatch[1]) {
    const slangVal = parseIndonesianAmount(slangMatch[1])
    if (slangVal > 0) return slangVal
  }

  // 2. Spending-verb bound amounts (e.g. "habisin 10k", "sebesar 25rb", "bayar 15k")
  const verbMatch = lower.match(
    /(?:habisin|keluarin|keluar|sebesar|bayar|beli|total)\s*(?:rp\.?\s*)?(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|perak)?)\b/i
  )
  if (verbMatch && verbMatch[1]) {
    const val = parseIndonesianAmount(verbMatch[1])
    if (val > 0) return val
  }

  // 3. Amount with explicit currency suffix or prefix (e.g. "10k", "rp 50000", "25rb", "1.5jt")
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

  // 4. Fallback: search for numbers that are NOT dates (not followed by "hari lalu" or preceded by "tanggal")
  const words = lower.split(/\s+/)
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (/^\d+$/.test(w)) {
      const prev = words[i - 1] || ''
      const next = words[i + 1] || ''
      if (prev.includes('tanggal') || prev.includes('tgl')) continue
      if (next.includes('hari') || next.includes('jam') || next.includes('menit') || next.includes('bulan') || next.includes('tahun')) continue
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
  }

  // 3. PATTERN B: Single-day with relative day or specific day name
  let resolvedDate = todayStr
  let matchedDayName = ''

  for (const def of DAY_DEFINITIONS) {
    if (def.regex.test(lower)) {
      const hasPastQualifier =
        new RegExp(`${def.canonical}\\s+(kemarin|lalu|minggu\\s+lalu)`, 'i').test(lower) ||
        new RegExp(`(kemarin|minggu\\s+lalu)\\s+hari\\s+${def.canonical}`, 'i').test(lower)
      resolvedDate = getRecentPastDayDate(def.dayIndex, ref, hasPastQualifier)
      matchedDayName = def.nameId
      break
    }
  }

  if (!matchedDayName) {
    if (/\b(kemarin\s+lusa|2\s+hari\s+lalu)\b/i.test(lower)) {
      resolvedDate = format(subDays(ref, 2), 'yyyy-MM-dd')
    } else if (/\b(kemarin|semalam|tadi\s+malam)\b/i.test(lower)) {
      resolvedDate = format(subDays(ref, 1), 'yyyy-MM-dd')
    }
  }

  // 4. PATTERN C: Clean item & amount extraction
  const clean = normalized
    .replace(/^(kemarin\s+|tadi\s+pagi\s+|tadi\s+siang\s+|tadi\s+malam\s+|hari\s+ini\s+|semalam\s+)/i, '')
    .replace(/^(beli|bayar|catat|tambah|pengeluaran|pemasukan|dapat|terima|makan|minum)\s+/i, '')
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
          )
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
  const amountMatch = normalized.match(
    /(?:habisin|bayar|beli|keluar|sebesar)?\s*(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|perak)?)\s+(?:buat|untuk|di|naik)?\s*([a-zA-Z0-9\-_]+)/i
  )
  if (amountMatch && amountMatch[1] && amountMatch[2]) {
    const amt = parseIndonesianAmount(amountMatch[1])
    const targetWord = amountMatch[2]
    if (amt > 0 && targetWord.length >= 3) {
      const { merchant, category } = extractMerchantAndCategory(targetWord)
      const cleanMerchant = merchant || targetWord.charAt(0).toUpperCase() + targetWord.slice(1)
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

  return null
}
