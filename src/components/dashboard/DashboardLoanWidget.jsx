import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { HandCoins, Plus, ChevronRight, Receipt, AlertCircle, Clock } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

export const DashboardLoanWidget = memo(function DashboardLoanWidget({
  loanSummary,
  defaultCurrency,
  locale,
  onOpenLoanSheet,
  onPayLoan,
}) {
  const navigate = useNavigate()
  const { totalDebt, totalReceivable, netPosition, receivablePct, debtPct, hasActiveLoans, activeCount, mostUrgentItem } = loanSummary

  return (
    <section className="ft-stagger-in" style={{ '--stagger': 4 }}>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-sm sm:p-5 space-y-3.5">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-3">
          <div
            onClick={() => navigate('/loans')}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition active:scale-[0.99] min-w-0"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/25">
              <HandCoins className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold tracking-tight text-[var(--fg)] truncate">Utang & Piutang</h3>
              <p className="text-[10px] font-semibold text-[var(--muted)] truncate">
                {activeCount > 0 ? `${activeCount} Catatan Aktif` : 'Tidak Ada Catatan Aktif'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenLoanSheet}
              className="flex h-7 items-center gap-1 rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs font-bold text-[var(--bg)] shadow-2xs transition hover:opacity-90 active:scale-95 cursor-pointer"
              aria-label="Catat"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Catat</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/loans')}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] transition active:scale-95 cursor-pointer"
              aria-label="Loans"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Hero Bento Net Position & Totals */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">Posisi Bersih (Net Position)</span>
              <p className={`text-base sm:text-lg font-black tabular-nums tracking-tight ${
                netPosition > 0 ? 'text-[var(--status-income)]' : netPosition < 0 ? 'text-[var(--status-expense)]' : 'text-[var(--fg)]'
              }`}>
                {netPosition > 0 ? '+' : ''}{formatCurrency(netPosition, defaultCurrency, locale)}
              </p>
            </div>

            <div className="text-right flex flex-col items-end text-xs font-extrabold tabular-nums">
              <span className="text-[var(--status-expense)]">Utang: {formatCurrency(totalDebt, defaultCurrency, locale)}</span>
              <span className="text-[var(--status-income)]">Piutang: {formatCurrency(totalReceivable, defaultCurrency, locale)}</span>
            </div>
          </div>

          {/* Balance Ratio Visual Bar: Only show ratio split if there is active loan/debt */}
          {hasActiveLoans ? (
            <div className="space-y-1 pt-0.5">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--panel-strong)] border border-[var(--border)]/60">
                <div
                  className="h-full bg-[var(--status-income)] transition-all duration-500"
                  style={{ width: `${receivablePct}%` }}
                  title={`Piutang: ${receivablePct}%`}
                />
                <div
                  className="h-full bg-[var(--status-expense)] transition-all duration-500"
                  style={{ width: `${debtPct}%` }}
                  title={`Utang: ${debtPct}%`}
                />
              </div>
            </div>
          ) : (
            <div className="h-1.5 w-full rounded-full bg-[var(--panel-strong)] border border-[var(--border)]/40" />
          )}
        </div>

        {/* Most Urgent Item Preview Box with Direct Payment Interaction */}
        {mostUrgentItem ? (
          <div
            onClick={() => onPayLoan(mostUrgentItem)}
            className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-3 cursor-pointer hover:border-[var(--border-strong)] transition-all active:scale-[0.98] shadow-2xs"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${
                    mostUrgentItem.type === 'debt'
                      ? 'bg-[var(--status-expense-soft)] text-[var(--status-expense)] border-[var(--status-expense)]/25'
                      : 'bg-[var(--status-income-soft)] text-[var(--status-income)] border-[var(--status-income)]/25'
                  }`}
                >
                  {mostUrgentItem.type === 'debt' ? (
                    <HandCoins className="h-3.5 w-3.5" />
                  ) : (
                    <Receipt className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="truncate text-xs font-extrabold text-[var(--fg)]">
                      {mostUrgentItem.title}
                    </p>
                    <span className="text-[10px] font-extrabold text-[var(--muted)]">·</span>
                    <span className="text-[11px] font-bold text-[var(--muted)] truncate">
                      {mostUrgentItem.personName}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-black tabular-nums text-[var(--fg)]">
                    Sisa {formatCurrency(mostUrgentItem.remaining, mostUrgentItem.currency || defaultCurrency, locale)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {mostUrgentItem.isOverdue ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-black text-rose-500">
                    <AlertCircle className="h-3 w-3" />
                    Terlambat
                  </span>
                ) : mostUrgentItem.daysLeft !== null ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--panel-strong)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-black text-[var(--muted)]">
                    <Clock className="h-3 w-3" />
                    {mostUrgentItem.daysLeft === 0 ? 'Hari Ini' : `${mostUrgentItem.daysLeft} Hari Lagi`}
                  </span>
                ) : null}

                <span className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] px-2 py-1 text-[10px] font-extrabold text-[var(--accent)] group-hover:border-[var(--accent)] transition-colors">
                  Bayar <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
})

export default DashboardLoanWidget
