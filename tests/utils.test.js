import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatCompactCurrency,
  toSafeNumber,
  clampPercent,
  formatMoneyInput,
  parseMoneyInput,
  convertCurrency,
  isExcludeAnalyticsTx,
  toTransactionsCsv,
  FALLBACK_EXCHANGE_RATES,
} from '../src/lib/utils'

describe('utils - formatCurrency & formatCompactCurrency', () => {
  it('formats IDR without decimals', () => {
    const formatted = formatCurrency(50000, 'IDR', 'id-ID')
    expect(formatted).toContain('50.000')
  })

  it('formats USD with 2 decimals', () => {
    const formatted = formatCurrency(12.5, 'USD', 'en-US')
    expect(formatted).toContain('12.50')
  })

  it('formats compact currency for IDR correctly', () => {
    expect(formatCompactCurrency(150000, 'IDR', 'id')).toContain('150')
    expect(formatCompactCurrency(2500000, 'IDR', 'id')).toContain('2,5')
    expect(formatCompactCurrency(1500000000, 'IDR', 'id')).toContain('1,5')
  })

  it('formats compact currency for USD correctly', () => {
    expect(formatCompactCurrency(2500000, 'USD', 'en')).toContain('2.5')
  })
})

describe('utils - convertCurrency', () => {
  it('returns same amount if fromCurrency equals toCurrency', () => {
    expect(convertCurrency(100000, 'IDR', 'IDR')).toBe(100000)
    expect(convertCurrency(50, 'USD', 'USD')).toBe(50)
  })

  it('converts USD to IDR accurately using fallback rates', () => {
    const res = convertCurrency(10, 'USD', 'IDR')
    expect(res).toBe(10 * FALLBACK_EXCHANGE_RATES.IDR)
  })

  it('converts IDR to USD accurately using fallback rates', () => {
    const res = convertCurrency(FALLBACK_EXCHANGE_RATES.IDR, 'IDR', 'USD')
    expect(res).toBe(1)
  })

  it('supports custom live rates overrides', () => {
    const customRates = { USD: 1, IDR: 16000, EUR: 0.9 }
    const res = convertCurrency(100, 'USD', 'IDR', customRates)
    expect(res).toBe(1600000)
  })

  it('handles zero or invalid numbers gracefully', () => {
    expect(convertCurrency(0, 'USD', 'IDR')).toBe(0)
    expect(convertCurrency(null, 'USD', 'IDR')).toBe(0)
    expect(convertCurrency(undefined, 'USD', 'IDR')).toBe(0)
    expect(convertCurrency('invalid', 'USD', 'IDR')).toBe(0)
  })
})

describe('utils - parseMoneyInput & formatMoneyInput', () => {
  it('formats and parses IDR integer inputs', () => {
    const formatted = formatMoneyInput('150000', 'IDR')
    expect(formatted).toBe('150.000')
    const parsed = parseMoneyInput(formatted, 'IDR')
    expect(parsed).toBe(150000)
  })

  it('formats and parses foreign currency decimal inputs', () => {
    const formatted = formatMoneyInput('1250,50', 'USD')
    expect(formatted).toBe('1.250,50')
    const parsed = parseMoneyInput(formatted, 'USD')
    expect(parsed).toBe(1250.5)
  })

  it('handles empty and null inputs safely', () => {
    expect(parseMoneyInput('', 'IDR')).toBe(0)
    expect(parseMoneyInput(null, 'IDR')).toBe(0)
    expect(formatMoneyInput('', 'IDR')).toBe('')
  })
})

describe('utils - isExcludeAnalyticsTx', () => {
  it('identifies transactions that must be excluded from analytics', () => {
    expect(isExcludeAnalyticsTx({ isExcludeFromAnalytics: true })).toBe(true)
    expect(isExcludeAnalyticsTx({ excludeFromAnalytics: true })).toBe(true)
    expect(isExcludeAnalyticsTx({ tags: ['exclude_analytics'] })).toBe(true)
    expect(isExcludeAnalyticsTx({ type: 'balance_adjustment' })).toBe(true)
    expect(isExcludeAnalyticsTx({ loanId: 123 })).toBe(true)
    expect(isExcludeAnalyticsTx({ splitBillId: 456 })).toBe(true)
    expect(isExcludeAnalyticsTx({ category: 'Bayar Hutang' })).toBe(true)
  })

  it('identifies standard transactions that should be included', () => {
    expect(isExcludeAnalyticsTx({ type: 'expense', category: 'makanan' })).toBe(false)
    expect(isExcludeAnalyticsTx({ type: 'income', category: 'gaji' })).toBe(false)
    expect(isExcludeAnalyticsTx(null)).toBe(false)
  })
})

describe('utils - toTransactionsCsv & numeric helpers', () => {
  it('generates properly escaped CSV rows', () => {
    const rows = [
      {
        id: 1,
        date: '2026-08-28',
        type: 'expense',
        category: 'makanan',
        amount: 25000,
        currency: 'IDR',
        notes: 'Lunch with "team", delicious',
        walletId: 1,
        walletName: 'Cash',
      },
    ]
    const csv = toTransactionsCsv(rows)
    expect(csv).toContain('Lunch with ""team"", delicious')
    expect(csv).toContain('2026-08-28')
  })

  it('clampPercent bounds values between 0 and 100', () => {
    expect(clampPercent(-10)).toBe(0)
    expect(clampPercent(50)).toBe(50)
    expect(clampPercent(150)).toBe(100)
    expect(clampPercent(NaN)).toBe(0)
  })

  it('toSafeNumber converts safely', () => {
    expect(toSafeNumber('42')).toBe(42)
    expect(toSafeNumber(null)).toBe(0)
    expect(toSafeNumber(undefined)).toBe(0)
    expect(toSafeNumber('abc')).toBe(0)
  })
})
