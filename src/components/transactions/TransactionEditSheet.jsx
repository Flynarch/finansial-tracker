import { useRef, useState } from 'react'
import BottomSheet from '../ui/BottomSheet'
import CustomDatePicker from '../ui/CustomDatePicker'
import CategoryIcon from '../ui/CategoryIcon'
import CategoryPickerModal from './CategoryPickerModal'
import Button from '../ui/Button'
import { resolveTransactionIconKey } from '../../lib/categoryIcon'
import { formatExpenseCategory } from '../../lib/expenseCategories'
import { formatIncomeCategory } from '../../lib/incomeCategories'
import { formatMoneyInput, getMoneyInputCaret } from '../../lib/utils'

const currencyOptions = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP']

export default function TransactionEditSheet({
  isOpen,
  onClose,
  formData,
  setFormData,
  onSubmit,
  t,
  locale,
  wallets = [],
}) {
  const amountInputRef = useRef(null)
  const [isCatModalOpen, setIsCatModalOpen] = useState(false)
  const [editError, setEditError] = useState('')
  const [categoryError, setCategoryError] = useState(false)
  const [categoryShaking, setCategoryShaking] = useState(false)

  const selectedWallet = (wallets || []).find((w) => String(w.id) === String(formData.walletId))
  const isCashWallet =
    !selectedWallet ||
    selectedWallet.institutionType === 'cash' ||
    String(selectedWallet.name || '').toLowerCase().includes('cash') ||
    String(selectedWallet.name || '').toLowerCase().includes('tunai')

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => {
        setEditError('')
        setCategoryError(false)
        setCategoryShaking(false)
        onClose()
      }}
      title={t('tx.modal.editTitle') || 'Edit Transaksi'}
      maxHeight="max-h-[88dvh]"
    >
      {editError ? (
        <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-500 animate-[ft-fade-in_0.2s_ease-out]">
          {editError}
        </div>
      ) : null}
      <form
        className="grid gap-3 md:grid-cols-2 pt-1 pb-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!formData.category || !formData.category.trim()) {
            setCategoryError(true)
            setCategoryShaking(true)
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              try {
                navigator.vibrate([30, 50, 30])
              } catch {
                // ignore
              }
            }
            setTimeout(() => setCategoryShaking(false), 500)
            return
          }
          setEditError('')
          setCategoryError(false)
          onSubmit(event)
        }}
      >
        <div className="ft-label md:col-span-2">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">
            {t('tx.date', 'Tanggal')}
          </label>
          <CustomDatePicker
            value={formData.date}
            onChange={(val) => setFormData((prev) => ({ ...prev, date: val }))}
            title={t('tx.dateSelectTitle', 'Pilih Tanggal Transaksi')}
          />
        </div>

        <label className="ft-label md:col-span-2">
          {t('tx.amount', 'Jumlah')}
          <input
            ref={amountInputRef}
            type="text"
            inputMode="numeric"
            value={formData.amount}
            onChange={(event) => {
              const rawValue = event.target.value
              const currency = formData.currency
              const formatted = formatMoneyInput(rawValue, currency)
              const caret = getMoneyInputCaret(rawValue, formatted, event.target.selectionStart, currency)
              setFormData((prev) => ({ ...prev, amount: formatted }))
              window.requestAnimationFrame(() => {
                const el = amountInputRef.current
                if (!el) return
                el.setSelectionRange(caret, caret)
              })
            }}
            placeholder="0"
            className="ft-field text-base font-extrabold"
            required
          />
        </label>

        <label className="ft-label">
          {t('tx.type', 'Jenis Transaksi')}
          <select
            value={formData.type}
            onChange={(event) => {
              const nextType = event.target.value
              setFormData((prev) => ({
                ...prev,
                type: nextType,
                category: prev.type === nextType ? prev.category : '',
              }))
            }}
            className="ft-field"
          >
            <option value="income">{t('tx.type.income', 'Pemasukan')}</option>
            <option value="expense">{t('tx.type.expense', 'Pengeluaran')}</option>
          </select>
        </label>

        <div className={`ft-label ${categoryShaking ? 'ft-shake' : ''}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">
              {t('tx.category', 'Kategori')}
            </span>
            {categoryError && (
              <span className="text-[10.5px] font-bold text-rose-500 flex items-center gap-1 animate-[ft-fade-in_0.2s_ease-out]">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                {t('addTx.selectCategoryRequired', 'Wajib dipilih')}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setCategoryError(false)
              setIsCatModalOpen(true)
            }}
            className={`flex h-11 w-full items-center justify-between rounded-xl px-3 text-left transition-all cursor-pointer ${
              categoryError
                ? 'border border-rose-500/60 bg-rose-500/[0.08] shadow-[0_0_12px_rgba(244,63,94,0.18)] ring-2 ring-rose-500/30'
                : 'border border-[var(--border)] bg-[var(--field-bg)] hover:border-[var(--border-strong)]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <CategoryIcon
                icon={resolveTransactionIconKey(formData.category, formData.type)}
                className="h-6 w-6 shrink-0"
              />
              <span
                className={`truncate text-sm ${
                  !formData.category
                    ? categoryError
                      ? 'font-bold text-rose-500'
                      : 'font-normal italic text-[var(--muted-2)]'
                    : 'font-semibold text-[var(--fg)]'
                }`}
              >
                {!formData.category
                  ? t('addTx.selectCategory', 'Pilih Kategori...')
                  : formData.type === 'expense'
                    ? formatExpenseCategory(formData.category, locale)
                    : formatIncomeCategory(formData.category, locale)}
              </span>
            </div>
            <span className="shrink-0 text-xs font-bold text-[var(--accent)]">{t('tx.change', 'Ubah')} ›</span>
          </button>
          <CategoryPickerModal
            isOpen={isCatModalOpen}
            onClose={() => setIsCatModalOpen(false)}
            txType={formData.type || 'expense'}
            selectedCategory={formData.category}
            onSelectCategory={(cat) => {
              setCategoryError(false)
              setFormData((prev) => ({ ...prev, category: cat }))
            }}
          />
        </div>

        <label className="ft-label">
          {t('tx.currency', 'Mata Uang')}
          {isCashWallet ? (
            <select
              value={formData.currency}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  currency: event.target.value,
                  amount: formatMoneyInput(prev.amount, event.target.value),
                }))
              }
              className="ft-field"
            >
              {currencyOptions.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex h-11 items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--field-bg)]/80 px-3 text-sm font-bold text-[var(--fg)]">
              <span>{formData.currency}</span>
              <span className="text-[10.5px] font-semibold text-[var(--muted)]">
                {selectedWallet?.name ? `Terkunci (${selectedWallet.name})` : 'Terkunci'}
              </span>
            </div>
          )}
        </label>

        <label className="ft-label md:col-span-2">
          {t('tx.notes', 'Catatan')}
          <input
            type="text"
            value={formData.notes}
            onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
            placeholder={t('tx.notes.placeholder', 'Catatan (opsional)')}
            className="ft-field"
          />
        </label>

        <div className="flex gap-2 md:col-span-2 pt-2">
          <Button type="submit">{t('tx.modal.update', 'Perbarui Transaksi')}</Button>
          <Button
            type="button"
            onClick={onClose}
            className="bg-[var(--field-border)] text-[var(--fg)] hover:bg-[var(--field-border-hover)]"
          >
            {t('tx.cancel', 'Batal')}
          </Button>
        </div>
      </form>
    </BottomSheet>
  )
}
