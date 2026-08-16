import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, addMonths, subMonths, isSameMonth, isToday, addDays } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../../lib/db'
import useTranslation from '../../hooks/useTranslation'

export default function HabitHeatmapWidget({ habitId }) {
  const { t, locale } = useTranslation()
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))

  const activeHabit = useLiveQuery(() => habitId ? db.habits.get(habitId) : null, [habitId])
  const habitColor = activeHabit?.color || null

  const handlePrevMonth = (e) => {
    e.stopPropagation()
    setCurrentMonth(prev => subMonths(prev, 1))
  }
  
  const handleNextMonth = (e) => {
    e.stopPropagation()
    setCurrentMonth(prev => addMonths(prev, 1))
  }

  const days = useMemo(() => {
    const start = startOfWeek(currentMonth, { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    const intervalDays = eachDayOfInterval({ start, end })
    while (intervalDays.length < 42) {
      const lastDay = intervalDays[intervalDays.length - 1]
      intervalDays.push(addDays(lastDay, 1))
    }
    return intervalDays
  }, [currentMonth])

  const startDateStr = format(days[0], 'yyyy-MM-dd')
  const endDateStr = format(days[days.length - 1], 'yyyy-MM-dd')

  const logs = useLiveQuery(
    async () => {
      const results = await db.habitLogs.where('date').between(startDateStr, endDateStr, true, true).toArray()
      if (habitId) return results.filter(l => l.habitId === habitId)
      return results
    },
    [startDateStr, endDateStr, habitId]
  )
  
  const activityMap = useMemo(() => {
    const map = new Map()
    if (!logs) return map
    logs.forEach(log => {
      const count = map.get(log.date) || 0
      map.set(log.date, count + 1)
    })
    return map
  }, [logs])

  const getCellAppearance = (count, isCurrentMonth) => {
    if (!isCurrentMonth) {
      return {
        className: 'opacity-20 bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--border)_40%,transparent)] ring-inset',
        style: {}
      }
    }
    if (count === 0) {
      return {
        className: 'bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--border)_40%,transparent)] ring-inset',
        style: {}
      }
    }
    if (habitColor) {
      return {
        className: 'ring-1 ring-white/20 ring-inset shadow-sm font-bold text-white',
        style: { backgroundColor: habitColor }
      }
    }
    return {
      className: 'bg-[var(--accent)] ring-1 ring-white/20 ring-inset shadow-sm font-bold text-white',
      style: {}
    }
  }

  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: locale === 'en' ? undefined : idLocale })
  const weekdays = locale === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'S', 'R', 'K', 'J', 'S', 'M']

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--fg)] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="w-[110px] text-center text-[14px] font-bold tracking-tight text-[var(--fg)]">
            {monthLabel}
          </h3>
          <button
            onClick={handleNextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--fg)] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="text-[12px] font-semibold text-[var(--muted)] flex items-center gap-1.5 bg-[var(--field-bg)] px-3 py-1.5 rounded-full border border-[var(--border)]">
          <svg viewBox="0 0 24 24" className="h-3 w-3 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
          </svg>
          {t('habits.days', { count: activityMap.size }, `${activityMap.size} Hari`)}
        </div>
      </div>
      
      <div className="mx-auto max-w-sm">
        <div className="grid grid-cols-7 gap-2">
          {weekdays.map((day, i) => (
            <div key={i} className="text-center text-[11px] font-bold text-[var(--muted-2)]">
              {day}
            </div>
          ))}
          {days.map(dayObj => {
            const dayStr = format(dayObj, 'yyyy-MM-dd')
            const count = activityMap.get(dayStr) || 0
            const isCurrMonth = isSameMonth(dayObj, currentMonth)
            const today = isToday(dayObj)
            const appearance = getCellAppearance(count, isCurrMonth)
            
            return (
              <div key={dayStr} className="flex flex-col items-center gap-1">
                <div
                  title={`${dayStr}: ${count >= 1 ? t('habits.completed', 'Selesai') : t('habits.empty', 'Belum/Kosong')}`}
                  className={`flex items-center justify-center h-9 w-full rounded-lg transition-colors ${appearance.className} ${today ? 'ring-2 ring-[var(--fg)] ring-offset-2 ring-offset-[var(--panel-strong)]' : ''}`}
                  style={appearance.style}
                >
                  <div className={`text-[11px] font-bold ${count > 0 ? 'text-white' : 'text-[var(--muted)]'} ${!isCurrMonth ? 'opacity-40' : ''}`}>
                    {format(dayObj, 'd')}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
