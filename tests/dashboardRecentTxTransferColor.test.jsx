// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardRecentTx from '../src/components/dashboard/DashboardRecentTx'
import CalendarDayModal from '../src/components/calendar/CalendarDayModal'

describe('DashboardRecentTx Transfer Color and Styling', () => {
  const wallets = [
    { id: 1, name: 'BCA Main' },
    { id: 2, name: 'GoPay Digital' },
  ]

  it('renders transfer transaction with ft-transfer-soft icon container and ft-transfer-text amount', () => {
    const transferTx = {
      id: 101,
      amount: 150000,
      type: 'transfer',
      category: 'transfer',
      walletId: 1,
      targetWalletId: 2,
      date: '2026-10-12',
      currency: 'IDR',
      notes: 'Transfer to GoPay',
      createdAt: Date.now(),
    }

    const groupedRecentEntries = [
      ['2026-10-12', [transferTx]],
    ]

    const { container } = render(
      <MemoryRouter>
        <DashboardRecentTx
          groupedRecentEntries={groupedRecentEntries}
          isDbLoading={false}
          defaultCurrency="IDR"
          locale="id"
          rates={{}}
          wallets={wallets}
          t={(k, fallback) => fallback || k}
        />
      </MemoryRouter>,
    )

    // Verify icon container has ft-transfer-soft and border color
    const iconContainer = container.querySelector('.ft-transfer-soft')
    expect(iconContainer).not.toBeNull()
    expect(iconContainer.className).toContain('border-[color-mix(in_srgb,var(--status-transfer)_25%,transparent)]')

    // Verify amount element has ft-transfer-text
    const amountElement = container.querySelector('.ft-transfer-text')
    expect(amountElement).not.toBeNull()
    expect(amountElement.textContent).toContain('150.000')
    // No + or - prefix for transfer
    expect(amountElement.textContent).not.toContain('+')
    expect(amountElement.textContent).not.toContain('-')

    // Verify wallet transfer route label
    expect(screen.getByText('BCA Main -> GoPay Digital')).toBeDefined()
  })

  it('renders expense transaction with status-expense styling', () => {
    const expenseTx = {
      id: 102,
      amount: 50000,
      type: 'expense',
      category: 'food',
      walletId: 1,
      date: '2026-10-12',
      currency: 'IDR',
      notes: 'Makan siang',
      createdAt: Date.now(),
    }

    const groupedRecentEntries = [
      ['2026-10-12', [expenseTx]],
    ]

    const { container } = render(
      <MemoryRouter>
        <DashboardRecentTx
          groupedRecentEntries={groupedRecentEntries}
          isDbLoading={false}
          defaultCurrency="IDR"
          locale="id"
          rates={{}}
          wallets={wallets}
          t={(k, fallback) => fallback || k}
        />
      </MemoryRouter>,
    )

    const amountElement = container.querySelector('.text-\\[var\\(--status-expense\\)\\]')
    expect(amountElement).not.toBeNull()
    expect(amountElement.textContent).toContain('-')
  })

  it('renders income transaction with status-income styling', () => {
    const incomeTx = {
      id: 103,
      amount: 5000000,
      type: 'income',
      category: 'salary',
      walletId: 1,
      date: '2026-10-12',
      currency: 'IDR',
      notes: 'Gaji Bulanan',
      createdAt: Date.now(),
    }

    const groupedRecentEntries = [
      ['2026-10-12', [incomeTx]],
    ]

    const { container } = render(
      <MemoryRouter>
        <DashboardRecentTx
          groupedRecentEntries={groupedRecentEntries}
          isDbLoading={false}
          defaultCurrency="IDR"
          locale="id"
          rates={{}}
          wallets={wallets}
          t={(k, fallback) => fallback || k}
        />
      </MemoryRouter>,
    )

    const amountElement = container.querySelector('.text-\\[var\\(--status-income\\)\\]')
    expect(amountElement).not.toBeNull()
    expect(amountElement.textContent).toContain('+')
  })

  it('falls back to Wallet -> Wallet when transfer wallet ids do not match wallets list', () => {
    const orphanTransferTx = {
      id: 104,
      amount: 75000,
      type: 'transfer',
      category: 'transfer',
      walletId: 999,
      targetWalletId: 888,
      date: '2026-10-12',
      currency: 'IDR',
      notes: 'Unknown wallets transfer',
      createdAt: Date.now(),
    }

    const { container } = render(
      <MemoryRouter>
        <DashboardRecentTx
          groupedRecentEntries={[['2026-10-12', [orphanTransferTx]]]}
          isDbLoading={false}
          defaultCurrency="IDR"
          locale="id"
          rates={{}}
          wallets={[]}
          t={(k, fallback) => fallback || k}
        />
      </MemoryRouter>,
    )

    const amountElement = container.querySelector('.ft-transfer-text')
    expect(amountElement).not.toBeNull()
    expect(screen.getByText('Wallet -> Wallet')).toBeDefined()
  })

  it('renders balance_adjustment transaction correctly without transfer styling collision', () => {
    const adjustmentTx = {
      id: 105,
      amount: 25000,
      type: 'balance_adjustment',
      category: 'adjustment',
      walletId: 1,
      date: '2026-10-12',
      currency: 'IDR',
      notes: 'Penyesuaian saldo',
      createdAt: Date.now(),
    }

    const { container } = render(
      <MemoryRouter>
        <DashboardRecentTx
          groupedRecentEntries={[['2026-10-12', [adjustmentTx]]]}
          isDbLoading={false}
          defaultCurrency="IDR"
          locale="id"
          rates={{}}
          wallets={wallets}
          t={(k, fallback) => fallback || k}
        />
      </MemoryRouter>,
    )

    const iconContainer = container.querySelector('.text-\\[var\\(--accent\\)\\]')
    expect(iconContainer).not.toBeNull()
    expect(container.querySelector('.ft-transfer-soft')).toBeNull()
  })
})

