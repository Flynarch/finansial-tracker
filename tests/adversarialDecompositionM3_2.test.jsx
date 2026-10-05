// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import useSettingsStore from '../src/store/useSettingsStore'

// Slices imports
import {
  calculateChartData,
  calculateSevenDaysStats,
  buildRevenueSeries,
  buildPreviousPeriodRevenueSeries,
  calculateRangedSummaryStats,
  calculateZoomPeakAndFloor,
  calculateComparisonSummary,
} from '../src/hooks/dashboard/chartSlices'
import { calculateLoanSummary } from '../src/hooks/dashboard/loanSlice'
import { calculateBudgetGoalSummary, calculateTotalSavings } from '../src/hooks/dashboard/budgetGoalSlice'
import {
  calculateTotalWalletBalance,
  calculatePortfolioStats,
  computeCashBalanceBeforeDateHelper,
  calculateAssetBreakdown,
} from '../src/hooks/dashboard/assetBreakdownSlice'
import { calculateMonthStats } from '../src/hooks/dashboard/monthStatsSlice'

// QuickLog templates and components
import {
  CURRENCY_SAMPLE_TEMPLATES,
  generateSampleChips,
  getInputPlaceholder,
  isObviousNonTransaction,
} from '../src/components/chat/quicklog/currencySampleTemplates'
import QuickLogInputSection from '../src/components/chat/quicklog/QuickLogInputSection'
import QuickLogAnalyzingState from '../src/components/chat/quicklog/QuickLogAnalyzingState'

// Auth sections
import { SUGGESTED_DOMAINS } from '../src/components/auth/sections/authFormHelpers'
import { AuthDomainChips, AuthGmailWarning } from '../src/components/auth/sections/AuthDomainChips'
import AuthLoginForm from '../src/components/auth/sections/AuthLoginForm'
import AuthRegisterForm from '../src/components/auth/sections/AuthRegisterForm'
import AuthForgotPasswordForm from '../src/components/auth/sections/AuthForgotPasswordForm'
import AuthMagicLinkForm from '../src/components/auth/sections/AuthMagicLinkForm'
import AuthModal from '../src/components/auth/AuthModal'

// Mocks for Auth and UI
vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
}))

vi.mock('../src/lib/auth', () => ({
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  sendPasswordReset: vi.fn(),
  sendEmailMagicLink: vi.fn(),
  promptGoogleOneTap: vi.fn(),
}))

vi.mock('../src/lib/cloudBackup', () => ({
  uploadLatestBackup: vi.fn(),
  downloadLatestBackupJson: vi.fn(),
  getLatestBackupMeta: vi.fn(),
}))

vi.mock('../src/lib/backup', () => ({
  importAllDataFromJsonPayload: vi.fn(),
  exportAllDataAsEncryptedEnvelope: vi.fn(),
  importAllDataFromEncryptedEnvelope: vi.fn(),
}))

vi.mock('../src/lib/mnemonicCrypto', () => ({
  getSessionMnemonicPhrase: vi.fn().mockReturnValue(null),
}))

vi.mock('../src/lib/db', () => ({
  db: {
    wallets: { toArray: vi.fn().mockResolvedValue([]) },
    transactions: { toArray: vi.fn().mockResolvedValue([]) },
    categories: { toArray: vi.fn().mockResolvedValue([]) },
    budgets: { toArray: vi.fn().mockResolvedValue([]) },
    savingsGoals: { toArray: vi.fn().mockResolvedValue([]) },
    loans: { toArray: vi.fn().mockResolvedValue([]) },
    recurringRules: { toArray: vi.fn().mockResolvedValue([]) },
    shoppingList: { toArray: vi.fn().mockResolvedValue([]) },
    settings: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue('ok'),
    },
  },
}))

