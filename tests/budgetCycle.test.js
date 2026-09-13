import { describe, it, expect } from 'vitest'
import { getBudgetPeriodDateRange } from '../src/lib/budgetUtils'

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

  it('clamps invalid startDay values safely between 1 and 28', () => {
    const resNegative = getBudgetPeriodDateRange('2026-05', -5)
    expect(resNegative.startDate).toBe('2026-05-01')
    expect(resNegative.endDate).toBe('2026-05-31')

    const resOverflow = getBudgetPeriodDateRange('2026-05', 35)
    expect(resOverflow.startDate).toBe('2026-04-28')
    expect(resOverflow.endDate).toBe('2026-05-27')
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
