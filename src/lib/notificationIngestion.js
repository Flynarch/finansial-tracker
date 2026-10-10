import { WebPlugin, registerPlugin, Capacitor } from '@capacitor/core'
import { format } from 'date-fns'
import { db } from './db'
import { toSafeNumber } from './utils'
import { matchCategoryFromDescription, cleanMutationMerchant } from './merchantUtils'
import { invalidateWalletBalance } from './balanceEngine'
import { getRememberedCategory, enrichPendingMutationsWithAi } from './ai/merchantCategorizer'
import { encryptField, warmupDecryptionCache, getDecryptedNoteSync } from './fieldEncryption'
import { clearCachedDashboardState } from '../hooks/useDashboardData'
import { scheduleNativeWidgetSync } from './nativeWidgetSync'

// Re-export decomposed parsers and guards for 100% backward compatibility
export {
  parseAmountFromRegexMatch,
  parseWithBankRegex,
  parseWithTokenBoundary,
  extractTransactionRef,
} from './notifications/parsers/bankParsers'

export { parseWithWalletRegex } from './notifications/parsers/walletParsers'

export {
  isFinancialMutation,
  scanSuspectPromoTransactions,
  cleanSuspectPromoTransactions,
} from './notifications/parsers/antiSpamGuard'

export {
  getNotificationTimestamp,
  INSTITUTION_ALIASES,
  findBestMatchingWallet,
  correlateInternalTransfers,
} from './notifications/parsers/walletMatcher'

import {
  parseWithBankRegex,
  parseWithTokenBoundary,
  extractTransactionRef,
} from './notifications/parsers/bankParsers'
import { isFinancialMutation } from './notifications/parsers/antiSpamGuard'
import {
  getNotificationTimestamp,
  findBestMatchingWallet,
  correlateInternalTransfers,
} from './notifications/parsers/walletMatcher'

