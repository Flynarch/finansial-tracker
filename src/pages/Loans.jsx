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
import useBottomSheet from '../hooks/useBottomSheet'
import useSwipeAction from '../hooks/useSwipeAction'
import { convertCurrency, formatCurrency, toSafeNumber } from '../lib/utils'
import {
  Plus,
  ChevronLeft,
  HandCoins,
  Receipt,
  CheckCircle2,
  Clock,
  StickyNote,
  Pencil,
  Scale,
} from 'lucide-react'
import { differenceInDays } from 'date-fns'

export default function Loans() {
  const { t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const motionDelay = reduceMotion ? 0 : 220
  const navigate = useNavigate()

  const [isEntering, setIsEntering] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [activeTab, setActiveTab] = useState('debt') // 'debt' or 'receivable'
  const [statusFilter, setStatusFilter] = useState('active') // 'active' | 'paid' | 'all'

  // Swipe action hook
  const { swipedId, getSwipeHandlers } = useSwipeAction()

  // Inline note editing state
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [noteInputText, setNoteInputText] = useState('')

  useEffect(() => {
    window.scrollTo(0, 0)
    const id = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const loans = useLiveQuery(() => db.loans.toArray(), [], [])
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], [])
  const walletMap = useMemo(() => {
    const map = new Map()
    wallets?.forEach((w) => map.set(w.id, w.name))
    return map
  }, [wallets])

  const deleteLoan = useLoanStore((s) => s.deleteLoan)
  const updateLoan = useLoanStore((s) => s.updateLoan)

  const { isOpen: isSheetOpen, openSheet, closeSheet } = useBottomSheet(false)
  const [editingLoan, setEditingLoan] = useState(null)
  const [deletingLoan, setDeletingLoan] = useState(null)

  const [payLoan, setPayLoan] = useState(null)
  const [isPayOpen, setIsPayOpen] = useState(false)

  // Auto cleanup dummy/test data if present
  useEffect(() => {
    if (loans && loans.length > 0) {
      const dummy = loans.find(
        (l) => (l.title === 'm' && l.personName === 'gg') || l.title === 'm' || l.personName === 'gg'
      )
      if (dummy) {
        db.loans.delete(dummy.id)
      }
    }
  }, [loans])

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

  const openPaymentModal = (loan, e) => {
    e?.stopPropagation()
    setPayLoan(loan)
    setIsPayOpen(true)
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
      const remaining = toSafeNumber(l.remainingAmount)
      const paid = Math.max(0, total - remaining)
      const isPaid = l.status === 'paid' || remaining <= 0
      const pct = total > 0 ? Math.min(100, Math.max(0, (paid / total) * 100)) : 0

      let dueBadge = null
      let isOverdue = false
      if (l.dueDate && !isPaid) {
        const daysLeft = differenceInDays(new Date(l.dueDate), new Date())
        if (daysLeft < 0) {
          dueBadge = {
            text: 'Telat',
            color: 'bg-[var(--earthy-terra-soft)] text-[var(--earthy-terra)] border-[var(--earthy-terra)]/25',
          }
          isOverdue = true
        } else if (daysLeft === 0) {
          dueBadge = {
            text: 'Hari ini',
            color: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
          }
        } else {
          dueBadge = {
            text: `${daysLeft}h`,
            color: 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)]',
          }
        }
      }

      return {
        ...l,
        total,
        remaining,
        paid,
        pct,
        isPaid,
        dueBadge,
        isOverdue,
      }
    })
  }, [loans])

  const totals = useMemo(() => {
    let totalDebt = 0
    let totalReceivable = 0
    let dueThisMonthCount = 0

    const now = new Date()
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    rows.forEach((r) => {
      const val = convertCurrency(r.remaining, r.currency || defaultCurrency, defaultCurrency, {})
      if (r.type === 'debt' && !r.isPaid) {
        totalDebt += val
      } else if (r.type === 'receivable' && !r.isPaid) {
        totalReceivable += val
      }

      if (r.dueDate && r.dueDate.startsWith(currentMonthStr) && !r.isPaid) {
        dueThisMonthCount += 1
      }
    })

    const netPosition = totalReceivable - totalDebt
    const sum = totalDebt + totalReceivable
    const debtPct = sum > 0 ? Math.round((totalDebt / sum) * 100) : 0
    const receivablePct = sum > 0 ? 100 - debtPct : 0

    return { totalDebt, totalReceivable, dueThisMonthCount, netPosition, debtPct, receivablePct }
  }, [defaultCurrency, rows])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (r.type !== activeTab) return false
      if (statusFilter === 'active') return !r.isPaid
      if (statusFilter === 'paid') return r.isPaid
      return true
    })
  }, [rows, activeTab, statusFilter])

  const activeCountInTab = rows.filter((r) => r.type === activeTab && !r.isPaid).length
  const paidCountInTab = rows.filter((r) => r.type === activeTab && r.isPaid).length
  const totalCountInTab = rows.filter((r) => r.type === activeTab).length

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
        {/* Page Header */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--panel-strong)] transition-colors cursor-pointer"
              aria-label={t('loans.back') || 'Kembali'}
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
            </button>
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight text-[var(--fg)]">
                {t('loans.title') || 'Utang & Piutang'}
              </h2>
              <p className="text-xs font-bold text-[var(--muted)] truncate">
                {t('loans.subtitle') || 'Kelola kewajiban utang dan tagihan piutang.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openAdd}
            className="px-3.5 py-2 rounded-xl bg-[var(--accent)] text-white font-extrabold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Catat Baru
          </button>
        </div>

        {/* Summary Card Header */}
        <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-sm space-y-3.5">
          <div className="grid grid-cols-2 gap-4 divide-x divide-[var(--border)]">
            {/* Total Debt */}
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                <HandCoins className="h-3.5 w-3.5 text-[var(--earthy-terra)]" />
                Utang Saya
              </span>
              <p className="mt-1 text-xl sm:text-2xl font-black tabular-nums tracking-tight text-[var(--earthy-terra)]">
                {formatCurrency(totals.totalDebt, defaultCurrency)}
              </p>
            </div>

            {/* Total Receivable */}
            <div className="min-w-0 pl-4">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                <Receipt className="h-3.5 w-3.5 text-[var(--earthy-green)]" />
                Piutang Saya
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
                title={`Piutang: ${totals.receivablePct}%`}
              />
              <div
                className="h-full bg-[var(--earthy-terra)] transition-all duration-500"
                style={{ width: `${totals.debtPct}%` }}
                title={`Utang: ${totals.debtPct}%`}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-extrabold tabular-nums">
              <span className="text-[var(--earthy-green)]">Piutang {totals.receivablePct}%</span>
              <span className="text-[var(--muted)] font-semibold italic">
                {totals.receivablePct === totals.debtPct
                  ? 'seimbang'
                  : totals.receivablePct > totals.debtPct
                    ? 'surplus'
                    : 'beban'}
              </span>
              <span className="text-[var(--earthy-terra)]">Utang {totals.debtPct}%</span>
            </div>
          </div>

          {/* Posisi Bersih Row */}
          <div className="pt-2.5 border-t border-dashed border-[var(--border)] flex items-center justify-between text-xs font-bold">
            <span className="text-[var(--muted)] flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5" /> Posisi Bersih
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
              <span>{totals.dueThisMonthCount} pinjaman jatuh tempo bulan ini</span>
            </div>
          )}
        </div>

        {/* Primary Type Tab Switcher (Underline Style) */}
        <div className="flex items-center gap-6 px-3 border-b border-[var(--border)] pt-1">
          <button
            type="button"
            onClick={() => setActiveTab('debt')}
            className={`pb-3 text-sm font-extrabold transition-all cursor-pointer relative ${
              activeTab === 'debt' ? 'text-[var(--fg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            Utang Saya ({rows.filter((r) => r.type === 'debt' && !r.isPaid).length})
            {activeTab === 'debt' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-[var(--earthy-terra)]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('receivable')}
            className={`pb-3 text-sm font-extrabold transition-all cursor-pointer relative ${
              activeTab === 'receivable' ? 'text-[var(--fg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            Piutang Saya ({rows.filter((r) => r.type === 'receivable' && !r.isPaid).length})
            {activeTab === 'receivable' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-[var(--earthy-green)]" />
            )}
          </button>
        </div>

        {/* Secondary Status Filter Tabs (Aktif | Lunas | Semua) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
              statusFilter === 'active'
                ? 'bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]'
                : 'bg-[var(--panel-strong)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--fg)]'
            }`}
          >
            Aktif ({activeCountInTab})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('paid')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
              statusFilter === 'paid'
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-[var(--panel-strong)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--fg)]'
            }`}
          >
            Lunas ({paidCountInTab})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
              statusFilter === 'all'
                ? 'bg-[var(--field-bg)] text-[var(--fg)] border-[var(--border-strong)]'
                : 'bg-[var(--panel-strong)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--fg)]'
            }`}
          >
            Semua ({totalCountInTab})
          </button>
        </div>

        {/* List of Individual Loan Cards with Swipe-to-Reveal (Compact Simplified Layout) */}
        <div className="space-y-3 pt-1">
          {filteredRows.length === 0 ? (
            <EmptyState
              title={
                statusFilter === 'paid'
                  ? 'Belum Ada Catatan Lunas'
                  : activeTab === 'debt'
                    ? 'Belum Ada Catatan Utang Aktif'
                    : 'Belum Ada Catatan Piutang Aktif'
              }
              description={
                statusFilter === 'paid'
                  ? 'Catatan pinjaman yang sudah lunas 100% akan tersimpan di sini.'
                  : activeTab === 'debt'
                    ? 'Tekan "Catat Baru" untuk menambah catatan utang Anda.'
                    : 'Tekan "Catat Baru" untuk menambah catatan uang yang dipinjam orang lain.'
              }
              action={
                <button
                  type="button"
                  onClick={openAdd}
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white font-extrabold text-xs shadow-sm transition active:scale-95 flex items-center gap-1.5 mx-auto cursor-pointer"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  Catat Baru
                </button>
              }
            />
          ) : (
            <div className="space-y-3 ft-stagger-in">
              {filteredRows.map((item) => {
                const isPaid = item.isPaid
                const isDebt = item.type === 'debt'
                const isEditingThisNote = editingNoteId === item.id
                const isSwiped = swipedId === item.id

                const glowClass = isPaid
                  ? 'loan-card-glow-paid'
                  : isDebt
                    ? 'loan-card-glow-debt'
                    : 'loan-card-glow-receivable'

                return (
                  <div
                    key={item.id}
                    className={`relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] ${glowClass} hover:border-[var(--border-strong)] transition-all`}
                  >
                    {/* Progressive Swipe Background (Habits Style) */}
                    <div className="absolute inset-0 z-0 flex items-center justify-end rounded-2xl px-5 opacity-0 transition-colors duration-200" />

                    {/* Swipable Compact Card Content (Front Layer) */}
                    <article
                      className="loan-entry relative z-10 bg-[var(--panel-strong)] p-3.5 space-y-2.5 touch-pan-y cursor-pointer"
                      onClick={(e) => {
                        if (isSwiped) {
                          openEdit(item, e)
                        }
                      }}
                      {...getSwipeHandlers(item.id, { onEdit: () => openEdit(item), onDelete: () => setDeletingLoan(item) })}
                    >
                      {/* Circular LUNAS Stamp for Paid Items */}
                      {isPaid && (
                        <div className={`loan-stamp ${isDebt ? 'loan-stamp-debt' : 'loan-stamp-receivable'}`}>
                          <b className="loan-stamp-text">LUNAS</b>
                          <span className="loan-stamp-sub">{item.dueDate || '100%'}</span>
                        </div>
                      )}

                      {/* Row 1 & 2: Header Block (Icon + Title + Due Badge / Person · Wallet) */}
                      <div className={`flex items-start justify-between gap-2.5 ${isPaid ? 'pr-14' : ''}`}>
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
                            {isPaid && (
                              <span
                                className="absolute -bottom-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-[var(--panel-strong)]"
                                title={'Lunas'}
                              >
                                <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={3} />
                              </span>
                            )}
                          </div>

                          {/* Title & Combined Subtitle */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <h4 className="truncate text-sm font-extrabold text-[var(--fg)]">
                                {item.title}
                              </h4>
                              {!isPaid && item.dueBadge && (
                                <span
                                  className={`shrink-0 rounded-full px-1.5 py-0.2 text-[9px] font-black border ${item.dueBadge.color}`}
                                >
                                  {item.dueBadge.text}
                                </span>
                              )}
                              {statusFilter === 'paid' && (
                                <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[9px] font-black bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> Lunas
                                </span>
                              )}
                            </div>

                            {/* Combined Person · Wallet (Single line) */}
                            <p className="mt-0.5 text-[11px] font-bold text-[var(--muted)] truncate">
                              <span>{item.personName}</span>
                              {item.walletId && walletMap.has(Number(item.walletId)) && (
                                <span> · {walletMap.get(Number(item.walletId))}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Row 3: Compact Progress Bar + Nominal Inline */}
                      <div className="flex items-center gap-2.5 pt-0.5">
                        <div className="h-2 flex-1 rounded-full bg-[var(--field-bg)] border border-[var(--border)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isPaid ? 'bg-emerald-500' : isDebt ? 'bg-[var(--earthy-terra)]' : 'bg-[var(--earthy-green)]'
                            }`}
                            style={{ width: `${isPaid ? 100 : item.pct}%` }}
                          />
                        </div>

                        <div className="shrink-0 text-[11px] font-extrabold tabular-nums">
                          {isPaid ? (
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
                            placeholder={'Tulis catatan singkat...'}
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
                            Simpan
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingNoteId(null)}
                            className="px-2 py-1 rounded-xl border border-[var(--border)] text-[var(--muted)] text-[11px] font-bold cursor-pointer shrink-0"
                          >
                            Batal
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
                                title={'Klik untuk mengedit catatan'}
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
                                <Plus className="h-2.5 w-2.5" /> Catatan
                              </button>
                            )}
                          </div>

                          {/* CTA Button side (right) */}
                          {!isPaid && (
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
                              {isDebt ? 'Bayar' : 'Terima'}
                            </button>
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

      <LoanPaymentModal isOpen={isPayOpen} onClose={() => setIsPayOpen(false)} loan={payLoan} />

      <ConfirmDeleteModal
        isOpen={!!deletingLoan}
        onClose={() => setDeletingLoan(null)}
        onConfirm={async () => {
          if (deletingLoan) {
            await deleteLoan(deletingLoan.id)
            setDeletingLoan(null)
          }
        }}
        title={'Hapus Catatan Pinjaman'}
        message="Apakah Anda yakin ingin menghapus catatan pinjaman ini beserta seluruh riwayat pembayarannya?"
      />
    </div>
  )
}
