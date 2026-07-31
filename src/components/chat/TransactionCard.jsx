import { useState } from 'react'
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'
import { formatCurrency } from '../../lib/utils'
import CategoryIcon from '../../components/ui/CategoryIcon'
import { getTransactionCategoryLabels } from '../../lib/categoryIcon'
import { Calendar, FileText, Pencil, Check } from 'lucide-react'

export default function TransactionCard({ data, onSave, onEdit, isEditing, onCancelEdit }) {
  const locale = useSettingsStore((s) => s.locale)
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency)

  // Local state for editing
  const [editData, setEditData] = useState({ ...data })

  const getLabels = (type, category) => {
    return getTransactionCategoryLabels(category, type, locale)
  }

  const labels = getLabels(data.type, data.category)
  
  if (isEditing) {
    return (
      <div className="ft-tx-preview ft-swush-in flex flex-col gap-3">
        <div className="flex bg-[var(--field-bg)] rounded-full p-1 border border-[var(--border)]">
          <button
            onClick={() => setEditData({...editData, type: 'expense'})}
            className={`flex-1 text-sm py-1.5 rounded-full transition-all ${editData.type === 'expense' ? 'bg-[var(--accent)] text-[var(--bg)] shadow-sm' : 'text-[var(--muted)]'}`}
          >
            {translate(locale, 'addTx.expense')}
          </button>
          <button
            onClick={() => setEditData({...editData, type: 'income'})}
            className={`flex-1 text-sm py-1.5 rounded-full transition-all ${editData.type === 'income' ? 'bg-[var(--accent)] text-[var(--bg)] shadow-sm' : 'text-[var(--muted)]'}`}
          >
            {translate(locale, 'addTx.income')}
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--muted)] px-1">{translate(locale, 'addTx.amount')}</label>
          <input
            type="text"
            inputMode="numeric"
            className="ft-field text-lg font-semibold"
            value={editData.amount}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '')
              setEditData({...editData, amount: val ? parseInt(val, 10) : ''})
            }}
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1 flex flex-col gap-1">
             <label className="text-xs text-[var(--muted)] px-1">{translate(locale, 'addTx.date')}</label>
             <input
               type="date"
               className="ft-field"
               value={editData.date}
               onChange={(e) => setEditData({...editData, date: e.target.value})}
             />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--muted)] px-1">{translate(locale, 'addTx.notes')}</label>
          <input
            type="text"
            className="ft-field"
            value={editData.notes}
            onChange={(e) => setEditData({...editData, notes: e.target.value})}
          />
        </div>

        <div className="flex gap-2 mt-2">
          <button onClick={onCancelEdit} className="ft-btn-ghost flex-1 text-sm py-2">
            {translate(locale, 'aiChat.cancel')}
          </button>
          <button onClick={() => onSave(editData)} className="ft-btn-primary flex-1 text-sm py-2">
            {translate(locale, 'aiChat.save')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ft-tx-preview ft-swush-in">
      <div className="flex items-center gap-3 mb-4">
        <CategoryIcon categoryId={data.category} type={data.type} />
        <div className="flex-1 truncate">
          <div className="text-sm font-semibold truncate">{labels.parentLabel}</div>
          {labels.childLabel && (
            <div className="text-xs text-[var(--muted)] truncate">› {labels.childLabel}</div>
          )}
        </div>
        <div className={`px-2 py-0.5 rounded-full text-xs font-medium border ${data.type === 'expense' ? 'bg-[var(--status-expense-soft)] text-[var(--status-expense)] border-[var(--status-expense)] border-opacity-20' : 'bg-[var(--status-income-soft)] text-[var(--status-income)] border-[var(--status-income)] border-opacity-20'}`}>
          {data.type === 'expense' ? translate(locale, 'addTx.expense') : translate(locale, 'addTx.income')}
        </div>
      </div>

      <div className="text-2xl font-bold font-display tracking-tight mb-3">
        {formatCurrency(data.amount, data.currency || defaultCurrency)}
      </div>

      <div className="flex flex-col gap-1 mb-4 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-2">
          <Calendar size={14} />
          <span>{data.date}</span>
        </div>
        {data.notes && (
          <div className="flex items-center gap-2">
            <FileText size={14} />
            <span className="truncate">{data.notes}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={onEdit} className="ft-btn-secondary flex-1 text-sm py-2 flex items-center justify-center gap-1.5">
          <Pencil size={14} />
          {translate(locale, 'aiChat.edit')}
        </button>
        <button onClick={() => onSave(data)} className="ft-btn-primary flex-1 text-sm py-2 flex items-center justify-center gap-1.5">
          <Check size={16} />
          {translate(locale, 'aiChat.save')}
        </button>
      </div>
    </div>
  )
}
