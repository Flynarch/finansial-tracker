import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
import LoanSheetModal from '../components/loans/LoanSheetModal'
import LoanPaymentModal from '../components/loans/LoanPaymentModal'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import useLoanStore from '../store/useLoanStore'
import useBackButton from '../hooks/useBackButton'
import useSwipeAction from '../hooks/useSwipeAction'
import { convertCurrency, formatCurrency, toSafeNumber, FALLBACK_EXCHANGE_RATES } from '../lib/utils'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import { triggerHaptic } from '../lib/haptics'
import PageHeader from '../components/ui/PageHeader'
import {
  Plus,
  HandCoins,
  Receipt,
  CheckCircle2,
  Clock,
  StickyNote,
  Pencil,
  Scale,
  HeartHandshake,
  Calendar,
} from 'lucide-react'
import LoanForgiveModal from '../components/loans/LoanForgiveModal'
import LoanInstallmentModal from '../components/loans/LoanInstallmentModal'
import { differenceInDays, format } from 'date-fns'

export default function Loans() {
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const motionDelay = reduceMotion ? 0 : 200
  const navigate = useNavigate()

  const [rates, setRates] = useState(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES })
  const [isEntering, setIsEntering] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [activeTab, setActiveTab] = useState('debt') // 'debt' or 'receivable'
  const [statusFilter, setStatusFilter] = useState('active') // 'active' | 'paid' | 'all'

  useEffect(() => {
    const loadRates = async () => {
      try {
        const fetchedRates = await fetchCurrencyRates('USD')
        setRates(fetchedRates)
      } catch (err){
      console.warn('[Loans]', err)
        setRates({ ...FALLBACK_EXCHANGE_RATES })
      }
    }
    loadRates()
  }, [])

  // Swipe action hook
  const { swipedId, getSwipeHandlers } = useSwipeAction()

  // Inline note editing state
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [noteInputText, setNoteInputText] = useState('')

  useBackButton(() => setEditingNoteId(null), editingNoteId !== null)

  useEffect(() => {
    window.scrollTo(0, 0)
    const id = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const loans = useLiveQuery(() => db.loans.toArray(), [], [])
  const loanPayments = useLiveQuery(() => db.loanPayments.toArray(), [], [])
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], [])
  const walletMap = useMemo(() => {
    const map = new Map()
    wallets?.forEach((w) => map.set(w.id, w.name))
    return map
  }, [wallets])

  const latestPaymentDateMap = useMemo(() => {
    const map = new Map()
    ;(loanPayments ?? []).forEach((lp) => {
      if (!lp?.loanId || !lp?.date) return
      const prev = map.get(lp.loanId)
      if (!prev || lp.date > prev) {
        map.set(lp.loanId, lp.date)
      }
    })
    return map
  }, [loanPayments])

  const formatStampDate = (rawDate) => {
    if (!rawDate) return '100%'
    try {
      const d = typeof rawDate === 'number' ? new Date(rawDate) : new Date(rawDate)
      if (isNaN(d.getTime())) return String(rawDate)
      return format(d, 'dd/MM/yyyy')
    } catch (err){
      console.warn('[Loans]', err)
      return String(rawDate)
    }
  }

  const deleteLoan = useLoanStore((s) => s.deleteLoan)
  const updateLoan = useLoanStore((s) => s.updateLoan)

  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const openSheet = useCallback(() => setIsSheetOpen(true), [])
  const closeSheet = useCallback(() => setIsSheetOpen(false), [])
  const [editingLoan, setEditingLoan] = useState(null)
  const [deletingLoan, setDeletingLoan] = useState(null)

  const [payLoan, setPayLoan] = useState(null)
  const [isPayOpen, setIsPayOpen] = useState(false)
  const [payInitialAmount, setPayInitialAmount] = useState(null)

  const [installmentLoan, setInstallmentLoan] = useState(null)
  const [isInstallmentOpen, setIsInstallmentOpen] = useState(false)

  const [forgiveLoanItem, setForgiveLoanItem] = useState(null)
  const [isForgiveOpen, setIsForgiveOpen] = useState(false)

  const handleBack = () => {
    if (isLeaving) return
    setIsLeaving(true)
    setIsEntering(false)
    window.setTimeout(() => {
      navigate(-1)
    }, motionDelay)
  }

  const openAdd = useCallback(() => {
    setEditingLoan(null)
    openSheet()
  }, [openSheet])

  const openEdit = (loan, e) => {
    e?.stopPropagation()
    setEditingLoan(loan)
    openSheet()
  }

  const openPaymentModal = (loan, e, initialAmount = null) => {
    e?.stopPropagation()
    setPayLoan(loan)
    setPayInitialAmount(initialAmount)
    setIsPayOpen(true)
  }

  const openInstallmentModal = (loan, e) => {
    e?.stopPropagation()
    setInstallmentLoan(loan)
    setIsInstallmentOpen(true)
  }

  const handlePayFromInstallment = (amount) => {
    setPayLoan(installmentLoan)
    setPayInitialAmount(amount)
    setIsPayOpen(true)
  }

  const openForgiveModal = (loan, e) => {
    e?.stopPropagation()
    setForgiveLoanItem(loan)
    setIsForgiveOpen(true)
  }

  const startEditNote = (item, e) => {
    e?.stopPropagation()
    setEditingNoteId(item.id)
    setNoteInputText(item.notes || '')
  }

  const handleSaveInlineNote = async (id) => {
    await updateLoan(id, { notes: noteInputText.trim() })
    setEditingNoteId(null)
    setNoteInputText('')
  }

  // Calculate totals and format row data
  const rows = useMemo(() => {
    return (loans ?? []).map((l) => {
      const total = toSafeNumber(l.totalAmount)
      const remaining = toSafeNumber(l.remainingAmount ?? l.totalAmount)
      const isForgiven = l.status === 'forgiven'
      const isPaid = l.status === 'paid' || (remaining <= 0 && !isForgiven)
      const isSettled = isPaid || isForgiven
      const paid = isForgiven ? Math.max(0, total - toSafeNumber(l.forgivenAmount || remaining)) : Math.max(0, total - remaining)
      const pct = total > 0 ? Math.min(100, Math.max(0, (paid / total) * 100)) : 0

      let dueBadge = null
      let isOverdue = false
      if (l.dueDate && !isSettled) {
        const daysLeft = differenceInDays(new Date(l.dueDate), new Date())
        if (daysLeft < 0) {
          dueBadge = {
            text: t('loans.badge.overdue', 'Telat'),
            color: 'bg-[var(--earthy-terra-soft)] text-[var(--earthy-terra)] border-[var(--earthy-terra)]/25',
          }
          isOverdue = true
        } else if (daysLeft === 0) {
          dueBadge = {
            text: t('loans.badge.today', 'Hari ini'),
            color: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
          }
        } else {
          dueBadge = {
            text: locale === 'en' ? `${daysLeft}d` : `${daysLeft}h`,
            color: 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)]',
          }
        }
      }

      const rawSettledDate = isForgiven
        ? (l.forgivenAt || latestPaymentDateMap.get(l.id) || l.dueDate || l.startDate)
        : (l.paidDate || latestPaymentDateMap.get(l.id) || l.dueDate || l.startDate)
      const settledDate = formatStampDate(rawSettledDate)

      return {
        ...l,
        total,
        remaining,
        paid,
        pct,
        isPaid,
        isForgiven,
        isSettled,
        settledDate,
        dueBadge,
        isOverdue,
      }
    })
  }, [loans, latestPaymentDateMap, t, locale])

  const totals = useMemo(() => {
    let totalDebt = 0
    let totalReceivable = 0
    let dueThisMonthCount = 0

    const now = new Date()
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    rows.forEach((r) => {
      const val = convertCurrency(r.remaining, r.currency || defaultCurrency, defaultCurrency, rates)
      if (r.type === 'debt' && !r.isSettled) {
        totalDebt += val
      } else if (r.type === 'receivable' && !r.isSettled) {
        totalReceivable += val
      }

      if (r.dueDate && r.dueDate.startsWith(currentMonthStr) && !r.isSettled) {
        dueThisMonthCount += 1
      }
    })

    const netPosition = totalReceivable - totalDebt
    const sum = totalDebt + totalReceivable
    const debtPct = sum > 0 ? Math.round((totalDebt / sum) * 100) : 0
    const receivablePct = sum > 0 ? 100 - debtPct : 0

    return { totalDebt, totalReceivable, dueThisMonthCount, netPosition, debtPct, receivablePct }
  }, [rows, defaultCurrency, rates])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (r.type !== activeTab) return false
      if (statusFilter === 'active') return !r.isSettled
      if (statusFilter === 'paid') return r.isPaid
      if (statusFilter === 'forgiven') return r.isForgiven
      return true
    })
  }, [rows, activeTab, statusFilter])

  const activeCountInTab = rows.filter((r) => r.type === activeTab && !r.isSettled).length
  const paidCountInTab = rows.filter((r) => r.type === activeTab && r.isPaid).length
  const forgivenCountInTab = rows.filter((r) => r.type === activeTab && r.isForgiven).length
  const totalCountInTab = rows.filter((r) => r.type === activeTab).length

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
          title={t('loans.title')}
          titlePosition="left"
          onBack={handleBack}
          backAriaLabel={t('loans.back')}
          className="pt-2 mb-0"
          rightAction={
            <button
              type="button"
              onClick={openAdd}
              className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-[var(--accent)] text-white font-extrabold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              {t('loans.recordNew', 'Catat Baru')}
            </button>
          }
        />

        {/* Summary Card Header */}
        <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-[var(--shadow-card)] space-y-3.5">
          <div className="grid grid-cols-2 gap-4 divide-x divide-[var(--border)]">
            {/* Total Debt */}
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                <HandCoins className="h-3.5 w-3.5 text-[var(--earthy-terra)]" />
                {t('loans.myDebt', 'Utang Saya')}
              </span>
              <p className="mt-1 text-xl sm:text-2xl font-black tabular-nums tracking-tight text-[var(--earthy-terra)]">
                {formatCurrency(totals.totalDebt, defaultCurrency)}
              </p>
            </div>

            {/* Total Receivable */}
            <div className="min-w-0 pl-4">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                <Receipt className="h-3.5 w-3.5 text-[var(--earthy-green)]" />
                {t('loans.myReceivable', 'Piutang Saya')}
              </span>
              <p className="mt-1 text-xl sm:text-2xl font-black tabular-nums tracking-tight text-[var(--earthy-green)]">
                {formatCurrency(totals.totalReceivable, defaultCurrency)}
              </p>
            </div>
          </div>

          {/* Segmented Ratio Bar */}
          <div className="space-y-1 pt-1">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--field-bg)] border border-[var(--border)]/60">
              <div
                className="h-full bg-[var(--earthy-green)] transition-all duration-500"
                style={{ width: `${totals.receivablePct}%` }}
                title={`${t('loans.myReceivable', 'Piutang')}: ${totals.receivablePct}%`}
              />
              <div
                className="h-full bg-[var(--earthy-terra)] transition-all duration-500"
                style={{ width: `${totals.debtPct}%` }}
                title={`${t('loans.myDebt', 'Utang')}: ${totals.debtPct}%`}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-extrabold tabular-nums">
              <span className="text-[var(--earthy-green)]">{t('loans.myReceivable', 'Piutang')} {totals.receivablePct}%</span>
              <span className="text-[var(--muted)] font-semibold italic">
                {totals.receivablePct === totals.debtPct
                  ? t('loans.balanced', 'seimbang')
                  : totals.receivablePct > totals.debtPct
                  ? t('loans.moreReceivable', 'piutang lebih dominan')
                  : t('loans.moreDebt', 'utang lebih dominan')}
              </span>
              <span className="text-[var(--earthy-terra)]">{t('loans.myDebt', 'Utang')} {totals.debtPct}%</span>
            </div>
          </div>

          {/* Posisi Bersih Row */}
          <div className="pt-2.5 border-t border-dashed border-[var(--border)] flex items-center justify-between text-xs font-bold">
            <span className="text-[var(--muted)] flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5" /> {t('loans.netPosition', 'Posisi Bersih')}
            </span>
            <span
              className={`font-black tabular-nums ${
                totals.netPosition > 0
                  ? 'text-[var(--earthy-green)]'
                  : totals.netPosition < 0
                    ? 'text-[var(--earthy-terra)]'
                    : 'text-[var(--fg)]'
              }`}
            >
              {totals.netPosition > 0 ? '+' : totals.netPosition < 0 ? '-' : ''}
              {formatCurrency(Math.abs(totals.netPosition), defaultCurrency)}
            </span>
          </div>

          {totals.dueThisMonthCount > 0 && (
            <div className="pt-2 border-t border-[var(--border)]/60 flex items-center gap-1.5 text-xs font-bold text-amber-500">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{t('loans.dueThisMonth', { count: totals.dueThisMonthCount }, `${totals.dueThisMonthCount} pinjaman jatuh tempo bulan ini`)}</span>
            </div>
          )}
        </div>

        {/* Primary Type Tab Switcher (Underline Style) */}
        <div className="flex items-center gap-6 px-3 border-b border-[var(--border)] pt-1">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light')
              setActiveTab('debt')
            }}
            className={`pb-3 text-sm font-extrabold transition-all cursor-pointer relative ${
              activeTab === 'debt' ? 'text-[var(--fg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            {t('loans.myDebt', 'Utang Saya')} ({rows.filter((r) => r.type === 'debt' && !r.isSettled).length})
            {activeTab === 'debt' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-[var(--earthy-terra)]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light')
              setActiveTab('receivable')
            }}
            className={`pb-3 text-sm font-extrabold transition-all cursor-pointer relative ${
              activeTab === 'receivable' ? 'text-[var(--fg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            {t('loans.myReceivable', 'Piutang Saya')} ({rows.filter((r) => r.type === 'receivable' && !r.isSettled).length})
            {activeTab === 'receivable' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-[var(--earthy-green)]" />
            )}
          </button>
        </div>

        {/* Secondary Status Filter Tabs (Aktif | Lunas | Diikhlaskan | Semua) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light')
              setStatusFilter('active')
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border active:scale-95 shrink-0 ${
              statusFilter === 'active'
                ? activeTab === 'debt'
                  ? 'bg-[var(--earthy-terra)] text-white border-[var(--earthy-terra)]'
                  : 'bg-[var(--earthy-green)] text-white border-[var(--earthy-green)]'
                : 'bg-[var(--panel-strong)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--fg)]'
            }`}
          >
            {t('loans.filter.active', { count: activeCountInTab }, `Aktif (${activeCountInTab})`)}
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light')
              setStatusFilter('paid')
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border active:scale-95 shrink-0 ${
              statusFilter === 'paid'
                ? 'bg-[var(--status-income)] text-white border-[var(--status-income)]'
                : 'bg-[var(--panel-strong)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--fg)]'
            }`}
          >
            {t('loans.filter.paid', { count: paidCountInTab }, `Lunas (${paidCountInTab})`)}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('forgiven')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border active:scale-95 shrink-0 ${
              statusFilter === 'forgiven'
                ? 'bg-[var(--forgiven)] text-white border-[var(--forgiven)]'
                : 'bg-[var(--panel-strong)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--fg)]'
            }`}
          >
            {t('loans.filter.forgiven', { count: forgivenCountInTab }, `Diikhlaskan (${forgivenCountInTab})`)}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border active:scale-95 shrink-0 ${
              statusFilter === 'all'
                ? 'bg-[var(--field-bg)] text-[var(--fg)] border-[var(--border-strong)]'
                : 'bg-[var(--panel-strong)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--fg)]'
            }`}
          >
            {t('loans.filter.all', { count: totalCountInTab }, `Semua (${totalCountInTab})`)}
          </button>
        </div>

        {/* List of Individual Loan Cards with Swipe-to-Reveal (Compact Simplified Layout) */}
        <div className="space-y-3 pt-1">
          {filteredRows.length === 0 ? (
            <EmptyState
              variant="loans"
              title={
                statusFilter === 'forgiven'
                  ? t('loans.empty.forgiven.title', 'Belum Ada Catatan yang Diikhlaskan')
                  : statusFilter === 'paid'
                    ? t('loans.empty.paid.title', 'Belum Ada Catatan Lunas')
                    : activeTab === 'debt'
                      ? t('loans.empty.debt.title', 'Belum Ada Catatan Utang Aktif')
                      : t('loans.empty.receivable.title', 'Belum Ada Catatan Piutang Aktif')
              }
              description={
                statusFilter === 'forgiven'
                  ? t('loans.empty.forgiven.desc', 'Catatan pinjaman yang diputihkan atau direlakan akan tersimpan di sini.')
                  : statusFilter === 'paid'
                    ? t('loans.empty.paid.desc', 'Catatan pinjaman yang sudah lunas 100% akan tersimpan di sini.')
                    : activeTab === 'debt'
                      ? t('loans.empty.debt.desc', 'Tekan "Catat Baru" untuk menambah catatan utang Anda.')
                      : t('loans.empty.receivable.desc', 'Tekan "Catat Baru" untuk menambah catatan uang yang dipinjam orang lain.')
              }
              action={
                <button
                  type="button"
                  onClick={openAdd}
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white font-extrabold text-xs shadow-sm transition active:scale-95 flex items-center gap-1.5 mx-auto cursor-pointer"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  {t('loans.recordNew', 'Catat Baru')}
                </button>
              }
            />
          ) : (
            <div className="space-y-3 ft-stagger-in">
              {filteredRows.map((item) => {
                const isPaid = item.isPaid
                const isForgiven = item.isForgiven
                const isSettled = item.isSettled
                const isDebt = item.type === 'debt'
                const isEditingThisNote = editingNoteId === item.id
                const isSwiped = swipedId === item.id

                return (
                  <div
                    key={item.id}
                    className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] select-none transition-all"
                  >
                    {/* Progressive Swipe Background (Revealed Action Slot) */}
                    <div className="absolute inset-y-0 right-0 z-0 flex items-center justify-end rounded-r-2xl px-5 opacity-0 transition-colors duration-150 w-full" />

                    {/* Swipable Compact Card Content (Front Layer) */}
                    <article
                      className="loan-entry relative z-10 bg-[var(--panel-strong)] border-r border-[var(--border)]/70 p-3.5 space-y-2.5 touch-pan-y cursor-pointer"
                      onClick={(e) => {
                        if (isSwiped) {
                          openEdit(item, e)
                        }
                      }}
                      {...getSwipeHandlers(item.id, { onEdit: () => openEdit(item), onDelete: () => setDeletingLoan(item) })}
                    >
                      {/* Circular Stamp for Paid or Forgiven Items */}
                      {isForgiven ? (
                        <div className="loan-stamp loan-stamp-forgiven">
                          <b className="loan-stamp-text">{t('loans.stamp.forgiven', 'DIIKHLASKAN')}</b>
                          <span className="loan-stamp-sub">{item.settledDate}</span>
                        </div>
                      ) : isPaid ? (
                        <div className={`loan-stamp ${isDebt ? 'loan-stamp-debt' : 'loan-stamp-receivable'}`}>
                          <b className="loan-stamp-text">{t('loans.badge.paid', 'LUNAS')}</b>
                          <span className="loan-stamp-sub">{item.settledDate}</span>
                        </div>
                      ) : null}

                      {/* Row 1 & 2: Header Block (Icon + Title + Due Badge / Person · Wallet) */}
                      <div className={`flex items-start justify-between gap-2.5 ${isSettled ? 'pr-20 sm:pr-24' : ''}`}>
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* Category Icon */}
                          <div className="relative shrink-0">
                            <div
                              className={`grid h-9 w-9 place-items-center rounded-xl border ${
                                isDebt
                                  ? 'bg-[var(--earthy-terra-soft)] text-[var(--earthy-terra)] border-[var(--earthy-terra)]/25'
                                  : 'bg-[var(--earthy-green-soft)] text-[var(--earthy-green)] border-[var(--earthy-green)]/25'
                              }`}
                            >
                              {isDebt ? <HandCoins className="h-4.5 w-4.5" /> : <Receipt className="h-4.5 w-4.5" />}
                            </div>
                            {isForgiven ? (
                              <span
                                className="absolute -bottom-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-[var(--forgiven)] text-white ring-2 ring-[var(--panel-strong)]"
                                title={t('loans.badge.forgiven', 'Diikhlaskan')}
                              >
                                <HeartHandshake className="h-2.5 w-2.5" strokeWidth={3} />
                              </span>
                            ) : isPaid ? (
                              <span
                                className="absolute -bottom-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-[var(--panel-strong)]"
                                title={t('loans.paid', 'Lunas')}
                              >
                                <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={3} />
                              </span>
                            ) : null}
                          </div>

                          {/* Title & Combined Subtitle */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <h4 className="truncate text-sm font-extrabold text-[var(--fg)]">
                                {item.title}
                              </h4>
                              {!isSettled && item.dueBadge && (
                                <span
                                  className={`shrink-0 rounded-full px-1.5 py-0.2 text-[9px] font-black border ${item.dueBadge.color}`}
                                >
                                  {item.dueBadge.text}
                                </span>
                              )}
                              {isForgiven && (
                                <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[9px] font-black bg-[var(--forgiven-soft)] text-[var(--forgiven)] border border-[var(--forgiven)]/30">
                                  <HeartHandshake className="h-2.5 w-2.5" /> {t('loans.badge.forgiven', 'Diikhlaskan')}
                                </span>
                              )}
                              {statusFilter === 'paid' && isPaid && !isForgiven && (
                                <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[9px] font-black bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> {t('loans.paid', 'Lunas')}
                                </span>
                              )}
                            </div>

                            {/* Combined Person · Wallet (Single line) */}
                            <p className="mt-0.5 text-[11px] font-bold text-[var(--muted)] truncate">
                              <span>{item.personName}</span>
                              {item.walletId && walletMap.has(Number(item.walletId)) && (
                                <span> · {walletMap.get(Number(item.walletId))}</span>
                              )}
                              {item.interestRate ? <span> · {item.interestRate}%/thn</span> : null}
                              {item.tenorMonths ? <span> · {item.tenorMonths} bln</span> : null}
                              {item.monthlyPayment && !isSettled ? (
                                <span className="text-[var(--accent)] font-semibold"> (Cicilan: {formatCurrency(item.monthlyPayment, item.currency || defaultCurrency)}/bln)</span>
                              ) : null}
                            </p>
                            {(item.tenorMonths > 1 || item.monthlyPayment > 0) && (
                              <div className="mt-1">
                                <button
                                  type="button"
                                  onClick={(e) => openInstallmentModal(item, e)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-[var(--field-bg)] hover:bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-all cursor-pointer active:scale-95"
                                  title={t('loans.installments.viewSchedule', 'Jadwal Cicilan')}
                                >
                                  <Calendar className="h-3 w-3" />
                                  <span>{t('loans.installments.viewSchedule', 'Jadwal Cicilan')}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Row 3: Compact Progress Bar + Nominal Inline */}
                      <div className="flex items-center gap-2.5 pt-0.5">
                        <div className="h-2 flex-1 rounded-full bg-[var(--field-bg)] border border-[var(--border)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isForgiven
                                ? 'bg-[var(--forgiven)]'
                                : isPaid
                                  ? 'bg-emerald-500'
                                  : isDebt
                                    ? 'bg-[var(--earthy-terra)]'
                                    : 'bg-[var(--earthy-green)]'
                            }`}
                            style={{ width: `${isSettled ? 100 : item.pct}%` }}
                          />
                        </div>

                        <div className="shrink-0 text-[11px] font-extrabold tabular-nums">
                          {isForgiven ? (
                            <span className="text-[var(--forgiven)] flex items-center gap-1 font-black">
                              <HeartHandshake className="h-3 w-3" /> {formatCurrency(item.total, item.currency || defaultCurrency)}
                            </span>
                          ) : isPaid ? (
                            <span className="text-emerald-500 flex items-center gap-1 font-black">
                              <CheckCircle2 className="h-3 w-3" /> {formatCurrency(item.total, item.currency || defaultCurrency)}
                            </span>
                          ) : (
                            <span className="text-[var(--fg)] font-black">
                              {formatCurrency(item.remaining, item.currency || defaultCurrency)}
                              <span className="text-[var(--muted)] font-normal text-[10px]">
                                / {formatCurrency(item.total, item.currency || defaultCurrency)}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Row 4: Notes + Action CTA Button (Combined in 1 row) */}
                      {isEditingThisNote ? (
                        <div className="flex items-center gap-2 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            className="ft-input text-xs font-semibold py-1 px-2.5 rounded-xl flex-1"
                            value={noteInputText}
                            onChange={(e) => setNoteInputText(e.target.value)}
                            placeholder={t('loans.notes.placeholder', 'Tulis catatan singkat...')}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInlineNote(item.id)
                              if (e.key === 'Escape') setEditingNoteId(null)
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveInlineNote(item.id)}
                            className="px-2.5 py-1 rounded-xl bg-[var(--accent)] text-white text-[11px] font-extrabold cursor-pointer hover:opacity-90 shrink-0"
                          >
                            {t('common.save', 'Simpan')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingNoteId(null)}
                            className="px-2 py-1 rounded-xl border border-[var(--border)] text-[var(--muted)] text-[11px] font-bold cursor-pointer shrink-0"
                          >
                            {t('common.cancel', 'Batal')}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          {/* Notes side (left) */}
                          <div className="min-w-0 flex-1">
                            {item.notes ? (
                              <div
                                onClick={(e) => startEditNote(item, e)}
                                className="inline-flex items-center gap-1.5 text-[11px] text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer truncate max-w-full group/note"
                                title={t('common.edit', 'Edit')}
                              >
                                <StickyNote className="h-3 w-3 text-amber-500 shrink-0" />
                                <span className="truncate font-medium">{item.notes}</span>
                                <Pencil className="h-2.5 w-2.5 opacity-0 group-hover/note:opacity-100 transition-opacity shrink-0" />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => startEditNote(item, e)}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer"
                              >
                                <Plus className="h-2.5 w-2.5" /> {t('loans.modal.notes', 'Catatan')}
                              </button>
                            )}
                          </div>

                          {/* CTA Button side (right) */}
                          {!isSettled ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {(item.tenorMonths > 1 || item.monthlyPayment > 0) && (
                                <button
                                  type="button"
                                  onClick={(e) => openInstallmentModal(item, e)}
                                  className="shrink-0 px-2 py-1 rounded-xl text-[11px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/20 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                  title={t('loans.installments.viewSchedule', 'Jadwal Cicilan')}
                                >
                                  <Calendar className="h-3 w-3" />
                                  <span className="hidden xs:inline">{t('loans.installments.schedule', 'Cicilan')}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => openForgiveModal(item, e)}
                                className="shrink-0 px-2 py-1 rounded-xl text-[11px] font-bold text-[var(--forgiven)] bg-[var(--forgiven-soft)] hover:bg-[var(--forgiven)]/20 border border-[var(--forgiven)]/20 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                title={isDebt ? t('loans.action.forgiveDebt', 'Diikhlaskan') : t('loans.action.forgive', 'Ikhlaskan')}
                              >
                                <HeartHandshake className="h-3 w-3" />
                                <span>{isDebt ? t('loans.action.forgiveDebt', 'Diikhlaskan') : t('loans.action.forgive', 'Ikhlaskan')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => openPaymentModal(item, e)}
                                className={`shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer active:scale-95 border ${
                                  isDebt
                                    ? 'bg-[var(--earthy-terra-soft)] text-[var(--earthy-terra)] border-[var(--earthy-terra)]/25 hover:bg-[var(--earthy-terra)]/20'
                                    : 'bg-[var(--earthy-green-soft)] text-[var(--earthy-green)] border-[var(--earthy-green)]/25 hover:bg-[var(--earthy-green)]/20'
                                }`}
                              >
                                <Plus className="h-3 w-3" strokeWidth={3} />
                                {isDebt ? t('loans.action.pay', 'Bayar') : t('loans.action.receive', 'Terima')}
                              </button>
                            </div>
                          ) : (
                            (item.tenorMonths > 1 || item.monthlyPayment > 0) && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => openInstallmentModal(item, e)}
                                  className="shrink-0 px-2 py-1 rounded-xl text-[11px] font-bold text-[var(--muted)] hover:text-[var(--fg)] bg-[var(--field-bg)] border border-[var(--border)] transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                  title={t('loans.installments.viewSchedule', 'Jadwal Cicilan')}
                                >
                                  <Calendar className="h-3 w-3" />
                                  <span>{t('loans.installments.viewSchedule', 'Jadwal Cicilan')}</span>
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </article>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <LoanSheetModal
        isOpen={isSheetOpen}
        onClose={closeSheet}
        editingLoan={editingLoan}
        defaultType={activeTab}
      />

      <LoanPaymentModal
        isOpen={isPayOpen}
        onClose={() => {
          setIsPayOpen(false)
          setPayInitialAmount(null)
        }}
        loan={payLoan}
        initialAmount={payInitialAmount}
        onOpenForgive={(loan) => {
          setIsPayOpen(false)
          setPayInitialAmount(null)
          openForgiveModal(loan)
        }}
      />

      <LoanInstallmentModal
        isOpen={isInstallmentOpen}
        onClose={() => setIsInstallmentOpen(false)}
        loan={installmentLoan}
        onPayInstallment={handlePayFromInstallment}
      />

      <LoanForgiveModal
        isOpen={isForgiveOpen}
        onClose={() => setIsForgiveOpen(false)}
        loan={forgiveLoanItem}
      />

      <ConfirmDeleteModal
        isOpen={!!deletingLoan}
        onClose={() => setDeletingLoan(null)}
        onConfirm={async () => {
          if (deletingLoan) {
            await deleteLoan(deletingLoan.id)
            setDeletingLoan(null)
          }
        }}
        title={t('loans.delete.title', 'Hapus Catatan Pinjaman')}
        message={t('loans.delete.message', 'Apakah Anda yakin ingin menghapus catatan pinjaman ini beserta seluruh riwayat pembayarannya?')}
      />
    </div>
  )
}
