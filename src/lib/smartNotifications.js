import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { parseISO } from 'date-fns'
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

    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: NOTIFICATION_ACTION_TYPES.DAILY_REMINDER,
          actions: [
            {
              id: 'quick_add',
              title: translate(locale, 'notifications.actionQuickAddBtn', '+ Catat Cepat'),
            },
            {
              id: 'snooze_1h',
              title: translate(locale, 'notifications.actionSnooze1hBtn', 'Tunda 1 Jam'),
            },
          ],
        },
        {
          id: NOTIFICATION_ACTION_TYPES.BUDGET_ALERT,
          actions: [
            {
              id: 'view_budget',
              title: translate(locale, 'notifications.actionViewBudgetBtn', 'Lihat Anggaran'),
            },
          ],
        },
        {
          id: NOTIFICATION_ACTION_TYPES.BILL_REMINDER,
          actions: [
            {
              id: 'mark_paid',
              title: translate(locale, 'notifications.actionMarkPaidBtn', 'Tandai Lunas'),
            },
            {
              id: 'view_details',
              title: translate(locale, 'notifications.actionViewDetailsBtn', 'Buka Detail'),
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
    const securityEnabled = Boolean(useSettingsStore.getState?.()?.securityEnabled)
    // 0 = VISIBILITY_PRIVATE (masks sensitive numbers on secure lock screen)
    // 1 = VISIBILITY_PUBLIC
    const sensitiveVisibility = securityEnabled ? 0 : 1

    await initNotificationActionTypes()

    await LocalNotifications.createChannel({
      id: NOTIFICATION_CHANNELS.DAILY_REMINDER,
      name: translate(locale, 'notifications.channelDailyName', 'Pengingat Harian'),
      description: translate(
        locale,
        'notifications.channelDailyDesc',
        'Pengingat rutin untuk mencatat pengeluaran harian Anda.'
      ),
      importance: 4, // High
      visibility: 1, // Public (daily reminder contains no sensitive balance data)
      lights: true,
      lightColor: FINTRACK_NOTIFICATION_COLOR,
      vibration: true,
    }).catch(() => {})

    await LocalNotifications.createChannel({
      id: NOTIFICATION_CHANNELS.BUDGET_ALERTS,
      name: translate(locale, 'notifications.channelBudgetName', 'Peringatan Batas Anggaran'),
      description: translate(
        locale,
        'notifications.channelBudgetDesc',
        'Pemberitahuan instan saat pengeluaran mendekati atau melebihi limit anggaran.'
      ),
      importance: 5, // Max (triggers heads-up popdown banner when over limit)
      visibility: sensitiveVisibility,
      lights: true,
      lightColor: '#F43F5E',
      vibration: true,
    }).catch(() => {})

    await LocalNotifications.createChannel({
      id: NOTIFICATION_CHANNELS.BILL_REMINDERS,
      name: translate(locale, 'notifications.channelBillName', 'Pengingat Tagihan & Rutin'),
      description: translate(
        locale,
        'notifications.channelBillDesc',
        'Notifikasi untuk tagihan dan pengeluaran rutin yang akan jatuh tempo.'
      ),
      importance: 4, // High
      visibility: sensitiveVisibility,
      lights: true,
      lightColor: FINTRACK_NOTIFICATION_COLOR,
      vibration: true,
    }).catch(() => {})
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
  } catch {
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

    const title = translate(locale, 'notifications.testNotifTitle', 'FinTrack • Sistem Notifikasi')
    const body = translate(
      locale,
      'notifications.testNotifBody',
      'Notifikasi eksternal aktif • FinTrack siap mengawal ritme keuangan Anda.'
    )

    const header = translate(locale, 'notifications.testNotifHeader', 'FinTrack • Sistem Notifikasi Aktif')
    const headline = translate(locale, 'notifications.testNotifHeadline', 'Integrasi Notifikasi Native Berjalan Normal')
    const line1 = translate(locale, 'notifications.testNotifLine1', '• Status: Izin notifikasi aktif • Saluran pengingat siap.')
    const line2 = translate(locale, 'notifications.testNotifLine2', '• Tampilan: BigTextStyle & tombol aksi cepat terverifikasi.')
    const largeBody = `${header}\n${headline}\n${line1}\n${line2}`

    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 90000) + 10000,
            title,
            body,
            largeBody,
            summaryText: translate(locale, 'notifications.testNotifSummary', 'Diagnostik Sistem'),
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
      }).catch(() => {})
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
    const triggerDate = new Date()
    triggerDate.setHours(targetHour, targetMin, 0, 0)
    if (triggerDate <= now) {
      triggerDate.setDate(triggerDate.getDate() + 1)
    }

    const locale = useSettingsStore.getState?.()?.locale || 'id'

    const title = translate(locale, 'notifications.dailyReminderTitle', 'Evaluasi Arus Kas Harian')
    const body = translate(
      locale,
      'notifications.dailyReminderBody',
      'Catat pengeluaran hari ini • Jaga arus kas dan limit anggaran tetap presisi.'
    )

    const header = translate(locale, 'notifications.dailyReminderHeader', 'Pengingat Harian • FinTrack')
    const headline = translate(locale, 'notifications.dailyReminderHeadline', 'Sudahkah Anda mencatat pengeluaran hari ini?')
    const bullet1 = translate(locale, 'notifications.dailyReminderBullet1', '• Arus Kas: Catat setiap pengeluaran agar saldo dompet tetap sinkron.')
    const bullet2 = translate(locale, 'notifications.dailyReminderBullet2', '• Anggaran: Pantau sisa kuota belanja sebelum akhir bulan.')
    const bullet3 = translate(locale, 'notifications.dailyReminderBullet3', '• Aksi Cepat: Tekan tombol di bawah untuk menambah transaksi secara instan.')
    const largeBody = `${header}\n${headline}\n${bullet1}\n${bullet2}\n${bullet3}`
    const summaryText = translate(locale, 'notifications.channelDailyName', 'Pengingat Harian')

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

    const snoozeDate = new Date(Date.now() + Math.max(1, Number(hours) || 1) * 3600 * 1000)

    const title = translate(locale, 'notifications.snoozeTitle', 'Pengingat Ditunda')
    const body = translate(
      locale,
      'notifications.snoozeBody',
      'Pengingat pencatatan harian ditunda • Luangkan 1 menit untuk mencatat transaksi.'
    )

    const header = translate(locale, 'notifications.dailyReminderHeader', 'Pengingat Harian • FinTrack')
    const headline = translate(locale, 'notifications.snoozeHeadline', 'Pengingat Pencatatan Ditunda Aktif Kembali')
    const bullet1 = translate(locale, 'notifications.snoozeBullet1', '• Catatan: Luangkan 1 menit untuk memeriksa pengeluaran yang belum dicatat.')
    const bullet2 = translate(locale, 'notifications.snoozeBullet2', '• Status: Arus kas harian menunggu pembaruan.')
    const bullet3 = translate(locale, 'notifications.snoozeBullet3', '• Aksi Cepat: Tekan tombol di bawah untuk menambah transaksi.')
    const largeBody = `${header}\n${headline}\n${bullet1}\n${bullet2}\n${bullet3}`

    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIFICATION_IDS.DAILY_REMINDER_SNOOZE,
          title,
          body,
          largeBody,
          summaryText: translate(locale, 'notifications.channelDailyName', 'Pengingat Harian'),
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

    const catDisplayName = matchingBudget.category === 'all'
      ? 'Total Anggaran'
      : matchingBudget.category

    const formattedSpent = formatCurrency(totalSpent, budgetCurrency, locale)
    const formattedLimit = formatCurrency(budgetLimit, budgetCurrency, locale)

    let alertTitle = ''
    let alertBody = ''
    let largeBody = ''

    if (spentRatio >= 1.0) {
      alertTitle = translate(locale, 'notifications.budgetExceededTitle', 'Batas Anggaran Terlampaui')
      alertBody = translate(
        locale,
        'notifications.budgetExceededBody',
        `Pos ${catDisplayName} mencapai ${formattedSpent} • Batas: ${formattedLimit}.`,
        { category: catDisplayName, spent: formattedSpent, limit: formattedLimit }
      )

      const header = translate(locale, 'notifications.budgetExceededHeader', 'Peringatan Anggaran • FinTrack')
      const headline = translate(
        locale,
        'notifications.budgetExceededHeadline',
        `Batas Anggaran ${catDisplayName} Terlampaui (100%)`,
        { category: catDisplayName }
      )
      const metricLine = translate(
        locale,
        'notifications.budgetExceededMetric',
        `• Realisasi: ${formattedSpent} • Batas: ${formattedLimit} • Melebihi plafon.`,
        { spent: formattedSpent, limit: formattedLimit }
      )
      const actionLine = translate(
        locale,
        'notifications.budgetExceededAction',
        '• Rekomendasi: Tinjau dan kendalikan pos belanja di menu Anggaran.'
      )
      largeBody = `${header}\n${headline}\n${metricLine}\n${actionLine}`
    } else if (spentRatio >= 0.8) {
      const pct = Math.round(spentRatio * 100)
      const remaining = formatCurrency(Math.max(0, budgetLimit - totalSpent), budgetCurrency, locale)
      alertTitle = translate(
        locale,
        'notifications.budgetWarningTitle',
        `Peringatan Anggaran (${pct}%)`,
        { percent: pct }
      )
      alertBody = translate(
        locale,
        'notifications.budgetWarningBody',
        `Pos ${catDisplayName} mencapai ${pct}% • Terpakai: ${formattedSpent} dari ${formattedLimit}.`,
        { category: catDisplayName, percent: pct, spent: formattedSpent, limit: formattedLimit }
      )

      const header = translate(locale, 'notifications.budgetWarningHeader', 'Peringatan Anggaran • FinTrack')
      const headline = translate(
        locale,
        'notifications.budgetWarningHeadline',
        `Batas Anggaran ${catDisplayName} Mencapai ${pct}%`,
        { category: catDisplayName, percent: pct }
      )
      const metricLine = translate(
        locale,
        'notifications.budgetWarningMetric',
        `• Realisasi: ${formattedSpent} • Batas: ${formattedLimit} • Sisa kuota: ${remaining}.`,
        { spent: formattedSpent, limit: formattedLimit, remaining }
      )
      const actionLine = translate(
        locale,
        'notifications.budgetWarningAction',
        '• Rekomendasi: Perlambat belanja pada kategori ini untuk menjaga arus kas aman.'
      )
      largeBody = `${header}\n${headline}\n${metricLine}\n${actionLine}`
    }

    if (alertTitle && alertBody) {
      const isDanger = spentRatio >= 1.0
      const inAppTitle = isDanger
        ? translate(locale, 'notifications.budgetExceededInApp', 'Budget Jebol!')
        : translate(locale, 'notifications.budgetWarningInApp', 'Peringatan Budget')

      const inAppMessage = isDanger
        ? translate(
            locale,
            'notifications.budgetExceededInAppMsg',
            `Pengeluaran kategori ${catDisplayName} melebihi batas anggaran (${Math.round(spentRatio * 100)}%).`,
            { category: catDisplayName, percent: Math.round(spentRatio * 100) }
          )
        : translate(
            locale,
            'notifications.budgetWarningInAppMsg',
            `Pengeluaran kategori ${catDisplayName} hampir habis (${Math.round(spentRatio * 100)}%).`,
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
          summaryText: translate(locale, 'notifications.channelBudgetName', 'Peringatan Batas Anggaran'),
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
            id: id || Date.now() % 100000,
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
  } catch {
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
        snoozeDailyReminder(1).catch(() => {})
        if (typeof window !== 'undefined') {
          const locale = useSettingsStore.getState?.()?.locale || 'id'
          window.dispatchEvent(
            new CustomEvent('ft-show-toast', {
              detail: {
                title: translate(locale, 'notifications.snoozedTitle', 'Pengingat Ditunda'),
                message: translate(
                  locale,
                  'notifications.snoozedBody',
                  'Pengingat pencatatan harian ditunda selama 1 jam.'
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
            await db.todos.update(Number(extra.todoId), {
              completed: 1,
              completedAt: new Date().toISOString(),
            })
          }
          if (typeof window !== 'undefined') {
            const locale = useSettingsStore.getState?.()?.locale || 'id'
            window.dispatchEvent(
              new CustomEvent('ft-show-toast', {
                detail: {
                  title: translate(locale, 'notifications.actionMarkPaidBtn', 'Tandai Lunas'),
                  message: translate(
                    locale,
                    'notifications.markedPaidSuccess',
                    'Komitmen telah berhasil diselesaikan.'
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
      listenerPromise.then((handle) => handle.remove()).catch(() => {})
    }
  } catch {
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
