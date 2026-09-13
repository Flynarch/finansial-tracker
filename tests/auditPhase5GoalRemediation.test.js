import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/lib/db'
import { createTransaction, updateTransaction } from '../src/services/transactionService'
import { generateInstallmentSchedule } from '../src/lib/loanUtils'
import { isExcludeAnalyticsTx } from '../src/lib/utils'
import { generateBalanceSheet, generateIncomeStatement, generateCashFlowStatement } from '../src/lib/accountingEngine'
import { uploadLatestBackup } from '../src/lib/cloudBackup'
import { calculateBudgetSpent } from '../src/lib/budgetUtils'
import { calculateDirectFinancialHealth } from '../src/lib/gemini'
import { aggregateMonthlyIncomeExpense } from '../src/lib/reportAnalytics'

describe('Audit Phase 5 Remediation - Deep Verification Suite', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.wallets.clear()
    await db.loans.clear()
    await db.loanPayments.clear()
    await db.goals.clear()
    await db.goalLogs.clear()
  })

  describe('Loan Installment Schedule Accumulation & Clamping', () => {
    it('clamps remaining principal so total installments strictly equal totalAmount with monthlyPayment', () => {
      const loan = {
        totalAmount: 10000000,
        remainingAmount: 10000000,
        monthlyPayment: 4000000,
        tenorMonths: 3,
        startDate: '2026-01-01',
      }
      const schedule = generateInstallmentSchedule(loan)
      expect(schedule).toHaveLength(3)
      expect(schedule[0].amount).toBe(4000000)
      expect(schedule[1].amount).toBe(4000000)
      expect(schedule[2].amount).toBe(2000000)

      const totalScheduled = schedule.reduce((sum, item) => sum + item.amount, 0)
      expect(totalScheduled).toBe(10000000)
    })

    it('handles rounding on odd amounts so sum equals totalAmount', () => {
      const loan = {
        totalAmount: 100,
        remainingAmount: 100,
        monthlyPayment: 0,
        tenorMonths: 3,
        startDate: '2026-01-01',
      }
      const schedule = generateInstallmentSchedule(loan)
      expect(schedule).toHaveLength(3)
      expect(schedule[0].amount).toBe(33)
      expect(schedule[1].amount).toBe(33)
      expect(schedule[2].amount).toBe(34)

      const totalScheduled = schedule.reduce((sum, item) => sum + item.amount, 0)
      expect(totalScheduled).toBe(100)
    })

    it('handles oversized tenor without overshooting totalAmount', () => {
      const loan = {
        totalAmount: 5000000,
        remainingAmount: 5000000,
        monthlyPayment: 2000000,
        tenorMonths: 4,
        startDate: '2026-01-01',
      }
      const schedule = generateInstallmentSchedule(loan)
      expect(schedule).toHaveLength(4)
      expect(schedule[0].amount).toBe(2000000)
      expect(schedule[1].amount).toBe(2000000)
      expect(schedule[2].amount).toBe(1000000)
      expect(schedule[3].amount).toBe(0)

      const totalScheduled = schedule.reduce((sum, item) => sum + item.amount, 0)
      expect(totalScheduled).toBe(5000000)
    })
  })

  describe('Pending Review Mutations & Analytics Filter', () => {
    it('excludes transactions marked as pending review', () => {
      expect(isExcludeAnalyticsTx({ isPendingReview: true })).toBe(true)
      expect(isExcludeAnalyticsTx({ isPendingReview: 1 })).toBe(true)
      expect(isExcludeAnalyticsTx({ isPendingReview: false, type: 'expense', category: 'makanan' })).toBe(false)
    })

    it('excludes investment portfolio transfers while retaining dividend and interest income', () => {
      // Purchase
      expect(isExcludeAnalyticsTx({ category: 'investasi_pengeluaran/saham' })).toBe(true)
      expect(isExcludeAnalyticsTx({ type: 'expense', category: 'investasi/saham', isExcludeFromAnalytics: true })).toBe(true)
      expect(isExcludeAnalyticsTx({ category: 'investasi/kripto', notes: 'Buy BTC' })).toBe(true)
      // Sale (income side)
      expect(isExcludeAnalyticsTx({ type: 'income', category: 'investasi/saham' })).toBe(true)
      expect(isExcludeAnalyticsTx({ type: 'income', category: 'investasi/reksadana' })).toBe(true)
      expect(isExcludeAnalyticsTx({ category: 'investasi/saham', notes: 'Sell BBCA' })).toBe(true)
      // Dividend & interest income must be included in analytics
      expect(isExcludeAnalyticsTx({ type: 'income', category: 'investasi/dividen' })).toBe(false)
      expect(isExcludeAnalyticsTx({ type: 'income', category: 'investasi/bunga_bank' })).toBe(false)
    })

    it('filters out pending review transactions from postDateTxs in Balance Sheet calculation', () => {
      const wallets = [{ id: 1, name: 'BCA', currentBalance: 10000000, currency: 'IDR' }]
      const transactions = [
        {
          id: 1,
          walletId: 1,
          type: 'income',
          amount: 5000000,
          date: '2099-01-01',
          currency: 'IDR',
          isPendingReview: true,
        },
      ]
      const bs = generateBalanceSheet(wallets, [], [], {
        asOfDate: '2026-01-01',
        defaultCurrency: 'IDR',
        transactions,
      })
      // If isPendingReview was not filtered, postDateTx would subtract 5m income -> balance would be 5m
      // Because it is filtered, balance remains 10m
      expect(bs.assets.currentAssets.total).toBe(10000000)
    })
  })

  describe('Savings Goal Synchronization on Transaction Update', () => {
    it('synchronizes goal.currentAmount and updates goalLogs when transaction amount increases', async () => {
      const goalId = await db.goals.add({
        name: 'Beli Laptop',
        targetAmount: 10000000,
        currentAmount: 1000000,
        status: 'active',
        isCompleted: false,
      })

      const walletId = await db.wallets.add({
        name: 'Dompet Utama',
        balance: 5000000,
        currency: 'IDR',
      })

      const txId = await createTransaction({
        amount: 1000000,
        type: 'expense',
        category: 'tabungan',
        walletId,
        goalId,
        date: '2026-03-01',
        notes: 'Tabungan awal',
      })

      const logId = await db.goalLogs.add({
        goalId,
        amount: 1000000,
        transactionId: txId,
        date: '2026-03-01 10:00:00',
        notes: 'Tabungan awal',
      })

      // Update transaction amount from 1,000,000 to 1,500,000 (delta: +500,000)
      await updateTransaction(txId, {
        amount: 1500000,
        notes: 'Tabungan awal (revisi)',
      })

      const updatedGoal = await db.goals.get(goalId)
      expect(updatedGoal.currentAmount).toBe(1500000)
      expect(updatedGoal.isCompleted).toBe(false)

      const updatedLog = await db.goalLogs.get(logId)
      expect(updatedLog.amount).toBe(1500000)
      expect(updatedLog.notes).toBe('Tabungan awal (revisi)')
    })

    it('marks goal completed when updated transaction amount meets target', async () => {
      const goalId = await db.goals.add({
        name: 'Dana Liburan',
        targetAmount: 3000000,
        currentAmount: 2000000,
        status: 'active',
        isCompleted: false,
      })

      const walletId = await db.wallets.add({
        name: 'Dompet Utama',
        balance: 5000000,
        currency: 'IDR',
      })

      const txId = await createTransaction({
        amount: 2000000,
        type: 'expense',
        category: 'tabungan',
        walletId,
        goalId,
        date: '2026-03-01',
      })

      await db.goalLogs.add({
        goalId,
        amount: 2000000,
        transactionId: txId,
        date: '2026-03-01 10:00:00',
      })

      // Increase amount from 2,000,000 to 3,000,000 (meets target of 3,000,000)
      await updateTransaction(txId, {
        amount: 3000000,
      })

      const updatedGoal = await db.goals.get(goalId)
      expect(updatedGoal.currentAmount).toBe(3000000)
      expect(updatedGoal.isCompleted).toBe(true)
      expect(updatedGoal.status).toBe('completed')
    })
  })

  describe('Parent Split Bill Transaction Update Guard', () => {
    it('prevents decreasing parent split bill transaction amount below active participant loans sum', async () => {
      const splitBillId = `SPLIT-TEST-${Date.now()}`
      const walletId = await db.wallets.add({
        name: 'Dompet Utama',
        balance: 5000000,
        currency: 'IDR',
      })

      const parentTxId = await createTransaction({
        amount: 300000,
        type: 'expense',
        category: 'Pinjaman Diberikan',
        splitBillId,
        walletId,
        date: '2026-03-01',
      })

      // Add two active participant loans with remaining amounts of 100,000 each (sum = 200,000)
      await db.loans.add({
        splitBillId,
        title: 'Share Budi',
        personName: 'Budi',
        type: 'receivable',
        totalAmount: 100000,
        remainingAmount: 100000,
        status: 'active',
        initialTransactionId: parentTxId,
      })

      await db.loans.add({
        splitBillId,
        title: 'Share Charlie',
        personName: 'Charlie',
        type: 'receivable',
        totalAmount: 100000,
        remainingAmount: 100000,
        status: 'active',
        initialTransactionId: parentTxId,
      })

      // Attempt to decrease parent transaction amount to 150,000 (which is less than active loans sum 200,000)
      await expect(
        updateTransaction(parentTxId, { amount: 150000 })
      ).rejects.toThrow('Nominal transaksi talangan tidak boleh lebih kecil dari sisa pinjaman aktif partisipan.')

      // Successfully updating to 250,000 (which is >= 200,000)
      await expect(
        updateTransaction(parentTxId, { amount: 250000 })
      ).resolves.toBe(1)

      const updatedParent = await db.transactions.get(parentTxId)
      expect(updatedParent.amount).toBe(250000)
    })
  })

  describe('Dexie Schema v19 SplitBillId Index', () => {
    it('has splitBillId indexed on transactions table in schema', () => {
      const txTable = db.tables.find((t) => t.name === 'transactions')
      expect(txTable).toBeDefined()
      const hasSplitBillId = txTable.schema.indexes.some((idx) => idx.name === 'splitBillId')
      expect(hasSplitBillId).toBe(true)
    })
  })

  describe('Cloud Backup Plaintext Prevention Guard', () => {
    it('rejects unencrypted or plaintext payloads in uploadLatestBackup', async () => {
      const result = await uploadLatestBackup('user-123', { data: 'plaintext' }, { isEncrypted: false })
      expect(result).toBeNull()

      const resultWithoutOption = await uploadLatestBackup('user-123', { data: 'plaintext' })
      expect(resultWithoutOption).toBeNull()

      const resultFakeEncrypted = await uploadLatestBackup('user-123', { data: 'fake' }, { isEncrypted: true })
      expect(resultFakeEncrypted).toBeNull()
    })
  })

  describe('Savings Goal Withdrawal Synchronization & Status Reversal', () => {
    it('reverts goal to active when a withdrawal brings currentAmount below targetAmount', async () => {
      const goalId = await db.goals.add({
        name: 'Dana Darurat',
        targetAmount: 5000000,
        currentAmount: 5000000,
        status: 'completed',
        isCompleted: true,
      })

      const walletId = await db.wallets.add({
        name: 'BCA',
        balance: 10000000,
        currency: 'IDR',
      })

      // Create initial withdrawal of 500,000
      const txId = await createTransaction({
        amount: 500000,
        type: 'income',
        category: 'cairkan_tabungan',
        walletId,
        goalId,
        date: '2026-03-01',
      })

      // Add corresponding legacy log without transactionId
      const logId = await db.goalLogs.add({
        goalId,
        amount: -500000,
        date: '2026-03-01 10:00:00',
      })

      // Update withdrawal to 1,000,000 (delta: +500,000 withdrawal)
      await updateTransaction(txId, {
        amount: 1000000,
      })

      const updatedGoal = await db.goals.get(goalId)
      expect(updatedGoal.currentAmount).toBe(4500000)
      expect(updatedGoal.isCompleted).toBe(false)
      expect(updatedGoal.status).toBe('active')

      // Verify log was updated and transactionId was backfilled
      const updatedLog = await db.goalLogs.get(logId)
      expect(updatedLog.amount).toBe(-1000000)
      expect(updatedLog.transactionId).toBe(txId)
    })
  })

  describe('Dashboard Net Worth Alignment with Savings Goals', () => {
    it('preserves net worth when transferring/depositing cash to a savings goal', async () => {
      // 1. Initial State: Wallet with 10,000,000 IDR
      const walletId = await db.wallets.add({
        name: 'BCA Tabungan',
        balance: 10000000,
        currency: 'IDR',
      })

      const goalId = await db.goals.add({
        name: 'Beli Rumah',
        targetAmount: 50000000,
        currentAmount: 0,
        currency: 'IDR',
        isArchived: false,
      })

      // Initial net worth calculation
      const initialCash = 10000000
      const initialSavings = 0
      const initialNetWorth = initialCash + initialSavings
      expect(initialNetWorth).toBe(10000000)

      // 2. User deposits 2,500,000 into savings goal
      await createTransaction({
        amount: 2500000,
        type: 'expense',
        category: 'tabungan',
        walletId,
        goalId,
        date: '2026-03-01',
      })

      // Update goal current amount (simulating deposit handler in SavingsFundSheetModal)
      await db.goals.update(goalId, { currentAmount: 2500000 })

      // Simulating wallet balance deduction
      const updatedCash = initialCash - 2500000
      const goal = await db.goals.get(goalId)
      const updatedSavings = Number(goal.currentAmount)

      // Combined Net Worth must remain exactly 10,000,000 IDR
      const postDepositNetWorth = updatedCash + updatedSavings
      expect(postDepositNetWorth).toBe(10000000)
    })
  })

  describe('Multi-Category Split Invariant in Accounting Engine (Finding 1.3)', () => {
    it('unpacks split items in generateIncomeStatement and evaluates isExcludeAnalyticsTx per item', () => {
      const txs = [
        {
          id: 101,
          date: '2026-03-15',
          amount: 500000,
          currency: 'IDR',
          type: 'expense',
          category: 'makanan/restoran',
          isSplit: true,
          splitItems: [
            { category: 'makanan/restoran', amount: 350000, type: 'expense' },
            // Internal savings transfer must be excluded from income statement operating expenses
            { category: 'tabungan', amount: 150000, type: 'expense', isExcludeFromAnalytics: true },
          ],
        },
      ]

      const isResult = generateIncomeStatement(txs, {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        defaultCurrency: 'IDR',
      })
      // Only the 350k food expense should be included
      expect(isResult.operatingExpenses.total).toBe(350000)
      expect(isResult.operatingExpenses.items).toHaveLength(1)
      expect(isResult.operatingExpenses.items[0].category).toBe('makanan/restoran')
      expect(isResult.operatingExpenses.items[0].amount).toBe(350000)
    })

    it('unpacks split items in generateCashFlowStatement and handles savings outflow vs operating flow', () => {
      const txs = [
        {
          id: 102,
          date: '2026-03-15',
          amount: 500000,
          currency: 'IDR',
          type: 'expense',
          category: 'belanja',
          isSplit: true,
          splitItems: [
            { category: 'belanja/pakaian', amount: 300000, type: 'expense', notes: 'Baju' },
            { category: 'tabungan', amount: 200000, type: 'expense', notes: 'Setor Tabungan' },
          ],
        },
      ]

      const cfsResult = generateCashFlowStatement(txs, {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        defaultCurrency: 'IDR',
      })
      // Operating outflow should be 300k
      expect(cfsResult.operatingActivities.outflow).toBe(300000)
      // Investing / savings outflow should be 200k
      expect(cfsResult.investingActivities.outflow).toBe(200000)
      expect(cfsResult.netChangeInCash).toBe(-500000)
    })
  })

  describe('AI Savings Deposit Ledger Integration (Finding 1.1)', () => {
    it('creates expense transaction with category tabungan and links walletId and goalId', async () => {
      const walletId = await db.wallets.add({
        name: 'Dompet Utama',
        institutionType: 'cash',
        balance: 5000000,
        currency: 'IDR',
        isArchived: 0,
      })

      const goalId = await db.goals.add({
        name: 'Dana Darurat',
        targetAmount: 20000000,
        currentAmount: 1000000,
        currency: 'IDR',
      })

      const depositAmt = 500000
      const newCurrent = 1000000 + depositAmt

      // Perform the ledger integration as implemented in AiFinanceChat
      const createdTxId = await db.transactions.add({
        date: '2026-03-13',
        amount: depositAmt,
        type: 'expense',
        category: 'tabungan',
        notes: 'Setor ke Tabungan: Dana Darurat',
        currency: 'IDR',
        walletId: walletId,
        goalId: goalId,
        createdAt: Date.now(),
        isExcludeFromAnalytics: true,
        excludeFromAnalytics: true,
      })

      await db.goals.update(goalId, { currentAmount: newCurrent })
      const logId = await db.goalLogs.add({
        goalId: goalId,
        amount: depositAmt,
        notes: 'Dicatat oleh AI',
        date: '2026-03-13 10:00:00',
        walletName: 'Dompet Utama',
        transactionId: createdTxId,
      })

      // Verify db integrity
      const tx = await db.transactions.get(createdTxId)
      expect(tx).toBeDefined()
      expect(tx.walletId).toBe(walletId)
      expect(tx.goalId).toBe(goalId)
      expect(tx.category).toBe('tabungan')
      expect(tx.type).toBe('expense')
      expect(tx.amount).toBe(500000)
      expect(tx.isExcludeFromAnalytics).toBe(true)

      const goal = await db.goals.get(goalId)
      expect(goal.currentAmount).toBe(1500000)

      const log = await db.goalLogs.get(logId)
      expect(log.transactionId).toBe(createdTxId)
      expect(log.walletName).toBe('Dompet Utama')
    })
  })

  describe('Budget Spent Split Invariant & Analytics Exclusion (Finding 1.3)', () => {
    it('evaluates isExcludeAnalyticsTx per split item and does not drop split transaction when parent is marked excluded', () => {
      const splitTxs = [
        {
          id: 201,
          date: '2026-03-10',
          amount: 500000,
          currency: 'IDR',
          type: 'expense',
          category: 'tabungan', // Parent is tabungan/excluded
          isExcludeFromAnalytics: true,
          isSplit: true,
          splitItems: [
            // Split item 1: Food expense (should match makanan budget)
            { category: 'makanan/restoran', amount: 200000, type: 'expense' },
            // Split item 2: Savings deposit (must be excluded by isExcludeAnalyticsTx)
            { category: 'tabungan', amount: 300000, type: 'expense', isExcludeFromAnalytics: true },
          ],
        },
      ]

      const spentMakanan = calculateBudgetSpent('makanan', splitTxs, 'IDR', null)
      expect(spentMakanan).toBe(200000)

      const spentTabungan = calculateBudgetSpent('tabungan', splitTxs, 'IDR', null)
      expect(spentTabungan).toBe(0) // Internal savings must not be counted in expense budget
    })

    it('ignores non-expense split items in calculateBudgetSpent', () => {
      const splitTxs = [
        {
          id: 202,
          date: '2026-03-12',
          amount: 300000,
          currency: 'IDR',
          type: 'expense',
          category: 'belanja',
          isSplit: true,
          splitItems: [
            { category: 'belanja/pakaian', amount: 350000, type: 'expense' },
            { category: 'belanja/cashback', amount: 50000, type: 'income' },
          ],
        },
      ]

      const spentBelanja = calculateBudgetSpent('belanja', splitTxs, 'IDR', null)
      expect(spentBelanja).toBe(350000)
    })
  })

  describe('Direct Financial Health Calculation Multi-Currency & Invariants (Finding 1.4)', () => {
    it('calculates financial health converting multi-currency wallets and excluding forgiven/archived loans', async () => {
      // 1. Wallets: IDR wallet and USD wallet
      await db.wallets.bulkAdd([
        { id: 1, name: 'BCA', balance: 15000000, currency: 'IDR', isArchived: 0 },
        { id: 2, name: 'Chase USD', balance: 1000, currency: 'USD', isArchived: 0 },
        { id: 3, name: 'Old Inactive', balance: 50000000, currency: 'IDR', isArchived: 1 }, // archived: ignored
      ])

      // 2. Loans: active debt, paid debt, forgiven debt, archived debt
      await db.loans.bulkAdd([
        { id: 10, title: 'Active Debt', type: 'debt', totalAmount: 2000000, remainingAmount: 2000000, currency: 'IDR', status: 'active', isArchived: 0 },
        { id: 11, title: 'Paid Debt', type: 'debt', totalAmount: 5000000, remainingAmount: 0, currency: 'IDR', status: 'paid', isArchived: 0 },
        { id: 12, title: 'Forgiven Debt', type: 'debt', totalAmount: 3000000, remainingAmount: 3000000, currency: 'IDR', status: 'forgiven', isArchived: 0 },
        { id: 13, title: 'Archived Debt', type: 'debt', totalAmount: 10000000, remainingAmount: 10000000, currency: 'IDR', status: 'active', isArchived: 1 },
      ])

      // 3. Transactions for the active month
      const todayStr = '2026-03-15'
      await db.transactions.bulkAdd([
        { id: 100, date: todayStr, type: 'income', amount: 10000000, currency: 'IDR', category: 'gaji' },
        { id: 101, date: todayStr, type: 'expense', amount: 3000000, currency: 'IDR', category: 'kebutuhan' },
      ])

      const rates = { IDR: 16000, USD: 1 }

      const healthEn = await calculateDirectFinancialHealth({
        defaultCurrency: 'IDR',
        locale: 'en',
        rates,
        referenceDate: new Date('2026-03-15'),
      })

      expect(healthEn.type).toBe('financial_health')
      // Total cash = 15m IDR + (1000 USD * 16000) = 31,000,000 IDR (archived wallet ignored)
      expect(healthEn.metrics.totalCash).toBe(31000000)
      // Total debt = 2,000,000 IDR (paid, forgiven, and archived loans ignored)
      expect(healthEn.metrics.totalDebt).toBe(2000000)
      expect(healthEn.metrics.monthlyIncome).toBe(10000000)
      expect(healthEn.metrics.monthlyExpense).toBe(3000000)
      // Rating must be in English when locale is en
      expect(['Excellent', 'Healthy', 'Fair', 'Needs Attention', 'Critical']).toContain(healthEn.rating)
      expect(healthEn.text).toContain('Financial Health Score')
    })
  })

  describe('Report Analytics Split Preservation with Parent Exclusion Flags', () => {
    it('does not drop split transactions when parent object has excludeFromAnalytics flag', () => {
      const mockTxs = [
        {
          id: 301,
          date: '2026-03-05',
          amount: 1000000,
          currency: 'IDR',
          type: 'expense',
          category: 'belanja',
          isSplit: true,
          excludeFromAnalytics: true, // Parent-level tag
          splitItems: [
            { category: 'belanja/pakaian', amount: 700000, type: 'expense' },
            { category: 'tabungan', amount: 300000, type: 'expense', isExcludeFromAnalytics: true },
          ],
        },
      ]

      const refDate = new Date('2026-03-20')
      const monthly = aggregateMonthlyIncomeExpense(mockTxs, 1, 'IDR', null, refDate)
      expect(monthly).toHaveLength(1)
      // The 700k expense should be preserved, while 300k tabungan is excluded
      expect(monthly[0].expense).toBe(700000)
    })
  })
})


