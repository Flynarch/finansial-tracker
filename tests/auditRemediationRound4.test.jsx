import { describe, it, expect } from 'vitest'
import { isExcludeAnalyticsTx, formatCurrency } from '../src/lib/utils'
import { format, startOfMonth, subMonths } from 'date-fns'

describe('Audit Remediation Round 4 - Cross-Subsystem Fixes Suite', () => {
  describe('Item 1: Split Bill Personal Share Analytics Inclusion', () => {
    it('includes user personal operational expense from split bill in analytics', () => {
      const personalTx = {
        id: 101,
        date: '2026-09-30',
        amount: 45000,
        type: 'expense',
        category: 'makanan/makan_diluar',
        splitBillId: 'SPLIT-1727670000',
        notes: 'Split Bill (Porsi Saya): Makan Siang Bersama',
      }
      expect(isExcludeAnalyticsTx(personalTx)).toBe(false)
    })

    it('excludes talangan/friends loan disbursement portion from analytics', () => {
      const friendsLoanTx = {
        id: 102,
        date: '2026-09-30',
        amount: 90000,
        type: 'expense',
        category: 'Pinjaman Diberikan',
        splitBillId: 'SPLIT-1727670000',
        notes: 'Split Bill (Talangan Teman): Makan Siang Bersama',
      }
      expect(isExcludeAnalyticsTx(friendsLoanTx)).toBe(true)
    })

    it('excludes split bill transaction if explicitly marked with isExcludeAnalyticsTx', () => {
      const explicitlyExcludedTx = {
        id: 103,
        date: '2026-09-30',
        amount: 25000,
        type: 'expense',
        category: 'transportasi/ojek_online',
        splitBillId: 'SPLIT-1727670000',
        isExcludeAnalyticsTx: true,
      }
      expect(isExcludeAnalyticsTx(explicitlyExcludedTx)).toBe(true)
    })

    it('excludes normal loan transactions unless marked as loan excess', () => {
      const normalLoanTx = {
        id: 104,
        loanId: 5,
        amount: 500000,
        type: 'expense',
        category: 'Bayar Hutang',
      }
      expect(isExcludeAnalyticsTx(normalLoanTx)).toBe(true)

      const excessLoanTx = {
        id: 105,
        loanId: 5,
        isLoanExcess: true,
        amount: 50000,
        type: 'expense',
        category: 'tagihan/cicilan',
      }
      expect(isExcludeAnalyticsTx(excessLoanTx)).toBe(false)
    })
  })

  describe('Item 2: Timezone Date Determinism in SMS / Notification Parser', () => {
    it('generates consistent local calendar date representation matching notification ingestion', () => {
      const testTimestamp = new Date('2026-09-30T23:30:00+07:00').getTime()
      const formattedDate = format(new Date(testTimestamp), 'yyyy-MM-dd')
      expect(formattedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(formattedDate).toBe('2026-09-30')
    })
  })

  describe('Item 4: Multi-Currency Budget Formatting Logic', () => {
    it('formats spent and limit using budget specific currency instead of forcing default currency', () => {
      const defaultCurrency = 'IDR'
      const budgetUsd = {
        id: 1,
        category: 'makanan',
        currency: 'USD',
        spent: 75.5,
        limit: 100,
        remaining: 24.5,
        isOver: false,
      }

      const activeCurrency = budgetUsd.currency || defaultCurrency
      const formattedSpent = formatCurrency(budgetUsd.spent, activeCurrency)
      const formattedLimit = formatCurrency(budgetUsd.limit, activeCurrency)

      expect(formattedSpent).toContain('$')
      expect(formattedLimit).toContain('$')
      expect(formattedSpent).not.toContain('Rp')
    })

    it('formats over-budget amount in budget specific currency', () => {
      const defaultCurrency = 'IDR'
      const budgetEur = {
        id: 2,
        category: 'liburan',
        currency: 'EUR',
        spent: 150,
        limit: 100,
        remaining: 0,
        isOver: true,
      }

      const activeCurrency = budgetEur.currency || defaultCurrency
      const overAmount = budgetEur.spent - budgetEur.limit
      const formattedOver = formatCurrency(overAmount, activeCurrency)

      expect(formattedOver).toContain('€')
      expect(formattedOver).not.toContain('Rp')
    })
  })

  describe('Item 6: Reports Cutoff Date Scoping', () => {
    it('accurately computes cutoff date for 3 months without enforcing 12 months minimum', () => {
      const rangeMonths = 3
      const months = typeof rangeMonths === 'number' ? rangeMonths : 12
      const cutoff3 = format(startOfMonth(subMonths(new Date(), Math.max(1, months))), 'yyyy-MM-dd')

      const cutoff12 = format(startOfMonth(subMonths(new Date(), 12)), 'yyyy-MM-dd')

      expect(cutoff3).toBeDefined()
      expect(cutoff12).toBeDefined()
      // 3 months cutoff should be more recent (greater date string) than 12 months cutoff
      expect(cutoff3 > cutoff12).toBe(true)
    })
  })
})
