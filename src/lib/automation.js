import { addDays, addWeeks, format } from 'date-fns'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { db } from './db'
import { createTransaction } from '../services/transactionService'
import useSettingsStore from '../store/useSettingsStore'
import { formatCurrency, convertCurrency, roundCurrency } from './utils'
import { getCachedCurrencyRates } from './api'
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
      const isEn = locale === 'en'
      const largeBody = body
      const summaryText = translate(locale, 'notifications.summaryRecurring', isEn ? 'Automated' : 'Otomatis')

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 30000 + Math.floor(Math.random() * 9000),
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

let isProcessingRecurring = false

export async function processRecurringTransactions(currentDate = new Date()) {
  if (isProcessingRecurring) return
  isProcessingRecurring = true
  try {
    const today = currentDate instanceof Date ? currentDate : new Date(currentDate || Date.now())
    const todayKey = dateKey(today)
    const allRecurring = await db.recurringTransactions.toArray()
    const recurringItems = allRecurring.filter(shouldAutoExecuteRecurring)
    const locale = useSettingsStore.getState().locale || 'id'
    const isEn = locale === 'en'

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

        if (item.walletId) {
          const wallet = await db.wallets.get(Number(item.walletId))
          if (!wallet || wallet.isArchived) {
            await db.recurringTransactions.update(item.id, { nextDate: nextKey, anchorDay })
            const failTitle = translate(locale, 'notifications.recurringFailedTitle', isEn ? 'Recurring Bill Failed' : 'Gagal Catat Tagihan')
            const failMsg = translate(
              locale,
              'notifications.recurringWalletArchivedMsg',
              isEn
                ? `Failed to log "${item.title}": Target wallet is archived or deleted.`
                : `Gagal mencatat "${item.title}": Dompet tujuan telah diarsip atau dihapus.`,
              { title: item.title }
            )
            await db.notifications.add({
              type: 'recurring_failed',
              title: failTitle,
              message: failMsg,
              read: false,
              relatedId: item.id,
              createdAt: Date.now(),
            })
            pointer = nextPointer
            continue
          }
        }

        if (item.targetWalletId) {
          const targetWallet = await db.wallets.get(Number(item.targetWalletId))
          if (!targetWallet || targetWallet.isArchived) {
            await db.recurringTransactions.update(item.id, { nextDate: nextKey, anchorDay })
            const failTitle = translate(locale, 'notifications.recurringFailedTitle', isEn ? 'Recurring Bill Failed' : 'Gagal Catat Tagihan')
            const failMsg = translate(
              locale,
              'notifications.recurringTargetWalletArchivedMsg',
              isEn
                ? `Failed to log "${item.title}": Target transfer wallet is archived or deleted.`
                : `Gagal mencatat "${item.title}": Dompet tujuan transfer telah diarsip atau dihapus.`,
              { title: item.title }
            )
            await db.notifications.add({
              type: 'recurring_failed',
              title: failTitle,
              message: failMsg,
              read: false,
              relatedId: item.id,
              createdAt: Date.now(),
            })
            pointer = nextPointer
            continue
          }
        }

        const srcWallet = item.walletId ? await db.wallets.get(Number(item.walletId)) : null
        const srcCurrency = item.currency || srcWallet?.currency || 'IDR'

        const txData = {
          date: currentDateKey,
          amount: item.amount,
          type: item.type,
          category: item.category,
          notes: `${item.notes || ''} (Auto: ${item.title})`.trim(),
          currency: srcCurrency,
          createdAt: pointer.getTime(),
        }
        if (item.walletId) txData.walletId = item.walletId
        if (item.type === 'transfer' && item.targetWalletId) {
          txData.targetWalletId = item.targetWalletId
          if (item.targetAmount) {
            txData.targetAmount = item.targetAmount
          } else {
            const targetWallet = await db.wallets.get(Number(item.targetWalletId))
            const tgtCurrency = targetWallet?.currency || srcCurrency
            if (srcCurrency !== tgtCurrency) {
              const rates = getCachedCurrencyRates('USD')
              txData.targetAmount = roundCurrency(convertCurrency(item.amount, srcCurrency, tgtCurrency, rates), tgtCurrency)
            }
          }
        } else if (item.targetWalletId) {
          txData.targetWalletId = item.targetWalletId
        }

        try {
          await createTransaction(txData)
          await db.recurringTransactions.update(item.id, { nextDate: nextKey, anchorDay })

          try {
            const formattedAmount = formatCurrency(item.amount, item.currency || 'IDR', locale)
            const notifTitle = translate(locale, 'notifications.recurringAutoTitle', isEn ? 'Recurring Bill' : 'Tagihan Rutin')
            const notifMsg = translate(
              locale,
              'notifications.recurringAutoMsg',
              isEn ? `"${item.title}" auto-logged (${formattedAmount})` : `"${item.title}" otomatis dicatat (${formattedAmount})`,
              { title: item.title, amount: formattedAmount }
            )

            await db.notifications.add({
              type: 'recurring_auto',
              title: notifTitle,
              message: notifMsg,
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
            const failTitle = translate(locale, 'notifications.recurringFailedTitle', isEn ? 'Recurring Bill Failed' : 'Gagal Catat Tagihan')
            const failMsg = translate(
              locale,
              'notifications.recurringFailedMsg',
              isEn
                ? `Failed to log "${item.title}": ${err?.message || 'Error'}.`
                : `Gagal mencatat "${item.title}": ${err?.message || 'Terjadi kesalahan'}.`,
              { title: item.title, error: err?.message || (isEn ? 'Error' : 'Terjadi kesalahan') }
            )

            await db.notifications.add({
              type: 'recurring_failed',
              title: failTitle,
              message: failMsg,
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
  } finally {
    isProcessingRecurring = false
  }
}

export async function notifyTodayEvents() {
  const today = new Date()
  const todayKey = dateKey(today)
  const marker = `fintrack-notified-${todayKey}`
  if (typeof localStorage !== 'undefined' && localStorage.getItem(marker)) return

  const [events, recurring] = await Promise.all([
    db.calendarEvents.where('date').equals(todayKey).toArray(),
    db.recurringTransactions.where('nextDate').belowOrEqual(todayKey).toArray(),
  ])

  const locale = useSettingsStore.getState().locale || 'id'
  const isEn = locale === 'en'

  for (const event of events) {
    const title = translate(locale, 'notifications.calendarReminderTitle', isEn ? 'Calendar Reminder' : 'Pengingat Agenda')
    await notifyIfAllowed(title, event.title, '/calendar', { type: 'calendar' })
  }

  const activeRecurring = recurring.filter((item) => item.enabled === true || item.enabled === 1)
  for (const item of activeRecurring) {
    const freqLabel = translate(locale, `settings.recurring.frequency.${item.frequency}`, item.frequency)
    const title = translate(locale, 'notifications.recurringBillReminderTitle', isEn ? 'Recurring Bill Reminder' : 'Pengingat Tagihan Rutin')
    const body = translate(
      locale,
      'notifications.recurringBillDueToday',
      isEn ? `${item.title} (${freqLabel}) is due today.` : `${item.title} (${freqLabel}) jatuh tempo hari ini.`,
      { title: item.title, frequency: freqLabel }
    )
    await notifyIfAllowed(title, body, '/settings/recurring', { recurringId: item.id, type: 'recurring' })

    if (item.autoExecute === false && item.nextDate <= todayKey) {
      let nextDateStr = item.nextDate
      const anchorDay = item.anchorDay || parseInt(String(item.nextDate).split('-')[2], 10)
      while (nextDateStr <= todayKey) {
        const baseDate = new Date(`${nextDateStr}T12:00:00`)
        const nextPointer = nextDateByFrequency(baseDate, item.frequency, anchorDay)
        nextDateStr = dateKey(nextPointer)
      }
      await db.recurringTransactions.update(item.id, { nextDate: nextDateStr, lastRun: todayKey })
    }
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(marker, '1')
  }
}
