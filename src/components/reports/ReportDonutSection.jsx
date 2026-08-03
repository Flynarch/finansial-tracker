import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import EmptyState from '../ui/EmptyState'
import useTranslation from '../../hooks/useTranslation'
import { formatCurrency, toSafeNumber } from '../../lib/utils'
import ChartTooltip from './ChartTooltip'

const ELEGANT_PIE_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#fb7185', '#38bdf8', '#a78bfa']

function donutCalloutLabel({ cx, cy, midAngle, outerRadius, percent, payload }) {
  const p = Number(percent || 0)
  if (!(p >= 0.03) || Math.round(p * 100) <= 0) return null

  const RADIAN = Math.PI / 180
  const sin = Math.sin(-RADIAN * midAngle)
  const cos = Math.cos(-RADIAN * midAngle)

  const r0 = Number(outerRadius) + 4
  const r1 = Number(outerRadius) + 12

  const x0 = Number(cx) + r0 * cos
  const y0 = Number(cy) + r0 * sin
  const x1 = Number(cx) + r1 * cos
  const y1 = Number(cy) + r1 * sin

  const isRight = cos >= 0
  const x2 = x1 + (isRight ? 8 : -8)
  const y2 = y1

  const label = String(payload?.label || payload?.name || '')
  const pctText = `${Math.round(p * 100)}%`
  const stroke = 'var(--border-strong)'
  const textAnchor = isRight ? 'start' : 'end'

  return (
    <g>
      <path d={`M${x0},${y0} L${x1},${y1} L${x2},${y2}`} stroke={stroke} strokeWidth={1} fill="none" />
      <circle cx={x2} cy={y2} r={2} fill={stroke} />
      <text x={x2 + (isRight ? 5 : -5)} y={y2 - 2} textAnchor={textAnchor} dominantBaseline="central" fill="var(--fg)" fontSize={10} fontWeight={650}>
        {pctText}
      </text>
      <text x={x2 + (isRight ? 5 : -5)} y={y2 + 12} textAnchor={textAnchor} dominantBaseline="central" fill="var(--muted)" fontSize={9}>
        {label.length > 14 ? `${label.slice(0, 14)}…` : label}
      </text>
    </g>
  )
}

function donutInsidePercentLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  const p = Number(percent || 0)
  if (!(p >= 0.03) || Math.round(p * 100) <= 0) return null
  const RADIAN = Math.PI / 180
  const r = (Number(innerRadius) + Number(outerRadius)) / 2
  const x = Number(cx) + r * Math.cos(-midAngle * RADIAN)
  const y = Number(cy) + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="var(--fg)" fontSize={10} fontWeight={750}>
      {Math.round(p * 100)}%
    </text>
  )
}

function formatIdrCompact(amount, { locale = 'id' } = {}) {
  const n = Number(amount || 0)
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const prefix = 'Rp '
  const fmt = (value, digits = 1) =>
    value.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    })

  if (abs >= 1_000_000_000_000) return `${sign}${prefix}${fmt(abs / 1_000_000_000_000)} T`
  if (abs >= 1_000_000_000) return `${sign}${prefix}${fmt(abs / 1_000_000_000)} M`
  if (abs >= 1_000_000) return `${sign}${prefix}${fmt(abs / 1_000_000)} jt`
  if (abs >= 1_000) return `${sign}${prefix}${fmt(Math.round(abs), 0)}`
  return `${sign}${prefix}${fmt(abs, 0)}`
}

