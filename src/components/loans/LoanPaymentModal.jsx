import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Button from '../ui/Button'
import ToastBanner from '../ui/ToastBanner'
import Modal from '../ui/Modal'
import CustomDatePicker from '../ui/CustomDatePicker'
import WalletSelectModal, { WalletSelectTrigger } from '../ui/WalletSelectModal'
import { db } from '../../lib/db'
import useLoanStore from '../../store/useLoanStore'
import useSettingsStore from '../../store/useSettingsStore'
import useTranslation from '../../hooks/useTranslation'
import {
  formatCurrency,
  formatMoneyInput,
  formatMoneyValueForInput,
  getMoneyInputCaret,
  parseMoneyInput,
  toSafeNumber,
} from '../../lib/utils'
import { HandCoins, Receipt, Calendar, FileText, CheckCircle2, ArrowRight, Sparkles, Wallet, History, HeartHandshake, ChevronRight } from 'lucide-react'
import LoanForgiveModal from './LoanForgiveModal'
import CategoryPickerModal from '../transactions/CategoryPickerModal'
import CategoryIcon from '../ui/CategoryIcon'
import { formatExpenseCategory } from '../../lib/expenseCategories'
import { formatIncomeCategory } from '../../lib/incomeCategories'
import { hapticSuccess, hapticWarning } from '../../lib/haptics'
import { getLocalDateString } from '../../lib/dateUtils'
import { format } from 'date-fns'
import CanvasConfettiOverlay from '../ui/CanvasConfettiOverlay'

