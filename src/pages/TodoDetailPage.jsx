import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, isToday, isTomorrow, isBefore, startOfDay } from 'date-fns'
import { id as idLocale, enUS as enLocale } from 'date-fns/locale'
import CustomDateTimePicker from '../components/ui/CustomDateTimePicker'
import PageHeader from '../components/ui/PageHeader'
import BottomSheet from '../components/ui/BottomSheet'
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  CheckCircle2,
  Circle,
  Plus,
  X,
  Calendar,
  Edit3,
  CheckSquare,
  Clock,
  AlertCircle,
  Receipt,
  TrendingUp,
  ShoppingBag,
  Landmark,
  Folder,
  Briefcase,
  User,
  HeartPulse,
  GraduationCap,
  Home,
  Car,
  Check,
} from 'lucide-react'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'

const TODO_CATEGORIES = ['tagihan', 'investasi', 'belanja', 'tabungan', 'pekerjaan', 'pribadi', 'kesehatan', 'pendidikan', 'rumah', 'transportasi', 'lainnya']
const PRIORITIES = ['low', 'medium', 'high']

const TODO_CATEGORY_META = {
  tagihan: { icon: Receipt, color: 'text-amber-500', bg: 'bg-amber-500/15' },
  investasi: { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/15' },
  belanja: { icon: ShoppingBag, color: 'text-sky-500', bg: 'bg-sky-500/15' },
  tabungan: { icon: Landmark, color: 'text-indigo-500', bg: 'bg-indigo-500/15' },
  pekerjaan: { icon: Briefcase, color: 'text-violet-500', bg: 'bg-violet-500/15' },
  pribadi: { icon: User, color: 'text-pink-500', bg: 'bg-pink-500/15' },
  kesehatan: { icon: HeartPulse, color: 'text-rose-500', bg: 'bg-rose-500/15' },
  pendidikan: { icon: GraduationCap, color: 'text-cyan-500', bg: 'bg-cyan-500/15' },
  rumah: { icon: Home, color: 'text-orange-500', bg: 'bg-orange-500/15' },
  transportasi: { icon: Car, color: 'text-teal-500', bg: 'bg-teal-500/15' },
  lainnya: { icon: Folder, color: 'text-slate-400', bg: 'bg-slate-500/15' },
}

function getCategoryIcon(cat) {
  switch (cat) {
    case 'tagihan':
      return <Receipt size={14} className="text-amber-500" />
    case 'investasi':
      return <TrendingUp size={14} className="text-emerald-500" />
    case 'belanja':
      return <ShoppingBag size={14} className="text-sky-500" />
    case 'tabungan':
      return <Landmark size={14} className="text-indigo-500" />
    case 'pekerjaan':
      return <Briefcase size={14} className="text-violet-500" />
    case 'pribadi':
      return <User size={14} className="text-pink-500" />
    case 'kesehatan':
      return <HeartPulse size={14} className="text-rose-500" />
    case 'pendidikan':
      return <GraduationCap size={14} className="text-cyan-500" />
    case 'rumah':
      return <Home size={14} className="text-orange-500" />
    case 'transportasi':
      return <Car size={14} className="text-teal-500" />
    default:
      return <Folder size={14} className="text-[var(--muted)]" />
  }
}

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
      label: t('todo.statusCompleted'),
      badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-500 font-bold',
      icon: <CheckCircle2 size={13} />,
    }
  }

  if (!dueDate) {
    return {
      label: t('todo.due.none'),
      badgeClass: 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] font-medium',
      icon: <Circle size={13} />,
    }
  }

  const todayObj = startOfDay(new Date())
  const dueDateObj = startOfDay(new Date(String(dueDate) + 'T00:00:00'))

  if (isToday(dueDateObj)) {
    return {
      label: t('todo.due.today'),
      badgeClass: 'border-amber-500/50 bg-amber-500/15 text-amber-500 font-bold',
      icon: <Clock size={13} />,
    }
  }

  if (isTomorrow(dueDateObj)) {
    return {
      label: t('todo.due.tomorrow'),
      badgeClass: 'border-sky-500/40 bg-sky-500/15 text-sky-500 font-bold',
      icon: <Calendar size={13} />,
    }
  }

  if (isBefore(dueDateObj, todayObj)) {
    return {
      label: t('todo.due.overdue'),
      badgeClass: 'border-rose-500/40 bg-rose-500/15 text-rose-500 font-bold',
      icon: <AlertCircle size={13} />,
    }
  }

  return {
    label: format(dueDateObj, 'dd MMM yyyy', { locale: dateLocale }),
    badgeClass: 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] font-semibold',
    icon: <Calendar size={13} />,
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
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingSubId, setEditingSubId] = useState(null)
  const [editingSubText, setEditingSubText] = useState('')

  // Edit mode states
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
      if (target.closest('[data-todo-popover="detail-category"]')) return
      setCategoryOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const startEditing = useCallback(() => {
    if (!todo) return
    setEditDraft({
      title: todo.title || '',
      description: todo.description || '',
      category: todo.category || 'lainnya',
      dueDate: todo.dueDate || '',
      reminderTime: todo.reminderTime || '',
      priority: todo.priority || 'medium',
    })
    setEditError('')
    setIsEditing(true)
    setCategoryOpen(false)
  }, [todo])

  const cancelEditing = useCallback(() => {
    setIsEditing(false)
    setEditDraft(null)
    setEditError('')
    setCategoryOpen(false)
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

      setIsEditing(false)
      setEditDraft(null)
      setEditError('')
      setCategoryOpen(false)
    },
    [editDraft, todoId],
  )

  const handleToggleComplete = useCallback(async () => {
    if (!todo || !todoId) return
    const next = !todo.completed
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(15) } catch { /* ignore */ }
    }
    await db.transaction('rw', db.todos, db.sub_tasks, async () => {
      await db.todos.update(todoId, { completed: next })
      await db.sub_tasks.where('todoId').equals(todoId).modify({ checked: next })
    })
  }, [todo, todoId])

  const handleDeleteTodo = useCallback(async () => {
    if (!todo || !todoId) return
    setIsDeleting(true)
    await db.sub_tasks.where('todoId').equals(todoId).delete()
    await db.todos.delete(todoId)
    navigate('/todos', { replace: true })
  }, [todo, todoId, navigate])

  const handleToggleSubTask = useCallback(async (sub) => {
    if (!sub?.id || !todoId) return
    const nextChecked = !sub.checked
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(nextChecked ? 15 : 10) } catch { /* ignore */ }
    }
    await db.transaction('rw', db.todos, db.sub_tasks, async () => {
      await db.sub_tasks.update(sub.id, { checked: nextChecked })
      const allSubs = await db.sub_tasks.where('todoId').equals(todoId).toArray()
      if (allSubs.length > 0) {
        const allDone = allSubs.every((s) => (s.id === sub.id ? nextChecked : s.checked))
        if (allDone) {
          if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            try { navigator.vibrate(25) } catch { /* ignore */ }
          }
          await db.todos.update(todoId, { completed: true })
        } else {
          await db.todos.update(todoId, { completed: false })
        }
      }
    })
  }, [todoId])

  const handleDeleteSubTask = useCallback(async (subId) => {
    if (!subId || !todoId) return
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
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-strong)] px-3.5 py-1.5 text-xs font-bold text-[var(--fg)] hover:bg-[var(--border)]/40 transition active:scale-95 shadow-xs"
        >
          <ChevronLeft size={18} />
          {t('common.back')}
        </button>
        <EmptyState title={t('todo.emptyTitle')} description={t('todo.emptyDesc')} />
      </div>
    )
  }

  const dateLocale = locale === 'en' ? enLocale : idLocale
  const statusCfg = getDueStatusConfig(todo.dueDate, todo.completed, t, dateLocale)
  const priorityCfg = priorityConfig(todo.priority)
  const formattedDue = todo.dueDate
    ? format(new Date(String(todo.dueDate) + 'T00:00:00'), 'dd MMMM yyyy', { locale: dateLocale })
    : ''
  const doneSubCount = (subTasks || []).filter((s) => s.checked).length
  const totalSubCount = (subTasks || []).length
  const subPercent = totalSubCount > 0 ? Math.round((doneSubCount / totalSubCount) * 100) : 0

  return (
    <div className="ft-page-enter min-h-screen bg-[var(--bg)] pb-28">
      {/* ── Sleek Top Navigation Header ───────────────────────────────── */}
      <div className="pt-[calc(0.75rem+env(safe-area-inset-top))] px-4 sm:px-6">
        <div className="mx-auto max-w-2xl py-2">
          <PageHeader
            onBack={() => (isEditing ? cancelEditing() : navigate('/todos'))}
            backAriaLabel={t('common.back')}
            rightAction={
              !isEditing ? (
                <button
                  type="button"
                  onClick={startEditing}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel-strong)] px-3.5 py-1.5 text-xs font-bold text-[var(--fg)] shadow-xs hover:border-[var(--border-strong)] transition-all active:scale-95"
                >
                  <Edit3 size={13} />
                  <span>{t('todo.edit')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="rounded-full border border-[var(--border)] bg-[var(--panel-strong)] px-3.5 py-1.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] shadow-xs transition-all active:scale-95"
                >
                  <span>{t('common.cancel')}</span>
                </button>
              )
            }
          />
        </div>
      </div>

      {/* ── Main Container ───────────────────────────────────────────── */}
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-2 sm:px-6">
        {!isEditing ? (
          /* ── VIEW MODE LAYOUT ──────────────────────────────────────── */
          <>
            {/* Executive Hero Card */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-xs space-y-4">
              {/* 1. Title First (Primary Reading Hierarchy) */}
              <div>
                <h1
                  className={`text-lg sm:text-xl font-bold tracking-tight text-[var(--fg)] leading-snug break-words [overflow-wrap:anywhere] ${
                    todo.completed ? 'line-through opacity-60' : ''
                  }`}
                >
                  {todo.title}
                </h1>

                {/* Metadata Badges Directly Below Title */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1 text-xs font-bold text-[var(--fg)]">
                    {getCategoryIcon(todo.category)}
                    <span>{t(`todo.cat.${todo.category || 'lainnya'}`)}</span>
                  </span>

                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${priorityCfg.badge}`}>
                    <span className={`h-2 w-2 rounded-full ${priorityCfg.dot}`} />
                    <span>{t(`todo.priority.${todo.priority || 'medium'}`)}</span>
                  </span>

                  {statusCfg && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${statusCfg.badgeClass}`}>
                      {statusCfg.icon}
                      <span>{statusCfg.label}</span>
                    </span>
                  )}
                </div>

                {(todo.dueDate || todo.reminderTime) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs font-semibold text-[var(--muted)]">
                    {todo.dueDate && (
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} />
                        <span>Tenggat: {formattedDue}</span>
                      </span>
                    )}
                    {todo.reminderTime && (
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} />
                        <span>Pengingat: {todo.reminderTime}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Description Block (Clean Tint & Left Accent Line without heavy border) */}
              {todo.description ? (
                <div className="rounded-r-xl border-l-2 border-[var(--fg)]/40 bg-[var(--field-bg)]/60 p-3.5 max-h-80 overflow-y-auto">
                  <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    {t('todo.field.description')}
                  </h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--fg)] break-words [overflow-wrap:anywhere]">
                    {todo.description}
                  </p>
                </div>
              ) : null}
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

              {/* Segmented Progress Bar */}
              {totalSubCount > 0 && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--field-bg)] border border-[var(--border)]/40">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300 ease-out"
                    style={{ width: `${subPercent}%` }}
                  />
                </div>
              )}

              {/* Subtask Items (Clean List Layout with Dividers - No Heavy Cards) */}
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
                            className="h-9 w-9 grid place-items-center rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition active:scale-95 shrink-0"
                            aria-label={'Simpan subtask'}
                          >
                            <CheckCircle2 size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSubId(null)}
                            className="h-9 w-9 grid place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--border)]/40 transition active:scale-95 shrink-0"
                            aria-label={'Batal'}
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <input
                              type="checkbox"
                              className="h-5 w-5 shrink-0 rounded border-[var(--border)] accent-[var(--fg)] cursor-pointer"
                              checked={Boolean(row.checked)}
                              onChange={() => handleToggleSubTask(row)}
                            />
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
                              className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 transition active:scale-95"
                              aria-label={t('todo.subtask.delete')}
                              title={t('todo.subtask.delete')}
                            >
                              <X size={16} />
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
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--fg)] px-4 py-2.5 text-sm font-bold text-[var(--bg)] transition hover:opacity-90 active:scale-95 shrink-0"
                >
                  <Plus size={16} />
                  <span>{t('todo.subtask.add')}</span>
                </button>
              </div>
            </div>

            {/* Static Action Card (In-Flow, Never Overlaps Bottom Nav or AI Bar) */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 shadow-xs flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleToggleComplete}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 px-4 text-xs font-bold transition active:scale-95 ${
                  todo.completed
                    ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20'
                    : 'bg-[var(--fg)] text-[var(--bg)] hover:opacity-95'
                }`}
              >
                {todo.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                <span>{todo.completed ? t('todo.uncomplete') : t('todo.complete')}</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteTodo}
                disabled={isDeleting}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-500 hover:bg-rose-500/20 transition active:scale-95 disabled:opacity-50"
              >
                <Trash2 size={16} />
                <span>{t('todo.delete')}</span>
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
                className="bg-[var(--field-border)] text-[var(--fg)] hover:bg-[var(--field-border-hover)] active:scale-95"
                onClick={cancelEditing}
              >
                {t('todo.editCancel')}
              </Button>
              <Button type="submit" className="active:scale-95">{t('todo.editSave')}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
