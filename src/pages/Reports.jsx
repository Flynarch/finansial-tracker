import { format, parseISO, startOfMonth, subMonths } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db } from '../lib/db'
import EmptyState from '../components/ui/EmptyState'
import useTranslation from '../hooks/useTranslation'
import { formatExpenseCategory, parseExpenseCategoryPath } from '../lib/expenseCategories'
import { formatIncomeCategory } from '../lib/incomeCategories'
import { convertCurrency, FALLBACK_EXCHANGE_RATES, formatCurrency, toSafeNumber } from '../lib/utils'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import useSettingsStore from '../store/useSettingsStore'

const ELEGANT_PIE_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#fb7185', '#38bdf8', '#a78bfa']
const RANGE_OPTIONS = [
  { id: 3, label: '3M' },
  { id: 6, label: '6M' },
  { id: 12, label: '12M' },
]

function safeMonthKey(input) {
  if (!input) return ''
  try {
    return format(parseISO(String(input)), 'yyyy-MM')
  } catch {
    return ''
  }
}

function formatDelta(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return '—'
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

/* ─── Premium KPI Card ─── */
function KpiCard({ title, value, tone = 'neutral', meta, icon }) {
  const toneConfig = {
    income: { color: 'var(--status-income)', bg: 'color-mix(in srgb, var(--status-income) 12%, var(--field-bg))' },
    expense: { color: 'var(--status-expense)', bg: 'color-mix(in srgb, var(--status-expense) 12%, var(--field-bg))' },
    net: { color: 'var(--accent)', bg: 'color-mix(in srgb, var(--accent) 12%, var(--field-bg))' },
    neutral: { color: 'var(--fg)', bg: 'var(--field-bg)' },
  }[tone] || { color: 'var(--fg)', bg: 'var(--field-bg)' }

  return (
    <div className="group relative overflow-hidden rounded-[1.25rem] border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-[var(--panel-strong)] p-4 shadow-[var(--shadow-card)] transition hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)]">
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-[1.5rem] transition-opacity group-hover:opacity-30"
        style={{ background: toneConfig.color }}
        aria-hidden="true"
      />
      <div className="flex items-center justify-between gap-2">
        <div
          className="grid h-8 w-8 place-items-center rounded-[0.6rem] border border-[color-mix(in_srgb,var(--border)_50%,transparent)] shadow-sm transition group-hover:scale-105"
          style={{ background: toneConfig.bg, color: toneConfig.color }}
        >
          {icon}
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted-2)]">{title}</p>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight sm:text-[1.75rem]" style={{ color: toneConfig.color }}>
        {value}
      </p>
      <p className="mt-1.5 text-[11.5px] font-medium text-[var(--muted)]">{meta}</p>
    </div>
  )
}

