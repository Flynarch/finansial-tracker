import { convertCurrency, isExcludeAnalyticsTx, toSafeNumber } from './utils'
import { parseExpenseCategoryPath } from './expenseCategories'

export function normalizeCategoryKey(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function isTxMatchingBudget(budgetCategory, txCategory) {
  const b = normalizeCategoryKey(budgetCategory)
  const raw = normalizeCategoryKey(txCategory)
  if (!b || !raw) return false
  if (raw === b) return true

  // Parent / Child path matching (e.g. "makanan_minuman" matches "makanan_minuman/restoran")
  if (raw.startsWith(`${b}/`)) return true
  if (b.startsWith(`${raw}/`)) return true

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

  return monthExpenseTxs.reduce((sum, tx) => {
    if (isExcludeAnalyticsTx(tx)) return sum
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
}
