import { addDays, addWeeks, format } from 'date-fns'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { db } from './db'
import { createTransaction } from '../services/transactionService'
import useSettingsStore from '../store/useSettingsStore'
import { formatCurrency } from './utils'
import { translate } from './i18n'
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_ACTION_TYPES,
  FINTRACK_NOTIFICATION_COLOR,
  NOTIFICATION_SMALL_ICON,
  NOTIFICATION_LARGE_ICON,
} from './smartNotifications'

export function nextDateByFrequency(dateValue, frequency, anchorDay = null) {
  const freq = String(frequency || '').toLowerCase()
  if (freq === 'daily') return addDays(dateValue, 1)
  if (freq === 'weekly') return addWeeks(dateValue, 1)

  const d = new Date(dateValue)
  const effectiveAnchorDay = anchorDay != null ? Number(anchorDay) : d.getDate()

  if (freq === 'yearly') {
    const targetYear = d.getFullYear() + 1
    const targetMonth = d.getMonth()
    const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
    const targetDay = Math.min(effectiveAnchorDay, daysInTargetMonth)
    return new Date(targetYear, targetMonth, targetDay, d.getHours(), d.getMinutes(), d.getSeconds())
  }

  // Monthly
  const targetYear = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear()
  const targetMonth = (d.getMonth() + 1) % 12
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
  const targetDay = Math.min(effectiveAnchorDay, daysInTargetMonth)
  return new Date(targetYear, targetMonth, targetDay, d.getHours(), d.getMinutes(), d.getSeconds())
}

export function shouldAutoExecuteRecurring(item) {
  if (!item) return false
  const isEnabled = item.enabled === true || item.enabled === 1
  if (!isEnabled) return false
  return item.autoExecute !== false
}

function dateKey(dateValue) {
  return format(dateValue, 'yyyy-MM-dd')
}

async function notifyIfAllowed(title, body, route = '/settings/recurring', extraData = {}) {
  if (Capacitor.isNativePlatform()) {
    try {
      const locale = useSettingsStore.getState?.()?.locale || 'id'
      const largeHeader = translate(locale, 'notifications.recurringHeader', 'Eksekusi Transaksi Terjadwal • FinTrack')
      const line1 = translate(locale, 'notifications.recurringLine1', '• Status: Transaksi terjadwal berhasil dieksekusi.')
      const line2 = translate(locale, 'notifications.recurringLine2', '• Tindakan: Tinjau mutasi dan saldo akun di menu Transaksi.')
      const largeBody = `${largeHeader}\n${title}\n${body}\n${line1}\n${line2}`
      const summaryText = translate(locale, 'notifications.summaryRecurring', 'Transaksi Otomatis')

      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 100000),
            title: title.startsWith('FinTrack') ? title : `FinTrack • ${title}`,
            body,
            largeBody,
            summaryText,
            channelId: NOTIFICATION_CHANNELS.BILL_REMINDERS,
            actionTypeId: NOTIFICATION_ACTION_TYPES.BILL_REMINDER,
            extra: { route, ...extraData },
            schedule: { at: new Date(Date.now() + 1000) },
            smallIcon: NOTIFICATION_SMALL_ICON,
            largeIcon: NOTIFICATION_LARGE_ICON,
            iconColor: FINTRACK_NOTIFICATION_COLOR,
          },
        ],
      })
      return
    } catch (err){
      console.warn('[automation]', err)
      // Fallback
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification(title.startsWith('FinTrack') ? title : `FinTrack • ${title}`, { body })
    return
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') new Notification(title.startsWith('FinTrack') ? title : `FinTrack • ${title}`, { body })
  }
}

