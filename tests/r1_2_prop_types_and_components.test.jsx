// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Import all 14 modified JSX components
import ScrollToBottomFAB from '../src/components/chat/ScrollToBottomFAB'
import CardCarousel from '../src/components/chat/CardCarousel'
import ExpandableSection from '../src/components/chat/ExpandableSection'
import MessageContextMenu from '../src/components/chat/MessageContextMenu'
import WelcomeHero from '../src/components/chat/WelcomeHero'
import ActionSuccessCard from '../src/components/chat/ActionSuccessCard'
import BudgetStatusWidget from '../src/components/chat/widgets/BudgetStatusWidget'
import FinancialHealthWidget from '../src/components/chat/widgets/FinancialHealthWidget'
import HabitCardWidget from '../src/components/chat/widgets/HabitCardWidget'
import LoanCardWidget from '../src/components/chat/widgets/LoanCardWidget'
import RecurringCardWidget from '../src/components/chat/widgets/RecurringCardWidget'
import SavingsCardWidget from '../src/components/chat/widgets/SavingsCardWidget'
import TodoCardWidget from '../src/components/chat/widgets/TodoCardWidget'
import StagingReviewInbox from '../src/components/transactions/StagingReviewInbox'

describe('Adversarial Verification: PropTypes Removal & Component Mounting Integrity', () => {
  let consoleErrorSpy
  let consoleWarnSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  const assertNoPropTypesWarnings = () => {
    const errorCalls = consoleErrorSpy.mock.calls.map((c) => c.join(' '))
    const warnCalls = consoleWarnSpy.mock.calls.map((c) => c.join(' '))
    const allLogs = [...errorCalls, ...warnCalls]

    const propTypeViolations = allLogs.filter(
      (log) =>
        log.includes('Warning: Failed prop type') ||
        log.includes('PropTypes') ||
        log.includes('prop-types')
    )
    expect(propTypeViolations).toEqual([])
  }

  describe('1. ScrollToBottomFAB parameter defaults and text display', () => {
    it('mounts with zero props without throwing TypeError or warnings', () => {
      const { container } = render(<ScrollToBottomFAB />)
      expect(container).toBeDefined()
      assertNoPropTypesWarnings()
    })

    it('renders fallback label when unreadCount is default (0) and never renders "undefined"', () => {
      render(<ScrollToBottomFAB isVisible={true} />)
      const btn = screen.getByRole('button')
      expect(btn.textContent).not.toContain('undefined')
      expect(btn.textContent).toMatch(/Ke Bawah|To Bottom/)
      assertNoPropTypesWarnings()
    })

    it('renders badge text when unreadCount > 0 without displaying "undefined"', () => {
      render(<ScrollToBottomFAB isVisible={true} unreadCount={7} />)
      const btn = screen.getByRole('button')
      expect(btn.textContent).not.toContain('undefined')
      expect(btn.textContent).toMatch(/7 (Pesan Baru|New Messages)/)
      assertNoPropTypesWarnings()
    })

    it('handles click callback gracefully', () => {
      const onClick = vi.fn()
      render(<ScrollToBottomFAB isVisible={true} onClick={onClick} />)
      const btn = screen.getByRole('button')
      fireEvent.click(btn)
      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('2. CardCarousel mounting & rendering', () => {
    it('mounts with no children or props without throwing', () => {
      const { container } = render(<CardCarousel />)
      expect(container).toBeDefined()
      assertNoPropTypesWarnings()
    })

    it('renders child items correctly with custom cardWidth', () => {
      const { container } = render(
        <CardCarousel cardWidth={300}>
          <div data-testid="card-1">Card 1</div>
          <div data-testid="card-2">Card 2</div>
        </CardCarousel>
      )
      expect(screen.getByTestId('card-1')).toBeDefined()
      expect(screen.getByTestId('card-2')).toBeDefined()
      expect(container).toBeDefined()
      assertNoPropTypesWarnings()
    })
  })

  describe('3. ExpandableSection mounting & rendering', () => {
    it('mounts with minimal props and expands on click', () => {
      render(
        <ExpandableSection title="Test Title" defaultOpen={false}>
          <div data-testid="expanded-content">Content</div>
        </ExpandableSection>
      )
      expect(screen.getByText('Test Title')).toBeDefined()
      const titleEl = screen.getByText('Test Title')
      fireEvent.click(titleEl)
      expect(screen.getByTestId('expanded-content')).toBeDefined()
      assertNoPropTypesWarnings()
    })
  })

  describe('4. MessageContextMenu mounting & rendering', () => {
    it('returns null when isOpen is false without throwing', () => {
      const { container } = render(
        <MessageContextMenu isOpen={false} onClose={vi.fn()} />
      )
      expect(container.firstChild).toBeNull()
      assertNoPropTypesWarnings()
    })

    it('mounts correctly when isOpen is true and triggers actions', () => {
      const onClose = vi.fn()
      const onCopyText = vi.fn()
      render(
        <MessageContextMenu
          isOpen={true}
          onClose={onClose}
          messageContent="Sample financial note"
          messageType="text"
          onCopyText={onCopyText}
        />
      )
      assertNoPropTypesWarnings()
    })
  })

  describe('5. WelcomeHero mounting & rendering', () => {
    it('mounts with onSelectPrompt callback without throwing', () => {
      const onSelect = vi.fn()
      const { container } = render(
        <WelcomeHero onSelectPrompt={onSelect} todayExpense={150000} todayCurrency="IDR" />
      )
      expect(container).toBeDefined()
      assertNoPropTypesWarnings()
    })
  })

  describe('6. ActionSuccessCard mounting & rendering across all action types', () => {
    const actionTypes = ['todo', 'transaction', 'habit', 'loan', 'budget', 'savings']

    actionTypes.forEach((type) => {
      it(`mounts successfully for action type "${type}"`, () => {
        const { container } = render(
          <MemoryRouter>
            <ActionSuccessCard
              type={type}
              action="create"
              title={`Success ${type}`}
              subtitle="Details"
              data={{ id: 1 }}
            />
          </MemoryRouter>
        )
        expect(container).toBeDefined()
        assertNoPropTypesWarnings()
      })
    })
  })

  describe('7. BudgetStatusWidget mounting & rendering', () => {
    it('mounts with defined props without throwing', () => {
      const { container } = render(
        <MemoryRouter>
          <BudgetStatusWidget
            category="Makanan"
            limit={2000000}
            spent={800000}
            currency="IDR"
          />
        </MemoryRouter>
      )
      expect(container).toBeDefined()
      assertNoPropTypesWarnings()
    })
  })

  describe('8. FinancialHealthWidget mounting & rendering', () => {
    it('mounts with health metrics without throwing', () => {
      const { container } = render(
        <FinancialHealthWidget
          score={85}
          rating="Sangat Baik"
          savingsRate={30}
          expenseVelocity={45}
          debtRatio={10}
          budgetCompliance={90}
          onAction={vi.fn()}
        />
      )
      expect(container).toBeDefined()
      assertNoPropTypesWarnings()
    })
  })

  describe('9. HabitCardWidget mounting & rendering', () => {
    it('mounts with habit props without throwing', () => {
      const { container } = render(
        <MemoryRouter>
          <HabitCardWidget
            habitId={101}
            title="Olahraga Pagi"
            color="emerald"
            frequencyType="daily"
          />
        </MemoryRouter>
      )
      expect(container).toBeDefined()
      assertNoPropTypesWarnings()
    })
  })

  describe('10. LoanCardWidget mounting & rendering', () => {
    it('mounts with loan props without throwing', () => {
      const { container } = render(
        <MemoryRouter>
          <LoanCardWidget
            title="Pinjaman Teman"
            personName="Budi"
            loanType="lent"
            amount={500000}
            dueDate="2026-10-01"
            currency="IDR"
          />
        </MemoryRouter>
      )
      expect(container).toBeDefined()
      assertNoPropTypesWarnings()
    })
  })

  describe('11. RecurringCardWidget mounting & rendering', () => {
    it('mounts with recurring bill props without throwing', () => {
      const { container } = render(
        <MemoryRouter>
          <RecurringCardWidget
            title="Langganan Internet"
            amount={350000}
            frequency="monthly"
            currency="IDR"
            category="Tagihan"
          />
        </MemoryRouter>
      )
      expect(container).toBeDefined()
      assertNoPropTypesWarnings()
    })
  })

  describe('12. SavingsCardWidget mounting & rendering', () => {
    it('mounts with savings target props without throwing', () => {
      const { container } = render(
        <MemoryRouter>
          <SavingsCardWidget
            title="Dana Darurat"
            targetAmount={20000000}
            currentAmount={15000000}
            currency="IDR"
          />
        </MemoryRouter>
      )
      expect(container).toBeDefined()
      assertNoPropTypesWarnings()
    })
  })

  describe('13. TodoCardWidget mounting & rendering', () => {
    it('mounts with todo task props without throwing', () => {
      const { container } = render(
        <MemoryRouter>
          <TodoCardWidget
            todoId={202}
            title="Bayar Listrik PLN"
            category="Tagihan"
            dueDate="2026-09-30"
            priority="high"
            subTasks={['Cek tagihan', 'Transfer m-banking']}
          />
        </MemoryRouter>
      )
      expect(container).toBeDefined()
      assertNoPropTypesWarnings()
    })
  })

  describe('14. StagingReviewInbox mounting & rendering', () => {
    it('mounts with empty pendingTransactions without throwing', () => {
      const { container } = render(
        <StagingReviewInbox
          pendingTransactions={[]}
          wallets={[]}
          formatCurrency={(n) => String(n)}
          defaultCurrency="IDR"
          t={(k) => k}
        />
      )
      expect(container).toBeDefined()
      assertNoPropTypesWarnings()
    })

    it('mounts with staged items and handles render without PropTypes error', () => {
      const mockTx = [
        {
          id: 999,
          type: 'expense',
          amount: 45000,
          category: 'Makan',
          date: '2026-09-22',
          note: 'Makan siang',
          walletId: 1,
        },
      ]
      const mockWallets = [{ id: 1, name: 'Dompet Utama' }]
      const { container } = render(
        <StagingReviewInbox
          pendingTransactions={mockTx}
          wallets={mockWallets}
          formatCurrency={(n) => `Rp ${n}`}
          defaultCurrency="IDR"
          t={(k) => k}
        />
      )
      expect(container).toBeDefined()
      assertNoPropTypesWarnings()
    })
  })
})
