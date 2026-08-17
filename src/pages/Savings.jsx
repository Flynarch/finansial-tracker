import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
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
  FALLBACK_EXCHANGE_RATES,
} from '../lib/utils'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import { Plus, Minus, Target, Edit2, Trash2, ChevronLeft, Star, Archive, RotateCcw } from 'lucide-react'
import { differenceInDays } from 'date-fns'

function Savings() {
  const { t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const motionDelay = reduceMotion ? 0 : 220
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

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

  const showArchive = searchParams.get('view') === 'archive'

  useEffect(() => {
    window.scrollTo(0, 0)
    const id = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const goals = useLiveQuery(async () => {
    try {
      return await db.goals.toArray()
    } catch {
      return []
    }
  }, [], [])
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

  const togglePin = async (goalId, currentPinned, e) => {
    e?.stopPropagation()
    await db.goals.update(goalId, { isPinned: !currentPinned })
  }

  const toggleArchiveStatus = async (goalId, currentArchived, e) => {
    e?.stopPropagation()
    await db.goals.update(goalId, {
      isArchived: !currentArchived,
      isCompleted: !currentArchived,
    })
  }

  const processedGoals = useMemo(() => {
    return (goals ?? []).map((g) => {
      const isArch = g.isCompleted || g.isArchived
      const target = toSafeNumber(g.targetAmount)
      const current = isArch ? target : toSafeNumber(g.currentAmount)
      const pct = isArch ? 100 : target > 0 ? clampPercent((current / target) * 100) : 0
      const remaining = isArch ? 0 : Math.max(0, target - current)

      let deadlineText = null
      let isOverdue = false
      if (g.deadline && !isArch) {
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

      return { ...g, target, current, pct, remaining, deadlineText, isOverdue, isArchived: isArch }
    })
  }, [goals])

  const activeGoals = useMemo(
    () => processedGoals.filter((g) => !g.isArchived).sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)),
    [processedGoals]
  )

  const archivedGoals = useMemo(
    () => processedGoals.filter((g) => g.isArchived).sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)),
    [processedGoals]
  )

  const displayedRows = showArchive ? archivedGoals : activeGoals

  const totals = useMemo(() => {
    const rawActive = (goals ?? []).filter((g) => !g.isCompleted && !g.isArchived)
    const target = rawActive.reduce(
      (sum, g) => sum + convertCurrency(toSafeNumber(g.targetAmount), g.currency || defaultCurrency, defaultCurrency, rates),
      0
    )
    const current = rawActive.reduce(
      (sum, g) => sum + convertCurrency(toSafeNumber(g.currentAmount), g.currency || defaultCurrency, defaultCurrency, rates),
      0
    )
    const pct = target > 0 ? clampPercent((current / target) * 100) : 0
    return { target, current, pct }
  }, [defaultCurrency, goals, rates])

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
    if (showArchive) {
      setSearchParams({})
      return
    }
    if (isLeaving) return
    setIsLeaving(true)
    setIsEntering(false)
    window.setTimeout(() => {
      navigate(-1)
    }, motionDelay)
  }

  return (
    <div className="bg-[var(--bg)] min-h-[100dvh] pb-28">
      <div
        className={`ft-motion-page min-h-full max-w-lg mx-auto space-y-5 px-4 transform-gpu ${
          isLeaving
            ? '-translate-x-2 opacity-0'
            : isEntering
              ? 'translate-y-0 opacity-100'
              : 'translate-y-2 opacity-0'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3 pt-3">
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
              <h2 className="text-xl font-black tracking-tight text-[var(--fg)]">
                {showArchive ? 'Arsip Tabungan' : t('savings.title')}
              </h2>
              <p className="text-xs font-bold text-[var(--muted)] truncate">
                {showArchive ? 'Daftar target tabungan yang telah tuntas & dicairkan' : t('savings.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!showArchive && (
              <>
                <button
                  type="button"
                  onClick={() => setSearchParams({ view: 'archive' })}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
                  title={'Buka Arsip Tabungan'}
                >
                  <Archive className="h-4.5 w-4.5" />
                  {archivedGoals.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--earthy-green)] text-[9px] font-black text-white shadow-2xs">
                      {archivedGoals.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={openAdd}
                  className="px-3.5 py-2 rounded-xl bg-[var(--accent)] text-white font-extrabold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  Target Baru
                </button>
              </>
            )}

            {showArchive && (
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-xs font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors cursor-pointer"
              >
                Kembali ke Aktif
              </button>
            )}
          </div>
        </div>

        {/* Hero Summary Card (Active View Only) */}
        {!showArchive && (
          <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-6 shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-3 relative z-10">
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                  {t('savings.totalSaved')} (Aktif)
                </span>
                <p className="mt-0.5 text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-[var(--fg)]">
                  {formatCurrency(totals.current, defaultCurrency)}
                </p>
                <p className="mt-1 text-xs font-extrabold text-[var(--muted)] tabular-nums">
                  {t('savings.of')}{' '}
                  <span className="text-[var(--fg)] font-black">{formatCurrency(totals.target, defaultCurrency)}</span>
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-flex items-center rounded-full bg-[var(--earthy-green-soft)] px-3 py-1 text-xs font-black text-[var(--earthy-green)] border border-[var(--earthy-green)]/25">
                  {Math.round(totals.pct)}%
                </span>
              </div>
            </div>

            <div className="h-2.5 w-full rounded-full bg-[var(--field-bg)] border border-[var(--border)]/40 overflow-hidden relative z-10">
              <div
                className="h-full rounded-full bg-[var(--earthy-green)] transition-all duration-700 ease-out"
                style={{ width: `${totals.pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Goal Cards Section */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              {showArchive ? `Arsip Selesai (${archivedGoals.length})` : `Target Tabungan Aktif (${activeGoals.length})`}
            </h3>
          </div>

          {displayedRows.length === 0 ? (
            <EmptyState
              title={showArchive ? 'Belum Ada Tabungan di Arsip' : t('savings.emptyTitle')}
              description={
                showArchive
                  ? 'Target tabungan yang telah 100% dan dicairkan ke dompet akan disimpan dengan aman di sini.'
                  : t('savings.emptyDesc')
              }
              action={
                !showArchive ? (
                  <button
                    type="button"
                    onClick={openAdd}
                    className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white font-extrabold text-xs shadow-sm transition active:scale-95 flex items-center gap-1.5 mx-auto cursor-pointer"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                    {t('savings.newGoal', 'Target Baru')}
                  </button>
                ) : null
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 ft-stagger-in">
              {displayedRows.map((g) => {
                const isComplete = g.isArchived
                return (
                  <div
                    key={g.id}
                    onClick={() => navigate(`/savings/${g.id}`)}
                    className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-2xs hover:border-[var(--border-strong)] transition-all cursor-pointer flex flex-col justify-between space-y-3.5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${
                              isComplete
                                ? 'bg-[var(--earthy-green)] text-white border-[var(--earthy-green)] shadow-xs'
                                : 'bg-[var(--earthy-green-soft)] text-[var(--earthy-green)] border-[var(--earthy-green)]/25'
                            }`}
                          >
                            <Target className="h-4.5 w-4.5" strokeWidth={2.2} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="truncate text-xs font-bold text-[var(--fg)] group-hover:text-[var(--earthy-green)] transition-colors">
                                {g.name}
                              </h4>
                              {g.isPinned && <Star className="h-3 w-3 fill-amber-500 text-amber-500 shrink-0" />}
                            </div>
                            <p className="mt-0.5 text-[10px] font-semibold text-[var(--muted)] truncate">
                              {isComplete
                                ? 'Selesai & Dicairkan 🏆'
                                : `Kurang: ${formatCurrency(g.remaining, g.currency || defaultCurrency)}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="rounded-full border border-[var(--earthy-green)]/25 bg-[var(--earthy-green-soft)] px-2.5 py-0.5 text-[10px] font-black text-[var(--earthy-green)] tabular-nums">
                            {Math.round(g.pct)}%
                          </span>
                          {g.deadlineText && !isComplete && (
                            <span
                              className={`text-[9px] font-extrabold ${
                                g.isOverdue ? 'text-[var(--earthy-terra)]' : 'text-[var(--muted)]'
                              }`}
                            >
                              {g.deadlineText}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
                          <span className="text-[var(--fg)] font-black">
                            {formatCurrency(g.current, g.currency || defaultCurrency)}
                          </span>
                          <span className="text-[var(--muted)] font-semibold">
                            / {formatCurrency(g.target, g.currency || defaultCurrency)}
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-[var(--field-bg)] border border-[var(--border)]/40 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--earthy-green)] transition-all duration-500"
                            style={{ width: `${g.pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[var(--border)]/60 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        {!isComplete && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => openFundModal(g, 'add', e)}
                              className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[var(--earthy-green-soft)] text-[var(--earthy-green)] border border-[var(--earthy-green)]/25 hover:bg-[var(--earthy-green)]/20 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
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
                          </>
                        )}

                        {isComplete && (
                          <button
                            type="button"
                            onClick={(e) => toggleArchiveStatus(g.id, true, e)}
                            className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[var(--field-bg)] text-[var(--muted)] border border-[var(--border)] hover:text-[var(--fg)] transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                            title={'Kembalikan ke Target Aktif'}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Aktifkan Kembali
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => togglePin(g.id, g.isPinned, e)}
                          className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                            g.isPinned
                              ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                              : 'bg-[var(--panel)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--fg)]'
                          }`}
                          title={g.isPinned ? 'Lepas Pin' : 'Pin Target'}
                        >
                          <Star className="h-3.5 w-3.5" fill={g.isPinned ? 'currentColor' : 'none'} />
                        </button>
                        {!isComplete && (
                          <button
                            type="button"
                            onClick={(e) => openEdit(g, e)}
                            className="p-1.5 rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
                            title={'Edit Target'}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeletingGoal(g)
                          }}
                          className="p-1.5 rounded-xl border border-[var(--earthy-terra)]/30 bg-[var(--earthy-terra-soft)] text-[var(--earthy-terra)] hover:bg-[var(--earthy-terra)]/20 transition-colors cursor-pointer"
                          title={'Hapus Target'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
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
        onGoalCompleted={(completedGoal) => {
          if (completedGoal?.id) {
            navigate(`/savings/${completedGoal.id}`)
          }
        }}
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


