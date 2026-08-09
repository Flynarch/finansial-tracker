import { memo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Target } from 'lucide-react'
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

  return (
    <section data-tour="budget-chart-section" className="ft-stagger-in" style={{ '--stagger': 3 }}>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-sm sm:p-5 space-y-3.5">
        {/* Header Row with Active Expandable Pill Dots */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/60 pb-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black tracking-tight text-[var(--fg)] truncate">
              {activeBudgetSlide === 0 ? 'Anggaran Bulan Ini' : 'Target Tabungan'}
            </h3>
            <p className="mt-0.5 text-xs font-semibold leading-tight text-[var(--muted)] truncate">
              {activeBudgetSlide === 0 ? 'Pantau batas pengeluaran' : 'Progres tujuan finansial'}
            </p>
          </div>

          {/* Active Expandable Pill Dots + Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Expandable Pill Dots */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveBudgetSlide(0)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  activeBudgetSlide === 0 ? 'w-5 bg-[var(--fg)]' : 'w-2 bg-[var(--muted)]/30 hover:bg-[var(--muted)]/60'
                }`}
                title={t('dashboard.budget') || 'Anggaran'}
                aria-label={t('dashboard.budget') || 'Anggaran'}
              />
              <button
                type="button"
                onClick={() => setActiveBudgetSlide(1)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  activeBudgetSlide === 1 ? 'w-5 bg-[var(--fg)]' : 'w-2 bg-[var(--muted)]/30 hover:bg-[var(--muted)]/60'
                }`}
                title={t('dashboard.savings') || 'Target'}
                aria-label={t('dashboard.savings') || 'Target'}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => navigate(activeBudgetSlide === 0 ? '/budget' : '/savings')}
                className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-1.5 text-xs font-bold text-[var(--muted)] transition hover:border-[var(--fg)]/40 hover:text-[var(--fg)] cursor-pointer hidden sm:inline-block"
              >
                Lihat Halaman
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeBudgetSlide === 0) onOpenQuickBudget()
                  else onOpenQuickGoal()
                }}
                className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent)] px-2.5 py-1.5 text-xs font-extrabold text-[var(--bg)] shadow-xs transition hover:opacity-90 active:scale-95 cursor-pointer"
                aria-label={activeBudgetSlide === 0 ? t('dashboard.budget.add') : t('dashboard.savings.add')}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                <span>{activeBudgetSlide === 0 ? 'Anggaran' : 'Target'}</span>
              </button>
            </div>
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
            {/* Slide 0: Budget */}
            <div className="w-full shrink-0 pr-0.5">
              {budgetGoalSummary?.budgetRows?.length ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {budgetGoalSummary.budgetRows.slice(0, 6).map((row) => {
                    const isDanger = row.pct >= 100
                    const isWarn = row.pct >= 80 && row.pct < 100
                    const iconKey = resolveTransactionIconKey(row.category, 'expense')
                    const colorClass = getCategoryColorClass(iconKey, 'expense', row.category)

                    return (
                      <div
                        key={row.id}
                        onClick={() => navigate('/budget')}
                        className={`group rounded-2xl border bg-[var(--field-bg)] p-3 transition-all duration-200 active:scale-[0.99] cursor-pointer space-y-2.5 shadow-2xs hover:shadow-xs ${
                          isDanger
                            ? 'border-rose-500/30 hover:border-rose-500/50'
                            : isWarn
                            ? 'border-amber-500/30 hover:border-amber-500/50'
                            : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${colorClass}`}>
                              <CategoryIcon iconKey={iconKey} className="h-3.5 w-3.5" />
                            </div>
                            <p className="text-xs font-bold text-[var(--fg)] truncate">
                              {formatExpenseCategory(row.category, locale)}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide ${
                              isDanger
                                ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                                : isWarn
                                ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                                : 'bg-[var(--status-income-soft)] text-[var(--status-income)] border border-[var(--status-income)]/25'
                            }`}
                          >
                            {Math.round(row.pct)}%
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
                            <span className="text-[var(--fg)] font-black">{formatCurrency(row.spent, defaultCurrency, locale)}</span>
                            <span className="text-[var(--muted)] font-semibold">/ {formatCurrency(row.limit, defaultCurrency, locale)}</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--panel-strong)] border border-[var(--border)]/60">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isDanger
                                  ? 'bg-rose-500'
                                  : isWarn
                                  ? 'bg-amber-500'
                                  : 'bg-[var(--status-income)]'
                              }`}
                              style={{ width: `${Math.min(100, row.pct)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-5 text-center transition hover:bg-[var(--panel)] cursor-pointer"
                  onClick={() => navigate('/budget')}
                >
                  <p className="text-xs font-bold text-[var(--fg)]">{t('dashboard.budget.emptyCta') || 'Atur Anggaran Pertama'}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">{t('dashboard.budget.emptyDesc') || 'Kendalikan pengeluaran bulananmu'}</p>
                </button>
              )}
            </div>

            {/* Slide 1: Savings */}
            <div className="w-full shrink-0 pl-0.5">
              {budgetGoalSummary?.goalRows?.length ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {budgetGoalSummary.goalRows.slice(0, 6).map((row) => {
                    const isComplete = row.pct >= 100
                    return (
                      <div
                        key={row.id}
                        onClick={() => navigate('/savings')}
                        className="group rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3 hover:border-[var(--border-strong)] transition-all duration-200 active:scale-[0.99] cursor-pointer space-y-2.5 shadow-2xs hover:shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--status-income-soft)] text-[var(--status-income)] border border-[var(--status-income)]/25">
                              <Target className="h-3.5 w-3.5" />
                            </div>
                            <p className="text-xs font-bold text-[var(--fg)] truncate">
                              {String(row.name || '').replace(/_/g, ' ')}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide ${
                              isComplete
                                ? 'bg-[var(--status-income-soft)] text-[var(--status-income)] border border-[var(--status-income)]/25'
                                : 'bg-[var(--panel-strong)] text-[var(--muted)] border border-[var(--border)]'
                            }`}
                          >
                            {Math.round(row.pct)}%
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
                            <span className="text-[var(--fg)] font-black">{formatCurrency(row.current, defaultCurrency, locale)}</span>
                            <span className="text-[var(--muted)] font-semibold">/ {formatCurrency(row.target, defaultCurrency, locale)}</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--panel-strong)] border border-[var(--border)]/60">
                            <div
                              className="h-full rounded-full bg-[var(--status-income)] transition-all duration-500"
                              style={{ width: `${Math.min(100, row.pct)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-5 text-center">
                  <p className="text-xs font-bold text-[var(--fg)]">{t('dashboard.savings.empty') || 'Belum Ada Target Tabungan'}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">{t('dashboard.savings.emptyDesc') || 'Buat impian finansialmu sekarang'}</p>
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
