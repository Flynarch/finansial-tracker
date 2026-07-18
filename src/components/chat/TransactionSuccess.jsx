import React from 'react'
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'
import { formatCurrency } from '../../lib/utils'
import { CheckCircle2, Undo2 } from 'lucide-react'

export default function TransactionSuccess({ data, onUndo, contextMsg }) {
  const locale = useSettingsStore((s) => s.locale)
  const isArray = Array.isArray(data)
  const txs = isArray ? data : [data]
  
  const totalExpense = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const totalIncome = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  
  return (
    <div className="ft-swush-in relative overflow-hidden bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-sm">
      {/* Premium Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-white/5 dark:bg-white/5">
        <div className="flex items-center gap-2 text-emerald-500">
          <CheckCircle2 size={18} className="ft-scale-in" strokeWidth={2.5} style={{ animationDelay: '100ms' }} />
          <span className="font-semibold text-sm text-[var(--fg)] tracking-tight">
            {isArray && txs.length > 1 ? `${txs.length} Transaksi Dicatat` : 'Transaksi Berhasil'}
          </span>
        </div>
        
        {onUndo && (
          <button
            onClick={onUndo}
            className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--fg)] bg-[var(--field-bg)] px-2.5 py-1 rounded-md transition-colors active:scale-95"
          >
            <Undo2 size={14} />
            {translate(locale, 'aiChat.undo')}
          </button>
        )}
      </div>

      {/* Clean List */}
      <div className="flex flex-col py-2 px-1">
        {txs.map((tx, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2.5 group hover:bg-[var(--field-bg)] rounded-xl transition-colors mx-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] font-medium text-[var(--fg)]">{tx.notes || tx.category}</span>
              <span className="text-[11px] text-[var(--muted)]">{tx.date} • {tx.type === 'expense' ? translate(locale, 'addTx.expense') : translate(locale, 'addTx.income')}</span>
            </div>
            <div className={`text-[14px] font-semibold tabular-nums ${tx.type === 'income' ? 'text-emerald-500' : 'text-[var(--fg)]'}`}>
              {tx.type === 'income' ? '+' : ''}{formatCurrency(tx.amount, tx.currency || 'IDR')}
            </div>
          </div>
        ))}
      </div>
      
      {/* Sleek Totals */}
      {txs.length > 1 && (
        <div className="px-5 py-3.5 border-t border-[var(--border)] bg-[var(--field-bg)] flex flex-col gap-2">
          {totalExpense > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[12px] font-medium text-[var(--muted)] uppercase tracking-wider">Total Pengeluaran</span>
              <span className="text-[15px] font-bold text-[var(--fg)] tabular-nums">{formatCurrency(totalExpense, txs[0]?.currency || 'IDR')}</span>
            </div>
          )}
          {totalIncome > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[12px] font-medium text-[var(--muted)] uppercase tracking-wider">Total Pemasukan</span>
              <span className="text-[15px] font-bold text-emerald-500 tabular-nums">{formatCurrency(totalIncome, txs[0]?.currency || 'IDR')}</span>
            </div>
          )}
        </div>
      )}

      {/* Context Tips */}
      {contextMsg && (
        <div className="px-4 pb-4 pt-2">
          <div className="px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-[12px] text-indigo-700 dark:text-indigo-300 leading-relaxed">
            <span className="font-semibold mr-1">💡 Tips:</span>{contextMsg.replace('💡', '').trim()}
          </div>
        </div>
      )}
    </div>
  )
}
