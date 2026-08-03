import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import useTranslation from '../../hooks/useTranslation'
import { formatCurrency } from '../../lib/utils'
import ChartTooltip from './ChartTooltip'

function formatIdrCompact(amount, { locale = 'id', withPrefix = false } = {}) {
  const n = Number(amount || 0)
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const prefix = withPrefix ? 'Rp ' : ''
  const fmt = (value, digits = 1) =>
    value.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    })

  if (abs >= 1_000_000_000_000) return `${sign}${prefix}${fmt(abs / 1_000_000_000_000)} T`
  if (abs >= 1_000_000_000) return `${sign}${prefix}${fmt(abs / 1_000_000_000)} M`
  if (abs >= 1_000_000) return `${sign}${prefix}${fmt(abs / 1_000_000)} jt`
  if (abs >= 1_000) return `${sign}${prefix}${fmt(Math.round(abs), 0)}`
  return `${sign}${prefix}${fmt(abs, 0)}`
}

export default function ReportBarChart({ monthlyIncomeExpense, selectedMonth, onSelectMonthIdx }) {
  const { t, locale } = useTranslation()

  const yAxisTickFormatter = (value) => formatIdrCompact(value, { locale, withPrefix: false })

  return (
    <section className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel-strong)] shadow-[var(--shadow-card)]">
      <h3 className="border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_40%,transparent)] px-5 py-3.5 text-[15px] font-bold tracking-tight text-[var(--fg)]">
        {t('reports.monthlyIncomeExpense')}
      </h3>
      <div className="p-4 sm:p-5">
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-[1rem] border border-[color-mix(in_srgb,var(--status-income)_30%,var(--border))] bg-[color-mix(in_srgb,var(--status-income)_5%,var(--field-bg))] px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wider text-[var(--muted-2)] uppercase">{selectedMonth?.month || '-'}</p>
            <p className="mt-1 text-sm font-bold tracking-tight text-[var(--status-income)]">
              {formatCurrency(selectedMonth?.income || 0, 'IDR')}
            </p>
          </div>
          <div className="rounded-[1rem] border border-[color-mix(in_srgb,var(--status-expense)_30%,var(--border))] bg-[color-mix(in_srgb,var(--status-expense)_5%,var(--field-bg))] px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wider text-[var(--muted-2)] uppercase">{t('reports.thisMonthExpense')}</p>
            <p className="mt-1 text-sm font-bold tracking-tight text-[var(--status-expense)]">
              {formatCurrency(selectedMonth?.expense || 0, 'IDR')}
            </p>
          </div>
        </div>

        <div className="h-72 rounded-2xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_40%,transparent)] p-3 shadow-inner">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyIncomeExpense} barGap={6}>
              <defs>
                <linearGradient id="incomeBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--status-income)" stopOpacity={1} />
                  <stop offset="100%" stopColor="var(--status-income)" stopOpacity={0.5} />
                </linearGradient>
                <linearGradient id="expenseBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--status-expense)" stopOpacity={1} />
                  <stop offset="100%" stopColor="var(--status-expense)" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
              <XAxis dataKey="month" stroke="var(--muted-2)" tickLine={false} axisLine={false} fontSize={11} fontWeight={500} dy={8} />
              <YAxis stroke="var(--muted-2)" tickLine={false} axisLine={false} width={52} tickFormatter={yAxisTickFormatter} fontSize={11} fontWeight={500} />
              <Tooltip content={<ChartTooltip />} cursor={false} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)' }} />
              <Bar dataKey="income" name={t('reports.thisMonthIncome')} fill="url(#incomeBar)" radius={[6, 6, 0, 0]} onClick={(_, idx) => onSelectMonthIdx(idx)} />
              <Bar dataKey="expense" name={t('reports.thisMonthExpense')} fill="url(#expenseBar)" radius={[6, 6, 0, 0]} onClick={(_, idx) => onSelectMonthIdx(idx)} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}
