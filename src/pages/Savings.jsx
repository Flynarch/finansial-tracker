import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
import SavingsSheetModal from '../components/savings/SavingsSheetModal'
import SavingsFundSheetModal from '../components/savings/SavingsFundSheetModal'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import useBottomSheet from '../hooks/useBottomSheet'
import useSwipeAction from '../hooks/useSwipeAction'
import {
  clampPercent,
  convertCurrency,
  formatCurrency,
  toSafeNumber,
} from '../lib/utils'
import { Plus, Minus, Target, Edit2, Trash2, Sparkles, ChevronLeft } from 'lucide-react'
import { differenceInDays } from 'date-fns'

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
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    const id = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const goals = useLiveQuery(() => db.goals.toArray(), [], [])
  const { isOpen: sheetOpen, openSheet, closeSheet } = useBottomSheet(false)
  const [editingId, setEditingId] = useState(null)
  const [deletingGoal, setDeletingGoal] = useState(null)
  const { setSwipedId } = useSwipeAction()

  const [fundGoal, setFundGoal] = useState(null)
  const [fundActionType, setFundActionType] = useState('add')
  const [isFundOpen, setIsFundOpen] = useState(false)

  const openFundModal = (goal, actionType = 'add', e) => {
    e?.stopPropagation()
    setFundGoal(goal)
    setFundActionType(actionType)
    setIsFundOpen(true)
  }

  const rows = useMemo(() => {
    return (goals ?? []).map((g) => {
      const target = toSafeNumber(g.targetAmount)
      const current = toSafeNumber(g.currentAmount)
      const pct = target > 0 ? clampPercent((current / target) * 100) : 0
      const remaining = Math.max(0, target - current)

      let deadlineText = null
      let isOverdue = false
      if (g.deadline) {
        const daysLeft = differenceInDays(new Date(g.deadline), new Date())
        if (daysLeft < 0) {
          deadlineText = 'Lewat Tenggat'
          isOverdue = true
        } else if (daysLeft === 0) {
          deadlineText = 'Hari Ini'
        } else {
          deadlineText = `${daysLeft} Hari Lagi`
        }
      }

      return { ...g, target, current, pct, remaining, deadlineText, isOverdue }
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
    setEditingId(null)
    setSwipedId(null)
    openSheet()
  }, [openSheet, setSwipedId])

  const openEdit = (goal, e) => {
    e?.stopPropagation()
    setEditingId(goal.id)
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
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--panel-strong)] transition-colors cursor-pointer"
              aria-label={t('savings.back')}
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
            </button>
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight text-[var(--fg)]">{t('savings.title')}</h2>
              <p className="text-xs font-bold text-[var(--muted)] truncate">{t('savings.subtitle')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={openAdd}
            className="px-3.5 py-2 rounded-xl bg-[var(--accent)] text-white font-extrabold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Target Baru
          </button>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 relative z-10">
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                {t('savings.totalSaved')}
              </span>
              <p className="mt-0.5 text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-[var(--fg)]">
                {formatCurrency(totals.current, defaultCurrency)}
              </p>
              <p className="mt-1 text-xs font-extrabold text-[var(--muted)] tabular-nums">
                {t('savings.of')} <span className="text-[var(--fg)]">{formatCurrency(totals.target, defaultCurrency)}</span>
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/15 px-3 py-1 text-xs font-black text-[var(--accent)] border border-[var(--accent)]/30">
                <Sparkles className="h-3.5 w-3.5" />
                {Math.round(totals.pct)}%
              </span>
            </div>
          </div>

          <div className="mt-4 h-2.5 w-full rounded-full bg-[var(--field-bg)] border border-[var(--border)]/40 overflow-hidden relative z-10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-emerald-500 transition-all duration-700 ease-out"
              style={{ width: `${totals.pct}%` }}
            />
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Daftar Target ({rows.length})
            </h3>
          </div>

          {rows.length === 0 ? (
            <EmptyState title={t('savings.emptyTitle')} description={t('savings.emptyDesc')} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((g) => (
                <div
                  key={g.id}
                  onClick={() => navigate(`/savings/${g.id}`)}
                  className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3.5 shadow-2xs hover:border-[var(--border-strong)] transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/25">
                          <Target className="h-4.5 w-4.5" strokeWidth={2.2} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="truncate text-xs font-bold text-[var(--fg)] group-hover:text-emerald-500 transition-colors">
                            {g.name}
                          </h4>
                          <p className="mt-0.5 text-[10px] font-medium text-[var(--muted)] truncate tabular-nums">
                            {formatCurrency(g.current, g.currency || defaultCurrency)} / {formatCurrency(g.target, g.currency || defaultCurrency)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-black text-emerald-500 tabular-nums">
                          {Math.round(g.pct)}%
                        </span>
                        {g.deadlineText && (
                          <span
                            className={`text-[9px] font-extrabold ${
                              g.isOverdue ? 'text-rose-500' : 'text-[var(--muted)]'
                            }`}
                          >
                            {g.deadlineText}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 h-2 w-full rounded-full bg-[var(--border-strong)]/40 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          g.pct >= 100 ? 'bg-emerald-400' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${g.pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => openFundModal(g, 'add', e)}
                        className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                      >
                        <Plus className="h-3 w-3" strokeWidth={3} />
                        Setor
                      </button>
                      <button
                        type="button"
                        onClick={(e) => openFundModal(g, 'withdraw', e)}
                        className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[var(--panel)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--field-bg)] transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                      >
                        <Minus className="h-3 w-3" strokeWidth={3} />
                        Tarik
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => openEdit(g, e)}
                        className="p-1.5 rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
                        title="Edit Target"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeletingGoal(g)
                        }}
                        className="p-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                        title="Hapus Target"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SavingsSheetModal
        isOpen={sheetOpen}
        onClose={closeSheet}
        editingGoal={goals?.find((g) => g.id === editingId)}
      />

      <SavingsFundSheetModal
        isOpen={isFundOpen}
        onClose={() => setIsFundOpen(false)}
        goal={fundGoal}
        initialAction={fundActionType}
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
