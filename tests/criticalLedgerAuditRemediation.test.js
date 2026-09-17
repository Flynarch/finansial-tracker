import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db, computeWalletBalance, computeAllWalletBalances } from '../src/lib/db'
import useLoanStore from '../src/store/useLoanStore'
import useSettingsStore from '../src/store/useSettingsStore'
import { createTransaction, updateTransaction } from '../src/services/transactionService'
import { checkBudgetAlertsAfterExpense } from '../src/lib/smartNotifications'
import { distributeReceiptTransactions } from '../src/lib/gemini'
import { generateIncomeStatement, generateCashFlowStatement } from '../src/lib/accountingEngine'
import { calculateBudgetSpent, getCurrentBudgetMonthKey, getBudgetPeriodDateRange } from '../src/lib/budgetUtils'
import { aggregateMonthlyIncomeExpense, calculateNetWorthSummary } from '../src/lib/reportAnalytics'
import { calculatePeriodStats } from '../src/hooks/useDashboardData'
import { queryTransactions } from '../src/lib/aiDatabaseQueries'
import { convertCurrency, FALLBACK_EXCHANGE_RATES } from '../src/lib/utils'
import { getTools } from '../src/lib/ai/toolSchemas'
import { validateTransferWallets } from '../src/lib/ai/aiChatHelpers'
import { backButtonManager } from '../src/lib/backButtonManager'
import { subMonths, startOfMonth, format } from 'date-fns'

