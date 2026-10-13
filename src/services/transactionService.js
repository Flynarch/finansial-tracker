import { format } from 'date-fns'
import Dexie from 'dexie'
import { db } from '../lib/db'
import { convertCurrency, roundCurrency } from '../lib/utils'
import { getCachedCurrencyRates } from '../lib/api'
import { checkBudgetAlertsAfterExpense } from '../lib/smartNotifications'
import { invalidateWalletBalance } from '../lib/balanceEngine'
import { getLocalDateString } from '../lib/dateUtils'
import useSettingsStore from '../store/useSettingsStore'
import { scheduleNativeWidgetSync } from '../lib/nativeWidgetSync'
import { AppError, transformDbError } from '../lib/errors'
import { rememberTransactionEntity, updateEntityMemory, forgetTransactionEntity } from '../lib/ai/entityMemory'
import { encryptField, decryptField, getDecryptedNoteSync, warmupDecryptionCache } from '../lib/fieldEncryption'
import {
  validateTalanganParentUpdate,
  syncLoanOnUpdate,
  syncInvestmentOnUpdate,
  syncGoalOnUpdate,
  validateTalanganParentDelete,
  syncLoanOnDelete,
  syncGoalOnDelete,
  syncInvestmentOnDelete,
} from './transactionSyncHelpers'

export { AppError, transformDbError, getDecryptedNoteSync, warmupDecryptionCache }

/**
 * Creates a new transaction and handles post-creation side effects (e.g. budget alerts).
 *
 * @param {object} payload - Transaction data
 * @returns {Promise<number>} - ID of the created transaction
 */
