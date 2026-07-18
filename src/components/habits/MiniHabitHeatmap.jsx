import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { format, subDays } from 'date-fns'
import { isHabitScheduledOnDate } from '../../lib/habitStats'

export default function MiniHabitHeatmap() {
  // Generate the last 14 days ending today
  const days = Array.from({ length: 14 }, (_, i) => {
    return format(subDays(new Date(), 13 - i), 'yyyy-MM-dd')
  })

  const startDateStr = days[0]
  const endDateStr = days[days.length - 1]

  const habits = useLiveQuery(() => db.habits.toArray(), []) || []

  const logs = useLiveQuery(
    () => db.habitLogs.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    [startDateStr, endDateStr]
  ) || []

  const map = new Map()
  if (logs) {
    logs.forEach(log => {
      map.set(log.date, (map.get(log.date) || 0) + 1)
    })
  }

  const getColorClass = (count, total) => {
    if (total <= 0 || count <= 0) {
      return 'bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--border)_40%,transparent)] ring-inset'
    }
    const pct = Math.round((count / total) * 100)
    if (pct <= 0) return 'bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--border)_40%,transparent)] ring-inset'
    if (pct <= 33) return 'bg-[color-mix(in_srgb,var(--accent)_30%,transparent)]'
    if (pct <= 66) return 'bg-[color-mix(in_srgb,var(--accent)_60%,transparent)]'
    if (pct <= 99) return 'bg-[color-mix(in_srgb,var(--accent)_85%,transparent)]'
    return 'bg-[var(--accent)] shadow-sm font-bold'
  }

  return (
    <div className="flex w-full items-center justify-between gap-1 overflow-hidden">
      {days.map(day => {
        const count = map.get(day) || 0
        const total = habits.filter(h => isHabitScheduledOnDate(h, day)).length
        return (
          <div 
            key={day} 
            className={`h-6 flex-1 rounded-[4px] ${getColorClass(count, total)}`}
            title={`${day}: ${count}/${total} (${total > 0 ? Math.round((count / total) * 100) : 0}%)`}
          />
        )
      })}
    </div>
  )
}
