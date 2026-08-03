import { memo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import Card from '../ui/Card'

export const TransactionSummaryCard = memo(function TransactionSummaryCard({
  totals,
  defaultCurrency,
  formatCurrency,
  t,
}) {
  return (
    <Card className="min-w-0 bg-[color-mix(in_srgb,var(--panel-strong)_94%,var(--bg)_6%)] p-3 sm:p-4">
      <div className="grid grid-cols-2 gap-2.5">
        {/* Income Card */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-2.5 sm:p-3 transition-all">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate">
              {t('tx.summary.income')}
            </span>
          </div>
          <p className="ft-income-text break-all text-sm font-extrabold tabular-nums sm:text-base md:text-lg">
            {formatCurrency(totals.income, defaultCurrency)}
          </p>
        </div>

        {/* Expense Card */}
        <div className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent p-2.5 sm:p-3 transition-all">
          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 mb-1">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-rose-500/15">
              <TrendingDown className="h-3.5 w-3.5" strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate">
              {t('tx.summary.expense')}
            </span>
          </div>
          <p className="ft-expense-text break-all text-sm font-extrabold tabular-nums sm:text-base md:text-lg">
            {formatCurrency(totals.expense, defaultCurrency)}
          </p>
        </div>
      </div>
    </Card>
  )
})
