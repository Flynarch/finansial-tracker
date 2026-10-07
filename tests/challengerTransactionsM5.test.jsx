// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, renderHook, act } from '@testing-library/react'
import { format } from 'date-fns'
import { groupTransactionsDetailed } from '../src/components/transactions/transactionDateGrouping'
import { useTransactionBatchActions } from '../src/components/transactions/useTransactionBatchActions'
import { useSingleDeleteTransaction } from '../src/components/transactions/useSingleDeleteTransaction'
import { useTransactionEditForm } from '../src/components/transactions/useTransactionEditForm'

vi.mock('../src/lib/db', () => ({
  db: {
    transactions: {
      where: vi.fn().mockReturnThis(),
      anyOf: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
      modify: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(1),
    },
  },
}))

vi.mock('../src/hooks/useDashboardData', () => ({
  clearCachedDashboardState: vi.fn(),
}))

vi.mock('../src/lib/nativeWidgetSync', () => ({
  scheduleNativeWidgetSync: vi.fn(),
}))

vi.mock('../src/lib/balanceEngine', () => ({
  invalidateWalletBalance: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
}))

const mockT = (key, arg1, arg2) => {
  if (typeof arg1 === 'string') return arg1
  if (typeof arg2 === 'string') return arg2
  return key
}

describe('Challenger M5 - Deep Stress & Adversarial Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Adversarial Date & Split Logic in transactionDateGrouping', () => {
    it('handles empty, null, or malformed transactions array without crashing', () => {
      expect(groupTransactionsDetailed([])).toEqual([])
      expect(groupTransactionsDetailed(undefined)).toEqual([])
      expect(groupTransactionsDetailed(null)).toEqual([])
    })

    it('gracefully categorizes invalid date formats under unknownDate label', () => {
      const mockTxs = [
        { id: 'bad-1', date: 'invalid-date-string', amount: 1000, type: 'expense' },
        { id: 'bad-2', date: null, amount: 2000, type: 'income' },
      ]

      const grouped = groupTransactionsDetailed(mockTxs, {
        locale: 'id',
        defaultCurrency: 'IDR',
        rates: {},
        t: mockT,
      })

      expect(grouped.length).toBe(2)
      // Invalid date string and null date fallback cleanly
      expect(grouped.some((g) => g.dateKey === 'invalid-da')).toBe(true)
      expect(grouped.some((g) => g.dateKey === 'unknown')).toBe(true)
    })

    it('safely handles empty splitItems array when isSplit is true', () => {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const brokenSplitTx = {
        id: 'split-empty',
        date: todayStr,
        amount: 50000,
        type: 'expense',
        isSplit: true,
        splitItems: [], // empty split items
      }

      const grouped = groupTransactionsDetailed([brokenSplitTx], {
        locale: 'id',
        defaultCurrency: 'IDR',
        rates: {},
        t: mockT,
      })

      expect(grouped.length).toBe(1)
      expect(grouped[0].dailySummaryText).toContain('50.000')
    })

    it('correctly calculates net when income and expense exactly balance out to 0', () => {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const txs = [
        { id: '1', date: todayStr, amount: 50000, type: 'income' },
        { id: '2', date: todayStr, amount: 50000, type: 'expense' },
      ]

      const grouped = groupTransactionsDetailed(txs, {
        locale: 'id',
        defaultCurrency: 'IDR',
        rates: {},
        t: mockT,
      })

      expect(grouped.length).toBe(1)
      expect(grouped[0].dailySummaryText).toContain('0')
    })
  })

  describe('useTransactionBatchActions Hook', () => {
    it('toggles selection, selects all, and clears selection', () => {
      const filteredTransactions = [{ id: '1' }, { id: '2' }, { id: '3' }]
      const setApiError = vi.fn()
      const setApiErrorTone = vi.fn()

      const { result } = renderHook(() =>
        useTransactionBatchActions({
          filteredTransactions,
          deleteTransaction: vi.fn(),
          t: mockT,
          setApiError,
          setApiErrorTone,
        })
      )

      act(() => {
        result.current.toggleSelectTx('1')
      })
      expect(result.current.selectedTxIds.has('1')).toBe(true)

      act(() => {
        result.current.toggleSelectTx('1')
      })
      expect(result.current.selectedTxIds.has('1')).toBe(false)

      act(() => {
        result.current.selectAllVisible()
      })
      expect(result.current.selectedTxIds.size).toBe(3)

      act(() => {
        result.current.clearBulkSelection()
      })
      expect(result.current.selectedTxIds.size).toBe(0)
      expect(result.current.isBulkMode).toBe(false)
    })
  })

  describe('useSingleDeleteTransaction Hook', () => {
    it('dispatches undo toast without undoHint for cascading relations', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
      const deleteTransaction = vi.fn().mockResolvedValue(undefined)

      const { result } = renderHook(() =>
        useSingleDeleteTransaction({
          deleteTransaction,
          swipedTransactionId: null,
          setSwipedTransactionId: vi.fn(),
          t: mockT,
          setApiError: vi.fn(),
          setApiErrorTone: vi.fn(),
        })
      )

      // Transaction with cascading loanId
      act(() => {
        result.current.setSingleDeleteTx({
          id: 'loan-tx-1',
          amount: 100000,
          loanId: 'loan-123',
        })
      })

      await act(async () => {
        await result.current.handleConfirmSingleDelete()
      })

      expect(deleteTransaction).toHaveBeenCalledWith('loan-tx-1')
      expect(dispatchSpy).toHaveBeenCalled()
      const eventDetail = dispatchSpy.mock.calls[0][0].detail
      // When cascading, message and undo action should be undefined
      expect(eventDetail.message).toBeUndefined()
      expect(eventDetail.action).toBeUndefined()
    })

    it('dispatches undo toast with actionable undo callback for standard transactions', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
      const deleteTransaction = vi.fn().mockResolvedValue(undefined)

      const { result } = renderHook(() =>
        useSingleDeleteTransaction({
          deleteTransaction,
          swipedTransactionId: null,
          setSwipedTransactionId: vi.fn(),
          t: mockT,
          setApiError: vi.fn(),
          setApiErrorTone: vi.fn(),
        })
      )

      act(() => {
        result.current.setSingleDeleteTx({
          id: 'std-tx-1',
          amount: 50000,
          walletId: 'w-1',
        })
      })

      await act(async () => {
        await result.current.handleConfirmSingleDelete()
      })

      expect(dispatchSpy).toHaveBeenCalled()
      const eventDetail = dispatchSpy.mock.calls[0][0].detail
      expect(eventDetail.action).toBeDefined()
      expect(typeof eventDetail.action.onClick).toBe('function')

      // Trigger undo callback
      await act(async () => {
        await eventDetail.action.onClick()
      })
    })
  })

  describe('useTransactionEditForm Hook', () => {
    it('duplicates transaction with date set to today and id removed', async () => {
      const addTransaction = vi.fn().mockResolvedValue('new-id')
      const setApiError = vi.fn()
      const setApiErrorTone = vi.fn()

      const { result } = renderHook(() =>
        useTransactionEditForm({
          allWallets: [],
          defaultCurrency: 'IDR',
          addTransaction,
          updateTransaction: vi.fn(),
          t: mockT,
          setApiError,
          setApiErrorTone,
        })
      )

      const originalTx = {
        id: 'old-tx-id',
        date: '2025-01-01',
        amount: 25000,
        type: 'expense',
        notes: 'Coffee',
      }

      await act(async () => {
        await result.current.handleDuplicateTransaction(originalTx)
      })

      expect(addTransaction).toHaveBeenCalledTimes(1)
      const payload = addTransaction.mock.calls[0][0]
      expect(payload.id).toBeUndefined()
      expect(payload.date).toBe(format(new Date(), 'yyyy-MM-dd'))
      expect(payload.isPendingReview).toBe(false)
      expect(setApiErrorTone).toHaveBeenCalledWith('success')
    })
  })
})
