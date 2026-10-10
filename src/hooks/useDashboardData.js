import { useState, useEffect, useMemo, useCallback } from 'react'
import { format, startOfMonth, subMonths, subDays } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { getAllWalletBalances } from '../lib/balanceEngine'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import { convertCurrency, FALLBACK_EXCHANGE_RATES, toSafeNumber } from '../lib/utils'
import { getBudgetPeriodDateRange, getCurrentBudgetMonthKey } from '../lib/budgetUtils'
import useTranslation from './useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import { calculateGlobalWeeklyTrend } from '../lib/habitStats'
import { warmupDecryptionCache } from '../lib/fieldEncryption'
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

export {
  calculateChartData,
  calculateSevenDaysStats,
  buildRevenueSeries as buildRevenueSeriesHelper,
  buildPreviousPeriodRevenueSeries as buildPreviousPeriodRevenueSeriesHelper,
  calculateRangedSummaryStats,
  calculateZoomPeakAndFloor,
  calculateComparisonSummary,
} from './dashboard/chartSlices'

export {
  calculateLoanSummary,
} from './dashboard/loanSlice'

export {
  calculateTotalSavings,
  calculateBudgetGoalSummary,
} from './dashboard/budgetGoalSlice'

export {
  calculateTotalWalletBalance,
  calculatePortfolioStats,
  calculateTodayStats,
  computeCashBalanceBeforeDateHelper,
  calculateAssetBreakdown,
} from './dashboard/assetBreakdownSlice'

export {
  calculateMonthStats,
} from './dashboard/monthStatsSlice'

import {
  getSavedNetWorthRange,
  cachedDashboardState,
} from './dashboard/dashboardCache'

import {
  calculateRangeNetWorthGrowth,
} from './dashboard/dashboardStats'

import {
  calculateChartData,
  calculateSevenDaysStats,
  buildRevenueSeries as buildRevenueSeriesHelper,
  buildPreviousPeriodRevenueSeries as buildPreviousPeriodRevenueSeriesHelper,
  calculateRangedSummaryStats,
  calculateZoomPeakAndFloor,
  calculateComparisonSummary,
} from './dashboard/chartSlices'

import {
  calculateLoanSummary,
} from './dashboard/loanSlice'

import {
  calculateTotalSavings,
  calculateBudgetGoalSummary,
} from './dashboard/budgetGoalSlice'

import {
  calculateTotalWalletBalance,
  calculatePortfolioStats,
  calculateTodayStats,
  computeCashBalanceBeforeDateHelper,
  calculateAssetBreakdown,
} from './dashboard/assetBreakdownSlice'

