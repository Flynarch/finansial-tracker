import { memo } from 'react'
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

export const DashboardQuickStats = memo(function DashboardQuickStats({
  monthIncome = 0,
  monthExpense = 0,
  monthDelta = 0,
  defaultCurrency = 'IDR',
  locale = 'id',
}) {
  const isPositive = monthDelta >= 0

  return (
    <section className="grid grid-cols-3 gap-2 ft-stagger-in" style={{ '--stagger': 1 }}>
      {/* Pemasukan */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-1.5">
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[var(--status-income-soft)] text-[var(--status-income)]">
            <ArrowDownLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate">Masuk</span>
        </div>
        <p className="mt-2 text-xs sm:text-sm font-black tabular-nums tracking-tight text-[var(--status-income)] truncate">
          {formatCurrency(monthIncome, defaultCurrency, locale)}
        </p>
      </div>

      {/* Pengeluaran */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-1.5">
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[var(--status-expense-soft)] text-[var(--status-expense)]">
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate">Keluar</span>
        </div>
        <p className="mt-2 text-xs sm:text-sm font-black tabular-nums tracking-tight text-[var(--status-expense)] truncate">
          {formatCurrency(monthExpense, defaultCurrency, locale)}
        </p>
      </div>

      {/* Selisih Bersih */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-1.5">
          <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${
            isPositive
              ? 'bg-[var(--status-income-soft)] text-[var(--status-income)]'
              : 'bg-[var(--status-expense-soft)] text-[var(--status-expense)]'
          }`}>
            <Wallet className="h-3.5 w-3.5" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate">Selisih</span>
        </div>
        <p className={`mt-2 text-xs sm:text-sm font-black tabular-nums tracking-tight truncate ${
          isPositive ? 'text-[var(--status-income)]' : 'text-[var(--status-expense)]'
        }`}>
          {isPositive ? '+' : ''}{formatCurrency(monthDelta, defaultCurrency, locale)}
        </p>
      </div>
    </section>
  )
})

export default DashboardQuickStats
