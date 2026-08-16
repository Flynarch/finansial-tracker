import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { formatCurrency } from '../../lib/utils'
import ChartTooltip from './ChartTooltip'

function formatDelta(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return '—'
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function formatCompactCurrency(amount, currency = 'IDR', { locale = 'id' } = {}) {
  const n = Number(amount || 0)
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const fmt = (value, digits = 1) =>
    value.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    })

  if (currency === 'IDR') {
    if (abs >= 1_000_000_000_000) return `${sign}${fmt(abs / 1_000_000_000_000)} T`
    if (abs >= 1_000_000_000) return `${sign}${fmt(abs / 1_000_000_000)} M`
    if (abs >= 1_000_000) return `${sign}${fmt(abs / 1_000_000)} jt`
    if (abs >= 1_000) return `${sign}${fmt(Math.round(abs), 0)}`
    return `${sign}${fmt(abs, 0)}`
  }

  const prefix = currency === 'USD' ? '$' : `${currency} `
  if (abs >= 1_000_000_000) return `${sign}${prefix}${fmt(abs / 1_000_000_000)}B`
  if (abs >= 1_000_000) return `${sign}${prefix}${fmt(abs / 1_000_000)}M`
  if (abs >= 1_000) return `${sign}${prefix}${fmt(abs / 1_000)}k`
  return `${sign}${prefix}${fmt(abs, 0)}`
}

export default function ReportNetWorthChart({ netWorthTrend }) {
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)

  const netWorthLatest = netWorthTrend.at(-1)?.netWorth ?? 0
  const netWorthPrev = netWorthTrend.at(-2)?.netWorth ?? 0
  const deltaText = formatDelta(netWorthLatest, netWorthPrev)

  const yAxisTickFormatter = (value) => formatCompactCurrency(value, defaultCurrency, { locale })

  return (
    <section className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel-strong)] shadow-[var(--shadow-card)]">
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold tracking-tight text-[var(--fg)]">
            {t('reports.netWorthTrend')}
          </h3>
          <p className="text-xs font-semibold text-[var(--muted)]">
            {t('dashboard.gold.current', 'Saat ini')}:{' '}
            <span className="font-extrabold text-[var(--accent)]">{formatCurrency(netWorthLatest, defaultCurrency)}</span>{' '}
            <span className="text-[11px] text-[var(--muted-2)]">({deltaText})</span>
          </p>
        </div>

        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={netWorthTrend}>
              <defs>
                <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
              <XAxis dataKey="month" stroke="var(--muted-2)" tickLine={false} axisLine={false} fontSize={11} fontWeight={500} dy={6} />
              <YAxis stroke="var(--muted-2)" tickLine={false} axisLine={false} width={48} tickFormatter={yAxisTickFormatter} fontSize={10} fontWeight={500} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke="var(--accent)"
                fill="url(#netWorthFill)"
                strokeWidth={3}
                activeDot={{ r: 5, fill: 'var(--accent)', stroke: 'var(--panel-strong)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}
