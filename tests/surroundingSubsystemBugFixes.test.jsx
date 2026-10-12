// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../src/lib/db'
import { invalidateAllBalances } from '../src/lib/balanceEngine'
import { useTransactionEditForm } from '../src/components/transactions/useTransactionEditForm'
import TransactionEditSplitSection from '../src/components/transactions/TransactionEditSplitSection'
import WalletSelectModal from '../src/components/ui/WalletSelectModal'
import CalendarDayModal from '../src/components/calendar/CalendarDayModal'
import TransactionDetailSheet from '../src/components/transactions/TransactionDetailSheet'
import WalletDetailHero from '../src/components/wallet/detail/WalletDetailHero'
import BudgetSavingsDetailSheet from '../src/components/dashboard/BudgetSavingsDetailSheet'
import { groupTransactionsDetailed } from '../src/components/transactions/transactionDateGrouping'
import { computeCalendarIndicators } from '../src/components/calendar/calendarIndicators'
import { getAllWalletBalances } from '../src/lib/balanceEngine'

const mockCreateTransaction = vi.fn()
vi.mock('../src/services/transactionService', () => ({
  createTransaction: (...args) => mockCreateTransaction(...args),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('Surrounding Subsystem Audited Bug Fixes Suite', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    invalidateAllBalances()
    await db.wallets.clear()
    await db.transactions.clear()
    await db.goals.clear()
    await db.goalLogs.clear()
  })

  afterEach(() => {
    cleanup()
  })

  describe('1. Duplicate Transaction - Secondary Entity FK Stripping', () => {
    it('strips all foreign keys and metadata so duplicate does not trigger cascading mutations', async () => {
      const mockAddTransaction = vi.fn().mockResolvedValue(1)
      const { result } = renderHook(() =>
        useTransactionEditForm({
          allWallets: [{ id: 1, name: 'Main', currency: 'IDR' }],
          defaultCurrency: 'IDR',
          addTransaction: mockAddTransaction,
          updateTransaction: vi.fn(),
          t: (k, fb) => fb || k,
        })
      )

      const rawTx = {
        id: 999,
        splitBillId: 101,
        loanId: 202,
        initialTransactionId: 303,
        deletedAt: 404,
        sourceNotifId: 'notif-1',
        sourceNotifIds: ['notif-1'],
        goalId: 505,
        investmentId: 606,
        investmentOrderId: 707,
        paymentId: 808,
        isLoanExcess: true,
        principalTransactionId: 909,
        excessTransactionId: 1001,
        amount: 75000,
        type: 'expense',
        category: 'food',
        walletId: 1,
        currency: 'IDR',
      }

      await act(async () => {
        await result.current.handleDuplicateTransaction(rawTx)
      })

      expect(mockAddTransaction).toHaveBeenCalledTimes(1)
      const passedPayload = mockAddTransaction.mock.calls[0][0]

      expect(passedPayload.id).toBeUndefined()
      expect(passedPayload.splitBillId).toBeUndefined()
      expect(passedPayload.loanId).toBeUndefined()
      expect(passedPayload.initialTransactionId).toBeUndefined()
      expect(passedPayload.deletedAt).toBeUndefined()
      expect(passedPayload.sourceNotifId).toBeUndefined()
      expect(passedPayload.sourceNotifIds).toBeUndefined()
      expect(passedPayload.goalId).toBeUndefined()
      expect(passedPayload.investmentId).toBeUndefined()
      expect(passedPayload.investmentOrderId).toBeUndefined()
      expect(passedPayload.paymentId).toBeUndefined()
      expect(passedPayload.isLoanExcess).toBeUndefined()
      expect(passedPayload.principalTransactionId).toBeUndefined()
      expect(passedPayload.excessTransactionId).toBeUndefined()
      expect(passedPayload.amount).toBe(75000)
      expect(passedPayload.category).toBe('food')
      expect(passedPayload.isPendingReview).toBe(false)
    })
  })

  describe('2. Split Item Category Input Typing Updates Without Lockup', () => {
    it('updates both category and name when typing into split item category input', () => {
      const handleSplitItemChange = vi.fn()
      const formData = {
        isSplit: true,
        currency: 'IDR',
        splitItems: [
          {
            category: 'Groceries',
            name: 'Initial Name',
            amount: 50000,
          },
        ],
      }

      render(
        <TransactionEditSplitSection
          formData={formData}
          handleSplitItemChange={handleSplitItemChange}
          t={(k, fb) => fb || k}
        />
      )

      const input = screen.getByDisplayValue('Groceries')
      expect(input).toBeTruthy()

      fireEvent.change(input, { target: { value: 'Supermarket' } })

      expect(handleSplitItemChange).toHaveBeenCalledWith(0, 'category', 'Supermarket')
      expect(handleSplitItemChange).toHaveBeenCalledWith(0, 'name', 'Supermarket')
    })

    it('falls back to item.name when item.category is undefined', () => {
      const formData = {
        isSplit: true,
        currency: 'IDR',
        splitItems: [
          {
            name: 'Item From Bill',
            amount: 25000,
          },
        ],
      }

      render(
        <TransactionEditSplitSection
          formData={formData}
          handleSplitItemChange={vi.fn()}
          t={(k, fb) => fb || k}
        />
      )

      expect(screen.getByDisplayValue('Item From Bill')).toBeTruthy()
    })
  })

  describe('3. WalletSelectModal - Dynamic Ledger Balances with propWallets', () => {
    it('enriches passed propWallets with actual ledger balances from Dexie transactions', async () => {
      const wallet = {
        id: 1,
        name: 'Dompet Utama',
        balance: 100000,
        currency: 'IDR',
      }
      await db.wallets.add(wallet)
      await db.transactions.add({
        id: 10,
        walletId: 1,
        amount: 250000,
        type: 'income',
        currency: 'IDR',
        date: '2026-10-12',
      })

      render(
        <MemoryRouter>
          <WalletSelectModal
            isOpen={true}
            onClose={() => {}}
            wallets={[wallet]}
            selectedWalletId={1}
            onSelectWallet={() => {}}
          />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/350\.000/)).toBeTruthy()
      })
    })
  })

  describe('4. CalendarDayModal - Wallet Currency Sync and Pending Submit Lock', () => {
    const wallets = [
      { id: 1, name: 'BCA IDR', currency: 'IDR', balance: 500000 },
      { id: 2, name: 'Cash USD', currency: 'USD', balance: 100 },
    ]

    it('synchronizes currency when user selects another wallet in add transaction mode', async () => {
      render(
        <MemoryRouter>
          <CalendarDayModal
            isOpen={true}
            onClose={() => {}}
            selectedDate={new Date('2026-10-12T12:00:00')}
            dayItems={{ transactions: [], events: [], loans: [] }}
            wallets={wallets}
            defaultWalletId={1}
            defaultCurrency="IDR"
            dayTab="add"
            setDayTab={() => {}}
          />
        </MemoryRouter>
      )

      const walletTrigger = screen.getByText('BCA IDR')
      fireEvent.click(walletTrigger)

      const usdWalletButton = screen.getByText('Cash USD')
      fireEvent.click(usdWalletButton)

      const selectEl = screen.getByRole('combobox')
      expect(selectEl.value).toBe('USD')
    })

    it('locks submission and disables save button during asynchronous transaction creation', async () => {
      let resolvePromise
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      mockCreateTransaction.mockReturnValue(pendingPromise)

      render(
        <MemoryRouter>
          <CalendarDayModal
            isOpen={true}
            onClose={() => {}}
            selectedDate={new Date('2026-10-12T12:00:00')}
            dayItems={{ transactions: [], events: [], loans: [] }}
            wallets={wallets}
            defaultWalletId={1}
            defaultCurrency="IDR"
            dayTab="add"
            setDayTab={() => {}}
          />
        </MemoryRouter>
      )

      const amountInput = screen.getByPlaceholderText('0')
      fireEvent.change(amountInput, { target: { value: '50000' } })

      const categoryTrigger = screen.getByText(/select category|pilih kategori/i)
      fireEvent.click(categoryTrigger)
      const parentOption = screen.getByText(/food|makanan/i)
      fireEvent.click(parentOption)
      const subOption = screen.getByText(/lunch|makan siang/i)
      fireEvent.click(subOption)

      const saveBtn = screen.getByRole('button', { name: /save|simpan/i })
      expect(saveBtn.disabled).toBe(false)

      fireEvent.click(saveBtn)

      expect(mockCreateTransaction).toHaveBeenCalledTimes(1)
      expect(saveBtn.disabled).toBe(true)

      fireEvent.click(saveBtn)
      expect(mockCreateTransaction).toHaveBeenCalledTimes(1)

      await act(async () => {
        resolvePromise({ id: 99 })
      })

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalledTimes(1)
      })
    })

    it('navigates to /loans when due loan card is clicked', () => {
      const dayItemsWithLoan = {
        transactions: [],
        events: [],
        loans: [
          {
            id: 88,
            title: 'Pinjaman Teman',
            personName: 'Budi',
            type: 'debt',
            remainingAmount: 200000,
            currency: 'IDR',
          },
        ],
      }

      render(
        <MemoryRouter>
          <CalendarDayModal
            isOpen={true}
            onClose={() => {}}
            selectedDate={new Date('2026-10-12T12:00:00')}
            dayItems={dayItemsWithLoan}
            wallets={wallets}
            defaultWalletId={1}
            defaultCurrency="IDR"
            dayTab="items"
            setDayTab={() => {}}
          />
        </MemoryRouter>
      )

      const loanCard = screen.getByText(/Pinjaman Teman/i).closest('div[class*="cursor-pointer"]')
      expect(loanCard).toBeTruthy()

      fireEvent.click(loanCard)
      expect(mockNavigate).toHaveBeenCalledWith('/loans')
    })
  })

  describe('5. transactionDateGrouping - Numeric Tie-Breaker Sorting', () => {
    it('sorts numeric transaction IDs properly in descending order', () => {
      const txs = [
        {
          id: 2,
          date: '2026-10-12',
          amount: 20000,
          type: 'expense',
          category: 'food',
          createdAt: 1712740000000,
        },
        {
          id: 10,
          date: '2026-10-12',
          amount: 50000,
          type: 'expense',
          category: 'food',
          createdAt: 1712740000000,
        },
      ]

      const grouped = groupTransactionsDetailed(txs, {
        locale: 'id',
        defaultCurrency: 'IDR',
        rates: {},
        t: (k, fb) => fb || k,
      })

      expect(grouped).toHaveLength(1)
      expect(grouped[0].items[0].id).toBe(10)
      expect(grouped[0].items[1].id).toBe(2)
    })
  })

  describe('6. TransactionDetailSheet - Analytics Excluded and Target Amount Badges', () => {
    it('renders Di luar Analisis badge when isExcludeAnalyticsTx is true', () => {
      const tx = {
        id: 50,
        amount: 150000,
        type: 'expense',
        category: 'belanja',
        walletId: 1,
        date: '2026-10-12',
        currency: 'IDR',
        isExcludeAnalyticsTx: true,
      }

      render(
        <TransactionDetailSheet
          isOpen={true}
          onClose={() => {}}
          transaction={tx}
          wallets={[{ id: 1, name: 'BCA', currency: 'IDR' }]}
          defaultCurrency="IDR"
          formatCurrency={(val) => `Rp ${val}`}
          t={(k, fb) => fb || k}
        />
      )

      expect(screen.getByText('Di luar Analisis')).toBeTruthy()
    })

    it('renders destination target amount badge on cross-currency transfer', () => {
      const transferTx = {
        id: 51,
        amount: 1500000,
        type: 'transfer',
        category: 'transfer',
        walletId: 1,
        targetWalletId: 2,
        date: '2026-10-12',
        currency: 'IDR',
        targetAmount: 100,
        targetCurrency: 'USD',
      }

      const wallets = [
        { id: 1, name: 'Rupiah Wallet', currency: 'IDR' },
        { id: 2, name: 'USD Wallet', currency: 'USD' },
      ]

      render(
        <TransactionDetailSheet
          isOpen={true}
          onClose={() => {}}
          transaction={transferTx}
          wallets={wallets}
          defaultCurrency="IDR"
          formatCurrency={(val, curr) => `${curr} ${val}`}
          t={(k, fb) => fb || k}
        />
      )

      expect(screen.getByText('Diterima:')).toBeTruthy()
      expect(screen.getByText('USD 100')).toBeTruthy()
    })
  })

  describe('7. WalletDetailHero - Archived State and Disabled Actions', () => {
    it('displays Diarsipkan badge and disables Sesuaikan Saldo button when wallet is archived', () => {
      const archivedWallet = {
        id: 7,
        name: 'Old Bank Account',
        institutionType: 'bank',
        isArchived: 1,
        currency: 'IDR',
        balance: 0,
      }

      const handleAdjust = vi.fn()

      render(
        <WalletDetailHero
          wallet={archivedWallet}
          currentBalance={0}
          defaultCurrency="IDR"
          onAdjustBalance={handleAdjust}
          locale="id"
          t={(k, fb) => fb || k}
        />
      )

      expect(screen.getByText('Diarsipkan')).toBeTruthy()

      const adjustButton = screen.getByRole('button', { name: /Penyesuaian Saldo/i })
      expect(adjustButton.disabled).toBe(true)

      fireEvent.click(adjustButton)
      expect(handleAdjust).not.toHaveBeenCalled()
    })
  })

  describe('8. BudgetSavingsDetailSheet - Complete Goal Schema and Initial Deposit Log', () => {
    it('creates active goal with status and initial deposit log when currentAmount > 0', async () => {
      render(
        <MemoryRouter>
          <BudgetSavingsDetailSheet
            isOpen={true}
            onClose={() => {}}
            initialMode="savings"
            goals={[]}
            budgets={[]}
            defaultCurrency="IDR"
          />
        </MemoryRouter>
      )

      const addBtn = screen.getByRole('button', { name: /Savings Goals|Target/i })
      fireEvent.click(addBtn)

      const nameInput = screen.getByPlaceholderText(/Beli Rumah|Nama Target|house|goal/i)
      fireEvent.change(nameInput, { target: { value: 'Dana Liburan' } })

      const inputs = screen.getAllByPlaceholderText('0')
      // inputs[0] is targetAmount, inputs[1] is currentAmount
      fireEvent.change(inputs[0], { target: { value: '10.000.000' } })
      fireEvent.change(inputs[1], { target: { value: '2.500.000' } })

      const saveGoalBtn = screen.getByRole('button', { name: /Simpan|Save/i })
      expect(saveGoalBtn.disabled).toBe(false)
      fireEvent.click(saveGoalBtn)

      await waitFor(async () => {
        const goals = await db.goals.toArray()
        expect(goals).toHaveLength(1)
        expect(goals[0]).toMatchObject({
          name: 'Dana Liburan',
          targetAmount: 10000000,
          currentAmount: 2500000,
          currency: 'IDR',
          status: 'active',
          isCompleted: false,
          completedAt: null,
          createdAt: expect.any(Number),
        })

        const logs = await db.goalLogs.toArray()
        expect(logs).toHaveLength(1)
        expect(logs[0]).toMatchObject({
          goalId: goals[0].id,
          amount: 2500000,
          notes: 'Saldo Awal Target Tabungan',
          transactionId: null,
        })
      })
    })

    it('creates completed goal when currentAmount >= targetAmount', async () => {
      render(
        <MemoryRouter>
          <BudgetSavingsDetailSheet
            isOpen={true}
            onClose={() => {}}
            initialMode="savings"
            goals={[]}
            budgets={[]}
            defaultCurrency="IDR"
          />
        </MemoryRouter>
      )

      const addBtn = screen.getByRole('button', { name: /Savings Goals|Target/i })
      fireEvent.click(addBtn)

      const nameInput = screen.getByPlaceholderText(/Beli Rumah|Nama Target|house|goal/i)
      fireEvent.change(nameInput, { target: { value: 'Goal Sudah Tercapai' } })

      const inputs = screen.getAllByPlaceholderText('0')
      fireEvent.change(inputs[0], { target: { value: '5.000.000' } })
      fireEvent.change(inputs[1], { target: { value: '5.000.000' } })

      const saveGoalBtn = screen.getByRole('button', { name: /Simpan|Save/i })
      fireEvent.click(saveGoalBtn)

      await waitFor(async () => {
        const goals = await db.goals.toArray()
        const found = goals.find((g) => g.name === 'Goal Sudah Tercapai')
        expect(found).toBeDefined()
        expect(found.status).toBe('completed')
        expect(found.isCompleted).toBe(true)
        expect(found.completedAt).toEqual(expect.any(Number))
      })
    })
  })

  describe('9. Calendar - Balance Adjustment Indicator Tally Mapping', () => {
    it('tallies positive balance_adjustment as income and negative as expense', () => {
      const txs = [
        {
          id: 1,
          date: '2026-10-15',
          amount: 500000,
          type: 'balance_adjustment',
        },
        {
          id: 2,
          date: '2026-10-15',
          amount: -150000,
          type: 'balance_adjustment',
        },
        {
          id: 3,
          date: '2026-10-15',
          isSplit: true,
          splitItems: [
            { id: 31, amount: 200000, type: 'balance_adjustment' },
            { id: 32, amount: -80000, type: 'balance_adjustment' },
          ],
        },
      ]

      const indicators = computeCalendarIndicators(txs, [], {}, [], new Date('2026-10-15T12:00:00'))
      const dayData = indicators.get('2026-10-15')

      expect(dayData).toBeDefined()
      expect(dayData.income).toBe(2) // 1 standard positive + 1 split positive
      expect(dayData.expense).toBe(2) // 1 standard negative + 1 split negative
    })
  })

  describe('10. useTransactionEditForm - Split Items Category Population from Name', () => {
    it('populates category from item.name when category is undefined in openEditTransaction', () => {
      const { result } = renderHook(() =>
        useTransactionEditForm({
          allWallets: [{ id: 1, name: 'Main', currency: 'IDR' }],
          defaultCurrency: 'IDR',
          addTransaction: vi.fn(),
          updateTransaction: vi.fn(),
          t: (k, fb) => fb || k,
        })
      )

      act(() => {
        result.current.openEditTransaction({
          id: 777,
          date: '2026-10-12',
          amount: 50000,
          type: 'expense',
          category: 'food',
          walletId: 1,
          currency: 'IDR',
          isSplit: true,
          splitItems: [
            {
              name: 'Split Item From Bill',
              amount: 50000,
            },
          ],
        })
      })

      expect(result.current.editFormData.splitItems[0].category).toBe('Split Item From Bill')
    })
  })

  describe('11. balanceEngine - LiveQuery Context Cache Persistence Without ReadOnlyError', () => {
    it('successfully bulk-puts walletBalanceCache without throwing ReadOnlyError', async () => {
      const w1 = { id: 1, name: 'Wallet 1', balance: 100000, currency: 'IDR' }
      const w2 = { id: 2, name: 'Wallet 2', balance: 200000, currency: 'IDR' }
      await db.wallets.bulkAdd([w1, w2])

      const balances = await getAllWalletBalances([w1, w2])
      expect(balances).toHaveLength(2)
      expect(balances[0].currentBalance).toBe(100000)
      expect(balances[1].currentBalance).toBe(200000)

      await waitFor(async () => {
        if (db.walletBalanceCache) {
          const cached1 = await db.walletBalanceCache.get(1)
          const cached2 = await db.walletBalanceCache.get(2)
          expect(cached1?.balance).toBe(100000)
          expect(cached2?.balance).toBe(200000)
        }
      })
    })
  })
})
