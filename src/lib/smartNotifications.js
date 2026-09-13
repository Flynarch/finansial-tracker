import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { format, parseISO } from 'date-fns'
import { db } from './db'
import { formatCurrency, toSafeNumber } from './utils'
import useSettingsStore from '../store/useSettingsStore'

export const NOTIFICATION_CHANNELS = {
  DAILY_REMINDER: 'fintrack_daily_reminder',
  BUDGET_ALERTS: 'fintrack_budget_alerts',
  BILL_REMINDERS: 'fintrack_bill_reminders',
}

const NOTIFICATION_IDS = {
  DAILY_REMINDER: 99901,
  BUDGET_ALERT_BASE: 99800,
}

/**
 * Initializes Android notification channels with active language support.
 */
export async function initNotificationChannels() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const locale = useSettingsStore.getState().locale || 'id'
    const isEn = locale === 'en'

    await LocalNotifications.createChannel({
      id: NOTIFICATION_CHANNELS.DAILY_REMINDER,
      name: isEn ? 'Daily Logging Reminder' : 'Pengingat Harian',
      description: isEn
        ? 'Daily friendly reminder to log your daily expenses.'
        : 'Pengingat rutin untuk mencatat pengeluaran harian Anda.',
      importance: 4, // High
      visibility: 1, // Public
    }).catch(() => {})

    await LocalNotifications.createChannel({
      id: NOTIFICATION_CHANNELS.BUDGET_ALERTS,
      name: isEn ? 'Budget Limit Alerts' : 'Peringatan Batas Anggaran',
      description: isEn
        ? 'Real-time notifications when spending nears or exceeds budget limit.'
        : 'Pemberitahuan saat pengeluaran mendekati atau melebihi limit anggaran.',
      importance: 5, // Max
      visibility: 1,
    }).catch(() => {})

    await LocalNotifications.createChannel({
      id: NOTIFICATION_CHANNELS.BILL_REMINDERS,
      name: isEn ? 'Bill & Recurring Reminders' : 'Pengingat Tagihan & Rutin',
      description: isEn
        ? 'Notifications for upcoming bills and recurring commitments.'
        : 'Notifikasi untuk tagihan dan pengeluaran rutin yang akan jatuh tempo.',
      importance: 4, // High
      visibility: 1,
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

    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 90000) + 10000,
            title: 'FinTrack • Pengingat Finansial',
            body: 'Notifikasi uji coba berhasil! FinTrack siap mengingatkan pencatatan keuangan Anda.',
            channelId: NOTIFICATION_CHANNELS.DAILY_REMINDER,
            schedule: { at: new Date(Date.now() + 300) },
            smallIcon: 'ic_stat_fintrack',
            iconColor: '#6366f1',
          },
        ],
      })
      return true
    } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('FinTrack • Pengingat Finansial', {
        body: 'Notifikasi uji coba berhasil! FinTrack siap mengingatkan pencatatan keuangan Anda.',
      })
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

    const locale = useSettingsStore.getState().locale || 'id'
    const isEn = locale === 'en'

    const title = isEn
      ? 'FinTrack • Daily Expense Reminder'
      : 'FinTrack • Pengingat Catat Keuangan'
    const body = isEn
      ? 'Have you logged your expenses today? Take 1 minute to keep your finances organized.'
      : 'Sudahkah Anda mencatat pengeluaran hari ini? Luangkan 1 menit untuk keuangan yang lebih teratur.'

    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: NOTIFICATION_IDS.DAILY_REMINDER,
            title,
            body,
            channelId: NOTIFICATION_CHANNELS.DAILY_REMINDER,
            extra: { route: 'fintrack://quick-add' },
            schedule: {
              at: triggerDate,
              every: 'day',
              allowWhileIdle: true,
            },
            smallIcon: 'ic_stat_fintrack',
            iconColor: '#10b981',
          },
        ],
      })
    }
  } catch (err) {
    console.warn('syncDailyReminderSchedule error:', err)
  }
}

/**
 * Checks budget limits after a new expense transaction is recorded.
 * Sends proactive alert if category expense reaches 80% or exceeds 100%.
 */