export async function processRecurringTransactions(currentDate = new Date()) {
  const today = currentDate instanceof Date ? currentDate : new Date(currentDate || Date.now())
  const todayKey = dateKey(today)
  const allRecurring = await db.recurringTransactions.toArray()
  const recurringItems = allRecurring.filter(shouldAutoExecuteRecurring)
  const isEn = useSettingsStore.getState().locale === 'en'

  for (const item of recurringItems) {
    if (!item.nextDate || typeof item.nextDate !== 'string') continue
    let pointer = new Date(`${item.nextDate}T12:00:00`)
    if (isNaN(pointer.getTime())) continue

    const anchorDay = item.anchorDay || parseInt(String(item.nextDate).split('-')[2], 10) || pointer.getDate()

    let loopCount = 0
    while (dateKey(pointer) <= todayKey) {
      if (++loopCount > 366) break
      const currentDateKey = dateKey(pointer)
      const nextPointer = nextDateByFrequency(pointer, item.frequency, anchorDay)
      const nextKey = dateKey(nextPointer)
      if (nextKey <= currentDateKey) break

      const txData = {
        date: currentDateKey,
        amount: item.amount,
        type: item.type,
        category: item.category,
        notes: `${item.notes || ''} (Auto: ${item.title})`.trim(),
        currency: item.currency || 'IDR',
        createdAt: pointer.getTime(),
      }
      if (item.walletId) txData.walletId = item.walletId
      if (item.targetWalletId) txData.targetWalletId = item.targetWalletId

      try {
        await createTransaction(txData)
        await db.recurringTransactions.update(item.id, { nextDate: nextKey, anchorDay })

        try {
          await db.notifications.add({
            type: 'recurring_auto',
            title: isEn ? 'Recurring Bill' : 'Tagihan Rutin',
            message: isEn
              ? `"${item.title}" auto-logged (${formatCurrency(item.amount, item.currency || 'IDR', 'en')})`
              : `"${item.title}" otomatis dicatat (${formatCurrency(item.amount, item.currency || 'IDR', 'id')})`,
            read: false,
            relatedId: item.id,
            createdAt: Date.now(),
          })
        } catch (err){
      console.warn('[automation]', err)
          // Ignore notification storage error
        }
      } catch (err) {
      console.warn('[automation]', err)
        // When execution fails, advance nextDate to next cycle and notify user rather than freezing execution indefinitely
        try {
          await db.recurringTransactions.update(item.id, { nextDate: nextKey, anchorDay })
          await db.notifications.add({
            type: 'recurring_failed',
            title: isEn ? 'Recurring Bill Failed' : 'Gagal Catat Tagihan',
            message: isEn
              ? `Failed to log "${item.title}": ${err?.message || 'Error'}.`
              : `Gagal mencatat "${item.title}": ${err?.message || 'Terjadi kesalahan'}.`,
            read: false,
            relatedId: item.id,
            createdAt: Date.now(),
          })
        } catch (err){
      console.warn('[automation]', err)
          // Ignore secondary notification/update errors
        }
        break
      }

      pointer = nextPointer
    }
  }
}

export async function notifyTodayEvents() {
  const today = new Date()
  const todayKey = dateKey(today)
  const marker = `fintrack-notified-${todayKey}`
  if (localStorage.getItem(marker)) return

  const [events, recurring] = await Promise.all([
    db.calendarEvents.where('date').equals(todayKey).toArray(),
    db.recurringTransactions.where('nextDate').equals(todayKey).toArray(),
  ])

  const isEn = useSettingsStore.getState().locale === 'en'
  for (const event of events) {
    const title = isEn ? 'Calendar Reminder' : 'Pengingat Agenda'
    await notifyIfAllowed(title, event.title, '/calendar', { type: 'calendar' })
  }

  const activeRecurring = recurring.filter((item) => item.enabled === true || item.enabled === 1)
  for (const item of activeRecurring) {
    const title = isEn ? 'Recurring Bill Reminder' : 'Pengingat Tagihan Rutin'
    const body = isEn
      ? `${item.title} (${item.frequency}) is due today!`
      : `${item.title} (${item.frequency}) jatuh tempo hari ini!`
    await notifyIfAllowed(title, body, '/settings/recurring', { recurringId: item.id, type: 'recurring' })
  }

  localStorage.setItem(marker, '1')
}
