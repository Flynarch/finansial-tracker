// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { TransactionItemCard } from '../src/components/transactions/TransactionItemCard'

describe('TransactionItemCard BARU/NEW Badge', () => {
  afterEach(() => {
    cleanup()
  })
  const dummyTx = {
    id: 999,
    amount: 50000,
    type: 'expense',
    category: 'makanan/makan_diluar',
    notes: 'Makan siang enak',
    date: '2026-09-26',
    createdAt: 1700000000000,
    currency: 'IDR',
    walletId: 1,
  }

  const defaultProps = {
    transaction: dummyTx,
    locale: 'id',
    t: (key, fallback) => (key === 'common.new' ? 'BARU' : fallback),
    format: vi.fn(),
    defaultCurrency: 'IDR',
    formatCurrency: (val) => `Rp ${val}`,
    convertCurrency: (val) => val,
    getCategoryColorClass: () => 'bg-red-500 text-white',
    resolveTransactionIconKey: () => 'food',
    getTransactionCategoryLabels: () => ({ main: 'Makanan', sub: null }),
    rates: {},
    wallets: [{ id: 1, name: 'Dompet Utama' }],
  }

  it('renders BARU badge at top right when isNew is true', () => {
    render(<TransactionItemCard {...defaultProps} isNew={true} />)

    const badge = screen.getByTestId('badge-new-tx')
    expect(badge).toBeDefined()
    expect(badge.textContent).toBe('BARU')
    // Badge has absolute top-1.5 right-2 classes for top-right corner placement
    expect(badge.className).toContain('absolute')
    expect(badge.className).toContain('top-1.5')
    expect(badge.className).toContain('right-2')
    expect(badge.className).toContain('pointer-events-none')
  })

  it('does not render BARU badge when isNew is false', () => {
    render(<TransactionItemCard {...defaultProps} isNew={false} />)

    const badge = screen.queryByTestId('badge-new-tx')
    expect(badge).toBeNull()
  })

  it('renders localized NEW text when locale provides English translation', () => {
    render(
      <TransactionItemCard
        {...defaultProps}
        locale="en"
        t={(key, fallback) => (key === 'common.new' ? 'NEW' : fallback)}
        isNew={true}
      />
    )

    const badge = screen.getByTestId('badge-new-tx')
    expect(badge).toBeDefined()
    expect(badge.textContent).toBe('NEW')
  })
})
