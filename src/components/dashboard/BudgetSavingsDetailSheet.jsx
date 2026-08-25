import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { PieChart, Target, Plus, AlertTriangle, CheckCircle2, ArrowRight, X, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import {
  formatCurrency,
  formatMoneyInput,
  formatGroupedIntegerInput,
  getMoneyInputCaret,
  parseMoneyInput,
  toSafeNumber,
} from '../../lib/utils'
import { formatExpenseCategory, getMergedExpenseTree, parseExpenseCategoryPath } from '../../lib/expenseCategories'
import { getCategoryColorClass, resolveExpenseParentIconKey, resolveTransactionIconKey } from '../../lib/categoryIcon'
import CategoryIcon from '../ui/CategoryIcon'
import MonthPicker from '../ui/MonthPicker'
import ToastBanner from '../ui/ToastBanner'
import Button from '../ui/Button'
import { db } from '../../lib/db'
import useBottomSheet from '../../hooks/useBottomSheet'
import useTranslation from '../../hooks/useTranslation'

const BudgetChildCategoryItem = memo(function BudgetChildCategoryItem({
  child,
  parentId,
  active,
  lang,
  onSelectChild,
}) {
  const path = `${parentId}/${child.id}`
  return (
    <button
      type="button"
      onClick={() => onSelectChild(path)}
      className={`flex h-[40px] w-full items-center gap-2 border-b border-[var(--border)]/30 px-3 text-left text-[12px] font-medium transition last:border-b-0 ${
        active
          ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--fg)]'
          : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{child?.names?.[lang] || child?.id || ''}</span>
      {active ? <span className="text-[var(--accent)] font-bold">✓</span> : null}
    </button>
  )
})

const BudgetParentCategoryItem = memo(function BudgetParentCategoryItem({
  parent,
  expanded,
  activeMain,
  hasSub,
  lang,
  currentCategoryPath,
  onSelectParent,
  onToggleExpand,
  onSelectChild,
  t,
}) {
  return (
    <li className="border-b border-[var(--border)]/40 last:border-b-0">
      <div
        className={`flex h-[44px] w-full items-stretch text-[13px] font-semibold transition ${
          expanded || activeMain
            ? 'bg-[color-mix(in_srgb,var(--accent)_10%,var(--field-bg))] text-[var(--fg)]'
            : 'text-[var(--fg)] hover:bg-[var(--panel)]'
        }`}
      >
        <button
          type="button"
          className="flex w-[80%] items-center gap-2 px-3 text-left cursor-pointer"
          onClick={() => onSelectParent(parent.id)}
        >
          <CategoryIcon icon={resolveExpenseParentIconKey(parent.id)} className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{parent?.names?.[lang] || parent?.id || ''}</span>
        </button>

        <button
          type="button"
          className="flex w-[20%] items-center justify-center border-l border-[var(--border)]/40 text-[var(--muted)] cursor-pointer"
          onClick={() => onToggleExpand(parent.id)}
          aria-label={expanded ? t('budget.subCategory.close', 'Tutup subkategori') : t('budget.subCategory.open', 'Buka subkategori')}
        >
          <span>{expanded ? '▾' : '▸'}</span>
        </button>
      </div>

      {expanded && hasSub ? (
        <div className="px-2 pb-2 pt-1 animate-sub-in">
          <div className="overflow-hidden rounded-xl border border-[var(--border)]/60 bg-[var(--panel)]/40">
            {(parent.children || []).map((child) => {
              const path = `${parent.id}/${child.id}`
              const active = currentCategoryPath === path
              return (
                <BudgetChildCategoryItem
                  key={child.id}
                  child={child}
                  parentId={parent.id}
                  active={active}
                  lang={lang}
                  onSelectChild={onSelectChild}
                />
              )
            })}
          </div>
        </div>
      ) : null}
    </li>
  )
})

export default function BudgetSavingsDetailSheet({
  isOpen,
  onClose,
  initialMode = 'budget',
  budgetGoalSummary,
  defaultCurrency = 'IDR',
  locale = 'id',
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isVisible: sheetVisible, closeSheet } = useBottomSheet({ isOpen, onClose })
  const [sheetView, setSheetView] = useState('detail') // 'detail' | 'create-budget' | 'create-goal'

  // Reset view when opening
  const [prevOpen, setPrevOpen] = useState(isOpen)
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen)
    if (isOpen) setSheetView('detail')
  }

  // --- Quick Goal Form State ---
  const [goalForm, setGoalForm] = useState({
    name: '',
    targetAmount: '',
    currentAmount: '',
    currency: defaultCurrency,
  })
  const [goalError, setGoalError] = useState('')
  const goalTargetRef = useRef(null)
  const goalCurrentRef = useRef(null)

  // --- Quick Budget Form State ---
  const [budgetForm, setBudgetForm] = useState({
    month: format(new Date(), 'yyyy-MM'),
    categoryPath: '',
    limit: '',
  })
  const [budgetLimitInput, setBudgetLimitInput] = useState('')
  const [budgetError, setBudgetError] = useState('')
  const [expandedParentId, setExpandedParentId] = useState(null)
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const budgetLimitRef = useRef(null)

  const tree = useMemo(() => getMergedExpenseTree(), [])
  const lang = locale === 'en' ? 'en' : 'id'

  const parsedCategoryPath = useMemo(() => {
    if (!budgetForm.categoryPath) return null
    return parseExpenseCategoryPath(budgetForm.categoryPath)
  }, [budgetForm.categoryPath])

  const selectedParentId = useMemo(() => {
    const raw = String(budgetForm.categoryPath || '')
    if (!raw) return ''
    if (raw.includes('/')) return raw.split('/')[0]
    return raw
  }, [budgetForm.categoryPath])

  const handleSelectParent = useCallback((parentId) => {
    setBudgetForm((p) => ({ ...p, categoryPath: parentId }))
    setExpandedParentId(null)
    setIsCategoryOpen(false)
  }, [])

  const handleToggleExpand = useCallback((parentId) => {
    setExpandedParentId((prev) => (prev === parentId ? null : parentId))
  }, [])

  const handleSelectChild = useCallback((path) => {
    setBudgetForm((p) => ({ ...p, categoryPath: path }))
    setIsCategoryOpen(false)
  }, [])

  const saveGoal = async () => {
    const payload = {
      name: String(goalForm.name || '').trim(),
      targetAmount: parseMoneyInput(goalForm.targetAmount, goalForm.currency),
      currentAmount: parseMoneyInput(goalForm.currentAmount, goalForm.currency),
      currency: goalForm.currency || defaultCurrency,
    }
    if (!payload.name) {
      setGoalError(t('savings.validation.name', 'Nama target wajib diisi.'))
      return
    }
    if (payload.targetAmount <= 0) {
      setGoalError(t('savings.validation.target', 'Target nominal harus lebih dari 0.'))
      return
    }
    if (payload.currentAmount < 0) {
      setGoalError(t('savings.validation.current', 'Saldo awal tidak boleh negatif.'))
      return
    }
    try {
      setGoalError('')
      await db.goals.add(payload)
      setGoalForm({
        name: '',
        targetAmount: '',
        currentAmount: '',
        currency: defaultCurrency,
      })
      setSheetView('detail')
    } catch {
      setGoalError(t('common.error.saveFailed', 'Gagal menyimpan data.'))
    }
  }

  const saveBudget = async () => {
    const payload = {
      month: budgetForm.month,
      category: String(budgetForm.categoryPath || '').trim(),
      limit: toSafeNumber(budgetForm.limit),
    }
    if (!payload.category) {
      setBudgetError(t('budget.validation.category', 'Kategori anggaran wajib dipilih.'))
      return
    }
    if (!payload.month || payload.limit <= 0) {
      setBudgetError(t('budget.validation.limit', 'Batas nominal harus lebih dari 0.'))
      return
    }
    try {
      setBudgetError('')
      await db.budgets.add(payload)
      setBudgetForm({
        month: format(new Date(), 'yyyy-MM'),
        categoryPath: '',
        limit: '',
      })
      setBudgetLimitInput('')
      setSheetView('detail')
    } catch {
      setBudgetError(t('common.error.saveFailed', 'Gagal menyimpan data.'))
    }
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
        className={`ft-motion-overlay absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity duration-320 ${
          sheetVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeSheet}
        aria-label={t('common.close', 'Tutup')}
      />

      {/* Sheet Container with Seamless iOS / Vaul-style slide-up */}
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full sm:max-w-lg sm:px-4 sm:pb-6">
        <div
          className={`max-h-[min(88dvh,44rem)] overflow-y-auto w-full rounded-t-[32px] sm:rounded-3xl border-t sm:border border-[var(--border)] bg-[var(--panel-strong)] p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:p-6 shadow-2xl transition-all duration-320 transform-gpu will-change-[transform,opacity] ft-hide-scrollbar ${
            sheetVisible
              ? 'translate-y-0 scale-100 opacity-100'
              : 'translate-y-full sm:translate-y-6 sm:scale-96 opacity-0'
          }`}
          style={{
            boxShadow: 'var(--shadow-card)',
            transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          {/* Top Handle */}
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--border-strong)]/60 transition-colors hover:bg-[var(--border-strong)]" />

          {/* Header Row */}
          <div className="mb-4 flex items-center justify-between gap-2 border-b border-[var(--border)]/60 pb-3.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {sheetView !== 'detail' ? (
                <button
                  type="button"
                  onClick={() => setSheetView('detail')}
                  className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--border)] transition-colors cursor-pointer shrink-0"
                  aria-label={t('common.back', 'Kembali')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl border ${
                  isBudget
                    ? 'bg-indigo-500/15 text-indigo-500 border-indigo-500/25'
                    : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25'
                }`}>
                  {isBudget ? <PieChart className="h-4.5 w-4.5" /> : <Target className="h-4.5 w-4.5" />}
                </div>
              )}

              <div className="min-w-0">
                <h3 className="text-base font-black tracking-tight text-[var(--fg)] truncate">
                  {sheetView === 'create-budget'
                    ? t('budget.sheet.addTitle', 'Tambah Anggaran')
                    : sheetView === 'create-goal'
                    ? t('savings.sheet.addTitle', 'Tambah Target Tabungan')
                    : isBudget
                    ? t('dashboard.budgetThisMonth', 'Anggaran Bulan Ini')
                    : t('dashboard.savings', 'Target Tabungan')}
                </h3>
                {sheetView === 'detail' && (
                  <p className="text-xs font-semibold text-[var(--muted)] truncate">
                    {isBudget
                      ? budgetCalc
                        ? `${budgetCalc.count} ${t('dashboard.categoriesMonitored', 'Kategori Terpantau')}`
                        : t('dashboard.monitorLimits', 'Pantau batas pengeluaran')
                      : goalCalc
                        ? `${goalCalc.count} ${t('dashboard.activeGoals', 'Target Aktif')}`
                        : t('dashboard.dreamProgress', 'Progres tujuan impian')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {sheetView === 'detail' && (
                <button
                  type="button"
                  onClick={() => {
                    setSheetView(isBudget ? 'create-budget' : 'create-goal')
                  }}
                  className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-extrabold text-white shadow-xs transition hover:opacity-90 active:scale-95 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                  <span>{isBudget ? t('budget.title', 'Anggaran') : t('savings.title', 'Target')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={closeSheet}
                className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--field-bg)] transition-colors cursor-pointer"
                aria-label={t('common.close', 'Tutup')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body Multi-Pane Slide Container */}
          <div className="relative w-full overflow-hidden">
            <div
              className={`flex w-[200%] transition-transform duration-320 transform-gpu ${
                sheetView !== 'detail' ? '-translate-x-1/2' : 'translate-x-0'
              }`}
              style={{
                transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
              }}
            >
              {/* ── Pane 1: Detail Summary View ── */}
              <div className="w-1/2 shrink-0 pr-1.5 space-y-4">
                {isBudget ? (
                  /* Budget Detail View */
                  <div className="space-y-4">
                    {budgetCalc ? (
                      <>
                        {/* Overall Total Spent Card */}
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-4 space-y-2.5">
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] truncate">
                              {t('dashboard.totalBudgetSpent', 'Total Pengeluaran Anggaran')}
                            </span>
                            <span
                              className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-black tracking-wide border ${
                                budgetCalc.isOverBudget
                                  ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                                  : budgetCalc.overallPct >= 80
                                  ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                                  : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                              }`}
                            >
                              {budgetCalc.overallPct}% {t('dashboard.spentPct', 'Terpakai')}
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
                                {t('dashboard.budgetRemaining', 'Sisa')}:{' '}
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
                              <AlertTriangle className="h-3.5 w-3.5" /> {t('dashboard.needsAttention', 'Perlu Diperhatikan')} ({budgetCalc.warningItems.length})
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
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-500 font-bold">
                            <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
                            <span>{t('dashboard.allBudgetsSafe', { count: budgetCalc.count }, `Semua ${budgetCalc.count} anggaran dalam batas aman`)}</span>
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
                          <span>{t('dashboard.openFullBudget', 'Buka Halaman Anggaran Lengkap')}</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-6 text-center">
                        <p className="text-sm font-bold text-[var(--fg)]">{t('dashboard.noBudgetYet', 'Belum Ada Anggaran')}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{t('dashboard.noBudgetDesc', 'Atur batas pengeluaran untuk mengendalikan keuangan bulananmu.')}</p>
                        <button
                          type="button"
                          onClick={() => setSheetView('create-budget')}
                          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--fg)] text-[var(--bg)] px-4 py-2 text-xs font-bold transition active:scale-95 cursor-pointer"
                        >
                          <Plus size={14} strokeWidth={2.5} />
                          {t('dashboard.createBudgetNow', 'Buat Anggaran Sekarang')}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Savings Goals Detail View */
                  <div className="space-y-4">
                    {goalCalc ? (
                      <>
                        {/* Overall Total Collected Card */}
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-4 space-y-2.5">
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] truncate">
                              {t('dashboard.totalSavingsCollected', 'Total Tabungan Terkumpul')}
                            </span>
                            <span className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-black tracking-wide bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                              {goalCalc.overallPct}% {t('dashboard.collectedPct', 'Terkumpul')}
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
                                {goalCalc.count} {t('dashboard.activeGoals', 'Target Aktif')}
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
                            <Target className="h-3.5 w-3.5" /> {t('dashboard.goalsList', 'Daftar Target Tabungan')} ({goalCalc.count})
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
                          <span>{t('dashboard.openFullSavings', 'Buka Halaman Target Tabungan Lengkap')}</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-6 text-center">
                        <p className="text-sm font-bold text-[var(--fg)]">{t('dashboard.noGoalsYet', 'Belum Ada Target Tabungan')}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{t('dashboard.noGoalsDesc', 'Pasang impian finansialmu dan mulai menabung sekarang.')}</p>
                        <button
                          type="button"
                          onClick={() => setSheetView('create-goal')}
                          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--fg)] text-[var(--bg)] px-4 py-2 text-xs font-bold transition active:scale-95 cursor-pointer"
                        >
                          <Plus size={14} strokeWidth={2.5} />
                          {t('dashboard.addGoalNow', 'Tambah Target Sekarang')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Pane 2: In-Sheet Create Form (Slides In from Right) ── */}
              <div className="w-1/2 shrink-0 pl-1.5 space-y-3">
                {sheetView === 'create-goal' ? (
                  /* In-Sheet Goal Form */
                  <div className="space-y-3 pt-0.5">
                    {goalError ? <ToastBanner message={goalError} type="error" onDismiss={() => setGoalError('')} /> : null}

                    <label className="ft-label text-xs block">
                      {t('savings.goalName', 'Nama Target')}
                      <input
                        type="text"
                        value={goalForm.name}
                        onChange={(e) => setGoalForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder={t('savings.namePlaceholder', 'Beli Rumah, Dana Darurat, Liburan...')}
                        className="ft-field mt-1 w-full text-xs font-semibold py-2 px-3 rounded-xl"
                      />
                    </label>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <label className="ft-label text-xs block">
                        {t('savings.target', 'Target Nominal')}
                        <input
                          ref={goalTargetRef}
                          type="text"
                          inputMode="numeric"
                          value={goalForm.targetAmount}
                          onChange={(e) => {
                            const rawValue = e.target.value
                            const currency = goalForm.currency
                            const formatted = formatMoneyInput(rawValue, currency)
                            const caret = getMoneyInputCaret(rawValue, formatted, e.target.selectionStart, currency)
                            setGoalForm((p) => ({ ...p, targetAmount: formatted }))
                            window.requestAnimationFrame(() => {
                              const el = goalTargetRef.current
                              if (!el) return
                              el.setSelectionRange(caret, caret)
                            })
                          }}
                          placeholder="0"
                          className="ft-field mt-1 w-full font-bold tabular-nums text-xs py-2 px-3 rounded-xl"
                        />
                      </label>

                      <label className="ft-label text-xs block">
                        {t('savings.current', 'Saldo Awal')}
                        <input
                          ref={goalCurrentRef}
                          type="text"
                          inputMode="numeric"
                          value={goalForm.currentAmount}
                          onChange={(e) => {
                            const rawValue = e.target.value
                            const currency = goalForm.currency
                            const formatted = formatMoneyInput(rawValue, currency)
                            const caret = getMoneyInputCaret(rawValue, formatted, e.target.selectionStart, currency)
                            setGoalForm((p) => ({ ...p, currentAmount: formatted }))
                            window.requestAnimationFrame(() => {
                              const el = goalCurrentRef.current
                              if (!el) return
                              el.setSelectionRange(caret, caret)
                            })
                          }}
                          placeholder="0"
                          className="ft-field mt-1 w-full font-bold tabular-nums text-xs py-2 px-3 rounded-xl"
                        />
                      </label>
                    </div>

                    <label className="ft-label text-xs block">
                      {t('savings.currency', 'Mata Uang')}
                      <select
                        value={goalForm.currency}
                        onChange={(e) =>
                          setGoalForm((p) => ({
                            ...p,
                            currency: e.target.value,
                            targetAmount: formatMoneyInput(p.targetAmount, e.target.value),
                            currentAmount: formatMoneyInput(p.currentAmount, e.target.value),
                          }))
                        }
                        className="ft-field mt-1 w-full text-xs font-semibold py-2 px-3 rounded-xl"
                      >
                        {['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP'].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]/40 mt-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="!py-2 !px-4 text-xs active:scale-95 transition-all cursor-pointer"
                        onClick={() => setSheetView('detail')}
                      >
                        {t('common.cancel', 'Batal')}
                      </Button>
                      <Button
                        type="button"
                        onClick={saveGoal}
                        className="!py-2 !px-5 text-xs font-bold active:scale-95 transition-all cursor-pointer"
                        disabled={
                          !String(goalForm.name || '').trim() ||
                          parseMoneyInput(goalForm.targetAmount, goalForm.currency) <= 0 ||
                          parseMoneyInput(goalForm.currentAmount, goalForm.currency) < 0
                        }
                      >
                        {t('savings.save', 'Simpan')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* In-Sheet Budget Form */
                  <div className="space-y-3 pt-0.5">
                    {budgetError ? <ToastBanner message={budgetError} type="error" onDismiss={() => setBudgetError('')} /> : null}

                    <label className="ft-label text-xs block">
                      {t('budget.month', 'Bulan')}
                      <MonthPicker
                        value={budgetForm.month}
                        onChange={(val) => setBudgetForm((p) => ({ ...p, month: val }))}
                        className="mt-1"
                      />
                    </label>

                    <label className="ft-label text-xs block">
                      {t('budget.category', 'Kategori')}
                      <div
                        className="mt-1 overflow-hidden rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)]"
                        data-budget-category
                      >
                        <button
                          type="button"
                          onClick={() => setIsCategoryOpen((v) => !v)}
                          className="flex h-11 w-full items-center justify-between gap-3 px-3 text-left cursor-pointer"
                          aria-expanded={isCategoryOpen}
                        >
                          <span className="text-[13px] font-medium text-[var(--fg)] truncate">
                            {(() => {
                              if (!budgetForm.categoryPath) return t('budget.category.placeholder', 'Pilih kategori')
                              if (parsedCategoryPath) {
                                const parentName = parsedCategoryPath.parent?.names?.[lang] || parsedCategoryPath.parent?.id || ''
                                const childName = parsedCategoryPath.child?.names?.[lang] || parsedCategoryPath.child?.id || ''
                                return childName ? `${parentName} · ${childName}` : parentName
                              }
                              return String(budgetForm.categoryPath || '').trim()
                            })()}
                          </span>
                          <span className="text-[var(--muted)]">{isCategoryOpen ? '▾' : '▸'}</span>
                        </button>

                        {isCategoryOpen ? (
                          <div className="border-t border-[var(--border)]/40 animate-collapse-in">
                            <ul
                              className="ft-hide-scrollbar max-h-[300px] min-w-0 overflow-y-auto"
                              style={{ touchAction: 'pan-y' }}
                            >
                              {tree.map((parent) => {
                                const expanded = expandedParentId === parent.id
                                const activeMain = selectedParentId === parent.id && !String(budgetForm.categoryPath || '').includes('/')
                                const hasSub = (parent.children || []).length > 0

                                return (
                                  <BudgetParentCategoryItem
                                    key={parent.id}
                                    parent={parent}
                                    expanded={expanded}
                                    activeMain={activeMain}
                                    hasSub={hasSub}
                                    lang={lang}
                                    currentCategoryPath={budgetForm.categoryPath}
                                    onSelectParent={handleSelectParent}
                                    onToggleExpand={handleToggleExpand}
                                    onSelectChild={handleSelectChild}
                                    t={t}
                                  />
                                );
                              })}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </label>

                    <label className="ft-label text-xs block">
                      {t('budget.limit', 'Batas Anggaran')}
                      <input
                        ref={budgetLimitRef}
                        type="text"
                        inputMode="numeric"
                        value={budgetLimitInput}
                        onChange={(e) => {
                          const rawValue = e.target.value
                          const formatted = formatGroupedIntegerInput(rawValue)
                          const caret = getMoneyInputCaret(rawValue, formatted, e.target.selectionStart)
                          const numericOnly = formatted.replace(/[^0-9]/g, '')
                          setBudgetForm((p) => ({ ...p, limit: numericOnly }))
                          setBudgetLimitInput(formatted)
                          window.requestAnimationFrame(() => {
                            const el = budgetLimitRef.current
                            if (!el) return
                            el.setSelectionRange(caret, caret)
                          })
                        }}
                        className="ft-field mt-1 w-full font-semibold tabular-nums text-xs py-2 px-3 rounded-xl"
                        placeholder={t('budget.limit.placeholder', 'contoh: 1000000')}
                      />
                    </label>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]/40 mt-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="!py-2 !px-4 text-xs active:scale-95 transition-all cursor-pointer"
                        onClick={() => setSheetView('detail')}
                      >
                        {t('common.cancel', 'Batal')}
                      </Button>
                      <Button
                        type="button"
                        onClick={saveBudget}
                        className="!py-2 !px-5 text-xs font-bold active:scale-95 transition-all cursor-pointer"
                        disabled={!String(budgetForm.categoryPath || '').trim() || !String(budgetForm.month || '').trim() || toSafeNumber(budgetForm.limit) <= 0}
                      >
                        {t('budget.save', 'Simpan')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
