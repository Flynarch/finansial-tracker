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
import { convertCurrency, formatCurrency, toSafeNumber } from '../lib/utils'
import { Plus, ChevronLeft, Edit2, Trash2, HandCoins, Receipt, CheckCircle2, AlertCircle, Clock, FileText } from 'lucide-react'
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

  const { isOpen: isSheetOpen, openSheet, closeSheet } = useBottomSheet(false)
  const [editingLoan, setEditingLoan] = useState(null)
  const [deletingLoan, setDeletingLoan] = useState(null)

  const [payLoan, setPayLoan] = useState(null)
  const [isPayOpen, setIsPayOpen] = useState(false)

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

  // Calculate totals and format row data
  const rows = useMemo(() => {
    return (loans ?? []).map((l) => {
      const total = toSafeNumber(l.totalAmount)
      const remaining = toSafeNumber(l.remainingAmount)
      const paid = Math.max(0, total - remaining)
      const pct = total > 0 ? Math.min(100, Math.max(0, (paid / total) * 100)) : 0

      let dueText = null
      let isOverdue = false
      if (l.dueDate && l.status !== 'paid') {
        const daysLeft = differenceInDays(new Date(l.dueDate), new Date())
        if (daysLeft < 0) {
          dueText = 'Terlambat'
          isOverdue = true
        } else if (daysLeft === 0) {
          dueText = 'Jatuh Tempo Hari Ini'
        } else {
          dueText = `${daysLeft} Hari Lagi`
        }
      }

      return {
        ...l,
        total,
        remaining,
        paid,
        pct,
        dueText,
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
      if (r.type === 'debt' && r.status !== 'paid') {
        totalDebt += val
      } else if (r.type === 'receivable' && r.status !== 'paid') {
        totalReceivable += val
      }

      if (r.dueDate && r.dueDate.startsWith(currentMonthStr) && r.status !== 'paid') {
        dueThisMonthCount += 1
      }
    })

    return { totalDebt, totalReceivable, dueThisMonthCount }
  }, [defaultCurrency, rows])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => r.type === activeTab)
  }, [rows, activeTab])

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
              <h2 className="text-xl font-black tracking-tight text-[var(--fg)]">{t('loans.title') || 'Utang & Piutang'}</h2>
              <p className="text-xs font-bold text-[var(--muted)] truncate">{t('loans.subtitle') || 'Kelola kewajiban utang dan tagihan piutang.'}</p>
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
        <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-sm space-y-3">
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

          {totals.dueThisMonthCount > 0 && (
            <div className="pt-2 border-t border-[var(--border)]/60 flex items-center gap-1.5 text-xs font-bold text-amber-500">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{totals.dueThisMonthCount} pinjaman jatuh tempo bulan ini</span>
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setActiveTab('debt')}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'debt'
                ? 'bg-[var(--earthy-terra)] text-white shadow-xs'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            <HandCoins className="h-3.5 w-3.5" />
            Utang Saya ({rows.filter((r) => r.type === 'debt').length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('receivable')}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'receivable'
                ? 'bg-[var(--earthy-green)] text-white shadow-xs'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            Piutang Saya ({rows.filter((r) => r.type === 'receivable').length})
          </button>
        </div>

        {/* List of Loans */}
        <div className="space-y-3 pt-1">
          {filteredRows.length === 0 ? (
            <EmptyState
              title={activeTab === 'debt' ? 'Belum Ada Catatan Utang' : 'Belum Ada Catatan Piutang'}
              description={activeTab === 'debt' ? 'Tekan "Catat Baru" untuk menambah catatan utang Anda.' : 'Tekan "Catat Baru" untuk menambah catatan uang yang dipinjam orang lain.'}
            />
          ) : (
            <div className="space-y-3 ft-stagger-in">
              {filteredRows.map((item) => {
                const isPaid = item.status === 'paid' || item.remaining <= 0
                const isDebt = item.type === 'debt'

                return (
                  <div
                    key={item.id}
                    className="group relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-2xs hover:border-[var(--border-strong)] transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${
                            isDebt
                              ? 'bg-[var(--earthy-terra-soft)] text-[var(--earthy-terra)] border-[var(--earthy-terra)]/25'
                              : 'bg-[var(--earthy-green-soft)] text-[var(--earthy-green)] border-[var(--earthy-green)]/25'
                          }`}
                        >
                          {isDebt ? <HandCoins className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
                        </div>

                        <div className="min-w-0">
                          <h4 className="truncate text-base font-extrabold text-[var(--fg)]">
                            {item.title}
                          </h4>
                          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold text-[var(--muted)] truncate">
                              {isDebt ? 'Pemberi: ' : 'Peminjam: '}
                              <span className="text-[var(--fg)]">{item.personName}</span>
                            </p>
                            {item.walletId && walletMap.has(Number(item.walletId)) ? (
                              <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold bg-[var(--field-bg)] border border-[var(--border)] text-[var(--accent)]">
                                {walletMap.get(Number(item.walletId))}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold bg-[var(--field-bg)] border border-[var(--border)] text-[var(--muted)]">
                                <FileText className="h-2.5 w-2.5" /> Memo
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                            isPaid
                              ? 'bg-[var(--earthy-green-soft)] text-[var(--earthy-green)] border border-[var(--earthy-green)]/25'
                              : item.status === 'partially_paid'
                                ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                                : item.isOverdue
                                  ? 'bg-[var(--earthy-terra-soft)] text-[var(--earthy-terra)] border border-[var(--earthy-terra)]/25'
                                  : 'bg-[var(--field-bg)] text-[var(--muted)] border border-[var(--border)]'
                          }`}
                        >
                          {isPaid ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              Lunas
                            </>
                          ) : item.status === 'partially_paid' ? (
                            'Sebagian Lunas'
                          ) : item.isOverdue ? (
                            <>
                              <AlertCircle className="h-3 w-3" />
                              Terlambat
                            </>
                          ) : (
                            'Aktif'
                          )}
                        </span>
                        {item.dueText && !isPaid && (
                          <span
                            className={`text-[10px] font-extrabold ${
                              item.isOverdue ? 'text-[var(--earthy-terra)]' : 'text-[var(--muted)]'
                            }`}
                          >
                            {item.dueText}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3.5 h-2.5 w-full rounded-full bg-[var(--field-bg)] border border-[var(--border)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isPaid ? 'bg-[var(--earthy-green)]' : isDebt ? 'bg-[var(--earthy-terra)]' : 'bg-[var(--earthy-green)]'
                        }`}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>

                    {/* Info balance */}
                    <div className="mt-2 flex items-center justify-between text-[11px] font-bold">
                      <span className="text-[var(--muted)]">
                        {isPaid ? (
                          <span className="text-[var(--earthy-green)] font-extrabold">Pinjaman Lunas</span>
                        ) : (
                          <>
                            Sisa <span className="text-[var(--fg)] font-black">{formatCurrency(item.remaining, item.currency || defaultCurrency)}</span> lagi
                          </>
                        )}
                      </span>
                      <span className="text-[var(--muted)] tabular-nums">
                        Total: {formatCurrency(item.total, item.currency || defaultCurrency)}
                      </span>
                    </div>

                    {/* Actions Bar */}
                    <div className="mt-3.5 pt-3 border-t border-[var(--border)]/60 flex items-center justify-between gap-2">
                      <div>
                        {!isPaid && (
                          <button
                            type="button"
                            onClick={(e) => openPaymentModal(item, e)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer active:scale-95 border ${
                              isDebt
                                ? 'bg-[var(--earthy-terra-soft)] text-[var(--earthy-terra)] border-[var(--earthy-terra)]/25 hover:bg-[var(--earthy-terra)]/20'
                                : 'bg-[var(--earthy-green-soft)] text-[var(--earthy-green)] border-[var(--earthy-green)]/25 hover:bg-[var(--earthy-green)]/20'
                            }`}
                          >
                            <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                            {isDebt ? 'Bayar Cicilan' : 'Terima Cicilan'}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => openEdit(item, e)}
                          className="p-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
                          title="Edit Catatan"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeletingLoan(item)
                          }}
                          className="p-1.5 rounded-xl border border-[var(--earthy-terra)]/30 bg-[var(--earthy-terra-soft)] text-[var(--earthy-terra)] hover:bg-[var(--earthy-terra)]/20 transition-colors cursor-pointer"
                          title="Hapus Catatan"
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

      {/* Modals */}
      <LoanSheetModal
        isOpen={isSheetOpen}
        onClose={closeSheet}
        editingLoan={editingLoan}
        defaultType={activeTab}
      />

      <LoanPaymentModal
        isOpen={isPayOpen}
        onClose={() => setIsPayOpen(false)}
        loan={payLoan}
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
        title="Hapus Catatan Pinjaman"
        message="Apakah Anda yakin ingin menghapus catatan pinjaman ini beserta seluruh riwayat pembayarannya?"
      />
    </div>
  )
}
