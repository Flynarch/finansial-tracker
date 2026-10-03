import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { parseISO, addDays } from 'date-fns'
import { db } from './db'
import { formatCurrency, toSafeNumber, isExcludeAnalyticsTx } from './utils'
import useSettingsStore from '../store/useSettingsStore'
import { translate } from './i18n'
import {
  calculateBudgetSpent,
  getCurrentBudgetMonthKey,
  getBudgetPeriodDateRange,
  isTxMatchingBudget,
} from './budgetUtils'
import { getCachedCurrencyRates } from './api'
import { formatExpenseCategory } from './expenseCategories'

export const FINTRACK_NOTIFICATION_COLOR = '#6B7C5E'
export const NOTIFICATION_LARGE_ICON = 'ic_fintrack_large'
export const NOTIFICATION_SMALL_ICON = 'ic_stat_fintrack'

export const NOTIFICATION_CHANNELS = {
  DAILY_REMINDER: 'fintrack_daily_reminder',
  BUDGET_ALERTS: 'fintrack_budget_alerts',
  BILL_REMINDERS: 'fintrack_bill_reminders',
}

export const NOTIFICATION_ACTION_TYPES = {
  DAILY_REMINDER: 'DAILY_REMINDER_ACTIONS',
  BUDGET_ALERT: 'BUDGET_ALERT_ACTIONS',
  BILL_REMINDER: 'BILL_REMINDER_ACTIONS',
}

export const NOTIFICATION_IDS = {
  SYSTEM_TEST: 10100,
  DAILY_REMINDER: 99901,
  DAILY_REMINDER_SNOOZE: 99902,
  BUDGET_ALERT_BASE: 99800,
  BILL_REMINDER_BASE: 99700,
}

/**
 * Registers interactive quick action types with localized button titles on Android/iOS.
 */
export async function initNotificationActionTypes() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const locale = useSettingsStore.getState?.()?.locale || 'id'
    const isEn = locale === 'en'

    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: NOTIFICATION_ACTION_TYPES.DAILY_REMINDER,
          actions: [
            {
              id: 'quick_add',
              title: translate(locale, 'notifications.actionQuickAddBtn', isEn ? '+ Log' : '+ Catat'),
            },
            {
              id: 'snooze_1h',
              title: translate(locale, 'notifications.actionSnooze1hBtn', isEn ? 'Snooze 1h' : 'Tunda 1 Jam'),
            },
          ],
        },
        {
          id: NOTIFICATION_ACTION_TYPES.BUDGET_ALERT,
          actions: [
            {
              id: 'view_budget',
              title: translate(locale, 'notifications.actionViewBudgetBtn', isEn ? 'View Budget' : 'Lihat Anggaran'),
            },
          ],
        },
        {
          id: NOTIFICATION_ACTION_TYPES.BILL_REMINDER,
          actions: [
            {
              id: 'mark_paid',
              title: translate(locale, 'notifications.actionMarkPaidBtn', isEn ? 'Mark Paid' : 'Tandai Lunas'),
            },
            {
              id: 'view_details',
              title: translate(locale, 'notifications.actionViewDetailsBtn', isEn ? 'View Details' : 'Buka Detail'),
            },
          ],
        },
      ],
    })
  } catch (err) {
    console.warn('initNotificationActionTypes error:', err)
  }
}

/**
 * Initializes Android notification channels with active language support,
 * proper importance levels (Max=5 for budget breach, High=4 for reminders),
 * and lock screen privacy settings.
 */