export default function ReportDonutSection({
  donutKind,
  setDonutKind,
  selectedWalletFilter,
  setSelectedWalletFilter,
  wallets,
  selectedDrilldownParent,
  setSelectedDrilldownParent,
  donutCenterTitle,
  donutData,
  donutTotal,
  activePieIdx,
  setActivePieIdx,
  topExpenseCategories,
  topIncomeCategories,
  averageExpense,
  compactDonut,
}) {
  const { t, locale } = useTranslation()

  const safeActivePieIdx = donutData.length ? Math.min(activePieIdx, donutData.length - 1) : 0
  const donutTotalText = compactDonut ? formatIdrCompact(donutTotal, { locale }) : formatCurrency(donutTotal, 'IDR')
  const categoriesList = donutKind === 'income' ? topIncomeCategories : topExpenseCategories

  return (
    <section className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel-strong)] shadow-[var(--shadow-card)]">
      <div className="p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-bold tracking-tight text-[var(--fg)]">
          {t('reports.expenseBreakdown')}
        </h3>

        {/* Controls: Segmented Tabs & Wallet Filter */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)] p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                setDonutKind('expense')
                setActivePieIdx(0)
                setSelectedDrilldownParent(null)
              }}
              className={`rounded-[0.625rem] px-3.5 py-1.5 text-xs font-bold tracking-wide transition ${
                donutKind === 'expense'
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {t('reports.donutExpense')}
            </button>
            <button
              type="button"
              onClick={() => {
                setDonutKind('income')
                setActivePieIdx(0)
                setSelectedDrilldownParent(null)
              }}
              className={`rounded-[0.625rem] px-3.5 py-1.5 text-xs font-bold tracking-wide transition ${
                donutKind === 'income'
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {t('reports.donutIncome')}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-bold text-[var(--muted)] sm:inline">Filter Wallet:</span>
            <select
              value={selectedWalletFilter}
              onChange={(e) => setSelectedWalletFilter(e.target.value)}
              className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] shadow-2xs outline-none transition-all focus:border-[var(--accent)]"
            >
              <option value="all">Semua Wallet</option>
              {wallets?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Drilldown Back Chip */}
        {selectedDrilldownParent && donutKind === 'expense' ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-2 shadow-xs">
            <button
              type="button"
              onClick={() => setSelectedDrilldownParent(null)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] px-2.5 py-1 text-xs font-bold text-[var(--fg)] transition hover:bg-[var(--field-bg)]"
            >
              ← Kembali ke Utama
            </button>
            <span className="text-xs font-extrabold text-[var(--fg)]">
              Subkategori:{' '}
              <span className="text-[var(--accent)] underline underline-offset-2">{donutCenterTitle}</span>
            </span>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Donut Chart -- h-64 compact height */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <defs>
                  {ELEGANT_PIE_COLORS.map((color, i) => (
                    <linearGradient key={`grad-${i}`} id={`pieGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.4} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="label"
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={3}
                  outerRadius={80}
                  innerRadius={54}
                  activeIndex={safeActivePieIdx}
                  activeOuterRadius={90}
                  onMouseEnter={(_, index) => setActivePieIdx(index)}
                  onTouchMove={(_, index) => setActivePieIdx(index)}
                  onClick={(_, index) => {
                    setActivePieIdx(index)
                    const entry = donutData[index]
                    if (entry?.isParent && entry?.parentId) {
                      setSelectedDrilldownParent(entry.parentId)
                      setActivePieIdx(0)
                    }
                  }}
                  labelLine={false}
                  label={compactDonut ? donutInsidePercentLabel : donutCalloutLabel}
                >
                  {donutData.map((entry, index) => (
                    <Cell
                      key={`${entry.key}-${index}`}
                      fill={`url(#pieGrad-${index % ELEGANT_PIE_COLORS.length})`}
                      stroke="var(--panel-strong)"
                      strokeWidth={3}
                      style={{
                        filter: activePieIdx === index ? 'drop-shadow(0px 8px 16px rgba(0,0,0,0.2))' : 'none',
                        outline: 'none',
                        cursor: entry?.isParent ? 'pointer' : 'default',
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <text
                  x="50%"
                  y={compactDonut ? '43%' : '45%'}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--muted-2)"
                  fontSize={compactDonut ? 9 : 10}
                  fontWeight={700}
                  style={{ letterSpacing: compactDonut ? '0.08em' : '0.1em', textTransform: 'uppercase' }}
                >
                  {compactDonut ? (
                    <>
                      <tspan x="50%" dy="0">{t('reports.total')}</tspan>
                      <tspan x="50%" dy="12">{donutKind === 'income' ? t('reports.income') : t('reports.expense')}</tspan>
                    </>
                  ) : (
                    donutCenterTitle
                  )}
                </text>
                <text
                  x="50%"
                  y={compactDonut ? '57%' : '56%'}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--fg)"
                  fontSize={compactDonut ? 14 : 16}
                  fontWeight={800}
                >
                  {donutTotalText}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* List Breakdown */}
          <div>
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted-2)]">
                {donutKind === 'income'
                  ? t('reports.topIncome')
                  : selectedDrilldownParent
                  ? `${t('reports.topExpense')} (${donutCenterTitle})`
                  : t('reports.topExpense')}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted-2)]">
                {t('reports.share')}
              </p>
            </div>

            {categoriesList.length === 0 ? (
              <EmptyState title={donutKind === 'income' ? t('reports.noIncomeYet') : t('reports.noExpenseYet')} />
            ) : (
              <ul className="space-y-2">
                {categoriesList.map((row, index) => {
                  const share = donutTotal > 0 ? (toSafeNumber(row.value) / donutTotal) * 100 : 0
                  return (
                    <li
                      key={`${row.key}-${index}`}
                      onClick={() => {
                        if (row.isParent && row.parentId) {
                          setSelectedDrilldownParent(row.parentId)
                          setActivePieIdx(0)
                        }
                      }}
                      className={`group relative overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--border)_40%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] px-3.5 py-2.5 transition ${
                        row.isParent
                          ? 'cursor-pointer hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_6%,var(--field-bg))]'
                          : 'hover:bg-[var(--field-bg)]'
                      }`}
                    >
                      <div className="relative z-10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shadow-inner shrink-0"
                            style={{ background: ELEGANT_PIE_COLORS[index % ELEGANT_PIE_COLORS.length] }}
                          />
                          <p className="truncate text-xs sm:text-sm font-semibold text-[var(--fg)]">{row.label || '-'}</p>
                          {row.isParent ? (
                            <span className="rounded bg-[var(--panel-strong)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--muted)] group-hover:bg-[var(--accent)] group-hover:text-white transition shrink-0">
                              {locale === 'en' ? 'Sub ›' : 'Lihat Sub ›'}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs sm:text-sm font-bold tabular-nums tracking-tight text-[var(--fg)] shrink-0">
                          {formatCurrency(row.value, 'IDR')}
                        </p>
                      </div>
                      <div className="relative z-10 mt-2 flex items-center justify-between gap-3">
                        <p className="text-[10px] font-bold tabular-nums text-[var(--muted)]">{share.toFixed(1)}%</p>
                        <div className="h-1 flex-1 rounded-full bg-[color-mix(in_srgb,var(--border)_40%,transparent)] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: `${Math.min(100, Math.max(0, share))}%`,
                              backgroundColor: ELEGANT_PIE_COLORS[index % ELEGANT_PIE_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="mt-3 rounded-xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)] p-2.5 text-center">
              <p className="text-xs font-medium text-[var(--muted)]">
                {t('reports.avgExpense')}:{' '}
                <span className="font-bold tracking-tight text-[var(--fg)]">{formatCurrency(averageExpense, 'IDR')}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
