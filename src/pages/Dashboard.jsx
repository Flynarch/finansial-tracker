/* eslint-disable */
import { format, subMonths } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Card from '../components/ui/Card'
import CategoryIcon from '../components/ui/CategoryIcon'
import { db } from '../lib/db'
import { getCategoryColorClass, getTransactionCategoryLabels, resolveTransactionIconKey } from '../lib/categoryIcon'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import { convertCurrency, FALLBACK_EXCHANGE_RATES, formatCurrency, toSafeNumber } from '../lib/utils'
import { formatExpenseCategory, parseExpenseCategoryPath } from '../lib/expenseCategories'
import { formatIncomeCategory } from '../lib/incomeCategories'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import HabitHeatmapWidget from '../components/habits/HabitHeatmapWidget'
import MiniHabitHeatmap from '../components/habits/MiniHabitHeatmap'
import { calculateGlobalWeeklyTrend } from '../lib/habitStats'
import BudgetSheetModal from '../components/budget/BudgetSheetModal'
import SavingsSheetModal from '../components/savings/SavingsSheetModal'
import WalletCarousel from '../components/dashboard/WalletCarousel'

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function ProgressBar({ value, className = '', tone }) {
  const pct = clampPercent(value)
  let fillTone = ''
  if (tone === 'budget') {
    fillTone = value >= 100 ? 'bg-rose-500 dark:bg-rose-400' : value >= 80 ? 'bg-amber-500 dark:bg-amber-400' : ''
  } else if (tone === 'savings') {
    fillTone = 'bg-sky-500 dark:bg-sky-400'
  }
  return (
    <div className={`ft-progress-bar ${className}`}>
      <div
        className={`ft-progress-fill ${fillTone}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function MetricCard({ title, value, rightLabel, progress = 0, showProgress = true, showPercentText = true, active = false }) {
  const toneCfg =
    active
      ? { border: 'border-[var(--border)]', bg: 'bg-[var(--fg)]', fg: 'text-[var(--bg)]' }
      : { border: 'border-[var(--border)]', bg: 'bg-[var(--panel-strong)]', fg: 'text-[var(--fg)]' }

  return (
    <section
      className={`rounded-2xl border p-3 shadow-sm transition sm:p-4 ${toneCfg.border} ${toneCfg.bg} ${toneCfg.fg}`}
      style={{
        background: active ? 'var(--fg)' : 'var(--panel-strong)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`ft-display break-all text-[17px] font-semibold leading-tight tracking-tight tabular-nums sm:text-xl ${
              active ? 'text-[var(--bg)]' : 'text-[var(--fg)]'
            }`}
          >
            {value}
          </p>
          <p className={`mt-1 text-[11px] ${active ? 'text-[var(--bg)]/70' : 'text-[var(--muted)]'}`}>
            {title}
          </p>
        </div>
        {rightLabel ? (
          <p className={`text-xs font-semibold tabular-nums ${active ? 'text-[var(--bg)]/70' : 'text-[var(--muted)]'}`}>
            {rightLabel}
          </p>
        ) : null}
      </div>

      {showPercentText ? (
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className={active ? 'text-[var(--bg)]/60' : 'text-[var(--muted-2)]'}>0%</span>
          <span className={active ? 'text-[var(--bg)]/60' : 'text-[var(--muted-2)]'}>
            {Math.round(clampPercent(progress))}%
          </span>
        </div>
      ) : null}

      {showProgress ? (
        <ProgressBar
          value={progress}
          className={active ? 'bg-[var(--bg)]/15' : ''}
        />
      ) : null}
    </section>
  )
}

function buildCenteredDomain(series, padRatio = 0.22, { includeZero = false } = {}) {
  const values = (series || [])
    .map((row) => Number(row?.value))
    .filter((v) => Number.isFinite(v))
  if (values.length === 0) return ['auto', 'auto']
  const min = Math.min(...values)
  const max = Math.max(...values)
  const last = Number((series || [])[series.length - 1]?.value)
  const center = Number.isFinite(last) ? last : (min + max) / 2
  const halfSpan = Math.max(1, Math.max(Math.abs(max - center), Math.abs(center - min)))
  const pad = halfSpan * padRatio
  const lo = center - halfSpan - pad
  const hi = center + halfSpan + pad
  if (!includeZero) return [lo, hi]
  return [Math.min(lo, 0), Math.max(hi, 0)]
}

function buildPaddedDomain(series, padRatio = 0.18, { includeZero = false, respectDataSign = false } = {}) {
  const values = (series || [])
    .map((row) => Number(row?.value))
    .filter((v) => Number.isFinite(v))
  if (values.length === 0) return ['auto', 'auto']
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(1, max - min)
  const pad = span * padRatio
  let lo = min - pad
  let hi = max + pad
  if (includeZero) {
    if (min >= 0) lo = 0
    if (max <= 0) hi = 0
  }
  if (respectDataSign) {
    // Keep mini-chart scale faithful to actual extrema (avoid inflated top like 150k for 100k data).
    if (min >= 0) hi = max
    if (max <= 0) lo = min
  }
  return [lo, hi]
}

function pickNiceStep(roughStep, minUnit = 1) {
  const safeRough = Math.max(Number(minUnit) || 1, Number(roughStep) || 1)
  const exponent = Math.floor(Math.log10(safeRough))
  const base = 10 ** exponent
  const normalized = safeRough / base
  const ladder = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 10]
  const chosen = ladder.find((n) => n >= normalized) || 10
  const step = chosen * base
  const unit = Math.max(1, Number(minUnit) || 1)
  return Math.max(unit, Math.ceil(step / unit) * unit)
}

function buildNiceTicksForDomain(domain, maxLabels = 5, minUnit = 1, includeZero = true) {
  if (!Array.isArray(domain) || domain.length < 2) return [0]
  let lo = Number(domain[0])
  let hi = Number(domain[1])
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0]
  if (lo > hi) {
    const tmp = lo
    lo = hi
    hi = tmp
  }
  if (includeZero) {
    lo = Math.min(lo, 0)
    hi = Math.max(hi, 0)
  }

  const targetLabels = Math.max(3, maxLabels)
  let step = pickNiceStep((hi - lo) / Math.max(1, targetLabels - 1), minUnit)
  let start = Math.floor(lo / step) * step
  let end = Math.ceil(hi / step) * step
  let ticks = []
  for (let v = start; v <= end + step * 0.5; v += step) ticks.push(Math.round(v))

  while (ticks.length > targetLabels + 1) {
    step = pickNiceStep(step * 1.6, minUnit)
    start = Math.floor(lo / step) * step
    end = Math.ceil(hi / step) * step
    ticks = []
    for (let v = start; v <= end + step * 0.5; v += step) ticks.push(Math.round(v))
  }
  return ticks
}
function buildAdaptiveMoneyTicks(domain, { minUnit = 1 } = {}) {
  if (!Array.isArray(domain) || domain.length < 2) return [0]
  const lo = Number(domain[0])
  const hi = Number(domain[1])
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0]

  const min = Math.min(lo, hi)
  const max = Math.max(lo, hi)

  const ticks = new Set()
  ticks.add(0)

  const addSide = (target, sign) => {
    const absTarget = Math.max(0, Math.abs(target))
    if (absTarget <= 0) return
    let decade = Math.max(1, Number(minUnit) || 1)
    while (decade <= absTarget * 1.001) {
      ;[1, 2.5, 5].forEach((m) => {
        const v = Math.round(m * decade)
        if (v <= 0) return
        if (v <= absTarget * 1.001) ticks.add(sign * v)
      })
      decade *= 10
    }
  }

  addSide(max, 1)
  addSide(min, -1)

  return Array.from(ticks)
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b)
}

function compactTicksAroundZero(allTicks, maxLabels = 6) {
  const sorted = Array.from(new Set((allTicks || []).filter((v) => Number.isFinite(v)))).sort((a, b) => a - b)
  if (sorted.length <= maxLabels) return sorted

  const negatives = sorted.filter((v) => v < 0)
  const positives = sorted.filter((v) => v > 0)
  const result = [0]

  let negIdx = negatives.length - 1
  let posIdx = 0
  while (result.length < maxLabels && (negIdx >= 0 || posIdx < positives.length)) {
    if (negIdx >= 0) {
      result.push(negatives[negIdx])
      negIdx -= 1
      if (result.length >= maxLabels) break
    }
    if (posIdx < positives.length) {
      result.push(positives[posIdx])
      posIdx += 1
    }
  }

  return Array.from(new Set(result)).sort((a, b) => a - b)
}

function ensureZeroTickWithinLimit(ticks, maxLabels) {
  const uniqueSorted = Array.from(new Set((ticks || []).filter((v) => Number.isFinite(v)))).sort((a, b) => a - b)
  if (uniqueSorted.length === 0) return [0]
  const withZero = uniqueSorted.includes(0) ? uniqueSorted : [...uniqueSorted, 0].sort((a, b) => a - b)
  if (withZero.length <= maxLabels) return withZero

  const minTick = withZero[0]
  const maxTick = withZero[withZero.length - 1]
  const selected = new Set([minTick, 0, maxTick])

  // Fill remaining slots with ticks closest to zero for readability.
  const remaining = withZero
    .filter((v) => !selected.has(v))
    .sort((a, b) => Math.abs(a) - Math.abs(b))
  for (const tick of remaining) {
    if (selected.size >= maxLabels) break
    selected.add(tick)
  }

  return Array.from(selected).sort((a, b) => a - b)
}

const ChartToggle = memo(function ChartToggle({ value, onChange, items }) {
  return (
    <div
      className="grid gap-1 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-1"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`flex h-7 items-center justify-center rounded-lg px-2 py-1 text-center text-[10px] font-semibold leading-none transition ${
            value === item.id ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
})

const MiniChartCard = memo(function MiniChartCard({
  title,
  value,
  data,
  stroke,
  fill,
  onOpen,
  formatValue,
  rangeLabel,
  xKey = 'day',
  yDomain,
  lowHigh,
  t: tMini,
  showRightAxis = false,
  rightAxisTickFormatter,
  rightAxisWidth = 56,
  rightAxisTicks,
  animate = false,
  premium = false,
  animationDuration = 900,
  animationEasing = 'ease',
}) {
  const lowHighText = useMemo(() => {
    if (!lowHigh || !Array.isArray(data) || data.length < 2) return null
    const values = data.map((r) => Number(r?.value)).filter((v) => Number.isFinite(v))
    if (values.length < 2) return null
    const min = Math.min(...values)
    const max = Math.max(...values)
    const fmt = (v) => (formatValue ? formatValue(v) : String(v))
    return { min: fmt(min), max: fmt(max) }
  }, [data, formatValue, lowHigh])

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`ft-interactive-card w-full rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 text-left shadow-sm`}
      style={{
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)]">{title}</p>
          <p className="mt-0.5 text-[clamp(13px,3.4vw,16px)] font-semibold leading-tight tracking-tight tabular-nums text-[var(--fg)]">
          </p>
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
                domain={yDomain}
                orientation="right"
                stroke="var(--muted)"
                tickFormatter={rightAxisTickFormatter}
                ticks={rightAxisTicks}
                interval="preserveStartEnd"
                tickCount={rightAxisTicks ? undefined : 3}
                width={rightAxisWidth}
                axisLine={false}
                tickLine={false}
                fontSize={11}
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
              contentStyle={{
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--panel-strong)',
                color: 'var(--fg)',
                fontSize: 12,
                boxShadow: 'var(--shadow-soft)',
              }}
              labelStyle={{ color: 'var(--muted)' }}
            />
            <Area
              key={data?.map((d) => d?.value).join('-')}
              type="monotone"
              dataKey="value"
              stroke={stroke}
              fill={fill}
              fillOpacity={0.1}
              strokeWidth={1.8}
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={animate}
              animationBegin={24}
              animationDuration={animationDuration}
              animationEasing={animationEasing}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {lowHighText ? (
        <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums">
          <span className="text-[var(--muted)]">
            {tMini('dashboard.chart.low')} {lowHighText.min}
          </span>
          <span className="text-[var(--muted)]">
            {tMini('dashboard.chart.high')} {lowHighText.max}
          </span>
        </div>
      ) : null}
    </button>
  )
})

