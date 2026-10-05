import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/lib/db'
import useLoanStore from '../src/store/useLoanStore'
import { isExcludeAnalyticsTx } from '../src/lib/utils'
import { generateInstallmentSchedule, getLoanInstallmentSummary } from '../src/lib/loanUtils'
import { deleteTransaction, updateTransaction } from '../src/services/transactionService'
import { generateBalanceSheet } from '../src/lib/accountingEngine'
import { decryptField } from '../src/lib/fieldEncryption'

describe('Loan Overpayment Architecture', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.wallets.clear()
    await db.loans.clear()
    await db.loanPayments.clear()
  })

  describe('1. Analytics exclusion for loan excess transactions', () => {
    it('returns true for normal loan transactions without isLoanExcess flag', () => {
      const normalLoanTx = {
        id: 1,
        loanId: 10,
        type: 'expense',
        category: 'Bayar Hutang',
        amount: 100000,
      }
      expect(isExcludeAnalyticsTx(normalLoanTx)).toBe(true)
    })

    it('returns false for loan excess transactions with isLoanExcess: true', () => {
      const debtExcessTx = {
        id: 2,
        loanId: 10,
        isLoanExcess: true,
        type: 'expense',
        category: 'tagihan/cicilan',
        amount: 20000,
      }
      expect(isExcludeAnalyticsTx(debtExcessTx)).toBe(false)

      const receivableExcessTx = {
        id: 3,
        loanId: 11,
        isLoanExcess: true,
        type: 'income',
        category: 'investasi/bunga_bank',
        amount: 30000,
      }
      expect(isExcludeAnalyticsTx(receivableExcessTx)).toBe(false)
    })

    it('returns true when tx has deletedAt (soft-deleted)', () => {
      const deletedTx = {
        id: 4,
        type: 'expense',
        category: 'makanan',
        amount: 25000,
        deletedAt: '2026-09-29T10:00:00.000Z',
      }
      expect(isExcludeAnalyticsTx(deletedTx)).toBe(true)
    })
  })

  describe('2. Installment schedule and summary principal fallback in loanUtils', () => {
    it('uses principalAmount ?? amount in generateInstallmentSchedule', () => {
      const loan = {
        id: 1,
        type: 'debt',
        totalAmount: 200000,
        remainingAmount: 100000,
        tenorMonths: 2,
        monthlyPayment: 100000,
        startDate: '2026-01-01',
      }

      // Overpayment payment log with principalAmount and excessAmount
      const payments = [
        {
          id: 1,
          loanId: 1,
          amount: 120000,
          principalAmount: 100000,
          excessAmount: 20000,
        },
      ]

      const schedule = generateInstallmentSchedule(loan, payments)
      expect(schedule[0].status).toBe('paid')
      expect(schedule[0].paidAmount).toBe(100000)
      expect(schedule[1].status).toBe('unpaid')
      expect(schedule[1].remainingAmount).toBe(100000)
    })

    it('falls back to amount when principalAmount is absent in loanUtils', () => {
      const loan = {
        id: 2,
        type: 'debt',
        totalAmount: 100000,
        remainingAmount: 0,
        tenorMonths: 1,
        monthlyPayment: 100000,
        startDate: '2026-01-01',
      }

      const legacyPayments = [
        {
          id: 2,
          loanId: 2,
          amount: 100000,
        },
      ]

      const summary = getLoanInstallmentSummary(loan, legacyPayments)
      expect(summary.totalPaid).toBe(100000)
    })
  })

  describe('3. Debt loan overpayment in useLoanStore.recordPayment', () => {
    it('splits debt payment > remaining into principal and excess transactions', async () => {
      const walletId = await db.wallets.add({
        name: 'Dompet Utama',
        currency: 'IDR',
        balance: 1000000,
      })

      const loanId = await db.loans.add({
        type: 'debt',
        title: 'Hutang Teman',
        personName: 'Budi',
        totalAmount: 100000,
        remainingAmount: 100000,
        currency: 'IDR',
        walletId,
        status: 'active',
      })

      // Pay 120,000 on a 100,000 remaining debt
      await useLoanStore.getState().recordPayment(loanId, 120000, '2026-09-29', 'Lunas plus lebih', walletId, 'IDR', 'tagihan/cicilan')

      // Verify loan state
      const updatedLoan = await db.loans.get(loanId)
      expect(updatedLoan.remainingAmount).toBe(0)
      expect(updatedLoan.status).toBe('paid')

      // Verify transactions
      const txs = await db.transactions.where('loanId').equals(loanId).toArray()
      expect(txs).toHaveLength(2)

      const principalTx = txs.find((t) => !t.isLoanExcess)
      const excessTx = txs.find((t) => t.isLoanExcess)

      expect(principalTx).toBeDefined()
      expect(principalTx.type).toBe('expense')
      expect(principalTx.category).toBe('Bayar Hutang')
      expect(principalTx.amount).toBe(100000)
      expect(isExcludeAnalyticsTx(principalTx)).toBe(true)

      expect(excessTx).toBeDefined()
      expect(excessTx.type).toBe('expense')
      expect(excessTx.category).toBe('tagihan/cicilan')
      expect(excessTx.amount).toBe(20000)
      expect(await decryptField(excessTx.notes)).toContain('Kelebihan Bayar')
      expect(isExcludeAnalyticsTx(excessTx)).toBe(false)

      // Verify payment log
      const paymentLog = await db.loanPayments.where('loanId').equals(loanId).first()
      expect(paymentLog).toBeDefined()
      expect(paymentLog.amount).toBe(120000)
      expect(paymentLog.principalAmount).toBe(100000)
      expect(paymentLog.excessAmount).toBe(20000)
      expect(paymentLog.transactionId).toBe(principalTx.id)
      expect(paymentLog.excessTransactionId).toBe(excessTx.id)
    })
  })

  describe('4. Receivable loan overpayment in useLoanStore.recordPayment', () => {
    it('splits receivable payment > remaining into principal and excess income transactions', async () => {
      const walletId = await db.wallets.add({
        name: 'Rekening Mandiri',
        currency: 'IDR',
        balance: 500000,
      })

      const loanId = await db.loans.add({
        type: 'receivable',
        title: 'Piutang Usaha',
        personName: 'Siti',
        totalAmount: 100000,
        remainingAmount: 100000,
        currency: 'IDR',
        walletId,
        status: 'active',
      })

      // Receive 130,000 on a 100,000 remaining receivable
      await useLoanStore.getState().recordPayment(loanId, 130000, '2026-09-29', 'Pelunasan Siti', walletId, 'IDR', 'investasi/bunga_bank')

      // Verify loan state
      const updatedLoan = await db.loans.get(loanId)
      expect(updatedLoan.remainingAmount).toBe(0)
      expect(updatedLoan.status).toBe('paid')

      // Verify transactions
      const txs = await db.transactions.where('loanId').equals(loanId).toArray()
      expect(txs).toHaveLength(2)

      const principalTx = txs.find((t) => !t.isLoanExcess)
      const excessTx = txs.find((t) => t.isLoanExcess)

      expect(principalTx).toBeDefined()
      expect(principalTx.type).toBe('income')
      expect(principalTx.category).toBe('Terima Piutang')
      expect(principalTx.amount).toBe(100000)
      expect(isExcludeAnalyticsTx(principalTx)).toBe(true)

      expect(excessTx).toBeDefined()
      expect(excessTx.type).toBe('income')
      expect(excessTx.category).toBe('investasi/bunga_bank')
      expect(excessTx.amount).toBe(30000)
      expect(await decryptField(excessTx.notes)).toContain('Kelebihan Terima')
      expect(isExcludeAnalyticsTx(excessTx)).toBe(false)

      // Verify payment log
      const paymentLog = await db.loanPayments.where('loanId').equals(loanId).first()
      expect(paymentLog.amount).toBe(130000)
      expect(paymentLog.principalAmount).toBe(100000)
      expect(paymentLog.excessAmount).toBe(30000)
      expect(paymentLog.transactionId).toBe(principalTx.id)
      expect(paymentLog.excessTransactionId).toBe(excessTx.id)
    })
  })

  describe('5. Transaction service deletion and updates synchronization', () => {
    it('deletes linked excess transaction and restores principal amount when principal transaction is deleted', async () => {
      const walletId = await db.wallets.add({
        name: 'Dompet',
        currency: 'IDR',
        balance: 1000000,
      })

      const loanId = await db.loans.add({
        type: 'debt',
        title: 'Hutang Bank',
        totalAmount: 100000,
        remainingAmount: 100000,
        currency: 'IDR',
        walletId,
        status: 'active',
      })

      await useLoanStore.getState().recordPayment(loanId, 120000, '2026-09-29', 'Bayar lebih', walletId, 'IDR')

      const paymentLog = await db.loanPayments.where('loanId').equals(loanId).first()
      const principalTxId = paymentLog.transactionId
      const excessTxId = paymentLog.excessTransactionId

      // Delete principal transaction
      await deleteTransaction(principalTxId)

      // Loan remaining should be restored by principalAmount (100,000), not total (120,000)
      const restoredLoan = await db.loans.get(loanId)
      expect(restoredLoan.remainingAmount).toBe(100000)
      expect(restoredLoan.status).toBe('active')

      // Linked excess transaction should be soft-deleted
      const deletedExcessTx = await db.transactions.get(excessTxId)
      expect(deletedExcessTx.deletedAt).toBeTruthy()

      // Payment log should be deleted
      const remainingPaymentLogs = await db.loanPayments.where('loanId').equals(loanId).toArray()
      expect(remainingPaymentLogs).toHaveLength(0)
    })

    it('deleting excess transaction alone keeps loan remaining intact and unlinks payment', async () => {
      const walletId = await db.wallets.add({
        name: 'Dompet',
        currency: 'IDR',
        balance: 1000000,
      })

      const loanId = await db.loans.add({
        type: 'debt',
        title: 'Hutang Toko',
        totalAmount: 100000,
        remainingAmount: 100000,
        currency: 'IDR',
        walletId,
        status: 'active',
      })

      await useLoanStore.getState().recordPayment(loanId, 120000, '2026-09-29', 'Bayar lebih', walletId, 'IDR')

      const paymentLog = await db.loanPayments.where('loanId').equals(loanId).first()
      const excessTxId = paymentLog.excessTransactionId

      // Delete excess transaction only
      await deleteTransaction(excessTxId)

      // Loan should stay paid with 0 remaining
      const currentLoan = await db.loans.get(loanId)
      expect(currentLoan.remainingAmount).toBe(0)
      expect(currentLoan.status).toBe('paid')

      // Payment log should have excessAmount set to 0 and excessTransactionId null
      const updatedPaymentLog = await db.loanPayments.get(paymentLog.id)
      expect(updatedPaymentLog.excessAmount).toBe(0)
      expect(updatedPaymentLog.excessTransactionId).toBeNull()
    })

    it('synchronizes date across principal and excess transactions on update', async () => {
      const walletId = await db.wallets.add({
        name: 'Dompet',
        currency: 'IDR',
        balance: 1000000,
      })

      const loanId = await db.loans.add({
        type: 'debt',
        title: 'Hutang Servis',
        totalAmount: 100000,
        remainingAmount: 100000,
        currency: 'IDR',
        walletId,
        status: 'active',
      })

      await useLoanStore.getState().recordPayment(loanId, 120000, '2026-09-29', 'Bayar', walletId, 'IDR')

      const paymentLog = await db.loanPayments.where('loanId').equals(loanId).first()
      const principalTxId = paymentLog.transactionId
      const excessTxId = paymentLog.excessTransactionId

      // Update date of principal transaction
      await updateTransaction(principalTxId, { date: '2026-09-25' })

      const updatedExcessTx = await db.transactions.get(excessTxId)
      expect(updatedExcessTx.date).toBe('2026-09-25')

      const updatedPayment = await db.loanPayments.get(paymentLog.id)
      expect(updatedPayment.date).toBe('2026-09-25')
    })

    it('deletes loan payment log completely when deleting a 100% excess transaction', async () => {
      const walletId = await db.wallets.add({
        name: 'Dompet',
        currency: 'IDR',
        balance: 1000000,
      })

      const loanId = await db.loans.add({
        type: 'debt',
        title: 'Hutang Lunas',
        totalAmount: 100000,
        remainingAmount: 0,
        currency: 'IDR',
        walletId,
        status: 'paid',
      })

      // Pay 50000 on already paid loan (100% excess)
      await useLoanStore.getState().recordPayment(loanId, 50000, '2026-09-29', 'Kelebihan setelah lunas', walletId, 'IDR')

      const paymentLog = await db.loanPayments.where('loanId').equals(loanId).first()
      expect(paymentLog.principalAmount).toBe(0)
      expect(paymentLog.excessAmount).toBe(50000)

      const excessTxId = paymentLog.excessTransactionId
      expect(excessTxId).toBeTruthy()

      // Delete excess transaction
      await deleteTransaction(excessTxId)

      // Payment log should be completely deleted (no zombie record with amount: 0)
      const survivingLog = await db.loanPayments.get(paymentLog.id)
      expect(survivingLog).toBeUndefined()
    })
  })

  describe('6. Accounting engine historical balance sheet', () => {
    it('uses principalAmount ?? amount so overpayment excess does not inflate historical balance', () => {
      const loan = {
        id: 1,
        type: 'debt',
        totalAmount: 100000,
        remainingAmount: 0,
        currency: 'IDR',
        startDate: '2026-01-01',
      }

      // Payment happened on 2026-03-01 with excess 20,000 (total paid: 120,000, principal: 100,000)
      const loanPayments = [
        {
          id: 1,
          loanId: 1,
          date: '2026-03-01',
          amount: 120000,
          principalAmount: 100000,
          excessAmount: 20000,
        },
      ]

      // As of 2026-02-01 (before payment), the historical debt should be 100,000 (not 120,000)
      const balanceSheet = generateBalanceSheet([], [], [loan], {
        asOfDate: '2026-02-01',
        loanPayments,
      })

      expect(balanceSheet.liabilities.total).toBe(100000)
    })
  })
})
