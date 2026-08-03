import { formatCurrency } from '../../lib/utils'

export default function ChartTooltip({ active, payload, label, valuePrefix = '' }) {
  if (!active || !payload?.length) return null

  return (
    <div className="min-w-[10rem] rounded-xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[var(--panel-strong)]/90 px-3 py-2 shadow-[var(--shadow-hover)] backdrop-blur-md">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-2)]">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={`${entry?.name}-${entry?.dataKey}`} className="flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry?.color || 'var(--muted)' }} />
              {entry?.name}
            </span>
            <span className="font-semibold text-[var(--fg)]">
              {valuePrefix}
              {formatCurrency(Number(entry?.value || 0), 'IDR')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