const ZoomTab = memo(function ZoomTab({ id, active, label, onSelect }) {
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

function Dashboard() {
  const navigate = useNavigate()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const { t, locale } = useTranslation()
  const [rates, setRates] = useState(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES })
  const currentMonthKey = format(new Date(), 'yyyy-MM')
  const currentMonthLabel = format(new Date(), 'MMM yyyy', {
    locale: locale === 'en' ? enUS : idLocale,
  })

  const transactions = useLiveQuery(() => db.transactions.toArray(), [])
  const investments = useLiveQuery(() => db.investments.toArray(), [])
  const budgets = useLiveQuery(() => db.budgets.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const wallets = useLiveQuery(() => db.wallets.toArray(), [])
  
  const walletsWithBalance = useMemo(() => {
    if (wallets === undefined) return undefined
    if (!wallets) return []
    const txs = transactions || []
    return wallets.map(w => {
      let bal = Number(w.balance) || 0
      for (const tx of txs) {
        const amount = Number(tx.amount) || 0
        if (tx.walletId === w.id) {
          if (tx.type === 'income') bal += amount
          else if (tx.type === 'expense') bal -= amount
          else if (tx.type === 'transfer') bal -= amount
          else if (tx.type === 'balance_adjustment') bal += amount
        }
        if (tx.targetWalletId === w.id) {
          if (tx.type === 'transfer') bal += amount
        }
      }
      return { ...w, currentBalance: bal }
    })
  }, [wallets, transactions])

  const totalWalletBalance = useMemo(() => (walletsWithBalance || []).reduce((s, w) => s + w.currentBalance, 0), [walletsWithBalance])
  const [isEntering, setIsEntering] = useState(false)
  const [budgetTab, setBudgetTab] = useState('budget')
  const [isOpenQuickBudget, setIsOpenQuickBudget] = useState(false)
  const [isOpenQuickGoal, setIsOpenQuickGoal] = useState(false)

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(frameId)
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
  }, [defaultCurrency])

  const computed = useMemo(() => {
    const safeTx = transactions ?? []
    const safeInv = investments ?? []

    const lastMonthKey = format(subMonths(new Date(), 1), 'yyyy-MM')
    const lastMonthIncomeExpense = safeTx.reduce(
      (acc, tx) => {
        if (!tx?.date?.startsWith(lastMonthKey)) return acc
        const amount = convertCurrency(
          toSafeNumber(tx.amount),
          tx.currency || defaultCurrency,
          defaultCurrency,
          rates,
        )
        if (tx.type === 'income') acc.income += amount
        if (tx.type === 'expense') acc.expense += amount
        return acc
      },
      { income: 0, expense: 0 },
    )

    const monthIncomeExpense = safeTx.reduce(
      (acc, tx) => {
        if (!tx?.date?.startsWith(currentMonthKey)) return acc
        const amount = convertCurrency(
          toSafeNumber(tx.amount),
          tx.currency || defaultCurrency,
          defaultCurrency,
          rates,
        )
        if (tx.type === 'income') acc.income += amount
        if (tx.type === 'expense') acc.expense += amount
        return acc
      },
      { income: 0, expense: 0 },
    )

    const incomeDeltaPct = lastMonthIncomeExpense.income > 0
      ? ((monthIncomeExpense.income - lastMonthIncomeExpense.income) / lastMonthIncomeExpense.income) * 100
      : 0
    const expenseDeltaPct = lastMonthIncomeExpense.expense > 0
      ? ((monthIncomeExpense.expense - lastMonthIncomeExpense.expense) / lastMonthIncomeExpense.expense) * 100
      : 0

    const allIncomeExpense = safeTx.reduce(
      (acc, tx) => {
        const amount = convertCurrency(
          toSafeNumber(tx.amount),
          tx.currency || defaultCurrency,
          defaultCurrency,
          rates,
        )
        if (tx.type === 'income') acc.income += amount
        if (tx.type === 'expense') acc.expense += amount
        return acc
      },
      { income: 0, expense: 0 },
    )

    const cashBalance = totalWalletBalance

    const investedAmount = safeInv.reduce((acc, inv) => {
      const qty = toSafeNumber(inv.quantity)
      const pp = toSafeNumber(inv.purchasePrice)
      const raw = qty * pp
      // Convert from purchaseCurrency -> defaultCurrency for all invested amounts.
      return (
        acc +
        convertCurrency(raw, inv.purchaseCurrency || defaultCurrency, defaultCurrency, rates)
      )
    }, 0)

    // Without live market pricing here, we default current value to invested amount.
    const portfolioValue = investedAmount
    const portfolioChangePct = investedAmount > 0 ? 0 : 0

    const netWorth = cashBalance + portfolioValue
    const monthDelta = monthIncomeExpense.income - monthIncomeExpense.expense
    const monthDeltaTone = monthDelta >= 0 ? 'success' : 'danger'
    const monthDeltaPct = monthIncomeExpense.income > 0 ? (monthDelta / monthIncomeExpense.income) * 100 : 0

    const recentTransactions = [...safeTx].sort((a, b) => {
      const byDate = String(b.date || '').localeCompare(String(a.date || ''))
      if (byDate !== 0) return byDate
      const byCreatedAt = Number(b.createdAt || 0) - Number(a.createdAt || 0)
      if (byCreatedAt !== 0) return byCreatedAt
      return String(b.id || '').localeCompare(String(a.id || ''))
    })

    const todayKey = format(new Date(), 'yyyy-MM-dd')
    const todayFlow = safeTx.reduce(
      (acc, tx) => {
        if (tx?.date !== todayKey) return acc
        const amount = convertCurrency(
          toSafeNumber(tx.amount),
          tx.currency || defaultCurrency,
          defaultCurrency,
          rates,
        )
        if (tx.type === 'income') acc.income += amount
        if (tx.type === 'expense') acc.expense += amount
        return acc
      },
      { income: 0, expense: 0 },
    )
    const todayIncome = todayFlow.income
    const todayNet = todayFlow.income - todayFlow.expense

    const last7 = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - idx))
      const key = format(d, 'yyyy-MM-dd')
      return { day: format(d, 'EEE').slice(0, 1), date: key, income: 0, expense: 0, net: 0 }
    })
    const byDate = new Map(last7.map((row) => [row.date, row]))
    safeTx.forEach((tx) => {
      const row = byDate.get(tx?.date)
      if (!row) return
      const amount = convertCurrency(
        toSafeNumber(tx.amount),
        tx.currency || defaultCurrency,
        defaultCurrency,
        rates,
      )
      if (tx.type === 'income') row.income += amount
      if (tx.type === 'expense') row.expense += amount
    })
    last7.forEach((row) => {
      row.net = row.income - row.expense
    })

    const last30 = Array.from({ length: 30 }, (_, idx) => {
      const d = new Date()
      d.setDate(d.getDate() - (29 - idx))
      const key = format(d, 'yyyy-MM-dd')
      return { day: format(d, 'dd'), date: key, income: 0, expense: 0, net: 0 }
    })
    const byDate30 = new Map(last30.map((row) => [row.date, row]))
    safeTx.forEach((tx) => {
      const row = byDate30.get(tx?.date)
      if (!row) return
      const amount = convertCurrency(
        toSafeNumber(tx.amount),
        tx.currency || defaultCurrency,
        defaultCurrency,
        rates,
      )
      if (tx.type === 'income') row.income += amount
      if (tx.type === 'expense') row.expense += amount
    })
    last30.forEach((row) => {
      row.net = row.income - row.expense
    })

    const last12m = Array.from({ length: 12 }, (_, idx) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (11 - idx))
      const key = format(d, 'yyyy-MM')
      return { day: format(d, 'MMM'), key, income: 0, expense: 0, net: 0 }
    })
    const byMonth12 = new Map(last12m.map((row) => [row.key, row]))
    safeTx.forEach((tx) => {
      const monthKey = String(tx?.date || '').slice(0, 7)
      const row = byMonth12.get(monthKey)
      if (!row) return
      const amount = convertCurrency(
        toSafeNumber(tx.amount),
        tx.currency || defaultCurrency,
        defaultCurrency,
        rates,
      )
      if (tx.type === 'income') row.income += amount
      if (tx.type === 'expense') row.expense += amount
    })
    last12m.forEach((row) => {
      row.net = row.income - row.expense
    })

    const weeklyExpense = last7.reduce((acc, row) => acc + row.expense, 0)
    const weeklyIncome = last7.reduce((acc, row) => acc + row.income, 0)
    const weeklyNet = weeklyIncome - weeklyExpense
    const weeklyProgress = weeklyIncome > 0 ? (weeklyIncome - weeklyExpense) / weeklyIncome : 0

    return {
      netWorth,
      monthIncome: monthIncomeExpense.income,
      monthExpense: monthIncomeExpense.expense,
      monthDelta,
      monthDeltaTone,
      monthDeltaPct,
      incomeDeltaPct,
      expenseDeltaPct,
      portfolioValue,
     
      cashBalance,
      recentTransactions,
      todayNet,
      todayIncome,
      last7,
      last30,
      last12m,
      weeklyIncome,
      weeklyExpense,
      weeklyNet,
      weeklyProgress,
    }
  }, [currentMonthKey, transactions, investments, defaultCurrency, rates, totalWalletBalance])

  const {
    netWorth,
    monthIncome,
    monthExpense,
    monthDelta,
    monthDeltaPct,
    incomeDeltaPct,
    expenseDeltaPct,
    portfolioValue,
    recentTransactions,
    cashBalance,
    last7,
    last30,
    last12m,
    weeklyIncome,
    weeklyExpense,
    weeklyNet,
  } =
    computed
  const showCashAsSeparateMetric = Math.abs(netWorth - cashBalance) > 1

  const groupedRecentEntries = useMemo(() => {
    const grouped = recentTransactions.reduce((acc, tx) => {
      const key = tx?.date || 'unknown'
      if (!acc[key]) acc[key] = []
      acc[key].push(tx)
      return acc
    }, {})
    return Object.entries(grouped)
      .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
      .map(([dateKey, items]) => [dateKey, items])
  }, [recentTransactions])

  const visibleHistoryCount = useMemo(
    () => groupedRecentEntries.reduce((sum, [, items]) => sum + items.length, 0),
    [groupedRecentEntries],
  )
  const allowHistoryGrow = recentTransactions.length <= 5
  const formatHistoryDate = useCallback(
    (value) => {
      if (!value || value === 'unknown') return t('tx.unknownDate')
      const target = new Date(`${value}T00:00:00`)
      if (Number.isNaN(target.getTime())) return value
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const dateOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate())
      const diffDays = Math.round((today - dateOnly) / 86400000)
      if (diffDays === 0) return t('dashboard.date.today')
      if (diffDays === 1) return t('dashboard.date.yesterday')
      return format(dateOnly, 'dd MMM yyyy', { locale: locale === 'en' ? enUS : idLocale })
    },
    [locale, t],
  )

  const budgetGoalSummary = useMemo(() => {
    const monthBudgets = (budgets ?? []).filter((b) => b.month === currentMonthKey)
    const monthBudgetCount = monthBudgets.length
    const goalCount = (goals ?? []).length
    const monthExpenseTxs = (transactions ?? []).filter(
      (tx) => tx?.type === 'expense' && tx?.date?.startsWith(currentMonthKey),
    )
    const monthExpenseTotal = monthExpenseTxs.reduce(
      (sum, tx) =>
        sum +
        convertCurrency(
          toSafeNumber(tx.amount),
          tx.currency || defaultCurrency,
          defaultCurrency,
          rates,
        ),
      0,
    )

    const normalize = (value) => String(value ?? '').trim().toLowerCase()
    const txMatchesBudget = (budgetCategory, txCategory) => {
      const b = normalize(budgetCategory)
      if (!b) return false
      const raw = String(txCategory ?? '')
      const rawNorm = normalize(raw)
      if (rawNorm && rawNorm === b) return true

      const parsed = parseExpenseCategoryPath(raw)
      if (parsed) {
        const candidates = [
          parsed.parent?.names?.id,
          parsed.parent?.names?.en,
          parsed.child?.names?.id,
          parsed.child?.names?.en,
        ]
          .filter(Boolean)
          .map(normalize)
        if (candidates.includes(b)) return true
        const combined = normalize(`${parsed.parent?.names?.id ?? ''} ${parsed.child?.names?.id ?? ''}`)
        if (combined.includes(b)) return true
      }

      return rawNorm.includes(b)
    }

    const budgetRows = monthBudgets.map((b) => {
      const limit = toSafeNumber(b.limit)
      const spent = monthExpenseTxs.reduce((sum, tx) => {
        if (!txMatchesBudget(b.category, tx.category)) return sum
        return sum + convertCurrency(
          toSafeNumber(tx.amount),
          tx.currency || defaultCurrency,
          defaultCurrency,
          rates,
        )
      }, 0)
      const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0
      return { id: b.id, category: b.category, limit, spent, pct }
    })

    const totalLimit = monthBudgets.reduce((sum, b) => sum + toSafeNumber(b.limit), 0)
    const totalSpent = monthExpenseTotal
    const budgetPercent = totalLimit > 0 ? Math.min(100, Math.round((totalSpent / totalLimit) * 100)) : 0

    const goalTarget = (goals ?? []).reduce(
      (sum, g) => sum + convertCurrency(toSafeNumber(g.targetAmount), g.currency || defaultCurrency, defaultCurrency, rates),
      0,
    )
    const goalCurrent = (goals ?? []).reduce(
      (sum, g) => sum + convertCurrency(toSafeNumber(g.currentAmount), g.currency || defaultCurrency, defaultCurrency, rates),
      0,
    )
    const goalPercent = goalTarget > 0 ? Math.min(100, Math.round((goalCurrent / goalTarget) * 100)) : 0

    const goalRows = (goals ?? []).map((g) => {
      const target = convertCurrency(toSafeNumber(g.targetAmount), g.currency || defaultCurrency, defaultCurrency, rates)
      const current = convertCurrency(toSafeNumber(g.currentAmount), g.currency || defaultCurrency, defaultCurrency, rates)
      const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
      return {
        id: g.id,
        name: g.name,
        target,
        current,
        pct,
        deadline: g.deadline,
      }
    })

    return {
      monthBudgetCount,
      goalCount,
      totalLimit,
      totalSpent,
      budgetPercent,
      budgetRows,
      goalTarget,
      goalCurrent,
      goalPercent,
      goalRows,
    }
  }, [budgets, goals, transactions, currentMonthKey, defaultCurrency, rates])

  const [miniRevenueRange, setMiniRevenueRange] = useState('weekly')
  const [zoomRevenueRange, setZoomRevenueRange] = useState('weekly')
  const [miniRevenueSnapshot, setMiniRevenueSnapshot] = useState([])
  const [isCoarsePointer, setIsCoarsePointer] = useState(false)
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const nowRef = useRef(0)

  useEffect(() => {
    // Keep "now" updated without re-rendering charts.
    nowRef.current = Date.now()
    const id = setInterval(() => {
      nowRef.current = Date.now()
    }, 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia('(pointer: coarse)')
    const onChange = () => setIsCoarsePointer(mq.matches)
    onChange()
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    mq.addListener(onChange)
    return () => mq.removeListener(onChange)
  }, [])

  const computeCashBalanceBeforeDate = useCallback(
    (dateKey) => {
      const safeTx = transactions ?? []
      const target = String(dateKey || '')
      if (!target) return 0
      return safeTx.reduce((acc, tx) => {
        const d = String(tx?.date || '')
        if (!d || d >= target) return acc
        const amount = convertCurrency(
          toSafeNumber(tx.amount),
          tx.currency || defaultCurrency,
          defaultCurrency,
          rates,
        )
        if (tx.type === 'income') return acc + amount
        if (tx.type === 'expense') return acc - amount
        return acc
      }, totalWalletBalance || 0)
    },
    [defaultCurrency, rates, transactions, totalWalletBalance],
  )

  const buildRevenueSeries = useCallback(
    (rangeId) => {
    if (rangeId === 'today') {
      const todayKey = format(new Date(), 'yyyy-MM-dd')
      const startBalance = computeCashBalanceBeforeDate(todayKey) + portfolioValue
      const hourNet = Array.from({ length: 24 }, () => 0)
      ;(transactions ?? []).forEach((tx) => {
        if (String(tx?.date || '') !== todayKey) return
        const amount = convertCurrency(
          toSafeNumber(tx.amount),
          tx.currency || defaultCurrency,
          defaultCurrency,
          rates,
        )
        const signed = tx.type === 'income' ? amount : tx.type === 'expense' ? -amount : 0
        const fallbackMs = Number(new Date(`${todayKey}T12:00:00`).getTime())
        const txMs = Number.isFinite(Number(tx?.createdAt)) ? Number(tx.createdAt) : fallbackMs
        const hour = new Date(txMs).getHours()
        if (hour >= 0 && hour <= 23) hourNet[hour] += signed
      })

      const startOfToday = new Date(`${todayKey}T00:00:00`).getTime()
      const currentHour = new Date(nowRef.current).getHours()
      let running = startBalance
      return Array.from({ length: currentHour + 1 }, (_, hour) => {
        running += toSafeNumber(hourNet[hour])
        return { time: startOfToday + hour * 60 * 60 * 1000, value: running }
      })
    }
    if (rangeId === 'weekly') {
      const startDate = last7[0]?.date
      const startBalance = (startDate ? computeCashBalanceBeforeDate(startDate) : 0) + portfolioValue
      let running = startBalance
      return last7.map((row) => {
        running += toSafeNumber(row.net)
        return { time: new Date(row.date).getTime(), value: running }
      })
    }
    if (rangeId === 'monthly') {
      const startDate = last30[0]?.date
      const startBalance = (startDate ? computeCashBalanceBeforeDate(startDate) : 0) + portfolioValue
      let running = startBalance
      return last30.map((row) => {
        running += toSafeNumber(row.net)
        return { time: new Date(row.date).getTime(), value: running }
      })
    }
    // yearly
    const startMonthKey = last12m[0]?.key
    const startDate = startMonthKey ? `${startMonthKey}-01` : ''
    const startBalance = (startDate ? computeCashBalanceBeforeDate(startDate) : 0) + portfolioValue
    let running = startBalance
    return last12m.map((row) => {
      running += toSafeNumber(row.net)
      return { time: new Date(`${row.key}-01`).getTime(), value: running }
    })
    },
    [computeCashBalanceBeforeDate, defaultCurrency, last12m, last30, last7, portfolioValue, rates, transactions],
  )

  const computeRevenueValue = useCallback(
    (rangeId) => {
      if (rangeId === 'today') return cashBalance + portfolioValue
      if (rangeId === 'weekly') return cashBalance + portfolioValue
      if (rangeId === 'monthly') return cashBalance + portfolioValue
      return cashBalance + portfolioValue
    },
    [cashBalance, portfolioValue],
  )

  const zoomRevenueSeries = useMemo(() => {
    try {
      return buildRevenueSeries(zoomRevenueRange)
    } catch {
      return []
    }
  }, [buildRevenueSeries, zoomRevenueRange])

  const zoomRevenueValue = useMemo(
    () => computeRevenueValue(zoomRevenueRange),
    [computeRevenueValue, zoomRevenueRange],
  )

  const miniRevenueSeries = useMemo(() => {
    if (miniRevenueSnapshot.length > 1) return miniRevenueSnapshot
    try {
      return buildRevenueSeries(miniRevenueRange)
    } catch {
      return []
    }
  }, [miniRevenueSnapshot, buildRevenueSeries, miniRevenueRange])

  useEffect(() => {
    if (miniRevenueSnapshot.length > 0) {
      setMiniRevenueSnapshot([])
    }
  }, [transactions, miniRevenueSnapshot.length])

  const miniRevenueAxisDomain = useMemo(
    () => buildPaddedDomain(miniRevenueSeries, 0.14, { includeZero: true, respectDataSign: true }),
    [miniRevenueSeries],
  )
  const miniRevenueAxisTicks = useMemo(() => {
    const minUnit = defaultCurrency === 'IDR' ? 10_000 : 1
    const maxLabels = isCoarsePointer ? 4 : 5
    return buildNiceTicksForDomain(miniRevenueAxisDomain, maxLabels, minUnit, true)
  }, [defaultCurrency, isCoarsePointer, miniRevenueAxisDomain])
  const miniRevenueChartDomain = useMemo(() => {
    if (miniRevenueAxisTicks.length >= 2) {
      return [miniRevenueAxisTicks[0], miniRevenueAxisTicks[miniRevenueAxisTicks.length - 1]]
    }
    return miniRevenueAxisDomain
  }, [miniRevenueAxisTicks, miniRevenueAxisDomain])

  const zoomRevenueAxisDomain = useMemo(
    () => buildPaddedDomain(zoomRevenueSeries, 0.14, { includeZero: true, respectDataSign: true }),
    [zoomRevenueSeries],
  )
  const zoomRevenueAxisTicks = useMemo(() => {
    const minUnit = defaultCurrency === 'IDR' ? 10_000 : 1
    return buildNiceTicksForDomain(zoomRevenueAxisDomain, 6, minUnit, true)
  }, [defaultCurrency, zoomRevenueAxisDomain])
  const zoomRevenueChartDomain = useMemo(() => {
    if (zoomRevenueAxisTicks.length >= 2) {
      return [zoomRevenueAxisTicks[0], zoomRevenueAxisTicks[zoomRevenueAxisTicks.length - 1]]
    }
    return zoomRevenueAxisDomain
  }, [zoomRevenueAxisTicks, zoomRevenueAxisDomain])

  const [zoomedChart, setZoomedChart] = useState(null) // 'revenue' | 'budget' | 'savings' | null
  const [zoomVisible, setZoomVisible] = useState(false)
  const closeZoomTimeoutRef = useRef(null)
  const motionDelay = reduceMotion ? 0 : 220

  const closeZoom = () => {
    if (zoomedChart === 'revenue') {
      setMiniRevenueSnapshot(zoomRevenueSeries)
      setMiniRevenueRange(zoomRevenueRange)
    }
    setZoomVisible(false)
    if (closeZoomTimeoutRef.current) window.clearTimeout(closeZoomTimeoutRef.current)
    closeZoomTimeoutRef.current = window.setTimeout(() => {
      setZoomedChart(null)
      closeZoomTimeoutRef.current = null
    }, motionDelay)
  }

  useEffect(() => {
    if (!zoomedChart) return undefined
    window.requestAnimationFrame(() => setZoomVisible(true))
    return undefined
  }, [zoomedChart])

  useEffect(() => {
    if (!zoomedChart || typeof document === 'undefined') return undefined
    const previousOverflow = document.body.style.overflow
    const previousTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.touchAction = previousTouchAction
    }
  }, [zoomedChart])

  useEffect(() => {
    return () => {
      if (closeZoomTimeoutRef.current) window.clearTimeout(closeZoomTimeoutRef.current)
    }
  }, [])

  const RevenueCard = ({ interactive = false }) => {
    const containerProps = interactive
      ? {
          role: 'button',
          tabIndex: 0,
          onClick: () => setZoomedChart('revenue'),
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') setZoomedChart('revenue')
          },
        }
      : {}

    return (
      <div
        {...containerProps}
        className={`${interactive ? 'cursor-pointer select-none' : ''}`}
      >
        <Card title={t('dashboard.netWorthHistory')} withDivider>
          <div className="mb-3 flex min-h-[44px] items-center justify-between gap-2">
            <ChartToggle
              value={zoomRevenueRange}
              onChange={setZoomRevenueRange}
              items={[
                { id: 'yearly', label: t('dashboard.range.yearly') },
                { id: 'monthly', label: t('dashboard.range.monthly') },
                { id: 'weekly', label: t('dashboard.range.weekly') },
                { id: 'today', label: t('dashboard.range.today') },
              ]}
            />
            <div className="text-right">
              <p className="text-xs text-[var(--muted)]">
                {zoomRevenueRange === 'yearly'
                  ? t('dashboard.range.yearly')
                  : zoomRevenueRange === 'monthly'
                    ? t('dashboard.range.monthly')
                    : zoomRevenueRange === 'today'
                      ? t('dashboard.range.today')
                      : t('dashboard.range.weekly')}
              </p>
              <p className="text-sm font-semibold text-[var(--fg)]">
                {formatCurrency(zoomRevenueValue, defaultCurrency)}
              </p>
            </div>
          </div>

          <div className="h-60 w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] p-2 text-[var(--fg)]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={zoomRevenueSeries} margin={{ top: 10, right: 4, bottom: 4, left: 4 }}>
                <XAxis type="number" dataKey="time" scale="time" domain={['dataMin', 'dataMax']} hide />
                <YAxis
                  domain={zoomRevenueChartDomain}
                  orientation="right"
                  stroke="#64748b"
                  tickFormatter={(v) => formatCurrency(v, defaultCurrency)}
                  ticks={zoomRevenueAxisTicks}
                  interval={0}
                  tickCount={undefined}
                  axisLine={false}
                  tickLine={false}
                  width={defaultCurrency === 'IDR' ? 84 : 64}
                  fontSize={11}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(value, defaultCurrency)}
                  labelFormatter={(label, payload) => {
                    const ts = Number(payload?.[0]?.payload?.time ?? label)
                    if (!Number.isFinite(ts) || ts <= 0) return '-'
                    return format(new Date(ts), 'dd MMM yyyy, HH:mm')
                  }}
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
                  key={zoomRevenueSeries?.map((d) => d?.value).join('-')}
                  type="monotone"
                  dataKey="value"
                  stroke="var(--chart-ink)"
                  fill="var(--chart-ink)"
                  fillOpacity={0.1}
                  strokeWidth={1.8}
                  dot={false}
                  activeDot={{ r: 3 }}
                  isAnimationActive={!reduceMotion}
                  animationDuration={700}
                  animationEasing="ease"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="ft-muted mt-3 min-h-[16px] text-xs">
            {t('dashboard.revenue.quickSummary', {
              net: formatCurrency(weeklyNet, defaultCurrency),
              income: formatCurrency(weeklyIncome, defaultCurrency),
              expense: formatCurrency(weeklyExpense, defaultCurrency),
            })}
          </p>
        </Card>
      </div>
    )
  }

  const allHabitLogs = useLiveQuery(() => db.habitLogs.toArray(), []) || []
  const allHabits = useLiveQuery(() => db.habits.toArray(), []) || []

  const globalWeeklyTrend = useMemo(() => {
    return calculateGlobalWeeklyTrend(allHabits, allHabitLogs)
  }, [allHabits, allHabitLogs])

  const globalConsistencyStreak = useMemo(() => {
    if (!allHabitLogs.length) return 0
    const logDates = new Set(allHabitLogs.map(l => l.date))
    let streak = 0
    const todayDate = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(todayDate)
      d.setDate(d.getDate() - i)
      // JS Date to YYYY-MM-DD in local time
      const dateStr = format(d, 'yyyy-MM-dd')
      if (logDates.has(dateStr)) {
        streak++
      } else {
        if (i !== 0) break
      }
    }
    return streak
  }, [allHabitLogs])

  return (
    <div className="bg-[var(--bg)]">
      <div
        className={`ft-page-enter min-h-full space-y-4 transform-gpu ${
          isEntering ? '' : 'opacity-0'
        }`}
      >
      {/* Wallet Carousel Hero */}
      <WalletCarousel
        monthIncome={monthIncome}
        monthExpense={monthExpense}
        wallets={walletsWithBalance}
        defaultCurrency={defaultCurrency}
      />

      {/* Transaksi Terakhir Card */}
      <section>
        <button
          type="button"
          onClick={() => navigate('/transactions')}
          className="w-full text-left rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 sm:p-4 shadow-sm hover:border-[var(--border-strong)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-bold tracking-tight text-[var(--fg)]">Transaksi Terakhir</h3>
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7"/></svg>
          </div>
          
          {groupedRecentEntries.length > 0 ? (() => {
            const [latestDateKey, items] = groupedRecentEntries[0];
            const latestTx = items[0];
            const dateObj = new Date(`${latestDateKey}T12:00:00`);
            const dateLabel = Number.isNaN(dateObj.getTime()) ? latestDateKey : format(dateObj, 'EEEE d MMMM yyyy', { locale: locale === 'en' ? enUS : idLocale }).toUpperCase();
            
            const iconKey = resolveTransactionIconKey(latestTx?.category, latestTx?.type);
            const colorClass = getCategoryColorClass(iconKey, latestTx?.type, latestTx?.category);
            const labels = getTransactionCategoryLabels(latestTx?.category, latestTx?.type, locale);
            
            let createdTime = null;
            const createdAtMs = Number(latestTx?.createdAt);
            if (Number.isFinite(createdAtMs) && createdAtMs > 0) {
              createdTime = format(new Date(createdAtMs), 'HH:mm');
            }
            
            const sub = labels.sub || null;
            const noteStr = latestTx?.notes ? String(latestTx.notes).trim() : '';
            const isExpense = latestTx?.type === 'expense';
            
            return (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold tracking-wider text-[var(--muted)]">{dateLabel}</p>
                  <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[9px] font-bold tracking-wider text-[var(--bg)]">BARU</span>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2">
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${colorClass}`}>
                        <CategoryIcon icon={iconKey} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {createdTime ? (
                          <p className="text-[9px] font-medium leading-tight text-[var(--muted)]">{createdTime}</p>
                        ) : null}
                        <p className="truncate text-[13px] font-bold text-[var(--fg)]">{labels.main}</p>
                        {sub ? (
                          <>
                            <p className="mt-0.5 truncate text-[10px] font-medium leading-tight text-[var(--muted)]">{sub}</p>
                            {noteStr ? (
                              <p className="mt-0.5 truncate text-[9px] italic leading-tight text-[var(--muted-2)]">{noteStr}</p>
                            ) : null}
                          </>
                        ) : noteStr ? (
                          <p className="mt-0.5 truncate text-[10px] font-medium leading-tight text-[var(--muted)]">{noteStr}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 max-w-[50%] pl-2 text-right">
                      <p className={`break-all text-[13px] font-bold tabular-nums ${isExpense ? 'ft-expense-text' : 'ft-income-text'}`}>
                        {isExpense ? '-' : '+'}
                        {formatCurrency(Math.abs(Number(latestTx?.amount || 0)), latestTx?.currency || defaultCurrency)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })() : (
            <div className="flex items-center gap-3 py-3 px-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"/>
                  <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
                  <path d="M12 17V7"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-[12px] font-bold text-[var(--fg)]">{t('dashboard.history.empty')}</p>
                <p className="text-[10px] mt-0.5 font-medium text-[var(--muted)]">Mulai catat pengeluaran pertamamu.</p>
              </div>
            </div>
          )}
        </button>
      </section>



      <div
        className="ft-interactive-card rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        style={{ boxShadow: 'var(--shadow-card)' }}
        onClick={() => setZoomedChart('habits')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setZoomedChart('habits') }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between mb-4">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold tracking-tight text-[var(--fg)]">Habit Consistency</p>
              <p className="ft-muted mt-0.5 text-[11px]">14 Hari Terakhir</p>
            </div>
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
                </svg>
                <span className="text-xl font-black text-[var(--fg)] tabular-nums leading-none">{globalConsistencyStreak}</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)] mt-1">Hari Beruntun</span>
            </div>
          </div>
          <MiniHabitHeatmap />
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3">
        <MiniChartCard
          t={t}
          title={t('dashboard.netWorthHistory')}
          value={formatCurrency(computeRevenueValue(miniRevenueRange), defaultCurrency)}
          data={miniRevenueSeries}
          stroke="var(--accent)"
          fill="var(--accent)"
          animate={!reduceMotion}
          premium
          animationDuration={isCoarsePointer ? 700 : 900}
          animationEasing="ease"
          onOpen={() => {
            setMiniRevenueSnapshot([])
            setZoomRevenueRange(miniRevenueRange)
            setZoomedChart('revenue')
          }}
          formatValue={(v) => formatCurrency(v, defaultCurrency)}
          xKey="time"
          yDomain={miniRevenueChartDomain}
          showRightAxis
          rightAxisTickFormatter={(v) => formatCurrency(v, defaultCurrency)}
          rightAxisWidth={defaultCurrency === 'IDR' ? 84 : 64}
          rightAxisTicks={miniRevenueAxisTicks}
          rangeLabel={
            miniRevenueRange === 'yearly'
              ? t('dashboard.range.yearly')
              : miniRevenueRange === 'monthly'
                ? t('dashboard.range.monthly')
                : miniRevenueRange === 'today'
                  ? t('dashboard.range.today')
                  : t('dashboard.range.weekly')
          }
        />
      </section>

      
      {/* Combined Budget & Savings Tabbed Card (Fintech Pro Segmented Design) */}
      <section>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-sm sm:p-5">
          {/* Segmented Control Switcher */}
          <div className="grid grid-cols-2 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
            <button
              type="button"
              onClick={() => setBudgetTab('budget')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-xs font-bold transition ${
                budgetTab === 'budget'
                  ? 'bg-[var(--fg)] text-[var(--bg)] shadow-2xs'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              <span>{t('dashboard.budget')}</span>
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                budgetTab === 'budget' ? 'bg-[var(--bg)]/20 text-[var(--bg)]' : 'bg-[var(--border)]/60 text-[var(--muted)]'
              }`}>
                {currentMonthLabel}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setBudgetTab('savings')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-xs font-bold transition ${
                budgetTab === 'savings'
                  ? 'bg-[var(--fg)] text-[var(--bg)] shadow-2xs'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              <span>{t('dashboard.savings')}</span>
              {budgetGoalSummary.goalCount ? (
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                  budgetTab === 'savings' ? 'bg-[var(--bg)]/20 text-[var(--bg)]' : 'bg-[var(--border)]/60 text-[var(--muted)]'
                }`}>
                  {budgetGoalSummary.goalCount}
                </span>
              ) : null}
            </button>
          </div>

          {/* Section Header & Actions Row */}
          <div className="mt-4 flex flex-col justify-between gap-3 border-b border-[var(--border)]/60 pb-3.5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold tracking-tight text-[var(--fg)]">
                {budgetTab === 'budget' ? 'Anggaran Bulan Ini' : 'Target & Progres Tabungan'}
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
                {budgetTab === 'budget' ? 'Pantau pengeluaran agar tetap dalam batas aman' : 'Progres akumulasi dana menuju tujuan finansialmu'}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => navigate(budgetTab === 'budget' ? '/budget' : '/savings')}
                className="rounded-lg border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--fg)]/40 hover:text-[var(--fg)]"
              >
                Lihat Halaman
              </button>
              <button
                type="button"
                onClick={() => (budgetTab === 'budget' ? setIsOpenQuickBudget(true) : setIsOpenQuickGoal(true))}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--fg)] px-3 py-1.5 text-xs font-bold text-[var(--bg)] shadow-2xs transition hover:opacity-90"
                aria-label={budgetTab === 'budget' ? t('dashboard.budget.add') : t('dashboard.savings.add')}
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                <span>{budgetTab === 'budget' ? 'Anggaran' : 'Target'}</span>
              </button>
            </div>
          </div>

          <div className="mt-4">
            {budgetTab === 'budget' ? (
              <div className="space-y-3">
                {budgetGoalSummary.budgetRows?.length ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {budgetGoalSummary.budgetRows.slice(0, 6).map((row) => (
                      <div key={row.id} className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-bold leading-tight text-[var(--fg)]">{row.category}</p>
                          <span className={`shrink-0 text-[11px] font-bold ${
                            row.pct >= 100 ? 'text-rose-500 dark:text-rose-400' : row.pct >= 80 ? 'text-amber-500 dark:text-amber-400' : 'text-[var(--muted)]'
                          }`}>{Math.round(row.pct)}%</span>
                        </div>
                        <p className="mt-1 text-xs font-semibold tabular-nums text-[var(--muted)]">
                          {formatCurrency(row.spent, defaultCurrency)} / <span className="text-[var(--fg)]">{formatCurrency(row.limit, defaultCurrency)}</span>
                        </p>
                        <ProgressBar value={row.pct} tone="budget" className="mt-2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="w-full rounded-xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-6 text-center transition hover:bg-[var(--panel)]"
                    onClick={() => navigate('/budget')}
                  >
                    <p className="text-sm font-semibold text-[var(--fg)]">{t('dashboard.budget.emptyCta')}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{t('dashboard.budget.emptyDesc')}</p>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {budgetGoalSummary.goalRows?.length ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {budgetGoalSummary.goalRows.slice(0, 6).map((row) => (
                      <div key={row.id} className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-bold leading-tight text-[var(--fg)]">{row.name}</p>
                          <span className="shrink-0 text-[11px] font-bold text-[var(--muted)]">{Math.round(row.pct)}%</span>
                        </div>
                        <p className="mt-1 text-xs font-semibold tabular-nums text-[var(--muted)]">
                          {formatCurrency(row.current, defaultCurrency)} / <span className="text-[var(--fg)]">{formatCurrency(row.target, defaultCurrency)}</span>
                        </p>
                        <ProgressBar value={row.pct} tone="savings" className="mt-2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-6 text-center">
                    <p className="text-sm font-semibold text-[var(--fg)]">{t('dashboard.savings.empty')}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{t('dashboard.savings.emptyDesc')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      

      {zoomedChart && typeof document !== 'undefined'
        ? createPortal(
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            onClick={closeZoom}
            className={`ft-motion-overlay absolute inset-0 bg-black/40 ${
              zoomVisible ? 'opacity-100' : 'opacity-0'
            }`}
            aria-label={t('dashboard.zoom.close')}
          />

          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div
              className={`ft-motion-panel origin-bottom rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 shadow-xl ${
                zoomVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
              style={{ boxShadow: 'var(--shadow)' }}
            >
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[var(--border-strong)]/40" />
              {zoomedChart === 'habits' ? (
                <>
                  <HabitHeatmapWidget />
                  <div className="mt-4">
                    <h4 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-[var(--muted-2)]">Tren Penyelesaian Rata-Rata</h4>
                    <div className="h-40 rounded-2xl bg-[color-mix(in_srgb,var(--field-bg)_30%,transparent)] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] p-4 text-[var(--fg)]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={globalWeeklyTrend} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorGlobalRate" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
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
                      onClick={closeZoom}
                      className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-5 py-2 text-[12px] font-semibold text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors"
                    >
                      {t('dashboard.zoom.close')}
                    </button>
                  </div>
                </>
              ) : zoomedChart === 'savings' ? (
                <>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tracking-tight text-[var(--fg)]">{t('dashboard.savings')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate('/savings')}
                        className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[11px] font-semibold text-[var(--fg)] hover:bg-[var(--field-bg)]"
                      >
                        + Target
                      </button>
                      <button
                        type="button"
                        onClick={closeZoom}
                        className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[11px] font-semibold text-[var(--fg)] hover:bg-[var(--field-bg)]"
                      >
                        {t('dashboard.zoom.close')}
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[80dvh] overflow-y-auto overscroll-none pr-1">
                    {budgetGoalSummary.goalRows?.length ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {budgetGoalSummary.goalRows.map((row) => (
                          <div key={row.id} className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-bold text-[var(--fg)]">{row.name}</p>
                              <span className="text-[11px] font-bold text-[var(--muted)]">{Math.round(row.pct)}%</span>
                            </div>
                            <p className="mt-1 text-xs font-semibold tabular-nums text-[var(--muted)]">
                              {formatCurrency(row.current, defaultCurrency)} / <span className="text-[var(--fg)]">{formatCurrency(row.target, defaultCurrency)}</span>
                            </p>
                            <ProgressBar value={row.pct} tone="savings" className="mt-2" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-4">
                        <p className="text-sm font-semibold text-[var(--fg)]">{t('dashboard.savings.empty')}</p>
                        <p className="ft-muted mt-1 text-[12px]">{t('dashboard.savings.emptyDesc')}</p>
                      </div>
                    )}
                  </div>
                </>
              ) : zoomedChart === 'budget' ? (
                <>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tracking-tight text-[var(--fg)]">{t('dashboard.budget')}</p>
                      <p className="ft-muted mt-0.5 text-[11px]">{currentMonthLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate('/budget')}
                        className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[11px] font-semibold text-[var(--fg)] hover:bg-[var(--field-bg)]"
                      >
                        {t('budget.add')}
                      </button>
                      <button
                        type="button"
                        onClick={closeZoom}
                        className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[11px] font-semibold text-[var(--fg)] hover:bg-[var(--field-bg)]"
                      >
                        {t('dashboard.zoom.close')}
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[80dvh] overflow-y-auto overscroll-none pr-1">
                    {budgetGoalSummary.budgetRows?.length ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {budgetGoalSummary.budgetRows.map((row) => (
                          <div key={row.id} className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-bold text-[var(--fg)]">{row.category}</p>
                              <span className={`text-[11px] font-bold ${
                                row.pct >= 100 ? 'text-rose-500 dark:text-rose-400' : row.pct >= 80 ? 'text-amber-500 dark:text-amber-400' : 'text-[var(--muted)]'
                              }`}>{Math.round(row.pct)}%</span>
                            </div>
                            <p className="mt-1 text-xs font-semibold tabular-nums text-[var(--muted)]">
                              {formatCurrency(row.spent, defaultCurrency)} / <span className="text-[var(--fg)]">{formatCurrency(row.limit, defaultCurrency)}</span>
                            </p>
                            <ProgressBar value={row.pct} tone="budget" className="mt-2" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-4 text-center">
                        <p className="text-sm font-semibold text-[var(--fg)]">{t('dashboard.budget.empty')}</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex flex-1 gap-1 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
                      <ZoomTab id="revenue" active={zoomedChart === 'revenue'} label={t('dashboard.zoom.tabRevenue')} onSelect={setZoomedChart} />
                    </div>

                    <button
                      type="button"
                      onClick={closeZoom}
                      className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[11px] font-semibold text-[var(--fg)] hover:bg-[var(--field-bg)]"
                    >
                      {t('dashboard.zoom.close')}
                    </button>
                  </div>

                  <div className="max-h-[80dvh] overflow-hidden overscroll-none">
                    <RevenueCard />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
          ,
          document.body,
        )
        : null}

      <BudgetSheetModal
        isOpen={isOpenQuickBudget}
        onClose={() => setIsOpenQuickBudget(false)}
      />
      <SavingsSheetModal
        isOpen={isOpenQuickGoal}
        onClose={() => setIsOpenQuickGoal(false)}
      />
      </div>
    </div>
  )
}

export default Dashboard
