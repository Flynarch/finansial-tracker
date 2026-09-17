import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'
import { convertCurrency, isExcludeAnalyticsTx, toSafeNumber } from './utils'
import { parseExpenseCategoryPath } from './expenseCategories'

/**
 * Returns the budget month key ('yyyy-MM') taking into account payday cycle start day.
 * If startDay > 1 and date.getDate() >= startDay, return format(addMonths(date, 1), 'yyyy-MM'),
 * otherwise format(date, 'yyyy-MM').
 * @param {Date} [date=new Date()]
 * @param {number} [startDay=1]
 * @returns {string} - 'yyyy-MM'
 */
export function getCurrentBudgetMonthKey(date = new Date(), startDay = 1) {
  const safeDate = date instanceof Date && !isNaN(date.getTime()) ? date : new Date()
  const safeDay = Math.min(28, Math.max(1, Math.floor(Number(startDay) || 1)))
  if (safeDay > 1 && safeDate.getDate() >= safeDay) {
    return format(addMonths(safeDate, 1), 'yyyy-MM')
  }
  return format(safeDate, 'yyyy-MM')
}

export function normalizeCategoryKey(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function isTxMatchingBudget(budgetCategory, txCategory) {
  const b = normalizeCategoryKey(budgetCategory)
  const raw = normalizeCategoryKey(txCategory)
  if (b === 'all' || b === 'semua' || raw === b) return true

  // Parent / Child path matching (e.g. "makanan_minuman" matches "makanan_minuman/restoran")
  if (raw.startsWith(`${b}/`)) return true

  const parsedTx = parseExpenseCategoryPath(txCategory)
  const parsedB = parseExpenseCategoryPath(budgetCategory)

  if (parsedTx && parsedB) {
    if (parsedTx.parent?.id && parsedB.parent?.id && parsedTx.parent.id.toLowerCase() === parsedB.parent.id.toLowerCase()) {
      if (!parsedB.child || (parsedTx.child?.id && parsedTx.child.id.toLowerCase() === parsedB.child.id.toLowerCase())) {
        return true
      }
    }
  }

  return false
}

export function calculateBudgetSpent(budgetCategory, monthExpenseTxs, defaultCurrency = 'IDR', rates = null) {
  if (!budgetCategory || !Array.isArray(monthExpenseTxs)) return 0

  const total = monthExpenseTxs.reduce((sum, tx) => {
    if (!tx || tx.isPendingReview === true || tx.isPendingReview === 1) return sum

    if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
      let splitSum = 0
      tx.splitItems.forEach((item) => {
        const itemType = item.type || tx.type
        if (itemType !== 'expense') return
        const itemTx = {
          ...tx,
          ...item,
          category: item.category || tx.category,
          isExcludeFromAnalytics: Boolean(item.isExcludeFromAnalytics || item.excludeFromAnalytics),
          excludeFromAnalytics: Boolean(item.excludeFromAnalytics || item.isExcludeFromAnalytics),
          isExcludeAnalyticsTx: Boolean(item.isExcludeAnalyticsTx),
        }
        if (isExcludeAnalyticsTx(itemTx)) return
        if (isTxMatchingBudget(budgetCategory, item.category || tx.category)) {
          splitSum += convertCurrency(
            toSafeNumber(item.amount),
            item.currency || tx.currency || defaultCurrency,
            defaultCurrency,
            rates,
          )
        }
      })
      return sum + splitSum
    }

    if (isExcludeAnalyticsTx(tx)) return sum
    if (tx.type !== 'expense') return sum
    if (!isTxMatchingBudget(budgetCategory, tx.category)) return sum

    return (
      sum +
      convertCurrency(
        toSafeNumber(tx.amount),
        tx.currency || defaultCurrency,
        defaultCurrency,
        rates,
      )
    )
  }, 0)

  return Math.round(total * 100) / 100
}

/**
 * Calculate the date range for a given budget month and custom start day (payday cycle).
 * @param {string} monthStr - Month in 'yyyy-MM' format (e.g. '2026-03')
 * @param {number} [startDay=1] - Cycle start day (1-28). Default 1.
 * @param {string} [locale='id'] - 'id' or 'en'
 * @returns {{ startDate: string, endDate: string, label: string, isCustomCycle: boolean }}
 */
export function getBudgetPeriodDateRange(monthStr, startDay = 1, locale = 'id') {
  const safeDay = Math.min(28, Math.max(1, Math.floor(Number(startDay) || 1)))
  const dateLocale = String(locale || '').toLowerCase().startsWith('en') ? enUS : idLocale

  let targetYear = new Date().getFullYear()
  let targetMonthIndex = new Date().getMonth()

  if (typeof monthStr === 'string' && monthStr.includes('-')) {
    const parts = monthStr.split('-')
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10) - 1
    if (!isNaN(y) && !isNaN(m) && m >= 0 && m <= 11) {
      targetYear = y
      targetMonthIndex = m
    }
  }

  if (safeDay <= 1) {
    const d = new Date(targetYear, targetMonthIndex, 1)
    const start = startOfMonth(d)
    const end = endOfMonth(d)
    const startDate = format(start, 'yyyy-MM-dd')
    const endDate = format(end, 'yyyy-MM-dd')
    const label = `${format(start, 'd MMM', { locale: dateLocale })} - ${format(end, 'd MMM yyyy', { locale: dateLocale })}`
    return { startDate, endDate, label, isCustomCycle: false }
  }

  // Payday cycle: starts on safeDay of previous month, ends on (safeDay - 1) of target month
  const start = new Date(targetYear, targetMonthIndex - 1, safeDay)
  const end = new Date(targetYear, targetMonthIndex, safeDay - 1)
  const startDate = format(start, 'yyyy-MM-dd')
  const endDate = format(end, 'yyyy-MM-dd')
  const label = `${format(start, 'd MMM', { locale: dateLocale })} - ${format(end, 'd MMM yyyy', { locale: dateLocale })}`

  return { startDate, endDate, label, isCustomCycle: true }
}

