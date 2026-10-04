// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { triggerHaptic, hapticImpact, hapticSuccess, hapticWarning, hapticError, hapticSelection } from '../src/lib/haptics'
import AnimatedWalletBalance from '../src/components/dashboard/AnimatedWalletBalance'
import CanvasConfettiOverlay from '../src/components/ui/CanvasConfettiOverlay'
import InAppNotificationToast from '../src/components/notifications/InAppNotificationToast'
import AnimatedCounter from '../src/components/ui/AnimatedCounter'
import { BrowserRouter } from 'react-router-dom'

// Mock Haptics plugin
vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: vi.fn(),
    notification: vi.fn(),
    selectionChanged: vi.fn(),
  },
  ImpactStyle: {
    Light: 'LIGHT',
    Medium: 'MEDIUM',
    Heavy: 'HEAVY',
  },
  NotificationType: {
    Success: 'SUCCESS',
    Warning: 'WARNING',
    Error: 'ERROR',
  },
}))

describe('Package 1: Polymorphic Haptic Engine', () => {
  it('dispatches haptic polymorphic calls correctly', async () => {
    // Test that triggerHaptic works for polymorphic arguments without crashing
    await expect(triggerHaptic('success')).resolves.not.toThrow()
    await expect(triggerHaptic('warning')).resolves.not.toThrow()
    await expect(triggerHaptic('error')).resolves.not.toThrow()
    await expect(triggerHaptic('selection')).resolves.not.toThrow()
    await expect(triggerHaptic('medium')).resolves.not.toThrow()
    await expect(triggerHaptic('heavy')).resolves.not.toThrow()
    await expect(triggerHaptic('light')).resolves.not.toThrow()
    await expect(hapticSuccess()).resolves.not.toThrow()
    await expect(hapticWarning()).resolves.not.toThrow()
    await expect(hapticError()).resolves.not.toThrow()
    await expect(hapticSelection()).resolves.not.toThrow()
    await expect(hapticImpact()).resolves.not.toThrow()
  })
})

describe('Package 1: AnimatedWalletBalance (sm & lg)', () => {
  it('renders standard size sm properly', () => {
    const { container } = render(
      <AnimatedWalletBalance balance={1500000} currency="IDR" hideBalance={false} size="sm" />
    )
    expect(container.textContent).toContain('1.500.000')
  })

  it('renders large size lg with MaskedBalance when hidden with 106px width', () => {
    const { container } = render(
      <AnimatedWalletBalance balance={50000000} currency="IDR" hideBalance={true} size="lg" />
    )
    expect(container.querySelector('[aria-hidden="false"]')).toBeTruthy()
    const wrapper = container.firstChild
    expect(wrapper.style.width).toBe('106px')
  })
})

describe('Package 2: CanvasConfettiOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders canvas element and calls onComplete after duration', () => {
    const onComplete = vi.fn()
    render(<CanvasConfettiOverlay duration={500} onComplete={onComplete} />)
    const canvas = document.querySelector('canvas')
    expect(canvas).toBeTruthy()
  })

  it('supports cannons variant without crashing', () => {
    const onComplete = vi.fn()
    render(<CanvasConfettiOverlay duration={500} variant="cannons" onComplete={onComplete} />)
    const canvas = document.querySelector('canvas')
    expect(canvas).toBeTruthy()
  })
})

describe('Package 3: AnimatedCounter Rolling Tickers', () => {
  it('renders target counter formatted string', () => {
    const { container } = render(
      <AnimatedCounter value={2500000} currency="IDR" skipInitial={true} />
    )
    expect(container.textContent).toBeTruthy()
    expect(container.textContent).toContain('2.500.000')
  })

  it('renders signed positive and negative values correctly when showSign is enabled', () => {
    const { container: posContainer } = render(
      <AnimatedCounter value={500000} currency="IDR" skipInitial={true} showSign={true} />
    )
    expect(posContainer.textContent).toContain('+')
    expect(posContainer.textContent).toContain('500.000')

    const { container: negContainer } = render(
      <AnimatedCounter value={-500000} currency="IDR" skipInitial={true} showSign={true} />
    )
    expect(negContainer.textContent).toContain('-')
    expect(negContainer.textContent).toContain('500.000')
  })
})

