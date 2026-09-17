import { memo } from 'react'
import { PieChart, Target, ChevronRight, AlertTriangle, CheckCircle2, Plus } from 'lucide-react'
import { formatCompactCurrency, convertCurrency } from '../../lib/utils'
import useTranslation from '../../hooks/useTranslation'

export const DashboardPulseBento = memo(function DashboardPulseBento({
  isDbLoading = false,
  budgetGoalSummary,
  defaultCurrency = 'IDR',
  rates = null,
  locale = 'id',
  onOpenBudgetDetail,
  onOpenSavingsDetail,
}) {
  const { t } = useTranslation()

  if (isDbLoading || !budgetGoalSummary) {
    return (
      <section className="ft-stagger-in" style={{ '--stagger': 4 }}>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 shadow-xs animate-pulse space-y-3 min-h-[128px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-[var(--border)]/60" />
                <div className="h-3.5 w-16 rounded bg-[var(--border)]/60" />
              </div>
              <div className="h-3.5 w-3.5 rounded bg-[var(--border)]/40" />
            </div>
            <div className="space-y-1">
              <div className="h-5 w-20 rounded bg-[var(--border)]/70" />
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--border)]/40" />
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 shadow-xs animate-pulse space-y-3 min-h-[128px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-[var(--border)]/60" />
                <div className="h-3.5 w-16 rounded bg-[var(--border)]/60" />
              </div>
              <div className="h-3.5 w-3.5 rounded bg-[var(--border)]/40" />
            </div>
            <div className="space-y-1">
              <div className="h-5 w-20 rounded bg-[var(--border)]/70" />
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--border)]/40" />
          </div>
        </div>
      </section>
    )
  }

  // 1. Budget Stats
  const budgetRows = budgetGoalSummary?.budgetRows || []
  const totalBudgetSpent = budgetRows.reduce(
    (sum, r) => sum + convertCurrency(r.spent || 0, r.currency || defaultCurrency, defaultCurrency, rates),
    0
  )
  const totalBudgetLimit = budgetRows.reduce(
    (sum, r) => sum + convertCurrency(r.limit || 0, r.currency || defaultCurrency, defaultCurrency, rates),
    0
  )
  const budgetPct = totalBudgetLimit > 0 ? Math.min(100, Math.round((totalBudgetSpent / totalBudgetLimit) * 100)) : 0
  const budgetWarnings = budgetRows.filter((r) => r.pct >= 80)
  const isOverBudget = totalBudgetSpent > totalBudgetLimit && totalBudgetLimit > 0
  const hasBudgets = budgetRows.length > 0

  // 2. Goals Stats
  const goalRows = budgetGoalSummary?.goalRows || []
  const totalGoalCurrent = goalRows.reduce(
    (sum, r) => sum + convertCurrency(r.current || 0, r.currency || defaultCurrency, defaultCurrency, rates),
    0
  )
  const totalGoalTarget = goalRows.reduce(
    (sum, r) => sum + convertCurrency(r.target || 0, r.currency || defaultCurrency, defaultCurrency, rates),
    0
  )
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
          className="ft-bento-card group rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 shadow-xs hover:border-[var(--border-strong)] transition-all cursor-pointer flex flex-col justify-between active:scale-[0.98] min-h-[128px]"
        >
          <div>
            {/* Top Row: Icon + Title on left, Chevron on right */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="grid h-7 w-7 place-items-center rounded-xl bg-indigo-500/12 text-indigo-500 border border-indigo-500/20 shrink-0">
                  <PieChart className="h-3.5 w-3.5" />
                </div>
                <p className="text-xs font-black text-[var(--fg)] tracking-tight truncate">
                  {t('budget.title', 'Anggaran')}
                </p>
              </div>

              <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)] opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>

            {/* Main Metric */}
            {hasBudgets ? (
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-[var(--fg)]">
                  {budgetPct}%
                </p>
                <span className="text-[11px] font-bold text-[var(--muted)]">
                  {t('budget.used', 'terpakai')}
                </span>
              </div>
            ) : (
              <div className="mt-2">
                <p className="text-xs sm:text-[13px] font-black text-[var(--fg)] tracking-tight">
                  {t('budget.notSet', 'Belum Diatur')}
                </p>
                <p className="mt-0.5 text-[10px] sm:text-[10.5px] font-semibold text-[var(--muted-2)] line-clamp-1">
                  {locale === 'en' ? 'Track monthly budget' : 'Kelola batas belanja bulanan'}
                </p>
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-[var(--border)]/60 space-y-1.5">
            {hasBudgets ? (
              <>
                {/* Progress Bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--field-bg)]">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOverBudget
                        ? 'bg-[var(--status-expense)]'
                        : budgetPct >= 80
                        ? 'bg-[var(--warning)]'
                        : 'bg-indigo-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(budgetPct, totalBudgetSpent > 0 ? 4 : 0))}%` }}
                  />
                </div>

                {/* Sub-row below bar */}
                <div className="flex items-center justify-between text-[10px] font-semibold text-[var(--muted)] tabular-nums">
                  <span className="truncate">
                    {budgetWarnings.length > 0 ? (
                      <span className="text-[var(--warning)] flex items-center gap-0.5 font-bold">
                        <AlertTriangle className="h-2.5 w-2.5 shrink-0" /> {budgetWarnings.length} {t('budget.warning', 'waspada')}
                      </span>
                    ) : (
                      <span className="text-[var(--status-income)] flex items-center gap-0.5 font-bold">
                        <CheckCircle2 className="h-2.5 w-2.5 shrink-0" /> {t('budget.safe', 'Aman')}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums font-bold text-[var(--fg)]">
                    {formatCompactCurrency(totalBudgetSpent, defaultCurrency, locale)}
                  </span>
                </div>
              </>
            ) : (
              <>
                {/* Progress Bar Empty */}
                <div className="h-1.5 w-full rounded-full bg-[var(--field-bg)] border border-dashed border-[var(--border)]" />

                {/* Sub-row below bar */}
                <div className="flex items-center justify-between text-[10px] font-bold text-indigo-500 tabular-nums">
                  <span className="flex items-center gap-1">
                    <Plus className="h-3 w-3 shrink-0" strokeWidth={2.5} />
                    {t('budget.createQuick', 'Buat Anggaran')}
                  </span>
                  <span className="text-[9.5px] font-semibold text-[var(--muted-2)]">0 Kategori</span>
                </div>
              </>
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
          className="ft-bento-card group rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 shadow-xs hover:border-[var(--border-strong)] transition-all cursor-pointer flex flex-col justify-between active:scale-[0.98] min-h-[128px]"
        >
          <div>
            {/* Top Row: Icon + Title on left, Chevron on right */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="grid h-7 w-7 place-items-center rounded-xl bg-emerald-500/12 text-emerald-500 border border-emerald-500/20 shrink-0">
                  <Target className="h-3.5 w-3.5" />
                </div>
                <p className="text-xs font-black text-[var(--fg)] tracking-tight truncate">
                  {t('savings.title', 'Target Tabungan')}
                </p>
              </div>

              <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)] opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>

            {/* Main Metric */}
            {hasGoals ? (
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-[var(--fg)]">
                  {goalPct}%
                </p>
                <span className="text-[11px] font-bold text-[var(--muted)]">
                  {t('savings.collected', 'terkumpul')}
                </span>
              </div>
            ) : (
              <div className="mt-2">
                <p className="text-xs sm:text-[13px] font-black text-[var(--fg)] tracking-tight">
                  {t('savings.emptyTitle', 'Belum Ada Target')}
                </p>
                <p className="mt-0.5 text-[10px] sm:text-[10.5px] font-semibold text-[var(--muted-2)] line-clamp-1">
                  {locale === 'en' ? 'Plan your dream savings' : 'Wujudkan impian finansialmu'}
                </p>
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-[var(--border)]/60 space-y-1.5">
            {hasGoals ? (
              <>
                {/* Progress Bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--field-bg)]">
                  <div
                    className="h-full rounded-full bg-[var(--status-income)] transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(goalPct, totalGoalCurrent > 0 ? 4 : 0))}%` }}
                  />
                </div>

                {/* Sub-row below bar */}
                <div className="flex items-center justify-between text-[10px] font-semibold text-[var(--muted)] tabular-nums">
                  <span>{goalRows.length} {t('savings.goalsCount', 'Target')}</span>
                  <span className="tabular-nums font-bold text-[var(--fg)]">
                    {formatCompactCurrency(totalGoalCurrent, defaultCurrency, locale)}
                  </span>
                </div>
              </>
            ) : (
              <>
                {/* Progress Bar Empty */}
                <div className="h-1.5 w-full rounded-full bg-[var(--field-bg)] border border-dashed border-[var(--border)]" />

                {/* Sub-row below bar */}
                <div className="flex items-center justify-between text-[10px] font-bold text-emerald-500 tabular-nums">
                  <span className="flex items-center gap-1">
                    <Plus className="h-3 w-3 shrink-0" strokeWidth={2.5} />
                    {t('savings.createQuick', 'Mulai Menabung')}
                  </span>
                  <span className="text-[9.5px] font-semibold text-[var(--muted-2)]">0 Target</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
})

export default DashboardPulseBento
