import { describe, it, expect } from 'vitest'
import { toSafeNumber } from '../src/lib/utils'

describe('AI Chat Generative Widgets Logic', () => {
  describe('Budget Status Calculations', () => {
    it('correctly determines safe budget status (< 75%)', () => {
      const limit = 1000000
      const spent = 500000
      const numLimit = toSafeNumber(limit)
      const numSpent = toSafeNumber(spent)
      const percentage = numLimit > 0 ? Math.min(Math.round((numSpent / numLimit) * 100), 999) : 0
      const remaining = Math.max(0, numLimit - numSpent)
      const isOverbudget = numSpent > numLimit
      const isNearLimit = percentage >= 75 && !isOverbudget

      expect(percentage).toBe(50)
      expect(remaining).toBe(500000)
      expect(isOverbudget).toBe(false)
      expect(isNearLimit).toBe(false)
    })

    it('correctly determines near limit status (>= 75% and <= 100%)', () => {
      const limit = 1000000
      const spent = 850000
      const numLimit = toSafeNumber(limit)
      const numSpent = toSafeNumber(spent)
      const percentage = numLimit > 0 ? Math.min(Math.round((numSpent / numLimit) * 100), 999) : 0
      const remaining = Math.max(0, numLimit - numSpent)
      const isOverbudget = numSpent > numLimit
      const isNearLimit = percentage >= 75 && !isOverbudget

      expect(percentage).toBe(85)
      expect(remaining).toBe(150000)
      expect(isOverbudget).toBe(false)
      expect(isNearLimit).toBe(true)
    })

    it('correctly determines overbudget status (> 100%)', () => {
      const limit = 1000000
      const spent = 1200000
      const numLimit = toSafeNumber(limit)
      const numSpent = toSafeNumber(spent)
      const percentage = numLimit > 0 ? Math.min(Math.round((numSpent / numLimit) * 100), 999) : 0
      const remaining = Math.max(0, numLimit - numSpent)
      const isOverbudget = numSpent > numLimit
      const isNearLimit = percentage >= 75 && !isOverbudget

      expect(percentage).toBe(120)
      expect(remaining).toBe(0)
      expect(isOverbudget).toBe(true)
      expect(isNearLimit).toBe(false)
    })
  })

  describe('Savings Goal Calculations', () => {
    it('calculates savings goal percentage and remaining amount', () => {
      const target = 5000000
      const current = 3500000
      const numTarget = toSafeNumber(target)
      const numCurrent = toSafeNumber(current)
      const percentage = numTarget > 0 ? Math.min(Math.round((numCurrent / numTarget) * 100), 100) : 0
      const remaining = Math.max(0, numTarget - numCurrent)

      expect(percentage).toBe(70)
      expect(remaining).toBe(1500000)
    })

    it('caps savings progress at 100% when goal is exceeded', () => {
      const target = 5000000
      const current = 6000000
      const numTarget = toSafeNumber(target)
      const numCurrent = toSafeNumber(current)
      const percentage = numTarget > 0 ? Math.min(Math.round((numCurrent / numTarget) * 100), 100) : 0
      const remaining = Math.max(0, numTarget - numCurrent)

      expect(percentage).toBe(100)
      expect(remaining).toBe(0)
    })
  })

  describe('Todo Subtasks Checklist Parsing', () => {
    it('normalizes string subtasks to object checklist items', () => {
      const subTasks = ['Beli sayur', 'Beli susu', 'Beli roti']
      const initialItems = subTasks.map((item, idx) => {
        if (typeof item === 'string') {
          return { id: idx, title: item, completed: false }
        }
        return { id: idx, title: item.title || item.name || '', completed: !!item.completed }
      })

      expect(initialItems.length).toBe(3)
      expect(initialItems[0]).toEqual({ id: 0, title: 'Beli sayur', completed: false })
      expect(initialItems[1]).toEqual({ id: 1, title: 'Beli susu', completed: false })
    })

    it('correctly toggles subtask completion', () => {
      const items = [
        { id: 0, title: 'Beli sayur', completed: false },
        { id: 1, title: 'Beli susu', completed: true },
      ]
      const toggled = items.map((it, i) => (i === 0 ? { ...it, completed: !it.completed } : it))
      expect(toggled[0].completed).toBe(true)
      expect(toggled.filter((it) => it.completed).length).toBe(2)
    })
  })
})
