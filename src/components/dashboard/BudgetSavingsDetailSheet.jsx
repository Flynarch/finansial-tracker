import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { PieChart, Target, Plus, AlertTriangle, CheckCircle2, ArrowRight, X } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { formatExpenseCategory } from '../../lib/expenseCategories'
import { getCategoryColorClass, resolveTransactionIconKey } from '../../lib/categoryIcon'
import CategoryIcon from '../ui/CategoryIcon'
import useBottomSheet from '../../hooks/useBottomSheet'

export default function BudgetSavingsDetailSheet({
  isOpen,
  onClose,
  initialMode = 'budget',
  budgetGoalSummary,
  defaultCurrency = 'IDR',
  locale = 'id',
  onOpenQuickBudget,
  onOpenQuickGoal,
}) {
  const navigate = useNavigate()
  const { isVisible: sheetVisible, closeSheet } = useBottomSheet({ isOpen, onClose })

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
      rows,
    }
  }, [budgetGoalSummary])

  // Savings calculations
  const goalCalc = useMemo(() => {
    const rows = budgetGoalSummary?.goalRows || []
    if (!rows.length) return null
    const totalCurrent = rows.reduce((sum, r) => sum + (r.current || 0), 0)
    const totalTarget = rows.reduce((sum, r) => sum + (r.target || 0), 0)
    const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalCurrent / totalTarget) * 100)) : 0
    const topGoals = [...rows].sort((a, b) => b.pct - a.pct)

    return {
      count: rows.length,
      totalCurrent,
      totalTarget,
      overallPct,
      topGoals,
      rows,
    }
  }, [budgetGoalSummary])

  if ((!isOpen && !sheetVisible) || typeof document === 'undefined') return null

  const isBudget = initialMode === 'budget'

  return createPortal(
    <div className="fixed inset-0 z-50 ft-motion-overlay">
      {/* Backdrop */}
      <button
        type="button"
        className={`ft-motion-overlay absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          sheetVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeSheet}
        aria-label="Tutup"
      />

      {/* Sheet Container with Jumpy/Bouncy Spring Animation */}
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div
          className={`max-h-[85dvh] overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-2xl transition-all duration-400 ft-hide-scrollbar ${
            sheetVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-12 scale-95 opacity-0'
          }`}
          style={{
            transitionTimingFunction: sheetVisible ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : 'cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Top Handle */}
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--border-strong)]/50" />

          {/* Header Row */}
          <div className="mb-4 flex items-center justify-between gap-2 border-b border-[var(--border)]/60 pb-3.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl border ${
                isBudget
                  ? 'bg-indigo-500/15 text-indigo-500 border-indigo-500/25'
                  : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25'
              }`}>
                {isBudget ? <PieChart className="h-4.5 w-4.5" /> : <Target className="h-4.5 w-4.5" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black tracking-tight text-[var(--fg)] truncate">
                  {isBudget ? 'Anggaran Bulan Ini' : 'Target Tabungan'}
                </h3>
                <p className="text-xs font-semibold text-[var(--muted)] truncate">
                  {isBudget
                    ? budgetCalc
                      ? `${budgetCalc.count} Kategori Terpantau`
                      : 'Pantau batas pengeluaran'
                    : goalCalc
                      ? `${goalCalc.count} Target Aktif`
                      : 'Progres tujuan impian'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  closeSheet()
                  if (isBudget) onOpenQuickBudget?.()
                  else onOpenQuickGoal?.()
                }}
                className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-extrabold text-white shadow-xs transition hover:opacity-90 active:scale-95 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                <span>{isBudget ? 'Anggaran' : 'Target'}</span>
              </button>

              <button
                type="button"
                onClick={closeSheet}
                className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--field-bg)] transition-colors cursor-pointer"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          {isBudget ? (
            /* ── Budget Detail View ── */
            <div className="space-y-4">
              {budgetCalc ? (
                <>
                  {/* Overall Total Spent Card */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                        Total Pengeluaran Anggaran
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-black tracking-wide border ${
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
                        <p className="text-lg sm:text-xl font-black text-[var(--fg)]">
                          {formatCurrency(budgetCalc.totalSpent, defaultCurrency, locale)}
                          <span className="text-xs font-normal text-[var(--muted)] ml-1.5">
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

                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--panel-strong)] border border-[var(--border)]/60">
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

                  {/* Warning / Active List */}
                  {budgetCalc.warningItems.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" /> Perlu Diperhatikan ({budgetCalc.warningItems.length})
                      </p>
                      <div className="space-y-2">
                        {budgetCalc.warningItems.map((row) => {
                          const isDanger = row.pct >= 100
                          const iconKey = resolveTransactionIconKey(row.category, 'expense')
                          const colorClass = getCategoryColorClass(iconKey, 'expense', row.category)

                          return (
                            <div
                              key={row.id}
                              onClick={() => {
                                closeSheet()
                                navigate('/budget')
                              }}
                              className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3 text-xs cursor-pointer hover:border-[var(--border-strong)] transition-all"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${colorClass}`}>
                                  <CategoryIcon iconKey={iconKey} className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold text-[var(--fg)] truncate text-xs">
                                    {formatExpenseCategory(row.category, locale)}
                                  </p>
                                  <p className="text-[10.5px] font-semibold text-[var(--muted)] tabular-nums mt-0.5">
                                    {formatCurrency(row.spent, defaultCurrency, locale)}{' '}
                                    <span className="opacity-75">/ {formatCurrency(row.limit, defaultCurrency, locale)}</span>
                                  </p>
                                </div>
                              </div>

                              <span
                                className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-black tabular-nums border ${
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
                    <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-500 font-bold">
                      <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
                      <span>Semua {budgetCalc.count} anggaran dalam batas aman</span>
                    </div>
                  )}

                  {/* Footer Action to /budget */}
                  <button
                    type="button"
                    onClick={() => {
                      closeSheet()
                      navigate('/budget')
                    }}
                    className="w-full py-3 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-center text-xs font-bold text-[var(--fg)] hover:border-[var(--border-strong)] transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Buka Halaman Anggaran Lengkap</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-6 text-center">
                  <p className="text-sm font-bold text-[var(--fg)]">Belum Ada Anggaran</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Atur batas pengeluaran untuk mengendalikan keuangan bulananmu.</p>
                  <button
                    type="button"
                    onClick={() => {
                      closeSheet()
                      onOpenQuickBudget?.()
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--fg)] text-[var(--bg)] px-4 py-2 text-xs font-bold transition active:scale-95 cursor-pointer"
                  >
                    <Plus size={14} strokeWidth={2.5} />
                    Buat Anggaran Sekarang
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── Savings Goals Detail View ── */
            <div className="space-y-4">
              {goalCalc ? (
                <>
                  {/* Overall Total Collected Card */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                        Total Tabungan Terkumpul
                      </span>
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-black tracking-wide bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                        {goalCalc.overallPct}% Terkumpul
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap tabular-nums">
                        <p className="text-lg sm:text-xl font-black text-[var(--fg)]">
                          {formatCurrency(goalCalc.totalCurrent, defaultCurrency, locale)}
                          <span className="text-xs font-normal text-[var(--muted)] ml-1.5">
                            / {formatCurrency(goalCalc.totalTarget, defaultCurrency, locale)}
                          </span>
                        </p>
                        <p className="text-xs font-extrabold text-[var(--muted)] shrink-0">
                          {goalCalc.count} Target Aktif
                        </p>
                      </div>
                    </div>

                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--panel-strong)] border border-[var(--border)]/60">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${goalCalc.overallPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Goals List */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" /> Daftar Target Tabungan ({goalCalc.count})
                    </p>
                    <div className="space-y-2">
                      {goalCalc.topGoals.map((row) => (
                        <div
                          key={row.id}
                          onClick={() => {
                            closeSheet()
                            navigate('/savings')
                          }}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3 text-xs cursor-pointer hover:border-[var(--border-strong)] transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--status-income-soft)] text-[var(--status-income)] border border-[var(--status-income)]/25">
                              <Target className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-[var(--fg)] truncate text-xs">
                                {String(row.name || '').replace(/_/g, ' ')}
                              </p>
                              <p className="text-[10.5px] font-semibold text-[var(--muted)] tabular-nums mt-0.5">
                                {formatCurrency(row.current, defaultCurrency, locale)}{' '}
                                <span className="opacity-75">/ {formatCurrency(row.target, defaultCurrency, locale)}</span>
                              </p>
                            </div>
                          </div>

                          <span className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-black tabular-nums bg-[var(--panel-strong)] text-[var(--fg)] border border-[var(--border)]">
                            {Math.round(row.pct)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer Action to /savings */}
                  <button
                    type="button"
                    onClick={() => {
                      closeSheet()
                      navigate('/savings')
                    }}
                    className="w-full py-3 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-center text-xs font-bold text-[var(--fg)] hover:border-[var(--border-strong)] transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Buka Halaman Target Tabungan Lengkap</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-6 text-center">
                  <p className="text-sm font-bold text-[var(--fg)]">Belum Ada Target Tabungan</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Pasang impian finansialmu dan mulai menabung sekarang.</p>
                  <button
                    type="button"
                    onClick={() => {
                      closeSheet()
                      onOpenQuickGoal?.()
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--fg)] text-[var(--bg)] px-4 py-2 text-xs font-bold transition active:scale-95 cursor-pointer"
                  >
                    <Plus size={14} strokeWidth={2.5} />
                    Tambah Target Sekarang
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