export async function checkBudgetAlertsAfterExpense({ category, amount, date }) {
  try {
    const budgetAlertsEnabled = useSettingsStore.getState().budgetAlertsEnabled
    if (!budgetAlertsEnabled) return

    if (!category || !amount || Number(amount) <= 0) return

    const targetMonthStr = date ? format(parseISO(String(date)), 'yyyy-MM') : format(new Date(), 'yyyy-MM')
    const currentMonthStr = format(new Date(), 'yyyy-MM')
    if (targetMonthStr !== currentMonthStr) return

    // Find active budgets for this category or parent category
    const budgets = await db.budgets.toArray()
    const parentCategory = category.includes('/') ? category.split('/')[0] : category

    const matchingBudget = budgets.find(
      (b) =>
        b.month === currentMonthStr &&
        (b.category === category || b.category === parentCategory || b.category === 'all')
    )

    if (!matchingBudget || !(matchingBudget.amount ?? matchingBudget.limit) || (matchingBudget.amount ?? matchingBudget.limit) <= 0) return

    // Calculate total spent in this budget category for the current month
    const allTxs = await db.transactions
      .where('date')
      .between(`${currentMonthStr}-01`, `${currentMonthStr}-31`, true, true)
      .toArray()

    const categoryTxs = allTxs.filter(
      (t) =>
        t.type === 'expense' &&
        (t.category === matchingBudget.category ||
          (matchingBudget.category !== 'all' && t.category?.startsWith?.(matchingBudget.category)) ||
          matchingBudget.category === 'all')
    )

    const totalSpent = categoryTxs.reduce((acc, t) => acc + toSafeNumber(t.amount), 0)
    const budgetLimit = toSafeNumber(matchingBudget.amount ?? matchingBudget.limit)
    const spentRatio = totalSpent / budgetLimit

    const defaultCurrency = useSettingsStore.getState().defaultCurrency || 'IDR'
    const locale = useSettingsStore.getState().locale || 'id'
    const isEn = locale === 'en'

    const catDisplayName = matchingBudget.category === 'all'
      ? (isEn ? 'Total Budget' : 'Total Anggaran')
      : matchingBudget.category

    const formattedSpent = formatCurrency(totalSpent, defaultCurrency, locale)
    const formattedLimit = formatCurrency(budgetLimit, defaultCurrency, locale)

    let alertTitle = ''
    let alertBody = ''

    if (spentRatio >= 1.0) {
      alertTitle = isEn ? 'Budget Limit Exceeded!' : 'Batas Anggaran Terlampaui!'
      alertBody = isEn
        ? `Spending for ${catDisplayName} reached ${formattedSpent} (exceeded monthly limit of ${formattedLimit}).`
        : `Pengeluaran ${catDisplayName} telah mencapai ${formattedSpent} (melebihi limit ${formattedLimit}).`
    } else if (spentRatio >= 0.8) {
      alertTitle = isEn ? 'Budget Warning (80%)' : 'Peringatan Anggaran (80%)'
      alertBody = isEn
        ? `Spending for ${catDisplayName} reached ${Math.round(spentRatio * 100)}% of your monthly budget (${formattedSpent} / ${formattedLimit}).`
        : `Pengeluaran ${catDisplayName} telah mencapai ${Math.round(spentRatio * 100)}% dari batas bulanan (${formattedSpent} / ${formattedLimit}).`
    }

    if (alertTitle && alertBody) {
      await sendInstantBudgetNotification({
        id: NOTIFICATION_IDS.BUDGET_ALERT_BASE + Math.floor(Math.random() * 100),
        title: alertTitle,
        body: alertBody,
        route: '/budget',
      })
    }
  } catch (err) {
    console.warn('checkBudgetAlertsAfterExpense error:', err)
  }
}

/**
 * Fires an instant local notification or browser notification.
 */
async function sendInstantBudgetNotification({ id, title, body, route = '/budget' }) {
  try {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: id || Date.now() % 100000,
            title,
            body,
            channelId: NOTIFICATION_CHANNELS.BUDGET_ALERTS,
            extra: { route },
            schedule: { at: new Date(Date.now() + 500) },
            smallIcon: 'ic_stat_fintrack',
            iconColor: '#10b981',
          },
        ],
      })
    } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`FinTrack • ${title}`, { body })
    }
  } catch {
    /* ignore */
  }
}

/**
 * Sets up tap listeners on native notifications to navigate inside the app.
 * @param {Function} navigateFn - React router navigate function
 */
export function registerNotificationTapListener(navigateFn) {
  if (!Capacitor.isNativePlatform() || typeof navigateFn !== 'function') return () => {}
  try {
    const listenerPromise = LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const targetRoute = action?.notification?.extra?.route
      if (targetRoute) {
        navigateFn(targetRoute)
      }
    })
    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {})
    }
  } catch {
    return () => {}
  }
}
