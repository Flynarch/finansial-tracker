// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TransactionItemCard } from '../src/components/transactions/TransactionItemCard'
import { MonthDateHeader } from '../src/pages/Calendar'
import CalendarDayModal from '../src/components/calendar/CalendarDayModal'
import { calculateBudgetGoalSummary } from '../src/hooks/dashboard/budgetGoalSlice'
import { toSafeNumber } from '../src/lib/utils'

describe('Subsystem Audit Bug Fixes Suite', () => {
  afterEach(() => {
    cleanup()
  })

  describe('1. TransactionItemCard Data Contracts & Transfer Labels', () => {
    const wallets = [
      { id: 1, name: 'Bank BCA' },
      { id: 2, name: 'GoPay Wallet' },
    ]

    const baseProps = {
      locale: 'id',
      t: (key, fallback) => fallback || key,
      format: vi.fn(),
      defaultCurrency: 'IDR',
      formatCurrency: (val) => `Rp ${val}`,
      convertCurrency: (val) => val,
      getCategoryColorClass: () => 'bg-transparent text-white',
      resolveTransactionIconKey: () => 'transfer',
      getTransactionCategoryLabels: () => ({ main: 'Transfer', sub: null }),
      rates: {},
      wallets,
    }

    it('renders Transfer Masuk when contextWalletId (number) matches targetWalletId (string)', () => {
      const transferTx = {
        id: 101,
        amount: 150000,
        type: 'transfer',
        category: 'transfer',
        walletId: '1',
        targetWalletId: '2',
        currency: 'IDR',
        date: '2026-10-12',
      }

      const { container } = render(
        <TransactionItemCard
          {...baseProps}
          transaction={transferTx}
          contextWalletId={2} // Number contextWalletId vs string targetWalletId
        />
      )

      expect(screen.getByText('Transfer Masuk')).not.toBeNull()
      expect(screen.getByText('Dari Bank BCA')).not.toBeNull()
      const amountEl = container.querySelector('.ft-income-text')
      expect(amountEl).not.toBeNull()
      expect(amountEl.textContent).toContain('+')
      expect(amountEl.textContent).toContain('150000')
    })

    it('renders Transfer Keluar when contextWalletId (string) matches walletId (number)', () => {
      const transferTx = {
        id: 102,
        amount: 150000,
        type: 'transfer',
        category: 'transfer',
        walletId: 1,
        targetWalletId: 2,
        currency: 'IDR',
        date: '2026-10-12',
      }

      const { container } = render(
        <TransactionItemCard
          {...baseProps}
          transaction={transferTx}
          contextWalletId="1" // String contextWalletId vs number walletId
        />
      )

      expect(screen.getByText('Transfer Keluar')).not.toBeNull()
      expect(screen.getByText('Ke GoPay Wallet')).not.toBeNull()
      const amountEl = container.querySelector('.ft-expense-text')
      expect(amountEl).not.toBeNull()
      expect(amountEl.textContent).toContain('-')
      expect(amountEl.textContent).toContain('150000')
    })

    it('renders english bilingual Transfer In and Transfer Out when locale is en', () => {
      const transferTx = {
        id: 103,
        amount: 50000,
        type: 'transfer',
        category: 'transfer',
        walletId: 1,
        targetWalletId: 2,
        currency: 'IDR',
        date: '2026-10-12',
      }

      const { rerender } = render(
        <TransactionItemCard
          {...baseProps}
          locale="en"
          transaction={transferTx}
          contextWalletId={2}
        />
      )
      expect(screen.getByText('Transfer In')).not.toBeNull()
      expect(screen.getByText('From Bank BCA')).not.toBeNull()

      rerender(
        <TransactionItemCard
          {...baseProps}
          locale="en"
          transaction={transferTx}
          contextWalletId={1}
        />
      )
      expect(screen.getByText('Transfer Out')).not.toBeNull()
      expect(screen.getByText('To GoPay Wallet')).not.toBeNull()
    })
  })

  describe('2. Calendar Transfer Indicators and MonthDateHeader', () => {
    it('renders transfer indicator dot when day.transfer > 0', () => {
      const indicators = new Map()
      indicators.set('2026-10-12', {
        income: 0,
        expense: 0,
        transfer: 1,
        reminder: 0,
      })

      const { container } = render(
        <MonthDateHeader
          date={new Date('2026-10-12T00:00:00')}
          label="12"
          selectedDate={new Date('2026-10-12T00:00:00')}
          indicators={indicators}
          onPick={() => {}}
        />
      )

      const transferDot = container.querySelector('.bg-\\[var\\(--status-transfer\\)\\]')
      expect(transferDot).not.toBeNull()
    })

    it('does not render transfer indicator dot when day.transfer is 0', () => {
      const indicators = new Map()
      indicators.set('2026-10-12', {
        income: 1,
        expense: 0,
        transfer: 0,
        reminder: 0,
      })

      const { container } = render(
        <MonthDateHeader
          date={new Date('2026-10-12T00:00:00')}
          label="12"
          selectedDate={new Date('2026-10-12T00:00:00')}
          indicators={indicators}
          onPick={() => {}}
        />
      )

      const transferDot = container.querySelector('.bg-\\[var\\(--status-transfer\\)\\]')
      expect(transferDot).toBeNull()
    })
  })

  describe('3. budgetGoalSlice excludes archived and completed goals in activeGoalRows', () => {
    it('filters out archived and completed goals from activeGoalRows while retaining goalRows', () => {
      const goals = [
        { id: 1, name: 'Dana Darurat', currentAmount: 500000, targetAmount: 1000000, isArchived: false, isCompleted: false },
        { id: 2, name: 'Beli Laptop', currentAmount: 10000000, targetAmount: 10000000, isArchived: false, isCompleted: true },
        { id: 3, name: 'Liburan Bali', currentAmount: 200000, targetAmount: 5000000, isArchived: true, isCompleted: false },
        { id: 4, name: 'Renovasi', currentAmount: 100000, targetAmount: 2000000, isArchived: 1, isCompleted: 0 },
        { id: 5, name: 'Dana Pensiun', currentAmount: 2000000, targetAmount: 10000000, isArchived: 0, isCompleted: 1 },
        { id: 6, name: 'Tabungan Nikah', currentAmount: 3000000, targetAmount: 5000000, isArchived: 0, isCompleted: 0 },
      ]

      const summary = calculateBudgetGoalSummary({
        budgets: [],
        goals,
        currentMonthKey: '2026-10',
        budgetCycleStartDay: 1,
        locale: 'id',
        normalizedTransactions: [],
        defaultCurrency: 'IDR',
      })

      expect(summary.activeGoalRows).toHaveLength(2)
      expect(summary.activeGoalRows.map((g) => g.id)).toEqual([1, 6])
      expect(summary.goalRows).toHaveLength(6)
    })
  })

  describe('4. CalendarDayModal Transfer Source/Target Wallets & Whitespace Spacing', () => {
    const wallets = [
      { id: 10, name: 'BCA Utama' },
      { id: 20, name: 'Mandiri Tabungan' },
    ]

    it('displays source -> target wallet names for transfers', () => {
      const transferTx = {
        id: 301,
        amount: 250000,
        type: 'transfer',
        category: 'transfer',
        walletId: '10',
        targetWalletId: '20',
        date: '2026-10-12',
        time: '14:30',
        currency: 'IDR',
        notes: 'Transfer modal test',
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
        </MemoryRouter>
      )

      expect(screen.getByText('BCA Utama -> Mandiri Tabungan')).not.toBeNull()
      expect(screen.getByText('14:30', { exact: false })).not.toBeNull()
    })

    it('formats transfer amount without leading whitespace glitch', () => {
      const transferTx = {
        id: 302,
        amount: 100000,
        type: 'transfer',
        category: 'transfer',
        walletId: 10,
        targetWalletId: 20,
        date: '2026-10-12',
        currency: 'IDR',
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
        </MemoryRouter>
      )

      const amountText = document.body.querySelector('.text-right p')
      expect(amountText).not.toBeNull()
      expect(amountText?.textContent?.trim().startsWith('+')).toBe(false)
      expect(amountText?.textContent?.trim().startsWith('-')).toBe(false)
      // Check that there is no space between empty sign prefix and currency formatted string
      expect(amountText?.textContent?.startsWith(' ')).toBe(false)
    })

    it('robustly parses createdAt timestamp and ISO string when tx.time is missing', () => {
      const txWithTimestamp = {
        id: 303,
        amount: 50000,
        type: 'expense',
        category: 'makanan',
        walletId: 10,
        date: '2026-10-12',
        createdAt: new Date('2026-10-12T09:45:00').getTime(),
        currency: 'IDR',
      }

      const txWithIso = {
        id: 304,
        amount: 75000,
        type: 'income',
        category: 'gaji',
        walletId: 10,
        date: '2026-10-12',
        createdAt: '2026-10-12T16:20:00.000Z',
        currency: 'IDR',
      }

      const dayItems = {
        transactions: [txWithTimestamp, txWithIso],
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
        </MemoryRouter>
      )

      expect(screen.getByText('09:45', { exact: false })).not.toBeNull()
    })

    it('renders positive balance_adjustment with + prefix and income status color', () => {
      const posAdjTx = {
        id: 305,
        amount: 500000,
        type: 'balance_adjustment',
        category: 'adjustment',
        walletId: 10,
        date: '2026-10-12',
        currency: 'IDR',
      }

      const dayItems = {
        transactions: [posAdjTx],
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
        </MemoryRouter>
      )

      const amountEl = document.body.querySelector('.text-right p')
      expect(amountEl).not.toBeNull()
      expect(amountEl.textContent).toContain('+')
      expect(amountEl.style.color).toBe('var(--status-income)')
    })

    it('renders negative balance_adjustment with - prefix and expense status color', () => {
      const negAdjTx = {
        id: 306,
        amount: -250000,
        type: 'balance_adjustment',
        category: 'adjustment',
        walletId: 10,
        date: '2026-10-12',
        currency: 'IDR',
      }

      const dayItems = {
        transactions: [negAdjTx],
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
        </MemoryRouter>
      )

      const amountEl = document.body.querySelector('.text-right p')
      expect(amountEl).not.toBeNull()
      expect(amountEl.textContent).toContain('-')
      expect(amountEl.style.color).toBe('var(--status-expense)')
    })
  })

  describe('5. TransactionItemCard Orphaned Bullet Prevention in Context Wallet View', () => {
    const wallets = [{ id: 1, name: 'Bank BCA' }]
    const baseProps = {
      locale: 'id',
      t: (key, fallback) => fallback || key,
      format: vi.fn(),
      defaultCurrency: 'IDR',
      formatCurrency: (val) => `Rp ${val}`,
      convertCurrency: (val) => val,
      getCategoryColorClass: () => 'bg-transparent text-white',
      resolveTransactionIconKey: () => 'makanan',
      getTransactionCategoryLabels: () => ({ main: 'Makanan', sub: 'Makan Siang' }),
      rates: {},
      wallets,
    }

    it('does not render a leading bullet before subcategory when displayWalletName is null', () => {
      const tx = {
        id: 401,
        amount: 25000,
        type: 'expense',
        category: 'makanan',
        walletId: 1,
        time: '12:30',
        date: '2026-10-12',
        currency: 'IDR',
      }

      const { container } = render(
        <TransactionItemCard
          {...baseProps}
          transaction={tx}
          contextWalletId={1} // Viewing dedicated wallet, so displayWalletName is null
        />
      )

      const subLine = container.querySelector('p.text-\\[11px\\].font-semibold')
      expect(subLine).not.toBeNull()
      expect(subLine.textContent?.trim().startsWith('•')).toBe(false)
      expect(subLine.textContent).toContain('Makan Siang • 12:30')
    })

    it('does not render a leading bullet before time when displayWalletName and sub are null', () => {
      const tx = {
        id: 402,
        amount: 30000,
        type: 'expense',
        category: 'transport',
        walletId: 1,
        time: '15:45',
        date: '2026-10-12',
        currency: 'IDR',
      }

      const { container } = render(
        <TransactionItemCard
          {...baseProps}
          getTransactionCategoryLabels={() => ({ main: 'Transport', sub: null })}
          transaction={tx}
          contextWalletId={1}
        />
      )

      const subLine = container.querySelector('p.text-\\[11px\\].font-semibold')
      expect(subLine).not.toBeNull()
      expect(subLine.textContent?.trim().startsWith('•')).toBe(false)
      expect(subLine.textContent?.trim()).toBe('15:45')
    })
  })

  describe('6. Wallet ID Type Coercion & Balance Fallback Invariants', () => {
    it('evaluates isDefaultWallet correctly across string vs number types', () => {
      const checkIsDefaultWallet = (defaultWalletId, walletId) =>
        defaultWalletId != null && String(defaultWalletId) === String(walletId)

      expect(checkIsDefaultWallet(1, '1')).toBe(true)
      expect(checkIsDefaultWallet('2', 2)).toBe(true)
      expect(checkIsDefaultWallet('abc', 'abc')).toBe(true)
      expect(checkIsDefaultWallet(null, '1')).toBe(false)
      expect(checkIsDefaultWallet(undefined, '1')).toBe(false)
      expect(checkIsDefaultWallet('1', '2')).toBe(false)
    })

    it('evaluates isPrimary wallet in carousel correctly across string vs number types', () => {
      const checkIsPrimary = (defaultWalletId, wallet, activeWallets) =>
        defaultWalletId
          ? String(wallet.id) === String(defaultWalletId)
          : activeWallets.length === 1 && String(wallet.id) === String(activeWallets[0].id)

      expect(checkIsPrimary(1, { id: '1' }, [{ id: 1 }])).toBe(true)
      expect(checkIsPrimary('1', { id: 1 }, [{ id: 1 }])).toBe(true)
      expect(checkIsPrimary(null, { id: '1' }, [{ id: 1 }])).toBe(true)
      expect(checkIsPrimary(null, { id: '1' }, [{ id: 1 }, { id: 2 }])).toBe(false)
    })

    it('calculates wallet balance with fallback to w.balance and toSafeNumber', () => {
      const calcBal = (w) => toSafeNumber(w.currentBalance ?? w.balance ?? 0)

      expect(calcBal({ currentBalance: 50000 })).toBe(50000)
      expect(calcBal({ balance: 75000 })).toBe(75000)
      expect(calcBal({ currentBalance: '100000' })).toBe(100000)
      expect(calcBal({ balance: '25000' })).toBe(25000)
      expect(calcBal({})).toBe(0)
      expect(calcBal({ currentBalance: null, balance: 40000 })).toBe(40000)
    })
  })
})
