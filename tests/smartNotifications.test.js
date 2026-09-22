import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_ACTION_TYPES,
  NOTIFICATION_IDS,
  FINTRACK_NOTIFICATION_COLOR,
  NOTIFICATION_LARGE_ICON,
  NOTIFICATION_SMALL_ICON,
  initNotificationActionTypes,
  initNotificationChannels,
  syncDailyReminderSchedule,
  snoozeDailyReminder,
  registerNotificationTapListener,
  sendTestNotification,
} from '../src/lib/smartNotifications'
import { LocalNotifications } from '@capacitor/local-notifications'
import { db } from '../src/lib/db'

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
  },
}))

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    createChannel: vi.fn().mockResolvedValue(undefined),
    registerActionTypes: vi.fn().mockResolvedValue(undefined),
    schedule: vi.fn().mockResolvedValue({ notifications: [] }),
    cancel: vi.fn().mockResolvedValue(undefined),
    checkPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
    requestPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
    addListener: vi.fn(),
  },
}))

vi.mock('../src/lib/db', () => ({
  db: {
    todos: {
      update: vi.fn().mockResolvedValue(1),
    },
  },
}))

describe('smartNotifications - Constants & Design Tokens', () => {
  it('defines valid Android notification channel keys', () => {
    expect(NOTIFICATION_CHANNELS.DAILY_REMINDER).toBe('fintrack_daily_reminder')
    expect(NOTIFICATION_CHANNELS.BUDGET_ALERTS).toBe('fintrack_budget_alerts')
    expect(NOTIFICATION_CHANNELS.BILL_REMINDERS).toBe('fintrack_bill_reminders')
  })

  it('defines valid Notification Action Type keys', () => {
    expect(NOTIFICATION_ACTION_TYPES.DAILY_REMINDER).toBe('DAILY_REMINDER_ACTIONS')
    expect(NOTIFICATION_ACTION_TYPES.BUDGET_ALERT).toBe('BUDGET_ALERT_ACTIONS')
    expect(NOTIFICATION_ACTION_TYPES.BILL_REMINDER).toBe('BILL_REMINDER_ACTIONS')
  })

  it('defines valid Notification IDs', () => {
    expect(NOTIFICATION_IDS.DAILY_REMINDER).toBe(99901)
    expect(NOTIFICATION_IDS.DAILY_REMINDER_SNOOZE).toBe(99902)
    expect(NOTIFICATION_IDS.BUDGET_ALERT_BASE).toBe(99800)
    expect(NOTIFICATION_IDS.BILL_REMINDER_BASE).toBe(99700)
  })

  it('uses FinTrack brand accent sage token #6B7C5E instead of raw neon hex', () => {
    expect(FINTRACK_NOTIFICATION_COLOR).toBe('#6B7C5E')
  })

  it('defines valid Android small and large icon drawable resources', () => {
    expect(NOTIFICATION_SMALL_ICON).toBe('ic_stat_fintrack')
    expect(NOTIFICATION_LARGE_ICON).toBe('ic_fintrack_large')
  })
})

describe('smartNotifications - Channel & Action Registration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers notification action types with quick action buttons', async () => {
    await initNotificationActionTypes()
    expect(LocalNotifications.registerActionTypes).toHaveBeenCalledTimes(1)
    const callArg = LocalNotifications.registerActionTypes.mock.calls[0][0]
    expect(callArg.types).toBeDefined()
    expect(callArg.types.length).toBe(3)

    const dailyAction = callArg.types.find((t) => t.id === NOTIFICATION_ACTION_TYPES.DAILY_REMINDER)
    expect(dailyAction).toBeDefined()
    expect(dailyAction.actions.some((a) => a.id === 'quick_add')).toBe(true)
    expect(dailyAction.actions.some((a) => a.id === 'snooze_1h')).toBe(true)

    const budgetAction = callArg.types.find((t) => t.id === NOTIFICATION_ACTION_TYPES.BUDGET_ALERT)
    expect(budgetAction).toBeDefined()
    expect(budgetAction.actions.some((a) => a.id === 'view_budget')).toBe(true)

    const billAction = callArg.types.find((t) => t.id === NOTIFICATION_ACTION_TYPES.BILL_REMINDER)
    expect(billAction).toBeDefined()
    expect(billAction.actions.some((a) => a.id === 'mark_paid')).toBe(true)
    expect(billAction.actions.some((a) => a.id === 'view_details')).toBe(true)
  })

  it('initializes Android channels with correct importance levels and security visibility', async () => {
    await initNotificationChannels()
    expect(LocalNotifications.createChannel).toHaveBeenCalledTimes(3)

    const channels = LocalNotifications.createChannel.mock.calls.map((c) => c[0])
    const dailyChannel = channels.find((c) => c.id === NOTIFICATION_CHANNELS.DAILY_REMINDER)
    const budgetChannel = channels.find((c) => c.id === NOTIFICATION_CHANNELS.BUDGET_ALERTS)
    const billChannel = channels.find((c) => c.id === NOTIFICATION_CHANNELS.BILL_REMINDERS)

    expect(dailyChannel.importance).toBe(4) // High
    expect(dailyChannel.visibility).toBe(1) // Public

    expect(budgetChannel.importance).toBe(5) // Max for heads-up alert
    expect(billChannel.importance).toBe(4) // High
  })
})

