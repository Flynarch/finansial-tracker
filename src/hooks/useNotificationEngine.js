import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { db } from '../lib/db'
import { format } from 'date-fns'
import useSettingsStore from '../store/useSettingsStore'
import { translate } from '../lib/i18n'
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_ACTION_TYPES,
  FINTRACK_NOTIFICATION_COLOR,
  NOTIFICATION_SMALL_ICON,
  NOTIFICATION_LARGE_ICON,
} from '../lib/smartNotifications'

export default function useNotificationEngine() {
  const todos = useLiveQuery(() => db.todos.where('completed').equals(0).toArray())
  const habits = useLiveQuery(() => db.habits.where('reminderEnabled').equals(1).toArray())
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!Capacitor.isNativePlatform() && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }

    const checkReminders = async () => {
      const now = new Date()
      const currentTimeStr = format(now, 'HH:mm')
      const todayStr = format(now, 'yyyy-MM-dd')
      const locale = useSettingsStore.getState().locale || 'id'

      const isCreatedToday = (createdVal) => {
        if (!createdVal) return false
        try {
          return format(new Date(createdVal), 'yyyy-MM-dd') === todayStr
        } catch {
          return false
        }
      }

      if (todos) {
        for (const todo of todos) {
          if (todo.reminderTime === currentTimeStr && todo.dueDate === todayStr) {
            const existing = await db.notifications
              .filter(n => n.relatedId === `todo_${todo.id}` && isCreatedToday(n.createdAt))
              .toArray()
            
            if (existing.length === 0) {
              const title = translate(locale, 'notifications.todoDueTitle', 'Pengingat Komitmen')
              const message = `${todo.title} • ${translate(locale, 'notifications.todoDueBodySuffix', 'Jatuh tempo hari ini')}`

              await db.notifications.add({
                type: 'todo',
                title,
                message,
                read: false,
                relatedId: `todo_${todo.id}`,
                createdAt: now.toISOString()
              })

              if (Capacitor.isNativePlatform()) {
                const largeHeader = translate(locale, 'notifications.billReminderHeader', 'Jadwal Komitmen • FinTrack')
                const bullet1 = translate(locale, 'notifications.todoDueBullet1', '• Jadwal: Jatuh tempo hari ini • Prioritas komitmen aktif.')
                const bullet2 = translate(locale, 'notifications.todoDueBullet2', '• Rekomendasi: Selesaikan tugas atau tandai lunas setelah transaksi.')
                const largeBody = `${largeHeader}\n${todo.title}\n${bullet1}\n${bullet2}`
                const summaryText = translate(locale, 'notifications.summaryCommitment', 'Jadwal & Komitmen')

                await LocalNotifications.schedule({
                  notifications: [
                    {
                      id: Number(todo.id) ? Number(todo.id) + 88000 : Math.floor(Math.random() * 10000) + 88000,
                      title,
                      body: message,
                      largeBody,
                      summaryText,
                      channelId: NOTIFICATION_CHANNELS.BILL_REMINDERS,
                      actionTypeId: NOTIFICATION_ACTION_TYPES.BILL_REMINDER,
                      extra: { route: `/todos/${todo.id}`, todoId: todo.id, type: 'todo' },
                      schedule: { at: new Date(Date.now() + 500) },
                      smallIcon: NOTIFICATION_SMALL_ICON,
                      largeIcon: NOTIFICATION_LARGE_ICON,
                      iconColor: FINTRACK_NOTIFICATION_COLOR,
                    }
                  ]
                }).catch(() => {})
              } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(title.startsWith('FinTrack') ? title : `FinTrack • ${title}`, {
                  body: message
                })
              }
            }
          }
        }
      }

      if (habits) {
        for (const habit of habits) {
          if (habit.reminderTime === currentTimeStr) {
            const log = await db.habitLogs.where({ habitId: habit.id, date: todayStr }).first()
            if (!log) {
              const existing = await db.notifications
                .filter(n => n.relatedId === `habit_${habit.id}` && isCreatedToday(n.createdAt))
                .toArray()
                
              if (existing.length === 0) {
                const title = translate(locale, 'notifications.habitTitle', 'Pengingat Kebiasaan')
                const message = `${habit.title} • ${translate(locale, 'notifications.habitBodySuffix', 'Waktunya menyelesaikan target kebiasaan hari ini')}`

                await db.notifications.add({
                  type: 'habit',
                  title,
                  message,
                  read: false,
                  relatedId: `habit_${habit.id}`,
                  createdAt: now.toISOString()
                })
  
                if (Capacitor.isNativePlatform()) {
                  const habitHeader = translate(locale, 'notifications.habitHeader', 'Pelacak Kebiasaan • FinTrack')
                  const habitBullet1 = translate(locale, 'notifications.habitBullet1', '• Target: Konsistensi harian memperkuat kontrol finansial Anda.')
                  const habitBullet2 = translate(locale, 'notifications.habitBullet2', '• Aksi: Buka aplikasi dan tandai progres kebiasaan Anda.')
                  const largeBody = `${habitHeader}\n${habit.title}\n${habitBullet1}\n${habitBullet2}`
                  const summaryText = translate(locale, 'notifications.summaryHabit', 'Disiplin Finansial')

                  await LocalNotifications.schedule({
                    notifications: [
                      {
                        id: Number(habit.id) ? Number(habit.id) + 77000 : Math.floor(Math.random() * 10000) + 77000,
                        title,
                        body: message,
                        largeBody,
                        summaryText,
                        channelId: NOTIFICATION_CHANNELS.BILL_REMINDERS,
                        actionTypeId: NOTIFICATION_ACTION_TYPES.BILL_REMINDER,
                        extra: { route: '/todos' },
                        schedule: { at: new Date(Date.now() + 500) },
                        smallIcon: NOTIFICATION_SMALL_ICON,
                        largeIcon: NOTIFICATION_LARGE_ICON,
                        iconColor: FINTRACK_NOTIFICATION_COLOR,
                      }
                    ]
                  }).catch(() => {})
                } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                  new Notification(title.startsWith('FinTrack') ? title : `FinTrack • ${title}`, {
                    body: message
                  })
                }
              }
            }
          }
        }
      }
    }

    intervalRef.current = setInterval(checkReminders, 30000)
    
    if (todos || habits) {
      checkReminders()
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [todos, habits])
}
