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
import useBottomSheet from '../../hooks/useBottomSheet'
import {
  formatMoneyInput,
  formatMoneyValueForInput,
  getMoneyInputCaret,
  parseMoneyInput,
} from '../../lib/utils'

export default function LoanSheetModal({ isOpen, onClose, editingLoan = null, defaultType = 'debt', onSaved }) {
  const { t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const { addLoan, updateLoan } = useLoanStore()
  const { closeSheet } = useBottomSheet({ isOpen, onClose })
  const [sheetError, setSheetError] = useState('')
  const [walletModalOpen, setWalletModalOpen] = useState(false)
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
      } else {
        setForm({
          type: defaultType,
          personName: '',
          title: '',
          totalAmount: '',
          dueDate: '',
          startDate: new Date().toISOString().split('T')[0],
          notes: '',
          walletId: wallets && wallets.length > 0 ? String(wallets[0].id) : '',
          currency: defaultCurrency,
          interestRate: '',
          tenorMonths: '',
        })
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
      setSheetError(t('loans.error.amountPositive', 'Nominal pinjaman harus lebih dari 0.'))
      return
    }
    if (!form.walletId) {
      setSheetError(t('loans.error.walletRequired', 'Dompet / akun wajib dipilih.'))
      return
    }

    const annualRate = parseFloat(form.interestRate) || 0
    const tenor = parseInt(form.tenorMonths, 10) || 0
    const monthlyRate = annualRate / 100 / 12

    let calculatedMonthlyPayment = 0
    if (total > 0 && tenor > 0) {
      if (annualRate > 0) {
        calculatedMonthlyPayment = Math.round(
          (total * (monthlyRate * Math.pow(1 + monthlyRate, tenor))) /
            (Math.pow(1 + monthlyRate, tenor) - 1),
        )
      } else {
        calculatedMonthlyPayment = Math.round(total / tenor)
      }
    }

    const payload = {
      type: form.type,
      personName: form.personName.trim(),
      title: form.title.trim(),
      totalAmount: total,
      dueDate: form.dueDate || null,
      startDate: form.startDate || new Date().toISOString().split('T')[0],
      notes: form.notes.trim(),
      walletId: Number(form.walletId),
      currency: form.currency,
      interestRate: annualRate > 0 ? annualRate : null,
      tenorMonths: tenor > 0 ? tenor : null,
      monthlyPayment: calculatedMonthlyPayment > 0 ? calculatedMonthlyPayment : null,
    }

    try {
      if (editingLoan) {
        await updateLoan(editingLoan.id, payload)
      } else {
        await addLoan(payload)
      }
      onSaved?.()
      closeSheet()
    } catch (err) {
      setSheetError(err.message || t('loans.error.saveFailed', 'Gagal menyimpan data pinjaman. Silakan coba lagi.'))
    }
  }

  const isDebt = form.type === 'debt'
  const numericAmount = parseMoneyInput(form.totalAmount, form.currency) || 0
  const hasFilledAmount = numericAmount > 0

  const annualRate = parseFloat(form.interestRate) || 0
  const tenor = parseInt(form.tenorMonths, 10) || 0
  const monthlyRate = annualRate / 100 / 12

  let previewMonthlyPayment = 0
  let previewTotalInterest = 0
  let previewTotalRepayment = numericAmount

  if (numericAmount > 0 && tenor > 0) {
    if (annualRate > 0) {
      previewMonthlyPayment = Math.round(
        (numericAmount * (monthlyRate * Math.pow(1 + monthlyRate, tenor))) /
          (Math.pow(1 + monthlyRate, tenor) - 1),
      )
      previewTotalRepayment = previewMonthlyPayment * tenor
      previewTotalInterest = previewTotalRepayment - numericAmount
    } else {
      previewMonthlyPayment = Math.round(numericAmount / tenor)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeSheet}
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
      <div className="space-y-2.5">
        {sheetError ? <ToastBanner message={sheetError} type="error" onDismiss={() => setSheetError('')} /> : null}

        {/* 1. Segmented Pill Toggle */}
        <div
          className={`relative grid grid-cols-2 rounded-xl p-0.5 ${
            hasPaymentsRecorded ? 'opacity-60 pointer-events-none' : ''
          } bg-[var(--field-bg)] border border-[var(--border)]`}
        >
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, type: 'debt' }))}
            className={`relative z-10 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
              isDebt
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            {t('loans.myDebt', 'Hutang Saya')}
          </button>
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, type: 'receivable' }))}
            className={`relative z-10 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
              !isDebt
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            {t('loans.myReceivable', 'Piutang Saya')}
          </button>
        </div>

        {/* 2. Nominal Input */}
        <div className={`rounded-xl border px-3 py-2 space-y-0.5 transition-all duration-200 ${
          hasFilledAmount
            ? isDebt
              ? 'border-rose-500/30 bg-rose-500/5'
              : 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-[var(--border)] bg-[var(--field-bg)]'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {t('loans.modal.amount', 'Nominal Pinjaman')}
            </span>
            <span className="text-[10px] font-bold text-[var(--muted)]">{form.currency}</span>
          </div>
          <input
            ref={totalAmountInputRef}
            type="text"
            inputMode="decimal"
            disabled={hasPaymentsRecorded}
            className={`w-full bg-transparent text-xl font-black tabular-nums tracking-tight focus:outline-none transition-colors ${
              hasFilledAmount
                ? isDebt ? 'text-rose-500' : 'text-emerald-500'
                : 'text-[var(--fg)] placeholder:text-[var(--muted)]/40'
            } ${hasPaymentsRecorded ? 'opacity-60 cursor-not-allowed' : ''}`}
            placeholder="0"
            value={form.totalAmount}
            onChange={handleTotalAmountChange}
          />
          {hasPaymentsRecorded && (
            <p className="text-[9.5px] font-semibold text-amber-500">
              {t('loans.error.paymentLocked', 'Nominal dan tipe tidak dapat diubah setelah ada pembayaran.')}
            </p>
          )}
        </div>

        {/* 3. Detail Pinjaman: Judul & Peminjam side-by-side */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[var(--muted)] block truncate">
              {t('loans.modal.titleLabel', 'Judul Pinjaman')}
            </label>
            <input
              type="text"
              className="ft-input w-full text-xs font-semibold py-1.5 px-2.5 rounded-xl"
              placeholder={
                isDebt
                  ? t('loans.modal.titlePlaceholderDebt', 'Motor, Laptop, dll')
                  : t('loans.modal.titlePlaceholderReceivable', 'Pinjamkan ke Andi')
              }
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[var(--muted)] block truncate">
              {isDebt
                ? t('loans.modal.personDebt', 'Pemberi Pinjaman')
                : t('loans.modal.personReceivable', 'Nama Peminjam')}
            </label>
            <input
              type="text"
              className="ft-input w-full text-xs font-semibold py-1.5 px-2.5 rounded-xl"
              placeholder={
                isDebt
                  ? t('loans.modal.personPlaceholderDebt', 'BCA, Budi, dll')
                  : t('loans.modal.personPlaceholderReceivable', 'Andi, Rina, dll')
              }
              value={form.personName}
              onChange={(e) => setForm((prev) => ({ ...prev, personName: e.target.value }))}
            />
          </div>
        </div>

        {/* 4. Wallet (Wajib) */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[var(--muted)] block">
            {t('loans.modal.wallet', 'Dompet / Akun (Wajib)')}
          </label>
          <WalletSelectTrigger
            wallet={selectedWallet}
            disabled={!!editingLoan}
            placeholder={t('loans.selectWallet', 'Pilih Dompet / Akun')}
            onClick={() => setWalletModalOpen(true)}
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

        {/* 5. Jadwal: 2 column dates */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[var(--muted)] block truncate">
              {t('loans.startDateLabel', 'Tanggal Pinjam')}
            </label>
            <CustomDatePicker
              value={form.startDate}
              onChange={(val) => setForm((prev) => ({ ...prev, startDate: val }))}
              title={t('loans.startDateTitle', 'Pilih Tanggal Pinjam')}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[var(--muted)] block truncate">
              {t('loans.dueDateLabel', 'Jatuh Tempo')}
            </label>
            <CustomDatePicker
              value={form.dueDate}
              onChange={(val) => setForm((prev) => ({ ...prev, dueDate: val }))}
              allowClear
              clearLabel={t('loans.noDueDate', 'Tanpa Jatuh Tempo')}
              placeholder={t('common.optional', 'Opsional')}
              title={t('loans.dueDateTitle', 'Pilih Jatuh Tempo')}
            />
          </div>
        </div>

        {/* 6. Suku Bunga & Tenor Cicilan (Opsional) */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block">
            Kalkulator Bunga & Tenor (Opsional)
          </span>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[9.5px] font-semibold text-[var(--muted)] block">
                Bunga (% / Tahun)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                className="ft-input w-full text-xs font-bold py-1.5 px-2.5 rounded-xl font-mono"
                placeholder="12"
                value={form.interestRate}
                onChange={(e) => setForm((prev) => ({ ...prev, interestRate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9.5px] font-semibold text-[var(--muted)] block">
                Tenor (Bulan)
              </label>
              <input
                type="number"
                min="1"
                className="ft-input w-full text-xs font-bold py-1.5 px-2.5 rounded-xl font-mono"
                placeholder="12"
                value={form.tenorMonths}
                onChange={(e) => setForm((prev) => ({ ...prev, tenorMonths: e.target.value }))}
              />
            </div>
          </div>

          {previewMonthlyPayment > 0 && tenor > 0 && (
            <div className="p-2 rounded-xl bg-[var(--panel-strong)] border border-[var(--border)] space-y-1 text-xs animate-fadeIn">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-semibold text-[var(--muted)]">Estimasi Cicilan / Bulan:</span>
                <span className="font-extrabold text-[var(--fg)] tabular-nums">
                  Rp {previewMonthlyPayment.toLocaleString('id-ID')}
                </span>
              </div>
              {annualRate > 0 && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-semibold text-[var(--muted)]">Total Estimasi Bunga:</span>
                    <span className="font-bold text-amber-500 tabular-nums">
                      +Rp {previewTotalInterest.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-0.5 border-t border-[var(--border)]/60">
                    <span className="text-[10px] font-bold text-[var(--fg)]">Total Pengembalian:</span>
                    <span className="font-black text-[var(--fg)] tabular-nums">
                      Rp {previewTotalRepayment.toLocaleString('id-ID')}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 7. Catatan (Opsional) */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[var(--muted)] block">
            {t('loans.modal.notes', 'Catatan (Opsional)')}
          </label>
          <input
            type="text"
            className="ft-input w-full text-xs font-semibold py-1.5 px-2.5 rounded-xl"
            placeholder={t('loans.notesPlaceholder', 'Nomor rekening, keterangan, dll')}
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </div>

        {/* 7. Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]/40">
          <Button type="button" variant="secondary" onClick={closeSheet} className="!py-1.5 !px-3.5 text-xs active:scale-95 transition-all cursor-pointer">
            {t('common.cancel', 'Batal')}
          </Button>
          <Button
            type="button"
            onClick={save}
            className={`!py-1.5 !px-4 text-xs font-bold active:scale-95 transition-all cursor-pointer ${
              isDebt ? '!bg-rose-500 hover:!bg-rose-600 !text-white' : '!bg-emerald-500 hover:!bg-emerald-600 !text-white'
            }`}
          >
            {editingLoan ? t('common.saveChanges', 'Simpan Perubahan') : t('loans.modal.save', 'Simpan')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
