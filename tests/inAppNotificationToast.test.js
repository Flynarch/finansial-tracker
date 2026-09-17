import { describe, it, expect } from 'vitest'
import id from '../src/locales/id'
import en from '../src/locales/en'

describe('InAppNotificationToast & System Notification i18n Verification', () => {
  it('contains all required notification keys in id.js and en.js', () => {
    const requiredKeys = [
      'notifications.toastBadgeNew',
      'notifications.defaultTitle',
      'notifications.fallbackTitle',
      'notifications.snoozedTitle',
      'notifications.snoozedBody',
      'notifications.channelDailyName',
      'notifications.channelDailyDesc',
      'notifications.channelBudgetName',
      'notifications.channelBudgetDesc',
      'notifications.channelBillName',
      'notifications.channelBillDesc',
      'notifications.actionQuickAddBtn',
      'notifications.actionSnooze1hBtn',
      'notifications.actionViewBudgetBtn',
      'notifications.actionViewDetailsBtn',
      'notifications.actionMarkPaidBtn',
      'notifications.markedPaidSuccess',
      'notifications.dailyReminderHeader',
      'notifications.dailyReminderHeadline',
      'notifications.dailyReminderInsight',
      'notifications.budgetExceededHeader',
      'notifications.budgetExceededHeadline',
      'notifications.budgetExceededInsight',
      'notifications.budgetWarningHeader',
      'notifications.budgetWarningHeadline',
      'notifications.budgetWarningInsight',
      'notifications.billReminderHeader',
      'notifications.billReminderHeadline',
      'notifications.billReminderInsight',
    ]

    for (const key of requiredKeys) {
      expect(id[key], `Missing Indonesian key: ${key}`).toBeDefined()
      expect(en[key], `Missing English key: ${key}`).toBeDefined()
      expect(id[key].length).toBeGreaterThan(0)
      expect(en[key].length).toBeGreaterThan(0)
    }
  })

  it('ensures notification badge is strictly localized without hardcoded values', () => {
    expect(id['notifications.toastBadgeNew']).toBe('Baru')
    expect(en['notifications.toastBadgeNew']).toBe('New')
  })

  it('ensures action buttons are clean plain text without emojis', () => {
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
    expect(emojiRegex.test(id['notifications.actionQuickAddBtn'])).toBe(false)
    expect(emojiRegex.test(id['notifications.actionSnooze1hBtn'])).toBe(false)
    expect(emojiRegex.test(id['notifications.actionViewBudgetBtn'])).toBe(false)
    expect(emojiRegex.test(id['notifications.actionMarkPaidBtn'])).toBe(false)
    expect(emojiRegex.test(id['notifications.markedPaidSuccess'])).toBe(false)
    expect(emojiRegex.test(en['notifications.actionQuickAddBtn'])).toBe(false)
    expect(emojiRegex.test(en['notifications.actionSnooze1hBtn'])).toBe(false)
    expect(emojiRegex.test(en['notifications.actionViewBudgetBtn'])).toBe(false)
    expect(emojiRegex.test(en['notifications.actionMarkPaidBtn'])).toBe(false)
    expect(emojiRegex.test(en['notifications.markedPaidSuccess'])).toBe(false)
  })

  it('correctly sorts mixed ISO date string and numeric epoch timestamps without NaN failures', () => {
    const toTimestamp = (val) => {
      if (!val) return 0
      if (typeof val === 'number') return val
      const t = new Date(val).getTime()
      return isNaN(t) ? 0 : t
    }

    const items = [
      { id: 1, createdAt: '2026-09-17T10:00:00.000Z' },
      { id: 2, createdAt: 1773750000000 },
      { id: 3, createdAt: '2026-09-17T12:00:00.000Z' },
    ]

    const sorted = [...items].sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt))
    expect(sorted.map((i) => i.id)).toBeDefined()
    expect(toTimestamp(sorted[0].createdAt)).toBeLessThanOrEqual(toTimestamp(sorted[1].createdAt))
    expect(toTimestamp(sorted[1].createdAt)).toBeLessThanOrEqual(toTimestamp(sorted[2].createdAt))
  })
})