export async function createTransaction(payload) {
  const dataWithoutId = { ...payload }
  delete dataWithoutId.id

  const cleanDate =
    typeof payload?.date === 'string' && payload.date.trim()
      ? payload.date.trim()
      : getLocalDateString()

  const rawAmount = Number(payload?.amount || 0)
  const cleanAmount =
    payload?.type === 'balance_adjustment'
      ? roundCurrency(rawAmount)
      : roundCurrency(Math.abs(rawAmount))

  if (payload?.type !== 'balance_adjustment' && (!Number.isFinite(cleanAmount) || cleanAmount <= 0)) {
    throw new Error('Nominal transaksi harus lebih dari 0.')
  }

  let resolvedWalletId = payload?.walletId
  if (!resolvedWalletId) {
    const defaultWalletId = useSettingsStore.getState?.()?.defaultWalletId
    if (defaultWalletId) {
      resolvedWalletId = defaultWalletId
    } else {
      throw new Error('Dompet wajib dipilih.')
    }
  }

  let srcWallet = null
  if (resolvedWalletId) {
    srcWallet = await db.wallets.get(Number(resolvedWalletId))
    if (srcWallet?.isArchived) {
      throw new Error('Dompet asal tidak valid atau sudah diarsipkan.')
    }
  }

  if (payload?.type === 'transfer') {
    if (!payload?.targetWalletId || String(payload.targetWalletId) === String(resolvedWalletId)) {
      throw new Error('Dompet tujuan transfer wajib dipilih dan harus berbeda dengan dompet asal.')
    }
    if (!srcWallet || srcWallet.isArchived) {
      throw new Error('Dompet asal tidak valid atau sudah diarsipkan.')
    }
    const tgtWallet = await db.wallets.get(Number(payload.targetWalletId))
    if (!tgtWallet || tgtWallet.isArchived) {
      throw new Error('Dompet tujuan transfer tidak valid atau sudah diarsipkan.')
    }
  }

  const cleanCreatedAt = Number.isFinite(Number(payload?.createdAt))
    ? Number(payload.createdAt)
    : Date.now()

  const sanitizedTargetWalletId = payload?.type === 'transfer' ? (payload?.targetWalletId ?? null) : null

  let cleanCurrency = payload?.currency
  if (!cleanCurrency && resolvedWalletId) {
    if (srcWallet?.currency) {
      cleanCurrency = srcWallet.currency
    } else {
      try {
        const fetchedWallet = await db.wallets.get(Number(resolvedWalletId))
        if (fetchedWallet?.currency) {
          cleanCurrency = fetchedWallet.currency
        }
      } catch (err) {
        console.error('[createTransaction:getWalletCurrency]', err)
      }
    }
  }

  const cleanWalletId = Number(resolvedWalletId)
  const cleanTargetWalletId = sanitizedTargetWalletId ? Number(sanitizedTargetWalletId) : null

  if (dataWithoutId.notes && typeof dataWithoutId.notes === 'string' && dataWithoutId.notes.trim()) {
    const encP = encryptField(dataWithoutId.notes)
    dataWithoutId.notes = Dexie.currentTransaction ? await Dexie.waitFor(encP) : await encP
  }

  if (Array.isArray(dataWithoutId.splitItems) && dataWithoutId.splitItems.length > 0) {
    const encryptedSplitItems = []
    for (const item of dataWithoutId.splitItems) {
      if (item && item.notes && typeof item.notes === 'string' && item.notes.trim()) {
        const encP = encryptField(item.notes)
        const encNote = Dexie.currentTransaction ? await Dexie.waitFor(encP) : await encP
        encryptedSplitItems.push({ ...item, notes: encNote })
      } else {
        encryptedSplitItems.push(item)
      }
    }
    dataWithoutId.splitItems = encryptedSplitItems
  }

  const isTransfer = dataWithoutId.type === 'transfer'

  let createdId
  try {
    await db.transaction('rw', [db.transactions], async () => {
      createdId = await db.transactions.add({
        ...dataWithoutId,
        walletId: cleanWalletId,
        currency: cleanCurrency || 'IDR',
        date: cleanDate,
        amount: cleanAmount,
        createdAt: cleanCreatedAt,
        targetWalletId: isTransfer ? cleanTargetWalletId : null,
        targetAmount: isTransfer ? dataWithoutId.targetAmount : null,
        targetCurrency: isTransfer ? dataWithoutId.targetCurrency : null,
        deletedAt: null,
      })
    })
  } catch (err) {
    console.error('[transactionService:createTransaction]', err)
    throw transformDbError(err, 'createTransaction')
  }

  // Invalidate balance cache for affected wallets
  const affectedWallets = [cleanWalletId, cleanTargetWalletId].filter(Boolean)
  if (affectedWallets.length > 0) {
    await invalidateWalletBalance(affectedWallets)
  }

  // Auto-check budget for new expenses
  if (payload?.type === 'expense' && cleanAmount > 0 && cleanDate) {
    try {
      if (payload.isSplit && Array.isArray(payload.splitItems) && payload.splitItems.length > 0) {
        for (const item of payload.splitItems) {
          const itemType = item.type || payload.type
          if (itemType === 'expense' && item.category) {
            await checkBudgetAlertsAfterExpense({
              category: item.category,
              amount: Number(item.amount) || 0,
              date: cleanDate,
            }).catch((err) => console.error('[transactionService:checkBudget]', err))
          }
        }
      } else {
        await checkBudgetAlertsAfterExpense({
          category: payload.category,
          amount: cleanAmount,
          date: cleanDate,
        }).catch((err) => console.error('[transactionService:checkBudget]', err))
      }
    } catch (e) {
      console.error('[transactionService:checkBudget]', e)
    }
  }

  scheduleNativeWidgetSync()

  if (payload?.type !== 'transfer' && (payload?.notes || payload?.merchant)) {
    try {
      rememberTransactionEntity({
        notes: payload.notes,
        category: payload.category,
        amount: cleanAmount,
        walletId: cleanWalletId,
        merchant: payload.merchant,
      })
    } catch (e) {
      console.warn('[transactionService:rememberEntity]', e)
    }
  }

  return createdId
}

