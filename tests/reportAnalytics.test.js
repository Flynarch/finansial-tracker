import { describe, it, expect } from 'vitest'
import {
  calculateSavingsRate,
  calculateDailyBurnRate,
  calculateCashflowRatio,
  calculateSpendingTrend,
  calculateFinancialHealthTier,
  formatDelta,
  aggregateMonthlyIncomeExpense,
  calculateNetWorthSummary,
} from '../src/lib/reportAnalytics'

describe('reportAnalytics - calculateSavingsRate', () => {
  it('returns 0 when income is 0 or negative', () => {
    expect(calculateSavingsRate(0, 50000)).toBe(0)
    expect(calculateSavingsRate(-1000, 50000)).toBe(0)
  })

  it('calculates positive savings rate accurately', () => {
    // Income 10,000,000, Expense 6,000,000 -> 40%
    expect(calculateSavingsRate(10_000_000, 6_000_000)).toBe(40)
  })

  it('calculates negative savings rate (deficit) clamped to -100', () => {
    // Income 5,000,000, Expense 15,000,000 -> -200% clamped to -100%
    expect(calculateSavingsRate(5_000_000, 15_000_000)).toBe(-100)
  })

  it('returns 0 when income equals expense', () => {
    expect(calculateSavingsRate(5_000_000, 5_000_000)).toBe(0)
  })
})

describe('reportAnalytics - calculateDailyBurnRate', () => {
  it('returns 0 when days or expense is 0 or negative', () => {
    expect(calculateDailyBurnRate(0, 30)).toBe(0)
    expect(calculateDailyBurnRate(100000, 0)).toBe(0)
    expect(calculateDailyBurnRate(-50000, 30)).toBe(0)
  })

  it('computes daily average expense pace accurately', () => {
    expect(calculateDailyBurnRate(3_000_000, 30)).toBe(100_000)
  })
})

describe('reportAnalytics - calculateCashflowRatio', () => {
  it('handles zero total flow gracefully without division by zero', () => {
    const res = calculateCashflowRatio(0, 0)
    expect(res).toEqual({
      incomePercent: 0,
      expensePercent: 0,
      totalFlow: 0,
      hasData: false,
    })
  })

  it('computes accurate percentages when data exists', () => {
    const res = calculateCashflowRatio(7_500_000, 2_500_000)
    expect(res).toEqual({
      incomePercent: 75,
      expensePercent: 25,
      totalFlow: 10_000_000,
      hasData: true,
    })
  })
})

describe('reportAnalytics - calculateSpendingTrend', () => {
  it('returns neutral without history when historical average is zero', () => {
    const res = calculateSpendingTrend(500_000, 0)
    expect(res.hasHistory).toBe(false)
    expect(res.isNormal).toBe(true)
    expect(res.diffPercent).toBe(0)
  })

  it('detects lower spending (saving more) accurately', () => {
    // Current 4,000,000 vs Average 5,000,000 -> -20%
    const res = calculateSpendingTrend(4_000_000, 5_000_000)
    expect(res.hasHistory).toBe(true)
    expect(res.isLower).toBe(true)
    expect(res.diffPercent).toBe(-20)
  })

  it('detects higher spending accurately', () => {
    // Current 6,000,000 vs Average 5,000,000 -> +20%
    const res = calculateSpendingTrend(6_000_000, 5_000_000)
    expect(res.hasHistory).toBe(true)
    expect(res.isHigher).toBe(true)
    expect(res.diffPercent).toBe(20)
  })

  it('handles current expense = 0 with historical average as -100% trend', () => {
    const res = calculateSpendingTrend(0, 5_000_000)
    expect(res.hasHistory).toBe(true)
    expect(res.isLower).toBe(true)
    expect(res.diffPercent).toBe(-100)
  })
})

describe('reportAnalytics - calculateFinancialHealthTier', () => {
  it('returns empty when hasData is false', () => {
    expect(calculateFinancialHealthTier(0, false)).toBe('empty')
  })

  it('returns surplus when net savings > 0 and hasData is true', () => {
    expect(calculateFinancialHealthTier(1_000_000, true)).toBe('surplus')
  })

  it('returns stable when net savings === 0 and hasData is true', () => {
    expect(calculateFinancialHealthTier(0, true)).toBe('stable')
  })

  it('returns deficit when net savings < 0 and hasData is true', () => {
    expect(calculateFinancialHealthTier(-500_000, true)).toBe('deficit')
  })
})

describe('reportAnalytics - formatDelta', () => {
  it('returns dash when previous is 0 or invalid', () => {
    expect(formatDelta(100, 0)).toBe('—')
    expect(formatDelta(100, null)).toBe('—')
  })

  it('formats positive and negative deltas with sign', () => {
    expect(formatDelta(110, 100)).toBe('+10.0%')
    expect(formatDelta(85, 100)).toBe('-15.0%')
  })
})

describe('reportAnalytics - aggregateMonthlyIncomeExpense', () => {
  it('creates clean month rows over rangeMonths', () => {
    const fixedDate = new Date('2026-08-15T00:00:00Z')
    const txs = [
      { date: '2026-08-01', amount: 5000000, type: 'income' },
      { date: '2026-08-05', amount: 1500000, type: 'expense' },
      { date: '2026-07-10', amount: 2000000, type: 'expense' },
    ]
    const res = aggregateMonthlyIncomeExpense(txs, 3, 'IDR', null, fixedDate)
    expect(res.length).toBe(3)
    const aug = res.find((r) => r.key === '2026-08')
    expect(aug?.income).toBe(5000000)
    expect(aug?.expense).toBe(1500000)
  })
})

describe('reportAnalytics - calculateNetWorthSummary', () => {
  it('aggregates cash, investments, and net loans correctly', () => {
    const wallets = [{ id: 1, balance: 10_000_000, currency: 'IDR' }]
    const allTxs = []
    const investments = [{ quantity: 2, purchasePrice: 5_000_000, purchaseCurrency: 'IDR' }]
    const loans = [{ type: 'receivable', totalAmount: 3_000_000, remainingAmount: 3_000_000, status: 'active', currency: 'IDR' }]

    const res = calculateNetWorthSummary(wallets, allTxs, investments, loans, null, 'IDR')
    expect(res.totalCash).toBe(10_000_000)
    expect(res.investmentValue).toBe(10_000_000)
    expect(res.netLoanPosition).toBe(3_000_000)
    expect(res.totalNetWorth).toBe(23_000_000)
  })
})