import {
  calculateMonthStats,
} from './dashboard/monthStatsSlice'

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
  const isMultiYear = zoomRevenueRange === '1y' || miniRevenueRange === '1y'
  const cutoffMonths = isMultiYear ? 24 : 12
  const txCutoffDate = format(subMonths(startOfMonth(new Date()), cutoffMonths), 'yyyy-MM-dd')
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
    return calculateTotalWalletBalance(walletsWithBalance, defaultCurrency, rates)
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
    return transactions
      .filter((tx) => tx && tx.isPendingReview !== true && tx.isPendingReview !== 1)
      .map((tx) => {
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
    return calculateMonthStats({
      transactions,
      investments,
      currentMonthKey,
      budgetCycleStartDay,
      locale,
      currentPeriod,
      normalizedTransactions,
      defaultCurrency,
      rates,
    })
  }, [transactions, investments, currentMonthKey, budgetCycleStartDay, locale, currentPeriod, normalizedTransactions, defaultCurrency, rates])

  const portfolioStats = useMemo(() => {
    return calculatePortfolioStats(investments, defaultCurrency, rates)
  }, [investments, defaultCurrency, rates])

  const recentTransactions = useMemo(() => {
    if (transactions === null || transactions === undefined) {
      return null
    }
    return [...(transactions ?? [])]
      .filter((tx) => tx.isPendingReview !== true && tx.isPendingReview !== 1)
      .sort((a, b) => {
        const byDate = String(b.date || '').localeCompare(String(a.date || ''))
        if (byDate !== 0) return byDate
        const byCreatedAt = Number(b.createdAt || 0) - Number(a.createdAt || 0)
        if (byCreatedAt !== 0) return byCreatedAt
        return String(b.id || '').localeCompare(String(a.id || ''))
      })
  }, [transactions])

  useEffect(() => {
    if (recentTransactions && recentTransactions.length > 0) {
      warmupDecryptionCache(recentTransactions.slice(0, 10))
    }
  }, [recentTransactions])

  const todayStats = useMemo(() => {
    if (transactions === null || transactions === undefined) {
      return { todayNet: 0, todayIncome: 0 }
    }
    return calculateTodayStats(normalizedTransactions, defaultCurrency, rates)
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
    return calculateChartData({
      normalizedTransactions,
      activeWalletIdSet,
      walletCurrencyMap,
      defaultCurrency,
      rates,
    })
  }, [transactions, normalizedTransactions, activeWalletIdSet, defaultCurrency, rates, walletCurrencyMap])

  const { data1w } = chartData

  const sevenDaysStats = useMemo(() => {
    return calculateSevenDaysStats(data1w)
  }, [data1w])

  const loanSummary = useMemo(() => {
    return calculateLoanSummary(loans, defaultCurrency, rates)
  }, [loans, defaultCurrency, rates])

  const totalSavings = useMemo(() => {
    return calculateTotalSavings(goals, defaultCurrency, rates)
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
      const dateKey = tx.date ? String(tx.date).slice(0, 10) : 'Unknown'
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(tx)
    })
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [recentTransactions])

  const budgetGoalSummary = useMemo(() => {
    return calculateBudgetGoalSummary({
      budgets,
      goals,
      currentMonthKey,
      budgetCycleStartDay,
      locale,
      normalizedTransactions,
      defaultCurrency,
      rates,
    })
  }, [budgets, goals, currentMonthKey, budgetCycleStartDay, locale, normalizedTransactions, defaultCurrency, rates])

  const computeCashBalanceBeforeDate = useCallback(
    (dateKey) => {
      return computeCashBalanceBeforeDateHelper({
        dateKey,
        normalizedTransactions,
        totalWalletBalance,
        activeWalletIdSet,
        walletCurrencyMap,
        defaultCurrency,
        rates,
      })
    },
    [normalizedTransactions, totalWalletBalance, activeWalletIdSet, walletCurrencyMap, defaultCurrency, rates],
  )

  const buildRevenueSeries = useCallback(
    (rangeId) => {
      return buildRevenueSeriesHelper({
        rangeId,
        chartData,
        computeCashBalanceBeforeDate,
        portfolioValue,
        netLoanPosition,
        totalSavings,
        normalizedTransactions,
        activeWalletIdSet,
        walletCurrencyMap,
        defaultCurrency,
        rates,
      })
    },
    [
      chartData,
      computeCashBalanceBeforeDate,
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
    return calculateRangedSummaryStats({
      range: zoomRevenueRange,
      todayIncome,
      todayStats,
      chartData,
    })
  }, [zoomRevenueRange, todayIncome, todayStats, chartData])

  const miniNetWorthGrowth = useMemo(() => {
    return calculateRangeNetWorthGrowth(miniRevenueRange, netWorth, chartData, todayStats)
  }, [miniRevenueRange, netWorth, chartData, todayStats])

  const zoomNetWorthGrowth = useMemo(() => {
    return calculateRangeNetWorthGrowth(zoomRevenueRange, netWorth, chartData, todayStats)
  }, [zoomRevenueRange, netWorth, chartData, todayStats])

  const netWorthGrowth = miniNetWorthGrowth

  const buildPreviousPeriodRevenueSeries = useCallback(
    (rangeId, currentSeries) => {
      return buildPreviousPeriodRevenueSeriesHelper({
        rangeId,
        currentSeries,
        normalizedTransactions,
        computeCashBalanceBeforeDate,
        portfolioValue,
        netLoanPosition,
        totalSavings,
      })
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
    return calculateComparisonSummary(zoomCombinedChartSeries, comparePrevious)
  }, [comparePrevious, zoomCombinedChartSeries])

  const zoomPeakAndFloor = useMemo(() => {
    return calculateZoomPeakAndFloor({
      zoomRevenueSeries,
      net: rangedSummaryStats.net,
      zoomRevenueRange,
    })
  }, [zoomRevenueSeries, rangedSummaryStats.net, zoomRevenueRange])

  const assetBreakdownData = useMemo(() => {
    return calculateAssetBreakdown(walletsWithBalance, defaultCurrency, rates)
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
    todayStats,
  }
}
