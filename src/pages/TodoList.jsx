import { addDays, format, parse } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import HabitsView from '../components/habits/HabitsView'
import IdeaBoard from './IdeaBoard'
import { ErrorBoundary } from '../components/ErrorBoundary'
import useSwipeAction from '../hooks/useSwipeAction'

const TODO_CATEGORIES = ['tagihan', 'investasi', 'belanja', 'tabungan', 'lainnya']
const PRIORITIES = ['low', 'medium', 'high']
const TODO_SORT_PREF_KEY = 'todo_sort_pref'
const TODO_NOTIF_PERMISSION_KEY = 'todo_notif_permission_asked_v1'

function priorityClass(p) {
  if (p === 'high') return 'bg-rose-500'
  if (p === 'medium') return 'bg-amber-400'
  return 'bg-slate-400'
}

const updateBgVisual = (bgEl, mode) => {
  if (!bgEl || bgEl.dataset.swipeMode === mode) return
  bgEl.dataset.swipeMode = mode
  bgEl.classList.remove('opacity-0', 'opacity-100', 'bg-rose-500/15', 'text-rose-500', 'justify-end', 'bg-emerald-500/15', 'text-emerald-500', 'justify-start', 'justify-between')
  if (mode === 'delete') {
    bgEl.classList.add('opacity-100', 'bg-rose-500/15', 'text-rose-500', 'justify-end')
    bgEl.innerHTML = '<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>'
  } else if (mode === 'complete') {
    bgEl.classList.add('opacity-100', 'bg-emerald-500/15', 'text-emerald-500', 'justify-start')
    bgEl.innerHTML = '<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>'
  } else {
    bgEl.classList.add('opacity-0', 'justify-between')
    bgEl.innerHTML = ''
  }
}

