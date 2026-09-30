import { Capacitor } from '@capacitor/core'
import { format, subDays } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'
import { formatCurrency, formatCompactCurrency, isExcludeAnalyticsTx, convertCurrency, FALLBACK_EXCHANGE_RATES } from './utils'
import { getCachedCurrencyRates } from './api'
import { FinTrackNotificationPlugin } from './notificationIngestion'
import { db, computeAllWalletBalances } from './db'
import { getCurrentBudgetMonthKey, getBudgetPeriodDateRange } from './budgetUtils'
import useSettingsStore from '../store/useSettingsStore'

let syncDebounceTimer = null

/**
 * Low-level call to sync pre-computed financial summary to Android Native Home Screen Widget
 * @param {object} params
 * @param {number|string} [params.totalBalance]
 * @param {number|string} [params.monthIncome]
 * @param {number|string} [params.monthExpense]
 * @param {string} [params.defaultCurrency]
 * @param {string} [params.period]
 * @param {string} [params.dateText]
 * @param {number[]} [params.sparklinePoints]
 * @param {string[]} [params.sparklineDates]
 * @param {number|null} [params.todayNet]
 * @param {string|null} [params.todayNetFormatted]
 */
export async function syncNativeWidgetData({
  totalBalance = 0,
  monthIncome = 0,
  monthExpense = 0,
  defaultCurrency = 'IDR',
  period = 'Bulan Ini',
  dateText: customDateText = null,
  sparklinePoints = [],
  sparklineDates = [],
  incomeSparklinePoints = [],
  expenseSparklinePoints = [],
  topCategories = [],
  todayNet = null,
  todayNetFormatted = null,
} = {}) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return
  }

  try {
    const locale = useSettingsStore?.getState?.()?.locale || 'id'
    const isEn = locale === 'en'
    const dateLocale = isEn ? enUS : idLocale

    const cleanBalNum = typeof totalBalance === 'number' ? totalBalance : Number(totalBalance) || 0
    const cleanIncNum = typeof monthIncome === 'number' ? monthIncome : Number(monthIncome) || 0
    const cleanExpNum = typeof monthExpense === 'number' ? monthExpense : Number(monthExpense) || 0

    const formattedBalance = formatCurrency(cleanBalNum, defaultCurrency, locale)
    const incomePrefix = isEn ? 'In: ' : 'Masuk: '
    const expensePrefix = isEn ? 'Out: ' : 'Keluar: '
    const incomeValue = cleanIncNum > 0 ? `+${formatCurrency(cleanIncNum, defaultCurrency, locale)}` : formatCurrency(cleanIncNum, defaultCurrency, locale)
    const expenseValue = cleanExpNum > 0 ? `-${formatCurrency(cleanExpNum, defaultCurrency, locale)}` : formatCurrency(cleanExpNum, defaultCurrency, locale)
    const formattedIncome = `${incomePrefix}${incomeValue}`
    const formattedExpense = `${expensePrefix}${expenseValue}`
    const effectivePeriod = period || (isEn ? 'This Month' : 'Bulan Ini')
    const dateText = customDateText || format(new Date(), 'EEEE, d MMM', { locale: dateLocale })
    const btnText = isEn ? '+ Add' : '+ Catat'
    const balanceLabel = isEn ? 'Net Worth' : 'Kekayaan Bersih'
    const safePoints = Array.isArray(sparklinePoints) ? sparklinePoints.map((p) => Number(p) || 0) : []
    const sparklineJson = JSON.stringify(safePoints)
    const safeIncomePoints = Array.isArray(incomeSparklinePoints) ? incomeSparklinePoints.map((p) => Number(p) || 0) : []
    const safeExpensePoints = Array.isArray(expenseSparklinePoints) ? expenseSparklinePoints.map((p) => Number(p) || 0) : []
    const sparklineIncomeJson = JSON.stringify(safeIncomePoints)
    const sparklineExpenseJson = JSON.stringify(safeExpensePoints)
    const safeCategories = Array.isArray(topCategories) ? topCategories : []
    const topCategoriesJson = JSON.stringify(safeCategories)

    let safeDates = Array.isArray(sparklineDates) ? sparklineDates.map((d) => String(d)) : []
    if (safeDates.length === 0 && safePoints.length > 0) {
      const len = safePoints.length
      safeDates = Array.from({ length: len }, (_, idx) => {
        const d = subDays(new Date(), len - 1 - idx)
        return format(d, 'd')
      })
    }
    const sparklineDatesJson = JSON.stringify(safeDates)

    let cleanTodayNetVal = 0
    let formattedTodayNet = ''
    if (todayNet != null && !isNaN(Number(todayNet))) {
      cleanTodayNetVal = Number(todayNet)
      const absVal = Math.abs(cleanTodayNetVal)
      const compact = formatCompactCurrency(absVal, defaultCurrency, locale, true)
      if (cleanTodayNetVal > 0) {
        formattedTodayNet = `+${compact}`
      } else if (cleanTodayNetVal < 0) {
        formattedTodayNet = `-${compact}`
      } else {
        formattedTodayNet = formatCurrency(0, defaultCurrency, locale)
      }
    } else if (todayNetFormatted) {
      formattedTodayNet = todayNetFormatted
      cleanTodayNetVal = safePoints.length > 0 ? safePoints[safePoints.length - 1] : 0
    } else if (safePoints.length > 0) {
      cleanTodayNetVal = safePoints[safePoints.length - 1]
      const absVal = Math.abs(cleanTodayNetVal)
      const compact = formatCompactCurrency(absVal, defaultCurrency, locale, true)
      formattedTodayNet = cleanTodayNetVal > 0 ? `+${compact}` : cleanTodayNetVal < 0 ? `-${compact}` : formatCurrency(0, defaultCurrency, locale)
    } else {
      formattedTodayNet = formatCurrency(0, defaultCurrency, locale)
    }

    // Fallback in web storage for debugging
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fintrack_widget_balance', formattedBalance)
        localStorage.setItem('fintrack_widget_income', formattedIncome)
        localStorage.setItem('fintrack_widget_expense', formattedExpense)
        localStorage.setItem('fintrack_widget_income_val', incomeValue)
        localStorage.setItem('fintrack_widget_expense_val', expenseValue)
        localStorage.setItem('fintrack_widget_date', dateText)
        localStorage.setItem('fintrack_widget_period', effectivePeriod)
        localStorage.setItem('fintrack_widget_sparkline', sparklineJson)
        localStorage.setItem('fintrack_widget_sparkline_income', sparklineIncomeJson)
        localStorage.setItem('fintrack_widget_sparkline_expense', sparklineExpenseJson)
        localStorage.setItem('fintrack_widget_top_categories', topCategoriesJson)
        localStorage.setItem('fintrack_widget_sparkline_dates', sparklineDatesJson)
        localStorage.setItem('fintrack_widget_today_net', formattedTodayNet)
        localStorage.setItem('fintrack_widget_today_net_val', String(cleanTodayNetVal))
        localStorage.setItem('fintrack_widget_btn_text', btnText)
        localStorage.setItem('fintrack_widget_balance_label', balanceLabel)
      }
    } catch (err){
      console.warn('[nativeWidgetSync]', err)
      /* ignore */
    }

    // Call native Android plugin to update SharedPreferences and trigger AppWidgetManager
    await FinTrackNotificationPlugin.updateWidgetData({
      balance: formattedBalance,
      totalBalance: formattedBalance,
      total_net_worth: formattedBalance,
      wallet_balance: formattedBalance,
      income: formattedIncome,
      monthIncome: formattedIncome,
      incomeValue,
      expense: formattedExpense,
      monthExpense: formattedExpense,
      expenseValue,
      dateText,
      period: effectivePeriod,
      sparklineData: sparklineJson,
      sparklinePoints: safePoints,
      sparklineIncome: sparklineIncomeJson,
      sparklineExpense: sparklineExpenseJson,
      topCategories: topCategoriesJson,
      topCategoriesJson,
      sparklineDates: safeDates,
      sparklineDatesJson,
      todayNet: formattedTodayNet,
      todayNetFormatted: formattedTodayNet,
      todayNetVal: cleanTodayNetVal,
      btnText,
      balanceLabel,
    })
  } catch (err) {
    // Non-blocking fallback
    console.debug('Failed to sync native widget data:', err)
  }
}

