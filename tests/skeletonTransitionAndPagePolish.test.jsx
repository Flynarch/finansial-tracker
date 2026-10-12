// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SkeletonTransition from '../src/components/ui/SkeletonTransition'
import PageSkeleton from '../src/components/ui/PageSkeleton'
import InAppNotificationToast from '../src/components/notifications/InAppNotificationToast'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
  hapticImpact: vi.fn(),
  hapticSuccess: vi.fn(),
  hapticWarning: vi.fn(),
  hapticError: vi.fn(),
  hapticSelection: vi.fn(),
}))

vi.mock('../src/lib/db', () => ({
  db: {
    notifications: {
      toArray: vi.fn().mockResolvedValue([]),
    },
    budgets: {
      toArray: vi.fn().mockResolvedValue([]),
    },
    loans: {
      toArray: vi.fn().mockResolvedValue([]),
    },
    loanPayments: {
      toArray: vi.fn().mockResolvedValue([]),
    },
    wallets: {
      toArray: vi.fn().mockResolvedValue([]),
    },
    goals: {
      toArray: vi.fn().mockResolvedValue([]),
    },
  },
}))

describe('SkeletonTransition Component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('renders ONLY the skeleton while isLoading is true and never mounts children', () => {
    const childSpy = vi.fn()
    function ChildComponent() {
      childSpy()
      return <div>Real Live Content</div>
    }

    render(
      <SkeletonTransition
        isLoading={true}
        skeleton={<div data-testid="skeleton-layer">Loading Skeleton</div>}
      >
        <ChildComponent />
      </SkeletonTransition>
    )

    expect(screen.getByTestId('skeleton-layer')).toBeDefined()
    expect(screen.queryByText('Real Live Content')).toBeNull()
    expect(childSpy).not.toHaveBeenCalled()
  })

  it('renders children directly when isLoading is false from initial mount', () => {
    render(
      <SkeletonTransition
        isLoading={false}
        skeleton={<div data-testid="skeleton-layer">Loading Skeleton</div>}
      >
        <div>Direct Loaded Content</div>
      </SkeletonTransition>
    )

    expect(screen.getByText('Direct Loaded Content')).toBeDefined()
    expect(screen.queryByTestId('skeleton-layer')).toBeNull()
  })

  it('performs cross-dissolve when transitioning from isLoading true to false', () => {
    const { rerender } = render(
      <SkeletonTransition
        isLoading={true}
        skeleton={<div data-testid="skeleton-layer">Loading Skeleton</div>}
      >
        <div>Content After Load</div>
      </SkeletonTransition>
    )

    expect(screen.queryByText('Content After Load')).toBeNull()

    // Flip isLoading to false
    rerender(
      <SkeletonTransition
        isLoading={false}
        skeleton={<div data-testid="skeleton-layer">Loading Skeleton</div>}
      >
        <div>Content After Load</div>
      </SkeletonTransition>
    )

    // Children is mounted with ft-content-loaded
    expect(screen.getByText('Content After Load')).toBeDefined()

    // Retained skeleton overlay is present with ft-skeleton-leaving and pointer-events-none
    const overlay = document.querySelector('.ft-skeleton-leaving')
    expect(overlay).not.toBeNull()
    expect(overlay.className).toContain('pointer-events-none')

    // Fast-forward transition timer (240ms)
    act(() => {
      vi.advanceTimersByTime(250)
    })

    // Overlay is completely unmounted
    expect(document.querySelector('.ft-skeleton-leaving')).toBeNull()
  })

  it('synchronously renders the exiting skeleton overlay on the first render frame without blank gap', () => {
    const { rerender } = render(
      <SkeletonTransition
        isLoading={true}
        skeleton={<div data-testid="skeleton-layer">Loading Skeleton</div>}
      >
        <div data-testid="live-content">Live Content</div>
      </SkeletonTransition>
    )

    expect(screen.getByTestId('skeleton-layer')).toBeDefined()
    expect(screen.queryByTestId('live-content')).toBeNull()

    // Flip isLoading to false synchronously
    rerender(
      <SkeletonTransition
        isLoading={false}
        skeleton={<div data-testid="skeleton-layer">Loading Skeleton</div>}
      >
        <div data-testid="live-content">Live Content</div>
      </SkeletonTransition>
    )

    // Synchronous state adjustment ensures BOTH live content AND leaving skeleton overlay exist in Frame 1
    expect(screen.getByTestId('live-content')).toBeDefined()
    const overlay = document.querySelector('.ft-skeleton-leaving')
    expect(overlay).not.toBeNull()
    expect(overlay.querySelector('[data-testid="skeleton-layer"]')).not.toBeNull()

    // After 240ms timeout, overlay is removed
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(document.querySelector('.ft-skeleton-leaving')).toBeNull()
  })

  it('resets transition cleanly if isLoading toggles back to true during cross-dissolve', () => {
    const { rerender } = render(
      <SkeletonTransition
        isLoading={true}
        skeleton={<div data-testid="skeleton-layer">Loading Skeleton</div>}
      >
        <div>Content After Load</div>
      </SkeletonTransition>
    )

    // Flip isLoading to false -> transition begins
    rerender(
      <SkeletonTransition
        isLoading={false}
        skeleton={<div data-testid="skeleton-layer">Loading Skeleton</div>}
      >
        <div>Content After Load</div>
      </SkeletonTransition>
    )

    expect(document.querySelector('.ft-skeleton-leaving')).not.toBeNull()

    // Rapid toggle back to isLoading true before 240ms ends
    rerender(
      <SkeletonTransition
        isLoading={true}
        skeleton={<div data-testid="skeleton-layer">Loading Skeleton</div>}
      >
        <div>Content After Load</div>
      </SkeletonTransition>
    )

    // Should immediately show only skeleton and clean up leaving overlay
    expect(screen.getByTestId('skeleton-layer')).toBeDefined()
    expect(screen.queryByText('Content After Load')).toBeNull()
    expect(document.querySelector('.ft-skeleton-leaving')).toBeNull()
  })

  it('maintains stable flex container and renders overflow-hidden on exiting overlay', () => {
    const { rerender, container } = render(
      <SkeletonTransition
        isLoading={true}
        skeleton={<div data-testid="skeleton-layer">Loading Skeleton</div>}
        className="h-full flex-1 flex flex-col min-h-0"
      >
        <div>Content In Flex</div>
      </SkeletonTransition>
    )

    rerender(
      <SkeletonTransition
        isLoading={false}
        skeleton={<div data-testid="skeleton-layer">Loading Skeleton</div>}
        className="h-full flex-1 flex flex-col min-h-0"
      >
        <div>Content In Flex</div>
      </SkeletonTransition>
    )

    const overlay = container.querySelector('.ft-skeleton-leaving')
    expect(overlay).not.toBeNull()
    expect(overlay.className).toContain('overflow-hidden')
    expect(overlay.className).toContain('pointer-events-none')

    const contentWrapper = container.querySelector('.ft-content-loaded')
    expect(contentWrapper).not.toBeNull()
    expect(contentWrapper.className).toContain('flex-1')
    expect(contentWrapper.className).toContain('flex-col')
  })
})

