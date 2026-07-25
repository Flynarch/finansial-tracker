import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, isToday, isTomorrow, isBefore, startOfDay } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import {
  ChevronLeft,
  Trash2,
  CheckCircle2,
  Circle,
  Plus,
  X,
  Calendar,
  Tag,
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
} from 'lucide-react'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'

const TODO_CATEGORIES = ['tagihan', 'investasi', 'belanja', 'tabungan', 'pekerjaan', 'pribadi', 'kesehatan', 'pendidikan', 'rumah', 'transportasi', 'lainnya']
const PRIORITIES = ['low', 'medium', 'high']

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

function getDueStatusConfig(dueStr, completed, t) {
  if (completed) {
    return {
      label: t('todo.completed'),
      badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-500 font-bold',
      icon: <CheckCircle2 size={13} />,
    }
  }
  if (!dueStr) return null

  const dueKey = String(dueStr)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueKey)) return null

  const dueDateObj = startOfDay(new Date(dueKey + 'T00:00:00'))
  const todayObj = startOfDay(new Date())

  if (isToday(dueDateObj)) {
    return {
      label: t('todo.due.today'),
      badgeClass: 'border-amber-500/40 bg-amber-500/15 text-amber-500 font-bold',
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
    label: format(dueDateObj, 'dd MMM yyyy', { locale: idLocale }),
    badgeClass: 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] font-semibold',
    icon: <Calendar size={13} />,
  }
}

export default function TodoDetailPage() {
  const { id } = useParams()
  const todoId = Number(id)
  const isValidId = !isNaN(todoId) && todoId > 0
  const navigate = useNavigate()
  const { t } = useTranslation()

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
      await db.todos.update(todoId, {
        title,
        description: String(editDraft.description || '').trim(),
        category: editDraft.category,
        dueDate,
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
    if (!sub?.id) return
    await db.sub_tasks.update(sub.id, { checked: !sub.checked })
  }, [])

  const handleDeleteSubTask = useCallback(async (subId) => {
    if (!subId) return
    await db.sub_tasks.delete(subId)
  }, [])

  const handleAddSubTask = useCallback(async () => {
    const label = newSubLabel.trim()
    if (!label || !todoId) return
    await db.sub_tasks.add({
      todoId,
      label,
      checked: false,
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

  const statusCfg = getDueStatusConfig(todo.dueDate, todo.completed, t)
  const priorityCfg = priorityConfig(todo.priority)
  const formattedDue = todo.dueDate
    ? format(new Date(String(todo.dueDate) + 'T00:00:00'), 'dd MMMM yyyy', { locale: idLocale })
    : ''
  const doneSubCount = (subTasks || []).filter((s) => s.checked).length
  const totalSubCount = (subTasks || []).length
  const subPercent = totalSubCount > 0 ? Math.round((doneSubCount / totalSubCount) * 100) : 0

  return (
    <div className="ft-page-enter min-h-screen bg-[var(--bg)] pb-12 sm:pb-8">
      {/* ── Sleek Top Navigation Header ───────────────────────────────── */}
      <div className="pt-[calc(0.75rem+env(safe-area-inset-top))] px-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 py-2">
          {/* Back Button */}
          <button
            type="button"
            onClick={() => (isEditing ? cancelEditing() : navigate('/todos'))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs hover:border-[var(--border-strong)] transition-all active:scale-95"
            aria-label={t('common.back')}
          >
            <ChevronLeft size={18} />
          </button>

          {/* Page Action / Title */}
          <div className="flex items-center gap-2">
            {!isEditing ? (
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
                {t('todo.editCancel')}
              </button>
            )}
          </div>
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

                {todo.dueDate && (
                  <p className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]">
                    <Calendar size={13} />
                    <span>Tenggat: {formattedDue}</span>
                  </p>
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
                            aria-label="Simpan subtask"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSubId(null)}
                            className="h-9 w-9 grid place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--border)]/40 transition active:scale-95 shrink-0"
                            aria-label="Batal"
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
                              title="Klik untuk mengedit"
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
              <div className="relative mt-1.5" data-todo-popover="detail-category">
                <button
                  type="button"
                  className="ft-field mt-0 flex items-center justify-between text-left text-base md:text-sm cursor-pointer"
                  onClick={() => setCategoryOpen((v) => !v)}
                  aria-expanded={categoryOpen}
                >
                  <span className="flex items-center gap-2">
                    {getCategoryIcon(editDraft.category)}
                    <span>{t(`todo.cat.${editDraft.category}`)}</span>
                  </span>
                  <span className={`text-xs text-[var(--muted)] transition-transform duration-200 ${categoryOpen ? 'rotate-180' : ''}`}>⌄</span>
                </button>
                <div
                  className={`absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 origin-top transition-all duration-200 ${
                    categoryOpen ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-[0.98] opacity-0'
                  }`}
                >
                  <div className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-1.5 shadow-xl">
                    {TODO_CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`flex w-full items-center gap-2 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition cursor-pointer ${
                          editDraft.category === c ? 'bg-[var(--fg)] text-[var(--bg)] font-bold' : 'text-[var(--fg)] hover:bg-[var(--panel)]'
                        }`}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setEditDraft((p) => ({ ...p, category: c }))
                          setCategoryOpen(false)
                        }}
                      >
                        {getCategoryIcon(c)}
                        <span>{t(`todo.cat.${c}`)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="block">
              <span className="text-xs font-bold text-[var(--fg)] uppercase tracking-wider">{t('todo.field.due')}</span>
              <input
                type="date"
                className="ft-field text-base md:text-sm mt-1.5"
                value={editDraft.dueDate}
                onChange={(e) => setEditDraft((p) => ({ ...p, dueDate: e.target.value }))}
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
                      editDraft.priority === p ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs' : 'text-[var(--muted)] hover:text-[var(--fg)]'
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
