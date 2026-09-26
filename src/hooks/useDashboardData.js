import { useState, useEffect, useMemo, useCallback } from 'react'
import { format, startOfMonth, subMonths, subDays, differenceInDays } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { getAllWalletBalances } from '../lib/balanceEngine'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import { convertCurrency, FALLBACK_EXCHANGE_RATES, isExcludeAnalyticsTx, roundCurrency, toSafeNumber } from '../lib/utils'
import { calculateBudgetSpent, getBudgetPeriodDateRange, getCurrentBudgetMonthKey } from '../lib/budgetUtils'
import useTranslation from './useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import { calculateGlobalWeeklyTrend } from '../lib/habitStats'
import {
  buildNiceTicksForDomain,
  buildPaddedDomain,
} from '../components/dashboard/DashboardChartHelpers'

export {
  getCompactItems,
  COMPACT_ITEMS,
  getSavedNetWorthRange,
  cachedDashboardState,
  clearCachedDashboardState,
  getCachedDashboardTransactions,
  setCachedDashboardTransactions,
  getCachedDashboardWallets,
  setCachedDashboardWallets,
} from './dashboard/dashboardCache'

export {
  computeNetWorthGrowth,
  calculateRangeNetWorthGrowth,
  formatGrowthPercentage,
  generateMonthlyData,
  calculatePeriodStats,
  calculate1DHourlyFlow,
} from './dashboard/dashboardStats'

import {
  getSavedNetWorthRange,
  cachedDashboardState,
} from './dashboard/dashboardCache'

import {
  calculatePeriodStats,
  calculate1DHourlyFlow,
  calculateRangeNetWorthGrowth,
} from './dashboard/dashboardStats'

