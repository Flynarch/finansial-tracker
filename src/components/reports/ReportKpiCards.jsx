import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { formatCurrency } from '../../lib/utils'

function formatDelta(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return '—'
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

export default function ReportKpiCards({ thisMonth, previousMonth }) {
  const { t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)

  const incomeDelta = formatDelta(thisMonth.income, previousMonth.income)
  const expenseDelta = formatDelta(thisMonth.expense, previousMonth.expense)

  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4">
      {/* Pemasukan Card */}
      <div className="group relative overflow-hidden rounded-[var(--radius-xl)] border border-[color-mix(in_srgb,var(--status-income)_25%,var(--border))] bg-[var(--panel-strong)] p-4 shadow-[var(--shadow-card)] transition hover:border-[var(--status-income)]">
        <div className="flex items-center justify-between gap-2">
          <div
            className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--status-income)_30%,transparent)] shadow-sm"
            style={{
              background: 'color-mix(in srgb, var(--status-income) 12%, var(--field-bg))',
              color: 'var(--status-income)',
            }}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted-2)]">
            {t('reports.thisMonthIncome')}
          </p>
        </div>
        <p
          className="mt-3 text-lg font-black tracking-tight text-[var(--status-income)] truncate min-w-0 sm:text-xl md:text-2xl"
          title={formatCurrency(thisMonth.income, defaultCurrency)}
        >
          {formatCurrency(thisMonth.income, defaultCurrency)}
        </p>
        <p className="mt-1 text-[11.5px] font-semibold text-[var(--muted)] truncate">
          {incomeDelta} <span className="font-normal text-[var(--muted-2)]">{t('reports.vsPrev')}</span>
        </p>
      </div>

      {/* Pengeluaran Card */}
      <div className="group relative overflow-hidden rounded-[var(--radius-xl)] border border-[color-mix(in_srgb,var(--status-expense)_25%,var(--border))] bg-[var(--panel-strong)] p-4 shadow-[var(--shadow-card)] transition hover:border-[var(--status-expense)]">
        <div className="flex items-center justify-between gap-2">
          <div
            className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--status-expense)_30%,transparent)] shadow-sm"
            style={{
              background: 'color-mix(in srgb, var(--status-expense) 12%, var(--field-bg))',
              color: 'var(--status-expense)',
            }}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted-2)]">
            {t('reports.thisMonthExpense')}
          </p>
        </div>
        <p
          className="mt-3 text-lg font-black tracking-tight text-[var(--status-expense)] truncate min-w-0 sm:text-xl md:text-2xl"
          title={formatCurrency(thisMonth.expense, defaultCurrency)}
        >
          {formatCurrency(thisMonth.expense, defaultCurrency)}
        </p>
        <p className="mt-1 text-[11.5px] font-semibold text-[var(--muted)] truncate">
          {expenseDelta} <span className="font-normal text-[var(--muted-2)]">{t('reports.vsPrev')}</span>
        </p>
      </div>
    </section>
  )
}