/**
 * Aggregates all ledger balances & current month statistics directly from Dexie DB
 * and triggers an immediate Android home screen widget refresh.
 */
export async function syncNativeWidgetFromDb() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return
  }

  try {
    const settings = useSettingsStore?.getState?.() || {}
    const defaultCurrency = settings.defaultCurrency || 'IDR'
    const locale = settings.locale || 'id'
    const isEn = locale === 'en'
    const activeRates = getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }

    const wallets = await db.wallets.toArray()
    const allTxs = (await db.transactions.toArray()).filter((tx) => !tx.deletedAt)
    const computedWallets = computeAllWalletBalances(wallets, allTxs, activeRates)

    const totalBalance = computedWallets
      .filter((w) => !w.isArchived)
      .reduce((sum, w) => sum + convertCurrency(Number(w.currentBalance) || 0, w.currency || defaultCurrency, defaultCurrency, activeRates), 0)

    const budgetCycleStartDay = settings.budgetCycleStartDay || 1
    const currentMonthKey = getCurrentBudgetMonthKey(new Date(), budgetCycleStartDay)
    const budgetPeriod = getBudgetPeriodDateRange(currentMonthKey, budgetCycleStartDay)
    const periodLabel = isEn ? 'This Month' : 'Bulan Ini'
    let monthIncome = 0
    let monthExpense = 0
    const categoryExpenseMap = {}

    for (const tx of allTxs) {
      if (!tx?.date || tx.deletedAt || tx.isPendingReview === true || tx.isPendingReview === 1 || tx.date < budgetPeriod.startDate || tx.date > budgetPeriod.endDate) continue

      const txCurrency = tx.currency || defaultCurrency
      if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
        for (const item of tx.splitItems) {
          const itemTx = {
            ...tx,
            ...item,
            category: item.category || tx.category,
            amount: item.amount,
            type: item.type || tx.type,
            currency: item.currency || txCurrency,
            isExcludeAnalyticsTx: Boolean(item.isExcludeAnalyticsTx),
            isExcludeFromAnalytics: Boolean(item.isExcludeFromAnalytics || item.excludeFromAnalytics),
            excludeFromAnalytics: Boolean(item.excludeFromAnalytics || item.isExcludeFromAnalytics),
          }
          if (isExcludeAnalyticsTx(itemTx)) continue
          const amt = convertCurrency(Number(item.amount) || 0, item.currency || txCurrency, defaultCurrency, activeRates)
          const itemType = item.type || tx.type
          if (itemType === 'income') {
            monthIncome += amt
          } else if (itemType === 'expense') {
            monthExpense += amt
            const catName = itemTx.category || (isEn ? 'Other' : 'Lainnya')
            categoryExpenseMap[catName] = (categoryExpenseMap[catName] || 0) + amt
          }
        }
      } else {
        if (isExcludeAnalyticsTx(tx)) continue
        const amt = convertCurrency(Number(tx.amount) || 0, txCurrency, defaultCurrency, activeRates)
        if (tx.type === 'income') {
          monthIncome += amt
        } else if (tx.type === 'expense') {
          monthExpense += amt
          const catName = tx.category || (isEn ? 'Other' : 'Lainnya')
          categoryExpenseMap[catName] = (categoryExpenseMap[catName] || 0) + amt
        }
      }
    }

    // Generate 30-day sparkline trend data & cash flow metrics
    const now = new Date()
    const sparklinePoints = []
    const incomeSparklinePoints = []
    const expenseSparklinePoints = []
    const sparklineDates = []
    let sevenDaysIncome = 0
    let sevenDaysExpense = 0
    let todayNet = 0

    // Pre-index transactions by day for maximum efficiency
    const dayMetricsMap = new Map()
    for (const tx of allTxs) {
      if (!tx || tx.isPendingReview === true || tx.isPendingReview === 1 || !tx.date) continue
      const dateKey = tx.date.slice(0, 10)
      const txCurrency = tx.currency || defaultCurrency

      if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
        for (const item of tx.splitItems) {
          const itemTx = {
            ...tx,
            ...item,
            category: item.category || tx.category,
            amount: item.amount,
            type: item.type || tx.type,
            currency: item.currency || txCurrency,
            isExcludeAnalyticsTx: Boolean(item.isExcludeAnalyticsTx),
            isExcludeFromAnalytics: Boolean(item.isExcludeFromAnalytics || item.excludeFromAnalytics),
            excludeFromAnalytics: Boolean(item.excludeFromAnalytics || item.isExcludeFromAnalytics),
          }
          if (isExcludeAnalyticsTx(itemTx)) continue
          const amt = convertCurrency(Number(item.amount) || 0, item.currency || txCurrency, defaultCurrency, activeRates)
          const itemType = item.type || tx.type
          const current = dayMetricsMap.get(dateKey) || { income: 0, expense: 0, net: 0 }
          if (itemType === 'income') {
            current.income += amt
            current.net += amt
          } else if (itemType === 'expense') {
            current.expense += amt
            current.net -= amt
          }
          dayMetricsMap.set(dateKey, current)
        }
      } else {
        if (isExcludeAnalyticsTx(tx)) continue
        const amt = convertCurrency(Number(tx.amount) || 0, txCurrency, defaultCurrency, activeRates)
        const current = dayMetricsMap.get(dateKey) || { income: 0, expense: 0, net: 0 }
        if (tx.type === 'income') {
          current.income += amt
          current.net += amt
        } else if (tx.type === 'expense') {
          current.expense += amt
          current.net -= amt
        }
        dayMetricsMap.set(dateKey, current)
      }
    }

    const widgetRange = settings.widgetRange || '7d'
    const isSevenDays = widgetRange === '7d'
    const daysCount = isSevenDays ? 7 : 30

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = subDays(now, i)
      const dStr = format(d, 'yyyy-MM-dd')
      sparklineDates.push(format(d, 'd'))
      const metric = dayMetricsMap.get(dStr) || { income: 0, expense: 0, net: 0 }

      sparklinePoints.push(metric.net)
      incomeSparklinePoints.push(metric.income)
      expenseSparklinePoints.push(metric.expense)

      if (i < 7) {
        sevenDaysIncome += metric.income
        sevenDaysExpense += metric.expense
      }
      if (i === 0) {
        todayNet = metric.net
      }
    }

    // Top 3 categories
    const sortedCats = Object.entries(categoryExpenseMap)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)

    const defaultPalette = ['#10B981', '#06B6D4', '#F59E0B']
    const totalExp = monthExpense > 0 ? monthExpense : 1
    const topCategories = sortedCats.slice(0, 3).map((cat, idx) => ({
      name: cat.name,
      amount: cat.amount,
      percentage: Math.max(5, Math.round((cat.amount / totalExp) * 100)),
      color: defaultPalette[idx] || '#64748B',
      amountFormatted: formatCompactCurrency(cat.amount, defaultCurrency, locale, true),
    }))

    if (topCategories.length === 0) {
      topCategories.push(
        { name: isEn ? 'Food' : 'Makan', percentage: 45, color: '#10B981', amountFormatted: formatCompactCurrency(0, defaultCurrency, locale, true) },
        { name: isEn ? 'Transport' : 'Transportasi', percentage: 30, color: '#06B6D4', amountFormatted: formatCompactCurrency(0, defaultCurrency, locale, true) },
        { name: isEn ? 'Shopping' : 'Belanja', percentage: 25, color: '#F59E0B', amountFormatted: formatCompactCurrency(0, defaultCurrency, locale, true) }
      )
    }

    const effectiveIncome = isSevenDays ? sevenDaysIncome : monthIncome
    const effectiveExpense = isSevenDays ? sevenDaysExpense : monthExpense
    const effectivePeriod = isSevenDays
      ? (isEn ? 'Last 7 Days' : '7 Hari Terakhir')
      : periodLabel

    await syncNativeWidgetData({
      totalBalance,
      monthIncome: effectiveIncome,
      monthExpense: effectiveExpense,
      defaultCurrency,
      period: effectivePeriod,
      sparklinePoints,
      incomeSparklinePoints,
      expenseSparklinePoints,
      topCategories,
      sparklineDates,
      todayNet,
    })
  } catch (err) {
    console.error('[nativeWidgetSync] Failed to sync widget from DB:', err)
  }
}

/**
 * Debounced helper to schedule widget synchronization on ledger mutations
 * @param {number} [delay=250]
 */
export function scheduleNativeWidgetSync(delay = 250) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return
  }
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer)
  }
  syncDebounceTimer = setTimeout(() => {
    syncDebounceTimer = null
    syncNativeWidgetFromDb().catch((err) => {
      console.error('[nativeWidgetSync] Scheduled sync failed:', err)
    })
  }, delay)
}

export const syncNativeWidget = scheduleNativeWidgetSync

export default syncNativeWidgetData
