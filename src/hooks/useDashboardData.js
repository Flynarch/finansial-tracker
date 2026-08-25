import { useState, useEffect, useMemo, useCallback } from 'react'
import { format, startOfMonth, subMonths, subDays, differenceInDays } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, computeAllWalletBalances } from '../lib/db'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import { convertCurrency, FALLBACK_EXCHANGE_RATES, isExcludeAnalyticsTx, toSafeNumber } from '../lib/utils'
import useTranslation from './useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import { calculateGlobalWeeklyTrend } from '../lib/habitStats'
import {
  buildNiceTicksForDomain,
  buildPaddedDomain,
} from '../components/dashboard/DashboardChartHelpers'

export const getCompactItems = (locale = 'id') => [
  { id: '1d', label: locale === 'en' ? '1D' : '1H' },
  { id: '1w', label: locale === 'en' ? '1W' : '1M' },
  { id: '1m', label: locale === 'en' ? '1M' : '1B' },
  { id: '3m', label: locale === 'en' ? '3M' : '3B' },
  { id: 'ytd', label: 'YTD' },
  { id: '1y', label: locale === 'en' ? '1Y' : '1T' },
  { id: 'all', label: locale === 'en' ? 'ALL' : 'SEMUA' },
]

export const COMPACT_ITEMS = getCompactItems('id')

