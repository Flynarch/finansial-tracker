import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Button from '../ui/Button'
import ToastBanner from '../ui/ToastBanner'
import BottomSheet from '../ui/BottomSheet'
import { db } from '../../lib/db'
import useLoanStore from '../../store/useLoanStore'
import useSettingsStore from '../../store/useSettingsStore'
import useBottomSheet from '../../hooks/useBottomSheet'
import {
  formatCurrency,
  formatMoneyInput,
  formatMoneyValueForInput,
  getMoneyInputCaret,
  parseMoneyInput,
  toSafeNumber,
} from '../../lib/utils'
import { HandCoins, Receipt, Calendar, FileText, CheckCircle2, ArrowRight, Sparkles, Wallet, History } from 'lucide-react'

export default function LoanPaymentModal({ isOpen, onClose, loan = null, onSaved }) {
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const { recordPayment } = useLoanStore()
  const { closeSheet } = useBottomSheet({ isOpen, onClose })
  const [sheetError, setSheetError] = useState('')
  const amountInputRef = useRef(null)

  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  const connectedWallet = useLiveQuery(
    async () => {
      if (!loan?.walletId) return null
      return await db.wallets.get(Number(loan.walletId))
    },
    [loan?.walletId],
    null,
  )

  const paymentLogs = useLiveQuery(
    async () => {
      if (!loan?.id) return []
      return await db.loanPayments.where('loanId').equals(loan.id).reverse().toArray()
    },
    [loan?.id],
    [],
  )

  useEffect(() => {
    if (isOpen) {
      setSheetError('')
      setAmount('')
      setDate(new Date().toISOString().split('T')[0])
      setNotes('')
    }
  }, [isOpen, loan])

  if (!loan) return null

  const currency = loan.currency || defaultCurrency
  const total = toSafeNumber(loan.totalAmount)
  const remaining = Math.max(0, toSafeNumber(loan.remainingAmount))
  const paidAlready = Math.max(0, total - remaining)
  const isDebt = loan.type === 'debt'

  const currentPayValue = parseMoneyInput(amount, currency) || 0
  const nextRemaining = Math.max(0, remaining - currentPayValue)
  const isWillBePaidFull = currentPayValue >= remaining && remaining > 0

  const currentPct = total > 0 ? Math.min(100, Math.max(0, (paidAlready / total) * 100)) : 0
  const nextPaidTotal = paidAlready + currentPayValue
  const nextPct = total > 0 ? Math.min(100, Math.max(0, (nextPaidTotal / total) * 100)) : 0

  const handleAmountChange = (e) => {
    const el = e.target
    const nextFormatted = formatMoneyInput(el.value, currency)
    const caretPos = getMoneyInputCaret(el.value, nextFormatted, el.selectionStart ?? el.value.length, currency)
    setAmount(nextFormatted)
    window.requestAnimationFrame(() => el.setSelectionRange(caretPos, caretPos))
  }

  const setAmountPercent = (pct) => {
    const targetAmt = Math.round((remaining * pct) / 100)
    setAmount(formatMoneyValueForInput(targetAmt, currency))
  }

  const addAmountIncrement = (val) => {
    const nextVal = Math.min(remaining, currentPayValue + val)
    setAmount(formatMoneyValueForInput(nextVal, currency))
  }

  const handleSave = async () => {
    const payAmt = parseMoneyInput(amount, currency)
    if (payAmt <= 0) {
      setSheetError('Nominal pembayaran harus lebih dari 0.')
      return
    }

    if (payAmt > remaining) {
      setSheetError(`Nominal pembayaran (${formatCurrency(payAmt, currency)}) tidak boleh melebihi sisa tagihan (${formatCurrency(remaining, currency)}).`)
      return
    }

    try {
      await recordPayment(loan.id, payAmt, date, notes.trim())
      onSaved?.()
      closeSheet()
    } catch (err) {
      setSheetError(err.message || 'Gagal mencatat pembayaran. Silakan coba lagi.')
    }
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={closeSheet}
      title={isDebt ? 'Bayar Cicilan Hutang' : 'Terima Pembayaran Piutang'}
    >
      <div className="space-y-2.5 pt-0.5 pb-2">
        {sheetError ? <ToastBanner message={sheetError} type="error" onDismiss={() => setSheetError('')} /> : null}

        {/* Hero Context Header */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 space-y-2 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${
                  isDebt
                    ? 'bg-rose-500/15 text-rose-500 border-rose-500/25'
                    : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25'
                }`}
              >
                {isDebt ? <HandCoins className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <h4 className="truncate text-sm font-extrabold text-[var(--fg)]">{loan.title}</h4>
                <p className="text-[11px] font-semibold text-[var(--muted)] truncate">
                  {isDebt ? 'Pemberi: ' : 'Peminjam: '}
                  <span className="text-[var(--fg)]">{loan.personName}</span>
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">Sisa Tagihan</span>
              <p className={`text-sm sm:text-base font-black tabular-nums ${isDebt ? 'text-rose-500' : 'text-emerald-500'}`}>
                {formatCurrency(remaining, currency)}
              </p>
            </div>
          </div>

          {/* Wallet Badge Link */}
          <div className="flex items-center gap-1.5 pt-0.5 border-t border-[var(--border)]/60 text-[10px] font-bold">
            <Wallet className="h-3 w-3 text-[var(--accent)] shrink-0" />
            {connectedWallet ? (
              <span className="text-[var(--fg)]">
                Terhubung ke Wallet: <strong className="text-[var(--accent)]">{connectedWallet.name}</strong> (Transaksi ledger otomatis)
              </span>
            ) : (
              <span className="text-[var(--muted)]">
                Pinjaman ini hanya catatan memo (tidak terhubung ke wallet)
              </span>
            )}
          </div>

          {/* Progress Bar Dynamic Preview */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-extrabold text-[var(--muted)]">
              <span>Progress Pelunasan</span>
              <span className="tabular-nums">{Math.round(nextPct)}%</span>
            </div>
            <div className="relative h-2.5 w-full rounded-full bg-[var(--field-bg)] border border-[var(--border)] overflow-hidden">
              <div
                className={`absolute top-0 left-0 h-full rounded-full transition-all duration-300 opacity-50 ${
                  isDebt ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${currentPct}%` }}
              />
              <div
                className={`absolute top-0 left-0 h-full rounded-full transition-all duration-300 ${
                  isWillBePaidFull ? 'bg-emerald-500' : isDebt ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${nextPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Input Money Area */}
        <div className={`rounded-2xl border p-3 space-y-2.5 transition-all ${
          currentPayValue > 0
            ? isDebt
              ? 'bg-rose-500/5 border-rose-500/25'
              : 'bg-emerald-500/5 border-emerald-500/25'
            : 'bg-[var(--field-bg)] border-[var(--border)]'
        }`}>
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Nominal {isDebt ? 'Pembayaran' : 'Penerimaan'}
            </label>
            <span className="text-[11px] font-black text-[var(--muted)]">{currency}</span>
          </div>

          <div className="relative flex items-center">
            <input
              ref={amountInputRef}
              type="text"
              inputMode="decimal"
              className={`w-full bg-transparent text-xl sm:text-2xl font-black tabular-nums tracking-tight focus:outline-none ${
                currentPayValue > 0
                  ? isDebt
                    ? 'text-rose-500 placeholder-rose-300'
                    : 'text-emerald-500 placeholder-emerald-300'
                  : 'text-[var(--fg)] placeholder-[var(--muted)]'
              }`}
              placeholder="0"
              value={amount}
              onChange={handleAmountChange}
            />
          </div>

          {/* Quick Presets — Separated by Category */}
          <div className="pt-1 space-y-2 border-t border-[var(--border)]/40">
            {/* Set Value Group */}
            <div className="space-y-1">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--muted)]">Set Nominal:</span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setAmountPercent(100)}
                  className="py-1 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-extrabold hover:bg-[var(--accent)]/20 transition-colors cursor-pointer active:scale-95 flex items-center justify-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  Lunas (100%)
                </button>
                <button
                  type="button"
                  onClick={() => setAmountPercent(50)}
                  className="py-1 rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] text-[10px] font-extrabold text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors cursor-pointer active:scale-95 text-center"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => setAmountPercent(25)}
                  className="py-1 rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] text-[10px] font-extrabold text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors cursor-pointer active:scale-95 text-center"
                >
                  25%
                </button>
              </div>
            </div>

            {/* Incremental Add Group */}
            <div className="space-y-1">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--muted)]">Tambah Nominal:</span>
              <div className="grid grid-cols-3 gap-1.5">
                {[50000, 100000, 500000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => addAmountIncrement(amt)}
                    className="py-1 rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] text-[10px] font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors cursor-pointer text-center active:scale-95"
                  >
                    +{amt >= 1000000 ? `${amt / 1000000}Jt` : `${amt / 1000}Rb`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Balance Impact Card */}
        {currentPayValue > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="text-[9px] font-extrabold text-[var(--muted)] uppercase tracking-wider block">Sebelum</span>
              <span className="font-bold tabular-nums text-[var(--fg)]">{formatCurrency(remaining, currency)}</span>
            </div>

            <ArrowRight className="h-3.5 w-3.5 text-[var(--muted)] shrink-0 mx-1" />

            <div className="space-y-0.5">
              <span className="text-[9px] font-extrabold text-[var(--muted)] uppercase tracking-wider block">Bayar</span>
              <span className="font-black tabular-nums text-[var(--accent)]">-{formatCurrency(currentPayValue, currency)}</span>
            </div>

            <ArrowRight className="h-3.5 w-3.5 text-[var(--muted)] shrink-0 mx-1" />

            <div className="space-y-0.5 text-right">
              <span className="text-[9px] font-extrabold text-[var(--muted)] uppercase tracking-wider block">Sisa Baru</span>
              {isWillBePaidFull ? (
                <span className="inline-flex items-center gap-1 text-emerald-500 font-black">
                  <CheckCircle2 className="h-3 w-3" /> Lunas!
                </span>
              ) : (
                <span className={`font-black tabular-nums ${isDebt ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {formatCurrency(nextRemaining, currency)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Input Details Card */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--fg)] flex items-center gap-1">
                <Calendar className="h-3 w-3 text-[var(--muted)]" />
                Tanggal
              </label>
              <input
                type="date"
                className="ft-input w-full text-xs font-semibold py-1.5"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--fg)] flex items-center gap-1">
                <FileText className="h-3 w-3 text-[var(--muted)]" />
                Catatan
              </label>
              <input
                type="text"
                className="ft-input w-full text-xs font-semibold py-1.5"
                placeholder="Transfer BCA, dsb..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Riwayat Cicilan Ringkas */}
        {paymentLogs && paymentLogs.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
              <History className="h-3 w-3" />
              Riwayat Pembayaran ({paymentLogs.length})
            </span>
            <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
              {paymentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between text-xs py-1 border-b border-[var(--border)]/40 last:border-0">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--fg)] truncate">{log.notes || 'Pembayaran Cicilan'}</p>
                    <p className="text-[9px] text-[var(--muted)]">{log.date}</p>
                  </div>
                  <span className="font-extrabold tabular-nums text-emerald-500 shrink-0">
                    +{formatCurrency(log.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={closeSheet}>
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className={isDebt ? '!bg-rose-500 hover:!bg-rose-600 !text-white' : '!bg-emerald-500 hover:!bg-emerald-600 !text-white'}
          >
            {isDebt ? 'Konfirmasi Pembayaran' : 'Konfirmasi Penerimaan'}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
