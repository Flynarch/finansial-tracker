// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TodoCardWidget from '../src/components/chat/widgets/TodoCardWidget'
import ActionSuccessCard from '../src/components/chat/ActionSuccessCard'
import QuickChips from '../src/components/chat/QuickChips'
import BudgetStatusWidget from '../src/components/chat/widgets/BudgetStatusWidget'
import SavingsCardWidget from '../src/components/chat/widgets/SavingsCardWidget'
import RecurringCardWidget from '../src/components/chat/widgets/RecurringCardWidget'
import LoanCardWidget from '../src/components/chat/widgets/LoanCardWidget'
import HabitCardWidget from '../src/components/chat/widgets/HabitCardWidget'

// Mock haptics
vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
}))

// Mock dexie-react-hooks
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn((fn, deps, defaultVal) => defaultVal ?? null),
}))

describe('AI Chat Visual Interactions and Bento Glass Widgets', () => {
  afterEach(() => {
    cleanup()
  })

  describe('TodoCardWidget Completed State', () => {
    it('renders normal active state with priority badge when not completed', () => {
      const { container } = render(
        <MemoryRouter>
          <TodoCardWidget
            todoId={101}
            title="Bayar tagihan listrik PLN"
            category="Tagihan"
            priority="high"
            subTasks={['Buka PLN Mobile', 'Bayar via BCA']}
            action="create"
            completed={false}
          />
        </MemoryRouter>
      )

      expect(screen.getByText('Bayar tagihan listrik PLN')).toBeDefined()
      expect(screen.getByText('Tinggi')).toBeDefined()
      expect(container.querySelector('.line-through')).toBeNull()
      expect(container.firstChild.className).toContain('backdrop-blur-md')
      expect(container.firstChild.className).toContain('bg-[var(--panel-strong)]/85')
    })

    it('renders completed state with Selesai badge and strikethrough when action is done', () => {
      const { container } = render(
        <MemoryRouter>
          <TodoCardWidget
            todoId={102}
            title="Bayar tagihan listrik PLN"
            category="Tagihan"
            priority="high"
            subTasks={['Buka PLN Mobile', 'Bayar via BCA']}
            action="done"
          />
        </MemoryRouter>
      )

      expect(screen.getByText('Bayar tagihan listrik PLN')).toBeDefined()
      // Selesai badge should be visible
      const selesaiBadges = screen.getAllByText(/Selesai/)
      expect(selesaiBadges.length).toBeGreaterThan(0)
      // Title or subtasks should have line-through
      const strikethroughElements = container.querySelectorAll('.line-through')
      expect(strikethroughElements.length).toBeGreaterThan(0)
      // Top emerald accent bar should be rendered
      expect(container.querySelector('.bg-emerald-500\\/60')).toBeDefined()
    })

    it('renders completed state when completed prop is true', () => {
      const { container } = render(
        <MemoryRouter>
          <TodoCardWidget
            todoId={103}
            title="Beli deterjen"
            completed={true}
          />
        </MemoryRouter>
      )

      const selesaiBadges = screen.getAllByText(/Selesai/)
      expect(selesaiBadges.length).toBeGreaterThan(0)
      expect(container.querySelector('.bg-emerald-500\\/60')).toBeDefined()
    })
  })

  describe('ActionSuccessCard Integration with TodoCardWidget', () => {
    it('forwards completed state to TodoCardWidget when action is done', () => {
      const { container } = render(
        <MemoryRouter>
          <ActionSuccessCard
            type="todo"
            action="done"
            title="Bayar tagihan listrik"
            data={{
              id: 104,
              title: 'Bayar tagihan listrik',
              category: 'Tagihan',
              completed: true,
            }}
          />
        </MemoryRouter>
      )

      expect(screen.getByText('Bayar tagihan listrik')).toBeDefined()
      const selesaiBadges = screen.getAllByText(/Selesai/)
      expect(selesaiBadges.length).toBeGreaterThan(0)
      expect(container.firstChild.className).toContain('backdrop-blur-md')
    })
  })

  describe('QuickChips Bento Glass & Interaction', () => {
    it('renders chips with translucent glass styling and triggers onSelect', () => {
      const onSelect = vi.fn()
      const chips = ['Lihat sisa tugas', 'Catat pembayaran listrik']

      render(
        <QuickChips chips={chips} onSelect={onSelect} />
      )

      const chipButtons = screen.getAllByRole('button')
      expect(chipButtons.length).toBe(2)
      expect(chipButtons[0].className).toContain('backdrop-blur-md')
      expect(chipButtons[0].className).toContain('bg-[var(--panel-strong)]/75')

      fireEvent.click(chipButtons[0])
      expect(onSelect).toHaveBeenCalledWith('Lihat sisa tugas')
    })

    it('returns null when no chips are provided', () => {
      const { container } = render(<QuickChips chips={[]} onSelect={vi.fn()} />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('Bento Glass Shell Consistency Across Domain Widgets', () => {
    it('BudgetStatusWidget renders with bento glass container', () => {
      const { container } = render(
        <MemoryRouter>
          <BudgetStatusWidget
            category="makanMinum"
            limit={1000000}
            spent={450000}
            currency="IDR"
          />
        </MemoryRouter>
      )

      expect(container.firstChild.className).toContain('backdrop-blur-md')
      expect(container.firstChild.className).toContain('bg-[var(--panel-strong)]/85')
    })

    it('SavingsCardWidget renders with bento glass container', () => {
      const { container } = render(
        <MemoryRouter>
          <SavingsCardWidget
            title="Dana Darurat"
            targetAmount={10000000}
            currentAmount={4000000}
            currency="IDR"
          />
        </MemoryRouter>
      )

      expect(container.firstChild.className).toContain('backdrop-blur-md')
      expect(container.firstChild.className).toContain('bg-[var(--panel-strong)]/85')
    })

    it('RecurringCardWidget renders with bento glass container', () => {
      const { container } = render(
        <MemoryRouter>
          <RecurringCardWidget
            title="Netflix"
            amount={186000}
            frequency="monthly"
            currency="IDR"
          />
        </MemoryRouter>
      )

      expect(container.firstChild.className).toContain('backdrop-blur-md')
      expect(container.firstChild.className).toContain('bg-[var(--panel-strong)]/85')
    })

    it('LoanCardWidget renders with bento glass container', () => {
      const { container } = render(
        <MemoryRouter>
          <LoanCardWidget
            title="Pinjaman Teman"
            personName="Budi"
            amount={500000}
            loanType="debt"
            currency="IDR"
          />
        </MemoryRouter>
      )

      expect(container.firstChild.className).toContain('backdrop-blur-md')
      expect(container.firstChild.className).toContain('bg-[var(--panel-strong)]/85')
    })

    it('HabitCardWidget renders with bento glass container', () => {
      const { container } = render(
        <MemoryRouter>
          <HabitCardWidget
            habitId={1}
            title="Minum Air 2L"
            frequencyType="daily"
          />
        </MemoryRouter>
      )

      expect(container.firstChild.className).toContain('backdrop-blur-md')
      expect(container.firstChild.className).toContain('bg-[var(--panel-strong)]/85')
    })
  })
})
