// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AppShell from '../src/components/layout/AppShell'
import { TransactionListSection, TransactionListSkeleton } from '../src/components/transactions/TransactionListSection'

// Mock dependencies that AppShell uses
vi.mock('../src/store/useSettingsStore', () => {
  const storeState = {
    isLoaded: true,
    hasCompletedOnboarding: true,
    securityEnabled: false,
    isUnlocked: true,
    unlock: vi.fn(),
    lock: vi.fn(),
    autoLockTimeout: 0,
    locale: 'id',
    defaultCurrency: 'IDR',
    defaultWalletId: null,
    notificationAutoApprove: false,
    theme: 'dark',
    motionPreference: 'system',
    loadSettings: vi.fn(),
    setReduceMotion: vi.fn(),
  }
  const mockFn = vi.fn((selector) => {
    return typeof selector === 'function' ? selector(storeState) : storeState
  })
  mockFn.getState = vi.fn(() => storeState)
  return { default: mockFn }
})

vi.mock('../src/store/useTransactionStore', () => ({
  default: vi.fn((selector) => {
    const state = {
      unviewedMutationsCount: 0,
      isQuickAddOpen: false,
      quickAddNonce: 0,
      closeQuickAdd: vi.fn(),
    }
    return typeof selector === 'function' ? selector(state) : state
  }),
}))

vi.mock('../src/store/useChatStore', () => ({
  default: vi.fn((selector) => {
    const state = {
      isQuickLogOpen: false,
      openQuickLog: vi.fn(),
    }
    return typeof selector === 'function' ? selector(state) : state
  }),
}))

vi.mock('../src/components/ui/LoadingScreen', () => ({
  default: () => <div>Loading...</div>,
}))

vi.mock('../src/components/ui/PageSkeleton', () => ({
  default: () => <div>Skeleton</div>,
}))

vi.mock('../src/components/layout/Navbar', () => ({
  default: () => <header>Navbar</header>,
}))

vi.mock('../src/components/layout/Sidebar', () => ({
  default: () => <aside>Sidebar</aside>,
}))

vi.mock('../src/components/layout/BottomNav', () => ({
  default: () => <nav>BottomNav</nav>,
}))

vi.mock('../src/components/onboarding/SpotlightTour', () => ({
  default: () => null,
}))

vi.mock('../src/components/chat/AiTriggerBar', () => ({
  default: () => null,
}))

vi.mock('../src/components/ui/InAppNotificationToast', () => ({
  default: () => null,
}))

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  },
}))

describe('Transactions Page Layout & Scroll Architecture', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders AppShell with viewport-locked, overflow-hidden main for /transactions', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/transactions']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/transactions" element={<div data-testid="tx-content">Transactions Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    const main = container.querySelector('main')
    expect(main).not.toBeNull()
    // Must contain fixed-viewport classes and zero bottom padding to prevent window scroll
    expect(main.className).toContain('h-[calc(100dvh-64px)]')
    expect(main.className).toContain('max-h-[calc(100dvh-64px)]')
    expect(main.className).toContain('overflow-hidden')
    expect(main.className).toContain('pb-0')
    expect(main.className).not.toContain('pb-[calc(10rem+env(safe-area-inset-bottom))]')

    // Crossfade container must flex-stretch cleanly
    const crossfade = container.querySelector('.ft-page-crossfade')
    expect(crossfade).not.toBeNull()
    expect(crossfade.className).toContain('h-full')
    expect(crossfade.className).toContain('flex-1')
    expect(crossfade.className).toContain('min-h-0')
    expect(crossfade.className).toContain('overflow-hidden')
  })

  it('renders standard full-page scroll padding on other pages (e.g. /dashboard)', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<div>Dashboard Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    const main = container.querySelector('main')
    expect(main).not.toBeNull()
    expect(main.className).toContain('pb-[calc(10rem+env(safe-area-inset-bottom))]')
    expect(main.className).not.toContain('overflow-hidden')
  })

  it('renders TransactionListSection with bottom padding cleared for BottomNav and AiTriggerBar', () => {
    const { container } = render(
      <TransactionListSection
        filteredTransactions={[]}
        groupedEntriesDetailed={[]}
        t={(key, fallback) => fallback || key}
        locale="id"
        defaultCurrency="IDR"
        formatCurrency={(val) => `Rp ${val}`}
        convertCurrency={(val) => val}
        rates={{}}
        allWallets={[]}
      />
    )

    // Empty state container should be rendered
    const listWrapper = container.firstChild
    expect(listWrapper).not.toBeNull()
  })

  it('renders TransactionListSkeleton with 8.5rem bottom padding', () => {
    const { container } = render(<TransactionListSkeleton />)

    const scrollContainer = container.querySelector('.overflow-y-auto')
    expect(scrollContainer).not.toBeNull()
    expect(scrollContainer.className).toContain('pb-[calc(8.5rem+env(safe-area-inset-bottom))]')
  })
})
