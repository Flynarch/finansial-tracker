import { format } from 'date-fns'
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

export { AppError, transformDbError }

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
        targetWalletId: cleanTargetWalletId,
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
    if (existing.splitBillId) {
      const linkedLoans = await db.loans.where('splitBillId').equals(existing.splitBillId).toArray()
      const isTalanganTx =
        linkedLoans.some((l) => Number(l.initialTransactionId) === cleanId || l.initialTransactionId === cleanId || Number(l.initialTransactionId) === Number(existing.id)) ||
        Boolean(existing.isExcludeAnalyticsTx) ||
        existing.category === 'Pinjaman Diberikan'

      if (isTalanganTx) {
        const activeParticipantLoans = linkedLoans.filter(
          (l) => l.status !== 'paid' && l.status !== 'forgiven' && (Number(l.remainingAmount) || 0) > 0,
        )
        const loanCurrency = activeParticipantLoans[0]?.currency || existing.currency || defaultCurrency
        const activeLoansSum = activeParticipantLoans.reduce(
          (sum, l) => sum + convertCurrency(Number(l.remainingAmount) || 0, l.currency || loanCurrency, loanCurrency, rates),
          0,
        )
        const newAmtInLoanCurrency = convertCurrency(newAmt, newCurrency, loanCurrency, rates)
        if (newAmtInLoanCurrency < activeLoansSum) {
          throw new Error('Nominal transaksi talangan tidak boleh lebih kecil dari sisa pinjaman aktif partisipan.')
        }
      }
    }

    // 2. Synchronize linked loan & loan payment record if applicable
    let loan = null
    if (existing.loanId) {
      loan = await db.loans.get(existing.loanId)
    }
    if (!loan) {
      loan = await db.loans.where('initialTransactionId').equals(cleanId).first()
      if (!loan && typeof cleanId === 'number') {
        loan = await db.loans.where('initialTransactionId').equals(String(cleanId)).first()
      }
    }
    if (!loan && existing.splitBillId) {
      loan = await db.loans.where('splitBillId').equals(existing.splitBillId).first()
    }
    if (loan) {
      const loanCurrency = loan.currency || defaultCurrency
        const oldAmtNorm = convertCurrency(oldAmt, oldCurrency, loanCurrency, rates)
        const newAmtNorm = convertCurrency(newAmt, newCurrency, loanCurrency, rates)

        const isExcessTx = Boolean(existing.isLoanExcess)
        let payment = await db.loanPayments.where('transactionId').equals(cleanId).first()
        if (!payment && isExcessTx) {
          payment = await db.loanPayments
            .where('loanId')
            .equals(existing.loanId)
            .filter((p) => p.excessTransactionId === cleanId)
            .first()
        }

        if (payment) {
          if (isExcessTx) {
            // Updating excess transaction: sync payment.excessAmount and total amount
            const newExcessAmt = newAmtNorm
            const currentPrincipal = Number(payment.principalAmount ?? payment.amount) || 0
            const updatedPaymentFields = {
              excessAmount: newExcessAmt,
              amount: currentPrincipal + newExcessAmt,
              ...(fields.date ? { date: fields.date } : {}),
            }
            await db.loanPayments.update(payment.id, updatedPaymentFields)

            // Keep linked principal transaction synchronized
            const principalTxId = existing.principalTransactionId || payment.transactionId
            if (principalTxId) {
              const syncFields = {}
              if (fields.date) syncFields.date = fields.date
              if (fields.walletId !== undefined) {
                syncFields.walletId = Number(fields.walletId)
                extraAffectedWallets.push(Number(fields.walletId))
              }
              if (Object.keys(syncFields).length > 0) {
                await db.transactions.update(Number(principalTxId), syncFields)
              }
            }
          } else {
            // Updating principal transaction
            const delta = newAmtNorm - oldAmtNorm
            const newRemaining = Math.max(0, Math.min(loan.totalAmount, (Number(loan.remainingAmount) || 0) - delta))
            const isNowActive = newRemaining > 0

            const currentExcess = Number(payment.excessAmount) || 0
            await db.loanPayments.update(payment.id, {
              principalAmount: newAmtNorm,
              amount: newAmtNorm + currentExcess,
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

            // Keep linked excess transaction synchronized
            const excessTxId = existing.excessTransactionId || payment.excessTransactionId
            if (excessTxId) {
              const syncFields = {}
              if (fields.date) syncFields.date = fields.date
              if (fields.walletId !== undefined) {
                syncFields.walletId = Number(fields.walletId)
                extraAffectedWallets.push(Number(fields.walletId))
              }
              if (Object.keys(syncFields).length > 0) {
                await db.transactions.update(Number(excessTxId), syncFields)
              }
            }
          }
        } else if (
          Number(loan.initialTransactionId) === cleanId ||
          loan.initialTransactionId === cleanId ||
          Boolean(existing.splitBillId)
        ) {
          let linkedLoans = await db.loans.where('initialTransactionId').equals(cleanId).toArray()
          if (linkedLoans.length === 0 && typeof cleanId === 'number') {
            linkedLoans = await db.loans.where('initialTransactionId').equals(String(cleanId)).toArray()
          }
          if (linkedLoans.length === 0 && existing.splitBillId) {
            linkedLoans = await db.loans.where('splitBillId').equals(existing.splitBillId).toArray()
          }
          const eligibleLoans = linkedLoans.filter((l) => l.status === 'active' || l.status === 'partially_paid')
          const sumTotalLoans = eligibleLoans.reduce(
            (sum, l) => sum + convertCurrency(Number(l.totalAmount) || 0, l.currency || loanCurrency, loanCurrency, rates),
            0,
          )
          if (eligibleLoans.length > 0 && newAmtNorm !== oldAmtNorm) {
            const deltaTotal = newAmtNorm - oldAmtNorm
            let distributedDelta = 0
            for (let i = 0; i < eligibleLoans.length; i++) {
              const l = eligibleLoans[i]
              const lTotalInLoanCur = convertCurrency(Number(l.totalAmount) || 0, l.currency || loanCurrency, loanCurrency, rates)
              const ratio = sumTotalLoans > 0 ? lTotalInLoanCur / sumTotalLoans : 1 / eligibleLoans.length

              let deltaPartInLoanCur
              if (i === eligibleLoans.length - 1) {
                deltaPartInLoanCur = deltaTotal - distributedDelta
              } else {
                deltaPartInLoanCur = Math.round(deltaTotal * ratio)
                distributedDelta += deltaPartInLoanCur
              }

              const deltaPart = roundCurrency(
                convertCurrency(deltaPartInLoanCur, loanCurrency, l.currency || loanCurrency, rates),
                l.currency || loanCurrency,
              )
              const newTotal = Math.max(0, (Number(l.totalAmount) || 0) + deltaPart)
              const newRemaining = Math.max(0, (Number(l.remainingAmount) || 0) + deltaPart)
              const newStatus = newRemaining <= 0 ? 'paid' : (newRemaining < newTotal ? 'partially_paid' : 'active')
              await db.loans.update(l.id, {
                totalAmount: newTotal,
                remainingAmount: newRemaining,
                status: newStatus,
                ...(newStatus === 'paid'
                  ? { paidDate: fields.date || existing.date || format(new Date(), 'yyyy-MM-dd'), paidAt: Date.now() }
                  : { paidDate: null, paidAt: null }),
              })
            }
          }
        }
      }

    // Synchronize linked investment & investment orders if applicable
    if (existing.investmentId) {
      const investment = await db.investments.get(Number(existing.investmentId))
      if (investment) {
        const orderCandidates = await db.investmentOrders
          .filter((o) => Number(o.transactionId) === cleanId || o.transactionId === cleanId || (existing.investmentOrderId && Number(o.id) === Number(existing.investmentOrderId)))
          .toArray()
        for (const order of orderCandidates) {
          const orderUpdates = {}
          if (fields.amount !== undefined && Number(fields.amount) !== Number(existing.amount)) {
            orderUpdates.totalAmount = Number(fields.amount)
          }
          if (fields.date && fields.date !== existing.date) {
            orderUpdates.date = fields.date
          }
          if (Object.keys(orderUpdates).length > 0) {
            await db.investmentOrders.update(order.id, orderUpdates)
          }
        }
      }
    }

    // 3. Synchronize linked savings goal & goal logs if applicable
    if (existing.goalId) {
      const goal = await db.goals.get(existing.goalId)
      if (goal) {
        const goalCurrency = goal.currency || defaultCurrency
        const oldAmtNorm = convertCurrency(oldAmt, oldCurrency, goalCurrency, rates)
        const newAmtNorm = convertCurrency(newAmt, newCurrency, goalCurrency, rates)
        const delta = newAmtNorm - oldAmtNorm

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
            const expectedAmt = isDeposit ? oldAmtNorm : -oldAmtNorm
            targetLog =
              goalLogs.find(
                (l) =>
                  Math.abs(Number(l.amount) - expectedAmt) < 0.01 &&
                  Boolean(existing.date && l.date?.startsWith(existing.date)),
              ) ||
              goalLogs.find(
                (l) => Math.abs(Number(l.amount)) === oldAmtNorm && Math.sign(Number(l.amount)) === Math.sign(expectedAmt),
              )
          }

          if (targetLog) {
            const logAmt = isDeposit ? newAmtNorm : -newAmtNorm
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
      } else if (sanitizedFields.targetAmount !== undefined && !sanitizedFields.targetAmount) {
        sanitizedFields.targetAmount = null
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

  const existing = await db.transactions.get(cleanId)
  if (!existing) return

  const extraAffectedWallets = []

  try {
    await db.transaction('rw', [db.transactions, db.loans, db.loanPayments, db.goals, db.goalLogs, db.investments, db.investmentOrders], async () => {
      const defaultCurrency = useSettingsStore.getState?.()?.defaultCurrency || 'IDR'
      const rates = getCachedCurrencyRates('USD')

      // 1. Guard: Parent Split Bill Transaction Deletion (talangan / fronted transaction only)
      if (existing.splitBillId) {
        const linkedLoans = await db.loans.where('splitBillId').equals(existing.splitBillId).toArray()
        const isTalanganTx =
          linkedLoans.some((l) => Number(l.initialTransactionId) === cleanId || l.initialTransactionId === cleanId || Number(l.initialTransactionId) === Number(existing.id)) ||
          Boolean(existing.isExcludeAnalyticsTx) ||
          existing.category === 'Pinjaman Diberikan'

        if (isTalanganTx) {
          const activeParticipantLoans = linkedLoans.filter(
            (l) => l.status !== 'paid' && l.status !== 'forgiven' && (Number(l.remainingAmount) || 0) > 0,
          )
          if (activeParticipantLoans.length > 0) {
            throw new Error('Transaksi ini merupakan talangan split bill dengan pinjaman aktif. Hapus atau selesaikan pinjaman terlebih dahulu.')
          }
          if (linkedLoans.length > 0) {
            throw new Error('Transaksi ini merupakan talangan split bill yang memiliki catatan pinjaman partisipan. Kelola atau hapus pinjaman partisipan melalui menu Pinjaman.')
          }
        }
      }

      // 2. If transaction is linked to a loan, synchronize remaining amount and payment records
      let loan = null
      if (existing.loanId) {
        loan = await db.loans.get(existing.loanId)
      }
      if (!loan) {
        loan = await db.loans.where('initialTransactionId').equals(cleanId).first()
        if (!loan && typeof cleanId === 'number') {
          loan = await db.loans.where('initialTransactionId').equals(String(cleanId)).first()
        }
      }
      if (loan) {
        const isExcessTx = Boolean(existing.isLoanExcess)
        let payment = await db.loanPayments.where('transactionId').equals(cleanId).first()
          if (!payment && isExcessTx) {
            payment = await db.loanPayments
              .where('loanId')
              .equals(existing.loanId)
              .filter((p) => p.excessTransactionId === cleanId)
              .first()
          }

          if (payment) {
            if (isExcessTx) {
              // Deleting only the excess transaction: unlink from payment and principal tx
              const remainingPrincipal = Number(payment.principalAmount ?? payment.amount) || 0
              if (remainingPrincipal <= 0) {
                await db.loanPayments.delete(payment.id)
              } else {
                await db.loanPayments.update(payment.id, {
                  excessAmount: 0,
                  excessTransactionId: null,
                  amount: remainingPrincipal,
                })
              }
              const principalTxId = existing.principalTransactionId || payment.transactionId
              if (principalTxId) {
                await db.transactions.update(Number(principalTxId), { excessTransactionId: null })
              }
              const existingPaymentIds = Array.isArray(loan.paymentTransactionIds)
                ? loan.paymentTransactionIds
                : []
              await db.loans.update(loan.id, {
                paymentTransactionIds: existingPaymentIds.filter((txId) => txId !== cleanId),
              })
            } else {
              // Deleting the principal payment transaction
              await db.loanPayments.delete(payment.id)
              const loanCurrency = loan.currency || defaultCurrency
              const principalPortion = payment.principalAmount != null
                ? Number(payment.principalAmount)
                : convertCurrency(
                    Number(existing.amount || 0),
                    existing.currency || defaultCurrency,
                    loanCurrency,
                    rates,
                  )
              const restoredRemaining = Math.min(
                loan.totalAmount,
                (Number(loan.remainingAmount) || 0) + principalPortion,
              )

              // If there is a linked excess transaction, also delete it
              const excessTxId = existing.excessTransactionId || payment.excessTransactionId
              if (excessTxId) {
                const excessTx = await db.transactions.get(Number(excessTxId))
                if (excessTx && !excessTx.deletedAt) {
                  await db.transactions.update(excessTx.id, { deletedAt: Date.now() })
                  if (excessTx.walletId) extraAffectedWallets.push(excessTx.walletId)
                }
              }

              const existingPaymentIds = Array.isArray(loan.paymentTransactionIds)
                ? loan.paymentTransactionIds
                : []
              const txsToRemove = new Set([cleanId, Number(excessTxId)].filter(Boolean))
              const nextPaymentIds = existingPaymentIds.filter((txId) => !txsToRemove.has(txId))
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
            }
          } else if (Number(loan.initialTransactionId) === cleanId || loan.initialTransactionId === cleanId) {
            let linkedLoansForInit = await db.loans.where('initialTransactionId').equals(cleanId).toArray()
            if (linkedLoansForInit.length === 0 && typeof cleanId === 'number') {
              linkedLoansForInit = await db.loans.where('initialTransactionId').equals(String(cleanId)).toArray()
            }
            const hasActiveLoan = linkedLoansForInit.some(
              (l) => (l.status === 'active' || l.status === 'partially_paid') && (Number(l.remainingAmount) || 0) > 0,
            )
            if (hasActiveLoan) {
              throw new Error('Transaksi ini merupakan pencairan pokok pinjaman aktif. Silakan kelola atau hapus pinjaman melalui menu Pinjaman.')
            }
            for (const l of linkedLoansForInit) {
              await db.loans.update(l.id, { initialTransactionId: null })
            }
          }
        }

      // 3. Savings Goal Ledger Reversal on Transaction Deletion
      if (existing.goalId) {
        const goal = await db.goals.get(existing.goalId)
        if (goal) {
          const goalCurrency = goal.currency || defaultCurrency
          const isDeposit = existing.category === 'tabungan' || existing.type === 'expense'
          const normalizedExistingAmt = convertCurrency(
            Number(existing.amount || 0),
            existing.currency || defaultCurrency,
            goalCurrency,
            rates,
          )
          const newGoalAmount = isDeposit
            ? Math.max(0, (Number(goal.currentAmount) || 0) - normalizedExistingAmt)
            : (Number(goal.currentAmount) || 0) + normalizedExistingAmt
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
            const expectedAmt = isDeposit ? normalizedExistingAmt : -normalizedExistingAmt
            const fallbackLog = goalLogs.find(
              (l) => Math.abs(Number(l.amount) - expectedAmt) < 0.01 && l.date?.startsWith(existing.date),
            )
            if (fallbackLog) {
              await db.goalLogs.delete(fallbackLog.id)
            }
          }
        }
      }

      // 4. Investment Holding Reversal on Transaction Deletion
      if (
        existing.investmentId ||
        existing.investmentOrderId ||
        (typeof existing.notes === 'string' &&
          /^(?:Buy|Sell)\s+/i.test(existing.notes.trim()) &&
          (existing.category?.startsWith('investasi') || existing.category?.startsWith('investasi_pengeluaran')))
      ) {
        let order = null
        if (existing.investmentOrderId) {
          order = await db.investmentOrders.get(Number(existing.investmentOrderId))
        }
        if (!order && existing.createdAt) {
          order = await db.investmentOrders.where('createdAt').equals(Number(existing.createdAt)).first()
        }
        if (!order && existing.date) {
          const candidates = await db.investmentOrders.where('date').equals(existing.date).toArray()
          order = candidates.find(
            (o) =>
              Math.abs(Number(o.totalAmount) - Number(existing.amount)) < 0.01 &&
              (!existing.notes || (o.name && existing.notes.includes(o.name))),
          )
        }

        let holding = null
        if (existing.investmentId) {
          holding = await db.investments.get(Number(existing.investmentId))
        }
        if (!holding && order) {
          holding = await db.investments
            .filter(
              (inv) =>
                inv.name?.toLowerCase() === order.name?.toLowerCase() &&
                (!order.type || inv.type?.toLowerCase() === order.type?.toLowerCase()),
            )
            .first()
        }
        if (!holding && existing.notes) {
          const match = existing.notes.trim().match(/^(?:Buy|Sell)\s+(.+)$/i)
          if (match && match[1]) {
            const assetName = match[1].trim().toLowerCase()
            holding = await db.investments.filter((inv) => inv.name?.toLowerCase() === assetName).first()
          }
        }

        const isBuy = order
          ? order.side === 'buy'
          : existing.type === 'expense' || existing.notes?.toLowerCase().startsWith('buy')
        const qtyToAdjust = order
          ? Number(order.quantity) || 0
          : holding && Number(holding.purchasePrice) > 0
          ? Number(existing.amount) / Number(holding.purchasePrice)
          : 0

        if (isBuy) {
          if (holding && qtyToAdjust > 0) {
            const currentQty = Number(holding.quantity) || 0
            const newQty = Math.max(0, currentQty - qtyToAdjust)
            if (newQty <= 0.000001) {
              await db.investments.delete(holding.id)
            } else {
              await db.investments.update(holding.id, { quantity: newQty })
            }
          }
        } else {
          // Deleting a sell transaction restores the sold holding
          if (holding && qtyToAdjust > 0) {
            const newQty = (Number(holding.quantity) || 0) + qtyToAdjust
            await db.investments.update(holding.id, { quantity: newQty })
          } else if (order && qtyToAdjust > 0) {
            // Holding was deleted when sold out; restore it with original costBasis
            await db.investments.add({
              name: order.name,
              type: order.type || 'Investasi',
              quantity: qtyToAdjust,
              purchasePrice: Number(order.costBasis || order.purchasePrice || order.unitPrice) || 0,
              purchaseCurrency: order.currency || existing.currency || defaultCurrency,
            })
          }
        }

        if (order) {
          await db.investmentOrders.delete(order.id)
        }
      }

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
