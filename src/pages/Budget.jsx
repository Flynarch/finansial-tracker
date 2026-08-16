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
import useBottomSheet from '../hooks/useBottomSheet'
import useSwipeAction from '../hooks/useSwipeAction'
import { ChevronLeft, Plus, Edit2, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'

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

  const budgets = useLiveQuery(() => db.budgets.toArray(), [], [])
  const transactions = useLiveQuery(() => db.transactions.toArray(), [], [])
  const currentMonth = format(new Date(), 'yyyy-MM')

  const [month, setMonth] = useState(currentMonth)
  const { isOpen: sheetOpen, openSheet, closeSheet } = useBottomSheet(false)
  const [editingId, setEditingId] = useState(null)
  const [deletingBudget, setDeletingBudget] = useState(null)
  const { swipedId, setSwipedId, getSwipeHandlers } = useSwipeAction()

  const monthBudgets = useMemo(() => (budgets ?? []).filter((b) => b.month === month), [budgets, month])

  const monthExpenseTxs = useMemo(
    () => (transactions ?? []).filter((tx) => tx?.type === 'expense' && tx?.date?.startsWith(month)),
    [transactions, month]
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

  const openAdd = useCallback(() => {
    setEditingId(null)
    setSwipedId(null)
    openSheet()
  }, [openSheet, setSwipedId])

  const openEdit = (budget, e) => {
    e?.stopPropagation()
    setEditingId(budget.id)
    setSwipedId(null)
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
    <div className="bg-[var(--bg)] min-h-[100dvh] pb-24">
      <div
        className={`ft-motion-page min-h-full space-y-4 transform-gpu ${
          isLeaving
            ? '-translate-x-2 opacity-0'
            : isEntering
              ? 'translate-y-0 opacity-100'
              : 'translate-y-2 opacity-0'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--panel-strong)] transition-colors cursor-pointer active:scale-95"
              aria-label={t('budget.back')}
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
            </button>
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight text-[var(--fg)]">{t('budget.title')}</h2>
              <p className="text-xs font-bold text-[var(--muted)] truncate">{t('budget.subtitle')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={openAdd}
            className="px-4 py-2 rounded-full bg-[var(--fg)] text-[var(--bg)] font-black text-xs shadow-md transition hover:opacity-90 active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            {t('budget.add')}
          </button>
        </div>

        {/* Summary Hero Card (Modern Premium Design) */}
        <div className="relative overflow-hidden rounded-3xl border border-[color-mix(in_srgb,var(--border)_75%,transparent)] bg-gradient-to-br from-[color-mix(in_srgb,var(--panel-strong)_95%,var(--accent)_5%)] via-[var(--panel-strong)] to-[color-mix(in_srgb,var(--panel-strong)_90%,var(--accent)_10%)] p-5 sm:p-6 shadow-sm shadow-black/5 space-y-4">
          {/* Subtle Ambient Background Light */}
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

          {/* Top Row: Month Picker & Category Counter */}
          <div className="flex items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">
                {t('budget.month')}
              </span>
              <MonthPicker
                value={month}
                onChange={setMonth}
                compact
                className="min-w-[130px]"
              />
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">{t('budget.totalCategories', 'Total Kategori')}</span>
              <p className="text-xs font-black tabular-nums text-[var(--fg)]">{monthBudgets.length} {locale === 'en' ? 'Categories' : 'Kategori'}</p>
            </div>
          </div>

          {/* Middle Row: Main Metric & Status Badge */}
          <div className="flex items-end justify-between gap-3 relative z-10 pt-1">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                {t('budget.totalSpent', 'Total Terpakai')}
              </span>
              <p className="mt-0.5 text-3xl sm:text-4xl font-black tabular-nums tracking-tight text-[var(--fg)]">
                {formatCurrency(summary.totalSpent, defaultCurrency)}
              </p>
              <p className="mt-1 text-xs font-bold text-[var(--muted)] tabular-nums">
                {t('budget.of')} <span className="font-extrabold text-[var(--fg)]">{formatCurrency(summary.totalLimit, defaultCurrency)}</span>
                {summary.totalLimit > 0 && (
                  <span className={`ml-2 font-bold ${summary.isOver ? 'text-rose-500' : 'text-[var(--muted)]'}`}>
                    ({summary.isOver ? `${t('budget.overLimit', 'Kelebihan')}: ${formatCurrency(summary.overAmount, defaultCurrency)}` : `${t('budget.remaining', 'Sisa')}: ${formatCurrency(summary.remaining, defaultCurrency)}`})
                  </span>
                )}
              </p>
            </div>

            <div className="text-right shrink-0 pb-0.5">
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-black border shadow-2xs backdrop-blur-md ${
                  summary.pct >= 100
                    ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                    : summary.pct >= 80
                    ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25'
                }`}
              >
                {summary.pct >= 100 ? (
                  <AlertCircle size={13} className="shrink-0" />
                ) : summary.pct >= 80 ? (
                  <AlertTriangle size={13} className="shrink-0" />
                ) : (
                  <CheckCircle2 size={13} className="shrink-0" />
                )}
                <span>{Math.round(summary.pct)}%</span>
              </div>
            </div>
          </div>

          {/* Bottom Row: Smooth Progress Bar */}
          <div className="h-3 w-full rounded-full bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] overflow-hidden relative z-10 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out shadow-xs ${
                summary.pct >= 100
                  ? 'bg-gradient-to-r from-rose-500 to-red-600'
                  : summary.pct >= 80
                  ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                  : 'bg-gradient-to-r from-emerald-400 to-teal-500'
              }`}
              style={{ width: `${Math.min(100, summary.pct)}%` }}
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
            <EmptyState title={t('budget.emptyTitle')} description={t('budget.emptyDesc')} />
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
                  ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                  : isWarn
                  ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/25'

                const barClass = isDanger
                  ? 'bg-gradient-to-r from-rose-500 to-red-600'
                  : isWarn
                  ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                  : 'bg-gradient-to-r from-emerald-400 to-teal-500'

                return (
                  <div
                    key={b.id}
                    className={`relative overflow-hidden rounded-2xl border transition-all duration-200 ${
                      isDanger
                        ? 'border-rose-500/30 bg-rose-500/5'
                        : isWarn
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[var(--panel-strong)] shadow-2xs hover:border-[var(--border-strong)]'
                    }`}
                  >
                    {/* Progressive Swipe Background (Habits Style) */}
                    <div className="absolute inset-0 z-0 flex items-center justify-end rounded-2xl px-5 opacity-0 transition-colors duration-200" />

                    <article
                      className="relative z-10 bg-[var(--panel-strong)] p-4 touch-pan-y cursor-pointer"
                      onClick={(e) => {
                        if (swipedId === b.id) {
                          openEdit(b, e)
                        }
                      }}
                      {...getSwipeHandlers(b.id, { onEdit: () => openEdit(b), onDelete: () => setDeletingBudget(b) })}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${colorClass} shadow-xs`}>
                            <CategoryIcon iconKey={iconKey} className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-extrabold text-[var(--fg)]">{displayLabel}</p>
                            <p className="text-[11px] font-bold text-[var(--muted)] truncate tabular-nums">
                              {formatCurrency(spent, defaultCurrency)} / {formatCurrency(limit, defaultCurrency)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-black tabular-nums ${badgeClass}`}>
                            {Math.round(pct)}%
                          </span>
                          <button
                            type="button"
                            onClick={(e) => openEdit(b, e)}
                            className="p-1.5 rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors cursor-pointer"
                            title={t('budget.edit')}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3.5 h-2 w-full rounded-full bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold">
                        <span className="text-[var(--muted)]">
                          {isOver ? t('budget.overBudget', 'Kelebihan anggaran') : t('budget.remainingBudget', 'Sisa anggaran')}
                        </span>
                        <span className={isOver ? 'text-rose-500 font-extrabold' : 'text-[var(--fg)]'}>
                          {isOver ? formatCurrency(spent - limit, defaultCurrency) : formatCurrency(remaining, defaultCurrency)}
                        </span>
                      </div>
                    </article>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <BudgetSheetModal
        isOpen={sheetOpen}
        onClose={closeSheet}
        editingBudget={budgets?.find((b) => b.id === editingId)}
        month={month}
      />
      <ConfirmDeleteModal
        isOpen={!!deletingBudget}
        onClose={() => setDeletingBudget(null)}
        onConfirm={async () => {
          if (deletingBudget) {
            await db.budgets.delete(deletingBudget.id)
            setDeletingBudget(null)
          }
        }}
        title={t('budget.delete') || 'Hapus Anggaran'}
        message={t('budget.deleteConfirm') || 'Apakah Anda yakin ingin menghapus anggaran ini?'}
      />
    </div>
  )
}

export default Budget
