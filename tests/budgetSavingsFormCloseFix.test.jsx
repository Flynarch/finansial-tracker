// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BudgetSavingsDetailSheet from '../src/components/dashboard/BudgetSavingsDetailSheet'

// Mocks
vi.mock('../src/hooks/useTranslation', () => ({
  default: () => ({
    t: (key, fallback) => fallback || key,
    locale: 'id',
  }),
}))

vi.mock('../src/store/useSettingsStore', () => ({
  default: (selector) => {
    const state = {
      defaultCurrency: 'IDR',
      budgetCycleStartDay: 1,
      reduceMotion: true,
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('../src/lib/db', () => ({
  db: {
    budgets: {
      where: () => ({
        equals: () => ({
          first: () => Promise.resolve(null),
        }),
      }),
      add: vi.fn(),
      update: vi.fn(),
    },
    goals: {
      add: vi.fn(),
      update: vi.fn(),
    },
  },
}))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('BudgetSavingsDetailSheet & Form Close Fixes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('header bar does NOT contain touch-blocking touch-none or cursor-grab classes', () => {
    render(
      <MemoryRouter>
        <BudgetSavingsDetailSheet
          isOpen={true}
          onClose={vi.fn()}
          initialMode="budget"
          budgetGoalSummary={{ budgetRows: [] }}
        />
      </MemoryRouter>
    )

    const closeBtns = screen.getAllByLabelText('Tutup')
    const closeBtn = closeBtns.find((el) => el.className.includes('rounded-full'))
    expect(closeBtn).toBeDefined()
    const headerBar = closeBtn.closest('div.border-b')
    expect(headerBar).toBeDefined()
    expect(headerBar.className).not.toContain('touch-none')
    expect(headerBar.className).not.toContain('cursor-grab')
  })

  it('clicking Cancel on empty budget form immediately closes the sheet', () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <BudgetSavingsDetailSheet
          isOpen={true}
          onClose={onClose}
          initialMode="budget"
          budgetGoalSummary={{ budgetRows: [] }}
        />
      </MemoryRouter>
    )

    // Click "Buat Anggaran Sekarang"
    const createBtn = screen.getByText('Buat Anggaran Sekarang')
    fireEvent.click(createBtn)

    // Form is now shown with "Batal"
    const cancelBtn = screen.getByText('Batal')
    fireEvent.click(cancelBtn)

    // Motion delay is 0 when reduceMotion: true
    act(() => {
      vi.runAllTimers()
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clicking Cancel on empty savings goal form immediately closes the sheet', () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <BudgetSavingsDetailSheet
          isOpen={true}
          onClose={onClose}
          initialMode="savings"
          budgetGoalSummary={{ goalRows: [] }}
        />
      </MemoryRouter>
    )

    // Click "Tambah Target Sekarang"
    const createBtn = screen.getByText('Tambah Target Sekarang')
    fireEvent.click(createBtn)

    // Form is now shown with "Batal"
    const cancelBtn = screen.getByText('Batal')
    fireEvent.click(cancelBtn)

    act(() => {
      vi.runAllTimers()
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clicking header close (X) button triggers onClose', () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <BudgetSavingsDetailSheet
          isOpen={true}
          onClose={onClose}
          initialMode="budget"
          budgetGoalSummary={{ budgetRows: [] }}
        />
      </MemoryRouter>
    )

    const closeBtns = screen.getAllByLabelText('Tutup')
    const closeBtn = closeBtns.find((el) => el.className.includes('rounded-full'))
    fireEvent.click(closeBtn)

    act(() => {
      vi.runAllTimers()
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clicking Cancel on budget form returns to detail if existing budget items exist', () => {
    const onClose = vi.fn()
    const existingBudgetRows = [
      { id: 1, category: 'food', spent: 50000, limit: 100000, pct: 50, currency: 'IDR' },
    ]

    render(
      <MemoryRouter>
        <BudgetSavingsDetailSheet
          isOpen={true}
          onClose={onClose}
          initialMode="budget"
          budgetGoalSummary={{ budgetRows: existingBudgetRows }}
        />
      </MemoryRouter>
    )

    // In detail view with existing items, header has "+ Anggaran" button
    const addBtn = screen.getByText('Anggaran')
    fireEvent.click(addBtn)

    // Now in create view, click "Batal"
    const cancelBtn = screen.getByText('Batal')
    fireEvent.click(cancelBtn)

    act(() => {
      vi.runAllTimers()
    })

    // Sheet should NOT close, it should stay open in detail view
    expect(onClose).not.toHaveBeenCalled()
    // "+ Anggaran" button is visible again in detail view
    expect(screen.getByText('Anggaran')).toBeDefined()
  })

  it('clicking ArrowLeft header button returns to detail if existing items exist', () => {
    const onClose = vi.fn()
    const existingGoalRows = [
      { id: 1, name: 'Dana Darurat', currentAmount: 500000, targetAmount: 1000000, pct: 50, currency: 'IDR' },
    ]

    render(
      <MemoryRouter>
        <BudgetSavingsDetailSheet
          isOpen={true}
          onClose={onClose}
          initialMode="savings"
          budgetGoalSummary={{ goalRows: existingGoalRows }}
        />
      </MemoryRouter>
    )

    const addBtn = screen.getByText('Target')
    fireEvent.click(addBtn)

    const backBtn = screen.getByLabelText('Kembali')
    fireEvent.click(backBtn)

    act(() => {
      vi.runAllTimers()
    })

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Target')).toBeDefined()
  })
})
