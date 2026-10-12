/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import BudgetSavingsDetailSheet from '../src/components/dashboard/BudgetSavingsDetailSheet'

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('../src/hooks/useTranslation', () => ({
  default: () => ({
    t: (key, fallback) => fallback || key,
    locale: 'id',
  }),
}))

vi.mock('../src/hooks/useBackButton', () => ({
  default: vi.fn(),
}))

describe('BudgetSavingsDetailSheet Open Transition', () => {
  it('opens cleanly without throwing ReferenceError when isOpen transitions from false to true', () => {
    const { rerender } = render(
      <BudgetSavingsDetailSheet
        isOpen={false}
        onClose={vi.fn()}
        initialMode="budget"
      />
    )

    // Now transition isOpen to true (simulating tapping the bento card on dashboard)
    expect(() => {
      act(() => {
        rerender(
          <BudgetSavingsDetailSheet
            isOpen={true}
            onClose={vi.fn()}
            initialMode="budget"
          />
        )
      })
    }).not.toThrow()
  })

  it('opens cleanly for savings mode as well', () => {
    const { rerender } = render(
      <BudgetSavingsDetailSheet
        isOpen={false}
        onClose={vi.fn()}
        initialMode="savings"
      />
    )

    expect(() => {
      act(() => {
        rerender(
          <BudgetSavingsDetailSheet
            isOpen={true}
            onClose={vi.fn()}
            initialMode="savings"
          />
        )
      })
    }).not.toThrow()
  })
})
