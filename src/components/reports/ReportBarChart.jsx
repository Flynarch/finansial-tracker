import { useState, useRef } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import ChartTooltip from './ChartTooltip'
import EmptyState from '../ui/EmptyState'
import { formatCurrency, formatCompactCurrency, toSafeNumber } from '../../lib/utils'
import {
  CHART_X_AXIS_DEFAULTS,
  CHART_Y_AXIS_DEFAULTS,
  CHART_GRID_DEFAULTS,
  CHART_MARGIN_DEFAULTS,
} from '../../lib/chartTheme'
import { triggerHaptic } from '../../lib/haptics'

export default function ReportBarChart({
  monthlyIncomeExpense,
  selectedMonthKey = null,
  onSelectMonthKey,
  onClick,
}) {
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const [chartMode, setChartMode] = useState('inflowOutflow') // 'inflowOutflow' | 'netFlow'
  const lastScrubbedIndexRef = useRef(null)

  const handleBarClick = (entry) => {
    const key = entry?.key || entry?.payload?.key
    const setter = onSelectMonthKey || onClick
    if (!key || !setter) return
    triggerHaptic('light')
    if (selectedMonthKey === key) {
      setter(null)
    } else {
      setter(key)
    }
  }

  const hasData = (monthlyIncomeExpense || []).some(
    (m) => toSafeNumber(m.income) > 0 || toSafeNumber(m.expense) > 0
  )

  const validMonths = monthlyIncomeExpense?.filter((m) => toSafeNumber(m.expense) > 0) || []
  const avgExpense =
    validMonths.length > 0
      ? validMonths.reduce((acc, m) => acc + toSafeNumber(m.expense), 0) / validMonths.length
      : 0

  const chartData = (monthlyIncomeExpense || []).map((m) => {
    const inc = toSafeNumber(m.income)
    const exp = toSafeNumber(m.expense)
    return {
      ...m,
      income: inc,
      expense: exp,
      netFlow: inc - exp,
    }
  })

  const yAxisTickFormatter = (value) => formatCompactCurrency(value, defaultCurrency, locale, false)

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-[var(--shadow-card)]">
      {/* Header & Mode Switcher */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-black tracking-tight text-[var(--fg)]">
            {chartMode === 'inflowOutflow'
              ? t('reports.monthlyIncomeExpense', 'Pemasukan vs Pengeluaran Bulanan')
              : t('reports.viewNetFlow', 'Tren Surplus Bersih')}
          </h3>
          <p className="text-[11px] font-medium text-[var(--muted)]">
            {chartMode === 'inflowOutflow'
              ? t('reports.cashflowSubtitle', 'Komparasi arus kas masuk dan keluar per periode')
              : t('reports.netFlowSubtitle', 'Fluktuasi akumulasi surplus atau defisit bulanan')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light')
                setChartMode('inflowOutflow')
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-black transition cursor-pointer ${
                chartMode === 'inflowOutflow'
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs ring-1 ring-[var(--border)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {t('reports.viewInflowOutflow', 'Inflow vs Outflow')}
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light')
                setChartMode('netFlow')
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-black transition cursor-pointer ${
                chartMode === 'netFlow'
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs ring-1 ring-[var(--border)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {t('reports.viewNetFlow', 'Net Surplus')}
            </button>
          </div>

          {/* Average Spending Benchmark Badge */}
          {hasData && chartMode === 'inflowOutflow' && avgExpense > 0 && (
            <div className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs shadow-2xs">
              <span className="text-[11px] font-bold text-[var(--muted)]">
                {t('reports.averageMonthlyLine', 'Rata-rata')}:
              </span>
              <span className="font-black tabular-nums text-[var(--fg)]">
                {formatCurrency(avgExpense, defaultCurrency)}
              </span>
            </div>
          )}
        </div>
      </div>

      {!hasData ? (
        <EmptyState
          icon={<BarChart3 className="h-7 w-7 text-[var(--muted)]" />}
          title={t('reports.noChartDataTitle', 'Belum Ada Data Transaksi Bulanan')}
          description={t('reports.noChartDataSubtitle', 'Grafik perbandingan akan otomatis ditampilkan setelah Anda mencatat pemasukan atau pengeluaran.')}
          className="py-10 border border-dashed border-[var(--border)] rounded-2xl bg-[var(--field-bg)]/30"
        />
      ) : (
        <div className="h-60 sm:h-68 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              barGap={6}
              margin={CHART_MARGIN_DEFAULTS}
              onMouseMove={(e) => {
                const activeIdx = e?.activeTooltipIndex
                if (activeIdx !== undefined && activeIdx !== lastScrubbedIndexRef.current) {
                  lastScrubbedIndexRef.current = activeIdx
                  triggerHaptic('selection')
                }
              }}
              onMouseLeave={() => {
                lastScrubbedIndexRef.current = null
              }}
              onTouchEnd={() => {
                lastScrubbedIndexRef.current = null
              }}
              onClick={(state) => {
                if (state?.activePayload?.[0]?.payload) {
                  handleBarClick(state.activePayload[0].payload)
                }
              }}
              className="cursor-pointer"
            >
              <defs>
                <linearGradient id="incomeBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--status-income)" stopOpacity={1} />
                  <stop offset="100%" stopColor="var(--status-income)" stopOpacity={0.6} />
                </linearGradient>
                <linearGradient id="expenseBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--status-expense)" stopOpacity={1} />
                  <stop offset="100%" stopColor="var(--status-expense)" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid {...CHART_GRID_DEFAULTS} />
              <XAxis dataKey="month" {...CHART_X_AXIS_DEFAULTS} />
              <YAxis
                {...CHART_Y_AXIS_DEFAULTS}
                tickFormatter={yAxisTickFormatter}
                domain={chartMode === 'inflowOutflow' ? [0, 'auto'] : ['auto', 'auto']}
                allowDecimals={false}
              />
              <Tooltip
                content={<ChartTooltip currency={defaultCurrency} />}
                cursor={{ fill: 'var(--field-bg)', opacity: 0.4 }}
                allowEscapeViewBox={{ x: false, y: false }}
                wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
              />

              {chartMode === 'inflowOutflow' ? (
                <>
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', paddingTop: '10px' }}
                  />
                  {avgExpense > 0 && (
                    <ReferenceLine
                      y={avgExpense}
                      stroke="var(--muted-2)"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                    />
                  )}
                  <Bar
                    dataKey="income"
                    name={t('reports.income', 'Pemasukan')}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={32}
                    onClick={(entry) => handleBarClick(entry)}
                    className="cursor-pointer"
                  >
                    {chartData.map((entry) => {
                      const isSelected = selectedMonthKey === entry.key
                      return (
                        <Cell
                          key={`cell-inc-${entry.key || entry.month}`}
                          fill={isSelected ? 'var(--status-income)' : 'url(#incomeBarGrad)'}
                          opacity={selectedMonthKey ? (isSelected ? 1 : 0.35) : 1}
                          stroke={isSelected ? 'var(--fg)' : 'none'}
                          strokeWidth={isSelected ? 1.5 : 0}
                          onClick={() => handleBarClick(entry)}
                          className="cursor-pointer"
                        />
                      )
                    })}
                  </Bar>
                  <Bar
                    dataKey="expense"
                    name={t('reports.expense', 'Pengeluaran')}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={32}
                    onClick={(entry) => handleBarClick(entry)}
                    className="cursor-pointer"
                  >
                    {chartData.map((entry) => {
                      const isSelected = selectedMonthKey === entry.key
                      return (
                        <Cell
                          key={`cell-exp-${entry.key || entry.month}`}
                          fill={isSelected ? 'var(--status-expense)' : 'url(#expenseBarGrad)'}
                          opacity={selectedMonthKey ? (isSelected ? 1 : 0.35) : 1}
                          stroke={isSelected ? 'var(--fg)' : 'none'}
                          strokeWidth={isSelected ? 1.5 : 0}
                          onClick={() => handleBarClick(entry)}
                          className="cursor-pointer"
                        />
                      )
                    })}
                  </Bar>
                </>
              ) : (
                <>
                  <ReferenceLine y={0} stroke="var(--border-strong)" strokeWidth={1} />
                  <Bar
                    dataKey="netFlow"
                    name={t('reports.netFlow', 'Surplus / Defisit')}
                    radius={[6, 6, 6, 6]}
                    maxBarSize={36}
                    onClick={(entry) => handleBarClick(entry)}
                    className="cursor-pointer"
                  >
                    {chartData.map((entry) => {
                      const isSelected = selectedMonthKey === entry.key
                      return (
                        <Cell
                          key={`cell-${entry.key || entry.month}`}
                          fill={entry.netFlow >= 0 ? 'var(--status-income)' : 'var(--status-expense)'}
                          opacity={selectedMonthKey ? (isSelected ? 1 : 0.35) : 0.9}
                          stroke={isSelected ? 'var(--fg)' : 'none'}
                          strokeWidth={isSelected ? 1.5 : 0}
                          onClick={() => handleBarClick(entry)}
                          className="cursor-pointer"
                        />
                      )
                    })}
                  </Bar>
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Interactive Month Selection Hint & Reset Footer */}
      {hasData && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)]/50 pt-2.5 text-[11px]">
          <div className="flex items-center gap-1.5 text-[var(--muted)]">
            <span className={`h-1.5 w-1.5 rounded-full ${selectedMonthKey ? 'bg-[var(--accent)] animate-pulse' : 'bg-[var(--muted-2)]'}`} />
            {selectedMonthKey ? (
              <span>
                {t('reports.filteredByMonth', 'Menampilkan rincian untuk bulan')}:{' '}
                <strong className="text-[var(--fg)]">
                  {chartData.find((d) => d.key === selectedMonthKey)?.month || selectedMonthKey}
                </strong>
              </span>
            ) : (
              <span>{t('reports.tapBarHint', 'Ketuk batang grafik untuk melihat rincian bulan tertentu')}</span>
            )}
          </div>
          {selectedMonthKey && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light')
                const setter = onSelectMonthKey || onClick
                if (setter) setter(null)
              }}
              className="font-bold text-[var(--accent)] hover:underline cursor-pointer"
            >
              {t('reports.showAllPeriod', 'Tampilkan Semua')}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
