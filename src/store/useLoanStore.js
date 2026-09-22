import { create } from 'zustand'
import { db } from '../lib/db'
import { invalidateWalletBalance } from '../lib/balanceEngine'
import { getLocalDateString } from '../lib/dateUtils'
import { convertCurrency, roundCurrency } from '../lib/utils'
import { getCachedCurrencyRates } from '../lib/api'
import useSettingsStore from './useSettingsStore'

const useLoanStore = create(() => ({
  loans: [],
  loanPayments: [],

  addLoan: async (loanData) => {
    const total = Number(loanData.totalAmount) || 0
    const principal = loanData.principalAmount !== undefined ? Number(loanData.principalAmount) : total
    if (!Number.isFinite(total) || total <= 0) {
      throw new Error('Nominal total pinjaman harus lebih dari 0.')
    }
    if (!Number.isFinite(principal) || principal <= 0) {
      throw new Error('Nominal pokok pinjaman harus lebih dari 0.')
    }
    if (!loanData.walletId) {
      throw new Error('Dompet / akun wajib dipilih untuk pencatatan pinjaman.')
    }
    const walletId = Number(loanData.walletId)
    const type = loanData.type || 'debt'

    const newLoan = {
      type, // 'debt' or 'receivable'
      personName: loanData.personName || '',
      title: loanData.title || '',
      totalAmount: total,
      principalAmount: principal,
      remainingAmount: loanData.remainingAmount !== undefined ? Number(loanData.remainingAmount) : total,
      currency: loanData.currency || 'IDR',
      dueDate: loanData.dueDate || null,
      startDate: loanData.startDate || getLocalDateString(),
      status: 'active',
      notes: loanData.notes || '',
      walletId,
      interestRate: loanData.interestRate || 0,
      tenorMonths: loanData.tenorMonths || 0,
      monthlyPayment: loanData.monthlyPayment || null,
      initialTransactionId: null,
      paymentTransactionIds: [],
      createdAt: Date.now(),
    }

    let loanId = null
    await db.transaction('rw', [db.loans, db.transactions], async () => {
      loanId = await db.loans.add(newLoan)

      // Generate initial transaction in ledger for mandatory walletId (disbursement uses principal amount)
      const isDebt = type === 'debt'
      const txCategory = isDebt ? 'Pinjaman Diterima' : 'Pinjaman Diberikan'
      const txType = isDebt ? 'income' : 'expense'
      const txNotes = loanData.notes || (isDebt ? `Pinjaman Diterima: ${loanData.title}` : `Pinjaman Diberikan: ${loanData.title}`)

      const initialTxId = await db.transactions.add({
        date: loanData.startDate || getLocalDateString(),
        type: txType,
        category: txCategory,
        amount: principal,
        currency: loanData.currency || 'IDR',
        notes: txNotes,
        walletId,
        loanId,
        isExcludeAnalyticsTx: true,
        isExcludeFromAnalytics: true,
        excludeFromAnalytics: true,
        createdAt: Date.now(),
        deletedAt: null,
      })

      await db.loans.update(loanId, { initialTransactionId: initialTxId })
    })

    await invalidateWalletBalance([walletId])
    return loanId
  },

  updateLoan: async (id, loanData) => {
    const existing = await db.loans.get(id)
    if (!existing) return

    const total = loanData.totalAmount !== undefined ? Number(loanData.totalAmount) : existing.totalAmount
    const principal = loanData.principalAmount !== undefined
      ? Number(loanData.principalAmount)
      : (existing.principalAmount !== undefined ? Number(existing.principalAmount) : total)
    const diffTotal = total - existing.totalAmount
    const rawRemaining = loanData.remainingAmount !== undefined
      ? Number(loanData.remainingAmount)
      : existing.remainingAmount + diffTotal
    let newRemaining = Math.max(0, rawRemaining)
    newRemaining = roundCurrency(newRemaining)
    const isNowPaid = newRemaining <= 0
    const wasPaidReopened = !isNowPaid && existing.status === 'paid'
    const newStatus = isNowPaid ? 'paid' : (wasPaidReopened ? 'active' : (loanData.status || existing.status))

    const updated = {
      ...existing,
      ...loanData,
      totalAmount: total,
      principalAmount: principal,
      remainingAmount: newRemaining,
      status: newStatus,
      ...(isNowPaid && !existing.paidDate ? { paidDate: loanData.paidDate || getLocalDateString(), paidAt: Date.now() } : {}),
      ...(wasPaidReopened ? { paidDate: null, paidAt: null } : {}),
    }

    const affectedWallets = []
    await db.transaction('rw', [db.loans, db.transactions], async () => {
      await db.loans.put(updated)

      // Update initial transaction in db.transactions if linked
      if (existing.initialTransactionId) {
        const txUpdates = {}
        if (existing.splitBillId) {
          if (diffTotal !== 0) {
            const initTx = await db.transactions.get(existing.initialTransactionId)
            if (initTx) {
              txUpdates.amount = Math.max(0, (Number(initTx.amount) || 0) + diffTotal)
            }
          }
        } else {
          const oldPrincipal = existing.principalAmount !== undefined ? existing.principalAmount : existing.totalAmount
          if (principal !== oldPrincipal) {
            txUpdates.amount = principal
          }
        }
        if (loanData.walletId && Number(loanData.walletId) !== Number(existing.walletId)) {
          txUpdates.walletId = Number(loanData.walletId)
          if (existing.walletId) affectedWallets.push(Number(existing.walletId))
          affectedWallets.push(Number(loanData.walletId))
        } else if (diffTotal !== 0 && existing.walletId) {
          affectedWallets.push(Number(existing.walletId))
        }
        if (loanData.startDate && loanData.startDate !== existing.startDate) {
          txUpdates.date = loanData.startDate
        }
        if (loanData.currency && loanData.currency !== existing.currency) {
          txUpdates.currency = loanData.currency
        }
        if (!existing.splitBillId && (loanData.title !== undefined || loanData.personName !== undefined)) {
          const isDebt = existing.type === 'debt'
          const title = loanData.title ?? existing.title
          const person = loanData.personName ?? existing.personName
          txUpdates.notes = isDebt ? `Pinjaman Diterima: ${title} dari ${person}` : `Pinjaman Diberikan: ${title} ke ${person}`
        }
        if (Object.keys(txUpdates).length > 0) {
          await db.transactions.update(existing.initialTransactionId, txUpdates)
        }
      }
    })

    if (affectedWallets.length > 0) {
      await invalidateWalletBalance(affectedWallets)
    }
  },

  deleteLoan: async (id) => {
    const loan = await db.loans.get(id)
    if (!loan) return
    const affectedWallets = new Set()
    if (loan.walletId) affectedWallets.add(Number(loan.walletId))

    await db.transaction('rw', db.loans, db.loanPayments, db.transactions, async () => {
      // Split Bill Bi-Directional Ledger Sync
      if (loan.splitBillId) {
        const siblingLoans = await db.loans
          .where('splitBillId')
          .equals(loan.splitBillId)
          .filter((l) => l.id !== id)
          .toArray()

        let friendsTx = null
        if (loan.initialTransactionId) {
          friendsTx = await db.transactions.get(loan.initialTransactionId)
        }
        if (!friendsTx) {
          friendsTx = await db.transactions.filter((t) => t.splitBillId === loan.splitBillId).first()
        }

        if (friendsTx) {
          if (friendsTx.walletId) affectedWallets.add(Number(friendsTx.walletId))
          // Immutable ledger invariant: Never modify historical cash outflow amount.
          // Outflows represent physical money that left the account at the merchant.
          if (siblingLoans.length === 0) {
            await db.transactions.update(friendsTx.id, { splitBillId: null })
          }
        }
      }

      // Delete loan
      await db.loans.delete(id)

      // Delete payments
      const payments = await db.loanPayments.where('loanId').equals(id).toArray()
      if (payments.length > 0) {
        await db.loanPayments.where('loanId').equals(id).delete()
      }

      // Unlink linked transactions in ledger instead of destroying them to preserve historical balances
      const linkedTxs = await db.transactions.where('loanId').equals(id).toArray()
      if (linkedTxs.length > 0) {
        for (const t of linkedTxs) {
          await db.transactions.update(t.id, { loanId: null })
        }
      }
    })

    if (affectedWallets.size > 0) {
      await invalidateWalletBalance(Array.from(affectedWallets))
    }
  },

  recordPayment: async (loanId, amount, date, notes = '', paymentWalletId = null, inputCurrency = null) => {
    const loan = await db.loans.get(loanId)
    if (!loan) throw new Error('Catatan pinjaman tidak ditemukan.')

    const payAmt = Number(amount) || 0
    if (payAmt <= 0) throw new Error('Nominal pembayaran harus lebih dari 0.')

    let effectiveDate = date
    let effectiveNotes = notes
    let effectivePaymentWalletId = paymentWalletId

    if (typeof effectiveDate === 'number' && effectivePaymentWalletId === null) {
      effectivePaymentWalletId = effectiveDate
      effectiveDate = getLocalDateString()
    }

    const effectiveWalletId = effectivePaymentWalletId || loan.walletId
    const targetWallet = effectiveWalletId ? await db.wallets.get(Number(effectiveWalletId)) : null
    const defaultCurrency = useSettingsStore.getState?.()?.defaultCurrency || 'IDR'
    const loanCurrency = loan.currency || defaultCurrency
    const walletCurrency = targetWallet?.currency || loanCurrency
    const paymentCurrency = inputCurrency || loanCurrency
    const rates = getCachedCurrencyRates('USD')

    const payAmtInLoanCurrency = convertCurrency(payAmt, paymentCurrency, loanCurrency, rates)
    const payAmtInWalletCurrency = convertCurrency(payAmt, paymentCurrency, walletCurrency, rates)

    const roundedLoanRemaining = roundCurrency(Number(loan.remainingAmount) || 0)
    const roundedPayAmt = roundCurrency(payAmtInLoanCurrency)
    if (roundedPayAmt > roundedLoanRemaining) {
      throw new Error(`Nominal pembayaran tidak boleh melebihi sisa tagihan (${loan.remainingAmount}).`)
    }

    let newRemaining = Math.max(0, loan.remainingAmount - payAmtInLoanCurrency)
    newRemaining = roundCurrency(newRemaining)
    const newStatus = newRemaining <= 0 ? 'paid' : 'partially_paid'
    const payDate = (typeof effectiveDate === 'string' && effectiveDate) ? effectiveDate : getLocalDateString()

    let generatedTxId = null

    await db.transaction('rw', db.transactions, db.loans, db.loanPayments, async () => {
      // Generate transaction in ledger if loan has connected walletId
      if (effectiveWalletId) {
        const isDebt = loan.type === 'debt'
        const txCategory = isDebt ? 'Bayar Hutang' : 'Terima Piutang'
        const txType = isDebt ? 'expense' : 'income' // Debt payment reduces wallet cash; Receivable receipt increases wallet cash
        const txNotes = effectiveNotes || (isDebt ? `Cicilan Hutang: ${loan.title}` : `Penerimaan Piutang: ${loan.title}`)

        generatedTxId = await db.transactions.add({
          date: payDate,
          type: txType,
          category: txCategory,
          amount: payAmtInWalletCurrency,
          currency: walletCurrency,
          notes: txNotes,
          walletId: Number(effectiveWalletId),
          loanId,
          isExcludeAnalyticsTx: true,
          isExcludeFromAnalytics: true,
          excludeFromAnalytics: true,
          createdAt: Date.now(),
          deletedAt: null,
        })
      }

      await db.loanPayments.add({
        loanId,
        amount: payAmtInLoanCurrency,
        date: payDate,
        notes: effectiveNotes,
        transactionId: generatedTxId || null,
        createdAt: Date.now(),
      })

      const existingPaymentTxIds = Array.isArray(loan.paymentTransactionIds) ? loan.paymentTransactionIds : []
      const nextPaymentTxIds = generatedTxId ? [...existingPaymentTxIds, generatedTxId] : existingPaymentTxIds

      const isNowPaid = newRemaining <= 0
      await db.loans.update(loanId, {
        remainingAmount: newRemaining,
        status: newStatus,
        paymentTransactionIds: nextPaymentTxIds,
        ...(isNowPaid ? { paidDate: payDate, paidAt: Date.now() } : {}),
      })
    })

    if (effectiveWalletId) {
      await invalidateWalletBalance([Number(effectiveWalletId)])
    }
  },

  forgiveLoan: async (loanId, notes = '') => {
    const loan = await db.loans.get(loanId)
    if (!loan) throw new Error('Catatan pinjaman tidak ditemukan.')

    const remaining = Number(loan.remainingAmount) || 0
    if (remaining <= 0) {
      throw new Error('Pinjaman ini sudah lunas / tidak memiliki sisa tagihan.')
    }

    const forgiveDate = getLocalDateString()
    const forgiveNoteText = notes.trim() || 'Diikhlaskan / Pemutihan'

    await db.transaction('rw', db.loans, db.loanPayments, async () => {
      await db.loanPayments.add({
        loanId,
        amount: remaining,
        date: forgiveDate,
        notes: forgiveNoteText,
        isForgive: true,
        transactionId: null,
        createdAt: Date.now(),
      })

      await db.loans.update(loanId, {
        remainingAmount: 0,
        status: 'forgiven',
        forgivenDate: forgiveDate || getLocalDateString(),
        forgivenAt: Date.now(),
        forgivenAmount: remaining,
        forgivenNotes: forgiveNoteText,
      })
    })

    if (loan.walletId) {
      await invalidateWalletBalance([Number(loan.walletId)])
    }
  },
}))

export default useLoanStore
