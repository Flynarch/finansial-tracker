// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { format } from 'date-fns'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { groupTransactionsDetailed } from '../src/components/transactions/transactionDateGrouping'
import TransactionHeaderActions from '../src/components/transactions/TransactionHeaderActions'
import TransactionViewTabs from '../src/components/transactions/TransactionViewTabs'
import TransactionSearchAndBanner from '../src/components/transactions/TransactionSearchAndBanner'

const mockT = (key, fallback) => {
  const dict = {
    'tx.pageTitle': 'Transaksi',
    'tx.search.placeholder': 'Cari catatan atau kategori...',
    'tx.filter.open': 'Filter Lengkap',
    'tx.menu.bulkEdit': 'Edit Massal (Bulk)',
    'tx.menu.splitBill': 'Bagi Tagihan (Split Bill)',
    'tx.menu.importStatement': 'Impor Mutasi / e-Statement',
    'tx.menu.exportCsv': 'Ekspor CSV',
    'tx.tab.all': 'Semua Transaksi',
    'tx.tab.staging': 'Tampungan',
    'tx.staging.reviewNow': 'Tinjau',
    'tx.today': 'HARI INI',
    'tx.yesterday': 'KEMARIN',
  }
  return dict[key] || fallback || key
}

describe('Milestone 5 - Transactions Modular Architecture Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('transactionDateGrouping.js', () => {
    it('correctly groups transactions by date and computes daily summaries', () => {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const mockTxs = [
        {
          id: 'tx-1',
          date: `${todayStr}T10:00:00.000Z`,
          amount: 50000,
          type: 'income',
          category: 'salary',
          currency: 'IDR',
        },
        {
          id: 'tx-2',
          date: `${todayStr}T14:30:00.000Z`,
          amount: 20000,
          type: 'expense',
          category: 'food',
          currency: 'IDR',
        },
      ]

      const grouped = groupTransactionsDetailed(mockTxs, {
        locale: 'id',
        defaultCurrency: 'IDR',
        rates: {},
        t: mockT,
      })

      expect(grouped.length).toBe(1)
      expect(grouped[0].dateKey).toBe(todayStr)
      expect(grouped[0].dateLabel).toBe('HARI INI')
      expect(grouped[0].items.length).toBe(2)
      expect(grouped[0].isPositive).toBe(true)
      expect(grouped[0].dailySummaryText).toContain('30.000')
    })

    it('unpacks split items and honors analytics exclusion invariants', () => {
      const testDate = '2026-03-15'
      const splitTx = {
        id: 'split-1',
        date: `${testDate}T12:00:00.000Z`,
        amount: 100000,
        type: 'expense',
        isSplit: true,
        splitItems: [
          {
            amount: 40000,
            type: 'expense',
            category: 'groceries',
            isExcludeFromAnalytics: false,
          },
          {
            amount: 60000,
            type: 'expense',
            category: 'business_reimbursable',
            isExcludeAnalyticsTx: true, // Should be excluded from analytics daily flow
          },
        ],
      }

      const grouped = groupTransactionsDetailed([splitTx], {
        locale: 'id',
        defaultCurrency: 'IDR',
        rates: {},
        t: mockT,
      })

      expect(grouped.length).toBe(1)
      expect(grouped[0].dateKey).toBe(testDate)
      expect(grouped[0].isPositive).toBe(false)
      // Only the non-excluded 40,000 should count towards daily summary expense
      expect(grouped[0].dailySummaryText).toContain('40.000')
    })
  })

  describe('TransactionHeaderActions.jsx', () => {
    it('renders header, triggers search toggle, and manages dropdown menu', () => {
      const onToggleSearch = vi.fn()
      const onOpenFilter = vi.fn()
      const setIsMenuOpen = vi.fn()
      const onOpenBulkMode = vi.fn()
      const onOpenSplitBill = vi.fn()
      const onOpenStatementImport = vi.fn()
      const onExportCsv = vi.fn()

      const { rerender } = render(
        <TransactionHeaderActions
          t={mockT}
          isSearchOpen={false}
          onToggleSearch={onToggleSearch}
          hasSearchQuery={false}
          activeFilterCount={2}
          onOpenFilter={onOpenFilter}
          isMenuOpen={false}
          setIsMenuOpen={setIsMenuOpen}
          onOpenBulkMode={onOpenBulkMode}
          onOpenSplitBill={onOpenSplitBill}
          onOpenStatementImport={onOpenStatementImport}
          onExportCsv={onExportCsv}
        />
      )

      expect(screen.getByText('Transaksi')).toBeDefined()

      // Click search toggle
      const searchBtn = screen.getByRole('button', { name: /cari/i })
      fireEvent.click(searchBtn)
      expect(onToggleSearch).toHaveBeenCalledTimes(1)

      // Click filter button
      const filterBtn = screen.getByRole('button', { name: /filter lengkap/i })
      fireEvent.click(filterBtn)
      expect(onOpenFilter).toHaveBeenCalledTimes(1)

      // Re-render with menu open
      rerender(
        <TransactionHeaderActions
          t={mockT}
          isSearchOpen={false}
          onToggleSearch={onToggleSearch}
          hasSearchQuery={false}
          activeFilterCount={0}
          onOpenFilter={onOpenFilter}
          isMenuOpen={true}
          setIsMenuOpen={setIsMenuOpen}
          onOpenBulkMode={onOpenBulkMode}
          onOpenSplitBill={onOpenSplitBill}
          onOpenStatementImport={onOpenStatementImport}
          onExportCsv={onExportCsv}
        />
      )

      const bulkBtn = screen.getByText('Edit Massal (Bulk)')
      fireEvent.click(bulkBtn)
      expect(onOpenBulkMode).toHaveBeenCalledTimes(1)
      expect(setIsMenuOpen).toHaveBeenCalledWith(false)
    })
  })

  describe('TransactionViewTabs.jsx', () => {
    it('renders fluid pill switcher and handles tab selection', () => {
      const onSelectTab = vi.fn()
      render(
        <TransactionViewTabs
          activeViewTab="all"
          onSelectTab={onSelectTab}
          pendingReviewCount={3}
          t={mockT}
        />
      )

      expect(screen.getByText('Semua Transaksi')).toBeDefined()
      expect(screen.getByText('Tampungan')).toBeDefined()
      expect(screen.getByText('3')).toBeDefined()

      fireEvent.click(screen.getByText('Tampungan'))
      expect(onSelectTab).toHaveBeenCalledWith('staging')
    })
  })

  describe('TransactionSearchAndBanner.jsx', () => {
    it('renders search input when open and propagates changes', () => {
      const onSearchChange = vi.fn()
      const onOpenStaging = vi.fn()

      const { rerender } = render(
        <TransactionSearchAndBanner
          isSearchOpen={true}
          searchQuery=""
          onSearchChange={onSearchChange}
          pendingReviewCount={5}
          onOpenStaging={onOpenStaging}
          t={mockT}
        />
      )

      const input = screen.getByPlaceholderText(/cari/i)
      fireEvent.change(input, { target: { value: 'makan' } })
      expect(onSearchChange).toHaveBeenCalledWith('makan')

      const reviewBtn = screen.getByText('Tinjau')
      fireEvent.click(reviewBtn)
      expect(onOpenStaging).toHaveBeenCalledTimes(1)

      // Re-render with active search query to verify clear button
      rerender(
        <TransactionSearchAndBanner
          isSearchOpen={true}
          searchQuery="makan"
          onSearchChange={onSearchChange}
          pendingReviewCount={0}
          onOpenStaging={onOpenStaging}
          t={mockT}
        />
      )

      const clearButtons = screen.getAllByRole('button')
      const clearBtn = clearButtons[0]
      fireEvent.click(clearBtn)
      expect(onSearchChange).toHaveBeenCalledWith('')
    })
  })
})
