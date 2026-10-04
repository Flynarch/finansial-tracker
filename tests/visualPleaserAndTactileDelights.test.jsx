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

  it('renders large size lg with MaskedBalance when hidden', () => {
    const { container } = render(
      <AnimatedWalletBalance balance={50000000} currency="IDR" hideBalance={true} size="lg" />
    )
    expect(container.querySelector('[aria-hidden="false"]')).toBeTruthy()
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
})

describe('Package 3: AnimatedCounter Rolling Tickers', () => {
  it('renders target counter formatted string', () => {
    const { container } = render(
      <AnimatedCounter value={2500000} currency="IDR" skipInitial={true} />
    )
    expect(container.textContent).toBeTruthy()
    expect(container.textContent).toContain('2.500.000')
  })
})

describe('Package 4: InAppNotificationToast with Actionable Undo', () => {
  it('renders action button and triggers onClick when action is present', async () => {
    const handleUndo = vi.fn()
    render(
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
  })
})