describe('smartNotifications - Schedule & BigTextStyle Formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('schedules daily reminder with 3-line expandable BigTextStyle and exact alarm flag', async () => {
    await syncDailyReminderSchedule(true, '21:00')

    expect(LocalNotifications.cancel).toHaveBeenCalled()
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1)

    const payload = LocalNotifications.schedule.mock.calls[0][0].notifications[0]
    expect(payload.id).toBe(NOTIFICATION_IDS.DAILY_REMINDER)
    expect(payload.channelId).toBe(NOTIFICATION_CHANNELS.DAILY_REMINDER)
    expect(payload.actionTypeId).toBe(NOTIFICATION_ACTION_TYPES.DAILY_REMINDER)
    expect(payload.smallIcon).toBe('ic_stat_fintrack')
    expect(payload.largeIcon).toBe('ic_fintrack_large')
    expect(payload.iconColor).toBe('#6B7C5E')
    expect(payload.schedule.allowWhileIdle).toBe(true)
    expect(payload.summaryText).toBeDefined()
    expect(payload.largeBody).toBeDefined()

    // Verify clean, concise format without bullet point clutter
    expect(payload.largeBody).toBeDefined()
    expect(payload.largeBody).not.toContain('•')
  })

  it('schedules snooze reminder for 1 hour with correct ID and action buttons', async () => {
    const success = await snoozeDailyReminder(1)
    expect(success).toBe(true)
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1)

    const payload = LocalNotifications.schedule.mock.calls[0][0].notifications[0]
    expect(payload.id).toBe(NOTIFICATION_IDS.DAILY_REMINDER_SNOOZE)
    expect(payload.channelId).toBe(NOTIFICATION_CHANNELS.DAILY_REMINDER)
    expect(payload.actionTypeId).toBe(NOTIFICATION_ACTION_TYPES.DAILY_REMINDER)
    expect(payload.smallIcon).toBe('ic_stat_fintrack')
    expect(payload.largeIcon).toBe('ic_fintrack_large')
    expect(payload.iconColor).toBe('#6B7C5E')
    expect(payload.schedule.allowWhileIdle).toBe(true)
  })

  it('schedules test notification with complete branding assets and clean formatting', async () => {
    const success = await sendTestNotification()
    expect(success).toBe(true)
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1)

    const payload = LocalNotifications.schedule.mock.calls[0][0].notifications[0]
    expect(payload.smallIcon).toBe('ic_stat_fintrack')
    expect(payload.largeIcon).toBe('ic_fintrack_large')
    expect(payload.iconColor).toBe('#6B7C5E')
    expect(payload.title).toContain('FinTrack')
    expect(payload.largeBody).toBeDefined()
    expect(payload.largeBody).not.toContain('•')
    expect(payload.summaryText).toBeDefined()
  })
})

