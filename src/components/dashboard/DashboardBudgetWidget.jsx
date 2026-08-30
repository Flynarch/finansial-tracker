import { memo, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Target, CheckCircle2, AlertTriangle, ArrowRight, PieChart } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { formatExpenseCategory } from '../../lib/expenseCategories'
import { getCategoryColorClass, resolveTransactionIconKey } from '../../lib/categoryIcon'
import CategoryIcon from '../ui/CategoryIcon'

export const DashboardBudgetWidget = memo(function DashboardBudgetWidget({
  budgetGoalSummary,
  defaultCurrency,
  locale,
  t,
  onOpenQuickBudget,
  onOpenQuickGoal,
}) {
  const navigate = useNavigate()
  const [activeBudgetSlide, setActiveBudgetSlide] = useState(0)
  const budgetTouchStartXRef = useRef(null)
  const budgetTouchEndXRef = useRef(null)

  const handleBudgetTouchStart = (e) => {
    budgetTouchStartXRef.current = e.touches[0].clientX
    budgetTouchEndXRef.current = e.touches[0].clientX
  }

  const handleBudgetTouchMove = (e) => {
    budgetTouchEndXRef.current = e.touches[0].clientX
  }

  const handleBudgetTouchEnd = () => {
    if (budgetTouchStartXRef.current === null || budgetTouchEndXRef.current === null) return
    const diff = budgetTouchStartXRef.current - budgetTouchEndXRef.current
    if (diff > 45) {
      setActiveBudgetSlide(1)
    } else if (diff < -45) {
      setActiveBudgetSlide(0)
    }
    budgetTouchStartXRef.current = null
    budgetTouchEndXRef.current = null
  }

  // Budget calculations
  const budgetCalc = useMemo(() => {
    const rows = budgetGoalSummary?.budgetRows || []
    if (!rows.length) return null
    const totalSpent = rows.reduce((sum, r) => sum + (r.spent || 0), 0)
    const totalLimit = rows.reduce((sum, r) => sum + (r.limit || 0), 0)
    const totalRemaining = Math.max(0, totalLimit - totalSpent)
    const overallPct = totalLimit > 0 ? Math.min(100, Math.round((totalSpent / totalLimit) * 100)) : 0
    const warningItems = rows.filter((r) => r.pct >= 80).sort((a, b) => b.pct - a.pct)
    const isOverBudget = totalSpent > totalLimit

    return {
      count: rows.length,
      totalSpent,
      totalLimit,
      totalRemaining,
      overallPct,
      warningItems,
      isOverBudget,
    }
  }, [budgetGoalSummary])

  // Savings calculations
  const goalCalc = useMemo(() => {
    const rows = budgetGoalSummary?.goalRows || []
    if (!rows.length) return null
    const totalCurrent = rows.reduce((sum, r) => sum + (r.current || 0), 0)
    const totalTarget = rows.reduce((sum, r) => sum + (r.target || 0), 0)
    const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalCurrent / totalTarget) * 100)) : 0
    const topGoals = [...rows].sort((a, b) => b.pct - a.pct).slice(0, 3)

    return {
      count: rows.length,
      totalCurrent,
      totalTarget,
      overallPct,
      topGoals,
    }
  }, [budgetGoalSummary])

  return (
    <section data-tour="budget-chart-section" className="ft-stagger-in" style={{ '--stagger': 3 }}>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-sm sm:p-5 space-y-3.5">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/60 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-500/15 text-indigo-500 border border-indigo-500/25">
              {activeBudgetSlide === 0 ? <PieChart className="h-4 w-4" /> : <Target className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black tracking-tight text-[var(--fg)] truncate">
                {activeBudgetSlide === 0 ? 'Anggaran Bulan Ini' : 'Target Tabungan'}
              </h3>
              <p className="mt-0.5 text-xs font-semibold leading-tight text-[var(--muted)] truncate">
                {activeBudgetSlide === 0
                  ? budgetCalc
                    ? `${budgetCalc.count} Kategori Anggaran`
                    : 'Pantau batas pengeluaran'
                  : goalCalc
                    ? `${goalCalc.count} Target Aktif`
                    : 'Progres tujuan finansial'}
              </p>
            </div>
          </div>

          {/* Expandable Pill Dots + Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveBudgetSlide(0)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  activeBudgetSlide === 0 ? 'w-5 bg-[var(--fg)]' : 'w-2 bg-[var(--muted)]/30 hover:bg-[var(--muted)]/60'
                }`}
                title={t('dashboard.budget')}
                aria-label={t('dashboard.budget')}
              />
              <button
                type="button"
                onClick={() => setActiveBudgetSlide(1)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  activeBudgetSlide === 1 ? 'w-5 bg-[var(--fg)]' : 'w-2 bg-[var(--muted)]/30 hover:bg-[var(--muted)]/60'
                }`}
                title={t('dashboard.savings')}
                aria-label={t('dashboard.savings')}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (activeBudgetSlide === 0) onOpenQuickBudget()
                else onOpenQuickGoal()
              }}
              className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent)] px-2.5 py-1.5 text-xs font-extrabold text-white shadow-xs transition hover:opacity-90 active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              <span>{activeBudgetSlide === 0 ? 'Anggaran' : 'Target'}</span>
            </button>
          </div>
        </div>

        {/* Touch Swipeable Container */}
        <div
          className="relative overflow-hidden touch-pan-y"
          onTouchStart={handleBudgetTouchStart}
          onTouchMove={handleBudgetTouchMove}
          onTouchEnd={handleBudgetTouchEnd}
        >
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${activeBudgetSlide * 100}%)` }}
          >
            {/* Slide 0: Smart Monarch-Style Budget Summary */}
            <div className="w-full shrink-0 pr-0.5 space-y-3">
              {budgetCalc ? (
                <>
                  {/* Overall Total Spent & Bar */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] truncate">
                        Total Pengeluaran Anggaran
                      </span>
                      <span
                        className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide border ${
                          budgetCalc.isOverBudget
                            ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                            : budgetCalc.overallPct >= 80
                            ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                        }`}
                      >
                        {budgetCalc.overallPct}% Terpakai
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap tabular-nums">
                        <p className="text-base sm:text-lg font-black text-[var(--fg)]">
                          {formatCurrency(budgetCalc.totalSpent, defaultCurrency, locale)}
                          <span className="text-xs font-normal text-[var(--muted)] ml-1">
                            / {formatCurrency(budgetCalc.totalLimit, defaultCurrency, locale)}
                          </span>
                        </p>
                        <p className="text-xs font-extrabold text-[var(--muted)] shrink-0">
                          Sisa:{' '}
                          <span
                            className={
                              budgetCalc.isOverBudget ? 'text-rose-500 font-black' : 'text-[var(--fg)] font-black'
                            }
                          >
                            {formatCurrency(budgetCalc.totalRemaining, defaultCurrency, locale)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--panel-strong)] border border-[var(--border)]/60">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          budgetCalc.isOverBudget
                            ? 'bg-rose-500'
                            : budgetCalc.overallPct >= 80
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${budgetCalc.overallPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Smart Warning List OR All Safe Badge */}
                  {budgetCalc.warningItems.length > 0 ? (
                    <div className="space-y-1.5 pt-0.5">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Perlu Diperhatikan ({budgetCalc.warningItems.length})
                      </p>
                      <div className="space-y-1.5">
                        {budgetCalc.warningItems.slice(0, 3).map((row) => {
                          const isDanger = row.pct >= 100
                          const iconKey = resolveTransactionIconKey(row.category, 'expense')
                          const colorClass = getCategoryColorClass(iconKey, 'expense', row.category)

                          return (
                            <div
                              key={row.id}
                              onClick={() => navigate('/budget')}
                              className="flex items-center justify-between gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 text-xs cursor-pointer hover:border-[var(--border-strong)] transition-all"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${colorClass}`}>
                                  <CategoryIcon iconKey={iconKey} className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold text-[var(--fg)] truncate text-xs leading-tight">
                                    {formatExpenseCategory(row.category, locale)}
                                  </p>
                                  <p className="text-[10px] font-semibold text-[var(--muted)] tabular-nums mt-0.5">
                                    {formatCurrency(row.spent, defaultCurrency, locale)}{' '}
                                    <span className="opacity-75">/ {formatCurrency(row.limit, defaultCurrency, locale)}</span>
                                  </p>
                                </div>
                              </div>

                              <span
                                className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black tabular-nums border ${
                                  isDanger
                                    ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                                    : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                                }`}
                              >
                                {Math.round(row.pct)}%
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-500 font-bold">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>{t('dashboard.budget.allSafe', { count: budgetCalc.count }, `Semua ${budgetCalc.count} anggaran dalam batas aman`)}</span>
                    </div>
                  )}

                  {/* Footer Link to /budget */}
                  <div className="pt-1 text-right">
                    <button
                      type="button"
                      onClick={() => navigate('/budget')}
                      className="inline-flex items-center gap-1 text-xs font-extrabold text-[var(--accent)] hover:underline cursor-pointer"
                    >
                      {t('dashboard.budget.viewAll', { count: budgetCalc.count }, `Lihat Semua ${budgetCalc.count} Anggaran`)}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="w-full rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-5 text-center transition hover:bg-[var(--panel)] cursor-pointer"
                  onClick={() => navigate('/budget')}
                >
                  <p className="text-xs font-bold text-[var(--fg)]">{t('dashboard.budget.emptyCta')}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">{t('dashboard.budget.emptyDesc')}</p>
                </button>
              )}
            </div>

            {/* Slide 1: Savings Goals Summary */}
            <div className="w-full shrink-0 pl-0.5 space-y-3">
              {goalCalc ? (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-extrabold">
                      <span className="text-[var(--muted)]">{t('dashboard.totalSavingsCollected', 'Total Tabungan')}</span>
                      <span className="text-emerald-500 font-black">
                        {goalCalc.overallPct}% {t('dashboard.collectedPct', 'Terkumpul')}
                      </span>
                    </div>
                    <p className="text-lg font-black tracking-tight text-[var(--fg)]">
                      {formatCurrency(goalCalc.totalCurrent, defaultCurrency, locale)}
                      <span className="text-xs font-bold text-[var(--muted)] ml-1">
                        / {formatCurrency(goalCalc.totalTarget, defaultCurrency, locale)}
                      </span>
                    </p>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--panel-strong)] border border-[var(--border)]/60">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${goalCalc.overallPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Top Goals List */}
                  <div className="space-y-1.5 pt-0.5">
                    <div className="space-y-1.5">
                      {goalCalc.topGoals.map((row) => (
                        <div
                          key={row.id}
                          onClick={() => navigate('/savings')}
                          className="flex items-center justify-between gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 text-xs cursor-pointer hover:border-[var(--border-strong)] transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--status-income-soft)] text-[var(--status-income)] border border-[var(--status-income)]/25">
                              <Target className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-[var(--fg)] truncate">{row.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="h-1 w-16 rounded-full bg-[var(--border)] overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                                    style={{ width: `${row.pct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-[var(--muted)]">{row.pct}%</span>
                              </div>
                            </div>
                          </div>
                          <span className="font-black text-[var(--fg)] text-[11px] tabular-nums shrink-0">
                            {formatCurrency(row.current, defaultCurrency, locale)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate('/savings')}
                      className="w-full text-center py-1 text-[11px] font-bold text-[var(--accent)] hover:underline flex items-center justify-center gap-1 pt-1 cursor-pointer"
                    >
                      {t('dashboard.viewAllGoals', { count: goalCalc.count }, `Lihat Semua ${goalCalc.count} Target Tabungan`)}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-5 text-center">
                  <p className="text-xs font-bold text-[var(--fg)]">{t('dashboard.savings.empty')}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">{t('dashboard.savings.emptyDesc')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
})

export default DashboardBudgetWidget
