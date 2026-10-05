import { toSafeNumber } from '../../utils'

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

  // Check 2: Fuzzy / Alias matching on wallet name & institutionName
  const matchedWallets = availableWallets.filter((w) => {
    const wName = (w.name || '').trim().toLowerCase()
    const wInst = (w.institutionName || '').trim().toLowerCase()

    const matchesAlias = aliases.some((alias) => {
      if (!alias) return false
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
  if (!Array.isArray(parsedMutations) || parsedMutations.length < 2) {
    return { correlated: parsedMutations, transfersCreated: 0 }
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

      // Criteria: Opposite types (one expense, one income), same amount
      const isOppositeType =
        (current.type === 'expense' && candidate.type === 'income') ||
        (current.type === 'income' && candidate.type === 'expense')

      const isSameAmount = Math.abs(toSafeNumber(current.amount) - toSafeNumber(candidate.amount)) < 0.01

      // Within 120 seconds time difference
      const timeI = getNotificationTimestamp(current.createdAt || current.timestamp)
      const timeJ = getNotificationTimestamp(candidate.createdAt || candidate.timestamp)
      const isWithinWindow = Math.abs(timeI - timeJ) <= 120000

      if (isOppositeType && isSameAmount && isWithinWindow) {
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

      result.push({
        type: 'transfer',
        amount: fromMutation.amount,
        currency: fromMutation.currency || 'IDR',
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

  return { correlated: result, transfersCreated }
}
