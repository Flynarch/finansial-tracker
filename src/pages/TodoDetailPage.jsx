import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, isToday, isTomorrow, isBefore, startOfDay, parse } from 'date-fns'
import { id as idLocale, enUS as enLocale } from 'date-fns/locale'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import CustomDateTimePicker from '../components/ui/CustomDateTimePicker'
import BottomSheet from '../components/ui/BottomSheet'
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
import {
  ArrowLeft,
  ChevronRight,
  Trash2,
  CheckCircle2,
  Plus,
  X,
  Calendar,
  Edit3,
  CheckSquare,
  Square,
  Clock,
  AlertCircle,
  Check,
  MoreVertical,
} from 'lucide-react'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import { triggerHaptic } from '../lib/haptics'
import { TODO_CATEGORIES, TODO_CATEGORY_META } from '../components/todos/TodoMeta'

const PRIORITIES = ['low', 'medium', 'high']

function priorityConfig(p) {
  if (p === 'high') {
    return {
      dot: 'bg-rose-500',
      badge: 'border-rose-500/30 bg-rose-500/10 text-rose-500',
    }
  }
  if (p === 'medium') {
    return {
      dot: 'bg-amber-400',
      badge: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
    }
  }
  return {
    dot: 'bg-slate-400',
    badge: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
  }
}

function getDueStatusConfig(dueDate, completed, t, dateLocale = idLocale) {
  if (completed) {
    return {
      label: t('todo.completed', 'Selesai'),
      badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-500 font-bold',
      icon: <CheckCircle2 size={13} />,
    }
  }

  if (!dueDate) {
    return null
  }

  try {
    const todayObj = startOfDay(new Date())
    const dueDateObj = startOfDay(new Date(String(dueDate) + 'T00:00:00'))

    if (isToday(dueDateObj)) {
      return {
        label: t('todo.due.today', 'Hari ini'),
        badgeClass: 'border-amber-500/50 bg-amber-500/15 text-amber-500 font-bold',
        icon: <Clock size={13} />,
      }
    }

    if (isTomorrow(dueDateObj)) {
      return {
        label: t('todo.due.tomorrow', 'Besok'),
        badgeClass: 'border-sky-500/40 bg-sky-500/15 text-sky-500 font-bold',
        icon: <Calendar size={13} />,
      }
    }

    if (isBefore(dueDateObj, todayObj)) {
      return {
        label: t('todo.due.overdue', 'Terlewat'),
        badgeClass: 'border-rose-500/40 bg-rose-500/15 text-rose-500 font-bold',
        icon: <AlertCircle size={13} />,
      }
    }

    return {
      label: format(dueDateObj, 'dd MMM yyyy', { locale: dateLocale }),
      badgeClass: 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] font-semibold',
      icon: <Calendar size={13} />,
    }
  } catch {
    return null
  }
}

