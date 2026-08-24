import { memo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { X, TrendingUp, TrendingDown, ArrowDownRight, ArrowUpRight, Wallet, GitCompare, Activity, PieChart, ChevronDown } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { formatExpenseCategory } from '../../lib/expenseCategories'
import HabitHeatmapWidget from '../habits/HabitHeatmapWidget'
import { ProgressBar } from './DashboardStatComponents'
import { getCompactItems } from '../../hooks/useDashboardData'
import useBackButton from '../../hooks/useBackButton'

export const DashboardZoomOverlay = memo(function DashboardZoomOverlay({
  zoomedChart,
  zoomVisible,
  onCloseZoom,
  defaultCurrency,
  locale,
  t,
  reduceMotion,
  // Net Worth Modal Props
  zoomRevenueRange,
  setZoomRevenueRange,
  zoomRevenueValue,
  netWorthGrowth,
  comparePrevious,
  setComparePrevious,
  comparisonSummary,
  zoomCombinedChartSeries,
  zoomRevenueChartDomain,
  zoomRevenueAxisTicks,
  formatAxisCurrency,
  rangedSummaryStats,
  showDetailedAnalytics,
  setShowDetailedAnalytics,
  zoomPeakAndFloor,
  assetBreakdownData,
  zoomTooltipDismissed,
  setZoomTooltipDismissed,
  // Habit Modal Props
  globalWeeklyTrend,
  // Budget / Savings Modal Props
  budgetGoalSummary,
  currentMonthLabel,
}) {
  const navigate = useNavigate()
  const zoomChartRef = useRef(null)

  useBackButton(onCloseZoom, Boolean(zoomedChart))

  useEffect(() => {
    const handleTapOutside = (event) => {
      if (zoomChartRef.current && !zoomChartRef.current.contains(event.target)) {
        setZoomTooltipDismissed?.(true)
      }
    }
    document.addEventListener('touchstart', handleTapOutside, { passive: true })
    document.addEventListener('mousedown', handleTapOutside)
    return () => {
      document.removeEventListener('touchstart', handleTapOutside)
      document.removeEventListener('mousedown', handleTapOutside)
    }
  }, [setZoomTooltipDismissed])

  if (!zoomedChart || typeof document === 'undefined') return null

  const handleZoomChartTouchOrMove = () => {
    setZoomTooltipDismissed?.(false)
  }

  const rangeTitleMap = {
    '1d': t('dashboard.rangeTitle.1d', 'Total Hari Ini'),
    '1w': t('dashboard.rangeTitle.1w', 'Total 7 Hari'),
    '1m': t('dashboard.rangeTitle.1m', 'Total 30 Hari'),
    '3m': t('dashboard.rangeTitle.3m', 'Total 90 Hari'),
    'ytd': t('dashboard.rangeTitle.ytd', 'Total Tahun Ini'),
    '1y': t('dashboard.rangeTitle.1y', 'Total 1 Tahun'),
    'all': t('dashboard.rangeTitle.all', 'Total Semua Waktu'),
  }

  const isNetPositive = (netWorthGrowth?.net ?? 0) > 0
  const isNetNegative = (netWorthGrowth?.net ?? 0) < 0

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        onClick={onCloseZoom}
        className={`ft-motion-overlay absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          zoomVisible ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label={t('dashboard.zoom.close') || 'Tutup'}
      />

      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl sm:px-3 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div
          className={`origin-bottom rounded-t-[32px] sm:rounded-3xl border-t sm:border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl max-h-[min(90dvh,48rem)] overflow-y-auto transition-all duration-300 ft-hide-scrollbar ${
            zoomVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-12 scale-95 opacity-0'
          }`}
          style={{
            boxShadow: 'var(--shadow)',
            transitionTimingFunction: zoomVisible ? 'cubic-bezier(0.16, 1, 0.3, 1)' : 'cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border-strong)]/40" />

          {zoomedChart === 'habits' ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black tracking-tight text-[var(--fg)]">
                    {t('habits.activityTitle', 'Aktivitas Kebiasaan')}
                  </h3>
                  <p className="text-[10px] font-semibold text-[var(--muted)]">
                    {t('habits.activitySubtitle', 'Riwayat dan konsistensi harian')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCloseZoom}
                  className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>

              <HabitHeatmapWidget />

              <div className="mt-4">
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  {t('habits.averageCompletionTrend', 'Tren Penyelesaian Rata-Rata')}
                </h4>
                <div className="h-40 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] p-3 text-[var(--fg)]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={globalWeeklyTrend} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorGlobalRate" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                      <Tooltip
                        formatter={(val) => [`${val}%`, t('habits.averageCompletion', 'Rata-Rata Penyelesaian')]}
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid var(--border)',
                          background: 'var(--panel-strong)',
                          color: 'var(--fg)',
                          fontSize: 12,
                          boxShadow: 'var(--shadow-soft)',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="rate"
                        stroke="var(--accent)"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorGlobalRate)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={onCloseZoom}
                  className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-5 py-2 text-xs font-semibold text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors cursor-pointer"
                >
                  {t('dashboard.zoom.close') || 'Tutup'}
                </button>
              </div>
            </>
          ) : zoomedChart === 'savings' ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-black tracking-tight text-[var(--fg)]">{t('dashboard.savings') || 'Target Tabungan'}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onCloseZoom()
                      navigate('/savings')
                    }}
                    className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-[11px] font-semibold text-[var(--fg)] hover:bg-[var(--field-bg)] cursor-pointer"
                  >
                    + {t('savings.title', 'Target')}
                  </button>
                  <button
                    type="button"
                    onClick={onCloseZoom}
                    className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer"
                  >
                    <X className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {budgetGoalSummary?.goalRows?.length ? (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {budgetGoalSummary.goalRows.map((row) => (
                      <div key={row.id} className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-bold text-[var(--fg)]">{row.name}</p>
                          <span className="text-[11px] font-bold text-[var(--muted)]">{Math.round(row.pct)}%</span>
                        </div>
                        <p className="mt-1 text-xs font-semibold tabular-nums text-[var(--muted)]">
                          {formatCurrency(row.current, defaultCurrency, locale)} / <span className="text-[var(--fg)]">{formatCurrency(row.target, defaultCurrency, locale)}</span>
                        </p>
                        <ProgressBar value={row.pct} tone="savings" className="mt-2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-4 text-center">
                    <p className="text-xs font-semibold text-[var(--fg)]">{t('dashboard.savings.empty') || 'Belum ada target'}</p>
                  </div>
                )}
              </div>
            </>
          ) : zoomedChart === 'budget' ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-black tracking-tight text-[var(--fg)]">{t('dashboard.budget') || 'Anggaran'}</h3>
                  <p className="text-[10px] font-semibold text-[var(--muted)]">{currentMonthLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onCloseZoom()
                      navigate('/budget')
                    }}
                    className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-[11px] font-semibold text-[var(--fg)] hover:bg-[var(--field-bg)] cursor-pointer"
                  >
                    + {t('budget.title', 'Anggaran')}
                  </button>
                  <button
                    type="button"
                    onClick={onCloseZoom}
                    className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer"
                  >
                    <X className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {budgetGoalSummary?.budgetRows?.length ? (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {budgetGoalSummary.budgetRows.map((row) => (
                      <div key={row.id} className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-bold text-[var(--fg)]">{formatExpenseCategory(row.category, locale)}</p>
                          <span
                            className={`text-[11px] font-bold ${
                              row.pct >= 100 ? 'text-rose-500' : row.pct >= 80 ? 'text-amber-500' : 'text-[var(--muted)]'
                            }`}
                          >
                            {Math.round(row.pct)}%
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-semibold tabular-nums text-[var(--muted)]">
                          {formatCurrency(row.spent, defaultCurrency, locale)} / <span className="text-[var(--fg)]">{formatCurrency(row.limit, defaultCurrency, locale)}</span>
                        </p>
                        <ProgressBar value={row.pct} tone="budget" className="mt-2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-4 text-center">
                    <p className="text-xs font-semibold text-[var(--fg)]">{t('dashboard.budget.empty') || 'Belum ada anggaran'}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* — Net Worth Modal Header — */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-[var(--accent)]/15">
                    <TrendingUp className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-tight text-[var(--fg)]">
                      {t('dashboard.netWorth', 'Kekayaan Bersih')}
                    </h3>
                    <p className="text-[10px] font-semibold text-[var(--muted)]">
                      {t('dashboard.netWorthSubtitle', 'Ringkasan & Fluktuasi Aset')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onCloseZoom}
                  aria-label={t('dashboard.zoom.close') || 'Tutup'}
                  className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>

              {/* — Hero Balance & Growth Badge — */}
              <div className="mb-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  {rangeTitleMap[zoomRevenueRange] || t('dashboard.totalPeriod', 'Total Periode')}
                </p>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                  <p className="text-[20px] sm:text-[26px] font-black tabular-nums leading-tight tracking-tight text-[var(--fg)]">
                    {formatCurrency(zoomRevenueValue, defaultCurrency, locale)}
                  </p>
                  <span
                    className={`inline-flex whitespace-nowrap shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border transition-colors ${
                      isNetPositive
                        ? 'bg-[var(--status-income-soft)] text-[var(--status-income)] border-[var(--status-income)]/20'
                        : isNetNegative
                        ? 'bg-[var(--status-expense-soft)] text-[var(--status-expense)] border-[var(--status-expense)]/20'
                        : 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)]'
                    }`}
                  >
                    {isNetPositive ? (
                      <TrendingUp className="h-3.5 w-3.5 shrink-0 text-[var(--status-income)]" strokeWidth={2.5} />
                    ) : isNetNegative ? (
                      <TrendingDown className="h-3.5 w-3.5 shrink-0 text-[var(--status-expense)]" strokeWidth={2.5} />
                    ) : null}
                    <span>
                      {isNetPositive ? '+' : ''}
                      {formatCurrency(netWorthGrowth.net, defaultCurrency, locale)} ({isNetPositive ? '+' : ''}{Math.round(netWorthGrowth.pct)}%)
                    </span>
                  </span>
                </div>

                {/* Comparison Summary Banner Container with Smooth Animated Expansion */}
                <div
                  className={`grid transition-all duration-320 transform-gpu ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    comparePrevious && comparisonSummary
                      ? 'grid-rows-[1fr] opacity-100 mt-2.5 translate-y-0'
                      : 'grid-rows-[0fr] opacity-0 mt-0 -translate-y-1 pointer-events-none'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] px-3.5 py-2 text-xs shadow-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
                          <GitCompare className="h-3.5 w-3.5" strokeWidth={2.2} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[11px] font-bold text-[var(--fg)] truncate block">
                            {t('dashboard.compareVsPrev', 'Perubahan vs Periode Lalu')}
                          </span>
                        </div>
                      </div>
                      <span className={`font-black tabular-nums shrink-0 ${
                        comparisonSummary?.isPositive ? 'text-[var(--status-income)]' : 'text-[var(--status-expense)]'
                      }`}>
                        {comparisonSummary?.isPositive ? '+' : ''}
                        {formatCurrency(comparisonSummary?.diff ?? 0, defaultCurrency, locale)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* — Compact Filter Toggle & Compare Switch — */}
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1 overflow-x-auto ft-hide-scrollbar">
                  <div className="inline-flex min-w-full items-center gap-0.5 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] p-1 select-none">
                    {getCompactItems(locale).map((item) => {
                      const isActive = zoomRevenueRange === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setZoomRevenueRange(item.id)}
                          className={`flex-1 min-w-[32px] px-2 h-7.5 flex items-center justify-center rounded-xl text-[11px] font-bold tracking-tight transition-colors duration-150 active:scale-95 cursor-pointer whitespace-nowrap ${
                            isActive
                              ? 'bg-[var(--fg)] text-[var(--bg)] shadow-xs'
                              : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--border)]/40'
                          }`}
                        >
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setComparePrevious?.((prev) => !prev)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-1.5 h-9.5 text-[11px] font-bold border transition-all active:scale-95 cursor-pointer select-none ${
                    comparePrevious
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm shadow-[var(--accent)]/20'
                      : 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--fg)] hover:border-[var(--border-strong)]'
                  }`}
                  title={t('dashboard.compare', 'Bandingkan')}
                >
                  <GitCompare className={`h-3.5 w-3.5 shrink-0 ${comparePrevious ? 'text-white' : 'text-[var(--accent)]'}`} strokeWidth={2.2} />
                  <span className="hidden xs:inline sm:inline">{t('dashboard.compare', 'Bandingkan')}</span>
                  {comparePrevious && <span className="h-1.5 w-1.5 rounded-full bg-white ml-0.5" />}
                </button>
              </div>

              {/* Chart Comparison Micro-Legend with Smooth Animated Expansion */}
              <div
                className={`grid transition-all duration-320 transform-gpu ease-[cubic-bezier(0.32,0.72,0,1)] ${
                  comparePrevious
                    ? 'grid-rows-[1fr] opacity-100 mb-1.5 mt-0.5 translate-y-0'
                    : 'grid-rows-[0fr] opacity-0 mb-0 mt-0 -translate-y-1 pointer-events-none'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="flex items-center justify-end gap-3.5 text-[10px] font-bold text-[var(--muted)] py-0.5">
                    <div className="flex items-center gap-1.5 transition-transform duration-200">
                      <span className="h-1.5 w-3.5 rounded-full bg-[var(--accent)] inline-block shadow-2xs" />
                      <span className="text-[var(--fg)]">{t('dashboard.currentPeriod', 'Periode Ini')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 transition-transform duration-200">
                      <span className="h-0.5 w-3.5 border-b-2 border-dashed border-[var(--muted-2)] inline-block" />
                      <span className="text-[var(--muted)]">{t('dashboard.prevPeriod', 'Periode Sebelumnya')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* — Chart Area — */}
              <div
                ref={zoomChartRef}
                onTouchStart={handleZoomChartTouchOrMove}
                className="h-56 w-full text-[var(--fg)]"
              >
                <ResponsiveContainer width="100%" height="100%" debounce={100}>
                  <AreaChart
                    data={zoomCombinedChartSeries}
                    margin={{ top: 14, right: defaultCurrency === 'IDR' ? 44 : 40, bottom: 20, left: 4 }}
                    onMouseMove={handleZoomChartTouchOrMove}
                    onTouchStart={handleZoomChartTouchOrMove}
                    onTouchMove={handleZoomChartTouchOrMove}
                    onMouseLeave={() => setZoomTooltipDismissed?.(true)}
                  >
                    <defs>
                      <linearGradient id="nwGradZoom" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.38} />
                        <stop offset="50%" stopColor="var(--accent)" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.35} vertical={false} />
                    <XAxis
                      dataKey="time"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--muted)', fontSize: 10 }}
                      dy={6}
                      tickFormatter={(timeMs) => {
                        if (!timeMs || !Number.isFinite(timeMs)) return ''
                        const d = new Date(timeMs)
                        if (zoomRevenueRange === '1d') return format(d, 'HH:mm')
                        if (zoomRevenueRange === 'all') return format(d, 'MMM yy')
                        if (zoomRevenueRange === '1y' || zoomRevenueRange === 'ytd') return format(d, 'MMM')
                        return format(d, 'd MMM')
                      }}
                      interval="preserveStartEnd"
                      minTickGap={28}
                    />
                    <YAxis
                      domain={zoomRevenueChartDomain}
                      orientation="right"
                      tick={{ fill: 'var(--muted)', fontSize: 10 }}
                      tickFormatter={(v) => formatAxisCurrency(v, defaultCurrency)}
                      ticks={zoomRevenueAxisTicks}
                      interval={0}
                      axisLine={false}
                      tickLine={false}
                      width={defaultCurrency === 'IDR' ? 44 : 38}
                    />
                    <Tooltip
                      cursor={{ stroke: 'var(--accent)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                      content={(props) => {
                        if (zoomTooltipDismissed || !props.active || !props.payload || !props.payload.length) return null
                        const payloadItem = props.payload[0]?.payload || {}
                        const rawVal = props.payload[0]?.value
                        const valStr = formatCurrency(rawVal, defaultCurrency, locale)
                        const ts = Number(payloadItem?.time ?? props.label)
                        const isMonthlyData = ['1y', 'ytd', 'all'].includes(zoomRevenueRange)
                        const labelStr =
                          Number.isFinite(ts) && ts > 0
                            ? format(new Date(ts), isMonthlyData ? 'MMMM yyyy' : 'dd MMM yyyy, HH:mm')
                            : '-'
                        const prevVal = payloadItem?.prevValue
                        const hasPrev = comparePrevious && prevVal !== undefined && Number.isFinite(prevVal)
                        const diff = hasPrev ? rawVal - prevVal : 0

                        return (
                          <div className="pointer-events-none rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 text-xs shadow-xl text-[var(--fg)] min-w-[200px] space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]/60 pb-1">
                              {labelStr}
                            </p>
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <span className="flex items-center gap-1.5 font-semibold text-[var(--fg)]">
                                <span className="h-2 w-2 rounded-full bg-[var(--accent)] shrink-0" />
                                {t('dashboard.currentPeriod', 'Periode Ini')}:
                              </span>
                              <span className="font-black tabular-nums text-[var(--accent)]">{valStr}</span>
                            </div>
                            {hasPrev && (
                              <>
                                <div className="flex items-center justify-between gap-3 text-xs">
                                  <span className="flex items-center gap-1.5 font-medium text-[var(--muted)]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted)] shrink-0" />
                                    {payloadItem?.prevLabel || t('dashboard.prevPeriod', 'Periode Lalu')}:
                                  </span>
                                  <span className="font-bold tabular-nums text-[var(--fg)]">
                                    {formatCurrency(prevVal, defaultCurrency, locale)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-3 text-[11px] pt-1 border-t border-[var(--border)]/40 font-bold">
                                  <span className="text-[var(--muted)]">{t('dashboard.diff', 'Selisih')}:</span>
                                  <span className={`tabular-nums font-black ${
                                    diff >= 0 ? 'text-[var(--status-income)]' : 'text-[var(--status-expense)]'
                                  }`}>
                                    {diff >= 0 ? '+' : ''}
                                    {formatCurrency(diff, defaultCurrency, locale)}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        )
                      }}
                    />
                    {comparePrevious && (
                      <Line
                        type="monotone"
                        dataKey="prevValue"
                        stroke="var(--muted)"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 1.5, stroke: 'var(--panel-strong)', fill: 'var(--muted)' }}
                        isAnimationActive={!reduceMotion}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--accent)"
                      fill="url(#nwGradZoom)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4.5, strokeWidth: 2, stroke: 'var(--panel-strong)', fill: 'var(--accent)' }}
                      isAnimationActive={!reduceMotion}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* — Contextual Summary Cards — */}
              <div className="mt-3.5 grid grid-cols-3 gap-2">
                {[
                  { label: t('dashboard.income', 'Masuk'), value: rangedSummaryStats?.income ?? 0, positive: true, icon: ArrowDownRight, iconColor: 'text-[var(--status-income)]' },
                  { label: t('dashboard.expense', 'Keluar'), value: rangedSummaryStats?.expense ?? 0, positive: false, icon: ArrowUpRight, iconColor: 'text-[var(--status-expense)]' },
                  { label: t('dashboard.net', 'Selisih'), value: rangedSummaryStats?.net ?? 0, positive: (rangedSummaryStats?.net ?? 0) >= 0, icon: Wallet, iconColor: 'text-[var(--accent)]' },
                ].map(({ label, value, positive, icon: Icon, iconColor }) => (
                  <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-2 sm:px-3 sm:py-2.5 shadow-2xs min-w-0">
                    <div className="flex items-center gap-1 min-w-0">
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} strokeWidth={2.2} />
                      <span className="text-[9.5px] sm:text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] truncate">{label}</span>
                    </div>
                    <p className={`mt-1 text-[11px] sm:text-xs md:text-sm font-black tabular-nums tracking-tight truncate ${
                      label === t('dashboard.net', 'Selisih')
                        ? positive
                          ? 'text-[var(--status-income)]'
                          : 'text-[var(--status-expense)]'
                        : 'text-[var(--fg)]'
                    }`}>
                      {label === t('dashboard.net', 'Selisih') && value > 0 ? '+' : ''}{formatCurrency(value, defaultCurrency, locale)}
                    </p>
                  </div>
                ))}
              </div>

              {/* — Collapsible Secondary Analytics Toggle Button — */}
              <button
                type="button"
                onClick={() => setShowDetailedAnalytics?.((prev) => !prev)}
                className="mt-3 flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-2.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] transition-all active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[var(--accent)] shrink-0" strokeWidth={2.2} />
                  <span>{t('dashboard.statsComposition', 'Statistik & Komposisi Aset')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-[var(--muted-2)]">
                    {showDetailedAnalytics ? t('common.hide', 'Sembunyikan') : t('common.show', 'Tampilkan')}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--muted)] shrink-0 transition-transform duration-300 ${
                      showDetailedAnalytics ? 'rotate-180 text-[var(--accent)]' : ''
                    }`}
                    strokeWidth={2.2}
                  />
                </div>
              </button>

              {/* — Collapsible Secondary Content — */}
              <div className={`ft-accordion-wrapper ${showDetailedAnalytics ? 'is-open' : ''}`}>
                <div className="ft-accordion-inner space-y-2.5">
                  {/* Key Indicators (Peak, Floor, Average Rate) */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 text-left min-w-0">
                      <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold tracking-wide uppercase text-[var(--muted)] min-w-0">
                        <ArrowUpRight className="h-3.5 w-3.5 text-[var(--status-income)] shrink-0" strokeWidth={2.5} />
                        <span className="truncate">{t('dashboard.peak', 'Tertinggi')}</span>
                      </div>
                      <p className="mt-1 text-[11px] sm:text-xs md:text-sm font-black tabular-nums tracking-tight text-[var(--fg)] truncate">
                        {formatCurrency(zoomPeakAndFloor?.max ?? 0, defaultCurrency, locale)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 text-left min-w-0">
                      <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold tracking-wide uppercase text-[var(--muted)] min-w-0">
                        <ArrowDownRight className="h-3.5 w-3.5 text-[var(--status-expense)] shrink-0" strokeWidth={2.5} />
                        <span className="truncate">{t('dashboard.floor', 'Terendah')}</span>
                      </div>
                      <p className="mt-1 text-[11px] sm:text-xs md:text-sm font-black tabular-nums tracking-tight text-[var(--fg)] truncate">
                        {formatCurrency(zoomPeakAndFloor?.min ?? 0, defaultCurrency, locale)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 text-left min-w-0">
                      <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold tracking-wide uppercase text-[var(--muted)] min-w-0">
                        <Activity className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" strokeWidth={2.5} />
                        <span className="truncate">{t('dashboard.avgRateShort', 'Rata-rata')}</span>
                      </div>
                      <div className="mt-1 min-w-0">
                        <p className={`text-[11px] sm:text-xs md:text-sm font-black tabular-nums tracking-tight truncate ${
                          (zoomPeakAndFloor?.netRate ?? 0) > 0
                            ? 'text-[var(--status-income)]'
                            : (zoomPeakAndFloor?.netRate ?? 0) < 0
                            ? 'text-[var(--status-expense)]'
                            : 'text-[var(--fg)]'
                        }`}>
                          {(zoomPeakAndFloor?.netRate ?? 0) > 0 ? '+' : ''}
                          {formatCurrency(zoomPeakAndFloor?.netRate ?? 0, defaultCurrency, locale)}
                        </p>
                        <p className="text-[9px] font-semibold text-[var(--muted)] truncate">
                          / {zoomPeakAndFloor?.unitLabel || (locale === 'en' ? 'day' : 'hari')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Asset Breakdown Section */}
                  {assetBreakdownData?.items?.length > 0 && (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <PieChart className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" strokeWidth={2.2} />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--fg)]">
                            {t('dashboard.assetSourceComposition', 'Komposisi Sumber Aset')}
                          </h4>
                        </div>
                        <span className="text-[10px] font-semibold text-[var(--muted)]">
                          {assetBreakdownData.items.length} {t('dashboard.activeWallets', 'Dompet Aktif')}
                        </span>
                      </div>

                      {/* Multi-segment horizontal bar */}
                      <div className="mt-2.5 flex h-2 w-full overflow-hidden rounded-full bg-[var(--panel-strong)] border border-[var(--border)] p-0.5 gap-0.5">
                        {assetBreakdownData.items.map((item) => (
                          <div
                            key={item.id}
                            className={`h-full rounded-xs transition-all duration-300 ${item.color}`}
                            style={{ width: `${Math.max(2, item.pct)}%` }}
                            title={`${item.name}: ${item.pct}%`}
                          />
                        ))}
                      </div>

                      {/* Wallet Legend Grid */}
                      <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {assetBreakdownData.items.slice(0, 6).map((item) => (
                          <div key={item.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] px-2 py-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`h-2 w-2 rounded-full shrink-0 ${item.color}`} />
                              <span className="truncate text-[10px] font-semibold text-[var(--fg)]">{item.name}</span>
                            </div>
                            <span className="ml-1 text-[10px] font-bold tabular-nums text-[var(--muted)]">{item.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
})

export default DashboardZoomOverlay