describe('PageSkeleton Geometry Alignment', () => {
  afterEach(() => {
    cleanup()
  })

  it('DashboardSkeleton matches production cards and excludes old quick actions grid', () => {
    const { container } = render(<PageSkeleton variant="dashboard" />)
    // Should NOT have the old 4-column quick action grid
    const oldQuickGrid = container.querySelector('.grid-cols-4')
    expect(oldQuickGrid).toBeNull()

    // Should have net worth and bento placeholders
    const cards = container.querySelectorAll('.ft-skeleton-card')
    expect(cards.length).toBeGreaterThanOrEqual(5)
  })

  it('TransactionsSkeleton has 2 segmented tabs and search bar', () => {
    const { container } = render(<PageSkeleton variant="transactions" />)
    const tabsContainer = container.querySelector('.grid-cols-2')
    expect(tabsContainer).not.toBeNull()
    const bars = tabsContainer.querySelectorAll('.ft-skeleton')
    expect(bars.length).toBe(2)
  })

  it('BudgetSkeleton has responsive 3-column grid for budget cards', () => {
    const { container } = render(<PageSkeleton variant="budget" />)
    const responsiveGrid = container.querySelector('.lg\\:grid-cols-3')
    expect(responsiveGrid).not.toBeNull()
  })

  it('LoansSkeleton has divided summary card and 2 segmented tabs', () => {
    const { container } = render(<PageSkeleton variant="loans" />)
    const dividedSection = container.querySelector('.divide-x')
    expect(dividedSection).not.toBeNull()

    const tabsContainer = container.querySelector('.grid-cols-2')
    expect(tabsContainer).not.toBeNull()
  })

  it('SavingsSkeleton has full-width progress bar in hero summary', () => {
    const { container } = render(<PageSkeleton variant="savings" />)
    const progressBars = container.querySelectorAll('.rounded-full.ft-skeleton')
    expect(progressBars.length).toBeGreaterThanOrEqual(1)
  })

  it('ReportsSkeleton includes smart insights strip and net worth chart placeholder', () => {
    const { container } = render(<PageSkeleton variant="reports" />)
    const cards = container.querySelectorAll('.ft-skeleton-card')
    expect(cards.length).toBeGreaterThanOrEqual(4)
  })

  it('ProfileSkeleton matches production hero card, 3 stats, and shortcuts list', () => {
    const { container } = render(<PageSkeleton variant="profile" />)
    // Avatar circle 88px with camera badge
    const avatar = container.querySelector('.h-\\[88px\\].w-\\[88px\\]')
    expect(avatar).not.toBeNull()

    // 3-column stats row
    const statsCols = container.querySelector('.flex.gap-3')
    expect(statsCols).not.toBeNull()
    expect(statsCols.children.length).toBe(3)

    // Account & Preferences card
    const accountCard = container.querySelector('.flex.items-center.gap-4')
    expect(accountCard).not.toBeNull()

    // Shortcuts panel with 6 rows
    const shortcutRows = container.querySelectorAll('.divide-y > div')
    expect(shortcutRows.length).toBe(6)

    // Version footer divider
    const footerDividers = container.querySelectorAll('.h-px.flex-1')
    expect(footerDividers.length).toBe(2)
  })

  it('TodoSkeleton has + Tugas header action, 2 segmented tabs, and 4 todo cards', () => {
    const { container } = render(<PageSkeleton variant="todo" />)
    // Header with Title + Action button
    const headerRow = container.querySelector('.flex.items-center.justify-between.mb-2')
    expect(headerRow).not.toBeNull()

    // Segmented tab control (Tugas vs Kebiasaan)
    const segmentedTabs = container.querySelector('.grid-cols-2')
    expect(segmentedTabs).not.toBeNull()

    // Filter pills
    const filterTabsRow = container.querySelector('.space-y-4 > .flex.gap-2')
    expect(filterTabsRow).not.toBeNull()
    expect(filterTabsRow.children.length).toBe(4)

    // 4 todo card placeholders
    const todoCards = container.querySelectorAll('.ft-skeleton-card')
    expect(todoCards.length).toBe(4)
  })

  it('CalendarSkeleton has 3-button toolbar and 35 day grid cells', () => {
    const { container } = render(<PageSkeleton variant="calendar" />)
    // Toolbar navigation group (prev, today, next)
    const toolbar = container.querySelector('.rounded-2xl.bg-\\[var\\(--field-bg\\)\\]')
    expect(toolbar).not.toBeNull()
    expect(toolbar.querySelectorAll('.ft-skeleton').length).toBe(4)

    // 7 day headers
    const dayHeaders = container.querySelector('.grid-cols-7')
    expect(dayHeaders).not.toBeNull()
    expect(dayHeaders.querySelectorAll('.ft-skeleton').length).toBe(7)

    // Calendar month grid with 35 cells
    const monthCells = container.querySelectorAll('.grid-cols-7 .flex-col')
    expect(monthCells.length).toBe(35)
  })
})

