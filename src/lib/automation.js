import { addDays, addWeeks, format } from 'date-fns'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { db } from './db'
import { createTransaction } from '../services/transactionService'
import useSettingsStore from '../store/useSettingsStore'
import { formatCurrency } from './utils'

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

async function notifyIfAllowed(title, body) {
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 100000),
            title,
            body,
            schedule: { at: new Date(Date.now() + 1000) },
          },
        ],
      })
      return
    } catch {
      // Fallback
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification(title, { body })
    return
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') new Notification(title, { body })
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
            title: isEn ? 'Recurring Bill Auto-Logged' : 'Tagihan Rutin Dicatat Otomatis',
            message: isEn
              ? `Auto-logged "${item.title}" for ${formatCurrency(item.amount, item.currency || 'IDR', 'en')}`
              : `Tagihan "${item.title}" sebesar ${formatCurrency(item.amount, item.currency || 'IDR', 'id')} telah dicatat otomatis ke dompet.`,
            read: false,
            relatedId: item.id,
            createdAt: Date.now(),
          })
        } catch {
          // Ignore notification storage error
        }
      } catch (err) {
        // When execution fails, advance nextDate to next cycle and notify user rather than freezing execution indefinitely
        try {
          await db.recurringTransactions.update(item.id, { nextDate: nextKey, anchorDay })
          await db.notifications.add({
            type: 'recurring_failed',
            title: isEn ? 'Recurring Bill Execution Failed' : 'Gagal Mencatat Tagihan Rutin',
            message: isEn
              ? `Failed to auto-log "${item.title}": ${err?.message || 'Unknown error'}. Advanced to next cycle.`
              : `Gagal mencatat transaksi rutin "${item.title}": ${err?.message || 'Terjadi kesalahan'}. Jadwal dialihkan ke periode berikutnya.`,
            read: false,
            relatedId: item.id,
            createdAt: Date.now(),
          })
        } catch {
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

  for (const event of events) {
    await notifyIfAllowed('FinTrack Reminder', event.title)
  }

  const activeRecurring = recurring.filter((item) => item.enabled === true || item.enabled === 1)
  const isEn = useSettingsStore.getState().locale === 'en'
  for (const item of activeRecurring) {
    const title = isEn ? 'Recurring Bill Reminder' : 'Pengingat Tagihan Rutin'
    const body = isEn
      ? `${item.title} (${item.frequency}) is due today!`
      : `${item.title} (${item.frequency}) jatuh tempo hari ini!`
    await notifyIfAllowed(title, body)
  }

  localStorage.setItem(marker, '1')
}
