/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

afterEach(() => {
  cleanup()
})

// Mock dependencies
vi.mock('../src/hooks/useTranslation', () => ({
  default: () => ({
    t: (key, fallback) => fallback || key,
    locale: 'id',
  }),
}))

vi.mock('../src/hooks/useBackButton', () => ({
  default: vi.fn(),
}))

vi.mock('../src/lib/db', () => ({
  db: {
    wallets: {
      toArray: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
    },
    goals: {
      get: vi.fn().mockResolvedValue(null),
      toArray: vi.fn().mockResolvedValue([]),
    },
    todos: {
      get: vi.fn().mockResolvedValue(null),
      toArray: vi.fn().mockResolvedValue([]),
    },
    sub_tasks: {
      where: () => ({
        equals: () => ({
          sortBy: vi.fn().mockResolvedValue([]),
          toArray: vi.fn().mockResolvedValue([]),
        }),
      }),
      toArray: vi.fn().mockResolvedValue([]),
    },
    transactions: {
      where: () => ({
        equals: () => ({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      }),
    },
  },
  computeWalletBalance: vi.fn().mockReturnValue(0),
}))

let mockLiveQueryValue = undefined

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn((fn, deps, defaultVal) => {
    if (mockLiveQueryValue !== undefined) {
      return mockLiveQueryValue
    }
    return defaultVal !== undefined ? defaultVal : undefined
  }),
}))

import AddAccountPage from '../src/pages/AddAccountPage'
import WalletDetailPage from '../src/pages/WalletDetailPage'
import SavingsDetail from '../src/pages/SavingsDetail'
import TodoDetailPage from '../src/pages/TodoDetailPage'

describe('Page Skeleton Loading States QA', () => {
  it('renders PageSkeleton variant="add-account" when wallets are loading (undefined)', () => {
    mockLiveQueryValue = undefined
    const { container } = render(
      <MemoryRouter>
        <AddAccountPage />
      </MemoryRouter>
    )
    const statusEl = screen.getByRole('status')
    expect(statusEl).toBeDefined()
    expect(statusEl.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelectorAll('.ft-skeleton').length).toBeGreaterThanOrEqual(10)
  })

  it('renders PageSkeleton variant="wallet-detail" when wallet is loading (undefined)', () => {
    mockLiveQueryValue = undefined
    const { container } = render(
      <MemoryRouter initialEntries={['/wallet/1']}>
        <Routes>
          <Route path="/wallet/:id" element={<WalletDetailPage />} />
        </Routes>
      </MemoryRouter>
    )
    const statusEl = screen.getByRole('status')
    expect(statusEl).toBeDefined()
    expect(statusEl.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelectorAll('.ft-skeleton').length).toBeGreaterThanOrEqual(5)
  })

  it('renders PageSkeleton variant="savings-detail" when goal is loading (undefined)', () => {
    mockLiveQueryValue = undefined
    const { container } = render(
      <MemoryRouter initialEntries={['/savings/1']}>
        <Routes>
          <Route path="/savings/:id" element={<SavingsDetail />} />
        </Routes>
      </MemoryRouter>
    )
    const statusEl = screen.getByRole('status')
    expect(statusEl).toBeDefined()
    expect(statusEl.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelectorAll('.ft-skeleton').length).toBeGreaterThanOrEqual(5)
  })

  it('renders PageSkeleton variant="todo-detail" when todo is loading (undefined)', () => {
    mockLiveQueryValue = undefined
    const { container } = render(
      <MemoryRouter initialEntries={['/todos/1']}>
        <Routes>
          <Route path="/todos/:id" element={<TodoDetailPage />} />
        </Routes>
      </MemoryRouter>
    )
    const statusEl = screen.getByRole('status')
    expect(statusEl).toBeDefined()
    expect(statusEl.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelectorAll('.ft-skeleton').length).toBeGreaterThanOrEqual(5)
  })
})
