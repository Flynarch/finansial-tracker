// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TodoList from '../src/pages/TodoList'

// Mock dexie queries
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => [],
}))

vi.mock('../src/lib/db', () => ({
  db: {
    todos: {
      orderBy: () => ({ reverse: () => ({ toArray: async () => [] }) }),
      where: () => ({ equals: () => ({ delete: async () => {} }) }),
      delete: async () => {},
      add: async () => 1,
    },
    sub_tasks: {
      toArray: async () => [],
      where: () => ({ equals: () => ({ delete: async () => {} }) }),
    },
    habits: {
      orderBy: () => ({ reverse: () => ({ toArray: async () => [] }) }),
      add: async () => 1,
    },
    habitLogs: {
      where: () => ({ equals: () => ({ toArray: async () => [] }) }),
      toArray: async () => [],
    },
    transaction: async (mode, tables, fn) => fn(),
  },
}))

describe('Activity Tab (Aktivitas) Button Sizing & Layout Spacing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders task add button and habit add button with identical dimensions (w-24 min-w-[96px] h-11)', () => {
    // Render in default (Tasks) tab
    const { container, rerender } = render(
      <MemoryRouter initialEntries={['/todos']}>
        <TodoList />
      </MemoryRouter>
    )

    const header = container.querySelector('header')
    expect(header).not.toBeNull()
    const taskAddBtn = header.querySelector('button')
    expect(taskAddBtn).not.toBeNull()
    expect(taskAddBtn.className).toContain('w-24')
    expect(taskAddBtn.className).toContain('min-w-[96px]')
    expect(taskAddBtn.className).toContain('h-11')

    // Rerender in Habits tab (?tab=habits)
    rerender(
      <MemoryRouter initialEntries={['/todos?tab=habits']}>
        <TodoList />
      </MemoryRouter>
    )

    const habitHeader = container.querySelector('header')
    expect(habitHeader).not.toBeNull()
    const habitAddBtn = habitHeader.querySelector('button')
    expect(habitAddBtn).not.toBeNull()
    expect(habitAddBtn.className).toContain('w-24')
    expect(habitAddBtn.className).toContain('min-w-[96px]')
    expect(habitAddBtn.className).toContain('h-11')
  })

  it('renders spacious bottom margin on segmented control to provide breathing room for the content below', () => {
    render(
      <MemoryRouter initialEntries={['/todos']}>
        <TodoList />
      </MemoryRouter>
    )

    const habitsTabBtn = screen.getByRole('button', { name: 'Habits' })
    const segmentedControl = habitsTabBtn.parentElement
    expect(segmentedControl).not.toBeNull()
    expect(segmentedControl.className).toContain('mb-3')
  })
})
