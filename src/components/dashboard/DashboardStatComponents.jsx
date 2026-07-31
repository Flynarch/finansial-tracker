import { memo, useMemo } from 'react'
import { format } from 'date-fns'
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { clampPercent } from './DashboardChartHelpers'

/** Compact progress bar used in MetricCard */
export function ProgressBar({ value, className = '', tone }) {
  const pct = clampPercent(value)
  let fillTone = ''
  if (tone === 'budget') {
    fillTone = value >= 100 ? 'bg-rose-500 dark:bg-rose-400' : value >= 80 ? 'bg-amber-500 dark:bg-amber-400' : ''
  } else if (tone === 'savings') {
    fillTone = 'bg-sky-500 dark:bg-sky-400'
  }
  return (
    <div className={`ft-progress-bar ${className}`}>
      <div className={`ft-progress-fill ${fillTone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Metric card with optional progress bar */
export function MetricCard({ title, value, rightLabel, progress = 0, showProgress = true, showPercentText = true, active = false }) {
  const toneCfg = active
    ? { border: 'border-[var(--border)]', bg: 'bg-[var(--fg)]', fg: 'text-[var(--bg)]' }
    : { border: 'border-[var(--border)]', bg: 'bg-[var(--panel-strong)]', fg: 'text-[var(--fg)]' }

  return (
    <section
      className={`rounded-2xl border p-3 shadow-sm transition sm:p-4 ${toneCfg.border} ${toneCfg.bg} ${toneCfg.fg}`}
      style={{ background: active ? 'var(--fg)' : 'var(--panel-strong)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`ft-display break-all text-[17px] font-semibold leading-tight tracking-tight tabular-nums sm:text-xl ${active ? 'text-[var(--bg)]' : 'text-[var(--fg)]'}`}>
            {value}
          </p>
          <p className={`mt-1 text-[11px] ${active ? 'text-[var(--bg)]/70' : 'text-[var(--muted)]'}`}>{title}</p>
        </div>
        {rightLabel ? (
          <p className={`text-xs font-semibold tabular-nums ${active ? 'text-[var(--bg)]/70' : 'text-[var(--muted)]'}`}>{rightLabel}</p>
        ) : null}
      </div>

      {showPercentText ? (
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className={active ? 'text-[var(--bg)]/60' : 'text-[var(--muted-2)]'}>0%</span>
          <span className={active ? 'text-[var(--bg)]/60' : 'text-[var(--muted-2)]'}>{Math.round(clampPercent(progress))}%</span>
        </div>
      ) : null}

      {showProgress ? <ProgressBar value={progress} className={active ? 'bg-[var(--bg)]/15' : ''} /> : null}
    </section>
  )
}

/** Mini chart card with area chart */
export const MiniChartCard = memo(function MiniChartCard({
  title, value, data, stroke, onOpen, formatValue, rangeLabel, rangeId,
  xKey = 'day', yDomain, lowHigh, t: tMini, trendBadge, showXAxisDate = false,
  showRightAxis = false, rightAxisTickFormatter, rightAxisWidth = 56,
  rightAxisTicks, animate = false,
  animationDuration = 900, animationEasing = 'ease',
}) {
  const lowHighText = useMemo(() => {
    if (!lowHigh || !Array.isArray(data) || data.length < 2) return null
    const values = data.map((r) => Number(r?.value)).filter((v) => Number.isFinite(v))
    if (values.length < 2) return null
    const min = Math.min(...values); const max = Math.max(...values)
    const fmt = (v) => (formatValue ? formatValue(v) : String(v))
    return { min: fmt(min), max: fmt(max) }
  }, [data, formatValue, lowHigh])

  return (
    <button
      type="button"
      onClick={onOpen}
      className="ft-interactive-card w-full rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 text-left shadow-sm sm:p-4"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)]">{title}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="text-[clamp(15px,3.8vw,18px)] font-black leading-tight tracking-tight tabular-nums text-[var(--fg)]">{value}</p>
            {trendBadge ? (
              <div className="shrink-0">{trendBadge}</div>
            ) : null}
          </div>
        </div>
        {rangeLabel ? (
          <span className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--field-bg)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--muted)]">
            {rangeLabel}
          </span>
        ) : null}
      </div>

      <div className={`mt-3 ${showXAxisDate ? 'h-32' : 'h-28'} w-full pointer-events-none`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 6, right: showRightAxis ? 4 : 8, bottom: showXAxisDate ? 4 : 0, left: 8 }}
          >
            <defs>
              <linearGradient id="miniGradFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke || 'var(--accent)'} stopOpacity={0.30} />
                <stop offset="100%" stopColor={stroke || 'var(--accent)'} stopOpacity={0} />
              </linearGradient>
            </defs>
            {showXAxisDate ? (
              <XAxis
                dataKey={xKey}
                type={xKey === 'time' ? 'number' : 'category'}
                scale={xKey === 'time' ? 'time' : 'auto'}
                domain={xKey === 'time' ? ['dataMin', 'dataMax'] : undefined}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted)', fontSize: 10 }}
                dy={0}
                tickFormatter={(val) => {
                  if (xKey === 'day') return val
                  if (!val || !Number.isFinite(val)) return ''
                  if (rangeId === '1d') return format(new Date(val), 'HH:mm')
                  if (rangeId === 'all') return format(new Date(val), 'MMM yy')
                  if (rangeId === '1y' || rangeId === 'ytd') return format(new Date(val), 'MMM')
                  return format(new Date(val), 'dd MMM')
                }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
            ) : (
              <XAxis dataKey={xKey} hide />
            )}
            {showRightAxis ? (
              <YAxis
                domain={yDomain} orientation="right" stroke="var(--muted)"
                tickFormatter={rightAxisTickFormatter} ticks={rightAxisTicks}
                interval="preserveStartEnd" tickCount={rightAxisTicks ? undefined : 3}
                width={rightAxisWidth} axisLine={false} tickLine={false} fontSize={11}
              />
            ) : (
              <YAxis hide domain={yDomain} />
            )}
            <Area
              type="monotone" dataKey="value" stroke={stroke || 'var(--accent)'} fill="url(#miniGradFade)"
              strokeWidth={2} dot={false}
              isAnimationActive={animate} animationBegin={24}
              animationDuration={animationDuration} animationEasing={animationEasing}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {lowHighText ? (
        <div className="mt-1.5 flex items-center justify-between text-[11px] tabular-nums">
          <span className="text-[var(--muted)]">{tMini('dashboard.chart.low')} {lowHighText.min}</span>
          <span className="text-[var(--muted)]">{tMini('dashboard.chart.high')} {lowHighText.max}</span>
        </div>
      ) : null}
    </button>
  )
})

/** Chart range tab button */
export const ChartToggle = memo(function ChartToggle({ value, onChange, items, className = '' }) {
  const colsClass = items?.length === 7 ? 'grid-cols-7' : 'grid-cols-4 sm:grid-cols-7'
  return (
    <div
      className={`grid ${colsClass} gap-1 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] p-1 select-none ${className}`}
    >
      {items.map((item) => {
        const isActive = value === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange?.(item.id)}
            className={`relative flex h-8 items-center justify-center rounded-xl text-[11px] font-bold tracking-tight transition-colors duration-150 active:scale-95 ${
              isActive
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--border)]/40'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
})

/** Zoom tab button for chart range selector */
export const ZoomTab = memo(function ZoomTab({ id, active, label, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(id)}
      className={`flex-1 rounded-lg px-3 py-2 text-center text-[12px] font-semibold transition ${
        active ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
      }`}
    >
      {label}
    </button>
  )
})