function ChartTooltip({ active, payload, label, valuePrefix = '' }) {
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

function donutCalloutLabel({ cx, cy, midAngle, outerRadius, percent, payload }) {
  const p = Number(percent || 0)
  if (!(p >= 0.03) || Math.round(p * 100) <= 0) return null

  const RADIAN = Math.PI / 180
  const sin = Math.sin(-RADIAN * midAngle)
  const cos = Math.cos(-RADIAN * midAngle)

  const r0 = Number(outerRadius) + 5
  const r1 = Number(outerRadius) + 14

  const x0 = Number(cx) + r0 * cos
  const y0 = Number(cy) + r0 * sin
  const x1 = Number(cx) + r1 * cos
  const y1 = Number(cy) + r1 * sin

  const isRight = cos >= 0
  const x2 = x1 + (isRight ? 10 : -10)
  const y2 = y1

  const label = String(payload?.label || payload?.name || '')
  const pctText = `${Math.round(p * 100)}%`
  const stroke = 'var(--border-strong)'
  const textAnchor = isRight ? 'start' : 'end'

  return (
    <g>
      <path d={`M${x0},${y0} L${x1},${y1} L${x2},${y2}`} stroke={stroke} strokeWidth={1} fill="none" />
      <circle cx={x2} cy={y2} r={2} fill={stroke} />
      <text x={x2 + (isRight ? 6 : -6)} y={y2 - 2} textAnchor={textAnchor} dominantBaseline="central" fill="var(--fg)" fontSize={10} fontWeight={650}>
        {pctText}
      </text>
      <text x={x2 + (isRight ? 6 : -6)} y={y2 + 12} textAnchor={textAnchor} dominantBaseline="central" fill="var(--muted)" fontSize={9}>
        {label.length > 18 ? `${label.slice(0, 18)}…` : label}
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
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="var(--fg)" fontSize={11} fontWeight={750}>
      {Math.round(p * 100)}%
    </text>
  )
}

function formatIdrCompact(amount, { locale = 'id', withPrefix = true } = {}) {
  const n = Number(amount || 0)
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const prefix = withPrefix ? (locale === 'en' ? 'Rp ' : 'Rp ') : ''
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

/* ─── Premium Section Card Wrapper ─── */
function PremiumSection({ title, children, className = '' }) {
  return (
    <section className={`overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel-strong)] shadow-[var(--shadow-card)] ${className}`}>
      {title && (
        <h3 className="border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_40%,transparent)] px-5 py-3.5 text-[15px] font-bold tracking-tight text-[var(--fg)]">
          {title}
        </h3>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

function Reports() {
  const { t, locale } = useTranslation()
  const [isEntering, setIsEntering] = useState(false)
  const [rangeMonths, setRangeMonths] = useState(6)
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(null)
  const [activePieIdx, setActivePieIdx] = useState(0)
  const [donutKind, setDonutKind] = useState('expense')
  const [selectedDrilldownParent, setSelectedDrilldownParent] = useState(null)
  const [compactDonut, setCompactDonut] = useState(false)
  const [rates, setRates] = useState(() => getCachedCurrencyRates('USD'))
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency)
  const initialBalance = useSettingsStore((s) => s.initialBalance)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const loadRates = async () => {
      try {
        const fetchedRates = await fetchCurrencyRates('USD')
        setRates(fetchedRates)
      } catch {
        setRates({ ...FALLBACK_EXCHANGE_RATES })
      }
    }
    loadRates()
  }, [])

  useEffect(() => {
    const sync = () => setCompactDonut(typeof window !== 'undefined' && window.innerWidth < 420)
    sync()
    window.addEventListener('resize', sync, { passive: true })
    return () => window.removeEventListener('resize', sync)
  }, [])

  const yAxisTickFormatter = (value) => formatIdrCompact(value, { locale, withPrefix: false })

  const transactions = useLiveQuery(() => db.transactions.toArray(), [], [])
  const investments = useLiveQuery(() => db.investments.toArray(), [], [])

  const monthlyIncomeExpense = useMemo(() => {
    const monthMap = new Map()
    for (let i = rangeMonths - 1; i >= 0; i -= 1) {
      const month = subMonths(startOfMonth(new Date()), i)
      const key = format(month, 'yyyy-MM')
      monthMap.set(key, { month: format(month, 'MMM yy'), income: 0, expense: 0 })
    }

    transactions.forEach((tx) => {
      const key = safeMonthKey(tx?.date)
      if (!monthMap.has(key)) return
      const row = monthMap.get(key)
      let val = toSafeNumber(tx.amount)
      if (tx.currency && tx.currency !== defaultCurrency && rates) {
        val = convertCurrency(val, tx.currency, defaultCurrency, rates)
      }
      if (tx.type === 'income') row.income += val
      if (tx.type === 'expense') row.expense += val
    })
    return [...monthMap.values()]
  }, [rangeMonths, transactions])

  const expenseByCategory = useMemo(() => {
    const categoryMap = new Map()
    transactions.forEach((tx) => {
      if (tx.type !== 'expense') return
      const parsed = parseExpenseCategoryPath(tx.category)
      let key = ''
      let label = ''
      let isParent = false
      let parentId = null

      if (!selectedDrilldownParent) {
        parentId = parsed?.parentId || tx.category || 'lainnya'
        key = parentId
        label = parsed?.parent?.names?.[locale === 'en' ? 'en' : 'id'] || formatExpenseCategory(key, locale)
        isParent = true
      } else {
        const itemParent = parsed?.parentId || tx.category || 'lainnya'
        if (itemParent !== selectedDrilldownParent) return
        key = parsed?.childId || 'utama'
        label = parsed?.child?.names?.[locale === 'en' ? 'en' : 'id'] || (locale === 'en' ? 'Utama / Umum' : 'Utama / Umum')
        isParent = false
        parentId = selectedDrilldownParent
      }

      const current = categoryMap.get(key) || { key, label, value: 0, isParent, parentId }
      let val = toSafeNumber(tx.amount)
      if (tx.currency && tx.currency !== defaultCurrency && rates) {
        val = convertCurrency(val, tx.currency, defaultCurrency, rates)
      }
      current.value += val
      categoryMap.set(key, current)
    })
    return [...categoryMap.values()].sort((a, b) => b.value - a.value)
  }, [locale, transactions, selectedDrilldownParent, defaultCurrency, rates])

  const incomeByCategory = useMemo(() => {
    const categoryMap = new Map()
    transactions.forEach((tx) => {
      if (tx.type !== 'income') return
      const key = tx.category || ''
      const current = categoryMap.get(key) ?? 0
      let val = toSafeNumber(tx.amount)
      if (tx.currency && tx.currency !== defaultCurrency && rates) {
        val = convertCurrency(val, tx.currency, defaultCurrency, rates)
      }
      categoryMap.set(key, current + val)
    })
    return [...categoryMap.entries()].map(([key, value]) => ({
      key,
      label: formatIncomeCategory(key, locale),
      value,
    })).sort((a, b) => b.value - a.value)
  }, [locale, transactions, defaultCurrency, rates])

  const netWorthTrend = useMemo(() => {
    let cumulativeNet = initialBalance || 0
    const investmentValue = investments.reduce(
      (acc, row) => acc + toSafeNumber(row.quantity) * toSafeNumber(row.purchasePrice),
      0,
    )
    return monthlyIncomeExpense.map((monthData) => {
      cumulativeNet += monthData.income - monthData.expense
      return {
        month: monthData.month,
        netWorth: cumulativeNet + investmentValue,
      }
    })
  }, [investments, monthlyIncomeExpense, initialBalance])

  const thisMonth = monthlyIncomeExpense.at(-1) ?? { income: 0, expense: 0 }
  const previousMonth = monthlyIncomeExpense.at(-2) ?? { income: 0, expense: 0 }
  const thisMonthNet = thisMonth.income - thisMonth.expense
  const previousMonthNet = previousMonth.income - previousMonth.expense
  const txCount = transactions.length
  const totalExpense = expenseByCategory.reduce((acc, row) => acc + toSafeNumber(row.value), 0)
  const totalIncome = incomeByCategory.reduce((acc, row) => acc + toSafeNumber(row.value), 0)
  const averageExpense = monthlyIncomeExpense.length
    ? monthlyIncomeExpense.reduce((acc, row) => acc + toSafeNumber(row.expense), 0) / monthlyIncomeExpense.length
    : 0

  const donutBase = donutKind === 'income' ? incomeByCategory : expenseByCategory
  const donutTotal = donutKind === 'income' ? totalIncome : totalExpense
  const donutTotalText = compactDonut ? formatIdrCompact(donutTotal, { locale }) : formatCurrency(donutTotal, 'IDR')
  
  const donutCenterTitle = useMemo(() => {
    if (donutKind === 'income') return t('reports.totalIncome')
    if (selectedDrilldownParent) {
      const p = parseExpenseCategoryPath(selectedDrilldownParent)?.parent
      return p?.names?.[locale === 'en' ? 'en' : 'id'] || selectedDrilldownParent
    }
    return t('reports.totalExpense')
  }, [donutKind, selectedDrilldownParent, locale, t])

  const donutData = useMemo(() => {
    const sorted = [...donutBase].sort((a, b) => b.value - a.value)
    if (selectedDrilldownParent) return sorted
    const top = sorted.slice(0, 5)
    const others = sorted.slice(5).reduce((acc, row) => acc + toSafeNumber(row.value), 0)
    if (others > 0) {
      top.push({ key: '__others__', label: t('reports.otherCategory'), value: others })
    }
    return top
  }, [donutBase, selectedDrilldownParent, t])

  const safeActivePieIdx = donutData.length ? Math.min(activePieIdx, donutData.length - 1) : 0

  const topExpenseCategories = useMemo(() => {
    const sorted = [...expenseByCategory].sort((a, b) => b.value - a.value)
    return selectedDrilldownParent ? sorted : sorted.slice(0, 6)
  }, [expenseByCategory, selectedDrilldownParent])
  const topIncomeCategories = useMemo(() => [...incomeByCategory].sort((a, b) => b.value - a.value).slice(0, 6), [incomeByCategory])
  const selectedMonth = monthlyIncomeExpense[selectedMonthIdx ?? (monthlyIncomeExpense.length - 1)] || { income: 0, expense: 0, month: '-' }
  const netWorthLatest = netWorthTrend.at(-1)?.netWorth ?? 0
  const netWorthPrev = netWorthTrend.at(-2)?.netWorth ?? 0

  return (
    <div className="min-h-full">
      <div
        className={`ft-motion-page min-h-full space-y-4 transform-gpu ${
          isEntering ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        {/* ── Premium Header ── */}
      <section className="relative overflow-hidden rounded-[1.5rem] border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-[var(--panel-strong)] shadow-[var(--shadow-card)]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 120% 120% at 10% -20%, color-mix(in srgb, var(--accent) 15%, transparent), transparent 60%)',
          }}
          aria-hidden="true"
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--fg)] sm:text-2xl">{t('reports.title')}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{t('reports.subtitle')}</p>
          </div>
          <div className="inline-flex rounded-xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)] p-1 backdrop-blur-md">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setRangeMonths(opt.id)
                  setSelectedMonthIdx(null)
                }}
                className={`rounded-[0.625rem] px-3 py-1.5 text-xs font-bold tracking-wide transition ${
                  rangeMonths === opt.id
                    ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]'
                    : 'text-[var(--muted)] hover:text-[var(--fg)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── KPI Cards ── */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          title={t('reports.thisMonthIncome')}
          value={formatCurrency(thisMonth.income, 'IDR')}
          tone="income"
          meta={`${formatDelta(thisMonth.income, previousMonth.income)} ${t('reports.vsPrev')}`}
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <KpiCard
          title={t('reports.thisMonthExpense')}
          value={formatCurrency(thisMonth.expense, 'IDR')}
          tone="expense"
          meta={`${formatDelta(thisMonth.expense, previousMonth.expense)} ${t('reports.vsPrev')}`}
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <KpiCard
          title={t('reports.thisMonthNet')}
          value={formatCurrency(thisMonthNet, 'IDR')}
          tone="net"
          meta={`${formatDelta(thisMonthNet, previousMonthNet)} ${t('reports.vsPrev')}`}
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 12h18M12 3v18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <KpiCard
          title={t('reports.transactionCount')}
          value={txCount.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID')}
          tone="neutral"
          meta={t('reports.kpiCountHint')}
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 6h16M4 12h16m-7 6h7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
      </section>

      {/* ── Income vs Expense Bar Chart ── */}
      <PremiumSection title={t('reports.monthlyIncomeExpense')}>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-[1rem] border border-[color-mix(in_srgb,var(--status-income)_30%,var(--border))] bg-[color-mix(in_srgb,var(--status-income)_5%,var(--field-bg))] px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wider text-[var(--muted-2)] uppercase">{selectedMonth.month}</p>
            <p className="mt-1 text-sm font-bold tracking-tight text-[var(--status-income)]">{formatCurrency(selectedMonth.income, 'IDR')}</p>
          </div>
          <div className="rounded-[1rem] border border-[color-mix(in_srgb,var(--status-expense)_30%,var(--border))] bg-[color-mix(in_srgb,var(--status-expense)_5%,var(--field-bg))] px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wider text-[var(--muted-2)] uppercase">{t('reports.thisMonthExpense')}</p>
            <p className="mt-1 text-sm font-bold tracking-tight text-[var(--status-expense)]">{formatCurrency(selectedMonth.expense, 'IDR')}</p>
          </div>
        </div>
        <div className="h-72 rounded-2xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_40%,transparent)] p-3 shadow-inner">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyIncomeExpense} barGap={6}>
              <defs>
                <linearGradient id="incomeBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--status-income)" stopOpacity={1} />
                  <stop offset="100%" stopColor="var(--status-income)" stopOpacity={0.5} />
                </linearGradient>
                <linearGradient id="expenseBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--status-expense)" stopOpacity={1} />
                  <stop offset="100%" stopColor="var(--status-expense)" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
              <XAxis dataKey="month" stroke="var(--muted-2)" tickLine={false} axisLine={false} fontSize={11} fontWeight={500} dy={8} />
              <YAxis stroke="var(--muted-2)" tickLine={false} axisLine={false} width={58} tickFormatter={yAxisTickFormatter} fontSize={11} fontWeight={500} />
              <Tooltip content={<ChartTooltip />} cursor={false} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)' }} />
              <Bar dataKey="income" name={t('reports.thisMonthIncome')} fill="url(#incomeBar)" radius={[6, 6, 0, 0]} onClick={(_, idx) => setSelectedMonthIdx(idx)} />
              <Bar dataKey="expense" name={t('reports.thisMonthExpense')} fill="url(#expenseBar)" radius={[6, 6, 0, 0]} onClick={(_, idx) => setSelectedMonthIdx(idx)} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PremiumSection>

      {/* ── Category Breakdown ── */}
      <PremiumSection title={t('reports.expenseBreakdown')}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)] p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                setDonutKind('expense')
                setActivePieIdx(0)
                setSelectedDrilldownParent(null)
              }}
              className={`rounded-[0.625rem] px-4 py-2 text-xs font-bold tracking-wide transition ${
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
              className={`rounded-[0.625rem] px-4 py-2 text-xs font-bold tracking-wide transition ${
                donutKind === 'income'
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {t('reports.donutIncome')}
            </button>
          </div>

          {selectedDrilldownParent && donutKind === 'expense' ? (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setSelectedDrilldownParent(null)}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--panel-strong)] border border-[var(--border)] px-2.5 py-1 text-xs font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] transition"
              >
                ← {locale === 'en' ? 'Kembali ke Utama' : 'Kembali ke Utama'}
              </button>
              <span className="text-xs font-extrabold text-[var(--fg)]">
                {locale === 'en' ? 'Subkategori: ' : 'Subkategori: '}
                <span className="text-[var(--accent)] underline underline-offset-2">{donutCenterTitle}</span>
              </span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-5 md:grid-cols-1">
          {/* Pie Chart */}
          <div className="h-80 rounded-2xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_40%,transparent)] p-4 shadow-inner">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 12, right: 22, bottom: 12, left: 22 }}>
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
                  outerRadius={96}
                  innerRadius={68}
                  activeIndex={safeActivePieIdx}
                  activeOuterRadius={106}
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
                  labelLine={compactDonut ? false : false}
                  label={compactDonut ? donutInsidePercentLabel : donutCalloutLabel}
                >
                  {donutData.map((entry, index) => (
                    <Cell
                      key={`${entry.key}-${index}`}
                      fill={`url(#pieGrad-${index % ELEGANT_PIE_COLORS.length})`}
                      stroke="var(--panel-strong)"
                      strokeWidth={3}
                      style={{ filter: activePieIdx === index ? 'drop-shadow(0px 8px 16px rgba(0,0,0,0.2))' : 'none', outline: 'none', cursor: entry?.isParent ? 'pointer' : 'default' }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <text x="50%" y={compactDonut ? '43%' : '46%'} textAnchor="middle" dominantBaseline="central" fill="var(--muted-2)" fontSize={compactDonut ? 9 : 11} fontWeight={700} style={{ letterSpacing: compactDonut ? '0.08em' : '0.12em', textTransform: 'uppercase' }}>
                  {compactDonut ? (
                    <>
                      <tspan x="50%" dy="0">{t('reports.total')}</tspan>
                      <tspan x="50%" dy="12">{donutKind === 'income' ? t('reports.income') : t('reports.expense')}</tspan>
                    </>
                  ) : donutCenterTitle}
                </text>
                <text x="50%" y={compactDonut ? '57%' : '56%'} textAnchor="middle" dominantBaseline="central" fill="var(--fg)" fontSize={compactDonut ? 15 : 18} fontWeight={800}>
                  {donutTotalText}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* List Breakdown */}
          <div className="rounded-2xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_20%,transparent)] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted-2)]">
                {donutKind === 'income' ? t('reports.topIncome') : (selectedDrilldownParent ? `${t('reports.topExpense')} (${donutCenterTitle})` : t('reports.topExpense'))}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted-2)]">
                {t('reports.share')}
              </p>
            </div>

            {(donutKind === 'income' ? topIncomeCategories : topExpenseCategories).length === 0 ? (
              <EmptyState
                title={donutKind === 'income' ? t('reports.noIncomeYet') : t('reports.noExpenseYet')}
              />
            ) : (
              <ul className="space-y-2.5">
                {(donutKind === 'income' ? topIncomeCategories : topExpenseCategories).map((row, index) => {
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
                      className={`group relative overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--border)_40%,transparent)] bg-[color-mix(in_srgb,var(--panel-strong)_60%,transparent)] px-4 py-3 transition ${
                        row.isParent ? 'cursor-pointer hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_6%,var(--field-bg))]' : 'hover:bg-[var(--field-bg)]'
                      }`}
                    >
                      <div className="relative z-10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full shadow-inner shrink-0" style={{ background: ELEGANT_PIE_COLORS[index % ELEGANT_PIE_COLORS.length] }} />
                          <p className="truncate text-sm font-semibold text-[var(--fg)]">{row.label || '-'}</p>
                          {row.isParent ? (
                            <span className="rounded bg-[var(--field-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--muted)] group-hover:bg-[var(--accent)] group-hover:text-white transition">
                              {locale === 'en' ? 'Subcategories ›' : 'Lihat Sub ›'}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm font-bold tabular-nums tracking-tight text-[var(--fg)] shrink-0">{formatCurrency(row.value, 'IDR')}</p>
                      </div>
                      <div className="relative z-10 mt-2.5 flex items-center justify-between gap-3">
                        <p className="text-[11px] font-bold tabular-nums text-[var(--muted)]">{share.toFixed(1)}%</p>
                        <div className="h-1.5 flex-1 rounded-full bg-[color-mix(in_srgb,var(--border)_40%,transparent)] overflow-hidden">
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

            <div className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)] p-3 text-center">
              <p className="text-xs font-medium text-[var(--muted)]">
                {t('reports.avgExpense')}:{' '}
                <span className="font-bold text-[var(--fg)] tracking-tight">{formatCurrency(averageExpense, 'IDR')}</span>
              </p>
            </div>
          </div>
        </div>
      </PremiumSection>

      {/* ── Net Worth Trend ── */}
      <PremiumSection title={t('reports.netWorthTrend')}>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-[1rem] border border-[color-mix(in_srgb,var(--accent)_30%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_5%,var(--field-bg))] px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wider text-[var(--muted-2)] uppercase">{t('reports.netWorthTrend')}</p>
            <p className="mt-1 text-sm font-bold tracking-tight text-[var(--accent)]">{formatCurrency(netWorthLatest, 'IDR')}</p>
          </div>
          <div className="rounded-[1rem] border border-[color-mix(in_srgb,var(--accent-strong)_30%,var(--border))] bg-[color-mix(in_srgb,var(--accent-strong)_5%,var(--field-bg))] px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wider text-[var(--muted-2)] uppercase">{t('reports.vsPrev')}</p>
            <p className="mt-1 text-sm font-bold tracking-tight text-[var(--accent-strong)]">{formatDelta(netWorthLatest, netWorthPrev)}</p>
          </div>
        </div>
        <div className="h-72 rounded-2xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_40%,transparent)] p-3 shadow-inner">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={netWorthTrend}>
              <defs>
                <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
              <XAxis dataKey="month" stroke="var(--muted-2)" tickLine={false} axisLine={false} fontSize={11} fontWeight={500} dy={8} />
              <YAxis stroke="var(--muted-2)" tickLine={false} axisLine={false} width={58} tickFormatter={yAxisTickFormatter} fontSize={11} fontWeight={500} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area type="monotone" dataKey="netWorth" stroke="var(--accent)" fill="url(#netWorthFill)" strokeWidth={3} activeDot={{ r: 6, fill: 'var(--accent)', stroke: 'var(--panel-strong)', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </PremiumSection>
    </div>
  </div>
  )
}

export default Reports
