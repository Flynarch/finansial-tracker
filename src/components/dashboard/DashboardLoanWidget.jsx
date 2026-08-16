import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { HandCoins, Plus, ChevronRight, Scale, Clock } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import useTranslation from '../../hooks/useTranslation'

export const DashboardLoanWidget = memo(function DashboardLoanWidget({
  isDbLoading = false,
  loanSummary,
  defaultCurrency,
  locale,
  onOpenLoanSheet,
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  if (isDbLoading) {
    return (
      <section className="ft-stagger-in" style={{ '--stagger': 4 }}>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-sm animate-pulse space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-[var(--border)]/60" />
              <div className="space-y-1">
                <div className="h-3.5 w-24 rounded bg-[var(--border)]/70" />
                <div className="h-2.5 w-32 rounded bg-[var(--border)]/40" />
              </div>
            </div>
            <div className="h-7 w-20 rounded-xl bg-[var(--border)]/60" />
          </div>
        </div>
      </section>
    )
  }

  const {
    totalDebt = 0,
    totalReceivable = 0,
    netPosition = 0,
    receivablePct = 0,
    debtPct = 0,
    hasActiveLoans = false,
    activeCount = 0,
    mostUrgentItem = null,
  } = loanSummary || {}

  const isNetPositive = netPosition > 0
  const isNetNegative = netPosition < 0

  return (
    <section className="ft-stagger-in" style={{ '--stagger': 4 }}>
      <div
        onClick={() => navigate('/loans')}
        className="group rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-sm hover:border-[var(--border-strong)] transition-all cursor-pointer active:scale-[0.995] space-y-3"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/25">
              <HandCoins className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black tracking-tight text-[var(--fg)] flex items-center gap-1">
                Utang & Piutang
                <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-[11px] font-bold text-[var(--muted)] truncate">
                {activeCount > 0 ? `${activeCount} Catatan Aktif` : 'Kelola pinjaman & hak tagih'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenLoanSheet()
            }}
            className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent)] px-2.5 py-1.5 text-xs font-extrabold text-white shadow-xs transition hover:opacity-90 active:scale-95 cursor-pointer shrink-0"
            aria-label={t('loans.add', 'Catat Hutang atau Piutang')}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span>Catat</span>
          </button>
        </div>

        {hasActiveLoans ? (
          <>
            {/* Side-by-side Totals (Clean, single surface) */}
            <div className="grid grid-cols-2 gap-3 pt-0.5">
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--status-expense)]">
                  Utang Saya
                </span>
                <p className="mt-0.5 text-base sm:text-lg font-black tabular-nums text-[var(--status-expense)] truncate">
                  {formatCurrency(totalDebt, defaultCurrency, locale)}
                </p>
              </div>

              <div className="min-w-0 border-l border-[var(--border)]/60 pl-3">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--status-income)]">
                  Piutang Saya
                </span>
                <p className="mt-0.5 text-base sm:text-lg font-black tabular-nums text-[var(--status-income)] truncate">
                  {formatCurrency(totalReceivable, defaultCurrency, locale)}
                </p>
              </div>
            </div>

            {/* Proportional bar */}
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--field-bg)] border border-[var(--border)]/50">
              <div
                className="h-full bg-[var(--status-income)] transition-all duration-500"
                style={{ width: `${receivablePct}%` }}
              />
              <div
                className="h-full bg-[var(--status-expense)] transition-all duration-500"
                style={{ width: `${debtPct}%` }}
              />
            </div>

            {/* Posisi Bersih Footer */}
            <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-dashed border-[var(--border)]">
              <span className="text-[var(--muted)] flex items-center gap-1">
                <Scale className="h-3.5 w-3.5" /> Posisi Bersih
              </span>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-black border ${
                    isNetPositive
                      ? 'bg-[var(--status-income-soft)] text-[var(--status-income)] border-[var(--status-income)]/25'
                      : isNetNegative
                      ? 'bg-[var(--status-expense-soft)] text-[var(--status-expense)] border-[var(--status-expense)]/25'
                      : 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)]'
                  }`}
                >
                  {isNetPositive ? 'Surplus' : isNetNegative ? 'Beban' : 'Seimbang'}
                </span>
                <span
                  className={`font-black tabular-nums ${
                    isNetPositive
                      ? 'text-[var(--status-income)]'
                      : isNetNegative
                      ? 'text-[var(--status-expense)]'
                      : 'text-[var(--fg)]'
                  }`}
                >
                  {isNetPositive ? '+' : isNetNegative ? '-' : ''}
                  {formatCurrency(Math.abs(netPosition), defaultCurrency, locale)}
                </span>
              </div>
            </div>

            {/* Urgent hint (if present) */}
            {mostUrgentItem && mostUrgentItem.daysLeft !== null && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-500 font-semibold pt-0.5">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  <strong className="font-bold">{mostUrgentItem.title}</strong>{' '}
                  {mostUrgentItem.isOverdue
                    ? 'terlambat'
                    : mostUrgentItem.daysLeft === 0
                    ? 'jatuh tempo hari ini'
                    : `${mostUrgentItem.daysLeft} hari lagi`}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-3 text-center">
            <p className="text-xs font-bold text-[var(--muted)]">Belum Ada Catatan Utang & Piutang</p>
          </div>
        )}
      </div>
    </section>
  )
})

export default DashboardLoanWidget