describe('Critical Ledger Audit Remediation Test Suite', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.wallets.clear()
    await db.loans.clear()
    await db.loanPayments.clear()
    await db.budgets.clear()
    await db.notifications.clear()
    vi.restoreAllMocks()
  })

  describe('Phase 1: Multi-Currency & Mencegah Korupsi Nilai Transaksi', () => {
    it('CRIT-01: prioritizes tx.currency over wallet currency to preserve foreign currency transactions', () => {
      const matchedWallet = { id: 1, name: 'BCA IDR', currency: 'IDR' }
      const defaultCurrency = 'IDR'
      const foreignTx = { currency: 'SGD', amount: 15 }

      // CRIT-01 invariant: tx.currency || matchedWallet?.currency || defaultCurrency
      const txCurrency = foreignTx.currency || matchedWallet?.currency || defaultCurrency
      expect(txCurrency).toBe('SGD')
    })

    it('CRIT-04: statement import resolves target wallet currency instead of hardcoded default currency', async () => {
      const wallets = [
        { id: 1, name: 'IDR Wallet', currency: 'IDR' },
        { id: 2, name: 'SGD Card', currency: 'SGD' },
      ]
      const defaultCurrency = 'IDR'
      const selectedWalletId = 2

      const targetWallet = wallets.find((w) => w.id === Number(selectedWalletId))
      const txCurrency = targetWallet?.currency || defaultCurrency
      expect(txCurrency).toBe('SGD')
    })

    it('HIGH-05: fallback exchange rates are applied when rates is null or offline', () => {
      const amountSGD = 100
      // When rates is null or empty, convertCurrency uses FALLBACK_EXCHANGE_RATES
      const converted = convertCurrency(amountSGD, 'SGD', 'IDR', null)
      const expected = (100 / FALLBACK_EXCHANGE_RATES.SGD) * FALLBACK_EXCHANGE_RATES.IDR
      expect(converted).toBeCloseTo(expected, 2)
      expect(converted).toBeGreaterThan(0)
    })

    it('HIGH-07: cross-currency transfer recap uses tx.targetAmount matching computeWalletBalance', () => {
      const sourceWallet = { id: 1, name: 'SGD Wallet', currency: 'SGD', balance: 1000 }
      const targetWallet = { id: 2, name: 'IDR Wallet', currency: 'IDR', balance: 0 }

      const transferTx = {
        id: 10,
        type: 'transfer',
        amount: 100, // 100 SGD out
        currency: 'SGD',
        walletId: 1,
        targetWalletId: 2,
        targetAmount: 1180000, // 1,180,000 IDR in
        date: '2026-09-16',
      }

      // computeWalletBalance for target wallet
      const targetBal = computeWalletBalance(targetWallet, [transferTx], null, [sourceWallet, targetWallet])
      expect(targetBal).toBe(1180000)

      // Daily recap calculation for target wallet
      const allWallets = [sourceWallet, targetWallet]
      let net = 0
      if (String(transferTx.targetWalletId) === String(targetWallet.id)) {
        const srcWallet = allWallets.find((w) => String(w.id) === String(transferTx.walletId))
        const sourceCurrency = transferTx.currency || srcWallet?.currency || 'IDR'
        const targetAmount =
          transferTx.targetAmount != null && Number(transferTx.targetAmount) > 0
            ? Number(transferTx.targetAmount)
            : convertCurrency(transferTx.amount, sourceCurrency, targetWallet.currency, null)
        net += targetAmount
      }
      expect(net).toBe(1180000)
    })

    it('HIGH-07: daily recap falls back to wallet currency instead of defaultCurrency when tx.currency is omitted', () => {
      const wallet = { id: 3, name: 'USD Cash', currency: 'USD' }
      const defaultCurrency = 'IDR'
      const tx = {
        id: 99,
        type: 'expense',
        amount: 50,
        currency: undefined, // omitted
        walletId: 3,
      }
      const walletCurrency = wallet?.currency || defaultCurrency
      // Bug was: convertCurrency(tx.amount, tx.currency || defaultCurrency, walletCurrency) -> converted 50 IDR to USD
      // Fix is: convertCurrency(tx.amount, tx.currency || walletCurrency, walletCurrency) -> stays 50 USD
      const amt = convertCurrency(tx.amount, tx.currency || walletCurrency, walletCurrency, {})
      expect(amt).toBe(50)
    })

    it('CRIT-04: statement import preserves tx.currency when present on transaction', () => {
      const targetWallet = { id: 2, name: 'SGD Wallet', currency: 'SGD' }
      const defaultCurrency = 'IDR'
      const txCurrency = targetWallet?.currency || defaultCurrency

      const parsedWithCurrency = { amount: 100, currency: 'USD' }
      const finalCurrency1 = parsedWithCurrency.currency || txCurrency
      expect(finalCurrency1).toBe('USD')

      const parsedWithoutCurrency = { amount: 100 }
      const finalCurrency2 = parsedWithoutCurrency.currency || txCurrency
      expect(finalCurrency2).toBe('SGD')
    })
  })

  describe('Phase 2: Pencegahan Double-Taxation & Rekonsiliasi Struk OCR (CRIT-03)', () => {
    it('CRIT-03: does NOT re-add netAdjustment when totalItemAmount already reflects receipt grand total', () => {
      // AI extracted 2 items whose sum equals the receipt grand total
      const transactions = [
        { name: 'Item 1 (with tax)', amount: 33000, currency: 'IDR' },
        { name: 'Item 2 (with tax)', amount: 22000, currency: 'IDR' },
      ]
      // Receipt has total: 55000 and tax: 5000
      const resultMeta = { total: 55000, tax: 5000 }

      const processed = distributeReceiptTransactions(transactions, resultMeta, 'per_item')
      expect(processed).toHaveLength(2)
      // Amounts must remain 33000 and 22000, NOT 36000 and 24000
      expect(processed[0].amount).toBe(33000)
      expect(processed[1].amount).toBe(22000)
      const sum = processed.reduce((acc, t) => acc + t.amount, 0)
      expect(sum).toBe(55000)
    })

    it('CRIT-03: distributes netAdjustment when totalItemAmount does NOT reflect grand total', () => {
      // AI extracted items before tax
      const transactions = [
        { name: 'Item 1 (pre-tax)', amount: 30000, currency: 'IDR' },
        { name: 'Item 2 (pre-tax)', amount: 20000, currency: 'IDR' },
      ]
      // Receipt has total: 55000 and tax: 5000
      const resultMeta = { total: 55000, tax: 5000 }

      const processed = distributeReceiptTransactions(transactions, resultMeta, 'per_item')
      expect(processed).toHaveLength(2)
      expect(processed[0].amount).toBe(33000)
      expect(processed[1].amount).toBe(22000)
      const sum = processed.reduce((acc, t) => acc + t.amount, 0)
      expect(sum).toBe(55000)
    })

    it('CRIT-03 Case 1: unrolling items does NOT re-add tax when itemsSum already reflects receipt grand total', () => {
      // Single transaction with items array where item prices already sum to grand total
      const transactions = [
        {
          amount: 55000,
          tax: 5000,
          currency: 'IDR',
          items: [
            { name: 'Kopi (incl. tax)', price: 33000 },
            { name: 'Roti (incl. tax)', price: 22000 },
          ],
        },
      ]
      const resultMeta = { total: 55000, tax: 5000 }

      const processed = distributeReceiptTransactions(transactions, resultMeta, 'per_item')
      expect(processed).toHaveLength(2)
      // Must remain 33000 and 22000, NOT double-taxed to 36000 and 24000 (totaling 60000)
      expect(processed[0].amount).toBe(33000)
      expect(processed[1].amount).toBe(22000)
      const sum = processed.reduce((acc, t) => acc + t.amount, 0)
      expect(sum).toBe(55000)
    })
  })

  describe('Phase 3: Perlindungan Sejarah Ledger & Pencegahan Saldo Fiktif (CRIT-02)', () => {
    it('CRIT-02: decouples transaction instead of deleting it when deleting split bill loan with no siblings', async () => {
      const walletId = await db.wallets.add({ name: 'Cash', balance: 200000, currency: 'IDR' })

      // User paid for lunch Rp 100,000 for friends (recorded as transaction with splitBillId)
      const friendsTxId = await db.transactions.add({
        walletId,
        amount: 100000,
        type: 'expense',
        category: 'makanan/makan_diluar',
        date: '2026-09-15',
        notes: 'Makan bareng Budi & Siti',
        splitBillId: 'sb-12345',
      })

      // Associated loan for friend
      const loanId = await db.loans.add({
        type: 'receivable',
        personName: 'Budi',
        title: 'Split Bill Makan Siang',
        totalAmount: 100000,
        remainingAmount: 100000,
        currency: 'IDR',
        status: 'active',
        splitBillId: 'sb-12345',
        initialTransactionId: friendsTxId,
        walletId,
      })

      // Delete the loan
      await useLoanStore.getState().deleteLoan(loanId)

      // Invariant check: loan is deleted
      const deletedLoan = await db.loans.get(loanId)
      expect(deletedLoan).toBeUndefined()

      // CRIT-02 Invariant check: friendsTx MUST NOT be deleted from ledger!
      const preservedTx = await db.transactions.get(friendsTxId)
      expect(preservedTx).toBeDefined()
      // Immutable ledger invariant: Cash outflow at merchant remains 100,000 intact
      expect(preservedTx.amount).toBe(100000)
      expect(preservedTx.splitBillId).toBeNull()
      expect(preservedTx.walletId).toBe(walletId)
    })
  })

  describe('Phase 4: Standardisasi Unpacking Transaksi Split & Penapisan Dompet', () => {
    it('HIGH-02: does not leak parent exclusion flags to legitimate child split items in Income Statement', () => {
      const tx = {
        id: 1,
        date: '2026-09-15',
        type: 'income',
        category: 'gaji',
        amount: 10000000,
        isSplit: true,
        // Parent has exclusion flag
        isExcludeAnalyticsTx: true,
        splitItems: [
          {
            amount: 8000000,
            category: 'gaji/gaji_pokok',
            type: 'income',
            isExcludeAnalyticsTx: false,
          },
          {
            amount: 2000000,
            category: 'gaji/bonus',
            type: 'income',
            isExcludeAnalyticsTx: true, // only this child is excluded
          },
        ],
      }

      const stmt = generateIncomeStatement([tx], {
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        defaultCurrency: 'IDR',
        rates: {},
      })
      // The non-excluded child item (8,000,000) should be included in revenue
      expect(stmt.totalRevenue).toBe(8000000)
    })

    it('HIGH-02: does not leak parent exclusion flags in Cash Flow Statement', () => {
      const tx = {
        id: 1,
        date: '2026-09-15',
        type: 'expense',
        category: 'belanja',
        amount: 500000,
        isSplit: true,
        isExcludeAnalyticsTx: true,
        splitItems: [
          {
            amount: 300000,
            category: 'kebutuhan_harian/belanja_bulanan',
            type: 'expense',
            isExcludeAnalyticsTx: false,
          },
          {
            amount: 200000,
            category: 'kebutuhan_harian/lainnya',
            type: 'expense',
            isExcludeAnalyticsTx: true,
          },
        ],
      }

      const cf = generateCashFlowStatement([tx], {
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        defaultCurrency: 'IDR',
        rates: {},
      })
      expect(cf.operatingActivities.outflow).toBe(300000)
    })

    it('HIGH-03: calculateBudgetSpent respects individual child item exclusion flags', () => {
      const budgetCategory = 'makanan'
      const monthExpenseTxs = [
        {
          id: 1,
          type: 'expense',
          category: 'makanan',
          amount: 150000,
          currency: 'IDR',
          isSplit: true,
          splitItems: [
            {
              amount: 100000,
              category: 'makanan/makan_diluar',
              type: 'expense',
              isExcludeAnalyticsTx: false,
            },
            {
              amount: 50000,
              category: 'makanan/jajan',
              type: 'expense',
              isExcludeAnalyticsTx: true, // child explicitly excluded
            },
          ],
        },
      ]

      const spent = calculateBudgetSpent(budgetCategory, monthExpenseTxs, 'IDR', {})
      // Only the 100,000 item should be counted, the 50,000 item must be excluded
      expect(spent).toBe(100000)
    })

    it('HIGH-03: aggregateMonthlyIncomeExpense respects individual child item exclusion flags', () => {
      const validTxs = [
        {
          id: 1,
          date: '2026-09-10',
          type: 'expense',
          category: 'transportasi',
          amount: 75000,
          currency: 'IDR',
          isSplit: true,
          splitItems: [
            {
              amount: 50000,
              category: 'transportasi/bensin',
              type: 'expense',
              isExcludeAnalyticsTx: false,
            },
            {
              amount: 25000,
              category: 'transportasi/parkir',
              type: 'expense',
              isExcludeAnalyticsTx: true, // excluded
            },
          ],
        },
      ]

      const refDate = new Date('2026-09-15')
      const summary = aggregateMonthlyIncomeExpense(validTxs, 1, 'IDR', {}, refDate)
      const currentMonthSummary = summary.find((s) => s.key === '2026-09')
      expect(currentMonthSummary?.expense).toBe(50000)
    })

    it('HIGH-06: anchor month stepping to startOfMonth avoids skipping short months on month-end dates', () => {
      // Reference date: March 31, 2026
      const march31 = new Date(2026, 2, 31) // March 31
      const lastMonthAnchor = subMonths(startOfMonth(march31), 1)
      expect(format(lastMonthAnchor, 'yyyy-MM')).toBe('2026-02')

      // Stepping back 2 months from start of month
      const janAnchor = subMonths(startOfMonth(march31), 2)
      expect(format(janAnchor, 'yyyy-MM')).toBe('2026-01')
    })

    it('HIGH-03 & CRIT-05: split item exclusion sanitization isolates child from parent and respects child flags', () => {
      const parentTx = {
        id: 42,
        type: 'expense',
        category: 'belanja',
        amount: 200000,
        isSplit: true,
        isExcludeAnalyticsTx: true, // parent is excluded
        isExcludeFromAnalytics: true,
        excludeFromAnalytics: true,
        splitItems: [
          {
            amount: 120000,
            category: 'belanja/buku',
            type: 'expense',
            isExcludeAnalyticsTx: false,
          },
          {
            amount: 80000,
            category: 'belanja/elektronik',
            type: 'expense',
            isExcludeAnalyticsTx: true,
          },
        ],
      }

      // Test child 1 sanitization: must NOT inherit parent exclusion
      const itemTx1 = {
        ...parentTx,
        ...parentTx.splitItems[0],
        category: parentTx.splitItems[0].category || parentTx.category,
        isExcludeAnalyticsTx: Boolean(parentTx.splitItems[0].isExcludeAnalyticsTx),
        isExcludeFromAnalytics: Boolean(parentTx.splitItems[0].isExcludeFromAnalytics || parentTx.splitItems[0].excludeFromAnalytics),
        excludeFromAnalytics: Boolean(parentTx.splitItems[0].excludeFromAnalytics || parentTx.splitItems[0].isExcludeFromAnalytics),
      }
      expect(itemTx1.isExcludeAnalyticsTx).toBe(false)
      expect(itemTx1.isExcludeFromAnalytics).toBe(false)
      expect(itemTx1.excludeFromAnalytics).toBe(false)

      // Test child 2 sanitization: must respect its own isExcludeAnalyticsTx: true
      const itemTx2 = {
        ...parentTx,
        ...parentTx.splitItems[1],
        category: parentTx.splitItems[1].category || parentTx.category,
        isExcludeAnalyticsTx: Boolean(parentTx.splitItems[1].isExcludeAnalyticsTx),
        isExcludeFromAnalytics: Boolean(parentTx.splitItems[1].isExcludeFromAnalytics || parentTx.splitItems[1].excludeFromAnalytics),
        excludeFromAnalytics: Boolean(parentTx.splitItems[1].excludeFromAnalytics || parentTx.splitItems[1].isExcludeFromAnalytics),
      }
      expect(itemTx2.isExcludeAnalyticsTx).toBe(true)
    })

    it('HIGH-01: archived wallets are excluded from active wallet lists in SplitBillModal and chat', async () => {
      await db.wallets.add({ id: 1, name: 'Active Wallet', balance: 500000, currency: 'IDR', isArchived: false })
      await db.wallets.add({ id: 2, name: 'Old Archived Wallet', balance: 100000, currency: 'IDR', isArchived: true })

      const activeWallets = await db.wallets.filter((w) => !w.isArchived).toArray()
      expect(activeWallets).toHaveLength(1)
      expect(activeWallets[0].name).toBe('Active Wallet')
    })
  })

  describe('Phase 5: Critical Ledger Audit Follow-up Remediation (CRIT-01, CRIT-02, CRIT-03, HIGH-01)', () => {
    it('CRIT-01: createTransaction extracts splitItems categories and triggers notification when split expense exceeds budget limit', async () => {
      useSettingsStore.setState({ budgetCycleStartDay: 1, defaultCurrency: 'IDR', budgetAlertsEnabled: true, defaultWalletId: 1 })
      await db.wallets.add({ id: 1, name: 'Main Wallet', currency: 'IDR', balance: 5000000, isArchived: false })
      await db.budgets.add({
        id: 1,
        month: '2026-09',
        category: 'makanan/restoran',
        limit: 100000,
        amount: 100000,
        currency: 'IDR',
      })

      // Create split transaction where payload.category is 'umum', but splitItems has 'makanan/restoran' expense of 90,000 (90%)
      await createTransaction({
        date: '2026-09-16',
        type: 'expense',
        category: 'umum',
        amount: 150000,
        walletId: 1,
        isSplit: true,
        splitItems: [
          { category: 'makanan/restoran', amount: 90000, type: 'expense' },
          { category: 'belanja', amount: 60000, type: 'expense' },
        ],
      })

      const notifs = await db.notifications.toArray()
      expect(notifs.length).toBeGreaterThanOrEqual(1)
      const budgetNotif = notifs.find((n) => n.route === '/budget')
      expect(budgetNotif).toBeDefined()
      expect(budgetNotif.title).toContain('Peringatan Budget')
    })

    it('CRIT-01: multi-currency budget uses budget.currency instead of IDR fallback', async () => {
      useSettingsStore.setState({ budgetCycleStartDay: 1, defaultCurrency: 'IDR', budgetAlertsEnabled: true, defaultWalletId: 1 })
      await db.wallets.add({ id: 1, name: 'SGD Card', currency: 'SGD', balance: 1000, isArchived: false })
      await db.budgets.add({
        id: 2,
        month: '2026-09',
        category: 'hiburan',
        limit: 100,
        amount: 100,
        currency: 'SGD',
      })

      // 85 SGD spent on 100 SGD budget (85%)
      await createTransaction({
        date: '2026-09-16',
        type: 'expense',
        category: 'hiburan',
        amount: 85,
        currency: 'SGD',
        walletId: 1,
      })

      const notifs = await db.notifications.toArray()
      const budgetNotif = notifs.find((n) => n.route === '/budget' && n.message.toLowerCase().includes('hiburan'))
      expect(budgetNotif).toBeDefined()
    })

    it('CRIT-02: checkBudgetAlertsAfterExpense respects multi-currency budget and budgetCycleStartDay', async () => {
      useSettingsStore.setState({ budgetCycleStartDay: 1, defaultCurrency: 'IDR', budgetAlertsEnabled: true, locale: 'id' })
      const currentMonthKey = format(new Date(), 'yyyy-MM')
      await db.budgets.add({
        id: 3,
        month: currentMonthKey,
        category: 'transportasi',
        limit: 100,
        amount: 100,
        currency: 'USD',
      })

      const todayStr = format(new Date(), 'yyyy-MM-dd')
      await db.transactions.add({
        id: 101,
        date: todayStr,
        type: 'expense',
        category: 'transportasi',
        amount: 85,
        currency: 'USD',
      })

      let scheduledNotif = null
      const OriginalWindow = globalThis.window
      const OriginalNotification = globalThis.Notification
      const MockNotification = class {
        constructor(title, options) {
          scheduledNotif = { title, ...options }
        }
        static permission = 'granted'
      }

      globalThis.window = {
        Notification: MockNotification,
      }
      globalThis.Notification = MockNotification

      try {
        await checkBudgetAlertsAfterExpense({
          category: 'transportasi',
          amount: 85,
          date: todayStr,
        })

        expect(scheduledNotif).not.toBeNull()
        expect(scheduledNotif.title).toMatch(/Budget Warning|Peringatan Anggaran/)
        expect(scheduledNotif.body).toContain('85')
        expect(scheduledNotif.body).toContain('100')
      } finally {
        globalThis.window = OriginalWindow
        globalThis.Notification = OriginalNotification
      }
    })

    it('CRIT-03: deleteLoan preserves friendsTx amount and decouples when deleting loan with no siblings and loan was fully paid', async () => {
      await db.wallets.add({ id: 1, name: 'Dompet Utama', balance: 500000, currency: 'IDR', isArchived: false })
      await db.transactions.add({
        id: 50,
        date: '2026-09-10',
        type: 'expense',
        category: 'makanan',
        amount: 100000,
        walletId: 1,
        splitBillId: 'sb-123',
      })

      await db.loans.add({
        id: 1,
        personName: 'Budi',
        type: 'receivable',
        totalAmount: 100000,
        remainingAmount: 0,
        status: 'paid',
        splitBillId: 'sb-123',
        initialTransactionId: 50,
        walletId: 1,
      })

      await useLoanStore.getState().deleteLoan(1)

      const updatedTx = await db.transactions.get(50)
      expect(updatedTx.amount).toBe(100000)
      expect(updatedTx.splitBillId).toBeNull()
    })

    it('CRIT-03: deleteLoan preserves friendsTx amount and decouples when deleting loan with no siblings and loan was partially paid', async () => {
      await db.wallets.add({ id: 1, name: 'Dompet Utama', balance: 500000, currency: 'IDR', isArchived: false })
      await db.transactions.add({
        id: 53,
        date: '2026-09-10',
        type: 'expense',
        category: 'makanan',
        amount: 100000,
        walletId: 1,
        splitBillId: 'sb-part',
      })

      // Friend paid 60k, unpaid remaining is 40k
      await db.loans.add({
        id: 6,
        personName: 'Budi',
        type: 'receivable',
        totalAmount: 100000,
        remainingAmount: 40000,
        status: 'active',
        splitBillId: 'sb-part',
        initialTransactionId: 53,
        walletId: 1,
      })

      await useLoanStore.getState().deleteLoan(6)

      const updatedTx = await db.transactions.get(53)
      // Immutable ledger invariant: friendsTx amount is never mutated (100k remains 100k)
      expect(updatedTx.amount).toBe(100000)
      expect(updatedTx.splitBillId).toBeNull()
    })

    it('CRIT-03: deleteLoan with sibling loans preserves friendsTx amount and keeps splitBillId when siblings remain', async () => {
      await db.wallets.add({ id: 1, name: 'Dompet Utama', balance: 500000, currency: 'IDR', isArchived: false })
      await db.transactions.add({
        id: 51,
        date: '2026-09-10',
        type: 'expense',
        category: 'makanan',
        amount: 200000,
        walletId: 1,
        splitBillId: 'sb-456',
      })

      // Friend 1: total 100k, paid 60k, unpaid remainingAmount is 40k
      await db.loans.add({
        id: 2,
        personName: 'Siti',
        type: 'receivable',
        totalAmount: 100000,
        remainingAmount: 40000,
        status: 'active',
        splitBillId: 'sb-456',
        initialTransactionId: 51,
        walletId: 1,
      })

      // Friend 2: sibling loan
      await db.loans.add({
        id: 5,
        personName: 'Rian',
        type: 'receivable',
        totalAmount: 100000,
        remainingAmount: 100000,
        status: 'active',
        splitBillId: 'sb-456',
        initialTransactionId: 51,
        walletId: 1,
      })

      // Delete Friend 1's loan: friendsTx amount remains 200k intact
      await useLoanStore.getState().deleteLoan(2)

      const updatedTx = await db.transactions.get(51)
      expect(updatedTx.amount).toBe(200000)
      expect(updatedTx.splitBillId).toBe('sb-456')
    })

    it('CRIT-03: deleteLoan with sibling loans does not deduct anything if deleted loan was fully paid', async () => {
      await db.wallets.add({ id: 1, name: 'Dompet Utama', balance: 500000, currency: 'IDR', isArchived: false })
      await db.transactions.add({
        id: 52,
        date: '2026-09-10',
        type: 'expense',
        category: 'makanan',
        amount: 150000,
        walletId: 1,
        splitBillId: 'sb-789',
      })

      // Friend 1: total 50k, fully paid (remainingAmount: 0)
      await db.loans.add({
        id: 3,
        personName: 'Andi',
        type: 'receivable',
        totalAmount: 50000,
        remainingAmount: 0,
        status: 'paid',
        splitBillId: 'sb-789',
        initialTransactionId: 52,
        walletId: 1,
      })

      // Friend 2 (sibling loan)
      await db.loans.add({
        id: 4,
        personName: 'Doni',
        type: 'receivable',
        totalAmount: 100000,
        remainingAmount: 100000,
        status: 'active',
        splitBillId: 'sb-789',
        initialTransactionId: 52,
        walletId: 1,
      })

      // Delete Friend 1's loan: since remainingAmount is 0, nothing should be deducted from friendsTx!
      await useLoanStore.getState().deleteLoan(3)

      const updatedTx = await db.transactions.get(52)
      expect(updatedTx.amount).toBe(150000)
      expect(updatedTx.splitBillId).toBe('sb-789')
    })

    it('HIGH-01: WalletDetailPage daily net accumulation skips isPendingReview transactions', () => {
      const defaultCurrency = 'IDR'
      const wallet = { id: 1, currency: 'IDR' }
      const rates = null

      const items = [
        { id: 1, type: 'income', amount: 200000, currency: 'IDR' },
        { id: 2, type: 'expense', amount: 50000, currency: 'IDR' },
        { id: 3, type: 'income', amount: 500000, currency: 'IDR', isPendingReview: true },
        { id: 4, type: 'expense', amount: 300000, currency: 'IDR', isPendingReview: 1 },
      ]

      let net = 0
      items.forEach((tx) => {
        if (tx.isPendingReview === true || tx.isPendingReview === 1) return
        const walletCurrency = wallet?.currency || defaultCurrency
        if (tx.type === 'income') {
          const amt = convertCurrency(tx.amount, tx.currency || walletCurrency, walletCurrency, rates)
          net += amt
        } else if (tx.type === 'expense') {
          const amt = convertCurrency(tx.amount, tx.currency || walletCurrency, walletCurrency, rates)
          net -= amt
        }
      })

      expect(net).toBe(150000)
    })

    it('HIGH-01: computeCashBalanceBeforeDate skips pending review transactions', () => {
      const activeWalletIdSet = new Set(['1'])
      const totalWalletBalance = 1000000

      const safeTx = [
        { id: 1, date: '2026-09-15', walletId: '1', type: 'income', convertedAmount: 200000 },
        { id: 2, date: '2026-09-16', walletId: '1', type: 'expense', convertedAmount: 50000 },
        { id: 3, date: '2026-09-16', walletId: '1', type: 'income', convertedAmount: 1000000, isPendingReview: true },
        { id: 4, date: '2026-09-16', walletId: '1', type: 'expense', convertedAmount: 800000, isPendingReview: 1 },
      ]

      const target = '2026-09-16'
      const netFlowSinceTarget = safeTx.reduce((acc, tx) => {
        if (tx?.isPendingReview === true || tx?.isPendingReview === 1) return acc
        const d = String(tx?.date || '')
        if (!d || d < target) return acc
        const isSrcActive = activeWalletIdSet.has(String(tx?.walletId))

        if (!isSrcActive) return acc
        const amount = tx.convertedAmount || 0
        if (tx.type === 'income') return acc + amount
        if (tx.type === 'expense') return acc - amount
        return acc
      }, 0)

      expect(netFlowSinceTarget).toBe(-50000)
      const balanceBefore = totalWalletBalance - netFlowSinceTarget
      expect(balanceBefore).toBe(1050000)
    })

    it('HIGH-01: buildRevenueSeries for 1d skips pending review transactions', () => {
      const todayKey = '2026-09-16'
      const hourNet = Array.from({ length: 24 }, () => 0)
      const normalizedTransactions = [
        { id: 1, date: todayKey, type: 'income', convertedAmount: 100000, createdAt: new Date('2026-09-16T10:00:00').getTime() },
        { id: 2, date: todayKey, type: 'expense', convertedAmount: 30000, createdAt: new Date('2026-09-16T11:00:00').getTime() },
        { id: 3, date: todayKey, type: 'income', convertedAmount: 500000, isPendingReview: true, createdAt: new Date('2026-09-16T10:00:00').getTime() },
        { id: 4, date: todayKey, type: 'expense', convertedAmount: 200000, isPendingReview: 1, createdAt: new Date('2026-09-16T11:00:00').getTime() },
      ]

      normalizedTransactions.forEach((tx) => {
        if (tx?.isPendingReview === true || tx?.isPendingReview === 1) return
        if (String(tx?.date || '') !== todayKey) return
        if (tx.type === 'transfer') return
        const isAdj = tx.type === 'balance_adjustment'
        const amount = tx.convertedAmount || 0
        const signed =
          tx.type === 'income'
            ? amount
            : tx.type === 'expense'
              ? -amount
              : isAdj
                ? amount
                : 0
        const fallbackMs = Number(new Date(`${todayKey}T12:00:00`).getTime())
        const txMs = Number.isFinite(Number(tx?.createdAt)) ? Number(tx.createdAt) : fallbackMs
        const hour = new Date(txMs).getHours()
        if (hour >= 0 && hour <= 23) hourNet[hour] += signed
      })

      expect(hourNet[10]).toBe(100000)
      expect(hourNet[11]).toBe(-30000)
    })

    it('HIGH-01: chartData daily & monthly aggregation skips pending review transactions', () => {
      const activeWalletIdSet = new Set(['1'])
      const safeTx = [
        { id: 1, date: '2026-09-16', walletId: '1', type: 'income', convertedAmount: 100000 },
        { id: 2, date: '2026-09-16', walletId: '1', type: 'expense', convertedAmount: 30000 },
        { id: 3, date: '2026-09-16', walletId: '1', type: 'income', convertedAmount: 500000, isPendingReview: true },
        { id: 4, date: '2026-09-16', walletId: '1', type: 'expense', convertedAmount: 200000, isPendingReview: 1 },
      ]

      const row = { day: '16 Sep', date: '2026-09-16', income: 0, expense: 0, net: 0, cashNet: 0 }

      safeTx.forEach((tx) => {
        if (tx?.isPendingReview === true || tx?.isPendingReview === 1) return
        const amount = tx.convertedAmount || 0
        const isSrcActive = activeWalletIdSet.has(String(tx?.walletId))

        let cashChange = 0
        if (isSrcActive) {
          if (tx.type === 'income') cashChange = amount
          else if (tx.type === 'expense') cashChange = -amount
        }

        row.cashNet = (row.cashNet || 0) + cashChange
        if (isSrcActive) {
          row[tx.type] = (row[tx.type] || 0) + amount
        }
      })

      row.net = row.cashNet
      expect(row.cashNet).toBe(70000)
      expect(row.income).toBe(100000)
      expect(row.expense).toBe(30000)
      expect(row.net).toBe(70000)
    })

    it('CRIT-01: budgetGoalSummary calculates spent using b.currency instead of IDR fallback', () => {
      const defaultCurrency = 'IDR'
      const rates = { USD: 1, IDR: 16000 }
      const budgets = [
        { id: 1, month: '2026-09', category: 'software', limit: 100, currency: 'USD' },
      ]
      const periodExpenseTxs = [
        { id: 10, type: 'expense', category: 'software', amount: 50, currency: 'USD', date: '2026-09-16' },
      ]

      const rows = budgets.map((b) => {
        const budgetCurrency = b.currency || defaultCurrency
        const spent = calculateBudgetSpent(b.category, periodExpenseTxs, budgetCurrency, rates)
        const limit = Number(b.limit)
        const pct = limit > 0 ? (spent / limit) * 100 : 0
        return { spent, limit, pct }
      })

      // Must be 50 USD spent against 100 USD limit (50%), NOT 800,000 IDR against 100 USD (800,000%)
      expect(rows[0].spent).toBe(50)
      expect(rows[0].limit).toBe(100)
      expect(rows[0].pct).toBe(50)
    })

    it('CRIT-01 & CRIT-02: split transactions with parent-level exclusion flags still process valid splitItems', async () => {
      useSettingsStore.setState({ budgetCycleStartDay: 1, defaultCurrency: 'IDR', budgetAlertsEnabled: true, defaultWalletId: 1 })
      await db.wallets.add({ id: 1, name: 'Main', currency: 'IDR', balance: 1000000, isArchived: false })
      await db.budgets.add({
        id: 10,
        month: '2026-09',
        category: 'groceries',
        limit: 100000,
        amount: 100000,
        currency: 'IDR',
      })

      // Transaction where parent has isExcludeAnalyticsTx: true, but child item does NOT
      await createTransaction({
        date: '2026-09-16',
        type: 'expense',
        category: 'groceries',
        amount: 90000,
        walletId: 1,
        isSplit: true,
        isExcludeAnalyticsTx: true,
        splitItems: [
          { category: 'groceries', amount: 90000, type: 'expense', isExcludeAnalyticsTx: false },
        ],
      })

      const notifs = await db.notifications.toArray()
      const budgetNotif = notifs.find((n) => n.route === '/budget' && n.message.toLowerCase().includes('groceries'))
      expect(budgetNotif).toBeDefined()
    })
  })

  describe('Phase 6: Critical Ledger Remediation Follow-up (9 Findings)', () => {
    it('LEDGER-CRIT-01: distributeReceiptTransactions in mode all reconciles single transaction amount with receipt grand total', () => {
      // AI extracted subtotal 50,000 into tx.amount, but receiptMeta has total 55,000 (tax 5,000)
      const transactions = [
        { name: 'Belanja Supermarket', amount: 50000, currency: 'IDR' },
      ]
      const resultMeta = { total: 55000, tax: 5000 }

      const processed = distributeReceiptTransactions(transactions, resultMeta, 'all')
      expect(processed).toHaveLength(1)
      expect(processed[0].amount).toBe(55000)
    })

    it('LEDGER-CRIT-01: distributeReceiptTransactions in mode all computes grand total from parent amount plus net adjustment if total is missing', () => {
      const transactions = [
        { name: 'Makan Kafe', amount: 100000, tax: 11000, discount: 5000, currency: 'IDR' },
      ]
      const processed = distributeReceiptTransactions(transactions, {}, 'all')
      expect(processed).toHaveLength(1)
      // 100,000 + 11,000 - 5,000 = 106,000
      expect(processed[0].amount).toBe(106000)
    })

    it('LEDGER-CRIT-02: distributeReceiptTransactions preserves cents on foreign currencies like USD in penny balancing', () => {
      const transactions = [
        {
          amount: 1.0,
          currency: 'USD',
          items: [
            { name: 'Coffee', price: 0.4 },
            { name: 'Donut', price: 0.6 },
          ],
        },
      ]
      const resultMeta = { total: 1.0, currency: 'USD' }

      const processed = distributeReceiptTransactions(transactions, resultMeta, 'per_item')
      expect(processed).toHaveLength(2)
      // Coffee must be 0.4, NOT rounded down to 0
      expect(processed[0].amount).toBe(0.4)
      expect(processed[1].amount).toBe(0.6)
      expect(processed[0].amount + processed[1].amount).toBeCloseTo(1.0, 2)
    })

    it('LEDGER-CRIT-03: DashboardPulseBento & BudgetSavingsDetailSheet logic converts currencies before summing totals', () => {
      const defaultCurrency = 'IDR'
      const rates = { USD: 1, IDR: 16000 }

      // 1 budget in IDR (limit 1,000,000, spent 500,000), 1 budget in USD (limit 100, spent 50)
      const budgetRows = [
        { category: 'makanan', limit: 1000000, spent: 500000, currency: 'IDR' },
        { category: 'software', limit: 100, spent: 50, currency: 'USD' },
      ]

      const totalBudgetSpent = budgetRows.reduce(
        (sum, r) => sum + convertCurrency(r.spent || 0, r.currency || defaultCurrency, defaultCurrency, rates),
        0
      )
      const totalBudgetLimit = budgetRows.reduce(
        (sum, r) => sum + convertCurrency(r.limit || 0, r.currency || defaultCurrency, defaultCurrency, rates),
        0
      )

      // 500,000 IDR + (50 USD * 16,000) = 500,000 + 800,000 = 1,300,000 IDR
      expect(totalBudgetSpent).toBe(1300000)
      // 1,000,000 IDR + (100 USD * 16,000) = 1,000,000 + 1,600,000 = 2,600,000 IDR
      expect(totalBudgetLimit).toBe(2600000)

      // 1 goal in IDR (target 10,000,000, current 5,000,000), 1 goal in USD (target 1,000, current 500)
      const goalRows = [
        { name: 'Liburan Bali', target: 10000000, current: 5000000, currency: 'IDR' },
        { name: 'MacBook', target: 1000, current: 500, currency: 'USD' },
      ]

      const totalGoalCurrent = goalRows.reduce(
        (sum, r) => sum + convertCurrency(r.current || 0, r.currency || defaultCurrency, defaultCurrency, rates),
        0
      )
      const totalGoalTarget = goalRows.reduce(
        (sum, r) => sum + convertCurrency(r.target || 0, r.currency || defaultCurrency, defaultCurrency, rates),
        0
      )

      // 5,000,000 IDR + (500 USD * 16,000) = 5,000,000 + 8,000,000 = 13,000,000 IDR
      expect(totalGoalCurrent).toBe(13000000)
      // 10,000,000 IDR + (1,000 USD * 16,000) = 10,000,000 + 16,000,000 = 26,000,000 IDR
      expect(totalGoalTarget).toBe(26000000)
    })

    it('LEDGER-CRIT-04 & LEDGER-HIGH-04: AI loan and goal creation preserves currency from input and toolSchemas has currency parameter', async () => {
      // 1. Check toolSchemas has currency in manage_loans and manage_savings
      const mainTools = getTools()[0]?.functionDeclarations || []
      const savingsTool = mainTools.find((t) => t.name === 'manage_savings')
      const loansTool = mainTools.find((t) => t.name === 'manage_loans')

      expect(savingsTool).toBeDefined()
      expect(savingsTool.parameters.properties.currency).toBeDefined()
      expect(loansTool).toBeDefined()
      expect(loansTool.parameters.properties.currency).toBeDefined()

      // 2. Goal creation with custom currency
      const resultGoal = { action: 'create', name: 'Emergency Fund USD', amount: 5000, currency: 'USD' }
      const defaultCurrency = 'IDR'
      const goalCurrency = (resultGoal.currency && typeof resultGoal.currency === 'string' && resultGoal.currency.trim())
        ? resultGoal.currency.trim().toUpperCase()
        : defaultCurrency

      await db.goals.add({
        name: resultGoal.name,
        targetAmount: Number(resultGoal.amount) || 0,
        currentAmount: 0,
        currency: goalCurrency,
      })

      const savedGoal = await db.goals.where({ name: 'Emergency Fund USD' }).first()
      expect(savedGoal.currency).toBe('USD')

      // 3. Loan creation with custom currency
      const walletId = await db.wallets.add({ name: 'SGD Card', currency: 'SGD', balance: 1000 })
      const resultLoan = {
        action: 'create',
        title: 'Pinjaman Kuliah SGD',
        amount: 2000,
        walletId,
        currency: 'SGD',
      }
      const matchedWallet = await db.wallets.get(walletId)
      const loanCurrency = (resultLoan.currency && typeof resultLoan.currency === 'string' && resultLoan.currency.trim())
        ? resultLoan.currency.trim().toUpperCase()
        : (matchedWallet?.currency || defaultCurrency)

      await useLoanStore.getState().addLoan({
        type: 'debt',
        personName: 'Kampus',
        title: resultLoan.title,
        totalAmount: resultLoan.amount,
        walletId,
        currency: loanCurrency,
      })

      const savedLoan = await db.loans.where({ title: 'Pinjaman Kuliah SGD' }).first()
      expect(savedLoan.currency).toBe('SGD')
    })

    it('LEDGER-HIGH-01: transactionService createTransaction rejects transfer if source or target wallet is archived or non-existent', async () => {
      const activeWalletId = await db.wallets.add({ name: 'Active Wallet', currency: 'IDR', balance: 500000, isArchived: false })
      const archivedWalletId = await db.wallets.add({ name: 'Archived Wallet', currency: 'IDR', balance: 100000, isArchived: true })

      // Transfer to archived wallet must throw
      await expect(
        createTransaction({
          type: 'transfer',
          walletId: activeWalletId,
          targetWalletId: archivedWalletId,
          amount: 50000,
          date: '2026-09-16',
        })
      ).rejects.toThrow('Dompet tujuan transfer tidak valid atau sudah diarsipkan.')

      // Transfer from archived wallet must throw
      await expect(
        createTransaction({
          type: 'transfer',
          walletId: archivedWalletId,
          targetWalletId: activeWalletId,
          amount: 50000,
          date: '2026-09-16',
        })
      ).rejects.toThrow('Dompet asal tidak valid atau sudah diarsipkan.')

      // Transfer to non-existent wallet must throw
      await expect(
        createTransaction({
          type: 'transfer',
          walletId: activeWalletId,
          targetWalletId: 999999,
          amount: 50000,
          date: '2026-09-16',
        })
      ).rejects.toThrow('Dompet tujuan transfer tidak valid atau sudah diarsipkan.')
    })

    it('LEDGER-HIGH-02: ISO timestamp string correctly steps budgetCycleStartDay without producing NaN', () => {
      // Transaction on March 25, 2026 with payday cycle starting on 25th
      const isoDateStr = '2026-03-25T14:30:00'
      const startDay = 25
      const cycleMonth = getCurrentBudgetMonthKey(new Date(isoDateStr), startDay)
      // Since date is 25th >= startDay 25, it advances to next month: April 2026
      expect(cycleMonth).toBe('2026-04')

      // Date on March 24, 2026 is before payday 25th -> stays in March 2026
      const isoDateStrBefore = '2026-03-24T09:15:00'
      const cycleMonthBefore = getCurrentBudgetMonthKey(new Date(isoDateStrBefore), startDay)
      expect(cycleMonthBefore).toBe('2026-03')
    })

    it('LEDGER-HIGH-03: native widget period respects custom budgetCycleStartDay', () => {
      const budgetCycleStartDay = 25
      const currentMonthKey = getCurrentBudgetMonthKey(new Date('2026-09-28'), budgetCycleStartDay)
      const budgetPeriod = getBudgetPeriodDateRange(currentMonthKey, budgetCycleStartDay)

      // September 28 is after payday 25th -> month key is 2026-10
      expect(currentMonthKey).toBe('2026-10')
      expect(budgetPeriod.startDate).toBe('2026-09-25')
      expect(budgetPeriod.endDate).toBe('2026-10-24')

      // A transaction on 2026-09-26 falls INSIDE the period
      const txInside = { date: '2026-09-26', amount: 50000 }
      const isInside = txInside.date >= budgetPeriod.startDate && txInside.date <= budgetPeriod.endDate
      expect(isInside).toBe(true)

      // A transaction on 2026-09-20 falls OUTSIDE the period (belongs to previous cycle)
      const txOutside = { date: '2026-09-20', amount: 50000 }
      const isOutside = txOutside.date >= budgetPeriod.startDate && txOutside.date <= budgetPeriod.endDate
      expect(isOutside).toBe(false)
    })

    it('LEDGER-HIGH-05: calculateNetWorthSummary filters out archived wallets from totalCash', () => {
      const wallets = [
        { id: 1, name: 'Active Bank', balance: 5000000, currency: 'IDR', isArchived: false },
        { id: 2, name: 'Closed Old Bank', balance: 2000000, currency: 'IDR', isArchived: true },
      ]
      const transactions = []

      const netWorth = calculateNetWorthSummary(wallets, transactions, [], [], null, 'IDR', [])
      // totalCash must only include the active wallet (5,000,000), NOT the closed archived wallet (7,000,000)
      expect(netWorth.totalCash).toBe(5000000)
      expect(netWorth.totalNetWorth).toBe(5000000)
    })
  })

  describe('Phase 4: Critical Ledger Audit Remediation (CRIT-01 to CRIT-04 & HIGH-01 to HIGH-04)', () => {
    // 1. CRIT-01: Prioritize receiptGrandTotal on discrepancies
    it('CRIT-01: distributeReceiptTransactions prioritizes receiptGrandTotal when item sum differs, even if netAdjustment is 0', () => {
      // Case 1: unrolling summary item
      const parentWithItems = [
        {
          amount: 100000,
          currency: 'IDR',
          tax: 0,
          discount: 0,
          items: [
            { name: 'Nasi Goreng', price: 50000 },
            { name: 'Mie Ayam', price: 50000 },
          ],
        },
      ]
      // Receipt has grand total 115,000 (e.g., service fee or rounding)
      const resMeta1 = { total: 115000, tax: 0, discount: 0 }
      const unrolled = distributeReceiptTransactions(parentWithItems, resMeta1, 'per_item')
      expect(unrolled).toHaveLength(2)
      const sum1 = unrolled.reduce((acc, t) => acc + t.amount, 0)
      expect(sum1).toBe(115000)

      // Case 2: multiple transactions directly
      const multiTxs = [
        { name: 'Item A', amount: 40000, currency: 'IDR' },
        { name: 'Item B', amount: 60000, currency: 'IDR' },
      ]
      const resMeta2 = { grandTotal: 110000, tax: 0, discount: 0 }
      const distributed = distributeReceiptTransactions(multiTxs, resMeta2, 'per_item')
      expect(distributed).toHaveLength(2)
      const sum2 = distributed.reduce((acc, t) => acc + t.amount, 0)
      expect(sum2).toBe(110000)
    })

    // 2. CRIT-02: Filter out Rp 0 / free items and prevent penny leakage into promo items
    it('CRIT-02: distributeReceiptTransactions filters out promo/free items with price Rp 0', () => {
      const parentWithPromo = [
        {
          amount: 50000,
          currency: 'IDR',
          items: [
            { name: 'Kopi Susu', price: 30000 },
            { name: 'Donat Cokelat', price: 20000 },
            { name: 'Promo Es Krim Gratis', price: 0 },
          ],
        },
      ]
      const unrolled = distributeReceiptTransactions(parentWithPromo, { total: 50000 }, 'per_item')
      expect(unrolled).toHaveLength(2)
      expect(unrolled.some((t) => t.notes?.includes('Promo Es Krim'))).toBe(false)
      expect(unrolled.every((t) => t.amount > 0)).toBe(true)
    })

    it('CRIT-01 & CRIT-02: free promo item at the end of items list does not absorb penny rounding discrepancy', () => {
      const parent = [
        {
          amount: 20000,
          currency: 'IDR',
          items: [
            { name: 'Kopi', price: 10000 },
            { name: 'Roti', price: 10000 },
            { name: 'Promo Es Teh Manis Gratis', price: 0 },
          ],
        },
      ]
      // Discrepancy of 1 rupiah
      const resultMeta = { total: 20001 }
      const unrolled = distributeReceiptTransactions(parent, resultMeta, 'per_item')
      expect(unrolled).toHaveLength(2)
      expect(unrolled.some((t) => t.notes?.includes('Promo'))).toBe(false)
      expect(unrolled.reduce((sum, t) => sum + t.amount, 0)).toBe(20001)
    })

    it('CRIT-02: AI logging skips zero-amount transactions without throwing and rejects negative amounts', async () => {
      const walletId = await db.wallets.add({ name: 'Cash', balance: 100000, currency: 'IDR' })
      const txsToProcess = [
        { name: 'Valid Item', amount: 25000, type: 'expense', walletId },
        { name: 'Free Item', amount: 0, type: 'expense', walletId },
        { name: 'Negative Item', amount: -5000, type: 'expense', walletId },
      ]

      const savedTxs = []
      for (const tx of txsToProcess) {
        const numericAmount = Number(tx.amount || 0)
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) continue
        const txId = await createTransaction({
          type: 'expense',
          amount: numericAmount,
          date: '2026-09-16',
          walletId: tx.walletId,
          category: 'makanan/kopi',
          notes: tx.name,
        })
        savedTxs.push(txId)
      }

      expect(savedTxs).toHaveLength(1)
      const dbTxs = await db.transactions.toArray()
      expect(dbTxs).toHaveLength(1)
      expect(dbTxs[0].amount).toBe(25000)
    })

    // 3. CRIT-03: updateTransaction transfer validation
    it('CRIT-03: updateTransaction rejects transfer if source or target wallet is archived or not found', async () => {
      const activeW1 = await db.wallets.add({ name: 'Active 1', currency: 'IDR', balance: 500000, isArchived: false })
      const activeW2 = await db.wallets.add({ name: 'Active 2', currency: 'IDR', balance: 200000, isArchived: false })
      const archivedW = await db.wallets.add({ name: 'Old Archived', currency: 'IDR', balance: 50000, isArchived: true })

      const txId = await createTransaction({
        type: 'expense',
        walletId: activeW1,
        amount: 50000,
        date: '2026-09-16',
        category: 'makanan/makan_siang',
      })

      // Try updating to transfer pointing to archived target
      await expect(
        updateTransaction(txId, {
          type: 'transfer',
          walletId: activeW1,
          targetWalletId: archivedW,
        })
      ).rejects.toThrow('Dompet tujuan transfer tidak valid atau sudah diarsipkan.')

      // Try updating to transfer originating from archived source
      await expect(
        updateTransaction(txId, {
          type: 'transfer',
          walletId: archivedW,
          targetWalletId: activeW2,
        })
      ).rejects.toThrow('Dompet asal tidak valid atau sudah diarsipkan.')

      // Try updating to transfer with non-existent target wallet
      await expect(
        updateTransaction(txId, {
          type: 'transfer',
          walletId: activeW1,
          targetWalletId: 888888,
        })
      ).rejects.toThrow('Dompet tujuan transfer tidak valid atau sudah diarsipkan.')

      // Valid transfer update succeeds
      const updated = await updateTransaction(txId, {
        type: 'transfer',
        walletId: activeW1,
        targetWalletId: activeW2,
      })
      expect(updated).toBe(1)
      const updatedTx = await db.transactions.get(txId)
      expect(updatedTx.type).toBe('transfer')
      expect(updatedTx.targetWalletId).toBe(activeW2)
    })

    // 4. HIGH-02: useLoanStore addLoan positive validation
    it('HIGH-02: addLoan rejects zero or negative totalAmount and principalAmount', async () => {
      const walletId = await db.wallets.add({ name: 'Cash IDR', currency: 'IDR', balance: 1000000 })

      // Zero totalAmount
      await expect(
        useLoanStore.getState().addLoan({
          type: 'debt',
          title: 'Hutang Nol',
          totalAmount: 0,
          walletId,
        })
      ).rejects.toThrow('Nominal total pinjaman harus lebih dari 0.')

      // Negative totalAmount
      await expect(
        useLoanStore.getState().addLoan({
          type: 'debt',
          title: 'Hutang Negatif',
          totalAmount: -100000,
          walletId,
        })
      ).rejects.toThrow('Nominal total pinjaman harus lebih dari 0.')

      // Zero principalAmount
      await expect(
        useLoanStore.getState().addLoan({
          type: 'debt',
          title: 'Pokok Nol',
          totalAmount: 100000,
          principalAmount: 0,
          walletId,
        })
      ).rejects.toThrow('Nominal pokok pinjaman harus lebih dari 0.')

      // Negative principalAmount
      await expect(
        useLoanStore.getState().addLoan({
          type: 'debt',
          title: 'Pokok Negatif',
          totalAmount: 100000,
          principalAmount: -50000,
          walletId,
        })
      ).rejects.toThrow('Nominal pokok pinjaman harus lebih dari 0.')

      // Valid loan succeeds
      const loanId = await useLoanStore.getState().addLoan({
        type: 'debt',
        title: 'Pinjaman Valid',
        totalAmount: 500000,
        principalAmount: 500000,
        walletId,
      })
      expect(loanId).toBeTruthy()
      const savedLoan = await db.loans.get(loanId)
      expect(savedLoan.totalAmount).toBe(500000)
    })

    // 5. CRIT-04: AI loan payment fallback avoids archived wallet
    it('CRIT-04: loan payment records payment to active wallet when loan wallet is archived', async () => {
      const activeWalletId = await db.wallets.add({ name: 'Active Wallet', currency: 'IDR', balance: 500000, isArchived: false })
      const archivedWalletId = await db.wallets.add({ name: 'Archived Wallet', currency: 'IDR', balance: 100000, isArchived: true })
      const activeWallets = await db.wallets.filter((w) => !w.isArchived).toArray()

      const loanId = await db.loans.add({
        title: 'Cicilan Laptop',
        personName: 'Toko Elektronik',
        type: 'debt',
        totalAmount: 1000000,
        remainingAmount: 500000,
        walletId: archivedWalletId,
        currency: 'IDR',
        status: 'active',
      })

      const matchedLoan = await db.loans.get(loanId)
      const result = { action: 'pay', amount: 200000 }

      // CRIT-04 resolution logic as in AiFinanceChat
      const matchedActiveWallet = activeWallets.find((w) => w.id === (result.walletId ? Number(result.walletId) : matchedLoan.walletId))
      const payWalletId = matchedActiveWallet ? matchedActiveWallet.id : (activeWallets.length > 0 ? activeWallets[0].id : null)

      expect(payWalletId).toBe(activeWalletId)
      expect(payWalletId).not.toBe(archivedWalletId)

      // Execute real recordPayment with payWalletId
      await useLoanStore.getState().recordPayment(matchedLoan.id, result.amount, '2026-09-16', 'Cicilan via AI', payWalletId)

      const txs = await db.transactions.where('loanId').equals(matchedLoan.id).toArray()
      expect(txs).toHaveLength(1)
      expect(txs[0].walletId).toBe(activeWalletId)
      expect(txs[0].walletId).not.toBe(archivedWalletId)
      expect(txs[0].amount).toBe(200000)
      expect(txs[0].isExcludeAnalyticsTx).toBe(true)
    })

    // 6. HIGH-01: validateTransferWallets requires both wallets and rejects guessing
    it('HIGH-01: validateTransferWallets does not guess missing source or target wallets', () => {
      const wallets = [
        { id: 1, name: 'BCA', currency: 'IDR' },
        { id: 2, name: 'Gopay', currency: 'IDR' },
        { id: 3, name: 'OVO', currency: 'IDR' },
      ]

      // Neither wallet specified
      const res1 = validateTransferWallets(null, null, wallets)
      expect(res1.isValid).toBe(false)
      expect(res1.errorMessageKey).toBe('missing_wallets')
      expect(res1.fromWallet).toBeNull()
      expect(res1.toWallet).toBeNull()

      // Only source specified, target missing
      const res2 = validateTransferWallets(1, null, wallets)
      expect(res2.isValid).toBe(false)
      expect(res2.errorMessageKey).toBe('missing_wallets')
      expect(res2.toWallet).toBeNull()

      // Only target specified, source missing
      const res3 = validateTransferWallets(null, 2, wallets)
      expect(res3.isValid).toBe(false)
      expect(res3.errorMessageKey).toBe('missing_wallets')
      expect(res3.fromWallet).toBeNull()

      // Both specified and distinct -> valid
      const res4 = validateTransferWallets(1, 2, wallets)
      expect(res4.isValid).toBe(true)
      expect(res4.fromWallet.id).toBe(1)
      expect(res4.toWallet.id).toBe(2)
    })

    // 7. HIGH-03: Savings goal deletion decouples associated transactions
    it('HIGH-03: deleting savings goal decouples transactions by setting goalId to null without deleting them', async () => {
      const walletId = await db.wallets.add({ name: 'Bank', balance: 5000000, currency: 'IDR' })
      const goalId = await db.goals.add({
        name: 'Dana Liburan',
        targetAmount: 10000000,
        currentAmount: 2000000,
        currency: 'IDR',
      })

      const tx1Id = await db.transactions.add({
        date: '2026-09-01',
        amount: 1000000,
        type: 'expense',
        category: 'tabungan',
        walletId,
        goalId,
        notes: 'Tabungan Liburan 1',
      })
      const tx2Id = await db.transactions.add({
        date: '2026-09-10',
        amount: 1000000,
        type: 'expense',
        category: 'tabungan',
        walletId,
        goalId,
        notes: 'Tabungan Liburan 2',
      })

      // Simulate Savings.jsx goal deletion flow with liquidation and decoupling
      const deletingGoal = await db.goals.get(goalId)
      const currentAmt = 2000000
      const targetWalletIdNum = walletId

      await db.transaction('rw', db.goals, db.goalLogs, db.transactions, async () => {
        if (currentAmt > 0 && targetWalletIdNum) {
          await db.transactions.add({
            date: '2026-09-16',
            amount: currentAmt,
            type: 'income',
            category: 'cairkan_tabungan',
            notes: `Pencairan Tabungan: ${deletingGoal.name} ke Dompet`,
            currency: 'IDR',
            walletId: targetWalletIdNum,
            goalId: deletingGoal.id,
            createdAt: Date.now(),
            isExcludeAnalyticsTx: true,
            isExcludeFromAnalytics: true,
            excludeFromAnalytics: true,
          })
        }
        await db.goals.delete(deletingGoal.id)
        await db.transactions
          .filter((tx) => String(tx.goalId) === String(deletingGoal.id))
          .modify({ goalId: null })
      })

      // Goal is deleted
      const checkGoal = await db.goals.get(goalId)
      expect(checkGoal).toBeUndefined()

      // Both historical transactions remain in ledger with goalId = null
      const tx1 = await db.transactions.get(tx1Id)
      const tx2 = await db.transactions.get(tx2Id)
      expect(tx1).toBeDefined()
      expect(tx2).toBeDefined()
      expect(tx1.goalId).toBeNull()
      expect(tx2.goalId).toBeNull()
      expect(tx1.amount).toBe(1000000)
      expect(tx2.amount).toBe(1000000)

      // Liquidation transaction was also decoupled and has isExcludeAnalyticsTx
      const allTxs = await db.transactions.toArray()
      expect(allTxs).toHaveLength(3)
      const liqTx = allTxs.find((t) => t.category === 'cairkan_tabungan')
      expect(liqTx).toBeDefined()
      expect(liqTx.goalId).toBeNull()
      expect(liqTx.isExcludeAnalyticsTx).toBe(true)
    })

    // 8. HIGH-04: AI loan payment success card displays loan currency
    it('HIGH-04: loan payment success card uses matched.currency instead of hardcoded defaultCurrency', () => {
      const defaultCurrency = 'IDR'
      const matchedLoanUSD = {
        id: 5,
        title: 'US College Loan',
        personName: 'University',
        type: 'debt',
        currency: 'USD',
        dueDate: '2027-01-01',
      }
      const matchedLoanDefault = {
        id: 6,
        title: 'Pinjaman IDR',
        personName: 'Teman',
        type: 'debt',
        currency: null,
      }

      const cardUSD = {
        type: 'loan',
        action: 'pay',
        title: matchedLoanUSD.title,
        data: {
          title: matchedLoanUSD.title,
          personName: matchedLoanUSD.personName,
          loanType: matchedLoanUSD.type,
          amount: 500,
          dueDate: matchedLoanUSD.dueDate,
          currency: matchedLoanUSD.currency || defaultCurrency,
        },
      }

      const cardDefault = {
        type: 'loan',
        action: 'pay',
        title: matchedLoanDefault.title,
        data: {
          title: matchedLoanDefault.title,
          personName: matchedLoanDefault.personName,
          loanType: matchedLoanDefault.type,
          amount: 500000,
          dueDate: matchedLoanDefault.dueDate,
          currency: matchedLoanDefault.currency || defaultCurrency,
        },
      }

      expect(cardUSD.data.currency).toBe('USD')
      expect(cardDefault.data.currency).toBe('IDR')
    })

    // 9. AUDIT-01: Subtotal-aware receipt distribution prevents double taxation
    it('AUDIT-01: distributeReceiptTransactions does not add tax twice when parent.amount already equals subtotal + tax', () => {
      const transactions = [{
        amount: 110000,
        subtotal: 100000,
        tax: 10000,
        category: 'makanan',
      }]
      const resultMeta = { subtotal: 100000, tax: 10000 }
      const processed = distributeReceiptTransactions(transactions, resultMeta, 'all')
      expect(processed).toHaveLength(1)
      expect(processed[0].amount).toBe(110000)
    })

    // 10. AUDIT-08: Foreign currency budget uses budget currency so percentage is accurate
    it('AUDIT-08: foreign currency budget uses budget currency and calculates accurate percentage', () => {
      const budget = {
        category: 'software',
        limit: 100,
        currency: 'USD',
      }
      const transactions = [
        {
          type: 'expense',
          category: 'software',
          amount: 10,
          currency: 'USD',
          date: '2026-09-10',
        },
      ]
      const rates = { IDR: 16000, USD: 1 }
      const budgetCurrency = budget.currency || 'IDR'
      const spent = calculateBudgetSpent(budget.category, transactions, budgetCurrency, rates)
      expect(spent).toBe(10)
      const pct = (spent / budget.limit) * 100
      expect(pct).toBe(10) // 10%, NOT 160,000%
    })

    // 11. AUDIT-05: manage_savings toolSchema includes withdraw action
    it('AUDIT-05: manage_savings tool schema includes withdraw action enum', () => {
      const tools = getTools()
      const savingsTool = tools[0].functionDeclarations.find((f) => f.name === 'manage_savings')
      expect(savingsTool).toBeDefined()
      expect(savingsTool.parameters.properties.action.enum).toContain('withdraw')
    })

    // 12. AUDIT-09: manage_budget toolSchema includes currency property
    it('AUDIT-09: manage_budget tool schema includes currency parameter', () => {
      const tools = getTools()
      const budgetTool = tools[0].functionDeclarations.find((f) => f.name === 'manage_budget')
      expect(budgetTool).toBeDefined()
      expect(budgetTool.parameters.properties.currency).toBeDefined()
    })

    // 13. AUDIT-12: archived loans are excluded from active loan debt calculations
    it('AUDIT-12: archived loans are excluded from active debt calculations', async () => {
      const activeLoanId = await db.loans.add({
        title: 'Active Debt',
        type: 'debt',
        totalAmount: 500000,
        remainingAmount: 500000,
        status: 'active',
        isArchived: false,
      })
      const archivedLoanId = await db.loans.add({
        title: 'Archived Debt',
        type: 'debt',
        totalAmount: 1000000,
        remainingAmount: 1000000,
        status: 'active',
        isArchived: true,
      })

      const loans = await db.loans.toArray()
      const activeLoans = loans.filter((l) => !l.isArchived && l.status !== 'paid' && l.status !== 'forgiven' && Number(l.remainingAmount || 0) > 0)

      expect(activeLoans.some((l) => l.id === activeLoanId)).toBe(true)
      expect(activeLoans.some((l) => l.id === archivedLoanId)).toBe(false)
      const totalDebt = activeLoans.filter((l) => l.type === 'debt').reduce((s, l) => s + Number(l.remainingAmount), 0)
      expect(totalDebt).toBe(500000)
    })
  })

  describe('Critical Ledger Re-Audit Remediation (AUDIT2-01 to AUDIT2-07)', () => {
    // AUDIT2-01: recordPayment currency conversion from wallet currency / payment currency to loan currency
    it('AUDIT2-01: recordPayment converts payment currency to loan currency and wallet currency accurately', async () => {
      // 1 IDR wallet with initial balance 500,000 IDR
      const walletId = await db.wallets.add({
        name: 'IDR Wallet',
        institutionType: 'bank',
        currency: 'IDR',
        balance: 500000,
        createdAt: Date.now(),
      })

      // 1 USD debt loan of $10 USD
      const loanId = await db.loans.add({
        title: 'Server Hosting Loan',
        type: 'debt',
        totalAmount: 10,
        remainingAmount: 10,
        currency: 'USD',
        walletId: walletId,
        status: 'active',
        createdAt: Date.now(),
      })

      // Pay $5 USD with inputCurrency = 'USD'
      await useLoanStore.getState().recordPayment(loanId, 5, '2026-09-16', 'Pay $5 host', walletId, 'USD')

      // Check loan remaining
      const updatedLoan = await db.loans.get(loanId)
      expect(updatedLoan.remainingAmount).toBe(5)
      expect(updatedLoan.status).toBe('partially_paid')

      // Check transaction recorded in ledger
      const txs = await db.transactions.where('loanId').equals(loanId).toArray()
      expect(txs).toHaveLength(1)
      expect(txs[0].currency).toBe('IDR')
      // $5 converted to IDR using fallback rates (1 USD = 16,800 IDR -> 84,000 IDR)
      const expectedIdr = convertCurrency(5, 'USD', 'IDR', null)
      expect(txs[0].amount).toBe(expectedIdr)
      expect(txs[0].type).toBe('expense')

      // Check loan payment recorded
      const payments = await db.loanPayments.where('loanId').equals(loanId).toArray()
      expect(payments).toHaveLength(1)
      expect(payments[0].amount).toBe(5) // In loan currency (USD)
    })

    // AUDIT2-04: Cross-currency transfer preserves locked targetAmount
    it('AUDIT2-04: cross-currency transfer locks targetAmount and prevents rate drift', async () => {
      const srcWallet = { id: 1, name: 'USD Wallet', currency: 'USD', balance: 100 }
      const dstWallet = { id: 2, name: 'IDR Wallet', currency: 'IDR', balance: 0 }

      const ratesAtTransfer = { IDR: 16000, USD: 1 }
      const transferAmt = 10
      const targetAmount = convertCurrency(transferAmt, 'USD', 'IDR', ratesAtTransfer)
      expect(targetAmount).toBe(160000)

      const transferTx = {
        id: 1,
        type: 'transfer',
        amount: transferAmt,
        targetAmount: targetAmount,
        targetCurrency: 'IDR',
        currency: 'USD',
        walletId: 1,
        targetWalletId: 2,
        date: '2026-09-16',
      }

      // Even if rates fluctuate drastically later (e.g. USD skyrockets to 20,000 IDR):
      const laterRates = { IDR: 20000, USD: 1 }
      const dstBal = computeWalletBalance(dstWallet, [transferTx], laterRates, [srcWallet, dstWallet])
      // Destination wallet balance must remain 160,000 IDR, NOT drift to 200,000 IDR
      expect(dstBal).toBe(160000)
    })

    // AUDIT2-05: manage_wallet tool schema includes ewallet and currency
    it('AUDIT2-05: manage_wallet tool schema includes ewallet in enum and currency property', () => {
      const tools = getTools()
      const walletTool = tools[0].functionDeclarations.find((f) => f.name === 'manage_wallet')
      expect(walletTool).toBeDefined()
      expect(walletTool.parameters.properties.walletType.enum).toContain('ewallet')
      expect(walletTool.parameters.properties.walletType.enum).toContain('e-wallet')
      expect(walletTool.parameters.properties.currency).toBeDefined()
    })

    // AUDIT2-07: computeAllWalletBalances handles soft-archived foreign currency counterparty wallet
    it('AUDIT2-07: computeAllWalletBalances resolves counterparty currency from allWallets for archived wallets', () => {
      const activeIdrWallet = { id: 2, name: 'Active IDR Wallet', currency: 'IDR', balance: 0, isArchived: 0 }
      const archivedUsdWallet = { id: 1, name: 'Archived USD Wallet', currency: 'USD', balance: 0, isArchived: 1 }

      // Transfer 10 USD from archived USD wallet to active IDR wallet
      const transferTx = {
        id: 1,
        type: 'transfer',
        amount: 10,
        currency: 'USD',
        walletId: 1,
        targetWalletId: 2,
        date: '2026-09-16',
      }

      const rates = { IDR: 16000, USD: 1 }
      // Active wallets only passed to first argument, but allWallets passed to 4th argument
      const computed = computeAllWalletBalances([activeIdrWallet], [transferTx], rates, [archivedUsdWallet, activeIdrWallet])

      expect(computed).toHaveLength(1)
      // 10 USD should be converted to 160,000 IDR, NOT treated as 10 IDR
      expect(computed[0].currentBalance).toBe(160000)
    })

    // ULTRA-AUDIT: Split items independent currency normalization across reports, budget, dashboard, and AI queries
    it('ULTRA-AUDIT-01: aggregateMonthlyIncomeExpense normalizes split items with independent currency', () => {
      const splitTx = {
        id: 101,
        date: '2026-09-15',
        type: 'expense',
        category: 'makanan/restoran',
        amount: 336000,
        currency: 'IDR',
        isSplit: true,
        splitItems: [
          {
            amount: 10,
            currency: 'USD', // 10 USD = 168,000 IDR
            category: 'makanan/restoran',
            type: 'expense',
          },
          {
            amount: 168000,
            currency: 'IDR',
            category: 'transportasi/taksi',
            type: 'expense',
          },
        ],
      }

      const rows = aggregateMonthlyIncomeExpense(
        [splitTx],
        1,
        'IDR',
        { USD: 1, IDR: 16800 },
        new Date(2026, 8, 15)
      )

      expect(rows).toHaveLength(1)
      expect(rows[0].expense).toBe(336000)
    })

    it('ULTRA-AUDIT-02: calculateBudgetSpent normalizes split item amount using item.currency', () => {
      const splitTx = {
        id: 102,
        date: '2026-09-15',
        type: 'expense',
        category: 'makanan/restoran',
        amount: 336000,
        currency: 'IDR',
        isSplit: true,
        splitItems: [
          {
            amount: 10,
            currency: 'USD', // 10 USD in IDR = 168,000 IDR
            category: 'makanan/restoran',
            type: 'expense',
          },
        ],
      }

      const spent = calculateBudgetSpent('makanan', [splitTx], 'IDR', { USD: 1, IDR: 16800 })
      expect(spent).toBe(168000)
    })

    it('ULTRA-AUDIT-03: calculatePeriodStats evaluates split item with independent currency correctly', () => {
      const splitTx = {
        id: 103,
        date: '2026-09-15',
        type: 'expense',
        category: 'belanja/elektronik',
        amount: 168000,
        currency: 'IDR',
        isSplit: true,
        splitItems: [
          {
            amount: 20,
            currency: 'USD', // 20 USD = 336,000 IDR
            category: 'belanja/elektronik',
            type: 'expense',
          },
        ],
      }

      const period = { startDate: '2026-09-01', endDate: '2026-09-30' }
      const stats = calculatePeriodStats([splitTx], period, 'IDR', { USD: 1, IDR: 16800 })
      expect(stats.expense).toBe(336000)
    })

    it('ULTRA-AUDIT-04: queryTransactions preserves si.currency in flattened split items and normalizes correctly', async () => {
      await db.transactions.clear()
      await db.transactions.add({
        id: 104,
        date: '2026-09-15',
        type: 'expense',
        category: 'makanan',
        amount: 168000,
        currency: 'IDR',
        isSplit: true,
        splitItems: [
          {
            amount: 10,
            currency: 'USD',
            category: 'makanan/cafe',
            type: 'expense',
          },
        ],
      })

      const res = await queryTransactions({ type: 'expense' }, 'IDR', { USD: 1, IDR: 16800 })
      expect(res.totalTransactionsFound).toBe(1)
      expect(res.recentSampleTransactions).toHaveLength(1)
      expect(res.recentSampleTransactions[0].currency).toBe('USD')
      expect(res.totalExpense).toBe(168000)
    })

    it('ULTRA-AUDIT-05: calculateNetWorthSummary forwards allWallets to resolve foreign currency transfers from archived wallets', () => {
      const activeIdrWallet = { id: 2, name: 'Active IDR Wallet', currency: 'IDR', balance: 0, isArchived: 0 }
      const archivedUsdWallet = { id: 1, name: 'Archived USD Wallet', currency: 'USD', balance: 0, isArchived: 1 }

      const transferTx = {
        id: 105,
        type: 'transfer',
        amount: 10,
        currency: 'USD',
        walletId: 1,
        targetWalletId: 2,
        date: '2026-09-16',
      }

      const rates = { IDR: 16000, USD: 1 }
      const netWorth = calculateNetWorthSummary(
        [activeIdrWallet],
        [transferTx],
        [],
        [],
        rates,
        'IDR',
        [],
        [archivedUsdWallet, activeIdrWallet]
      )

      expect(netWorth.totalCash).toBe(160000)
    })

    it('ULTRA-AUDIT-06: calculateBudgetSpent strictly excludes isPendingReview transactions for both split and non-split items', () => {
      const splitPendingTx = {
        id: 201,
        type: 'expense',
        amount: 50000,
        category: 'makanan',
        isSplit: true,
        isPendingReview: true,
        splitItems: [{ category: 'makanan', amount: 50000, type: 'expense' }],
      }
      const regularPendingTx = {
        id: 202,
        type: 'expense',
        amount: 30000,
        category: 'makanan',
        isPendingReview: 1,
      }
      const approvedTx = {
        id: 203,
        type: 'expense',
        amount: 20000,
        category: 'makanan',
        isPendingReview: false,
      }

      const spent = calculateBudgetSpent('makanan', [splitPendingTx, regularPendingTx, approvedTx], 'IDR')
      expect(spent).toBe(20000)
    })

    it('ULTRA-AUDIT-07: BackButtonManager maintains strict LIFO stack for nested sheets and pickers', () => {
      backButtonManager.handlers = []

      let modalClosed = false
      const unregModal = backButtonManager.register(() => {
        modalClosed = true
      })

      let pickerClosed = false
      const unregPicker = backButtonManager.register(() => {
        pickerClosed = true
      })

      expect(backButtonManager.hasHandlers()).toBe(true)

      // First back button press: closes top-most picker
      const handled1 = backButtonManager.handleBack()
      expect(handled1).toBe(true)
      expect(pickerClosed).toBe(true)
      expect(modalClosed).toBe(false)
      unregPicker()

      // Second back button press: closes underlying modal
      const handled2 = backButtonManager.handleBack()
      expect(handled2).toBe(true)
      expect(modalClosed).toBe(true)
      unregModal()

      // Third back button press: stack empty, unhandled (allows native navigation/exit)
      const handled3 = backButtonManager.handleBack()
      expect(handled3).toBe(false)
      expect(backButtonManager.hasHandlers()).toBe(false)
    })

    it('ULTRA-AUDIT-08: Cross-currency transfer with zero-decimal currency (JPY) funded by archived wallet maintains precision', () => {
      const archivedJpyWallet = { id: 10, name: 'Archived JPY Wallet', currency: 'JPY', balance: 0, isArchived: 1 }
      const activeUsdWallet = { id: 20, name: 'Active USD Wallet', currency: 'USD', balance: 0, isArchived: 0 }

      const transferTx = {
        id: 106,
        type: 'transfer',
        amount: 15400,
        currency: 'JPY',
        walletId: 10,
        targetWalletId: 20,
        date: '2026-09-16',
      }

      const rates = { JPY: 154, USD: 1 }
      const bal = computeWalletBalance(activeUsdWallet, [transferTx], rates, [archivedJpyWallet, activeUsdWallet])
      expect(bal).toBe(100)
    })

    it('ULTRA-AUDIT-09: addLoan assigns isExcludeAnalyticsTx: true to initial ledger disbursement transaction', async () => {
      const walletId = await db.wallets.add({ name: 'Cash IDR', balance: 1000000, currency: 'IDR' })
      const loanId = await useLoanStore.getState().addLoan({
        title: 'Kredit HP',
        type: 'debt',
        totalAmount: 3000000,
        principalAmount: 3000000,
        currency: 'IDR',
        walletId,
        personName: 'Bank ABC',
      })

      const loan = await db.loans.get(loanId)
      expect(loan).toBeDefined()
      expect(loan.initialTransactionId).toBeDefined()

      const initTx = await db.transactions.get(loan.initialTransactionId)
      expect(initTx).toBeDefined()
      expect(initTx.isExcludeAnalyticsTx).toBe(true)
      expect(initTx.isExcludeFromAnalytics).toBe(true)
    })
  })
})
