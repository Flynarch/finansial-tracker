import { create } from 'zustand'
import { db } from '../lib/db'
import { invalidateWalletBalance } from '../lib/balanceEngine'
import { getLocalDateString } from '../lib/dateUtils'
import { convertCurrency, roundCurrency } from '../lib/utils'
import { getCachedCurrencyRates } from '../lib/api'
import { clearCachedDashboardState } from '../hooks/dashboard/dashboardCache'
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
    await db.transaction('rw', [db.loans, db.transactions, db.wallets], async () => {
      loanId = await db.loans.add(newLoan)

      // Generate initial transaction in ledger for mandatory walletId (disbursement uses principal amount)
      const isDebt = type === 'debt'
      const txCategory = isDebt ? 'Pinjaman Diterima' : 'Pinjaman Diberikan'
      const txType = isDebt ? 'income' : 'expense'
      const txNotes = loanData.notes || (isDebt ? `Pinjaman Diterima: ${loanData.title}` : `Pinjaman Diberikan: ${loanData.title}`)

      let principalInWallet = principal
      let txCurrency = loanData.currency || 'IDR'
      if (walletId) {
        const targetWallet = await db.wallets.get(Number(walletId))
        if (targetWallet && targetWallet.currency && targetWallet.currency !== txCurrency) {
          const rates = getCachedCurrencyRates('USD')
          principalInWallet = roundCurrency(convertCurrency(principal, txCurrency, targetWallet.currency, rates), targetWallet.currency)
          txCurrency = targetWallet.currency
        }
      }

      const initialTxId = await db.transactions.add({
        date: loanData.startDate || getLocalDateString(),
        type: txType,
        category: txCategory,
        amount: principalInWallet,
        currency: txCurrency,
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
    clearCachedDashboardState()
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
    let rawRemaining
    if (loanData.remainingAmount !== undefined) {
      rawRemaining = Number(loanData.remainingAmount)
    } else {
      const payments = await db.loanPayments.where('loanId').equals(Number(id)).toArray()
      if (payments && payments.length > 0) {
        const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
        rawRemaining = total - totalPaid
      } else {
        rawRemaining = existing.remainingAmount + diffTotal
      }
    }
    let newRemaining = Math.max(0, rawRemaining)
    newRemaining = roundCurrency(newRemaining)
    const isNowPaid = newRemaining <= 0
    const wasPaidReopened = !isNowPaid && existing.status === 'paid'
    const wasForgivenReopened = !isNowPaid && existing.status === 'forgiven'
    const newStatus = isNowPaid ? 'paid' : (wasPaidReopened || wasForgivenReopened ? 'active' : (loanData.status || existing.status))

    const updated = {
      ...existing,
      ...loanData,
      totalAmount: total,
      principalAmount: principal,
      remainingAmount: newRemaining,
      status: newStatus,
      ...(isNowPaid && !existing.paidDate ? { paidDate: loanData.paidDate || getLocalDateString(), paidAt: Date.now() } : {}),
      ...(wasPaidReopened ? { paidDate: null, paidAt: null } : {}),
      ...(wasForgivenReopened ? { forgivenDate: null, forgivenAt: null, forgivenAmount: null, forgivenNotes: null } : {}),
    }

    const affectedWallets = []
    await db.transaction('rw', [db.loans, db.transactions, db.loanPayments, db.wallets], async () => {
      await db.loans.put(updated)

      if (wasForgivenReopened) {
        const forgivePayments = await db.loanPayments.where('loanId').equals(id).filter((p) => Boolean(p.isForgive)).toArray()
        if (forgivePayments.length > 0) {
          await db.loanPayments.bulkDelete(forgivePayments.map((p) => p.id))
        }
      }

      // Update initial transaction in db.transactions if linked
      if (existing.initialTransactionId) {
        const txUpdates = {}
        const oldPrincipal = existing.principalAmount !== undefined ? existing.principalAmount : existing.totalAmount
        const principalChanged = principal !== oldPrincipal
        const currencyChanged = Boolean(loanData.currency && loanData.currency !== existing.currency)
        const initTx = await db.transactions.get(existing.initialTransactionId)

        const loanCurrency = loanData.currency || existing.currency || 'IDR'
        const effectiveWalletId = loanData.walletId ? Number(loanData.walletId) : (existing.walletId ? Number(existing.walletId) : (initTx?.walletId ? Number(initTx.walletId) : null))
        const targetWallet = effectiveWalletId ? await db.wallets.get(effectiveWalletId) : null
        const txTargetCurrency = targetWallet?.currency || initTx?.currency || loanCurrency
        const rates = getCachedCurrencyRates('USD')

        if (existing.splitBillId) {
          if (diffTotal !== 0 && initTx) {
            const diffInTxCurrency = roundCurrency(convertCurrency(diffTotal, loanCurrency, initTx.currency || txTargetCurrency, rates), initTx.currency || txTargetCurrency)
            txUpdates.amount = Math.max(0, (Number(initTx.amount) || 0) + diffInTxCurrency)
          }
        } else {
          if (principalChanged) {
            const targetCurrency = initTx?.currency || loanCurrency
            if (loanCurrency !== targetCurrency) {
              txUpdates.amount = roundCurrency(convertCurrency(principal, loanCurrency, targetCurrency, rates), targetCurrency)
            } else {
              txUpdates.amount = principal
            }
          }
        }
        if (!existing.splitBillId) {
          if (loanData.walletId && Number(loanData.walletId) !== Number(existing.walletId)) {
            txUpdates.walletId = Number(loanData.walletId)
            if (existing.walletId) affectedWallets.push(Number(existing.walletId))
            affectedWallets.push(Number(loanData.walletId))
          } else if ((diffTotal !== 0 || principalChanged || currencyChanged) && existing.walletId) {
            affectedWallets.push(Number(existing.walletId))
          }
          if (loanData.startDate && loanData.startDate !== existing.startDate) {
            txUpdates.date = loanData.startDate
          }
          if (loanData.currency && loanData.currency !== existing.currency) {
            txUpdates.currency = loanData.currency
          }
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
    clearCachedDashboardState()
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
    clearCachedDashboardState()
  },

  recordPayment: async (loanId, amount, date, notes = '', paymentWalletId = null, inputCurrency = null, excessCategory = null) => {
    let effectiveAmount = amount
    let effectiveDate = date
    let effectiveNotes = notes
    let effectivePaymentWalletId = paymentWalletId
    let effectiveInputCurrency = inputCurrency
    let effectiveExcessCategory = excessCategory

    if (typeof amount === 'object' && amount !== null) {
      effectiveAmount = amount.amount
      effectiveDate = amount.date
      effectiveNotes = amount.notes || ''
      effectivePaymentWalletId = amount.paymentWalletId || amount.walletId || null
      effectiveInputCurrency = amount.inputCurrency || amount.currency || null
      effectiveExcessCategory = amount.excessCategory || null
    }

    const loan = await db.loans.get(loanId)
    if (!loan) throw new Error('Catatan pinjaman tidak ditemukan.')
    if (loan.status === 'forgiven') {
      throw new Error('Pinjaman ini telah diputihkan. Pulihkan status pinjaman sebelum mencatat pembayaran.')
    }

    const payAmt = Number(effectiveAmount) || 0
    if (payAmt <= 0) throw new Error('Nominal pembayaran harus lebih dari 0.')

    if (typeof effectiveDate === 'number' && effectivePaymentWalletId === null) {
      effectivePaymentWalletId = effectiveDate
      effectiveDate = getLocalDateString()
    }

    const effectiveWalletId = effectivePaymentWalletId || loan.walletId
    const targetWallet = effectiveWalletId ? await db.wallets.get(Number(effectiveWalletId)) : null
    const defaultCurrency = useSettingsStore.getState?.()?.defaultCurrency || 'IDR'
    const loanCurrency = loan.currency || defaultCurrency
    const walletCurrency = targetWallet?.currency || loanCurrency
    const paymentCurrency = effectiveInputCurrency || loanCurrency
    const rates = getCachedCurrencyRates('USD')

    const payAmtInLoanCurrency = convertCurrency(payAmt, paymentCurrency, loanCurrency, rates)

    const roundedLoanRemaining = roundCurrency(Number(loan.remainingAmount) || 0)

    const principalPortion = Math.min(payAmtInLoanCurrency, roundedLoanRemaining)
    const excessPortion = Math.max(0, roundCurrency(payAmtInLoanCurrency - roundedLoanRemaining))

    let newRemaining = Math.max(0, loan.remainingAmount - principalPortion)
    newRemaining = roundCurrency(newRemaining)
    const newStatus = newRemaining <= 0 ? 'paid' : 'partially_paid'
    const payDate = (typeof effectiveDate === 'string' && effectiveDate) ? effectiveDate : getLocalDateString()

    let generatedTxId = null
    let generatedExcessTxId = null

    await db.transaction('rw', db.transactions, db.loans, db.loanPayments, async () => {
      const isDebt = loan.type === 'debt'
      const txCategory = isDebt ? 'Bayar Hutang' : 'Terima Piutang'
      const txType = isDebt ? 'expense' : 'income'
      const txNotes = effectiveNotes || (isDebt ? `Cicilan Hutang: ${loan.title}` : `Penerimaan Piutang: ${loan.title}`)

      // 1. Generate Principal Transaction if wallet connected and principalPortion > 0
      if (effectiveWalletId && principalPortion > 0) {
        const principalInWallet = roundCurrency(convertCurrency(principalPortion, loanCurrency, walletCurrency, rates))
        generatedTxId = await db.transactions.add({
          date: payDate,
          type: txType,
          category: txCategory,
          amount: principalInWallet,
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

      // 2. Generate Excess Transaction if excessPortion > 0
      if (effectiveWalletId && excessPortion > 0) {
        const excessInWallet = roundCurrency(convertCurrency(excessPortion, loanCurrency, walletCurrency, rates))
        const excessCat = effectiveExcessCategory || (isDebt ? 'tagihan/cicilan' : 'investasi/bunga_bank')
        const excessNotes = isDebt ? `[Kelebihan Bayar] ${loan.title}` : `[Kelebihan Terima] ${loan.title}`

        generatedExcessTxId = await db.transactions.add({
          date: payDate,
          type: txType,
          category: excessCat,
          amount: excessInWallet,
          currency: walletCurrency,
          notes: excessNotes,
          walletId: Number(effectiveWalletId),
          loanId,
          isLoanExcess: true,
          isExcludeAnalyticsTx: false,
          isExcludeFromAnalytics: false,
          excludeFromAnalytics: false,
          principalTransactionId: generatedTxId || null,
          createdAt: Date.now(),
          deletedAt: null,
        })

        if (generatedTxId) {
          await db.transactions.update(generatedTxId, {
            excessTransactionId: generatedExcessTxId,
          })
        }
      }

      await db.loanPayments.add({
        loanId,
        amount: payAmtInLoanCurrency,
        principalAmount: principalPortion,
        excessAmount: excessPortion,
        date: payDate,
        notes: effectiveNotes,
        transactionId: generatedTxId || null,
        excessTransactionId: generatedExcessTxId || null,
        createdAt: Date.now(),
      })

      const existingPaymentTxIds = Array.isArray(loan.paymentTransactionIds) ? loan.paymentTransactionIds : []
      const newTxIds = [generatedTxId, generatedExcessTxId].filter(Boolean)
      const nextPaymentTxIds = [...existingPaymentTxIds, ...newTxIds]

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
    clearCachedDashboardState()
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
    clearCachedDashboardState()
  },
}))

export default useLoanStore
