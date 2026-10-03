import { describe, it, expect } from 'vitest'
import { getBudgetPeriodDateRange, isTxMatchingBudget } from '../src/lib/budgetUtils'

describe('budgetUtils - getBudgetPeriodDateRange', () => {
  it('returns standard month calendar range when startDay is 1', () => {
    const res = getBudgetPeriodDateRange('2026-03', 1)
    expect(res.startDate).toBe('2026-03-01')
    expect(res.endDate).toBe('2026-03-31')
    expect(res.isCustomCycle).toBe(false)
  })

  it('calculates payday cycle starting on day 25', () => {
    const res = getBudgetPeriodDateRange('2026-03', 25)
    expect(res.startDate).toBe('2026-02-25')
    expect(res.endDate).toBe('2026-03-24')
    expect(res.isCustomCycle).toBe(true)
  })

  it('handles year rollover boundary for January with startDay 25', () => {
    const res = getBudgetPeriodDateRange('2026-01', 25)
    expect(res.startDate).toBe('2025-12-25')
    expect(res.endDate).toBe('2026-01-24')
    expect(res.isCustomCycle).toBe(true)
  })

  it('handles February leap year boundary (2024 is leap year)', () => {
    // For March 2024 with startDay 28: starts 2024-02-28 and ends 2024-03-27
    const res = getBudgetPeriodDateRange('2024-03', 28)
    expect(res.startDate).toBe('2024-02-28')
    expect(res.endDate).toBe('2024-03-27')
    expect(res.isCustomCycle).toBe(true)
  })

  it('clamps invalid startDay values safely between 1 and 31', () => {
    const resNegative = getBudgetPeriodDateRange('2026-05', -5)
    expect(resNegative.startDate).toBe('2026-05-01')
    expect(resNegative.endDate).toBe('2026-05-31')

    const resOverflow = getBudgetPeriodDateRange('2026-05', 35)
    expect(resOverflow.startDate).toBe('2026-04-30')
    expect(resOverflow.endDate).toBe('2026-05-30')
  })

  it('generates clear human-readable date labels for ID and EN', () => {
    const resId = getBudgetPeriodDateRange('2026-03', 25, 'id')
    expect(resId.label).toBeTruthy()
    expect(resId.label).toContain('25')
    expect(resId.label).toContain('24')

    const resEn = getBudgetPeriodDateRange('2026-03', 25, 'en')
    expect(resEn.label).toBeTruthy()
    expect(resEn.label).toContain('25')
    expect(resEn.label).toContain('24')
  })
})

describe('budgetUtils - isTxMatchingBudget', () => {
  it('matches all transactions when budget category is "all" or "semua"', () => {
    expect(isTxMatchingBudget('all', 'makanan/makan_siang')).toBe(true)
    expect(isTxMatchingBudget('all', 'transportasi/bensin')).toBe(true)
    expect(isTxMatchingBudget('semua', 'makanan/makan_siang')).toBe(true)
    expect(isTxMatchingBudget('semua', 'tagihan/listrik')).toBe(true)
    expect(isTxMatchingBudget('Semua', 'kesehatan/obat')).toBe(true)
  })

  it('matches specific parent or exact category path', () => {
    expect(isTxMatchingBudget('makanan', 'makanan/makan_siang')).toBe(true)
    expect(isTxMatchingBudget('makanan/makan_siang', 'makanan/makan_siang')).toBe(true)
    expect(isTxMatchingBudget('makanan/makan_malam', 'makanan/makan_siang')).toBe(false)
    expect(isTxMatchingBudget('transportasi', 'makanan/makan_siang')).toBe(false)
  })
})
