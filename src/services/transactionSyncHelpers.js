import { db } from '../lib/db'
import { format } from 'date-fns'
import { convertCurrency, roundCurrency } from '../lib/utils'

/**
 * Validates that modifying a talangan / fronted transaction does not violate
 * remaining active loan balances or amounts already paid by participants.
 */
export async function validateTalanganParentUpdate({
  existing,
  newAmt,
  newCurrency,
  defaultCurrency,
  rates,
}) {
  const isTalanganTx = Boolean(
    existing.splitBillId &&
    existing.type === 'expense' &&
    (existing.category === 'Pinjaman Diberikan' ||
     existing.category === 'Talangan' ||
     existing.subCategory === 'Talangan' ||
     Boolean(existing.isTalangan))
  )

  if (!isTalanganTx) return

  const linkedLoans = await db.loans.where('splitBillId').equals(existing.splitBillId).toArray()
  const activeParticipantLoans = linkedLoans.filter(
    (l) => l.status !== 'paid' && l.status !== 'forgiven' && (Number(l.remainingAmount) || 0) > 0,
  )
  const loanCurrency = activeParticipantLoans[0]?.currency || existing.currency || defaultCurrency
  const activeLoansSum = activeParticipantLoans.reduce(
    (sum, l) => sum + convertCurrency(Number(l.remainingAmount) || 0, l.currency || loanCurrency, loanCurrency, rates),
    0,
  )
  const totalPaidSum = linkedLoans.reduce((sum, l) => {
    const total = Number(l.totalAmount) || 0
    const rem = Number(l.remainingAmount) || 0
    const paid = Math.max(0, total - rem)
    return sum + convertCurrency(paid, l.currency || loanCurrency, loanCurrency, rates)
  }, 0)
  const newAmtInLoanCurrency = convertCurrency(newAmt, newCurrency, loanCurrency, rates)
  if (newAmtInLoanCurrency < activeLoansSum) {
    throw new Error('Nominal transaksi talangan tidak boleh lebih kecil dari sisa pinjaman aktif partisipan.')
  }
  if (newAmtInLoanCurrency < totalPaidSum) {
    throw new Error('Nominal transaksi talangan tidak boleh lebih kecil dari total cicilan yang telah dibayarkan partisipan.')
  }
}

/**
 * Synchronizes linked loans and loan payments when a transaction is updated.
 */
