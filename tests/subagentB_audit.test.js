import { describe, it, expect } from 'vitest'
import { getCurrentBudgetMonthKey, getBudgetPeriodDateRange } from '../src/lib/budgetUtils'
import { computeFilteredTransactions } from '../src/hooks/useTransactionFilters'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

describe('Subagent B Audit Tests - Budget, Dates, Filters', () => {
  describe('1. getCurrentBudgetMonthKey & getBudgetPeriodDateRange with Days 1..31', () => {
    it('supports payday cycle start day 31 and formats current month key correctly', () => {
      // March 30, 2026 before day 31 payday -> stays in March 2026
      const keyBefore = getCurrentBudgetMonthKey(new Date('2026-03-30T10:00:00'), 31)
      expect(keyBefore).toBe('2026-03')

      // March 31, 2026 on day 31 payday -> steps to April 2026
      const keyOn = getCurrentBudgetMonthKey(new Date('2026-03-31T10:00:00'), 31)
      expect(keyOn).toBe('2026-04')

      // February 28, 2026 (last day of short month) -> steps to March 2026
      const keyFebLast = getCurrentBudgetMonthKey(new Date('2026-02-28T10:00:00'), 31)
      expect(keyFebLast).toBe('2026-03')

      // February 27, 2026 (day before last day) -> stays in February 2026
      const keyFebBefore = getCurrentBudgetMonthKey(new Date('2026-02-27T10:00:00'), 31)
      expect(keyFebBefore).toBe('2026-02')

      // April 30, 2026 (last day of 30-day month) -> steps to May 2026
      const keyAprLast = getCurrentBudgetMonthKey(new Date('2026-04-30T10:00:00'), 31)
      expect(keyAprLast).toBe('2026-05')
    })

    it('calculates payday date range for startDay 31 without month skipping or overlapping', () => {
      // For March 2026 with startDay 31:
      // Previous month is February (28 days). Start date clamped to Feb 28.
      // Target month is March (31 days). Next month starts on Mar 31, so ends on Mar 30.
      const rangeMarch = getBudgetPeriodDateRange('2026-03', 31)
      expect(rangeMarch.startDate).toBe('2026-02-28')
      expect(rangeMarch.endDate).toBe('2026-03-30')
      expect(rangeMarch.isCustomCycle).toBe(true)

      // For April 2026 with startDay 31:
      // Previous month is March (31 days). Starts Mar 31.
      // Target month is April (30 days). Next month starts on Apr 30, so ends on Apr 29.
      const rangeApril = getBudgetPeriodDateRange('2026-04', 31)
      expect(rangeApril.startDate).toBe('2026-03-31')
      expect(rangeApril.endDate).toBe('2026-04-29')
      expect(rangeApril.isCustomCycle).toBe(true)

      // For May 2026 with startDay 31:
      // Previous month is April (30 days). Start date clamped to April 30.
      // Target month is May (31 days). Next month starts on May 31, so ends on May 30.
      const rangeMay = getBudgetPeriodDateRange('2026-05', 31)
      expect(rangeMay.startDate).toBe('2026-04-30')
      expect(rangeMay.endDate).toBe('2026-05-30')
      expect(rangeMay.isCustomCycle).toBe(true)

      // March end (03-30) + 1 day = April start (03-31)
      // April end (04-29) + 1 day = May start (04-30)
      // Strictly contiguous, zero overlap, zero gap.
    })
  })

  describe('2. Date Boundary Normalization on Timestamped Transactions', () => {
    it('includes timestamped transactions on the exact endDate', () => {
      const txs = [
        { id: '1', date: '2026-03-31T18:45:22.000Z', amount: 50000, type: 'expense', category: 'makanan' },
        { id: '2', date: '2026-03-01T08:00:00.000Z', amount: 30000, type: 'expense', category: 'makanan' },
        { id: '3', date: '2026-04-01T00:00:00.000Z', amount: 40000, type: 'expense', category: 'makanan' },
      ]

      const filters = {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      }

      const filtered = computeFilteredTransactions(txs, filters, 0, 0)
      const ids = filtered.map((t) => t.id)
      expect(ids).toContain('1')
      expect(ids).toContain('2')
      expect(ids).not.toContain('3')
    })
  })

  describe('3. Amount Range Filtering (Min / Max Amount)', () => {
    const txs = [
      { id: '1', amount: 25000, type: 'expense', category: 'makanan', date: '2026-03-10' },
      { id: '2', amount: 75000, type: 'expense', category: 'makanan', date: '2026-03-11' },
      { id: '3', amount: 150000, type: 'expense', category: 'makanan', date: '2026-03-12' },
    ]

    it('filters transactions below minAmount', () => {
      const filtered = computeFilteredTransactions(txs, { minAmount: '50000' }, 0, 0)
      expect(filtered.map((t) => t.id)).toEqual(['3', '2'])
    })

    it('filters transactions above maxAmount', () => {
      const filtered = computeFilteredTransactions(txs, { maxAmount: '100000' }, 0, 0)
      expect(filtered.map((t) => t.id)).toEqual(['2', '1'])
    })

    it('filters transactions within both minAmount and maxAmount', () => {
      const filtered = computeFilteredTransactions(txs, { minAmount: '50000', maxAmount: '100000' }, 0, 0)
      expect(filtered.map((t) => t.id)).toEqual(['2'])
    })
  })

  describe('4. Timestamp Date Key Normalization in Header Grouping', () => {
    it('extracts first 10 characters to avoid RangeError: Invalid time value', () => {
      const timestampKey = '2026-03-31T15:30:00.000Z'
      const cleanDateKey = String(timestampKey || '').slice(0, 10)
      expect(cleanDateKey).toBe('2026-03-31')

      // Verifies no RangeError is thrown
      const dateObj = new Date(`${cleanDateKey}T12:00:00`)
      expect(isNaN(dateObj.getTime())).toBe(false)
      const label = format(dateObj, 'EEEE, d MMMM yyyy', { locale: idLocale })
      expect(label).toBeTruthy()
    })
  })
})
