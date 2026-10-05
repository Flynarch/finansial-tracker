// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  encryptField,
  warmupDecryptionCache,
  getDecryptedNoteSync,
  clearSessionEncryptionKey,
  getDecryptionCacheSize,
  isFieldEncrypted,
} from '../src/lib/fieldEncryption'
import { parseIndonesianAmount } from '../src/lib/ai/nlp/amountRules'
import { extractDateFromPhrase } from '../src/lib/ai/nlp/dateRules'
import { computeWalletBalance, computeAllWalletBalances } from '../src/lib/db'
import { calculateLoanSummary } from '../src/hooks/dashboard/loanSlice'
import { calculateTotalSavings } from '../src/hooks/dashboard/budgetGoalSlice'
import { calculateMonthStats } from '../src/hooks/dashboard/monthStatsSlice'
import TransactionDetailSheet from '../src/components/transactions/TransactionDetailSheet'
import useSettingsStore from '../src/store/useSettingsStore'
import { format } from 'date-fns'

vi.mock('../src/lib/biometric', () => ({
  authenticateBiometric: vi.fn().mockResolvedValue(true),
  canUseBiometric: vi.fn().mockResolvedValue(true),
}))

vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
}))

describe('Adversarial Remediation Round 5 - Cross-Subsystem Integrity Suite', () => {
  beforeEach(() => {
    clearSessionEncryptionKey()
  })

  describe('1. Field Encryption Cold-Cache Protection & Lifecycle', () => {
    it('returns empty string fallback on cold cache miss instead of leaking ciphertext', async () => {
      const sensitiveNote = 'Catatan rahasia keluarga'
      const encryptedNote = await encryptField(sensitiveNote)
      expect(isFieldEncrypted(encryptedNote)).toBe(true)

      // Cold cache: warmupDecryptionCache has NOT been called
      clearSessionEncryptionKey()
      expect(getDecryptionCacheSize()).toBe(0)

      // Must return fallback (default empty string), NOT the raw enc:v1 string
      const syncResult = getDecryptedNoteSync(encryptedNote)
      expect(syncResult).toBe('')
      expect(syncResult).not.toContain('enc:v1:')

      // Custom fallback works as expected
      const customFallbackResult = getDecryptedNoteSync(encryptedNote, 'Memuat...')
      expect(customFallbackResult).toBe('Memuat...')

      // Once warmed up, returns plain text
      await warmupDecryptionCache([{ notes: encryptedNote }])
      expect(getDecryptedNoteSync(encryptedNote)).toBe(sensitiveNote)
    })

    it('clears decrypted note cache and session key on store lock()', async () => {
      const note = 'Pengeluaran penting kantor'
      const encrypted = await encryptField(note)
      await warmupDecryptionCache([{ notes: encrypted }])
      expect(getDecryptedNoteSync(encrypted)).toBe(note)
      expect(getDecryptionCacheSize()).toBeGreaterThan(0)

      // Call store lock()
      useSettingsStore.getState().lock()
      expect(useSettingsStore.getState().isUnlocked).toBe(false)
      expect(getDecryptionCacheSize()).toBe(0)
    })
  })

  describe('2. AI & Indonesian NLP Miliar and Date Bounds', () => {
    it('parses large nominal suffixes (miliar, milyar, b) without 1,000,000,000x under-calculation', () => {
      expect(parseIndonesianAmount('2 miliar')).toBe(2000000000)
      expect(parseIndonesianAmount('2miliar')).toBe(2000000000)
      expect(parseIndonesianAmount('2.5 milyar')).toBe(2500000000)
      expect(parseIndonesianAmount('1.5 b')).toBe(1500000000)
      expect(parseIndonesianAmount('500 jt')).toBe(500000000)
      expect(parseIndonesianAmount('500 juta')).toBe(500000000)
      expect(parseIndonesianAmount('100k')).toBe(100000)
    })

    it('rejects ghost calendar dates on month length boundaries', () => {
      const refDate = new Date(2026, 9, 5) // Oct 5, 2026

      // Feb 31 does not exist
      const feb31Result = extractDateFromPhrase('31 februari 2026', refDate)
      expect(feb31Result).toBeNull()

      // Feb 29 on non-leap year (2026) does not exist
      const feb29Result = extractDateFromPhrase('29/02/2026', refDate)
      expect(feb29Result).toBeNull()

      // April 31 does not exist (April has 30 days)
      const apr31Result = extractDateFromPhrase('31 april 2026', refDate)
      expect(apr31Result).toBeNull()

      // April 30 exists and is valid
      const apr30Result = extractDateFromPhrase('30 april 2026', refDate)
      expect(apr30Result).not.toBeNull()
      expect(apr30Result.dateStr).toBe('2026-04-30')
    })
  })

  describe('3. Financial Precision & Ledger Balancing in db.js', () => {
    it('accurately computes wallet balance with fractional transactions to 2 decimal places', () => {
      const initialWallet = { id: 1, balance: 100000, currency: 'IDR' }
      const transactions = [
        // Transaction with fractional sen: 33333.33333
        { id: 10, walletId: 1, amount: 33333.33333, type: 'income', currency: 'IDR' },
      ]

      const balance = computeWalletBalance(initialWallet, transactions, {}, [initialWallet])
      expect(balance).toBe(133333.33)

      const allBalances = computeAllWalletBalances([initialWallet], transactions, {}, [initialWallet])
      expect(allBalances[0].currentBalance).toBe(133333.33)
    })
  })

  describe('4. Dashboard Slices: Historical Projections, Loans, and Goal Filtering', () => {
    it('does not apply isEarlyMonth projection to historical past months', () => {
      // Historical month: 2026-01 (completed past month)
      const pastPeriod = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      }
      const txs = [
        { id: 1, date: '2026-01-15', amount: 1000000, type: 'income' },
        { id: 2, date: '2026-01-20', amount: 500000, type: 'expense' },
      ]

      const stats = calculateMonthStats({
        transactions: txs,
        investments: [],
        currentMonthKey: '2026-01',
        currentPeriod: pastPeriod,
        normalizedTransactions: txs,
        defaultCurrency: 'IDR',
        rates: null,
        budgetCycleStartDay: 1,
        locale: 'id',
      })

      // Past month should calculate exact delta without 15x early-month multiplier
      expect(stats.monthIncome).toBe(1000000)
      expect(stats.monthExpense).toBe(500000)
      expect(stats.monthDelta).toBe(500000)
    })

    it('marks loan due today as daysLeft === 0 and NOT overdue', () => {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const loans = [
        {
          id: 1,
          type: 'debt',
          totalAmount: 1000000,
          remainingAmount: 1000000,
          dueDate: todayStr,
          status: 'active',
        },
      ]

      const summary = calculateLoanSummary(loans, 'IDR', null)
      expect(summary.activeLoans[0].daysLeft).toBe(0)
      expect(summary.activeLoans[0].isOverdue).toBe(false)
    })

    it('excludes archived goals from calculateTotalSavings', () => {
      const goals = [
        { id: 1, name: 'Dana Darurat Aktif', targetAmount: 10000000, currentAmount: 5000000, isArchived: 0 },
        { id: 2, name: 'Target Lama Terhapus', targetAmount: 2000000, currentAmount: 2000000, isArchived: 1 },
      ]

      const totalSavings = calculateTotalSavings(goals, 'IDR', null)
      expect(totalSavings).toBe(5000000)
    })
  })

  describe('5. TransactionDetailSheet Split Item Notes Rendering', () => {
    it('renders individual split item notes in TransactionDetailSheet', () => {
      const tx = {
        id: 99,
        type: 'expense',
        amount: 80000,
        currency: 'IDR',
        date: '2026-10-05',
        category: 'makanan',
        isSplit: true,
        splitItems: [
          { name: 'Nasi Rendang', amount: 50000, notes: 'Porsi jumbo pedas' },
          { name: 'Es Teh Manis', amount: 30000, notes: 'Tanpa sedotan plastik' },
        ],
      }

      render(
        <TransactionDetailSheet
          isOpen={true}
          onClose={vi.fn()}
          transaction={tx}
          wallets={[{ id: 1, name: 'Dompet Utama' }]}
          defaultCurrency="IDR"
          formatCurrency={(val) => `Rp ${Number(val).toLocaleString('id-ID')}`}
          locale="id"
          t={(k, fallback) => fallback || k}
        />
      )

      expect(screen.getByText(/Nasi Rendang/)).toBeDefined()
      expect(screen.getByText(/Porsi jumbo pedas/)).toBeDefined()
      expect(screen.getByText(/Es Teh Manis/)).toBeDefined()
      expect(screen.getByText(/Tanpa sedotan plastik/)).toBeDefined()
    })
  })
})