export async function initNotificationChannels() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const locale = useSettingsStore.getState?.()?.locale || 'id'
    const isEn = locale === 'en'
    const securityEnabled = Boolean(useSettingsStore.getState?.()?.securityEnabled)
    // 0 = VISIBILITY_PRIVATE (masks sensitive numbers on secure lock screen)
    // 1 = VISIBILITY_PUBLIC
    const sensitiveVisibility = securityEnabled ? 0 : 1

    await initNotificationActionTypes()

    await LocalNotifications.createChannel({
      id: NOTIFICATION_CHANNELS.DAILY_REMINDER,
      name: translate(locale, 'notifications.channelDailyName', isEn ? 'Daily Reminder' : 'Pengingat Harian'),
      description: translate(
        locale,
        'notifications.channelDailyDesc',
        isEn ? 'Daily expense tracking reminder.' : 'Pengingat mencatat pengeluaran harian.'
      ),
      importance: 4, // High
      visibility: 1, // Public (daily reminder contains no sensitive balance data)
      lights: true,
      lightColor: FINTRACK_NOTIFICATION_COLOR,
      vibration: true,
    }).catch((err) => console.warn('[smartNotifications]', err))

    await LocalNotifications.createChannel({
      id: NOTIFICATION_CHANNELS.BUDGET_ALERTS,
      name: translate(locale, 'notifications.channelBudgetName', isEn ? 'Budget Alerts' : 'Peringatan Anggaran'),
      description: translate(
        locale,
        'notifications.channelBudgetDesc',
        isEn ? 'Notifications when spending nears budget limit.' : 'Notifikasi saat pengeluaran mendekati batas anggaran.'
      ),
      importance: 5, // Max (triggers heads-up popdown banner when over limit)
      visibility: sensitiveVisibility,
      lights: true,
      lightColor: '#F43F5E',
      vibration: true,
    }).catch((err) => console.warn('[smartNotifications]', err))

    await LocalNotifications.createChannel({
      id: NOTIFICATION_CHANNELS.BILL_REMINDERS,
      name: translate(locale, 'notifications.channelBillName', isEn ? 'Bill Reminders' : 'Pengingat Tagihan'),
      description: translate(
        locale,
        'notifications.channelBillDesc',
        isEn ? 'Notifications for upcoming bills and recurring items.' : 'Notifikasi tagihan dan pengeluaran rutin.'
      ),
      importance: 4, // High
      visibility: sensitiveVisibility,
      lights: true,
      lightColor: FINTRACK_NOTIFICATION_COLOR,
      vibration: true,
    }).catch((err) => console.warn('[smartNotifications]', err))
  } catch (err) {
    console.warn('initNotificationChannels error:', err)
  }
}

/**
 * Request notification permissions if not already granted.
 */
export async function requestNotificationPermission() {
  try {
    if (Capacitor.isNativePlatform()) {
      const status = await LocalNotifications.checkPermissions()
      if (status.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions()
        return req.display === 'granted'
      }
      return true
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted') {
        const res = await Notification.requestPermission()
        return res === 'granted'
      }
      return true
    }
  } catch (err){
      console.warn('[smartNotifications]', err)
    /* ignore */
    return false
  }
  return false
}

/**
 * Sends an immediate test notification using Capacitor LocalNotifications on Android/iOS,
 * or browser Web Notification on desktop.
 */
export async function sendTestNotification() {
  try {
    const permOk = await requestNotificationPermission()
    if (!permOk) return false

    await initNotificationChannels()
    const locale = useSettingsStore.getState?.()?.locale || 'id'
    const isEn = locale === 'en'

    const title = translate(locale, 'notifications.testNotifTitle', isEn ? 'FinTrack • Test Notification' : 'FinTrack • Tes Notifikasi')
    const body = translate(
      locale,
      'notifications.testNotifBody',
      isEn ? 'FinTrack notifications are active and ready.' : 'Notifikasi FinTrack aktif dan siap digunakan.'
    )
    const largeBody = body

    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: NOTIFICATION_IDS.SYSTEM_TEST,
            title,
            body,
            largeBody,
            summaryText: translate(locale, 'notifications.testNotifSummary', isEn ? 'System Test' : 'Tes Sistem'),
            channelId: NOTIFICATION_CHANNELS.DAILY_REMINDER,
            actionTypeId: NOTIFICATION_ACTION_TYPES.DAILY_REMINDER,
            extra: { route: 'fintrack://quick-add' },
            schedule: { at: new Date(Date.now() + 300) },
            smallIcon: NOTIFICATION_SMALL_ICON,
            largeIcon: NOTIFICATION_LARGE_ICON,
            iconColor: FINTRACK_NOTIFICATION_COLOR,
          },
        ],
      })
      return true
    } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body })
      return true
    }
  } catch (err) {
    console.warn('sendTestNotification error:', err)
  }
  return false
}

/**
 * Cancels all pending notifications scheduled by the application on native platforms.
 */
export async function cancelAllAppNotifications() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const pending = await LocalNotifications.getPending()
    if (pending?.notifications?.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications })
    }
  } catch (err) {
    console.warn('[smartNotifications:cancelAllAppNotifications]', err)
  }
}

