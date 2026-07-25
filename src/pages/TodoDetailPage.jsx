import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, addDays } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { ChevronLeft, Trash2, CheckCircle, Circle, Plus, X, Calendar, Tag, Edit2, CheckSquare } from 'lucide-react'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'

const TODO_CATEGORIES = ['tagihan', 'investasi', 'belanja', 'tabungan', 'lainnya']
const PRIORITIES = ['low', 'medium', 'high']

function priorityClass(p) {
  if (p === 'high') return 'bg-rose-500'
  if (p === 'medium') return 'bg-amber-400'
  return 'bg-slate-400'
}

function dueStatus(dueStr, t) {
  if (!dueStr) return null
  const dueKey = String(dueStr)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueKey)) return null

  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const tomorrowKey = format(addDays(new Date(todayKey + 'T00:00:00'), 1), 'yyyy-MM-dd')

  if (dueKey === todayKey) {
    return { kind: 'today', label: t('todo.due.today'), badgeClass: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-500' }
  }
  if (dueKey === tomorrowKey) {
    return { kind: 'tomorrow', label: t('todo.due.tomorrow'), badgeClass: 'border-sky-500/30 bg-sky-500/10 text-sky-400' }
  }
  if (dueKey < todayKey) {
    return { kind: 'overdue', label: t('todo.due.overdue'), badgeClass: 'border-rose-500/30 bg-rose-500/10 text-rose-400' }
  }
  return null
}

