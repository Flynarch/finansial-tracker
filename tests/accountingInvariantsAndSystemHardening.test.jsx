// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, render, fireEvent } from '@testing-library/react'
import { db } from '../src/lib/db'
import { updateTransaction, deleteTransaction } from '../src/services/transactionService'
import { evaluateExpression } from '../src/lib/calcParser'
import { formatInstallmentRelativeDate, generateInstallmentSchedule } from '../src/lib/loanUtils'
import { processRecurringTransactions } from '../src/lib/automation'
import { getMonthSummaryForPrompt } from '../src/lib/aiDatabaseQueries'
import { useTransactionBatchActions } from '../src/components/transactions/useTransactionBatchActions'
import InvestmentForm from '../src/components/transactions/quick-add/InvestmentForm'
import useSettingsStore from '../src/store/useSettingsStore'
import * as dashboardCache from '../src/hooks/dashboard/dashboardCache'
import * as nativeWidgetSync from '../src/lib/nativeWidgetSync'
import { differenceInDays, differenceInCalendarDays, parseISO } from 'date-fns'

describe('Accounting Invariants and System Hardening Test Suite', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.loans.clear()
    await db.loanPayments.clear()
    await db.budgets.clear()
    await db.goals.clear()
    await db.wallets.clear()
    await db.recurringTransactions.clear()
    await db.notifications.clear()
    await db.investments.clear()
    await db.investmentOrders.clear()
    useSettingsStore.setState({ defaultCurrency: 'IDR', budgetCycleStartDay: 1 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================
  // Area 1: Cloud Backup Envelope Fix (Dead Code)
  // ==========================================
  describe('Area 1: Cloud Backup Envelope Data Detection', () => {
    it('detects data correctly from standard exported envelope with nested data property', () => {
      const envelopeBackup = {
        exportedAt: '2026-10-08T10:00:00.000Z',
        app: 'FinTrack',
        version: 3,
        data: {
          transactions: [{ id: 1, amount: 50000 }],
          wallets: [{ id: 1, name: 'Dompet Utama' }],
        },
      }

      const txList = envelopeBackup?.data?.transactions || envelopeBackup?.transactions || []
      const walletList = envelopeBackup?.data?.wallets || envelopeBackup?.wallets || []
      const hasData = txList.length > 0 || walletList.length > 0

      expect(hasData).toBe(true)
      expect(txList.length).toBe(1)
      expect(walletList.length).toBe(1)
    })

    it('remains backward compatible with legacy flat backup payloads', () => {
      const flatBackup = {
        exportedAt: '2026-01-01T00:00:00.000Z',
        transactions: [{ id: 2, amount: 20000 }],
        wallets: [],
      }

      const txList = flatBackup?.data?.transactions || flatBackup?.transactions || []
      const walletList = flatBackup?.data?.wallets || flatBackup?.wallets || []
      const hasData = txList.length > 0 || walletList.length > 0

      expect(hasData).toBe(true)
      expect(txList.length).toBe(1)
      expect(walletList.length).toBe(0)
    })

    it('returns false when backup is empty or devoid of transactions and wallets', () => {
      const emptyBackup = {
        exportedAt: '2026-10-08T10:00:00.000Z',
        data: {
          transactions: [],
          wallets: [],
        },
      }

      const txList = emptyBackup?.data?.transactions || emptyBackup?.transactions || []
      const walletList = emptyBackup?.data?.wallets || emptyBackup?.wallets || []
      const hasData = txList.length > 0 || walletList.length > 0

      expect(hasData).toBe(false)
    })
  })

  // ==========================================
  // Area 2: Split Bill Personal Expense Loan Corruption Guard
  // ==========================================
  describe('Area 2: Split Bill Personal Expense Loan Guard', () => {
    it('does NOT adjust participant loans when updating a personal expense share in a split bill', async () => {
      const splitBillId = 'sb_test_personal_guard_1'

      // Create a participant loan
      const loanId = await db.loans.add({
        splitBillId,
        personName: 'Rudi',
        totalAmount: 50000,
        remainingAmount: 50000,
        status: 'active',
        currency: 'IDR',
        initialTransactionId: 9999, // Linked to the talangan parent tx
      })

      // Create personal food share transaction (NOT a talangan tx)
      const personalTxId = await db.transactions.add({
        splitBillId,
        amount: 35000,
        type: 'expense',
        category: 'makanan/restoran',
        currency: 'IDR',
        date: '2026-10-08',
        isExcludeAnalyticsTx: false,
      })

      // Updating personal meal expense from 35,000 to 45,000
      await updateTransaction(personalTxId, {
        amount: 45000,
      })

      // Ensure the personal transaction was updated
      const updatedPersonalTx = await db.transactions.get(personalTxId)
      expect(updatedPersonalTx.amount).toBe(45000)

      // CRITICAL INVARIANT: The participant loan totalAmount and remainingAmount must remain untouched!
      const participantLoan = await db.loans.get(loanId)
      expect(participantLoan.totalAmount).toBe(50000)
      expect(participantLoan.remainingAmount).toBe(50000)
      expect(participantLoan.status).toBe('active')
    })

    it('does NOT corrupt loans or fail minimum sum guard when personal expense has isExcludeAnalyticsTx: true', async () => {
      const splitBillId = 'sb_test_personal_exclude_analytics'

      const loanId = await db.loans.add({
        splitBillId,
        personName: 'Rudi',
        totalAmount: 100000,
        remainingAmount: 100000,
        status: 'active',
        currency: 'IDR',
        initialTransactionId: 7777,
      })

      // Personal meal with isExcludeAnalyticsTx: true and nominal smaller than active loans
      const personalTxId = await db.transactions.add({
        splitBillId,
        amount: 30000,
        type: 'expense',
        category: 'makanan/restoran',
        currency: 'IDR',
        date: '2026-10-08',
        isExcludeAnalyticsTx: true,
      })

      // Reducing personal expense to 20,000 (< 100,000 active loans) MUST NOT throw error
      await updateTransaction(personalTxId, {
        amount: 20000,
      })

      const updatedPersonalTx = await db.transactions.get(personalTxId)
      expect(updatedPersonalTx.amount).toBe(20000)

      // Participant loan remains completely untouched
      const loan = await db.loans.get(loanId)
      expect(loan.totalAmount).toBe(100000)
      expect(loan.remainingAmount).toBe(100000)
    })

    it('allows deleting personal expense share even when active participant loans exist in split bill', async () => {
      const splitBillId = 'sb_test_del_personal'

      const loanId = await db.loans.add({
        splitBillId,
        personName: 'Alice',
        totalAmount: 50000,
        remainingAmount: 50000,
        status: 'active',
        currency: 'IDR',
        initialTransactionId: 6666,
      })

      const personalTxId = await db.transactions.add({
        splitBillId,
        amount: 40000,
        type: 'expense',
        category: 'makanan/restoran',
        currency: 'IDR',
        date: '2026-10-08',
        isExcludeAnalyticsTx: true,
      })

      // Deleting personal food expense MUST succeed without throwing talangan guard error
      await expect(deleteTransaction(personalTxId)).resolves.not.toThrow()

      const deletedTx = await db.transactions.get(personalTxId)
      expect(deletedTx.deletedAt).toBeDefined()

      // Participant loan is still active and unchanged
      const loan = await db.loans.get(loanId)
      expect(loan.remainingAmount).toBe(50000)
    })

    it('blocks deletion of genuine talangan transaction while participant loans exist', async () => {
      const splitBillId = 'sb_test_del_talangan'

      const talanganTxId = await db.transactions.add({
        id: 5555,
        splitBillId,
        amount: 80000,
        type: 'expense',
        category: 'Pinjaman Diberikan',
        currency: 'IDR',
        date: '2026-10-08',
      })

      await db.loans.add({
        splitBillId,
        personName: 'Dedi',
        totalAmount: 80000,
        remainingAmount: 80000,
        status: 'active',
        currency: 'IDR',
        initialTransactionId: talanganTxId,
      })

      await expect(deleteTransaction(talanganTxId)).rejects.toThrow('Transaksi ini merupakan talangan split bill')
    })
  })

  // ==========================================
  // Area 3: Multi-Currency Transfer Editing & Overrides
  // ==========================================
  describe('Area 3: Multi-Currency Transfer Overrides & Target Amount', () => {
    it('accepts evaluated targetAmount override and updates cross-currency transfer correctly', async () => {
      const walletFrom = await db.wallets.add({ name: 'USD Wallet', currency: 'USD', balance: 100 })
      const walletTo = await db.wallets.add({ name: 'IDR Wallet', currency: 'IDR', balance: 1000000 })

      const txId = await db.transactions.add({
        date: '2026-10-08',
        amount: 50,
        currency: 'USD',
        targetAmount: 800000,
        type: 'transfer',
        category: 'transfer_internal',
        walletId: walletFrom,
        targetWalletId: walletTo,
      })

      // Apply overrides passed by TransactionEditSheet
      await updateTransaction(txId, {
        amount: 60,
        targetAmount: 960000,
      })

      const updatedTx = await db.transactions.get(txId)
      expect(updatedTx.amount).toBe(60)
      expect(updatedTx.targetAmount).toBe(960000)
    })
  })

  // ==========================================
  // Area 4: Due Date Precision & Calendar Days
  // ==========================================
  describe('Area 4: Due Date Precision using Calendar Days', () => {
    it('accurately calculates remaining days in the afternoon without the 24-hour truncation glitch', () => {
      // Scenario: Today is afternoon 18:00, target date is tomorrow midnight 00:00
      const mockTodayAfternoon = new Date('2026-10-08T18:00:00')
      const targetTomorrowStr = '2026-10-09'
      const parsedTarget = parseISO(targetTomorrowStr)

      // The buggy differenceInDays returns 0 because 6 hours < 24 hours!
      const brokenDays = differenceInDays(parsedTarget, mockTodayAfternoon)
      expect(brokenDays).toBe(0)

      // The fixed differenceInCalendarDays correctly returns 1 (Tomorrow / 1 day remaining)
      const correctDays = differenceInCalendarDays(parsedTarget, mockTodayAfternoon)
      expect(correctDays).toBe(1)
    })

    it('formatInstallmentRelativeDate returns Tomorrow instead of Today for next calendar day', () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(now.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().slice(0, 10)

      const labelId = formatInstallmentRelativeDate(tomorrowStr, 'id')
      expect(labelId).toBe('Besok')

      const labelEn = formatInstallmentRelativeDate(tomorrowStr, 'en')
      expect(labelEn).toBe('Tomorrow')
    })

    it('generateInstallmentSchedule calculates calendar days remaining for each installment', () => {
      const now = new Date()
      const futureDate = new Date(now)
      futureDate.setDate(now.getDate() + 5)
      const futureStr = futureDate.toISOString().slice(0, 10)

      const loan = {
        totalAmount: 1000000,
        tenorMonths: 1,
        dueDate: futureStr,
        startDate: now.toISOString().slice(0, 10),
      }

      const schedule = generateInstallmentSchedule(loan, [])
      expect(schedule.length).toBe(1)
      expect(schedule[0].daysRemaining).toBe(5)
    })
  })

  // ==========================================
  // Area 5: Investment Funding Wallet Selection
  // ==========================================
  describe('Area 5: Investment Funding Wallet Selection', () => {
    it('renders funding wallet select dropdown when fundingSource is balance and updates walletId', () => {
      const mockSetForm = vi.fn()
      const wallets = [
        { id: 1, name: 'Dompet Tunai', currency: 'IDR' },
        { id: 2, name: 'Rekening Investasi', currency: 'IDR' },
      ]
      const form = {
        action: 'buy',
        fundingSource: 'balance',
        walletId: '1',
        type: 'Emas',
        date: '2026-10-08',
        purchaseCurrency: 'IDR',
        purchasePrice: '1000000',
        quantity: '1',
      }

      const { getByLabelText } = render(
        <InvestmentForm
          form={form}
          setForm={mockSetForm}
          wallets={wallets}
          ownedInvestmentGroups={[]}
        />
      )

      const selectEl = getByLabelText(/Dompet Sumber Dana/i)
      expect(selectEl).toBeDefined()
      expect(selectEl.value).toBe('1')

      fireEvent.change(selectEl, { target: { value: '2' } })
      expect(mockSetForm).toHaveBeenCalled()
    })

    it('auto-initializes walletId from first available wallet when form.walletId is initially empty', () => {
      const mockSetForm = vi.fn()
      const wallets = [
        { id: 10, name: 'BCA Utama', currency: 'IDR' },
      ]
      const form = {
        action: 'buy',
        fundingSource: 'balance',
        walletId: '',
        type: 'Emas',
        date: '2026-10-08',
        purchaseCurrency: 'IDR',
      }

      render(
        <InvestmentForm
          form={form}
          setForm={mockSetForm}
          wallets={wallets}
        />
      )

      expect(mockSetForm).toHaveBeenCalled()
      const updateFn = mockSetForm.mock.calls[0][0]
      const nextState = typeof updateFn === 'function' ? updateFn(form) : updateFn
      expect(nextState.walletId).toBe('10')
    })
  })

  // ==========================================
  // Area 6: Automated Recurring Transfers Currency
  // ==========================================
  describe('Area 6: Recurring Transfers Target Currency Assignment', () => {
    it('sets targetCurrency on cross-currency recurring transfers', async () => {
      const wSrc = await db.wallets.add({ name: 'USD Wallet', currency: 'USD', balance: 1000 })
      const wTgt = await db.wallets.add({ name: 'SGD Wallet', currency: 'SGD', balance: 500 })

      const recurringItem = {
        id: 101,
        title: 'Monthly Transfer to SGD',
        amount: 100,
        type: 'transfer',
        category: 'transfer_internal',
        walletId: wSrc,
        targetWalletId: wTgt,
        currency: 'USD',
        targetCurrency: 'SGD',
        targetAmount: 135,
        frequency: 'monthly',
        nextDate: '2026-10-01',
        enabled: true,
        autoExecute: true,
      }

      await db.recurringTransactions.add(recurringItem)

      // Process recurring transactions
      await processRecurringTransactions(new Date('2026-10-08T00:00:00'))

      const txs = await db.transactions.where('type').equals('transfer').toArray()
      expect(txs.length).toBe(1)
      expect(txs[0].currency).toBe('USD')
      expect(txs[0].targetCurrency).toBe('SGD')
      expect(txs[0].targetAmount).toBe(135)
    })
  })

  // ==========================================
  // Area 7: Budget Cycle & Budget Changes Cache Invalidation & Widget Sync
  // ==========================================
  describe('Area 7: Budget Cycle & Cache Invalidation', () => {
    it('persists budgetCycleStartDay and invokes cache clear and widget sync', async () => {
      const clearCacheSpy = vi.spyOn(dashboardCache, 'clearCachedDashboardState')
      const widgetSyncSpy = vi.spyOn(nativeWidgetSync, 'scheduleNativeWidgetSync')

      const setBudgetCycleStartDay = useSettingsStore.getState().setBudgetCycleStartDay

      await setBudgetCycleStartDay(25)
      expect(useSettingsStore.getState().budgetCycleStartDay).toBe(25)
      expect(clearCacheSpy).toHaveBeenCalled()
      expect(widgetSyncSpy).toHaveBeenCalledWith(100)

      // Test boundary clamping
      await setBudgetCycleStartDay(0)
      expect(useSettingsStore.getState().budgetCycleStartDay).toBe(1)

      await setBudgetCycleStartDay(35)
      expect(useSettingsStore.getState().budgetCycleStartDay).toBe(31)
    })
  })

  // ==========================================
  // Area 8: Mathematical Formula Support in Loans & Budgets
  // ==========================================
  describe('Area 8: Mathematical Formula Evaluation in Loans & Budgets', () => {
    it('evaluates addition, multiplication, thousand dots, and Indonesian suffixes', () => {
      const res1 = evaluateExpression('150.000 + 50.000', 'IDR')
      expect(res1.isValid).toBe(true)
      expect(res1.result).toBe(200000)

      const res2 = evaluateExpression('2.5jt', 'IDR')
      expect(res2.isValid).toBe(true)
      expect(res2.result).toBe(2500000)

      const res3 = evaluateExpression('500k * 2', 'IDR')
      expect(res3.isValid).toBe(true)
      expect(res3.result).toBe(1000000)

      const res4 = evaluateExpression('1.000.000 / 4', 'IDR')
      expect(res4.isValid).toBe(true)
      expect(res4.result).toBe(250000)
    })

    it('gracefully returns null for invalid expressions without crashing', () => {
      const invalid = evaluateExpression('+++--', 'IDR')
      expect(invalid.isValid).toBe(false)
      expect(invalid.result).toBeNull()
    })
  })

  // ==========================================
  // Area 9: Batch Category Protection for Transfers & Adjustments
  // ==========================================
  describe('Area 9: Batch Category Protection for Specialized Transactions', () => {
    it('excludes transfers and balance adjustments from batch category overwrites', async () => {
      const txExpense = await db.transactions.add({
        type: 'expense',
        category: 'makanan/restoran',
        amount: 25000,
        date: '2026-10-08',
      })
      const txTransfer = await db.transactions.add({
        type: 'transfer',
        category: 'transfer_internal',
        amount: 100000,
        date: '2026-10-08',
      })
      const txAdjustment = await db.transactions.add({
        type: 'balance_adjustment',
        category: 'penyesuaian_saldo',
        amount: 5000,
        date: '2026-10-08',
      })

      const setApiErrorMock = vi.fn()
      const setApiErrorToneMock = vi.fn()

      const { result } = renderHook(() =>
        useTransactionBatchActions({
          filteredTransactions: [
            { id: txExpense },
            { id: txTransfer },
            { id: txAdjustment },
          ],
          deleteTransaction: vi.fn(),
          t: (k, d) => d || k,
          setApiError: setApiErrorMock,
          setApiErrorTone: setApiErrorToneMock,
        })
      )

      // Select all 3 transactions
      act(() => {
        result.current.toggleSelectTx(txExpense)
        result.current.toggleSelectTx(txTransfer)
        result.current.toggleSelectTx(txAdjustment)
      })

      // Attempt to bulk assign category "hiburan"
      await act(async () => {
        await result.current.handleBatchCategoryChange('hiburan')
      })

      // Standard expense should have its category changed
      const updatedExpense = await db.transactions.get(txExpense)
      expect(updatedExpense.category).toBe('hiburan')

      // Transfer and balance adjustment MUST retain their original system categories!
      const updatedTransfer = await db.transactions.get(txTransfer)
      expect(updatedTransfer.category).toBe('transfer_internal')

      const updatedAdjustment = await db.transactions.get(txAdjustment)
      expect(updatedAdjustment.category).toBe('penyesuaian_saldo')

      // Should notify user that transfer/adjustment were skipped
      expect(setApiErrorMock).toHaveBeenCalledWith('Transaksi transfer dan penyesuaian saldo dilewati.')
      expect(setApiErrorToneMock).toHaveBeenCalledWith('warning')
    })
  })

  // ==========================================
  // Area 10: AI Context Filtering for Savings Goals
  // ==========================================
  describe('Area 10: AI Context Filtering for Savings Goals', () => {
    it('excludes archived and soft-deleted savings goals from AI prompt summary', async () => {
      // Active goal
      await db.goals.add({
        name: 'Dana Darurat 2026',
        currentAmount: 5000000,
        targetAmount: 20000000,
        currency: 'IDR',
        isArchived: false,
      })

      // Archived goal
      await db.goals.add({
        name: 'Liburan Jepang 2024',
        currentAmount: 15000000,
        targetAmount: 15000000,
        currency: 'IDR',
        isArchived: true,
      })

      // Soft-deleted goal
      await db.goals.add({
        name: 'Beli Gadget Lama',
        currentAmount: 2000000,
        targetAmount: 8000000,
        currency: 'IDR',
        isArchived: false,
        deletedAt: '2026-09-01T00:00:00.000Z',
      })

      const summary = await getMonthSummaryForPrompt()

      // Active goal MUST appear in summary
      expect(summary).toContain('Dana Darurat 2026')

      // Archived and deleted goals MUST be filtered out
      expect(summary).not.toContain('Liburan Jepang 2024')
      expect(summary).not.toContain('Beli Gadget Lama')
    })
  })
})
