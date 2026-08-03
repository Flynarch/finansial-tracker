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
import ChartTooltip from './ChartTooltip'

function formatIdrCompact(amount, { locale = 'id' } = {}) {
  const n = Number(amount || 0)
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const fmt = (value, digits = 1) =>
    value.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    })

  if (abs >= 1_000_000_000_000) return `${sign}${fmt(abs / 1_000_000_000_000)} T`
  if (abs >= 1_000_000_000) return `${sign}${fmt(abs / 1_000_000_000)} M`
  if (abs >= 1_000_000) return `${sign}${fmt(abs / 1_000_000)} jt`
  if (abs >= 1_000) return `${sign}${fmt(Math.round(abs), 0)}`
  return `${sign}${fmt(abs, 0)}`
}

export default function ReportBarChart({ monthlyIncomeExpense, onSelectMonthIdx }) {
  const { t, locale } = useTranslation()

  const yAxisTickFormatter = (value) => formatIdrCompact(value, { locale })

  return (
    <section className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel-strong)] shadow-[var(--shadow-card)]">
      <div className="p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-bold tracking-tight text-[var(--fg)]">
          {t('reports.monthlyIncomeExpense')}
        </h3>

        <div className="h-56">
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
              <XAxis dataKey="month" stroke="var(--muted-2)" tickLine={false} axisLine={false} fontSize={11} fontWeight={500} dy={6} />
              <YAxis stroke="var(--muted-2)" tickLine={false} axisLine={false} width={48} tickFormatter={yAxisTickFormatter} fontSize={10} fontWeight={500} />
              <Tooltip content={<ChartTooltip />} cursor={false} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted)', paddingTop: '4px' }} />
              <Bar dataKey="income" name={t('reports.income')} fill="url(#incomeBar)" radius={[5, 5, 0, 0]} onClick={(_, idx) => onSelectMonthIdx(idx)} />
              <Bar dataKey="expense" name={t('reports.expense')} fill="url(#expenseBar)" radius={[5, 5, 0, 0]} onClick={(_, idx) => onSelectMonthIdx(idx)} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}
