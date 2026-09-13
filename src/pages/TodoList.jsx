import { addDays, format, parse } from 'date-fns'
import { id as idLocale, enUS as enLocale } from 'date-fns/locale'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import { Plus } from 'lucide-react'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import HabitsView from '../components/habits/HabitsView'
import useSwipeAction from '../hooks/useSwipeAction'
import { triggerHaptic } from '../lib/haptics'
import { TodoItemCard } from '../components/todos/TodoItemCard'
import TodoCreateModal from '../components/todos/TodoCreateModal'

const TODO_SORT_PREF_KEY = 'todo_sort_pref'
const TODO_NOTIF_PERMISSION_KEY = 'todo_notif_permission_asked_v1'

function TodoList() {
  const navigate = useNavigate()
  const { t, locale } = useTranslation()
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const [activeTab, setActiveTab] = useState('todo')
  const [filter, setFilter] = useState(() => 'all')
  const [isEntering, setIsEntering] = useState(false)
  const [sortPref, setSortPref] = useState(() => {
    if (typeof window === 'undefined') return 'latest'
    const raw = window.localStorage.getItem(TODO_SORT_PREF_KEY)
    if (raw === 'latest' || raw === 'priority' || raw === 'due') return raw
    return 'latest'
  })
  const [sortOpen, setSortOpen] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(() => ({
    title: '',
    description: '',
    category: 'tagihan',
    dueDate: '',
    priority: 'medium',
  }))

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTodoId, setDeleteTodoId] = useState(null)

  const {
    swipedId: swipeTodoId,
    setSwipedId: setSwipeTodoId,
    swipeIdRef: swipeTodoIdRef,
    swipeStartXRef,
    swipeStartYRef,
    swipeDxRef,
    ignoreNextClickRef,
  } = useSwipeAction()
  const rafIdRef = useRef(null)
  const [notifPermissionAsked, setNotifPermissionAsked] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(TODO_NOTIF_PERMISSION_KEY) === '1'
  })

  const todos = useLiveQuery(() => db.todos.orderBy('createdAt').reverse().toArray(), [])
  const allSubTasks = useLiveQuery(() => db.sub_tasks.toArray(), [])
  const isDataReady = Array.isArray(todos) && Array.isArray(allSubTasks)

  const subProgressByTodo = useMemo(() => {
    const map = new Map()
    ;(allSubTasks || []).forEach((row) => {
      const tid = Number(row?.todoId)
      if (!tid) return
      const cur = map.get(tid) || { total: 0, done: 0 }
      cur.total += 1
      if (row?.checked) cur.done += 1
      map.set(tid, cur)
    })
    return map
  }, [allSubTasks])

  const filteredTodos = useMemo(() => {
    const list = todos || []
    if (filter === 'active') return list.filter((x) => !x?.completed)
    if (filter === 'completed') return list.filter((x) => x?.completed)
    return list
  }, [todos, filter])

  const todoCounts = useMemo(() => {
    const list = todos || []
    const all = list.length
    const completed = list.filter((x) => Boolean(x?.completed)).length
    return { all, active: all - completed, completed }
  }, [todos])

  const sortedTodos = useMemo(() => {
    const list = filteredTodos || []
    const next = list.slice()
    const tieBreak = (a, b) => {
      const created = Number(b?.createdAt || 0) - Number(a?.createdAt || 0)
      if (created !== 0) return created
      return Number(b?.id || 0) - Number(a?.id || 0)
    }

    if (sortPref === 'priority') {
      const score = { high: 3, medium: 2, low: 1 }
      next.sort((a, b) => {
        const prio = (score[b?.priority] || 0) - (score[a?.priority] || 0)
        if (prio !== 0) return prio
        return tieBreak(a, b)
      })
      return next
    }

    if (sortPref === 'due') {
      const dueScore = (x) => {
        if (!x?.dueDate) return Number.POSITIVE_INFINITY
        const d = parse(String(x.dueDate), 'yyyy-MM-dd', new Date())
        const timeVal = d && Number.isFinite(d.getTime()) ? d.getTime() : Number.POSITIVE_INFINITY
        return timeVal
      }
      next.sort((a, b) => {
        const due = dueScore(a) - dueScore(b)
        if (due !== 0) return due
        return tieBreak(a, b)
      })
      return next
    }

    next.sort((a, b) => tieBreak(a, b))
    return next
  }, [filteredTodos, sortPref])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  useEffect(() => {
    const onPointerDown = (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (target.closest('[data-todo-popover="sort"]')) return
      setSortOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(TODO_SORT_PREF_KEY, sortPref)
  }, [sortPref])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    if (notifPermissionAsked) return
    if (!(todos || []).some((x) => Boolean(x?.dueDate))) return

    void LocalNotifications.requestPermissions()
      .then(() => {
        setNotifPermissionAsked(true)
        window.localStorage.setItem(TODO_NOTIF_PERMISSION_KEY, '1')
      })
      .catch(() => {})
  }, [todos, notifPermissionAsked])

  const scheduleTodoDueNotifications = useCallback(async (todo) => {
    if (!Capacitor.isNativePlatform()) return
    const id = Number(todo?.id)
    if (!id) return
    const rawDate = String(todo?.dueDate || '').trim()
    if (!rawDate) return

    const parsedDate = parse(rawDate, 'yyyy-MM-dd', new Date())
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) return

    const timeStr = String(todo?.reminderTime || '09:00').trim()
    const [hh, mm] = timeStr.split(':').map((x) => Number(x) || 0)

    const scheduleDate = new Date(parsedDate)
    scheduleDate.setHours(hh, mm, 0, 0)

    const now = new Date()
    const notifs = []

    if (scheduleDate > now) {
      notifs.push({
        id: id * 10 + 1,
        title: t('todo.notif.dueTodayTitle', 'Tenggat Tugas Hari Ini'),
        body: todo.title,
        schedule: { at: scheduleDate },
        extra: { route: `/todos/${id}`, todoId: id },
      })
    }

    const dMinus1 = new Date(scheduleDate)
    dMinus1.setDate(dMinus1.getDate() - 1)
    if (dMinus1 > now) {
      notifs.push({
        id: id * 10 + 2,
        title: t('todo.notif.dueTomorrowTitle', 'Pengingat Tugas Besok'),
        body: t('todo.notif.dueTomorrowBody', 'Besok: {{title}}', { title: todo.title }),
        schedule: { at: dMinus1 },
        extra: { route: `/todos/${id}`, todoId: id },
      })
    }

    if (notifs.length > 0) {
      try {
        await LocalNotifications.schedule({ notifications: notifs })
      } catch {
        // ignore
      }
    }
  }, [t])

  const cancelTodoDueNotifications = useCallback(async (todoId) => {
    if (!Capacitor.isNativePlatform()) return
    const id = Number(todoId)
    if (!id) return
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: id * 10 + 1 }, { id: id * 10 + 2 }],
      })
    } catch {
      // ignore
    }
  }, [])

  const dueStatus = useCallback((dueDate) => {
    if (!dueDate) return null
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
      if (dueDate < today) return { key: 'overdue', label: t('todo.due.overdue', 'Terlewat'), borderClass: 'border-rose-500/50' }
      if (dueDate === today) return { key: 'today', label: t('todo.due.today', 'Hari Ini'), borderClass: 'border-amber-500/50' }
      if (dueDate === tomorrow) return { key: 'tomorrow', label: t('todo.due.tomorrow', 'Besok'), borderClass: 'border-sky-500/40' }
      const parsed = parse(dueDate, 'yyyy-MM-dd', new Date())
      const dateLocale = locale === 'en' ? enLocale : idLocale
      return { key: 'upcoming', label: format(parsed, 'd MMM', { locale: dateLocale }), borderClass: '' }
    } catch {
      return null
    }
  }, [t, locale])

  const dueBadgeClass = useCallback((status) => {
    if (!status) return ''
    if (status.key === 'overdue') return 'bg-[var(--status-expense-soft)] text-[var(--status-expense)] border border-[var(--status-expense)]/30'
    if (status.key === 'today') return 'bg-[var(--warning)]/15 text-[var(--warning)] border border-[var(--warning)]/30'
    if (status.key === 'tomorrow') return 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)]'
    return 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)]'
  }, [])

  const resetAddForm = () => {
    setAddForm({
      title: '',
      description: '',
      category: 'tagihan',
      dueDate: '',
      priority: 'medium',
    })
  }

  const handleAddTodo = async (event) => {
    event.preventDefault()
    const title = String(addForm.title || '').trim()
    if (!title) return
    const dueDate = addForm.dueDate || ''
    const reminderTime = dueDate ? (addForm.reminderTime || '09:00') : ''
    const id = await db.todos.add({
      title,
      description: String(addForm.description || '').trim(),
      category: addForm.category,
      dueDate,
      reminderTime,
      priority: addForm.priority,
      completed: false,
      createdAt: Date.now(),
    })
    if (dueDate) {
      void scheduleTodoDueNotifications({ id, ...addForm, title, dueDate, reminderTime })
    }
    resetAddForm()
    setAddOpen(false)
  }

  const toggleCardComplete = useCallback(async (todoId, currentCompleted) => {
    const id = Number(todoId)
    if (!id) return
    const next = !currentCompleted
    triggerHaptic(next ? 'success' : 'light')
    await db.transaction('rw', db.todos, db.sub_tasks, async () => {
      await db.todos.update(id, { completed: next })
      await db.sub_tasks.where('todoId').equals(id).modify({ checked: next })
    })
    if (next) {
      void cancelTodoDueNotifications(id)
    }
  }, [cancelTodoDueNotifications])

  const onDeleteTodoFromCard = useCallback((todo) => {
    setDeleteTodoId(todo.id)
    setDeleteConfirmOpen(true)
  }, [])

  const removeTodo = async () => {
    if (!deleteTodoId) return
    const id = Number(deleteTodoId)
    void cancelTodoDueNotifications(id)
    await db.transaction('rw', db.todos, db.sub_tasks, async () => {
      await db.sub_tasks.where('todoId').equals(id).delete()
      await db.todos.delete(id)
    })
    setDeleteConfirmOpen(false)
    setDeleteTodoId(null)
  }

  const pillClass = (active) =>
    `flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-bold transition-all duration-300 ${
      active ? 'bg-[var(--fg)] text-[var(--bg)] shadow-xs' : 'bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)]'
    }`

  return (
    <div>
      <div
        className={`ft-motion-page min-h-full space-y-4 transform-gpu pb-2 ${
          isEntering ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        <PageHeader
          title={t('todo.pageTitle')}
          titlePosition="left"
          className="px-1 !mb-0"
          rightAction={
            activeTab === 'todo' ? (
              <button
                type="button"
                onClick={() => {
                  resetAddForm()
                  setAddOpen(true)
                }}
                className="flex items-center gap-1.5 min-h-[44px] rounded-2xl bg-[var(--accent)] px-4 py-2 text-xs font-extrabold text-white shadow-md transition-all active:scale-95 cursor-pointer ft-smooth-in"
                aria-label={t('todo.add')}
              >
                <Plus size={15} strokeWidth={3} />
                <span>{t('todo.addShort', 'Tugas')}</span>
              </button>
            ) : null
          }
        />

        {/* Segmented Control with Smooth Sliding Indicator */}
        <div className="relative grid grid-cols-2 rounded-[1rem] bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] p-1 border border-[color-mix(in_srgb,var(--border)_50%,transparent)] shadow-inner select-none overflow-hidden">
          {/* Sliding Animated Pill */}
          <div
            className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-[0.75rem] bg-[var(--panel-strong)] shadow-[var(--shadow-card)] ring-1 ring-[color-mix(in_srgb,var(--border)_80%,transparent)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform-gpu ${
              activeTab === 'todo' ? 'translate-x-0' : 'translate-x-[calc(100%+4px)]'
            }`}
          />

          <button
            type="button"
            className={`relative z-10 flex-1 rounded-[0.75rem] py-2.5 text-[14px] font-bold transition-colors duration-200 cursor-pointer active:scale-[0.98] ${
              activeTab === 'todo'
                ? 'text-[var(--fg)]'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
            onClick={() => {
              triggerHaptic('light')
              setActiveTab('todo')
            }}
          >
            Tasks
          </button>
          <button
            type="button"
            className={`relative z-10 flex-1 rounded-[0.75rem] py-2.5 text-[14px] font-bold transition-colors duration-200 cursor-pointer active:scale-[0.98] ${
              activeTab === 'habits'
                ? 'text-[var(--fg)]'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
            onClick={() => {
              triggerHaptic('light')
              setActiveTab('habits')
            }}
          >
            Habits
          </button>
        </div>

        {activeTab === 'habits' && (
          <div key="tab-habits" className="ft-smooth-in">
            <HabitsView />
          </div>
        )}
        {activeTab === 'todo' && (
          <div key="tab-todo" className="space-y-5 ft-smooth-in">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 pl-0.5 min-w-0 flex-1 whitespace-nowrap">
                <button type="button" className={pillClass(filter === 'all')} onClick={() => setFilter('all')}>
                  {t('todo.filter.all')} <span className="ml-1 opacity-60">({todoCounts.all})</span>
                </button>
                <button type="button" className={pillClass(filter === 'active')} onClick={() => setFilter('active')}>
                  {t('todo.filter.active')} <span className="ml-1 opacity-60">({todoCounts.active})</span>
                </button>
                <button type="button" className={pillClass(filter === 'completed')} onClick={() => setFilter('completed')}>
                  {t('todo.filter.completed')} <span className="ml-1 opacity-60">({todoCounts.completed})</span>
                </button>
              </div>

              <div className="relative flex-shrink-0 mt-[-4px]" data-todo-popover="sort">
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--fg)] transition-colors active:scale-95 cursor-pointer"
                  onClick={() => setSortOpen((v) => !v)}
                  aria-expanded={sortOpen}
                  aria-label={t('todo.sort.title')}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                </button>
                <div
                  className={`absolute right-0 top-[calc(100%+0.5rem)] z-30 origin-top-right transition-all duration-200 w-48 ${
                    sortOpen ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-[0.98] opacity-0'
                  }`}
                >
                  <div className="space-y-1 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-1.5 shadow-xl">
                    <button
                      type="button"
                      className={`w-full rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition cursor-pointer ${
                        sortPref === 'latest' ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--fg)] hover:bg-[var(--panel)]'
                      }`}
                      onClick={() => {
                        setSortPref('latest')
                        setSortOpen(false)
                      }}
                    >
                      {t('todo.sort.latest')}
                    </button>
                    <button
                      type="button"
                      className={`w-full rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition cursor-pointer ${
                        sortPref === 'priority' ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--fg)] hover:bg-[var(--panel)]'
                      }`}
                      onClick={() => {
                        setSortPref('priority')
                        setSortOpen(false)
                      }}
                    >
                      {t('todo.sort.priority')}
                    </button>
                    <button
                      type="button"
                      className={`w-full rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition cursor-pointer ${
                        sortPref === 'due' ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--fg)] hover:bg-[var(--panel)]'
                      }`}
                      onClick={() => {
                        setSortPref('due')
                        setSortOpen(false)
                      }}
                    >
                      {t('todo.sort.due')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {!isDataReady ? (
              <ul className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${reduceMotion ? '' : 'ft-sheet-enter'}`}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <li key={`todo-skeleton-${i}`}>
                    <div className="h-[8.75rem] rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3 shadow-[var(--shadow-card)]">
                      <div className="h-full animate-pulse rounded-xl bg-[color-mix(in_srgb,var(--field-bg)_70%,transparent)]" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : !sortedTodos?.length ? (
              <EmptyState
                title={t('todo.emptyState.title', 'Tidak ada tugas')}
                description={
                  filter === 'all'
                    ? t('todo.emptyState.all')
                    : filter === 'active'
                    ? t('todo.emptyState.active')
                    : t('todo.emptyState.completed')
                }
                action={
                  filter === 'all' ? (
                    <button
                      type="button"
                      onClick={() => { resetAddForm(); setAddOpen(true) }}
                      className="mt-2 inline-flex items-center gap-1.5 min-h-[44px] rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      <Plus size={15} strokeWidth={2.5} />
                      <span>{t('todo.addBtn', 'Tambah Tugas')}</span>
                    </button>
                  ) : null
                }
              />
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {sortedTodos.map((todo) => (
                  <TodoItemCard
                    key={todo.id}
                    todo={todo}
                    subProgress={subProgressByTodo.get(Number(todo.id))}
                    isSwiping={swipeTodoId === String(todo.id)}
                    setSwipeTodoId={setSwipeTodoId}
                    swipeTodoIdRef={swipeTodoIdRef}
                    swipeStartXRef={swipeStartXRef}
                    swipeStartYRef={swipeStartYRef}
                    swipeDxRef={swipeDxRef}
                    ignoreNextClickRef={ignoreNextClickRef}
                    rafIdRef={rafIdRef}
                    toggleCardComplete={toggleCardComplete}
                    openDetail={(id) => navigate(`/todos/${id}`)}
                    onDeleteTodoFromCard={onDeleteTodoFromCard}
                    dueStatus={dueStatus}
                    dueBadgeClass={dueBadgeClass}
                    t={t}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Todo Create Modal */}
      <TodoCreateModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        addForm={addForm}
        setAddForm={setAddForm}
        onSubmit={handleAddTodo}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false)
          setDeleteTodoId(null)
        }}
        onConfirm={() => void removeTodo()}
        title={t('todo.delete')}
        message={t('todo.deleteConfirm')}
      />
    </div>
  )
}

export default TodoList
