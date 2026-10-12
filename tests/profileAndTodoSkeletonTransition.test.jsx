// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Profile from '../src/pages/Profile'
import TodoList from '../src/pages/TodoList'
import Calendar from '../src/pages/Calendar'

let mockLiveQueryState = {
  txCount: undefined,
  budgetCount: undefined,
  goalsCount: undefined,
  todos: undefined,
  allSubTasks: undefined,
}

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn) => {
    const fnStr = fn.toString()
    if (fnStr.includes('transactions')) return mockLiveQueryState.txCount
    if (fnStr.includes('budgets')) return mockLiveQueryState.budgetCount
    if (fnStr.includes('goals')) return mockLiveQueryState.goalsCount
    if (fnStr.includes('todos')) return mockLiveQueryState.todos
    if (fnStr.includes('sub_tasks')) return mockLiveQueryState.allSubTasks
    return undefined
  },
}))

vi.mock('../src/lib/db', () => ({
  db: {
    transactions: { filter: () => ({ count: () => Promise.resolve(0) }) },
    budgets: { count: () => Promise.resolve(0) },
    goals: { filter: () => ({ count: () => Promise.resolve(0) }) },
    todos: {
      orderBy: () => ({ reverse: () => ({ toArray: () => Promise.resolve([]) }) }),
      where: () => ({ equals: () => ({ delete: () => Promise.resolve() }) }),
      delete: () => Promise.resolve(),
      add: () => Promise.resolve(1),
    },
    sub_tasks: {
      toArray: () => Promise.resolve([]),
      where: () => ({ equals: () => ({ delete: () => Promise.resolve() }) }),
    },
    habits: {
      orderBy: () => ({ reverse: () => ({ toArray: () => Promise.resolve([]) }) }),
      add: () => Promise.resolve(1),
    },
    habitLogs: {
      where: () => ({ equals: () => ({ toArray: () => Promise.resolve([]) }) }),
      toArray: () => Promise.resolve([]),
    },
    transaction: async (_mode, _tables, fn) => fn(),
  },
}))

vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
  hapticImpact: vi.fn(),
  hapticSuccess: vi.fn(),
  hapticWarning: vi.fn(),
  hapticError: vi.fn(),
  hapticSelection: vi.fn(),
}))

