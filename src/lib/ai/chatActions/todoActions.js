import { format } from 'date-fns'
import { db } from '../../db'

export async function handleTodoAction(result) {
  const newMsgs = []
  const todos = await db.todos.toArray()
  const fuzzyMatch = (str, query) => String(str || '').toLowerCase().includes(String(query || '').toLowerCase())

  if (result.action === 'create') {
    const validCategories = ['tagihan', 'investasi', 'belanja', 'tabungan', 'pekerjaan', 'pribadi', 'kesehatan', 'pendidikan', 'rumah', 'transportasi', 'lainnya']
    const aiCategory = result.category && validCategories.includes(result.category) ? result.category : 'lainnya'
    const todoId = await db.todos.add({
      title: result.title,
      description: result.description || '',
      category: aiCategory,
      dueDate: result.dueDate || format(new Date(), 'yyyy-MM-dd'),
      priority: result.priority || 'medium',
      completed: false,
      reminderTime: result.reminderTime || null,
      createdAt: Date.now(),
    })

    if (result.subTasks && Array.isArray(result.subTasks) && result.subTasks.length > 0) {
      const subTasksToInsert = result.subTasks.map((label) => ({
        todoId,
        label,
        checked: false,
      }))
      await db.sub_tasks.bulkAdd(subTasksToInsert)
    }

    newMsgs.push({
      id: Date.now() + 3,
      role: 'ai',
      type: 'action_success',
      data: {
        type: 'todo',
        action: 'create',
        title: result.title,
        data: {
          id: todoId,
          title: result.title,
          category: aiCategory,
          dueDate: result.dueDate || format(new Date(), 'yyyy-MM-dd'),
          priority: result.priority || 'medium',
          subTasks: result.subTasks || [],
        },
      },
    })
  } else if (result.action === 'complete') {
    const matched = todos.find((t) => !t.completed && fuzzyMatch(t.title, result.title))
    if (matched) {
      await db.todos.update(matched.id, { completed: true })
      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'action_success',
        data: {
          type: 'todo',
          action: 'done',
          title: matched.title,
          data: {
            id: matched.id,
            title: matched.title,
            category: matched.category,
            dueDate: matched.dueDate,
            priority: matched.priority,
          },
        },
      })
    } else {
      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'text',
        content: `Tugas aktif yang mirip dengan "${result.title}" tidak ditemukan.`,
      })
    }
  }

  return newMsgs
}
