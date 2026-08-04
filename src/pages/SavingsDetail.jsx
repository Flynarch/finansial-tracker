import { useEffect, useRef, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import useBottomSheet from '../hooks/useBottomSheet'
import BottomSheet from '../components/ui/BottomSheet'
import CustomDatePicker from '../components/ui/CustomDatePicker'
import WalletSelectModal, { WalletSelectTrigger } from '../components/ui/WalletSelectModal'
import {
  clampPercent,
  formatCurrency,
  formatMoneyInput,
  getMoneyInputCaret,
  parseMoneyInput,
  toSafeNumber,
} from '../lib/utils'
import {
  ChevronLeft,
  Plus,
  Minus,
  History,
  Sparkles,
  X,
  Loader2,
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
  const { locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const profileName = useSettingsStore((state) => state.profileName)

  const goal = useLiveQuery(async () => {
    if (!goalId || Number.isNaN(goalId)) return null
    try {
      const item = await db.goals.get(goalId)
      if (item) return item
      const all = await db.goals.toArray()
      return all.find((g) => String(g.id) === String(goalId)) || null
    } catch {
      return null
    }
  }, [goalId])

  const logs = useLiveQuery(async () => {
    if (!goalId || Number.isNaN(goalId)) return []
    try {
      const data = await db.goalLogs.toArray()
      return data
        .filter((l) => String(l.goalId) === String(goalId))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    } catch {
      return []
    }
  }, [goalId])

  const { isOpen: sheetOpen, openSheet, closeSheet } = useBottomSheet(false)
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

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const wallets = useLiveQuery(async () => {
    try {
      return await db.wallets.toArray()
    } catch {
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
    const val = parseMoneyInput(amountInput)
    if (val <= 0) return

    const isWithdraw = fundActionType === 'withdraw'
    const currentGoalAmt = Number(goal?.currentAmount || 0)
    const newGoalAmount = isWithdraw
      ? Math.max(0, currentGoalAmt - val)
      : currentGoalAmt + val

    await db.goals.update(goalId, { currentAmount: newGoalAmount })

    const walletIdNum = Number(selectedWalletId)
    let walletObj = null
    if (walletIdNum) {
      walletObj = await db.wallets.get(walletIdNum)
      if (walletObj) {
        const currentBal = Number(walletObj.balance || 0)
        const newWalletBal = isWithdraw
          ? currentBal + val
          : Math.max(0, currentBal - val)
        await db.wallets.update(walletIdNum, { balance: newWalletBal })
      }
    }

    const now = new Date()
    const selectedDate = new Date(`${dateInput}T00:00:00`)
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds())
    const formattedDate = format(selectedDate, 'yyyy-MM-dd HH:mm:ss')

    const logPayload = {
      goalId,
      amount: isWithdraw ? -val : val,
      notes: notesInput.trim() || (isWithdraw ? 'Penarikan Tabungan' : 'Setoran Tabungan'),
      date: formattedDate,
    }
    if (walletObj) {
      logPayload.walletName = walletObj.name
    }
    await db.goalLogs.add(logPayload)

    if (walletIdNum) {
      await db.transactions.add({
        date: dateInput,
        amount: val,
        type: isWithdraw ? 'income' : 'expense',
        category: 'tabungan',
        notes: notesInput.trim() || `${isWithdraw ? 'Tarik dari' : 'Setor ke'} Tabungan: ${goal.name}`,
        currency: goal.currency || defaultCurrency,
        walletId: walletIdNum,
        createdAt: Date.now(),
      })
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

    // 1. Update Goal
    await db.goals.update(goalId, {
      currentAmount: 0,
      isCompleted: true,
      status: 'completed',
    })

    // 2. Update Wallet Balance
    const newBal = Number(walletObj.balance || 0) + cashoutAmount
    await db.wallets.update(walletIdNum, { balance: newBal })

    // 3. Add Income Transaction to Wallet
    const now = new Date()
    const formattedDate = format(now, 'yyyy-MM-dd HH:mm:ss')
    await db.transactions.add({
      date: format(now, 'yyyy-MM-dd'),
      amount: cashoutAmount,
      type: 'income',
      category: 'cairkan_tabungan',
      notes: `Pencairan Tabungan: ${goal.name} ke ${walletObj.name}`,
      currency: goal.currency || defaultCurrency,
      walletId: walletIdNum,
      createdAt: Date.now(),
    })

    // 4. Add Log Entry
    await db.goalLogs.add({
      goalId,
      amount: -cashoutAmount,
      notes: `Pencairan Tabungan ke ${walletObj.name}`,
      date: formattedDate,
      walletName: walletObj.name,
    })

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
        const firstLogDate = new Date(logs[logs.length - 1].date)
        const monthsDiff = Math.max(1, differenceInMonths(new Date(), firstLogDate))
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
      } catch {
        setAiPrediction({ error: true, text: predictionRaw })
      }
    } catch (error) {
      setAiPrediction({ error: true, text: 'Gagal mendapatkan prediksi AI: ' + error.message })
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
      } catch {
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
        <p className="text-[var(--muted)] font-bold">Target tabungan tidak ditemukan</p>
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

  let deadlineText = 'Tanpa batas waktu'
  let daysLeft = null
  let isOverdue = false
  if (goal.deadline) {
    daysLeft = differenceInDays(new Date(goal.deadline), new Date())
    if (daysLeft < 0) {
      deadlineText = 'Lewat Tenggat'
      isOverdue = true
    } else if (daysLeft === 0) {
      deadlineText = 'Jatuh Tempo Hari Ini'
    } else {
      deadlineText = `${daysLeft} Hari Lagi`
    }
  }

  const currency = goal.currency || defaultCurrency

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] pb-28">
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between gap-3 pt-3 px-4 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--panel-strong)] transition-colors cursor-pointer"
            aria-label="Kembali"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
          </button>
          <div className="min-w-0">
            <h2 className="text-xl font-black tracking-tight text-[var(--fg)] truncate">{goal.name}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-[var(--muted)] truncate">
                {goal.deadline ? `Target: ${format(new Date(goal.deadline), 'dd MMM yyyy')}` : 'Tanpa batas waktu'}
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
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Pin Button */}
          <button
            type="button"
            onClick={togglePin}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors cursor-pointer ${
              goal.isPinned
                ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                : 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)]'
            }`}
            title={goal.isPinned ? 'Lepas Pin' : 'Pin Target'}
          >
            <Star className="h-4 w-4" fill={goal.isPinned ? 'currentColor' : 'none'} />
          </button>

          <span className="rounded-full bg-[var(--earthy-green-soft)] border border-[var(--earthy-green)]/25 px-3 py-1 text-xs font-black text-[var(--earthy-green)] tabular-nums shadow-2xs">
            {Math.round(pct)}%
          </span>
        </div>
      </div>

      <div className="space-y-4 px-4 ft-stagger-in">
        {/* ── CELEBRATION BANNER (If 100% or Completed) ── */}
        {isTargetComplete && (
          <div className="rounded-3xl border border-[var(--earthy-green)]/40 bg-[var(--earthy-green-soft)] p-4 text-[var(--earthy-green)] shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--earthy-green)] text-white shadow-xs">
                <PartyPopper className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black uppercase tracking-wider">
                  {goal.isCompleted ? 'Tabungan Selesai & Dicairkan 🏆' : 'Target 100% Tercapai! 🎉'}
                </h3>
                <p className="mt-0.5 text-xs font-medium opacity-90 leading-relaxed">
                  {goal.isCompleted
                    ? 'Target ini telah sukses dicairkan ke saldo dompet pilihanmu.'
                    : 'Selamat! Seluruh nominal target telah terkumpul. Kamu bisa mencairkan dana ini ke dompetmu.'}
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
                Cairkan ke Dompet Saya
              </button>
            )}
          </div>
        )}

        {/* ── Compact & Aesthetic Hero Card ── */}
        <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-xs space-y-4">
          {/* Subtle Ambient Glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 120% 120% at 50% -20%, color-mix(in srgb, var(--earthy-green) 12%, transparent), transparent 75%)',
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-[var(--earthy-green)]" />
              Saldo Tabungan Terkumpul
            </span>
            <p className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight text-[var(--fg)]">
              {formatCurrency(current, currency)}
            </p>
            <p className="text-xs font-bold text-[var(--muted)] tabular-nums">
              dari target <span className="text-[var(--fg)] font-black">{formatCurrency(target, currency)}</span>
            </p>
          </div>

          {/* Clean Progress Bar */}
          <div className="relative z-10 space-y-1.5">
            <div className="h-3 w-full rounded-full bg-[var(--field-bg)] border border-[var(--border)]/40 overflow-hidden relative">
              <div
                className="h-full rounded-full bg-[var(--earthy-green)] transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-xs font-bold text-[var(--muted)] tabular-nums">
              <span>Sisa: <strong className="text-[var(--fg)]">{formatCurrency(remaining, currency)}</strong></span>
              <span className="text-[var(--earthy-green)] font-black">{Math.round(pct)}% Tercapai</span>
            </div>
          </div>
        </div>

        {/* ── Dual Action Buttons: Setor & Tarik ── */}
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
              className="flex items-center justify-center gap-2 bg-[var(--earthy-green)] hover:bg-[var(--earthy-green-dark)] text-white font-black py-3.5 px-4 rounded-2xl shadow-md transition active:scale-[0.98] cursor-pointer text-xs uppercase tracking-wider"
            >
              <Plus size={16} strokeWidth={3} />
              Setor (Tambah)
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
              className="flex items-center justify-center gap-2 bg-[var(--earthy-terra)] hover:bg-[var(--earthy-terra-dark)] text-white font-black py-3.5 px-4 rounded-2xl shadow-md transition active:scale-[0.98] cursor-pointer text-xs uppercase tracking-wider"
            >
              <Minus size={16} strokeWidth={3} />
              Tarik (Kurangi)
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
          Tanya Prediksi AI & Tips Akselerasi
        </button>

        {/* ── History Section (Grouped Timeline) ── */}
        <div className="pt-2 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--muted)]">
                <History className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                Riwayat Transaksi Tabungan ({logs?.length || 0})
              </h3>
            </div>
          </div>

          {!logs || logs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-8 text-center space-y-1">
              <p className="text-xs font-bold text-[var(--muted)]">Belum ada riwayat setoran/penarikan tabungan.</p>
              <p className="text-[11px] font-semibold text-[var(--muted)]/70">Tekan "Setor (Tambah)" untuk mulai menabung.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedLogs.map((group) => (
                <div key={group.monthName} className="space-y-2">
                  <div className="px-1 pb-1 border-b border-[var(--border)]/40 flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                      {group.monthName}
                    </span>
                    <span className="text-[9.5px] font-bold text-[var(--muted)] tabular-nums">
                      {group.items.length} catatan
                    </span>
                  </div>

                  <div className="space-y-2">
                    {group.items.map((log) => {
                      const isWithdraw = (log.amount || 0) < 0
                      const absAmount = Math.abs(log.amount || 0)
                      const logDateStr = (() => {
                        try {
                          return format(new Date(log.date), 'dd MMM yyyy, HH:mm')
                        } catch {
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
                                  {isWithdraw ? 'Penarikan Tabungan' : 'Setoran Tabungan'}
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
          {/* Tab Setor vs Tarik */}
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
            <button
              type="button"
              onClick={() => setFundActionType('add')}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition-all cursor-pointer ${
                fundActionType === 'add'
                  ? 'bg-[var(--earthy-green)] text-white shadow-xs scale-[1.01]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              <Plus size={14} strokeWidth={3} />
              Setor (Tambah)
            </button>
            <button
              type="button"
              onClick={() => setFundActionType('withdraw')}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition-all cursor-pointer ${
                fundActionType === 'withdraw'
                  ? 'bg-[var(--earthy-terra)] text-white shadow-xs scale-[1.01]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              <Minus size={14} strokeWidth={3} />
              Tarik (Kurangi)
            </button>
          </div>

          {/* Amount Input */}
          <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-4 text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] mb-1">
              {fundActionType === 'withdraw' ? 'Jumlah Penarikan' : 'Jumlah Setoran'}
            </p>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              className="w-full bg-transparent text-center text-3xl font-black text-[var(--fg)] outline-none placeholder:text-[var(--muted)]/30 tabular-nums"
              placeholder="0"
              value={amountInput}
              onChange={(e) => {
                const selStart = e.target.selectionStart
                const oldVal = amountInput
                const newVal = formatMoneyInput(e.target.value, currency)
                setAmountInput(newVal)
                window.requestAnimationFrame(() => {
                  if (inputRef.current) {
                    const newPos = getMoneyInputCaret(e.target.value, oldVal, newVal, selStart)
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
              placeholder="Tanpa Potong Dompet (Manual Log)"
              onClick={() => setWalletModalOpen(true)}
            />
            <WalletSelectModal
              isOpen={walletModalOpen}
              onClose={() => setWalletModalOpen(false)}
              wallets={wallets}
              selectedWalletId={selectedWalletId}
              onSelectWallet={(id) => setSelectedWalletId(id)}
              allowNone
              noneLabel="Tanpa Potong Dompet (Manual Log)"
              title={fundActionType === 'withdraw' ? 'Pilih Dompet Tujuan' : 'Pilih Sumber Dompet'}
            />
          </div>

          {/* Date Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5 mb-1">
              <Calendar className="h-3.5 w-3.5 text-[var(--accent)]" />
              Tanggal Transaksi
            </label>
            <CustomDatePicker
              value={dateInput}
              onChange={(val) => setDateInput(val)}
              title="Pilih Tanggal Tabungan"
            />
          </div>

          {/* Notes Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5 mb-1">
              <FileText className="h-3.5 w-3.5 text-[var(--accent)]" />
              Catatan (Opsional)
            </label>
            <input
              type="text"
              placeholder={fundActionType === 'withdraw' ? 'Misal: Keperluan mendadak' : 'Misal: Uang sisa jajan'}
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
            {fundActionType === 'withdraw' ? 'Simpan Penarikan' : 'Simpan Setoran'}
          </button>
        </div>
      </BottomSheet>

      {/* ── Cashout Bottom Sheet ── */}
      <BottomSheet isOpen={isCashoutSheetOpen} onClose={() => setIsCashoutSheetOpen(false)} showCloseButton={false}>
        <div className="space-y-4 pt-1">
          <div className="text-center space-y-1">
            <h3 className="text-base font-black text-[var(--fg)]">Cairkan Tabungan ke Dompet</h3>
            <p className="text-xs font-medium text-[var(--muted)]">
              Seluruh saldo sebesar <strong className="text-[var(--fg)] tabular-nums">{formatCurrency(current, currency)}</strong> akan ditransfer ke dompet pilihanmu.
            </p>
          </div>

          {/* Wallet Select */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5 mb-1">
              <Wallet className="h-3.5 w-3.5 text-[var(--earthy-green)]" />
              Pilih Dompet Tujuan Pencairan
            </label>
            <WalletSelectTrigger
              wallet={selectedCashoutWallet}
              placeholder="Pilih Dompet Tujuan"
              onClick={() => setCashoutWalletModalOpen(true)}
            />
            <WalletSelectModal
              isOpen={cashoutWalletModalOpen}
              onClose={() => setCashoutWalletModalOpen(false)}
              wallets={wallets}
              selectedWalletId={cashoutWalletId}
              onSelectWallet={(id) => setCashoutWalletId(id)}
              allowNone={false}
              title="Pilih Dompet Tujuan Pencairan"
            />
          </div>

          <button
            type="button"
            className="w-full py-3.5 rounded-2xl font-black text-xs text-white bg-[var(--earthy-green)] hover:bg-[var(--earthy-green-dark)] shadow-md transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none uppercase tracking-wider"
            disabled={!cashoutWalletId}
            onClick={handleCashoutToWallet}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
            Konfirmasi Pencairan Dana
          </button>
        </div>
      </BottomSheet>

      {/* ── Celebration Certificate Modal ── */}
      {isCelebrationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm ft-motion-overlay">
          <div className="w-full max-w-sm bg-[var(--panel-strong)] border border-[var(--earthy-green)]/40 rounded-3xl shadow-2xl overflow-hidden p-6 text-center space-y-4">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[var(--earthy-green-soft)] border border-[var(--earthy-green)]/30 text-[var(--earthy-green)] shadow-sm">
              <Trophy className="h-8 w-8 animate-bounce" />
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--earthy-green)]">
                Selamat! Target 100% Tercapai 🏆
              </span>
              <h3 className="text-xl font-black text-[var(--fg)] mt-1">{goal.name}</h3>
              <p className="mt-1 text-2xl font-black text-[var(--earthy-green)] tabular-nums">
                {formatCurrency(goal.targetAmount, currency)}
              </p>
              <p className="mt-2 text-xs font-semibold text-[var(--muted)] leading-relaxed">
                Kamu telah berhasil menabung seluruh target nominal! Pilih bagaimana kamu ingin menyimpan pencapaian ini:
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
                Cairkan Dana ke Dompet
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
                Tandai Selesai & Masukkan Arsip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Prediction Modal ── */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm ft-motion-overlay pt-16 sm:pt-4">
          <div className="w-full max-w-lg bg-[var(--panel-strong)] border border-[color-mix(in_srgb,var(--accent)_40%,var(--border))] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[var(--accent)]" />
                <h3 className="font-bold text-[var(--fg)] text-base">Prediksi AI</h3>
              </div>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="rounded-full p-1.5 text-[var(--muted)] hover:bg-[var(--field-bg)] hover:text-[var(--fg)] transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 ft-hide-scrollbar text-sm leading-relaxed text-[var(--fg)]">
              {isAiLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--accent)]">
                  <Loader2 className="h-8 w-8 animate-spin mb-3" />
                  <p className="font-medium animate-pulse">AI sedang menghitung prediksi targetmu...</p>
                </div>
              ) : aiPrediction && !aiPrediction.error ? (
                <div className="space-y-5">
                  <div
                    className={`p-4 rounded-2xl border ${
                      aiPrediction.isOnTrack
                        ? 'text-[var(--earthy-green)] bg-[var(--earthy-green-soft)] border-[var(--earthy-green)]/25'
                        : 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                    } flex gap-3 items-start`}
                  >
                    {aiPrediction.isOnTrack ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-[var(--earthy-green)]" />
                    ) : (
                      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm uppercase tracking-wider mb-1">
                        {aiPrediction.isOnTrack ? 'On Track' : 'Butuh Perhatian'}
                      </h4>
                      <p className="text-sm font-medium leading-relaxed opacity-90">{aiPrediction.summary}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] text-center">
                    <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                      Estimasi Target Tercapai
                    </p>
                    <div className="flex items-center justify-center gap-2 text-xl font-black text-[var(--accent)]">
                      <Clock className="h-5 w-5" />
                      {aiPrediction.predictedDate}
                    </div>
                  </div>

                  {aiPrediction.tips && aiPrediction.tips.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3 px-1 text-[var(--fg)]">
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                        <h4 className="font-bold text-sm">Saran Akselerasi</h4>
                      </div>
                      <ul className="space-y-2">
                        {aiPrediction.tips.map((tip, idx) => (
                          <li key={idx} className="flex gap-3 bg-[var(--panel)] border border-[var(--border)] p-3 rounded-xl items-start">
                            <span className="flex shrink-0 items-center justify-center h-5 w-5 rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)] text-xs font-bold mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="text-sm text-[var(--fg)] leading-relaxed">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[var(--earthy-terra)] text-center py-6">
                  {aiPrediction?.text || 'Terjadi kesalahan saat mengambil prediksi.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
