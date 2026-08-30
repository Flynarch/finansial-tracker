import { format } from 'date-fns'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import EmptyState from '../components/ui/EmptyState'
import MonthPicker from '../components/ui/MonthPicker'
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
import BudgetSheetModal from '../components/budget/BudgetSheetModal'
import CategoryIcon from '../components/ui/CategoryIcon'
import { getCategoryColorClass, resolveTransactionIconKey } from '../lib/categoryIcon'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import { formatCurrency, toSafeNumber, clampPercent, FALLBACK_EXCHANGE_RATES } from '../lib/utils'
import { formatExpenseCategory } from '../lib/expenseCategories'
import { calculateBudgetSpent } from '../lib/budgetUtils'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import useSwipeAction from '../hooks/useSwipeAction'
import { ArrowLeft, Plus, AlertCircle, CheckCircle2, AlertTriangle, Copy, AlertOctagon } from 'lucide-react'
import { isTxMatchingBudget } from '../lib/budgetUtils'
import { isExcludeAnalyticsTx, convertCurrency } from '../lib/utils'

function Budget() {
  const { locale, t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const motionDelay = reduceMotion ? 0 : 220
  const navigate = useNavigate()
  const location = useLocation()

  const [rates, setRates] = useState(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES })
  const [isEntering, setIsEntering] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    const loadRates = async () => {
      try {
        const fetchedRates = await fetchCurrencyRates('USD')
        setRates(fetchedRates)
      } catch {
        setRates({ ...FALLBACK_EXCHANGE_RATES })
      }
    }
    loadRates()
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
    const id = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deletingBudget, setDeletingBudget] = useState(null)
  const openSheet = useCallback(() => setSheetOpen(true), [])
  const closeSheet = useCallback(() => {
    setSheetOpen(false)
    setEditingId(null)
  }, [setEditingId])
  const { setSwipedId, getSwipeHandlers } = useSwipeAction()

  const budgets = useLiveQuery(async () => {
    try {
      return await db.budgets.toArray()
    } catch {
      return []
    }
  }, [], [])

  const monthBudgets = useMemo(() => (budgets ?? []).filter((b) => b.month === month), [budgets, month])

  const monthStart = `${month}-01`
  const monthEnd = `${month}-31`
  const monthExpenseTxs = useLiveQuery(
    () => db.transactions.where('date').between(monthStart, monthEnd, true, true).filter((tx) => tx.type === 'expense').toArray(),
    [month],
    []
  )

  const sortedMonthBudgets = useMemo(() => {
    const list = (monthBudgets ?? []).map((b) => {
      const spent = calculateBudgetSpent(b.category, monthExpenseTxs, defaultCurrency, rates)
      const limit = toSafeNumber(b.limit)
      const pct = limit > 0 ? (spent / limit) * 100 : 0
      const remaining = Math.max(0, limit - spent)
      const isOver = spent > limit
      return {
        ...b,
        spent,
        limit,
        pct,
        remaining,
        isOver,
      }
    })
    return list.sort((a, b) => b.pct - a.pct)
  }, [monthBudgets, monthExpenseTxs, defaultCurrency, rates])

  const summary = useMemo(() => {
    let totalSpent = 0
    let totalLimit = 0
    sortedMonthBudgets.forEach((b) => {
      totalSpent += b.spent
      totalLimit += b.limit
    })
    const pct = totalLimit > 0 ? clampPercent((totalSpent / totalLimit) * 100) : 0
    const remaining = Math.max(0, totalLimit - totalSpent)
    const isOver = totalSpent > totalLimit && totalLimit > 0
    const overAmount = isOver ? totalSpent - totalLimit : 0
    return { totalSpent, totalLimit, pct, remaining, isOver, overAmount }
  }, [sortedMonthBudgets])

  const prevMonthKey = useMemo(() => {
    try {
      const [y, m] = month.split('-').map(Number)
      const d = new Date(y, m - 2, 1)
      return format(d, 'yyyy-MM')
    } catch {
      return ''
    }
  }, [month])

  const prevMonthBudgets = useMemo(() => {
    if (!prevMonthKey || !budgets) return []
    return budgets.filter((b) => b.month === prevMonthKey)
  }, [budgets, prevMonthKey])

  const handleCopyPrevMonthBudgets = async () => {
    if (!prevMonthBudgets.length) return
    const newBudgets = prevMonthBudgets.map((b) => ({
      category: b.category,
      limit: b.limit,
      month: month,
    }))
    await db.budgets.bulkAdd(newBudgets)
  }

  const unbudgetedExpenses = useMemo(() => {
    if (!monthExpenseTxs || !monthExpenseTxs.length) return []
    const unbudgetedMap = new Map()

    monthExpenseTxs.forEach((tx) => {
      if (isExcludeAnalyticsTx(tx)) return
      const isBudgeted = sortedMonthBudgets.some((b) => isTxMatchingBudget(b.category, tx.category))
      if (!isBudgeted) {
        const catKey = tx.category || 'lainnya'
        const current = unbudgetedMap.get(catKey) || { category: catKey, totalSpent: 0, count: 0 }
        const amt = convertCurrency(toSafeNumber(tx.amount), tx.currency || defaultCurrency, defaultCurrency, rates)
        current.totalSpent += amt
        current.count += 1
        unbudgetedMap.set(catKey, current)
      }
    })

    return [...unbudgetedMap.values()].sort((a, b) => b.totalSpent - a.totalSpent)
  }, [monthExpenseTxs, sortedMonthBudgets, defaultCurrency, rates])

  const [selectedInitialCategory, setSelectedInitialCategory] = useState('')

  const openAdd = useCallback((initialCat = '') => {
    setEditingId(null)
    setSwipedId(null)
    setSelectedInitialCategory(typeof initialCat === 'string' ? initialCat : '')
    openSheet()
  }, [openSheet, setSwipedId, setEditingId, setSelectedInitialCategory])

  const openEdit = (budget, e) => {
    e?.stopPropagation()
    setEditingId(budget.id)
    setSwipedId(null)
    setSelectedInitialCategory('')
    openSheet()
  }

  useEffect(() => {
    if (location.state?.openAdd) {
      window.setTimeout(() => openAdd(), 0)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate, openAdd])

  const handleBack = () => {
    if (isLeaving) return
    setIsLeaving(true)
    setIsEntering(false)
    window.setTimeout(() => {
      navigate(-1)
    }, motionDelay)
  }

  return (
    <div className="min-h-[100dvh] pb-24">
      <div
        className={`ft-motion-page min-h-full space-y-4 transform-gpu ${
          isLeaving
            ? '-translate-x-2 opacity-0'
            : isEntering
              ? 'translate-y-0 opacity-100'
              : 'translate-y-2 opacity-0'
        }`}
      >
        {/* Header (Compact Single Row) */}
        <div className="flex items-center justify-between gap-2.5 pt-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs transition hover:bg-[var(--field-bg)] active:scale-95 cursor-pointer"
              aria-label={t('budget.back')}
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </button>
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-[var(--fg)] truncate">
              {t('budget.title')}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => openAdd()}
            className="h-10 px-3.5 rounded-2xl bg-[var(--accent)] text-white font-extrabold text-xs shadow-xs transition hover:opacity-90 active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span>{t('budget.add')}</span>
          </button>
        </div>

        {/* Summary Hero Card */}
        <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--panel-strong)] p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-3.5">
          {/* Main Metric Section */}
          <div className="relative z-10 space-y-2.5">
            {/* Top Row: Total Terpakai + Status Badge on left, MonthPicker on top right */}
            <div className="flex items-center justify-between gap-2 -mt-0.5">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                  {t('budget.totalSpent', 'Total Terpakai')}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums border transition-all ${
                    summary.pct >= 100
                      ? 'bg-[var(--status-expense-soft)] text-[var(--status-expense)] border-[var(--status-expense)]/30'
                      : summary.pct >= 80
                      ? 'bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/30'
                      : 'bg-[var(--status-income-soft)] text-[var(--status-income)] border-[var(--status-income)]/25'
                  }`}
                >
                  {summary.pct >= 100 ? (
                    <AlertCircle size={11} className="shrink-0" />
                  ) : summary.pct >= 80 ? (
                    <AlertTriangle size={11} className="shrink-0" />
                  ) : (
                    <CheckCircle2 size={11} className="shrink-0" />
                  )}
                  <span>{Math.round(summary.pct)}%</span>
                </span>
              </div>

              <div className="shrink-0">
                <MonthPicker
                  value={month}
                  onChange={setMonth}
                  compact
                  className="min-w-[105px]"
                />
              </div>
            </div>

            {/* Middle Row: Inline Big Amount + Limit */}
            <div className="flex items-baseline gap-2 pt-0.5 flex-wrap">
              <p className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight text-[var(--fg)]">
                {formatCurrency(summary.totalSpent, defaultCurrency)}
              </p>
              <span className="text-sm sm:text-base font-bold text-[var(--muted-2)] tabular-nums">
                / {formatCurrency(summary.totalLimit, defaultCurrency)}
              </span>
            </div>

            {/* Sub-row: Sisa Anggaran / Kelebihan on left, Category Count on right */}
            <div className="pt-2 border-t border-[var(--border)]/40 flex items-center justify-between text-xs font-bold tabular-nums">
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--muted)]">
                  {summary.isOver ? t('budget.overLimit', 'Kelebihan') : t('budget.remaining', 'Sisa')}:
                </span>
                <span
                  className={`font-black ${
                    summary.isOver ? 'text-[var(--status-expense)]' : 'text-[var(--fg)]'
                  }`}
                >
                  {summary.isOver
                    ? formatCurrency(summary.overAmount, defaultCurrency)
                    : formatCurrency(summary.remaining, defaultCurrency)}
                </span>
              </div>

              <span className="rounded-full bg-[var(--field-bg)] border border-[var(--border)]/60 px-2.5 py-0.5 text-[10px] font-extrabold text-[var(--muted)] tabular-nums shrink-0">
                {monthBudgets.length} {locale === 'en' ? 'Categories' : 'Kategori'}
              </span>
            </div>
          </div>

          {/* Bottom Row: Smooth Progress Bar */}
          <div className="h-3 w-full rounded-full bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] overflow-hidden relative z-10 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out shadow-xs transform-gpu ${
                summary.pct >= 100
                  ? 'bg-[var(--status-expense)]'
                  : summary.pct >= 80
                  ? 'bg-[var(--warning)]'
                  : 'bg-[var(--status-income)]'
              }`}
              style={{ width: `${Math.min(100, Math.max(summary.pct > 0 ? summary.pct : 0, 0))}%` }}
            />
          </div>
        </div>

        {/* Budget List Section */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Daftar Anggaran ({monthBudgets.length})
            </h3>
          </div>

          {monthBudgets.length === 0 ? (
            <div className="space-y-4">
              <EmptyState title={t('budget.emptyTitle')} description={t('budget.emptyDesc')} />
              {prevMonthBudgets.length > 0 && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleCopyPrevMonthBudgets}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-bold text-[var(--fg)] shadow-xs transition hover:bg-[var(--field-bg)] active:scale-95 cursor-pointer"
                  >
                    <Copy className="h-4 w-4 text-[var(--accent)]" />
                    <span>
                      Salin Anggaran dari Bulan Lalu ({prevMonthBudgets.length} Kategori)
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ft-stagger-in">
              {sortedMonthBudgets.map((b) => {
                const { spent, limit, pct, remaining, isOver } = b
                const iconKey = resolveTransactionIconKey(b.category, 'expense')
                const displayLabel = formatExpenseCategory(b.category, locale)
                const colorClass = getCategoryColorClass(iconKey, 'expense', b.category)

                const isDanger = pct >= 100
                const isWarn = pct >= 80 && pct < 100

                const badgeClass = isDanger
                  ? 'bg-[var(--status-expense-soft)] text-[var(--status-expense)] border border-[var(--status-expense)]/30'
                  : isWarn
                  ? 'bg-[var(--warning)]/15 text-[var(--warning)] border border-[var(--warning)]/30'
                  : 'bg-[var(--status-income-soft)] text-[var(--status-income)] border border-[var(--status-income)]/25'

                const barClass = isDanger
                  ? 'bg-[var(--status-expense)]'
                  : isWarn
                  ? 'bg-[var(--warning)]'
                  : 'bg-[var(--status-income)]'

                return (
                  <div
                    key={b.id}
                    className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] shadow-2xs select-none touch-pan-y"
                  >
                    {/* Progressive Swipe Background (Revealed Action Slot) */}
                    <div className="absolute inset-y-0 right-0 z-0 flex items-center justify-end rounded-r-2xl px-5 opacity-0 transition-colors duration-150 w-full" />

                    {/* Sliding Foreground Card with crisp divider border on right */}
                    <div
                      className={`relative z-10 rounded-2xl border-r border-[var(--border)]/70 p-4 sm:p-5 transition-[background-color,border-color] duration-200 shadow-2xs ${
                        isDanger
                          ? 'bg-[var(--status-expense-soft)] border-[var(--status-expense)]/30'
                          : isWarn
                          ? 'bg-[var(--warning)]/5 border-[var(--warning)]/30'
                          : 'bg-[var(--panel-strong)]'
                      }`}
                      style={{ transform: 'translate3d(0px, 0px, 0px)' }}
                      {...getSwipeHandlers(b.id, {
                        onEdit: () => openEdit(b),
                        onDelete: () => setDeletingBudget(b),
                      })}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${colorClass}`}>
                            <CategoryIcon icon={iconKey} className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-extrabold text-[var(--fg)]">
                              {displayLabel}
                            </h3>
                            <p className="mt-0.5 text-xs font-bold text-[var(--muted)] tabular-nums">
                              {formatCurrency(spent, defaultCurrency)} <span className="font-normal text-[var(--muted-2)]">/ {formatCurrency(limit, defaultCurrency)}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-black tabular-nums ${badgeClass}`}>
                            {Math.round(pct)}%
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 h-2 w-full rounded-full bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold">
                        <span className="text-[var(--muted)]">
                          {isOver ? t('budget.overBudget', 'Kelebihan anggaran') : t('budget.remainingBudget', 'Sisa anggaran')}
                        </span>
                        <span className={isOver ? 'text-[var(--status-expense)] font-extrabold' : 'text-[var(--fg)]'}>
                          {isOver ? formatCurrency(spent - limit, defaultCurrency) : formatCurrency(remaining, defaultCurrency)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Unbudgeted Expenses Section */}
        {unbudgetedExpenses.length > 0 && (
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <AlertOctagon className="h-4 w-4 text-amber-500" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--fg)]">
                  {t('budget.unbudgetedTitle', 'Pengeluaran Tanpa Anggaran ({{count}})', { count: unbudgetedExpenses.length })}
                </h3>
              </div>
              <span className="text-[11px] font-bold text-[var(--muted)]">
                Total: {formatCurrency(unbudgetedExpenses.reduce((s, u) => s + u.totalSpent, 0), defaultCurrency)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {unbudgetedExpenses.map((item) => {
                const iconKey = resolveTransactionIconKey(item.category, 'expense')
                const displayLabel = formatExpenseCategory(item.category, locale)
                const colorClass = getCategoryColorClass(iconKey, 'expense', item.category)

                return (
                  <div
                    key={item.category}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colorClass} shadow-xs`}>
                        <CategoryIcon iconKey={iconKey} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-[var(--fg)]">{displayLabel}</p>
                        <p className="text-[10px] text-[var(--muted)] font-medium">
                          {t('wallets.txCount', '{{count}} Transaksi', { count: item.count })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-black font-mono text-[var(--status-expense)]">
                        {formatCurrency(item.totalSpent, defaultCurrency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => openAdd(item.category)}
                        className="rounded-xl bg-[var(--field-bg)] border border-[var(--border)] px-2.5 py-1 text-[10px] font-extrabold text-[var(--fg)] hover:bg-[var(--panel)] transition cursor-pointer"
                      >
                        + Budget
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <BudgetSheetModal
          isOpen={sheetOpen}
          onClose={closeSheet}
          editingBudget={budgets?.find((b) => b.id === editingId)}
          month={month}
          initialCategory={selectedInitialCategory}
          onDelete={(budgetToDelete) => {
            closeSheet()
            setDeletingBudget(budgetToDelete)
          }}
        />
        <ConfirmDeleteModal
          isOpen={!!deletingBudget}
          onClose={() => setDeletingBudget(null)}
          onConfirm={async () => {
            if (deletingBudget) {
              try {
                const targetId = Number(deletingBudget.id) || deletingBudget.id
                await db.budgets.delete(targetId)
              } catch {
                await db.budgets.where('id').equals(deletingBudget.id).delete()
              }
              setDeletingBudget(null)
            }
          }}
          title={t('budget.delete', 'Hapus Anggaran')}
          message={t('budget.deleteConfirm', 'Hapus anggaran untuk kategori ini?')}
        />
      </div>
    </div>
  )
}

export default Budget
