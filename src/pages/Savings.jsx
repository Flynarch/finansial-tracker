import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Minus, Target, Edit2, Trash2, Star, Archive, RotateCcw, CheckCircle2, MoreVertical } from 'lucide-react'
import { differenceInDays, format } from 'date-fns'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
import SavingsSheetModal from '../components/savings/SavingsSheetModal'
import SavingsFundSheetModal from '../components/savings/SavingsFundSheetModal'
import PageHeader from '../components/ui/PageHeader'
import AnimatedCounter from '../components/ui/AnimatedCounter'
import { db } from '../lib/db'
import { invalidateWalletBalance } from '../lib/balanceEngine'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import useBackButton from '../hooks/useBackButton'
import useSwipeAction from '../hooks/useSwipeAction'
import {
  clampPercent,
  convertCurrency,
  formatCurrency,
  roundCurrency,
  toSafeNumber,
  FALLBACK_EXCHANGE_RATES,
} from '../lib/utils'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'

function Savings() {
  const { locale, t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const defaultWalletId = useSettingsStore((state) => state.defaultWalletId)
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const motionDelay = reduceMotion ? 0 : 200
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
      } catch (err){
      console.warn('[Savings]', err)
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
    } catch (err){
      console.warn('[Savings]', err)
      return []
    }
  }, [], [])

  const wallets = useLiveQuery(async () => {
    try {
      return await db.wallets.toArray()
    } catch (err){
      console.warn('[Savings]', err)
      return []
    }
  }, [], [])

  const [sheetOpen, setSheetOpen] = useState(false)
  const openSheet = useCallback(() => setSheetOpen(true), [])
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  const [editingId, setEditingId] = useState(null)
  const [deletingGoal, setDeletingGoal] = useState(null)
  const [liquidationWalletId, setLiquidationWalletId] = useState('')
  const [menuOpenId, setMenuOpenId] = useState(null)
  useBackButton(() => setMenuOpenId(null), Boolean(menuOpenId))
  const { setSwipedId } = useSwipeAction()

  const promptDeleteGoal = useCallback(
    (goal, e) => {
      e?.stopPropagation()
      setMenuOpenId(null)
      setDeletingGoal(goal)
      const defWallet =
        wallets?.find((w) => !w.isArchived && String(w.id) === String(defaultWalletId)) ||
        wallets?.find((w) => !w.isArchived)
      setLiquidationWalletId(defWallet ? String(defWallet.id) : (wallets?.[0]?.id ? String(wallets[0].id) : ''))
    },
    [wallets, defaultWalletId]
  )

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
      const isCompleted = Boolean(g.isCompleted)
      const isArch = isCompleted || Boolean(g.isArchived)
      const target = toSafeNumber(g.targetAmount)
      const current = toSafeNumber(g.currentAmount)
      const pct = isCompleted ? 100 : target > 0 ? clampPercent((current / target) * 100) : 0
      const remaining = isCompleted ? 0 : Math.max(0, target - current)

      let deadlineText = null
      let isOverdue = false
      if (g.deadline && !isArch) {
        const daysLeft = differenceInDays(new Date(g.deadline), new Date())
        if (daysLeft < 0) {
          deadlineText = t('savings.overdue', 'Lewat Tenggat')
          isOverdue = true
        } else if (daysLeft === 0) {
          deadlineText = t('common.today', 'Hari Ini')
        } else {
          deadlineText = t('savings.daysLeft', { count: daysLeft }, `${daysLeft} Hari Lagi`)
        }
      }

      return { ...g, target, current, pct, remaining, deadlineText, isOverdue, isArchived: isArch }
    })
  }, [goals, t])

  const activeGoals = useMemo(
    () => processedGoals.filter((g) => !g.isArchived).sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)),
    [processedGoals]
  )

  const archivedGoals = useMemo(
    () => processedGoals.filter((g) => g.isArchived).sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)),
    [processedGoals]
  )

  const [seenArchivedIds, setSeenArchivedIds] = useState(() => {
    try {
      const stored = localStorage.getItem('fintrack_seen_archived_goal_ids')
      return stored ? JSON.parse(stored) : []
    } catch (err){
      console.warn('[Savings]', err)
      return []
    }
  })

  // Calculate unseen archived count
  const unseenArchivedCount = useMemo(() => {
    return archivedGoals.filter((g) => !seenArchivedIds.includes(String(g.id))).length
  }, [archivedGoals, seenArchivedIds])

  const handleOpenArchive = useCallback(() => {
    if (archivedGoals.length > 0) {
      const allCurrentArchivedIds = archivedGoals.map((g) => String(g.id))
      setSeenArchivedIds((prev) => {
        const merged = Array.from(new Set([...prev, ...allCurrentArchivedIds]))
        try {
          localStorage.setItem('fintrack_seen_archived_goal_ids', JSON.stringify(merged))
        } catch (err){
      console.warn('[Savings]', err)
          // ignore
        }
        return merged
      })
    }
    setSearchParams({ view: 'archive' })
  }, [archivedGoals, setSearchParams])

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
    const remaining = Math.max(0, target - current)
    return { target, current, pct, remaining }
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
        {/* Page Header */}
        <PageHeader
          title={showArchive ? t('savings.archiveTitle', 'Arsip Tabungan') : t('savings.title', 'Target Tabungan')}
          titlePosition="left"
          onBack={handleBack}
          backAriaLabel={t('savings.back', 'Kembali')}
          className="pt-2 mb-0"
          rightAction={
            <div className="flex items-center gap-1.5 shrink-0">
              {!showArchive && (
                <>
                  <button
                    type="button"
                    onClick={handleOpenArchive}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] shadow-xs transition-all active:scale-95 cursor-pointer relative"
                    title={t('savings.openArchive', 'Buka Arsip Tabungan')}
                  >
                    <Archive className="h-4.5 w-4.5" />
                    {unseenArchivedCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[var(--status-income)] text-[9px] font-black text-white shadow-2xs animate-fadeIn">
                        {unseenArchivedCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => openAdd()}
                    className="h-10 px-3.5 rounded-2xl bg-[var(--accent)] text-white font-extrabold text-xs shadow-xs transition hover:opacity-90 active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                    <span>{t('savings.newGoal', 'Target Baru')}</span>
                  </button>
                </>
              )}

              {showArchive && (
                <button
                  type="button"
                  onClick={() => setSearchParams({})}
                  className="h-10 px-3.5 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] text-xs font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  {t('savings.backToActive', 'Kembali ke Aktif')}
                </button>
              )}
            </div>
          }
        />

        {/* Summary Hero Card (Active View Only) */}
        {!showArchive && (
          <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--panel-strong)] p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-3.5 ft-card-sheen">
            {/* Main Metric Section */}
            <div className="relative z-10 space-y-2.5">
              <div className="flex items-center justify-between gap-2 -mt-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                    {t('savings.totalSaved', 'Total Terkumpul')}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums border transition-all ${
                      totals.pct >= 100
                        ? 'bg-[var(--status-income)] text-white border-[var(--status-income)] shadow-xs'
                        : 'bg-[var(--status-income-soft)] text-[var(--status-income)] border-[var(--status-income)]/25'
                    }`}
                  >
                    <CheckCircle2 size={11} className="shrink-0" />
                    <span>{Math.round(totals.pct)}%</span>
                  </span>
                </div>
              </div>

              <div className="flex items-baseline gap-2 pt-0.5 flex-wrap">
                <p className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight text-[var(--fg)]">
                  <AnimatedCounter value={totals.current} currency={defaultCurrency} />
                </p>
                <span className="text-sm sm:text-base font-bold text-[var(--muted-2)] tabular-nums">
                  / <AnimatedCounter value={totals.target} currency={defaultCurrency} />
                </span>
              </div>

              {/* Sub-row: Kurang / Sisa Kekurangan on left, Goals Count on right */}
              <div className="pt-2 border-t border-[var(--border)]/40 flex items-center justify-between text-xs font-bold tabular-nums">
                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--muted)]">{t('savings.remainingShort', 'Kurang')}:</span>
                  <span className="font-black text-[var(--fg)]">
                    {totals.remaining > 0 ? (
                      <AnimatedCounter value={totals.remaining} currency={defaultCurrency} />
                    ) : (
                      t('savings.completed', 'Tercapai')
                    )}
                  </span>
                </div>

                <span className="rounded-full bg-[var(--field-bg)] border border-[var(--border)]/60 px-2.5 py-0.5 text-[10px] font-extrabold text-[var(--muted)] tabular-nums shrink-0">
                  {activeGoals.length} {locale === 'en' ? 'Goals' : 'Target'}
                </span>
              </div>
            </div>

            {/* Bottom Row: Smooth Full-width Progress Bar */}
            <div className="h-3 w-full rounded-full bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] overflow-hidden relative z-10 p-0.5">
              <div
                className="h-full rounded-full bg-[var(--status-income)] transition-all duration-700 ease-out shadow-xs transform-gpu"
                style={{ width: `${Math.min(100, Math.max(totals.pct > 0 ? totals.pct : 0, 0))}%` }}
              />
            </div>
          </div>
        )}

        {/* Goal Cards Section */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              {showArchive
                ? t('savings.archivedListTitle', { count: archivedGoals.length }, `Arsip Selesai (${archivedGoals.length})`)
                : t('savings.activeListTitle', { count: activeGoals.length }, `Daftar Target Tabungan (${activeGoals.length})`)}
            </h3>
          </div>

          {displayedRows.length === 0 ? (
            <EmptyState
              variant="savings"
              title={showArchive ? t('savings.archiveEmptyTitle', 'Belum Ada Tabungan di Arsip') : t('savings.emptyTitle')}
              description={
                showArchive
                  ? t('savings.archiveEmptyDesc', 'Target tabungan yang telah 100% dan dicairkan ke dompet akan disimpan dengan aman di sini.')
                  : t('savings.emptyDesc')
              }
              action={
                !showArchive ? (
                  <button
                    type="button"
                    onClick={() => openAdd()}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[var(--accent)] text-white font-extrabold text-xs shadow-md transition hover:opacity-90 active:scale-95 flex items-center gap-1.5 mx-auto cursor-pointer"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                    {t('savings.newGoal', 'Target Baru')}
                  </button>
                ) : null
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ft-stagger-in">
              {displayedRows.map((g) => {
                const isComplete = g.isArchived

                return (
                  <div
                    key={g.id}
                    onClick={() => navigate(`/savings/${g.id}`)}
                    className="relative overflow-visible rounded-2xl border transition-all duration-200 border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[var(--panel-strong)] shadow-2xs hover:border-[var(--border-strong)] cursor-pointer ft-spring-press"
                  >
                    <div className="relative z-10 p-4 sm:p-5 flex flex-col justify-between h-full space-y-4">
                      {/* Top Part: Icon, Name + Percentage next to name, Amount & 3-dots Menu */}
                      <div>
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
                                isComplete
                                  ? 'bg-[var(--status-income)] text-white border-[var(--status-income)] shadow-xs'
                                  : 'bg-[var(--status-income-soft)] text-[var(--status-income)] border-[var(--status-income)]/25'
                              }`}
                            >
                              <Target className="h-5 w-5" strokeWidth={2.2} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                <h3 className="truncate text-sm font-extrabold text-[var(--fg)]">
                                  {g.name}
                                </h3>
                                <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums bg-[var(--status-income-soft)] text-[var(--status-income)] border border-[var(--status-income)]/25 shrink-0">
                                  {Math.round(g.pct)}%
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs font-bold text-[var(--muted)] tabular-nums">
                                {formatCurrency(g.current, g.currency || defaultCurrency)}{' '}
                                <span className="font-normal text-[var(--muted-2)]">
                                  / {formatCurrency(g.target, g.currency || defaultCurrency)}
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* Star Pin & 3-Dots Menu */}
                          <div className="flex items-center gap-0.5 shrink-0 relative">
                            <button
                              type="button"
                              onClick={(e) => togglePin(g.id, g.isPinned, e)}
                              className={`h-8 w-8 flex items-center justify-center rounded-xl transition-colors active:scale-90 cursor-pointer ${
                                g.isPinned
                                  ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                                  : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)]'
                              }`}
                              title={g.isPinned ? t('savings.unpin', 'Lepas Pin') : t('savings.pin', 'Pin Target')}
                            >
                              <Star className="h-3.5 w-3.5" fill={g.isPinned ? 'currentColor' : 'none'} />
                            </button>

                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setMenuOpenId(menuOpenId === g.id ? null : g.id)
                                }}
                                className="h-8 w-8 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors active:scale-90 cursor-pointer"
                                title={t('savings.options', 'Opsi')}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>

                              {menuOpenId === g.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setMenuOpenId(null)
                                    }}
                                  />
                                  <div className="absolute right-0 top-full mt-1 w-32 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-1 shadow-lg z-50 animate-in fade-in-0 zoom-in-95">
                                    {!isComplete && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          setMenuOpenId(null)
                                          openEdit(g, e)
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] rounded-xl transition-colors cursor-pointer"
                                      >
                                        <Edit2 className="h-3.5 w-3.5 text-[var(--muted)]" />
                                        <span>{t('savings.edit', 'Edit')}</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={(e) => promptDeleteGoal(g, e)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-[var(--status-expense)] hover:bg-[var(--status-expense-soft)] rounded-xl transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      <span>{t('savings.delete', 'Hapus')}</span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3.5 h-2 w-full rounded-full bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--status-income)] transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, g.pct))}%` }}
                          />
                        </div>

                        {/* Bottom Status Row */}
                        <div className="mt-2 flex items-center justify-between text-[11px] font-bold">
                          <span className="text-[var(--muted)]">
                            {isComplete
                              ? t('savings.completedAndCashed', 'Selesai & Dicairkan')
                              : g.deadlineText
                              ? g.deadlineText
                              : t('savings.remainingShort', 'Sisa kekurangan')}
                          </span>
                          <span className="text-[var(--fg)] font-extrabold">
                            {isComplete
                              ? '100%'
                              : formatCurrency(g.remaining, g.currency || defaultCurrency)}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons: Setor, Tarik, Reopen */}
                      <div className="pt-2.5 border-t border-[var(--border)]/50 flex items-center justify-between gap-2">
                        {!isComplete ? (
                          <div className="flex items-center gap-2 w-full">
                            <button
                              type="button"
                              onClick={(e) => openFundModal(g, 'add', e)}
                              className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold bg-[var(--status-income-soft)] text-[var(--status-income)] border border-[var(--status-income)]/25 hover:bg-[var(--status-income)]/20 active:scale-95 transition flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" strokeWidth={2.8} />
                              <span>{t('savings.deposit', 'Setor')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => openFundModal(g, 'withdraw', e)}
                              className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold bg-[var(--field-bg)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--panel-strong)] active:scale-95 transition flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Minus className="h-3.5 w-3.5" strokeWidth={2.8} />
                              <span>{t('savings.withdraw', 'Tarik')}</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => toggleArchiveStatus(g.id, true, e)}
                            className="w-full py-1.5 px-3 rounded-xl text-xs font-bold bg-[var(--field-bg)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--panel-strong)] active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>{t('savings.reopen', 'Aktifkan Kembali')}</span>
                          </button>
                        )}
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
            navigate(`/savings/${completedGoal.id}`, { state: { celebrate: true } })
          }
        }}
      />

      <ConfirmDeleteModal
        isOpen={!!deletingGoal}
        onClose={() => setDeletingGoal(null)}
        onConfirm={async () => {
          if (deletingGoal) {
            const currentAmt = toSafeNumber(deletingGoal.currentAmount)
            const targetWalletIdNum = liquidationWalletId ? Number(liquidationWalletId) : null

            await db.transaction('rw', db.goals, db.goalLogs, db.transactions, async () => {
              if (currentAmt > 0 && targetWalletIdNum) {
                const now = new Date()
                const targetWallet = wallets?.find((w) => Number(w.id) === targetWalletIdNum)
                const walletName = targetWallet?.name || 'Dompet'
                const targetCurrency = targetWallet?.currency || deletingGoal.currency || defaultCurrency
                const effectiveAmount = roundCurrency(
                  targetCurrency !== (deletingGoal.currency || defaultCurrency)
                    ? convertCurrency(currentAmt, deletingGoal.currency || defaultCurrency, targetCurrency, rates)
                    : currentAmt
                )

                await db.transactions.add({
                  date: format(now, 'yyyy-MM-dd'),
                  amount: effectiveAmount,
                  type: 'income',
                  category: 'cairkan_tabungan',
                  notes: `Pencairan Tabungan: ${deletingGoal.name} ke ${walletName}`,
                  currency: targetCurrency,
                  walletId: targetWalletIdNum,
                  goalId: deletingGoal.id,
                  createdAt: Date.now(),
                  deletedAt: null,
                  isExcludeAnalyticsTx: true,
                  isExcludeFromAnalytics: true,
                  excludeFromAnalytics: true,
                })
              }
              await db.goals.delete(deletingGoal.id)
              const logsToDelete = await db.goalLogs
                .filter((l) => String(l.goalId) === String(deletingGoal.id))
                .toArray()
              if (logsToDelete.length > 0) {
                await db.goalLogs.bulkDelete(logsToDelete.map((l) => l.id))
              }
              await db.transactions
                .filter((tx) => String(tx.goalId) === String(deletingGoal.id))
                .modify({ goalId: null })
            })

            if (currentAmt > 0 && targetWalletIdNum) {
              await invalidateWalletBalance([targetWalletIdNum])
            }
            setDeletingGoal(null)
          }
        }}
        title={t('savings.delete', 'Hapus')}
        message={t('savings.deleteConfirm', 'Hapus tujuan tabungan ini?')}
      >
        {toSafeNumber(deletingGoal?.currentAmount) > 0 && (
          <div className="space-y-2 p-3 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-xs">
            <div className="flex items-center justify-between font-bold text-[var(--fg)]">
              <span>{t('savings.savedFunds', 'Dana Tersimpan')}:</span>
              <span className="text-[var(--status-income)] font-extrabold">
                {formatCurrency(deletingGoal.currentAmount, deletingGoal.currency || defaultCurrency)}
              </span>
            </div>
            <div className="space-y-1 pt-1">
              <label className="text-[11px] font-medium text-[var(--muted)]">
                {t('savings.returnFundsToWallet', 'Kembalikan dana tersimpan ke dompet:')}
              </label>
              <select
                value={liquidationWalletId}
                onChange={(e) => setLiquidationWalletId(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--panel-strong)] text-[var(--fg)] border border-[var(--border)] rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-[var(--primary)] cursor-pointer"
              >
                {wallets
                  ?.filter((w) => !w.isArchived)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatCurrency(w.balance || 0, w.currency || defaultCurrency)})
                    </option>
                  ))}
                <option value="">{t('savings.doNotReturnFunds', '-- Jangan kembalikan dana (hapus saja) --')}</option>
              </select>
            </div>
          </div>
        )}
      </ConfirmDeleteModal>
    </div>
  )
}

export default Savings


