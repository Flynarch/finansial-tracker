import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/lib/db'
import { deleteTransaction, createTransaction } from '../src/services/transactionService'
import useLoanStore from '../src/store/useLoanStore'
import { getCurrentBudgetMonthKey } from '../src/lib/budgetUtils'
import { computeFilteredTransactions } from '../src/hooks/useTransactionFilters'

describe('Audit Phase 4 Remediation - Data Integrity & Feature Tests', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.wallets.clear()
    await db.loans.clear()
    await db.loanPayments.clear()
    await db.goals.clear()
    await db.goalLogs.clear()
  })

  describe('Payday Budget Cycle - getCurrentBudgetMonthKey', () => {
    it('returns current month key when startDay is 1', () => {
      const date = new Date(2026, 2, 28) // March 28, 2026
      expect(getCurrentBudgetMonthKey(date, 1)).toBe('2026-03')
    })

    it('returns current month key before payday when startDay is 25', () => {
      const date = new Date(2026, 2, 24) // March 24, 2026
      expect(getCurrentBudgetMonthKey(date, 25)).toBe('2026-03')
    })

    it('advances to next month key on or after payday when startDay is 25', () => {
      const datePayday = new Date(2026, 2, 25) // March 25, 2026
      expect(getCurrentBudgetMonthKey(datePayday, 25)).toBe('2026-04')

      const dateLater = new Date(2026, 2, 31) // March 31, 2026
      expect(getCurrentBudgetMonthKey(dateLater, 25)).toBe('2026-04')
    })

    it('handles December year rollover properly', () => {
      const dateDec26 = new Date(2026, 11, 26) // Dec 26, 2026
      expect(getCurrentBudgetMonthKey(dateDec26, 25)).toBe('2027-01')
    })
  })

  describe('Savings Goal Deletion Reversal', () => {
    it('reverses goal.currentAmount and removes goalLog when deposit transaction is deleted', async () => {
      const goalId = await db.goals.add({
        name: 'Dana Darurat',
        targetAmount: 5000000,
        currentAmount: 1000000,
        status: 'active',
      })

      const walletId = await db.wallets.add({
        name: 'Dompet Utama',
        balance: 2000000,
        currency: 'IDR',
      })

      const txId = await createTransaction({
        amount: 250000,
        type: 'expense',
        category: 'tabungan',
        walletId,
        goalId,
        date: '2026-03-10',
        notes: 'Nabung darurat',
      })

      const logId = await db.goalLogs.add({
        goalId,
        amount: 250000,
        type: 'deposit',
        date: '2026-03-10',
        transactionId: txId,
      })

      await db.goals.update(goalId, { currentAmount: 1250000 })

      let goal = await db.goals.get(goalId)
      expect(goal.currentAmount).toBe(1250000)

      // Delete the deposit transaction
      await deleteTransaction(txId)

      // Verify goal amount was reversed
      goal = await db.goals.get(goalId)
      expect(goal.currentAmount).toBe(1000000)

      // Verify goalLog was removed
      const log = await db.goalLogs.get(logId)
      expect(log).toBeUndefined()
    })
  })

  describe('Split Bill Deletion Guard & Sync', () => {
    it('blocks deleting fronted expense (friendsTxId) if active participant loans exist', async () => {
      const walletId = await db.wallets.add({
        name: 'Dompet Utama',
        balance: 1000000,
        currency: 'IDR',
      })

      const splitBillId = 'sb_test_123'

      const friendsTxId = await createTransaction({
        amount: 150000,
        type: 'expense',
        category: 'Pinjaman Diberikan',
        walletId,
        splitBillId,
        date: '2026-03-10',
        notes: 'Split Bill Talangan Teman',
      })

      await db.loans.add({
        splitBillId,
        title: 'Makan Bareng Budi',
        personName: 'Budi',
        type: 'receivable',
        totalAmount: 75000,
        remainingAmount: 75000,
        status: 'active',
        initialTransactionId: friendsTxId,
      })

      // Attempting to delete friendsTxId while loan is active should throw
      await expect(deleteTransaction(friendsTxId)).rejects.toThrow(
        /talangan split bill dengan pinjaman aktif/i,
      )
    })

    it('preserves friendsTxId amount when a sibling loan is deleted (ledger immutability)', async () => {
      const walletId = await db.wallets.add({ name: 'Kas Utama', balance: 500000, currency: 'IDR' })
      const splitBillId = 'sb-sibling-test'

      // Fronted 150,000 for two friends (75,000 each)
      const friendsTxId = await db.transactions.add({
        amount: 150000,
        type: 'expense',
        category: 'Makanan',
        walletId,
        splitBillId,
        date: '2026-03-10',
        notes: 'Split Bill Talangan Teman',
      })

      const loan1Id = await db.loans.add({
        splitBillId,
        title: 'Makan Bareng Budi',
        personName: 'Budi',
        type: 'receivable',
        totalAmount: 75000,
        remainingAmount: 75000,
        status: 'active',
        initialTransactionId: friendsTxId,
      })

      await db.loans.add({
        splitBillId,
        title: 'Makan Bareng Andi',
        personName: 'Andi',
        type: 'receivable',
        totalAmount: 75000,
        remainingAmount: 75000,
        status: 'active',
        initialTransactionId: friendsTxId,
      })

      // Delete loan 1 via useLoanStore
      await useLoanStore.getState().deleteLoan(loan1Id)

      // friendsTxId amount should remain 150,000 intact to preserve immutable ledger history
      const tx = await db.transactions.get(friendsTxId)
      expect(tx).toBeDefined()
      expect(tx.amount).toBe(150000)
    })

    it('does not mutate walletId, date, or currency on shared initialTransactionId when updating a sibling split loan', async () => {
      const walletId1 = await db.wallets.add({ name: 'Kas Utama', balance: 500000, currency: 'IDR' })
      const walletId2 = await db.wallets.add({ name: 'Bank BCA', balance: 1000000, currency: 'IDR' })
      const splitBillId = 'sb-sibling-update-test'

      const friendsTxId = await db.transactions.add({
        amount: 200000,
        type: 'expense',
        category: 'Pinjaman Diberikan',
        walletId: walletId1,
        splitBillId,
        date: '2026-03-10',
        currency: 'IDR',
        notes: 'Split Bill Talangan',
      })

      const loanId = await db.loans.add({
        splitBillId,
        title: 'Makan Bareng Budi',
        personName: 'Budi',
        type: 'receivable',
        totalAmount: 100000,
        remainingAmount: 100000,
        status: 'active',
        walletId: walletId1,
        startDate: '2026-03-10',
        currency: 'IDR',
        initialTransactionId: friendsTxId,
      })

      // Update loan with different wallet, date, and currency
      await useLoanStore.getState().updateLoan(loanId, {
        walletId: walletId2,
        startDate: '2026-03-15',
        currency: 'USD',
      })

      // Shared friendsTxId must NOT have its walletId, date, or currency overwritten
      const tx = await db.transactions.get(friendsTxId)
      expect(tx.walletId).toBe(walletId1)
      expect(tx.date).toBe('2026-03-10')
      expect(tx.currency).toBe('IDR')
    })
  })

  describe('Split Transactions Filter & Search Support', () => {
    it('matches split transaction when searching inside split items', () => {
      const transactions = [
        {
          id: 1,
          notes: 'Belanja Bulanan',
          category: 'Supermarket',
          amount: 500000,
          date: '2026-03-10',
          type: 'expense',
          isSplit: true,
          splitItems: [
            { category: 'makanan', notes: 'Kopi Arabika Premium', amount: 80000 },
            { category: 'kebutuhan_rumah', notes: 'Sabun Cuci', amount: 420000 },
          ],
        },
      ]

      // Search matching split item note
      const filtered = computeFilteredTransactions(transactions, { search: 'arabika' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe(1)

      // Search non-matching term
      const noMatch = computeFilteredTransactions(transactions, { search: 'bensin' })
      expect(noMatch).toHaveLength(0)
    })

    it('matches split transaction when category filter matches any split item category', () => {
      const transactions = [
        {
          id: 1,
          notes: 'Belanja Campuran',
          category: 'Lainnya',
          amount: 300000,
          date: '2026-03-10',
          type: 'expense',
          isSplit: true,
          splitItems: [
            { category: 'makanan', notes: 'Makan siang', amount: 100000 },
            { category: 'transportasi', notes: 'Bensin', amount: 200000 },
          ],
        },
      ]

      // Filter by 'transportasi' category
      const filtered = computeFilteredTransactions(
        transactions,
        { categories: ['transportasi'] },
        false,
        true,
        true,
        5,
      )
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe(1)

      // Filter by 'hiburan' category
      const noMatch = computeFilteredTransactions(
        transactions,
        { categories: ['hiburan'] },
        false,
        true,
        true,
        5,
      )
      expect(noMatch).toHaveLength(0)
    })
  })
})