export class FinTrackNotificationWeb extends WebPlugin {
  async isPermissionGranted() {
    return { granted: false }
  }
  async requestPermission() {
    return { success: true }
  }
  async checkSmsPermission() {
    return { receiveGranted: false, readGranted: false }
  }
  async requestSmsPermission() {
    return { success: true }
  }
  async scanHistoricalSms() {
    return { mutations: [] }
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
  async acknowledgeQueuedMutations(options = {}) {
    return { acknowledgedCount: options?.ids?.length || 0, remainingCount: 0 }
  }
  async getCustomPackages() {
    return { packages: [] }
  }
  async updateCustomPackages(options = {}) {
    return { success: true, count: options?.packages?.length || 0 }
  }
  async getSupportedInstitutions() {
    return { institutions: [] }
  }
  async updateWidgetData() {
    return { success: true }
  }
  async getWidgetConfig() {
    let range = null
    let walletId = null
    let walletName = null
    try {
      if (typeof localStorage !== 'undefined') {
        range = localStorage.getItem('widget_config_range') || null
        walletId = localStorage.getItem('widget_config_wallet_id') || null
        walletName = localStorage.getItem('widget_config_wallet_name') || null
      }
    } catch { /* ignore */ }
    return { range, walletId, walletName }
  }
  async setWidgetConfig(options = {}) {
    try {
      if (typeof localStorage !== 'undefined') {
        if (options.range) localStorage.setItem('widget_config_range', options.range)
        if (options.walletId) localStorage.setItem('widget_config_wallet_id', options.walletId)
        if (options.walletName) localStorage.setItem('widget_config_wallet_name', options.walletName)
      }
    } catch { /* ignore */ }
    return { success: true }
  }
}

// Register Native Capacitor Plugin with fallback for Web preview
export const FinTrackNotificationPlugin = registerPlugin('FinTrackNotification', {
  web: () => new FinTrackNotificationWeb(),
})

/**
 * 3-TIER INGESTION PARSER PIPELINE
 */
export function parseFinancialNotification(notif = {}) {
  const { title = '', text = '', packageName = '', timestamp = Date.now(), id = null } = notif

  if (!isFinancialMutation(title, text, packageName)) {
    return null
  }

  const rawCombined = `${title} ${text}`.trim()
  const refNumber = extractTransactionRef(rawCombined)

  // Tier 1: Deterministic Bank / E-Wallet Regex
  const tier1 = parseWithBankRegex(title, text, packageName)
  if (tier1) {
    return formatParsedNotification(tier1, timestamp, id, refNumber)
  }

  // Tier 2: Token Boundary Extractor
  const tier2 = parseWithTokenBoundary(title, text)
  if (tier2) {
    return formatParsedNotification(tier2, timestamp, id, refNumber)
  }

  return null
}

function formatParsedNotification(parsed, timestamp, notifId = null, fallbackRef = null) {
  const cleanMerchant = cleanMutationMerchant(parsed.rawDescription)
  const rememberedCategory = getRememberedCategory(cleanMerchant, parsed.type)
  const matchedCategory = rememberedCategory || matchCategoryFromDescription(cleanMerchant, parsed.type)
  const defaultCategory = parsed.type === 'income' ? 'lainnya/umum' : 'lainnya_kategori/umum'
  const category = matchedCategory || defaultCategory
  const refNumber = parsed.refNumber || fallbackRef || extractTransactionRef(parsed.rawDescription)

  return {
    ...parsed,
    refNumber: refNumber || undefined,
    cleanMerchant,
    category,
    date: format(new Date(timestamp), 'yyyy-MM-dd'),
    createdAt: Number(timestamp) || Date.now(),
    notes: cleanMerchant,
    sourceNotifId: notifId || parsed.sourceNotifId || undefined,
  }
}

/**
 * Ingests all queued mutations from Android SharedPreferences into Dexie IndexedDB.
 */
export async function syncNotificationQueue(options = {}) {
  const { defaultWalletId, defaultCurrency = 'IDR', notificationAutoApprove = false } = options

  if (!Capacitor.isNativePlatform()) {
    return { syncedCount: 0, skippedDuplicates: 0 }
  }

  try {
    const res = await (FinTrackNotificationPlugin.getQueuedMutations
      ? FinTrackNotificationPlugin.getQueuedMutations()
      : FinTrackNotificationPlugin.drainQueuedMutations())
    const queuedItems = res?.mutations || []

    if (queuedItems.length === 0) {
      return { syncedCount: 0, skippedDuplicates: 0 }
    }

    let syncedCount = 0
    let skippedDuplicates = 0
    const processedIds = new Set()

    // Fetch existing transactions from recent 7 days to deduplicate
    const recentDate = format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd')
    const recentTransactions = (await db.transactions
      .where('date')
      .aboveOrEqual(recentDate)
      .toArray()).filter((tx) => !tx.deletedAt)

    if (recentTransactions.length > 0) {
      await warmupDecryptionCache(recentTransactions)
    }

    const availableWallets = await db.wallets.toArray()

    // 1. Parse all valid financial mutations & deduplicate within batch
    const parsedList = []
    const seenInBatch = new Set()

    for (const notif of queuedItems) {
      const parsed = parseFinancialNotification(notif)
      if (!parsed || parsed.amount <= 0) {
        if (notif.id) processedIds.add(notif.id)
        continue
      }

      const merchantKey = (parsed.cleanMerchant || parsed.notes || '').toLowerCase().trim()
      const timeBucket = Math.floor((parsed.createdAt || Date.now()) / (60 * 1000))
      const refKey = parsed.refNumber ? `_${parsed.refNumber}` : ''
      const batchKey = `${parsed.date}_${parsed.type}_${parsed.amount}_${parsed.institution}_${merchantKey}_${timeBucket}${refKey}`
      if (seenInBatch.has(batchKey)) {
        skippedDuplicates++
        if (notif.id) processedIds.add(notif.id)
        continue
      }

      // Deduplication check: Same date, same amount, same type, matching merchant/time window
      const isDuplicate = recentTransactions.some((existing) => {
        if (
          existing.date !== parsed.date ||
          existing.type !== parsed.type ||
          Math.abs(toSafeNumber(existing.amount) - toSafeNumber(parsed.amount)) >= 0.01
        ) {
          return false
        }

        // If both have explicit reference numbers, use them as definitive discriminator
        if (parsed.refNumber && existing.refNumber) {
          if (parsed.refNumber !== existing.refNumber) {
            return false
          }
          return true
        }

        const parsedTime = getNotificationTimestamp(parsed.createdAt)
        const existingTime = getNotificationTimestamp(existing.createdAt)
        const hasTimeWindow = parsedTime > 0 && existingTime > 0
        const isCloseInTime = hasTimeWindow && Math.abs(parsedTime - existingTime) <= 5 * 60 * 1000

        const parsedText = (parsed.cleanMerchant || parsed.notes || '').toLowerCase().trim()
        const existingPlainNotes = getDecryptedNoteSync(existing.notes)
        const existingText = (existing.cleanMerchant || existingPlainNotes || existing.description || '').toLowerCase().trim()

        const isSameMerchant = parsedText && existingText && (
          parsedText === existingText ||
          parsedText.includes(existingText) ||
          existingText.includes(parsedText)
        )

        // If both have timestamps and they are more than 5 minutes apart, legitimate separate transaction
        if (hasTimeWindow && !isCloseInTime) {
          return false
        }

        // If both have distinct merchant names that do not match, legitimate separate transaction
        if (parsedText && existingText && !isSameMerchant) {
          return false
        }

        return true
      })

      if (isDuplicate) {
        skippedDuplicates++
        if (notif.id) processedIds.add(notif.id)
        continue
      }

      seenInBatch.add(batchKey)
      parsedList.push(parsed)
    }

    // 2. Correlate internal transfers (e.g. BCA to GoPay in <= 120s)
    const { correlated } = correlateInternalTransfers(parsedList, availableWallets, { notificationAutoApprove })

    // 3. Match individual wallets & prepare insertion payload
    const toInsert = []
    const walletBalanceDeltas = new Map()

    for (const item of correlated) {
      if (item.sourceNotifId) processedIds.add(item.sourceNotifId)
      if (Array.isArray(item.sourceNotifIds)) {
        item.sourceNotifIds.forEach((id) => processedIds.add(id))
      }

      if (item.type === 'transfer') {
        toInsert.push({
          ...item,
          deletedAt: item.deletedAt !== undefined ? item.deletedAt : null,
        })
        syncedCount++

        // If fromWallet & toWallet are defined and not pending review, adjust balances
        if (!item.isPendingReview) {
          if (item.walletId) {
            const prev = walletBalanceDeltas.get(item.walletId) || 0
            walletBalanceDeltas.set(item.walletId, prev - item.amount)
          }
          if (item.targetWalletId) {
            const prev = walletBalanceDeltas.get(item.targetWalletId) || 0
            walletBalanceDeltas.set(item.targetWalletId, prev + item.amount)
          }
        }
        continue
      }

      // Single mutation: match best wallet
      const matchResult = findBestMatchingWallet(item.institution, availableWallets, item.rawDescription)
      const fallbackWallet = defaultWalletId
        ? availableWallets.find((w) => Number(w.id) === Number(defaultWalletId))
        : (availableWallets[0] || null)
      const matchedWallet = matchResult?.wallet || fallbackWallet
      let resolvedWalletId = matchedWallet?.id ? Number(matchedWallet.id) : (availableWallets[0]?.id ? Number(availableWallets[0].id) : null)

      // SAFE STAGING MODE:
      // By default (notificationAutoApprove = false), ALL auto-ingested transactions enter
      // the Staging Review Inbox (isPendingReview = true) so user balances are never altered without consent.
      // Even if notificationAutoApprove is enabled, require review if wallet is not an exact match or confidence < 0.95.
      const isExactMatch = Boolean(matchResult.wallet) && !matchResult.isAmbiguous
      const isPendingReview = !notificationAutoApprove || !isExactMatch || (item.confidence || 0) < 0.95
      const resolvedCurrency = matchedWallet?.currency || defaultCurrency

      toInsert.push({
        date: item.date,
        type: item.type,
        category: item.category,
        amount: item.amount,
        currency: resolvedCurrency,
        walletId: resolvedWalletId,
        notes: `[Auto: ${item.institution}] ${item.notes}`,
        source: 'notification_listener',
        createdAt: item.createdAt,
        isPendingReview: isPendingReview,
        suggestedInstitution: item.institution,
        cleanMerchant: item.cleanMerchant || item.notes || '',
        refNumber: item.refNumber || undefined,
        deletedAt: null,
      })

      if (resolvedWalletId && !isPendingReview) {
        const prev = walletBalanceDeltas.get(resolvedWalletId) || 0
        const delta = item.type === 'income' ? item.amount : -item.amount
        walletBalanceDeltas.set(resolvedWalletId, prev + delta)
      }

      syncedCount++
    }

    if (toInsert.length > 0) {
      for (const tx of toInsert) {
        if (tx.notes && typeof tx.notes === 'string' && tx.notes.trim()) {
          tx.notes = await encryptField(tx.notes)
        }
      }
      const insertedIds = await db.transactions.bulkAdd(toInsert, { allKeys: true })

      // Invalidate balance cache so dynamic computeWalletBalance immediately reflects inserted transactions
      const affectedWalletIds = Array.from(walletBalanceDeltas.keys()).map(Number).filter(Boolean)
      if (affectedWalletIds.length > 0) {
        await invalidateWalletBalance(affectedWalletIds)
      }
      clearCachedDashboardState()
      scheduleNativeWidgetSync()

      if (typeof window !== 'undefined') {
        import('../store/useSettingsStore').then((m) => {
          m.default.getState().incrementUnviewedMutations(syncedCount)
        })
        window.dispatchEvent(
          new CustomEvent('ft-show-toast', {
            detail: {
              title: 'Mutasi Bank Diterima',
              message: `${syncedCount} transaksi baru dicatat dan siap ditinjau.`,
              route: '/transactions',
              type: 'recurring',
            },
          })
        )
      }

      // Asynchronously trigger AI background enrichment for unclassified mutations
      if (Array.isArray(insertedIds) && insertedIds.length > 0) {
        enrichPendingMutationsWithAi(insertedIds).catch((err) =>
          console.warn('[syncNotificationQueue:enrichPendingMutationsWithAi]', err)
        )
      }
    }

    // Two-Phase Handshake: Acknowledge processed IDs so native queue removes only successfully processed/filtered items
    if (processedIds.size > 0 && FinTrackNotificationPlugin.acknowledgeQueuedMutations) {
      try {
        await FinTrackNotificationPlugin.acknowledgeQueuedMutations({
          ids: Array.from(processedIds),
        })
      } catch (ackErr) {
        console.warn('[syncNotificationQueue:acknowledgeQueuedMutations]', ackErr)
      }
    } else if (FinTrackNotificationPlugin.clearQueuedMutations) {
      await FinTrackNotificationPlugin.clearQueuedMutations()
    }

    return { syncedCount, skippedDuplicates }
  } catch (err) {
    console.error('Error syncing notification queue:', err)
    return { syncedCount: 0, skippedDuplicates: 0, error: err.message }
  }
}

/**
 * Scans historical SMS inbox for banking transactions and streams them to staging review inbox.
 */
export async function syncHistoricalSms(options = {}) {
  const { days = 30 } = options

  if (!Capacitor.isNativePlatform() && !options.force && !options.mockMutations) {
    return { syncedCount: 0, skippedDuplicates: 0 }
  }

  try {
    let items = options.mockMutations || []
    if (!options.mockMutations && FinTrackNotificationPlugin.scanHistoricalSms) {
      const res = await FinTrackNotificationPlugin.scanHistoricalSms({ days })
      items = res?.mutations || []
    }

    if (items.length === 0) {
      return { syncedCount: 0, skippedDuplicates: 0 }
    }

    let skippedDuplicates = 0

    const cutoffDate = format(new Date(Date.now() - days * 86400000), 'yyyy-MM-dd')
    const existingTransactions = (await db.transactions
      .where('date')
      .aboveOrEqual(cutoffDate)
      .toArray()).filter((tx) => !tx.deletedAt)

    const availableWallets = await db.wallets.toArray()
    const toInsert = []

    for (const item of items) {
      const parsed = (item.institution && item.amount) ? item : parseFinancialNotification(item)
      if (!parsed || parsed.amount <= 0) continue

      const parsedDate = parsed.date || (item.date ? String(item.date).slice(0, 10) : format(new Date(item.createdAt || item.timestamp || Date.now()), 'yyyy-MM-dd'))

      // Deduplication check: handle dates with mixed formats using (tx.date || '').slice(0, 10) === parsedDate
      const isAlreadyInTx = existingTransactions.some((tx) =>
        (tx.date || '').slice(0, 10) === parsedDate &&
        tx.type === parsed.type &&
        Math.abs(toSafeNumber(tx.amount) - toSafeNumber(parsed.amount)) < 0.01
      )
      const isAlreadyInBatch = toInsert.some((b) =>
        (b.date || '').slice(0, 10) === parsedDate &&
        b.type === parsed.type &&
        Math.abs(toSafeNumber(b.amount) - toSafeNumber(parsed.amount)) < 0.01
      )

      if (isAlreadyInTx || isAlreadyInBatch) {
        skippedDuplicates++
        continue
      }

      const institution = item.institution || parsed.institution || ''
      const notesText = item.notes || parsed.notes || parsed.cleanMerchant || ''
      const cleanMerchant = item.cleanMerchant || parsed.cleanMerchant || notesText || ''
      const rawDescription = item.rawDescription || parsed.rawDescription || (item.text ? `${item.title || ''} ${item.text}` : '')

      const matchResult = findBestMatchingWallet(institution, availableWallets, rawDescription)
      const resolvedWalletId = matchResult?.wallet?.id ? Number(matchResult.wallet.id) : (availableWallets[0]?.id ? Number(availableWallets[0].id) : null)
      const resolvedCurrency = matchResult?.wallet?.currency || parsed.currency || 'IDR'

      toInsert.push({
        date: parsedDate,
        type: parsed.type,
        category: parsed.category,
        amount: parsed.amount,
        currency: resolvedCurrency,
        walletId: resolvedWalletId,
        notes: `[SMS: ${institution}] ${notesText}`.trim(),
        source: 'sms_history',
        createdAt: parsed.createdAt || item.createdAt || item.timestamp || Date.now(),
        isPendingReview: true,
        suggestedInstitution: institution,
        cleanMerchant: cleanMerchant,
        deletedAt: null,
      })
    }

    let syncedCount = 0
    if (toInsert.length > 0) {
      const insertedIds = await db.transactions.bulkAdd(toInsert, { allKeys: true })
      syncedCount = toInsert.length

      try {
        const { default: useSettingsStore } = await import('../store/useSettingsStore')
        useSettingsStore.getState().incrementUnviewedMutations(syncedCount)
      } catch (storeErr) {
        console.error('[syncHistoricalSms:incrementUnviewedMutations]', storeErr)
      }

      if (Array.isArray(insertedIds) && insertedIds.length > 0) {
        enrichPendingMutationsWithAi(insertedIds).catch((aiErr) =>
          console.warn('[syncHistoricalSms:enrichPendingMutationsWithAi]', aiErr)
        )
      }
    }

    return { syncedCount, skippedDuplicates }
  } catch (err) {
    console.error('[syncHistoricalSms]', err)
    return { syncedCount: 0, skippedDuplicates: 0, error: err.message }
  }
}

/**
 * Retrieves custom packages configured in Native SharedPreferences.
 */
export async function getWhitelistedPackages() {
  if (!Capacitor.isNativePlatform() || !FinTrackNotificationPlugin.getCustomPackages) {
    return { packages: [] }
  }
  try {
    return await FinTrackNotificationPlugin.getCustomPackages()
  } catch (err) {
    console.warn('[getWhitelistedPackages]', err)
    return { packages: [] }
  }
}

/**
 * Updates custom whitelisted packages in Native SharedPreferences.
 */
export async function updateCustomPackages(packages = []) {
  if (!Capacitor.isNativePlatform() || !FinTrackNotificationPlugin.updateCustomPackages) {
    return { success: true, count: packages.length }
  }
  try {
    return await FinTrackNotificationPlugin.updateCustomPackages({ packages })
  } catch (err) {
    console.error('[updateCustomPackages]', err)
    return { success: false, error: err.message }
  }
}
