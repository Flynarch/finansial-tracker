import { memo } from 'react'
import { Flame } from 'lucide-react'
import MiniHabitHeatmap from '../habits/MiniHabitHeatmap'

export const DashboardHabitWidget = memo(function DashboardHabitWidget({
  globalConsistencyStreak = 0,
  onOpenHabitsZoom,
}) {
  return (
    <section className="ft-stagger-in py-1" style={{ '--stagger': 4 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenHabitsZoom}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpenHabitsZoom()
        }}
        className="text-left focus-visible:outline-none cursor-pointer"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Konsistensi Kebiasaan</p>
              <p className="text-[11px] font-semibold text-[var(--muted)]">14 Hari Terakhir</p>
            </div>
            <div className="flex items-center gap-1.5 bg-[var(--field-bg)]/80 border border-[var(--border)]/60 px-2.5 py-1 rounded-full">
              <Flame className="h-4 w-4 text-amber-500" strokeWidth={2.5} />
              <span className="text-sm font-black text-[var(--fg)] tabular-nums leading-none">
                {globalConsistencyStreak}
              </span>
              <span className="text-[10px] font-bold text-[var(--muted)]">
                hari
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--field-bg)]/80 p-3.5 shadow-xs">
            <MiniHabitHeatmap />
          </div>
        </div>
      </div>
    </section>
  )
})

export default DashboardHabitWidget
