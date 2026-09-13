import { format } from 'date-fns'
import { db } from '../lib/db'
import { formatExpenseCategory } from '../lib/expenseCategories'
import { isExcludeAnalyticsTx } from '../lib/utils'
import { getCachedCurrencyRates } from '../lib/api'
import { checkBudgetAlertsAfterExpense } from '../lib/smartNotifications'
import { invalidateWalletBalance } from '../lib/balanceEngine'
import { getLocalDateString } from '../lib/dateUtils'
import useSettingsStore from '../store/useSettingsStore'
import { getBudgetPeriodDateRange, calculateBudgetSpent } from '../lib/budgetUtils'

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
  const cleanAmount = payload?.type === 'balance_adjustment' ? rawAmount : Math.abs(rawAmount)

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

  if (payload?.type === 'transfer') {
    if (!payload?.targetWalletId || String(payload.targetWalletId) === String(resolvedWalletId)) {
      throw new Error('Dompet tujuan transfer wajib dipilih dan harus berbeda dengan dompet asal.')
    }
  }

  const cleanCreatedAt = Number.isFinite(Number(payload?.createdAt))
    ? Number(payload.createdAt)
    : Date.now()

  const sanitizedTargetWalletId = payload?.type === 'transfer' ? (payload?.targetWalletId ?? null) : null

  let cleanCurrency = payload?.currency
  if (!cleanCurrency && resolvedWalletId) {
    try {
      const srcWallet = await db.wallets.get(Number(resolvedWalletId))
      if (srcWallet?.currency) {
        cleanCurrency = srcWallet.currency
      }
    } catch {
      // Ignore
    }
  }

  const cleanWalletId = Number(resolvedWalletId)
  const cleanTargetWalletId = sanitizedTargetWalletId ? Number(sanitizedTargetWalletId) : null

  const createdId = await db.transactions.add({
    ...dataWithoutId,
    walletId: cleanWalletId,
    currency: cleanCurrency || 'IDR',
    date: cleanDate,
    amount: cleanAmount,
    createdAt: cleanCreatedAt,
    targetWalletId: cleanTargetWalletId,
  })

  // Invalidate balance cache for affected wallets
  const affectedWallets = [cleanWalletId, cleanTargetWalletId].filter(Boolean)
  if (affectedWallets.length > 0) {
    void invalidateWalletBalance(affectedWallets)
  }

  // Auto-check budget for new expenses
  if (payload?.type === 'expense' && cleanAmount > 0 && cleanDate) {
    try {
      const budgetCycleStartDay = useSettingsStore.getState?.()?.budgetCycleStartDay || 1
      let txMonth = cleanDate.substring(0, 7) // "YYYY-MM"
      if (budgetCycleStartDay > 1) {
        const [y, m, d] = cleanDate.split('-').map(Number)
        if (d >= budgetCycleStartDay) {
          const nextMonthDate = new Date(y, m, 1)
          txMonth = format(nextMonthDate, 'yyyy-MM')
        }
      }
      const budgetPeriod = getBudgetPeriodDateRange(txMonth, budgetCycleStartDay)
      const txCategory = String(payload.category || '')
      const parentCategory = txCategory.includes('/') ? txCategory.split('/')[0] : txCategory

      const budgets = await db.budgets.where({ month: txMonth }).toArray()
      const matchingBudgets = budgets.filter(
        (b) => b.category === txCategory || b.category === parentCategory || b.category === 'all'
      )

      if (matchingBudgets.length > 0) {
        const monthTxs = await db.transactions
          .filter(
            (t) =>
              typeof t.date === 'string' &&
              t.date >= budgetPeriod.startDate &&
              t.date <= budgetPeriod.endDate &&
              t.type === 'expense' &&
              !isExcludeAnalyticsTx(t)
          )
          .toArray()

        const rates = getCachedCurrencyRates('USD')
        for (const b of matchingBudgets) {
          const spent = calculateBudgetSpent(b.category, monthTxs, b.currency || 'IDR', rates)
          const limit = Number(b.limit ?? b.amount ?? 0)
          if (limit > 0) {
            const pct = (spent / limit) * 100
            if (pct >= 80) {
              const isDanger = pct >= 100
              const catLabel = b.category === 'all' ? 'Total Anggaran' : formatExpenseCategory(b.category)
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
                  read: false,
                  isRead: 0,
                  route: '/budget',
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
        amount: cleanAmount,
        date: cleanDate,
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

  const existing = await db.transactions.get(cleanId)
  if (!existing) return 0

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
  }

  await db.transaction('rw', [db.transactions, db.loans, db.loanPayments, db.goals, db.goalLogs], async () => {
    const oldAmt = Number(existing.amount) || 0
    const newAmt = fields.amount !== undefined ? Number(fields.amount) : oldAmt

    // 1. Guard: Parent Split Bill Transaction Update
    if (existing.splitBillId) {
      const linkedLoans = await db.loans.where('splitBillId').equals(existing.splitBillId).toArray()
      const activeParticipantLoans = linkedLoans.filter(
        (l) => l.status !== 'paid' && l.status !== 'forgiven' && (Number(l.remainingAmount) || 0) > 0,
      )
      const activeLoansSum = activeParticipantLoans.reduce(
        (sum, l) => sum + (Number(l.remainingAmount) || 0),
        0,
      )
      if (newAmt < activeLoansSum) {
        throw new Error('Nominal transaksi talangan tidak boleh lebih kecil dari sisa pinjaman aktif partisipan.')
      }
    }

    // 2. Synchronize linked loan & loan payment record if applicable
    if (existing.loanId) {
      const loan = await db.loans.get(existing.loanId)
      if (loan) {
        const payment = await db.loanPayments.where('transactionId').equals(cleanId).first()
        if (payment) {
          const delta = newAmt - oldAmt
          const newRemaining = Math.max(0, Math.min(loan.totalAmount, (Number(loan.remainingAmount) || 0) - delta))
          const isNowActive = newRemaining > 0

          await db.loanPayments.update(payment.id, {
            amount: newAmt,
            ...(fields.date ? { date: fields.date } : {}),
            ...(fields.notes !== undefined ? { notes: fields.notes } : {}),
          })

          await db.loans.update(loan.id, {
            remainingAmount: newRemaining,
            status: isNowActive
              ? newRemaining >= loan.totalAmount
                ? 'active'
                : 'partially_paid'
              : 'paid',
            ...(isNowActive
              ? { paidDate: null, paidAt: null }
              : { paidDate: fields.date || existing.date, paidAt: Date.now() }),
          })
        } else if (loan.initialTransactionId === cleanId && loan.status === 'active') {
          if (newAmt !== oldAmt) {
            const delta = newAmt - oldAmt
            const newTotal = Math.max(0, (Number(loan.totalAmount) || 0) + delta)
            const newRemaining = Math.max(0, (Number(loan.remainingAmount) || 0) + delta)
            await db.loans.update(loan.id, {
              totalAmount: newTotal,
              remainingAmount: newRemaining,
            })
          }
        }
      }
    }

    // 3. Synchronize linked savings goal & goal logs if applicable
    if (existing.goalId) {
      const goal = await db.goals.get(existing.goalId)
      if (goal) {
        const delta = newAmt - oldAmt

        if (delta !== 0 || fields.notes !== undefined || fields.date !== undefined) {
          const isDeposit = existing.category === 'tabungan' || existing.type === 'expense'
          const newGoalAmount = isDeposit
            ? Math.max(0, (Number(goal.currentAmount) || 0) + delta)
            : Math.max(0, (Number(goal.currentAmount) || 0) - delta)

          const targetAmt = Number(goal.targetAmount) || 0
          const isCompleted = targetAmt > 0 ? newGoalAmount >= targetAmt : false

          await db.goals.update(goal.id, {
            currentAmount: newGoalAmount,
            isCompleted,
            ...(newGoalAmount < targetAmt && goal.status === 'completed' ? { status: 'active' } : {}),
            ...(isCompleted && goal.status !== 'completed' ? { status: 'completed' } : {}),
          })

          const goalLogs = await db.goalLogs.where('goalId').equals(existing.goalId).toArray()
          let targetLog = goalLogs.find((l) => l.transactionId === cleanId)
          if (!targetLog) {
            const expectedAmt = isDeposit ? oldAmt : -oldAmt
            targetLog =
              goalLogs.find(
                (l) =>
                  Math.abs(Number(l.amount) - expectedAmt) < 0.01 &&
                  Boolean(existing.date && l.date?.startsWith(existing.date)),
              ) ||
              goalLogs.find(
                (l) => Math.abs(Number(l.amount)) === oldAmt && Math.sign(Number(l.amount)) === Math.sign(expectedAmt),
              )
          }

          if (targetLog) {
            const logAmt = isDeposit ? newAmt : -newAmt
            const updatePayload = {
              amount: logAmt,
              transactionId: cleanId,
            }
            if (fields.date) {
              const now = new Date()
              const updatedDate = new Date(`${fields.date}T00:00:00`)
              updatedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds())
              updatePayload.date = format(updatedDate, 'yyyy-MM-dd HH:mm:ss')
            }
            if (fields.notes !== undefined) {
              updatePayload.notes = fields.notes
            }
            await db.goalLogs.update(targetLog.id, updatePayload)
          }
        }
      }
    }

    // 2. Update transaction in ledger with sanitized fields
    const sanitizedFields = { ...fields }
    if (sanitizedFields.amount !== undefined) {
      sanitizedFields.amount = Number(sanitizedFields.amount)
    }
    if (sanitizedFields.walletId !== undefined && sanitizedFields.walletId !== null) {
      sanitizedFields.walletId = Number(sanitizedFields.walletId)
    }
    if (sanitizedFields.targetWalletId !== undefined) {
      sanitizedFields.targetWalletId = sanitizedFields.targetWalletId ? Number(sanitizedFields.targetWalletId) : null
    }
    if (sanitizedFields.type !== undefined && sanitizedFields.type !== 'transfer') {
      sanitizedFields.targetWalletId = null
    }

    await db.transactions.update(cleanId, sanitizedFields)
  })

  const affectedWallets = [
    existing?.walletId,
    existing?.targetWalletId,
    fields?.walletId,
    fields?.targetWalletId,
  ].filter(Boolean)
  if (affectedWallets.length > 0) {
    void invalidateWalletBalance(affectedWallets)
  }

  return 1
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
  if (!existing) return

  await db.transaction('rw', [db.transactions, db.loans, db.loanPayments, db.goals, db.goalLogs], async () => {
    // 1. Split Bill Bi-Directional Ledger Sync: block deletion if active linked loans exist
    if (existing.splitBillId) {
      const linkedLoans = await db.loans.where('splitBillId').equals(existing.splitBillId).toArray()
      const hasActiveLoans = linkedLoans.some(
        (l) => l.status !== 'paid' && l.status !== 'forgiven' && (Number(l.remainingAmount) || 0) > 0,
      )
      if (hasActiveLoans) {
        throw new Error('Transaksi ini merupakan talangan split bill dengan pinjaman aktif. Hapus atau selesaikan pinjaman terlebih dahulu.')
      }
    }

    // 2. If transaction is linked to a loan, synchronize remaining amount and payment records
    if (existing.loanId) {
      const loan = await db.loans.get(existing.loanId)
      if (loan) {
        const payment = await db.loanPayments.where('transactionId').equals(cleanId).first()
        if (payment) {
          await db.loanPayments.delete(payment.id)
          const restoredRemaining = Math.min(
            loan.totalAmount,
            (Number(loan.remainingAmount) || 0) + Number(existing.amount || 0),
          )
          const existingPaymentIds = Array.isArray(loan.paymentTransactionIds)
            ? loan.paymentTransactionIds
            : []
          const nextPaymentIds = existingPaymentIds.filter((txId) => txId !== cleanId)
          const isNowActive = restoredRemaining > 0
          await db.loans.update(loan.id, {
            remainingAmount: restoredRemaining,
            status: isNowActive
              ? restoredRemaining >= loan.totalAmount
                ? 'active'
                : 'partially_paid'
              : 'paid',
            paymentTransactionIds: nextPaymentIds,
            ...(isNowActive ? { paidDate: null, paidAt: null } : {}),
          })
        } else if (loan.initialTransactionId === cleanId) {
          throw new Error('Transaksi ini merupakan pencairan pokok pinjaman aktif. Silakan kelola atau hapus pinjaman melalui menu Pinjaman.')
        }
      }
    }

    // 3. Savings Goal Ledger Reversal on Transaction Deletion
    if (existing.goalId) {
      const goal = await db.goals.get(existing.goalId)
      if (goal) {
        const isDeposit = existing.category === 'tabungan' || existing.type === 'expense'
        const txAmt = Number(existing.amount) || 0
        const newGoalAmount = isDeposit
          ? Math.max(0, (Number(goal.currentAmount) || 0) - txAmt)
          : (Number(goal.currentAmount) || 0) + txAmt
        const targetAmt = Number(goal.targetAmount) || 0
        const isCompleted = targetAmt > 0 ? newGoalAmount >= targetAmt : false

        await db.goals.update(goal.id, {
          currentAmount: newGoalAmount,
          isCompleted,
          ...(isDeposit && newGoalAmount < targetAmt && goal.status === 'completed' ? { status: 'active' } : {}),
        })

        // Delete corresponding db.goalLogs where transactionId === cleanId
        const goalLogs = await db.goalLogs.where('goalId').equals(existing.goalId).toArray()
        const logsToDelete = goalLogs.filter((l) => l.transactionId === cleanId)
        if (logsToDelete.length > 0) {
          await db.goalLogs.bulkDelete(logsToDelete.map((l) => l.id))
        } else {
          // Fallback if log was created before transactionId was tracked: match amount & date
          const expectedAmt = isDeposit ? txAmt : -txAmt
          const fallbackLog = goalLogs.find(
            (l) => Math.abs(Number(l.amount) - expectedAmt) < 0.01 && l.date?.startsWith(existing.date),
          )
          if (fallbackLog) {
            await db.goalLogs.delete(fallbackLog.id)
          }
        }
      }
    }

    // 4. Delete transaction from ledger
    await db.transactions.delete(cleanId)
  })

  const affectedWallets = [existing?.walletId, existing?.targetWalletId].filter(Boolean)
  if (affectedWallets.length > 0) {
    void invalidateWalletBalance(affectedWallets)
  }
}
