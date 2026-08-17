import { useRef, useState } from 'react'
import Button from '../ui/Button'
import ToastBanner from '../ui/ToastBanner'
import BottomSheet from '../ui/BottomSheet'
import { db } from '../../lib/db'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import {
  formatMoneyInput,
  formatMoneyValueForInput,
  getMoneyInputCaret,
  parseMoneyInput,
} from '../../lib/utils'

export default function SavingsSheetModal({ isOpen, onClose, editingGoal = null, onSaved }) {
  const { t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const [sheetError, setSheetError] = useState('')
  const targetAmountInputRef = useRef(null)
  const currentAmountInputRef = useRef(null)

  const [form, setForm] = useState({
    name: '',
    targetAmount: '',
    currentAmount: '',
    currency: defaultCurrency,
  })

  const [prevOpen, setPrevOpen] = useState(isOpen)
  const [prevEditingGoal, setPrevEditingGoal] = useState(editingGoal)

  if (prevOpen !== isOpen || prevEditingGoal !== editingGoal) {
    setPrevOpen(isOpen)
    setPrevEditingGoal(editingGoal)
    if (isOpen) {
      setSheetError('')
      if (editingGoal) {
        setForm({
          name: editingGoal.name || '',
          targetAmount: formatMoneyValueForInput(editingGoal.targetAmount, editingGoal.currency || defaultCurrency),
          currentAmount: formatMoneyValueForInput(editingGoal.currentAmount, editingGoal.currency || defaultCurrency),
          currency: editingGoal.currency || defaultCurrency,
        })
      } else {
        setForm({
          name: '',
          targetAmount: '',
          currentAmount: '',
          currency: defaultCurrency,
        })
      }
    }
  }

  const save = async () => {
    const payload = {
      name: String(form.name || '').trim(),
      targetAmount: parseMoneyInput(form.targetAmount, form.currency),
      currentAmount: parseMoneyInput(form.currentAmount, form.currency),
      currency: form.currency || defaultCurrency,
    }
    if (!payload.name) {
      setSheetError(t('savings.validation.name'))
      return
    }
    if (payload.targetAmount <= 0) {
      setSheetError(t('savings.validation.target'))
      return
    }
    if (payload.currentAmount < 0) {
      setSheetError(t('savings.validation.current'))
      return
    }
    try {
      setSheetError('')
      if (editingGoal?.id) {
        await db.goals.update(editingGoal.id, payload)
      } else {
        await db.goals.add(payload)
      }
      onSaved?.()
      onClose()
    } catch {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      setSheetError(offline ? t('common.error.offline') : t('common.error.saveFailed'))
    }
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={editingGoal ? t('savings.sheet.editTitle', 'Edit Target Tabungan') : t('savings.sheet.addTitle', 'Tambah Target Tabungan')}
    >
      {sheetError ? <ToastBanner message={sheetError} /> : null}

      <div className="grid gap-3 pt-1">
        <label className="ft-label text-xs">
          {t('savings.goalName', 'Nama Target')}
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder={t('savings.namePlaceholder', 'Beli Rumah, Dana Darurat, Liburan...')}
            className="ft-field mt-1 w-full text-xs font-semibold py-2 px-3 rounded-xl"
          />
        </label>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="ft-label text-xs">
            {t('savings.target', 'Target Nominal')}
            <input
              ref={targetAmountInputRef}
              type="text"
              inputMode="numeric"
              value={form.targetAmount}
              onChange={(e) => {
                const rawValue = e.target.value
                const currency = form.currency
                const formatted = formatMoneyInput(rawValue, currency)
                const caret = getMoneyInputCaret(rawValue, formatted, e.target.selectionStart, currency)
                setForm((p) => ({ ...p, targetAmount: formatted }))
                window.requestAnimationFrame(() => {
                  const el = targetAmountInputRef.current
                  if (!el) return
                  el.setSelectionRange(caret, caret)
                })
              }}
              placeholder="0"
              className="ft-field mt-1 w-full font-bold tabular-nums text-xs py-2 px-3 rounded-xl"
            />
          </label>
          <label className="ft-label text-xs">
            {t('savings.current', 'Saldo Awal')}
            <input
              ref={currentAmountInputRef}
              type="text"
              inputMode="numeric"
              value={form.currentAmount}
              onChange={(e) => {
                const rawValue = e.target.value
                const currency = form.currency
                const formatted = formatMoneyInput(rawValue, currency)
                const caret = getMoneyInputCaret(rawValue, formatted, e.target.selectionStart, currency)
                setForm((p) => ({ ...p, currentAmount: formatted }))
                window.requestAnimationFrame(() => {
                  const el = currentAmountInputRef.current
                  if (!el) return
                  el.setSelectionRange(caret, caret)
                })
              }}
              placeholder="0"
              className="ft-field mt-1 w-full font-bold tabular-nums text-xs py-2 px-3 rounded-xl"
            />
          </label>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="ft-label text-xs">
            {t('savings.currency', 'Mata Uang')}
            <select
              value={form.currency}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  currency: e.target.value,
                  targetAmount: formatMoneyInput(p.targetAmount, e.target.value),
                  currentAmount: formatMoneyInput(p.currentAmount, e.target.value),
                }))
              }
              className="ft-field mt-1 w-full text-xs font-semibold py-2 px-3 rounded-xl"
            >
              {['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]/40 mt-1">
          <Button
            type="button"
            className="bg-[var(--field-border)] text-[var(--fg)] hover:bg-[var(--field-border-hover)] !py-2 !px-4 text-xs active:scale-95 transition-all cursor-pointer"
            onClick={onClose}
          >
            {t('savings.cancel', 'Batal')}
          </Button>
          <Button
            type="button"
            onClick={save}
            className="!py-2 !px-5 text-xs font-bold active:scale-95 transition-all cursor-pointer"
            disabled={
              !String(form.name || '').trim() ||
              parseMoneyInput(form.targetAmount, form.currency) <= 0 ||
              parseMoneyInput(form.currentAmount, form.currency) < 0
            }
          >
            {t('savings.save', 'Simpan')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
