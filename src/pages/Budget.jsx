import { format } from 'date-fns'
import { useCallback, useEffect, useRef, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { createPortal } from 'react-dom'
import Button from '../components/ui/Button'
import CategoryIcon from '../components/ui/CategoryIcon'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import MonthPicker from '../components/ui/MonthPicker'
import ToastBanner from '../components/ui/ToastBanner'
import { resolveExpenseParentIconKey } from '../lib/categoryIcon'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import { convertCurrency, formatCurrency, formatGroupedIntegerInput, getMoneyInputCaret, toSafeNumber } from '../lib/utils'
import { getMergedExpenseTree, parseExpenseCategoryPath } from '../lib/expenseCategories'
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
  const { isOpen: sheetOpen, isVisible: sheetVisible, openSheet, closeSheet } = useBottomSheet(false)
  const [editingId, setEditingId] = useState(null)
  const { swipedId, setSwipedId, getSwipeHandlers } = useSwipeAction()
  const [expandedParentId, setExpandedParentId] = useState(null)
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [sheetError, setSheetError] = useState('')
  const limitInputRef = useRef(null)

  useEffect(() => {
    if (!sheetOpen || !isCategoryOpen) return undefined
    const onPointerDown = (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (target.closest('[data-budget-category]')) return
      setIsCategoryOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [sheetOpen, isCategoryOpen])

  const tree = useMemo(() => getMergedExpenseTree(), [])
  const lang = locale === 'en' ? 'en' : 'id'

  const [form, setForm] = useState(() => ({
    month: currentMonth,
    categoryPath: '',
    limit: '',
  }))
  const [limitInput, setLimitInput] = useState('')

  const selectedParentId = useMemo(() => {
    const raw = String(form.categoryPath || '')
    if (!raw) return ''
    if (raw.includes('/')) return raw.split('/')[0]
    return raw
  }, [form.categoryPath])

  const monthBudgets = useMemo(() => (budgets ?? []).filter((b) => b.month === month), [budgets, month])

  const monthExpenseTxs = useMemo(
    () => (transactions ?? []).filter((tx) => tx?.type === 'expense' && tx?.date?.startsWith(month)),
    [transactions, month],
  )

  const spentByCategoryPath = useMemo(() => {
    return monthExpenseTxs.reduce((acc, tx) => {
      const key = String(tx?.category ?? '')
      if (!key) return acc
      acc[key] = (acc[key] ?? 0) + convertCurrency(toSafeNumber(tx.amount), tx.currency || defaultCurrency, defaultCurrency, {})
      return acc
    }, {})
  }, [defaultCurrency, monthExpenseTxs])

  const getBudgetLabel = (path) => {
    const parsed = parseExpenseCategoryPath(path)
    if (!parsed) return { main: String(path || ''), sub: null }
    return {
      main: parsed.parent?.names?.[lang] || parsed.parent?.id || String(path || ''),
      sub: parsed.child?.names?.[lang] || parsed.child?.id || null,
    }
  }

  const openAdd = useCallback(() => {
    setSheetError('')
    setEditingId(null)
    setSwipedId(null)
    setForm((p) => ({
      ...p,
      month,
      categoryPath: '',
      limit: '',
    }))
    setLimitInput('')
    setExpandedParentId(null)
    setIsCategoryOpen(false)
    openSheet()
  }, [month, openSheet, setSwipedId])

  const openEdit = (budget) => {
    setSheetError('')
    setEditingId(budget.id)
    setSwipedId(null)
    setForm({
      month: budget.month,
      categoryPath: String(budget.category || ''),
      limit: String(budget.limit ?? ''),
    })
    setLimitInput(formatGroupedIntegerInput(budget.limit ?? ''))
    const raw = String(budget.category || '')
    setExpandedParentId(raw.includes('/') ? raw.split('/')[0] : raw || null)
    setIsCategoryOpen(false)
    openSheet()
  }



  const save = async () => {
    const payload = {
      month: form.month,
      category: String(form.categoryPath || '').trim(),
      limit: toSafeNumber(form.limit),
    }
    if (!payload.category) {
      setSheetError(t('budget.validation.category'))
      return
    }
    if (!payload.month || payload.limit <= 0) {
      setSheetError(t('budget.validation.limit'))
      return
    }
    try {
      setSheetError('')
      if (editingId) {
        await db.budgets.update(editingId, payload)
      } else {
        await db.budgets.add(payload)
      }
      closeSheet()
      setEditingId(null)
    } catch {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      setSheetError(offline ? t('common.error.offline') : t('common.error.saveFailed'))
    }
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
                      onClick={() => {
                        const confirmed = window.confirm(t('budget.deleteConfirm'))
                        if (!confirmed) return
                        void db.budgets.delete(b.id)
                      }}
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

      {sheetOpen && typeof document !== 'undefined'
        ? createPortal(
        <div className="fixed inset-0 z-50 ft-motion-overlay">
          <button
            type="button"
            className={`ft-motion-overlay absolute inset-0 bg-black/40 backdrop-blur-sm ${
              sheetVisible ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={closeSheet}
            aria-label={t('budget.sheet.close')}
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div
              className={`ft-motion-panel max-h-[min(78dvh,40rem)] overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-2xl ${
                sheetVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
            >
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[var(--border-strong)]/40" />
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--fg)]">
                  {editingId ? t('budget.sheet.editTitle') : t('budget.sheet.addTitle')}
                </p>
                <button
                  type="button"
                  className="rounded-xl px-3 py-1 text-sm text-[var(--muted)] hover:bg-[var(--field-bg)]"
                  onClick={closeSheet}
                >
                  {t('budget.sheet.close')}
                </button>
              </div>
              {sheetError ? <ToastBanner message={sheetError} /> : null}

              <div className="grid gap-3">
                <label className="ft-label text-xs">
                  {t('budget.month')}
                  <MonthPicker
                    value={form.month}
                    onChange={(val) => setForm((p) => ({ ...p, month: val }))}
                    className="mt-1"
                  />
                </label>

                <label className="ft-label text-xs">
                  {t('budget.category')}
                  <div
                    className="mt-1 overflow-hidden rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)]"
                    data-budget-category
                  >
                    <button
                      type="button"
                      onClick={() => setIsCategoryOpen((v) => !v)}
                      className="flex h-11 w-full items-center justify-between gap-3 px-3 text-left"
                      aria-expanded={isCategoryOpen}
                    >
                      <span className="text-[13px] font-medium text-[var(--fg)]">
                        {(() => {
                          if (!form.categoryPath) return t('budget.category.placeholder')
                          const parsed = parseExpenseCategoryPath(form.categoryPath)
                          if (parsed) {
                            const langLabel = locale === 'en' ? 'en' : 'id'
                            const parentName = parsed.parent?.names?.[langLabel] || parsed.parent?.id || ''
                            const childName = parsed.child?.names?.[langLabel] || parsed.child?.id || ''
                            return childName ? `${parentName} · ${childName}` : parentName
                          }
                          return String(form.categoryPath || '').trim()
                        })()}
                      </span>
                      <span className="text-[var(--muted)]">{isCategoryOpen ? '▾' : '▸'}</span>
                    </button>

                    <div
                      className={`grid border-t border-[var(--border)]/40 transition-all duration-300 ease-out ${
                        isCategoryOpen
                          ? 'pointer-events-auto opacity-100 [grid-template-rows:1fr]'
                          : 'pointer-events-none opacity-0 [grid-template-rows:0fr]'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <ul
                          className="ft-hide-scrollbar max-h-[420px] min-w-0 overflow-y-auto"
                          style={{ scrollbarGutter: 'stable' }}
                        >
                          {tree.map((parent) => {
                            const expanded = expandedParentId === parent.id
                            const activeMain = selectedParentId === parent.id && !String(form.categoryPath || '').includes('/')
                            const hasSub = (parent.children || []).length > 0

                            return (
                              <li key={parent.id} className="border-b border-[var(--border)]/40 last:border-b-0">
                                <div
                                  className={`flex h-[44px] w-full items-stretch text-[13px] font-semibold transition ${
                                    expanded || activeMain
                                      ? 'bg-[color-mix(in_srgb,var(--accent)_10%,var(--field-bg))] text-[var(--fg)]'
                                      : 'text-[var(--fg)] hover:bg-[var(--panel)]'
                                  }`}
                                >
                                  {/* 80% kiri: pick main category saja */}
                                  <button
                                    type="button"
                                    className="flex w-[80%] items-center gap-2 px-3 text-left"
                                    onClick={() => {
                                      setForm((p) => ({ ...p, categoryPath: parent.id }))
                                      setExpandedParentId(null)
                                      setIsCategoryOpen(false)
                                    }}
                                  >
                                    <CategoryIcon icon={resolveExpenseParentIconKey(parent.id)} className="h-4 w-4 shrink-0" />
                                    <span className="min-w-0 flex-1 truncate">{parent?.names?.[lang] || parent?.id || ''}</span>
                                  </button>

                                  {/* 20% kanan: hanya buka/tutup sub category */}
                                  <button
                                    type="button"
                                    className="flex w-[20%] items-center justify-center border-l border-[var(--border)]/40 text-[var(--muted)]"
                                    onClick={() => {
                                      setExpandedParentId((prev) => (prev === parent.id ? null : parent.id))
                                    }}
                                    aria-label={expanded ? t('budget.subCategory.close') : t('budget.subCategory.open')}
                                  >
                                    <span>{expanded ? '▾' : '▸'}</span>
                                  </button>
                                </div>

                                <div
                                  className={`grid px-2 transition-all duration-300 ease-out ${
                                    expanded && hasSub
                                      ? 'pointer-events-auto opacity-100 [grid-template-rows:1fr]'
                                      : 'pointer-events-none opacity-0 [grid-template-rows:0fr]'
                                  }`}
                                >
                                  <div className="overflow-hidden pb-2">
                                <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel)]/40">
                                      {(parent.children || []).map((child) => {
                                        const path = `${parent.id}/${child.id}`
                                        const active = form.categoryPath === path
                                        return (
                                          <button
                                            key={path}
                                            type="button"
                                            onClick={() => {
                                              setForm((p) => ({ ...p, categoryPath: path }))
                                              setIsCategoryOpen(false)
                                            }}
                                            className={`flex h-[40px] w-full items-center gap-2 border-b border-[var(--border)]/30 px-3 text-left text-[12px] font-medium transition last:border-b-0 ${
                                              active
                                                ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--fg)]'
                                                : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                                            }`}
                                          >
                                            <span className="min-w-0 flex-1 truncate whitespace-nowrap">{child?.names?.[lang] || child?.id || ''}</span>
                                            {active ? <span className="text-[var(--accent)]">✓</span> : null}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                </label>

                <label className="ft-label text-xs">
                  {t('budget.limit')}
                  <input
                    ref={limitInputRef}
                    type="text"
                    inputMode="numeric"
                    value={limitInput}
                    onChange={(e) => {
                      const rawValue = e.target.value
                      const formatted = formatGroupedIntegerInput(rawValue)
                      const caret = getMoneyInputCaret(rawValue, formatted, e.target.selectionStart, 'IDR')
                      const digits = String(e.target.value || '').replace(/[^\d]/g, '')
                      setForm((p) => ({ ...p, limit: digits }))
                      setLimitInput(formatted)
                      window.requestAnimationFrame(() => {
                        const el = limitInputRef.current
                        if (!el) return
                        el.setSelectionRange(caret, caret)
                      })
                    }}
                    className="ft-field"
                    placeholder={t('budget.limit.placeholder')}
                  />
                </label>

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={save}
                    disabled={!String(form.categoryPath || '').trim() || !String(form.month || '').trim() || toSafeNumber(form.limit) <= 0}
                  >
                    {t('budget.save')}
                  </Button>
                  <Button
                    type="button"
                    className="bg-[var(--field-border)] text-[var(--fg)] hover:bg-[var(--field-border-hover)]"
                    onClick={closeSheet}
                  >
                    {t('budget.cancel')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
          ,
          document.body,
        )
        : null}
    </div>
  )
}

export default Budget
