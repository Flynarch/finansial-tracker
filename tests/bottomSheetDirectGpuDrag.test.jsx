// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { useState } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BottomSheet from '../src/components/ui/BottomSheet'
import BudgetSavingsDetailSheet from '../src/components/dashboard/BudgetSavingsDetailSheet'
import CategorySheet from '../src/components/transactions/quick-add/CategorySheet'
import WalletSelectModal from '../src/components/ui/WalletSelectModal'
import DashboardZoomOverlay from '../src/components/dashboard/DashboardZoomOverlay'
import AiQuickLogModal from '../src/components/chat/AiQuickLogModal'
import useChatStore from '../src/store/useChatStore'
import { triggerHaptic } from '../src/lib/haptics'

vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
}))

describe('BottomSheet Direct GPU Transform Drag Performance & Smoothness', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('updates dialog style transform directly on touchmove without triggering child re-renders', () => {
    const handleClose = vi.fn()
    const renderSpy = vi.fn()

    function HeavyChildForm() {
      renderSpy()
      return <div data-testid="heavy-form">Form Inputs and Live Data</div>
    }

    act(() => {
      render(
        <BottomSheet isOpen={true} onClose={handleClose} title="Tambah Tabungan" showHandle={true}>
          <HeavyChildForm />
        </BottomSheet>
      )
    })

    const dialog = screen.getByRole('dialog')
    // Advance entrance animation
    act(() => {
      vi.advanceTimersByTime(300)
    })

    const initialRenderCount = renderSpy.mock.calls.length
    expect(initialRenderCount).toBeGreaterThan(0)

    const handle = dialog.querySelector('.cursor-grab')
    expect(handle).toBeTruthy()

    // 1. Start drag
    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] })
    })

    // 2. Perform 5 consecutive touchmove steps simulating 120Hz finger movement
    act(() => {
      fireEvent.touchMove(handle, { touches: [{ clientY: 110 }] }) // 10px down
      fireEvent.touchMove(handle, { touches: [{ clientY: 125 }] }) // 25px down
      fireEvent.touchMove(handle, { touches: [{ clientY: 140 }] }) // 40px down
      fireEvent.touchMove(handle, { touches: [{ clientY: 155 }] }) // 55px down
      fireEvent.touchMove(handle, { touches: [{ clientY: 170 }] }) // 70px down
    })

    // Direct GPU transform must be applied directly to the DOM element
    expect(dialog.style.transform).toBe('translate3d(0, 70px, 0)')

    // CRITICAL PERFORMANCE INVARIANT: During active touchmove dragging, the child component MUST NOT re-render!
    // Zero re-renders during drag ensures 120 FPS hardware-composited dragging on mobile devices.
    const afterDragRenderCount = renderSpy.mock.calls.length
    expect(afterDragRenderCount).toBe(initialRenderCount)

    // 3. Release below dismiss threshold with 200ms drag duration -> snaps back
    act(() => {
      vi.advanceTimersByTime(200)
      fireEvent.touchEnd(handle)
    })

    expect(dialog.style.transform).toBe('translate3d(0, 0, 0)')
    expect(dialog.style.transition).toContain('cubic-bezier(0.16, 1, 0.3, 1)')

    // Fast forward snap back animation (250ms)
    act(() => {
      vi.advanceTimersByTime(260)
    })

    // Cleaned up styles after snap back completes
    expect(dialog.style.transform).toBe('')
    expect(handleClose).not.toHaveBeenCalled()
  })

  it('triggers haptic feedback when dragging exceeds 80px threshold and dismisses on release', () => {
    const handleClose = vi.fn()

    act(() => {
      render(
        <BottomSheet isOpen={true} onClose={handleClose} title="Budget Form" showHandle={true}>
          <div>Budget Content</div>
        </BottomSheet>
      )
    })

    const dialog = screen.getByRole('dialog')
    act(() => {
      vi.advanceTimersByTime(300)
    })

    const handle = dialog.querySelector('.cursor-grab')

    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] })
    })

    // Drag past 80px threshold
    act(() => {
      fireEvent.touchMove(handle, { touches: [{ clientY: 190 }] }) // 90px down
    })

    expect(dialog.style.transform).toBe('translate3d(0, 90px, 0)')
    expect(triggerHaptic).toHaveBeenCalledWith('light')

    // Release past threshold -> triggers dismiss
    act(() => {
      fireEvent.touchEnd(handle)
    })

    expect(dialog.style.transform).toBe('translate3d(0, 100%, 0)')

    // Advance motionDelay (200ms) for closeSheet to invoke onClose
    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(handleClose).toHaveBeenCalled()
  })

  it('applies elastic rubberband resistance when dragged upwards', () => {
    act(() => {
      render(
        <BottomSheet isOpen={true} onClose={() => {}} title="Rubberband Test" showHandle={true}>
          <div>Content</div>
        </BottomSheet>
      )
    })

    const dialog = screen.getByRole('dialog')
    act(() => {
      vi.advanceTimersByTime(300)
    })

    const handle = dialog.querySelector('.cursor-grab')

    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientY: 200 }] })
      fireEvent.touchMove(handle, { touches: [{ clientY: 100 }] }) // -100px upward
    })

    // Math.max(0, currentOffset) clamps translate3d to 0 so sheet doesn't detach awkwardly
    expect(dialog.style.transform).toBe('translate3d(0, 0px, 0)')
  })

  it('supports desktop mouse drag with window mousemove and mouseup listeners', () => {
    const handleClose = vi.fn()

    act(() => {
      render(
        <BottomSheet isOpen={true} onClose={handleClose} title="Mouse Drag Test" showHandle={true}>
          <div>Desktop Preview</div>
        </BottomSheet>
      )
    })

    const dialog = screen.getByRole('dialog')
    act(() => {
      vi.advanceTimersByTime(300)
    })

    const handle = dialog.querySelector('.cursor-grab')

    // Mouse down on handle (button 0 = left click)
    act(() => {
      fireEvent.mouseDown(handle, { button: 0, clientY: 100 })
    })

    // Window mouse move
    act(() => {
      fireEvent.mouseMove(window, { clientY: 150 }) // 50px down
    })

    expect(dialog.style.transform).toBe('translate3d(0, 50px, 0)')

    // Wait 200ms before releasing to simulate standard drag duration
    act(() => {
      vi.advanceTimersByTime(200)
      fireEvent.mouseUp(window)
    })

    // Snapped back
    expect(dialog.style.transform).toBe('translate3d(0, 0, 0)')
    expect(handleClose).not.toHaveBeenCalled()
  })

  it('BudgetSavingsDetailSheet preserves transform and opacity dismiss transition without immediate wipeout', () => {
    const handleClose = vi.fn()
    act(() => {
      render(
        <MemoryRouter>
          <BudgetSavingsDetailSheet
            isOpen={true}
            onClose={handleClose}
            initialMode="budget"
            budgetGoalSummary={{ budgetRows: [] }}
          />
        </MemoryRouter>
      )
    })

    const dialog = document.querySelector('.transform-gpu.ft-hide-scrollbar')
    expect(dialog).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    const handle = dialog.querySelector('.cursor-grab')
    expect(handle).toBeTruthy()

    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] })
      fireEvent.touchMove(handle, { touches: [{ clientY: 200 }] }) // 100px down (exceeds threshold)
    })

    expect(dialog.style.transform).toBe('translate3d(0, 100px, 0)')

    // Release drag to dismiss
    act(() => {
      fireEvent.touchEnd(handle)
    })

    // Dismiss transition must remain active on dialog and NOT be wiped out to '' immediately
    expect(dialog.style.transform).toBe('translate3d(0, 100%, 0)')
    expect(dialog.style.opacity).toBe('0')
    expect(dialog.style.transition).toContain('cubic-bezier(0.4, 0, 1, 1)')

    // Advance motion delay to complete close
    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(handleClose).toHaveBeenCalled()
  })

  it('CategorySheet applies opacity 0 and cubic-bezier transition on drag dismiss', () => {
    const handleClose = vi.fn()
    act(() => {
      render(
        <CategorySheet
          isOpen={true}
          isEnter={true}
          onClose={handleClose}
          txType="expense"
          activeTree={[]}
          activeParentId="cat-1"
          setActiveParentId={() => {}}
        />
      )
    })

    const sheet = document.querySelector('.transform-gpu')
    expect(sheet).toBeTruthy()

    const handle = sheet.querySelector('.cursor-grab')
    expect(handle).toBeTruthy()

    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] })
      fireEvent.touchMove(handle, { touches: [{ clientY: 200 }] }) // 100px down
    })

    expect(sheet.style.transform).toBe('translate3d(0, 100px, 0)')

    act(() => {
      fireEvent.touchEnd(handle)
    })

    expect(sheet.style.transform).toBe('translate3d(0, 100%, 0)')
    expect(sheet.style.opacity).toBe('0')
    expect(sheet.style.transition).toContain('opacity 180ms ease-in')
    expect(handleClose).toHaveBeenCalled()
  })

  it('BottomSheet omits ft-sheet-exit class on drag dismiss but applies it on programmatic close', () => {
    const handleClose = vi.fn()

    // 1. Drag dismiss test
    const { unmount } = render(
      <BottomSheet isOpen={true} onClose={handleClose} title="Test Drag Dismiss" showHandle={true}>
        <div>Sheet Content</div>
      </BottomSheet>
    )

    act(() => {
      vi.advanceTimersByTime(300)
    })

    const dialog = screen.getByRole('dialog')
    const handle = dialog.querySelector('.cursor-grab')

    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] })
      fireEvent.touchMove(handle, { touches: [{ clientY: 200 }] }) // 100px down > 80px
      fireEvent.touchEnd(handle)
    })

    // Drag dismissal: ft-sheet-exit must NOT be present to prevent upward glitch keyframe
    expect(dialog.classList.contains('ft-sheet-exit')).toBe(false)
    expect(dialog.style.transform).toBe('translate3d(0, 100%, 0)')

    unmount()

    // 2. Programmatic close test (via close button)
    const handleClose2 = vi.fn()
    render(
      <BottomSheet isOpen={true} onClose={handleClose2} title="Test Programmatic Close" showCloseButton={true}>
        <div>Sheet Content</div>
      </BottomSheet>
    )

    act(() => {
      vi.advanceTimersByTime(300)
    })

    const dialog2 = screen.getByRole('dialog')
    const closeBtn = dialog2.querySelector('button[aria-label="Tutup"], button[aria-label="Close"]')
    expect(closeBtn).toBeTruthy()

    act(() => {
      fireEvent.click(closeBtn)
    })

    // Programmatic close: ft-sheet-exit SHOULD be attached for smooth keyframe slide-down
    expect(dialog2.classList.contains('ft-sheet-exit')).toBe(true)
  })

  it('BudgetSavingsDetailSheet omits ft-sheet-exit class on drag dismiss but applies it on close button click', () => {
    const handleClose = vi.fn()

    // 1. Drag dismiss test
    const { unmount } = render(
      <MemoryRouter>
        <BudgetSavingsDetailSheet
          isOpen={true}
          onClose={handleClose}
          initialMode="budget"
          budgetGoalSummary={{ budgetRows: [] }}
        />
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(300)
    })

    const dialog = document.querySelector('.transform-gpu.ft-hide-scrollbar')
    expect(dialog).toBeTruthy()
    const handle = dialog.querySelector('.cursor-grab')

    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] })
      fireEvent.touchMove(handle, { touches: [{ clientY: 200 }] })
      fireEvent.touchEnd(handle)
    })

    expect(dialog.classList.contains('ft-sheet-exit')).toBe(false)

    unmount()

    // 2. Programmatic close test
    const handleClose2 = vi.fn()
    render(
      <MemoryRouter>
        <BudgetSavingsDetailSheet
          isOpen={true}
          onClose={handleClose2}
          initialMode="budget"
          budgetGoalSummary={{ budgetRows: [] }}
        />
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(300)
    })

    const dialog2 = document.querySelector('.transform-gpu.ft-hide-scrollbar')
    const closeBtn = dialog2.querySelector('button[aria-label="Tutup"], button[aria-label="Close"]')
    expect(closeBtn).toBeTruthy()

    act(() => {
      fireEvent.click(closeBtn)
    })

    expect(dialog2.classList.contains('ft-sheet-exit')).toBe(true)
  })

  it('WalletSelectModal omits ft-sheet-exit class on drag dismiss but applies it on programmatic close', () => {
    const handleClose = vi.fn()

    // 1. Drag dismiss test
    const { unmount } = render(
      <MemoryRouter>
        <WalletSelectModal
          isOpen={true}
          onClose={handleClose}
          wallets={[{ id: 'w1', name: 'Dompet Utama', balance: 100000 }]}
        />
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(300)
    })

    const modalDialog = document.querySelector('.transform-gpu.z-10')
    expect(modalDialog).toBeTruthy()
    const handle = modalDialog.querySelector('.cursor-grab')

    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] })
      fireEvent.touchMove(handle, { touches: [{ clientY: 200 }] })
      fireEvent.touchEnd(handle)
    })

    expect(modalDialog.classList.contains('ft-sheet-exit')).toBe(false)

    unmount()

    // 2. Programmatic close test
    const handleClose2 = vi.fn()
    render(
      <MemoryRouter>
        <WalletSelectModal
          isOpen={true}
          onClose={handleClose2}
          wallets={[{ id: 'w1', name: 'Dompet Utama', balance: 100000 }]}
        />
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(300)
    })

    const modalDialog2 = document.querySelector('.transform-gpu.z-10')
    const closeBtn = modalDialog2.querySelector('button[aria-label="Tutup"], button[aria-label="Close"]')
    expect(closeBtn).toBeTruthy()

    act(() => {
      fireEvent.click(closeBtn)
    })

    expect(modalDialog2.classList.contains('ft-sheet-exit')).toBe(true)
  })

  it('DashboardZoomOverlay omits ft-sheet-exit class on drag dismiss but applies it on backdrop click', () => {
    const handleClose = vi.fn()

    function ControlledZoom({ onDismiss }) {
      const [visible, setVisible] = useState(true)
      return (
        <DashboardZoomOverlay
          zoomedChart="habits"
          zoomVisible={visible}
          onCloseZoom={() => {
            setVisible(false)
            onDismiss?.()
          }}
          defaultCurrency="IDR"
          locale="id"
          t={(k, fallback) => fallback || k}
          zoomRevenueRange="7d"
          zoomCombinedChartSeries={[]}
        />
      )
    }

    // 1. Drag dismiss test
    const { unmount } = render(
      <MemoryRouter>
        <ControlledZoom onDismiss={handleClose} />
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(300)
    })

    const dialog = document.querySelector('.transform-gpu.ft-hide-scrollbar')
    expect(dialog).toBeTruthy()
    const handle = dialog.querySelector('.cursor-grab')

    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] })
      fireEvent.touchMove(handle, { touches: [{ clientY: 200 }] })
      fireEvent.touchEnd(handle)
    })

    expect(dialog.classList.contains('ft-sheet-exit')).toBe(false)
    expect(dialog.style.transform).toBe('translate3d(0, 100%, 0)')

    unmount()

    // 2. Programmatic close test (backdrop click)
    const handleClose2 = vi.fn()
    render(
      <MemoryRouter>
        <ControlledZoom onDismiss={handleClose2} />
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(300)
    })

    const dialog2 = document.querySelector('.transform-gpu.ft-hide-scrollbar')
    const backdrop = document.querySelector('.ft-backdrop-enter')
    expect(backdrop).toBeTruthy()

    act(() => {
      fireEvent.click(backdrop)
    })

    expect(dialog2.classList.contains('ft-sheet-exit')).toBe(true)
  })

  it('AiQuickLogModal applies smooth slide-down and opacity 0 on drag dismiss', () => {
    act(() => {
      useChatStore.getState().openQuickLog()
    })

    render(
      <MemoryRouter>
        <AiQuickLogModal />
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(300)
    })

    const sheet = document.querySelector('.transform-gpu.ft-hide-scrollbar')
    expect(sheet).toBeTruthy()
    const handle = sheet.querySelector('.cursor-grab')
    expect(handle).toBeTruthy()

    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] })
      fireEvent.touchMove(handle, { touches: [{ clientY: 200 }] })
      fireEvent.touchEnd(handle)
    })

    expect(sheet.style.transform).toBe('translate3d(0, 100%, 0)')
    expect(sheet.style.opacity).toBe('0')
    expect(sheet.style.transition).toContain('opacity 180ms ease-in')
  })
})
