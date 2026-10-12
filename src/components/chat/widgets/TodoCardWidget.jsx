import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListChecks, Calendar, ArrowUpRight, CheckSquare, Square, CheckCircle2, Check } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../lib/db'
import useTranslation from '../../../hooks/useTranslation'
import useChatStore from '../../../store/useChatStore'
import { triggerHaptic } from '../../../lib/haptics'

export default function TodoCardWidget({
  todoId,
  title = 'Tugas Baru',
  category = 'Umum',
  dueDate,
  priority = 'medium',
  subTasks = [],
  action = 'create',
  completed = false,
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const onClose = useChatStore((s) => s.closeChat)

  const isTaskDone = Boolean(completed || action === 'done' || action === 'complete')
  const parsedTodoId = todoId ? Number(todoId) : null

  const dbSubTasks = useLiveQuery(async () => {
    if (!parsedTodoId) return null
    return db.sub_tasks.where('todoId').equals(parsedTodoId).sortBy('id')
  }, [parsedTodoId])

  const [localChecked, setLocalChecked] = useState({})

  const items = useMemo(() => {
    if (dbSubTasks && dbSubTasks.length > 0) {
      return dbSubTasks.map((st) => ({
        id: st.id,
        title: st.label,
        completed: isTaskDone ? true : Boolean(st.checked),
      }))
    }
    return (subTasks || []).map((item, idx) => {
      const isString = typeof item === 'string'
      const title = isString ? item : item.title || item.name || item.label || ''
      const itemId = isString ? idx : (item.id ?? idx)
      const isItemChecked = isTaskDone
        ? true
        : localChecked[itemId] !== undefined
        ? localChecked[itemId]
        : Boolean(item.completed || item.checked)
      return {
        id: itemId,
        title,
        completed: isItemChecked,
      }
    })
  }, [dbSubTasks, subTasks, isTaskDone, localChecked])

  const toggleSubTask = async (idx) => {
    triggerHaptic('light')
    const item = items[idx]
    if (!item) return
    const nextCompleted = !item.completed

    if (dbSubTasks && dbSubTasks[idx]) {
      try {
        await db.sub_tasks.update(dbSubTasks[idx].id, { checked: nextCompleted })
      } catch (err) {
        console.error('Failed to update todo subTasks in DB:', err)
      }
    } else {
      setLocalChecked((prev) => ({ ...prev, [item.id]: nextCompleted }))
      if (parsedTodoId) {
        try {
          const subTaskInDb = await db.sub_tasks
            .where('todoId')
            .equals(parsedTodoId)
            .filter((st) => st.label === item.title)
            .first()
          if (subTaskInDb) {
            await db.sub_tasks.update(subTaskInDb.id, { checked: nextCompleted })
          }
        } catch (err) {
          console.error('Failed to update todo subTasks in DB:', err)
        }
      }
    }
  }

  const handleNavigate = () => {
    triggerHaptic('light')
    if (onClose) onClose()
    if (todoId) {
      navigate(`/todos/${todoId}`)
    } else {
      navigate('/todos')
    }
  }

  // Priority Pill Theme
  const priorityBadge = {
    high: {
      label: t('todos.priority.high', 'Tinggi'),
      className: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
    },
    medium: {
      label: t('todos.priority.medium', 'Sedang'),
      className: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    },
    low: {
      label: t('todos.priority.low', 'Rendah'),
      className: 'bg-sky-500/15 text-sky-500 border-sky-500/30',
    },
  }[priority] || {
    label: t('todos.priority.medium', 'Sedang'),
    className: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  }

  const completedCount = isTaskDone ? items.length : items.filter((it) => it.completed).length

  return (
    <div className="relative rounded-2xl border border-[var(--border)]/70 bg-[var(--panel-strong)]/85 backdrop-blur-md p-3.5 sm:p-4 shadow-sm overflow-hidden my-1.5 ft-msg-enter">
      {/* Top accent bar when completed */}
      {isTaskDone && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500/60" />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--border)]/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border shadow-2xs ${
              isTaskDone
                ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                : 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30'
            }`}
          >
            {isTaskDone ? (
              <CheckCircle2 size={16} strokeWidth={2.4} />
            ) : (
              <ListChecks size={16} strokeWidth={2.2} />
            )}
          </div>
          <div className="min-w-0">
            <div
              className={`text-xs font-black truncate ${
                isTaskDone ? 'text-[var(--muted)] line-through opacity-85' : 'text-[var(--fg)]'
              }`}
            >
              {title}
            </div>
            <div className="text-[10px] font-semibold text-[var(--muted)]">
              {isTaskDone
                ? t('todos.completedDesc', 'Tugas Selesai')
                : (category || t('todos.generalCategory', 'Umum'))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isTaskDone ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10.5px] font-bold text-emerald-500 shadow-2xs">
              <Check size={11} strokeWidth={3} />
              <span>{t('todos.subtasksCompleted', 'Selesai')}</span>
            </span>
          ) : (
            <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold shadow-2xs ${priorityBadge.className}`}>
              {priorityBadge.label}
            </span>
          )}
        </div>
      </div>

      {/* Due Date & Sub-task count */}
      <div className="flex items-center justify-between gap-2 my-2.5 text-[11px] font-semibold text-[var(--muted)]">
        {dueDate ? (
          <div className="flex items-center gap-1">
            <Calendar size={13} className={isTaskDone ? 'text-emerald-500' : 'text-[var(--accent)]'} />
            <span className={isTaskDone ? 'opacity-80' : ''}>{dueDate}</span>
          </div>
        ) : <div />}

        {items.length > 0 && (
          <div className={isTaskDone ? 'text-emerald-500 font-bold' : ''}>
            {completedCount}/{items.length} {t('todos.subtasksCompleted', 'Selesai')}
          </div>
        )}
      </div>

      {/* Interactive Subtasks Checklist */}
      {items.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-[var(--border)]/50 bg-[var(--field-bg)]/40 p-2.5 mb-2">
          {items.map((sub, i) => (
            <button
              key={sub.id ?? i}
              type="button"
              onClick={() => toggleSubTask(i)}
              className="flex w-full items-center gap-2 text-left text-xs text-[var(--fg)] hover:text-[var(--accent)] transition cursor-pointer active:scale-[0.99]"
            >
              {sub.completed ? (
                <CheckSquare size={14} className="text-emerald-500 shrink-0" />
              ) : (
                <Square size={14} className="text-[var(--muted)] shrink-0" />
              )}
              <span className={`truncate ${sub.completed ? 'line-through text-[var(--muted)] opacity-85' : 'font-medium'}`}>
                {sub.title}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Footer CTA */}
      <div className="flex items-center justify-end pt-2 border-t border-[var(--border)]/40">
        <button
          type="button"
          onClick={handleNavigate}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] hover:text-[var(--accent-strong)] transition active:scale-95 cursor-pointer"
        >
          <span>{t('todos.viewAll', 'Lihat di To-Do List')}</span>
          <ArrowUpRight size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

