import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { format } from 'date-fns'
import { nextDateByFrequency, shouldAutoExecuteRecurring, processRecurringTransactions, notifyTodayEvents } from '../src/lib/automation'
import { db } from '../src/lib/db'

describe('automation - Recurring Transactions Logic', () => {
  it('correctly advances dates according to frequency', () => {
    const base = new Date('2026-03-01T12:00:00')
    const nextDaily = nextDateByFrequency(base, 'daily')
    expect(nextDaily.toISOString().slice(0, 10)).toBe('2026-03-02')

    const nextWeekly = nextDateByFrequency(base, 'weekly')
    expect(nextWeekly.toISOString().slice(0, 10)).toBe('2026-03-08')

    const nextMonthly = nextDateByFrequency(base, 'monthly')
    expect(nextMonthly.toISOString().slice(0, 10)).toBe('2026-04-01')

    const nextYearly = nextDateByFrequency(base, 'yearly')
    expect(nextYearly.toISOString().slice(0, 10)).toBe('2027-03-01')
  })

  it('clamps monthly recurring dates to end-of-month and preserves anchor day', () => {
    const jan31 = new Date(2026, 0, 31, 12, 0, 0)
    const anchorDay = 31

    const febNext = nextDateByFrequency(jan31, 'monthly', anchorDay)
    expect(febNext.getFullYear()).toBe(2026)
    expect(febNext.getMonth()).toBe(1) // February
    expect(febNext.getDate()).toBe(28) // 2026 is not a leap year

    const marNext = nextDateByFrequency(febNext, 'monthly', anchorDay)
    expect(marNext.getFullYear()).toBe(2026)
    expect(marNext.getMonth()).toBe(2) // March
    expect(marNext.getDate()).toBe(31)

    const aprNext = nextDateByFrequency(marNext, 'monthly', anchorDay)
    expect(aprNext.getFullYear()).toBe(2026)
    expect(aprNext.getMonth()).toBe(3) // April
    expect(aprNext.getDate()).toBe(30)
  })

  it('handles leap year feb 29 for yearly recurring with anchorDay', () => {
    const leapFeb29 = new Date(2024, 1, 29, 12, 0, 0)
    const anchorDay = 29

    const year2025 = nextDateByFrequency(leapFeb29, 'yearly', anchorDay)
    expect(year2025.getFullYear()).toBe(2025)
    expect(year2025.getMonth()).toBe(1)
    expect(year2025.getDate()).toBe(28)

    const year2028 = nextDateByFrequency(new Date(2027, 1, 28, 12, 0, 0), 'yearly', anchorDay)
    expect(year2028.getFullYear()).toBe(2028)
    expect(year2028.getMonth()).toBe(1)
    expect(year2028.getDate()).toBe(29) // 2028 is leap year
  })

  it('determines whether an item should auto-execute', () => {
    // Active and autoExecute true or undefined -> true
    expect(shouldAutoExecuteRecurring({ enabled: true, autoExecute: true })).toBe(true)
    expect(shouldAutoExecuteRecurring({ enabled: 1, autoExecute: true })).toBe(true)
    expect(shouldAutoExecuteRecurring({ enabled: true })).toBe(true) // default true for backward compatibility

    // Explicitly set to false (reminder only) -> false
    expect(shouldAutoExecuteRecurring({ enabled: true, autoExecute: false })).toBe(false)

    // Disabled item -> false
    expect(shouldAutoExecuteRecurring({ enabled: false, autoExecute: true })).toBe(false)
    expect(shouldAutoExecuteRecurring({ enabled: 0, autoExecute: true })).toBe(false)
  })

  it('advances nextDate and creates recurring_failed notification when createTransaction fails', async () => {
    await db.recurringTransactions.clear()
    await db.notifications.clear()

    const item = {
      id: 999,
      title: 'Subscription Without Wallet',
      amount: 50000,
      type: 'expense',
      category: 'Subscription',
      frequency: 'monthly',
      startDate: '2026-01-01',
      nextDate: '2026-02-01',
      anchorDay: 1,
      enabled: true,
      autoExecute: true,
      walletId: null,
    }
    await db.recurringTransactions.add(item)

    await processRecurringTransactions(new Date('2026-02-05T12:00:00'))

    const updatedItem = await db.recurringTransactions.get(999)
    expect(updatedItem.nextDate).toBe('2026-03-01')

    const failedNotifs = await db.notifications.where('type').equals('recurring_failed').toArray()
    expect(failedNotifs.length).toBe(1)
    expect(failedNotifs[0].relatedId).toBe(999)
    expect(failedNotifs[0].message).toContain('Dompet wajib dipilih')
  })

  it('skips transaction and creates recurring_failed notification when target wallet is archived', async () => {
    await db.recurringTransactions.clear()
    await db.notifications.clear()
    await db.wallets.clear()
    await db.transactions.clear()

    const archivedWalletId = await db.wallets.add({
      name: 'Archived Wallet',
      currency: 'IDR',
      isArchived: 1,
      balance: 100000,
    })

    const item = {
      id: 888,
      title: 'Bill to Archived Wallet',
      amount: 25000,
      type: 'expense',
      category: 'Utilities',
      frequency: 'monthly',
      startDate: '2026-01-01',
      nextDate: '2026-02-01',
      anchorDay: 1,
      enabled: true,
      autoExecute: true,
      walletId: archivedWalletId,
    }
    await db.recurringTransactions.add(item)

    await processRecurringTransactions(new Date('2026-02-05T12:00:00'))

    const updatedItem = await db.recurringTransactions.get(888)
    expect(updatedItem.nextDate).toBe('2026-03-01')

    const txs = await db.transactions.toArray()
    expect(txs.length).toBe(0)

    const failedNotifs = await db.notifications.where('type').equals('recurring_failed').toArray()
    expect(failedNotifs.length).toBe(1)
    expect(failedNotifs[0].relatedId).toBe(888)
    expect(failedNotifs[0].message).toMatch(/archived or deleted|diarsip atau dihapus/)
  })

  it('preserves earliest overdue nextDate for reminder-only rules (autoExecute: false) until logged or dismissed', async () => {
    await db.recurringTransactions.clear()
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const marker = `fintrack-notified-${todayStr}`
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(marker)
    }

    const item = {
      id: 777,
      title: 'Reminder Only Bill',
      amount: 100000,
      type: 'expense',
      category: 'Tagihan',
      frequency: 'monthly',
      startDate: todayStr,
      nextDate: todayStr,
      anchorDay: parseInt(todayStr.split('-')[2], 10),
      enabled: true,
      autoExecute: false,
    }
    await db.recurringTransactions.add(item)

    await notifyTodayEvents()

    const updated = await db.recurringTransactions.get(777)
    expect(updated.nextDate).toBe(todayStr)
    expect(updated.anchorDay).toBe(item.anchorDay)
  })

  it('prevents concurrent executions via in-memory mutex lock', async () => {
    await db.recurringTransactions.clear()
    await db.wallets.clear()
    await db.transactions.clear()

    const walletId = await db.wallets.add({
      name: 'Test Wallet',
      currency: 'IDR',
      balance: 1000000,
    })

    const item = {
      id: 555,
      title: 'Mutual Fund Investment',
      amount: 100000,
      type: 'expense',
      category: 'Investasi',
      frequency: 'monthly',
      startDate: '2026-03-01',
      nextDate: '2026-03-01',
      anchorDay: 1,
      enabled: true,
      autoExecute: true,
      walletId,
    }
    await db.recurringTransactions.add(item)

    await Promise.all([
      processRecurringTransactions(new Date('2026-03-05T12:00:00')),
      processRecurringTransactions(new Date('2026-03-05T12:00:00')),
      processRecurringTransactions(new Date('2026-03-05T12:00:00')),
    ])

    const txs = await db.transactions.toArray()
    expect(txs.length).toBe(1)
  })
})

