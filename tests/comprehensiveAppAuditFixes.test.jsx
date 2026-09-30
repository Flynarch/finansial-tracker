// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { calculateHabitStats } from '../src/lib/habitStats'
import { getParentRoute } from '../src/lib/navigationHierarchy'
import { backButtonManager } from '../src/lib/backButtonManager'
import { subDays, setHours, setMinutes, format } from 'date-fns'

describe('Comprehensive App Audit Master Fixes Suite', () => {
  describe('Modul 3: Habit Streak & Calendar Day Boundary Calculation', () => {
    it('uses calendar day boundary instead of raw 24h span for daysSinceCreation', () => {
      const now = new Date()
      // Habit created yesterday at 23:00 (e.g. 9 hours ago if checked at 08:00)
      const yesterdayNight = setMinutes(setHours(subDays(now, 1), 23), 0)

      const habit = {
        id: 'habit-101',
        title: 'Buku Finansial',
        frequencyType: 'daily',
        createdAt: yesterdayNight.toISOString(),
      }

      const todayStr = format(now, 'yyyy-MM-dd')
      const yesterdayStr = format(yesterdayNight, 'yyyy-MM-dd')

      // User logged completion on both yesterday and today
      const logs = [
        { id: 'log-1', habitId: 'habit-101', date: yesterdayStr },
        { id: 'log-2', habitId: 'habit-101', date: todayStr },
      ]

      const stats = calculateHabitStats(habit, logs)

      expect(stats.currentStreak).toBe(2)
      expect(stats.bestStreak).toBe(2)
      expect(stats.completionRate).toBe(100)
      expect(stats.totalCompleted).toBe(2)
    })

    it('accurately calculates streak for specific days frequency', () => {
      const now = new Date()
      const dayOfWeek = now.getDay()

      const habit = {
        id: 'habit-102',
        title: 'Olahraga Mingguan',
        frequencyType: 'specific_days',
        frequencyValue: [dayOfWeek],
        createdAt: subDays(now, 7).toISOString(),
      }

      const todayStr = format(now, 'yyyy-MM-dd')
      const logs = [{ id: 'log-3', habitId: 'habit-102', date: todayStr }]

      const stats = calculateHabitStats(habit, logs)
      expect(stats.currentStreak).toBe(1)
      expect(stats.totalCompleted).toBe(1)
    })
  })

  describe('Modul 2 & 5: Hierarchical Navigation & Wallet Route Resolution', () => {
    it('resolves singular /wallet/:id route to /dashboard', () => {
      expect(getParentRoute('/wallet/bca-main-account')).toBe('/dashboard')
      expect(getParentRoute('/wallet/12345')).toBe('/dashboard')
    })

    it('resolves legacy or plural /wallets/:id route to /dashboard', () => {
      expect(getParentRoute('/wallets/cash-wallet')).toBe('/dashboard')
    })

    it('resolves other feature sub-routes to their respective parents', () => {
      expect(getParentRoute('/todos/todo-99')).toBe('/todos')
      expect(getParentRoute('/savings/goal-55')).toBe('/savings')
      expect(getParentRoute('/settings/security')).toBe('/settings')
      expect(getParentRoute('/settings/categories')).toBe('/settings')
      expect(getParentRoute('/settings')).toBe('/profile')
      expect(getParentRoute('/add-account')).toBe('/dashboard')
      expect(getParentRoute('/transactions')).toBe('/dashboard')
      expect(getParentRoute('/reports')).toBe('/dashboard')
    })

    it('returns null for root screens to signal 2-tap app exit', () => {
      expect(getParentRoute('/')).toBeNull()
      expect(getParentRoute('/dashboard')).toBeNull()
      expect(getParentRoute('')).toBeNull()
    })
  })

  describe('Modul 14: LIFO Back Button Stack Registration & Step Transitions', () => {
    it('correctly executes topmost handler and pops it from stack', () => {
      let modalClosed = false
      let stepReset = false

      // Level 1: Modal root close handler
      const unregisterModal = backButtonManager.register(() => {
        modalClosed = true
      })

      // Level 2: Wizard Step 2 back transition handler (PinPad / PatternLock / Mnemonic)
      const unregisterStep2 = backButtonManager.register(() => {
        stepReset = true
      })

      // Press hardware back once -> should trigger step 2 handler first
      const handledFirst = backButtonManager.handleBack()
      expect(handledFirst).toBe(true)
      expect(stepReset).toBe(true)
      expect(modalClosed).toBe(false)

      // Step 2 unregisters itself upon returning to step 1
      unregisterStep2()

      // Press hardware back second time -> should trigger modal close handler
      const handledSecond = backButtonManager.handleBack()
      expect(handledSecond).toBe(true)
      expect(modalClosed).toBe(true)

      unregisterModal()

      // Nothing left in stack
      const handledThird = backButtonManager.handleBack()
      expect(handledThird).toBe(false)
    })
  })
})
