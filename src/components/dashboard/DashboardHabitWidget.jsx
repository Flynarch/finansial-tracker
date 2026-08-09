import { memo } from 'react'
import { Flame } from 'lucide-react'
import MiniHabitHeatmap from '../habits/MiniHabitHeatmap'

export const DashboardHabitWidget = memo(function DashboardHabitWidget({
  globalConsistencyStreak = 0,
  onOpenHabitsZoom,
}) {
  return (
    <section className="ft-stagger-in" style={{ '--stagger': 6 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenHabitsZoom}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpenHabitsZoom()
        }}
        className="ft-interactive-card rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] cursor-pointer"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight text-[var(--fg)]">Konsistensi Kebiasaan</p>
              <p className="text-[11px] font-semibold text-[var(--muted)] mt-0.5">14 Hari Terakhir</p>
            </div>
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1">
                <Flame className="h-4 w-4 text-amber-500" strokeWidth={2.5} />
                <span className="text-lg font-black text-[var(--fg)] tabular-nums leading-none">
                  {globalConsistencyStreak}
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)] mt-0.5">
                Hari Beruntun
              </span>
            </div>
          </div>
          <MiniHabitHeatmap />
        </div>
      </div>
    </section>
  )
})

export default DashboardHabitWidget
