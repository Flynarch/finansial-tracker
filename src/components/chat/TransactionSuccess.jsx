import useSettingsStore from '../../store/useSettingsStore'
import { formatCurrency } from '../../lib/utils'
import { CheckCircle2, RotateCcw, ArrowRight } from 'lucide-react'
import CategoryIcon from '../ui/CategoryIcon'
import { resolveTransactionIconKey, getCategoryColorClass, getTransactionCategoryLabels } from '../../lib/categoryIcon'
import { format, parseISO } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import useChatStore from '../../store/useChatStore'

export default function TransactionSuccess({ data, onUndo }) {
  const locale = useSettingsStore((s) => s.locale)
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency)
  const isArray = Array.isArray(data)
  const txs = isArray ? data : [data]

  const grouped = {}
  txs.forEach(tx => {
    const d = tx.date || 'unknown'
    if (!grouped[d]) grouped[d] = []
    grouped[d].push(tx)
  })

  const formatDate = (dateStr) => {
    try {
      const parsed = parseISO(dateStr)
      return format(parsed, 'EEEE, dd MMMM yyyy', { locale: locale === 'id' ? idLocale : enUS })
    } catch {
      return dateStr
    }
  }

  const navigate = useNavigate()
  const setIsOpen = useChatStore(s => s.setIsOpen)

  const handleViewAll = () => {
    navigate('/transactions')
    setIsOpen(false)
  }

  return (
    <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-sm overflow-hidden my-1">
      {/* Top Accent line */}
      <div className="h-1 w-full bg-emerald-500/40" />

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border)]/50">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-500 flex items-center justify-center shadow-2xs">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-black text-[var(--fg)] tracking-tight">
            {txs.length > 1 
              ? `${txs.length} ${locale === 'en' ? 'Transactions Saved' : 'Transaksi Dicatat'}`
              : locale === 'en' ? 'Transaction Saved' : 'Transaksi Dicatat'}
          </span>
        </div>
        <button 
          type="button"
          onClick={handleViewAll} 
          className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[var(--muted)] hover:text-[var(--fg)] transition cursor-pointer"
        >
          <span>{locale === 'en' ? 'View' : 'Lihat'}</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* Items list */}
      <div className="p-3 space-y-3">
        {Object.entries(grouped).map(([dateStr, items]) => (
          <div key={dateStr} className="space-y-2">
            {txs.length > 1 && (
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                {formatDate(dateStr)}
              </span>
            )}
            
            <div className="space-y-1.5">
              {items.map((tx, i) => {
                const iconKey = resolveTransactionIconKey(tx.category, tx.type)
                const colorClass = getCategoryColorClass(iconKey, tx.type, tx.category)
                const labels = getTransactionCategoryLabels(tx.category, tx.type, locale)
                const isIncome = tx.type === 'income'

                return (
                  <div key={tx.id || i} className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-[var(--field-bg)] border border-[var(--border)]/40">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <div className={`grid h-8 w-8 place-items-center rounded-xl ${colorClass} shrink-0`}>
                        <CategoryIcon icon={iconKey} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-[var(--fg)] leading-tight">
                          {labels.main || tx.category}
                        </p>
                        {(labels.sub || tx.notes) && (
                          <p className="truncate text-[10.5px] font-medium text-[var(--muted)] mt-0.5">
                            {labels.sub ? labels.sub + (tx.notes ? ` • "${tx.notes}"` : '') : `"${tx.notes}"`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`text-xs font-black tabular-nums ${isIncome ? 'ft-income-text' : 'ft-expense-text'}`}>
                        {isIncome ? '+' : '-'}{formatCurrency(tx.amount, tx.currency || defaultCurrency)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Ticket Tear Perforation */}
      <div className="relative flex items-center px-3 py-0.5">
        <div className="absolute -left-2 h-4 w-4 rounded-full bg-[var(--bg)] border border-[var(--border)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]" />
        <div className="w-full border-t border-dashed border-[var(--border-strong)]/50" />
        <div className="absolute -right-2 h-4 w-4 rounded-full bg-[var(--bg)] border border-[var(--border)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]" />
      </div>

      {/* Card Actions Footer */}
      <div className="p-2.5 bg-[var(--field-bg)]/40 flex items-center justify-between">
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-bold text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Batalkan</span>
          </button>
        )}

        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 ml-auto">
          FinTrack Verified
        </span>
      </div>
    </div>
  )
}
