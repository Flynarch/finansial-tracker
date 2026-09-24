import { describe, it, expect, beforeEach } from 'vitest'

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    _store: {},
    getItem(key) { return this._store[key] ?? null },
    setItem(key, val) { this._store[key] = String(val) },
    removeItem(key) { delete this._store[key] },
    clear() { this._store = {} },
  }
}

import {
  getCompactItems,
  getSavedNetWorthRange,
  clearCachedDashboardState,
  getCachedDashboardTransactions,
  setCachedDashboardTransactions,
  getCachedDashboardWallets,
  setCachedDashboardWallets,
  computeNetWorthGrowth,
  calculateRangeNetWorthGrowth,
  formatGrowthPercentage,
  generateMonthlyData,
  calculatePeriodStats,
  calculate1DHourlyFlow,
} from '../src/hooks/useDashboardData'
import { getBudgetPeriodDateRange, getCurrentBudgetMonthKey } from '../src/lib/budgetUtils'

describe('useDashboardData - Unit Tests', () => {
  beforeEach(() => {
    clearCachedDashboardState()
    localStorage.clear()
  })

  describe('getCompactItems', () => {
    it('returns Indonesian range items by default', () => {
      const items = getCompactItems('id')
      expect(items).toEqual([
        { id: '1d', label: '1H' },
        { id: '1w', label: '1M' },
        { id: '1m', label: '1B' },
        { id: '3m', label: '3B' },
        { id: 'ytd', label: 'YTD' },
        { id: '1y', label: '1T' },
        { id: 'all', label: 'SEMUA' },
      ])
    })

    it('returns English range items when locale is en', () => {
      const items = getCompactItems('en')
      expect(items).toEqual([
        { id: '1d', label: '1D' },
        { id: '1w', label: '1W' },
        { id: '1m', label: '1M' },
        { id: '3m', label: '3M' },
        { id: 'ytd', label: 'YTD' },
        { id: '1y', label: '1Y' },
        { id: 'all', label: 'ALL' },
      ])
    })
  })

  describe('getSavedNetWorthRange', () => {
    it('defaults to 1m when localStorage is empty', () => {
      expect(getSavedNetWorthRange()).toBe('1m')
    })

    it('maps legacy named keys to compact range IDs', () => {
      localStorage.setItem('ft_networth_range', 'today')
      expect(getSavedNetWorthRange()).toBe('1d')

      localStorage.setItem('ft_networth_range', 'weekly')
      expect(getSavedNetWorthRange()).toBe('1w')

      localStorage.setItem('ft_networth_range', 'monthly')
      expect(getSavedNetWorthRange()).toBe('1m')

      localStorage.setItem('ft_networth_range', 'yearly')
      expect(getSavedNetWorthRange()).toBe('1y')
    })

    it('returns stored value if already formatted as compact ID', () => {
      localStorage.setItem('ft_networth_range', '3m')
      expect(getSavedNetWorthRange()).toBe('3m')

      localStorage.setItem('ft_networth_range', 'ytd')
      expect(getSavedNetWorthRange()).toBe('ytd')
    })
  })

  describe('Module-level Cache Helpers', () => {
    it('sets and retrieves transactions in memory cache', () => {
      expect(getCachedDashboardTransactions()).toBeNull()
      const mockTxs = [{ id: 1, amount: 50000 }]
      setCachedDashboardTransactions(mockTxs)
      expect(getCachedDashboardTransactions()).toEqual(mockTxs)
    })

    it('sets and retrieves wallets in memory cache', () => {
      expect(getCachedDashboardWallets()).toBeNull()
      const mockWallets = [{ id: 1, name: 'BCA', currentBalance: 100000 }]
      setCachedDashboardWallets(mockWallets)
      expect(getCachedDashboardWallets()).toEqual(mockWallets)
    })

    it('clears all cached items when clearCachedDashboardState is called', () => {
      setCachedDashboardTransactions([{ id: 1 }])
      setCachedDashboardWallets([{ id: 1 }])
      clearCachedDashboardState()
      expect(getCachedDashboardTransactions()).toBeNull()
      expect(getCachedDashboardWallets()).toBeNull()
    })
  })

  describe('Month Rollover & Month Keys Generation', () => {
    it('does not skip February or duplicate months on the 31st of a month', () => {
      // Simulate calling generateMonthly on March 31st (month boundary trap)
      const march31 = new Date(2026, 2, 31) // March 31, 2026
      const { arr, map } = generateMonthlyData(3, march31)

      expect(arr.length).toBe(3)
      // Expect January, February, March 2026
      expect(arr[0].key).toBe('2026-01')
      expect(arr[1].key).toBe('2026-02')
      expect(arr[2].key).toBe('2026-03')

      expect(map.has('2026-01')).toBe(true)
      expect(map.has('2026-02')).toBe(true)
      expect(map.has('2026-03')).toBe(true)
    })

    it('generates 12 distinct consecutive month keys ending on current reference month', () => {
      const may31 = new Date(2026, 4, 31) // May 31, 2026
      const { arr } = generateMonthlyData(12, may31)

      expect(arr.length).toBe(12)
      const keys = arr.map((item) => item.key)
      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(12)
      expect(arr[11].key).toBe('2026-05')
      expect(arr[0].key).toBe('2025-06')
    })
  })

  describe('computeNetWorthGrowth', () => {
    it('calculates accurate growth percentage on positive starting net worth', () => {
      const { net, pct } = computeNetWorthGrowth(10000000, 12500000)
      expect(net).toBe(2500000)
      expect(pct).toBe(25)
    })

    it('returns 100% when startVal is 0 and net is positive', () => {
      const { net, pct } = computeNetWorthGrowth(0, 5000000)
      expect(net).toBe(5000000)
      expect(pct).toBe(100)
    })

    it('handles negative starting net worth (debt reduction) accurately', () => {
      // Starting with -10,000,000 net worth, improved to -2,000,000 (net gain: +8,000,000)
      const { net, pct } = computeNetWorthGrowth(-10000000, -2000000)
      expect(net).toBe(8000000)
      // Percentage must be based on absolute starting value: (8m / 10m) * 100 = 80%
      expect(pct).toBe(80)
    })

    it('handles negative starting net worth with further decline', () => {
      // Starting with -5,000,000 net worth, deteriorated to -7,500,000 (net change: -2,500,000)
      const { net, pct } = computeNetWorthGrowth(-5000000, -7500000)
      expect(net).toBe(-2500000)
      expect(pct).toBe(-50)
    })
  })

  describe('formatGrowthPercentage', () => {
    it('formats positive and negative percentages with clean signs', () => {
      expect(formatGrowthPercentage(15, true)).toBe('+15%')
      expect(formatGrowthPercentage(-15, true)).toBe('-15%')
      expect(formatGrowthPercentage(0, true)).toBe('0%')
    })

    it('formats decimal percentages cleanly with 1 decimal place when under 10%', () => {
      expect(formatGrowthPercentage(2.4, true)).toBe('+2.4%')
      expect(formatGrowthPercentage(-2.4, true)).toBe('-2.4%')
      expect(formatGrowthPercentage(0.4, true)).toBe('+0.4%')
      expect(formatGrowthPercentage(-0.4, true)).toBe('-0.4%')
    })

    it('handles tiny percentages without showing weird 0% artifacts', () => {
      expect(formatGrowthPercentage(0.02, true)).toBe('+<0.1%')
      expect(formatGrowthPercentage(-0.02, true)).toBe('-<0.1%')
    })
  })

  describe('calculateRangeNetWorthGrowth', () => {
    it('accurately includes Day 0 transactions in 7d (1w) net worth growth calculation', () => {
      // Scenario: Current net worth is 10,000,000.
      // In the last 7 days:
      // Day 0 (7 days ago): user spent 300,000 (net: -300,000)
      // Day 2 (5 days ago): user earned 100,000 (net: +100,000)
      // Day 5 (2 days ago): user spent 50,000 (net: -50,000)
      // Overall 7-day net flow: -300k + 100k - 50k = -250,000 (NEGATIVE)
      const mockChartData = {
        data1w: [
          { date: '2026-09-18', net: -300000 },
          { date: '2026-09-19', net: 0 },
          { date: '2026-09-20', net: 100000 },
          { date: '2026-09-21', net: 0 },
          { date: '2026-09-22', net: 0 },
          { date: '2026-09-23', net: -50000 },
          { date: '2026-09-24', net: 0 },
        ],
      }

      const result = calculateRangeNetWorthGrowth('1w', 10000000, mockChartData, null)

      // Net must accurately be -250,000 (never falsely positive!)
      expect(result.net).toBe(-250000)
      // StartVal 7 days ago was 10,000,000 - (-250,000) = 10,250,000
      expect(result.startVal).toBe(10250000)
      // Percentage must be negative: (-250,000 / 10,250,000) * 100 = -2.439%
      expect(result.pct).toBeCloseTo(-2.44, 1)
      expect(formatGrowthPercentage(result.pct, true)).toBe('-2.4%')
    })

    it('accurately calculates 1d today net flow', () => {
      const todayStats = { todayNet: 150000 }
      const result = calculateRangeNetWorthGrowth('1d', 5000000, {}, todayStats)

      expect(result.net).toBe(150000)
      expect(result.startVal).toBe(4850000)
      expect(result.pct).toBeCloseTo(3.09, 1)
    })
  })

  describe('Payday Cycle & Period Stats Aggregation (Finding 1.2 & 1.5)', () => {
    it('correctly aggregates transactions logged between payday (25th) and month-end into active cycle', () => {
      // Simulate today is 2026-03-26, payday cycle start day is 25
      const refDate = new Date(2026, 2, 26) // 26 March 2026
      const budgetCycleStartDay = 25
      const currentMonthKey = getCurrentBudgetMonthKey(refDate, budgetCycleStartDay)
      expect(currentMonthKey).toBe('2026-04')

      const currentPeriod = getBudgetPeriodDateRange(currentMonthKey, budgetCycleStartDay, 'id')
      expect(currentPeriod.startDate).toBe('2026-03-25')
      expect(currentPeriod.endDate).toBe('2026-04-24')

      const mockTxs = [
        // Transaction logged on payday cycle start (25th)
        { id: 1, date: '2026-03-25', type: 'income', amount: 10000000 },
        // Transaction logged between payday and month-end (26th)
        { id: 2, date: '2026-03-26', type: 'expense', amount: 50000 },
        // Transaction logged on month-end (31st)
        { id: 3, date: '2026-03-31', type: 'expense', amount: 150000 },
        // Transaction logged in next calendar month within same cycle (10th April)
        { id: 4, date: '2026-04-10', type: 'expense', amount: 200000 },
        // Transaction before payday (10th March) - belongs to PREVIOUS cycle
        { id: 5, date: '2026-03-10', type: 'expense', amount: 300000 },
        // Transaction after cycle end (25th April) - belongs to NEXT cycle
        { id: 6, date: '2026-04-25', type: 'expense', amount: 400000 },
      ]

      const stats = calculatePeriodStats(mockTxs, currentPeriod, 'IDR', null)
      expect(stats.income).toBe(10000000)
      // Transactions 2 (50k) + 3 (150k) + 4 (200k) = 400k
      expect(stats.expense).toBe(400000)
    })

    it('correctly calculates previous cycle period stats without skipping a month', () => {
      const budgetCycleStartDay = 25
      const lastMonthKey = '2026-03' // previous budget month
      const lastPeriod = getBudgetPeriodDateRange(lastMonthKey, budgetCycleStartDay, 'id')
      expect(lastPeriod.startDate).toBe('2026-02-25')
      expect(lastPeriod.endDate).toBe('2026-03-24')

      const mockTxs = [
        // Transaction on 2026-03-10 belongs to previous cycle
        { id: 5, date: '2026-03-10', type: 'expense', amount: 300000 },
        // Transaction on 2026-02-26 belongs to previous cycle
        { id: 7, date: '2026-02-26', type: 'income', amount: 8000000 },
        // Transaction on 2026-03-26 belongs to current cycle, not previous
        { id: 2, date: '2026-03-26', type: 'expense', amount: 50000 },
      ]

      const lastStats = calculatePeriodStats(mockTxs, lastPeriod, 'IDR', null)
      expect(lastStats.income).toBe(8000000)
      expect(lastStats.expense).toBe(300000)
    })

    it('correctly unpacks split transactions and respects isExcludeAnalyticsTx per item', () => {
      const currentPeriod = { startDate: '2026-03-25', endDate: '2026-04-24' }
      const mockTxs = [
        {
          id: 10,
          date: '2026-03-28',
          type: 'expense',
          amount: 500000,
          isSplit: true,
          splitItems: [
            { category: 'makanan_minuman', amount: 200000, type: 'expense' },
            { category: 'tabungan', amount: 300000, type: 'expense', isExcludeFromAnalytics: true }, // internal savings excluded
          ],
        },
      ]

      const stats = calculatePeriodStats(mockTxs, currentPeriod, 'IDR', null)
      // Only the 200k expense should be counted; 300k tabungan is excluded from analytics
      expect(stats.expense).toBe(200000)
    })

    it('converts multi-currency split transactions using parent tx.currency when si.currency is omitted', () => {
      const currentPeriod = { startDate: '2026-03-25', endDate: '2026-04-24' }
      const mockRates = { USD: 1, IDR: 16000 }
      const mockTxs = [
        {
          id: 11,
          date: '2026-03-29',
          type: 'expense',
          amount: 50, // 50 USD total
          currency: 'USD', // Resolved from wallet in normalizedTransactions
          isSplit: true,
          splitItems: [
            { category: 'makanan', amount: 30, type: 'expense' }, // 30 USD -> 480,000 IDR
            { category: 'transportasi', amount: 20, type: 'expense' }, // 20 USD -> 320,000 IDR
          ],
        },
      ]

      const stats = calculatePeriodStats(mockTxs, currentPeriod, 'IDR', mockRates)
      // 30 USD * 16,000 + 20 USD * 16,000 = 800,000 IDR
      expect(stats.expense).toBe(800000)
      expect(stats.income).toBe(0)
    })

    it('correctly handles distinct per-item currencies within a split transaction', () => {
      const currentPeriod = { startDate: '2026-03-25', endDate: '2026-04-24' }
      const mockRates = { USD: 1, SGD: 1.35, IDR: 16000 }
      const mockTxs = [
        {
          id: 12,
          date: '2026-03-30',
          type: 'expense',
          amount: 100,
          currency: 'USD',
          isSplit: true,
          splitItems: [
            { category: 'belanja', amount: 10, currency: 'USD', type: 'expense' }, // 10 USD = 160,000 IDR
            { category: 'hiburan', amount: 13.5, currency: 'SGD', type: 'expense' }, // 13.5 SGD = 10 USD = 160,000 IDR
            { category: 'donasi', amount: 50000, currency: 'IDR', type: 'expense' }, // 50,000 IDR
          ],
        },
      ]

      const stats = calculatePeriodStats(mockTxs, currentPeriod, 'IDR', mockRates)
      // 160,000 + 160,000 + 50,000 = 370,000 IDR
      expect(stats.expense).toBeCloseTo(370000, -1)
    })
  })

  describe('calculate1DHourlyFlow (1D Timeline Invariant Integrity)', () => {
    const todayKey = '2026-09-17'
    const activeWalletIdSet = new Set(['1', '2'])
    const walletCurrencyMap = new Map([
      ['1', 'IDR'],
      ['2', 'USD'],
      ['3', 'IDR'], // Archived wallet
    ])

    it('places active wallet income and expense at appropriate hour', () => {
      const txs = [
        {
          id: 1,
          date: todayKey,
          type: 'income',
          convertedAmount: 500000,
          walletId: 1,
          createdAt: new Date(`${todayKey}T09:15:00`).getTime(),
        },
        {
          id: 2,
          date: todayKey,
          type: 'expense',
          convertedAmount: 150000,
          walletId: 1,
          createdAt: new Date(`${todayKey}T14:30:00`).getTime(),
        },
      ]

      const flow = calculate1DHourlyFlow(txs, todayKey, activeWalletIdSet, walletCurrencyMap, 'IDR', null)
      expect(flow[9]).toBe(500000)
      expect(flow[14]).toBe(-150000)
      expect(flow[0]).toBe(0)
    })

    it('ignores transactions in archived wallets to prevent active cash leakage', () => {
      const txs = [
        {
          id: 3,
          date: todayKey,
          type: 'income',
          convertedAmount: 1000000,
          walletId: 3, // Archived wallet (not in activeWalletIdSet)
          createdAt: new Date(`${todayKey}T10:00:00`).getTime(),
        },
      ]

      const flow = calculate1DHourlyFlow(txs, todayKey, activeWalletIdSet, walletCurrencyMap, 'IDR', null)
      expect(flow[10]).toBe(0)
    })

    it('ignores intra-active transfers as they do not change total active cash', () => {
      const txs = [
        {
          id: 4,
          date: todayKey,
          type: 'transfer',
          convertedAmount: 200000,
          walletId: 1, // Active wallet
          targetWalletId: 2, // Active wallet
          createdAt: new Date(`${todayKey}T11:00:00`).getTime(),
        },
      ]

      const flow = calculate1DHourlyFlow(txs, todayKey, activeWalletIdSet, walletCurrencyMap, 'IDR', null)
      expect(flow[11]).toBe(0)
    })

    it('decreases active cash on transfer from active wallet to archived wallet', () => {
      const txs = [
        {
          id: 5,
          date: todayKey,
          type: 'transfer',
          convertedAmount: 250000,
          walletId: 1, // Active
          targetWalletId: 3, // Archived
          createdAt: new Date(`${todayKey}T13:00:00`).getTime(),
        },
      ]

      const flow = calculate1DHourlyFlow(txs, todayKey, activeWalletIdSet, walletCurrencyMap, 'IDR', null)
      expect(flow[13]).toBe(-250000)
    })

    it('increases active cash on transfer from archived wallet to active wallet', () => {
      const txs = [
        {
          id: 6,
          date: todayKey,
          type: 'transfer',
          convertedAmount: 300000,
          targetAmount: 300000,
          walletId: 3, // Archived
          targetWalletId: 1, // Active
          createdAt: new Date(`${todayKey}T15:00:00`).getTime(),
        },
      ]

      const flow = calculate1DHourlyFlow(txs, todayKey, activeWalletIdSet, walletCurrencyMap, 'IDR', null)
      expect(flow[15]).toBe(300000)
    })

    it('ignores transactions flagged as isPendingReview', () => {
      const txs = [
        {
          id: 7,
          date: todayKey,
          type: 'income',
          convertedAmount: 999999,
          walletId: 1,
          isPendingReview: true,
          createdAt: new Date(`${todayKey}T08:00:00`).getTime(),
        },
      ]

      const flow = calculate1DHourlyFlow(txs, todayKey, activeWalletIdSet, walletCurrencyMap, 'IDR', null)
      expect(flow[8]).toBe(0)
    })
  })

  describe('calculatePeriodStats', () => {
    it('returns 0 for invalid or empty inputs', () => {
      expect(calculatePeriodStats([], null)).toEqual({ income: 0, expense: 0 })
      expect(calculatePeriodStats(null, { startDate: '2026-03-01', endDate: '2026-03-31' })).toEqual({ income: 0, expense: 0 })
    })

    it('rounds floating point income and expense values to 2 decimals to prevent IEEE 754 precision drift', () => {
      const txs = [
        { date: '2026-03-05', type: 'expense', amount: 0.1, currency: 'USD' },
        { date: '2026-03-06', type: 'expense', amount: 0.2, currency: 'USD' },
        { date: '2026-03-07', type: 'income', amount: 0.14, currency: 'USD' },
        { date: '2026-03-08', type: 'income', amount: 0.28, currency: 'USD' },
      ]
      const stats = calculatePeriodStats(txs, { startDate: '2026-03-01', endDate: '2026-03-31' }, 'USD')
      expect(stats.expense).toBe(0.3)
      expect(stats.income).toBe(0.42)
    })

    it('unpacks split transactions properly and rounds results', () => {
      const txs = [
        {
          date: '2026-03-05',
          isSplit: true,
          splitItems: [
            { type: 'expense', amount: 0.1, currency: 'USD' },
            { type: 'expense', amount: 0.2, currency: 'USD' },
          ],
        },
      ]
      const stats = calculatePeriodStats(txs, { startDate: '2026-03-01', endDate: '2026-03-31' }, 'USD')
      expect(stats.expense).toBe(0.3)
    })
  })
})