/**
 * Schedules or cancels the daily recurring financial logging reminder.
 * @param {boolean} enabled - Whether daily reminder is active
 * @param {string} timeStr - Time string in HH:mm format (default: '20:00')
 */
export async function syncDailyReminderSchedule(enabled = true, timeStr = '20:00') {
  try {
    // 1. Cancel existing daily notification
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.cancel({
        notifications: [{ id: NOTIFICATION_IDS.DAILY_REMINDER }],
      }).catch((err) => console.warn('[smartNotifications]', err))
    }

    if (!enabled) return

    // 2. Request permission
    const hasPerm = await requestNotificationPermission()
    if (!hasPerm) return

    // 3. Calculate target trigger time
    const [hourStr, minStr] = String(timeStr || '20:00').split(':')
    const targetHour = parseInt(hourStr, 10) || 20
    const targetMin = parseInt(minStr, 10) || 0

    const now = new Date()
    let triggerDate = new Date()
    triggerDate.setHours(targetHour, targetMin, 0, 0)
    if (triggerDate <= now) {
      triggerDate = addDays(triggerDate, 1)
    }

    const locale = useSettingsStore.getState?.()?.locale || 'id'
    const isEn = locale === 'en'

    const title = translate(locale, 'notifications.dailyReminderTitle', isEn ? 'Log Expenses' : 'Catat Pengeluaran')
    const body = translate(
      locale,
      'notifications.dailyReminderBody',
      isEn ? 'Have you logged today\'s expenses? Take a minute to check.' : 'Sudah catat pengeluaran hari ini? Yuk luangkan 1 menit.'
    )
    const largeBody = body
    const summaryText = translate(locale, 'notifications.channelDailyName', isEn ? 'Daily Reminder' : 'Pengingat Harian')

    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: NOTIFICATION_IDS.DAILY_REMINDER,
            title,
            body,
            largeBody,
            summaryText,
            channelId: NOTIFICATION_CHANNELS.DAILY_REMINDER,
            actionTypeId: NOTIFICATION_ACTION_TYPES.DAILY_REMINDER,
            extra: { route: 'fintrack://quick-add' },
            schedule: {
              at: triggerDate,
              every: 'day',
              allowWhileIdle: true,
            },
            smallIcon: NOTIFICATION_SMALL_ICON,
            largeIcon: NOTIFICATION_LARGE_ICON,
            iconColor: FINTRACK_NOTIFICATION_COLOR,
          },
        ],
      })
    }
  } catch (err) {
    console.warn('syncDailyReminderSchedule error:', err)
  }
}

/**
 * Snoozes the daily reminder for a specified number of hours (default 1h).
 * @param {number} [hours=1]
 */
export async function snoozeDailyReminder(hours = 1) {
  try {
    if (!Capacitor.isNativePlatform()) return false
    const locale = useSettingsStore.getState?.()?.locale || 'id'
    const isEn = locale === 'en'

    const snoozeDate = new Date(Date.now() + Math.max(1, Number(hours) || 1) * 3600 * 1000)

    const title = translate(locale, 'notifications.snoozeTitle', isEn ? 'Snoozed' : 'Ditunda')
    const body = translate(
      locale,
      'notifications.snoozeBody',
      isEn ? 'Time to log today\'s expenses.' : 'Waktunya mencatat pengeluaran hari ini.'
    )
    const largeBody = body

    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIFICATION_IDS.DAILY_REMINDER_SNOOZE,
          title,
          body,
          largeBody,
          summaryText: translate(locale, 'notifications.channelDailyName', isEn ? 'Daily Reminder' : 'Pengingat Harian'),
          channelId: NOTIFICATION_CHANNELS.DAILY_REMINDER,
          actionTypeId: NOTIFICATION_ACTION_TYPES.DAILY_REMINDER,
          extra: { route: 'fintrack://quick-add' },
          schedule: {
            at: snoozeDate,
            allowWhileIdle: true,
          },
          smallIcon: NOTIFICATION_SMALL_ICON,
          largeIcon: NOTIFICATION_LARGE_ICON,
          iconColor: FINTRACK_NOTIFICATION_COLOR,
        },
      ],
    })
    return true
  } catch (err) {
    console.warn('snoozeDailyReminder error:', err)
    return false
  }
}

/**
 * Checks budget limits after a new expense transaction is recorded.
 * Sends proactive heads-up alert if category expense reaches 80% or exceeds 100%.
 */
