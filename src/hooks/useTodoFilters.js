import { useState, useMemo, useCallback } from 'react'

const TODO_SORT_PREF_KEY = 'todo_sort_pref'

export function useTodoFilters(todos = []) {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showCompleted, setShowCompleted] = useState(true)
  const [sortPref, setSortPrefState] = useState(() => {
    try {
      return localStorage.getItem(TODO_SORT_PREF_KEY) || 'dueDate'
    } catch {
      return 'dueDate'
    }
  })

  const setSortPref = useCallback((pref) => {
    setSortPrefState(pref)
    try {
      localStorage.setItem(TODO_SORT_PREF_KEY, pref)
    } catch {
      // ignore
    }
  }, [])

  const filteredTodos = useMemo(() => {
    return (todos || [])
      .filter((todo) => {
        if (!showCompleted && todo.completed) return false
        if (selectedCategory !== 'all' && todo.category !== selectedCategory) return false
        return true
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1
        if (sortPref === 'priority') {
          const pOrder = { high: 0, medium: 1, low: 2 }
          const pA = pOrder[a.priority] ?? 1
          const pB = pOrder[b.priority] ?? 1
          if (pA !== pB) return pA - pB
        }
        if (sortPref === 'dueDate') {
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return a.dueDate.localeCompare(b.dueDate)
        }
        return (b.createdAt || 0) - (a.createdAt || 0)
      })
  }, [todos, selectedCategory, showCompleted, sortPref])

  const categoryCounts = useMemo(() => {
    const counts = {}
    for (const todo of todos || []) {
      const cat = todo.category || 'lainnya'
      counts[cat] = (counts[cat] || 0) + 1
    }
    return counts
  }, [todos])

  return {
    selectedCategory,
    setSelectedCategory,
    showCompleted,
    setShowCompleted,
    sortPref,
    setSortPref,
    filteredTodos,
    categoryCounts,
  }
}
