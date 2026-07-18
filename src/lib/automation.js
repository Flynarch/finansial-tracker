import { addDays, addMonths, addWeeks, format } from 'date-fns'
import { db } from './db'

function nextDateByFrequency(dateValue, frequency) {
  if (frequency === 'daily') return addDays(dateValue, 1)
  if (frequency === 'weekly') return addWeeks(dateValue, 1)
  return addMonths(dateValue, 1)
}

function dateKey(dateValue) {
  return format(dateValue, 'yyyy-MM-dd')
}

async function notifyIfAllowed(title, body) {
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
  const recurringItems = await db.recurringTransactions.where('enabled').equals(1).toArray()

  for (const item of recurringItems) {
    let pointer = new Date(`${item.nextDate}T12:00:00`)
    while (dateKey(pointer) <= todayKey) {
      await db.transactions.add({
        date: dateKey(pointer),
        amount: item.amount,
        type: item.type,
        category: item.category,
        notes: `${item.notes || ''} (Auto: ${item.title})`.trim(),
        currency: item.currency || 'IDR',
        createdAt: pointer.getTime(),
      })
      pointer = nextDateByFrequency(pointer, item.frequency)
    }
    await db.recurringTransactions.update(item.id, { nextDate: dateKey(pointer) })
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
  for (const item of recurring) {
    await notifyIfAllowed('Recurring Transaction Due', `${item.title} (${item.frequency})`)
  }

  localStorage.setItem(marker, '1')
}
