import { format } from 'date-fns'
import { db } from '../../db'

export async function handleHabitAction(result) {
  const newMsgs = []
  const habits = await db.habits.toArray()
  const fuzzyMatch = (str, query) => String(str || '').toLowerCase().includes(String(query || '').toLowerCase())

  if (result.action === 'create') {
    const newHabit = {
      title: result.title,
      color: result.color || 'indigo',
      category: 'Lainnya',
      frequencyType: result.frequencyType || 'daily',
      frequencyValue: null,
      reminderEnabled: Boolean(result.reminderTime),
      reminderTime: result.reminderTime || null,
      createdAt: Date.now(),
    }
    const newHabitId = await db.habits.add(newHabit)
    newMsgs.push({
      id: Date.now() + 3,
      role: 'ai',
      type: 'action_success',
      data: {
        type: 'habit',
        action: 'create',
        title: result.title,
        data: {
          id: newHabitId,
          title: result.title,
          color: result.color || 'indigo',
          frequencyType: result.frequencyType || 'daily',
        },
      },
    })
  } else if (result.action === 'log') {
    const matched = habits.find((h) => fuzzyMatch(h.title, result.title))
    if (matched) {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const existingLog = await db.habitLogs.where({ habitId: matched.id, date: todayStr }).first()
      if (!existingLog) {
        await db.habitLogs.add({ habitId: matched.id, date: todayStr })
      }
      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'action_success',
        data: {
          type: 'habit',
          action: 'log',
          title: matched.title,
          data: {
            id: matched.id,
            title: matched.title,
            color: matched.color || 'indigo',
            frequencyType: matched.frequencyType || 'daily',
          },
        },
      })
    } else {
      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'text',
        content: `Habit yang mirip dengan "${result.title}" tidak ditemukan di daftar Anda.`,
      })
    }
  } else if (result.action === 'log_all') {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    let count = 0
    for (const h of habits) {
      const existingLog = await db.habitLogs.where({ habitId: h.id, date: todayStr }).first()
      if (!existingLog) {
        await db.habitLogs.add({ habitId: h.id, date: todayStr })
        count++
      }
    }
    if (count > 0) {
      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'action_success',
        data: {
          type: 'habit',
          action: 'log_all',
          subtitle: `${count} habit berhasil dicentang`,
        },
      })
    } else {
      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'text',
        content: 'Semua habit sudah dicentang sebelumnya hari ini! Luar biasa!',
      })
    }
  }

  return newMsgs
}
