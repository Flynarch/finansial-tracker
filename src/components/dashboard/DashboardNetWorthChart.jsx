import { memo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { MiniChartCard } from './DashboardStatComponents'

export const DashboardNetWorthChart = memo(function DashboardNetWorthChart({
  t,
  defaultCurrency,
  miniRevenueRange,
  miniRevenueSeries,
  miniRevenueChartDomain,
  miniRevenueAxisTicks,
  netWorthGrowth,
  reduceMotion,
  isCoarsePointer,
  computeRevenueValue,
  onOpenZoom,
  formatAxisCurrency,
  isMobileScreen,
}) {
  const isNetPositive = (netWorthGrowth?.net ?? 0) > 0
  const isNetNegative = (netWorthGrowth?.net ?? 0) < 0

  const rangeLabelMap = {
    '1d': '1 Hari',
    '1w': '1 Minggu',
    '1m': '1 Bulan',
    '3m': '3 Bulan',
    'ytd': 'YTD',
    '1y': '1 Tahun',
    'all': 'All Time',
  }

  return (
    <section className="ft-stagger-in" style={{ '--stagger': 2 }}>
      <MiniChartCard
        t={t}
        title={t('dashboard.netWorth') || 'Kekayaan Bersih'}
        value={formatCurrency(computeRevenueValue(miniRevenueRange), defaultCurrency)}
        trendBadge={
          <span
            className={`inline-flex whitespace-nowrap shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border transition-colors ${
              isNetPositive
                ? 'bg-[var(--status-income-soft)] text-[var(--status-income)] border-[var(--status-income)]/20'
                : isNetNegative
                ? 'bg-[var(--status-expense-soft)] text-[var(--status-expense)] border-[var(--status-expense)]/20'
                : 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)]'
            }`}
          >
            {isNetPositive ? (
              <TrendingUp className="h-3 w-3 shrink-0 text-[var(--status-income)]" strokeWidth={2.5} />
            ) : isNetNegative ? (
              <TrendingDown className="h-3 w-3 shrink-0 text-[var(--status-expense)]" strokeWidth={2.5} />
            ) : null}
            <span>
              {isNetPositive ? '+' : ''}
              {formatCurrency(netWorthGrowth.net, defaultCurrency)} ({isNetPositive ? '+' : ''}{Math.round(netWorthGrowth.pct)}%)
            </span>
          </span>
        }
        rangeId={miniRevenueRange}
        showXAxisDate
        data={miniRevenueSeries}
        stroke="var(--accent)"
        fill="var(--accent)"
        animate={!reduceMotion}
        premium
        animationDuration={isCoarsePointer ? 700 : 900}
        animationEasing="ease"
        onOpen={onOpenZoom}
        formatValue={(v) => formatCurrency(v, defaultCurrency)}
        xKey="time"
        yDomain={miniRevenueChartDomain}
        showRightAxis={true}
        rightAxisTickFormatter={(v) => formatAxisCurrency(v, defaultCurrency)}
        rightAxisWidth={defaultCurrency === 'IDR' ? (isMobileScreen ? 36 : 44) : 38}
        rightAxisTicks={miniRevenueAxisTicks}
        rangeLabel={rangeLabelMap[miniRevenueRange] || '1 Bulan'}
      />
    </section>
  )
})

export default DashboardNetWorthChart
