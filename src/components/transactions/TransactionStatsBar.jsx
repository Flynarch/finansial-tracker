import { useMemo } from 'react'
import { formatCurrency, convertCurrency } from '../../lib/utils'
import useTranslation from '../../hooks/useTranslation'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'

export default function TransactionStatsBar({
  transactions = [],
  defaultCurrency = 'IDR',
  rates = {},
}) {
  const { t } = useTranslation()

  const { totalIncome, totalExpense, netFlow } = useMemo(() => {
    let inc = 0
    let exp = 0
    for (const tx of transactions) {
      const converted = convertCurrency(
        tx.amount,
        tx.currency || defaultCurrency,
        defaultCurrency,
        rates
      )
      if (tx.type === 'income') inc += converted
      else if (tx.type === 'expense') exp += converted
    }
    return {
      totalIncome: inc,
      totalExpense: exp,
      netFlow: inc - exp,
    }
  }, [transactions, defaultCurrency, rates])

  if (transactions.length === 0) return null

  return (
    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 sm:p-3">
      {/* Pemasukan */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-[var(--muted)]">
          <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />
          <span className="truncate">{t('tx.income', 'Pemasukan')}</span>
        </div>
        <span className="mt-0.5 text-[11px] sm:text-xs font-black text-emerald-500 tracking-tight leading-tight">
          +{formatCurrency(totalIncome, defaultCurrency)}
        </span>
      </div>

      {/* Pengeluaran */}
      <div className="flex flex-col min-w-0 border-x border-[var(--border)]/60 px-1.5 sm:px-2">
        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-[var(--muted)]">
          <TrendingDown className="h-3 w-3 text-rose-500 shrink-0" />
          <span className="truncate">{t('tx.expense', 'Pengeluaran')}</span>
        </div>
        <span className="mt-0.5 text-[11px] sm:text-xs font-black text-rose-500 tracking-tight leading-tight">
          -{formatCurrency(totalExpense, defaultCurrency)}
        </span>
      </div>

      {/* Arus Kas Bersih */}
      <div className="flex flex-col min-w-0 pl-1">
        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-[var(--muted)]">
          <Wallet className="h-3 w-3 text-[var(--accent)] shrink-0" />
          <span className="truncate">{t('reports.netFlow', 'Arus Kas')}</span>
        </div>
        <span
          className={`mt-0.5 text-[11px] sm:text-xs font-black tracking-tight leading-tight ${
            netFlow >= 0 ? 'text-[var(--fg)]' : 'text-rose-500'
          }`}
        >
          {netFlow >= 0 ? '+' : ''}
          {formatCurrency(netFlow, defaultCurrency)}
        </span>
      </div>
    </div>
  )
}
