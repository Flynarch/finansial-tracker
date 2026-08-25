import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Button from '../ui/Button'
import ToastBanner from '../ui/ToastBanner'
import Modal from '../ui/Modal'
import WalletSelectModal, { WalletSelectTrigger } from '../ui/WalletSelectModal'
import CustomDatePicker from '../ui/CustomDatePicker'
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
} from '../../lib/utils'
import {
  HandCoins,
  Receipt,
  Calculator,
  ChevronDown,
  Lock,
  Tag,
  User,
  Wallet,
  Calendar,
  FileText,
  RotateCcw,
} from 'lucide-react'

export default function LoanSheetModal({ isOpen, onClose, editingLoan = null, defaultType = 'debt', onSaved }) {
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const { addLoan, updateLoan } = useLoanStore()
  const [sheetError, setSheetError] = useState('')
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [showSimulator, setShowSimulator] = useState(false)
  const totalAmountInputRef = useRef(null)

  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.isArchived).toArray(), [], [])

  const [form, setForm] = useState({
    type: defaultType,
    personName: '',
    title: '',
    totalAmount: '',
    dueDate: '',
    startDate: new Date().toISOString().split('T')[0],
    notes: '',
    walletId: '',
    currency: defaultCurrency,
    interestRate: '',
    tenorMonths: '',
  })

  const selectedWallet = (wallets || []).find((w) => String(w.id) === String(form.walletId))

  const hasPaymentsRecorded = editingLoan
    ? (editingLoan.paymentTransactionIds?.length > 0 || editingLoan.remainingAmount < editingLoan.totalAmount)
    : false

  const [prevOpen, setPrevOpen] = useState(isOpen)
  const [prevEditingLoan, setPrevEditingLoan] = useState(editingLoan)

  if (prevOpen !== isOpen || prevEditingLoan !== editingLoan) {
    setPrevOpen(isOpen)
    setPrevEditingLoan(editingLoan)
    if (isOpen) {
      setSheetError('')
      if (editingLoan) {
        setForm({
          type: editingLoan.type || defaultType,
          personName: editingLoan.personName || '',
          title: editingLoan.title || '',
          totalAmount: formatMoneyValueForInput(editingLoan.totalAmount, editingLoan.currency || defaultCurrency),
          dueDate: editingLoan.dueDate || '',
          startDate: editingLoan.startDate || new Date().toISOString().split('T')[0],
          notes: editingLoan.notes || '',
          walletId: editingLoan.walletId ? String(editingLoan.walletId) : '',
          currency: editingLoan.currency || defaultCurrency,
          interestRate: editingLoan.interestRate ? String(editingLoan.interestRate) : '',
          tenorMonths: editingLoan.tenorMonths ? String(editingLoan.tenorMonths) : '',
        })
        setShowSimulator(Boolean(editingLoan.interestRate || editingLoan.tenorMonths))
      } else {
        const firstW = wallets && wallets.length > 0 ? wallets[0] : null
        setForm({
          type: defaultType,
          personName: '',
          title: '',
          totalAmount: '',
          dueDate: '',
          startDate: new Date().toISOString().split('T')[0],
          notes: '',
          walletId: firstW ? String(firstW.id) : '',
          currency: firstW?.currency || defaultCurrency,
          interestRate: '',
          tenorMonths: '',
        })
        setShowSimulator(false)
      }
    }
  }

  const handleTotalAmountChange = (e) => {
    if (hasPaymentsRecorded) return
    const el = e.target
    const nextFormatted = formatMoneyInput(el.value, form.currency)
    const caretPos = getMoneyInputCaret(el.value, nextFormatted, el.selectionStart ?? el.value.length, form.currency)
    setForm((prev) => ({ ...prev, totalAmount: nextFormatted }))
    window.requestAnimationFrame(() => el.setSelectionRange(caretPos, caretPos))
  }

  const clearAmount = () => {
    if (hasPaymentsRecorded) return
    setForm((prev) => ({ ...prev, totalAmount: '' }))
    totalAmountInputRef.current?.focus()
  }

  const isDebt = form.type === 'debt'
  const numericAmount = parseMoneyInput(form.totalAmount, form.currency) || 0

  const annualRate = parseFloat(form.interestRate) || 0
  const tenor = parseInt(form.tenorMonths, 10) || 0
  const monthlyRate = annualRate / 100 / 12

  let previewMonthlyPayment = 0
  let previewTotalInterest = 0

  if (numericAmount > 0 && tenor > 0) {
    if (annualRate > 0) {
      previewMonthlyPayment = Math.round(
        (numericAmount * (monthlyRate * Math.pow(1 + monthlyRate, tenor))) /
          (Math.pow(1 + monthlyRate, tenor) - 1),
      )
      const previewTotalRepayment = previewMonthlyPayment * tenor
      previewTotalInterest = Math.max(0, previewTotalRepayment - numericAmount)
    } else {
      previewMonthlyPayment = Math.round(numericAmount / tenor)
    }
  }

  const save = async () => {
    const total = parseMoneyInput(form.totalAmount, form.currency)
    if (!form.title.trim()) {
      setSheetError(t('loans.error.titleRequired', 'Judul pinjaman wajib diisi.'))
      return
    }
    if (!form.personName.trim()) {
      setSheetError(t('loans.error.personRequired', 'Nama pemberi/peminjam wajib diisi.'))
      return
    }
    if (total <= 0) {
      setSheetError(t('loans.error.amountPositive', 'Nominal harus lebih dari 0.'))
      return
    }
    if (!form.walletId) {
      setSheetError(t('loans.error.walletRequired', 'Dompet / akun transaksi wajib dipilih.'))
      return
    }

    const payload = {
      type: form.type,
      personName: form.personName.trim(),
      title: form.title.trim(),
      totalAmount: total,
      remainingAmount: editingLoan
        ? Math.min(editingLoan.remainingAmount, total)
        : total,
      dueDate: form.dueDate || null,
      startDate: form.startDate || new Date().toISOString().split('T')[0],
      notes: form.notes.trim(),
      walletId: Number(form.walletId),
      currency: form.currency,
      interestRate: form.interestRate ? parseFloat(form.interestRate) : 0,
      tenorMonths: form.tenorMonths ? parseInt(form.tenorMonths, 10) : 0,
      monthlyPayment: previewMonthlyPayment > 0 ? previewMonthlyPayment : null,
      status: editingLoan ? editingLoan.status : 'active',
    }

    try {
      if (editingLoan) {
        await updateLoan(editingLoan.id, payload)
      } else {
        await addLoan(payload)
      }
      onSaved?.()
      onClose?.()
    } catch (err) {
      setSheetError(err.message || t('loans.error.saveFailed', 'Gagal menyimpan data pinjaman. Silakan coba lagi.'))
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      title={
        editingLoan
          ? isDebt
            ? t('loans.modal.editDebt', 'Edit Hutang Saya')
            : t('loans.modal.editReceivable', 'Edit Piutang Saya')
          : isDebt
          ? t('loans.modal.createDebt', 'Catat Hutang Saya')
          : t('loans.modal.createReceivable', 'Catat Piutang Saya')
      }
    >
      {sheetError ? <ToastBanner message={sheetError} type="error" onDismiss={() => setSheetError('')} /> : null}

      <div className="space-y-2 pt-0.5 pb-0.5">
        {/* Row 1: Type Switcher with Smooth Sliding Indicator */}
        {!editingLoan && (
          <div className="relative grid grid-cols-2 rounded-xl bg-[var(--field-bg)] p-1 border border-[var(--border)] overflow-hidden select-none">
            {/* Sliding Animated Pill */}
            <div
              className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg shadow-xs transition-all duration-300 ease-out transform-gpu ${
                isDebt
                  ? 'translate-x-0 bg-[var(--earthy-terra)]'
                  : 'translate-x-[calc(100%+4px)] bg-[var(--earthy-green)]'
              }`}
            />

            <button
              type="button"
              className={`relative z-10 py-2 px-3 rounded-lg text-xs font-black transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
                isDebt ? 'text-white' : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
              onClick={() => setForm((p) => ({ ...p, type: 'debt' }))}
            >
              <HandCoins className={`h-3.5 w-3.5 transition-transform duration-200 ${isDebt ? 'scale-110' : 'scale-100'}`} />
              <span>{t('loans.myDebt', 'Utang Saya')}</span>
            </button>
            <button
              type="button"
              className={`relative z-10 py-2 px-3 rounded-lg text-xs font-black transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
                !isDebt ? 'text-white' : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
              onClick={() => setForm((p) => ({ ...p, type: 'receivable' }))}
            >
              <Receipt className={`h-3.5 w-3.5 transition-transform duration-200 ${!isDebt ? 'scale-110' : 'scale-100'}`} />
              <span>{t('loans.myReceivable', 'Piutang Saya')}</span>
            </button>
          </div>
        )}

        {/* Row 2: Hero Amount Box (Tanpa Inner Pill) */}
        <div
          className={`rounded-xl border p-2.5 space-y-1.5 transition-all ${
            isDebt
              ? 'border-[var(--earthy-terra)]/30 bg-[var(--earthy-terra-soft)]/20'
              : 'border-[var(--earthy-green)]/30 bg-[var(--earthy-green-soft)]/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
              <span>{t('loans.modal.amount', 'Nominal Pinjaman')}</span>
              <span className="text-rose-500">*</span>
            </span>
            {hasPaymentsRecorded ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded">
                <Lock className="h-2.5 w-2.5" /> {t('loans.modal.locked', 'Terkunci')}
              </span>
            ) : numericAmount > 0 ? (
              <button
                type="button"
                onClick={clearAmount}
                className="text-[9.5px] font-bold text-[var(--muted)] hover:text-rose-500 flex items-center gap-1 cursor-pointer transition-colors"
                title={t('loans.modal.reset', 'Reset')}
              >
                <RotateCcw className="h-2.5 w-2.5" />
                <span>{t('loans.modal.reset', 'Reset')}</span>
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <div className="relative flex items-center shrink-0">
              <select
                value={form.currency}
                disabled={hasPaymentsRecorded}
                onChange={(e) => {
                  const nextCurr = e.target.value
                  setForm((prev) => ({
                    ...prev,
                    currency: nextCurr,
                    totalAmount: formatMoneyInput(prev.totalAmount, nextCurr),
                  }))
                }}
                className={`appearance-none bg-transparent pr-4 text-xs sm:text-sm font-black text-[var(--fg)] outline-none cursor-pointer ${
                  hasPaymentsRecorded ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                {['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP'].map((c) => (
                  <option key={c} value={c} className="bg-[var(--panel-strong)] text-[var(--fg)]">
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 h-3 w-3 text-[var(--muted)] opacity-70" />
            </div>

            <div className="h-5 w-px bg-[var(--border)] shrink-0" />

            <div className="relative flex-1">
              <input
                ref={totalAmountInputRef}
                type="text"
                inputMode="numeric"
                disabled={hasPaymentsRecorded}
                className={`w-full bg-transparent border-0 py-0 text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-[var(--fg)] outline-none placeholder:text-[var(--muted)]/40 ${
                  hasPaymentsRecorded ? 'opacity-60 cursor-not-allowed' : ''
                }`}
                placeholder="0"
                value={form.totalAmount}
                onChange={handleTotalAmountChange}
              />
            </div>
          </div>
        </div>

        {/* Row 3: Judul / Keperluan */}
        <div className="space-y-0.5">
          <label className="text-[10px] font-bold text-[var(--muted)] flex items-center gap-1">
            <Tag className="h-3 w-3 shrink-0" />
            <span>{t('loans.modal.title', 'Judul / Keperluan')}</span>
            <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            className="ft-input w-full text-xs font-bold !py-1.5 !px-2.5 !rounded-xl"
            placeholder={
              isDebt
                ? t('loans.modal.titlePlaceholderDebt', 'Motor, Laptop, dll')
                : t('loans.modal.titlePlaceholderReceivable', 'Pinjamkan ke Andi')
            }
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          />
        </div>

        {/* Row 4: Pihak Terkait */}
        <div className="space-y-0.5">
          <label className="text-[10px] font-bold text-[var(--muted)] flex items-center gap-1">
            <User className="h-3 w-3 shrink-0" />
            <span>{isDebt ? t('loans.modal.personDebt', 'Pemberi Pinjaman') : t('loans.modal.personReceivable', 'Nama Peminjam')}</span>
            <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            className="ft-input w-full text-xs font-bold !py-1.5 !px-2.5 !rounded-xl"
            placeholder={
              isDebt
                ? t('loans.modal.personPlaceholderDebt', 'BCA, Budi, dll')
                : t('loans.modal.personPlaceholderReceivable', 'Andi, Rina, dll')
            }
            value={form.personName}
            onChange={(e) => setForm((prev) => ({ ...prev, personName: e.target.value }))}
          />
        </div>

        {/* Row 5: Dompet / Akun */}
        <div className="space-y-0.5">
          <label className="text-[10px] font-bold text-[var(--muted)] flex items-center gap-1">
            <Wallet className="h-3 w-3 shrink-0" />
            <span>{isDebt ? t('loans.modal.receiveWallet', 'Dompet Penerima') : t('loans.modal.sourceWallet', 'Dompet Sumber')}</span>
            <span className="text-rose-500">*</span>
          </label>
          <WalletSelectTrigger
            wallet={selectedWallet}
            placeholder={t('loans.selectWallet', 'Pilih Dompet / Akun')}
            compact
            onClick={() => setWalletModalOpen(true)}
            className="w-full !h-[32px] border border-[var(--border)] !rounded-xl text-xs !py-0 !px-2.5"
          />
          <WalletSelectModal
            isOpen={walletModalOpen}
            onClose={() => setWalletModalOpen(false)}
            wallets={wallets}
            selectedWalletId={form.walletId}
            onSelectWallet={(id) => {
              const matching = (wallets || []).find((w) => String(w.id) === String(id))
              const nextCurr = matching?.currency || defaultCurrency
              setForm((prev) => ({
                ...prev,
                walletId: id,
                currency: nextCurr,
                totalAmount: formatMoneyInput(prev.totalAmount, nextCurr),
              }))
            }}
            allowNone={false}
            title={t('wallets.selectTitle', 'Pilih Dompet')}
          />
        </div>

        {/* Row 6: Tanggal Pinjam & Jatuh Tempo (Tanpa Quick Chips) */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-0.5">
            <label className="text-[10px] font-bold text-[var(--muted)] flex items-center gap-1 truncate">
              <Calendar className="h-2.5 w-2.5 shrink-0" />
              <span>{t('loans.modal.startDate', 'Tanggal Pinjam')}</span>
            </label>
            <CustomDatePicker
              value={form.startDate}
              onChange={(d) => setForm((p) => ({ ...p, startDate: d }))}
              placeholder={t('loans.selectStartDate', 'Pilih Tanggal')}
            />
          </div>

          <div className="space-y-0.5">
            <label className="text-[10px] font-bold text-[var(--muted)] flex items-center gap-1 truncate">
              <Calendar className="h-2.5 w-2.5 shrink-0" />
              <span>{t('loans.modal.dueDate', 'Jatuh Tempo')}</span>
            </label>
            <CustomDatePicker
              value={form.dueDate}
              onChange={(d) => setForm((p) => ({ ...p, dueDate: d }))}
              placeholder={t('loans.selectDueDate', 'Pilih Jatuh Tempo')}
            />
          </div>
        </div>

        {/* Row 7: Catatan */}
        <div className="space-y-0.5">
          <label className="text-[10px] font-bold text-[var(--muted)] flex items-center gap-1">
            <FileText className="h-3 w-3 shrink-0" />
            <span>{t('loans.modal.notes', 'Catatan')}</span>
          </label>
          <input
            type="text"
            className="ft-input w-full text-xs font-semibold !py-1.5 !px-2.5 !rounded-xl"
            placeholder={t('loans.notesPlaceholder', 'Nomor rekening, keterangan, dll')}
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </div>

        {/* Row 8: Simulasi Bunga & Tenor (Smooth Expand/Collapse Animation) */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)]/40 overflow-hidden transition-all duration-300">
          <button
            type="button"
            onClick={() => setShowSimulator((p) => !p)}
            className="w-full py-1.5 px-2.5 flex items-center justify-between text-[10.5px] font-bold text-[var(--fg)] hover:bg-[var(--field-bg)]/60 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>{t('loans.modal.calcTitle', 'Simulasi Bunga & Tenor')}</span>
              {(annualRate > 0 || tenor > 0) && (
                <span className="px-1.5 py-0.2 text-[9px] font-black rounded-full bg-[var(--accent)] text-white">
                  {t('loans.modal.active', 'Aktif')}
                </span>
              )}
            </span>
            <span className="flex items-center text-[10px] text-[var(--muted)]">
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-300 ease-out transform ${
                  showSimulator ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </span>
          </button>

          <div
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
              showSimulator ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
            }`}
          >
            <div className="overflow-hidden">
              <div className="p-2 pt-1 space-y-1.5 border-t border-[var(--border)]/40">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9.5px] text-[var(--muted)] font-bold block mb-0.5">
                      {t('loans.modal.interestAnnual', 'Bunga (% / Tahun)')}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      className="ft-input w-full text-xs font-bold !py-1 !px-2 !rounded-lg font-mono"
                      placeholder="0"
                      value={form.interestRate}
                      onChange={(e) => setForm((prev) => ({ ...prev, interestRate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-[9.5px] text-[var(--muted)] font-bold block mb-0.5">
                      {t('loans.modal.tenorMonths', 'Tenor (Bulan)')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="360"
                      className="ft-input w-full text-xs font-bold !py-1 !px-2 !rounded-lg font-mono"
                      placeholder="12"
                      value={form.tenorMonths}
                      onChange={(e) => setForm((prev) => ({ ...prev, tenorMonths: e.target.value }))}
                    />
                  </div>
                </div>

                {previewMonthlyPayment > 0 && tenor > 0 && (
                  <div className="p-1.5 rounded-lg bg-[var(--panel-strong)] border border-[var(--border)] flex items-center justify-between text-[10px] tabular-nums font-bold animate-fadeIn">
                    <div>
                      <span className="text-[var(--muted)]">{t('loans.modal.installmentPerMonth', 'Cicilan/Bln')}: </span>
                      <span className="text-[var(--fg)] font-black">{formatCurrency(previewMonthlyPayment, form.currency, locale)}</span>
                    </div>
                    {annualRate > 0 && (
                      <div>
                        <span className="text-[var(--muted)]">{t('loans.modal.totalInterest', 'Total Bunga')}: </span>
                        <span className="text-amber-500 font-bold">+{formatCurrency(previewTotalInterest, form.currency, locale)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Row 9: Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--border)]/50">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="!py-1.5 !px-3.5 text-xs font-bold active:scale-95 transition-all cursor-pointer rounded-xl"
          >
            {t('common.cancel', 'Batal')}
          </Button>
          <Button
            type="button"
            onClick={save}
            className={`!py-1.5 !px-4.5 text-xs font-black shadow-md active:scale-95 transition-all cursor-pointer text-white rounded-xl ${
              isDebt
                ? '!bg-[var(--earthy-terra)] hover:opacity-95'
                : '!bg-[var(--earthy-green)] hover:opacity-95'
            }`}
          >
            {editingLoan
              ? t('common.saveChanges', 'Simpan Perubahan')
              : isDebt
              ? t('loans.modal.createDebt', 'Catat Utang')
              : t('loans.modal.createReceivable', 'Catat Piutang')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}







