// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/lib/db'
import useLoanStore from '../src/store/useLoanStore'
import { roundCurrency } from '../src/lib/utils'
import { deleteTransaction, updateTransaction } from '../src/services/transactionService'

describe('Audit Remediation & Polish Round 3', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.wallets.clear()
    await db.loans.clear()
    await db.loanPayments.clear()
    await db.goals.clear()
    await db.goalLogs.clear()
  })

  describe('1. Split Bill Non-IDR Foreign Currency Precision', () => {
    it('calculates equal share with cents for USD and exact sum reconciliation', () => {
      const parsedTotal = 25.5
      const participantsCount = 2
      const isIdr = false

      const friendShare = isIdr
        ? Math.floor(parsedTotal / participantsCount)
        : roundCurrency(parsedTotal / participantsCount)

      const nonPayerCount = participantsCount - 1
      const payerShare = roundCurrency(parsedTotal - friendShare * nonPayerCount)

      expect(friendShare).toBe(12.75)
      expect(payerShare).toBe(12.75)
      expect(friendShare + payerShare).toBe(25.5)
    })

    it('distributes 3-way split on $10.00 with penny reconciliation without truncating cents', () => {
      const parsedTotal = 10.0
      const participantsCount = 3
      const isIdr = false

      const friendShare = isIdr
        ? Math.floor(parsedTotal / participantsCount)
        : roundCurrency(parsedTotal / participantsCount)

      const nonPayerCount = participantsCount - 1
      const payerShare = roundCurrency(parsedTotal - friendShare * nonPayerCount)

      expect(friendShare).toBe(3.33)
      expect(payerShare).toBe(3.34)
      expect(roundCurrency(friendShare * nonPayerCount + payerShare)).toBe(10.0)
    })
  })

  describe('2. Loan Lifecycle: Editing Initial Transaction on partially_paid Loans', () => {
    it('synchronizes loan total and remaining when initial tx is edited on partially_paid status', async () => {
      const walletId = await db.wallets.add({
        name: 'Dompet Utama',
        currency: 'IDR',
        balance: 1000000,
      })

      const initTxId = await db.transactions.add({
        date: '2026-09-01',
        amount: 500000,
        type: 'expense',
        category: 'Pinjaman Diberikan',
        walletId,
        currency: 'IDR',
      })

      const loanId = await db.loans.add({
        title: 'Pinjaman Teman',
        type: 'receivable',
        totalAmount: 500000,
        remainingAmount: 500000,
        status: 'active',
        initialTransactionId: initTxId,
        walletId,
        currency: 'IDR',
      })

      // Pay 200,000 -> remaining becomes 300,000, status becomes partially_paid
      await useLoanStore.getState().recordPayment(loanId, {
        amount: 200000,
        walletId,
        date: '2026-09-05',
      })

      const loanAfterPay = await db.loans.get(loanId)
      expect(loanAfterPay.remainingAmount).toBe(300000)
      expect(loanAfterPay.status).toBe('partially_paid')

      // Edit initial transaction: increase from 500,000 to 600,000 (+100,000 delta)
      await updateTransaction(initTxId, {
        amount: 600000,
      })

      const loanAfterEdit = await db.loans.get(loanId)
      expect(loanAfterEdit.totalAmount).toBe(600000)
      expect(loanAfterEdit.remainingAmount).toBe(400000)
      expect(loanAfterEdit.status).toBe('partially_paid')

      // Edit initial transaction down to 150,000 (-450,000 delta)
      // Since remaining was 400,000, remaining <= 0 -> loan should be marked paid!
      await updateTransaction(initTxId, {
        amount: 150000,
      })

      const loanAfterDecrease = await db.loans.get(loanId)
      expect(loanAfterDecrease.totalAmount).toBe(150000)
      expect(loanAfterDecrease.remainingAmount).toBe(0)
      expect(loanAfterDecrease.status).toBe('paid')
    })
  })

  describe('3. Loan Forgiveness Lifecycle & Reopening', () => {
    it('blocks recordPayment on forgiven loans with explicit actionable error', async () => {
      const loanId = await db.loans.add({
        title: 'Pinjaman Diputihkan',
        type: 'debt',
        totalAmount: 300000,
        remainingAmount: 300000,
        status: 'forgiven',
        forgivenDate: '2026-09-10',
        forgivenAt: Date.now(),
        forgivenAmount: 300000,
      })

      await expect(
        useLoanStore.getState().recordPayment(loanId, { amount: 50000 })
      ).rejects.toThrow('Pinjaman ini telah diputihkan. Pulihkan status pinjaman sebelum mencatat pembayaran.')
    })

    it('clears forgiveness metadata and reverts status to active when remainingAmount > 0 is set on updateLoan', async () => {
      const loanId = await db.loans.add({
        title: 'Pinjaman Diputihkan',
        type: 'debt',
        totalAmount: 300000,
        remainingAmount: 0,
        status: 'forgiven',
        forgivenDate: '2026-09-10',
        forgivenAt: 123456789,
        forgivenAmount: 300000,
        forgivenNotes: 'Catatan pemutihan',
      })

      await useLoanStore.getState().updateLoan(loanId, {
        remainingAmount: 150000,
      })

      const reopenedLoan = await db.loans.get(loanId)
      expect(reopenedLoan.status).toBe('active')
      expect(reopenedLoan.remainingAmount).toBe(150000)
      expect(reopenedLoan.forgivenDate).toBeNull()
      expect(reopenedLoan.forgivenAt).toBeNull()
      expect(reopenedLoan.forgivenAmount).toBeNull()
      expect(reopenedLoan.forgivenNotes).toBeNull()
    })
  })

  describe('4. Talangan Split Bill Deletion Guard', () => {
    it('blocks direct deletion of talangan transaction when participant loans exist', async () => {
      const splitBillId = 'sb-101'
      const talanganTxId = await db.transactions.add({
        date: '2026-09-15',
        amount: 300000,
        type: 'expense',
        category: 'Pinjaman Diberikan',
        splitBillId,
        isExcludeAnalyticsTx: true,
      })

      const loanId = await db.loans.add({
        title: 'Talangan Split Bill Budi',
        type: 'receivable',
        totalAmount: 100000,
        remainingAmount: 100000,
        status: 'active',
        splitBillId,
        initialTransactionId: talanganTxId,
      })

      // When participant loan is active
      await expect(deleteTransaction(talanganTxId)).rejects.toThrow(
        /talangan split bill dengan pinjaman aktif/i
      )

      // When participant loan is marked paid / settled
      await db.loans.update(loanId, { status: 'paid', remainingAmount: 0 })
      await expect(deleteTransaction(talanganTxId)).rejects.toThrow(
        /memiliki catatan pinjaman partisipan/i
      )
    })
  })

  describe('5. Caret Positioning and Input Caret Order', () => {
    it('calculates proper caret position with (rawValue, formattedValue, rawCaret, currency) parameter order', async () => {
      const { getMoneyInputCaret } = await import('../src/lib/utils')
      // Entering raw '12345' -> formatted '12.345' in IDR
      const raw = '12345'
      const formatted = '12.345'
      const caret = getMoneyInputCaret(raw, formatted, 5, 'IDR')
      expect(caret).toBe(6) // accounts for the thousand separator dot inserted
    })
  })

  describe('6. Savings Actions Foreign Currency Rounding and Invariant Flags', () => {
    it('creates deposit transaction with roundCurrency, deletedAt: null, and isExcludeAnalyticsTx: true', async () => {
      const { handleSavingsAction } = await import('../src/lib/ai/chatActions/savingsActions')

      const walletId = await db.wallets.add({
        name: 'Dompet USD',
        currency: 'USD',
        balance: 1000,
      })

      const goalId = await db.goals.add({
        name: 'Liburan Bali',
        targetAmount: 500,
        currentAmount: 100,
        currency: 'USD',
      })

      const result = {
        action: 'add_funds',
        name: 'Liburan Bali',
        amount: 25.555,
        currency: 'USD',
      }

      await handleSavingsAction(result, {
        locale: 'id',
        defaultCurrency: 'USD',
        defaultWalletId: walletId,
        wallets: [{ id: walletId, name: 'Dompet USD', currency: 'USD' }],
      })

      const tx = await db.transactions.where('goalId').equals(goalId).first()
      expect(tx).not.toBeNull()
      expect(tx.amount).toBe(25.56) // rounded to 2 decimals via roundCurrency
      expect(tx.deletedAt).toBeNull()
      expect(tx.isExcludeAnalyticsTx).toBe(true)
      expect(tx.isExcludeFromAnalytics).toBe(true)
    })
  })
})
