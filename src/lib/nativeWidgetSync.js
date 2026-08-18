import { Capacitor } from '@capacitor/core'
import { formatCurrency } from './utils'

/**
 * Sync active financial summary to Android Native Home Screen Widget
 * @param {object} params
 * @param {number} params.totalBalance
 * @param {number} params.monthIncome
 * @param {number} params.monthExpense
 * @param {string} params.defaultCurrency
 */
export async function syncNativeWidgetData({ totalBalance = 0, monthIncome = 0, monthExpense = 0, defaultCurrency = 'IDR' }) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return
  }

  try {
    const formattedBalance = formatCurrency(totalBalance, defaultCurrency)
    const formattedIncome = `Masuk: ${formatCurrency(monthIncome, defaultCurrency)}`
    const formattedExpense = `Keluar: ${formatCurrency(monthExpense, defaultCurrency)}`

    localStorage.setItem('fintrack_widget_balance', formattedBalance)
    localStorage.setItem('fintrack_widget_income', formattedIncome)
    localStorage.setItem('fintrack_widget_expense', formattedExpense)
  } catch {
    // Non-blocking fallback
  }
}

export default syncNativeWidgetData
