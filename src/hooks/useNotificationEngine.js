import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { db } from '../lib/db'
import { format } from 'date-fns'
import useSettingsStore from '../store/useSettingsStore'

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
      const isEn = locale === 'en'

      if (todos) {
        for (const todo of todos) {
          if (todo.reminderTime === currentTimeStr && todo.dueDate === todayStr) {
            const existing = await db.notifications
              .filter(n => n.relatedId === `todo_${todo.id}` && n.createdAt.startsWith(todayStr))
              .toArray()
            
            if (existing.length === 0) {
              const title = isEn ? 'Task Reminder' : 'Pengingat Tugas'
              const message = isEn ? `Time for: ${todo.title}` : `Waktunya untuk: ${todo.title}`

              await db.notifications.add({
                type: 'todo',
                title,
                message,
                read: false,
                relatedId: `todo_${todo.id}`,
                createdAt: now.toISOString()
              })

              if (Capacitor.isNativePlatform()) {
                await LocalNotifications.schedule({
                  notifications: [
                    {
                      id: Number(todo.id) ? Number(todo.id) + 88000 : Math.floor(Math.random() * 10000) + 88000,
                      title: `FinTrack • ${title}`,
                      body: message,
                      extra: { route: `/todos/${todo.id}` },
                      schedule: { at: new Date(Date.now() + 500) },
                      smallIcon: 'ic_stat_icon_config_sample',
                    }
                  ]
                }).catch(() => {})
              } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(title, {
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
                .filter(n => n.relatedId === `habit_${habit.id}` && n.createdAt.startsWith(todayStr))
                .toArray()
                
              if (existing.length === 0) {
                const title = isEn ? 'Habit Reminder' : 'Pengingat Habit'
                const message = isEn ? `Don't forget: ${habit.title}` : `Jangan lupa untuk: ${habit.title}`

                await db.notifications.add({
                  type: 'habit',
                  title,
                  message,
                  read: false,
                  relatedId: `habit_${habit.id}`,
                  createdAt: now.toISOString()
                })
  
                if (Capacitor.isNativePlatform()) {
                  await LocalNotifications.schedule({
                    notifications: [
                      {
                        id: Number(habit.id) ? Number(habit.id) + 77000 : Math.floor(Math.random() * 10000) + 77000,
                        title: `FinTrack • ${title}`,
                        body: message,
                        extra: { route: '/todos' },
                        schedule: { at: new Date(Date.now() + 500) },
                        smallIcon: 'ic_stat_icon_config_sample',
                      }
                    ]
                  }).catch(() => {})
                } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                  new Notification(title, {
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
