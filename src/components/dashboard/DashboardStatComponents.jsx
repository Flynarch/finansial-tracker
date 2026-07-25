import { memo, useMemo } from 'react'
import { format } from 'date-fns'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
  title, value, data, stroke, fill, onOpen, formatValue, rangeLabel,
  xKey = 'day', yDomain, lowHigh, t: tMini,
  showRightAxis = false, rightAxisTickFormatter, rightAxisWidth = 56,
  rightAxisTicks, animate = false, premium = false,
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
      className="ft-interactive-card w-full rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 text-left shadow-sm"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)]">{title}</p>
          <p className="mt-0.5 text-[clamp(13px,3.4vw,16px)] font-semibold leading-tight tracking-tight tabular-nums text-[var(--fg)]"></p>
        </div>
        {rangeLabel ? (
          <span className="rounded-md border border-[var(--border)] bg-[var(--field-bg)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--muted)]">
            {rangeLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-3 h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 4, left: 4 }}>
            <XAxis dataKey={xKey} hide />
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
            <Tooltip
              formatter={(v) => (formatValue ? formatValue(v) : v)}
              labelFormatter={(label, payload) => {
                if (xKey !== 'time') return label
                const ts = Number(payload?.[0]?.payload?.time ?? label)
                if (!Number.isFinite(ts) || ts <= 0) return '-'
                return format(new Date(ts), 'dd MMM yyyy, HH:mm')
              }}
              contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--panel-strong)', color: 'var(--fg)', fontSize: 12, boxShadow: 'var(--shadow-soft)' }}
              labelStyle={{ color: 'var(--muted)' }}
            />
            <Area
              key={data?.map((d) => d?.value).join('-')}
              type="monotone" dataKey="value" stroke={stroke} fill={fill}
              fillOpacity={0.1} strokeWidth={1.8} dot={false} activeDot={{ r: 3 }}
              isAnimationActive={animate} animationBegin={24}
              animationDuration={animationDuration} animationEasing={animationEasing}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {lowHighText ? (
        <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums">
          <span className="text-[var(--muted)]">{tMini('dashboard.chart.low')} {lowHighText.min}</span>
          <span className="text-[var(--muted)]">{tMini('dashboard.chart.high')} {lowHighText.max}</span>
        </div>
      ) : null}
    </button>
  )
})

/** Chart range tab button */
export const ChartToggle = memo(function ChartToggle({ value, onChange, items }) {
  return (
    <div
      className="grid gap-1 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-1"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange?.(item.id)}
          className={`flex-1 rounded-lg px-3 py-2 text-center text-[12px] font-semibold transition ${
            value === item.id ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
        >
          {item.label}
        </button>
      ))}
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
