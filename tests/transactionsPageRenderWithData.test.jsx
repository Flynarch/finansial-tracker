// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { format as defaultFormat } from 'date-fns'

import { TransactionItemCard } from '../src/components/transactions/TransactionItemCard'
import { TransactionListSection } from '../src/components/transactions/TransactionListSection'
import { groupTransactionsDetailed } from '../src/components/transactions/transactionDateGrouping'
import Transactions from '../src/pages/Transactions'
import { db } from '../src/lib/db'

describe('Transactions Page & Item Card Render With Data (format prop robustness)', () => {
  const baseCardProps = {
    locale: 'id',
    t: (key, fallback) => fallback || key,
    defaultCurrency: 'IDR',
    formatCurrency: (val) => `Rp ${val}`,
    convertCurrency: (val) => val,
    getCategoryColorClass: () => 'bg-red-500 text-white',
    resolveTransactionIconKey: () => 'food',
    getTransactionCategoryLabels: () => ({ main: 'Makanan', sub: 'Makan Siang' }),
    rates: {},
    wallets: [{ id: 1, name: 'Dompet Utama' }],
  }

  beforeEach(async () => {
    await db.transactions.clear()
    await db.wallets.clear()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('TransactionItemCard format defense-in-depth', () => {
    it('renders with existing transaction.time without format prop', () => {
      const tx = {
        id: 1,
        amount: 25000,
        type: 'expense',
        time: '14:35',
        walletId: 1,
      }

      render(<TransactionItemCard {...baseCardProps} transaction={tx} />)
      expect(screen.getByText(/14:35/)).toBeDefined()
    })

    it('formats numeric createdAt correctly when format prop is omitted', () => {
      const timestamp = 1712739281000
      const expectedTime = defaultFormat(new Date(timestamp), 'HH:mm')
      const tx = {
        id: 2,
        amount: 50000,
        type: 'expense',
        createdAt: timestamp,
        walletId: 1,
      }

      // No format prop passed
      render(<TransactionItemCard {...baseCardProps} transaction={tx} />)
      expect(screen.getByText(new RegExp(expectedTime))).toBeDefined()
    })

    it('formats ISO string createdAt correctly when format prop is omitted', () => {
      const isoStr = '2026-04-10T14:30:00.000Z'
      const expectedTime = defaultFormat(new Date(isoStr), 'HH:mm')
      const tx = {
        id: 3,
        amount: 75000,
        type: 'income',
        createdAt: isoStr,
        walletId: 1,
      }

      render(<TransactionItemCard {...baseCardProps} transaction={tx} />)
      expect(screen.getByText(new RegExp(expectedTime))).toBeDefined()
    })

    it('formats numeric string createdAt correctly when format prop is omitted', () => {
      const timestamp = 1712739281000
      const expectedTime = defaultFormat(new Date(timestamp), 'HH:mm')
      const tx = {
        id: 4,
        amount: 30000,
        type: 'expense',
        createdAt: String(timestamp),
        walletId: 1,
      }

      render(<TransactionItemCard {...baseCardProps} transaction={tx} />)
      expect(screen.getByText(new RegExp(expectedTime))).toBeDefined()
    })

    it('handles invalid or corrupt createdAt without throwing', () => {
      const tx = {
        id: 5,
        amount: 30000,
        type: 'expense',
        createdAt: 'invalid-timestamp-string',
        walletId: 1,
      }

      expect(() => {
        render(<TransactionItemCard {...baseCardProps} transaction={tx} />)
      }).not.toThrow()
    })

    it('handles null or undefined createdAt without throwing', () => {
      const tx = {
        id: 6,
        amount: 30000,
        type: 'expense',
        createdAt: null,
        walletId: 1,
      }

      expect(() => {
        render(<TransactionItemCard {...baseCardProps} transaction={tx} />)
      }).not.toThrow()
    })

    it('uses custom format function when provided', () => {
      const customFormat = vi.fn(() => '99:99')
      const tx = {
        id: 7,
        amount: 20000,
        type: 'expense',
        createdAt: 1712739281000,
        walletId: 1,
      }

      render(<TransactionItemCard {...baseCardProps} transaction={tx} format={customFormat} />)
      expect(customFormat).toHaveBeenCalled()
      expect(screen.getByText(/99:99/)).toBeDefined()
    })

    it('falls back safely when format prop is null or non-function', () => {
      const tx = {
        id: 8,
        amount: 20000,
        type: 'expense',
        createdAt: 1712739281000,
        walletId: 1,
      }

      expect(() => {
        render(<TransactionItemCard {...baseCardProps} transaction={tx} format={null} />)
      }).not.toThrow()
    })
  })

  describe('TransactionListSection format fallback', () => {
    it('renders list items with formatted time when format prop is omitted', () => {
      const timestamp = 1712739281000
      const expectedTime = defaultFormat(new Date(timestamp), 'HH:mm')
      const transactions = [
        {
          id: 101,
          amount: 50000,
          type: 'expense',
          category: 'makanan',
          createdAt: timestamp,
          date: '2026-04-10',
          walletId: 1,
        },
      ]

      const groupedEntriesDetailed = groupTransactionsDetailed(transactions, {
        locale: 'id',
        defaultCurrency: 'IDR',
        rates: {},
        t: (k, fb) => fb || k,
      })

      // format prop is intentionally omitted
      render(
        <TransactionListSection
          filteredTransactions={transactions}
          groupedEntriesDetailed={groupedEntriesDetailed}
          allWallets={[{ id: 1, name: 'Dompet Utama' }]}
          t={(k, fb) => fb || k}
          locale="id"
          defaultCurrency="IDR"
          formatCurrency={(val) => `Rp ${val}`}
          convertCurrency={(val) => val}
          rates={{}}
          getCategoryColorClass={() => 'bg-red-500'}
          resolveTransactionIconKey={() => 'food'}
          getTransactionCategoryLabels={() => ({ main: 'Makanan', sub: null })}
        />
      )

      expect(screen.getByText(new RegExp(expectedTime))).toBeDefined()
    })
  })

  describe('Transactions Page live data rendering', () => {
    it('renders active transactions created without time field without crashing', async () => {
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const todayStr = `${yyyy}-${mm}-${dd}`

      await db.wallets.add({
        id: 1,
        name: 'Dompet Utama',
        balance: 1000000,
        currency: 'IDR',
      })

      // Simulate transaction created by QuickAdd (only createdAt, no time field)
      await db.transactions.add({
        id: 201,
        walletId: 1,
        amount: 45000,
        type: 'expense',
        category: 'makanan/makan_diluar',
        notes: 'Nasi Kapau Tambuah',
        date: todayStr,
        createdAt: Date.now(),
        currency: 'IDR',
      })

      render(
        <MemoryRouter initialEntries={['/transactions']}>
          <Transactions />
        </MemoryRouter>
      )

      // Verify the transaction item renders and the page does not crash into ErrorBoundary
      await waitFor(() => {
        expect(screen.getByText(/Nasi Kapau Tambuah/)).toBeDefined()
      })
    })
  })
})