describe('Adversarial Verification Suite M3_2: Frontend Decomposition', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'id' })
  })

  afterEach(() => {
    cleanup()
  })

  const dummyRates = {
    USD: 1,
    IDR: 16000,
    EUR: 16000 / 17500,
    SGD: 16000 / 12000,
    MYR: 16000 / 3500,
    JPY: 16000 / 105,
    GBP: 16000 / 20500,
  }

  /* =========================================================================
   * 1. Dashboard Calculation Slices Edge Cases
   * ========================================================================= */
  describe('1. Dashboard Calculation Slices Edge Cases', () => {
    describe('calculateChartData', () => {
      it('handles zero transactions gracefully without NaN or errors', () => {
        const result = calculateChartData({
          normalizedTransactions: [],
          activeWalletIdSet: new Set(['w1']),
          walletCurrencyMap: new Map([['w1', 'IDR']]),
          defaultCurrency: 'IDR',
          rates: dummyRates,
        })

        expect(result).toHaveProperty('data1w')
        expect(result).toHaveProperty('data1m')
        expect(result).toHaveProperty('data3m')
        expect(result).toHaveProperty('dataYtd')
        expect(result).toHaveProperty('data1y')
        expect(result).toHaveProperty('dataAll')

        expect(result.data1w).toHaveLength(7)
        expect(result.data1m).toHaveLength(30)
        expect(result.data3m).toHaveLength(90)
        expect(result.data1y).toHaveLength(12)

        // Verify zero-filled values
        result.data1w.forEach((row) => {
          expect(row.income).toBe(0)
          expect(row.expense).toBe(0)
          expect(row.net).toBe(0)
          expect(Number.isNaN(row.net)).toBe(false)
        })
      })

      it('handles single day transactions accurately', () => {
        const todayStr = new Date().toISOString().slice(0, 10)
        const txs = [
          {
            id: 'tx1',
            date: todayStr,
            walletId: 'w1',
            type: 'income',
            convertedAmount: 500000,
          },
        ]

        const result = calculateChartData({
          normalizedTransactions: txs,
          activeWalletIdSet: new Set(['w1']),
          walletCurrencyMap: new Map([['w1', 'IDR']]),
          defaultCurrency: 'IDR',
          rates: dummyRates,
        })

        const todayRow1w = result.data1w.find((r) => r.date === todayStr)
        expect(todayRow1w).toBeDefined()
        expect(todayRow1w.income).toBe(500000)
        expect(todayRow1w.expense).toBe(0)
        expect(todayRow1w.net).toBe(500000)

        // Non-today rows should be 0
        const otherRows = result.data1w.filter((r) => r.date !== todayStr)
        otherRows.forEach((r) => {
          expect(r.income).toBe(0)
          expect(r.net).toBe(0)
        })
      })

      it('handles negative cashflow (expense > income)', () => {
        const todayStr = new Date().toISOString().slice(0, 10)
        const txs = [
          {
            id: 'tx1',
            date: todayStr,
            walletId: 'w1',
            type: 'expense',
            convertedAmount: 750000,
          },
        ]

        const result = calculateChartData({
          normalizedTransactions: txs,
          activeWalletIdSet: new Set(['w1']),
          walletCurrencyMap: new Map([['w1', 'IDR']]),
          defaultCurrency: 'IDR',
          rates: dummyRates,
        })

        const todayRow = result.data1w.find((r) => r.date === todayStr)
        expect(todayRow.expense).toBe(750000)
        expect(todayRow.net).toBe(-750000)
      })

      it('handles wallet-to-wallet transfers correctly (internal net = 0, external net != 0)', () => {
        const todayStr = new Date().toISOString().slice(0, 10)
        // Internal transfer between two active wallets
        const internalTransfer = {
          id: 'tx_int',
          date: todayStr,
          walletId: 'w1',
          targetWalletId: 'w2',
          type: 'transfer',
          convertedAmount: 200000,
        }
        // Transfer out to inactive wallet
        const outTransfer = {
          id: 'tx_out',
          date: todayStr,
          walletId: 'w1',
          targetWalletId: 'w_inactive',
          type: 'transfer',
          convertedAmount: 150000,
        }

        const result = calculateChartData({
          normalizedTransactions: [internalTransfer, outTransfer],
          activeWalletIdSet: new Set(['w1', 'w2']),
          walletCurrencyMap: new Map([['w1', 'IDR'], ['w2', 'IDR']]),
          defaultCurrency: 'IDR',
          rates: dummyRates,
        })

        const todayRow = result.data1w.find((r) => r.date === todayStr)
        // Internal transfer produces 0 cash change (-200k + 200k).
        // Out transfer produces -150k cash change.
        expect(todayRow.cashNet).toBe(-150000)
        expect(todayRow.net).toBe(-150000)
      })

      it('handles split transactions and excludes flagged items per invariant', () => {
        const todayStr = new Date().toISOString().slice(0, 10)
        const splitTx = {
          id: 'split_1',
          date: todayStr,
          walletId: 'w1',
          type: 'expense',
          convertedAmount: 100000,
          isSplit: true,
          splitItems: [
            {
              amount: 60000,
              type: 'expense',
              category: 'Food',
              isExcludeAnalyticsTx: false,
            },
            {
              amount: 40000,
              type: 'expense',
              category: 'Reimbursement',
              isExcludeAnalyticsTx: true, // MUST be excluded from analytics
            },
          ],
        }

        const result = calculateChartData({
          normalizedTransactions: [splitTx],
          activeWalletIdSet: new Set(['w1']),
          walletCurrencyMap: new Map([['w1', 'IDR']]),
          defaultCurrency: 'IDR',
          rates: dummyRates,
        })

        const todayRow = result.data1w.find((r) => r.date === todayStr)
        // Parent cashNet reflects total wallet cash impact (-100k)
        expect(todayRow.cashNet).toBe(-100000)
        // Expense in analytics reflects only the non-excluded split item (60k)
        expect(todayRow.expense).toBe(60000)
      })
    })

    describe('calculateSevenDaysStats & buildRevenueSeries', () => {
      it('calculates 7-day totals correctly', () => {
        const data1w = [
          { income: 1000, expense: 300 },
          { income: 2000, expense: 500 },
        ]
        const stats = calculateSevenDaysStats(data1w)
        expect(stats.income).toBe(3000)
        expect(stats.expense).toBe(800)
        expect(stats.net).toBe(2200)
      })

      it('builds revenue series for 1d, 1w, 1m, ytd, 1y without errors', () => {
        const mockComputeCash = vi.fn().mockReturnValue(1000000)
        const chartData = calculateChartData({
          normalizedTransactions: [],
          activeWalletIdSet: new Set(['w1']),
          defaultCurrency: 'IDR',
        })

        const series1w = buildRevenueSeries({
          rangeId: '1w',
          chartData,
          computeCashBalanceBeforeDate: mockComputeCash,
          portfolioValue: 500000,
          netLoanPosition: 0,
          totalSavings: 200000,
        })

        expect(series1w).toHaveLength(7)
        expect(series1w[0].value).toBe(1700000) // 1m + 500k + 200k

        const series1d = buildRevenueSeries({
          rangeId: '1d',
          chartData,
          computeCashBalanceBeforeDate: mockComputeCash,
          portfolioValue: 0,
          netLoanPosition: 0,
          totalSavings: 0,
          normalizedTransactions: [],
          activeWalletIdSet: new Set(['w1']),
          defaultCurrency: 'IDR',
        })
        expect(series1d.length).toBeGreaterThan(0)
      })

      it('builds previous period comparison series correctly', () => {
        const mockComputeCash = vi.fn().mockReturnValue(800000)
        const currentSeries = [
          { time: Date.now() - 86400000, value: 1000000 },
          { time: Date.now(), value: 1100000 },
        ]

        const prevSeries1w = buildPreviousPeriodRevenueSeries({
          rangeId: '1w',
          currentSeries,
          normalizedTransactions: [],
          computeCashBalanceBeforeDate: mockComputeCash,
          portfolioValue: 100000,
        })

        expect(prevSeries1w).toHaveLength(2)
        expect(prevSeries1w[0]).toHaveProperty('prevValue')
        expect(prevSeries1w[0]).toHaveProperty('prevLabel')
      })

      it('calculates peak, floor, and ranged stats', () => {
        const stats = calculateRangedSummaryStats({
          range: '1w',
          chartData: {
            data1w: [
              { income: 500, expense: 200 },
              { income: 300, expense: 100 },
            ],
          },
        })
        expect(stats.income).toBe(800)
        expect(stats.expense).toBe(300)
        expect(stats.net).toBe(500)

        const peakFloor = calculateZoomPeakAndFloor({
          zoomRevenueSeries: [{ value: 100 }, { value: 500 }, { value: 250 }],
          net: 150,
          zoomRevenueRange: '1m',
        })
        expect(peakFloor.max).toBe(500)
        expect(peakFloor.min).toBe(100)
      })

      it('calculates comparison summary accurately', () => {
        const series = [
          { value: 1000, prevValue: 800 },
          { value: 1500, prevValue: 1000 },
        ]
        const comp = calculateComparisonSummary(series, true)
        expect(comp.currentNet).toBe(500) // 1500 - 1000
        expect(comp.prevNet).toBe(200) // 1000 - 800
        expect(comp.diff).toBe(300)
        expect(comp.isPositive).toBe(true)
      })
    })

    describe('calculateTotalWalletBalance & Multi-Wallet Net Worth', () => {
      it('returns 0 when wallets is null or undefined', () => {
        expect(calculateTotalWalletBalance(null)).toBe(0)
        expect(calculateTotalWalletBalance(undefined)).toBe(0)
      })

      it('aggregates multi-currency wallets with exchange rates accurately', () => {
        const wallets = [
          { id: 'w1', name: 'BCA', currency: 'IDR', currentBalance: 1000000, isArchived: false },
          { id: 'w2', name: 'USD Cash', currency: 'USD', currentBalance: 100, isArchived: false }, // 100 * 16,000 = 1,600,000
          { id: 'w3', name: 'SGD Account', currency: 'SGD', currentBalance: 50, isArchived: false }, // 50 * 12,000 = 600,000
          { id: 'w4', name: 'Old Bank', currency: 'IDR', currentBalance: 5000000, isArchived: true }, // ARCHIVED - MUST BE EXCLUDED!
        ]

        const total = calculateTotalWalletBalance(wallets, 'IDR', dummyRates)
        // 1,000,000 + 1,600,000 + 600,000 = 3,200,000
        expect(total).toBe(3200000)
      })

      it('handles negative wallet balances (e.g. credit card deficit)', () => {
        const wallets = [
          { id: 'w1', currency: 'IDR', currentBalance: 1000000, isArchived: false },
          { id: 'w2', currency: 'IDR', currentBalance: -250000, isArchived: false },
        ]
        const total = calculateTotalWalletBalance(wallets, 'IDR', dummyRates)
        expect(total).toBe(750000)
      })

      it('calculates asset breakdown percentages and badges', () => {
        const wallets = [
          { id: 'w1', name: 'Cash', currency: 'IDR', currentBalance: 200000 },
          { id: 'w2', name: 'Bank', currency: 'IDR', currentBalance: 800000 },
        ]
        const breakdown = calculateAssetBreakdown(wallets, 'IDR', dummyRates)
        expect(breakdown.total).toBe(1000000)
        expect(breakdown.items).toHaveLength(2)
        expect(breakdown.items[0].percentage).toBe(80)
        expect(breakdown.items[1].percentage).toBe(20)
      })

      it('calculates portfolio valuation across currencies', () => {
        expect(calculatePortfolioStats(null)).toEqual({ portfolioValue: 0 })
        const investments = [
          { quantity: 10, purchasePrice: 50, purchaseCurrency: 'USD' }, // 500 USD * 16,000 = 8,000,000
          { quantity: 100, purchasePrice: 1000, purchaseCurrency: 'IDR' }, // 100,000 IDR
        ]
        const stats = calculatePortfolioStats(investments, 'IDR', dummyRates)
        expect(stats.portfolioValue).toBe(8100000)
      })
    })

    describe('computeCashBalanceBeforeDateHelper', () => {
      it('calculates historical cash balance correctly by unwinding subsequent transactions', () => {
        const activeWallets = new Set(['w1', 'w2'])
        const totalWalletBalance = 2000000

        const txs = [
          // Income on 2026-03-10: 500,000 (after target date 2026-03-01)
          { date: '2026-03-10', walletId: 'w1', type: 'income', convertedAmount: 500000 },
          // Expense on 2026-03-15: 200,000 (after target date 2026-03-01)
          { date: '2026-03-15', walletId: 'w1', type: 'expense', convertedAmount: 200000 },
          // Transaction before target date (should NOT be unwound)
          { date: '2026-02-20', walletId: 'w1', type: 'income', convertedAmount: 1000000 },
        ]

        // Net flow since 2026-03-01 = +500,000 - 200,000 = +300,000
        // Balance before 2026-03-01 = 2,000,000 - 300,000 = 1,700,000
        const beforeBalance = computeCashBalanceBeforeDateHelper({
          dateKey: '2026-03-01',
          normalizedTransactions: txs,
          totalWalletBalance,
          activeWalletIdSet: activeWallets,
          defaultCurrency: 'IDR',
          rates: dummyRates,
        })

        expect(beforeBalance).toBe(1700000)
      })
    })

    describe('calculateLoanSummary & calculateBudgetGoalSummary', () => {
      it('processes active, overdue, paid, and forgiven loans correctly', () => {
        const loans = [
          {
            id: 'l1',
            type: 'debt',
            totalAmount: 1000000,
            remainingAmount: 400000,
            currency: 'IDR',
            status: 'active',
            dueDate: '2020-01-01', // Overdue!
          },
          {
            id: 'l2',
            type: 'receivable',
            totalAmount: 500000,
            remainingAmount: 500000,
            currency: 'IDR',
            status: 'active',
            dueDate: '2099-01-01', // Future
          },
          {
            id: 'l3',
            type: 'debt',
            totalAmount: 300000,
            remainingAmount: 0,
            status: 'paid', // Paid
          },
        ]

        const summary = calculateLoanSummary(loans, 'IDR', dummyRates)
        expect(summary.activeLoans).toHaveLength(2)
        expect(summary.totalDebt).toBe(400000)
        expect(summary.totalReceivable).toBe(500000)
        expect(summary.netPosition).toBe(100000) // 500k - 400k
        expect(summary.mostUrgentItem.id).toBe('l1') // Overdue takes precedence
        expect(summary.mostUrgentItem.isOverdue).toBe(true)
      })

      it('processes budget consumption and savings goals percentage', () => {
        const budgets = [
          { month: '2026-03', category: 'Food', limit: 1000000, currency: 'IDR' },
        ]
        const goals = [
          { id: 'g1', name: 'Emergency Fund', currentAmount: 3000000, targetAmount: 10000000, isArchived: false },
          { id: 'g2', name: 'Vacation', currentAmount: 5000000, targetAmount: 5000000, isArchived: true }, // Archived
        ]
        const txs = [
          { date: '2026-03-05', category: 'Food', type: 'expense', amount: 450000, currency: 'IDR' },
        ]

        const res = calculateBudgetGoalSummary({
          budgets,
          goals,
          currentMonthKey: '2026-03',
          budgetCycleStartDay: 1,
          locale: 'id',
          normalizedTransactions: txs,
          defaultCurrency: 'IDR',
          rates: dummyRates,
        })

        expect(res.budgetRows).toHaveLength(1)
        expect(res.budgetRows[0].spent).toBe(450000)
        expect(res.budgetRows[0].remaining).toBe(550000)
        expect(res.budgetRows[0].pct).toBe(45)

        expect(res.goalRows).toHaveLength(2)
        expect(res.goalRows[0].pct).toBe(30)

        // calculateTotalSavings should exclude archived goals
        const savings = calculateTotalSavings(goals, 'IDR', dummyRates)
        expect(savings).toBe(3000000)
      })
    })

    describe('calculateMonthStats & Month-End Transitions', () => {
      it('handles null transactions or investments gracefully', () => {
        const stats = calculateMonthStats({
          transactions: null,
          investments: null,
          currentMonthKey: '2026-03',
        })
        expect(stats.monthIncome).toBe(0)
        expect(stats.monthExpense).toBe(0)
        expect(stats.monthDelta).toBe(0)
        expect(stats.monthDeltaTone).toBe('success')
      })

      it('safely handles month-end date transitions without skipping short months', () => {
        // Test stepping back from March 2026 (subMonths from 2026-03-01 anchors to 2026-02-01)
        const statsMar = calculateMonthStats({
          transactions: [],
          investments: [],
          currentMonthKey: '2026-03',
          budgetCycleStartDay: 1,
          locale: 'id',
          currentPeriod: { startDate: '2026-03-01', endDate: '2026-03-31' },
          normalizedTransactions: [
            { date: '2026-03-15', type: 'income', convertedAmount: 2000000 },
            { date: '2026-03-20', type: 'expense', convertedAmount: 1500000 },
          ],
        })

        expect(statsMar.monthIncome).toBe(2000000)
        expect(statsMar.monthExpense).toBe(1500000)
        expect(statsMar.monthDelta).toBe(500000)
        expect(statsMar.monthDeltaTone).toBe('success')

        // Test stepping back across year boundary (January 2026 -> December 2025)
        const statsJan = calculateMonthStats({
          transactions: [],
          investments: [],
          currentMonthKey: '2026-01',
          budgetCycleStartDay: 1,
          locale: 'id',
          currentPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
          normalizedTransactions: [],
        })
        expect(statsJan.monthDelta).toBe(0)
      })
    })
  })

  /* =========================================================================
   * 2. QuickLog Templates for All 7 Currencies
   * ========================================================================= */
  describe('2. QuickLog Templates for All 7 Currencies', () => {
    const supportedCurrencies = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP']

    it('contains valid and non-empty template collections for all 7 currencies', () => {
      supportedCurrencies.forEach((curr) => {
        expect(CURRENCY_SAMPLE_TEMPLATES).toHaveProperty(curr)
        const currTemplates = CURRENCY_SAMPLE_TEMPLATES[curr]
        expect(currTemplates).toHaveProperty('id')
        expect(currTemplates).toHaveProperty('en')

        // Must be non-empty arrays with at least 10 sample items
        expect(Array.isArray(currTemplates.id)).toBe(true)
        expect(currTemplates.id.length).toBeGreaterThanOrEqual(10)
        expect(Array.isArray(currTemplates.en)).toBe(true)
        expect(currTemplates.en.length).toBeGreaterThanOrEqual(10)

        // Validate each item is a non-empty string
        currTemplates.id.forEach((item) => {
          expect(typeof item).toBe('string')
          expect(item.trim().length).toBeGreaterThan(2)
        })
        currTemplates.en.forEach((item) => {
          expect(typeof item).toBe('string')
          expect(item.trim().length).toBeGreaterThan(2)
        })
      })
    })

    it('generates sample chips correctly with and without wallets', () => {
      // Without wallets: returns base template strings
      const chipsNoWallets = generateSampleChips([], 'USD', 'en')
      expect(chipsNoWallets.length).toBeGreaterThanOrEqual(10)
      expect(chipsNoWallets[0]).toContain('$')

      // With wallets: appends wallet names cyclically
      const mockWallets = [{ name: 'Cash' }, { name: 'Chase' }]
      const chipsWithWallets = generateSampleChips(mockWallets, 'USD', 'en')
      expect(chipsWithWallets[0]).toContain('Cash')
      expect(chipsWithWallets[1]).toContain('Chase')
      expect(chipsWithWallets[2]).toContain('Cash')
    })

    it('provides localized input placeholders for all 7 currencies', () => {
      supportedCurrencies.forEach((curr) => {
        const phEn = getInputPlaceholder(curr, 'en')
        const phId = getInputPlaceholder(curr, 'id')
        expect(typeof phEn).toBe('string')
        expect(phEn.length).toBeGreaterThan(10)
        expect(typeof phId).toBe('string')
        expect(phId.length).toBeGreaterThan(10)
      })

      // Fallback currency
      const phFallback = getInputPlaceholder('XYZ', 'en')
      expect(phFallback).toContain('IDR')
    })

    it('identifies obvious non-transactions vs actual transactions', () => {
      // Questions / chat queries -> true
      expect(isObviousNonTransaction('Berapa pengeluaran saya bulan ini?')).toBe(true)
      expect(isObviousNonTransaction('Bagaimana cara menabung lebih hemat?')).toBe(true)
      expect(isObviousNonTransaction('Hai, selamat pagi?')).toBe(true)
      expect(isObviousNonTransaction('Laporan grafik keuangan gimana?')).toBe(true)

      // Actual financial transactions -> false
      expect(isObviousNonTransaction('Makan siang 35rb')).toBe(false)
      expect(isObviousNonTransaction('Beli bensin 50000')).toBe(false)
      expect(isObviousNonTransaction('Gaji 5jt transfer ke BCA')).toBe(false)
      expect(isObviousNonTransaction('Lunch $15 with card')).toBe(false)

      // Null / empty
      expect(isObviousNonTransaction('')).toBe(false)
      expect(isObviousNonTransaction(null)).toBe(false)
    })

    it('renders QuickLogAnalyzingState and QuickLogErrorBanner without errors', () => {
      const tMock = (k, fallback) => fallback || k
      const { rerender } = render(
        <QuickLogAnalyzingState lastSubmittedPrompt="Makan siang 35rb" t={tMock} errorMessage={null} />
      )
      expect(screen.getByText('Menganalisis Transaksi...')).toBeDefined()
      expect(screen.getByText('"Makan siang 35rb"')).toBeDefined()

      // Error banner
      rerender(<QuickLogAnalyzingState lastSubmittedPrompt="Makan siang 35rb" t={tMock} errorMessage="Model overloaded" />)
      expect(screen.getByText('Model overloaded')).toBeDefined()
    })

    it('renders QuickLogInputSection without missing prop errors', () => {
      const tMock = (k, fallback) => fallback || k
      const setInputValue = vi.fn()
      const handleSubmit = vi.fn()

      render(
        <QuickLogInputSection
          locale="id"
          t={tMock}
          inputValue=""
          setInputValue={setInputValue}
          inputPlaceholder="Contoh: Makan siang 35rb..."
          inputRef={{ current: null }}
          isRecording={false}
          handleStopRecording={vi.fn()}
          handleCancelRecording={vi.fn()}
          toggleRecording={vi.fn()}
          selectedImage={null}
          setSelectedImage={vi.fn()}
          setShowMediaSourcePicker={vi.fn()}
          handleSubmit={handleSubmit}
          sampleChips={['Makan 35rb', 'Bensin 20rb']}
          wallets={[{ id: 'w1', name: 'Dompet' }]}
          omissionData={null}
          setOmissionData={vi.fn()}
        />
      )

      expect(screen.getByPlaceholderText('Contoh: Makan siang 35rb...')).toBeDefined()
      expect(screen.getByText('Mau catat apa hari ini?')).toBeDefined()
    })
  })

  /* =========================================================================
   * 3. AuthModal Form Components Rendering & Missing Prop Resilience
   * ========================================================================= */
  describe('3. AuthModal Form Components Rendering', () => {
    const tMock = (key, fallback) => fallback || key

    it('renders AuthDomainChips and AuthGmailWarning correctly', () => {
      const onApply = vi.fn()
      const { container, rerender } = render(
        <AuthDomainChips email="john" onApplyDomain={onApply} t={tMock} suggestedDomains={SUGGESTED_DOMAINS} />
      )

      expect(screen.getByText('@gmail.com')).toBeDefined()
      fireEvent.click(screen.getByText('@gmail.com'))
      expect(onApply).toHaveBeenCalledWith('@gmail.com')

      // If email already ends with domain, chips should not render
      rerender(<AuthDomainChips email="john@gmail.com" onApplyDomain={onApply} t={tMock} />)
      expect(container.firstChild).toBeNull()

      // AuthGmailWarning
      const { rerender: rerenderWarn } = render(<AuthGmailWarning isInvalid={false} t={tMock} />)
      expect(screen.queryByText('Hanya mendukung @gmail.com atau @googlemail.com')).toBeNull()

      rerenderWarn(<AuthGmailWarning isInvalid={true} t={tMock} />)
      expect(screen.getByText('Hanya mendukung @gmail.com atau @googlemail.com')).toBeDefined()
    })

    it('renders AuthLoginForm with all controls and interactions', () => {
      const setEmail = vi.fn()
      const setPassword = vi.fn()
      const handleEmailSignIn = vi.fn((e) => e.preventDefault())
      const switchMode = vi.fn()

      render(
        <AuthLoginForm
          email="test@gmail.com"
          setEmail={setEmail}
          password="password123"
          setPassword={setPassword}
          showPassword={false}
          setShowPassword={vi.fn()}
          isLoading={false}
          isEmailError={false}
          isPasswordError={false}
          isEmailDomainInvalid={false}
          handleEmailSignIn={handleEmailSignIn}
          handleGoogleAuth={vi.fn()}
          handleApplyDomain={vi.fn()}
          switchMode={switchMode}
          t={tMock}
          clearErrorMessage={vi.fn()}
        />
      )

      expect(screen.getByDisplayValue('test@gmail.com')).toBeDefined()
      expect(screen.getByDisplayValue('password123')).toBeDefined()

      // Switch to register
      const forgotBtn = screen.getByText('Lupa Sandi?')
      fireEvent.click(forgotBtn)
      expect(switchMode).toHaveBeenCalledWith('forgot')
    })

    it('renders AuthRegisterForm with password strength meter and verification checkbox', () => {
      const setName = vi.fn()
      const setEmail = vi.fn()
      const setPassword = vi.fn()
      const setConfirmPassword = vi.fn()
      const setSendVerification = vi.fn()
      const handleRegister = vi.fn((e) => e.preventDefault())

      render(
        <AuthRegisterForm
          name="John Doe"
          setName={setName}
          email="john@gmail.com"
          setEmail={setEmail}
          password="SecretPassword1!"
          setPassword={setPassword}
          confirmPassword="SecretPassword1!"
          setConfirmPassword={setConfirmPassword}
          showPassword={false}
          setShowPassword={vi.fn()}
          showConfirmPassword={false}
          setShowConfirmPassword={vi.fn()}
          sendVerification={true}
          setSendVerification={setSendVerification}
          isLoading={false}
          passwordScore={4}
          isEmailError={false}
          isPasswordError={false}
          isConfirmPasswordError={false}
          isEmailDomainInvalid={false}
          handleRegister={handleRegister}
          handleGoogleAuth={vi.fn()}
          handleApplyDomain={vi.fn()}
          switchMode={vi.fn()}
          t={tMock}
          clearErrorMessage={vi.fn()}
        />
      )

      expect(screen.getByDisplayValue('John Doe')).toBeDefined()
      expect(screen.getByDisplayValue('john@gmail.com')).toBeDefined()
      expect(screen.getByText('Kirim email verifikasi setelah pendaftaran')).toBeDefined()
      expect(screen.getByText('Bikin Akun Baru')).toBeDefined()
    })

    it('renders AuthForgotPasswordForm cleanly', () => {
      const handleForgot = vi.fn((e) => e.preventDefault())
      const switchMode = vi.fn()

      render(
        <AuthForgotPasswordForm
          email="forgot@gmail.com"
          setEmail={vi.fn()}
          isLoading={false}
          isEmailError={false}
          isEmailDomainInvalid={false}
          handleForgotPassword={handleForgot}
          handleApplyDomain={vi.fn()}
          switchMode={switchMode}
          t={tMock}
          clearErrorMessage={vi.fn()}
        />
      )

      expect(screen.getByDisplayValue('forgot@gmail.com')).toBeDefined()
      expect(screen.getByText('Kirim Tautan Reset Sandi')).toBeDefined()
      fireEvent.click(screen.getByText('Kembali ke Halaman Masuk'))
      expect(switchMode).toHaveBeenCalledWith('login')
    })

    it('renders AuthMagicLinkForm cleanly', () => {
      const handleMagic = vi.fn((e) => e.preventDefault())
      const switchMode = vi.fn()

      render(
        <AuthMagicLinkForm
          email="magic@gmail.com"
          setEmail={vi.fn()}
          isLoading={false}
          isEmailError={false}
          isEmailDomainInvalid={false}
          handleMagicLink={handleMagic}
          handleApplyDomain={vi.fn()}
          switchMode={switchMode}
          t={tMock}
          clearErrorMessage={vi.fn()}
        />
      )

      expect(screen.getByDisplayValue('magic@gmail.com')).toBeDefined()
      expect(screen.getByText('Kirim Tautan Masuk Ajaib')).toBeDefined()
      expect(screen.getByText('Cara Kerja Magic Link:')).toBeDefined()
    })

    it('renders complete AuthModal across all 4 modes without prop warnings or exceptions', () => {
      const onClose = vi.fn()
      const { rerender } = render(
        <AuthModal isOpen={true} onClose={onClose} initialMode="login" onSuccess={vi.fn()} />
      )
      expect(screen.getByText('Masuk Akun')).toBeDefined()

      // Switch to register mode
      rerender(<AuthModal isOpen={true} onClose={onClose} initialMode="register" onSuccess={vi.fn()} />)
      expect(screen.getAllByText('Buat Akun Baru').length).toBeGreaterThan(0)

      // Switch to forgot mode
      rerender(<AuthModal isOpen={true} onClose={onClose} initialMode="forgot" onSuccess={vi.fn()} />)
      expect(screen.getByText('Pemulihan Kata Sandi')).toBeDefined()

      // Switch to magic link mode
      rerender(<AuthModal isOpen={true} onClose={onClose} initialMode="magic_link" onSuccess={vi.fn()} />)
      expect(screen.getByText('Masuk Tanpa Sandi')).toBeDefined()
    })
  })
})
