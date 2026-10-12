import { toSafeNumber, convertCurrency, FALLBACK_EXCHANGE_RATES } from '../../utils'
import { getCachedCurrencyRates } from '../../api'

export function getNotificationTimestamp(val) {
  if (!val) return Date.now()
  const num = Number(val)
  if (Number.isFinite(num) && num > 0) return num
  const d = new Date(val).getTime()
  return Number.isFinite(d) && d > 0 ? d : Date.now()
}

export const INSTITUTION_ALIASES = {
  BCA: ['bca', 'bank bca', 'mybca', 'm-bca', 'klikbca', 'bca digital', '69888', '6269888'],
  'Mandiri Livin': ['mandiri', 'livin', 'bank mandiri', 'livin by mandiri', '83355', '6283355'],
  BRImo: ['bri', 'brimo', 'bank bri', 'bank rakyat indonesia', 'bri-info', '3355', '623355'],
  BNI: ['bni', 'wondr', 'bank bni', 'bank negara indonesia', '3300', '623300'],
  'Bank Saqu': ['saqu', 'bank saqu', 'banksaqu'],
  Superbank: ['superbank', 'super bank'],
  'Allo Bank': ['allo', 'allobank', 'allo bank'],
  GoPay: ['gopay', 'gojek', 'go-pay', 'pt dompet anak bangsa'],
  OVO: ['ovo', 'ovo cash', 'pt visionet'],
  DANA: ['dana', 'dompet dana', 'pt espay debit indonesia'],
  ShopeePay: ['shopee', 'shopeepay', 'spay'],
  LinkAja: ['linkaja', 'link aja', 'pt fintek karya nusantara'],
  Seabank: ['seabank', 'sea bank', 'sea bank indonesia'],
  'Bank Jago': ['jago', 'bank jago', 'pt bank jago'],
  BSI: ['bsi', 'bank syariah indonesia', 'bsimobile', 'bsi mobile'],
  'CIMB Niaga': ['cimb', 'cimb niaga', 'octo', 'octomobile', 'octo mobile', 'pt bank cimb niaga', '3346', '623346'],
  'LINE Bank': ['line bank', 'linebank', 'hana bank', 'keb hana'],
  Blu: ['blu', 'blu by bca digital', 'bca digital'],
  Jenius: ['jenius', 'btpn', 'bank btpn'],
  Permata: ['permata', 'permatabank', 'bank permata', 'permata mobile', '1418', '621418'],
  Danamon: ['danamon', 'bank danamon', 'd-bank', 'd bank', '3399', '623399'],
  'Bank Mega': ['mega', 'bank mega', 'm-smile', '3377', '623377'],
  Citibank: ['citibank', 'citi'],
  HSBC: ['hsbc', 'bank hsbc'],
}

/**
 * Fuzzy Wallet Matcher
 * Finds the exact or best matching wallet for a bank/e-wallet institution.
 */