const TodoItemCard = memo(function TodoItemCard({
  todo,
  subProgress,
  isSwiping,
  setSwipeTodoId,
  swipeTodoIdRef,
  swipeStartXRef,
  swipeStartYRef,
  swipeDxRef,
  ignoreNextClickRef,
  rafIdRef,
  toggleCardComplete,
  openDetail,
  onDeleteTodoFromCard,
  dueStatus,
  dueBadgeClass,
  formatDue,
  t,
}) {
  const showProg = subProgress && subProgress.total > 0
  const doneStyle = todo.completed ? 'opacity-60' : ''
  const dimCompleted = todo.completed ? 'opacity-70' : ''
  const status = dueStatus(todo.dueDate)
  const dueBadgeCls = dueBadgeClass(status)

  return (
    <li key={todo.id}>
      <div className="relative">
        {/* Progressive Swipe Background */}
        <div 
          className="absolute inset-0 z-0 flex items-center justify-between rounded-[1.25rem] px-5 opacity-0 transition-colors duration-200"
        >
        </div>

        <div
          className={`relative z-10 flex h-full touch-pan-y flex-col rounded-[1.25rem] border border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[var(--panel-strong)] p-4 shadow-[var(--shadow-card)] transition-colors ${doneStyle} ${dimCompleted} ${status?.borderClass || ''} `}
          style={{
            transform: isSwiping ? undefined : 'translateX(0px)',
            transition: isSwiping ? 'none' : 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            willChange: isSwiping ? 'transform' : 'auto',
          }}
          onTouchStart={(e) => {
            if (e.touches.length !== 1) return
            if (rafIdRef.current) {
              cancelAnimationFrame(rafIdRef.current)
              rafIdRef.current = null
            }
            const touch = e.touches[0]
            swipeTodoIdRef.current = String(todo.id)
            swipeStartXRef.current = touch.clientX
            swipeStartYRef.current = touch.clientY
            swipeDxRef.current = 0
            ignoreNextClickRef.current = false
            setSwipeTodoId(String(todo.id))
            e.currentTarget.style.transition = 'none'
            e.currentTarget.style.willChange = 'transform'
          }}
          onTouchMove={(e) => {
            if (swipeTodoIdRef.current !== String(todo.id)) return
            const touch = e.touches[0]
            const dx = touch.clientX - swipeStartXRef.current
            const dy = touch.clientY - swipeStartYRef.current
            const absDy = Math.abs(dy)

            if (absDy > Math.abs(dx) * 1.2 && Math.abs(dy) > 10 && Math.abs(dx) < 15) {
              if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current)
                rafIdRef.current = null
              }
              swipeTodoIdRef.current = null
              setSwipeTodoId(null)
              const currentTarget = e.currentTarget
              currentTarget.style.transition = 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)'
              currentTarget.style.transform = 'translateX(0px)'
              currentTarget.style.willChange = 'auto'
              updateBgVisual(currentTarget.previousElementSibling, 'none')
              return
            }

            let totalDx = dx
            swipeDxRef.current = Math.max(-120, Math.min(120, totalDx))

            if (rafIdRef.current !== null) return
            const currentTarget = e.currentTarget
            const bgEl = currentTarget.previousElementSibling

            rafIdRef.current = requestAnimationFrame(() => {
              rafIdRef.current = null
              if (swipeTodoIdRef.current !== String(todo.id)) return
              const currentDx = swipeDxRef.current
              currentTarget.style.transform = `translateX(${currentDx}px)`
              if (currentDx <= -60) {
                updateBgVisual(bgEl, 'delete')
              } else if (currentDx >= 60) {
                updateBgVisual(bgEl, 'complete')
              } else {
                updateBgVisual(bgEl, 'none')
              }
            })
          }}
          onTouchEnd={(e) => {
            if (swipeTodoIdRef.current !== String(todo.id)) return
            if (rafIdRef.current) {
              cancelAnimationFrame(rafIdRef.current)
              rafIdRef.current = null
            }
            const finalDx = swipeDxRef.current
            swipeTodoIdRef.current = null
            setSwipeTodoId(null)
            
            const currentTarget = e.currentTarget
            currentTarget.style.transition = 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            currentTarget.style.transform = 'translateX(0px)'
            currentTarget.style.willChange = 'auto'
            
            updateBgVisual(currentTarget.previousElementSibling, 'none')

            if (finalDx <= -60) {
              onDeleteTodoFromCard(todo.id)
            } else if (finalDx >= 60) {
              void toggleCardComplete({ stopPropagation: () => {} }, todo)
              ignoreNextClickRef.current = true
              setTimeout(() => { ignoreNextClickRef.current = false }, 100)
            }
          }}
        >
        <button
          type="button"
          className={`absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border-[2.5px] transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${todo.completed ? 'border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)] shadow-md' : 'border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] hover:border-[var(--fg)] hover:shadow-sm'}`}
          aria-label={todo.completed ? t('todo.uncomplete') : t('todo.complete')}
          onClick={(e) => {
            if (ignoreNextClickRef.current) {
              ignoreNextClickRef.current = false
              return
            }
            void toggleCardComplete(e, todo)
          }}
        >
          {todo.completed ? (
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 scale-100 transition-transform duration-200"
              fill="currentColor"
              aria-hidden
            >
              <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
            </svg>
          ) : null}
        </button>
        <button
          type="button"
          className="min-h-[8rem] w-full pr-12 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 flex flex-col justify-between"
          onClick={() => {
            if (ignoreNextClickRef.current) {
              ignoreNextClickRef.current = false
              return
            }
            openDetail(todo.id)
          }}
        >
          <div>
            <p
              className={`line-clamp-2 break-words pr-1 text-[15px] font-bold leading-snug text-[var(--fg)] ${
                todo.completed ? 'line-through opacity-70' : ''
              }`}
              title={todo.title}
            >
              {todo.title}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-block rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
              {t(`todo.cat.${todo.category || 'lainnya'}`)}
            </span>
            {status ? (
              <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${dueBadgeCls}`}>
                {status.label}
              </span>
            ) : null}
          </div>
          {todo.dueDate ? (
            <p className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-[var(--muted)]">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 mr-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              {formatDue(todo.dueDate)}
            </p>
          ) : null}
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${priorityClass(todo.priority)}`} title={t(`todo.priority.${todo.priority || 'medium'}`)} />
            {showProg ? (
              <span className="text-[10px] font-medium text-[var(--muted)]">
                {t('todo.progress', { done: subProgress.done, total: subProgress.total })}
              </span>
            ) : null}
          </div>
        </button>
        </div>
      </div>
    </li>
  )
}, (prevProps, nextProps) => {
  const prevProg = prevProps.subProgress
  const nextProg = nextProps.subProgress
  const subProgEqual = prevProg === nextProg || (
    Boolean(prevProg) === Boolean(nextProg) &&
    (!prevProg || (prevProg.done === nextProg.done && prevProg.total === nextProg.total))
  )

  return (
    prevProps.todo === nextProps.todo &&
    prevProps.isSwiping === nextProps.isSwiping &&
    (prevProps.confirmDeleteId === Number(prevProps.todo.id)) === (nextProps.confirmDeleteId === Number(nextProps.todo.id)) &&
    subProgEqual &&
    prevProps.t === nextProps.t &&
    prevProps.dueStatus === nextProps.dueStatus &&
    prevProps.dueBadgeClass === nextProps.dueBadgeClass &&
    prevProps.formatDue === nextProps.formatDue
  )
})

