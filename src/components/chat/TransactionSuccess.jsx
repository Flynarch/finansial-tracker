import React from 'react'
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'
import { formatCurrency } from '../../lib/utils'
import { Check, Undo2, Plus, Minus } from 'lucide-react'
import CategoryIcon from '../ui/CategoryIcon'
import { resolveTransactionIconKey, getCategoryColorClass, getTransactionCategoryLabels } from '../../lib/categoryIcon'
import { format, parseISO } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'

export default function TransactionSuccess({ data, onUndo, contextMsg }) {
  const locale = useSettingsStore((s) => s.locale)
  const isArray = Array.isArray(data)
  const txs = isArray ? data : [data]
  
  const totalExpense = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const totalIncome = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const netTotal = totalIncome - totalExpense

  // Group transactions by date
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

  const getDayTotal = (items) => {
    const inc = items.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0)
    const exp = items.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0)
    return inc - exp
  }

  const handleViewAll = () => {
    window.location.hash = '#/transactions'
  }
  
  return (
    <div className="ft-swush-in ft-tx-success-card">
      {/* Blue Header Banner */}
      <div className="ft-tx-success-banner">
        <div className="ft-tx-success-banner-left">
          <div className="ft-tx-success-check">
            <Check size={12} strokeWidth={3} />
          </div>
          <span className="ft-tx-success-banner-text">
            {txs.length > 1 
              ? `${txs.length} ${locale === 'en' ? 'transactions added' : 'transaksi ditambahkan'}`
              : locale === 'en' ? 'Transaction added' : 'Transaksi ditambahkan'}
          </span>
        </div>
        <button onClick={handleViewAll} className="ft-tx-success-view-all">
          {locale === 'en' ? 'View all transactions' : 'Tinjau semua transaksi'}
        </button>
      </div>

      {/* Transaction Details */}
      <div className="ft-tx-success-body">
        {Object.entries(grouped).map(([dateStr, items], gi) => {
          const dayTotal = getDayTotal(items)
          return (
            <div key={dateStr} className="ft-tx-success-group" style={{ animationDelay: `${gi * 100}ms` }}>
              {/* Date Header */}
              <div className="ft-tx-success-date-row">
                <span className="ft-tx-success-date">{formatDate(dateStr)}</span>
                <span className={`ft-tx-success-date-total ${dayTotal >= 0 ? 'ft-amount-positive' : 'ft-amount-negative'}`}>
                  {dayTotal >= 0 ? '+' : '-'}{formatCurrency(Math.abs(dayTotal), items[0]?.currency || 'IDR')}
                </span>
              </div>

              {/* Items */}
              {items.map((tx, i) => {
                const iconKey = resolveTransactionIconKey(tx.category, tx.type)
                const colorClass = getCategoryColorClass(iconKey, tx.type, tx.category)
                const labels = getTransactionCategoryLabels(tx.category, tx.type, locale)
                const isIncome = tx.type === 'income'

                return (
                  <div key={i} className="ft-tx-success-item" style={{ animationDelay: `${150 + (gi * 100) + (i * 80)}ms` }}>
                    {/* Icon with +/- overlay */}
                    <div className="ft-tx-success-icon-wrap">
                      <div className={`ft-tx-success-item-icon ${colorClass}`}>
                        <CategoryIcon icon={iconKey} className="w-5 h-5" />
                      </div>
                      <div className={`ft-tx-success-type-badge ${isIncome ? 'ft-badge-income' : 'ft-badge-expense'}`}>
                        {isIncome ? <Plus size={8} strokeWidth={3} /> : <Minus size={8} strokeWidth={3} />}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="ft-tx-success-item-details">
                      <span className="ft-tx-success-item-category">{labels.main || tx.category}</span>
                      {labels.sub && <span className="ft-tx-success-item-sub">{labels.sub}</span>}
                      {tx.notes && <span className="ft-tx-success-item-notes">{tx.notes}</span>}
                    </div>

                    {/* Amount */}
                    <span className={`ft-tx-success-item-amount ${isIncome ? 'ft-amount-positive' : 'ft-amount-negative'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(tx.amount, tx.currency || 'IDR')}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Footer: Total + Undo */}
      <div className="ft-tx-success-footer">
        {txs.length > 1 && (
          <div className="ft-tx-success-total-row">
            <span className="ft-tx-success-total-label">
              {locale === 'en' ? 'Total Transaction' : 'Total Transaksi'}
            </span>
            <span className={`ft-tx-success-total-value ${netTotal >= 0 ? 'ft-amount-positive' : 'ft-amount-negative'}`}>
              {netTotal >= 0 ? '+' : '-'}{formatCurrency(Math.abs(netTotal), txs[0]?.currency || 'IDR')}
            </span>
          </div>
        )}
        {onUndo && (
          <button onClick={onUndo} className="ft-tx-success-undo">
            <Undo2 size={13} />
            {translate(locale, 'aiChat.undo')}
          </button>
        )}
      </div>
    </div>
  )
}
