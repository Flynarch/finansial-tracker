import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { invalidateWalletBalance } from '../lib/balanceEngine'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import useBackButton from '../hooks/useBackButton'
import Modal from '../components/ui/Modal'
import BottomSheet from '../components/ui/BottomSheet'
import EmptyState from '../components/ui/EmptyState'
import CustomDatePicker from '../components/ui/CustomDatePicker'
import WalletSelectModal, { WalletSelectTrigger } from '../components/ui/WalletSelectModal'
import PageHeader from '../components/ui/PageHeader'
import {
  clampPercent,
  formatCurrency,
  formatMoneyInput,
  getMoneyInputCaret,
  parseMoneyInput,
  roundCurrency,
  toSafeNumber,
  safeFormatDate,
} from '../lib/utils'
import {
  Plus,
  Minus,
  History,
  Sparkles,
  Lightbulb,
  Clock,
  CheckCircle2,
  AlertCircle,
  Target,
  Wallet,
  Calendar,
  FileText,
  Check,
  Star,
  Trophy,
  ArrowUpRight,
  PartyPopper,
} from 'lucide-react'
import { format, differenceInDays, differenceInMonths } from 'date-fns'
import { getSavingsPrediction } from '../lib/gemini'

export default function SavingsDetail() {
  const { id } = useParams()
  const goalId = Number(id)
  const navigate = useNavigate()
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const profileName = useSettingsStore((state) => state.profileName)

  const goal = useLiveQuery(async () => {
    if (!goalId || Number.isNaN(goalId)) return null
    try {
      const item = await db.goals.get(goalId)
      if (item) return item
      const all = await db.goals.toArray()
      return all.find((g) => String(g.id) === String(goalId)) || null
    } catch (err){
      console.warn('[SavingsDetail]', err)
      return null
    }
  }, [goalId])

  const logs = useLiveQuery(async () => {
    if (!goalId || Number.isNaN(goalId)) return []
    try {
      const data = await db.goalLogs.where('goalId').equals(goalId).toArray()
      return (data || []).sort((a, b) => String(b.date).localeCompare(String(a.date)))
    } catch (err){
      console.warn('[SavingsDetail]', err)
      return []
    }
  }, [goalId])

  const [sheetOpen, setSheetOpen] = useState(false)
  const openSheet = useCallback(() => setSheetOpen(true), [])
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  const [amountInput, setAmountInput] = useState('')
  const [dateInput, setDateInput] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [notesInput, setNotesInput] = useState('')
  const inputRef = useRef(null)

  const [aiPrediction, setAiPrediction] = useState(null)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [walletModalOpen, setWalletModalOpen] = useState(false)

  // Cashout Modal State
  const [isCashoutSheetOpen, setIsCashoutSheetOpen] = useState(false)
  const [cashoutWalletId, setCashoutWalletId] = useState('')
  const [cashoutWalletModalOpen, setCashoutWalletModalOpen] = useState(false)
  const [isCelebrationModalOpen, setIsCelebrationModalOpen] = useState(false)

  useBackButton(() => setIsCelebrationModalOpen(false), Boolean(isCelebrationModalOpen))
  useBackButton(() => setCashoutWalletModalOpen(false), Boolean(cashoutWalletModalOpen))
  useBackButton(() => setWalletModalOpen(false), Boolean(walletModalOpen))
  useBackButton(() => setIsCashoutSheetOpen(false), Boolean(isCashoutSheetOpen))
  useBackButton(() => setIsAiModalOpen(false), Boolean(isAiModalOpen))

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const wallets = useLiveQuery(async () => {
    try {
      return await db.wallets.toArray()
    } catch (err){
      console.warn('[SavingsDetail]', err)
      return []
    }
  }, [], [])
  const [selectedWalletId, setSelectedWalletId] = useState('')
  const selectedWallet = useMemo(
    () => (wallets || []).find((w) => String(w.id) === String(selectedWalletId)),
    [wallets, selectedWalletId]
  )

  const selectedCashoutWallet = useMemo(
    () => (wallets || []).find((w) => String(w.id) === String(cashoutWalletId)),
    [wallets, cashoutWalletId]
  )

  const [fundActionType, setFundActionType] = useState('add') // 'add' | 'withdraw'

  const togglePin = async () => {
    if (!goal) return
    await db.goals.update(goalId, { isPinned: !goal.isPinned })
  }

  const handleFundTransaction = async () => {
    const targetCurrency = goal?.currency || defaultCurrency
    const val = parseMoneyInput(amountInput, targetCurrency)
    if (val <= 0) return

    const isWithdraw = fundActionType === 'withdraw'
    const currentGoalAmt = Number(goal?.currentAmount || 0)
    const newGoalAmount = isWithdraw
      ? Math.max(0, currentGoalAmt - val)
      : currentGoalAmt + val

    const now = new Date()
    const selectedDate = new Date(`${dateInput}T00:00:00`)
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds())
    const formattedDate = format(selectedDate, 'yyyy-MM-dd HH:mm:ss')
    const walletIdNum = Number(selectedWalletId)

    await db.transaction('rw', [db.goals, db.goalLogs, db.transactions, db.wallets], async () => {
      await db.goals.update(goalId, { currentAmount: newGoalAmount })

      let walletObj = null
      if (walletIdNum) {
        walletObj = await db.wallets.get(walletIdNum)
      }

      let createdTxId = null
      if (walletIdNum) {
        createdTxId = await db.transactions.add({
          date: dateInput,
          amount: roundCurrency(val),
          type: isWithdraw ? 'income' : 'expense',
          category: isWithdraw ? 'cairkan_tabungan' : 'tabungan',
          notes: notesInput.trim() || `${isWithdraw ? 'Tarik dari' : 'Setor ke'} Tabungan: ${goal.name}`,
          currency: goal.currency || defaultCurrency,
          walletId: walletIdNum,
          goalId: goal.id,
          createdAt: Date.now(),
          deletedAt: null,
          isExcludeAnalyticsTx: true,
          isExcludeFromAnalytics: true,
          excludeFromAnalytics: true,
        })
      }

      const logPayload = {
        goalId,
        amount: isWithdraw ? -val : val,
        notes: notesInput.trim() || (isWithdraw ? 'Penarikan Tabungan' : 'Setoran Tabungan'),
        date: formattedDate,
        transactionId: createdTxId || null,
      }
      if (walletObj) {
        logPayload.walletName = walletObj.name
      }
      await db.goalLogs.add(logPayload)
    })

    if (walletIdNum) {
      await invalidateWalletBalance([walletIdNum])
    }

    const targetAmt = Number(goal?.targetAmount || 0)
    const isTargetAchieved = !isWithdraw && targetAmt > 0 && newGoalAmount >= targetAmt

    closeSheet()

    if (isTargetAchieved) {
      window.setTimeout(() => {
        setIsCelebrationModalOpen(true)
      }, 150)
    }
  }

  // Handle Cairkan ke Dompet (Cashout all savings balance to selected wallet)
  const handleCashoutToWallet = async () => {
    const walletIdNum = Number(cashoutWalletId)
    if (!walletIdNum) return
    const walletObj = await db.wallets.get(walletIdNum)
    if (!walletObj) return

    const cashoutAmount = Number(goal.currentAmount || 0)

    const now = new Date()
    const formattedDate = format(now, 'yyyy-MM-dd HH:mm:ss')

    await db.transaction('rw', [db.goals, db.transactions, db.goalLogs, db.wallets], async () => {
      // 1. Update Goal
      await db.goals.update(goalId, {
        currentAmount: 0,
        isCompleted: true,
        status: 'completed',
      })

      // 2. Add Income Transaction to Wallet
      const cashoutTxId = await db.transactions.add({
        date: format(now, 'yyyy-MM-dd'),
        amount: roundCurrency(cashoutAmount),
        type: 'income',
        category: 'cairkan_tabungan',
        notes: `Pencairan Tabungan: ${goal.name} ke ${walletObj.name}`,
        currency: goal.currency || defaultCurrency,
        walletId: walletIdNum,
        goalId: Number(goalId),
        createdAt: Date.now(),
        deletedAt: null,
        isExcludeAnalyticsTx: true,
        isExcludeFromAnalytics: true,
        excludeFromAnalytics: true,
      })

      // 3. Add Log Entry
      await db.goalLogs.add({
        goalId,
        amount: -cashoutAmount,
        notes: `Pencairan Tabungan ke ${walletObj.name}`,
        date: formattedDate,
        walletName: walletObj.name,
        transactionId: cashoutTxId || null,
      })
    })

    await invalidateWalletBalance([walletIdNum])

    setIsCashoutSheetOpen(false)
    setIsCelebrationModalOpen(false)
    navigate('/savings?view=archive')
  }

  const handleGetPrediction = async () => {
    setIsAiLoading(true)
    setIsAiModalOpen(true)
    setAiPrediction(null)

    try {
      let avgSavings = 0
      if (logs && logs.length > 0) {
        const rawDate = new Date(logs[logs.length - 1].date)
        const validFirstDate = isNaN(rawDate.getTime()) ? new Date() : rawDate
        const monthsDiff = Math.max(1, differenceInMonths(new Date(), validFirstDate))
        const totalSaved = logs.reduce((acc, log) => acc + (log.amount || 0), 0)
        avgSavings = Math.round(totalSaved / monthsDiff)
      }

      const predictionRaw = await getSavingsPrediction(
        {
          name: goal.name,
          currentAmount: goal.currentAmount,
          targetAmount: goal.targetAmount,
          deadline: goal.deadline,
          avgSavings,
        },
        { locale, profileName }
      )

      try {
        const cleanJson = predictionRaw.replace(/```json/g, '').replace(/```/g, '').trim()
        setAiPrediction(JSON.parse(cleanJson))
      } catch (err){
      console.warn('[SavingsDetail]', err)
        setAiPrediction({ error: true, text: predictionRaw || t('savings.aiError', 'Gagal memproses prediksi AI.') })
      }
    } catch (error) {
      console.warn('[SavingsDetail]', error)
      setAiPrediction({ error: true, text: error.message || t('savings.aiError', 'Gagal mendapatkan prediksi AI.') })
    } finally {
      setIsAiLoading(false)
    }
  }

  // Group logs by month
  const groupedLogs = useMemo(() => {
    if (!logs || logs.length === 0) return []
    const map = new Map()

    logs.forEach((log) => {
      let monthKey
      try {
        monthKey = format(new Date(log.date), 'MMMM yyyy').toUpperCase()
      } catch (err){
      console.warn('[SavingsDetail]', err)
        monthKey = 'LAINNYA'
      }

      if (!map.has(monthKey)) {
        map.set(monthKey, [])
      }
      map.get(monthKey).push(log)
    })

    return Array.from(map.entries()).map(([monthName, items]) => ({
      monthName,
      items,
    }))
  }, [logs])

  if (goal === undefined) return <div className="min-h-screen bg-[var(--bg)]" />
  if (goal === null) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <p className="text-[var(--muted)] font-bold">{t('savings.notFound', 'Target tabungan tidak ditemukan')}</p>
      </div>
    )
  }

  const isComplete = goal.isCompleted || goal.isArchived
  const target = toSafeNumber(goal.targetAmount)
  const rawCurrent = toSafeNumber(goal.currentAmount)
  const current = isComplete ? target : rawCurrent
  const pct = isComplete ? 100 : target > 0 ? clampPercent((current / target) * 100) : 0
  const remaining = isComplete ? 0 : Math.max(0, target - current)
  const isTargetComplete = pct >= 100 || isComplete

  let deadlineText = t('savings.noDeadline', 'Tanpa batas waktu')
  let daysLeft = null
  let isOverdue = false
  if (goal.deadline) {
    try {
      const dObj = new Date(goal.deadline)
      if (!isNaN(dObj.getTime())) {
        daysLeft = differenceInDays(dObj, new Date())
        if (daysLeft < 0) {
          deadlineText = t('savings.overdue', 'Lewat Tenggat')
          isOverdue = true
        } else if (daysLeft === 0) {
          deadlineText = t('savings.dueToday', 'Jatuh Tempo Hari Ini')
        } else {
          deadlineText = t('savings.daysLeft', { count: daysLeft }, `${daysLeft} Hari Lagi`)
        }
      }
    } catch (err){
      console.warn('[SavingsDetail]', err)
      daysLeft = null
    }
  }

  const currency = goal.currency || defaultCurrency

  return (
    <div className="ft-page-enter min-h-[100dvh] bg-[var(--bg)] pb-28">
      {/* ── Top Header ── */}
      <div className="pt-[calc(0.75rem+env(safe-area-inset-top))] px-3.5 sm:px-5">
        <div className="mx-auto max-w-3xl pt-2">
          <PageHeader
            titlePosition="left"
            title={goal.name}
            backAriaLabel={t('common.back', 'Kembali')}
            onBack={() => navigate(-1)}
            subtitle={
              <span className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[var(--muted)]">
                  {goal.deadline ? `${t('savings.targetDatePrefix', 'Target')}: ${safeFormatDate(goal.deadline, 'dd MMM yyyy')}` : t('savings.noDeadline', 'Tanpa batas waktu')}
                </span>
                {daysLeft !== null && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border ${
                      isOverdue
                        ? 'bg-[var(--earthy-terra-soft)] text-[var(--earthy-terra)] border-[var(--earthy-terra)]/25'
                        : 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)]'
                    }`}
                  >
                    <Clock className="h-2.5 w-2.5" />
                    {deadlineText}
                  </span>
                )}
              </span>
            }
            rightAction={
              <button
                type="button"
                onClick={togglePin}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors cursor-pointer active:scale-95 ${
                  goal.isPinned
                    ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                    : 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--fg)]'
                }`}
                title={goal.isPinned ? t('savings.unpin', 'Lepas Pin') : t('savings.pin', 'Pin Target')}
                aria-label={goal.isPinned ? t('savings.unpin', 'Lepas Pin') : t('savings.pin', 'Pin Target')}
              >
                <Star className="h-4 w-4" fill={goal.isPinned ? 'currentColor' : 'none'} />
              </button>
            }
          />
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 px-3.5 pt-1 sm:px-5 ft-stagger-in">
        {/* ── CELEBRATION BANNER (If 100% or Completed) ── */}
        {isTargetComplete && (
          <div className="rounded-3xl border border-[var(--earthy-green)]/40 bg-[var(--earthy-green-soft)] p-4 text-[var(--earthy-green)] shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--earthy-green)] text-white shadow-xs">
                <PartyPopper className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black uppercase tracking-wider">
                  {goal.isCompleted ? t('savings.completedAndCashed', 'Tabungan Selesai & Dicairkan') : t('savings.goalReached', 'Target 100% Tercapai!')}
                </h3>
                <p className="mt-0.5 text-xs font-medium opacity-90 leading-relaxed">
                  {goal.isCompleted
                    ? t('savings.cashedDesc', 'Target ini telah sukses dicairkan ke saldo dompet pilihanmu.')
                    : t('savings.reachedDesc', 'Selamat! Seluruh nominal target telah terkumpul. Kamu bisa mencairkan dana ini ke dompetmu.')}
                </p>
              </div>
            </div>

            {!goal.isCompleted && (
              <button
                type="button"
                onClick={() => setIsCashoutSheetOpen(true)}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[var(--earthy-green)] text-white py-3 px-4 text-xs font-black shadow-md hover:bg-[var(--earthy-green-dark)] transition active:scale-[0.98] cursor-pointer uppercase tracking-wider"
              >
                <ArrowUpRight className="h-4 w-4" strokeWidth={3} />
                {t('savings.cashoutAction', 'Cairkan ke Dompet Saya')}
              </button>
            )}
          </div>
        )}

        {/* ── Spacious & Aesthetic Hero Card ── */}
        <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--panel-strong)] p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-4">
          <div className="relative z-10 space-y-3">
            {/* Top Row: Title + % badge */}
            <div className="flex items-center justify-between gap-2 -mt-0.5">
              <span className="text-xs font-black uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                <Target className="h-4 w-4 text-[var(--earthy-green)]" />
                {t('savings.collectedSavings', 'Saldo Tabungan Terkumpul')}
              </span>
              <span className="rounded-full bg-[var(--earthy-green-soft)] border border-[var(--earthy-green)]/25 px-2.5 py-0.5 text-xs font-black text-[var(--earthy-green)] tabular-nums shadow-2xs">
                {Math.round(pct)}%
              </span>
            </div>

            {/* Middle Row: Inline Big Amount + Target */}
            <div className="flex items-baseline gap-2 pt-0.5 flex-wrap">
              <p className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight text-[var(--fg)]">
                {formatCurrency(current, currency)}
              </p>
              <span className="text-sm sm:text-base font-bold text-[var(--muted-2)] tabular-nums">
                / {formatCurrency(target, currency)}
              </span>
            </div>

            {/* Sub-row with clean divider */}
            <div className="pt-2 border-t border-[var(--border)]/40 flex items-center justify-between text-xs font-bold tabular-nums">
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--muted)]">{t('savings.remainingShort', 'Sisa')}:</span>
                <span className="font-black text-[var(--fg)]">{formatCurrency(remaining, currency)}</span>
              </div>
              <span className="text-[var(--earthy-green)] font-black">
                {Math.round(pct)}% {t('savings.reached', 'Tercapai')}
              </span>
            </div>
          </div>

          {/* Clean Progress Bar */}
          <div className="relative z-10 pt-1">
            <div className="h-2.5 w-full rounded-full bg-[var(--field-bg)] border border-[var(--border)]/40 overflow-hidden relative">
              <div
                className="h-full rounded-full bg-[var(--earthy-green)] transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Dual Action Buttons: Setor & Tarik (Clean & Modern Style) ── */}
        {!goal.isCompleted && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setFundActionType('add')
                setAmountInput('')
                setDateInput(format(new Date(), 'yyyy-MM-dd'))
                setNotesInput('')
                openSheet()
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--status-income)]/30 bg-[var(--status-income-soft)] py-2.5 px-4 text-xs font-black text-[var(--status-income)] hover:bg-[var(--status-income)]/20 transition active:scale-95 cursor-pointer shadow-2xs"
            >
              <Plus className="h-4 w-4" strokeWidth={2.8} />
              <span>{t('savings.deposit', 'Setor')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFundActionType('withdraw')
                setAmountInput('')
                setDateInput(format(new Date(), 'yyyy-MM-dd'))
                setNotesInput('')
                openSheet()
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2.5 px-4 text-xs font-black text-[var(--fg)] hover:bg-[var(--panel-strong)] transition active:scale-95 cursor-pointer shadow-2xs"
            >
              <Minus className="h-4 w-4" strokeWidth={2.8} />
              <span>{t('savings.withdraw', 'Tarik')}</span>
            </button>
          </div>
        )}

        {/* ── Compact AI Coach Button ── */}
        <button
          type="button"
          onClick={handleGetPrediction}
          className="w-full rounded-2xl border border-[color-mix(in_srgb,var(--accent)_30%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_6%,var(--panel-strong))] py-3 px-4 text-xs font-black text-[var(--accent)] hover:bg-[var(--accent)]/15 transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
        >
          <Sparkles className="h-4 w-4" />
          {t('savings.askAiTips', 'Tanya Prediksi AI & Tips Akselerasi')}
        </button>

        {/* ── History Section (Grouped Timeline) ── */}
        <div className="pt-2 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--muted)]">
                <History className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                {t('savings.historyTitle', 'Riwayat Transaksi Tabungan')} ({logs?.length || 0})
              </h3>
            </div>
          </div>

          {!logs || logs.length === 0 ? (
            <EmptyState
              title={t('savings.emptyLogsTitle', 'Belum Ada Riwayat')}
              description={t('savings.emptyLogsDesc', 'Tekan "Setor" untuk mulai menabung ke pos tabungan ini.')}
            />
          ) : (
            <div className="space-y-4">
              {groupedLogs.map((group) => (
                <div key={group.monthName} className="space-y-2">
                  <div className="px-1 pb-1 border-b border-[var(--border)]/40 flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                      {group.monthName}
                    </span>
                    <span className="text-[9.5px] font-bold text-[var(--muted)] tabular-nums">
                      {t('savings.notesCount', '{{count}} catatan', { count: group.items.length })}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {group.items.map((log) => {
                      const isWithdraw = (log.amount || 0) < 0
                      const absAmount = Math.abs(log.amount || 0)
                      const logDateStr = (() => {
                        try {
                          return format(new Date(log.date), 'dd MMM yyyy, HH:mm')
                        } catch (err){
      console.warn('[SavingsDetail]', err)
                          return String(log.date || '')
                        }
                      })()

                      return (
                        <div
                          key={log.id}
                          className="bg-[var(--panel-strong)] rounded-2xl p-3.5 border border-[var(--border)] flex items-center justify-between shadow-2xs hover:border-[var(--border-strong)] transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border ${
                                isWithdraw
                                  ? 'bg-[var(--earthy-terra-soft)] text-[var(--earthy-terra)] border-[var(--earthy-terra)]/25'
                                  : 'bg-[var(--earthy-green-soft)] text-[var(--earthy-green)] border-[var(--earthy-green)]/25'
                              }`}
                            >
                              {isWithdraw ? <Minus size={18} strokeWidth={3} /> : <Plus size={18} strokeWidth={3} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-black text-[var(--fg)] truncate">
                                  {isWithdraw ? t('savings.withdrawType', 'Penarikan Tabungan') : t('savings.depositType', 'Setoran Tabungan')}
                                </p>
                                {log.walletName && (
                                  <span className="rounded-md bg-[var(--field-bg)] px-1.5 py-0.5 text-[9px] font-extrabold text-[var(--muted)] border border-[var(--border)] truncate">
                                    {log.walletName}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] font-semibold text-[var(--muted)] mt-0.5">{logDateStr}</p>
                              {log.notes && (
                                <p className="text-xs font-semibold text-[var(--fg)] mt-0.5 opacity-80 break-words leading-tight">
                                  {log.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={`font-black text-xs tabular-nums shrink-0 ml-2 ${
                              isWithdraw ? 'text-[var(--earthy-terra)]' : 'text-[var(--earthy-green)]'
                            }`}
                          >
                            {isWithdraw ? '-' : '+'}{formatCurrency(absAmount, currency)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Add/Withdraw Funds Bottom Sheet ── */}
      <BottomSheet isOpen={sheetOpen} onClose={closeSheet} showCloseButton={false}>
        <div className="space-y-4 pt-1">
          {/* Tab Setor vs Tarik (Animated Sliding Segment) */}
          <div className="relative grid grid-cols-2 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-1 select-none overflow-hidden">
            {/* Sliding Pill Indicator */}
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl transition-all duration-300 ease-out shadow-sm ${
                fundActionType === 'withdraw'
                  ? 'left-[calc(50%+2px)] bg-[var(--earthy-terra)]'
                  : 'left-1 bg-[var(--earthy-green)]'
              }`}
            />

            <button
              type="button"
              onClick={() => setFundActionType('add')}
              className={`relative z-10 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition-colors duration-200 cursor-pointer ${
                fundActionType === 'add'
                  ? 'text-white'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              <Plus size={14} strokeWidth={3} />
              {t('savings.deposit', 'Setor')}
            </button>
            <button
              type="button"
              onClick={() => setFundActionType('withdraw')}
              className={`relative z-10 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition-colors duration-200 cursor-pointer ${
                fundActionType === 'withdraw'
                  ? 'text-white'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              <Minus size={14} strokeWidth={3} />
              {t('savings.withdraw', 'Tarik')}
            </button>
          </div>

          {/* Amount Input with Subtle Dynamic Glowlight */}
          <div
            className={`relative rounded-2xl border p-4 text-center transition-all duration-300 ${
              fundActionType === 'withdraw'
                ? 'border-rose-500/40 bg-[color-mix(in_srgb,var(--earthy-terra)_6%,var(--field-bg))] shadow-[0_0_20px_-4px_rgba(244,63,94,0.22)]'
                : 'border-emerald-500/40 bg-[color-mix(in_srgb,var(--earthy-green)_6%,var(--field-bg))] shadow-[0_0_20px_-4px_rgba(16,185,129,0.22)]'
            }`}
          >
            <p
              className={`text-[10px] font-extrabold uppercase tracking-wider mb-1 transition-colors duration-300 ${
                fundActionType === 'withdraw' ? 'text-[var(--earthy-terra)]' : 'text-[var(--earthy-green)]'
              }`}
            >
              {fundActionType === 'withdraw' ? t('savings.withdrawAmount', 'Jumlah Penarikan') : t('savings.depositAmount', 'Jumlah Setoran')}
            </p>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              className="w-full bg-transparent text-center text-3xl font-black text-[var(--fg)] outline-none placeholder:text-[var(--muted)]/30 tabular-nums"
              placeholder="0"
              value={amountInput}
              onChange={(e) => {
                const selStart = e.target.selectionStart
                const newVal = formatMoneyInput(e.target.value, currency)
                setAmountInput(newVal)
                window.requestAnimationFrame(() => {
                  if (inputRef.current) {
                    const newPos = getMoneyInputCaret(e.target.value, newVal, selStart ?? e.target.value.length, currency)
                    inputRef.current.setSelectionRange(newPos, newPos)
                  }
                })
              }}
            />
          </div>

          {/* Wallet Select (Integrasi Transaksi) */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5 mb-1">
              <Wallet className="h-3.5 w-3.5 text-[var(--accent)]" />
              {fundActionType === 'withdraw' ? 'Masuk ke Dompet (Opsional)' : 'Sumber Dompet (Opsional)'}
            </label>
            <WalletSelectTrigger
              wallet={selectedWallet}
              placeholder={t('savings.noWalletDeduct', 'Tanpa Potong Dompet (Manual Log)')}
              onClick={() => setWalletModalOpen(true)}
            />
            <WalletSelectModal
              isOpen={walletModalOpen}
              onClose={() => setWalletModalOpen(false)}
              wallets={wallets}
              selectedWalletId={selectedWalletId}
              onSelectWallet={(id) => setSelectedWalletId(id)}
              allowNone
              noneLabel={t('savings.noWalletDeduct', 'Tanpa Potong Dompet (Manual Log)')}
              title={fundActionType === 'withdraw' ? t('savings.selectTargetWallet', 'Pilih Dompet Tujuan') : t('savings.selectSourceWallet', 'Pilih Sumber Dompet')}
            />
          </div>

          {/* Date Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5 mb-1">
              <Calendar className="h-3.5 w-3.5 text-[var(--accent)]" />
              {t('savings.txDate', 'Tanggal Transaksi')}
            </label>
            <CustomDatePicker
              value={dateInput}
              onChange={(val) => setDateInput(val)}
              title={t('savings.selectTxDate', 'Pilih Tanggal Tabungan')}
            />
          </div>

          {/* Notes Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5 mb-1">
              <FileText className="h-3.5 w-3.5 text-[var(--accent)]" />
              {t('savings.notesOptional', 'Catatan (Opsional)')}
            </label>
            <input
              type="text"
              placeholder={fundActionType === 'withdraw' ? t('savings.withdrawPlaceholder', 'Misal: Keperluan mendadak') : t('savings.depositPlaceholder', 'Misal: Uang sisa jajan')}
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-3 text-xs font-bold text-[var(--fg)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--muted)]/50"
            />
          </div>

          {/* Submit Button */}
          <button
            type="button"
            className={`w-full py-3.5 rounded-2xl font-black text-xs text-white shadow-md transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
              fundActionType === 'withdraw'
                ? 'bg-[var(--earthy-terra)] hover:bg-[var(--earthy-terra-dark)]'
                : 'bg-[var(--earthy-green)] hover:bg-[var(--earthy-green-dark)]'
            }`}
            disabled={!amountInput || parseMoneyInput(amountInput) <= 0}
            onClick={handleFundTransaction}
          >
            <Check className="h-4 w-4" />
            {fundActionType === 'withdraw' ? t('savings.saveWithdraw', 'Simpan Penarikan') : t('savings.saveDeposit', 'Simpan Setoran')}
          </button>
        </div>
      </BottomSheet>

      {/* ── Cashout Bottom Sheet ── */}
      <BottomSheet isOpen={isCashoutSheetOpen} onClose={() => setIsCashoutSheetOpen(false)} showCloseButton={false}>
        <div className="space-y-4 pt-1">
          <div className="text-center space-y-1">
            <h3 className="text-base font-black text-[var(--fg)]">{t('savings.cashoutTitle', 'Cairkan Tabungan ke Dompet')}</h3>
            <p className="text-xs font-medium text-[var(--muted)]">
              {t('savings.cashoutDesc', { amount: formatCurrency(current, currency) }, `Seluruh saldo sebesar ${formatCurrency(current, currency)} akan ditransfer ke dompet pilihanmu.`)}
            </p>
          </div>

          {/* Wallet Select */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5 mb-1">
              <Wallet className="h-3.5 w-3.5 text-[var(--earthy-green)]" />
              {t('savings.selectDisbursementWallet', 'Pilih Dompet Tujuan Pencairan')}
            </label>
            <WalletSelectTrigger
              wallet={selectedCashoutWallet}
              placeholder={t('savings.selectTargetWallet', 'Pilih Dompet Tujuan')}
              onClick={() => setCashoutWalletModalOpen(true)}
            />
            <WalletSelectModal
              isOpen={cashoutWalletModalOpen}
              onClose={() => setCashoutWalletModalOpen(false)}
              wallets={wallets}
              selectedWalletId={cashoutWalletId}
              onSelectWallet={(id) => setCashoutWalletId(id)}
              allowNone={false}
              title={t('savings.selectDisbursementWallet', 'Pilih Dompet Tujuan Pencairan')}
            />
          </div>

          <button
            type="button"
            className="w-full py-3.5 rounded-2xl font-black text-xs text-white bg-[var(--earthy-green)] hover:bg-[var(--earthy-green-dark)] shadow-md transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none uppercase tracking-wider"
            disabled={!cashoutWalletId}
            onClick={handleCashoutToWallet}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
            {t('savings.confirmCashout', 'Konfirmasi Pencairan Dana')}
          </button>
        </div>
      </BottomSheet>

      {/* ── Celebration Certificate Modal ── */}
      <Modal
        isOpen={isCelebrationModalOpen}
        onClose={() => setIsCelebrationModalOpen(false)}
        maxWidth="max-w-sm"
        showHeader={false}
      >
        <div className="p-6 text-center space-y-4">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[var(--earthy-green-soft)] border border-[var(--earthy-green)]/30 text-[var(--earthy-green)] shadow-sm">
            <Trophy className="h-8 w-8 animate-bounce" />
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--earthy-green)]">
              {t('savings.congratsGoalReached', 'Selamat! Target 100% Tercapai')}
            </span>
            <h3 className="text-xl font-black text-[var(--fg)] mt-1">{goal.name}</h3>
            <p className="mt-1 text-2xl font-black text-[var(--earthy-green)] tabular-nums">
              {formatCurrency(goal.targetAmount, currency)}
            </p>
            <p className="mt-2 text-xs font-semibold text-[var(--muted)] leading-relaxed">
              {t('savings.celebrationDesc', 'Kamu telah berhasil menabung seluruh target nominal! Pilih bagaimana kamu ingin menyimpan pencapaian ini:')}
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsCelebrationModalOpen(false)
                setCashoutWalletId('')
                setIsCashoutSheetOpen(true)
              }}
              className="w-full py-3.5 rounded-2xl font-black text-xs text-white bg-[var(--earthy-green)] hover:bg-[var(--earthy-green-dark)] shadow-md transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              <Wallet className="h-4 w-4" />
              {t('savings.disburseToWallet', 'Cairkan Dana ke Dompet')}
            </button>

            <button
              type="button"
              onClick={async () => {
                await db.goals.update(goal.id, { isCompleted: true, isArchived: true })
                setIsCelebrationModalOpen(false)
                navigate('/savings?view=archive')
              }}
              className="w-full py-3 rounded-2xl font-extrabold text-xs text-[var(--fg)] bg-[var(--field-bg)] border border-[var(--border)] hover:bg-[var(--panel)] transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="h-4 w-4 text-[var(--earthy-green)]" />
              {t('savings.markCompletedAndArchive', 'Tandai Selesai & Masukkan Arsip')}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── AI Prediction Bottom Sheet ── */}
      <BottomSheet
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        title={
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_25%,transparent)]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-black text-[var(--fg)] truncate">
                {t('savings.aiPredictionTitle', 'Prediksi AI & Tips Akselerasi')}
              </h3>
              <p className="text-[10.5px] font-bold text-[var(--muted)] truncate">
                {goal.name} • {formatCurrency(current, currency)} / {formatCurrency(target, currency)}
              </p>
            </div>
          </div>
        }
        showCloseButton={false}
        showHandle={true}
        maxWidth="sm:max-w-xl"
        maxHeight="max-h-[min(90dvh,48rem)]"
      >
        <div className="space-y-4 pt-1 text-[var(--fg)]">

          {isAiLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--accent)] space-y-3">
              <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent)_25%,transparent)]">
                <Sparkles className="h-7 w-7 animate-pulse text-[var(--accent)]" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-extrabold text-[var(--fg)]">{t('savings.aiCalculating', 'AI Sedang Menganalisis...')}</p>
                <p className="text-xs font-medium text-[var(--muted)]">{t('savings.aiCalculatingDesc', 'Menghitung pola tabungan dan proyeksi tanggal pencapaian target.')}</p>
              </div>
            </div>
          ) : aiPrediction && !aiPrediction.error ? (
            <div className="space-y-3.5">
              {/* Status Banner */}
              <div
                className={`p-4 rounded-2xl border ${
                  aiPrediction.isOnTrack
                    ? 'text-[var(--status-income)] bg-[var(--status-income-soft)] border-[var(--status-income)]/25'
                    : 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                } flex gap-3 items-start`}
              >
                {aiPrediction.isOnTrack ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-[var(--status-income)]" />
                ) : (
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="font-extrabold text-xs uppercase tracking-wider mb-1">
                    {aiPrediction.isOnTrack ? 'Target On-Track' : 'Perlu Tambahan Akselerasi'}
                  </h4>
                  <p className="text-xs font-semibold leading-relaxed opacity-90 text-[var(--fg)]">
                    {aiPrediction.summary}
                  </p>
                </div>
              </div>

              {/* Estimation Card */}
              <div className="p-4 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] text-center space-y-1">
                <p className="text-[10px] font-extrabold text-[var(--muted)] uppercase tracking-wider">
                  {t('savings.predictedDateLabel', 'Estimasi Tanggal Target Tercapai')}
                </p>
                <div className="flex items-center justify-center gap-2 text-xl font-black text-[var(--accent)] tabular-nums">
                  <Clock className="h-5 w-5" />
                  <span>{aiPrediction.predictedDate}</span>
                </div>
              </div>

              {/* Tips Section */}
              {aiPrediction.tips && aiPrediction.tips.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-1.5 px-1 text-[var(--fg)]">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-[var(--muted)]">
                      {t('savings.accelerationTips', 'Saran & Tips Akselerasi')}
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {aiPrediction.tips.map((tip, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 bg-[var(--field-bg)] border border-[var(--border)] p-3 rounded-2xl"
                      >
                        <span className="flex shrink-0 items-center justify-center h-5 w-5 rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)] text-[10px] font-black mt-0.5 border border-[color-mix(in_srgb,var(--accent)_25%,transparent)]">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-[var(--fg)] leading-relaxed flex-1">
                          {tip}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 space-y-3 px-2">
              <p className="text-xs font-semibold text-[var(--status-expense)] leading-relaxed">
                {aiPrediction?.text || t('savings.aiError', 'Terjadi kendala saat memproses prediksi AI.')}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={handleGetPrediction}
                  className="px-4 py-2 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel-strong)] transition active:scale-95 cursor-pointer"
                >
                  {t('common.retry', 'Coba Lagi')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAiModalOpen(false)
                    navigate('/settings/ai')
                  }}
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-bold shadow-xs hover:opacity-90 transition active:scale-95 cursor-pointer"
                >
                  {t('settings.aiIntegration', 'Pengaturan AI')}
                </button>
              </div>
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}
