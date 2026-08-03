import { format } from 'date-fns'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import MonthPicker from '../components/ui/MonthPicker'
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
import BudgetSheetModal from '../components/budget/BudgetSheetModal'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import { formatCurrency, toSafeNumber } from '../lib/utils'
import { parseExpenseCategoryPath } from '../lib/expenseCategories'
import useBottomSheet from '../hooks/useBottomSheet'
import useSwipeAction from '../hooks/useSwipeAction'


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
    // Pastikan saat halaman dibuka selalu mulai dari paling atas
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

  const lang = locale === 'en' ? 'en' : 'id'

  const monthBudgets = useMemo(() => (budgets ?? []).filter((b) => b.month === month), [budgets, month])

  const monthExpenseTxs = useMemo(
    () => (transactions ?? []).filter((tx) => tx?.type === 'expense' && tx?.date?.startsWith(month)),
    [transactions, month]
  )

  const spentByCategoryPath = useMemo(() => {
    const map = {}
    monthExpenseTxs.forEach((tx) => {
      const cat = String(tx.category || '').trim()
      if (!cat) return
      map[cat] = (map[cat] ?? 0) + toSafeNumber(tx.amount)
    })
    return map
  }, [monthExpenseTxs])

  const getBudgetLabel = (path) => {
    const parsed = parseExpenseCategoryPath(path)
    if (!parsed) return { main: String(path || ''), sub: null }
    return {
      main: parsed.parent?.names?.[lang] || parsed.parent?.id || String(path || ''),
      sub: parsed.child?.names?.[lang] || parsed.child?.id || null,
    }
  }

  const openAdd = useCallback(() => {
    setEditingId(null)
    setSwipedId(null)
    openSheet()
  }, [openSheet, setSwipedId])

  const openEdit = (budget) => {
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
    <div className="bg-[var(--bg)]">
      <div
        className={`ft-motion-page min-h-full space-y-4 transform-gpu ${
          isLeaving
            ? '-translate-x-2 opacity-0'
            : isEntering
              ? 'translate-y-0 opacity-100'
              : 'translate-y-2 opacity-0'
        }`}
      >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] text-[var(--fg)] hover:bg-[var(--field-bg)]"
            aria-label={t('budget.back')}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--fg)]">{t('budget.title')}</h2>
            <p className="ft-muted mt-0.5 text-xs">{t('budget.subtitle')}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" onClick={openAdd}>
            {t('budget.add')}
          </Button>
        </div>
      </div>

      <Card className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <label className="ft-label text-xs">
            {t('budget.month')}
            <MonthPicker
              value={month}
              onChange={setMonth}
              className="mt-1 min-w-[160px]"
            />
          </label>
          <div className="text-right">
            <p className="ft-muted text-[11px]">{t('budget.totalCategories')}</p>
            <p className="text-sm font-semibold tabular-nums text-[var(--fg)]">{monthBudgets.length}</p>
          </div>
        </div>
      </Card>

      <Card title={t('budget.listTitle', { month })} withDivider>
        {monthBudgets.length === 0 ? (
          <EmptyState title={t('budget.emptyTitle')} description={t('budget.emptyDesc')} />
        ) : (
          <div className="space-y-2">
            {monthBudgets.map((b) => {
              const spent = toSafeNumber(spentByCategoryPath[String(b.category || '')] ?? 0)
              const limit = toSafeNumber(b.limit)
              const pct = limit > 0 ? (spent / limit) * 100 : 0
              const label = getBudgetLabel(b.category)
              
              const isDanger = pct >= 100
              const isWarn = pct >= 80 && pct < 100
              
              return (
                <div key={b.id} className={`relative overflow-hidden rounded-2xl border transition-colors ${isDanger ? 'border-rose-500/50 shadow-[0_0_15px_-3px_rgba(244,63,94,0.15)]' : isWarn ? 'border-amber-500/50 shadow-[0_0_15px_-3px_rgba(245,158,11,0.15)]' : 'border-[var(--border)]'}`}>
                  <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-2">
                    <button
                      type="button"
                      className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[11px] font-semibold text-[var(--fg)] hover:bg-[var(--field-bg)]"
                      onClick={() => openEdit(b)}
                    >
                      {t('budget.edit')}
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-rose-500/30 bg-rose-500/12 px-3 py-2 text-[11px] font-semibold text-rose-400"
                      onClick={() => setDeletingBudget(b)}
                    >
                      {t('budget.delete')}
                    </button>
                  </div>

                  <article
                    className={`relative bg-[var(--field-bg)] p-3 transition-all duration-200 ${
                      swipedId === b.id ? '-translate-x-[124px]' : 'translate-x-0'
                    } touch-pan-y`}
                    {...getSwipeHandlers(b.id)}
                  >
                    <div className="min-w-0 flex items-start justify-between gap-2">
                      <div>
                        <p className={`line-clamp-3 break-words text-sm font-semibold ${isDanger ? 'text-rose-400' : isWarn ? 'text-amber-400' : 'text-[var(--fg)]'}`}>{label.main}</p>
                        {label.sub ? (
                          <p className="mt-0.5 line-clamp-3 break-words text-[11px] font-medium text-[var(--muted)]">{label.sub}</p>
                        ) : null}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-bold tabular-nums ${isDanger ? 'text-rose-400' : isWarn ? 'text-amber-400' : 'text-[var(--fg)]'}`}>
                          {Math.round(pct)}%
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-1.5 flex items-center justify-between text-[11px] font-medium text-[var(--muted)] tabular-nums">
                       <span>{formatCurrency(spent, defaultCurrency)}</span>
                       <span>{formatCurrency(limit, defaultCurrency)}</span>
                    </div>

                    <div className="mt-2 h-2 w-full rounded-full bg-[var(--border-strong)]/40 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isDanger ? 'bg-rose-500' : isWarn ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                    </div>
                  </article>
                </div>
              )
            })}
          </div>
        )}
      </Card>

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