export function useDashboardData() {
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const budgetCycleStartDay = useSettingsStore((state) => state.budgetCycleStartDay || 1)
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const { t, locale } = useTranslation()

  const [rates, setRates] = useState(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES })
  const currentMonthKey = getCurrentBudgetMonthKey(new Date(), budgetCycleStartDay)
  const currentPeriod = useMemo(
    () => getBudgetPeriodDateRange(currentMonthKey, budgetCycleStartDay, locale),
    [currentMonthKey, budgetCycleStartDay, locale],
  )
  const currentMonthLabel = budgetCycleStartDay > 1 ? currentPeriod.label : format(new Date(), 'MMM yyyy', {
    locale: locale === 'en' ? enUS : idLocale,
  })

  const [zoomRevenueRange, setZoomRevenueRangeState] = useState(() => getSavedNetWorthRange())
  const [miniRevenueRange, setMiniRevenueRangeState] = useState(() => getSavedNetWorthRange())

  const isAllRange = zoomRevenueRange === 'all' || miniRevenueRange === 'all'
  const txCutoffDate = format(startOfMonth(subMonths(new Date(), 12)), 'yyyy-MM-dd')
  const transactions = useLiveQuery(
    async () => {
      const list = isAllRange
        ? await db.transactions.toArray()
        : await db.transactions.where('date').aboveOrEqual(txCutoffDate).toArray()
      return (list || []).filter((tx) => !tx.deletedAt)
    },
    [isAllRange, txCutoffDate],
    cachedDashboardState.transactions,
  )
  const investments = useLiveQuery(() => db.investments.toArray(), [], cachedDashboardState.investments)
  const budgets = useLiveQuery(() => db.budgets.toArray(), [], cachedDashboardState.budgets)
  const goals = useLiveQuery(() => db.goals.toArray(), [], cachedDashboardState.goals)
  const loans = useLiveQuery(() => db.loans.toArray(), [], cachedDashboardState.loans)
  const walletsWithBalance = useLiveQuery(
    async () => {
      // Establish active live dependency on transactions & walletBalanceCache
      // so any created/updated/deleted transaction immediately triggers balance recalculation!
      await db.transactions.limit(1).toArray()
      if (db.walletBalanceCache) {
        await db.walletBalanceCache.limit(1).toArray()
      }
      const rawWallets = await db.wallets.toArray()
      if (!rawWallets || rawWallets.length === 0) return []
      return await getAllWalletBalances(rawWallets, rates)
    },
    [rates],
    cachedDashboardState.walletsWithBalance,
  )
  const rawHabitLogs = useLiveQuery(() => db.habitLogs.toArray(), [], cachedDashboardState.rawHabitLogs)
  const rawHabits = useLiveQuery(() => db.habits.toArray(), [], cachedDashboardState.rawHabits)

  // Keep in-memory cache updated whenever live query results resolve
  useEffect(() => {
    if (transactions !== null) cachedDashboardState.transactions = transactions
    if (investments !== null) cachedDashboardState.investments = investments
    if (budgets !== null) cachedDashboardState.budgets = budgets
    if (goals !== null) cachedDashboardState.goals = goals
    if (loans !== null) cachedDashboardState.loans = loans
    if (walletsWithBalance !== null && walletsWithBalance !== undefined) cachedDashboardState.walletsWithBalance = walletsWithBalance
    if (rawHabitLogs !== null && rawHabitLogs !== undefined) cachedDashboardState.rawHabitLogs = rawHabitLogs
    if (rawHabits !== null && rawHabits !== undefined) cachedDashboardState.rawHabits = rawHabits
  }, [transactions, investments, budgets, goals, loans, walletsWithBalance, rawHabitLogs, rawHabits])

  const allHabitLogs = useMemo(() => rawHabitLogs || [], [rawHabitLogs])
  const allHabits = useMemo(() => rawHabits || [], [rawHabits])

  const isDbLoading =
    transactions === null ||
    walletsWithBalance === null ||
    walletsWithBalance === undefined ||
    budgets === null ||
    goals === null ||
    loans === null

  const [isCoarsePointer, setIsCoarsePointer] = useState(false)
  const [comparePrevious, setComparePrevious] = useState(false)
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
    } catch (err){
      console.warn('[useDashboardData]', err)
      /* ignore storage errors */
    }
  }, [])

  const setMiniRevenueRange = useCallback((range) => {
    setZoomTooltipDismissed(true)
    setMiniRevenueRangeState(range)
    setZoomRevenueRangeState(range)
    try {
      localStorage.setItem('ft_networth_range', range)
    } catch (err){
      console.warn('[useDashboardData]', err)
      /* ignore storage errors */
    }
  }, [])

  useEffect(() => {
    const loadRates = async () => {
      try {
        const fetchedRates = await fetchCurrencyRates('USD')
        setRates(fetchedRates)
      } catch (err){
      console.warn('[useDashboardData]', err)
        setRates({ ...FALLBACK_EXCHANGE_RATES })
      }
    }
    loadRates()
  }, [defaultCurrency])

  const totalWalletBalance = useMemo(() => {
    if (walletsWithBalance === undefined || walletsWithBalance === null) {
      return 0
    }
    return walletsWithBalance
      .filter((w) => !w.isArchived)
      .reduce((s, w) => {
        const converted = convertCurrency(
          w.currentBalance || 0,
          w.currency || defaultCurrency,
          defaultCurrency,
          rates,
        )
        return s + converted
      }, 0)
  }, [walletsWithBalance, defaultCurrency, rates])

  const activeWalletIdSet = useMemo(() => {
    if (!walletsWithBalance) return new Set()
    return new Set(walletsWithBalance.filter((w) => !w.isArchived).map((w) => String(w.id)))
  }, [walletsWithBalance])

  const walletCurrencyMap = useMemo(() => {
    const map = new Map()
    if (Array.isArray(walletsWithBalance)) {
      for (const w of walletsWithBalance) {
        if (w?.id != null) map.set(String(w.id), w.currency || defaultCurrency)
      }
    }
    return map
  }, [walletsWithBalance, defaultCurrency])

  const normalizedTransactions = useMemo(() => {
    if (!transactions) return []
    return transactions.map((tx) => {
      const walletCurrency = (tx.walletId != null ? walletCurrencyMap.get(String(tx.walletId)) : null) || defaultCurrency
      const txCurrency = tx.currency || walletCurrency
      const amount = convertCurrency(toSafeNumber(tx.amount), txCurrency, defaultCurrency, rates)
      return {
        ...tx,
        currency: txCurrency,
        walletCurrency,
        convertedAmount: amount,
      }
    })
  }, [transactions, walletCurrencyMap, defaultCurrency, rates])

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
    const [cYear, cMonth] = currentMonthKey.split('-').map(Number)
    const currentMonthDate = new Date(cYear, cMonth - 1, 1)
    const lastMonthKey = format(subMonths(currentMonthDate, 1), 'yyyy-MM')

    const lastPeriod = getBudgetPeriodDateRange(lastMonthKey, budgetCycleStartDay, locale)

    const thisMonth = calculatePeriodStats(safeTx, currentPeriod, defaultCurrency, rates)
    const lastMonth = calculatePeriodStats(safeTx, lastPeriod, defaultCurrency, rates)

    const rawMonthDelta = thisMonth.income - thisMonth.expense
    const monthDelta = roundCurrency(rawMonthDelta)
    return {
      monthIncome: thisMonth.income,
      monthExpense: thisMonth.expense,
      monthDelta,
      monthDeltaTone: monthDelta >= 0 ? 'success' : 'danger',
      monthDeltaPct: thisMonth.income > 0 ? roundCurrency((monthDelta / thisMonth.income) * 100) : 0,
      incomeDeltaPct: lastMonth.income > 0
        ? roundCurrency(((thisMonth.income - lastMonth.income) / lastMonth.income) * 100)
        : thisMonth.income > 0 ? 100 : 0,
      expenseDeltaPct: lastMonth.expense > 0
        ? roundCurrency(((thisMonth.expense - lastMonth.expense) / lastMonth.expense) * 100)
        : thisMonth.expense > 0 ? 100 : 0,
    }
  }, [transactions, investments, currentMonthKey, budgetCycleStartDay, locale, currentPeriod, normalizedTransactions, defaultCurrency, rates])

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
        if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
          tx.splitItems.forEach((si) => {
            const itemTx = {
              ...tx,
              ...si,
              category: si.category || tx.category,
              isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
              isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
              excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
            }
            if (isExcludeAnalyticsTx(itemTx)) return
            const amount = convertCurrency(toSafeNumber(si.amount), si.currency || tx.currency || defaultCurrency, defaultCurrency, rates)
            const itemType = si.type || tx.type
            if (itemType === 'income') acc.income += amount
            if (itemType === 'expense') acc.expense += amount
          })
          return acc
        }
        if (isExcludeAnalyticsTx(tx)) return acc
        const amount = tx.convertedAmount || 0
        if (tx.type === 'income') acc.income += amount
        if (tx.type === 'expense') acc.expense += amount
        return acc
      },
      { income: 0, expense: 0 },
    )
    return { todayIncome: flow.income, todayNet: flow.income - flow.expense }
  }, [transactions, normalizedTransactions, defaultCurrency, rates])

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
        const d = subDays(new Date(), daysCount - 1 - idx)
        return { day: format(d, 'dd MMM'), date: format(d, 'yyyy-MM-dd'), income: 0, expense: 0, net: 0 }
      })
      const map = new Map(arr.map((r) => [r.date, r]))
      return { arr, map }
    }

    const generateMonthly = (monthsCount, endMonthD = new Date()) => {
      const baseDate = startOfMonth(endMonthD)
      const arr = Array.from({ length: monthsCount }, (_, idx) => {
        const d = subMonths(baseDate, monthsCount - 1 - idx)
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
      if (tx?.isPendingReview === true || tx?.isPendingReview === 1) return
      const isAdj = tx.type === 'balance_adjustment'
      const amount = tx.convertedAmount || 0
      const txDate = tx?.date
      if (!txDate) return

      const isSrcActive = activeWalletIdSet.has(String(tx?.walletId))
      const isTgtActive = tx?.targetWalletId ? activeWalletIdSet.has(String(tx.targetWalletId)) : false

      let cashChange = 0
      if (tx.type === 'transfer') {
        if (isSrcActive && !isTgtActive) cashChange = -amount
        else if (!isSrcActive && isTgtActive) {
          const tgtCurrency =
            tx.targetCurrency || (tx.targetWalletId != null ? walletCurrencyMap.get(String(tx.targetWalletId)) : null) || defaultCurrency
          cashChange =
            tx.targetAmount != null && toSafeNumber(tx.targetAmount) > 0
              ? convertCurrency(toSafeNumber(tx.targetAmount), tgtCurrency, defaultCurrency, rates)
              : amount
        }
      } else if (isSrcActive) {
        if (tx.type === 'income' || isAdj) cashChange = amount
        else if (tx.type === 'expense') cashChange = -amount
      }

      const isExcluded = isExcludeAnalyticsTx(tx)

      const applyToRow = (row) => {
        if (!row) return
        row.cashNet = (row.cashNet || 0) + cashChange
        if (isAdj) {
          row.adjustment = (row.adjustment || 0) + amount
        } else if (isSrcActive) {
          if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
            tx.splitItems.forEach((si) => {
              const itemTx = {
                ...tx,
                ...si,
                category: si.category || tx.category,
                isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
                isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
                excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
              }
              if (isExcludeAnalyticsTx(itemTx)) return
              const itemAmt = convertCurrency(toSafeNumber(si.amount), si.currency || tx.currency || defaultCurrency, defaultCurrency, rates)
              const itemType = si.type || tx.type
              row[itemType] = (row[itemType] || 0) + itemAmt
            })
          } else if (!isExcluded) {
            row[tx.type] = (row[tx.type] || 0) + amount
          }
        }
      }

      applyToRow(map1w.get(txDate))
      applyToRow(map1m.get(txDate))
      applyToRow(map3m.get(txDate))

      const monthKey = txDate.slice(0, 7)
      applyToRow(mapYtd.get(monthKey))
      applyToRow(map1y.get(monthKey))
      applyToRow(mapAll.get(monthKey))
    })

    const calcNet = (arr) =>
      arr.forEach((r) => {
        r.net = r.cashNet !== undefined ? r.cashNet : ((r.income || 0) - (r.expense || 0) + (r.adjustment || 0))
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
  }, [transactions, normalizedTransactions, activeWalletIdSet, defaultCurrency, rates, walletCurrencyMap])

  const { data1w, data1m, data3m, dataYtd, data1y, dataAll } = chartData

  const sevenDaysStats = useMemo(() => {
    if (!Array.isArray(data1w)) return { income: 0, expense: 0, net: 0 }
    let income = 0
    let expense = 0
    for (const d of data1w) {
      income += Number(d.income) || 0
      expense += Number(d.expense) || 0
    }
    return {
      income,
      expense,
      net: income - expense,
    }
  }, [data1w])

  const loanSummary = useMemo(() => {
    const safeLoans = loans ?? []
    const activeLoans = safeLoans
      .map((l) => {
        const rawRemaining = l.remainingAmount !== undefined && l.remainingAmount !== null && l.remainingAmount !== '' ? l.remainingAmount : l.totalAmount
        const remaining = toSafeNumber(rawRemaining)
        const total = toSafeNumber(l.totalAmount || remaining)
        const paid = Math.max(0, total - remaining)
        const paidPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
        const val = convertCurrency(remaining, l.currency || defaultCurrency, defaultCurrency, rates)
        const isPaid = l.status === 'paid' || l.status === 'forgiven' || remaining <= 0

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

  const totalSavings = useMemo(() => {
    return (goals || [])
      .filter((g) => !g.isArchived)
      .reduce((sum, g) => {
        const amt = toSafeNumber(g.currentAmount)
        if (amt <= 0) return sum
        return sum + convertCurrency(amt, g.currency || defaultCurrency, defaultCurrency, rates)
      }, 0)
  }, [goals, defaultCurrency, rates])

  const netLoanPosition = loanSummary.netPosition || 0
  const portfolioValue = portfolioStats.portfolioValue || 0
  const cashBalance = totalWalletBalance || 0
  const netWorth = cashBalance + portfolioValue + netLoanPosition + totalSavings

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

    const budgetPeriod = getBudgetPeriodDateRange(currentMonthKey, budgetCycleStartDay, locale)
    const periodExpenseTxs = (normalizedTransactions || []).filter(
      (tx) =>
        tx?.date &&
        tx.date >= budgetPeriod.startDate &&
        tx.date <= budgetPeriod.endDate &&
        (tx.type === 'expense' || (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.some((si) => (si.type || tx.type) === 'expense')))
    )

    const budgetRows = safeBudgets
      .filter((b) => b.month === currentMonthKey)
      .map((b) => {
        const budgetCurrency = b.currency || defaultCurrency
        const spent = calculateBudgetSpent(b.category, periodExpenseTxs, budgetCurrency, rates)
        const limit = toSafeNumber(b.limit)
        const pct = limit > 0 ? (spent / limit) * 100 : 0
        const remaining = Math.max(0, limit - spent)
        const isOver = spent > limit
        return {
          ...b,
          spent,
          limit,
          pct,
          remaining,
          isOver,
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
  }, [budgets, goals, currentMonthKey, budgetCycleStartDay, locale, normalizedTransactions, defaultCurrency, rates])

  const computeCashBalanceBeforeDate = useCallback(
    (dateKey) => {
      const safeTx = normalizedTransactions || []
      const target = String(dateKey || '')
      if (!target) return totalWalletBalance || 0

      const netFlowSinceTarget = safeTx.reduce((acc, tx) => {
        if (tx?.isPendingReview === true || tx?.isPendingReview === 1) return acc
        const d = String(tx?.date || '')
        if (!d || d < target) return acc
        const isSrcActive = activeWalletIdSet.has(String(tx?.walletId))
        const isTgtActive = tx?.targetWalletId ? activeWalletIdSet.has(String(tx.targetWalletId)) : false

        if (tx.type === 'transfer') {
          if (isSrcActive && !isTgtActive) {
            return acc - (tx.convertedAmount || 0)
          }
          if (!isSrcActive && isTgtActive) {
            const tgtCurrency =
              tx.targetCurrency || (tx.targetWalletId != null ? walletCurrencyMap.get(String(tx.targetWalletId)) : null) || defaultCurrency
            const tgtAmt =
              tx.targetAmount != null && toSafeNumber(tx.targetAmount) > 0
                ? convertCurrency(toSafeNumber(tx.targetAmount), tgtCurrency, defaultCurrency, rates)
                : (tx.convertedAmount || 0)
            return acc + tgtAmt
          }
          return acc
        }

        if (!isSrcActive) return acc
        const isAdj = tx.type === 'balance_adjustment'
        const amount = tx.convertedAmount || 0
        if (tx.type === 'income') return acc + amount
        if (tx.type === 'expense') return acc - amount
        if (isAdj) return acc + amount
        return acc
      }, 0)

      return (totalWalletBalance || 0) - netFlowSinceTarget
    },
    [normalizedTransactions, totalWalletBalance, activeWalletIdSet, walletCurrencyMap, defaultCurrency, rates],
  )

  const buildRevenueSeries = useCallback(
    (rangeId) => {
      if (rangeId === '1d') {
        const todayKey = format(new Date(), 'yyyy-MM-dd')
        const startBalance = computeCashBalanceBeforeDate(todayKey) + portfolioValue + netLoanPosition + totalSavings
        const hourNet = calculate1DHourlyFlow(
          normalizedTransactions,
          todayKey,
          activeWalletIdSet,
          walletCurrencyMap,
          defaultCurrency,
          rates,
        )

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
      const startBalance = (startDate ? computeCashBalanceBeforeDate(startDate) : 0) + portfolioValue + netLoanPosition + totalSavings

      let running = startBalance
      return sourceData.map((row) => {
        running += toSafeNumber(row.net)
        const timeMs = isMonthly ? new Date(`${row.key}-01`).getTime() : new Date(row.date).getTime()
        return { time: timeMs, value: running }
      })
    },
    [
      computeCashBalanceBeforeDate,
      data1w,
      data1m,
      data3m,
      dataYtd,
      data1y,
      dataAll,
      portfolioValue,
      netLoanPosition,
      totalSavings,
      normalizedTransactions,
      activeWalletIdSet,
      walletCurrencyMap,
      defaultCurrency,
      rates,
    ],
  )

  const computeRevenueValue = useCallback(() => {
    return cashBalance + portfolioValue + netLoanPosition + totalSavings
  }, [cashBalance, portfolioValue, netLoanPosition, totalSavings])

  const zoomRevenueSeries = useMemo(() => {
    try {
      return buildRevenueSeries(zoomRevenueRange)
    } catch (err){
      console.warn('[useDashboardData]', err)
      return []
    }
  }, [buildRevenueSeries, zoomRevenueRange])

  const zoomRevenueValue = useMemo(() => computeRevenueValue(), [computeRevenueValue])

  const miniRevenueSeries = useMemo(() => {
    try {
      return buildRevenueSeries(miniRevenueRange)
    } catch (err){
      console.warn('[useDashboardData]', err)
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

  const miniNetWorthGrowth = useMemo(() => {
    return calculateRangeNetWorthGrowth(miniRevenueRange, netWorth, chartData, todayStats)
  }, [miniRevenueRange, netWorth, chartData, todayStats])

  const zoomNetWorthGrowth = useMemo(() => {
    return calculateRangeNetWorthGrowth(zoomRevenueRange, netWorth, chartData, todayStats)
  }, [zoomRevenueRange, netWorth, chartData, todayStats])

  const netWorthGrowth = miniNetWorthGrowth

  const buildPreviousPeriodRevenueSeries = useCallback(
    (rangeId, currentSeries) => {
      if (!currentSeries || currentSeries.length === 0) return []
      const safeTx = normalizedTransactions || []

      if (rangeId === '1d') {
        const yesterday = subDays(new Date(), 1)
        const yesterdayKey = format(yesterday, 'yyyy-MM-dd')
        const startBalanceYesterday = computeCashBalanceBeforeDate(yesterdayKey) + portfolioValue + netLoanPosition + totalSavings

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
        const startBalancePrev = computeCashBalanceBeforeDate(startPrevDate) + portfolioValue + netLoanPosition + totalSavings

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

        const startBalancePrev = computeCashBalanceBeforeDate(`${prevMonths[0]}-01`) + portfolioValue + netLoanPosition + totalSavings
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
          const d = subMonths(startOfMonth(today), totalMonths * 2 - 1 - idx)
          return format(d, 'yyyy-MM')
        })

        const firstMonth = prevMonths[0]
        const startBalancePrev = (firstMonth ? computeCashBalanceBeforeDate(`${firstMonth}-01`) : 0) + portfolioValue + netLoanPosition + totalSavings
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
    [normalizedTransactions, computeCashBalanceBeforeDate, portfolioValue, netLoanPosition, totalSavings],
  )

  const zoomCombinedChartSeries = useMemo(() => {
    if (!zoomRevenueSeries || zoomRevenueSeries.length === 0) return []
    if (!comparePrevious) return zoomRevenueSeries
    try {
      return buildPreviousPeriodRevenueSeries(zoomRevenueRange, zoomRevenueSeries)
    } catch (err){
      console.warn('[useDashboardData]', err)
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
      const d = subDays(todayDate, i)
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
    sevenDaysStats,
    monthDelta,
    monthDeltaTone,
    monthDeltaPct,
    incomeDeltaPct,
    expenseDeltaPct,
    portfolioValue,
    cashBalance,
    totalSavings,
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
    miniNetWorthGrowth,
    zoomNetWorthGrowth,
    zoomPeakAndFloor,
    assetBreakdownData,
    zoomCombinedChartSeries,
    comparePrevious,
    setComparePrevious,
    comparisonSummary,
    zoomTooltipDismissed,
    setZoomTooltipDismissed,
    isCoarsePointer,
    computeRevenueValue,
  }
}
