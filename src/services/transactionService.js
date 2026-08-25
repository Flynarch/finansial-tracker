import { db } from '../lib/db'
import { formatExpenseCategory } from '../lib/expenseCategories'
import { isExcludeAnalyticsTx, convertCurrency } from '../lib/utils'
import { getCachedCurrencyRates } from '../lib/api'
import { checkBudgetAlertsAfterExpense } from '../lib/smartNotifications'
import { invalidateWalletBalance } from '../lib/balanceEngine'

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
      : new Date().toISOString().split('T')[0]

  const rawAmount = Number(payload?.amount || 0)
  const cleanAmount = payload?.type === 'balance_adjustment' ? rawAmount : Math.abs(rawAmount)

  if (payload?.type !== 'balance_adjustment' && (!Number.isFinite(cleanAmount) || cleanAmount <= 0)) {
    throw new Error('Nominal transaksi harus lebih dari 0.')
  }

  const cleanCreatedAt = Number.isFinite(Number(payload?.createdAt))
    ? Number(payload.createdAt)
    : Date.now()

  const createdId = await db.transactions.add({
    ...dataWithoutId,
    date: cleanDate,
    amount: cleanAmount,
    createdAt: cleanCreatedAt,
  })

  // Invalidate balance cache for affected wallets
  const affectedWallets = [payload?.walletId, payload?.targetWalletId].filter(Boolean)
  if (affectedWallets.length > 0) {
    void invalidateWalletBalance(affectedWallets)
  }

  // Auto-check budget for new expenses
  if (payload?.type === 'expense' && cleanAmount > 0 && cleanDate) {
    try {
      const txMonth = String(payload.date).substring(0, 7) // "YYYY-MM"
      const txCategory = String(payload.category || '')
      const parentCategory = txCategory.includes('/') ? txCategory.split('/')[0] : txCategory

      const budgets = await db.budgets.where({ month: txMonth }).toArray()
      const matchingBudgets = budgets.filter(
        (b) => b.category === txCategory || b.category === parentCategory
      )

      if (matchingBudgets.length > 0) {
        const monthTxs = await db.transactions
          .filter(
            (t) =>
              typeof t.date === 'string' &&
              t.date.startsWith(txMonth) &&
              t.type === 'expense' &&
              !isExcludeAnalyticsTx(t)
          )
          .toArray()

        const rates = getCachedCurrencyRates('USD')
        for (const b of matchingBudgets) {
          let spent = 0
          for (const t of monthTxs) {
            const tCat = String(t.category || '')
            const tParent = tCat.includes('/') ? tCat.split('/')[0] : tCat
            if (b.category === tCat || b.category === tParent) {
              const txAmt = convertCurrency(t.amount, t.currency || b.currency || 'IDR', b.currency || 'IDR', rates)
              spent += Number(txAmt || 0)
            }
          }

          const limit = Number(b.limit ?? b.amount ?? 0)
          if (limit > 0) {
            const pct = (spent / limit) * 100
            if (pct >= 80) {
              const isDanger = pct >= 100
              const catLabel = formatExpenseCategory(b.category)
              const title = isDanger ? 'Budget Jebol!' : 'Peringatan Budget'
              const message = isDanger
                ? `Pengeluaran kategori ${catLabel} melebihi batas anggaran (${Math.round(pct)}%).`
                : `Pengeluaran kategori ${catLabel} hampir habis (${Math.round(pct)}%).`

              const recentNotifs = await db.notifications
                .orderBy('createdAt')
                .reverse()
                .limit(10)
                .toArray()

              const alreadyNotified = recentNotifs.some(
                (n) =>
                  n.title === title &&
                  n.message === message &&
                  Date.now() - n.createdAt < 24 * 3600 * 1000
              )

              if (!alreadyNotified) {
                await db.notifications.add({
                  title,
                  message,
                  type: isDanger ? 'alert' : 'warning',
                  isRead: 0,
                  createdAt: Date.now(),
                })
              }
            }
          }
        }
      }

      // Fire Native / Browser Push Notification
      await checkBudgetAlertsAfterExpense({
        category: payload.category,
        amount: payload.amount,
        date: payload.date,
      }).catch(() => {})
    } catch (e) {
      console.error('Failed to check budget:', e)
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

  if (fields?.amount !== undefined) {
    const raw = Number(fields.amount)
    if (fields?.type !== 'balance_adjustment' && (!Number.isFinite(raw) || raw <= 0)) {
      throw new Error('Nominal transaksi harus lebih dari 0.')
    }
  }
  
  const existing = await db.transactions.get(cleanId)
  const result = await db.transactions.update(cleanId, fields)
  
  const affectedWallets = [
    existing?.walletId,
    existing?.targetWalletId,
    fields?.walletId,
    fields?.targetWalletId,
  ].filter(Boolean)
  if (affectedWallets.length > 0) {
    void invalidateWalletBalance(affectedWallets)
  }
  
  return result
}

/**
 * Deletes a transaction by ID.
 *
 * @param {number} id - Transaction ID
 * @returns {Promise<void>}
 */
export async function deleteTransaction(id) {
  const cleanId = Number(id)
  if (!cleanId) throw new Error('Invalid transaction ID')
  
  const existing = await db.transactions.get(cleanId)
  await db.transactions.delete(cleanId)
  
  const affectedWallets = [existing?.walletId, existing?.targetWalletId].filter(Boolean)
  if (affectedWallets.length > 0) {
    void invalidateWalletBalance(affectedWallets)
  }
}
