import { memo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { formatGrowthPercentage } from '../../hooks/dashboard/dashboardStats'
import { MiniChartCard } from './DashboardStatComponents'

export const DashboardNetWorthChart = memo(function DashboardNetWorthChart({
  isDbLoading = false,
  t,
  defaultCurrency,
  miniRevenueRange,
  miniRevenueSeries,
  miniRevenueChartDomain,
  miniRevenueAxisTicks,
  netWorthGrowth,
  computeRevenueValue,
  onOpenZoom,
  formatAxisCurrency,
  isMobileScreen,
}) {
  if (isDbLoading) {
    return (
      <section className="ft-stagger-in" style={{ '--stagger': 2 }}>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-sm animate-pulse space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-28 rounded-md bg-[var(--border)]/70" />
            <div className="h-5 w-24 rounded-full bg-[var(--border)]/50" />
          </div>
          <div className="h-7 w-36 rounded-xl bg-[var(--border)]/80" />
          <div className="h-20 w-full rounded-xl bg-[var(--field-bg)]/60" />
        </div>
      </section>
    )
  }

  const isNetPositive = (netWorthGrowth?.net ?? 0) > 0
  const isNetNegative = (netWorthGrowth?.net ?? 0) < 0
  const hasGrowth = Boolean(
    netWorthGrowth && (netWorthGrowth.net !== 0 || Math.abs(netWorthGrowth.pct) >= 0.05)
  )

  const rangeLabelMap = {
    '1d': t('dashboard.range.1d', '1 Hari'),
    '1w': t('dashboard.range.1w', '1 Minggu'),
    '1m': t('dashboard.range.1m', '1 Bulan'),
    '3m': t('dashboard.range.3m', '3 Bulan'),
    'ytd': t('dashboard.range.ytd', 'YTD'),
    '1y': t('dashboard.range.1y', '1 Tahun'),
    'all': t('dashboard.range.all', 'All Time'),
  }

  return (
    <section className="ft-stagger-in" style={{ '--stagger': 2 }}>
      <MiniChartCard
        t={t}
        title={t('dashboard.netWorth')}
        value={formatCurrency(computeRevenueValue(miniRevenueRange), defaultCurrency)}
        trendBadge={
          hasGrowth ? (
            <span
              className={`inline-flex whitespace-nowrap shrink-0 items-center self-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border transition-colors leading-none ${
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
              <span className="leading-tight">
                {isNetPositive ? '+' : ''}
                {formatCurrency(netWorthGrowth.net, defaultCurrency)} ({formatGrowthPercentage(netWorthGrowth.pct, true)})
              </span>
            </span>
          ) : null
        }
        rangeId={miniRevenueRange}
        showXAxisDate
        data={miniRevenueSeries}
        stroke="var(--accent)"
        fill="var(--accent)"
        animate={false}
        premium
        onOpen={onOpenZoom}
        formatValue={(v) => formatCurrency(v, defaultCurrency)}
        xKey="time"
        yDomain={miniRevenueChartDomain}
        showRightAxis={true}
        rightAxisTickFormatter={(v) => formatAxisCurrency(v, defaultCurrency)}
        rightAxisWidth={defaultCurrency === 'IDR' ? (isMobileScreen ? 48 : 54) : 42}
        rightAxisTicks={miniRevenueAxisTicks}
        rangeLabel={rangeLabelMap[miniRevenueRange] || '1 Bulan'}
        emptyTitle={t('dashboard.netWorthEmptyTitle', 'Belum Ada Pergerakan Aset')}
        emptyDesc={t('dashboard.netWorthEmptyDesc', 'Grafik tren kekayaan otomatis tersusun begitu saldo dompet, investasi, atau transaksi mulai terisi.')}
      />
    </section>
  )
})

export default DashboardNetWorthChart
