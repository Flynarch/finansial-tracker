import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, addDays } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { ChevronLeft, Trash2, CheckCircle, Circle, Plus, X, Calendar, Tag } from 'lucide-react'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import EmptyState from '../components/ui/EmptyState'

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
    return { kind: 'today', label: t('todo.due.today'), badgeClass: 'border-yellow-300 bg-yellow-500/10 text-yellow-500' }
  }
  if (dueKey === tomorrowKey) {
    return { kind: 'tomorrow', label: t('todo.due.tomorrow'), badgeClass: 'border-sky-300 bg-sky-500/10 text-sky-400' }
  }
  if (dueKey < todayKey) {
    return { kind: 'overdue', label: t('todo.due.overdue'), badgeClass: 'border-rose-300 bg-rose-500/10 text-rose-400' }
  }
  return null
}

export default function TodoDetailPage() {
  const { id } = useParams()
  const todoId = Number(id)
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [newSubLabel, setNewSubLabel] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const todo = useLiveQuery(() => db.todos.get(todoId), [todoId])
  const subTasks = useLiveQuery(
    () => (todoId ? db.sub_tasks.where('todoId').equals(todoId).sortBy('id') : Promise.resolve([])),
    [todoId],
  )

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
      <div className="min-h-screen bg-[var(--bg)] p-4">
        <button
          onClick={() => navigate('/todos')}
          className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--fg)] transition"
        >
          <ChevronLeft size={20} />
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

  return (
    <div className="ft-page-enter min-h-screen bg-[var(--bg)] pb-24">
      {/* ── Hero Header ────────────────────────────────────────────── */}
      <div className="relative border-b border-[var(--border)] bg-[var(--panel-strong)] px-4 pt-4 pb-6 sm:px-6">
        <div className="mx-auto max-w-3xl">
          {/* Top navigation & action bar */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] hover:bg-[var(--border)]/40 transition active:scale-95"
            >
              <ChevronLeft size={18} />
              {t('common.back')}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleComplete}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                  todo.completed
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                    : 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--border)]/40'
                }`}
              >
                {todo.completed ? <CheckCircle size={15} /> : <Circle size={15} />}
                <span>{todo.completed ? t('todo.uncomplete') : t('todo.complete')}</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteTodo}
                disabled={isDeleting}
                className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-500/20 transition active:scale-95 disabled:opacity-50"
              >
                <Trash2 size={15} />
                <span>{t('todo.delete')}</span>
              </button>
            </div>
          </div>

          {/* Todo Title & Badges */}
          <div className="space-y-3">
            <h1
              className={`text-xl font-bold tracking-tight text-[var(--fg)] sm:text-2xl ${
                todo.completed ? 'line-through opacity-60' : ''
              }`}
            >
              {todo.title}
            </h1>

            <div className="flex flex-wrap items-center gap-2">
              {/* Category */}
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">
                <Tag size={12} />
                {t(`todo.cat.${todo.category || 'lainnya'}`)}
              </span>

              {/* Priority */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--fg)]">
                <span className={`h-2 w-2 rounded-full ${priorityClass(todo.priority)}`} />
                {t(`todo.priority.${todo.priority || 'medium'}`)}
              </span>

              {/* Due Date */}
              {todo.dueDate ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">
                  <Calendar size={12} />
                  {formattedDue}
                </span>
              ) : null}

              {/* Due Status Badge */}
              {status ? (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${status.badgeClass}`}
                >
                  {status.label}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Body Content ────────────────────────────────────────── */}
      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-6 sm:px-6">
        {/* Description Section */}
        {todo.description ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-sm">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              {t('todo.field.description')}
            </h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--fg)]">
              {todo.description}
            </p>
          </div>
        ) : null}

        {/* Subtasks Section */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              {t('todo.subtasksHeading')}
            </h3>
            {totalSubCount > 0 && (
              <span className="rounded-md border border-[var(--border)] bg-[var(--field-bg)] px-2 py-0.5 text-xs font-bold tabular-nums text-[var(--muted)]">
                {doneSubCount}/{totalSubCount}
              </span>
            )}
          </div>

          {/* Subtask list */}
          {(subTasks || []).length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-xs text-[var(--muted)]">{t('todo.subtasksEmpty')}</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {(subTasks || []).map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)]/60 bg-[var(--field-bg)] p-3 transition"
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-[var(--border)] accent-[var(--fg)]"
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
      </div>
    </div>
  )
}
