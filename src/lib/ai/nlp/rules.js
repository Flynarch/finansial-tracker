import { format, subDays } from 'date-fns'
import { sanitizeCategoryPath } from '../../categorySanitizer'
import { formatCurrency } from '../../utils'
import useSettingsStore from '../../../store/useSettingsStore'
import {
  extractTimeSlot,
  extractVenueSlot,
  extractCleanSubjectEntity,
} from '../semanticSlotFiller'
import { predictOmissionSuggestion } from '../entityMemory'
import {
  DAY_DEFINITIONS,
  KNOWN_MERCHANT_SERVICES,
  MONTH_NAME_REGEX,
} from './lexicon'
import {
  escapeRegExp,
  normalizeIndonesianNlpText,
  extractMerchantAndCategory,
  findWalletInText,
} from './tokenizer'
import {
  getRecentPastDayDate,
  extractDateFromPhrase,
} from './dateRules'
import {
  parseIndonesianAmount,
  extractCurrencyFromText,
  extractMonetaryAmountFromText,
} from './amountRules'
import {
  parseTransferTransaction,
} from './transferRules'

export {
  getRecentPastDayDate,
  extractDateFromPhrase,
  parseIndonesianAmount,
  extractCurrencyFromText,
  extractMonetaryAmountFromText,
  parseTransferTransaction,
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
      const hasPastWeekQualifier =
        new RegExp(`${dayNameInText}\\s+(?:lalu|minggu\\s+lalu)|(?:minggu\\s+lalu)\\s+(?:hari\\s+)?${dayNameInText}`, 'i').test(lower)
      const hasKemarinQualifier =
        new RegExp(`${dayNameInText}\\s+kemarin|kemarin\\s+(?:hari\\s+)?${dayNameInText}`, 'i').test(lower)

      const dateStr = getRecentPastDayDate(def.dayIndex, ref, {
        forcePastWeek: hasKemarinQualifier || hasPastWeekQualifier,
        isExplicitPastWeek: hasPastWeekQualifier,
      })
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
        `(?:${d.name}|${d.name.toLowerCase()})[^\\d]{0,15}(\\d+(?:[.,]\\d+)?\\s*(?:k|rb|ribu|jt|juta|m|miliar|milyar|b|perak)?)\\b`,
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
    /^([a-zA-Z0-9\s\-_]+?)\s+(?:sebesar\s+|rp\.?\s*|\$\s*|€\s*)?(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|miliar|milyar|b|perak)?)(?:\s+(.*))?$/i
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
      /(?:habisin|bayar|beli|keluar|sebesar)\s*(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|miliar|milyar|b|perak)?)\s+(?:buat|untuk|di|naik)?\s*([a-zA-Z0-9\-_]+(?:\s+[a-zA-Z0-9\-_]+)?)/i
    ) ||
    normalized.match(
      /\b(\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta|m|miliar|milyar|b|perak))\s+(?:buat|untuk|di|naik)\s+([a-zA-Z0-9\-_]+(?:\s+[a-zA-Z0-9\-_]+)?)/i
    )

  if (amountMatch && amountMatch[1] && amountMatch[2]) {
    let rawTarget = amountMatch[2].trim()
    rawTarget = rawTarget.replace(/\s+(?:kemarin|semalam|tadi|besok|lusa|hari\s+ini|senin|selasa|rabu|kamis|jumat|sabtu|minggu)$/i, '').trim()
    const targetWord = rawTarget.toLowerCase()
    // Month names are NEVER merchants or transaction targets
    if (!MONTH_NAME_REGEX.test(targetWord)) {
      const amt = parseIndonesianAmount(amountMatch[1])
      if (amt > 0 && targetWord.length >= 3) {
        const { merchant, category } = extractMerchantAndCategory(rawTarget)
        const cleanMerchant = merchant || rawTarget.charAt(0).toUpperCase() + rawTarget.slice(1)
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
