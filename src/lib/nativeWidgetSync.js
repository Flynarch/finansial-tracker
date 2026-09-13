import { Capacitor } from '@capacitor/core'
import { formatCurrency } from './utils'
import { FinTrackNotificationPlugin } from './notificationIngestion'

/**
 * Sync active financial summary to Android Native Home Screen Widget
 * @param {object} params
 * @param {number} params.totalBalance
 * @param {number} params.monthIncome
 * @param {number} params.monthExpense
 * @param {string} params.defaultCurrency
 * @param {string} params.period
 * @param {number[]} [params.sparklinePoints]
 */
export async function syncNativeWidgetData({
  totalBalance = 0,
  monthIncome = 0,
  monthExpense = 0,
  defaultCurrency = 'IDR',
  period = 'Bulan Ini',
  sparklinePoints = [],
}) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return
  }

  try {
    const formattedBalance = formatCurrency(totalBalance, defaultCurrency)
    const formattedIncome = `Masuk: ${formatCurrency(monthIncome, defaultCurrency)}`
    const formattedExpense = `Keluar: ${formatCurrency(monthExpense, defaultCurrency)}`
    const safePoints = Array.isArray(sparklinePoints) ? sparklinePoints.map((p) => Number(p) || 0) : []
    const sparklineJson = JSON.stringify(safePoints)

    // Fallback in web storage for debugging
    try {
      localStorage.setItem('fintrack_widget_balance', formattedBalance)
      localStorage.setItem('fintrack_widget_income', formattedIncome)
      localStorage.setItem('fintrack_widget_expense', formattedExpense)
      localStorage.setItem('fintrack_widget_period', period)
      localStorage.setItem('fintrack_widget_sparkline', sparklineJson)
    } catch {
      /* ignore */
    }

    // Call native Android plugin to update SharedPreferences and trigger AppWidgetManager
    await FinTrackNotificationPlugin.updateWidgetData({
      balance: formattedBalance,
      income: formattedIncome,
      expense: formattedExpense,
      period: period || 'Bulan Ini',
      sparklineData: sparklineJson,
    })
  } catch (err) {
    // Non-blocking fallback
    console.debug('Failed to sync native widget data:', err)
  }
}

export default syncNativeWidgetData