function TodoList() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const [activeTab, setActiveTab] = useState('todo')
  const [isBoardOpen, setIsBoardOpen] = useState(false)
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
  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const [addForm, setAddForm] = useState(() => ({
    title: '',
    description: '',
    category: 'tagihan',
    dueDate: '',
    priority: 'medium',
  }))

  const [detailId, setDetailId] = useState(null)
  const [detailEdit, setDetailEdit] = useState(false)
  const [detailCategoryOpen, setDetailCategoryOpen] = useState(false)
  const [detailSubTasksLoading, setDetailSubTasksLoading] = useState(false)
  const [detailSubTasksLeaving, setDetailSubTasksLeaving] = useState(false)
  const [detailHydrating, setDetailHydrating] = useState(false)
  const [detailDraft, setDetailDraft] = useState(null)
  const [newSubLabel, setNewSubLabel] = useState('')
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
  const detailLoadStartedAtRef = useRef(0)
  const rafIdRef = useRef(null)
  const [notifPermissionAsked, setNotifPermissionAsked] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(TODO_NOTIF_PERMISSION_KEY) === '1'
  })

  const todos = useLiveQuery(() => db.todos.orderBy('createdAt').reverse().toArray(), [])
  const allSubTasks = useLiveQuery(() => db.sub_tasks.toArray(), [])
  const detailSubTasks = useLiveQuery(
    () => {
      if (!detailId) return Promise.resolve([])
      return db.sub_tasks.where('todoId').equals(Number(detailId)).sortBy('id')
    },
    [detailId],
  )
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
        const t = d && Number.isFinite(d.getTime()) ? d.getTime() : Number.POSITIVE_INFINITY
        return t
      }
      next.sort((a, b) => {
        const due = dueScore(a) - dueScore(b)
        if (due !== 0) return due
        return tieBreak(a, b)
      })
      return next
    }

    // latest (default): createdAt descending
    next.sort((a, b) => tieBreak(a, b))
    return next
  }, [filteredTodos, sortPref])

  const selectedTodo = useMemo(() => {
    if (!detailId || !todos) return null
    return todos.find((row) => Number(row?.id) === Number(detailId)) || null
  }, [detailId, todos])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  useEffect(() => {
    const closePopovers = () => {
      setSortOpen(false)
      setAddCategoryOpen(false)
      setDetailCategoryOpen(false)
    }
    window.addEventListener('scroll', closePopovers, { passive: true })
    return () => window.removeEventListener('scroll', closePopovers)
  }, [])

  useEffect(() => {
    const onPointerDown = (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (target.closest('[data-todo-popover="sort"]')) return
      if (target.closest('[data-todo-popover="add-category"]')) return
      if (target.closest('[data-todo-popover="detail-category"]')) return
      setSortOpen(false)
      setAddCategoryOpen(false)
      setDetailCategoryOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(TODO_SORT_PREF_KEY, sortPref)
  }, [sortPref])

  useEffect(() => {
    if (!detailId) return
    if (!Array.isArray(detailSubTasks)) return
    const elapsed = Date.now() - detailLoadStartedAtRef.current
    const MIN_LOADING_MS = 120
    const waitMs = Math.max(0, MIN_LOADING_MS - elapsed)
    window.setTimeout(() => {
      setDetailSubTasksLoading(false)
      setDetailSubTasksLeaving(true)
      window.setTimeout(() => setDetailSubTasksLeaving(false), 140)
      window.setTimeout(() => setDetailHydrating(false), 0)
    }, waitMs)
  }, [detailId, detailSubTasks])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    if (notifPermissionAsked) return
    if (!(todos || []).some((x) => Boolean(x?.dueDate))) return

    // Ask permission only once: first time there's any todo with due date.
    void LocalNotifications.requestPermissions()
      .then(() => {
        setNotifPermissionAsked(true)
        window.localStorage.setItem(TODO_NOTIF_PERMISSION_KEY, '1')
      })
      .catch(() => {
        // Permission denied or plugin unavailable: silently ignore.
      })
  }, [todos, notifPermissionAsked])

  const formatDue = useCallback((dueStr) => {
    if (!dueStr) return ''
    // Required format: "12 Mei 2026" using Indonesian locale.
    return format(new Date(String(dueStr)), 'dd MMM yyyy', { locale: idLocale })
  }, [])

  const dueStatus = useCallback(
    (dueStr) => {
      if (!dueStr) return null
      const dueKey = String(dueStr)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueKey)) return null

      const todayKey = format(new Date(), 'yyyy-MM-dd')
      const tomorrowKey = format(addDays(new Date(todayKey + 'T00:00:00'), 1), 'yyyy-MM-dd')

      if (dueKey === todayKey) {
        return { kind: 'today', label: t('todo.due.today'), borderClass: 'border-yellow-400' }
      }
      if (dueKey === tomorrowKey) {
        return { kind: 'tomorrow', label: t('todo.due.tomorrow'), borderClass: 'border-sky-400' }
      }
      if (dueKey < todayKey) {
        return { kind: 'overdue', label: t('todo.due.overdue'), borderClass: 'border-rose-500' }
      }
      return null
    },
    [t],
  )

  const dueBadgeClass = useCallback((status) => {
    if (!status) return null
    if (status.kind === 'today') return 'border-yellow-300 bg-yellow-50 text-yellow-800'
    if (status.kind === 'tomorrow') return 'border-sky-300 bg-sky-50 text-sky-800'
    if (status.kind === 'overdue') return 'border-rose-300 bg-rose-50 text-rose-800'
    return null
  }, [])

  const notifIdFor = useCallback((todoId, offset) => {
    // We need two different ids (H-1 and H-0) but the base still comes from todo.id.
    // H-0: todoId, H-1: todoId + 1_000_000
    if (offset === 'h0') return todoId
    return todoId + 1_000_000
  }, [])

  const cancelTodoDueNotifications = useCallback(
    async (todoId) => {
      if (!Capacitor.isNativePlatform()) return
      const id = Number(todoId)
      if (!Number.isFinite(id) || id <= 0) return
      try {
        await LocalNotifications.cancel({
          notifications: [{ id: notifIdFor(id, 'h0') }, { id: notifIdFor(id, 'h1') }],
        })
      } catch {
        // Ignore plugin errors. Not worth blocking UI.
      }
    },
    [notifIdFor],
  )

  const scheduleTodoDueNotifications = useCallback(
    async (todo) => {
      if (!Capacitor.isNativePlatform()) return
      const dueDate = String(todo?.dueDate || '')
      if (!dueDate) return
      const todoId = Number(todo?.id)
      const title = String(todo?.title || '').trim()
      if (!Number.isFinite(todoId) || todoId <= 0 || !title) return

      // Ensure permission (best effort). If permission is not granted, schedule will throw and we ignore it.
      if (!notifPermissionAsked) {
        try {
          await LocalNotifications.requestPermissions()
          setNotifPermissionAsked(true)
          window.localStorage.setItem(TODO_NOTIF_PERMISSION_KEY, '1')
        } catch {
          return
        }
      }

      const dueParsed = parse(dueDate, 'yyyy-MM-dd', new Date())
      if (Number.isNaN(dueParsed.getTime())) return

      const h0At = new Date(dueParsed)
      h0At.setHours(9, 0, 0, 0)
      const h1At = addDays(h0At, -1)

      const now = new Date()
      // Avoid scheduling in the past to prevent immediate popups.
      const shouldScheduleH0 = h0At.getTime() > now.getTime()
      const shouldScheduleH1 = h1At.getTime() > now.getTime()
      if (!shouldScheduleH0 && !shouldScheduleH1) return

      try {
        await cancelTodoDueNotifications(todoId)
        const notifications = []
        if (shouldScheduleH1) {
          notifications.push({
            title: 'To-Do Jatuh Tempo!',
            body: `${title} jatuh tempo besok`,
            id: notifIdFor(todoId, 'h1'),
            schedule: { at: h1At },
          })
        }
        if (shouldScheduleH0) {
          notifications.push({
            title: 'To-Do Jatuh Tempo!',
            body: `${title} jatuh tempo hari ini`,
            id: notifIdFor(todoId, 'h0'),
            schedule: { at: h0At },
          })
        }

        if (notifications.length > 0) {
          await LocalNotifications.schedule({ notifications })
        }
      } catch {
        // Ignore scheduling errors.
      }
    },
    [cancelTodoDueNotifications, notifIdFor, notifPermissionAsked],
  )

  const resetAddForm = () => {
    setAddForm({
      title: '',
      description: '',
      category: 'tagihan',
      dueDate: '',
      priority: 'medium',
    })
    setAddCategoryOpen(false)
  }

  const openDetail = useCallback((id) => {
    detailLoadStartedAtRef.current = Date.now()
    setDetailSubTasksLoading(true)
    setDetailSubTasksLeaving(false)
    setDetailHydrating(true)
    setDetailId(id)
    setDetailEdit(false)
    setDetailDraft(null)
    setNewSubLabel('')
  }, [])

  const onDeleteTodoFromCard = useCallback((todoId) => {
    setDeleteTodoId(Number(todoId))
    setDeleteConfirmOpen(true)
    ignoreNextClickRef.current = true
    setTimeout(() => { ignoreNextClickRef.current = false }, 100)
  }, [ignoreNextClickRef])

  const closeDetail = () => {
    setDetailId(null)
    setDetailEdit(false)
    setDetailDraft(null)
    setNewSubLabel('')
    setDetailCategoryOpen(false)
    setSortOpen(false)
    setDetailSubTasksLoading(false)
    setDetailSubTasksLeaving(false)
    setDetailHydrating(false)
  }

  const startDetailEdit = () => {
    if (!selectedTodo) return
    setDetailDraft({
      title: selectedTodo.title || '',
      description: selectedTodo.description || '',
      category: selectedTodo.category || 'lainnya',
      dueDate: selectedTodo.dueDate || '',
      priority: selectedTodo.priority || 'medium',
    })
    setDetailEdit(true)
    setDetailCategoryOpen(false)
    setDetailSubTasksLoading(false)
    setDetailHydrating(false)
  }

  const saveDetailEdit = async () => {
    if (!detailId || !detailDraft) return
    const title = String(detailDraft.title || '').trim()
    if (!title) return
    const id = Number(detailId)
    const dueDate = detailDraft.dueDate || ''
    const nextData = {
      title,
      description: String(detailDraft.description || '').trim(),
      category: detailDraft.category,
      dueDate,
      priority: detailDraft.priority,
    }
    await db.todos.update(id, nextData)
    const stillCompleted = Boolean(selectedTodo?.completed)
    if (stillCompleted) {
      void cancelTodoDueNotifications(id)
    } else if (dueDate) {
      void scheduleTodoDueNotifications({ id, ...nextData })
    } else {
      void cancelTodoDueNotifications(id)
    }
    setDetailEdit(false)
    setDetailDraft(null)
  }

  const cancelDetailEdit = () => {
    setDetailEdit(false)
    setDetailDraft(null)
    setDetailCategoryOpen(false)
  }

  const handleAddTodo = async (event) => {
    event.preventDefault()
    const title = String(addForm.title || '').trim()
    if (!title) return
    const id = await db.todos.add({
      title,
      description: String(addForm.description || '').trim(),
      category: addForm.category,
      dueDate: addForm.dueDate || '',
      priority: addForm.priority,
      completed: false,
      createdAt: Date.now(),
    })
    // Schedule notifications if due date exists (best-effort).
    void scheduleTodoDueNotifications({ id, ...addForm, title })
    resetAddForm()
    setAddOpen(false)
  }

  const toggleCardComplete = useCallback(async (e, todo) => {
    e.stopPropagation()
    const id = Number(todo?.id)
    if (!id) return
    const next = !todo.completed
    await db.transaction('rw', db.todos, db.sub_tasks, async () => {
      await db.todos.update(id, { completed: next })
      // If todo is completed, also mark all its sub-tasks as checked.
      // If todo is uncompleted, also uncheck all sub-tasks.
      await db.sub_tasks.where('todoId').equals(id).modify({ checked: next })
    })
    if (next) {
      void cancelTodoDueNotifications(id)
    } else if (todo?.dueDate) {
      void scheduleTodoDueNotifications({ id, title: todo.title, dueDate: todo.dueDate })
    }
  }, [cancelTodoDueNotifications, scheduleTodoDueNotifications])

  const toggleDetailComplete = async () => {
    if (!selectedTodo) return
    const id = Number(selectedTodo.id)
    const next = !selectedTodo.completed
    await db.transaction('rw', db.todos, db.sub_tasks, async () => {
      await db.todos.update(id, { completed: next })
      await db.sub_tasks.where('todoId').equals(id).modify({ checked: next })
    })
    if (next) {
      void cancelTodoDueNotifications(id)
    } else if (selectedTodo?.dueDate) {
      void scheduleTodoDueNotifications({ id, title: selectedTodo.title, dueDate: selectedTodo.dueDate })
    }
  }

  const removeTodo = async () => {
    if (!deleteTodoId) return
    const id = Number(deleteTodoId)
    // Cancel notifications before deleting (best-effort).
    void cancelTodoDueNotifications(id)
    await db.transaction('rw', db.todos, db.sub_tasks, async () => {
      await db.sub_tasks.where('todoId').equals(id).delete()
      await db.todos.delete(id)
    })
    setDeleteConfirmOpen(false)
    setDeleteTodoId(null)
    if (String(detailId) === String(deleteTodoId)) closeDetail()
  }

  const addSubTask = async () => {
    if (!detailId) return
    const label = String(newSubLabel || '').trim()
    if (!label) return
    await db.sub_tasks.add({
      todoId: Number(detailId),
      label,
      checked: false,
    })
    setNewSubLabel('')
  }

  const toggleSubTask = async (row) => {
    await db.sub_tasks.update(row.id, { checked: !row.checked })
  }

  const deleteSubTask = async (id) => {
    await db.sub_tasks.delete(id)
  }

  const pillClass = (active) =>
    `flex-shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition-all duration-300 ${
      active ? 'bg-[var(--fg)] text-[var(--bg)] shadow-md scale-105' : 'bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)]'
    }`

  return (
    <div className="bg-[var(--bg)]">
      <div
        className={`ft-motion-page min-h-full space-y-4 transform-gpu pb-2 ${
          isEntering ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        <header className="flex items-center justify-between px-1">
          <h1 className="ft-display text-2xl font-black tracking-tight text-[var(--fg)]">{t('todo.pageTitle')}</h1>
          {activeTab === 'todo' && (
            <button
              type="button"
              onClick={() => {
                resetAddForm()
                setAddOpen(true)
              }}
              className="flex items-center gap-1.5 rounded-full bg-[var(--fg)] px-3.5 py-1.5 text-[12px] font-extrabold text-[var(--bg)] shadow-sm transition-transform active:scale-95"
              aria-label={t('todo.add')}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M12 5v14" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Tugas</span>
            </button>
          )}
        </header>

        {/* ── Segmented Control ── */}
        <div className="flex rounded-[1rem] bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] p-1 border border-[color-mix(in_srgb,var(--border)_50%,transparent)] shadow-inner">
          <button
            type="button"
            className={`flex-1 rounded-[0.75rem] py-2.5 text-[14px] font-bold transition-all duration-200 ${activeTab === 'todo' ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-[var(--shadow-card)] ring-1 ring-[color-mix(in_srgb,var(--border)_80%,transparent)]' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)]'}`}
            onClick={() => setActiveTab('todo')}
          >
            Tasks
          </button>
          <button
            type="button"
            className={`flex-1 rounded-[0.75rem] py-2.5 text-[14px] font-bold transition-all duration-200 ${activeTab === 'habits' ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-[var(--shadow-card)] ring-1 ring-[color-mix(in_srgb,var(--border)_80%,transparent)]' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)]'}`}
            onClick={() => setActiveTab('habits')}
          >
            Habits
          </button>
          <button
            type="button"
            className={`flex-1 rounded-[0.75rem] py-2.5 text-[14px] font-bold transition-all duration-200 ${activeTab === 'ideas' ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-[var(--shadow-card)] ring-1 ring-[color-mix(in_srgb,var(--border)_80%,transparent)]' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)]'}`}
            onClick={() => setActiveTab('ideas')}
          >
            Papan Ide
          </button>
        </div>

        {activeTab === 'habits' && <HabitsView />}
        {activeTab === 'ideas' && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-8 text-center shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-lg">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-bold text-[var(--fg)]">Papan Ide Kanvas</h2>
            <p className="mb-6 max-w-sm text-[14px] text-[var(--muted)] leading-relaxed">
              Ruang bebas tanpa batas untuk menuangkan ide, membuat pemetaan visual, dan merancang strategi.
            </p>
            <button
              type="button"
              onClick={() => setIsBoardOpen(true)}
              className="rounded-full bg-[var(--fg)] px-8 py-3 text-[14px] font-bold text-[var(--bg)] shadow-md transition-transform active:scale-95"
            >
              Buka Kanvas Penuh
            </button>
          </div>
        )}
        {activeTab === 'todo' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 pb-2 pt-1 pl-1">
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
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--fg)] transition-colors"
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
                      className={`w-full rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition ${
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
                      className={`w-full rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition ${
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
                      className={`w-full rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition ${
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
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-[color-mix(in_srgb,var(--field-bg)_30%,transparent)] rounded-[2rem] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--panel-strong)] shadow-sm">
              <svg viewBox="0 0 24 24" className="h-8 w-8 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                <path d="M12 11h4"></path>
                <path d="M12 16h4"></path>
                <path d="M8 11h.01"></path>
                <path d="M8 16h.01"></path>
              </svg>
            </div>
            <h3 className="text-[15px] font-bold text-[var(--fg)] mb-1">Tidak ada tugas</h3>
            <p className="text-[13px] font-medium text-[var(--muted)] max-w-[220px] leading-relaxed">
              {filter === 'all'
                ? t('todo.emptyState.all')
                : filter === 'active'
                  ? t('todo.emptyState.active')
                  : t('todo.emptyState.completed')}
            </p>
            {filter === 'all' && (
              <button
                type="button"
                onClick={() => { resetAddForm(); setAddOpen(true) }}
                className="mt-6 rounded-full bg-[var(--fg)] px-6 py-2.5 text-[13px] font-bold text-[var(--bg)] shadow-md transition-transform active:scale-95"
              >
                + Tambah Tugas
              </button>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sortedTodos.map((todo) => (
              <TodoItemCard
                key={todo.id}
                todo={todo}
                subProgress={subProgressByTodo.get(Number(todo.id))}
                isSwiping={swipeTodoId === String(todo.id)}
                confirmDeleteId={deleteConfirmOpen ? deleteTodoId : null}
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
                formatDue={formatDue}
                t={t}
              />
            ))}
          </ul>
        )}
          </div>
        )}
      </div>

      <Modal isOpen={addOpen} title={t('todo.addModalTitle')} onClose={() => setAddOpen(false)}>
        <form className="grid max-h-[min(70vh,28rem)] gap-2.5 overflow-y-auto pr-1" onSubmit={handleAddTodo}>
          <label className="ft-label">
            {t('todo.field.title')}
            <input
              className="ft-field appearance-none text-base md:text-sm"
              value={addForm.title}
              onChange={(e) => setAddForm((p) => ({ ...p, title: e.target.value }))}
              required
              maxLength={200}
            />
          </label>
          <label className="ft-label">
            {t('todo.field.description')}
            <textarea
              className="ft-field min-h-[4rem] resize-y text-base md:text-sm"
              value={addForm.description}
              onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))}
              maxLength={2000}
            />
          </label>
          <label className="ft-label">
            {t('todo.field.category')}
            <div className="relative mt-1">
                <button
                type="button"
                className="ft-field mt-0 flex items-center justify-between text-left text-base md:text-sm"
                onClick={() => setAddCategoryOpen((v) => !v)}
                aria-expanded={addCategoryOpen}
                  data-todo-popover="add-category"
              >
                <span>{t(`todo.cat.${addForm.category}`)}</span>
                <span className={`text-xs text-[var(--muted)] transition-transform ${addCategoryOpen ? 'rotate-180' : ''}`}>⌄</span>
              </button>
              <div
                className={`absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 origin-top transition-all duration-200 ${
                  addCategoryOpen ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-[0.98] opacity-0'
                }`}
              >
                <div className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-1.5 shadow-[var(--shadow-card)]">
                  {TODO_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                        addForm.category === c ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--fg)] hover:bg-[var(--panel)]'
                      }`}
                      onClick={() => {
                        setAddForm((p) => ({ ...p, category: c }))
                        setAddCategoryOpen(false)
                      }}
                    >
                      {t(`todo.cat.${c}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </label>
          <label className="ft-label">
            {t('todo.field.due')}
            <input
              type="date"
              className="ft-field text-base md:text-sm"
              value={addForm.dueDate}
              onChange={(e) => setAddForm((p) => ({ ...p, dueDate: e.target.value }))}
            />
          </label>
          <label className="ft-label">
            {t('todo.field.priority')}
            <div className="mt-1 grid grid-cols-3 gap-2 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`rounded-lg px-2 py-2 text-xs font-semibold ${
                    addForm.priority === p ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-[var(--muted)]'
                  }`}
                  onClick={() => setAddForm((s) => ({ ...s, priority: p }))}
                >
                  {t(`todo.priority.${p}`)}
                </button>
              ))}
            </div>
          </label>
          <div className="sticky bottom-0 mt-1 flex justify-end gap-2 border-t border-[var(--border)] bg-[var(--panel-strong)] pt-3">
            <Button
              type="button"
              className="bg-[var(--field-border)] text-[var(--fg)] hover:bg-[var(--field-border-hover)]"
              onClick={() => setAddOpen(false)}
            >
              {t('common.close')}
            </Button>
            <Button type="submit">{t('todo.save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(detailId && selectedTodo)} title={t('todo.detailTitle')} onClose={closeDetail}>
        {selectedTodo && detailDraft === null && !detailEdit ? (
          <div className="relative">
            {/* Keep layout stable; show loading as overlay (no jump) */}
            <div
              className={`pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-xl bg-[var(--panel-strong)]/95 transition-opacity duration-150 ${
                detailHydrating ? 'opacity-100' : 'opacity-0'
              }`}
              aria-hidden={!detailHydrating}
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--field-border)] border-t-[var(--fg)]" aria-hidden />
                <p className="text-sm font-semibold text-[var(--fg)]">{t('todo.loadingDetail')}</p>
                <p className="text-xs text-[var(--muted)]">{t('todo.loadingSubtasks')}</p>
              </div>
            </div>

            <div
              className={`ft-sheet-enter grid max-h-[min(78dvh,34rem)] gap-4 overflow-y-auto pr-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] transition-opacity duration-150 ${
                detailHydrating ? 'opacity-0' : 'opacity-100'
              }`}
            >
            <div>
              <p className={`text-base font-bold text-[var(--fg)] ${selectedTodo.completed ? 'line-through opacity-70' : ''}`}>
                {selectedTodo.title}
              </p>
              {selectedTodo.description ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted)]">{selectedTodo.description}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)]">
                  {t(`todo.cat.${selectedTodo.category || 'lainnya'}`)}
                </span>
                {selectedTodo.dueDate ? (
                  <span className="text-[11px] text-[var(--muted)]">{formatDue(selectedTodo.dueDate)}</span>
                ) : null}
                <span className={`inline-block h-2 w-2 rounded-full ${priorityClass(selectedTodo.priority)}`} />
                <span className="text-[11px] font-medium text-[var(--muted)]">{t(`todo.priority.${selectedTodo.priority || 'medium'}`)}</span>
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('todo.subtasksHeading')}</p>
              {/* Reserve height so layout never jumps when sub-tasks load */}
              <div className="relative min-h-[3.75rem]">
                <div
                  className={`absolute inset-0 transition-opacity duration-150 ${
                    detailSubTasksLoading || detailSubTasksLeaving ? 'opacity-100' : 'opacity-0'
                  }`}
                  aria-hidden={!(detailSubTasksLoading || detailSubTasksLeaving)}
                >
                  <div className="space-y-2">
                    <div className="h-6 animate-pulse rounded-md bg-[color-mix(in_srgb,var(--field-bg)_75%,transparent)]" />
                    <div className="h-6 w-10/12 animate-pulse rounded-md bg-[color-mix(in_srgb,var(--field-bg)_70%,transparent)]" />
                  </div>
                </div>

                <div
                  className={`absolute inset-0 transition-opacity duration-150 ${
                    detailSubTasksLoading ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  {(detailSubTasks || []).length === 0 ? (
                    <EmptyState title={t('todo.subtasksEmpty')} />
                  ) : (
                    <ul className="space-y-2">
                      {(detailSubTasks || []).map((row) => (
                        <li key={row.id} className="flex items-start gap-2">
                          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--border)]"
                              checked={Boolean(row.checked)}
                              onChange={() => toggleSubTask(row)}
                            />
                            <span
                              className={`text-sm ${row.checked ? 'text-[var(--muted)] line-through' : 'text-[var(--fg)]'}`}
                            >
                              {row.label}
                            </span>
                          </label>
                          <button
                            type="button"
                            className="shrink-0 rounded-lg p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            aria-label={t('todo.subtask.delete')}
                            onClick={() => deleteSubTask(row.id)}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className="ft-field min-w-0 flex-1 text-sm"
                  value={newSubLabel}
                  placeholder={t('todo.subtask.placeholder')}
                  onChange={(e) => setNewSubLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void addSubTask()
                    }
                  }}
                />
                <Button
                  type="button"
                  className="shrink-0 bg-[var(--field-border)] text-[var(--fg)] hover:bg-[var(--field-border-hover)]"
                  onClick={() => void addSubTask()}
                >
                  {t('todo.subtask.add')}
                </Button>
              </div>
            </div>

            <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap gap-2 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--panel-strong)_92%,transparent)] px-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
              <Button
                type="button"
                className="bg-[var(--field-border)] text-[var(--fg)] hover:bg-[var(--field-border-hover)]"
                onClick={startDetailEdit}
              >
                {t('todo.edit')}
              </Button>
              <Button
                type="button"
                className="bg-[var(--field-border)] text-[var(--fg)] hover:bg-[var(--field-border-hover)]"
                onClick={() => {
                  setDeleteTodoId(Number(selectedTodo?.id))
                  setDeleteConfirmOpen(true)
                }}
              >
                {t('todo.delete')}
              </Button>
              <Button type="button" onClick={() => void toggleDetailComplete()}>
                {selectedTodo.completed ? t('todo.uncomplete') : t('todo.complete')}
              </Button>
            </div>
            </div>
          </div>
        ) : null}

        {selectedTodo && detailEdit && detailDraft ? (
          <form
            className="ft-sheet-enter grid max-h-[min(78dvh,34rem)] gap-3 overflow-y-auto pr-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))]"
            onSubmit={(e) => {
              e.preventDefault()
              void saveDetailEdit()
            }}
          >
            <label className="ft-label">
              {t('todo.field.title')}
              <input
                className="ft-field appearance-none text-base md:text-sm"
                value={detailDraft.title}
                onChange={(e) => setDetailDraft((p) => ({ ...p, title: e.target.value }))}
                required
                maxLength={200}
              />
            </label>
            <label className="ft-label">
              {t('todo.field.description')}
              <textarea
                className="ft-field min-h-[4rem] resize-y text-base md:text-sm"
                value={detailDraft.description}
                onChange={(e) => setDetailDraft((p) => ({ ...p, description: e.target.value }))}
                maxLength={2000}
              />
            </label>
            <label className="ft-label">
              {t('todo.field.category')}
              <div className="relative mt-1">
                <button
                  type="button"
                  className="ft-field mt-0 flex items-center justify-between text-left text-base md:text-sm"
                  onClick={() => setDetailCategoryOpen((v) => !v)}
                  aria-expanded={detailCategoryOpen}
                  data-todo-popover="detail-category"
                >
                  <span>{t(`todo.cat.${detailDraft.category}`)}</span>
                  <span className={`text-xs text-[var(--muted)] transition-transform ${detailCategoryOpen ? 'rotate-180' : ''}`}>⌄</span>
                </button>
                <div
                  className={`absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 origin-top transition-all duration-200 ${
                    detailCategoryOpen ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-[0.98] opacity-0'
                  }`}
                >
                  <div className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-1.5 shadow-[var(--shadow-card)]">
                    {TODO_CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                          detailDraft.category === c ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--fg)] hover:bg-[var(--panel)]'
                        }`}
                        onClick={() => {
                          setDetailDraft((p) => ({ ...p, category: c }))
                          setDetailCategoryOpen(false)
                        }}
                      >
                        {t(`todo.cat.${c}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </label>
            <label className="ft-label">
              {t('todo.field.due')}
              <input
                type="date"
                className="ft-field text-base md:text-sm"
                value={detailDraft.dueDate}
                onChange={(e) => setDetailDraft((p) => ({ ...p, dueDate: e.target.value }))}
              />
            </label>
            <label className="ft-label">
              {t('todo.field.priority')}
              <div className="mt-1 grid grid-cols-3 gap-2 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`rounded-lg px-2 py-2 text-xs font-semibold ${
                      detailDraft.priority === p ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-[var(--muted)]'
                    }`}
                    onClick={() => setDetailDraft((s) => ({ ...s, priority: p }))}
                  >
                    {t(`todo.priority.${p}`)}
                  </button>
                ))}
              </div>
            </label>
            <div className="sticky bottom-0 z-10 mt-1 flex justify-end gap-2 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--panel-strong)_92%,transparent)] pb-[calc(0.25rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
              <Button
                type="button"
                className="bg-[var(--field-border)] text-[var(--fg)] hover:bg-[var(--field-border-hover)]"
                onClick={cancelDetailEdit}
              >
                {t('todo.editCancel')}
              </Button>
              <Button type="submit">{t('todo.editSave')}</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        isOpen={deleteConfirmOpen}
        title={t('todo.delete')}
        onClose={() => {
          setDeleteConfirmOpen(false)
          setDeleteTodoId(null)
        }}
      >
        <p className="text-sm text-[var(--muted)]">{t('todo.deleteConfirm')}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            className="bg-[var(--field-border)] text-[var(--fg)] hover:bg-[var(--field-border-hover)]"
            onClick={() => {
              setDeleteConfirmOpen(false)
              setDeleteTodoId(null)
            }}
          >
            {t('common.close')}
          </Button>
          <Button
            type="button"
            className="!bg-rose-600 hover:!bg-rose-700"
            onClick={() => void removeTodo()}
          >
            {t('todo.delete')}
          </Button>
        </div>
      </Modal>

      {/* -- Fullscreen Idea Board -- */}
      {isBoardOpen && (
        <div className="fixed inset-0 z-[100] bg-[var(--bg)] animate-in fade-in zoom-in-95 duration-200">
          <ErrorBoundary>
            <IdeaBoard onClose={() => setIsBoardOpen(false)} />
          </ErrorBoundary>
        </div>
      )}
    </div>
  )
}

export default TodoList