/**
 * Updates an existing transaction by ID.
 *
 * @param {number} id - Transaction ID
 * @param {object} fields - Updated fields
 * @returns {Promise<number>} - 1 if updated
 */
export async function updateTransaction(id, fields) {
  const cleanId = Number(id)
  if (!cleanId) throw new Error('Invalid transaction ID')

  const existingRaw = await db.transactions.get(cleanId)
  if (!existingRaw) return 0
  let decryptedExistingNotes = existingRaw.notes
  if (existingRaw.notes && typeof existingRaw.notes === 'string') {
    const decP = decryptField(existingRaw.notes)
    decryptedExistingNotes = Dexie.currentTransaction ? await Dexie.waitFor(decP) : await decP
  }
  const existing = {
    ...existingRaw,
    notes: decryptedExistingNotes,
  }

  let encryptedNotes = fields?.notes
  if (fields?.notes !== undefined && fields?.notes !== null) {
    if (typeof fields.notes === 'string' && fields.notes.trim()) {
      const encP = encryptField(fields.notes)
      encryptedNotes = Dexie.currentTransaction ? await Dexie.waitFor(encP) : await encP
    } else {
      encryptedNotes = fields.notes
    }
  }

  let encryptedSplitItems = fields?.splitItems
  if (Array.isArray(fields?.splitItems) && fields.splitItems.length > 0) {
    const encList = []
    for (const item of fields.splitItems) {
      if (item && item.notes && typeof item.notes === 'string' && item.notes.trim()) {
        const encP = encryptField(item.notes)
        const encNote = Dexie.currentTransaction ? await Dexie.waitFor(encP) : await encP
        encList.push({ ...item, notes: encNote })
      } else {
        encList.push(item)
      }
    }
    encryptedSplitItems = encList
  }

  const effectiveType = fields?.type ?? existing.type
  if (fields?.walletId !== undefined && !fields.walletId) {
    throw new Error('Dompet wajib dipilih.')
  }

  if (fields?.amount !== undefined) {
    const raw = Number(fields.amount)
    if (effectiveType !== 'balance_adjustment' && (!Number.isFinite(raw) || raw <= 0)) {
      throw new Error('Nominal transaksi harus lebih dari 0.')
    }
  }

  if (effectiveType === 'transfer') {
    const effectiveWalletId = fields?.walletId !== undefined ? fields.walletId : existing.walletId
    const effectiveTargetWalletId = fields?.targetWalletId !== undefined ? fields.targetWalletId : existing.targetWalletId
    if (!effectiveTargetWalletId || String(effectiveTargetWalletId) === String(effectiveWalletId)) {
      throw new Error('Dompet tujuan transfer wajib dipilih dan harus berbeda dengan dompet asal.')
    }
    const [srcWallet, tgtWallet] = await Promise.all([
      db.wallets.get(Number(effectiveWalletId)),
      db.wallets.get(Number(effectiveTargetWalletId)),
    ])
    if (!srcWallet || srcWallet.isArchived) {
      throw new Error('Dompet asal tidak valid atau sudah diarsipkan.')
    }
    if (!tgtWallet || tgtWallet.isArchived) {
      throw new Error('Dompet tujuan transfer tidak valid atau sudah diarsipkan.')
    }
  }

  const extraAffectedWallets = []

  try {
    await db.transaction('rw', [db.transactions, db.loans, db.loanPayments, db.goals, db.goalLogs, db.investments, db.investmentOrders], async () => {
    const defaultCurrency = useSettingsStore.getState?.()?.defaultCurrency || 'IDR'
    const rates = getCachedCurrencyRates('USD')
    const oldAmt = Number(existing.amount) || 0
    const newAmt = fields.amount !== undefined ? Number(fields.amount) : oldAmt
    const oldCurrency = existing.currency || defaultCurrency
    const newCurrency = fields.currency || existing.currency || defaultCurrency

    // 1. Guard: Parent Split Bill Transaction Update (talangan / fronted transaction only)
    await validateTalanganParentUpdate({
      existing,
      newAmt,
      newCurrency,
      defaultCurrency,
      rates,
    })

    // 2. Synchronize linked loan & loan payment record if applicable
    await syncLoanOnUpdate({
      existing,
      cleanId,
      newAmt,
      newCurrency,
      oldAmt,
      oldCurrency,
      fields,
      defaultCurrency,
      rates,
      extraAffectedWallets,
    })

    // Synchronize linked investment & investment orders if applicable
    await syncInvestmentOnUpdate({ existing, cleanId, fields })

    // 3. Synchronize linked savings goal & goal logs if applicable
    await syncGoalOnUpdate({
      existing,
      cleanId,
      newAmt,
      newCurrency,
      oldAmt,
      oldCurrency,
      fields,
      defaultCurrency,
      rates,
    })

      // Sanitize fields before writing
      const sanitizedFields = { ...fields }
      delete sanitizedFields.id
      if (sanitizedFields.amount !== undefined) {
        const raw = Number(sanitizedFields.amount)
        sanitizedFields.amount =
          effectiveType === 'balance_adjustment' ? roundCurrency(raw) : roundCurrency(Math.abs(raw))
      }
      if (sanitizedFields.walletId !== undefined) {
        sanitizedFields.walletId = Number(sanitizedFields.walletId)
      }
      if (sanitizedFields.targetWalletId !== undefined) {
        sanitizedFields.targetWalletId = sanitizedFields.targetWalletId ? Number(sanitizedFields.targetWalletId) : null
      }
      if (sanitizedFields.targetAmount !== undefined && sanitizedFields.targetAmount !== null) {
        const num = Number(sanitizedFields.targetAmount)
        sanitizedFields.targetAmount = Number.isFinite(num) && num > 0 ? roundCurrency(num) : null
      }
      if (effectiveType !== 'transfer') {
        sanitizedFields.targetWalletId = null
        sanitizedFields.targetAmount = null
        sanitizedFields.targetCurrency = null
      } else if (sanitizedFields.targetAmount !== undefined && !sanitizedFields.targetAmount) {
        sanitizedFields.targetAmount = null
      }
      if (sanitizedFields.notes !== undefined) {
        sanitizedFields.notes = encryptedNotes
      }
      if (
        fields?.isSplit === false ||
        sanitizedFields.isSplit === false ||
        fields?.isSplit === 0 ||
        sanitizedFields.isSplit === 0 ||
        (sanitizedFields.isSplit !== undefined && !sanitizedFields.isSplit)
      ) {
        sanitizedFields.splitItems = null
      } else if (encryptedSplitItems !== undefined) {
        sanitizedFields.splitItems = encryptedSplitItems
      }

      await db.transactions.update(cleanId, sanitizedFields)
    })
  } catch (err) {
    console.error('[transactionService:updateTransaction]', err)
    throw transformDbError(err, 'updateTransaction')
  }

  const affectedWallets = [
    existing?.walletId,
    existing?.targetWalletId,
    fields?.walletId,
    fields?.targetWalletId,
    ...extraAffectedWallets,
  ].filter(Boolean)
  if (affectedWallets.length > 0) {
    await invalidateWalletBalance(affectedWallets)
  }

  scheduleNativeWidgetSync()

  if (existing) {
    try {
      const merged = { ...existing, ...fields }
      if (merged.type !== 'transfer' && (merged.notes || merged.merchant)) {
        updateEntityMemory(existing, merged)
      }
    } catch (e) {
      console.warn('[transactionService:updateEntityMemory]', e)
    }
  }

  return 1
}

