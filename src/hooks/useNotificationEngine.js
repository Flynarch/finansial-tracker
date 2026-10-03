import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Capacitor } from '@capacitor/core'
import { db } from '../lib/db'
import { format } from 'date-fns'
import useSettingsStore from '../store/useSettingsStore'
import { translate } from '../lib/i18n'

export default function useNotificationEngine() {
  const todos = useLiveQuery(() => db.todos.filter((t) => !t.completed).toArray())
  const habits = useLiveQuery(() => db.habits.filter((h) => Boolean(h.reminderEnabled) && !h.isPaused).toArray())
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!Capacitor.isNativePlatform() && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch((err) => console.warn('[useNotificationEngine]', err))
    }

    const checkReminders = async () => {
      const now = new Date()
      const currentTimeStr = format(now, 'HH:mm')
      const todayStr = format(now, 'yyyy-MM-dd')
      const locale = useSettingsStore.getState().locale || 'id'
      const isEn = locale === 'en'

      const isCreatedToday = (createdVal) => {
        if (!createdVal) return false
        try {
          return format(new Date(createdVal), 'yyyy-MM-dd') === todayStr
        } catch (err){
          console.warn('[useNotificationEngine]', err)
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
              const title = translate(locale, 'notifications.todoDueTitle', isEn ? 'Due Today' : 'Jatuh Tempo')
              const message = `${todo.title} • ${translate(locale, 'notifications.todoDueBodySuffix', isEn ? 'due today' : 'jatuh tempo hari ini')}`

              await db.notifications.add({
                type: 'todo',
                title,
                message,
                read: false,
                relatedId: `todo_${todo.id}`,
                createdAt: now.toISOString()
              })

              if (!Capacitor.isNativePlatform() && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(title.startsWith('FinTrack') ? title : `FinTrack • ${title}`, {
                  body: message,
                })
              }
            }
          }
        }
      }

      if (habits) {
        for (const habit of habits) {
          if (habit.reminderTime === currentTimeStr) {
            const log = await db.habitLogs.where('habitId').equals(habit.id).filter(l => l.date === todayStr).first()
            if (!log) {
              const existing = await db.notifications
                .filter(n => n.relatedId === `habit_${habit.id}` && isCreatedToday(n.createdAt))
                .toArray()
                
              if (existing.length === 0) {
                const title = translate(locale, 'notifications.habitTitle', isEn ? 'Habit Reminder' : 'Pengingat Kebiasaan')
                const message = `${habit.title} • ${translate(locale, 'notifications.habitBodySuffix', isEn ? "Time to complete today's target" : 'Waktunya selesaikan target hari ini')}`

                await db.notifications.add({
                  type: 'habit',
                  title,
                  message,
                  read: false,
                  relatedId: `habit_${habit.id}`,
                  createdAt: now.toISOString()
                })
  
                if (!Capacitor.isNativePlatform() && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                  new Notification(title.startsWith('FinTrack') ? title : `FinTrack • ${title}`, {
                    body: message,
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
