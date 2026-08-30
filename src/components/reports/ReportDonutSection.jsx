import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ArrowLeft, Layers, ChevronRight, PieChart as PieIcon } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { formatCurrency, formatCompactCurrency, toSafeNumber } from '../../lib/utils'
import { CHART_PALETTE } from '../../lib/chartTheme'
import ChartTooltip from './ChartTooltip'
import EmptyState from '../ui/EmptyState'
import { triggerHaptic } from '../../lib/haptics'

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
  compactDonut,
}) {
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)

  const hasData = toSafeNumber(donutTotal) > 0
  const safeActivePieIdx = donutData.length ? Math.min(activePieIdx, donutData.length - 1) : 0
  const donutTotalText = compactDonut
    ? formatCompactCurrency(donutTotal, defaultCurrency, locale)
    : formatCurrency(donutTotal, defaultCurrency)
  const categoriesList = donutKind === 'income' ? topIncomeCategories : topExpenseCategories

  const handleKindSwitch = (kind) => {
    triggerHaptic('light')
    setDonutKind(kind)
    setActivePieIdx(0)
    setSelectedDrilldownParent(null)
  }

  const handleDrilldownBack = () => {
    triggerHaptic('light')
    setSelectedDrilldownParent(null)
    setActivePieIdx(0)
  }

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-[var(--shadow-card)]">
      {/* Top Header Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-black tracking-tight text-[var(--fg)]">
            {t('reports.expenseBreakdown', 'Komposisi & Distribusi Kategori')}
          </h3>
          <p className="text-[11px] font-medium text-[var(--muted)]">
            {t('reports.breakdownSubtitle', 'Alokasi dana berdasarkan pos pengeluaran & pemasukan')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Type Switcher */}
          <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => handleKindSwitch('expense')}
              className={`rounded-lg px-3 py-1.5 text-xs font-black transition cursor-pointer ${
                donutKind === 'expense'
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs ring-1 ring-[var(--border)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {t('reports.donutExpense', 'Pengeluaran')}
            </button>
            <button
              type="button"
              onClick={() => handleKindSwitch('income')}
              className={`rounded-lg px-3 py-1.5 text-xs font-black transition cursor-pointer ${
                donutKind === 'income'
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs ring-1 ring-[var(--border)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {t('reports.donutIncome', 'Pemasukan')}
            </button>
          </div>

          {/* Wallet Filter Selector */}
          <div className="relative">
            <select
              value={selectedWalletFilter}
              onChange={(e) => {
                triggerHaptic('light')
                setSelectedWalletFilter(e.target.value)
              }}
              className="h-8.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 text-xs font-bold text-[var(--fg)] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[var(--ring)] cursor-pointer"
            >
              <option value="all">{t('reports.allWallets', 'Semua Dompet')}</option>
              {(wallets || []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Drilldown Back Banner */}
      {selectedDrilldownParent && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-black text-[var(--fg)]">
            <Layers className="h-4 w-4 text-[var(--accent)]" />
            <span>
              Subkategori: <strong className="text-[var(--accent)]">{donutCenterTitle}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={handleDrilldownBack}
            className="inline-flex items-center gap-1 rounded-xl bg-[var(--panel-strong)] px-2.5 py-1 text-xs font-extrabold text-[var(--fg)] border border-[var(--border)] shadow-2xs hover:bg-[var(--field-bg)] active:scale-95 transition cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{t('reports.drilldownBack', 'Kembali')}</span>
          </button>
        </div>
      )}

      {/* Unified Empty State vs Data Grid */}
      {!hasData ? (
        <EmptyState
          icon={<PieIcon className="h-7 w-7 text-[var(--muted)]" />}
          title={
            donutKind === 'income'
              ? t('reports.noIncomeYet', 'Belum ada pemasukan untuk dianalisis.')
              : t('reports.noExpenseYet', 'Belum ada pengeluaran untuk dianalisis.')
          }
          description={t(
            'reports.noCategoryBreakdownDesc',
            'Komposisi diagram donat dan daftar kategori akan otomatis terbentuk saat transaksi tercatat.'
          )}
          className="py-10 border border-dashed border-[var(--border)] rounded-2xl bg-[var(--field-bg)]/30"
        />
      ) : (
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
          {/* Donut Chart Container */}
          <div className="relative flex h-64 sm:h-72 w-full items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<ChartTooltip currency={defaultCurrency} />} />
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={compactDonut ? 52 : 68}
                  outerRadius={compactDonut ? 78 : 96}
                  paddingAngle={3}
                  stroke="var(--panel-strong)"
                  strokeWidth={2}
                  onClick={(_, idx) => {
                    triggerHaptic('light')
                    setActivePieIdx(idx)
                  }}
                >
                  {donutData.map((_, idx) => (
                    <Cell
                      key={`donut-cell-${idx}`}
                      fill={CHART_PALETTE[idx % CHART_PALETTE.length]}
                      opacity={safeActivePieIdx === idx ? 1 : 0.82}
                    />
                  ))}
                </Pie>
                {/* Center Summary Text */}
                <text
                  x="50%"
                  y="44%"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--muted)"
                  fontSize={10}
                  fontWeight={800}
                  style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
                >
                  {selectedDrilldownParent
                    ? donutCenterTitle.length > 12
                      ? `${donutCenterTitle.slice(0, 11)}…`
                      : donutCenterTitle
                    : donutKind === 'income'
                      ? t('reports.income', 'Pemasukan')
                      : t('reports.expense', 'Pengeluaran')}
                </text>
                <text
                  x="50%"
                  y="56%"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--fg)"
                  fontSize={String(donutTotalText).length > 14 ? 12 : String(donutTotalText).length > 10 ? 14 : 16}
                  fontWeight={900}
                >
                  {donutTotalText}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Categories Breakdown List */}
          <div>
            <div className="mb-2.5 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">
              <span>
                {donutKind === 'income'
                  ? t('reports.topIncome', 'Pos Pemasukan')
                  : t('reports.topExpense', 'Pos Pengeluaran')}
              </span>
              <span>{t('reports.share', 'Porsi')}</span>
            </div>

            <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {categoriesList.map((row, index) => {
                const share = donutTotal > 0 ? (toSafeNumber(row.value) / donutTotal) * 100 : 0
                const color = CHART_PALETTE[index % CHART_PALETTE.length]

                return (
                  <li
                    key={`${row.key}-${index}`}
                    onClick={() => {
                      if (row.isParent && row.parentId) {
                        triggerHaptic('light')
                        setSelectedDrilldownParent(row.parentId)
                        setActivePieIdx(0)
                      }
                    }}
                    className={`group relative overflow-hidden rounded-2xl border border-[var(--border)]/70 bg-[var(--field-bg)]/80 p-3 shadow-2xs transition ${
                      row.isParent
                        ? 'cursor-pointer hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_6%,var(--field-bg))] active:scale-[0.99]'
                        : 'hover:bg-[var(--field-bg)]'
                    }`}
                  >
                    {/* Background Proportional Progress Track */}
                    <div
                      className="absolute inset-y-0 left-0 opacity-[0.08] transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, share))}%`,
                        backgroundColor: color,
                      }}
                    />

                    <div className="relative z-10 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full shadow-2xs"
                          style={{ backgroundColor: color }}
                        />
                        <p className="text-xs sm:text-sm font-extrabold text-[var(--fg)] truncate">
                          {row.label || '-'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <p className="text-xs sm:text-sm font-black tabular-nums text-[var(--fg)]">
                          {formatCurrency(row.value, defaultCurrency)}
                        </p>
                        <span className="rounded-md bg-[var(--panel)] px-1.5 py-0.5 text-[10px] font-black tabular-nums text-[var(--muted)] border border-[var(--border)]">
                          {share.toFixed(1)}%
                        </span>
                        {row.isParent && (
                          <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)] group-hover:text-[var(--accent)] transition shrink-0" />
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