export async function checkBudgetAlertsAfterExpense({ category, amount, date }) {
  try {
    const budgetAlertsEnabled = useSettingsStore.getState?.()?.budgetAlertsEnabled
    if (budgetAlertsEnabled === false) return

    if (!category || !amount || Number(amount) <= 0) return

    const budgetCycleStartDay = useSettingsStore.getState?.()?.budgetCycleStartDay || 1
    const defaultCurrency = useSettingsStore.getState?.()?.defaultCurrency || 'IDR'
    const locale = useSettingsStore.getState?.()?.locale || 'id'

    let txDateObj = new Date()
    if (date) {
      const parsed = typeof date === 'string' ? parseISO(date) : new Date(date)
      if (!isNaN(parsed.getTime())) {
        txDateObj = parsed
      }
    }

    const targetMonthKey = getCurrentBudgetMonthKey(txDateObj, budgetCycleStartDay)
    const currentMonthKey = getCurrentBudgetMonthKey(new Date(), budgetCycleStartDay)

    // Find active budgets for this category or parent category or 'all' for the transaction month
    const budgets = await db.budgets.where({ month: targetMonthKey }).toArray()
    const parentCategory = category.includes('/') ? category.split('/')[0] : category

    const matchingBudget =
      budgets.find((b) => b.category === category) ||
      budgets.find((b) => b.category === parentCategory) ||
      budgets.find((b) => isTxMatchingBudget(b.category, category)) ||
      budgets.find((b) => b.category === 'all')

    if (!matchingBudget) return
    const budgetLimit = toSafeNumber(matchingBudget.amount ?? matchingBudget.limit)
    if (budgetLimit <= 0) return

    const budgetCurrency = matchingBudget.currency || defaultCurrency
    const budgetPeriod = getBudgetPeriodDateRange(targetMonthKey, budgetCycleStartDay)

    const periodTxs = await db.transactions
      .filter(
        (t) =>
          !t.deletedAt &&
          typeof t.date === 'string' &&
          t.date >= budgetPeriod.startDate &&
          t.date <= budgetPeriod.endDate &&
          (t.type === 'expense' ||
            (t.isSplit &&
              Array.isArray(t.splitItems) &&
              t.splitItems.some((si) => (si.type || t.type) === 'expense'))) &&
          (t.isPendingReview !== true && t.isPendingReview !== 1) &&
          (t.isSplit ? true : !isExcludeAnalyticsTx(t))
      )
      .toArray()

    const rates = getCachedCurrencyRates('USD')
    const totalSpent = calculateBudgetSpent(matchingBudget.category, periodTxs, budgetCurrency, rates)
    const spentRatio = totalSpent / budgetLimit

    const isEn = locale === 'en'
    const catDisplayName = matchingBudget.category === 'all'
      ? translate(locale, 'notifications.totalBudget', isEn ? 'Total Budget' : 'Total Anggaran')
      : (formatExpenseCategory(matchingBudget.category, locale) || matchingBudget.category)

    const formattedSpent = formatCurrency(totalSpent, budgetCurrency, locale)
    const formattedLimit = formatCurrency(budgetLimit, budgetCurrency, locale)

    let alertTitle = ''
    let alertBody = ''
    let largeBody = ''

    if (spentRatio >= 1.0) {
      alertTitle = translate(locale, 'notifications.budgetExceededTitle', isEn ? 'Budget Limit Exceeded' : 'Batas Anggaran Terlampaui')
      alertBody = translate(
        locale,
        'notifications.budgetExceededBody',
        isEn ? `${catDisplayName}: ${formattedSpent} of ${formattedLimit}.` : `${catDisplayName}: ${formattedSpent} dari ${formattedLimit}.`,
        { category: catDisplayName, spent: formattedSpent, limit: formattedLimit }
      )
      largeBody = alertBody
    } else if (spentRatio >= 0.8) {
      const pct = Math.round(spentRatio * 100)
      alertTitle = translate(
        locale,
        'notifications.budgetWarningTitle',
        isEn ? `Budget Warning (${pct}%)` : `Peringatan Anggaran (${pct}%)`,
        { percent: pct }
      )
      alertBody = translate(
        locale,
        'notifications.budgetWarningBody',
        isEn ? `${catDisplayName}: ${formattedSpent} of ${formattedLimit} (${pct}%).` : `${catDisplayName}: ${formattedSpent} dari ${formattedLimit} (${pct}%).`,
        { category: catDisplayName, percent: pct, spent: formattedSpent, limit: formattedLimit }
      )
      largeBody = alertBody
    }

    if (alertTitle && alertBody) {
      const isDanger = spentRatio >= 1.0
      const inAppTitle = isDanger
        ? translate(locale, 'notifications.budgetExceededInApp', isEn ? 'Budget Exceeded' : 'Budget Jebol!')
        : translate(locale, 'notifications.budgetWarningInApp', isEn ? 'Budget Warning' : 'Peringatan Budget')

      const inAppMessage = isDanger
        ? translate(
            locale,
            'notifications.budgetExceededInAppMsg',
            isEn ? `${catDisplayName} exceeded limit (${Math.round(spentRatio * 100)}%).` : `${catDisplayName} melebihi batas (${Math.round(spentRatio * 100)}%).`,
            { category: catDisplayName, percent: Math.round(spentRatio * 100) }
          )
        : translate(
            locale,
            'notifications.budgetWarningInAppMsg',
            isEn ? `${catDisplayName} almost depleted (${Math.round(spentRatio * 100)}%).` : `${catDisplayName} hampir habis (${Math.round(spentRatio * 100)}%).`,
            { category: catDisplayName, percent: Math.round(spentRatio * 100) }
          )

      if (db?.notifications?.add) {
        try {
          const oneDayAgo = Date.now() - 24 * 3600 * 1000
          const recentNotifs = db.notifications.where
            ? await db.notifications.where('createdAt').above(oneDayAgo).toArray()
            : (db.notifications.orderBy
                ? await db.notifications.orderBy('createdAt').reverse().limit(50).toArray()
                : (db.notifications.toArray ? await db.notifications.toArray() : []))

          const alreadyNotified = recentNotifs.some((n) => {
            if (Date.now() - (n.createdAt || 0) >= 24 * 3600 * 1000) return false
            const isSameLevel = n.type === (isDanger ? 'alert' : 'warning')
            if (!isSameLevel) return false
            const matchesExact = n.title === inAppTitle && n.message === inAppMessage
            const matchesCategory =
              (n.category && n.category === matchingBudget.category) ||
              (typeof n.message === 'string' && n.message.includes(catDisplayName))
            return matchesExact || matchesCategory
          })

          if (!alreadyNotified) {
            await db.notifications.add({
              title: inAppTitle,
              message: inAppMessage,
              category: matchingBudget.category,
              type: isDanger ? 'alert' : 'warning',
              read: false,
              isRead: 0,
              route: '/budget',
              createdAt: Date.now(),
            })
          }
        } catch (notifErr) {
          console.warn('Failed to record in-app budget notification:', notifErr)
        }
      }

      if (targetMonthKey === currentMonthKey) {
        await sendInstantBudgetNotification({
          id: NOTIFICATION_IDS.BUDGET_ALERT_BASE + Math.floor(Math.random() * 100),
          title: alertTitle,
          body: alertBody,
          largeBody,
          summaryText: translate(locale, 'notifications.channelBudgetName', isEn ? 'Budget Alerts' : 'Peringatan Anggaran'),
          route: '/budget',
        })
      }
    }
  } catch (err) {
    console.warn('checkBudgetAlertsAfterExpense error:', err)
  }
}