export default function TodoDetailPage() {
  const { id } = useParams()
  const todoId = Number(id)
  const isValidId = !isNaN(todoId) && todoId > 0
  const navigate = useNavigate()
  const { t, locale } = useTranslation()

  // View & subtask states
  const [newSubLabel, setNewSubLabel] = useState('')
  const [editingSubId, setEditingSubId] = useState(null)
  const [editingSubText, setEditingSubText] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const descRef = useRef(null)

  const autoResizeDesc = useCallback(() => {
    if (descRef.current) {
      descRef.current.style.height = 'auto'
      descRef.current.style.height = `${Math.max(24, descRef.current.scrollHeight)}px`
    }
  }, [])

  // Full Edit mode states
  const [isEditing, setIsEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(null)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [editError, setEditError] = useState('')

  const todo = useLiveQuery(() => (isValidId ? db.todos.get(todoId) : Promise.resolve(undefined)), [todoId, isValidId])
  const subTasks = useLiveQuery(
    () => (isValidId ? db.sub_tasks.where('todoId').equals(todoId).sortBy('id') : Promise.resolve([])),
    [todoId, isValidId],
  )

  useEffect(() => {
    const onPointerDown = (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (!target.closest('[data-todo-popover="detail-category"]')) {
        setCategoryOpen(false)
      }
      if (!target.closest('[data-todo-popover="more-menu"]')) {
        setMoreMenuOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  useEffect(() => {
    autoResizeDesc()
  }, [todo?.description, autoResizeDesc])

  const startEditing = useCallback(() => {
    if (!todo) return
    setEditDraft({
      title: todo.title || '',
      description: todo.description || '',
      category: todo.category || 'tagihan',
      dueDate: todo.dueDate || '',
      reminderTime: todo.reminderTime || '',
      priority: todo.priority || 'medium',
    })
    setEditError('')
    setIsEditing(true)
    setCategoryOpen(false)
    setMoreMenuOpen(false)
  }, [todo])

  const cancelEditing = useCallback(() => {
    setIsEditing(false)
    setEditDraft(null)
    setEditError('')
    setCategoryOpen(false)
  }, [])

  const scheduleNotificationForTodo = useCallback(async (id, data) => {
    if (!Capacitor.isNativePlatform()) return
    const rawDate = String(data?.dueDate || '').trim()
    if (!rawDate) return

    const parsedDate = parse(rawDate, 'yyyy-MM-dd', new Date())
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) return

    const timeStr = String(data?.reminderTime || '09:00').trim()
    const [hh, mm] = timeStr.split(':').map((x) => Number(x) || 0)

    const scheduleDate = new Date(parsedDate)
    scheduleDate.setHours(hh, mm, 0, 0)

    const now = new Date()
    const notifs = []

    if (scheduleDate > now) {
      notifs.push({
        id: id * 10 + 1,
        title: t('todo.notif.dueTodayTitle', 'Tenggat Tugas Hari Ini'),
        body: data.title,
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
        body: t('todo.notif.dueTomorrowBody', 'Besok: {{title}}', { title: data.title }),
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

  const cancelNotificationForTodo = useCallback(async (id) => {
    if (!Capacitor.isNativePlatform()) return
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: id * 10 + 1 }, { id: id * 10 + 2 }],
      })
    } catch {
      // ignore
    }
  }, [])

  const saveEdit = useCallback(
    async (e) => {
      if (e) e.preventDefault()
      if (!editDraft || !todoId) return
      const title = String(editDraft.title || '').trim()
      if (!title) {
        setEditError('Judul todo tidak boleh kosong.')
        return
      }

      const dueDate = editDraft.dueDate || ''
      const reminderTime = dueDate ? (editDraft.reminderTime || '09:00') : ''
      await db.todos.update(todoId, {
        title,
        description: String(editDraft.description || '').trim(),
        category: editDraft.category,
        dueDate,
        reminderTime,
        priority: editDraft.priority,
      })

      void cancelNotificationForTodo(todoId)
      if (dueDate && !todo?.completed) {
        void scheduleNotificationForTodo(todoId, { title, dueDate, reminderTime })
      }

      setIsEditing(false)
      setEditDraft(null)
      setEditError('')
      setCategoryOpen(false)
    },
    [editDraft, todoId, todo?.completed, cancelNotificationForTodo, scheduleNotificationForTodo],
  )

  const handleToggleComplete = useCallback(async () => {
    if (!todo || !todoId) return
    const next = !todo.completed
    triggerHaptic(next ? 'success' : 'light')
    await db.transaction('rw', db.todos, db.sub_tasks, async () => {
      await db.todos.update(todoId, { completed: next })
      await db.sub_tasks.where('todoId').equals(todoId).modify({ checked: next })
    })
    if (next) {
      void cancelNotificationForTodo(todoId)
    } else if (todo.dueDate) {
      void scheduleNotificationForTodo(todoId, todo)
    }
  }, [todo, todoId, cancelNotificationForTodo, scheduleNotificationForTodo])

  const handleDeleteTodo = useCallback(async () => {
    if (!todo || !todoId) return
    void cancelNotificationForTodo(todoId)
    await db.transaction('rw', db.todos, db.sub_tasks, async () => {
      await db.sub_tasks.where('todoId').equals(todoId).delete()
      await db.todos.delete(todoId)
    })
    setDeleteConfirmOpen(false)
    navigate('/todos', { replace: true })
  }, [todo, todoId, navigate, cancelNotificationForTodo])

  const handleToggleSubTask = useCallback(async (sub) => {
    if (!sub?.id || !todoId) return
    const nextChecked = !sub.checked
    triggerHaptic(nextChecked ? 'success' : 'light')
    await db.transaction('rw', db.todos, db.sub_tasks, async () => {
      await db.sub_tasks.update(sub.id, { checked: nextChecked })
      const allSubs = await db.sub_tasks.where('todoId').equals(todoId).toArray()
      if (allSubs.length > 0) {
        const allDone = allSubs.every((s) => (s.id === sub.id ? nextChecked : s.checked))
        if (allDone) {
          triggerHaptic('success')
          await db.todos.update(todoId, { completed: true })
          void cancelNotificationForTodo(todoId)
        } else {
          await db.todos.update(todoId, { completed: false })
        }
      }
    })
  }, [todoId, cancelNotificationForTodo])

  const handleDeleteSubTask = useCallback(async (subId) => {
    if (!subId || !todoId) return
    triggerHaptic('light')
    await db.transaction('rw', db.todos, db.sub_tasks, async () => {
      await db.sub_tasks.delete(subId)
      const remainingSubs = await db.sub_tasks.where('todoId').equals(todoId).toArray()
      if (remainingSubs.length > 0) {
        const allDone = remainingSubs.every((s) => s.checked)
        await db.todos.update(todoId, { completed: allDone })
      }
    })
  }, [todoId])

  const handleAddSubTask = useCallback(async () => {
    const label = newSubLabel.trim()
    if (!label || !todoId) return
    triggerHaptic('medium')
    await db.transaction('rw', db.todos, db.sub_tasks, async () => {
      await db.sub_tasks.add({
        todoId,
        label,
        checked: false,
      })
      await db.todos.update(todoId, { completed: false })
    })
    setNewSubLabel('')
  }, [newSubLabel, todoId])

  const startEditingSubTask = useCallback((row) => {
    setEditingSubId(row.id)
    setEditingSubText(row.label || '')
  }, [])

  const saveSubTaskEdit = useCallback(async (subId) => {
    const label = editingSubText.trim()
    if (label && subId) {
      await db.sub_tasks.update(subId, { label })
    }
    setEditingSubId(null)
  }, [editingSubText])

  if (!todo) {
    return (
      <div className="min-h-screen bg-[var(--bg)] p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate('/todos')}
          className="mb-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs transition hover:bg-[var(--field-bg)] active:scale-95 cursor-pointer"
          aria-label={t('common.back')}
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <EmptyState title={t('todo.emptyTitle')} description={t('todo.emptyDesc')} />
      </div>
    )
  }

  const dateLocale = locale === 'en' ? enLocale : idLocale
  const statusCfg = getDueStatusConfig(todo.dueDate, todo.completed, t, dateLocale)
  const priorityCfg = priorityConfig(todo.priority)
  const formattedCreated = todo.createdAt
    ? format(new Date(Number(todo.createdAt)), 'dd MMM yyyy, HH:mm', { locale: dateLocale })
    : ''
  const doneSubCount = (subTasks || []).filter((s) => s.checked).length
  const totalSubCount = (subTasks || []).length
  const subPercent = totalSubCount > 0 ? Math.round((doneSubCount / totalSubCount) * 100) : 0

  const catMeta = TODO_CATEGORY_META[todo.category] || TODO_CATEGORY_META.lainnya
  const CatIcon = catMeta.icon

  return (
    <div className="ft-page-enter min-h-screen bg-[var(--bg)] pb-28">
      {/* ── Top Navigation Header ────────────────────────────────────── */}
      <div className="pt-[calc(0.75rem+env(safe-area-inset-top))] px-3.5 sm:px-5">
        <div className="mx-auto max-w-3xl py-2 flex items-center justify-between min-h-[44px]">
          {/* Back Button (Settings-style ArrowLeft) */}
          <button
            type="button"
            onClick={() => (isEditing ? cancelEditing() : navigate('/todos'))}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs transition hover:bg-[var(--field-bg)] active:scale-95 cursor-pointer"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>

          {/* Right Action */}
          {!isEditing ? (
            <div className="relative" data-todo-popover="more-menu">
              <button
                type="button"
                onClick={() => setMoreMenuOpen((p) => !p)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-90 cursor-pointer"
                aria-label={t('common.options')}
              >
                <MoreVertical size={20} strokeWidth={2.2} />
              </button>

              {moreMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-1.5 shadow-xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false)
                      startEditing()
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors cursor-pointer text-left"
                  >
                    <Edit3 size={14} className="text-[var(--muted)]" />
                    <span>{t('todo.menu.edit', 'Edit Tugas')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false)
                      setDeleteConfirmOpen(true)
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                  >
                    <Trash2 size={14} className="text-rose-500" />
                    <span>{t('todo.menu.delete', 'Hapus Tugas')}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={cancelEditing}
              className="rounded-full px-3.5 py-1.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition-all active:scale-95 cursor-pointer"
            >
              <span>{t('todo.editCancel', 'Batal')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Main Container ───────────────────────────────────────────── */}
      <div className="mx-auto max-w-3xl space-y-4 px-3.5 pt-1 sm:px-5">
        {!isEditing ? (
          /* ── VIEW MODE LAYOUT ──────────────────────────────────────── */
          <>
            {/* Executive Hero Card */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-xs space-y-3.5">
              {/* Eyebrow Meta Row (Category, Priority, Status/Completion, & Reminder all at Top) */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Category Chip */}
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-current/20 text-[10px] font-bold ${catMeta.bg} ${catMeta.color}`}>
                  <CatIcon size={10.5} className="shrink-0" />
                  <span>{t(`todo.cat.${todo.category || 'lainnya'}`)}</span>
                </div>

                {/* Priority Chip */}
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${priorityCfg.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${priorityCfg.dot}`} />
                  <span>{t(`todo.priority.${todo.priority || 'medium'}`)}</span>
                </div>

                {/* Status / Due Date / Completion Chip */}
                {statusCfg && (
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusCfg.badgeClass}`}>
                    {statusCfg.icon}
                    <span>{statusCfg.label}</span>
                  </div>
                )}

                {/* Reminder Time Chip */}
                {todo.reminderTime && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--field-bg)] text-[10px] font-bold text-[var(--muted)]">
                    <Clock size={10.5} className="shrink-0" />
                    <span>{todo.reminderTime}</span>
                  </div>
                )}
              </div>

              {/* Task Header with Circular Interactive Checkbox & Big Bold Title */}
              <div className="flex items-start gap-3.5">
                <button
                  type="button"
                  onClick={handleToggleComplete}
                  className="mt-0.5 flex h-8 w-8 min-h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded-full cursor-pointer transition-transform active:scale-90 group/check"
                  aria-label={todo.completed ? t('todos.unmarkComplete') : t('todos.markComplete')}
                >
                  <div
                    className={`flex h-6.5 w-6.5 items-center justify-center rounded-full border-2 transition-all ${
                      todo.completed
                        ? 'border-[var(--status-income)] bg-[var(--status-income)] text-white shadow-xs'
                        : 'border-[var(--border-strong)] bg-[var(--field-bg)] group-hover/check:border-[var(--status-income)]/60'
                    }`}
                  >
                    {todo.completed && <Check className="h-4.5 w-4.5" strokeWidth={3} />}
                  </div>
                </button>

                <div className="flex-1 min-w-0">
                  <h1
                    className={`text-xl sm:text-2xl font-black tracking-tight text-[var(--fg)] leading-snug break-words [overflow-wrap:anywhere] transition-all ${
                      todo.completed ? 'line-through opacity-60 text-[var(--muted)]' : ''
                    }`}
                  >
                    {todo.title}
                  </h1>

                  {formattedCreated && (
                    <p className="mt-1 text-[11px] font-medium text-[var(--muted)]/80">
                      {t('todo.created', 'Dibuat')}: {formattedCreated}
                    </p>
                  )}
                </div>
              </div>

              {/* Description Input Block (Seamless Built-in Direct Textarea) */}
              <div className="pt-2 border-t border-[var(--border)]/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  {t('todo.field.description')}
                </span>
                <textarea
                  ref={descRef}
                  rows={1}
                  className="mt-1 w-full bg-transparent p-0 text-sm leading-relaxed text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none resize-none border-none overflow-hidden block break-words [overflow-wrap:anywhere]"
                  placeholder={t('todo.notes.placeholder', 'Tulis catatan atau detail tambahan...')}
                  defaultValue={todo.description || ''}
                  key={todo.description || 'empty'}
                  onInput={autoResizeDesc}
                  onBlur={async (e) => {
                    const nextVal = e.target.value.trim()
                    if (todoId && nextVal !== (todo.description || '')) {
                      await db.todos.update(todoId, { description: nextVal })
                    }
                  }}
                  maxLength={2000}
                />
              </div>
            </div>

            {/* Subtasks Section */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare size={16} className="text-[var(--fg)]" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--fg)]">
                    {t('todo.subtasksHeading')}
                  </h2>
                </div>
                {totalSubCount > 0 && (
                  <span className="rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-0.5 text-xs font-bold tabular-nums text-[var(--fg)]">
                    {doneSubCount}/{totalSubCount} ({subPercent}%)
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              {totalSubCount > 0 && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--field-bg)] border border-[var(--border)]/40">
                  <div
                    className="h-full rounded-full bg-[var(--status-income)] transition-all duration-300 ease-out"
                    style={{ width: `${subPercent}%` }}
                  />
                </div>
              )}

              {/* Subtask Items */}
              {(subTasks || []).length === 0 ? (
                <div className="py-5 text-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--field-bg)]/40">
                  <p className="text-xs font-medium text-[var(--muted)]">{t('todo.subtasksEmpty')}</p>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border)]/40 rounded-xl bg-[var(--field-bg)]/40 px-3">
                  {(subTasks || []).map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-3 py-2.5 transition"
                    >
                      {editingSubId === row.id ? (
                        <div className="flex flex-1 items-center gap-2">
                          <input
                            type="text"
                            className="ft-field min-w-0 flex-1 text-xs py-1.5 px-3 mt-0 font-medium"
                            value={editingSubText}
                            onChange={(e) => setEditingSubText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                void saveSubTaskEdit(row.id)
                              } else if (e.key === 'Escape') {
                                setEditingSubId(null)
                              }
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => void saveSubTaskEdit(row.id)}
                            className="h-9 w-9 grid place-items-center rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition active:scale-95 shrink-0 cursor-pointer"
                            aria-label={'Simpan subtask'}
                          >
                            <CheckCircle2 size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSubId(null)}
                            className="h-9 w-9 grid place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--border)]/40 transition active:scale-95 shrink-0 cursor-pointer"
                            aria-label={'Batal'}
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleToggleSubTask(row)}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 active:scale-90 cursor-pointer"
                              aria-label={row.checked ? t('todos.unmarkComplete') : t('todos.markComplete')}
                            >
                              <div
                                className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                                  row.checked
                                    ? 'border-[var(--status-income)] bg-[var(--status-income)] text-white shadow-2xs'
                                    : 'border-[var(--border-strong)] bg-[var(--field-bg)]/80 hover:border-[var(--status-income)]/60'
                                }`}
                              >
                                {row.checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                              </div>
                            </button>
                            <span
                              onClick={() => startEditingSubTask(row)}
                              title={'Klik untuk mengedit'}
                              className={`text-sm font-medium transition min-w-0 break-words [overflow-wrap:anywhere] cursor-pointer hover:opacity-80 ${
                                row.checked ? 'text-[var(--muted)] line-through opacity-70' : 'text-[var(--fg)]'
                              }`}
                            >
                              {row.label}
                            </span>
                          </div>
                          <div className="flex items-center shrink-0">
                            <button
                              type="button"
                              onClick={() => handleDeleteSubTask(row.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 transition active:scale-95 cursor-pointer"
                              aria-label={t('todo.subtask.delete')}
                              title={t('todo.subtask.delete')}
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Add Subtask Input Field */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  className="ft-field min-w-0 flex-1 text-sm mt-0"
                  value={newSubLabel}
                  placeholder={t('todo.subtask.placeholder')}
                  onChange={(e) => setNewSubLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleAddSubTask()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleAddSubTask()}
                  className="flex items-center gap-1.5 rounded-2xl bg-[var(--fg)] px-4 py-2.5 text-xs font-bold text-[var(--bg)] transition hover:opacity-90 active:scale-95 shrink-0 cursor-pointer"
                >
                  <Plus size={15} />
                  <span>{t('todo.subtask.add')}</span>
                </button>
              </div>
            </div>

            {/* Bottom Action Card (Full Width Complete / Uncomplete Toggle) */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 shadow-xs">
              <button
                type="button"
                onClick={handleToggleComplete}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 px-4 text-xs font-bold transition-all active:scale-98 cursor-pointer ${
                  todo.completed
                    ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20'
                    : 'bg-[var(--fg)] text-[var(--bg)] hover:opacity-95'
                }`}
              >
                {todo.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                <span>{todo.completed ? t('todo.uncomplete', 'Batalkan selesai') : t('todo.complete', 'Tandai Selesai')}</span>
              </button>
            </div>
          </>
        ) : (
          /* ── EDIT FORM MODE ────────────────────────────────────────── */
          <form onSubmit={saveEdit} className="ft-sheet-enter space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-xs">
            {editError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-bold text-rose-500">
                {editError}
              </div>
            )}

            <div className="block">
              <span className="text-xs font-bold text-[var(--fg)] uppercase tracking-wider">{t('todo.field.title')}</span>
              <input
                className="ft-field appearance-none text-base md:text-sm mt-1.5"
                value={editDraft.title}
                onChange={(e) => setEditDraft((p) => ({ ...p, title: e.target.value }))}
                required
                maxLength={200}
              />
            </div>

            <div className="block">
              <span className="text-xs font-bold text-[var(--fg)] uppercase tracking-wider">{t('todo.field.description')}</span>
              <textarea
                className="ft-field min-h-[5rem] resize-y text-base md:text-sm mt-1.5 leading-relaxed"
                value={editDraft.description}
                onChange={(e) => setEditDraft((p) => ({ ...p, description: e.target.value }))}
                maxLength={2000}
              />
            </div>

            <div className="block">
              <span className="text-xs font-bold text-[var(--fg)] uppercase tracking-wider">{t('todo.field.category')}</span>
              <button
                type="button"
                className="mt-1.5 flex w-full items-center justify-between gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-2.5 text-left text-sm font-semibold text-[var(--fg)] hover:border-[var(--border-strong)] transition-all shadow-2xs cursor-pointer"
                onClick={() => setCategoryOpen(true)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {(() => {
                    const meta = TODO_CATEGORY_META[editDraft.category] || TODO_CATEGORY_META.lainnya
                    const Icon = meta.icon
                    return (
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${meta.bg} ${meta.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                    )
                  })()}
                  <span className="truncate font-bold text-[var(--fg)]">
                    {t(`todo.cat.${editDraft.category}`)}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
              </button>

              <BottomSheet
                isOpen={categoryOpen}
                onClose={() => setCategoryOpen(false)}
                title={t('todo.field.category') || 'Pilih Kategori'}
              >
                <div className="grid grid-cols-2 gap-2.5 pt-1 pb-4">
                  {TODO_CATEGORIES.map((c) => {
                    const meta = TODO_CATEGORY_META[c] || TODO_CATEGORY_META.lainnya
                    const Icon = meta.icon
                    const isSelected = editDraft.category === c
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`flex items-center justify-between rounded-2xl border p-3 text-left transition-all active:scale-95 cursor-pointer ${
                          isSelected
                            ? `border-[var(--fg)] bg-[var(--panel-strong)] shadow-md ring-1 ring-[var(--fg)]`
                            : 'border-[var(--border)] bg-[var(--field-bg)] hover:bg-[var(--panel)]'
                        }`}
                        onClick={() => {
                          setEditDraft((p) => ({ ...p, category: c }))
                          setCategoryOpen(false)
                        }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${meta.bg} ${meta.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className={`truncate text-xs font-bold ${isSelected ? 'text-[var(--fg)]' : 'text-[var(--muted)]'}`}>
                            {t(`todo.cat.${c}`)}
                          </span>
                        </div>
                        {isSelected && <Check className="h-4 w-4 shrink-0 text-[var(--fg)]" strokeWidth={3} />}
                      </button>
                    )
                  })}
                </div>
              </BottomSheet>
            </div>

            <div className="block">
              <CustomDateTimePicker
                label={t('todo.field.due')}
                dateValue={editDraft.dueDate}
                timeValue={editDraft.dueDate ? (editDraft.reminderTime || '09:00') : ''}
                onChangeDate={(d) => setEditDraft((p) => ({ ...p, dueDate: d, reminderTime: d ? (p.reminderTime || '09:00') : '' }))}
                onChangeTime={(t) => setEditDraft((p) => ({ ...p, reminderTime: t }))}
              />
            </div>

            <div className="block">
              <span className="text-xs font-bold text-[var(--fg)] uppercase tracking-wider">{t('todo.field.priority')}</span>
              <div className="mt-1.5 grid grid-cols-3 gap-2 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`rounded-lg px-2 py-2 text-xs font-bold transition active:scale-95 cursor-pointer ${
                      editDraft.priority === p ? 'bg-[var(--fg)] text-[var(--bg)] shadow-xs' : 'text-[var(--muted)] hover:text-[var(--fg)]'
                    }`}
                    onClick={() => setEditDraft((s) => ({ ...s, priority: p }))}
                  >
                    {t(`todo.priority.${p}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border)] pt-4 mt-3">
              <Button
                type="button"
                variant="secondary"
                className="active:scale-95"
                onClick={cancelEditing}
              >
                {t('todo.editCancel')}
              </Button>
              <Button type="submit" className="active:scale-95">{t('todo.editSave')}</Button>
            </div>
          </form>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => void handleDeleteTodo()}
        title={t('todo.delete')}
        message={t('todo.deleteConfirm')}
      />
    </div>
  )
}