describe('InAppNotificationToast Progress Bar and Polish', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('renders toast with CSS animation progress bar that does not jump back to 100% on dismiss', async () => {
    render(
      <MemoryRouter>
        <InAppNotificationToast />
      </MemoryRouter>
    )

    // Trigger toast via custom event
    act(() => {
      window.dispatchEvent(
        new CustomEvent('ft-show-toast', {
          detail: {
            title: 'Pembayaran Berhasil',
            message: 'Transaksi telah disimpan.',
            type: 'success',
            duration: 4000,
          },
        })
      )
    })

    // Advance frame for visibility
    act(() => {
      vi.advanceTimersByTime(20)
    })

    const alert = screen.getByRole('alert')
    expect(alert).toBeDefined()
    expect(screen.getByText('Pembayaran Berhasil')).toBeDefined()

    // Find progress bar element
    const progressBar = alert.querySelector('[class*="origin-left transform-gpu"]')
    expect(progressBar).not.toBeNull()
    expect(progressBar.style.animationName).toBe('ft-toast-progress')
    expect(progressBar.style.animationDuration).toBe('4000ms')
    expect(progressBar.style.opacity).not.toBe('0')

    // Find close button and click it
    const closeBtn = screen.getByTitle(/close|tutup/i)
    act(() => {
      fireEvent.click(closeBtn)
    })

    // On dismiss: animation pauses and opacity fades out (style.opacity === '0')
    expect(progressBar.style.opacity).toBe('0')
    expect(progressBar.style.animationPlayState).toBe('paused')
    // Crucially: style.width is NOT 100% (it uses keyframe scaleX without width resets)
    expect(progressBar.style.width).not.toBe('100%')

    // Fast-forward dismiss animation (320ms)
    act(() => {
      vi.advanceTimersByTime(350)
    })

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('generates unique IDs for multiple enqueued toasts', async () => {
    render(
      <MemoryRouter>
        <InAppNotificationToast />
      </MemoryRouter>
    )

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ft-show-toast', {
          detail: {
            title: 'Notifikasi 1',
            message: 'Pesan pertama',
            type: 'budget',
          },
        })
      )
      window.dispatchEvent(
        new CustomEvent('ft-show-toast', {
          detail: {
            title: 'Notifikasi 2',
            message: 'Pesan kedua',
            type: 'loan',
          },
        })
      )
    })

    act(() => {
      vi.advanceTimersByTime(20)
    })

    expect(screen.getByText('Notifikasi 1')).toBeDefined()

    // Dismiss first toast
    const closeBtn = screen.getByTitle(/close|tutup/i)
    act(() => {
      fireEvent.click(closeBtn)
    })
    act(() => {
      vi.advanceTimersByTime(350)
    })

    // Second toast appears cleanly
    act(() => {
      vi.advanceTimersByTime(20)
    })
    expect(screen.getByText('Notifikasi 2')).toBeDefined()
  })

  it('does not falsely dismiss on quick tap with micro-movement touch jitter', () => {
    render(
      <MemoryRouter>
        <InAppNotificationToast />
      </MemoryRouter>
    )

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ft-show-toast', {
          detail: {
            title: 'Pinjaman Jatuh Tempo',
            message: 'Tagihan harus dibayar.',
            type: 'loan',
            duration: 4000,
          },
        })
      )
    })

    act(() => {
      vi.advanceTimersByTime(20)
    })

    const alert = screen.getByRole('alert')
    expect(alert).toBeDefined()

    // Simulate quick tap with tiny jitter (dy = -3px in 8ms)
    act(() => {
      fireEvent.touchStart(alert, {
        touches: [{ clientX: 100, clientY: 200 }],
      })
      fireEvent.touchMove(alert, {
        touches: [{ clientX: 101, clientY: 197 }],
      })
      fireEvent.touchEnd(alert, {
        changedTouches: [{ clientX: 101, clientY: 197 }],
      })
    })

    // Alert should NOT be dismissed; remains visible
    expect(screen.getByRole('alert')).toBeDefined()
    expect(screen.getByText('Pinjaman Jatuh Tempo')).toBeDefined()
  })

  it('dismisses toast on upward swipe gesture', () => {
    render(
      <MemoryRouter>
        <InAppNotificationToast />
      </MemoryRouter>
    )

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ft-show-toast', {
          detail: {
            title: 'Peringatan Anggaran',
            message: 'Anggaran mendekati batas.',
            type: 'budget',
            duration: 4000,
          },
        })
      )
    })

    act(() => {
      vi.advanceTimersByTime(20)
    })

    const alert = screen.getByRole('alert')
    expect(alert).toBeDefined()

    // Upward swipe (dy = -50px)
    act(() => {
      fireEvent.touchStart(alert, {
        touches: [{ clientX: 100, clientY: 200 }],
      })
      fireEvent.touchMove(alert, {
        touches: [{ clientX: 100, clientY: 150 }],
      })
      fireEvent.touchEnd(alert, {
        changedTouches: [{ clientX: 100, clientY: 150 }],
      })
    })

    // Dismiss animation begins
    act(() => {
      vi.advanceTimersByTime(350)
    })

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('dismisses toast horizontally on swipe-right gesture', () => {
    render(
      <MemoryRouter>
        <InAppNotificationToast />
      </MemoryRouter>
    )

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ft-show-toast', {
          detail: {
            title: 'Peringatan Utang',
            message: 'Utang baru dicatat.',
            type: 'loan',
            duration: 4000,
          },
        })
      )
    })

    act(() => {
      vi.advanceTimersByTime(20)
    })

    const alert = screen.getByRole('alert')
    expect(alert).toBeDefined()

    // Horizontal swipe right (dx = 80px)
    act(() => {
      fireEvent.touchStart(alert, {
        touches: [{ clientX: 100, clientY: 200 }],
      })
      fireEvent.touchMove(alert, {
        touches: [{ clientX: 180, clientY: 200 }],
      })
      fireEvent.touchEnd(alert, {
        changedTouches: [{ clientX: 180, clientY: 200 }],
      })
    })

    act(() => {
      vi.advanceTimersByTime(350)
    })

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('navigates to /savings when tapping a savings type notification', () => {
    mockNavigate.mockClear()
    render(
      <MemoryRouter>
        <InAppNotificationToast />
      </MemoryRouter>
    )

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ft-show-toast', {
          detail: {
            title: 'Target Tabungan',
            message: 'Target baru telah dibuat.',
            type: 'savings',
            duration: 4000,
          },
        })
      )
    })

    act(() => {
      vi.advanceTimersByTime(20)
    })

    const alert = screen.getByRole('alert')
    act(() => {
      fireEvent.click(alert)
    })

    expect(mockNavigate).toHaveBeenCalledWith('/savings')
  })
})
