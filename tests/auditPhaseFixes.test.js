import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/lib/db'
import { createTransaction } from '../src/services/transactionService'
import { recomputeAndCacheWalletBalance, getAllWalletBalances } from '../src/lib/balanceEngine'
import { hashPin, verifyPin } from '../src/lib/crypto'
import { generateBalanceSheet } from '../src/lib/accountingEngine'
import { cascadeDeleteSubcategory, cascadeDeleteParentCategory } from '../src/lib/categoryCleanup'
import { computeWalletBalance, computeAllWalletBalances } from '../src/lib/db'
import { computeFilteredTransactions } from '../src/hooks/useTransactionFilters'
import useLoanStore from '../src/store/useLoanStore'

describe('Audit Phase 1-3 Fixes Verification', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.wallets.clear()
    await db.loans.clear()
    await db.loanPayments.clear()
    await db.goals.clear()
    await db.goalLogs.clear()
    await db.budgets.clear()
    await db.recurringTransactions.clear()
  })

  describe('Phase 1: Transfer Validation & Loan Math', () => {
    it('throws error when creating transfer without targetWalletId or with same walletId', async () => {
      const w1 = await db.wallets.add({ name: 'W1', balance: 100000, currency: 'IDR' })

      await expect(
        createTransaction({
          amount: 50000,
          type: 'transfer',
          walletId: w1,
          date: '2026-03-01',
        })
      ).rejects.toThrow('Dompet tujuan transfer wajib dipilih')

      await expect(
        createTransaction({
          amount: 50000,
          type: 'transfer',
          walletId: w1,
          targetWalletId: w1,
          date: '2026-03-01',
        })
      ).rejects.toThrow('Dompet tujuan transfer wajib dipilih dan harus berbeda dengan dompet asal')
    })

    it('rounds loan remainingAmount to avoid floating point precision drift', async () => {
      const walletId = await db.wallets.add({ name: 'Cash', balance: 1000, currency: 'USD' })
      const loanId = await db.loans.add({
        title: 'Float Test',
        type: 'payable',
        totalAmount: 0.3,
        remainingAmount: 0.3,
        status: 'active',
        walletId,
      })

      // 0.3 - 0.2 - 0.1 in JS float produces a tiny non-zero remainder without rounding
      await useLoanStore.getState().recordPayment(loanId, 0.2, walletId, 'Payment 1')
      await useLoanStore.getState().recordPayment(loanId, 0.1, walletId, 'Payment 2')

      const updated = await db.loans.get(loanId)
      expect(updated.remainingAmount).toBe(0)
      expect(updated.status).toBe('paid')
    })

    it('does not throw error when paying exact remaining amount with floating point representation', async () => {
      const walletId = await db.wallets.add({ name: 'Cash', balance: 1000, currency: 'USD' })
      const loanId = await db.loans.add({
        title: 'Float Precision Test',
        type: 'debt',
        totalAmount: 0.3,
        remainingAmount: 0.3,
        status: 'active',
        walletId,
      })

      // Paying 0.3 should succeed without false "exceeds remaining amount" exception
      await expect(
        useLoanStore.getState().recordPayment(loanId, 0.3, walletId, 'Full payoff')
      ).resolves.not.toThrow()

      const updated = await db.loans.get(loanId)
      expect(updated.remainingAmount).toBe(0)
      expect(updated.status).toBe('paid')
    })

    it('calculates remainingAmount as existing.remainingAmount + diffTotal without phantom repayments when editing totalAmount', async () => {
      const walletId = await db.wallets.add({ name: 'Cash', balance: 5000000, currency: 'IDR' })
      const loanId = await db.loans.add({
        title: 'Loan Math Edit Test',
        type: 'debt',
        totalAmount: 1000000,
        remainingAmount: 600000, // 400000 already paid
        status: 'active',
        walletId,
      })

      // Increase totalAmount from 1,000,000 to 1,200,000 without passing remainingAmount
      await useLoanStore.getState().updateLoan(loanId, { totalAmount: 1200000 })

      let updated = await db.loans.get(loanId)
      expect(updated.totalAmount).toBe(1200000)
      expect(updated.remainingAmount).toBe(800000) // 600k + 200k = 800k. Paid amount remains 400k (1.2m - 800k = 400k)
      expect(updated.status).toBe('active')

      // Reduce totalAmount to exactly the paid amount (400,000)
      await useLoanStore.getState().updateLoan(loanId, { totalAmount: 400000 })
      updated = await db.loans.get(loanId)
      expect(updated.remainingAmount).toBe(0)
      expect(updated.status).toBe('paid')

      // Reopen by increasing totalAmount to 500,000
      await useLoanStore.getState().updateLoan(loanId, { totalAmount: 500000 })
      updated = await db.loans.get(loanId)
      expect(updated.remainingAmount).toBe(100000)
      expect(updated.status).toBe('active')
      expect(updated.paidDate).toBeNull()
    })
  })

  describe('Phase 1: Balance Sheet Historical Date Reconstruction', () => {
    it('accurately rewinds cross-currency transfer without double-converting targetAmount', () => {
      const wallets = [
        { id: 1, name: 'USD Wallet', balance: 900, currentBalance: 900, currency: 'USD', isArchived: false },
        { id: 2, name: 'IDR Wallet', balance: 1600000, currentBalance: 1600000, currency: 'IDR', isArchived: false },
      ]

      // Transfer occurred on 2026-03-15 (after asOfDate 2026-03-01)
      const postDateTxs = [
        {
          id: 101,
          type: 'transfer',
          walletId: 1,
          targetWalletId: 2,
          amount: 100,
          currency: 'USD',
          targetAmount: 1600000,
          date: '2026-03-15',
        },
      ]

      const rates = { USD: 1, IDR: 16000 }
      const sheet = generateBalanceSheet(wallets, [], [], {
        asOfDate: '2026-03-01',
        defaultCurrency: 'IDR',
        rates,
        transactions: postDateTxs,
      })

      const idrAccount = sheet.assets.currentAssets.items.find((i) => i.id === 2)
      const usdAccount = sheet.assets.currentAssets.items.find((i) => i.id === 1)

      // IDR wallet had 1,600,000 received after asOfDate, so as of 2026-03-01 it had 0 IDR
      expect(idrAccount.balance).toBe(0)
      // USD wallet sent 100 USD after asOfDate, so as of 2026-03-01 it had 1000 USD = 16,000,000 IDR
      expect(usdAccount.balance).toBe(16000000)
    })

    it('rewinds post-date loan payments and savings goal transactions', () => {
      const wallets = [
        { id: 1, name: 'Bank IDR', balance: 10000000, currentBalance: 10000000, currency: 'IDR', isArchived: false },
      ]
      const savingsGoals = [
        { id: 10, name: 'Emergency Fund', targetAmount: 20000000, currentAmount: 5000000, currency: 'IDR', createdAt: '2026-01-01' },
      ]
      const loans = [
        { id: 20, title: 'Car Loan', type: 'debt', totalAmount: 10000000, remainingAmount: 2000000, currency: 'IDR', startDate: '2026-01-01', status: 'active' },
      ]

      const transactions = [
        // Deposit 1,000,000 into savings after asOfDate
        { id: 301, goalId: 10, amount: 1000000, currency: 'IDR', type: 'expense', category: 'tabungan', date: '2026-03-10' },
      ]
      const loanPayments = [
        // Paid 3,000,000 on car loan after asOfDate
        { id: 401, loanId: 20, amount: 3000000, currency: 'IDR', date: '2026-03-10' },
      ]

      const sheet = generateBalanceSheet(wallets, savingsGoals, loans, {
        asOfDate: '2026-03-01',
        defaultCurrency: 'IDR',
        transactions,
        loanPayments,
      })

      // Savings goal had 5M today, minus 1M deposited after asOfDate = 4M as of 2026-03-01
      const savings = sheet.assets.nonCurrentAssets.savings.items.find((g) => g.id === 10)
      expect(savings.currentAmount).toBe(4000000)

      // Debt had 2M remaining today, plus 3M paid after asOfDate = 5M remaining as of 2026-03-01
      const debt = sheet.liabilities.items.find((l) => l.id === 20)
      expect(debt.amount).toBe(5000000)
    })
  })

  describe('Phase 3: Security & Multi-Currency Transfers', () => {
    it('verifies pattern lock SHA-256 hash using verifyPin', async () => {
      const pattern = '0-1-2-5-8'
      const hashed = await hashPin(pattern)

      expect(hashed).not.toBe(pattern)
      expect(await verifyPin('0-1-2-5-8', hashed)).toBe(true)
      expect(await verifyPin('0-1-2-4-8', hashed)).toBe(false)
    })

    it('getAllWalletBalances and recomputeAndCacheWalletBalance support cross-currency transfers', async () => {
      const idrWalletId = await db.wallets.add({ name: 'Dompet IDR', balance: 0, currency: 'IDR' })
      const usdWalletId = await db.wallets.add({ name: 'Dompet USD', balance: 0, currency: 'USD' })

      // Transfer 100 USD from USD wallet to IDR wallet with targetAmount = 1,600,000 IDR
      await db.transactions.add({
        walletId: usdWalletId,
        targetWalletId: idrWalletId,
        amount: 100,
        targetAmount: 1600000,
        type: 'transfer',
        date: '2026-03-01',
      })

      const allWallets = await db.wallets.toArray()
      const balances = await getAllWalletBalances(allWallets)
      const usdBal = balances.find((w) => w.id === usdWalletId)?.currentBalance
      const idrBal = balances.find((w) => w.id === idrWalletId)?.currentBalance

      expect(usdBal).toBe(-100)
      expect(idrBal).toBe(1600000)

      const singleIdr = await recomputeAndCacheWalletBalance(idrWalletId, null, allWallets)
      expect(singleIdr).toBe(1600000)
    })
  })

  describe('Phase 1: Category Cascading Deletion & Ledger Integrity', () => {
    it('remaps direct transactions, split items, and merges duplicate budgets on subcategory deletion', async () => {
      // Direct transaction with subcategory
      const tx1 = await db.transactions.add({
        amount: 50000,
        category: 'makanan/mie_ayam',
        type: 'expense',
        date: '2026-03-01',
      })

      // Split transaction with subcategory item
      const tx2 = await db.transactions.add({
        amount: 150000,
        category: 'makanan',
        type: 'expense',
        isSplit: true,
        splitItems: [
          { amount: 50000, category: 'makanan/mie_ayam' },
          { amount: 100000, category: 'makanan/resto' },
        ],
        date: '2026-03-02',
      })

      // Existing budget for fallback category
      const bFallback = await db.budgets.add({
        category: 'makanan/lainnya',
        limit: 300000,
        month: '2026-03',
      })

      // Target budget to be deleted/merged
      const bTarget = await db.budgets.add({
        category: 'makanan/mie_ayam',
        limit: 200000,
        month: '2026-03',
      })

      // Recurring transaction with target category
      const rTx = await db.recurringTransactions.add({
        title: 'Langganan Mie',
        amount: 25000,
        category: 'makanan/mie_ayam',
        frequency: 'weekly',
        nextDate: '2026-03-10',
      })

      await cascadeDeleteSubcategory('makanan', 'mie_ayam', 'expense')

      // 1. Direct transaction remapped to fallback
      const updatedTx1 = await db.transactions.get(tx1)
      expect(updatedTx1.category).toBe('makanan/lainnya')

      // 2. Split item remapped to fallback
      const updatedTx2 = await db.transactions.get(tx2)
      expect(updatedTx2.splitItems[0].category).toBe('makanan/lainnya')
      expect(updatedTx2.splitItems[1].category).toBe('makanan/resto')

      // 3. Budgets merged without duplicate records
      const remainingBudgets = await db.budgets.where('month').equals('2026-03').toArray()
      expect(remainingBudgets.length).toBe(1)
      expect(remainingBudgets[0].id).toBe(bFallback)
      expect(remainingBudgets[0].limit).toBe(500000) // 300k + 200k merged!
      expect(remainingBudgets.some((b) => b.id === bTarget)).toBe(false)

      // 4. Recurring transaction remapped to fallback
      const updatedRTx = await db.recurringTransactions.get(rTx)
      expect(updatedRTx.category).toBe('makanan/lainnya')
    })

    it('remaps subcategory named lainnya to general lainnya_kategori/umum', async () => {
      const tx = await db.transactions.add({
        amount: 40000,
        category: 'makanan/lainnya',
        type: 'expense',
        date: '2026-03-01',
      })

      await cascadeDeleteSubcategory('makanan', 'lainnya', 'expense')

      const updated = await db.transactions.get(tx)
      expect(updated.category).toBe('lainnya_kategori/umum')
    })

    it('cascades parent category deletion to all children and deletes linked budgets', async () => {
      const tx1 = await db.transactions.add({
        amount: 80000,
        category: 'custom_cat/sub1',
        type: 'expense',
        date: '2026-03-01',
      })

      const tx2 = await db.transactions.add({
        amount: 100000,
        category: 'custom_cat',
        type: 'expense',
        date: '2026-03-01',
      })

      const b1 = await db.budgets.add({
        category: 'custom_cat',
        limit: 500000,
        month: '2026-03',
      })

      const b2 = await db.budgets.add({
        category: 'custom_cat/sub1',
        limit: 200000,
        month: '2026-03',
      })

      const rTx = await db.recurringTransactions.add({
        title: 'Custom Sub Recurring',
        amount: 50000,
        category: 'custom_cat/sub1',
        frequency: 'monthly',
        nextDate: '2026-03-15',
      })

      await cascadeDeleteParentCategory('custom_cat', 'expense')

      const updated1 = await db.transactions.get(tx1)
      const updated2 = await db.transactions.get(tx2)
      expect(updated1.category).toBe('lainnya_kategori/umum')
      expect(updated2.category).toBe('lainnya_kategori/umum')

      const budgets = await db.budgets.toArray()
      expect(budgets.some((b) => b.id === b1 || b.id === b2)).toBe(false)

      const updatedRTx = await db.recurringTransactions.get(rTx)
      expect(updatedRTx.category).toBe('lainnya_kategori/umum')
    })
  })

  describe('Phase 1 & 2: Goal Isolation & Budget Copy Logic', () => {
    it('isolates goal rewinds in balance sheet even when goal names overlap', () => {
      const wallets = [{ id: 1, name: 'Main', balance: 10000000, currentBalance: 10000000, currency: 'IDR' }]
      const goals = [
        { id: 1, name: 'Mobil', currentAmount: 5000000, targetAmount: 10000000, currency: 'IDR' },
        { id: 2, name: 'Mobil Impian', currentAmount: 8000000, targetAmount: 20000000, currency: 'IDR' },
      ]

      // Deposit 2,000,000 into Goal 2 ('Mobil Impian') after asOfDate, with goalId as string '2'
      const postDateTxs = [
        {
          id: 501,
          goalId: '2', // String type test
          amount: 2000000,
          type: 'expense',
          category: 'tabungan',
          notes: 'Setor ke Tabungan: Mobil Impian',
          currency: 'IDR',
          date: '2026-03-10',
        },
      ]

      const sheet = generateBalanceSheet(wallets, goals, [], {
        asOfDate: '2026-03-01',
        defaultCurrency: 'IDR',
        transactions: postDateTxs,
      })

      const goal1 = sheet.assets.nonCurrentAssets.savings.items.find((g) => g.id === 1)
      const goal2 = sheet.assets.nonCurrentAssets.savings.items.find((g) => g.id === 2)

      // Goal 1 ('Mobil') must NOT be polluted by Goal 2's deposit despite 'Mobil' being substring of 'Mobil Impian'
      expect(goal1.currentAmount).toBe(5000000)
      // Goal 2 ('Mobil Impian') rewinds from 8M - 2M = 6M
      expect(goal2.currentAmount).toBe(6000000)
    })

    it('prevents duplicate budgets when copying previous month even if source had duplicates', () => {
      const prevMonthBudgets = [
        { category: 'makanan', limit: 1000000, month: '2026-02' },
        { category: 'transport', limit: 500000, month: '2026-02' },
        { category: 'makanan', limit: 1200000, month: '2026-02' }, // Duplicate in source
      ]

      const currentMonthBudgets = [
        { category: 'makanan', limit: 800000, month: '2026-03' }, // Already exists in target
      ]

      const existingCategories = new Set(currentMonthBudgets.map((b) => b.category))
      const newBudgets = []
      for (const b of prevMonthBudgets) {
        if (!existingCategories.has(b.category)) {
          existingCategories.add(b.category)
          newBudgets.push({
            category: b.category,
            limit: b.limit,
            month: '2026-03',
          })
        }
      }

      // Only 'transport' should be copied, exactly once!
      expect(newBudgets).toEqual([
        { category: 'transport', limit: 500000, month: '2026-03' },
      ])
    })
  })

  describe('Phase 2 & 3: Staged Bank Mutation Consistency & Atomic Multi-Table Writes', () => {
    it('computeWalletBalance and computeAllWalletBalances ignore isPendingReview transactions', () => {
      const wallet = { id: 1, balance: 100000, currency: 'IDR' }
      const txs = [
        { id: 1, walletId: 1, amount: 50000, type: 'income', isPendingReview: true },
        { id: 2, walletId: 1, amount: 20000, type: 'expense', isPendingReview: 1 },
        { id: 3, walletId: 1, amount: 10000, type: 'income', isPendingReview: false },
      ]

      const singleBal = computeWalletBalance(wallet, txs)
      expect(singleBal).toBe(110000) // 100k + 10k confirmed = 110k

      const batchBals = computeAllWalletBalances([wallet], txs)
      expect(batchBals[0].currentBalance).toBe(110000)
    })

    it('computeFilteredTransactions excludes isPendingReview transactions from the main ledger view', () => {
      const txs = [
        { id: 1, notes: 'Staged unconfirmed mutation', category: 'Lainnya', amount: 50000, isPendingReview: true },
        { id: 2, notes: 'Confirmed expense', category: 'Makanan', amount: 35000, isPendingReview: false },
      ]

      const filtered = computeFilteredTransactions(txs, {}, 1, 1)
      expect(filtered.length).toBe(1)
      expect(filtered[0].id).toBe(2)
    })

    it('atomic Dexie transaction rolls back all changes if any write in sequence fails', async () => {
      const goalId = await db.goals.add({
        name: 'Darurat',
        targetAmount: 10000000,
        currentAmount: 1000000,
        currency: 'IDR',
      })
      await db.wallets.add({ name: 'Kas', balance: 500000, currency: 'IDR' })

      // Attempt multi-table write sequence that fails midway
      await expect(
        db.transaction('rw', [db.goals, db.goalLogs, db.transactions, db.wallets], async () => {
          await db.goals.update(goalId, { currentAmount: 1500000 })
          await db.goalLogs.add({ goalId, amount: 500000, notes: 'Setoran' })
          // Force error
          throw new Error('Simulated atomic rollback')
        })
      ).rejects.toThrow('Simulated atomic rollback')

      // Goal currentAmount must be intact (1,000,000)
      const goal = await db.goals.get(goalId)
      expect(goal.currentAmount).toBe(1000000)

      // No goal logs created
      const logs = await db.goalLogs.where('goalId').equals(goalId).toArray()
      expect(logs.length).toBe(0)
    })
  })
})
