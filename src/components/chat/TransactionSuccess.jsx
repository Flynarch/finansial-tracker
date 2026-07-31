
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'
import { formatCurrency } from '../../lib/utils'
import { Check, Undo2 } from 'lucide-react'
import CategoryIcon from '../ui/CategoryIcon'
import { resolveTransactionIconKey, getCategoryColorClass, getTransactionCategoryLabels } from '../../lib/categoryIcon'
import { format, parseISO } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import useChatStore from '../../store/useChatStore'

export default function TransactionSuccess({ data, onUndo }) {
  const locale = useSettingsStore((s) => s.locale)
  const isArray = Array.isArray(data)
  const txs = isArray ? data : [data]
  
  const totalExpense = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const totalIncome = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const netTotal = totalIncome - totalExpense

  const grouped = {}
  txs.forEach(tx => {
    const d = tx.date || 'unknown'
    if (!grouped[d]) grouped[d] = []
    grouped[d].push(tx)
  })

  const formatDate = (dateStr) => {
    try {
      const parsed = parseISO(dateStr)
      return format(parsed, 'EEE, dd MMM yyyy', { locale: locale === 'id' ? idLocale : enUS })
    } catch {
      return dateStr
    }
  }

  const formatFallbackCategory = (cat) => {
    if (!cat) return ''
    return String(cat).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const navigate = useNavigate()
  const setIsOpen = useChatStore(s => s.setIsOpen)

  const handleViewAll = () => {
    navigate('/transactions')
    setIsOpen(false)
  }
  
  return (
    <div className="ft-swush-in flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <Check size={14} strokeWidth={3} />
          </div>
          <span className="text-[13px] font-bold text-[var(--fg)]">
            {txs.length > 1 
              ? `${txs.length} ${locale === 'en' ? 'transactions added' : 'transaksi dicatat'}`
              : locale === 'en' ? 'Transaction added' : 'Transaksi dicatat'}
          </span>
        </div>
        <button 
          onClick={handleViewAll} 
          className="text-[11px] font-semibold text-[var(--accent)] hover:underline"
        >
          {locale === 'en' ? 'View all' : 'Lihat semua'}
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-4">
        {Object.entries(grouped).map(([dateStr, items], gi) => (
          <div key={dateStr} className="flex flex-col gap-2.5" style={{ animationDelay: `${gi * 100}ms` }}>
            {txs.length > 1 && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                {formatDate(dateStr)}
              </span>
            )}
            
            <div className="flex flex-col gap-2">
              {items.map((tx, i) => {
                const iconKey = resolveTransactionIconKey(tx.category, tx.type)
                const colorClass = getCategoryColorClass(iconKey, tx.type, tx.category)
                const labels = getTransactionCategoryLabels(tx.category, tx.type, locale)
                const isIncome = tx.type === 'income'

                return (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--panel)] p-2.5" style={{ animationDelay: `${150 + (gi * 100) + (i * 80)}ms` }}>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colorClass}`}>
                        <CategoryIcon icon={iconKey} className="h-5 w-5" />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-[13px] font-semibold text-[var(--fg)]">
                          {labels.main || formatFallbackCategory(tx.category)}
                        </span>
                        {(labels.sub || tx.notes) && (
                          <span className="truncate text-[11px] font-medium text-[var(--muted)]">
                            {labels.sub ? labels.sub + (tx.notes ? ` • ${tx.notes}` : '') : tx.notes}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`shrink-0 text-sm font-bold tabular-nums ${isIncome ? 'ft-income-text' : 'ft-expense-text'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(tx.amount, tx.currency || 'IDR')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Undo */}
      {(txs.length > 1 || onUndo) && (
        <div className="mt-1 flex items-center justify-between border-t border-[var(--border)] pt-3">
          {txs.length > 1 ? (
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="text-[var(--muted)]">{locale === 'en' ? 'Total:' : 'Total:'}</span>
              <span className={netTotal >= 0 ? 'ft-income-text' : 'ft-expense-text'}>
                {netTotal >= 0 ? '+' : '-'}{formatCurrency(Math.abs(netTotal), txs[0]?.currency || 'IDR')}
              </span>
            </div>
          ) : <div />}
          
          {onUndo && (
            <button 
              onClick={onUndo} 
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)] hover:bg-[var(--field-border)] hover:text-[var(--fg)] transition"
            >
              <Undo2 size={12} />
              {translate(locale, 'aiChat.undo')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
