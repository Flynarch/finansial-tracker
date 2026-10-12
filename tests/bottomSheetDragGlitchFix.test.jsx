// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BottomSheet from '../src/components/ui/BottomSheet'
import SavingsSheetModal from '../src/components/savings/SavingsSheetModal'
import BudgetSavingsDetailSheet from '../src/components/dashboard/BudgetSavingsDetailSheet'
import WalletSelectModal from '../src/components/ui/WalletSelectModal'
import { db } from '../src/lib/db'

describe('BottomSheet Drag Handle & No-Glitch Invariant', () => {
  beforeEach(async () => {
    await db.goals.clear()
    await db.budgets.clear()
    await db.wallets.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('does not re-trigger ft-sheet-enter when user taps or touches the drag handle', async () => {
    const handleClose = vi.fn()

    act(() => {
      render(
        <BottomSheet isOpen={true} onClose={handleClose} title="Test Sheet" showHandle={true}>
          <div>Sheet Content</div>
        </BottomSheet>
      )
    })

    const dialog = screen.getByRole('dialog')
    expect(dialog.classList.contains('ft-sheet-enter')).toBe(true)

    // Wait for entrance timer to complete
    act(() => {
      vi.advanceTimersByTime(300)
    })

    // After entering, ft-sheet-enter should be removed from resting state
    expect(dialog.classList.contains('ft-sheet-enter')).toBe(false)

    // Find the drag handle element
    const handle = dialog.querySelector('.cursor-grab')
    expect(handle).toBeTruthy()

    // Simulate tapping on the drag handle ("pencet yang buat naik turun itu")
    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] })
    })

    // While dragging, ft-sheet-enter should not be present
    expect(dialog.classList.contains('ft-sheet-enter')).toBe(false)

    // Touch end without moving (dragOffset = 0)
    act(() => {
      fireEvent.touchEnd(handle)
    })

    // CRITICAL: ft-sheet-enter MUST NOT be re-added, preventing the glitch where the sheet drops down and slides up again
    expect(dialog.classList.contains('ft-sheet-enter')).toBe(false)
    expect(handleClose).not.toHaveBeenCalled()
  })

  it('smoothly snaps back and does not re-add ft-sheet-enter after partial drag', async () => {
    act(() => {
      render(
        <BottomSheet isOpen={true} onClose={() => {}} title="Test Sheet" showHandle={true}>
          <div>Sheet Content</div>
        </BottomSheet>
      )
    })

    const dialog = screen.getByRole('dialog')
    act(() => {
      vi.advanceTimersByTime(300)
    })

    const handle = dialog.querySelector('.cursor-grab')

    // Drag down 30px (below dismiss threshold)
    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] })
      fireEvent.touchMove(handle, { touches: [{ clientY: 130 }] })
    })

    // Release
    act(() => {
      fireEvent.touchEnd(handle)
    })

    // Fast-forward snap-back transition (200ms)
    act(() => {
      vi.advanceTimersByTime(250)
    })

    // Dialog must remain stable without ft-sheet-enter
    expect(dialog.classList.contains('ft-sheet-enter')).toBe(false)
  })

  it('keeps SavingsSheetModal stable without entrance animation replay when handle is tapped', async () => {
    act(() => {
      render(
        <SavingsSheetModal isOpen={true} onClose={() => {}} />
      )
    })

    const dialog = screen.getByRole('dialog')
    act(() => {
      vi.advanceTimersByTime(300)
    })

    const handle = dialog.querySelector('.cursor-grab')
    expect(handle).toBeTruthy()

    // Tap the handle
    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientY: 50 }] })
      fireEvent.touchEnd(handle)
    })

    expect(dialog.classList.contains('ft-sheet-enter')).toBe(false)
  })

  it('keeps BudgetSavingsDetailSheet stable without entrance animation replay when handle is tapped', async () => {
    act(() => {
      render(
        <MemoryRouter>
          <BudgetSavingsDetailSheet
            isOpen={true}
            onClose={() => {}}
            initialMode="savings"
            budgetGoalSummary={{}}
          />
        </MemoryRouter>
      )
    })

    // Find the dialog container
    const dialog = document.querySelector('.transform-gpu.ft-hide-scrollbar')
    expect(dialog).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    const handle = dialog.querySelector('.cursor-grab')
    expect(handle).toBeTruthy()

    // Tap the handle
    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientY: 50 }] })
      fireEvent.touchEnd(handle)
    })

    expect(dialog.classList.contains('ft-sheet-enter')).toBe(false)
  })

  it('keeps WalletSelectModal stable without entrance animation replay when handle is tapped', async () => {
    act(() => {
      render(
        <MemoryRouter>
          <WalletSelectModal
            isOpen={true}
            onClose={() => {}}
            selectedWalletId={1}
            onSelectWallet={() => {}}
          />
        </MemoryRouter>
      )
    })

    const dialog = document.querySelector('.transform-gpu')
    expect(dialog).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    const handle = dialog.querySelector('.cursor-grab')
    expect(handle).toBeTruthy()

    // Tap the handle
    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientY: 50 }] })
      fireEvent.touchEnd(handle)
    })

    expect(dialog.classList.contains('ft-sheet-enter')).toBe(false)
  })
})
