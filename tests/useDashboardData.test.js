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
  generateMonthlyData,
  calculatePeriodStats,
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
  })
})