describe('Calendar and CalendarDayModal Transfer Color and Styling', () => {
  const wallets = [
    { id: 1, name: 'BCA Main' },
    { id: 2, name: 'GoPay Digital' },
  ]

  it('renders transfer transaction with var(--status-transfer) and var(--status-transfer-soft) in CalendarDayModal', () => {
    const transferTx = {
      id: 201,
      amount: 200000,
      type: 'transfer',
      category: 'transfer',
      walletId: 1,
      targetWalletId: 2,
      date: '2026-10-12',
      currency: 'IDR',
      notes: 'Transfer modal test',
      createdAt: Date.now(),
    }
    const dayItems = {
      transactions: [transferTx],
      events: [],
      loans: [],
      todos: [],
    }

    render(
      <MemoryRouter>
        <CalendarDayModal
          isOpen={true}
          onClose={() => {}}
          selectedDate={new Date('2026-10-12T12:00:00')}
          dayItems={dayItems}
          wallets={wallets}
          dayTab="items"
          setDayTab={() => {}}
        />
      </MemoryRouter>,
    )

    // Check amount text has var(--status-transfer)
    const amountElem = screen.getByText('200.000', { exact: false })
    expect(amountElem.style.color).toBe('var(--status-transfer)')

    // Check icon container has transfer background and color
    const iconContainer = document.body.querySelector('[style*="var(--status-transfer)"]')
    expect(iconContainer).not.toBeNull()
    expect(iconContainer.style.color).toBe('var(--status-transfer)')
  })

  it('verifies calendar transaction event color mapping produces var(--status-transfer) for transfers', () => {
    const mapTxColor = (txType) =>
      txType === 'income'
        ? 'var(--status-income)'
        : txType === 'transfer'
        ? 'var(--status-transfer)'
        : 'var(--status-expense)'

    expect(mapTxColor('income')).toBe('var(--status-income)')
    expect(mapTxColor('transfer')).toBe('var(--status-transfer)')
    expect(mapTxColor('expense')).toBe('var(--status-expense)')
    expect(mapTxColor('unknown')).toBe('var(--status-expense)')
  })
})

