import { WebPlugin, registerPlugin, Capacitor } from '@capacitor/core'
import { format } from 'date-fns'
import { db } from './db'
import { toSafeNumber } from './utils'
import { matchCategoryFromDescription, cleanMutationMerchant } from './merchantUtils'
import { invalidateWalletBalance } from './balanceEngine'

class FinTrackNotificationWeb extends WebPlugin {
  async isPermissionGranted() {
    return { granted: false }
  }
  async requestPermission() {
    return { success: true }
  }
  async drainQueuedMutations() {
    return { mutations: [] }
  }
  async getQueuedMutations() {
    return { mutations: [] }
  }
  async clearQueuedMutations() {
    return { success: true }
  }
  async getSupportedInstitutions() {
    return { institutions: [] }
  }
  async updateWidgetData() {
    return { success: true }
  }
}

// Register Native Capacitor Plugin with fallback for Web preview
export const FinTrackNotificationPlugin = registerPlugin('FinTrackNotification', {
  web: () => new FinTrackNotificationWeb(),
})

/**
 * TIER 1: Deterministic Bank-Specific Regex Parsers (0ms offline, ultra-low battery)
 */
export function parseWithBankRegex(title = '', text = '', packageName = '') {
  const combined = `${title} ${text}`.trim()
  const lowerPkg = (packageName || '').toLowerCase()

  // 1. BCA / myBCA
  if (lowerPkg.includes('bca') || /m-bca|mybca|bank bca/i.test(combined)) {
    // Expense e.g.: "m-Transfer Berhasil. Transfer Rp 50.000 ke 1234567890 Bpk Budi Santoso"
    // Income e.g.: "Transfer Masuk Rp 1.500.000 dari PT ABC"
    const isIncome = /masuk|cr|terima|kredit/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = toSafeNumber(amtMatch[1].replace(/[^0-9]/g, ''))
      return {
        institution: 'BCA',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 2. Mandiri / Livin
  if (lowerPkg.includes('mandiri') || /livin/i.test(combined)) {
    // "Pembayaran Berhasil Rp 45.000 di Kopi Kenangan"
    // "Transfer Masuk Rp 500.000"
    const isIncome = /masuk|cr|kredit|diterima/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = toSafeNumber(amtMatch[1].replace(/[^0-9]/g, ''))
      return {
        institution: 'Mandiri Livin',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 3. BRImo (BRI)
  if (lowerPkg.includes('bri') || /brimo/i.test(combined)) {
    const isIncome = /masuk|cr|kredit|setoran/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = toSafeNumber(amtMatch[1].replace(/[^0-9]/g, ''))
      return {
        institution: 'BRImo',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 4. BNI / Wondr
  if (lowerPkg.includes('bni') || /wondr/i.test(combined)) {
    const isIncome = /masuk|cr|kredit/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = toSafeNumber(amtMatch[1].replace(/[^0-9]/g, ''))
      return {
        institution: 'BNI',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 5. GoPay / Gojek
  if (lowerPkg.includes('gojek') || lowerPkg.includes('gopay') || /gopay/i.test(combined)) {
    // "Pembayaran Rp35.000 ke Solaria berhasil"
    // "Kamu menerima transfer Rp100.000 dari Andi"
    const isIncome = /menerima|top up|cashback|masuk/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = toSafeNumber(amtMatch[1].replace(/[^0-9]/g, ''))
      return {
        institution: 'GoPay',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.95,
        tier: 1,
      }
    }
  }

  // 6. OVO
  if (lowerPkg.includes('ovo') || /ovo/i.test(combined)) {
    const isIncome = /top up|menerima|cashback/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = toSafeNumber(amtMatch[1].replace(/[^0-9]/g, ''))
      return {
        institution: 'OVO',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.95,
        tier: 1,
      }
    }
  }

  // 7. DANA
  if (lowerPkg.includes('dana') || /dana/i.test(combined)) {
    const isIncome = /kirim uang diterima|isi saldo|cashback|top up/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = toSafeNumber(amtMatch[1].replace(/[^0-9]/g, ''))
      return {
        institution: 'DANA',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.95,
        tier: 1,
      }
    }
  }

  // 8. ShopeePay
  if (lowerPkg.includes('shopee') || /shopeepay/i.test(combined)) {
    const isIncome = /isi saldo|menerima transfer|cashback/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = toSafeNumber(amtMatch[1].replace(/[^0-9]/g, ''))
      return {
        institution: 'ShopeePay',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.95,
        tier: 1,
      }
    }
  }

  return null
}

export const INSTITUTION_ALIASES = {
  BCA: ['bca', 'bank bca', 'mybca', 'm-bca', 'klikbca', 'blu', 'bca digital'],
  'Mandiri Livin': ['mandiri', 'livin', 'bank mandiri', 'livin by mandiri'],
  BRImo: ['bri', 'brimo', 'bank bri', 'bank rakyat indonesia'],
  BNI: ['bni', 'wondr', 'bank bni', 'bank negara indonesia'],
  GoPay: ['gopay', 'gojek', 'go-pay', 'pt dompet anak bangsa'],
  OVO: ['ovo', 'ovo cash', 'pt visionet'],
  DANA: ['dana', 'dompet dana', 'pt espay debit indonesia'],
  ShopeePay: ['shopee', 'shopeepay', 'spay'],
  Seabank: ['seabank', 'sea bank', 'sea bank indonesia'],
  'Bank Jago': ['jago', 'bank jago', 'pt bank jago'],
  BSI: ['bsi', 'bank syariah indonesia', 'bsimobile'],
  Blu: ['blu', 'blu by bca digital', 'bca digital'],
}

/**
 * Deterministic Anti-Spam & Promo Guardrail
 */
export function isFinancialMutation(title = '', text = '', packageName = '') {
  const combined = `${title} ${text} ${packageName}`.toLowerCase()
  if (!combined.trim()) return false

  // Blacklist Promo, OTP, and Security alert keywords
  const blacklist = [
    'cashback s.d',
    'promo ',
    'diskon ',
    'voucher',
    'syarat & ketentuan',
    's&k berlaku',
    'poin reward',
    'klaim hadiah',
    'kode otp',
    'otp anda',
    'verifikasi login',
    'peringatan keamanan',
    'perangkat baru terdeteksi',
    'reset pin',
    'ganti password',
  ]
  if (blacklist.some((b) => combined.includes(b))) {
    return false
  }

  // Must contain monetary pattern (e.g. Rp 10.000, IDR 5000, Rp50.000)
  const hasMoneyPattern = /(?:rp|idr)\.?\s*[\d.,]+/i.test(combined)
  if (!hasMoneyPattern) return false

  // Must contain valid financial action indicator
  const actionKeywords = [
    'berhasil',
    'sukses',
    'transfer',
    'pembayaran',
    'qris',
    'debit',
    'kredit',
    'top up',
    'topup',
    'isi saldo',
    'terima',
    'diterima',
    'masuk',
    'keluar',
    'tarik tunai',
    'setoran',
    'kirim uang',
    'pembelian',
  ]
  return actionKeywords.some((w) => combined.includes(w))
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

  // Check 3: If no name match but only 1 wallet of matching institutionType exists (e.g. e-wallet)
  const isEWalletInst = ['gopay', 'ovo', 'dana', 'shopeepay'].includes(instClean)
  if (isEWalletInst) {
    const matchingEWallets = availableWallets.filter(
      (w) => (w.institutionType || '').toLowerCase() === 'ewallet'
    )
    if (matchingEWallets.length === 1) {
      return { wallet: matchingEWallets[0], matches: matchingEWallets, isAmbiguous: false }
    }
  }

  return { wallet: null, matches: [], isAmbiguous: false }
}

/**
 * Correlates dual debit/credit mutations within 120s into a single Transfer (Pindah Dana)
 */
export function correlateInternalTransfers(parsedMutations = [], availableWallets = []) {
  if (!Array.isArray(parsedMutations) || parsedMutations.length < 2) {
    return { correlated: parsedMutations, transfersCreated: 0 }
  }

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
      const timeI = new Date(current.createdAt || current.timestamp || Date.now()).getTime()
      const timeJ = new Date(candidate.createdAt || candidate.timestamp || Date.now()).getTime()
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

      result.push({
        type: 'transfer',
        amount: fromMutation.amount,
        currency: fromMutation.currency || 'IDR',
        date: fromMutation.date,
        createdAt: fromMutation.createdAt,
        walletId: fromMatch.wallet?.id || undefined,
        targetWalletId: toMatch.wallet?.id || undefined,
        category: 'transfer',
        notes: `[Pindah Dana] ${fromMutation.institution} -> ${toMutation.institution}`,
        isPendingReview: fromMatch.isAmbiguous || toMatch.isAmbiguous || !fromMatch.wallet || !toMatch.wallet,
        source: 'notification_listener_transfer',
      })
    } else {
      result.push(current)
    }
  }

  return { correlated: result, transfersCreated }
}

/**
 * TIER 2: Token Boundary & General Currency Extractor (Fallback for other financial apps)
 */
export function parseWithTokenBoundary(title = '', text = '') {
  const combined = `${title} ${text}`.trim()
  const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)

  if (!amtMatch) return null

  const amount = toSafeNumber(amtMatch[1].replace(/[^0-9]/g, ''))
  if (amount <= 0) return null

  const isIncome = /(masuk|terima|diterima|inflow|cr|kredit|top\s*up|cashback|refund)/i.test(combined)

  return {
    institution: 'Bank / E-Wallet',
    amount,
    type: isIncome ? 'income' : 'expense',
    rawDescription: combined,
    confidence: 0.8,
    tier: 2,
  }
}

/**
 * 3-TIER INGESTION PARSER PIPELINE
 */
export function parseFinancialNotification(notif = {}) {
  const { title = '', text = '', packageName = '', timestamp = Date.now() } = notif

  if (!isFinancialMutation(title, text, packageName)) {
    return null
  }

  // Tier 1: Deterministic Bank Regex
  const tier1 = parseWithBankRegex(title, text, packageName)
  if (tier1) {
    return formatParsedNotification(tier1, timestamp)
  }

  // Tier 2: Token Boundary Extractor
  const tier2 = parseWithTokenBoundary(title, text)
  if (tier2) {
    return formatParsedNotification(tier2, timestamp)
  }

  return null
}

function formatParsedNotification(parsed, timestamp) {
  const cleanMerchant = cleanMutationMerchant(parsed.rawDescription)
  const matchedCategory = matchCategoryFromDescription(cleanMerchant, parsed.type)
  const category = matchedCategory || 'Lainnya'

  return {
    ...parsed,
    cleanMerchant,
    category,
    date: format(new Date(timestamp), 'yyyy-MM-dd'),
    createdAt: Number(timestamp) || Date.now(),
    notes: cleanMerchant,
  }
}

/**
 * Ingests all queued mutations from Android SharedPreferences into Dexie IndexedDB.
 */
export async function syncNotificationQueue(options = {}) {
  const { defaultWalletId, defaultCurrency = 'IDR' } = options

  if (!Capacitor.isNativePlatform()) {
    return { syncedCount: 0, skippedDuplicates: 0 }
  }

  try {
    const res = await (FinTrackNotificationPlugin.drainQueuedMutations
      ? FinTrackNotificationPlugin.drainQueuedMutations()
      : FinTrackNotificationPlugin.getQueuedMutations())
    const queuedItems = res?.mutations || []

    if (queuedItems.length === 0) {
      return { syncedCount: 0, skippedDuplicates: 0 }
    }

    let syncedCount = 0
    let skippedDuplicates = 0

    // Fetch existing transactions from recent 7 days to deduplicate
    const recentDate = format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd')
    const recentTransactions = await db.transactions
      .where('date')
      .aboveOrEqual(recentDate)
      .toArray()

    const availableWallets = await db.wallets.toArray()

    // 1. Parse all valid financial mutations
    const parsedList = []
    for (const notif of queuedItems) {
      const parsed = parseFinancialNotification(notif)
      if (!parsed || parsed.amount <= 0) continue

      // Deduplication check: Same date, same amount, same type
      const isDuplicate = recentTransactions.some((existing) => {
        return (
          existing.date === parsed.date &&
          existing.type === parsed.type &&
          Math.abs(toSafeNumber(existing.amount) - toSafeNumber(parsed.amount)) < 0.01
        )
      })

      if (isDuplicate) {
        skippedDuplicates++
        continue
      }

      parsedList.push(parsed)
    }

    // 2. Correlate internal transfers (e.g. BCA to GoPay in <= 120s)
    const { correlated } = correlateInternalTransfers(parsedList, availableWallets)

    // 3. Match individual wallets & prepare insertion payload
    const toInsert = []
    const walletBalanceDeltas = new Map()

    for (const item of correlated) {
      if (item.type === 'transfer') {
        toInsert.push(item)
        syncedCount++

        // If fromWallet & toWallet are defined, adjust balances
        if (item.walletId) {
          const prev = walletBalanceDeltas.get(item.walletId) || 0
          walletBalanceDeltas.set(item.walletId, prev - item.amount)
        }
        if (item.targetWalletId) {
          const prev = walletBalanceDeltas.get(item.targetWalletId) || 0
          walletBalanceDeltas.set(item.targetWalletId, prev + item.amount)
        }
        continue
      }

      // Single mutation: match best wallet
      const matchResult = findBestMatchingWallet(item.institution, availableWallets, item.rawDescription)
      let resolvedWalletId = matchResult.wallet?.id || (defaultWalletId ? Number(defaultWalletId) : undefined)
      let isPendingReview = matchResult.isAmbiguous || (!matchResult.wallet && !defaultWalletId)

      toInsert.push({
        date: item.date,
        type: item.type,
        category: item.category,
        amount: item.amount,
        currency: defaultCurrency,
        walletId: resolvedWalletId,
        notes: `[Auto: ${item.institution}] ${item.notes}`,
        source: 'notification_listener',
        createdAt: item.createdAt,
        isPendingReview: isPendingReview,
        suggestedInstitution: item.institution,
      })

      if (resolvedWalletId && !isPendingReview) {
        const prev = walletBalanceDeltas.get(resolvedWalletId) || 0
        const delta = item.type === 'income' ? item.amount : -item.amount
        walletBalanceDeltas.set(resolvedWalletId, prev + delta)
      }

      syncedCount++
    }

    if (toInsert.length > 0) {
      await db.transactions.bulkAdd(toInsert)

      // Invalidate balance cache so dynamic computeWalletBalance immediately reflects inserted transactions
      const affectedWalletIds = Array.from(walletBalanceDeltas.keys()).map(Number).filter(Boolean)
      if (affectedWalletIds.length > 0) {
        void invalidateWalletBalance(affectedWalletIds)
      }

      if (typeof window !== 'undefined') {
        import('../store/useSettingsStore').then((m) => {
          m.default.getState().incrementUnviewedMutations(syncedCount)
        })
      }
    }

    // Safely fallback to clearing native queue if drainQueuedMutations was not available
    if (!FinTrackNotificationPlugin.drainQueuedMutations) {
      await FinTrackNotificationPlugin.clearQueuedMutations?.()
    }

    return { syncedCount, skippedDuplicates }
  } catch (err) {
    console.error('Error syncing notification queue:', err)
    return { syncedCount: 0, skippedDuplicates: 0, error: err.message }
  }
}
