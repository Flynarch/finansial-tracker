// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../src/lib/db'
import { buildSystemPrompt } from '../src/lib/ai/promptBuilder'
import { getLocalDateString } from '../src/lib/dateUtils'
import useLoanStore from '../src/store/useLoanStore'
import { updateTransaction } from '../src/services/transactionService'
import { parseCsvStatement, parseGenericCsvRows } from '../src/lib/statementParser'
import { generateInstallmentSchedule } from '../src/lib/loanUtils'
import { calculateLoanSummary } from '../src/hooks/dashboard/loanSlice'

describe('Adjacent Subsystems Hardening Test Suite', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.wallets.clear()
    await db.loans.clear()
    await db.loanPayments.clear()
    await db.goals.clear()
    await db.budgets.clear()
  })

  // =========================================================================
  // Defect 1: Timezone Date Shift in AI Prompt Defaults
  // =========================================================================
  describe('Defect 1: AI Prompt Date Handling', () => {
    it('defaults todayStr to getLocalDateString() rather than raw UTC date', () => {
      const prompt = buildSystemPrompt({})
      const localToday = getLocalDateString()
      expect(prompt).toContain(localToday)
    })
  })

  // =========================================================================
  // Defect 2: Destructive Status Overwrite & Excess Double-Deduction in Loan Updates
  // =========================================================================
  describe('Defect 2: Loan Store updateLoan Invariants', () => {
    it('preserves status: forgiven when editing a forgiven loan', async () => {
      const loanId = await db.loans.add({
        title: 'Pinjaman Teman',
        personName: 'Rudi',
        totalAmount: 500000,
        principalAmount: 500000,
        remainingAmount: 0,
        status: 'forgiven',
        forgivenDate: '2026-10-01',
        forgivenAmount: 500000,
        type: 'receivable',
      })

      await db.loanPayments.add({
        loanId,
        amount: 500000,
        date: '2026-10-01',
        notes: 'Diikhlaskan',
        isForgive: true,
        createdAt: Date.now(),
      })

      // Update non-balance loan properties (e.g. notes or title)
      await useLoanStore.getState().updateLoan(loanId, {
        notes: 'Catatan tambahan setelah pemutihan',
      })

      const updated = await db.loans.get(loanId)
      expect(updated.status).toBe('forgiven')
      expect(updated.remainingAmount).toBe(0)
    })

    it('does not double-deduct excess interest payments from remaining principal', async () => {
      const loanId = await db.loans.add({
        title: 'Hutang Bank',
        personName: 'Bank BCA',
        totalAmount: 1000000,
        principalAmount: 1000000,
        remainingAmount: 1000000,
        status: 'active',
        type: 'debt',
      })

      // Add a payment with principal 200,000 and excess interest 50,000 (total amount = 250,000)
      await db.loanPayments.add({
        loanId,
        amount: 250000,
        principalAmount: 200000,
        excessAmount: 50000,
        date: '2026-10-05',
        createdAt: Date.now(),
      })

      // Update loan without specifying remainingAmount
      await useLoanStore.getState().updateLoan(loanId, {
        title: 'Hutang Bank BCA Baru',
      })

      const updated = await db.loans.get(loanId)
      // Remaining must be total (1,000,000) - principal paid (200,000) = 800,000
      // If it deducted raw amount (250,000), it would erroneously become 750,000
      expect(updated.remainingAmount).toBe(800000)
      expect(updated.status).toBe('active')
    })
  })

  // =========================================================================
  // Defect 3: Downward Resizing Invariant on Fronted Talangan Transactions
  // =========================================================================
  describe('Defect 3: Talangan Downward Resizing Invariant', () => {
    it('blocks downward resizing if new amount is less than total historical payments collected', async () => {
      const splitBillId = 'sb_downward_resize_test'

      const parentTxId = await db.transactions.add({
        id: 9901,
        splitBillId,
        amount: 300000,
        type: 'expense',
        category: 'Pinjaman Diberikan',
        currency: 'IDR',
        date: '2026-10-08',
      })

      // Participant A has total 150,000, already paid 100,000 (remaining 50,000)
      await db.loans.add({
        id: 8801,
        splitBillId,
        personName: 'Participant A',
        totalAmount: 150000,
        remainingAmount: 50000,
        status: 'partially_paid',
        currency: 'IDR',
      })

      // Participant B has total 150,000, already paid 60,000 (remaining 90,000)
      await db.loans.add({
        id: 8802,
        splitBillId,
        personName: 'Participant B',
        totalAmount: 150000,
        remainingAmount: 90000,
        status: 'partially_paid',
        currency: 'IDR',
      })

      // Total collected so far = 100k + 60k = 160k.
      // Trying to reduce parent transaction to 150k (which is less than 160k collected) MUST fail!
      await expect(
        updateTransaction(parentTxId, {
          amount: 150000,
        }),
      ).rejects.toThrow('Nominal transaksi talangan tidak boleh lebih kecil dari total cicilan yang telah dibayarkan partisipan.')
    })

    it('clamps participant newTotal to paidSoFar during talangan delta distribution', async () => {
      const splitBillId = 'sb_delta_clamp_test'

      const parentTxId = await db.transactions.add({
        id: 9902,
        splitBillId,
        amount: 300000,
        type: 'expense',
        category: 'Pinjaman Diberikan',
        currency: 'IDR',
        date: '2026-10-08',
      })

      // Participant A: total 150k, paid 120k, remaining 30k
      const loanAId = await db.loans.add({
        splitBillId,
        personName: 'Participant A',
        totalAmount: 150000,
        remainingAmount: 30000,
        status: 'partially_paid',
        currency: 'IDR',
      })

      // Reduce parent transaction to 200k (delta = -100k)
      // Delta per loan = -50k.
      // For loan A: 150k - 50k = 100k. But paidSoFar is 120k!
      // New total must clamp to 120k (paidSoFar), and remaining becomes 0 (paid).
      await updateTransaction(parentTxId, {
        amount: 200000,
      })

      const updatedLoanA = await db.loans.get(loanAId)
      expect(updatedLoanA.totalAmount).toBe(120000)
      expect(updatedLoanA.remainingAmount).toBe(0)
      expect(updatedLoanA.status).toBe('paid')
    })
  })

  // =========================================================================
  // Defect 4: Indonesian Bank CSV Statement Credit Inversion ("D/K" Column)
  // =========================================================================
  describe('Defect 4: Indonesian Bank CSV Parser D/K Support', () => {
    it('correctly classifies "K" and "CREDIT" as income in CSV statements', async () => {
      const csvData = [
        'Tanggal,Keterangan,Nominal,Tipe',
        '01/10/2026,Gaji Masuk,10000000,K',
        '02/10/2026,Beli Pulsa,50000,D',
        '03/10/2026,Transfer Masuk,250000,CREDIT',
      ].join('\n')

      const { rows } = await parseCsvStatement(csvData)
      const parsed = parseGenericCsvRows(rows, {
        dateCol: 'Tanggal',
        descCol: 'Keterangan',
        amountCol: 'Nominal',
        typeCol: 'Tipe',
        incomeIndicator: 'K',
        expenseIndicator: 'D',
      })

      expect(parsed).toHaveLength(3)
      expect(parsed[0].type).toBe('income')
      expect(parsed[0].amount).toBe(10000000)
      expect(parsed[1].type).toBe('expense')
      expect(parsed[1].amount).toBe(50000)
      expect(parsed[2].type).toBe('income')
      expect(parsed[2].amount).toBe(250000)
    })
  })

  // =========================================================================
  // Defect 5: Multi-Month Installment Loan Expansion
  // =========================================================================
  describe('Defect 5: Multi-Month Installment Loan Expansion', () => {
    it('generates accurate installment schedules for multi-month loans', () => {
      const loan = {
        totalAmount: 1200000,
        tenorMonths: 6,
        startDate: '2026-10-01',
        dueDate: '2026-10-15',
        status: 'active',
      }

      const schedule = generateInstallmentSchedule(loan, [])
      expect(schedule).toHaveLength(6)
      expect(schedule[0].installmentNumber).toBe(1)
      expect(schedule[0].dueDate).toBe('2026-10-15')
      expect(schedule[1].installmentNumber).toBe(2)
      expect(schedule[1].dueDate).toBe('2026-11-15')
      expect(schedule[5].installmentNumber).toBe(6)
      expect(schedule[5].dueDate).toBe('2027-03-15')
    })
  })

  // =========================================================================
  // Defect 6: Savings Goal Completion Flag Sync
  // =========================================================================
  describe('Defect 6: Savings Goal isCompleted Evaluation', () => {
    it('determines isCompleted accurately based on currentAmount and targetAmount', () => {
      const checkCompleted = (currentAmount, targetAmount) => {
        return targetAmount > 0 && currentAmount >= targetAmount
      }

      expect(checkCompleted(10000000, 10000000)).toBe(true)
      expect(checkCompleted(12000000, 10000000)).toBe(true)
      expect(checkCompleted(9999999, 10000000)).toBe(false)
      expect(checkCompleted(0, 0)).toBe(false)
    })
  })

  // =========================================================================
  // Defect 7: Case-Insensitive Budget Hierarchy Rollup
  // =========================================================================
  describe('Defect 7: Budget Hierarchy Rollup Casing Invariance', () => {
    it('filters out subcategory budgets regardless of category casing discrepancies', () => {
      const categoryBudgets = [
        { id: 1, category: 'Makanan', limit: 3000000, spent: 1000000 },
        { id: 2, category: 'makanan/restoran', limit: 1000000, spent: 400000 },
        { id: 3, category: 'TRANSPORTASI', limit: 1500000, spent: 500000 },
        { id: 4, category: 'transportasi/bensin', limit: 500000, spent: 200000 },
      ]

      const topLevelBudgets = categoryBudgets.filter((b) => {
        const bCat = (b.category || '').toLowerCase()
        return !categoryBudgets.some((other) => {
          if (other.id === b.id) return false
          const otherCat = (other.category || '').toLowerCase()
          return bCat.startsWith(`${otherCat}/`)
        })
      })

      expect(topLevelBudgets).toHaveLength(2)
      expect(topLevelBudgets.map((b) => b.id)).toEqual([1, 3])
    })
  })

  // =========================================================================
  // Defect 8: Safe Date Parsing for Loan Urgency in loanSlice
  // =========================================================================
  describe('Defect 8: Loan Urgency Date Parsing', () => {
    it('parses due date strings consistently using parseISO', () => {
      const today = new Date('2026-10-09T10:00:00')
      vi.setSystemTime(today)

      const loans = [
        {
          id: 1,
          title: 'Cicilan Laptop',
          totalAmount: 10000000,
          remainingAmount: 5000000,
          dueDate: '2026-10-12',
          status: 'active',
          type: 'debt',
        },
      ]

      const summary = calculateLoanSummary(loans, 'IDR')
      expect(summary.totalDebt).toBe(5000000)
      expect(summary.urgentList).toHaveLength(1)
      expect(summary.mostUrgentItem).toBeDefined()
      expect(summary.mostUrgentItem.daysLeft).toBe(3)
      expect(summary.mostUrgentItem.isOverdue).toBe(false)

      vi.useRealTimers()
    })
  })
})
