import { getBudgetPeriodDateRange, calculateBudgetSpent } from '../../lib/budgetUtils'
import { convertCurrency, toSafeNumber } from '../../lib/utils'

/**
 * Calculates total savings accumulated across non-archived goals.
 */
export function calculateTotalSavings(goals = [], defaultCurrency = 'IDR', rates = null) {
  return (goals || [])
    .filter((g) => !g.isArchived)
    .reduce((sum, g) => {
      const amt = toSafeNumber(g.currentAmount)
      if (amt <= 0) return sum
      return sum + convertCurrency(amt, g.currency || defaultCurrency, defaultCurrency, rates)
    }, 0)
}

/**
 * Pure calculation slice for category budget consumption and savings goal progress metrics.
 */
export function calculateBudgetGoalSummary({
  budgets = [],
  goals = [],
  currentMonthKey,
  budgetCycleStartDay = 1,
  locale = 'id',
  normalizedTransactions = [],
  defaultCurrency = 'IDR',
  rates = null,
}) {
  const safeBudgets = budgets ?? []
  const safeGoals = goals ?? []

  const budgetPeriod = getBudgetPeriodDateRange(currentMonthKey, budgetCycleStartDay, locale)
  const periodExpenseTxs = (normalizedTransactions || []).filter((tx) => {
    if (!tx?.date) return false
    const txDateStr = String(tx.date || '').slice(0, 10)
    return (
      txDateStr >= budgetPeriod.startDate &&
      txDateStr <= budgetPeriod.endDate &&
      (tx.type === 'expense' ||
        (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.some((si) => (si.type || tx.type) === 'expense')))
    )
  })

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
}
