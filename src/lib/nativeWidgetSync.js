import { Capacitor } from '@capacitor/core'
import { format, subDays } from 'date-fns'
import { formatCurrency, isExcludeAnalyticsTx, convertCurrency, FALLBACK_EXCHANGE_RATES } from './utils'
import { getCachedCurrencyRates } from './api'
import { FinTrackNotificationPlugin } from './notificationIngestion'
import { db, computeAllWalletBalances } from './db'
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
 * @param {number[]} [params.sparklinePoints]
 */
export async function syncNativeWidgetData({
  totalBalance = 0,
  monthIncome = 0,
  monthExpense = 0,
  defaultCurrency = 'IDR',
  period = 'Bulan Ini',
  sparklinePoints = [],
} = {}) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return
  }

  try {
    const cleanBalNum = typeof totalBalance === 'number' ? totalBalance : Number(totalBalance) || 0
    const cleanIncNum = typeof monthIncome === 'number' ? monthIncome : Number(monthIncome) || 0
    const cleanExpNum = typeof monthExpense === 'number' ? monthExpense : Number(monthExpense) || 0

    const formattedBalance = formatCurrency(cleanBalNum, defaultCurrency)
    const formattedIncome = `Masuk: ${formatCurrency(cleanIncNum, defaultCurrency)}`
    const formattedExpense = `Keluar: ${formatCurrency(cleanExpNum, defaultCurrency)}`
    const safePoints = Array.isArray(sparklinePoints) ? sparklinePoints.map((p) => Number(p) || 0) : []
    const sparklineJson = JSON.stringify(safePoints)

    // Fallback in web storage for debugging
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fintrack_widget_balance', formattedBalance)
        localStorage.setItem('fintrack_widget_income', formattedIncome)
        localStorage.setItem('fintrack_widget_expense', formattedExpense)
        localStorage.setItem('fintrack_widget_period', period)
        localStorage.setItem('fintrack_widget_sparkline', sparklineJson)
      }
    } catch {
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
      expense: formattedExpense,
      monthExpense: formattedExpense,
      period: period || 'Bulan Ini',
      sparklineData: sparklineJson,
      sparklinePoints: safePoints,
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
    const activeRates = getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }

    const wallets = await db.wallets.toArray()
    const allTxs = await db.transactions.toArray()
    const computedWallets = computeAllWalletBalances(wallets, allTxs, activeRates)

    const totalBalance = computedWallets
      .filter((w) => !w.isArchived)
      .reduce((sum, w) => sum + convertCurrency(Number(w.currentBalance) || 0, w.currency || defaultCurrency, defaultCurrency, activeRates), 0)

    const currentMonthPrefix = format(new Date(), 'yyyy-MM')
    let monthIncome = 0
    let monthExpense = 0

    for (const tx of allTxs) {
      const txDateStr = (tx.date || '').slice(0, 7)
      if (txDateStr === currentMonthPrefix && !isExcludeAnalyticsTx(tx)) {
        const txCurrency = tx.currency || defaultCurrency
        if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
          for (const item of tx.splitItems) {
            if (item.isExcludeFromAnalytics || item.excludeFromAnalytics) continue
            const amt = convertCurrency(Number(item.amount) || 0, txCurrency, defaultCurrency, activeRates)
            if (item.type === 'income') monthIncome += amt
            else if (item.type === 'expense') monthExpense += amt
          }
        } else {
          const amt = convertCurrency(Number(tx.amount) || 0, txCurrency, defaultCurrency, activeRates)
          if (tx.type === 'income') monthIncome += amt
          else if (tx.type === 'expense') monthExpense += amt
        }
      }
    }

    // Generate 7-day sparkline trend data
    const now = new Date()
    const sparklinePoints = []
    for (let i = 6; i >= 0; i--) {
      const d = subDays(now, i)
      const dStr = format(d, 'yyyy-MM-dd')
      let dayNet = 0
      for (const tx of allTxs) {
        if ((tx.date || '').slice(0, 10) === dStr && !isExcludeAnalyticsTx(tx)) {
          const txCurrency = tx.currency || defaultCurrency
          if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
            for (const item of tx.splitItems) {
              if (item.isExcludeFromAnalytics || item.excludeFromAnalytics) continue
              const amt = convertCurrency(Number(item.amount) || 0, txCurrency, defaultCurrency, activeRates)
              if (item.type === 'income') dayNet += amt
              else if (item.type === 'expense') dayNet -= amt
            }
          } else {
            const amt = convertCurrency(Number(tx.amount) || 0, txCurrency, defaultCurrency, activeRates)
            if (tx.type === 'income') dayNet += amt
            else if (tx.type === 'expense') dayNet -= amt
          }
        }
      }
      sparklinePoints.push(dayNet)
    }

    await syncNativeWidgetData({
      totalBalance,
      monthIncome,
      monthExpense,
      defaultCurrency,
      period: 'Bulan Ini',
      sparklinePoints,
    })
  } catch (err) {
    console.debug('Failed to sync widget from DB:', err)
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
    syncNativeWidgetFromDb().catch(() => {})
  }, delay)
}

export const syncNativeWidget = scheduleNativeWidgetSync

export default syncNativeWidgetData