describe('Profile and TodoList SkeletonTransition Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockLiveQueryState = {
      txCount: undefined,
      budgetCount: undefined,
      goalsCount: undefined,
      todos: undefined,
      allSubTasks: undefined,
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  describe('Profile Page SkeletonTransition', () => {
    it('renders profile skeleton while Dexie queries are undefined', () => {
      mockLiveQueryState.txCount = undefined
      mockLiveQueryState.budgetCount = undefined
      mockLiveQueryState.goalsCount = undefined

      const { container } = render(
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      )

      // Skeleton should be visible with role="status"
      const statusElement = container.querySelector('[role="status"]')
      expect(statusElement).not.toBeNull()
      expect(statusElement.getAttribute('aria-busy')).toBe('true')

      // Skeleton-specific elements from ProfileSkeleton
      const avatarCircle = container.querySelector('.h-\\[88px\\].w-\\[88px\\]')
      expect(avatarCircle).not.toBeNull()

      // Real live content should NOT be rendered yet
      expect(screen.queryByText(/Akun Anonim|Google •|Email •/)).toBeNull()
    })

    it('cross-dissolves to profile content when queries resolve and displays counts', () => {
      mockLiveQueryState.txCount = undefined
      mockLiveQueryState.budgetCount = undefined
      mockLiveQueryState.goalsCount = undefined

      const { container, rerender } = render(
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      )

      expect(container.querySelector('[role="status"]')).not.toBeNull()

      // Resolve queries with mock data
      mockLiveQueryState.txCount = 14
      mockLiveQueryState.budgetCount = 3
      mockLiveQueryState.goalsCount = 2

      rerender(
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      )

      // Content wrapper should now have ft-content-loaded class and not be gated by opacity-0
      const contentWrapper = container.querySelector('.ft-content-loaded')
      expect(contentWrapper).not.toBeNull()
      const motionPage = container.querySelector('.ft-motion-page')
      expect(motionPage.className).not.toContain('opacity-0')

      // Transition leaving overlay is present synchronously on render
      expect(container.querySelector('.ft-skeleton-leaving')).not.toBeNull()

      // Stat cards display resolved counts
      expect(screen.getByText('14')).toBeDefined()
      expect(screen.getByText('3')).toBeDefined()
      expect(screen.getByText('2')).toBeDefined()

      // Advance timer by 250ms (transition ends at 240ms)
      act(() => {
        vi.advanceTimersByTime(250)
      })

      // Exiting skeleton overlay is cleanly removed
      expect(container.querySelector('.ft-skeleton-leaving')).toBeNull()
    })

    it('handles 0 counts gracefully without flickering back to skeleton', () => {
      mockLiveQueryState.txCount = 0
      mockLiveQueryState.budgetCount = 0
      mockLiveQueryState.goalsCount = 0

      render(
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      )

      // When resolved as 0, 0 is not undefined, so isDataReady is true
      const zeroes = screen.getAllByText('0')
      expect(zeroes.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('TodoList Page SkeletonTransition', () => {
    it('renders todo skeleton while todos and subtasks queries are undefined', () => {
      mockLiveQueryState.todos = undefined
      mockLiveQueryState.allSubTasks = undefined

      const { container } = render(
        <MemoryRouter>
          <TodoList />
        </MemoryRouter>
      )

      // Skeleton should be visible with role="status"
      const statusElement = container.querySelector('[role="status"]')
      expect(statusElement).not.toBeNull()
      expect(statusElement.getAttribute('aria-busy')).toBe('true')

      // Should have 4 skeleton card placeholders from TodoSkeleton
      const todoSkeletonCards = container.querySelectorAll('.ft-skeleton-card')
      expect(todoSkeletonCards.length).toBe(4)

      // Real live EmptyState or TodoItemCard should NOT be mounted yet
      expect(screen.queryByText('Tidak ada tugas')).toBeNull()
    })

    it('cross-dissolves to todo content when queries resolve to empty array', () => {
      mockLiveQueryState.todos = undefined
      mockLiveQueryState.allSubTasks = undefined

      const { container, rerender } = render(
        <MemoryRouter>
          <TodoList />
        </MemoryRouter>
      )

      expect(container.querySelector('[role="status"]')).not.toBeNull()

      // Resolve queries
      mockLiveQueryState.todos = []
      mockLiveQueryState.allSubTasks = []

      rerender(
        <MemoryRouter>
          <TodoList />
        </MemoryRouter>
      )

      // Content wrapper should now have ft-content-loaded class and not be gated by opacity-0
      expect(container.querySelector('.ft-content-loaded')).not.toBeNull()
      const motionPage = container.querySelector('.ft-motion-page')
      expect(motionPage.className).not.toContain('opacity-0')

      // Transition leaving overlay is present synchronously on render
      expect(container.querySelector('.ft-skeleton-leaving')).not.toBeNull()

      // Empty state is rendered
      expect(screen.getByText(/No tasks found|Tidak ada tugas/)).toBeDefined()

      // Advance timer by 250ms
      act(() => {
        vi.advanceTimersByTime(250)
      })

      // Exiting skeleton overlay is cleanly removed
      expect(container.querySelector('.ft-skeleton-leaving')).toBeNull()
    })

    it('cross-dissolves to todo items when queries resolve with todo items', () => {
      mockLiveQueryState.todos = [
        {
          id: 1,
          title: 'Beli Kebutuhan Bulanan',
          completed: false,
          priority: 'high',
          createdAt: Date.now(),
        },
      ]
      mockLiveQueryState.allSubTasks = []

      render(
        <MemoryRouter>
          <TodoList />
        </MemoryRouter>
      )

      expect(screen.getByText('Beli Kebutuhan Bulanan')).toBeDefined()
    })
  })

  describe('Calendar Entrance Consistency', () => {
    it('mounts immediately visible without opacity-0 entrance gate', () => {
      const { container } = render(
        <MemoryRouter>
          <Calendar />
        </MemoryRouter>
      )
      const motionPage = container.querySelector('.ft-motion-page')
      expect(motionPage).not.toBeNull()
      expect(motionPage.className).not.toContain('opacity-0')
    })
  })
})