export function findBestMatchingWallet(institution = '', availableWallets = [], rawText = '') {
  if (!Array.isArray(availableWallets) || availableWallets.length === 0) {
    return { wallet: null, matches: [], isAmbiguous: false }
  }

  const instClean = (institution || '').trim().toLowerCase()
  const aliases = (INSTITUTION_ALIASES[institution] || [instClean]).map((a) => a.toLowerCase())

  // Check 1: 4-digit Account Number matching if present in rawText
  const accMatch = (rawText || '').match(/(?:rekening|rek|acc|no\.?|kartu)\s*(?:[x*]*\s*)?(\d{4})/i)
  if (accMatch) {
    const accSuffix = accMatch[1]
    const accMatched = availableWallets.filter((w) => {
      const wAcc = (w.accountNumber || '').replace(/\D/g, '')
      return wAcc.endsWith(accSuffix)
    })
    if (accMatched.length === 1) {
      return { wallet: accMatched[0], matches: accMatched, isAmbiguous: false }
    }
    if (accMatched.length > 1) {
      return { wallet: null, matches: accMatched, isAmbiguous: true }
    }
  }

  // Check 2: Tier 1 Exact Match (wName === alias or wInst === alias)
  const GENERIC_DANA_PHRASES = /(?:dana\s*(?:darurat|cadangan|siaga|tabungan|simpanan|pensiun|pendidikan|liburan|kas|abadi|nikah|rumah|khusus|amal|usaha|modal))/i

  const exactMatches = availableWallets.filter((w) => {
    const wName = (w.name || '').trim().toLowerCase()
    const wInst = (w.institutionName || '').trim().toLowerCase()
    return aliases.some((alias) => {
      if (!alias) return false
      const isDanaAlias = alias === 'dana' || alias === 'dompet dana'
      const isGenericFund = isDanaAlias && (GENERIC_DANA_PHRASES.test(wName) || GENERIC_DANA_PHRASES.test(wInst))
      if (isGenericFund) return false
      return wName === alias || wInst === alias
    })
  })

  if (exactMatches.length === 1) {
    return { wallet: exactMatches[0], matches: exactMatches, isAmbiguous: false }
  }
  if (exactMatches.length > 1) {
    // If multiple exact matches exist, prioritize exact wallet name match over institution-only match
    const exactNameMatches = exactMatches.filter((w) => {
      const wName = (w.name || '').trim().toLowerCase()
      return aliases.some((alias) => alias && wName === alias)
    })
    if (exactNameMatches.length === 1) {
      return { wallet: exactNameMatches[0], matches: exactNameMatches, isAmbiguous: false }
    }
    return { wallet: null, matches: exactMatches, isAmbiguous: true }
  }

  // Check 3: Fuzzy / Alias matching on wallet name & institutionName
  const matchedWallets = availableWallets.filter((w) => {
    const wName = (w.name || '').trim().toLowerCase()
    const wInst = (w.institutionName || '').trim().toLowerCase()

    const matchesAlias = aliases.some((alias) => {
      if (!alias) return false

      // When matching the e-wallet alias 'dana', exclude generic Indonesian fund phrases
      const isDanaAlias = alias === 'dana' || alias === 'dompet dana'
      const isGenericFund = isDanaAlias && (GENERIC_DANA_PHRASES.test(wName) || GENERIC_DANA_PHRASES.test(wInst))
      if (isGenericFund) {
        return false
      }

      return (
        (wName && (wName === alias || wName.includes(alias) || (wName.length >= 3 && alias.includes(wName)))) ||
        (wInst && (wInst === alias || wInst.includes(alias) || (wInst.length >= 3 && alias.includes(wInst))))
      )
    })

    return matchesAlias
  })

  if (matchedWallets.length === 1) {
    return { wallet: matchedWallets[0], matches: matchedWallets, isAmbiguous: false }
  }

  if (matchedWallets.length > 1) {
    return { wallet: null, matches: matchedWallets, isAmbiguous: true }
  }

  // Unmatched: do NOT guess across different institutions or e-wallet brands
  return { wallet: null, matches: [], isAmbiguous: false }
}

/**
 * Correlates dual debit/credit mutations within 120s into a single Transfer (Pindah Dana)
 */
