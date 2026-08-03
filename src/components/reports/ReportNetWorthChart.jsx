import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import useTranslation from '../../hooks/useTranslation'
import { formatCurrency } from '../../lib/utils'
import ChartTooltip from './ChartTooltip'

function formatDelta(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return '—'
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function formatIdrCompact(amount, { locale = 'id' } = {}) {
  const n = Number(amount || 0)
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const prefix = ''
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

export default function ReportNetWorthChart({ netWorthTrend }) {
  const { t, locale } = useTranslation()

  const netWorthLatest = netWorthTrend.at(-1)?.netWorth ?? 0
  const netWorthPrev = netWorthTrend.at(-2)?.netWorth ?? 0

  const yAxisTickFormatter = (value) => formatIdrCompact(value, { locale })

  return (
    <section className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel-strong)] shadow-[var(--shadow-card)]">
      <h3 className="border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_40%,transparent)] px-5 py-3.5 text-[15px] font-bold tracking-tight text-[var(--fg)]">
        {t('reports.netWorthTrend')}
      </h3>
      <div className="p-4 sm:p-5">
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-[1rem] border border-[color-mix(in_srgb,var(--accent)_30%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_5%,var(--field-bg))] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-2)]">{t('reports.netWorthTrend')}</p>
            <p className="mt-1 text-sm font-bold tracking-tight text-[var(--accent)]">{formatCurrency(netWorthLatest, 'IDR')}</p>
          </div>
          <div className="rounded-[1rem] border border-[color-mix(in_srgb,var(--accent-strong)_30%,var(--border))] bg-[color-mix(in_srgb,var(--accent-strong)_5%,var(--field-bg))] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-2)]">{t('reports.vsPrev')}</p>
            <p className="mt-1 text-sm font-bold tracking-tight text-[var(--accent-strong)]">{formatDelta(netWorthLatest, netWorthPrev)}</p>
          </div>
        </div>
        <div className="h-72 rounded-2xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_40%,transparent)] p-3 shadow-inner">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={netWorthTrend}>
              <defs>
                <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
              <XAxis dataKey="month" stroke="var(--muted-2)" tickLine={false} axisLine={false} fontSize={11} fontWeight={500} dy={8} />
              <YAxis stroke="var(--muted-2)" tickLine={false} axisLine={false} width={52} tickFormatter={yAxisTickFormatter} fontSize={11} fontWeight={500} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke="var(--accent)"
                fill="url(#netWorthFill)"
                strokeWidth={3}
                activeDot={{ r: 6, fill: 'var(--accent)', stroke: 'var(--panel-strong)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}
