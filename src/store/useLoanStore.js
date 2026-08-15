import { create } from 'zustand'
import { db } from '../lib/db'

const useLoanStore = create((set) => ({
  loans: [],
  loanPayments: [],

  setLoans: (loans) => set({ loans }),
  setLoanPayments: (loanPayments) => set({ loanPayments }),

  addLoan: async (loanData) => {
    const total = Number(loanData.totalAmount) || 0
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
      remainingAmount: total,
      currency: loanData.currency || 'IDR',
      dueDate: loanData.dueDate || null,
      startDate: loanData.startDate || new Date().toISOString().split('T')[0],
      status: 'active',
      notes: loanData.notes || '',
      walletId,
      initialTransactionId: null,
      paymentTransactionIds: [],
      createdAt: Date.now(),
    }

    const loanId = await db.loans.add(newLoan)

    // Generate initial transaction in ledger for mandatory walletId
    const isDebt = type === 'debt'
    const txCategory = isDebt ? 'Pinjaman Diterima' : 'Pinjaman Diberikan'
    const txType = isDebt ? 'income' : 'expense'
    const txNotes = loanData.notes || (isDebt ? `Pinjaman Diterima: ${loanData.title}` : `Pinjaman Diberikan: ${loanData.title}`)

    const initialTxId = await db.transactions.add({
      date: loanData.startDate || new Date().toISOString().split('T')[0],
      type: txType,
      category: txCategory,
      amount: total,
      currency: loanData.currency || 'IDR',
      notes: txNotes,
      walletId,
      loanId,
      isExcludeFromAnalytics: true,
      excludeFromAnalytics: true,
      createdAt: Date.now(),
    })

    await db.loans.update(loanId, { initialTransactionId: initialTxId })

    return loanId
  },

  updateLoan: async (id, loanData) => {
    const existing = await db.loans.get(id)
    if (!existing) return

    const total = loanData.totalAmount !== undefined ? Number(loanData.totalAmount) : existing.totalAmount
    const diffTotal = total - existing.totalAmount
    const newRemaining = Math.max(0, existing.remainingAmount + diffTotal)
    const newStatus = newRemaining <= 0 ? 'paid' : (loanData.status || existing.status)

    const updated = {
      ...existing,
      ...loanData,
      totalAmount: total,
      remainingAmount: newRemaining,
      status: newStatus,
    }

    await db.loans.put(updated)

    // Update initial transaction amount in db.transactions if linked and total changed
    if (existing.initialTransactionId && diffTotal !== 0) {
      await db.transactions.update(existing.initialTransactionId, {
        amount: total,
      })
    }
  },

  deleteLoan: async (id) => {
    await db.transaction('rw', db.loans, db.loanPayments, db.transactions, async () => {
      // Delete loan
      await db.loans.delete(id)

      // Delete payments
      const payments = await db.loanPayments.where('loanId').equals(id).toArray()
      if (payments.length > 0) {
        await db.loanPayments.where('loanId').equals(id).delete()
      }

      // Cascade delete linked transactions in ledger
      const linkedTxs = await db.transactions.where('loanId').equals(id).toArray()
      if (linkedTxs.length > 0) {
        const txIds = linkedTxs.map((t) => t.id)
        await db.transactions.bulkDelete(txIds)
      }
    })
  },

  recordPayment: async (loanId, amount, date, notes = '') => {
    const loan = await db.loans.get(loanId)
    if (!loan) throw new Error('Catatan pinjaman tidak ditemukan.')

    const payAmt = Number(amount) || 0
    if (payAmt <= 0) throw new Error('Nominal pembayaran harus lebih dari 0.')
    if (payAmt > loan.remainingAmount) {
      throw new Error(`Nominal pembayaran tidak boleh melebihi sisa tagihan (${loan.remainingAmount}).`)
    }

    const newRemaining = Math.max(0, loan.remainingAmount - payAmt)
    const newStatus = newRemaining <= 0 ? 'paid' : 'partially_paid'
    const payDate = date || new Date().toISOString().split('T')[0]

    let generatedTxId = null

    // Generate transaction in ledger if loan has connected walletId
    if (loan.walletId) {
      const isDebt = loan.type === 'debt'
      const txCategory = isDebt ? 'Bayar Hutang' : 'Terima Piutang'
      const txType = isDebt ? 'expense' : 'income' // Debt payment reduces wallet cash; Receivable receipt increases wallet cash
      const txNotes = notes || (isDebt ? `Cicilan Hutang: ${loan.title}` : `Penerimaan Piutang: ${loan.title}`)

      generatedTxId = await db.transactions.add({
        date: payDate,
        type: txType,
        category: txCategory,
        amount: payAmt,
        currency: loan.currency || 'IDR',
        notes: txNotes,
        walletId: Number(loan.walletId),
        loanId,
        isExcludeFromAnalytics: true,
        excludeFromAnalytics: true,
        createdAt: Date.now(),
      })
    }

    await db.transaction('rw', db.loans, db.loanPayments, async () => {
      await db.loanPayments.add({
        loanId,
        amount: payAmt,
        date: payDate,
        notes,
        transactionId: generatedTxId || null,
        createdAt: Date.now(),
      })

      const existingPaymentTxIds = Array.isArray(loan.paymentTransactionIds) ? loan.paymentTransactionIds : []
      const nextPaymentTxIds = generatedTxId ? [...existingPaymentTxIds, generatedTxId] : existingPaymentTxIds

      await db.loans.update(loanId, {
        remainingAmount: newRemaining,
        status: newStatus,
        paymentTransactionIds: nextPaymentTxIds,
      })
    })
  },
}))

export default useLoanStore
