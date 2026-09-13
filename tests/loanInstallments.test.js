import { describe, it, expect } from 'vitest'
import {
  generateInstallmentSchedule,
  getLoanInstallmentSummary,
  formatInstallmentRelativeDate,
} from '../src/lib/loanUtils'

describe('Loan Installments Utility', () => {
  const baseLoan = {
    id: 1,
    type: 'debt',
    title: 'Pinjaman Motor',
    personName: 'Leasing ABC',
    totalAmount: 12000000,
    remainingAmount: 12000000,
    currency: 'IDR',
    startDate: '2026-01-15',
    tenorMonths: 12,
    monthlyPayment: 1000000,
    interestRate: 0,
  }

  describe('generateInstallmentSchedule', () => {
    it('generates a 12-month schedule with correct monthly due dates and amounts', () => {
      const schedule = generateInstallmentSchedule(baseLoan, [])
      expect(schedule).toHaveLength(12)

      expect(schedule[0].installmentNumber).toBe(1)
      expect(schedule[0].dueDate).toBe('2026-02-15')
      expect(schedule[0].amount).toBe(1000000)
      expect(schedule[0].status).toBe('unpaid')
      expect(schedule[0].paidAmount).toBe(0)
      expect(schedule[0].remainingAmount).toBe(1000000)

      expect(schedule[11].installmentNumber).toBe(12)
      expect(schedule[11].dueDate).toBe('2027-01-15')
      expect(schedule[11].amount).toBe(1000000)
    })

    it('accurately allocates full payments across sequential installments', () => {
      // 2.5 payments made (2 full installments + 500k partial)
      const loanWithPayments = {
        ...baseLoan,
        remainingAmount: 9500000,
      }
      const payments = [
        { amount: 1000000, date: '2026-02-15' },
        { amount: 1000000, date: '2026-03-15' },
        { amount: 500000, date: '2026-04-10' },
      ]

      const schedule = generateInstallmentSchedule(loanWithPayments, payments)

      // Installment 1: Fully Paid
      expect(schedule[0].status).toBe('paid')
      expect(schedule[0].paidAmount).toBe(1000000)
      expect(schedule[0].remainingAmount).toBe(0)

      // Installment 2: Fully Paid
      expect(schedule[1].status).toBe('paid')
      expect(schedule[1].paidAmount).toBe(1000000)
      expect(schedule[1].remainingAmount).toBe(0)

      // Installment 3: Partially Paid
      expect(schedule[2].status).toBe('partial')
      expect(schedule[2].paidAmount).toBe(500000)
      expect(schedule[2].remainingAmount).toBe(500000)

      // Installment 4: Unpaid
      expect(schedule[3].status).toBe('unpaid')
      expect(schedule[3].paidAmount).toBe(0)
      expect(schedule[3].remainingAmount).toBe(1000000)
    })

    it('correctly calculates schedule when loan has monthlyPayment but tenorMonths is omitted', () => {
      const loanWithoutTenor = {
        id: 2,
        type: 'debt',
        totalAmount: 3000000,
        remainingAmount: 3000000,
        monthlyPayment: 1000000,
        startDate: '2026-03-01',
      }
      const schedule = generateInstallmentSchedule(loanWithoutTenor)
      expect(schedule).toHaveLength(3)
      expect(schedule[0].amount).toBe(1000000)
      expect(schedule[2].amount).toBe(1000000)
    })

    it('handles non-installment single lump sum loans gracefully', () => {
      const lumpSumLoan = {
        id: 3,
        type: 'receivable',
        totalAmount: 500000,
        remainingAmount: 500000,
        startDate: '2026-03-01',
        dueDate: '2026-04-01',
        tenorMonths: 0,
        monthlyPayment: 0,
      }
      const schedule = generateInstallmentSchedule(lumpSumLoan)
      expect(schedule).toHaveLength(1)
      expect(schedule[0].installmentNumber).toBe(1)
      expect(schedule[0].dueDate).toBe('2026-04-01')
      expect(schedule[0].amount).toBe(500000)
    })
  })

  describe('getLoanInstallmentSummary', () => {
    it('summarizes installment progress and identifies next installment due', () => {
      const loanWithPayments = {
        ...baseLoan,
        remainingAmount: 10000000,
      }
      const payments = [
        { amount: 1000000, date: '2026-02-15' },
        { amount: 1000000, date: '2026-03-15' },
      ]

      const summary = getLoanInstallmentSummary(loanWithPayments, payments)

      expect(summary.hasInstallments).toBe(true)
      expect(summary.totalInstallments).toBe(12)
      expect(summary.paidInstallmentsCount).toBe(2)
      expect(summary.remainingInstallmentsCount).toBe(10)
      expect(summary.nextInstallment).not.toBeNull()
      expect(summary.nextInstallment?.installmentNumber).toBe(3)
      expect(summary.nextInstallment?.dueDate).toBe('2026-04-15')
      expect(summary.nextInstallment?.remainingAmount).toBe(1000000)
      expect(summary.isFullyPaid).toBe(false)
    })

    it('marks fully paid loans correctly', () => {
      const paidLoan = {
        ...baseLoan,
        remainingAmount: 0,
        status: 'paid',
      }
      const summary = getLoanInstallmentSummary(paidLoan, [])
      expect(summary.isFullyPaid).toBe(true)
      expect(summary.paidInstallmentsCount).toBe(12)
      expect(summary.remainingInstallmentsCount).toBe(0)
      expect(summary.nextInstallment).toBeNull()
    })
  })

  describe('formatInstallmentRelativeDate', () => {
    it('returns formatted date string or relative text', () => {
      const formatted = formatInstallmentRelativeDate('2026-03-15', 'id')
      expect(typeof formatted).toBe('string')
      expect(formatted.length).toBeGreaterThan(0)
    })
  })
})