export async function syncLoanOnUpdate({
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
}) {
  const isTalanganTx = Boolean(
    existing.splitBillId &&
    existing.type === 'expense' &&
    (existing.category === 'Pinjaman Diberikan' ||
     existing.category === 'Talangan' ||
     existing.subCategory === 'Talangan' ||
     Boolean(existing.isTalangan))
  )

  let loan = null
  if (existing.loanId) {
    loan = await db.loans.get(existing.loanId)
  }
  if (!loan) {
    if (!existing.splitBillId || isTalanganTx) {
      loan = await db.loans.where('initialTransactionId').equals(cleanId).first()
      if (!loan && typeof cleanId === 'number') {
        loan = await db.loans.where('initialTransactionId').equals(String(cleanId)).first()
      }
    }
  }
  if (!loan && existing.splitBillId && isTalanganTx) {
    loan = await db.loans.where('splitBillId').equals(existing.splitBillId).first()
  }
  if (!loan) return

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
      const newExcessAmt = newAmtNorm
      const currentPrincipal = Number(payment.principalAmount ?? payment.amount) || 0
      const updatedPaymentFields = {
        excessAmount: newExcessAmt,
        amount: currentPrincipal + newExcessAmt,
        ...(fields.date ? { date: fields.date } : {}),
      }
      await db.loanPayments.update(payment.id, updatedPaymentFields)

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
    (!existing.splitBillId && (Number(loan.initialTransactionId) === cleanId || loan.initialTransactionId === cleanId)) ||
    (Boolean(existing.splitBillId) && isTalanganTx)
  ) {
    let linkedLoans = await db.loans.where('initialTransactionId').equals(cleanId).toArray()
    if (linkedLoans.length === 0 && typeof cleanId === 'number') {
      linkedLoans = await db.loans.where('initialTransactionId').equals(String(cleanId)).toArray()
    }
    if (linkedLoans.length === 0 && existing.splitBillId && isTalanganTx) {
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
        const oldTotal = Number(l.totalAmount) || 0
        const oldRemaining = Number(l.remainingAmount) || 0
        const isTalangan = Boolean(existing.splitBillId && isTalanganTx)
        const paidSoFar = Math.max(0, oldTotal - oldRemaining)
        const newTotal = isTalangan
          ? Math.max(paidSoFar, oldTotal + deltaPart)
          : Math.max(0, oldTotal + deltaPart)
        const newRemaining = isTalangan
          ? Math.max(0, newTotal - paidSoFar)
          : Math.max(0, oldRemaining + deltaPart)
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

/**
 * Synchronizes linked investments and investment orders when a transaction is updated.
 */
export async function syncInvestmentOnUpdate({ existing, cleanId, fields }) {
  const investmentId = existing.investmentId ? Number(existing.investmentId) : null
  const orderCandidates = await db.investmentOrders
    .filter((o) => Number(o.transactionId) === cleanId || o.transactionId === cleanId || (existing.investmentOrderId && Number(o.id) === Number(existing.investmentOrderId)))
    .toArray()
  let investment = investmentId ? await db.investments.get(investmentId) : null
  if (!investment && orderCandidates.length > 0) {
    if (orderCandidates[0].investmentId) {
      investment = await db.investments.get(Number(orderCandidates[0].investmentId))
    }
    if (!investment && orderCandidates[0].name) {
      investment = await db.investments.filter((i) => String(i.name || '').toLowerCase() === String(orderCandidates[0].name).toLowerCase()).first()
    }
  }
  if (!investment || orderCandidates.length === 0) return

  for (const order of orderCandidates) {
    const orderUpdates = {}
    if (fields.amount !== undefined && Number(fields.amount) !== Number(existing.amount)) {
      const nextAmt = Number(fields.amount)
      orderUpdates.totalAmount = nextAmt
      const orderQty = Number(order.quantity) || 0
      if (orderQty > 0) {
        const nextUnitPrice = nextAmt / orderQty
        orderUpdates.unitPrice = nextUnitPrice
        if (order.side === 'buy') {
          const allBuyOrders = await db.investmentOrders
            .filter(
              (o) =>
                o.side === 'buy' &&
                String(o.name || '').toLowerCase() === String(investment.name || '').toLowerCase()
            )
            .toArray()
          const totalCost = allBuyOrders.reduce((acc, o) => {
            const q = Number(o.quantity) || 0
            const u = o.id === order.id ? nextUnitPrice : (Number(o.unitPrice || o.purchasePrice) || 0)
            return acc + q * u
          }, 0)
          const totalQ = allBuyOrders.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0)
          const weightedPrice = totalQ > 0 ? totalCost / totalQ : nextUnitPrice
          await db.investments.update(investment.id, {
            purchasePrice: weightedPrice,
          })
        }
      }
    }
    if (fields.date && fields.date !== existing.date) {
      orderUpdates.date = fields.date
    }
    if (Object.keys(orderUpdates).length > 0) {
      await db.investmentOrders.update(order.id, orderUpdates)
    }
  }
}

/**
 * Synchronizes linked savings goals and goal logs when a transaction is updated.
 */
export async function syncGoalOnUpdate({
  existing,
  cleanId,
  newAmt,
  newCurrency,
  oldAmt,
  oldCurrency,
  fields,
  defaultCurrency,
  rates,
}) {
  if (!existing.goalId) return

  const goal = await db.goals.get(existing.goalId)
  if (!goal) return

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

/**
 * Validates that deleting a talangan / fronted transaction does not leave dangling active loans.
 */
export async function validateTalanganParentDelete({ existing }) {
  const isTalanganTx = Boolean(
    existing.splitBillId &&
    existing.type === 'expense' &&
    (existing.category === 'Pinjaman Diberikan' ||
     existing.category === 'Talangan' ||
     existing.subCategory === 'Talangan' ||
     Boolean(existing.isTalangan))
  )

  if (isTalanganTx && existing.splitBillId) {
    const linkedLoans = await db.loans.where('splitBillId').equals(existing.splitBillId).toArray()
    const activeParticipantLoans = linkedLoans.filter(
      (l) => !l.isArchived && l.status !== 'paid' && l.status !== 'forgiven' && (Number(l.remainingAmount) || 0) > 0,
    )
    if (activeParticipantLoans.length > 0) {
      throw new Error('Transaksi ini merupakan talangan split bill dengan pinjaman aktif. Hapus atau selesaikan pinjaman terlebih dahulu.')
    }
    if (linkedLoans.length > 0) {
      throw new Error('Transaksi ini merupakan talangan split bill yang memiliki catatan pinjaman partisipan. Kelola atau hapus pinjaman partisipan melalui menu Pinjaman.')
    }
  }
}

/**
 * Synchronizes linked loans and loan payments when a transaction is deleted.
 */
export async function syncLoanOnDelete({
  existing,
  cleanId,
  defaultCurrency,
  rates,
  extraAffectedWallets,
}) {
  const isTalanganTx = Boolean(
    existing.splitBillId &&
    existing.type === 'expense' &&
    (existing.category === 'Pinjaman Diberikan' ||
     existing.category === 'Talangan' ||
     existing.subCategory === 'Talangan' ||
     Boolean(existing.isTalangan))
  )

  let loan = null
  if (existing.loanId) {
    loan = await db.loans.get(existing.loanId)
  }
  if (!loan) {
    if (!existing.splitBillId || isTalanganTx) {
      loan = await db.loans.where('initialTransactionId').equals(cleanId).first()
      if (!loan && typeof cleanId === 'number') {
        loan = await db.loans.where('initialTransactionId').equals(String(cleanId)).first()
      }
    }
  }
  if (!loan) return

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
      const remainingPrincipal = Number(payment.principalAmount ?? payment.amount) || 0
      if (remainingPrincipal <= 0) {
        await db.loanPayments.delete(payment.id)
      } else {
        await db.loanPayments.update(payment.id, {
          excessAmount: 0,
          interestAmount: 0,
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

/**
 * Synchronizes linked savings goals and goal logs when a transaction is deleted.
 */
export async function syncGoalOnDelete({ existing, cleanId, defaultCurrency, rates }) {
  if (!existing.goalId) return

  const goal = await db.goals.get(existing.goalId)
  if (!goal) return

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

  const goalLogs = await db.goalLogs.where('goalId').equals(existing.goalId).toArray()
  const logsToDelete = goalLogs.filter((l) => l.transactionId === cleanId)
  if (logsToDelete.length > 0) {
    await db.goalLogs.bulkDelete(logsToDelete.map((l) => l.id))
  } else {
    const expectedAmt = isDeposit ? normalizedExistingAmt : -normalizedExistingAmt
    const fallbackLog = goalLogs.find(
      (l) => Math.abs(Number(l.amount) - expectedAmt) < 0.01 && l.date?.startsWith(existing.date),
    )
    if (fallbackLog) {
      await db.goalLogs.delete(fallbackLog.id)
    }
  }
}

/**
 * Synchronizes linked investment holdings and investment orders when a transaction is deleted.
 */
export async function syncInvestmentOnDelete({ existing, defaultCurrency }) {
  const hasInvestmentMarker =
    existing.investmentId ||
    existing.investmentOrderId ||
    (typeof existing.notes === 'string' &&
      /^(?:Buy|Sell)\s+/i.test(existing.notes.trim()) &&
      (existing.category?.startsWith('investasi') || existing.category?.startsWith('investasi_pengeluaran')))

  if (!hasInvestmentMarker) return

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
      if (newQty <= 0.00000001) {
        await db.investments.delete(holding.id)
      } else {
        let nextPurchasePrice = holding.purchasePrice
        if (order?.id) {
          const remainingBuyOrders = await db.investmentOrders
            .filter(
              (o) =>
                o.id !== order.id &&
                o.side === 'buy' &&
                String(o.name || '').toLowerCase() === String(holding.name || '').toLowerCase()
            )
            .toArray()
          if (remainingBuyOrders.length > 0) {
            const totalCost = remainingBuyOrders.reduce(
              (acc, o) => acc + (Number(o.quantity) || 0) * (Number(o.unitPrice || o.purchasePrice) || 0),
              0
            )
            const totalQ = remainingBuyOrders.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0)
            if (totalQ > 0) {
              nextPurchasePrice = totalCost / totalQ
            }
          }
        }
        await db.investments.update(holding.id, { quantity: newQty, purchasePrice: nextPurchasePrice })
      }
    }
  } else {
    if (holding && qtyToAdjust > 0) {
      const newQty = (Number(holding.quantity) || 0) + qtyToAdjust
      await db.investments.update(holding.id, { quantity: newQty })
    } else if (order && qtyToAdjust > 0) {
      await db.investments.add({
        name: order.name,
        type: order.type || 'Investasi',
        quantity: qtyToAdjust,
        purchasePrice: Number(order.costBasis ?? order.purchasePrice ?? order.unitPrice) || 0,
        purchaseCurrency: order.currency || existing.currency || defaultCurrency,
      })
    }
  }

  if (order) {
    await db.investmentOrders.delete(order.id)
  }
}
