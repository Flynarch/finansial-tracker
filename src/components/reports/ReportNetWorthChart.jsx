import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Landmark } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { formatCurrency, formatCompactCurrency, toSafeNumber } from '../../lib/utils'
import { formatDelta } from '../../lib/reportAnalytics'
import {
  CHART_X_AXIS_DEFAULTS,
  CHART_Y_AXIS_DEFAULTS,
  CHART_GRID_DEFAULTS,
  CHART_TOOLTIP_CURSOR,
  CHART_MARGIN_DEFAULTS,
} from '../../lib/chartTheme'
import ChartTooltip from './ChartTooltip'
import EmptyState from '../ui/EmptyState'

export default function ReportNetWorthChart({
  netWorthTrend = [],
  totalCash = 0,
  investmentValue = 0,
  netLoanPosition = 0,
}) {
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)

  const netWorthLatest = netWorthTrend.at(-1)?.netWorth ?? 0
  const netWorthPrev = netWorthTrend.at(-2)?.netWorth ?? 0
  const hasHistory = netWorthPrev !== 0
  const deltaText = hasHistory ? formatDelta(netWorthLatest, netWorthPrev) : '—'

  const hasAssets = totalCash !== 0 || investmentValue !== 0 || netLoanPosition !== 0
  const hasTrendData = (netWorthTrend || []).some((m) => toSafeNumber(m.netWorth) !== 0)

  const yAxisTickFormatter = (value) => formatCompactCurrency(value, defaultCurrency, locale, false)

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-[var(--shadow-card)]">
      {/* Title and Current Net Worth */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-black tracking-tight text-[var(--fg)]">
            {t('reports.netWorthTrend', 'Tren Kekayaan Bersih (Net Worth)')}
          </h3>
          <p className="text-[11px] font-medium text-[var(--muted)]">
            {t('reports.netWorthSubtitle', 'Akumulasi total aset dikurangi kewajiban aktif')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[var(--muted)]">{t('dashboard.gold.current', 'Total')}:</span>
          <span className="text-base sm:text-lg font-black tabular-nums text-[var(--accent)]">
            {formatCurrency(netWorthLatest, defaultCurrency)}
          </span>
          {hasHistory && (
            <span className="rounded-md bg-[var(--field-bg)] px-2 py-0.5 text-xs font-black tabular-nums text-[var(--muted)] border border-[var(--border)]">
              {deltaText}
            </span>
          )}
        </div>
      </div>

      {/* Area Chart or Empty State Placeholder */}
      {!hasTrendData && !hasAssets ? (
        <EmptyState
          icon={<Landmark className="h-7 w-7 text-[var(--muted)]" />}
          title={t('reports.noNetWorthTitle', 'Belum Ada Data Kekayaan Bersih')}
          description={t(
            'reports.noNetWorthSubtitle',
            'Grafik perkembangan kekayaan akan otomatis terbentuk dari saldo dompet dan aset Anda.'
          )}
          className="py-10 border border-dashed border-[var(--border)] rounded-2xl bg-[var(--field-bg)]/30"
        />
      ) : (
        <div className="h-56 sm:h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={netWorthTrend} margin={CHART_MARGIN_DEFAULTS}>
              <defs>
                <linearGradient id="netWorthFillGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...CHART_GRID_DEFAULTS} />
              <XAxis dataKey="month" {...CHART_X_AXIS_DEFAULTS} />
              <YAxis
                {...CHART_Y_AXIS_DEFAULTS}
                tickFormatter={yAxisTickFormatter}
                domain={['auto', 'auto']}
                allowDecimals={false}
              />
              <Tooltip
                content={<ChartTooltip currency={defaultCurrency} />}
                cursor={CHART_TOOLTIP_CURSOR}
              />
              <Area
                type="monotone"
                dataKey="netWorth"
                name={t('reports.netWorthTrend', 'Net Worth')}
                stroke="var(--accent)"
                fill="url(#netWorthFillGrad)"
                strokeWidth={3}
                activeDot={{ r: 6, fill: 'var(--accent)', stroke: 'var(--panel-strong)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
