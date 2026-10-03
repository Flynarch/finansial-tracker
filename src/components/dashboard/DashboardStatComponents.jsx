import { memo, useId, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { clampPercent } from './DashboardChartHelpers'

/** Compact progress bar used in MetricCard */
export function ProgressBar({ value, className = '', tone }) {
  const pct = clampPercent(value)
  let fillTone = ''
  if (tone === 'budget') {
    fillTone = value >= 100 ? 'ft-progress-fill--overrun' : value >= 80 ? 'bg-amber-500/80' : ''
  } else if (tone === 'savings') {
    fillTone = ''
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
      style={{ background: active ? 'var(--fg)' : 'var(--panel-strong)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`ft-display break-all text-xl font-bold leading-tight tracking-tight tabular-nums sm:text-[22px] ${active ? 'text-[var(--bg)]' : 'text-[var(--fg)]'}`}>
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

/** Mini chart card with area chart and interactive touch scrubber */
export const MiniChartCard = memo(function MiniChartCard({
  title, value, data, stroke, onOpen, formatValue, rangeLabel, rangeId,
  xKey = 'day', yDomain, lowHigh, t: tMini, trendBadge, showXAxisDate = false,
  showRightAxis = false, rightAxisTickFormatter, rightAxisWidth = 56,
  rightAxisTicks, animate = false,
  animationDuration = 900, animationEasing = 'ease',
  emptyTitle, emptyDesc,
}) {
  const [scrubbedPoint, setScrubbedPoint] = useState(null)
  const reactId = useId()
  const gradientId = useMemo(() => `miniGradFade_${reactId.replace(/:/g, '')}`, [reactId])

  const lowHighText = useMemo(() => {
    if (!lowHigh || !Array.isArray(data) || data.length < 2) return null
    const values = data.map((r) => Number(r?.value)).filter((v) => Number.isFinite(v))
    if (values.length < 2) return null
    const min = Math.min(...values); const max = Math.max(...values)
    const fmt = (v) => (formatValue ? formatValue(v) : String(v))
    return { min: fmt(min), max: fmt(max) }
  }, [data, formatValue, lowHigh])

  const handleChartMove = (e) => {
    if (e?.activePayload?.[0]?.value !== undefined) {
      const payload = e.activePayload[0]
      const rawVal = payload.value
      const rawTime = payload.payload?.[xKey]
      let timeLabel = ''
      if (rawTime && Number.isFinite(rawTime)) {
        timeLabel = format(new Date(rawTime), 'dd MMM yyyy, HH:mm')
      } else if (rawTime) {
        timeLabel = String(rawTime)
      }
      setScrubbedPoint({
        value: formatValue ? formatValue(rawVal) : String(rawVal),
        time: timeLabel,
      })
    }
  }

  const handleChartLeave = () => {
    setScrubbedPoint(null)
  }

  const isEmptyData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return true
    return data.every((d) => !Number(d?.value) || Number(d?.value) === 0)
  }, [data])

  return (
    <div
      onClick={onOpen}
      className="ft-interactive-card ft-spring-press w-full rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 text-left shadow-sm sm:p-4 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)]">{title}</p>
          {!isEmptyData && (
            <div className="mt-0.5 flex items-center gap-2 flex-wrap">
              <p className="text-[clamp(15px,3.8vw,18px)] font-black leading-tight tracking-tight tabular-nums text-[var(--fg)]">
                {scrubbedPoint ? scrubbedPoint.value : value}
              </p>
              {scrubbedPoint?.time ? (
                <span className="inline-flex whitespace-nowrap shrink-0 items-center self-center rounded-full text-[10.5px] font-semibold text-[var(--accent)] bg-[var(--field-bg)] border border-[var(--border)] px-2 py-0.5 truncate leading-none">
                  {scrubbedPoint.time}
                </span>
              ) : trendBadge ? (
                <div className="shrink-0 inline-flex items-center self-center">{trendBadge}</div>
              ) : null}
            </div>
          )}
        </div>
        {rangeLabel ? (
          <span className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--field-bg)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--muted)]">
            {rangeLabel}
          </span>
        ) : null}
      </div>

      {isEmptyData ? (
        <div className="mt-2.5 h-36 sm:h-40 w-full rounded-xl border border-dashed border-[var(--border)] bg-[var(--field-bg)]/40 relative overflow-hidden flex flex-col items-center justify-center p-3 text-center transition-colors hover:border-[var(--border-strong)]">
          {/* Subtle background curved wave SVG */}
          <svg className="absolute inset-0 h-full w-full opacity-10 pointer-events-none stroke-[var(--accent)] fill-none" viewBox="0 0 300 100" preserveAspectRatio="none">
            <path d="M 0,80 Q 75,30 150,70 T 300,40" strokeWidth="2.5" strokeDasharray="6 6" />
          </svg>

          <div className="relative z-10 flex flex-col items-center gap-1.5 max-w-[280px]">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 shadow-2xs">
              <TrendingUp className="h-4 w-4 stroke-[2.5]" />
            </div>
            <p className="text-xs font-bold text-[var(--fg)] leading-tight">
              {emptyTitle || (tMini ? tMini('dashboard.netWorthEmptyTitle', 'Belum Ada Pergerakan Aset') : 'Belum Ada Pergerakan Aset')}
            </p>
            <p className="text-[10.5px] font-medium text-[var(--muted)] leading-normal line-clamp-2">
              {emptyDesc || (tMini ? tMini('dashboard.netWorthEmptyDesc', 'Grafik tren kekayaan otomatis tersusun begitu saldo dompet atau investasi mulai terisi.') : 'Grafik tren kekayaan otomatis tersusun begitu saldo dompet atau investasi mulai terisi.')}
            </p>
          </div>
        </div>
      ) : (
        <div className={`mt-3 ${showXAxisDate ? 'h-32' : 'h-28'} w-full`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 6, right: showRightAxis ? 4 : 8, bottom: showXAxisDate ? 4 : 0, left: 8 }}
              onMouseMove={handleChartMove}
              onTouchMove={handleChartMove}
              onMouseLeave={handleChartLeave}
              onTouchEnd={handleChartLeave}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke || 'var(--accent)'} stopOpacity={0.30} />
                  <stop offset="100%" stopColor={stroke || 'var(--accent)'} stopOpacity={0} />
                </linearGradient>
              </defs>
              {showXAxisDate ? (
                <XAxis
                  dataKey={xKey}
                  type={xKey === 'time' ? 'number' : 'category'}
                  scale={xKey === 'time' ? 'time' : 'auto'}
                  domain={xKey === 'time' ? (data?.length === 1 ? [data[0].time - 86400000, data[0].time + 86400000] : ['dataMin', 'dataMax']) : undefined}
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
                type="monotone" dataKey="value" stroke={stroke || 'var(--accent)'} fill={`url(#${gradientId})`}
                strokeWidth={2}
                dot={data?.length === 1 ? { r: 4, fill: stroke || 'var(--accent)', strokeWidth: 2, stroke: 'var(--panel-strong)' } : false}
                isAnimationActive={animate} animationBegin={24}
                animationDuration={animationDuration} animationEasing={animationEasing}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {lowHighText ? (
        <div className="mt-1.5 flex items-center justify-between text-[11px] tabular-nums">
          <span className="text-[var(--muted)]">{tMini('dashboard.chart.low')} {lowHighText.min}</span>
          <span className="text-[var(--muted)]">{tMini('dashboard.chart.high')} {lowHighText.max}</span>
        </div>
      ) : null}
    </div>
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
                ? 'bg-[var(--fg)] text-[var(--bg)] shadow-xs'
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