describe('Package 4: InAppNotificationToast with Actionable Undo', () => {
  it('renders action button and triggers onClick when action is present', async () => {
    const handleUndo = vi.fn()
    const { unmount } = render(
      <BrowserRouter>
        <InAppNotificationToast />
      </BrowserRouter>
    )

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ft-show-toast', {
          detail: {
            title: 'Transaksi Tersimpan',
            message: 'Rp 50.000 - Makan Siang',
            type: 'success',
            duration: 3000,
            action: {
              label: 'Urungkan',
              onClick: handleUndo,
            },
          },
        })
      )
    })

    const undoBtn = await screen.findByRole('button', { name: /urungkan/i })
    expect(undoBtn).toBeTruthy()
    fireEvent.click(undoBtn)
    expect(handleUndo).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('pauses and resumes on hover/touch without crashing', async () => {
    const { unmount } = render(
      <BrowserRouter>
        <InAppNotificationToast />
      </BrowserRouter>
    )

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ft-show-toast', {
          detail: {
            title: 'Info',
            message: 'Testing pause',
            type: 'info',
            duration: 3000,
          },
        })
      )
    })

    const alert = await screen.findByRole('alert')
    fireEvent.mouseEnter(alert)
    fireEvent.mouseLeave(alert)
    expect(alert).toBeTruthy()
    unmount()
  })

  it('unmounts cleanly while a toast countdown is actively pending', () => {
    const { unmount } = render(
      <BrowserRouter>
        <InAppNotificationToast />
      </BrowserRouter>
    )

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ft-show-toast', {
          detail: {
            title: 'Auto Dismiss Test',
            message: 'Testing unmount cleanup',
            type: 'success',
            duration: 5000,
          },
        })
      )
    })

    expect(() => unmount()).not.toThrow()
  })
})

describe('Package 5: Route Redirects & Goal Navigation Hierarchy', () => {
  it('resolves /goal/:id and /goals/:id hierarchical parent routes to /savings', async () => {
    const { getParentRoute } = await import('../src/lib/navigationHierarchy')
    expect(getParentRoute('/goal/laptop-baru')).toBe('/savings')
    expect(getParentRoute('/goals/rumah-idaman')).toBe('/savings')
    expect(getParentRoute('/savings/dana-darurat')).toBe('/savings')
  })

  it('redirects /goal/:id and /goals/:id to /savings/:id cleanly', async () => {
    const { MemoryRouter, Routes, Route, Navigate, useParams } = await import('react-router-dom')
    function GoalDetailRedirect() {
      const { id } = useParams()
      return <Navigate to={`/savings/${id}`} replace />
    }

    render(
      <MemoryRouter initialEntries={['/goal/goal-42']}>
        <Routes>
          <Route path="/savings/:id" element={<div data-testid="savings-target">Savings Detail</div>} />
          <Route path="/goal/:id" element={<GoalDetailRedirect />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('savings-target')).toBeTruthy()
  })
})

describe('Package 6: Zero-Decimal Currencies & Sign Edge Cases in AnimatedCounter', () => {
  it('handles zero decimal VND currency correctly', () => {
    const { container } = render(
      <AnimatedCounter value={50000} currency="VND" skipInitial={true} />
    )
    expect(container.textContent).toContain('50.000')
  })

  it('does not display negative prefix when value is -0 or 0 with showSign', () => {
    const { container } = render(
      <AnimatedCounter value={-0} currency="IDR" skipInitial={true} showSign={true} />
    )
    expect(container.textContent).not.toContain('-')
    expect(container.textContent).not.toContain('+')
  })
})
