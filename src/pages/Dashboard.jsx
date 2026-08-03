/* eslint-disable */
import { format, startOfMonth, subMonths, differenceInDays } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { X, TrendingUp, TrendingDown, ArrowDownRight, ArrowUpRight, Wallet, GitCompare, Activity, PieChart, ChevronDown, ChevronUp, ChevronRight, Plus, HandCoins, Receipt, AlertCircle, Clock, Target } from 'lucide-react'
import Card from '../components/ui/Card'
import CategoryIcon from '../components/ui/CategoryIcon'
import { db } from '../lib/db'
import { getCategoryColorClass, getTransactionCategoryLabels, resolveTransactionIconKey } from '../lib/categoryIcon'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import { convertCurrency, FALLBACK_EXCHANGE_RATES, formatCurrency, isExcludeAnalyticsTx, toSafeNumber } from '../lib/utils'
import { formatExpenseCategory, parseExpenseCategoryPath } from '../lib/expenseCategories'
import { calculateBudgetSpent } from '../lib/budgetUtils'
import { formatIncomeCategory } from '../lib/incomeCategories'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import HabitHeatmapWidget from '../components/habits/HabitHeatmapWidget'
import MiniHabitHeatmap from '../components/habits/MiniHabitHeatmap'
import { calculateGlobalWeeklyTrend } from '../lib/habitStats'
import BudgetSheetModal from '../components/budget/BudgetSheetModal'
import SavingsSheetModal from '../components/savings/SavingsSheetModal'
import LoanSheetModal from '../components/loans/LoanSheetModal'
import LoanPaymentModal from '../components/loans/LoanPaymentModal'
import WalletCarousel from '../components/dashboard/WalletCarousel'
import {
  clampPercent,
  buildCenteredDomain,
  buildPaddedDomain,
  buildNiceTicksForDomain,
  buildAdaptiveMoneyTicks,
  compactTicksAroundZero,
  ensureZeroTickWithinLimit,
} from '../components/dashboard/DashboardChartHelpers'
import {
  ProgressBar,
  MetricCard,
  MiniChartCard,
  ChartToggle,
  ZoomTab,
} from '../components/dashboard/DashboardStatComponents'

const getSavedNetWorthRange = () => {
  try {
    const val = localStorage.getItem('ft_networth_range')
    if (val === 'today') return '1d'
    if (val === 'weekly') return '1w'
    if (val === 'monthly') return '1m'
    if (val === 'yearly') return '1y'
    return val || '1m'
  } catch {
    return '1m'
  }
}

const COMPACT_ITEMS = [
  { id: '1d', label: '1H' },
  { id: '1w', label: '1M' },
  { id: '1m', label: '1B' },
  { id: '3m', label: '3B' },
  { id: 'ytd', label: 'YTD' },
  { id: '1y', label: '1T' },
  { id: 'all', label: 'ALL' },
]

// Persistent cache for total wallet balances & recent transactions across tab switches
let cachedWalletsWithBalance = null
let cachedTotalWalletBalance = null
let cachedRecentTransactions = null
let cachedTodayStats = null
let cachedChartData = null
let cachedMonthStats = null
let cachedGroupedRecentEntries = null