export function correlateInternalTransfers(parsedMutations = [], availableWallets = [], options = {}) {
  const hasRecentTx = Array.isArray(options?.recentTransactions) && options.recentTransactions.length > 0
  if (!Array.isArray(parsedMutations) || (parsedMutations.length < 2 && !hasRecentTx)) {
    return { correlated: parsedMutations || [], transfersCreated: 0, updatedExisting: [] }
  }

  const notificationAutoApprove =
    typeof options === 'boolean' ? options : Boolean(options?.notificationAutoApprove)

  const result = []
  const consumedIndices = new Set()
  let transfersCreated = 0

  for (let i = 0; i < parsedMutations.length; i++) {
    if (consumedIndices.has(i)) continue

    const current = parsedMutations[i]
    let pairedIndex = -1

    for (let j = i + 1; j < parsedMutations.length; j++) {
      if (consumedIndices.has(j)) continue
      const candidate = parsedMutations[j]

      // Criteria: Opposite types (one expense, one income)
      const isOppositeType =
        (current.type === 'expense' && candidate.type === 'income') ||
        (current.type === 'income' && candidate.type === 'expense')

      const isSameRawAmount = Math.abs(toSafeNumber(current.amount) - toSafeNumber(candidate.amount)) < 0.01

      // Admin fee tolerance for same-currency (e.g. Bank debits Rp 51.000, DANA receives Rp 50.000)
      const currentCurr = (current.currency || 'IDR').toUpperCase()
      const candCurr = (candidate.currency || 'IDR').toUpperCase()
      const isSameCurrency = currentCurr === candCurr
      const rawDiff = Math.abs(toSafeNumber(current.amount) - toSafeNumber(candidate.amount))
      const minAmount = Math.min(toSafeNumber(current.amount), toSafeNumber(candidate.amount))
      const expenseAmount = current.type === 'expense' ? toSafeNumber(current.amount) : toSafeNumber(candidate.amount)
      const incomeAmount = current.type === 'income' ? toSafeNumber(current.amount) : toSafeNumber(candidate.amount)
      const isFeeToleranceMatch = isSameCurrency && minAmount >= 5000 && rawDiff <= 2500 && expenseAmount >= incomeAmount

      // Support cross-currency transferred amounts using current rates
      let isConvertedAmountMatch = false
      if (!isSameRawAmount && !isFeeToleranceMatch && current.currency && candidate.currency && current.currency !== candidate.currency) {
        const activeRates = options?.rates || getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }
        const convertedCurrent = convertCurrency(toSafeNumber(current.amount), current.currency, candidate.currency, activeRates)
        const candAmt = toSafeNumber(candidate.amount)
        if (candAmt > 0 && Math.abs(convertedCurrent - candAmt) / candAmt <= 0.10) {
          isConvertedAmountMatch = true
        }
      }

      const isAmountMatch = isSameRawAmount || isFeeToleranceMatch || isConvertedAmountMatch

      // Within 120 seconds time difference
      const timeI = getNotificationTimestamp(current.createdAt || current.timestamp)
      const timeJ = getNotificationTimestamp(candidate.createdAt || candidate.timestamp)
      const isWithinWindow = Math.abs(timeI - timeJ) <= 120000

      if (isOppositeType && isAmountMatch && isWithinWindow) {
        pairedIndex = j
        break
      }
    }

    if (pairedIndex !== -1) {
      const candidate = parsedMutations[pairedIndex]
      consumedIndices.add(i)
      consumedIndices.add(pairedIndex)
      transfersCreated++

      const fromMutation = current.type === 'expense' ? current : candidate
      const toMutation = current.type === 'income' ? current : candidate

      const fromMatch = findBestMatchingWallet(fromMutation.institution, availableWallets, fromMutation.rawDescription)
      const toMatch = findBestMatchingWallet(toMutation.institution, availableWallets, toMutation.rawDescription)

      const isSameResolvedWallet =
        Boolean(fromMatch.wallet?.id) &&
        Boolean(toMatch.wallet?.id) &&
        String(fromMatch.wallet.id) === String(toMatch.wallet.id)

      const isCrossCurrency =
        fromMatch.wallet?.currency &&
        toMatch.wallet?.currency &&
        fromMatch.wallet.currency !== toMatch.wallet.currency

      const hasAmountDiff = Math.abs(toSafeNumber(fromMutation.amount) - toSafeNumber(toMutation.amount)) >= 0.01
      const isTargetAmountNeeded = isCrossCurrency || hasAmountDiff

      result.push({
        type: 'transfer',
        amount: fromMutation.amount,
        currency: fromMutation.currency || fromMatch.wallet?.currency || 'IDR',
        targetAmount: isTargetAmountNeeded ? toMutation.amount : undefined,
        targetCurrency: isTargetAmountNeeded ? (toMutation.currency || toMatch.wallet?.currency || fromMutation.currency || 'IDR') : undefined,
        date: fromMutation.date,
        createdAt: fromMutation.createdAt,
        walletId: fromMatch.wallet?.id ? Number(fromMatch.wallet.id) : null,
        targetWalletId: toMatch.wallet?.id ? Number(toMatch.wallet.id) : null,
        category: 'transfer',
        notes: `[Pindah Dana] ${fromMutation.institution} -> ${toMutation.institution}`,
        cleanMerchant: `Pindah Dana: ${fromMutation.institution} -> ${toMutation.institution}`,
        refNumber: fromMutation.refNumber || toMutation.refNumber || undefined,
        sourceNotifIds: [fromMutation.sourceNotifId, toMutation.sourceNotifId].filter(Boolean),
        isPendingReview:
          !notificationAutoApprove ||
          fromMatch.isAmbiguous ||
          toMatch.isAmbiguous ||
          !fromMatch.wallet ||
          !toMatch.wallet ||
          isSameResolvedWallet,
        source: 'notification_listener_transfer',
        deletedAt: null,
      })
    } else {
      result.push(current)
    }
  }

  // Cross-batch correlation against existing Dexie transactions (within 120s)
  const updatedExistingTransactions = []
  const consumedRecentIds = new Set()

  if (Array.isArray(options?.recentTransactions) && options.recentTransactions.length > 0) {
    for (let i = 0; i < result.length; i++) {
      const item = result[i]
      if (item.type !== 'income' && item.type !== 'expense') continue

      const itemTime = getNotificationTimestamp(item.createdAt || item.timestamp)

      const matchedExistingIndex = options.recentTransactions.findIndex((existing) => {
        if (!existing || existing.deletedAt || consumedRecentIds.has(existing.id)) return false
        if (existing.type !== 'income' && existing.type !== 'expense') return false

        const isOpposite =
          (item.type === 'expense' && existing.type === 'income') ||
          (item.type === 'income' && existing.type === 'expense')
        if (!isOpposite) return false

        const existingTime = getNotificationTimestamp(existing.createdAt || existing.date)
        if (Math.abs(itemTime - existingTime) > 120000) return false

        const isSameRaw = Math.abs(toSafeNumber(item.amount) - toSafeNumber(existing.amount)) < 0.01
        const itemCurr = (item.currency || 'IDR').toUpperCase()
        const existCurr = (existing.currency || 'IDR').toUpperCase()
        const isSameCurr = itemCurr === existCurr
        const rawDiff = Math.abs(toSafeNumber(item.amount) - toSafeNumber(existing.amount))
        const minAmt = Math.min(toSafeNumber(item.amount), toSafeNumber(existing.amount))
        const expenseAmount = item.type === 'expense' ? toSafeNumber(item.amount) : toSafeNumber(existing.amount)
        const incomeAmount = item.type === 'income' ? toSafeNumber(item.amount) : toSafeNumber(existing.amount)
        const isFeeTolerance = isSameCurr && minAmt >= 5000 && rawDiff <= 2500 && expenseAmount >= incomeAmount

        if (!isSameRaw && !isFeeTolerance) return false

        // Disallow cross-batch correlation if both mutations clearly belong to the exact same institution
        const itemInst = item.institution || item.suggestedInstitution || ''
        const existInst = existing.institution || existing.suggestedInstitution || ''
        if (itemInst && existInst && itemInst.trim().toLowerCase() === existInst.trim().toLowerCase()) {
          return false
        }

        return true
      })

      if (matchedExistingIndex !== -1) {
        const existingTx = options.recentTransactions[matchedExistingIndex]
        consumedRecentIds.add(existingTx.id)
        transfersCreated++

        const fromMutation = item.type === 'expense' ? item : existingTx
        const toMutation = item.type === 'income' ? item : existingTx

        const fromInst = fromMutation.institution || fromMutation.suggestedInstitution || ''
        const toInst = toMutation.institution || toMutation.suggestedInstitution || ''

        const fromMatch = fromMutation.walletId
          ? { wallet: availableWallets.find((w) => Number(w.id) === Number(fromMutation.walletId)) || { id: fromMutation.walletId }, isAmbiguous: false }
          : findBestMatchingWallet(fromInst, availableWallets, fromMutation.rawDescription || fromMutation.notes)

        const toMatch = toMutation.walletId
          ? { wallet: availableWallets.find((w) => Number(w.id) === Number(toMutation.walletId)) || { id: toMutation.walletId }, isAmbiguous: false }
          : findBestMatchingWallet(toInst, availableWallets, toMutation.rawDescription || toMutation.notes)

        const hasAmountDiff = Math.abs(toSafeNumber(fromMutation.amount) - toSafeNumber(toMutation.amount)) >= 0.01
        const isCrossCurrency =
          fromMatch.wallet?.currency &&
          toMatch.wallet?.currency &&
          fromMatch.wallet.currency !== toMatch.wallet.currency
        const isTargetAmountNeeded = isCrossCurrency || hasAmountDiff

        const isSameResolvedWallet =
          Boolean(fromMatch.wallet?.id) &&
          Boolean(toMatch.wallet?.id) &&
          String(fromMatch.wallet.id) === String(toMatch.wallet.id)

        const fromWalletId = fromMatch.wallet?.id ? Number(fromMatch.wallet.id) : null
        const toWalletId = toMatch.wallet?.id ? Number(toMatch.wallet.id) : null

        const combinedNotifIds = [
          existingTx.sourceNotifId,
          ...(Array.isArray(existingTx.sourceNotifIds) ? existingTx.sourceNotifIds : []),
          item.sourceNotifId,
          ...(Array.isArray(item.sourceNotifIds) ? item.sourceNotifIds : []),
        ].filter(Boolean)
        const uniqueNotifIds = Array.from(new Set(combinedNotifIds))

        const changes = {
          type: 'transfer',
          amount: fromMutation.amount,
          currency: fromMutation.currency || fromMatch.wallet?.currency || 'IDR',
          walletId: fromWalletId,
          targetWalletId: toWalletId,
          targetAmount: isTargetAmountNeeded ? toMutation.amount : undefined,
          targetCurrency: isTargetAmountNeeded ? (toMutation.currency || toMatch.wallet?.currency || fromMutation.currency || 'IDR') : undefined,
          category: 'transfer',
          notes: `[Pindah Dana] ${fromInst || 'Bank'} -> ${toInst || 'E-Wallet'}`,
          cleanMerchant: `Pindah Dana: ${fromInst || 'Bank'} -> ${toInst || 'E-Wallet'}`,
          refNumber: fromMutation.refNumber || toMutation.refNumber || existingTx.refNumber || undefined,
          sourceNotifId: existingTx.sourceNotifId || item.sourceNotifId || undefined,
          sourceNotifIds: uniqueNotifIds.length > 0 ? uniqueNotifIds : undefined,
          isPendingReview:
            !notificationAutoApprove ||
            fromMatch.isAmbiguous ||
            toMatch.isAmbiguous ||
            !fromMatch.wallet ||
            !toMatch.wallet ||
            isSameResolvedWallet,
          source: 'notification_listener_transfer',
        }

        updatedExistingTransactions.push({
          id: existingTx.id,
          sourceNotifId: item.sourceNotifId,
          sourceNotifIds: uniqueNotifIds.length > 0 ? uniqueNotifIds : [existingTx.sourceNotifId, item.sourceNotifId].filter(Boolean),
          changes,
        })

        result.splice(i, 1)
        i--
      }
    }
  }

  return { correlated: result, transfersCreated, updatedExisting: updatedExistingTransactions }
}
