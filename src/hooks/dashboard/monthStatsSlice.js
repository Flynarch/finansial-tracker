import { format, subMonths } from 'date-fns'
import { getBudgetPeriodDateRange } from '../../lib/budgetUtils'
import { roundCurrency } from '../../lib/utils'
import { calculatePeriodStats } from './dashboardStats'

/**
 * Pure calculation slice for period comparisons, MoM delta percentages, and income/expense totals.
 */
export function calculateMonthStats({
  transactions,
  investments,
  currentMonthKey,
  budgetCycleStartDay = 1,
  locale = 'id',
  currentPeriod,
  normalizedTransactions = [],
  defaultCurrency = 'IDR',
  rates = null,
}) {
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
  const now = new Date()
  const isCurrentMonth = format(now, 'yyyy-MM') === currentMonthKey
  const currentDay = Math.max(1, now.getDate())
  const daysInCurrentMonth = new Date(cYear, cMonth, 0).getDate()
  const isEarlyMonth = isCurrentMonth && currentDay <= 3

  return {
    monthIncome: thisMonth.income,
    monthExpense: thisMonth.expense,
    monthDelta,
    monthDeltaTone: monthDelta >= 0 ? 'success' : 'danger',
    monthDeltaPct: thisMonth.income > 0 ? roundCurrency((monthDelta / thisMonth.income) * 100) : 0,
    incomeDeltaPct: isEarlyMonth
      ? thisMonth.income > 0 && lastMonth.income > 0
        ? roundCurrency(
            (((thisMonth.income / currentDay) * daysInCurrentMonth - lastMonth.income) /
              lastMonth.income) *
              100,
          )
        : 0
      : lastMonth.income > 0
      ? roundCurrency(((thisMonth.income - lastMonth.income) / lastMonth.income) * 100)
      : thisMonth.income > 0
      ? 100
      : 0,
    expenseDeltaPct: isEarlyMonth
      ? thisMonth.expense > 0 && lastMonth.expense > 0
        ? roundCurrency(
            (((thisMonth.expense / currentDay) * daysInCurrentMonth - lastMonth.expense) /
              lastMonth.expense) *
              100,
          )
        : 0
      : lastMonth.expense > 0
      ? roundCurrency(((thisMonth.expense - lastMonth.expense) / lastMonth.expense) * 100)
      : thisMonth.expense > 0
      ? 100
      : 0,
  }
}