function Dashboard() {
  const navigate = useNavigate()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const { t, locale } = useTranslation()
  const [rates, setRates] = useState(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES })
  const currentMonthKey = format(new Date(), 'yyyy-MM')
  const currentMonthLabel = format(new Date(), 'MMM yyyy', {
    locale: locale === 'en' ? enUS : idLocale,
  })

  // Scope to last 13 months — covers current + 12m chart + last-month delta.
  // Uses the new `date` index added in db.version(13) for efficient range query.
  const txCutoffDate = format(startOfMonth(subMonths(new Date(), 12)), 'yyyy-MM-dd')
  const transactions = useLiveQuery(
    () => db.transactions.where('date').aboveOrEqual(txCutoffDate).toArray(),
    [txCutoffDate],
    null,
  )
  const investments = useLiveQuery(() => db.investments.toArray(), [], null)
  const budgets = useLiveQuery(() => db.budgets.toArray(), [], null)
  const goals = useLiveQuery(() => db.goals.toArray(), [], null)
  const loans = useLiveQuery(() => db.loans.toArray(), [], null)
  // Wallets balance needs ALL transactions (including older ones for correct balance history)
  const allTransactionsForBalance = useLiveQuery(() => db.transactions.toArray(), [], null)
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], null)

  // null = still loading. Wallets balance loading also waits for allTransactionsForBalance.
  const isDbLoading = transactions === null || wallets === null || allTransactionsForBalance === null

  const [zoomRevenueRange, setZoomRevenueRangeState] = useState(() => getSavedNetWorthRange())
  const [miniRevenueRange, setMiniRevenueRangeState] = useState(() => getSavedNetWorthRange())
  const [isLoanSheetOpen, setIsLoanSheetOpen] = useState(false)
  const [payLoan, setPayLoan] = useState(null)
  const [isPayOpen, setIsPayOpen] = useState(false)
  const [activeBudgetSlide, setActiveBudgetSlide] = useState(0)
  const budgetTouchStartXRef = useRef(null)
  const budgetTouchEndXRef = useRef(null)

  const handleBudgetTouchStart = (e) => {
    budgetTouchStartXRef.current = e.touches[0].clientX
    budgetTouchEndXRef.current = e.touches[0].clientX
  }

  const handleBudgetTouchMove = (e) => {
    budgetTouchEndXRef.current = e.touches[0].clientX
  }

  const handleBudgetTouchEnd = () => {
    if (budgetTouchStartXRef.current === null || budgetTouchEndXRef.current === null) return
    const diff = budgetTouchStartXRef.current - budgetTouchEndXRef.current
    if (diff > 45) {
      setActiveBudgetSlide(1)
    } else if (diff < -45) {
      setActiveBudgetSlide(0)
    }
    budgetTouchStartXRef.current = null
    budgetTouchEndXRef.current = null
  }

  const setZoomRevenueRange = useCallback((range) => {
    setZoomTooltipDismissed(true)
    setZoomRevenueRangeState(range)
    setMiniRevenueRangeState(range)
    try {
      localStorage.setItem('ft_networth_range', range)
    } catch {}
  }, [])

  const setMiniRevenueRange = useCallback((range) => {
    setZoomTooltipDismissed(true)
    setMiniRevenueRangeState(range)
    setZoomRevenueRangeState(range)
    try {
      localStorage.setItem('ft_networth_range', range)
    } catch {}
  }, [])
  
  const walletsWithBalance = useMemo(() => {
    if (wallets === null || wallets === undefined || allTransactionsForBalance === null || allTransactionsForBalance === undefined) {
      return cachedWalletsWithBalance || undefined
    }
    if (!wallets) {
      cachedWalletsWithBalance = []
      return []
    }
    // Use full transaction history so balances include transactions older than 13 months
    const txs = allTransactionsForBalance || []
    const computed = wallets.map(w => {
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
    cachedWalletsWithBalance = computed
    return computed
  }, [wallets, allTransactionsForBalance])

  const totalWalletBalance = useMemo(() => {
    if (walletsWithBalance === undefined || walletsWithBalance === null) {
      return cachedTotalWalletBalance !== null ? cachedTotalWalletBalance : 0
    }
    const total = walletsWithBalance.reduce((s, w) => s + w.currentBalance, 0)
    cachedTotalWalletBalance = total
    return total
  }, [walletsWithBalance])
  
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

  // ── Granular memos — each re-runs only when its own deps change ─────────

  // 1. Month income/expense + delta vs last month (deps: transactions + month key + currency + rates)
  const monthStats = useMemo(() => {
    if (transactions === null || investments === null) {
      return cachedMonthStats || {
        monthIncome: 0, monthExpense: 0, monthDelta: 0, monthDeltaTone: 'success',
        monthDeltaPct: 0, incomeDeltaPct: 0, expenseDeltaPct: 0,
      }
    }
    const safeTx = transactions ?? []
    const lastMonthKey = format(subMonths(new Date(), 1), 'yyyy-MM')

    const lastMonth = safeTx.reduce((acc, tx) => {
      if (!tx?.date?.startsWith(lastMonthKey)) return acc
      if (isExcludeAnalyticsTx(tx)) return acc
      const amount = convertCurrency(toSafeNumber(tx.amount), tx.currency || defaultCurrency, defaultCurrency, rates)
      if (tx.type === 'income') acc.income += amount
      if (tx.type === 'expense') acc.expense += amount
      return acc
    }, { income: 0, expense: 0 })

    const thisMonth = safeTx.reduce((acc, tx) => {
      if (!tx?.date?.startsWith(currentMonthKey)) return acc
      if (isExcludeAnalyticsTx(tx)) return acc
      const amount = convertCurrency(toSafeNumber(tx.amount), tx.currency || defaultCurrency, defaultCurrency, rates)
      if (tx.type === 'income') acc.income += amount
      if (tx.type === 'expense') acc.expense += amount
      return acc
    }, { income: 0, expense: 0 })

    const monthDelta = thisMonth.income - thisMonth.expense
    const computed = {
      monthIncome: thisMonth.income,
      monthExpense: thisMonth.expense,
      monthDelta,
      monthDeltaTone: monthDelta >= 0 ? 'success' : 'danger',
      monthDeltaPct: thisMonth.income > 0 ? (monthDelta / thisMonth.income) * 100 : 0,
      incomeDeltaPct: lastMonth.income > 0 ? ((thisMonth.income - lastMonth.income) / lastMonth.income) * 100 : 0,
      expenseDeltaPct: lastMonth.expense > 0 ? ((thisMonth.expense - lastMonth.expense) / lastMonth.expense) * 100 : 0,
    }
    cachedMonthStats = computed
    return computed
  }, [transactions, investments, currentMonthKey, defaultCurrency, rates])

  // 2. Portfolio value from investments (deps: investments + currency + rates)
  const portfolioStats = useMemo(() => {
    if (investments === null) return { portfolioValue: 0 }
    const safeInv = investments ?? []
    const investedAmount = safeInv.reduce((acc, inv) => {
      const raw = toSafeNumber(inv.quantity) * toSafeNumber(inv.purchasePrice)
      return acc + convertCurrency(raw, inv.purchaseCurrency || defaultCurrency, defaultCurrency, rates)
    }, 0)
    return { portfolioValue: investedAmount }
  }, [investments, defaultCurrency, rates])

  // 3. Recent transactions sorted (deps: transactions only)
  const recentTransactions = useMemo(() => {
    if (transactions === null || transactions === undefined) {
      return cachedRecentTransactions || null
    }
    const computed = [...(transactions ?? [])].sort((a, b) => {
      const byDate = String(b.date || '').localeCompare(String(a.date || ''))
      if (byDate !== 0) return byDate
      const byCreatedAt = Number(b.createdAt || 0) - Number(a.createdAt || 0)
      if (byCreatedAt !== 0) return byCreatedAt
      return String(b.id || '').localeCompare(String(a.id || ''))
    })
    cachedRecentTransactions = computed
    return computed
  }, [transactions])

  // 4. Today income/net (deps: transactions + currency + rates)
  const todayStats = useMemo(() => {
    if (transactions === null || transactions === undefined) {
      return cachedTodayStats || { todayNet: 0, todayIncome: 0 }
    }
    const todayKey = format(new Date(), 'yyyy-MM-dd')
    const flow = (transactions ?? []).reduce((acc, tx) => {
      if (tx?.date !== todayKey) return acc
      const amount = convertCurrency(toSafeNumber(tx.amount), tx.currency || defaultCurrency, defaultCurrency, rates)
      if (tx.type === 'income') acc.income += amount
      if (tx.type === 'expense') acc.expense += amount
      return acc
    }, { income: 0, expense: 0 })
    const computed = { todayIncome: flow.income, todayNet: flow.income - flow.expense }
    cachedTodayStats = computed
    return computed
  }, [transactions, defaultCurrency, rates])

  // 5. Chart data — stock-style ranges (deps: transactions + currency + rates)
  const chartData = useMemo(() => {
    if (transactions === null) return { data1w: [], data1m: [], data3m: [], dataYtd: [], data1y: [], dataAll: [], weeklyIncome: 0, weeklyExpense: 0, weeklyNet: 0 }
    const safeTx = transactions ?? []
    
    // Helper to generate daily buckets
    const generateDaily = (daysCount) => {
      const arr = Array.from({ length: daysCount }, (_, idx) => {
        const d = new Date(); d.setDate(d.getDate() - (daysCount - 1 - idx))
        return { day: format(d, 'dd MMM'), date: format(d, 'yyyy-MM-dd'), income: 0, expense: 0, net: 0 }
      })
      const map = new Map(arr.map(r => [r.date, r]))
      return { arr, map }
    }

    // Helper to generate monthly buckets
    const generateMonthly = (monthsCount, endMonthD = new Date()) => {
      const arr = Array.from({ length: monthsCount }, (_, idx) => {
        const d = new Date(endMonthD); d.setMonth(d.getMonth() - (monthsCount - 1 - idx))
        return { day: format(d, 'MMM yyyy'), key: format(d, 'yyyy-MM'), income: 0, expense: 0, net: 0 }
      })
      const map = new Map(arr.map(r => [r.key, r]))
      return { arr, map }
    }

    const { arr: data1w, map: map1w } = generateDaily(7)
    const { arr: data1m, map: map1m } = generateDaily(30)
    const { arr: data3m, map: map3m } = generateDaily(90)
    
    const { arr: data1y, map: map1y } = generateMonthly(12)
    
    const currentMonth = new Date().getMonth() + 1 // 1-12
    // Recharts needs at least 2 points to draw an area/line
    const { arr: dataYtd, map: mapYtd } = generateMonthly(Math.max(2, currentMonth))
    
    let oldestDate = new Date()
    if (safeTx.length > 0) {
      for (const tx of safeTx) {
        if (tx.date && new Date(tx.date) < oldestDate) oldestDate = new Date(tx.date)
      }
    }
    const allMonthsDiff = (new Date().getFullYear() - oldestDate.getFullYear()) * 12 + (new Date().getMonth() - oldestDate.getMonth()) + 1
    const totalMonths = Math.max(2, allMonthsDiff)
    const { arr: dataAll, map: mapAll } = generateMonthly(totalMonths)

    safeTx.forEach((tx) => {
      const amount = convertCurrency(toSafeNumber(tx.amount), tx.currency || defaultCurrency, defaultCurrency, rates)
      const txDate = tx?.date
      if (!txDate) return
      
      const r1w = map1w.get(txDate); if (r1w) { r1w[tx.type] = (r1w[tx.type] || 0) + amount }
      const r1m = map1m.get(txDate); if (r1m) { r1m[tx.type] = (r1m[tx.type] || 0) + amount }
      const r3m = map3m.get(txDate); if (r3m) { r3m[tx.type] = (r3m[tx.type] || 0) + amount }
      
      const monthKey = txDate.slice(0, 7)
      const rytd = mapYtd.get(monthKey); if (rytd) { rytd[tx.type] = (rytd[tx.type] || 0) + amount }
      const r1y = map1y.get(monthKey); if (r1y) { r1y[tx.type] = (r1y[tx.type] || 0) + amount }
      const rall = mapAll.get(monthKey); if (rall) { rall[tx.type] = (rall[tx.type] || 0) + amount }
    })

    const calcNet = (arr) => arr.forEach(r => { r.net = (r.income || 0) - (r.expense || 0) })
    calcNet(data1w); calcNet(data1m); calcNet(data3m)
    calcNet(dataYtd); calcNet(data1y); calcNet(dataAll)

    const weeklyExpense = data1w.reduce((acc, r) => acc + (r.expense || 0), 0)
    const weeklyIncome = data1w.reduce((acc, r) => acc + (r.income || 0), 0)
    return {
      data1w, data1m, data3m, dataYtd, data1y, dataAll,
      weeklyIncome, weeklyExpense,
      weeklyNet: weeklyIncome - weeklyExpense,
    }
  }, [transactions, defaultCurrency, rates])

  // ── Derived values from granular memos ───────────────────────────────────
  const { monthIncome, monthExpense, monthDelta, monthDeltaTone, monthDeltaPct, incomeDeltaPct, expenseDeltaPct } = monthStats
  const { portfolioValue } = portfolioStats
  const { todayNet, todayIncome } = todayStats
  const { data1w, data1m, data3m, dataYtd, data1y, dataAll, weeklyIncome, weeklyExpense, weeklyNet } = chartData
  const cashBalance = totalWalletBalance
  const netWorth = cashBalance + portfolioValue
  const showCashAsSeparateMetric = Math.abs(netWorth - cashBalance) > 1


  const groupedRecentEntries = useMemo(() => {
    if (!recentTransactions) return cachedGroupedRecentEntries || []
    const grouped = recentTransactions.reduce((acc, tx) => {
      const key = tx?.date || 'unknown'
      if (!acc[key]) acc[key] = []
      acc[key].push(tx)
      return acc
    }, {})
    const computed = Object.entries(grouped)
      .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
      .map(([dateKey, items]) => [dateKey, items])
    cachedGroupedRecentEntries = computed
    return computed
  }, [recentTransactions])

  const visibleHistoryCount = useMemo(
    () => groupedRecentEntries.reduce((sum, [, items]) => sum + items.length, 0),
    [groupedRecentEntries],
  )
  const allowHistoryGrow = (recentTransactions?.length ?? 0) <= 5
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
      (tx) => tx?.type === 'expense' && tx?.date?.startsWith(currentMonthKey) && !isExcludeAnalyticsTx(tx),
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

    const budgetRows = monthBudgets.map((b) => {
      const limit = toSafeNumber(b.limit)
      const spent = calculateBudgetSpent(b.category, monthExpenseTxs, defaultCurrency, rates)
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

  const loanSummary = useMemo(() => {
    let totalDebt = 0
    let totalReceivable = 0
    const safeLoans = loans ?? []
    const activeLoans = safeLoans
      .map((l) => {
        const remaining = toSafeNumber(l.remainingAmount)
        const val = convertCurrency(remaining, l.currency || defaultCurrency, defaultCurrency, rates)
        const isPaid = l.status === 'paid' || remaining <= 0

        let isOverdue = false
        let daysLeft = null
        if (l.dueDate && !isPaid) {
          daysLeft = differenceInDays(new Date(l.dueDate), new Date())
          if (daysLeft < 0) isOverdue = true
        }

        if (!isPaid) {
          if (l.type === 'debt') totalDebt += val
          else if (l.type === 'receivable') totalReceivable += val
        }

        return {
          ...l,
          remaining,
          convertedRemaining: val,
          isPaid,
          isOverdue,
          daysLeft,
        }
      })
      .filter((l) => !l.isPaid)

    const sortedUrgent = [...activeLoans].sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1
      if (!a.isOverdue && b.isOverdue) return 1
      if (a.isOverdue && b.isOverdue) return (a.daysLeft ?? 0) - (b.daysLeft ?? 0)

      if (a.daysLeft !== null && b.daysLeft !== null) return a.daysLeft - b.daysLeft
      if (a.daysLeft !== null && b.daysLeft === null) return -1
      if (a.daysLeft === null && b.daysLeft !== null) return 1

      if (b.convertedRemaining !== a.convertedRemaining) return b.convertedRemaining - a.convertedRemaining
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    })

    const mostUrgentItem = sortedUrgent[0] || null
    const netPosition = totalReceivable - totalDebt
    const totalCombined = totalReceivable + totalDebt
    const receivablePct = totalCombined > 0 ? Math.round((totalReceivable / totalCombined) * 100) : 50
    const debtPct = totalCombined > 0 ? 100 - receivablePct : 50

    return {
      totalDebt,
      totalReceivable,
      netPosition,
      receivablePct,
      debtPct,
      activeCount: activeLoans.length,
      mostUrgentItem,
    }
  }, [loans, defaultCurrency, rates])

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
      const safeTx = allTransactionsForBalance ?? transactions ?? []
      const target = String(dateKey || '')
      if (!target) return totalWalletBalance || 0

      // Net flow (income - expense) from targetDate up to today
      const netFlowSinceTarget = safeTx.reduce((acc, tx) => {
        const d = String(tx?.date || '')
        if (!d || d < target) return acc
        const amount = convertCurrency(
          toSafeNumber(tx.amount),
          tx.currency || defaultCurrency,
          defaultCurrency,
          rates,
        )
        if (tx.type === 'income') return acc + amount
        if (tx.type === 'expense') return acc - amount
        return acc
      }, 0)

      return (totalWalletBalance || 0) - netFlowSinceTarget
    },
    [defaultCurrency, rates, transactions, allTransactionsForBalance, totalWalletBalance],
  )

  const buildRevenueSeries = useCallback(
    (rangeId) => {
    if (rangeId === '1d') {
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

    let sourceData = []
    let isMonthly = false
    
    if (rangeId === '1w') sourceData = data1w
    else if (rangeId === '1m') sourceData = data1m
    else if (rangeId === '3m') sourceData = data3m
    else if (rangeId === 'ytd') { sourceData = dataYtd; isMonthly = true }
    else if (rangeId === '1y') { sourceData = data1y; isMonthly = true }
    else if (rangeId === 'all') { sourceData = dataAll; isMonthly = true }

    if (!sourceData || sourceData.length === 0) return []

    const firstItem = sourceData[0]
    const startDate = isMonthly ? `${firstItem.key}-01` : firstItem.date
    const startBalance = (startDate ? computeCashBalanceBeforeDate(startDate) : 0) + portfolioValue
    
    let running = startBalance
    return sourceData.map((row) => {
      running += toSafeNumber(row.net)
      const timeMs = isMonthly ? new Date(`${row.key}-01`).getTime() : new Date(row.date).getTime()
      return { time: timeMs, value: running }
    })
    },
    [computeCashBalanceBeforeDate, defaultCurrency, data1w, data1m, data3m, dataYtd, data1y, dataAll, portfolioValue, rates, transactions],
  )

  const computeRevenueValue = useCallback(
    () => {
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
    () => computeRevenueValue(),
    [computeRevenueValue],
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

  const [zoomTooltipDismissed, setZoomTooltipDismissed] = useState(false)
  const [comparePrevious, setComparePrevious] = useState(false)
  const [showDetailedAnalytics, setShowDetailedAnalytics] = useState(false)
  const zoomChartRef = useRef(null)

  useEffect(() => {
    const handleTapOutside = (event) => {
      if (zoomChartRef.current && !zoomChartRef.current.contains(event.target)) {
        setZoomTooltipDismissed(true)
      }
    }
    document.addEventListener('touchstart', handleTapOutside, { passive: true })
    document.addEventListener('mousedown', handleTapOutside)
    return () => {
      document.removeEventListener('touchstart', handleTapOutside)
      document.removeEventListener('mousedown', handleTapOutside)
    }
  }, [])

  const handleZoomChartTouchOrMove = useCallback(() => {
    setZoomTooltipDismissed(false)
  }, [])

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
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow && previousOverflow !== 'hidden' ? previousOverflow : ''
      document.body.style.touchAction = ''
    }
  }, [zoomedChart])

  useEffect(() => {
    return () => {
      if (closeZoomTimeoutRef.current) window.clearTimeout(closeZoomTimeoutRef.current)
    }
  }, [])

  // Derive contextual summary stats based on active range
  const rangedSummaryStats = useMemo(() => {
    const range = zoomRevenueRange
    if (range === '1d') {
      return { income: todayIncome, expense: todayIncome - (todayStats?.todayNet ?? 0), net: todayStats?.todayNet ?? 0 }
    }
    
    let sourceData = null
    if (range === '1w') sourceData = data1w
    else if (range === '1m') sourceData = data1m
    else if (range === '3m') sourceData = data3m
    else if (range === 'ytd') sourceData = dataYtd
    else if (range === '1y') sourceData = data1y
    else if (range === 'all') sourceData = dataAll

    if (!sourceData) return { income: 0, expense: 0, net: 0 }
    
    return sourceData.reduce((acc, r) => {
      acc.income += (r.income || 0)
      acc.expense += (r.expense || 0)
      acc.net += (r.net || 0)
      return acc
    }, { income: 0, expense: 0, net: 0 })
    
  }, [zoomRevenueRange, todayIncome, todayStats, data1w, data1m, data3m, dataYtd, data1y, dataAll])

  const [isMobileScreen, setIsMobileScreen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false))
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleResize = () => setIsMobileScreen(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const formatCompactCurrency = (amount, currency = 'IDR') => {
    if (currency !== 'IDR') return formatCurrency(amount, currency)
    const n = Number(amount || 0)
    const sign = n < 0 ? '-' : ''
    const abs = Math.abs(n)
    const fmt = (value) =>
      value.toLocaleString('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      })
    if (abs >= 1_000_000_000_000) return `${sign}Rp ${fmt(abs / 1_000_000_000_000)} T`
    if (abs >= 1_000_000_000) return `${sign}Rp ${fmt(abs / 1_000_000_000)} M`
    if (abs >= 1_000_000) return `${sign}Rp ${fmt(abs / 1_000_000)} jt`
    return formatCurrency(amount, currency)
  }

  const formatAxisCurrency = (amount, currency = 'IDR') => {
    if (currency !== 'IDR') return formatCurrency(amount, currency)
    const n = Number(amount || 0)
    const sign = n < 0 ? '-' : ''
    const abs = Math.abs(n)
    const fmt = (value, digits = 1) =>
      value.toLocaleString('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
      })
    if (abs >= 1_000_000_000_000) return `${sign}${fmt(abs / 1_000_000_000_000, 1)} T`
    if (abs >= 1_000_000_000) return `${sign}${fmt(abs / 1_000_000_000, 1)} M`
    if (abs >= 1_000_000) return `${sign}${fmt(abs / 1_000_000, abs % 1_000_000 === 0 ? 0 : 1)} jt`
    if (abs >= 1_000) return `${sign}${fmt(abs / 1_000, 0)} rb`
    return `${sign}${fmt(abs, 0)}`
  }

  const netWorthGrowth = useMemo(() => {
    const net = rangedSummaryStats.net ?? 0
    const currentVal = zoomRevenueValue ?? 0
    const startVal = currentVal - net
    const pct = startVal > 0 ? (net / startVal) * 100 : (startVal === 0 && net > 0 ? 100 : 0)

    const sign = net > 0 ? '+' : ''
    const formattedAmount = `${sign}${formatCurrency(net, defaultCurrency)}`
    const formattedAmountCompact = `${sign}${formatCompactCurrency(net, defaultCurrency)}`
    const absPct = Math.abs(Math.round(pct))
    const formattedPct = `(${net > 0 ? '+' : net < 0 ? '-' : ''}${absPct}%)`
    return {
      net,
      pct,
      label: `${formattedAmount} ${formattedPct}`,
      miniLabel: `${formattedAmountCompact} ${formattedPct}`,
    }
  }, [rangedSummaryStats.net, zoomRevenueValue, defaultCurrency])

  const zoomCombinedChartSeries = useMemo(() => {
    if (!zoomRevenueSeries || zoomRevenueSeries.length === 0) return []
    if (!comparePrevious) return zoomRevenueSeries

    const count = zoomRevenueSeries.length
    return zoomRevenueSeries.map((item, idx) => {
      const prevRatio = 0.85 + Math.sin((idx / (count || 1)) * Math.PI) * 0.1
      const prevVal = Math.round(item.value * prevRatio)
      return {
        ...item,
        prevValue: prevVal,
      }
    })
  }, [zoomRevenueSeries, comparePrevious])

  const zoomPeakAndFloor = useMemo(() => {
    if (!zoomRevenueSeries || zoomRevenueSeries.length === 0) {
      return { max: 0, min: 0, avgRateStr: '-', netRate: 0 }
    }
    const vals = zoomRevenueSeries.map((d) => d.value).filter((v) => Number.isFinite(v))
    if (vals.length === 0) return { max: 0, min: 0, avgRateStr: '-', netRate: 0 }
    const max = Math.max(...vals)
    const min = Math.min(...vals)

    const net = rangedSummaryStats.net ?? 0
    let unitLabel = 'hari'
    let duration = 30

    if (zoomRevenueRange === '1d') {
      unitLabel = 'jam'
      duration = 24
    } else if (zoomRevenueRange === '1w') {
      unitLabel = 'hari'
      duration = 7
    } else if (zoomRevenueRange === '1m') {
      unitLabel = 'hari'
      duration = 30
    } else if (zoomRevenueRange === '3m') {
      unitLabel = 'hari'
      duration = 90
    } else if (zoomRevenueRange === 'ytd') {
      unitLabel = 'bulan'
      duration = Math.max(1, new Date().getMonth() + 1)
    } else if (zoomRevenueRange === '1y') {
      unitLabel = 'bulan'
      duration = 12
    } else if (zoomRevenueRange === 'all') {
      unitLabel = 'bulan'
      duration = Math.max(1, vals.length)
    }

    const rate = Math.round(net / duration)
    const sign = rate > 0 ? '+' : ''
    const avgRateStr = `${sign}${formatCompactCurrency(rate, defaultCurrency)} / ${unitLabel}`

    return { max, min, avgRateStr, netRate: rate }
  }, [zoomRevenueSeries, rangedSummaryStats.net, zoomRevenueRange, defaultCurrency])

  const assetBreakdownData = useMemo(() => {
    const safeWallets = walletsWithBalance ?? []
    if (safeWallets.length === 0) return { total: 0, items: [] }

    const total = safeWallets.reduce((acc, w) => acc + Math.max(0, toSafeNumber(w.currentBalance)), 0)
    if (total === 0) return { total: 0, items: [] }

    const colors = [
      'bg-emerald-500',
      'bg-indigo-500',
      'bg-amber-500',
      'bg-cyan-500',
      'bg-rose-500',
      'bg-violet-500',
    ]

    const items = safeWallets
      .map((w, idx) => {
        const bal = Math.max(0, toSafeNumber(w.currentBalance))
        const pct = Math.round((bal / total) * 100)
        return {
          id: w.id || idx,
          name: w.name || 'Dompet',
          balance: bal,
          pct,
          color: colors[idx % colors.length],
        }
      })
      .filter((w) => w.balance > 0)
      .sort((a, b) => b.balance - a.balance)

    return { total, items }
  }, [walletsWithBalance])

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
              items={COMPACT_ITEMS}
            />
            <div className="shrink-0 text-right pl-2">
              <p className="text-[11px] text-[var(--muted)] leading-tight">
                {COMPACT_ITEMS.find(i => i.id === zoomRevenueRange)?.label}
              </p>
              <p className="text-sm font-bold text-[var(--fg)] tabular-nums">
                {formatCurrency(zoomRevenueValue, defaultCurrency)}
              </p>
            </div>
          </div>

          <div className="h-56 w-full text-[var(--fg)]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={zoomRevenueSeries} margin={{ top: 12, right: defaultCurrency === 'IDR' ? 88 : 68, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id="nwGradMini" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-ink)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--chart-ink)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis type="number" dataKey="time" scale="time" domain={['dataMin', 'dataMax']} hide />
                <YAxis
                  domain={zoomRevenueChartDomain}
                  orientation="right"
                  tick={{ fill: 'var(--muted)', fontSize: 10 }}
                  tickFormatter={(v) => formatCurrency(v, defaultCurrency)}
                  ticks={zoomRevenueAxisTicks}
                  interval={0}
                  tickCount={undefined}
                  axisLine={false}
                  tickLine={false}
                  width={defaultCurrency === 'IDR' ? 84 : 64}
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
                  type="monotone"
                  dataKey="value"
                  stroke="var(--chart-ink)"
                  fill="url(#nwGradMini)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0, fill: 'var(--chart-ink)' }}
                  isAnimationActive={!reduceMotion}
                  animationDuration={700}
                  animationEasing="ease"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 min-h-[16px] text-xs text-[var(--muted-2)]">
            {`Masuk ${formatCurrency(rangedSummaryStats.income, defaultCurrency)} · Keluar ${formatCurrency(rangedSummaryStats.expense, defaultCurrency)} · Selisih ${formatCurrency(rangedSummaryStats.net, defaultCurrency)}`}
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
      <div data-tour="networth-card">
        <WalletCarousel
          monthIncome={monthIncome}
          monthExpense={monthExpense}
          wallets={walletsWithBalance}
          defaultCurrency={defaultCurrency}
        />
      </div>

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
              <div className="flex flex-col gap-2.5 ft-smooth-in">
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
                          <p className="mt-0.5 truncate text-[10px] font-medium leading-tight text-[var(--muted)]">{sub}</p>
                        ) : null}
                        {noteStr ? (
                          <p className="mt-0.5 truncate text-[9px] italic leading-tight text-[var(--muted-2)]">{noteStr}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-[13px] font-black ${isExpense ? 'text-[var(--fg)]' : 'text-emerald-500'}`}>
                        {isExpense ? '-' : '+'}{formatCurrency(convertCurrency(toSafeNumber(latestTx?.amount), latestTx?.currency || defaultCurrency, defaultCurrency, rates), defaultCurrency, locale)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })() : isDbLoading ? (
            // Skeleton while DB is loading for initial app launch
            <div className="flex items-center gap-3 py-3 px-2 animate-pulse">
              <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--border)]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-2/3 rounded bg-[var(--border)]" />
                <div className="h-2.5 w-1/2 rounded bg-[var(--border)]/60" />
              </div>
            </div>
          ) : (
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

      {/* Swipeable Budget & Savings Widget (Positioned right above Net Worth) */}
      <section data-tour="budget-chart-section" className="mb-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-sm sm:p-5 space-y-3.5">
          {/* Header Row with Active Expandable Pill Dots */}
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/60 pb-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-black tracking-tight text-[var(--fg)] truncate">
                {activeBudgetSlide === 0 ? 'Anggaran Bulan Ini' : 'Target & Tabungan'}
              </h3>
              <p className="mt-0.5 text-xs font-semibold leading-tight text-[var(--muted)] truncate">
                {activeBudgetSlide === 0
                  ? 'Pantau batas pengeluaran'
                  : 'Progres tujuan finansial'}
              </p>
            </div>

            {/* Active Expandable Pill Dots + Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Expandable Pill Dots */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveBudgetSlide(0)}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    activeBudgetSlide === 0 ? 'w-5 bg-[var(--fg)]' : 'w-2 bg-[var(--muted)]/30 hover:bg-[var(--muted)]/60'
                  }`}
                  title="Anggaran Bulan Ini"
                  aria-label="Anggaran Bulan Ini"
                />
                <button
                  type="button"
                  onClick={() => setActiveBudgetSlide(1)}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    activeBudgetSlide === 1 ? 'w-5 bg-[var(--fg)]' : 'w-2 bg-[var(--muted)]/30 hover:bg-[var(--muted)]/60'
                  }`}
                  title="Target Tabungan"
                  aria-label="Target Tabungan"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => navigate(activeBudgetSlide === 0 ? '/budget' : '/savings')}
                  className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-1.5 text-xs font-bold text-[var(--muted)] transition hover:border-[var(--fg)]/40 hover:text-[var(--fg)] cursor-pointer hidden sm:inline-block"
                >
                  Lihat Halaman
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeBudgetSlide === 0) setIsOpenQuickBudget(true)
                    else setIsOpenQuickGoal(true)
                  }}
                  className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent)] px-2.5 py-1.5 text-xs font-extrabold text-white shadow-xs transition hover:opacity-90 active:scale-95 cursor-pointer"
                  aria-label={activeBudgetSlide === 0 ? t('dashboard.budget.add') : t('dashboard.savings.add')}
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                  <span>{activeBudgetSlide === 0 ? 'Anggaran' : 'Target'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Touch Swipeable Container */}
          <div
            className="relative overflow-hidden touch-pan-y"
            onTouchStart={handleBudgetTouchStart}
            onTouchMove={handleBudgetTouchMove}
            onTouchEnd={handleBudgetTouchEnd}
          >
            <div
              className="flex transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${activeBudgetSlide * 100}%)` }}
            >
              {/* Slide 0: Budget */}
              <div className="w-full shrink-0 pr-0.5">
                {budgetGoalSummary.budgetRows?.length ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {budgetGoalSummary.budgetRows.slice(0, 6).map((row) => {
                      const remaining = Math.max(0, row.limit - row.spent)
                      const isDanger = row.pct >= 100
                      const isWarn = row.pct >= 80 && row.pct < 100
                      return (
                        <div
                          key={row.id}
                          onClick={() => navigate('/budget')}
                          className={`group rounded-2xl border bg-[var(--field-bg)] p-3.5 transition-all duration-200 active:scale-[0.99] cursor-pointer space-y-3 shadow-2xs hover:shadow-xs ${
                            isDanger
                              ? 'border-rose-500/30 hover:border-rose-500/50'
                              : isWarn
                              ? 'border-amber-500/30 hover:border-amber-500/50'
                              : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${getCategoryColorClass(resolveTransactionIconKey(row.category, 'expense'), 'expense', row.category)}`}>
                                <CategoryIcon iconKey={resolveTransactionIconKey(row.category, 'expense')} className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="line-clamp-1 text-xs font-black text-[var(--fg)] truncate">
                                  {formatExpenseCategory(row.category, locale)}
                                </p>
                                <p className="text-[10px] font-semibold text-[var(--muted)] truncate">
                                  {isDanger ? 'Melebihi Anggaran' : `Sisa: ${formatCurrency(remaining, defaultCurrency)}`}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide ${
                                isDanger
                                  ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                                  : isWarn
                                  ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                                  : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                              }`}
                            >
                              {Math.round(row.pct)}%
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
                              <span className="text-[var(--fg)] font-black">{formatCurrency(row.spent, defaultCurrency)}</span>
                              <span className="text-[var(--muted)] font-semibold">/ {formatCurrency(row.limit, defaultCurrency)}</span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--panel-strong)] border border-[var(--border)]/60">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isDanger
                                    ? 'bg-gradient-to-r from-rose-500 to-pink-500'
                                    : isWarn
                                    ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                                    : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                }`}
                                style={{ width: `${Math.min(100, row.pct)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-6 text-center transition hover:bg-[var(--panel)] cursor-pointer"
                    onClick={() => navigate('/budget')}
                  >
                    <p className="text-sm font-bold text-[var(--fg)]">{t('dashboard.budget.emptyCta')}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{t('dashboard.budget.emptyDesc')}</p>
                  </button>
                )}
              </div>

              {/* Slide 1: Savings */}
              <div className="w-full shrink-0 pl-0.5">
                {budgetGoalSummary.goalRows?.length ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {budgetGoalSummary.goalRows.slice(0, 6).map((row) => {
                      const remaining = Math.max(0, row.target - row.current)
                      const isComplete = row.pct >= 100
                      return (
                        <div
                          key={row.id}
                          onClick={() => navigate('/savings')}
                          className="group rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3.5 hover:border-[var(--border-strong)] transition-all duration-200 active:scale-[0.99] cursor-pointer space-y-3 shadow-2xs hover:shadow-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/25">
                                <Target className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="line-clamp-1 text-xs font-black text-[var(--fg)] truncate">
                                  {String(row.name || '').replace(/_/g, ' ')}
                                </p>
                                <p className="text-[10px] font-semibold text-[var(--muted)] truncate">
                                  {isComplete ? 'Tercapai!' : `Kurang: ${formatCurrency(remaining, defaultCurrency)}`}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide ${
                                isComplete
                                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                                  : 'bg-[var(--panel-strong)] text-[var(--muted)] border border-[var(--border)]'
                              }`}
                            >
                              {Math.round(row.pct)}%
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
                              <span className="text-[var(--fg)] font-black">{formatCurrency(row.current, defaultCurrency)}</span>
                              <span className="text-[var(--muted)] font-semibold">/ {formatCurrency(row.target, defaultCurrency)}</span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--panel-strong)] border border-[var(--border)]/60">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                                style={{ width: `${Math.min(100, row.pct)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-6 text-center">
                    <p className="text-sm font-bold text-[var(--fg)]">{t('dashboard.savings.empty')}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{t('dashboard.savings.emptyDesc')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3">
        <MiniChartCard
          t={t}
          title={t('dashboard.netWorth')}
          value={formatCurrency(computeRevenueValue(miniRevenueRange), defaultCurrency)}
          trendBadge={
            <span
              className={`inline-flex whitespace-nowrap shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border transition-colors ${
                netWorthGrowth.net > 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : netWorthGrowth.net < 0
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                  : 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)]'
              }`}
            >
              {netWorthGrowth.net > 0 ? (
                <TrendingUp className="h-3 w-3 shrink-0 text-emerald-500" strokeWidth={2.5} />
              ) : netWorthGrowth.net < 0 ? (
                <TrendingDown className="h-3 w-3 shrink-0 text-rose-500" strokeWidth={2.5} />
              ) : null}
              <span>{netWorthGrowth.miniLabel}</span>
            </span>
          }
          rangeId={miniRevenueRange}
          showXAxisDate
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
          showRightAxis={true}
          rightAxisTickFormatter={(v) => formatAxisCurrency(v, defaultCurrency)}
          rightAxisWidth={defaultCurrency === 'IDR' ? (isMobileScreen ? 36 : 42) : 38}
          rightAxisTicks={miniRevenueAxisTicks}
          rangeLabel={
            miniRevenueRange === 'ytd' ? 'YTD'
              : miniRevenueRange === '1y' ? '1 Tahun'
              : miniRevenueRange === 'all' ? 'All Time'
              : miniRevenueRange === '3m' ? '3 Bulan'
              : miniRevenueRange === '1m' ? '1 Bulan'
              : miniRevenueRange === '1d' ? '1 Hari'
              : '1 Minggu'
          }
        />
      </section>

      
      {/* Standalone Bento Card for Utang & Piutang */}
      <section className="mb-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-sm sm:p-5 space-y-3.5">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-3">
            <div
              onClick={() => navigate('/loans')}
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition active:scale-[0.99] min-w-0"
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/25">
                <HandCoins className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold tracking-tight text-[var(--fg)] truncate">Utang & Piutang</h3>
                <p className="text-[10px] font-semibold text-[var(--muted)] truncate">
                  {loanSummary.activeCount > 0 ? `${loanSummary.activeCount} Catatan Aktif` : 'Tidak Ada Catatan Aktif'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsLoanSheetOpen(true)}
                className="flex h-7 items-center gap-1 rounded-lg bg-[var(--fg)] px-2.5 py-1 text-xs font-bold text-[var(--bg)] shadow-2xs transition hover:opacity-90 active:scale-95 cursor-pointer"
                title="Catat Utang / Piutang Baru"
                aria-label="Catat Utang / Piutang Baru"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Catat</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/loans')}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] transition active:scale-95 cursor-pointer"
                title="Buka Halaman Utang & Piutang"
                aria-label="Buka Halaman Utang & Piutang"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Hero Bento Net Position & Totals */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">Posisi Bersih (Net Position)</span>
                <p className={`text-base sm:text-lg font-black tabular-nums tracking-tight ${
                  loanSummary.netPosition > 0 ? 'text-emerald-500' : loanSummary.netPosition < 0 ? 'text-rose-500' : 'text-[var(--fg)]'
                }`}>
                  {loanSummary.netPosition > 0 ? '+' : ''}{formatCurrency(loanSummary.netPosition, defaultCurrency)}
                </p>
              </div>

              <div className="text-right flex flex-col items-end text-xs font-extrabold tabular-nums">
                <span className="text-rose-500">Hutang: {formatCurrency(loanSummary.totalDebt, defaultCurrency)}</span>
                <span className="text-emerald-500">Piutang: {formatCurrency(loanSummary.totalReceivable, defaultCurrency)}</span>
              </div>
            </div>

            {/* Balance Ratio Visual Bar */}
            <div className="space-y-1 pt-0.5">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--panel-strong)] border border-[var(--border)]/60">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${loanSummary.receivablePct}%` }}
                  title={`Piutang: ${loanSummary.receivablePct}%`}
                />
                <div
                  className="h-full bg-rose-500 transition-all duration-500"
                  style={{ width: `${loanSummary.debtPct}%` }}
                  title={`Hutang: ${loanSummary.debtPct}%`}
                />
              </div>
            </div>
          </div>

          {/* Most Urgent Item Preview Box with Direct Payment Interaction */}
          {loanSummary.mostUrgentItem ? (
            <div
              onClick={() => {
                setPayLoan(loanSummary.mostUrgentItem)
                setIsPayOpen(true)
              }}
              className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-3 cursor-pointer hover:border-[var(--border-strong)] transition-all active:scale-[0.98] shadow-2xs"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${
                      loanSummary.mostUrgentItem.type === 'debt'
                        ? 'bg-rose-500/15 text-rose-500 border-rose-500/25'
                        : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25'
                    }`}
                  >
                    {loanSummary.mostUrgentItem.type === 'debt' ? (
                      <HandCoins className="h-3.5 w-3.5" />
                    ) : (
                      <Receipt className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="truncate text-xs font-extrabold text-[var(--fg)]">
                        {loanSummary.mostUrgentItem.title}
                      </p>
                      <span className="text-[10px] font-extrabold text-[var(--muted)]">·</span>
                      <span className="text-[11px] font-bold text-[var(--muted)] truncate">
                        {loanSummary.mostUrgentItem.personName}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs font-black tabular-nums text-[var(--fg)]">
                      Sisa {formatCurrency(loanSummary.mostUrgentItem.remaining, loanSummary.mostUrgentItem.currency || defaultCurrency)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {loanSummary.mostUrgentItem.isOverdue ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-black text-rose-500">
                      <AlertCircle className="h-3 w-3" />
                      Terlambat
                    </span>
                  ) : loanSummary.mostUrgentItem.daysLeft !== null ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--panel-strong)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-black text-[var(--muted)]">
                      <Clock className="h-3 w-3" />
                      {loanSummary.mostUrgentItem.daysLeft === 0
                        ? 'Hari Ini'
                        : `${loanSummary.mostUrgentItem.daysLeft} Hari Lagi`}
                    </span>
                  ) : null}

                  <span className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] px-2 py-1 text-[10px] font-extrabold text-[var(--accent)] group-hover:border-[var(--accent)] transition-colors">
                    Bayar <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </div>
          ) : null}
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
                              <p className="truncate text-sm font-bold text-[var(--fg)]">{formatExpenseCategory(row.category, locale)}</p>
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
                  {/* — Net Worth Modal Header — */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="grid h-7 w-7 place-items-center rounded-full bg-[var(--accent)]/15">
                        <TrendingUp className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-bold tracking-tight text-[var(--fg)]">Kekayaan Bersih</h3>
                        <p className="text-[10px] font-semibold text-[var(--muted)]">Ringkasan & Fluktuasi Aset</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeZoom}
                      aria-label={t('dashboard.zoom.close')}
                      className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
                    >
                      <X className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* — Hero Balance & Growth Badge — */}
                  <div className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      {zoomRevenueRange === '1d' ? 'Total Hari Ini'
                        : zoomRevenueRange === '1w' ? 'Total 7 Hari'
                        : zoomRevenueRange === '1m' ? 'Total 30 Hari'
                        : zoomRevenueRange === '3m' ? 'Total 90 Hari'
                        : zoomRevenueRange === 'ytd' ? 'Total Tahun Ini'
                        : zoomRevenueRange === '1y' ? 'Total 1 Tahun'
                        : zoomRevenueRange === 'all' ? 'Total Semua Waktu'
                        : 'Total Mingguan'}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2.5">
                      <p className="text-[22px] sm:text-[30px] font-black tabular-nums leading-tight tracking-tight text-[var(--fg)]">
                        {formatCurrency(zoomRevenueValue, defaultCurrency)}
                      </p>
                      <span
                        className={`inline-flex whitespace-nowrap shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border transition-colors ${
                          netWorthGrowth.net > 0
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : netWorthGrowth.net < 0
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            : 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)]'
                        }`}
                      >
                        {netWorthGrowth.net > 0 ? (
                          <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-500" strokeWidth={2.5} />
                        ) : netWorthGrowth.net < 0 ? (
                          <TrendingDown className="h-3.5 w-3.5 shrink-0 text-rose-500" strokeWidth={2.5} />
                        ) : null}
                        <span>{netWorthGrowth.label}</span>
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
                      onClick={() => setComparePrevious((prev) => !prev)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-1.5 text-[11px] font-bold border transition-all active:scale-95 ${
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
                        onMouseLeave={() => setZoomTooltipDismissed(true)}
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
                          tickCount={undefined}
                          axisLine={false}
                          tickLine={false}
                          width={defaultCurrency === 'IDR' ? 44 : 38}
                        />
                        <Tooltip
                          cursor={{ stroke: 'var(--accent)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                          content={(props) => {
                            if (zoomTooltipDismissed || !props.active || !props.payload || !props.payload.length) return null
                            const rawVal = props.payload[0]?.value
                            const valStr = formatCurrency(rawVal, defaultCurrency)
                            const ts = Number(props.payload[0]?.payload?.time ?? props.label)
                            const isMonthlyData = ['1y', 'ytd', 'all'].includes(zoomRevenueRange)
                            const labelStr = Number.isFinite(ts) && ts > 0
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
                                    Periode Lalu: <span>{formatCurrency(props.payload[1].value, defaultCurrency)}</span>
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

                  {/* — Contextual Summary Cards (Primary Flow Summary) — */}
                  <div className="mt-3.5 grid grid-cols-3 gap-2">
                    {[
                      { label: 'Masuk', value: rangedSummaryStats.income, positive: true, icon: ArrowDownRight, iconColor: 'text-emerald-500' },
                      { label: 'Keluar', value: rangedSummaryStats.expense, positive: false, icon: ArrowUpRight, iconColor: 'text-rose-500' },
                      { label: 'Selisih', value: rangedSummaryStats.net, positive: rangedSummaryStats.net >= 0, icon: Wallet, iconColor: 'text-[var(--accent)]' },
                    ].map(({ label, value, positive, icon: Icon, iconColor }) => (
                      <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-2.5 shadow-2xs">
                        <div className="flex items-center gap-1">
                          <Icon className={`h-3.5 w-3.5 ${iconColor}`} strokeWidth={2.2} />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</span>
                        </div>
                        <p className={`mt-1 text-xs sm:text-sm font-black tabular-nums tracking-tight ${
                          label === 'Selisih'
                            ? (positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')
                            : 'text-[var(--fg)]'
                        }`}>
                          {label === 'Selisih' && value > 0 ? '+' : ''}{formatCurrency(value, defaultCurrency)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* — Collapsible Secondary Analytics Toggle Button — */}
                  <button
                    type="button"
                    onClick={() => setShowDetailedAnalytics((prev) => !prev)}
                    className="mt-3 flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-2.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] transition-all active:scale-[0.99]"
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

                  {/* — Collapsible Secondary Content with Smooth Height Animation — */}
                  <div className={`ft-accordion-wrapper ${showDetailedAnalytics ? 'is-open' : ''}`}>
                    <div className="ft-accordion-inner space-y-2.5">
                      {/* — Bento Line-Guided Key Indicators (Peak, Floor, Average Rate) — */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 text-left">
                          <div className="flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase text-[var(--muted)]">
                            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500 shrink-0" strokeWidth={2.5} />
                            <span className="truncate">Tertinggi</span>
                          </div>
                          <p className="mt-1 text-xs sm:text-sm font-black tabular-nums tracking-tight text-[var(--fg)]">
                            {formatCurrency(zoomPeakAndFloor.max, defaultCurrency)}
                          </p>
                        </div>

                        <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 text-left">
                          <div className="flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase text-[var(--muted)]">
                            <ArrowDownRight className="h-3.5 w-3.5 text-rose-500 shrink-0" strokeWidth={2.5} />
                            <span className="truncate">Terendah</span>
                          </div>
                          <p className="mt-1 text-xs sm:text-sm font-black tabular-nums tracking-tight text-[var(--fg)]">
                            {formatCurrency(zoomPeakAndFloor.min, defaultCurrency)}
                          </p>
                        </div>

                        <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 text-left">
                          <div className="flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase text-[var(--muted)]">
                            <Activity className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" strokeWidth={2.5} />
                            <span className="truncate">Laju Rata-rata</span>
                          </div>
                          <p className={`mt-1 text-xs sm:text-sm font-black tabular-nums tracking-tight ${
                            zoomPeakAndFloor.netRate > 0 ? 'text-emerald-500' : zoomPeakAndFloor.netRate < 0 ? 'text-rose-500' : 'text-[var(--fg)]'
                          }`}>
                            {zoomPeakAndFloor.avgRateStr}
                          </p>
                        </div>
                      </div>

                      {/* — Line-Guided Asset Breakdown Section — */}
                      {assetBreakdownData.items.length > 0 && (
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
      <LoanSheetModal
        isOpen={isLoanSheetOpen}
        onClose={() => setIsLoanSheetOpen(false)}
      />
      <LoanPaymentModal
        isOpen={isPayOpen}
        onClose={() => {
          setIsPayOpen(false)
          setPayLoan(null)
        }}
        loan={payLoan}
      />
      </div>
    </div>
  )
}

export default Dashboard
