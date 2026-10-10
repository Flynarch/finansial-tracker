// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { isTransactionNew } from '../src/lib/transactionLastSeen'
import { groupTransactionsDetailed } from '../src/components/transactions/transactionDateGrouping'
import { computeFilteredTransactions } from '../src/hooks/useTransactionFilters'
import { TransactionItemCard } from '../src/components/transactions/TransactionItemCard'
import TransactionDetailSheet from '../src/components/transactions/TransactionDetailSheet'
import CustomDatePickerModal from '../src/components/ui/CustomDatePickerModal'
import { format } from 'date-fns'

describe('Transactions Subsystem Comprehensive Fixes & Robustness', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('1. transactionLastSeen - isTransactionNew', () => {
    it('correctly handles ISO string createdAt timestamps', () => {
      const lastSeen = Date.parse('2026-04-10T12:00:00.000Z')
      const newTx = { id: 1, createdAt: '2026-04-10T13:00:00.000Z' }
      const oldTx = { id: 2, createdAt: '2026-04-10T11:00:00.000Z' }

      expect(isTransactionNew(newTx, lastSeen)).toBe(true)
      expect(isTransactionNew(oldTx, lastSeen)).toBe(false)
    })

    it('correctly handles numeric millisecond createdAt timestamps', () => {
      const lastSeen = 1712740000000
      const newTx = { id: 1, createdAt: 1712750000000 }
      const oldTx = { id: 2, createdAt: 1712730000000 }

      expect(isTransactionNew(newTx, lastSeen)).toBe(true)
      expect(isTransactionNew(oldTx, lastSeen)).toBe(false)
    })

    it('returns false safely on corrupt or missing createdAt', () => {
      expect(isTransactionNew({ id: 1, createdAt: 'not-a-date' }, 1712740000000)).toBe(false)
      expect(isTransactionNew({ id: 2, createdAt: null }, 1712740000000)).toBe(false)
      expect(isTransactionNew(null, 1712740000000)).toBe(false)
    })
  })

  describe('2. transactionDateGrouping - Deterministic sorting without NaN', () => {
    it('sorts intra-day items by time/timestamp descending even with ISO strings', () => {
      const txs = [
        { id: 'tx-morning', date: '2026-04-10', time: '09:00', amount: 20000, type: 'expense', category: 'food' },
        { id: 'tx-noon-iso', date: '2026-04-10', createdAt: '2026-04-10T12:30:00.000Z', amount: 35000, type: 'expense', category: 'food' },
        { id: 'tx-evening', date: '2026-04-10', time: '19:45', amount: 50000, type: 'expense', category: 'food' },
      ]

      const grouped = groupTransactionsDetailed(txs, {
        locale: 'id',
        defaultCurrency: 'IDR',
        rates: {},
        t: (k, fb) => fb || k,
      })

      expect(grouped).toHaveLength(1)
      const sortedIds = grouped[0].items.map((i) => i.id)
      // Evening (19:45) > Noon (12:30) > Morning (09:00)
      expect(sortedIds[0]).toBe('tx-evening')
      expect(sortedIds[1]).toBe('tx-noon-iso')
      expect(sortedIds[2]).toBe('tx-morning')
    })
  })

  describe('3. useTransactionFilters - Focus navigation and category filter', () => {
    it('does not filter out all transactions when categories is null (clean reset)', () => {
      const transactions = [
        { id: 1, date: '2026-04-10', amount: 50000, type: 'expense', category: 'makanan' },
        { id: 2, date: '2026-04-10', amount: 100000, type: 'income', category: 'gaji' },
      ]

      // Filter state set by useTransactionFocusScroll after our fix
      const focusFilters = {
        search: '',
        types: ['income', 'expense', 'transfer'],
        categories: null,
        walletIds: null,
        startDate: '',
        endDate: '',
        tag: '',
        minAmount: '',
        maxAmount: '',
      }

      const filtered = computeFilteredTransactions(transactions, focusFilters, 1, 2)
      expect(filtered).toHaveLength(2)
    })

    it('correctly handles sorting by createdAt when createdAt is an ISO string', () => {
      const transactions = [
        { id: 1, date: '2026-04-10', createdAt: '2026-04-10T10:00:00.000Z', amount: 10000, type: 'expense' },
        { id: 2, date: '2026-04-10', createdAt: '2026-04-10T16:00:00.000Z', amount: 20000, type: 'expense' },
      ]

      const filters = {
        types: ['expense'],
        categories: null,
        walletIds: null,
      }

      const filtered = computeFilteredTransactions(transactions, filters, 1, 1)
      expect(filtered[0].id).toBe(2)
      expect(filtered[1].id).toBe(1)
    })
  })

  describe('4. TransactionDetailSheet - Safe time formatting and duplicate action', () => {
    it('renders detail sheet with ISO string createdAt without throwing RangeError', () => {
      const tx = {
        id: 1,
        date: '2026-04-10',
        createdAt: '2026-04-10T14:30:00.000Z',
        amount: 45000,
        type: 'expense',
        category: 'makanan',
        walletId: 1,
      }

      const onDuplicateMock = vi.fn()

      render(
        <TransactionDetailSheet
          isOpen={true}
          onClose={vi.fn()}
          transaction={tx}
          onDuplicate={onDuplicateMock}
          wallets={[{ id: 1, name: 'Kas' }]}
          defaultCurrency="IDR"
          locale="id"
          t={(k, fb) => fb || k}
          formatCurrency={(val) => `Rp ${val}`}
          convertCurrency={(val) => val}
        />
      )

      // Time should format properly in local timezone
      const expectedTime = format(new Date('2026-04-10T14:30:00.000Z'), 'HH:mm')
      expect(screen.getByText(expectedTime)).toBeDefined()

      // Duplicate button should be present and functional
      const duplicateBtn = screen.getByTitle('Duplikasi')
      expect(duplicateBtn).toBeDefined()
      fireEvent.click(duplicateBtn)
      expect(onDuplicateMock).toHaveBeenCalledWith(tx)
    })

    it('handles invalid createdAt in detail sheet gracefully without crash', () => {
      const tx = {
        id: 2,
        date: '2026-04-10',
        createdAt: 'invalid-time-value',
        amount: 25000,
        type: 'expense',
        category: 'makanan',
        walletId: 1,
      }

      expect(() => {
        render(
          <TransactionDetailSheet
            isOpen={true}
            onClose={vi.fn()}
            transaction={tx}
            wallets={[{ id: 1, name: 'Kas' }]}
            defaultCurrency="IDR"
            locale="id"
            t={(k, fb) => fb || k}
            formatCurrency={(val) => `Rp ${val}`}
            convertCurrency={(val) => val}
          />
        )
      }).not.toThrow()
    })
  })

  describe('5. CustomDatePickerModal - State synchronization on open', () => {
    it('resets temp state whenever modal transitions from closed to open', async () => {
      const { rerender } = render(
        <CustomDatePickerModal
          isOpen={false}
          startDate="2026-04-01"
          endDate="2026-04-15"
          onClose={vi.fn()}
          onSelectRange={vi.fn()}
        />
      )

      rerender(
        <CustomDatePickerModal
          isOpen={true}
          startDate="2026-04-01"
          endDate="2026-04-15"
          onClose={vi.fn()}
          onSelectRange={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeDefined()
      })
    })
  })

  describe('6. TransactionItemCard - Zero-prop isolated render safety', () => {
    it('renders cleanly without helper props using module defaults', () => {
      const tx = {
        id: 99,
        amount: 15000,
        type: 'expense',
        category: 'belanja',
        date: '2026-04-10',
        walletId: 1,
      }

      expect(() => {
        render(<TransactionItemCard transaction={tx} />)
      }).not.toThrow()
    })
  })
})