/**
 * Soft-deletes a transaction by ID and handles ledger reversal side effects.
 *
 * @param {number} id - Transaction ID
 * @returns {Promise<void>}
 */
export async function deleteTransaction(id) {
  const cleanId = Number(id)
  if (!cleanId) throw new Error('Invalid transaction ID')

  const existingRaw = await db.transactions.get(cleanId)
  if (!existingRaw) return
  let decryptedExistingNotes = existingRaw.notes
  if (existingRaw.notes && typeof existingRaw.notes === 'string') {
    const decP = decryptField(existingRaw.notes)
    decryptedExistingNotes = Dexie.currentTransaction ? await Dexie.waitFor(decP) : await decP
  }
  const existing = {
    ...existingRaw,
    notes: decryptedExistingNotes,
  }

  const extraAffectedWallets = []

  try {
    await db.transaction('rw', [db.transactions, db.loans, db.loanPayments, db.goals, db.goalLogs, db.investments, db.investmentOrders], async () => {
      const defaultCurrency = useSettingsStore.getState?.()?.defaultCurrency || 'IDR'
      const rates = getCachedCurrencyRates('USD')

      // 1. Guard: Parent Split Bill Transaction Deletion (talangan / fronted transaction only)
      await validateTalanganParentDelete({ existing })

      // 2. If transaction is linked to a loan, synchronize remaining amount and payment records
      await syncLoanOnDelete({ existing, cleanId, defaultCurrency, rates, extraAffectedWallets })

      // 3. Savings Goal Ledger Reversal on Transaction Deletion
      await syncGoalOnDelete({ existing, cleanId, defaultCurrency, rates })

      // 4. Investment Holding Reversal on Transaction Deletion
      await syncInvestmentOnDelete({ existing, defaultCurrency })

      // 5. Soft-delete transaction from ledger and immediately release Base64 receipt memory
      await db.transactions.update(cleanId, {
        deletedAt: Date.now(),
        receiptImage: null,
      })
    })
  } catch (err) {
    console.error('[transactionService:deleteTransaction]', err)
    throw transformDbError(err, 'deleteTransaction')
  }

  const affectedWallets = [existing?.walletId, existing?.targetWalletId, ...extraAffectedWallets].filter(Boolean)
  if (affectedWallets.length > 0) {
    await invalidateWalletBalance(affectedWallets)
  }

  scheduleNativeWidgetSync()

  if (existing && existing.type !== 'transfer' && (existing.notes || existing.merchant)) {
    try {
      forgetTransactionEntity(existing)
    } catch (e) {
      console.warn('[transactionService:forgetEntity]', e)
    }
  }
}

