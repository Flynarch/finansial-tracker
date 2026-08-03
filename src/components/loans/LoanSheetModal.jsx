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
  formatMoneyInput,
  formatMoneyValueForInput,
  getMoneyInputCaret,
  parseMoneyInput,
} from '../../lib/utils'
import { HandCoins, Receipt, Tag, User, Calendar, FileText, Clock, Wallet } from 'lucide-react'

export default function LoanSheetModal({ isOpen, onClose, editingLoan = null, defaultType = 'debt', onSaved }) {
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const { addLoan, updateLoan } = useLoanStore()
  const { closeSheet } = useBottomSheet({ isOpen, onClose })
  const [sheetError, setSheetError] = useState('')
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
  })

  const hasPaymentsRecorded = editingLoan
    ? (editingLoan.paymentTransactionIds?.length > 0 || editingLoan.remainingAmount < editingLoan.totalAmount)
    : false

  useEffect(() => {
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
          walletId: '',
          currency: defaultCurrency,
        })
      }
    }
  }, [isOpen, editingLoan, defaultType, defaultCurrency])

  const handleTotalAmountChange = (e) => {
    if (hasPaymentsRecorded) return
    const el = e.target
    const nextFormatted = formatMoneyInput(el.value, form.currency)
    const caretPos = getMoneyInputCaret(el.value, nextFormatted, el.selectionStart ?? el.value.length, form.currency)
    setForm((prev) => ({ ...prev, totalAmount: nextFormatted }))
    window.requestAnimationFrame(() => el.setSelectionRange(caretPos, caretPos))
  }

  const addAmountPreset = (addVal) => {
    if (hasPaymentsRecorded) return
    const currentVal = parseMoneyInput(form.totalAmount, form.currency) || 0
    const newVal = currentVal + addVal
    setForm((prev) => ({
      ...prev,
      totalAmount: formatMoneyValueForInput(newVal, form.currency),
    }))
  }

  const setDueDatePreset = (days) => {
    const baseDate = form.startDate ? new Date(form.startDate) : new Date()
    if (days === 'endOfMonth') {
      const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0)
      setForm((prev) => ({ ...prev, dueDate: end.toISOString().split('T')[0] }))
    } else {
      const nextDate = new Date(baseDate)
      nextDate.setDate(nextDate.getDate() + days)
      setForm((prev) => ({ ...prev, dueDate: nextDate.toISOString().split('T')[0] }))
    }
  }

  const save = async () => {
    const total = parseMoneyInput(form.totalAmount, form.currency)
    if (!form.title.trim()) {
      setSheetError('Judul pinjaman wajib diisi.')
      return
    }
    if (!form.personName.trim()) {
      setSheetError('Nama pemberi/peminjam wajib diisi.')
      return
    }
    if (total <= 0) {
      setSheetError('Nominal pinjaman harus lebih dari 0.')
      return
    }

    const payload = {
      type: form.type,
      personName: form.personName.trim(),
      title: form.title.trim(),
      totalAmount: total,
      dueDate: form.dueDate || null,
      startDate: form.startDate || new Date().toISOString().split('T')[0],
      notes: form.notes.trim(),
      walletId: form.walletId ? Number(form.walletId) : null,
      currency: form.currency || defaultCurrency,
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
      setSheetError(err.message || 'Gagal menyimpan data pinjaman. Silakan coba lagi.')
    }
  }

  const isDebt = form.type === 'debt'
  const numericAmount = parseMoneyInput(form.totalAmount, form.currency) || 0
  const hasFilledAmount = numericAmount > 0

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={closeSheet}
      title={editingLoan ? 'Edit Pinjaman' : isDebt ? 'Catat Hutang Saya' : 'Catat Piutang Saya'}
    >
      <div className="space-y-4 pt-1 pb-3 transition-all duration-200 ease-in-out">
        {sheetError ? <ToastBanner message={sheetError} type="error" onDismiss={() => setSheetError('')} /> : null}

        {/* Hutang / Piutang Toggle Cards */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={hasPaymentsRecorded}
            onClick={() => setForm((prev) => ({ ...prev, type: 'debt' }))}
            className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer active:scale-98 ${
              isDebt
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-500 shadow-xs'
                : 'bg-[var(--field-bg)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)]'
            } ${hasPaymentsRecorded ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors ${
              isDebt ? 'bg-rose-500/20 text-rose-500' : 'bg-[var(--panel-strong)] text-[var(--muted)]'
            }`}>
              <HandCoins className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black tracking-tight">Hutang Saya</p>
              <p className="text-[10px] font-medium opacity-75 truncate">Saya meminjam</p>
            </div>
          </button>

          <button
            type="button"
            disabled={hasPaymentsRecorded}
            onClick={() => setForm((prev) => ({ ...prev, type: 'receivable' }))}
            className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer active:scale-98 ${
              !isDebt
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500 shadow-xs'
                : 'bg-[var(--field-bg)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)]'
            } ${hasPaymentsRecorded ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors ${
              !isDebt ? 'bg-emerald-500/20 text-emerald-500' : 'bg-[var(--panel-strong)] text-[var(--muted)]'
            }`}>
              <Receipt className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black tracking-tight">Piutang Saya</p>
              <p className="text-[10px] font-medium opacity-75 truncate">Dipinjam orang</p>
            </div>
          </button>
        </div>

        {/* Total Nominal Pinjaman */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3 space-y-1.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">Total Nominal Pinjaman</span>
            <span className="text-[11px] font-bold text-[var(--muted)]">{form.currency}</span>
          </div>

          <div className="relative flex items-center">
            <input
              ref={totalAmountInputRef}
              type="text"
              inputMode="decimal"
              disabled={hasPaymentsRecorded}
              className={`w-full bg-transparent text-2xl sm:text-3xl font-black tabular-nums tracking-tight focus:outline-none transition-colors ${
                hasFilledAmount
                  ? isDebt
                    ? 'text-rose-500'
                    : 'text-emerald-500'
                  : 'text-[var(--fg)] placeholder:text-[var(--muted)]/40'
              } ${hasPaymentsRecorded ? 'opacity-60 cursor-not-allowed' : ''}`}
              placeholder="0"
              value={form.totalAmount}
              onChange={handleTotalAmountChange}
            />
          </div>

          {hasPaymentsRecorded && (
            <p className="text-[10px] font-semibold text-amber-500 pt-0.5">
              Nominal total dan tipe tidak dapat diubah setelah ada riwayat pembayaran.
            </p>
          )}

          {/* Quick Nominal Chips */}
          {!hasPaymentsRecorded && (
            <div className="pt-1 grid grid-cols-4 gap-1.5">
              {[100000, 500000, 1000000, 5000000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => addAmountPreset(amt)}
                  className="w-full py-1 text-center rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[10px] font-extrabold text-[var(--fg)] hover:border-[var(--border-strong)] transition-all cursor-pointer active:scale-95"
                >
                  +{amt >= 1000000 ? `${amt / 1000000}Jt` : `${amt / 1000}Rb`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tier 1: Wallet Picker (Opsional) */}
        <div className="space-y-1">
          <label className="text-[11px] font-extrabold text-[var(--fg)] flex items-center gap-1">
            <Wallet className="h-3 w-3 text-[var(--muted)]" />
            Pilih Wallet (Opsional)
          </label>
          <select
            value={form.walletId}
            disabled={!!editingLoan}
            onChange={(e) => setForm((prev) => ({ ...prev, walletId: e.target.value }))}
            className={`ft-input w-full text-xs font-semibold py-1.5 text-[var(--fg)] ${
              editingLoan ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            <option value="">Tanpa Wallet (Hanya Catatan Memo)</option>
            {wallets?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.currency || defaultCurrency})
              </option>
            ))}
          </select>
          {form.walletId && (
            <p className="text-[10px] font-semibold text-[var(--accent)] pt-0.5">
              {isDebt ? 'Akan mencatat saldo masuk di wallet terpilih.' : 'Akan memotong saldo wallet terpilih.'}
            </p>
          )}
        </div>

        {/* Section 1: Title & Person Name Grid */}
        <div className="space-y-3 pt-1 border-t border-[var(--border)]/50">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-[var(--fg)] flex items-center gap-1">
                <Tag className="h-3 w-3 text-[var(--muted)]" />
                Judul Pinjaman
              </label>
              <input
                type="text"
                className="ft-input w-full text-xs font-semibold py-1.5 placeholder:text-[var(--muted)]/60 placeholder:font-normal text-[var(--fg)]"
                placeholder={isDebt ? 'Motor, Laptop' : 'Pinjamkan ke Andi'}
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-[var(--fg)] flex items-center gap-1">
                <User className="h-3 w-3 text-[var(--muted)]" />
                {isDebt ? 'Pemberi Pinjaman' : 'Nama Peminjam'}
              </label>
              <input
                type="text"
                className="ft-input w-full text-xs font-semibold py-1.5 placeholder:text-[var(--muted)]/60 placeholder:font-normal text-[var(--fg)]"
                placeholder={isDebt ? 'BCA, Budi' : 'Andi, Rina'}
                value={form.personName}
                onChange={(e) => setForm((prev) => ({ ...prev, personName: e.target.value }))}
              />
            </div>
          </div>

          {/* Section 2: Dates & Presets */}
          <div className="space-y-2 pt-2.5 border-t border-[var(--border)]/50">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-[var(--fg)] flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-[var(--muted)]" />
                  Tanggal Pinjam
                </label>
                <input
                  type="date"
                  className="ft-input w-full text-xs font-semibold py-1.5 text-[var(--fg)]"
                  value={form.startDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-[var(--fg)] flex items-center gap-1">
                  <Clock className="h-3 w-3 text-[var(--muted)]" />
                  Jatuh Tempo
                </label>
                <div className="relative flex items-center">
                  <input
                    type="date"
                    className={`ft-input w-full text-xs font-semibold py-1.5 ${
                      !form.dueDate ? 'text-[var(--muted)]/70 font-normal' : 'text-[var(--fg)]'
                    }`}
                    value={form.dueDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                  />
                  {!form.dueDate && (
                    <span className="pointer-events-none absolute left-3 text-xs text-[var(--muted)]/60 font-normal">
                      Pilih tanggal (opsional)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Due Date Presets */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setDueDatePreset(7)}
                className="w-full py-1 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[10px] font-extrabold text-[var(--muted)] hover:text-[var(--fg)] transition-all cursor-pointer text-center active:scale-95"
              >
                +7 Hari
              </button>
              <button
                type="button"
                onClick={() => setDueDatePreset(14)}
                className="w-full py-1 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[10px] font-extrabold text-[var(--muted)] hover:text-[var(--fg)] transition-all cursor-pointer text-center active:scale-95"
              >
                +14 Hari
              </button>
              <button
                type="button"
                onClick={() => setDueDatePreset(30)}
                className="w-full py-1 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[10px] font-extrabold text-[var(--muted)] hover:text-[var(--fg)] transition-all cursor-pointer text-center active:scale-95"
              >
                +30 Hari
              </button>
              <button
                type="button"
                onClick={() => setDueDatePreset('endOfMonth')}
                className="w-full py-1 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[10px] font-extrabold text-[var(--muted)] hover:text-[var(--fg)] transition-all cursor-pointer text-center active:scale-95"
              >
                Akhir Bulan
              </button>
            </div>
          </div>

          {/* Section 3: Notes */}
          <div className="space-y-1 pt-2.5 border-t border-[var(--border)]/50">
            <label className="text-[11px] font-extrabold text-[var(--fg)] flex items-center gap-1">
              <FileText className="h-2.5 w-2.5 text-[var(--muted)]/70" />
              Catatan (Opsional)
            </label>
            <input
              type="text"
              className="ft-input w-full text-xs font-semibold py-1.5 placeholder:text-[var(--muted)]/60 placeholder:font-normal text-[var(--fg)]"
              placeholder="Catatan, nomor rekening, dsb..."
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={closeSheet} className="active:scale-95 transition-all">
            Batal
          </Button>
          <Button
            type="button"
            onClick={save}
            className={`active:scale-95 transition-all ${
              isDebt ? '!bg-rose-500 hover:!bg-rose-600 !text-white' : '!bg-emerald-500 hover:!bg-emerald-600 !text-white'
            }`}
          >
            {editingLoan ? 'Simpan Perubahan' : isDebt ? 'Simpan Catatan Hutang' : 'Simpan Catatan Piutang'}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