export const getSavedNetWorthRange = () => {
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

// Module-level in-memory cache to eliminate skeleton flash and layout jump on tab switching
const cachedDashboardState = {
  transactions: null,
  investments: null,
  budgets: null,
  goals: null,
  loans: null,
  allTransactionsForBalance: null,
  wallets: null,
  rawHabitLogs: null,
  rawHabits: null,
}

export function useDashboardData() {
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const { t, locale } = useTranslation()

  const [rates, setRates] = useState(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES })
  const currentMonthKey = format(new Date(), 'yyyy-MM')
  const currentMonthLabel = format(new Date(), 'MMM yyyy', {
    locale: locale === 'en' ? enUS : idLocale,
  })

  const txCutoffDate = format(startOfMonth(subMonths(new Date(), 12)), 'yyyy-MM-dd')
  const transactions = useLiveQuery(
    () => db.transactions.where('date').aboveOrEqual(txCutoffDate).toArray(),
    [txCutoffDate],
    cachedDashboardState.transactions,
  )
  const investments = useLiveQuery(() => db.investments.toArray(), [], cachedDashboardState.investments)
  const budgets = useLiveQuery(() => db.budgets.toArray(), [], cachedDashboardState.budgets)
  const goals = useLiveQuery(() => db.goals.toArray(), [], cachedDashboardState.goals)
  const loans = useLiveQuery(() => db.loans.toArray(), [], cachedDashboardState.loans)
  const allTransactionsForBalance = useLiveQuery(() => db.transactions.toArray(), [], cachedDashboardState.allTransactionsForBalance)
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], cachedDashboardState.wallets)
  const rawHabitLogs = useLiveQuery(() => db.habitLogs.toArray(), [], cachedDashboardState.rawHabitLogs)
  const rawHabits = useLiveQuery(() => db.habits.toArray(), [], cachedDashboardState.rawHabits)

  // Keep in-memory cache updated whenever live query results resolve
  useEffect(() => {
    if (transactions !== null) cachedDashboardState.transactions = transactions
    if (investments !== null) cachedDashboardState.investments = investments
    if (budgets !== null) cachedDashboardState.budgets = budgets
    if (goals !== null) cachedDashboardState.goals = goals
    if (loans !== null) cachedDashboardState.loans = loans
    if (allTransactionsForBalance !== null) cachedDashboardState.allTransactionsForBalance = allTransactionsForBalance
    if (wallets !== null) cachedDashboardState.wallets = wallets
    if (rawHabitLogs !== null && rawHabitLogs !== undefined) cachedDashboardState.rawHabitLogs = rawHabitLogs
    if (rawHabits !== null && rawHabits !== undefined) cachedDashboardState.rawHabits = rawHabits
  }, [transactions, investments, budgets, goals, loans, allTransactionsForBalance, wallets, rawHabitLogs, rawHabits])

  const allHabitLogs = useMemo(() => rawHabitLogs || [], [rawHabitLogs])
  const allHabits = useMemo(() => rawHabits || [], [rawHabits])

  const isDbLoading = transactions === null || wallets === null || allTransactionsForBalance === null

  const [zoomRevenueRange, setZoomRevenueRangeState] = useState(() => getSavedNetWorthRange())
  const [miniRevenueRange, setMiniRevenueRangeState] = useState(() => getSavedNetWorthRange())
  const [isCoarsePointer, setIsCoarsePointer] = useState(false)
  const [comparePrevious, setComparePrevious] = useState(false)
  const [showDetailedAnalytics, setShowDetailedAnalytics] = useState(false)
  const [zoomTooltipDismissed, setZoomTooltipDismissed] = useState(false)

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

  const setZoomRevenueRange = useCallback((range) => {
    setZoomTooltipDismissed(true)
    setZoomRevenueRangeState(range)
    setMiniRevenueRangeState(range)
    try {
      localStorage.setItem('ft_networth_range', range)
    } catch {
      /* ignore storage errors */
    }
  }, [])

  const setMiniRevenueRange = useCallback((range) => {
    setZoomTooltipDismissed(true)
    setMiniRevenueRangeState(range)
    setZoomRevenueRangeState(range)
    try {
      localStorage.setItem('ft_networth_range', range)
    } catch {
      /* ignore storage errors */
    }
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

  const walletsWithBalance = useMemo(() => {
    if (wallets === null || wallets === undefined || allTransactionsForBalance === null || allTransactionsForBalance === undefined) {
      return undefined
    }
    if (!wallets) {
      return []
    }
    return computeAllWalletBalances(wallets, allTransactionsForBalance, rates)
  }, [wallets, allTransactionsForBalance, rates])

  const totalWalletBalance = useMemo(() => {
    if (walletsWithBalance === undefined || walletsWithBalance === null) {
      return 0
    }
    return walletsWithBalance.reduce((s, w) => {
      const converted = convertCurrency(
        w.currentBalance || 0,
        w.currency || defaultCurrency,
        defaultCurrency,
        rates,
      )
      return s + converted
    }, 0)
  }, [walletsWithBalance, defaultCurrency, rates])

  const normalizedTransactions = useMemo(() => {
    if (!transactions) return []
    return transactions.map((tx) => {
      const amount = convertCurrency(toSafeNumber(tx.amount), tx.currency || defaultCurrency, defaultCurrency, rates)
      return {
        ...tx,
        convertedAmount: amount,
      }
    })
  }, [transactions, defaultCurrency, rates])

  const normalizedAllTransactionsForBalance = useMemo(() => {
    if (!allTransactionsForBalance) return []
    return allTransactionsForBalance.map((tx) => {
      const amount = convertCurrency(toSafeNumber(tx.amount), tx.currency || defaultCurrency, defaultCurrency, rates)
      return {
        ...tx,
        convertedAmount: amount,
      }
    })
  }, [allTransactionsForBalance, defaultCurrency, rates])

  const monthStats = useMemo(() => {
    if (transactions === null || investments === null) {
      return {
        monthIncome: 0,
        monthExpense: 0,
        monthDelta: 0,
        monthDeltaTone: 'success',
        monthDeltaPct: 0,
        incomeDeltaPct: 0,
        expenseDeltaPct: 0,
      }
    }
    const safeTx = normalizedTransactions
    const lastMonthKey = format(subMonths(new Date(), 1), 'yyyy-MM')

    const lastMonth = safeTx.reduce(
      (acc, tx) => {
        if (!tx?.date?.startsWith(lastMonthKey)) return acc
        if (isExcludeAnalyticsTx(tx)) return acc
        const amount = tx.convertedAmount || 0
        if (tx.type === 'income') acc.income += amount
        if (tx.type === 'expense') acc.expense += amount
        return acc
      },
      { income: 0, expense: 0 },
    )

    const thisMonth = safeTx.reduce(
      (acc, tx) => {
        if (!tx?.date?.startsWith(currentMonthKey)) return acc
        if (isExcludeAnalyticsTx(tx)) return acc
        const amount = tx.convertedAmount || 0
        if (tx.type === 'income') acc.income += amount
        if (tx.type === 'expense') acc.expense += amount
        return acc
      },
      { income: 0, expense: 0 },
    )

    const monthDelta = thisMonth.income - thisMonth.expense
    return {
      monthIncome: thisMonth.income,
      monthExpense: thisMonth.expense,
      monthDelta,
      monthDeltaTone: monthDelta >= 0 ? 'success' : 'danger',
      monthDeltaPct: thisMonth.income > 0 ? (monthDelta / thisMonth.income) * 100 : 0,
      incomeDeltaPct: lastMonth.income > 0
        ? ((thisMonth.income - lastMonth.income) / lastMonth.income) * 100
        : thisMonth.income > 0 ? 100 : 0,
      expenseDeltaPct: lastMonth.expense > 0
        ? ((thisMonth.expense - lastMonth.expense) / lastMonth.expense) * 100
        : thisMonth.expense > 0 ? 100 : 0,
    }
  }, [transactions, investments, currentMonthKey, normalizedTransactions])

  const portfolioStats = useMemo(() => {
    if (investments === null) return { portfolioValue: 0 }
    const safeInv = investments ?? []
    const investedAmount = safeInv.reduce((acc, inv) => {
      const raw = toSafeNumber(inv.quantity) * toSafeNumber(inv.purchasePrice)
      return acc + convertCurrency(raw, inv.purchaseCurrency || defaultCurrency, defaultCurrency, rates)
    }, 0)
    return { portfolioValue: investedAmount }
  }, [investments, defaultCurrency, rates])

  const recentTransactions = useMemo(() => {
    if (transactions === null || transactions === undefined) {
      return null
    }
    return [...(transactions ?? [])].sort((a, b) => {
      const byDate = String(b.date || '').localeCompare(String(a.date || ''))
      if (byDate !== 0) return byDate
      const byCreatedAt = Number(b.createdAt || 0) - Number(a.createdAt || 0)
      if (byCreatedAt !== 0) return byCreatedAt
      return String(b.id || '').localeCompare(String(a.id || ''))
    })
  }, [transactions])

  const todayStats = useMemo(() => {
    if (transactions === null || transactions === undefined) {
      return { todayNet: 0, todayIncome: 0 }
    }
    const todayKey = format(new Date(), 'yyyy-MM-dd')
    const flow = normalizedTransactions.reduce(
      (acc, tx) => {
        if (tx?.date !== todayKey) return acc
        const amount = tx.convertedAmount || 0
        if (tx.type === 'income') acc.income += amount
        if (tx.type === 'expense') acc.expense += amount
        return acc
      },
      { income: 0, expense: 0 },
    )
    return { todayIncome: flow.income, todayNet: flow.income - flow.expense }
  }, [transactions, normalizedTransactions])

  const { todayIncome } = todayStats

  const chartData = useMemo(() => {
    if (transactions === null)
      return {
        data1w: [],
        data1m: [],
        data3m: [],
        dataYtd: [],
        data1y: [],
        dataAll: [],
      }
    const safeTx = normalizedTransactions ?? []

    const generateDaily = (daysCount) => {
      const arr = Array.from({ length: daysCount }, (_, idx) => {
        const d = new Date()
        d.setDate(d.getDate() - (daysCount - 1 - idx))
        return { day: format(d, 'dd MMM'), date: format(d, 'yyyy-MM-dd'), income: 0, expense: 0, net: 0 }
      })
      const map = new Map(arr.map((r) => [r.date, r]))
      return { arr, map }
    }

    const generateMonthly = (monthsCount, endMonthD = new Date()) => {
      const arr = Array.from({ length: monthsCount }, (_, idx) => {
        const d = new Date(endMonthD)
        d.setMonth(d.getMonth() - (monthsCount - 1 - idx))
        return { day: format(d, 'MMM yyyy'), key: format(d, 'yyyy-MM'), income: 0, expense: 0, net: 0 }
      })
      const map = new Map(arr.map((r) => [r.key, r]))
      return { arr, map }
    }

    const { arr: data1w, map: map1w } = generateDaily(7)
    const { arr: data1m, map: map1m } = generateDaily(30)
    const { arr: data3m, map: map3m } = generateDaily(90)
    const { arr: data1y, map: map1y } = generateMonthly(12)

    const currentMonth = new Date().getMonth() + 1
    const { arr: dataYtd, map: mapYtd } = generateMonthly(Math.max(2, currentMonth))

    let oldestDate = new Date()
    if (safeTx.length > 0) {
      for (const tx of safeTx) {
        if (tx.date && new Date(tx.date) < oldestDate) oldestDate = new Date(tx.date)
      }
    }
    const allMonthsDiff =
      (new Date().getFullYear() - oldestDate.getFullYear()) * 12 +
      (new Date().getMonth() - oldestDate.getMonth()) +
      1
    const totalMonths = Math.max(2, allMonthsDiff)
    const { arr: dataAll, map: mapAll } = generateMonthly(totalMonths)

    safeTx.forEach((tx) => {
      const amount = tx.convertedAmount || 0
      const txDate = tx?.date
      if (!txDate) return

      const r1w = map1w.get(txDate)
      if (r1w) {
        r1w[tx.type] = (r1w[tx.type] || 0) + amount
      }
      const r1m = map1m.get(txDate)
      if (r1m) {
        r1m[tx.type] = (r1m[tx.type] || 0) + amount
      }
      const r3m = map3m.get(txDate)
      if (r3m) {
        r3m[tx.type] = (r3m[tx.type] || 0) + amount
      }

      const monthKey = txDate.slice(0, 7)
      const rytd = mapYtd.get(monthKey)
      if (rytd) {
        rytd[tx.type] = (rytd[tx.type] || 0) + amount
      }
      const r1y = map1y.get(monthKey)
      if (r1y) {
        r1y[tx.type] = (r1y[tx.type] || 0) + amount
      }
      const rall = mapAll.get(monthKey)
      if (rall) {
        rall[tx.type] = (rall[tx.type] || 0) + amount
      }
    })

    const calcNet = (arr) =>
      arr.forEach((r) => {
        r.net = (r.income || 0) - (r.expense || 0)
      })
    calcNet(data1w)
    calcNet(data1m)
    calcNet(data3m)
    calcNet(dataYtd)
    calcNet(data1y)
    calcNet(dataAll)

    return {
      data1w,
      data1m,
      data3m,
      dataYtd,
      data1y,
      dataAll,
    }
  }, [transactions, normalizedTransactions])

  const { data1w, data1m, data3m, dataYtd, data1y, dataAll } = chartData

  const loanSummary = useMemo(() => {
    const safeLoans = loans ?? []
    const activeLoans = safeLoans
      .map((l) => {
        const remaining = toSafeNumber(l.remainingAmount ?? l.totalAmount)
        const total = toSafeNumber(l.totalAmount || remaining)
        const paid = Math.max(0, total - remaining)
        const paidPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
        const val = convertCurrency(remaining, l.currency || defaultCurrency, defaultCurrency, rates)
        const isPaid = l.status === 'paid' || remaining <= 0

        let isOverdue = false
        let daysLeft = null
        if (l.dueDate && !isPaid) {
          daysLeft = differenceInDays(new Date(l.dueDate), new Date())
          if (daysLeft < 0) isOverdue = true
        }

        return {
          ...l,
          remaining,
          total,
          paid,
          paidPct,
          convertedRemaining: val,
          isPaid,
          isOverdue,
          daysLeft,
        }
      })
      .filter((l) => !l.isPaid)

    const debtLoans = activeLoans.filter((l) => l.type === 'debt')
    const receivableLoans = activeLoans.filter((l) => l.type === 'receivable')

    const totalDebt = debtLoans.reduce((sum, l) => sum + l.convertedRemaining, 0)
    const totalReceivable = receivableLoans.reduce((sum, l) => sum + l.convertedRemaining, 0)

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
    const hasActiveLoans = totalCombined > 0
    const receivablePct = hasActiveLoans ? Math.round((totalReceivable / totalCombined) * 100) : 0
    const debtPct = hasActiveLoans ? 100 - receivablePct : 0

    return {
      activeLoans,
      debtLoans,
      receivableLoans,
      totalDebt,
      totalReceivable,
      debtCount: debtLoans.length,
      receivableCount: receivableLoans.length,
      netPosition,
      receivablePct,
      debtPct,
      hasActiveLoans,
      activeCount: activeLoans.length,
      mostUrgentItem,
      urgentList: sortedUrgent.slice(0, 2),
    }
  }, [loans, defaultCurrency, rates])

  const netLoanPosition = loanSummary.netPosition || 0
  const portfolioValue = portfolioStats.portfolioValue || 0
  const cashBalance = totalWalletBalance || 0
  const netWorth = cashBalance + portfolioValue + netLoanPosition

  const {
    monthIncome,
    monthExpense,
    monthDelta,
    monthDeltaTone,
    monthDeltaPct,
    incomeDeltaPct,
    expenseDeltaPct,
  } = monthStats

  const groupedRecentEntries = useMemo(() => {
    if (!recentTransactions) return []
    const groups = {}
    recentTransactions.slice(0, 10).forEach((tx) => {
      const dateKey = tx.date || 'Unknown'
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(tx)
    })
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [recentTransactions])

  const budgetGoalSummary = useMemo(() => {
    const safeBudgets = budgets ?? []
    const safeGoals = goals ?? []
    const currentMonthTxs = normalizedTransactions.filter(
      (tx) => tx.date?.startsWith(currentMonthKey) && tx.type === 'expense' && !isExcludeAnalyticsTx(tx),
    )

    const budgetRows = safeBudgets
      .filter((b) => b.month === currentMonthKey)
      .map((b) => {
        const spent = currentMonthTxs
          .filter((tx) => {
            if (!tx.category) return false
            if (b.category.includes('/')) return tx.category === b.category
            return tx.category.startsWith(b.category + '/') || tx.category === b.category
          })
          .reduce((sum, tx) => sum + (tx.convertedAmount || 0), 0)
        const limit = toSafeNumber(b.limit)
        const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0
        return {
          ...b,
          spent,
          limit,
          pct,
        }
      })

    const goalRows = safeGoals.map((g) => {
      const current = toSafeNumber(g.currentAmount)
      const target = toSafeNumber(g.targetAmount)
      const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
      return {
        ...g,
        current,
        target,
        pct,
      }
    })

    return {
      budgetRows,
      goalRows,
    }
  }, [budgets, goals, currentMonthKey, normalizedTransactions])

  const computeCashBalanceBeforeDate = useCallback(
    (dateKey) => {
      const safeTx = normalizedAllTransactionsForBalance.length > 0 ? normalizedAllTransactionsForBalance : normalizedTransactions
      const target = String(dateKey || '')
      if (!target) return totalWalletBalance || 0

      const netFlowSinceTarget = safeTx.reduce((acc, tx) => {
        const d = String(tx?.date || '')
        if (!d || d < target) return acc
        const amount = tx.convertedAmount || 0
        if (tx.type === 'income') return acc + amount
        if (tx.type === 'expense') return acc - amount
        return acc
      }, 0)

      return (totalWalletBalance || 0) - netFlowSinceTarget
    },
    [normalizedAllTransactionsForBalance, normalizedTransactions, totalWalletBalance],
  )

  const buildRevenueSeries = useCallback(
    (rangeId) => {
      if (rangeId === '1d') {
        const todayKey = format(new Date(), 'yyyy-MM-dd')
        const startBalance = computeCashBalanceBeforeDate(todayKey) + portfolioValue + netLoanPosition
        const hourNet = Array.from({ length: 24 }, () => 0)
        normalizedTransactions.forEach((tx) => {
          if (String(tx?.date || '') !== todayKey) return
          const amount = tx.convertedAmount || 0
          const signed = tx.type === 'income' ? amount : tx.type === 'expense' ? -amount : 0
          const fallbackMs = Number(new Date(`${todayKey}T12:00:00`).getTime())
          const txMs = Number.isFinite(Number(tx?.createdAt)) ? Number(tx.createdAt) : fallbackMs
          const hour = new Date(txMs).getHours()
          if (hour >= 0 && hour <= 23) hourNet[hour] += signed
        })

        const startOfToday = new Date(`${todayKey}T00:00:00`).getTime()
        const currentHour = new Date().getHours()
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
      else if (rangeId === 'ytd') {
        sourceData = dataYtd
        isMonthly = true
      } else if (rangeId === '1y') {
        sourceData = data1y
        isMonthly = true
      } else if (rangeId === 'all') {
        sourceData = dataAll
        isMonthly = true
      }

      if (!sourceData || sourceData.length === 0) return []

      const firstItem = sourceData[0]
      const startDate = isMonthly ? `${firstItem.key}-01` : firstItem.date
      const startBalance = (startDate ? computeCashBalanceBeforeDate(startDate) : 0) + portfolioValue + netLoanPosition

      let running = startBalance
      return sourceData.map((row) => {
        running += toSafeNumber(row.net)
        const timeMs = isMonthly ? new Date(`${row.key}-01`).getTime() : new Date(row.date).getTime()
        return { time: timeMs, value: running }
      })
    },
    [computeCashBalanceBeforeDate, data1w, data1m, data3m, dataYtd, data1y, dataAll, portfolioValue, netLoanPosition, normalizedTransactions],
  )

  const computeRevenueValue = useCallback(() => {
    return cashBalance + portfolioValue + netLoanPosition
  }, [cashBalance, portfolioValue, netLoanPosition])

  const zoomRevenueSeries = useMemo(() => {
    try {
      return buildRevenueSeries(zoomRevenueRange)
    } catch {
      return []
    }
  }, [buildRevenueSeries, zoomRevenueRange])

  const zoomRevenueValue = useMemo(() => computeRevenueValue(), [computeRevenueValue])

  const miniRevenueSeries = useMemo(() => {
    try {
      return buildRevenueSeries(miniRevenueRange)
    } catch {
      return []
    }
  }, [buildRevenueSeries, miniRevenueRange])

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

    return sourceData.reduce(
      (acc, r) => {
        acc.income += r.income || 0
        acc.expense += r.expense || 0
        acc.net += r.net || 0
        return acc
      },
      { income: 0, expense: 0, net: 0 },
    )
  }, [zoomRevenueRange, todayIncome, todayStats, data1w, data1m, data3m, dataYtd, data1y, dataAll])

  const netWorthGrowth = useMemo(() => {
    const net = rangedSummaryStats.net ?? 0
    const currentVal = zoomRevenueValue ?? 0
    const startVal = currentVal - net
    const pct = startVal > 0 ? (net / startVal) * 100 : startVal === 0 && net > 0 ? 100 : 0

    return {
      net,
      pct,
    }
  }, [rangedSummaryStats.net, zoomRevenueValue])

  const buildPreviousPeriodRevenueSeries = useCallback(
    (rangeId, currentSeries) => {
      if (!currentSeries || currentSeries.length === 0) return []
      const safeTx = normalizedAllTransactionsForBalance.length > 0 ? normalizedAllTransactionsForBalance : normalizedTransactions

      if (rangeId === '1d') {
        const yesterday = subDays(new Date(), 1)
        const yesterdayKey = format(yesterday, 'yyyy-MM-dd')
        const startBalanceYesterday = computeCashBalanceBeforeDate(yesterdayKey) + portfolioValue + netLoanPosition

        const hourNetYesterday = Array.from({ length: 24 }, () => 0)
        safeTx.forEach((tx) => {
          if (String(tx?.date || '') !== yesterdayKey) return
          const amount = tx.convertedAmount || 0
          const signed = tx.type === 'income' ? amount : tx.type === 'expense' ? -amount : 0
          const fallbackMs = Number(new Date(`${yesterdayKey}T12:00:00`).getTime())
          const txMs = Number.isFinite(Number(tx?.createdAt)) ? Number(tx.createdAt) : fallbackMs
          const hour = new Date(txMs).getHours()
          if (hour >= 0 && hour <= 23) hourNetYesterday[hour] += signed
        })

        let running = startBalanceYesterday
        const yesterdayHourly = Array.from({ length: 24 }, (_, hour) => {
          running += toSafeNumber(hourNetYesterday[hour])
          return running
        })

        return currentSeries.map((item) => {
          const timeMs = Number(item?.time)
          const dateObj = Number.isFinite(timeMs) ? new Date(timeMs) : new Date()
          const hour = isNaN(dateObj.getTime()) ? 0 : dateObj.getHours()
          const prevVal = yesterdayHourly[Math.min(23, Math.max(0, hour))] ?? startBalanceYesterday
          return {
            ...item,
            prevValue: prevVal,
            prevLabel: `${format(yesterday, 'dd MMM')}, ${String(hour).padStart(2, '0')}:00`,
          }
        })
      }

      let daysBack = 7
      if (rangeId === '1w') daysBack = 7
      else if (rangeId === '1m') daysBack = 30
      else if (rangeId === '3m') daysBack = 90

      if (['1w', '1m', '3m'].includes(rangeId)) {
        const today = new Date()
        const prevDates = Array.from({ length: daysBack }, (_, idx) => {
          const d = subDays(today, daysBack * 2 - 1 - idx)
          return format(d, 'yyyy-MM-dd')
        })

        const startPrevDate = prevDates[0]
        const startBalancePrev = computeCashBalanceBeforeDate(startPrevDate) + portfolioValue + netLoanPosition

        const prevDailyNetMap = new Map(prevDates.map((d) => [d, 0]))
        safeTx.forEach((tx) => {
          const d = tx?.date
          if (prevDailyNetMap.has(d)) {
            const amount = tx.convertedAmount || 0
            const signed = tx.type === 'income' ? amount : tx.type === 'expense' ? -amount : 0
            prevDailyNetMap.set(d, prevDailyNetMap.get(d) + signed)
          }
        })

        let running = startBalancePrev
        const prevRunningArray = prevDates.map((d) => {
          running += prevDailyNetMap.get(d) || 0
          return { date: d, value: running }
        })

        return currentSeries.map((item, idx) => {
          const prevData = prevRunningArray[idx] || prevRunningArray[prevRunningArray.length - 1]
          let prevLabel = ''
          if (prevData?.date) {
            const dateObj = new Date(prevData.date)
            if (!isNaN(dateObj.getTime())) {
              prevLabel = format(dateObj, 'dd MMM yyyy')
            }
          }
          return {
            ...item,
            prevValue: prevData?.value ?? startBalancePrev,
            prevLabel,
          }
        })
      }

      if (rangeId === 'ytd') {
        const currentYear = new Date().getFullYear()
        const prevYear = currentYear - 1
        const monthsCount = Math.max(2, new Date().getMonth() + 1)
        const prevMonths = Array.from({ length: monthsCount }, (_, idx) => {
          const m = String(idx + 1).padStart(2, '0')
          return `${prevYear}-${m}`
        })

        const startBalancePrev = computeCashBalanceBeforeDate(`${prevMonths[0]}-01`) + portfolioValue + netLoanPosition
        const prevMonthlyNetMap = new Map(prevMonths.map((m) => [m, 0]))
        safeTx.forEach((tx) => {
          const m = String(tx?.date || '').slice(0, 7)
          if (prevMonthlyNetMap.has(m)) {
            const amount = tx.convertedAmount || 0
            const signed = tx.type === 'income' ? amount : tx.type === 'expense' ? -amount : 0
            prevMonthlyNetMap.set(m, prevMonthlyNetMap.get(m) + signed)
          }
        })

        let running = startBalancePrev
        const prevRunningArray = prevMonths.map((m) => {
          running += prevMonthlyNetMap.get(m) || 0
          return { month: m, value: running }
        })

        return currentSeries.map((item, idx) => {
          const prevData = prevRunningArray[idx] || prevRunningArray[prevRunningArray.length - 1]
          let prevLabel = ''
          if (prevData?.month) {
            const dateObj = new Date(`${prevData.month}-01`)
            if (!isNaN(dateObj.getTime())) {
              prevLabel = format(dateObj, 'MMM yyyy')
            }
          }
          return {
            ...item,
            prevValue: prevData?.value ?? startBalancePrev,
            prevLabel,
          }
        })
      }

      if (rangeId === '1y' || rangeId === 'all') {
        const totalMonths = currentSeries.length || 12
        const today = new Date()
        const prevMonths = Array.from({ length: totalMonths }, (_, idx) => {
          const d = subMonths(today, totalMonths * 2 - 1 - idx)
          return format(d, 'yyyy-MM')
        })

        const firstMonth = prevMonths[0]
        const startBalancePrev = (firstMonth ? computeCashBalanceBeforeDate(`${firstMonth}-01`) : 0) + portfolioValue + netLoanPosition
        const prevMonthlyNetMap = new Map(prevMonths.map((m) => [m, 0]))
        safeTx.forEach((tx) => {
          const m = String(tx?.date || '').slice(0, 7)
          if (prevMonthlyNetMap.has(m)) {
            const amount = tx.convertedAmount || 0
            const signed = tx.type === 'income' ? amount : tx.type === 'expense' ? -amount : 0
            prevMonthlyNetMap.set(m, prevMonthlyNetMap.get(m) + signed)
          }
        })

        let running = startBalancePrev
        const prevRunningArray = prevMonths.map((m) => {
          running += prevMonthlyNetMap.get(m) || 0
          return { month: m, value: running }
        })

        return currentSeries.map((item, idx) => {
          const prevData = prevRunningArray[idx] || prevRunningArray[prevRunningArray.length - 1]
          let prevLabel = ''
          if (prevData?.month) {
            const dateObj = new Date(`${prevData.month}-01`)
            if (!isNaN(dateObj.getTime())) {
              prevLabel = format(dateObj, 'MMM yyyy')
            }
          }
          return {
            ...item,
            prevValue: prevData?.value ?? startBalancePrev,
            prevLabel,
          }
        })
      }

      return currentSeries
    },
    [normalizedAllTransactionsForBalance, normalizedTransactions, computeCashBalanceBeforeDate, portfolioValue, netLoanPosition],
  )

  const zoomCombinedChartSeries = useMemo(() => {
    if (!zoomRevenueSeries || zoomRevenueSeries.length === 0) return []
    if (!comparePrevious) return zoomRevenueSeries
    try {
      return buildPreviousPeriodRevenueSeries(zoomRevenueRange, zoomRevenueSeries)
    } catch {
      return zoomRevenueSeries
    }
  }, [zoomRevenueSeries, comparePrevious, buildPreviousPeriodRevenueSeries, zoomRevenueRange])

  const comparisonSummary = useMemo(() => {
    if (!comparePrevious || !zoomCombinedChartSeries || zoomCombinedChartSeries.length === 0) return null

    const first = zoomCombinedChartSeries[0]
    const last = zoomCombinedChartSeries[zoomCombinedChartSeries.length - 1]
    const currentEndVal = toSafeNumber(last?.value)
    const currentStartVal = toSafeNumber(first?.value)
    const currentNet = currentEndVal - currentStartVal

    const prevEndVal = toSafeNumber(last?.prevValue)
    const prevStartVal = toSafeNumber(first?.prevValue)
    const prevNet = prevEndVal - prevStartVal

    const diff = currentNet - prevNet
    const isPositive = diff >= 0

    return {
      currentNet,
      prevNet,
      diff,
      isPositive,
      currentEndVal,
      prevEndVal,
    }
  }, [comparePrevious, zoomCombinedChartSeries])

  const zoomPeakAndFloor = useMemo(() => {
    if (!zoomRevenueSeries || zoomRevenueSeries.length === 0) {
      return { max: 0, min: 0, avgRateStr: '-', netRate: 0 }
    }
    const vals = zoomRevenueSeries.map((d) => d.value).filter((v) => Number.isFinite(v))
    if (vals.length === 0) return { max: 0, min: 0, avgRateStr: '-', netRate: 0 }
    const max = Math.max(...vals)
    const min = Math.min(...vals)

    const net = rangedSummaryStats.net ?? 0
    let unitKey = 'day'
    let unitLabel = 'hari'
    let duration = 30

    if (zoomRevenueRange === '1d') {
      unitKey = 'hour'
      unitLabel = 'jam'
      duration = 24
    } else if (zoomRevenueRange === '1w') {
      unitKey = 'day'
      unitLabel = 'hari'
      duration = 7
    } else if (zoomRevenueRange === '1m') {
      unitKey = 'day'
      unitLabel = 'hari'
      duration = 30
    } else if (zoomRevenueRange === '3m') {
      unitKey = 'day'
      unitLabel = 'hari'
      duration = 90
    } else if (zoomRevenueRange === 'ytd') {
      unitKey = 'month'
      unitLabel = 'bulan'
      duration = Math.max(1, new Date().getMonth() + 1)
    } else if (zoomRevenueRange === '1y') {
      unitKey = 'month'
      unitLabel = 'bulan'
      duration = 12
    } else if (zoomRevenueRange === 'all') {
      unitKey = 'month'
      unitLabel = 'bulan'
      duration = Math.max(1, vals.length)
    }

    const rate = Math.round(net / duration)
    return { max, min, unitKey, unitLabel, netRate: rate }
  }, [zoomRevenueSeries, rangedSummaryStats.net, zoomRevenueRange])

  const assetBreakdownData = useMemo(() => {
    const safeWallets = walletsWithBalance ?? []
    if (safeWallets.length === 0) return { total: 0, items: [] }

    const convertedBalances = safeWallets.map((w) => ({
      ...w,
      convertedBalance: Math.max(
        0,
        convertCurrency(
          Math.max(0, toSafeNumber(w.currentBalance)),
          w.currency || defaultCurrency,
          defaultCurrency,
          rates,
        ),
      ),
    }))

    const total = convertedBalances.reduce((acc, w) => acc + w.convertedBalance, 0)
    if (total === 0) return { total: 0, items: [] }

    const colors = [
      'bg-emerald-500',
      'bg-indigo-500',
      'bg-amber-500',
      'bg-cyan-500',
      'bg-rose-500',
      'bg-violet-500',
    ]

    const items = convertedBalances
      .map((w, idx) => {
        const bal = w.convertedBalance
        const pct = Math.round((bal / total) * 100)
        return {
          id: w.id || idx,
          name: w.name || 'Dompet',
          balance: bal,
          rawBalance: Math.max(0, toSafeNumber(w.currentBalance)),
          currency: w.currency || defaultCurrency,
          pct,
          color: colors[idx % colors.length],
        }
      })
      .filter((w) => w.balance > 0)
      .sort((a, b) => b.balance - a.balance)

    return { total, items }
  }, [walletsWithBalance, defaultCurrency, rates])

  const globalWeeklyTrend = useMemo(() => {
    return calculateGlobalWeeklyTrend(allHabits, allHabitLogs)
  }, [allHabits, allHabitLogs])

  const globalConsistencyStreak = useMemo(() => {
    if (!allHabitLogs.length) return 0
    const logDates = new Set(allHabitLogs.map((l) => l.date))
    let streak = 0
    const todayDate = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(todayDate)
      d.setDate(d.getDate() - i)
      const dateStr = format(d, 'yyyy-MM-dd')
      if (logDates.has(dateStr)) {
        streak++
      } else {
        if (i !== 0) break
      }
    }
    return streak
  }, [allHabitLogs])

  return {
    t,
    locale,
    defaultCurrency,
    reduceMotion,
    isDbLoading,
    rates,
    currentMonthKey,
    currentMonthLabel,
    walletsWithBalance,
    totalWalletBalance,
    monthIncome,
    monthExpense,
    monthDelta,
    monthDeltaTone,
    monthDeltaPct,
    incomeDeltaPct,
    expenseDeltaPct,
    portfolioValue,
    cashBalance,
    netWorth,
    recentTransactions,
    groupedRecentEntries,
    budgetGoalSummary,
    loanSummary,
    globalWeeklyTrend,
    globalConsistencyStreak,
    // Chart series & ranges
    miniRevenueRange,
    setMiniRevenueRange,
    miniRevenueSeries,
    miniRevenueChartDomain,
    miniRevenueAxisTicks,
    zoomRevenueRange,
    setZoomRevenueRange,
    zoomRevenueSeries,
    zoomRevenueValue,
    zoomRevenueChartDomain,
    zoomRevenueAxisTicks,
    rangedSummaryStats,
    netWorthGrowth,
    zoomPeakAndFloor,
    assetBreakdownData,
    zoomCombinedChartSeries,
    comparePrevious,
    setComparePrevious,
    comparisonSummary,
    showDetailedAnalytics,
    setShowDetailedAnalytics,
    zoomTooltipDismissed,
    setZoomTooltipDismissed,
    isCoarsePointer,
    computeRevenueValue,
  }
}
