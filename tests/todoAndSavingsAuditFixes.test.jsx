// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { parse } from 'date-fns'

describe('TodoList Sorting and Priority Sinking Suite', () => {
  const tieBreak = (a, b) => {
    if (Boolean(a?.completed) !== Boolean(b?.completed)) {
      return a?.completed ? 1 : -1
    }
    const created = Number(b?.createdAt || 0) - Number(a?.createdAt || 0)
    if (created !== 0) return created
    return Number(b?.id || 0) - Number(a?.id || 0)
  }

  const sortTodos = (todos, sortPref) => {
    const next = todos.slice()
    if (sortPref === 'priority') {
      const score = { high: 3, medium: 2, low: 1 }
      next.sort((a, b) => {
        if (Boolean(a?.completed) !== Boolean(b?.completed)) {
          return a?.completed ? 1 : -1
        }
        const prio = (score[b?.priority] || 0) - (score[a?.priority] || 0)
        if (prio !== 0) return prio
        return tieBreak(a, b)
      })
      return next
    }

    if (sortPref === 'due') {
      const dueScore = (x) => {
        if (!x?.dueDate) return Number.POSITIVE_INFINITY
        const d = parse(String(x.dueDate), 'yyyy-MM-dd', new Date())
        return d && Number.isFinite(d.getTime()) ? d.getTime() : Number.POSITIVE_INFINITY
      }
      next.sort((a, b) => {
        if (Boolean(a?.completed) !== Boolean(b?.completed)) {
          return a?.completed ? 1 : -1
        }
        const due = dueScore(a) - dueScore(b)
        if (due !== 0) return due
        return tieBreak(a, b)
      })
      return next
    }

    next.sort((a, b) => tieBreak(a, b))
    return next
  }

  it('sinks completed todos to the bottom in priority sort', () => {
    const list = [
      { id: 1, title: 'Low Incomplete', priority: 'low', completed: false, createdAt: 10 },
      { id: 2, title: 'High Completed', priority: 'high', completed: true, createdAt: 20 },
      { id: 3, title: 'High Incomplete', priority: 'high', completed: false, createdAt: 30 },
      { id: 4, title: 'Medium Completed', priority: 'medium', completed: true, createdAt: 40 },
      { id: 5, title: 'Medium Incomplete', priority: 'medium', completed: false, createdAt: 50 },
    ]

    const sorted = sortTodos(list, 'priority')
    expect(sorted.map(x => x.title)).toEqual([
      'High Incomplete',
      'Medium Incomplete',
      'Low Incomplete',
      'High Completed',
      'Medium Completed',
    ])
  })

  it('sinks completed todos to the bottom in due date sort', () => {
    const list = [
      { id: 1, title: 'Due Today Incomplete', dueDate: '2026-10-03', completed: false, createdAt: 10 },
      { id: 2, title: 'Overdue Completed', dueDate: '2026-10-01', completed: true, createdAt: 20 },
      { id: 3, title: 'Due Tomorrow Incomplete', dueDate: '2026-10-04', completed: false, createdAt: 30 },
      { id: 4, title: 'Due Tomorrow Completed', dueDate: '2026-10-04', completed: true, createdAt: 40 },
      { id: 5, title: 'No Due Incomplete', dueDate: null, completed: false, createdAt: 50 },
    ]

    const sorted = sortTodos(list, 'due')
    expect(sorted.map(x => x.title)).toEqual([
      'Due Today Incomplete',
      'Due Tomorrow Incomplete',
      'No Due Incomplete',
      'Overdue Completed',
      'Due Tomorrow Completed',
    ])
  })

  it('sinks completed todos to the bottom in default created date sort', () => {
    const list = [
      { id: 1, title: 'Older Incomplete', completed: false, createdAt: 100 },
      { id: 2, title: 'Newer Completed', completed: true, createdAt: 300 },
      { id: 3, title: 'Newer Incomplete', completed: false, createdAt: 200 },
      { id: 4, title: 'Older Completed', completed: true, createdAt: 50 },
    ]

    const sorted = sortTodos(list, 'default')
    expect(sorted.map(x => x.title)).toEqual([
      'Newer Incomplete',
      'Older Incomplete',
      'Newer Completed',
      'Older Completed',
    ])
  })
})

describe('Savings Goal Status Transition Logic Suite', () => {
  const computeGoalUpdates = (goal, fundActionType, val) => {
    const isWithdraw = fundActionType === 'withdraw'
    const newGoalAmount = Math.max(0, (goal.currentAmount || 0) + (isWithdraw ? -val : val))
    const target = Number(goal.targetAmount) || 0
    const isNowCompleted = target > 0 && newGoalAmount >= target
    const goalUpdates = {
      currentAmount: newGoalAmount,
    }
    if (!isWithdraw && isNowCompleted) {
      goalUpdates.isCompleted = true
      goalUpdates.status = 'completed'
    } else if (isWithdraw && newGoalAmount < target) {
      goalUpdates.isCompleted = false
      goalUpdates.status = 'active'
    }
    return goalUpdates
  }

  it('marks goal completed when deposit reaches or exceeds target', () => {
    const goal = { currentAmount: 800000, targetAmount: 1000000, status: 'active', isCompleted: false }
    const updates = computeGoalUpdates(goal, 'deposit', 250000)

    expect(updates.currentAmount).toBe(1050000)
    expect(updates.isCompleted).toBe(true)
    expect(updates.status).toBe('completed')
  })

  it('reactivates goal when withdrawal drops current balance below target', () => {
    const goal = { currentAmount: 1000000, targetAmount: 1000000, status: 'completed', isCompleted: true }
    const updates = computeGoalUpdates(goal, 'withdraw', 100000)

    expect(updates.currentAmount).toBe(900000)
    expect(updates.isCompleted).toBe(false)
    expect(updates.status).toBe('active')
  })

  it('keeps goal completed if withdrawal remains above target', () => {
    const goal = { currentAmount: 1500000, targetAmount: 1000000, status: 'completed', isCompleted: true }
    const updates = computeGoalUpdates(goal, 'withdraw', 200000)

    expect(updates.currentAmount).toBe(1300000)
    expect(updates.isCompleted).toBeUndefined()
    expect(updates.status).toBeUndefined()
  })

  it('does not mark goal completed if target is 0 or unset', () => {
    const goal = { currentAmount: 0, targetAmount: 0, status: 'active', isCompleted: false }
    const updates = computeGoalUpdates(goal, 'deposit', 500000)

    expect(updates.currentAmount).toBe(500000)
    expect(updates.isCompleted).toBeUndefined()
    expect(updates.status).toBeUndefined()
  })
})
