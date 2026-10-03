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

    it('accurately calculates weekly habit streak across multiple ISO weeks (52-week backward loop)', () => {
      const now = new Date()
      const habit = {
        id: 'habit-weekly',
        title: 'Berenang 2x Seminggu',
        frequencyType: 'weekly',
        frequencyValue: 2,
        createdAt: subDays(now, 35).toISOString(),
      }

      // Add 2 logs per week for 4 consecutive weeks
      const logs = []
      for (let w = 0; w < 4; w++) {
        const d1 = subDays(now, w * 7)
        const d2 = subDays(now, w * 7 + 1)
        logs.push({ id: `log-${w}-1`, habitId: 'habit-weekly', date: format(d1, 'yyyy-MM-dd') })
        logs.push({ id: `log-${w}-2`, habitId: 'habit-weekly', date: format(d2, 'yyyy-MM-dd') })
      }

      const stats = calculateHabitStats(habit, logs)
      expect(stats.currentStreak).toBe(4)
      expect(stats.bestStreak).toBe(4)
      expect(stats.totalCompleted).toBe(8)
    })

    it('freezes streak for paused habits during the active pause period without resetting', () => {
      const now = new Date()
      const habit = {
        id: 'habit-paused',
        title: 'Meditasi',
        frequencyType: 'daily',
        isPaused: true,
        createdAt: subDays(now, 20).toISOString(),
      }

      // User paused 3 days ago. 3, 4, 5 days ago were completed (3-day streak).
      // 6 days ago was missed. 7 and 8 days ago were completed.
      const logs = [
        { id: 'p1', habitId: 'habit-paused', date: format(subDays(now, 3), 'yyyy-MM-dd') },
        { id: 'p2', habitId: 'habit-paused', date: format(subDays(now, 4), 'yyyy-MM-dd') },
        { id: 'p3', habitId: 'habit-paused', date: format(subDays(now, 5), 'yyyy-MM-dd') },
        { id: 'p4', habitId: 'habit-paused', date: format(subDays(now, 7), 'yyyy-MM-dd') },
        { id: 'p5', habitId: 'habit-paused', date: format(subDays(now, 8), 'yyyy-MM-dd') },
      ]

      const stats = calculateHabitStats(habit, logs)
      // Paused period (days 0, 1, 2) is skipped, streak of 3 is preserved,
      // and day 6 missed day breaks the streak correctly without merging old days 7 and 8
      expect(stats.currentStreak).toBe(3)
      expect(stats.bestStreak).toBe(3)
    })

    it('freezes streak for paused weekly habits during the pause period', () => {
      const now = new Date()
      const habit = {
        id: 'habit-weekly-paused',
        title: 'Review Finansial',
        frequencyType: 'weekly',
        frequencyValue: 1,
        isPaused: true,
        createdAt: subDays(now, 70).toISOString(),
      }

      // Current week (w=0) and last week (w=1) not completed while paused.
      // Weeks 2 and 3 completed (2-week streak). Week 4 missed.
      const logs = [
        { id: 'wp-1', habitId: 'habit-weekly-paused', date: format(subDays(now, 14), 'yyyy-MM-dd') },
        { id: 'wp-2', habitId: 'habit-weekly-paused', date: format(subDays(now, 21), 'yyyy-MM-dd') },
      ]

      const stats = calculateHabitStats(habit, logs)
      expect(stats.currentStreak).toBe(2)
      expect(stats.bestStreak).toBe(2)
    })

    it('uncaps daily streak search loop beyond 365 days for long-running habits', () => {
      const now = new Date()
      const habit = {
        id: 'habit-long',
        title: 'Minum Air',
        frequencyType: 'daily',
        createdAt: subDays(now, 400).toISOString(),
      }

      // Consecutive 380-day streak
      const logs = []
      for (let i = 0; i < 380; i++) {
        logs.push({ id: `long-${i}`, habitId: 'habit-long', date: format(subDays(now, i), 'yyyy-MM-dd') })
      }

      const stats = calculateHabitStats(habit, logs)
      expect(stats.currentStreak).toBe(380)
      expect(stats.bestStreak).toBe(380)
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
