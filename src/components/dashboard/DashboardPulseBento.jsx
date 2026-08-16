import { memo } from 'react'
import { PieChart, Target, ChevronRight, AlertTriangle, CheckCircle2, Plus } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import useTranslation from '../../hooks/useTranslation'

export const DashboardPulseBento = memo(function DashboardPulseBento({
  isDbLoading = false,
  budgetGoalSummary,
  defaultCurrency = 'IDR',
  locale = 'id',
  onOpenBudgetDetail,
  onOpenSavingsDetail,
}) {
  const { t } = useTranslation()

  if (isDbLoading) {
    return (
      <section className="ft-stagger-in" style={{ '--stagger': 4 }}>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 shadow-xs animate-pulse space-y-3 min-h-[120px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="h-7 w-7 rounded-xl bg-[var(--border)]/60" />
              <div className="h-3.5 w-3.5 rounded bg-[var(--border)]/40" />
            </div>
            <div className="space-y-1">
              <div className="h-2.5 w-14 rounded bg-[var(--border)]/50" />
              <div className="h-4 w-20 rounded bg-[var(--border)]/70" />
            </div>
            <div className="h-1.5 w-full rounded-full bg-[var(--border)]/40" />
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 shadow-xs animate-pulse space-y-3 min-h-[120px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="h-7 w-7 rounded-xl bg-[var(--border)]/60" />
              <div className="h-3.5 w-3.5 rounded bg-[var(--border)]/40" />
            </div>
            <div className="space-y-1">
              <div className="h-2.5 w-14 rounded bg-[var(--border)]/50" />
              <div className="h-4 w-20 rounded bg-[var(--border)]/70" />
            </div>
            <div className="h-1.5 w-full rounded-full bg-[var(--border)]/40" />
          </div>
        </div>
      </section>
    )
  }

  // 1. Budget Stats
  const budgetRows = budgetGoalSummary?.budgetRows || []
  const totalBudgetSpent = budgetRows.reduce((sum, r) => sum + (r.spent || 0), 0)
  const totalBudgetLimit = budgetRows.reduce((sum, r) => sum + (r.limit || 0), 0)
  const budgetPct = totalBudgetLimit > 0 ? Math.min(100, Math.round((totalBudgetSpent / totalBudgetLimit) * 100)) : 0
  const budgetWarnings = budgetRows.filter((r) => r.pct >= 80)
  const isOverBudget = totalBudgetSpent > totalBudgetLimit && totalBudgetLimit > 0
  const hasBudgets = budgetRows.length > 0

  // 2. Goals Stats
  const goalRows = budgetGoalSummary?.goalRows || []
  const totalGoalCurrent = goalRows.reduce((sum, r) => sum + (r.current || 0), 0)
  const totalGoalTarget = goalRows.reduce((sum, r) => sum + (r.target || 0), 0)
  const goalPct = totalGoalTarget > 0 ? Math.min(100, Math.round((totalGoalCurrent / totalGoalTarget) * 100)) : 0
  const hasGoals = goalRows.length > 0

  return (
    <section className="ft-stagger-in" style={{ '--stagger': 4 }}>
      <div className="grid grid-cols-2 gap-2.5">
        {/* Bento Card 1: Anggaran */}
        <div
          role="button"
          tabIndex={0}
          onClick={onOpenBudgetDetail}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onOpenBudgetDetail?.()
          }}
          className="ft-bento-card group rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 shadow-xs hover:border-[var(--border-strong)] transition-all cursor-pointer flex flex-col justify-between active:scale-[0.98] min-h-[120px]"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="grid h-7 w-7 place-items-center rounded-xl bg-indigo-500/12 text-indigo-500 border border-indigo-500/20">
                <PieChart className="h-3.5 w-3.5" />
              </div>
              <div className="flex items-center gap-1">
                {!hasBudgets ? (
                  <span className="rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-indigo-500 border border-indigo-500/15">
                    {t('dashboard.budget.unconfigured', 'Atur')}
                  </span>
                ) : null}
                <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)] opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>

            <p className="mt-2 text-[11px] font-bold text-[var(--muted)] truncate">
              {t('budget.title', 'Anggaran')}
            </p>

            {hasBudgets ? (
              <p className="mt-0.5 text-sm sm:text-base font-black tabular-nums tracking-tight text-[var(--fg)]">
                {budgetPct}% <span className="text-[10px] font-medium text-[var(--muted)]">{t('budget.used', 'terpakai')}</span>
              </p>
            ) : (
              <p className="mt-0.5 text-xs font-black text-[var(--fg)]">
                {t('budget.notSet', 'Belum Diatur')}
              </p>
            )}
          </div>

          <div className="mt-2.5 pt-2 border-t border-[var(--border)]/60">
            {hasBudgets ? (
              <div className="space-y-1.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--field-bg)]">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOverBudget
                        ? 'bg-rose-500'
                        : budgetPct >= 80
                        ? 'bg-amber-500'
                        : 'bg-indigo-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(budgetPct, totalBudgetSpent > 0 ? 3 : 0))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9.5px] font-semibold text-[var(--muted)]">
                  <span className="truncate">
                    {budgetWarnings.length > 0 ? (
                      <span className="text-amber-500 flex items-center gap-0.5 font-bold">
                        <AlertTriangle className="h-2.5 w-2.5" /> {budgetWarnings.length} {t('budget.warning', 'waspada')}
                      </span>
                    ) : (
                      <span className="text-emerald-500 flex items-center gap-0.5 font-bold">
                        <CheckCircle2 className="h-2.5 w-2.5" /> {t('budget.safe', 'Aman')}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums font-bold">
                    {formatCurrency(totalBudgetSpent, defaultCurrency, locale)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-[var(--field-bg)] border border-dashed border-[var(--border)]" />
                <div className="flex items-center justify-between text-[9.5px] font-extrabold text-[var(--accent)]">
                  <span className="flex items-center gap-0.5">
                    <Plus size={11} strokeWidth={2.5} />
                    {t('budget.createQuick', 'Atur Anggaran')}
                  </span>
                  <span className="text-[9px] font-semibold text-[var(--muted-2)]">0 Kategori</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bento Card 2: Target Tabungan */}
        <div
          role="button"
          tabIndex={0}
          onClick={onOpenSavingsDetail}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onOpenSavingsDetail?.()
          }}
          className="ft-bento-card group rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 shadow-xs hover:border-[var(--border-strong)] transition-all cursor-pointer flex flex-col justify-between active:scale-[0.98] min-h-[120px]"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="grid h-7 w-7 place-items-center rounded-xl bg-emerald-500/12 text-emerald-500 border border-emerald-500/20">
                <Target className="h-3.5 w-3.5" />
              </div>
              <div className="flex items-center gap-1">
                {!hasGoals ? (
                  <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-emerald-500 border border-emerald-500/15">
                    {t('savings.create', 'Mulai')}
                  </span>
                ) : null}
                <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)] opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>

            <p className="mt-2 text-[11px] font-bold text-[var(--muted)] truncate">
              {t('savings.title', 'Target Tabungan')}
            </p>

            {hasGoals ? (
              <p className="mt-0.5 text-sm sm:text-base font-black tabular-nums tracking-tight text-[var(--fg)]">
                {goalPct}% <span className="text-[10px] font-medium text-[var(--muted)]">{t('savings.collected', 'terkumpul')}</span>
              </p>
            ) : (
              <p className="mt-0.5 text-xs font-black text-[var(--fg)]">
                {t('savings.emptyTitle', 'Belum Ada Target')}
              </p>
            )}
          </div>

          <div className="mt-2.5 pt-2 border-t border-[var(--border)]/60">
            {hasGoals ? (
              <div className="space-y-1.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--field-bg)]">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(goalPct, totalGoalCurrent > 0 ? 3 : 0))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9.5px] font-semibold text-[var(--muted)]">
                  <span>{goalRows.length} {t('savings.goalsCount', 'Target')}</span>
                  <span className="tabular-nums font-bold">
                    {formatCurrency(totalGoalCurrent, defaultCurrency, locale)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-[var(--field-bg)] border border-dashed border-[var(--border)]" />
                <div className="flex items-center justify-between text-[9.5px] font-extrabold text-emerald-500">
                  <span className="flex items-center gap-0.5">
                    <Plus size={11} strokeWidth={2.5} />
                    {t('savings.createQuick', 'Mulai Menabung')}
                  </span>
                  <span className="text-[9px] font-semibold text-[var(--muted-2)]">0 Target</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
})

export default DashboardPulseBento
