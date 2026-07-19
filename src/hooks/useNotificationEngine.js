import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { format } from 'date-fns'

export default function useNotificationEngine() {
  const todos = useLiveQuery(() => db.todos.where('completed').equals(0).toArray())
  const habits = useLiveQuery(() => db.habits.where('reminderEnabled').equals(1).toArray())
  const intervalRef = useRef(null)

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const checkReminders = async () => {
      const now = new Date()
      const currentTimeStr = format(now, 'HH:mm')
      const todayStr = format(now, 'yyyy-MM-dd')

      if (todos) {
        for (const todo of todos) {
          if (todo.reminderTime === currentTimeStr && todo.dueDate === todayStr) {
            const existing = await db.notifications
              .filter(n => n.relatedId === `todo_${todo.id}` && n.createdAt.startsWith(todayStr))
              .toArray()
            
            if (existing.length === 0) {
              await db.notifications.add({
                type: 'todo',
                title: 'Pengingat Tugas',
                message: `Waktunya untuk: ${todo.title}`,
                read: false,
                relatedId: `todo_${todo.id}`,
                createdAt: now.toISOString()
              })

              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Pengingat Tugas', {
                  body: `Waktunya untuk: ${todo.title}`
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
                await db.notifications.add({
                  type: 'habit',
                  title: 'Pengingat Habit',
                  message: `Jangan lupa untuk: ${habit.title}`,
                  read: false,
                  relatedId: `habit_${habit.id}`,
                  createdAt: now.toISOString()
                })
  
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification('Pengingat Habit', {
                    body: `Jangan lupa untuk: ${habit.title}`
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
