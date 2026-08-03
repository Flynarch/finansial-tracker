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
import { formatCurrency, toSafeNumber, clampPercent } from '../lib/utils'
import { formatExpenseCategory } from '../lib/expenseCategories'
import { calculateBudgetSpent } from '../lib/budgetUtils'
import useBottomSheet from '../hooks/useBottomSheet'
import useSwipeAction from '../hooks/useSwipeAction'
import { ChevronLeft, Plus, Edit2 } from 'lucide-react'

function Budget() {
  const { locale, t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const motionDelay = reduceMotion ? 0 : 220
  const navigate = useNavigate()
  const location = useLocation()

  const [isEntering, setIsEntering] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
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

  const summary = useMemo(() => {
    let totalSpent = 0
    let totalLimit = 0
    monthBudgets.forEach((b) => {
      const spent = calculateBudgetSpent(b.category, monthExpenseTxs, defaultCurrency)
      const limit = toSafeNumber(b.limit)
      totalSpent += spent
      totalLimit += limit
    })
    const pct = totalLimit > 0 ? clampPercent((totalSpent / totalLimit) * 100) : 0
    const remaining = Math.max(0, totalLimit - totalSpent)
    return { totalSpent, totalLimit, pct, remaining }
  }, [monthBudgets, monthExpenseTxs, defaultCurrency])

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
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--panel-strong)] transition-colors cursor-pointer"
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
            className="px-3.5 py-2 rounded-xl bg-[var(--accent)] text-white font-extrabold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            {t('budget.add')}
          </button>
        </div>

        {/* Summary Card */}
        <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
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
              <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">{t('budget.totalCategories')}</span>
              <p className="text-sm font-black tabular-nums text-[var(--fg)]">{monthBudgets.length} Kategori</p>
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 relative z-10 pt-1">
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                Total Terpakai
              </span>
              <p className="mt-0.5 text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-[var(--fg)]">
                {formatCurrency(summary.totalSpent, defaultCurrency)}
              </p>
              <p className="mt-1 text-xs font-extrabold text-[var(--muted)] tabular-nums">
                {t('budget.of')} <span className="text-[var(--fg)]">{formatCurrency(summary.totalLimit, defaultCurrency)}</span>
                {summary.totalLimit > 0 && (
                  <span className="ml-2 text-[11px] font-bold text-[var(--muted)]">
                    (Sisa: {formatCurrency(summary.remaining, defaultCurrency)})
                  </span>
                )}
              </p>
            </div>

            <div className="text-right shrink-0">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black border ${
                  summary.pct >= 100
                    ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                    : summary.pct >= 80
                    ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                    : 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30'
                }`}
              >
                {Math.round(summary.pct)}%
              </span>
            </div>
          </div>

          <div className="h-2.5 w-full rounded-full bg-[var(--field-bg)] border border-[var(--border)]/40 overflow-hidden relative z-10">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                summary.pct >= 100
                  ? 'bg-rose-500'
                  : summary.pct >= 80
                  ? 'bg-amber-500'
                  : 'bg-[var(--accent)]'
              }`}
              style={{ width: `${Math.min(100, summary.pct)}%` }}
            />
          </div>
        </div>

        {/* Budget List */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Daftar Anggaran ({monthBudgets.length})
            </h3>
          </div>

          {monthBudgets.length === 0 ? (
            <EmptyState title={t('budget.emptyTitle')} description={t('budget.emptyDesc')} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {monthBudgets.map((b) => {
                const spent = calculateBudgetSpent(b.category, monthExpenseTxs, defaultCurrency)
                const limit = toSafeNumber(b.limit)
                const pct = limit > 0 ? (spent / limit) * 100 : 0
                const remaining = Math.max(0, limit - spent)
                const isOver = spent > limit
                const iconKey = resolveTransactionIconKey(b.category, 'expense')
                const displayLabel = formatExpenseCategory(b.category, locale)
                const colorClass = getCategoryColorClass(iconKey, 'expense', b.category)

                const isDanger = pct >= 100
                const isWarn = pct >= 80 && pct < 100

                const badgeClass = isDanger
                  ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                  : isWarn
                  ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'

                const barClass = isDanger
                  ? 'bg-gradient-to-r from-rose-500 to-pink-500'
                  : isWarn
                  ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400'

                return (
                  <div
                    key={b.id}
                    className={`relative overflow-hidden rounded-2xl border transition-all duration-200 ${
                      isDanger
                        ? 'border-rose-500/30 bg-rose-500/5'
                        : isWarn
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-[var(--border)] bg-[var(--field-bg)] shadow-2xs hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <div className="absolute inset-y-0 right-0 flex items-center gap-1.5 pr-2.5 z-0">
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors cursor-pointer"
                        onClick={(e) => openEdit(b, e)}
                      >
                        {t('budget.edit')}
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-rose-500/30 bg-rose-500/12 px-2.5 py-1.5 text-[11px] font-bold text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                        onClick={() => setDeletingBudget(b)}
                      >
                        {t('budget.delete')}
                      </button>
                    </div>

                    <article
                      className={`relative z-10 bg-[var(--field-bg)] p-3.5 transition-all duration-200 ${
                        swipedId === b.id ? '-translate-x-[130px]' : 'translate-x-0'
                      } touch-pan-y`}
                      {...getSwipeHandlers(b.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colorClass}`}>
                            <CategoryIcon iconKey={iconKey} className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-[var(--fg)]">{displayLabel}</p>
                            <p className="text-[10px] font-semibold text-[var(--muted)] truncate tabular-nums">
                              {formatCurrency(spent, defaultCurrency)} / {formatCurrency(limit, defaultCurrency)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black tabular-nums ${badgeClass}`}>
                            {Math.round(pct)}%
                          </span>
                          <button
                            type="button"
                            onClick={(e) => openEdit(b, e)}
                            className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition-colors cursor-pointer"
                            title={t('budget.edit')}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 h-2 w-full rounded-full bg-[var(--border-strong)]/30 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[10px] font-bold">
                        <span className="text-[var(--muted)]">
                          {isOver ? `Over budget` : `Sisa`}
                        </span>
                        <span className={isOver ? 'text-rose-500' : 'text-[var(--fg)]'}>
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