describe('smartNotifications - Tap & Action Listener Routing', () => {
  it('registers listener and dispatches quick_add action', async () => {
    let capturedHandler = null
    LocalNotifications.addListener.mockImplementation((eventName, handler) => {
      capturedHandler = handler
      return Promise.resolve({ remove: vi.fn() })
    })

    const mockCallback = vi.fn()
    registerNotificationTapListener(mockCallback)

    expect(capturedHandler).not.toBeNull()

    // Simulate clicking "+ Catat Cepat" button
    await capturedHandler({
      actionId: 'quick_add',
      notification: { id: 101, extra: { route: 'fintrack://quick-add' } },
    })

    expect(mockCallback).toHaveBeenCalledWith('/quick-add', 'quick_add', expect.any(Object))
  })

  it('dispatches view_budget action directly to /budget', async () => {
    let capturedHandler = null
    LocalNotifications.addListener.mockImplementation((eventName, handler) => {
      capturedHandler = handler
      return Promise.resolve({ remove: vi.fn() })
    })

    const mockCallback = vi.fn()
    registerNotificationTapListener(mockCallback)

    await capturedHandler({
      actionId: 'view_budget',
      notification: { id: 102, extra: { route: '/budget' } },
    })

    expect(mockCallback).toHaveBeenCalledWith('/budget', 'view_budget', expect.any(Object))
  })

  it('dispatches mark_paid action and normalizes route', async () => {
    let capturedHandler = null
    LocalNotifications.addListener.mockImplementation((eventName, handler) => {
      capturedHandler = handler
      return Promise.resolve({ remove: vi.fn() })
    })

    const mockCallback = vi.fn()
    registerNotificationTapListener(mockCallback)

    await capturedHandler({
      actionId: 'mark_paid',
      notification: { id: 103, extra: { route: 'fintrack://todos/45', todoId: 45, type: 'todo' } },
    })

    expect(mockCallback).toHaveBeenCalledWith('/todos/45', 'mark_paid', expect.any(Object))
    expect(db.todos.update).toHaveBeenCalledWith(45, {
      completed: 1,
      completedAt: expect.any(String),
    })
  })

  it('deduplicates rapid duplicate action dispatches', async () => {
    let capturedHandler = null
    LocalNotifications.addListener.mockImplementation((eventName, handler) => {
      capturedHandler = handler
      return Promise.resolve({ remove: vi.fn() })
    })

    const mockCallback = vi.fn()
    registerNotificationTapListener(mockCallback)

    const payload = {
      actionId: 'view_details',
      notification: { id: 104, extra: { route: '/loans' } },
    }

    await capturedHandler(payload)
    await capturedHandler(payload) // Immediate duplicate

    expect(mockCallback).toHaveBeenCalledTimes(1)
  })

  it('dispatches default card tap with route normalized from extra', async () => {
    let capturedHandler = null
    LocalNotifications.addListener.mockImplementation((eventName, handler) => {
      capturedHandler = handler
      return Promise.resolve({ remove: vi.fn() })
    })

    const mockCallback = vi.fn()
    registerNotificationTapListener(mockCallback)

    await capturedHandler({
      actionId: 'tap',
      notification: { id: 105, extra: { route: 'fintrack://loans' } },
    })

    expect(mockCallback).toHaveBeenCalledWith('/loans', 'tap', expect.any(Object))
  })
})

describe('smartNotifications - Branding & Locale Parity Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('guarantees complete bilingual parity for all notification keys with zero missing keys', async () => {
    const idLocale = (await import('../src/locales/id.js')).default
    const enLocale = (await import('../src/locales/en.js')).default

    const notificationKeys = Object.keys(idLocale).filter((k) => k.startsWith('notifications.') || k.startsWith('todo.notif.'))
    expect(notificationKeys.length).toBeGreaterThan(15)

    for (const key of notificationKeys) {
      expect(enLocale[key], `Missing English translation for ${key}`).toBeDefined()
      expect(typeof enLocale[key]).toBe('string')
      expect(enLocale[key].length).toBeGreaterThan(0)
    }
  })

  it('enforces repository rule of zero system emojis in all notification strings', async () => {
    const idLocale = (await import('../src/locales/id.js')).default
    const enLocale = (await import('../src/locales/en.js')).default
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

    const checkLocales = [idLocale, enLocale]
    for (const loc of checkLocales) {
      for (const [key, val] of Object.entries(loc)) {
        if (key.startsWith('notifications.') || key.startsWith('todo.notif.')) {
          expect(emojiRegex.test(val), `Emoji found in ${key}: "${val}"`).toBe(false)
        }
      }
    }
  })

  it('schedules clean non-redundant title for daily cash flow review on native Android', async () => {
    await syncDailyReminderSchedule(true, '20:00')
    const payload = LocalNotifications.schedule.mock.calls[0][0].notifications[0]
    expect(payload.title).not.toMatch(/^FinTrack\s*•/i)
    expect(['Catat Pengeluaran', 'Evaluasi Arus Kas Harian', 'Daily Financial Check-in', 'Log Expenses']).toContain(payload.title)
  })
})

