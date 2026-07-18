import React from 'react'
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'
import { formatCurrency } from '../../lib/utils'
import { Check, Undo2 } from 'lucide-react'

export default function TransactionSuccess({ data, onUndo, contextMsg }) {
  const locale = useSettingsStore((s) => s.locale)
  
  return (
    <div className="ft-tx-preview ft-swush-in relative overflow-hidden" style={{ 
      background: 'var(--status-income-soft)',
      borderColor: 'color-mix(in srgb, var(--status-income) 30%, transparent)'
    }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 mb-2 text-[var(--status-income)]">
          <Check size={18} className="ft-scale-in" style={{ animationDelay: '100ms' }} />
          <span className="font-semibold text-sm">
            {translate(locale, 'aiChat.saved')}
          </span>
        </div>
        
        {onUndo && (
          <button
            onClick={onUndo}
            className="flex items-center gap-1 text-xs bg-[var(--bg)] px-2 py-1 rounded-full shadow-sm active:scale-95 transition-transform"
          >
            <Undo2 size={12} />
            {translate(locale, 'aiChat.undo')}
          </button>
        )}
      </div>

      <div className="text-sm font-medium">
        {data.notes || data.category} • {formatCurrency(data.amount, data.currency || 'IDR')}
      </div>
      <div className="text-xs text-[var(--muted)] mt-1">
        {data.type === 'expense' ? translate(locale, 'addTx.expense') : translate(locale, 'addTx.income')} • {data.date}
      </div>

      {contextMsg && (
        <div className="mt-3 pt-3 border-t border-[var(--status-income)] border-opacity-20 text-xs text-[var(--fg)] opacity-90">
          💡 {contextMsg}
        </div>
      )}
    </div>
  )
}
