// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPulseBento from '../src/components/dashboard/DashboardPulseBento'
import BudgetSavingsDetailSheet from '../src/components/dashboard/BudgetSavingsDetailSheet'
import useSettingsStore from '../src/store/useSettingsStore'

describe('Dashboard Budget Indigo Color Invariant', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      locale: 'id',
      defaultCurrency: 'IDR',
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders Budget bento icon with indigo-500 classes and distinct from emerald-500 savings icon', () => {
    const budgetGoalSummary = {
      budgetRows: [
        {
          id: 1,
          category: 'all',
          spent: 250000,
          limit: 1000000,
          currency: 'IDR',
          pct: 25,
        },
      ],
      goalRows: [
        {
          id: 1,
          name: 'Dana Darurat',
          current: 500000,
          target: 2000000,
          currency: 'IDR',
          pct: 25,
        },
      ],
    }

    const { container } = render(
      <DashboardPulseBento
        budgetGoalSummary={budgetGoalSummary}
        defaultCurrency="IDR"
        locale="id"
        onOpenBudgetDetail={vi.fn()}
        onOpenSavingsDetail={vi.fn()}
      />,
    )

    // Budget card icon has indigo classes
    const indigoIcon = container.querySelector('.bg-indigo-500\\/12')
    expect(indigoIcon).not.toBeNull()
    expect(indigoIcon.className).toContain('text-indigo-500')
    expect(indigoIcon.className).toContain('border-indigo-500/20')

    // Savings card icon has emerald classes
    const emeraldIcon = container.querySelector('.bg-emerald-500\\/12')
    expect(emeraldIcon).not.toBeNull()
    expect(emeraldIcon.className).toContain('text-emerald-500')
    expect(emeraldIcon.className).toContain('border-emerald-500/20')

    // Progress bar for budget uses bg-indigo-500 when below 80%
    const indigoBar = container.querySelector('.bg-indigo-500')
    expect(indigoBar).not.toBeNull()
  })

  it('renders Budget detail sheet header icon with indigo-500 styling', () => {
    render(
      <MemoryRouter>
        <BudgetSavingsDetailSheet
          isOpen={true}
          initialMode="budget"
          onClose={vi.fn()}
          defaultCurrency="IDR"
          locale="id"
        />
      </MemoryRouter>,
    )

    const budgetIcon = document.body.querySelector('.bg-indigo-500\\/15')
    expect(budgetIcon).not.toBeNull()
    expect(budgetIcon.className).toContain('text-indigo-500')
    expect(budgetIcon.className).toContain('border-indigo-500/25')
  })

  it('renders "0 Categories" and "0 Goals" when locale is "en" on empty state', () => {
    useSettingsStore.setState({ locale: 'en' })
    const { getByText, queryByText } = render(
      <DashboardPulseBento
        budgetGoalSummary={{ budgetRows: [], goalRows: [] }}
        defaultCurrency="IDR"
        locale="en"
        onOpenBudgetDetail={vi.fn()}
        onOpenSavingsDetail={vi.fn()}
      />,
    )
    expect(getByText('0 Categories')).toBeTruthy()
    expect(queryByText('0 Kategori')).toBeNull()
    expect(getByText('0 Goals')).toBeTruthy()
    expect(queryByText('0 Target')).toBeNull()
  })

  it('renders "0 Kategori" and "0 Target" when locale is "id" on empty state', () => {
    useSettingsStore.setState({ locale: 'id' })
    const { getByText, queryByText } = render(
      <DashboardPulseBento
        budgetGoalSummary={{ budgetRows: [], goalRows: [] }}
        defaultCurrency="IDR"
        locale="id"
        onOpenBudgetDetail={vi.fn()}
        onOpenSavingsDetail={vi.fn()}
      />,
    )
    expect(getByText('0 Kategori')).toBeTruthy()
    expect(queryByText('0 Categories')).toBeNull()
    expect(getByText('0 Target')).toBeTruthy()
    expect(queryByText('0 Goals')).toBeNull()
  })
})
