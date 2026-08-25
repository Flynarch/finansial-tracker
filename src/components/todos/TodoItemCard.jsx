import { memo } from 'react'
import { ChevronRight, Check, Clock } from 'lucide-react'
import { priorityClass } from './TodoMeta'

const updateBgVisual = (bgEl, mode) => {
  if (!bgEl || bgEl.dataset.swipeMode === mode) return
  bgEl.dataset.swipeMode = mode
  bgEl.classList.remove(
    'opacity-0',
    'opacity-100',
    'bg-rose-500/15',
    'text-rose-500',
    'justify-end',
    'bg-emerald-500/15',
    'text-emerald-500',
    'justify-start',
    'justify-between'
  )
  if (mode === 'delete') {
    bgEl.classList.add('opacity-100', 'bg-rose-500/15', 'text-rose-500', 'justify-end')
    bgEl.innerHTML =
      '<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>'
  } else if (mode === 'complete') {
    bgEl.classList.add('opacity-100', 'bg-emerald-500/15', 'text-emerald-500', 'justify-start')
    bgEl.innerHTML =
      '<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>'
  } else {
    bgEl.classList.add('opacity-0', 'justify-between')
    bgEl.innerHTML = ''
  }
}

export const TodoItemCard = memo(function TodoItemCard({
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
        <div className="absolute inset-0 z-0 flex items-center justify-between rounded-[1.25rem] px-5 opacity-0 transition-colors duration-200" />

        <div
          className={`relative z-10 flex h-full touch-pan-y flex-col justify-between rounded-[1rem] border border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[var(--panel-strong)] p-3 shadow-xs transition-colors ${doneStyle} ${dimCompleted} ${
            status?.borderClass || ''
          }`}
          style={{
            transform: isSwiping ? undefined : 'translateX(0px)',
            transition: isSwiping ? 'none' : 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
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
              currentTarget.style.transition = 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)'
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
            const currentTarget = e.currentTarget
            const bgEl = currentTarget.previousElementSibling

            swipeTodoIdRef.current = null
            setSwipeTodoId(null)

            currentTarget.style.transition = 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)'
            currentTarget.style.transform = 'translateX(0px)'
            currentTarget.style.willChange = 'auto'

            if (Math.abs(finalDx) > 8) {
              ignoreNextClickRef.current = true
            }

            if (finalDx <= -60) {
              onDeleteTodoFromCard(todo)
            } else if (finalDx >= 60) {
              toggleCardComplete(todo.id, todo.completed)
            }
            updateBgVisual(bgEl, 'none')
          }}
        >
          <div className="flex items-start gap-2.5">
            {/* Round completion checkbox button with expanded touch target */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                toggleCardComplete(todo.id, todo.completed)
              }}
              className="mt-0 flex h-9 w-9 min-h-[36px] min-w-[36px] shrink-0 items-center justify-center -m-1.5 p-1.5 rounded-full cursor-pointer group/check"
              aria-label={todo.completed ? t('todos.unmarkComplete') : t('todos.markComplete')}
            >
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border transition active:scale-90 ${
                  todo.completed
                    ? 'border-[var(--status-income)] bg-[var(--status-income)] text-white'
                    : 'border-[var(--border-strong)] bg-transparent group-hover/check:border-[var(--status-income)]/50'
                }`}
              >
                {todo.completed && <Check className="h-3 w-3" strokeWidth={3} />}
              </div>
            </button>

            {/* Todo Info & Title */}
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => {
                if (ignoreNextClickRef.current) {
                  ignoreNextClickRef.current = false
                  return
                }
                openDetail(todo.id)
              }}
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-xs sm:text-sm font-bold text-[var(--fg)] tracking-tight leading-snug break-words ${
                    todo.completed ? 'line-through text-[var(--muted)]' : ''
                  }`}
                >
                  {todo.title}
                </span>

                {/* Priority dot indicator */}
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${priorityClass(todo.priority)}`}
                  title={`Priority: ${todo.priority || 'normal'}`}
                />
              </div>

              {/* Sub-progress bar if subtasks exist */}
              {showProg && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-[var(--field-bg)] overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                      style={{ width: `${((subProgress.done || 0) / subProgress.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-[var(--muted)] shrink-0">
                    {subProgress.done || 0}/{subProgress.total}
                  </span>
                </div>
              )}

              {/* Due Date & Reminder Badge */}
              {todo.dueDate && (
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${dueBadgeCls}`}>
                    {status?.label || todo.dueDate}
                  </span>
                  {todo.reminderTime && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)] font-medium">
                      <Clock size={10} className="shrink-0 text-[var(--muted)]" />
                      <span>{todo.reminderTime}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Detail arrow button */}
            <button
              type="button"
              onClick={() => openDetail(todo.id)}
              className="rounded-lg p-1 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition shrink-0 cursor-pointer"
              aria-label={t('common.details', 'Detail')}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </li>
  )
})
