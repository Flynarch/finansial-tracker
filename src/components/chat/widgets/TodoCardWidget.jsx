import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListChecks, Calendar, ArrowUpRight, CheckSquare, Square } from 'lucide-react'
import { db } from '../../../lib/db'
import useTranslation from '../../../hooks/useTranslation'
import useChatStore from '../../../store/useChatStore'

export default function TodoCardWidget({
  todoId,
  title = 'Tugas Baru',
  category = 'Umum',
  dueDate,
  priority = 'medium',
  subTasks = [],
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const onClose = useChatStore((s) => s.closeChat)

  const initialItems = (subTasks || []).map((item, idx) => {
    if (typeof item === 'string') {
      return { id: idx, title: item, completed: false }
    }
    return { id: idx, title: item.title || item.name || '', completed: !!item.completed }
  })

  const [items, setItems] = useState(initialItems)

  const toggleSubTask = async (idx) => {
    const next = items.map((it, i) => (i === idx ? { ...it, completed: !it.completed } : it))
    setItems(next)

    if (todoId) {
      try {
        const item = items[idx]
        if (item) {
          const subTaskInDb = await db.sub_tasks.where({ todoId: Number(todoId), label: item.title }).first()
          if (subTaskInDb) {
            await db.sub_tasks.update(subTaskInDb.id, { checked: !item.completed })
          }
        }
      } catch (err) {
        console.error('Failed to update todo subTasks in DB:', err)
      }
    }
  }

  const handleNavigate = () => {
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

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3.5 sm:p-4 shadow-sm my-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--border)]/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30">
            <ListChecks size={16} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-[var(--fg)] truncate">{title}</div>
            <div className="text-[10px] font-semibold text-[var(--muted)]">
              {category || t('todos.generalCategory', 'Umum')}
            </div>
          </div>
        </div>

        <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold shrink-0 ${priorityBadge.className}`}>
          {priorityBadge.label}
        </span>
      </div>

      {/* Due Date & Sub-task count */}
      <div className="flex items-center gap-3 my-2.5 text-[11px] font-semibold text-[var(--muted)]">
        {dueDate && (
          <div className="flex items-center gap-1">
            <Calendar size={13} className="text-[var(--accent)]" />
            <span>{dueDate}</span>
          </div>
        )}
        {items.length > 0 && (
          <div>
            {items.filter((it) => it.completed).length}/{items.length} {t('todos.subtasksCompleted', 'Selesai')}
          </div>
        )}
      </div>

      {/* Interactive Subtasks Checklist */}
      {items.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-[var(--border)]/60 bg-[var(--field-bg)]/60 p-2.5 mb-2">
          {items.map((sub, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleSubTask(i)}
              className="flex w-full items-center gap-2 text-left text-xs text-[var(--fg)] hover:text-[var(--accent)] transition cursor-pointer"
            >
              {sub.completed ? (
                <CheckSquare size={14} className="text-emerald-500 shrink-0" />
              ) : (
                <Square size={14} className="text-[var(--muted)] shrink-0" />
              )}
              <span className={`truncate ${sub.completed ? 'line-through text-[var(--muted)]' : 'font-medium'}`}>
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
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] hover:underline cursor-pointer"
        >
          <span>{t('todos.viewAll', 'Lihat di To-Do List')}</span>
          <ArrowUpRight size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