export default function TodoDetailPage() {
  const { id } = useParams()
  const todoId = Number(id)
  const navigate = useNavigate()
  const { t } = useTranslation()

  // View state & subtask state
  const [newSubLabel, setNewSubLabel] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(null)
  const [categoryOpen, setCategoryOpen] = useState(false)

  const todo = useLiveQuery(() => db.todos.get(todoId), [todoId])
  const subTasks = useLiveQuery(
    () => (todoId ? db.sub_tasks.where('todoId').equals(todoId).sortBy('id') : Promise.resolve([])),
    [todoId],
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
    setIsEditing(true)
    setCategoryOpen(false)
  }, [todo])

  const cancelEditing = useCallback(() => {
    setIsEditing(false)
    setEditDraft(null)
    setCategoryOpen(false)
  }, [])

  const saveEdit = useCallback(async (e) => {
    if (e) e.preventDefault()
    if (!editDraft || !todoId) return
    const title = String(editDraft.title || '').trim()
    if (!title) return

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
    setCategoryOpen(false)
  }, [editDraft, todoId])

  const handleToggleComplete = useCallback(async () => {
    if (!todo) return
    await db.todos.update(todoId, { completed: !todo.completed })
  }, [todo, todoId])

  const handleDeleteTodo = useCallback(async () => {
    if (!todo) return
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

  if (!todo) {
    return (
      <div className="min-h-screen bg-[var(--bg)] p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <button
          onClick={() => navigate('/todos')}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] hover:bg-[var(--border)]/40 transition active:scale-95"
        >
          <ChevronLeft size={18} />
          {t('common.back')}
        </button>
        <EmptyState title={t('todo.emptyTitle')} description={t('todo.emptyDesc')} />
      </div>
    )
  }

  const status = dueStatus(todo.dueDate, t)
  const formattedDue = todo.dueDate ? format(new Date(String(todo.dueDate)), 'dd MMM yyyy', { locale: idLocale }) : ''
  const doneSubCount = (subTasks || []).filter((s) => s.checked).length
  const totalSubCount = (subTasks || []).length
  const subPercent = totalSubCount > 0 ? Math.round((doneSubCount / totalSubCount) * 100) : 0

  return (
    <div className="ft-page-enter min-h-screen bg-[var(--bg)] pb-32 sm:pb-28">
      {/* ── Hero Header ────────────────────────────────────────────── */}
      <div className="relative border-b border-[var(--border)] bg-gradient-to-b from-[var(--panel-strong)] to-[var(--bg)] px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-6 sm:px-6 shadow-sm">
        <div className="mx-auto max-w-2xl">
          {/* Top navigation & action bar */}
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => (isEditing ? cancelEditing() : navigate('/todos'))}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] shadow-sm hover:bg-[var(--border)]/40 transition active:scale-95"
              aria-label={t('common.back')}
            >
              <ChevronLeft size={20} />
            </button>

            {/* Quick Action Pills Row */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {!isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={startEditing}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-1.5 text-xs font-bold text-[var(--fg)] shadow-sm hover:bg-[var(--border)]/40 transition active:scale-95"
                  >
                    <Edit2 size={14} />
                    <span>{t('todo.edit')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleComplete}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-sm transition active:scale-95 ${
                      todo.completed
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                        : 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--border)]/40'
                    }`}
                  >
                    {todo.completed ? <CheckCircle size={14} /> : <Circle size={14} />}
                    <span>{todo.completed ? t('todo.uncomplete') : t('todo.complete')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteTodo}
                    disabled={isDeleting}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-xs font-bold text-rose-500 shadow-sm hover:bg-rose-500/20 transition active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    <span>{t('todo.delete')}</span>
                  </button>
                </>
              ) : (
                <span className="rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Mode Edit
                </span>
              )}
            </div>
          </div>

          {/* Todo Title & Badges (View Mode Header) */}
          {!isEditing && (
            <div className="space-y-3.5 pt-1">
              <h1
                className={`text-xl font-bold tracking-tight text-[var(--fg)] sm:text-2xl leading-snug ${
                  todo.completed ? 'line-through opacity-60' : ''
                }`}
              >
                {todo.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1 text-xs font-semibold text-[var(--muted)] shadow-xs">
                  <Tag size={12} />
                  {t(`todo.cat.${todo.category || 'lainnya'}`)}
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1 text-xs font-semibold text-[var(--fg)] shadow-xs">
                  <span className={`h-2 w-2 rounded-full ${priorityClass(todo.priority)}`} />
                  {t(`todo.priority.${todo.priority || 'medium'}`)}
                </span>

                {todo.dueDate ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1 text-xs font-semibold text-[var(--muted)] shadow-xs">
                    <Calendar size={12} />
                    {formattedDue}
                  </span>
                ) : null}

                {status ? (
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold shadow-xs ${status.badgeClass}`}
                  >
                    {status.label}
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content Area ───────────────────────────────────────── */}
      <div className="mx-auto max-w-2xl space-y-5 px-4 pt-5 sm:px-6">
        {isEditing && editDraft ? (
          /* ── EDIT FORM MODE ────────────────────────────────────────── */
          <form onSubmit={saveEdit} className="ft-sheet-enter space-y-4.5 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-6 shadow-sm">
            <label className="ft-label block">
              <span className="text-xs font-bold text-[var(--fg)] uppercase tracking-wider">{t('todo.field.title')}</span>
              <input
                className="ft-field appearance-none text-base md:text-sm mt-1.5"
                value={editDraft.title}
                onChange={(e) => setEditDraft((p) => ({ ...p, title: e.target.value }))}
                required
                maxLength={200}
              />
            </label>

            <label className="ft-label block">
              <span className="text-xs font-bold text-[var(--fg)] uppercase tracking-wider">{t('todo.field.description')}</span>
              <textarea
                className="ft-field min-h-[5.5rem] resize-y text-base md:text-sm mt-1.5 leading-relaxed"
                value={editDraft.description}
                onChange={(e) => setEditDraft((p) => ({ ...p, description: e.target.value }))}
                maxLength={2000}
              />
            </label>

            <label className="ft-label block">
              <span className="text-xs font-bold text-[var(--fg)] uppercase tracking-wider">{t('todo.field.category')}</span>
              <div className="relative mt-1.5">
                <button
                  type="button"
                  className="ft-field mt-0 flex items-center justify-between text-left text-base md:text-sm"
                  onClick={() => setCategoryOpen((v) => !v)}
                  aria-expanded={categoryOpen}
                  data-todo-popover="detail-category"
                >
                  <span>{t(`todo.cat.${editDraft.category}`)}</span>
                  <span className={`text-xs text-[var(--muted)] transition-transform duration-200 ${categoryOpen ? 'rotate-180' : ''}`}>⌄</span>
                </button>
                <div
                  className={`absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 origin-top transition-all duration-200 ${
                    categoryOpen ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-[0.98] opacity-0'
                  }`}
                >
                  <div className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-1.5 shadow-[var(--shadow-card)]">
                    {TODO_CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                          editDraft.category === c ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--fg)] hover:bg-[var(--panel)]'
                        }`}
                        onClick={() => {
                          setEditDraft((p) => ({ ...p, category: c }))
                          setCategoryOpen(false)
                        }}
                      >
                        {t(`todo.cat.${c}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </label>

            <label className="ft-label block">
              <span className="text-xs font-bold text-[var(--fg)] uppercase tracking-wider">{t('todo.field.due')}</span>
              <input
                type="date"
                className="ft-field text-base md:text-sm mt-1.5"
                value={editDraft.dueDate}
                onChange={(e) => setEditDraft((p) => ({ ...p, dueDate: e.target.value }))}
              />
            </label>

            <label className="ft-label block">
              <span className="text-xs font-bold text-[var(--fg)] uppercase tracking-wider">{t('todo.field.priority')}</span>
              <div className="mt-1.5 grid grid-cols-3 gap-2 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`rounded-lg px-2 py-2 text-xs font-bold transition active:scale-95 ${
                      editDraft.priority === p ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs' : 'text-[var(--muted)] hover:text-[var(--fg)]'
                    }`}
                    onClick={() => setEditDraft((s) => ({ ...s, priority: p }))}
                  >
                    {t(`todo.priority.${p}`)}
                  </button>
                ))}
              </div>
            </label>

            <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border)] pt-4 mt-2">
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
        ) : (
          /* ── VIEW MODE ─────────────────────────────────────────────── */
          <>
            {/* Description Section */}
            {todo.description ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4.5 shadow-sm sm:p-5">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  {t('todo.field.description')}
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--fg)]">
                  {todo.description}
                </p>
              </div>
            ) : null}

            {/* Subtasks Section */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4.5 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare size={16} className="text-[var(--muted)]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    {t('todo.subtasksHeading')}
                  </h3>
                </div>
                {totalSubCount > 0 && (
                  <span className="rounded-md border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-0.5 text-xs font-bold tabular-nums text-[var(--muted)]">
                    {doneSubCount}/{totalSubCount} ({subPercent}%)
                  </span>
                )}
              </div>

              {/* Progress Bar when subtasks exist */}
              {totalSubCount > 0 && (
                <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-[var(--field-bg)] border border-[var(--border)]/40">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                    style={{ width: `${subPercent}%` }}
                  />
                </div>
              )}

              {/* Subtask list */}
              {(subTasks || []).length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-[var(--muted)]">{t('todo.subtasksEmpty')}</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {(subTasks || []).map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)]/60 bg-[var(--field-bg)] p-3 transition active:scale-[0.99]"
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4.5 w-4.5 shrink-0 rounded border-[var(--border)] accent-[var(--fg)] cursor-pointer"
                          checked={Boolean(row.checked)}
                          onChange={() => handleToggleSubTask(row)}
                        />
                        <span
                          className={`text-sm font-medium transition ${
                            row.checked ? 'text-[var(--muted)] line-through opacity-70' : 'text-[var(--fg)]'
                          }`}
                        >
                          {row.label}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleDeleteSubTask(row.id)}
                        className="shrink-0 rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-500 transition"
                        aria-label={t('todo.subtask.delete')}
                      >
                        <X size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Add subtask input */}
              <div className="mt-4 flex gap-2">
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
                  className="flex items-center gap-1 rounded-xl bg-[var(--fg)] px-4 py-2.5 text-sm font-bold text-[var(--bg)] transition hover:opacity-90 active:scale-95 shrink-0"
                >
                  <Plus size={16} />
                  <span>{t('todo.subtask.add')}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
