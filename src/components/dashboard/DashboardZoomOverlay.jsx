import { memo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { X, TrendingUp, TrendingDown, ArrowDownRight, ArrowUpRight, Wallet, GitCompare, Activity, PieChart, ChevronDown } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { formatExpenseCategory } from '../../lib/expenseCategories'
import HabitHeatmapWidget from '../habits/HabitHeatmapWidget'
import { ChartToggle, ProgressBar } from './DashboardStatComponents'
import { COMPACT_ITEMS } from '../../hooks/useDashboardData'

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
    '1d': 'Total Hari Ini',
    '1w': 'Total 7 Hari',
    '1m': 'Total 30 Hari',
    '3m': 'Total 90 Hari',
    'ytd': 'Total Tahun Ini',
    '1y': 'Total 1 Tahun',
    'all': 'Total Semua Waktu',
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

      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div
          className={`origin-bottom rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-2xl max-h-[88vh] overflow-y-auto transition-all duration-380 ft-hide-scrollbar ${
            zoomVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-12 scale-95 opacity-0'
          }`}
          style={{
            boxShadow: 'var(--shadow)',
            transitionTimingFunction: zoomVisible ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : 'cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border-strong)]/40" />

          {zoomedChart === 'habits' ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black tracking-tight text-[var(--fg)]">Aktivitas Kebiasaan</h3>
                  <p className="text-[10px] font-semibold text-[var(--muted)]">Riwayat dan konsistensi harian</p>
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
                  Tren Penyelesaian Rata-Rata
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
                        formatter={(val) => [`${val}%`, 'Rata-Rata Penyelesaian']}
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
                    + Target
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
                    + Anggaran
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
                    <h3 className="text-sm font-black tracking-tight text-[var(--fg)]">Kekayaan Bersih</h3>
                    <p className="text-[10px] font-semibold text-[var(--muted)]">Ringkasan & Fluktuasi Aset</p>
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
                  {rangeTitleMap[zoomRevenueRange] || 'Total Periode'}
                </p>
                <div className="mt-0.5 flex items-center gap-2.5">
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
              </div>

              {/* — Compact Filter Toggle & Compare Switch — */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <ChartToggle
                    value={zoomRevenueRange}
                    onChange={setZoomRevenueRange}
                    items={COMPACT_ITEMS}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setComparePrevious?.((prev) => !prev)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-1.5 text-[11px] font-bold border transition-all active:scale-95 cursor-pointer ${
                    comparePrevious
                      ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30 shadow-xs'
                      : 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--fg)]'
                  }`}
                >
                  <GitCompare className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                  <span>Bandingkan</span>
                </button>
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
                        const rawVal = props.payload[0]?.value
                        const valStr = formatCurrency(rawVal, defaultCurrency, locale)
                        const ts = Number(props.payload[0]?.payload?.time ?? props.label)
                        const isMonthlyData = ['1y', 'ytd', 'all'].includes(zoomRevenueRange)
                        const labelStr =
                          Number.isFinite(ts) && ts > 0
                            ? format(new Date(ts), isMonthlyData ? 'MMMM yyyy' : 'dd MMM yyyy, HH:mm')
                            : '-'

                        return (
                          <div className="pointer-events-none rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-xs shadow-[var(--shadow-soft)] text-[var(--fg)]">
                            <p className="text-[10px] font-semibold text-[var(--muted)]">{labelStr}</p>
                            <p className="mt-0.5 font-bold text-[var(--fg)] tabular-nums">
                              Kekayaan Bersih: <span className="text-[var(--accent)]">{valStr}</span>
                            </p>
                            {comparePrevious && props.payload[1]?.value !== undefined && (
                              <p className="mt-0.5 text-[11px] font-medium text-[var(--muted)] tabular-nums">
                                Periode Lalu: <span>{formatCurrency(props.payload[1].value, defaultCurrency, locale)}</span>
                              </p>
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
                        strokeWidth={1.8}
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
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
                      animationDuration={700}
                      animationEasing="ease"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* — Contextual Summary Cards — */}
              <div className="mt-3.5 grid grid-cols-3 gap-2">
                {[
                  { label: 'Masuk', value: rangedSummaryStats?.income ?? 0, positive: true, icon: ArrowDownRight, iconColor: 'text-[var(--status-income)]' },
                  { label: 'Keluar', value: rangedSummaryStats?.expense ?? 0, positive: false, icon: ArrowUpRight, iconColor: 'text-[var(--status-expense)]' },
                  { label: 'Selisih', value: rangedSummaryStats?.net ?? 0, positive: (rangedSummaryStats?.net ?? 0) >= 0, icon: Wallet, iconColor: 'text-[var(--accent)]' },
                ].map(({ label, value, positive, icon: Icon, iconColor }) => (
                  <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-2.5 shadow-2xs">
                    <div className="flex items-center gap-1">
                      <Icon className={`h-3.5 w-3.5 ${iconColor}`} strokeWidth={2.2} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</span>
                    </div>
                    <p className={`mt-1 text-xs sm:text-sm font-black tabular-nums tracking-tight ${
                      label === 'Selisih'
                        ? positive
                          ? 'text-[var(--status-income)]'
                          : 'text-[var(--status-expense)]'
                        : 'text-[var(--fg)]'
                    }`}>
                      {label === 'Selisih' && value > 0 ? '+' : ''}{formatCurrency(value, defaultCurrency, locale)}
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
                  <span>Statistik & Komposisi Aset</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-[var(--muted-2)]">
                    {showDetailedAnalytics ? 'Sembunyikan' : 'Tampilkan'}
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
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 text-left">
                      <div className="flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase text-[var(--muted)]">
                        <ArrowUpRight className="h-3.5 w-3.5 text-[var(--status-income)] shrink-0" strokeWidth={2.5} />
                        <span className="truncate">Tertinggi</span>
                      </div>
                      <p className="mt-1 text-xs sm:text-sm font-black tabular-nums tracking-tight text-[var(--fg)] truncate">
                        {formatCurrency(zoomPeakAndFloor?.max ?? 0, defaultCurrency, locale)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 text-left">
                      <div className="flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase text-[var(--muted)]">
                        <ArrowDownRight className="h-3.5 w-3.5 text-[var(--status-expense)] shrink-0" strokeWidth={2.5} />
                        <span className="truncate">Terendah</span>
                      </div>
                      <p className="mt-1 text-xs sm:text-sm font-black tabular-nums tracking-tight text-[var(--fg)] truncate">
                        {formatCurrency(zoomPeakAndFloor?.min ?? 0, defaultCurrency, locale)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 text-left">
                      <div className="flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase text-[var(--muted)]">
                        <Activity className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" strokeWidth={2.5} />
                        <span className="truncate">Laju Rata-rata</span>
                      </div>
                      <p className={`mt-1 text-xs sm:text-sm font-black tabular-nums tracking-tight truncate ${
                        (zoomPeakAndFloor?.netRate ?? 0) > 0
                          ? 'text-[var(--status-income)]'
                          : (zoomPeakAndFloor?.netRate ?? 0) < 0
                          ? 'text-[var(--status-expense)]'
                          : 'text-[var(--fg)]'
                      }`}>
                        {(zoomPeakAndFloor?.netRate ?? 0) > 0 ? '+' : ''}
                        {formatCurrency(zoomPeakAndFloor?.netRate ?? 0, defaultCurrency, locale)} / {zoomPeakAndFloor?.unitLabel || 'hari'}
                      </p>
                    </div>
                  </div>

                  {/* Asset Breakdown Section */}
                  {assetBreakdownData?.items?.length > 0 && (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <PieChart className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" strokeWidth={2.2} />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--fg)]">Komposisi Sumber Aset</h4>
                        </div>
                        <span className="text-[10px] font-semibold text-[var(--muted)]">
                          {assetBreakdownData.items.length} Dompet Aktif
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