/**
 * Fires an instant local notification or browser notification.
 */
async function sendInstantBudgetNotification({ id, title, body, largeBody, summaryText, route = '/budget' }) {
  try {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: id || (800000 + (Date.now() % 100000)),
            title,
            body,
            largeBody: largeBody || body,
            summaryText: summaryText || 'FinTrack',
            channelId: NOTIFICATION_CHANNELS.BUDGET_ALERTS,
            actionTypeId: NOTIFICATION_ACTION_TYPES.BUDGET_ALERT,
            extra: { route },
            schedule: { at: new Date(Date.now() + 500) },
            smallIcon: NOTIFICATION_SMALL_ICON,
            largeIcon: NOTIFICATION_LARGE_ICON,
            iconColor: FINTRACK_NOTIFICATION_COLOR,
          },
        ],
      })
    } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title.startsWith('FinTrack') ? title : `FinTrack • ${title}`, { body })
    }
  } catch (err){
      console.warn('[smartNotifications]', err)
    /* ignore */
  }
}

let lastProcessedActionKey = null
let lastProcessedActionTime = 0

/**
 * Sets up tap listeners on native notifications to navigate inside the app or execute quick actions.
 * @param {Function} callback - Route navigation and action handler callback (route, actionId, rawAction)
 */
export function registerNotificationTapListener(callback) {
  if (!Capacitor.isNativePlatform() || typeof callback !== 'function') return () => {}
  try {
    const listenerPromise = LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
      const actionId = action?.actionId
      const extra = action?.notification?.extra || {}
      const rawRoute = extra?.route
      const cleanRoute = rawRoute && typeof rawRoute === 'string'
        ? (rawRoute.startsWith('fintrack://') ? rawRoute.replace(/^fintrack:\/\//, '/') : rawRoute)
        : null

      // Deduplicate identical action dispatches within 1200ms
      const notifId = action?.notification?.id ?? ''
      const actionKey = `${actionId || 'tap'}_${notifId}_${cleanRoute || ''}`
      const now = Date.now()
      if (lastProcessedActionKey === actionKey && now - lastProcessedActionTime < 1200) {
        return
      }
      lastProcessedActionKey = actionKey
      lastProcessedActionTime = now

      if (actionId === 'snooze_1h') {
        snoozeDailyReminder(1).catch((err) => console.warn('[smartNotifications]', err))
        if (typeof window !== 'undefined') {
          const locale = useSettingsStore.getState?.()?.locale || 'id'
          const isEn = locale === 'en'
          window.dispatchEvent(
            new CustomEvent('ft-show-toast', {
              detail: {
                title: translate(locale, 'notifications.snoozedTitle', isEn ? 'Snoozed 1 Hour' : 'Ditunda 1 Jam'),
                message: translate(
                  locale,
                  'notifications.snoozedBody',
                  isEn ? 'Reminder will ring again in 1 hour.' : 'Pengingat akan aktif kembali dalam 1 jam.'
                ),
                type: 'todo',
              },
            })
          )
        }
      } else if (actionId === 'mark_paid') {
        // Handle marking commitment or todo paid/completed
        try {
          if (extra.type === 'todo' && extra.todoId) {
            const tid = Number(extra.todoId)
            await db.todos.update(tid, {
              completed: 1,
              completedAt: new Date().toISOString(),
            })
            if (Capacitor.isNativePlatform()) {
              await LocalNotifications.cancel({
                notifications: [{ id: 100000 + tid * 10 + 1 }, { id: 100000 + tid * 10 + 2 }],
              }).catch(() => {})
            }
          }
          if (typeof window !== 'undefined') {
            const locale = useSettingsStore.getState?.()?.locale || 'id'
            const isEn = locale === 'en'
            window.dispatchEvent(
              new CustomEvent('ft-show-toast', {
                detail: {
                  title: translate(locale, 'notifications.actionMarkPaidBtn', isEn ? 'Mark Paid' : 'Tandai Lunas'),
                  message: translate(
                    locale,
                    'notifications.markedPaidSuccess',
                    isEn ? 'Marked as paid.' : 'Berhasil ditandai lunas.'
                  ),
                  type: 'success',
                },
              })
            )
          }
        } catch (err) {
          console.warn('Failed to mark commitment paid:', err)
        }
        callback(cleanRoute || '/todos', actionId, action)
      } else if (actionId === 'quick_add') {
        callback('/quick-add', actionId, action)
      } else if (actionId === 'view_budget') {
        callback('/budget', actionId, action)
      } else if (actionId === 'view_details') {
        callback(cleanRoute || '/todos', actionId, action)
      } else if (cleanRoute) {
        callback(cleanRoute, actionId || 'tap', action)
      }
    })
    return () => {
      listenerPromise.then((handle) => handle.remove()).catch((err) => console.warn('[smartNotifications]', err))
    }
  } catch (err){
      console.warn('[smartNotifications]', err)
    return () => {}
  }
}

export default {
  initNotificationChannels,
  initNotificationActionTypes,
  requestNotificationPermission,
  sendTestNotification,
  syncDailyReminderSchedule,
  snoozeDailyReminder,
  checkBudgetAlertsAfterExpense,
  registerNotificationTapListener,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_ACTION_TYPES,
  NOTIFICATION_IDS,
  FINTRACK_NOTIFICATION_COLOR,
}
