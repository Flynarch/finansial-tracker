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
}) {
  const amountInputRef = useRef(null)
  const [isCatModalOpen, setIsCatModalOpen] = useState(false)

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t('tx.modal.editTitle') || 'Edit Transaksi'}
      maxHeight="max-h-[88dvh]"
    >
      <form
        className="grid gap-3 md:grid-cols-2 pt-1 pb-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!formData.category || !formData.category.trim()) {
            alert(t('addTx.selectCategoryRequired', 'Silakan pilih kategori terlebih dahulu.'))
            return
          }
          onSubmit()
        }}
      >
        <div className="ft-label">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">
            {t('tx.date', 'Tanggal')}
          </label>
          <CustomDatePicker
            value={formData.date}
            onChange={(val) =>
              setFormData((prev) => ({
                ...prev,
                date: val,
              }))
            }
            title={t('tx.date.selectTitle', 'Pilih Tanggal Transaksi')}
          />
        </div>

        <label className="ft-label">
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
            required
            className="ft-field"
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

        <div className="ft-label">
          {t('tx.category', 'Kategori')}
          <button
            type="button"
            onClick={() => setIsCatModalOpen(true)}
            className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-3 text-left transition hover:border-[var(--border-strong)] mt-1"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="flex h-7 w-9 shrink-0 items-center justify-center">
                <CategoryIcon icon={resolveTransactionIconKey(formData.category, formData.type)} className="h-5 w-5" />
              </span>
              <span className={`truncate text-sm ${!formData.category ? 'font-normal italic text-[var(--muted)]' : 'font-semibold text-[var(--fg)]'}`}>
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
            onSelectCategory={(cat) => setFormData((prev) => ({ ...prev, category: cat }))}
          />
        </div>

        <label className="ft-label">
          {t('tx.currency', 'Mata Uang')}
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