export default function LoanPaymentModal({ isOpen, onClose, loan: incomingLoan = null, initialAmount = null, onSaved, onOpenForgive }) {
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const defaultWalletId = useSettingsStore((state) => state.defaultWalletId)
  const recordPayment = useLoanStore((state) => state.recordPayment)
  const [sheetError, setSheetError] = useState('')
  const [showPayoffStamp, setShowPayoffStamp] = useState(false)
  const amountInputRef = useRef(null)

  const [cachedLoan, setCachedLoan] = useState(incomingLoan)
  const [prevIncomingLoan, setPrevIncomingLoan] = useState(incomingLoan)
  if (incomingLoan && incomingLoan !== prevIncomingLoan) {
    setPrevIncomingLoan(incomingLoan)
    setCachedLoan(incomingLoan)
  }
  const loan = incomingLoan || cachedLoan

  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(getLocalDateString())
  const [notes, setNotes] = useState('')
  const [paymentWalletId, setPaymentWalletId] = useState(
    incomingLoan?.walletId ? String(incomingLoan.walletId) : (defaultWalletId ? String(defaultWalletId) : '')
  )
  const [excessCategory, setExcessCategory] = useState(
    incomingLoan?.type === 'debt' ? 'tagihan/cicilan' : 'investasi/bunga_bank'
  )
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const [isForgiveOpen, setIsForgiveOpen] = useState(false)
  const [isExcessCategoryModalOpen, setIsExcessCategoryModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const allWallets = useLiveQuery(
    () => {
      if (!isOpen) return []
      return db.wallets.toArray()
    },
    [isOpen],
    []
  )

  const selectedPaymentWallet = (allWallets || []).find((w) => String(w.id) === String(paymentWalletId || loan?.walletId || defaultWalletId))

  const paymentLogs = useLiveQuery(
    async () => {
      if (!isOpen || !loan?.id) return []
      return await db.loanPayments.where('loanId').equals(loan.id).reverse().toArray()
    },
    [isOpen, loan?.id],
    [],
  )

  const [prevOpen, setPrevOpen] = useState(isOpen)
  const [prevLoanId, setPrevLoanId] = useState(loan?.id)

  if (prevOpen !== isOpen || prevLoanId !== loan?.id) {
    setPrevOpen(isOpen)
    setPrevLoanId(loan?.id)
    if (isOpen) {
      setSheetError('')
      const initAmtVal = initialAmount ? formatMoneyValueForInput(initialAmount, loan?.currency || defaultCurrency) : ''
      setAmount(initAmtVal)
      setDate(getLocalDateString())
      setNotes('')
      setPaymentWalletId(loan?.walletId ? String(loan.walletId) : (defaultWalletId ? String(defaultWalletId) : ''))
      setExcessCategory(loan?.type === 'debt' ? 'tagihan/cicilan' : 'investasi/bunga_bank')
      setIsExcessCategoryModalOpen(false)
    }
  }

  if (!loan) return null

  const currency = loan.currency || defaultCurrency
  const total = toSafeNumber(loan.totalAmount)
  const remaining = Math.max(0, toSafeNumber(loan.remainingAmount))
  const paidAlready = Math.max(0, total - remaining)
  const isDebt = loan.type === 'debt'

  const currentPayValue = parseMoneyInput(amount, currency) || 0
  const isOverpayment = currentPayValue > remaining
  const principalPortion = Math.min(currentPayValue, remaining)
  const excessPortion = Math.max(0, currentPayValue - remaining)
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
    const nextVal = currentPayValue + val
    setAmount(formatMoneyValueForInput(nextVal, currency))
  }

  const handleSave = async () => {
    if (isSubmitting) return
    const payAmt = parseMoneyInput(amount, currency)
    if (payAmt <= 0) {
      hapticWarning()
      setSheetError(t('loans.payment.amountPositive', 'Nominal pembayaran harus lebih dari 0.'))
      return
    }

    setIsSubmitting(true)
    try {
      const targetWalletId = paymentWalletId || loan?.walletId || (defaultWalletId ? String(defaultWalletId) : null)
      await recordPayment(
        loan.id,
        payAmt,
        date,
        notes.trim(),
        targetWalletId,
        currency,
        isOverpayment ? excessCategory : null
      )
      if (isWillBePaidFull) {
        setShowPayoffStamp(true)
        hapticSuccess()
        onSaved?.()
        setTimeout(() => {
          setShowPayoffStamp(false)
          onClose?.()
        }, 1300)
      } else {
        hapticSuccess()
        onSaved?.()
        onClose?.()
      }
    } catch (err) {
      console.warn('[LoanPaymentModal]', err)
      hapticWarning()
      setSheetError(err.message || t('loans.payment.saveFailed', 'Gagal mencatat pembayaran. Silakan coba lagi.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isDebt ? t('loans.payment.titleDebt', 'Bayar Cicilan Hutang') : t('loans.payment.titleReceivable', 'Terima Pembayaran Piutang')}
    >
      {showPayoffStamp && <CanvasConfettiOverlay duration={2000} />}
      <div className="relative space-y-2.5 pt-0.5 pb-2">
        {showPayoffStamp && (
          <div className="absolute inset-0 z-50 bg-[var(--panel-strong)]/90 backdrop-blur-xs flex flex-col items-center justify-center rounded-2xl animate-in fade-in duration-200">
            <div
              className={`loan-stamp ${isDebt ? 'loan-stamp-debt' : 'loan-stamp-receivable'} flex flex-col items-center justify-center text-center shadow-2xl`}
              style={{
                width: '6.5rem',
                height: '6.5rem',
                animation: 'stampPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
              }}
            >
              <span className="loan-stamp-text text-base sm:text-lg">
                {isDebt ? t('loans.status.paidDebt', 'LUNAS') : t('loans.status.paidReceivable', 'DITERIMA')}
              </span>
              <span className="loan-stamp-sub text-[10px]">
                {format(new Date(), 'dd/MM/yyyy')}
              </span>
            </div>
            <p className="mt-3 text-xs font-black text-[var(--fg)] tracking-tight">
              {isDebt ? t('loans.debtSettledCongrats', 'Utang telah lunas!') : t('loans.receivableSettledCongrats', 'Piutang telah diterima penuh!')}
            </p>
          </div>
        )}
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
                  {isDebt ? `${t('loans.modal.personDebt', 'Pemberi')}: ` : `${t('loans.modal.personReceivable', 'Peminjam')}: `}
                  <span className="text-[var(--fg)]">{loan.personName}</span>
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                {t('loans.payment.remainingLabel', 'Sisa Tagihan')}
              </span>
              <p className={`text-sm sm:text-base font-black tabular-nums ${isDebt ? 'text-rose-500' : 'text-emerald-500'}`}>
                {formatCurrency(remaining, currency)}
              </p>
            </div>
          </div>

          {/* Progress Bar Dynamic Preview */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-extrabold text-[var(--muted)]">
              <span>{t('loans.payment.progressLabel', 'Progress Pelunasan')}</span>
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
              {t('loans.payment.amountLabel', 'Nominal Pembayaran')}
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
                  : 'text-[var(--fg)] placeholder:[var(--muted)]'
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
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                {t('loans.payment.setNominal', 'Set Nominal:')}
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {loan?.monthlyPayment > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const installmentVal = remaining > 0 ? Math.min(remaining, toSafeNumber(loan.monthlyPayment)) : toSafeNumber(loan.monthlyPayment)
                      setAmount(formatMoneyValueForInput(installmentVal, currency))
                    }}
                    className="col-span-3 py-1.5 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-extrabold hover:bg-[var(--accent)]/20 transition-colors cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="h-3 w-3" />
                    {t('loans.payment.oneInstallment', '1x Cicilan')} ({formatCurrency(loan.monthlyPayment, currency)})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAmountPercent(100)}
                  className="py-1 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-extrabold hover:bg-[var(--accent)]/20 transition-colors cursor-pointer active:scale-95 flex items-center justify-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  {t('loans.paid', 'Lunas')} (100%)
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
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                {t('loans.payment.addNominal', 'Tambah Nominal:')}
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {((currency || 'IDR') === 'IDR' ? [50000, 100000, 500000] : [5, 10, 50]).map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => addAmountIncrement(amt)}
                    className="py-1 rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] text-[10px] font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors cursor-pointer text-center active:scale-95"
                  >
                    {(currency || 'IDR') === 'IDR'
                      ? `+${amt >= 1000000 ? `${amt / 1000000}Jt` : `${amt / 1000}Rb`}`
                      : `+${amt}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Balance Impact Card */}
        {currentPayValue > 0 && !isOverpayment && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="text-[9px] font-extrabold text-[var(--muted)] uppercase tracking-wider block">
                {t('loans.payment.before', 'Sebelum')}
              </span>
              <span className="font-bold tabular-nums text-[var(--fg)]">{formatCurrency(remaining, currency)}</span>
            </div>

            <ArrowRight className="h-3.5 w-3.5 text-[var(--muted)] shrink-0 mx-1" />

            <div className="space-y-0.5">
              <span className="text-[9px] font-extrabold text-[var(--muted)] uppercase tracking-wider block">
                {isDebt ? t('loans.action.pay', 'Bayar') : t('loans.action.receive', 'Terima')}
              </span>
              <span className="font-black tabular-nums text-[var(--accent)]">-{formatCurrency(currentPayValue, currency)}</span>
            </div>

            <ArrowRight className="h-3.5 w-3.5 text-[var(--muted)] shrink-0 mx-1" />

            <div className="space-y-0.5 text-right">
              <span className="text-[9px] font-extrabold text-[var(--muted)] uppercase tracking-wider block">
                {t('loans.payment.newRemaining', 'Sisa Baru')}
              </span>
              {isWillBePaidFull ? (
                <span className="inline-flex items-center gap-1 text-emerald-500 font-black">
                  <CheckCircle2 className="h-3 w-3" /> {t('loans.badge.paid', 'Lunas!')}
                </span>
              ) : (
                <span className={`font-black tabular-nums ${isDebt ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {formatCurrency(nextRemaining, currency)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Overpayment Breakdown Card */}
        {isOverpayment && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold uppercase tracking-wider text-amber-500 text-[10px]">
                {t('loans.payment.overpaymentBreakdown', 'Rincian Kelebihan Bayar')}
              </span>
              <span className="font-bold text-[10px] text-[var(--muted)]">
                {isDebt
                  ? t('loans.payment.excessExpense', 'Dicatat sebagai Pengeluaran')
                  : t('loans.payment.excessIncome', 'Dicatat sebagai Pemasukan')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-2 space-y-0.5">
                <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block">
                  {t('loans.payment.principalLabel', 'Pokok')}
                </span>
                <p className="font-extrabold text-[var(--fg)] tabular-nums">
                  {formatCurrency(principalPortion, currency)}{' '}
                  <span className="text-[10px] font-bold text-emerald-500">
                    ({t('loans.badge.paid', 'Lunas')})
                  </span>
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-2 space-y-0.5">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">
                  {t('loans.payment.excessLabel', 'Kelebihan')}
                </span>
                <p className="font-extrabold text-amber-500 tabular-nums">
                  +{formatCurrency(excessPortion, currency)}
                </p>
              </div>
            </div>

            {/* Category Selector for Excess */}
            <div className="space-y-1 pt-0.5">
              <label className="text-[11px] font-bold text-[var(--fg)] flex items-center justify-between">
                <span>{t('loans.payment.excessCategoryLabel', 'Kategori Kelebihan')}</span>
              </label>
              <button
                type="button"
                onClick={() => setIsExcessCategoryModalOpen(true)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] hover:bg-[var(--field-bg)] transition-colors text-left cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CategoryIcon
                    category={excessCategory}
                    txType={isDebt ? 'expense' : 'income'}
                    className="h-4 w-4 shrink-0 text-[var(--accent)]"
                  />
                  <span className="text-xs font-bold text-[var(--fg)] truncate">
                    {isDebt
                      ? formatExpenseCategory(excessCategory, locale)
                      : formatIncomeCategory(excessCategory, locale)}
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)] shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* Input Details Card */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 space-y-2">
          {/* Wallet Selector */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[var(--fg)] flex items-center gap-1">
              <Wallet className="h-3 w-3 text-[var(--muted)]" />
              {isDebt
                ? t('loans.payment.walletSourceDebt', 'Dompet Sumber Dana (Pengeluaran)')
                : t('loans.payment.walletSourceReceivable', 'Dompet Penerima Dana (Pemasukan)')}
            </label>
            <WalletSelectTrigger
              wallet={selectedPaymentWallet}
              placeholder={t('loans.payment.selectWallet', 'Pilih Dompet Transaksi')}
              onClick={() => setIsWalletModalOpen(true)}
            />
            <WalletSelectModal
              isOpen={isWalletModalOpen}
              onClose={() => setIsWalletModalOpen(false)}
              selectedWalletId={paymentWalletId || loan?.walletId || defaultWalletId}
              onSelectWallet={(wId) => {
                setPaymentWalletId(wId)
                setIsWalletModalOpen(false)
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--fg)] flex items-center gap-1">
                <Calendar className="h-3 w-3 text-[var(--muted)]" />
                {t('loans.payment.dateLabel', 'Tanggal')}
              </label>
              <CustomDatePicker
                value={date}
                onChange={(val) => setDate(val)}
                title={t('loans.paymentDateTitle', 'Pilih Tanggal Pembayaran')}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--fg)] flex items-center gap-1">
                <FileText className="h-3 w-3 text-[var(--muted)]" />
                {t('loans.payment.notesLabel', 'Catatan')}
              </label>
              <input
                type="text"
                className="ft-input w-full text-xs font-semibold py-1.5"
                placeholder={t('loans.paymentNotesPlaceholder', 'Transfer BCA, dsb...')}
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
              {t('loans.payment.historyCount', { count: paymentLogs.length }, `Riwayat Pembayaran (${paymentLogs.length})`)}
            </span>
            <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
              {paymentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between text-xs py-1 border-b border-[var(--border)]/40 last:border-0">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="font-semibold text-[var(--fg)] flex items-center gap-1 min-w-0">
                      {log.isForgive && <HeartHandshake className="h-3 w-3 text-purple-500 shrink-0" />}
                      <span className="break-words [overflow-wrap:anywhere] break-all line-clamp-2">
                        {log.notes || (log.isForgive ? t('loans.badge.forgiven', 'Diikhlaskan') : t('loans.payment.defaultLog', 'Pembayaran Cicilan'))}
                      </span>
                    </p>
                    <p className="text-[9px] text-[var(--muted)]">{log.date}</p>
                  </div>
                  {log.isForgive ? (
                    <span className="font-black tabular-nums text-purple-500 shrink-0 text-[11px] bg-purple-500/10 px-1.5 py-0.5 rounded-lg border border-purple-500/20">
                      {formatCurrency(log.amount, currency)}
                    </span>
                  ) : loan?.type === 'debt' ? (
                    <span className="font-extrabold tabular-nums text-rose-500 shrink-0">
                      -{formatCurrency(log.amount, currency)}
                    </span>
                  ) : (
                    <span className="font-extrabold tabular-nums text-emerald-500 shrink-0">
                      +{formatCurrency(log.amount, currency)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Forgive Option */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => {
              if (typeof onOpenForgive === 'function') {
                onOpenForgive(loan)
              } else {
                setIsForgiveOpen(true)
              }
            }}
            className="w-full py-2 px-3 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
          >
            <HeartHandshake className="h-3.5 w-3.5" />
            <span>{isDebt ? t('loans.action.forgiveDebtPrompt', 'Ikhlaskan / Pemutihan Sisa Hutang Ini') : t('loans.action.forgiveReceivablePrompt', 'Ikhlaskan / Relakan Sisa Piutang Ini')}</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel', 'Batal')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className={isDebt ? '!bg-rose-500 hover:!bg-rose-600 !text-white' : '!bg-emerald-500 hover:!bg-emerald-600 !text-white'}
          >
            {isOverpayment
              ? `${isDebt ? t('loans.action.pay', 'Bayar') : t('loans.action.receive', 'Terima')} ${formatCurrency(currentPayValue, currency)} (${t('loans.badge.paid', 'Lunas')} + ${t('loans.payment.excessShort', 'Kelebihan')} ${formatCurrency(excessPortion, currency)})`
              : isDebt
              ? t('loans.payment.save', 'Konfirmasi Pembayaran')
              : t('loans.payment.saveReceivable', 'Konfirmasi Penerimaan')}
          </Button>
        </div>
      </div>

      <CategoryPickerModal
        isOpen={isExcessCategoryModalOpen}
        onClose={() => setIsExcessCategoryModalOpen(false)}
        txType={isDebt ? 'expense' : 'income'}
        selectedCategory={excessCategory}
        onSelectCategory={(cat) => {
          setExcessCategory(cat)
          setIsExcessCategoryModalOpen(false)
        }}
      />

      {!onOpenForgive && (
        <LoanForgiveModal
          isOpen={isForgiveOpen}
          onClose={() => setIsForgiveOpen(false)}
          loan={loan}
          onSuccess={() => {
            onSaved?.()
            onClose?.()
          }}
        />
      )}
    </Modal>
  )
}
