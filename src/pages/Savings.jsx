import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { createPortal } from 'react-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import ToastBanner from '../components/ui/ToastBanner'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import useBottomSheet from '../hooks/useBottomSheet'
import useSwipeAction from '../hooks/useSwipeAction'
import {
  clampPercent,
  convertCurrency,
  formatCurrency,
  formatMoneyInput,
  formatMoneyValueForInput,
  getMoneyInputCaret,
  parseMoneyInput,
  toSafeNumber,
} from '../lib/utils'

function Savings() {
  const { t } = useTranslation()
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

  const goals = useLiveQuery(() => db.goals.toArray(), [], [])
  const { isOpen: sheetOpen, isVisible: sheetVisible, openSheet, closeSheet } = useBottomSheet(false)
  const [editingId, setEditingId] = useState(null)
  const { swipedId, setSwipedId, getSwipeHandlers } = useSwipeAction()
  const [sheetError, setSheetError] = useState('')
  const targetAmountInputRef = useRef(null)
  const currentAmountInputRef = useRef(null)
  const [form, setForm] = useState({
    name: '',
    targetAmount: '',
    currentAmount: '',
    currency: defaultCurrency,
  })

  const rows = useMemo(() => {
    return (goals ?? []).map((g) => {
      const target = toSafeNumber(g.targetAmount)
      const current = toSafeNumber(g.currentAmount)
      const pct = target > 0 ? clampPercent((current / target) * 100) : 0
      return { ...g, target, current, pct }
    })
  }, [goals])

  const totals = useMemo(() => {
    const target = (goals ?? []).reduce(
      (sum, g) => sum + convertCurrency(toSafeNumber(g.targetAmount), g.currency || defaultCurrency, defaultCurrency, {}),
      0,
    )
    const current = (goals ?? []).reduce(
      (sum, g) => sum + convertCurrency(toSafeNumber(g.currentAmount), g.currency || defaultCurrency, defaultCurrency, {}),
      0,
    )
    const pct = target > 0 ? clampPercent((current / target) * 100) : 0
    return { target, current, pct }
  }, [defaultCurrency, goals])

  const openAdd = useCallback(() => {
    setSheetError('')
    setEditingId(null)
    setSwipedId(null)
    setForm({
      name: '',
      targetAmount: '',
      currentAmount: '',
      currency: defaultCurrency,
    })
    openSheet()
  }, [defaultCurrency, openSheet, setSwipedId])

  const openEdit = (goal) => {
    setSheetError('')
    setEditingId(goal.id)
    setSwipedId(null)
    setForm({
      name: goal.name || '',
      targetAmount: formatMoneyValueForInput(goal.targetAmount, goal.currency || defaultCurrency),
      currentAmount: formatMoneyValueForInput(goal.currentAmount, goal.currency || defaultCurrency),
      currency: goal.currency || defaultCurrency,
    })
    openSheet()
  }



  const save = async () => {
    const payload = {
      name: String(form.name || '').trim(),
      targetAmount: parseMoneyInput(form.targetAmount, form.currency),
      currentAmount: parseMoneyInput(form.currentAmount, form.currency),
      currency: form.currency || defaultCurrency,
    }
    if (!payload.name) {
      setSheetError(t('savings.validation.name'))
      return
    }
    if (payload.targetAmount <= 0) {
      setSheetError(t('savings.validation.target'))
      return
    }
    if (payload.currentAmount < 0) {
      setSheetError(t('savings.validation.current'))
      return
    }
    try {
      setSheetError('')
      if (editingId) {
        await db.goals.update(editingId, payload)
      } else {
        await db.goals.add(payload)
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
            aria-label={t('savings.back')}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--fg)]">{t('savings.title')}</h2>
            <p className="ft-muted mt-0.5 text-xs">{t('savings.subtitle')}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" onClick={openAdd}>
            {t('savings.add')}
          </Button>
        </div>
      </div>

      <Card className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-[var(--muted)]">{t('savings.totalSaved')}</p>
            <p className="text-sm font-semibold tabular-nums text-[var(--fg)]">
              {formatCurrency(totals.current, defaultCurrency)}
            </p>
            <p className="mt-0.5 text-[11px] tabular-nums text-[var(--muted)]">
              {t('savings.of')} {formatCurrency(totals.target, defaultCurrency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-[var(--muted)]">{t('savings.progress')}</p>
            <p className="text-sm font-semibold tabular-nums text-[var(--fg)]">{Math.round(totals.pct)}%</p>
          </div>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-[var(--border-strong)]/40">
          <div className="h-2 rounded-full bg-[var(--accent)]/70" style={{ width: `${totals.pct}%` }} />
        </div>
      </Card>

      <Card title={t('savings.listTitle', { count: rows.length })} withDivider>
        {rows.length === 0 ? (
          <EmptyState title={t('savings.emptyTitle')} description={t('savings.emptyDesc')} />
        ) : (
          <div className="space-y-2">
            {rows.map((g) => (
              <div key={g.id} className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]">
                <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-2">
                  <button
                    type="button"
                    className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[11px] font-semibold text-[var(--fg)] hover:bg-[var(--field-bg)]"
                    onClick={() => openEdit(g)}
                  >
                    {t('savings.edit')}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-rose-500/30 bg-rose-500/12 px-3 py-2 text-[11px] font-semibold text-rose-400"
                    onClick={() => {
                      const confirmed = window.confirm(t('savings.deleteConfirm'))
                      if (!confirmed) return
                      void db.goals.delete(g.id)
                    }}
                  >
                    {t('savings.delete')}
                  </button>
                </div>

                <article
                  className={`relative bg-[var(--field-bg)] p-3 transition-all duration-200 ${
                    swipedId === g.id ? '-translate-x-[124px]' : 'translate-x-0'
                  } touch-pan-y`}
                  {...getSwipeHandlers(g.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--fg)]">{g.name}</p>
                    <p className="ft-muted mt-1 text-[11px] tabular-nums">
                      {formatCurrency(g.current, g.currency || defaultCurrency)} / {formatCurrency(g.target, g.currency || defaultCurrency)}
                    </p>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-[var(--border-strong)]/40">
                    <div className="h-2 rounded-full bg-[var(--accent)]/70" style={{ width: `${g.pct}%` }} />
                  </div>
                </article>
              </div>
            ))}
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
            aria-label={t('savings.sheet.close')}
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
                  {editingId ? t('savings.sheet.editTitle') : t('savings.sheet.addTitle')}
                </p>
                <button
                  type="button"
                  className="rounded-xl px-3 py-1 text-sm text-[var(--muted)] hover:bg-[var(--field-bg)]"
                  onClick={closeSheet}
                >
                  {t('savings.sheet.close')}
                </button>
              </div>
              {sheetError ? <ToastBanner message={sheetError} /> : null}

              <div className="grid gap-3">
                <label className="ft-label text-xs">
                  {t('savings.goalName')}
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="ft-field"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="ft-label text-xs">
                    {t('savings.target')}
                    <input
                      ref={targetAmountInputRef}
                      type="text"
                      inputMode="numeric"
                      value={form.targetAmount}
                      onChange={(e) => {
                        const rawValue = e.target.value
                        const currency = form.currency
                        const formatted = formatMoneyInput(rawValue, currency)
                        const caret = getMoneyInputCaret(rawValue, formatted, e.target.selectionStart, currency)
                        setForm((p) => ({ ...p, targetAmount: formatted }))
                        window.requestAnimationFrame(() => {
                          const el = targetAmountInputRef.current
                          if (!el) return
                          el.setSelectionRange(caret, caret)
                        })
                      }}
                      className="ft-field"
                    />
                  </label>
                  <label className="ft-label text-xs">
                    {t('savings.current')}
                    <input
                      ref={currentAmountInputRef}
                      type="text"
                      inputMode="numeric"
                      value={form.currentAmount}
                      onChange={(e) => {
                        const rawValue = e.target.value
                        const currency = form.currency
                        const formatted = formatMoneyInput(rawValue, currency)
                        const caret = getMoneyInputCaret(rawValue, formatted, e.target.selectionStart, currency)
                        setForm((p) => ({ ...p, currentAmount: formatted }))
                        window.requestAnimationFrame(() => {
                          const el = currentAmountInputRef.current
                          if (!el) return
                          el.setSelectionRange(caret, caret)
                        })
                      }}
                      className="ft-field"
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="ft-label text-xs">
                    {t('savings.currency')}
                    <select
                      value={form.currency}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          currency: e.target.value,
                          targetAmount: formatMoneyInput(p.targetAmount, e.target.value),
                          currentAmount: formatMoneyInput(p.currentAmount, e.target.value),
                        }))
                      }
                      className="ft-field"
                    >
                      {['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP'].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={save}
                    disabled={
                      !String(form.name || '').trim() ||
                      parseMoneyInput(form.targetAmount, form.currency) <= 0 ||
                      parseMoneyInput(form.currentAmount, form.currency) < 0
                    }
                  >
                    {t('savings.save')}
                  </Button>
                  <Button
                    type="button"
                    className="bg-[var(--field-border)] text-[var(--fg)] hover:bg-[var(--field-border-hover)]"
                    onClick={closeSheet}
                  >
                    {t('savings.cancel')}
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

export default Savings

