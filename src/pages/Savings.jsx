import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { createPortal } from 'react-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import ToastBanner from '../components/ui/ToastBanner'
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
import SavingsSheetModal from '../components/savings/SavingsSheetModal'
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
  const [deletingGoal, setDeletingGoal] = useState(null)
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
      deadline: '',
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
      deadline: goal.deadline || '',
    })
    openSheet()
  }



  const save = async () => {
    const payload = {
      name: String(form.name || '').trim(),
      targetAmount: parseMoneyInput(form.targetAmount, form.currency),
      currentAmount: parseMoneyInput(form.currentAmount, form.currency),
      currency: form.currency || defaultCurrency,
      deadline: form.deadline || null,
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
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19)
      if (editingId) {
        const oldGoal = await db.goals.get(editingId)
        await db.goals.update(editingId, payload)
        if (oldGoal && payload.currentAmount > oldGoal.currentAmount) {
          const diff = payload.currentAmount - oldGoal.currentAmount
          await db.goalLogs.add({ goalId: editingId, amount: diff, date: nowStr })
        }
      } else {
        const newId = await db.goals.add(payload)
        if (payload.currentAmount > 0) {
          await db.goalLogs.add({ goalId: newId, amount: payload.currentAmount, date: nowStr })
        }
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
                    onClick={() => setDeletingGoal(g)}
                  >
                    {t('savings.delete')}
                  </button>
                </div>

                <article
                  className={`relative bg-[var(--field-bg)] p-3 transition-all duration-200 ${
                    swipedId === g.id ? '-translate-x-[124px]' : 'translate-x-0'
                  } touch-pan-y cursor-pointer`}
                  onClick={() => {
                    if (swipedId === g.id) setSwipedId(null)
                    else navigate(`/savings/${g.id}`)
                  }}
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

      <SavingsSheetModal
        isOpen={sheetOpen}
        onClose={closeSheet}
        editingGoal={goals?.find((g) => g.id === editingId)}
      />
      <ConfirmDeleteModal
        isOpen={!!deletingGoal}
        onClose={() => setDeletingGoal(null)}
        onConfirm={async () => {
          if (deletingGoal) {
            await db.goals.delete(deletingGoal.id)
            setDeletingGoal(null)
          }
        }}
        title={t('savings.delete') || 'Hapus Tabungan'}
        message={t('savings.deleteConfirm') || 'Apakah Anda yakin ingin menghapus tujuan tabungan ini?'}
      />
    </div>
  )
}

export default Savings

