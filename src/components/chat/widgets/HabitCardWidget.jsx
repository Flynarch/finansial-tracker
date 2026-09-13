import { useState, useMemo } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import { Flame, Check, ArrowUpRight } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../lib/db'
import useTranslation from '../../../hooks/useTranslation'
import useChatStore from '../../../store/useChatStore'
import { safeFormatDate } from '../../../lib/utils'

export default function HabitCardWidget({
  habitId,
  title = 'Kebiasaan Baru',
  color = 'indigo',
  frequencyType = 'daily',
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const onClose = useChatStore((s) => s.closeChat)
  const [isProcessing, setIsProcessing] = useState(false)

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const habit = useLiveQuery(async () => {
    if (habitId) return db.habits.get(Number(habitId))
    return db.habits.where('title').equalsIgnoreCase(title).first()
  }, [habitId, title])

  const targetHabitId = habit?.id || (habitId ? Number(habitId) : null)

  const allLogs = useLiveQuery(async () => {
    if (!targetHabitId) return []
    return db.habitLogs.where('habitId').equals(targetHabitId).toArray()
  }, [targetHabitId], [])

  const isLoggedToday = allLogs.some((l) => l.date === todayStr)

  const pastWeekLogs = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'))
    return days.map((d) => ({
      date: d,
      done: allLogs.some((l) => l.date === d),
    }))
  }, [allLogs])

  const handleToggleLog = async () => {
    if (isProcessing) return
    setIsProcessing(true)

    try {
      let resolvedId = targetHabitId
      if (!resolvedId) {
        resolvedId = await db.habits.add({
          title,
          color,
          category: 'Lainnya',
          frequencyType,
          createdAt: Date.now(),
        })
      }

      if (isLoggedToday) {
        await db.habitLogs.where({ habitId: resolvedId, date: todayStr }).delete()
      } else {
        await db.habitLogs.add({
          habitId: resolvedId,
          date: todayStr,
          completedAt: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error('Failed to toggle habit log:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleNavigate = () => {
    if (onClose) onClose()
    navigate('/todos')
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3.5 sm:p-4 shadow-sm my-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--border)]/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
            <Flame size={16} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-[var(--fg)] truncate">{title}</div>
            <div className="text-[10px] font-semibold text-[var(--muted)]">
              {frequencyType === 'daily' ? t('habits.frequency.daily', 'Harian') : frequencyType}
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={isProcessing}
          onClick={handleToggleLog}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs shrink-0 ${
            isLoggedToday
              ? 'bg-emerald-500 text-white border-emerald-600'
              : 'bg-[var(--field-bg)] text-[var(--fg)] border-[var(--border)] hover:border-emerald-500/50'
          }`}
        >
          <Check size={13} strokeWidth={3} className={isLoggedToday ? 'text-white' : 'text-[var(--muted)]'} />
          <span>{isLoggedToday ? t('habits.doneToday', 'Selesai') : t('habits.logToday', 'Catat Hari Ini')}</span>
        </button>
      </div>

      {/* 7-Days Mini Weekly Tracker Dots */}
      <div className="my-3">
        <div className="text-[10.5px] font-bold text-[var(--muted)] mb-1.5 flex items-center justify-between">
          <span>{t('habits.weeklyProgress', 'Pelacak 7 Hari Terakhir')}</span>
          <span className="text-[10px] text-[var(--muted)]/80">{todayStr}</span>
        </div>
        <div className="flex items-center justify-between gap-1.5 rounded-xl border border-[var(--border)]/60 bg-[var(--field-bg)]/60 p-2">
          {pastWeekLogs.map((item, idx) => {
            const isToday = item.date === todayStr
            return (
              <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={`h-5 w-5 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all ${
                    item.done
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : isToday
                      ? 'border-2 border-dashed border-[var(--accent)] text-[var(--accent)]'
                      : 'bg-[var(--panel)] border border-[var(--border)] text-[var(--muted)]/50'
                  }`}
                >
                  {item.done ? <Check size={11} strokeWidth={3} /> : idx + 1}
                </div>
                <span className="text-[9px] font-semibold text-[var(--muted)]">
                  {safeFormatDate(item.date, 'EE')}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="flex items-center justify-end pt-2 border-t border-[var(--border)]/40">
        <button
          type="button"
          onClick={handleNavigate}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] hover:underline cursor-pointer"
        >
          <span>{t('habits.viewAll', 'Lihat Semua Habit')}</span>
          <ArrowUpRight size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

HabitCardWidget.propTypes = {
  habitId: PropTypes.number,
  title: PropTypes.string,
  color: PropTypes.string,
  frequencyType: PropTypes.string,
  action: PropTypes.string,
}