/**
 * Purges transactions soft-deleted more than `retentionDays` days ago.
 *
 * @param {number} [retentionDays=90]
 * @returns {Promise<number>} Number of transactions permanently purged
 */
export async function purgeOldSoftDeletedTransactions(retentionDays = 90) {
  try {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
    let candidates
    try {
      candidates = await db.transactions
        .where('deletedAt')
        .between(1, cutoff, true, true)
        .toArray()
    } catch (err) {
      console.error('[TransactionService.purgeDeletedTransactions] Index query failed, using filter fallback:', err)
      candidates = await db.transactions
        .filter((tx) => tx.deletedAt && Number(tx.deletedAt) < cutoff)
        .toArray()
    }
    if (candidates && candidates.length > 0) {
      await db.transactions.bulkDelete(candidates.map((tx) => tx.id))
    }
    return candidates ? candidates.length : 0
  } catch (err) {
    console.error('[purgeOldSoftDeletedTransactions]', err)
    throw transformDbError(err, 'purgeOldSoftDeletedTransactions')
  }
}

/**
 * Retrieves a transaction by ID and transparently decrypts its sensitive notes field.
 *
 * @param {number|string} id - Transaction ID
 * @returns {Promise<object|null>} The transaction object with decrypted notes, or null if not found
 */
export async function getTransaction(id) {
  const cleanId = Number(id)
  if (!cleanId) return null

  const tx = await db.transactions.get(cleanId)
  if (!tx) return null

  if (tx.notes && typeof tx.notes === 'string') {
    const decryptedNotes = await decryptField(tx.notes)
    return {
      ...tx,
      notes: decryptedNotes,
    }
  }

  return tx
}
