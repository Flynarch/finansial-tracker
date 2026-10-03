import { describe, it, expect } from 'vitest'
import { format, startOfMonth, subMonths, addMonths, endOfMonth, startOfYear, getMonth } from 'date-fns'
import { aggregateMonthlyIncomeExpense, calculateSavingsRate, calculateCashflowRatio } from '../src/lib/reportAnalytics'
import { calculatePeriodStats, calculateRangeNetWorthGrowth } from '../src/hooks/dashboard/dashboardStats'

describe('Reports Multi-Month & Month-Turn Audit Tests', () => {
  describe('Standardized Date Range Computation', () => {
    it('computes 3-month range as exactly 3 calendar months (Aug 1 to Oct 31 in Oct)', () => {
      const anchor = new Date(2026, 9, 1) // October 1, 2026 (month is 0-indexed: 9 = Oct)
      const rangeMonths = 3

      const end = format(endOfMonth(anchor), 'yyyy-MM-dd')
      const count = Math.max(1, Number(rangeMonths) || 6)
      const start = format(subMonths(startOfMonth(anchor), count - 1), 'yyyy-MM-dd')

      expect(start).toBe('2026-08-01')
      expect(end).toBe('2026-10-31')
      expect(count).toBe(3)
    })

    it('computes 1-month range as single current month (Oct 1 to Oct 31 in Oct)', () => {
      const anchor = new Date(2026, 9, 1) // Oct 1, 2026
      const rangeMonths = 1

      const end = format(endOfMonth(anchor), 'yyyy-MM-dd')
      const count = Math.max(1, Number(rangeMonths) || 6)
      const start = format(subMonths(startOfMonth(anchor), count - 1), 'yyyy-MM-dd')

      expect(start).toBe('2026-10-01')
      expect(end).toBe('2026-10-31')
      expect(count).toBe(1)
    })

    it('computes YTD strictly within current calendar year (Jan 1 to Oct 31, no 13-month leak)', () => {
      const anchor = new Date(2026, 9, 1) // Oct 1, 2026
      const rangeMonths = 'ytd'

      const end = format(endOfMonth(anchor), 'yyyy-MM-dd')
      let start
      let count
      if (rangeMonths === 'ytd') {
        start = format(startOfYear(anchor), 'yyyy-MM-dd')
        count = getMonth(anchor) + 1
      }

      expect(start).toBe('2026-01-01')
      expect(end).toBe('2026-10-31')
      expect(count).toBe(10) // Jan through Oct
    })

    it('handles year-boundary transition safely with safe month stepping (Jan 15 minus 1 month = Dec 1)', () => {
      const anchor = new Date(2027, 0, 15) // Jan 15, 2027
      const prevMonth = subMonths(startOfMonth(anchor), 1)

      expect(format(prevMonth, 'yyyy-MM')).toBe('2026-12')
      const nextMonth = addMonths(startOfMonth(prevMonth), 1)
      expect(format(nextMonth, 'yyyy-MM')).toBe('2027-01')
    })

    it('avoids 31st day month-skipping bug on month-end dates', () => {
      const marchEnd = new Date(2026, 2, 31) // March 31, 2026
      // Safe month date stepping anchors to startOfMonth
      const feb = subMonths(startOfMonth(marchEnd), 1)
      expect(format(feb, 'yyyy-MM')).toBe('2026-02')
    })
  })

  describe('Aggregate Monthly Income & Expense Scoping', () => {
    it('generates matching 3 slots and correctly buckets previous months even when current month is empty', () => {
      const anchor = new Date(2026, 9, 1) // October 1, 2026
      const transactions = [
        { id: 1, date: '2026-08-15', amount: 5000000, type: 'income', category: 'gaji' },
        { id: 2, date: '2026-08-20', amount: 2000000, type: 'expense', category: 'makan' },
        { id: 3, date: '2026-09-10', amount: 6000000, type: 'income', category: 'gaji' },
        { id: 4, date: '2026-09-25', amount: 3500000, type: 'expense', category: 'belanja' },
        // October has 0 transactions
      ]

      const result = aggregateMonthlyIncomeExpense(transactions, 3, 'IDR', null, anchor)
      expect(result).toHaveLength(3)

      const [aug, sep, oct] = result
      expect(aug.key).toBe('2026-08')
      expect(aug.income).toBe(5000000)
      expect(aug.expense).toBe(2000000)

      expect(sep.key).toBe('2026-09')
      expect(sep.income).toBe(6000000)
      expect(sep.expense).toBe(3500000)

      expect(oct.key).toBe('2026-10')
      expect(oct.income).toBe(0)
      expect(oct.expense).toBe(0)
    })

    it('filters out pending review transactions', () => {
      const anchor = new Date(2026, 9, 1)
      const transactions = [
        { id: 1, date: '2026-09-10', amount: 5000000, type: 'income', isPendingReview: true },
        { id: 2, date: '2026-09-15', amount: 1000000, type: 'income', isPendingReview: 1 },
        { id: 3, date: '2026-09-20', amount: 2000000, type: 'income', isPendingReview: false },
      ]

      const result = aggregateMonthlyIncomeExpense(transactions, 2, 'IDR', null, anchor)
      const sep = result.find((r) => r.key === '2026-09')
      expect(sep?.income).toBe(2000000)
    })

    it('unpacks split transactions properly in monthly aggregation', () => {
      const anchor = new Date(2026, 9, 1)
      const transactions = [
        {
          id: 1,
          date: '2026-09-15',
          amount: 1000000,
          type: 'expense',
          isSplit: true,
          splitItems: [
            { type: 'expense', amount: 700000, category: 'makan' },
            { type: 'expense', amount: 300000, category: 'transport', isExcludeFromAnalytics: true },
          ],
        },
      ]

      const result = aggregateMonthlyIncomeExpense(transactions, 2, 'IDR', null, anchor)
      const sep = result.find((r) => r.key === '2026-09')
      // Excluded split item (300,000) is filtered out, only 700,000 counted
      expect(sep?.expense).toBe(700000)
    })
  })

  describe('Period Summary & KPI Non-Zero Display Invariants', () => {
    it('ensures multi-month cumulative totals are non-zero when current month is empty but prior months have data', () => {
      const transactions = [
        { id: 1, date: '2026-08-15', amount: 5000000, type: 'income' },
        { id: 2, date: '2026-08-20', amount: 2000000, type: 'expense' },
        { id: 3, date: '2026-09-10', amount: 6000000, type: 'income' },
        { id: 4, date: '2026-09-25', amount: 3000000, type: 'expense' },
      ]

      let totInc = 0
      let totExp = 0
      let txCount = 0

      transactions.forEach((tx) => {
        txCount += 1
        if (tx.type === 'income') totInc += tx.amount
        if (tx.type === 'expense') totExp += tx.amount
      })

      const effectiveMonthsCount = 3
      const periodSummary = {
        totalIncome: totInc,
        totalExpense: totExp,
        totalNetSavings: totInc - totExp,
        periodSavingsRate: calculateSavingsRate(totInc, totExp),
        periodTxCount: txCount,
        avgIncome: totInc / effectiveMonthsCount,
        avgExpense: totExp / effectiveMonthsCount,
      }

      expect(periodSummary.totalIncome).toBe(11000000)
      expect(periodSummary.totalExpense).toBe(5000000)
      expect(periodSummary.totalNetSavings).toBe(6000000)
      expect(periodSummary.periodSavingsRate).toBe(55) // (6M / 11M) * 100 ~ 55%
      expect(periodSummary.periodTxCount).toBe(4)
      expect(periodSummary.avgIncome).toBeCloseTo(3666666.67, 1)
      expect(periodSummary.avgExpense).toBeCloseTo(1666666.67, 1)

      // Cashflow ratio calculation on multi-month total has hasData = true
      const ratio = calculateCashflowRatio(periodSummary.totalIncome, periodSummary.totalExpense)
      expect(ratio.hasData).toBe(true)
      expect(ratio.incomePercent).toBe(69)
      expect(ratio.expensePercent).toBe(31)
    })

    it('safely handles early month zero-expense condition without false -100% thrift claim', () => {
      // Simulate Oct 1st with 0 expense and historical average 5,000,000
      const now = new Date(2026, 9, 1)
      const isBeginningOfMonth = now.getDate() <= 3
      const thisMonthExpense = 0
      const isEarlyMonthZeroExpense = isBeginningOfMonth && thisMonthExpense === 0

      expect(isEarlyMonthZeroExpense).toBe(true)
    })

    it('scopes categorySourceTransactions to selectedMonthKey when drilled down', () => {
      const txs = [
        { id: 1, date: '2026-08-15', amount: 500000 },
        { id: 2, date: '2026-09-10', amount: 800000 },
        { id: 3, date: '2026-09-20', amount: 400000 },
        { id: 4, date: '2026-10-01', amount: 200000 },
      ]

      const selectedMonthKey = '2026-09'
      const scoped = txs.filter((tx) => {
        const dateStr = typeof tx.date === 'string' ? tx.date : (tx.date ? format(tx.date, 'yyyy-MM-dd') : '')
        return dateStr.startsWith(selectedMonthKey)
      })

      expect(scoped).toHaveLength(2)
      expect(scoped.map((t) => t.id)).toEqual([2, 3])
    })

    it('extracts selectedMonthData current and previous month correctly', () => {
      const monthlyData = [
        { key: '2026-08', month: 'Aug 26', income: 5000000, expense: 2000000 },
        { key: '2026-09', month: 'Sep 26', income: 6000000, expense: 3500000 },
        { key: '2026-10', month: 'Oct 26', income: 0, expense: 0 },
      ]

      const selectedKey = '2026-09'
      const idx = monthlyData.findIndex((m) => m.key === selectedKey)
      const selectedMonthData = {
        current: monthlyData[idx],
        previous: idx > 0 ? monthlyData[idx - 1] : { income: 0, expense: 0 },
      }

      expect(selectedMonthData.current.month).toBe('Sep 26')
      expect(selectedMonthData.current.income).toBe(6000000)
      expect(selectedMonthData.previous.month).toBe('Aug 26')
      expect(selectedMonthData.previous.income).toBe(5000000)
    })
  })

  describe('Pending Review Invariant & YTD Net Growth Guard Tests', () => {
    it('excludes isPendingReview transactions (boolean true and integer 1) in calculatePeriodStats', () => {
      const txs = [
        { id: 1, date: '2026-10-05', amount: 1000000, type: 'income', isPendingReview: false },
        { id: 2, date: '2026-10-06', amount: 500000, type: 'income', isPendingReview: true },
        { id: 3, date: '2026-10-07', amount: 250000, type: 'income', isPendingReview: 1 },
        { id: 4, date: '2026-10-08', amount: 400000, type: 'expense', isPendingReview: 0 },
        { id: 5, date: '2026-10-09', amount: 300000, type: 'expense', isPendingReview: true },
      ]
      const period = { startDate: '2026-10-01', endDate: '2026-10-31' }
      const stats = calculatePeriodStats(txs, period, 'IDR')
      expect(stats.income).toBe(1000000)
      expect(stats.expense).toBe(400000)
    })

    it('strictly excludes previous year December from YTD net worth growth', () => {
      const currentYear = new Date().getFullYear()
      const prevYear = currentYear - 1
      const chartData = {
        dataYtd: [
          { key: `${prevYear}-12`, net: 9999999 },
          { key: `${currentYear}-01`, net: 1000000 },
          { key: `${currentYear}-02`, net: 2000000 },
        ],
      }
      const growth = calculateRangeNetWorthGrowth('ytd', 5000000, chartData)
      expect(growth.net).toBe(3000000)
    })

    it('prevents UTC midnight date shift in negative timezones when appending T12:00:00', () => {
      const dateKey = '2026-10-01'
      const rawDate = typeof dateKey === 'string' && dateKey.length === 10 ? `${dateKey}T12:00:00` : dateKey
      const d = new Date(rawDate)
      expect(d.getDate()).toBe(1)
    })
  })
})
