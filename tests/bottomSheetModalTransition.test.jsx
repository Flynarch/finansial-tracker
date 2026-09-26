// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import Modal from '../src/components/ui/Modal'
import BottomSheet from '../src/components/ui/BottomSheet'
import useBottomSheet from '../src/hooks/useBottomSheet'
import ReceiptPreviewModal from '../src/components/transactions/ReceiptPreviewModal'
import HabitStatsModal from '../src/components/habits/HabitStatsModal'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Motion, Transition & Lifecycle Synchronization Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  describe('useBottomSheet Hook Lifecycle', () => {
    function ControlledTestComponent({ onClose }) {
      const [isOpen, setIsOpen] = useState(true)
      const handleClose = () => {
        onClose?.()
        setIsOpen(false)
      }
      const { isMounted, isVisible, closeSheet, motionDelay } = useBottomSheet({
        isOpen,
        onClose: handleClose,
      })

      return (
        <div>
          <div data-testid="mounted">{String(isMounted)}</div>
          <div data-testid="visible">{String(isVisible)}</div>
          <div data-testid="delay">{motionDelay}</div>
          <button type="button" onClick={closeSheet} data-testid="close-btn">
            Close
          </button>
        </div>
      )
    }

    it('standardizes motionDelay to 200ms by default', () => {
      render(<ControlledTestComponent />)
      expect(screen.getByTestId('delay').textContent).toBe('200')
    })

    it('defers onClose and maintains isMounted=true during the 200ms exit window', () => {
      const onClose = vi.fn()
      render(<ControlledTestComponent onClose={onClose} />)

      expect(screen.getByTestId('mounted').textContent).toBe('true')
      expect(screen.getByTestId('visible').textContent).toBe('true')

      // Trigger close
      fireEvent.click(screen.getByTestId('close-btn'))

      // Immediately after close: isVisible becomes false (triggers CSS exit), but still mounted
      expect(screen.getByTestId('visible').textContent).toBe('false')
      expect(screen.getByTestId('mounted').textContent).toBe('true')
      expect(onClose).not.toHaveBeenCalled()

      // Advance timer partially (100ms) - should still be mounted mid-flight
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(screen.getByTestId('mounted').textContent).toBe('true')
      expect(onClose).not.toHaveBeenCalled()

      // Advance to full 200ms
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('mounted').textContent).toBe('false')
    })
  })

  describe('Modal Component Exit Lifecycle', () => {
    function ModalWrapper({ onClose }) {
      const [isOpen, setIsOpen] = useState(true)
      const handleClose = () => {
        onClose?.()
        setIsOpen(false)
      }

      return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Test Modal">
          <p>Modal Body Content</p>
        </Modal>
      )
    }

    it('does not unmount immediately when clicking close button, waiting for exit animation', () => {
      const onClose = vi.fn()
      render(<ModalWrapper onClose={onClose} />)

      expect(screen.getByText('Modal Body Content')).toBeDefined()
      const closeBtn = screen.getByRole('button', { name: /close|tutup/i })

      // Click close button
      fireEvent.click(closeBtn)

      // CRITICAL: Modal should NOT be unmounted immediately
      expect(screen.queryByText('Modal Body Content')).not.toBeNull()
      expect(onClose).not.toHaveBeenCalled()

      // After 100ms: still in DOM (mid-exit transition)
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(screen.queryByText('Modal Body Content')).not.toBeNull()
      expect(onClose).not.toHaveBeenCalled()

      // After 200ms: animation complete, unmounted
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(screen.queryByText('Modal Body Content')).toBeNull()
    })

    it('applies ft-sheet-enter on mount to guarantee keyframe slide-up animation', () => {
      render(<ModalWrapper />)
      const dialog = screen.getByRole('dialog')
      expect(dialog.className).toContain('ft-sheet-enter')
    })
  })

  describe('BottomSheet Component Gesture & Lifecycle', () => {
    function BottomSheetWrapper({ onClose }) {
      const [isOpen, setIsOpen] = useState(true)
      const handleClose = () => {
        onClose?.()
        setIsOpen(false)
      }

      return (
        <BottomSheet isOpen={isOpen} onClose={handleClose} title="Test Sheet">
          <p>Sheet Body Content</p>
        </BottomSheet>
      )
    }

    it('does not unmount immediately on backdrop or close button click', () => {
      const onClose = vi.fn()
      render(<BottomSheetWrapper onClose={onClose} />)

      expect(screen.getByText('Sheet Body Content')).toBeDefined()
      const dialog = screen.getByRole('dialog')
      const closeBtn = dialog.querySelector('button')

      fireEvent.click(closeBtn)

      // Must remain mounted for exit animation
      expect(screen.queryByText('Sheet Body Content')).not.toBeNull()
      expect(onClose).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(200)
      })

      expect(onClose).toHaveBeenCalledTimes(1)
      expect(screen.queryByText('Sheet Body Content')).toBeNull()
    })

    it('smoothly transitions on drag dismiss without snapping back to 0px', () => {
      render(<BottomSheetWrapper />)
      const dialog = screen.getByRole('dialog')
      const handle = dialog.querySelector('.cursor-grab')
      expect(handle).not.toBeNull()

      // Start drag
      fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] })
      fireEvent.touchMove(handle, { touches: [{ clientY: 220 }] }) // dragged 120px down

      // During drag: inline transform follows finger
      expect(dialog.style.transform).toContain('120px')
      expect(dialog.style.transition).toBe('none')

      // End drag: released past dismiss threshold (>80px)
      fireEvent.touchEnd(handle)

      // Should transition smoothly down to 100% rather than snapping to translate3d(0, 0, 0)
      expect(dialog.style.transform).toBe('translate3d(0, 100%, 0)')
      expect(dialog.style.transition).toContain('transform 200ms')
    })

    it('smoothly snaps back to 0px on small drag cancel without replaying 100% enter', () => {
      render(<BottomSheetWrapper />)
      const dialog = screen.getByRole('dialog')
      const handle = dialog.querySelector('.cursor-grab')
      expect(handle).not.toBeNull()

      // Small drag (40px) over 200ms
      fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] })
      act(() => {
        vi.advanceTimersByTime(200)
      })
      fireEvent.touchMove(handle, { touches: [{ clientY: 140 }] })
      expect(dialog.style.transform).toContain('40px')

      // Release (cancel threshold, velocity is 40px / 200ms = 0.2 px/ms < 0.45)
      fireEvent.touchEnd(handle)

      // Should transition to 0px without having ft-sheet-enter jump from 100%
      expect(dialog.style.transform).toBe('translate3d(0, 0, 0)')
      expect(dialog.style.transition).toContain('transform 200ms')

      // After 200ms snap-back completes
      act(() => {
        vi.advanceTimersByTime(200)
      })
      expect(dialog.style.transform).toBe('')
    })

    it('dismisses on fast downward flick even with small drag distance', () => {
      render(<BottomSheetWrapper />)
      const dialog = screen.getByRole('dialog')
      const handle = dialog.querySelector('.cursor-grab')

      // Fast flick: 35px in 40ms -> velocity = 0.875 px/ms > 0.45 threshold
      fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] })
      act(() => {
        vi.advanceTimersByTime(40)
      })
      fireEvent.touchMove(handle, { touches: [{ clientY: 135 }] })

      fireEvent.touchEnd(handle)

      expect(dialog.style.transform).toBe('translate3d(0, 100%, 0)')
      expect(dialog.style.transition).toContain('transform 200ms')
    })
  })

  describe('ReceiptPreviewModal & HabitStatsModal Visual Retention on Exit Tests', () => {
    function ReceiptWrapper({ initialImage, initialNotes }) {
      const [isOpen, setIsOpen] = useState(true)
      const [imageSrc, setImageSrc] = useState(initialImage)
      const [notes, setNotes] = useState(initialNotes)

      const handleClose = () => {
        setIsOpen(false)
        setImageSrc(null)
      }

      return (
        <div>
          <button type="button" onClick={() => setImageSrc(null)} data-testid="nullify-image-btn">
            Nullify Image
          </button>
          <button type="button" onClick={() => setNotes('Updated notes text')} data-testid="update-notes-btn">
            Update Notes
          </button>
          <ReceiptPreviewModal
            isOpen={isOpen}
            onClose={handleClose}
            imageSrc={imageSrc}
            notes={notes}
            title="Bukti Struk Resto"
            amountFormatted="Rp 75.000"
            date="2026-03-31"
          />
        </div>
      )
    }

    it('retains receipt image and metadata via lastImageRef when imageSrc becomes null', () => {
      render(<ReceiptWrapper initialImage="https://example.com/receipt.jpg" initialNotes="Lunch with team" />)

      expect(screen.getByText('Bukti Struk Resto')).toBeDefined()
      expect(screen.getByText(/Lunch with team/)).toBeDefined()
      expect(screen.getByText('Rp 75.000')).toBeDefined()

      // Parent nullifies imageSrc
      fireEvent.click(screen.getByTestId('nullify-image-btn'))

      // Component must STILL render the image and metadata via lastImageRef instead of returning null
      expect(screen.getByText('Bukti Struk Resto')).toBeDefined()
      expect(screen.getByText(/Lunch with team/)).toBeDefined()
      expect(screen.getByText('Rp 75.000')).toBeDefined()

      // Now click the modal's close button to initiate exit animation
      const closeBtn = screen.getByRole('button', { name: /close|tutup/i })
      fireEvent.click(closeBtn)

      // Mid-flight (100ms): Still rendered
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(screen.getByText('Bukti Struk Resto')).toBeDefined()

      // After 200ms: Modal unmounts
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(screen.queryByText('Bukti Struk Resto')).toBeNull()
    })

    it('keeps metadata fresh in lastMetaRef even when imageSrc does not change', () => {
      render(<ReceiptWrapper initialImage="https://example.com/receipt.jpg" initialNotes="Original notes" />)
      expect(screen.getByText(/Original notes/)).toBeDefined()

      // Update notes without changing imageSrc
      fireEvent.click(screen.getByTestId('update-notes-btn'))
      expect(screen.getByText(/Updated notes text/)).toBeDefined()

      // Nullify imageSrc
      fireEvent.click(screen.getByTestId('nullify-image-btn'))

      // Metadata must reflect updated notes, not stale initial notes
      expect(screen.getByText(/Updated notes text/)).toBeDefined()
      expect(screen.queryByText(/Original notes/)).toBeNull()
    })

    function HabitWrapper({ initialHabit }) {
      const [isOpen, setIsOpen] = useState(true)
      const [habit, setHabit] = useState(initialHabit)

      const handleClose = () => {
        setIsOpen(false)
        setHabit(null)
      }

      return (
        <div>
          <button type="button" onClick={() => setHabit(null)} data-testid="nullify-habit-btn">
            Nullify Habit
          </button>
          <HabitStatsModal
            isOpen={isOpen}
            onClose={handleClose}
            habit={habit}
            allHabitLogs={[]}
          />
        </div>
      )
    }

    it('retains habit details via lastHabitRef when habit prop becomes null', () => {
      const sampleHabit = {
        id: 99,
        title: 'Minum Air 2L',
        color: '#3b82f6',
        createdAt: '2026-01-01',
        targetDaysPerWeek: 7,
      }
      render(<HabitWrapper initialHabit={sampleHabit} />)

      expect(screen.getByText('Minum Air 2L')).toBeDefined()

      // Parent nullifies habit prop
      fireEvent.click(screen.getByTestId('nullify-habit-btn'))

      // Component must STILL render the habit details via lastHabitRef instead of returning null
      expect(screen.getByText('Minum Air 2L')).toBeDefined()

      // Now close modal via close button
      const closeBtn = screen.getByRole('button', { name: /close|tutup/i })
      fireEvent.click(closeBtn)

      // Mid-flight (100ms): Still rendered
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(screen.getByText('Minum Air 2L')).toBeDefined()

      // After 200ms: Modal unmounts
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(screen.queryByText('Minum Air 2L')).toBeNull()
    })
  })
})
