import { addDays, addMonths, addWeeks, addYears, format } from 'date-fns'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { db } from './db'
import { createTransaction } from '../services/transactionService'

function nextDateByFrequency(dateValue, frequency) {
  const freq = String(frequency || '').toLowerCase()
  if (freq === 'daily') return addDays(dateValue, 1)
  if (freq === 'weekly') return addWeeks(dateValue, 1)
  if (freq === 'yearly') return addYears(dateValue, 1)
  return addMonths(dateValue, 1)
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

export async function processRecurringTransactions() {
  const today = new Date()
  const todayKey = dateKey(today)
  const allRecurring = await db.recurringTransactions.toArray()
  const recurringItems = allRecurring.filter((item) => item.enabled === true || item.enabled === 1)

  for (const item of recurringItems) {
    if (!item.nextDate || typeof item.nextDate !== 'string') continue
    let pointer = new Date(`${item.nextDate}T12:00:00`)
    if (isNaN(pointer.getTime())) continue

    while (dateKey(pointer) <= todayKey) {
      const currentDateKey = dateKey(pointer)
      const nextPointer = nextDateByFrequency(pointer, item.frequency)
      const nextKey = dateKey(nextPointer)

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
        await db.recurringTransactions.update(item.id, { nextDate: nextKey })
      } catch {
        // If an error occurs, break out to prevent infinite loop
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
  for (const item of activeRecurring) {
    await notifyIfAllowed('Pengingat Tagihan Rutin', `${item.title} (${item.frequency}) jatuh tempo hari ini!`)
  }

  localStorage.setItem(marker, '1')
}
