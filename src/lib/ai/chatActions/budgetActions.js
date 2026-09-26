import { db } from '../../db'
import useSettingsStore from '../../../store/useSettingsStore'
import { getCachedCurrencyRates } from '../../api'
import { FALLBACK_EXCHANGE_RATES } from '../../utils'
import { getMergedExpenseTree } from '../../expenseCategories'
import { sanitizeCategoryPath } from '../../categorySanitizer'
import { calculateBudgetSpent, getBudgetPeriodDateRange, getCurrentBudgetMonthKey } from '../../budgetUtils'

export async function handleBudgetAction(result, {
  locale,
  defaultCurrency,
}) {
  const newMsgs = []
  const budgets = await db.budgets.toArray()
  const allTxs = await db.transactions.toArray()
  const fuzzyMatch = (str, query) => str?.toLowerCase().includes((query || '').toLowerCase())
  const budgetCycleStartDay = useSettingsStore.getState().budgetCycleStartDay || 1
  const targetMonthKey = (result.month && /^\d{4}-\d{2}$/.test(String(result.month).trim()))
    ? String(result.month).trim()
    : getCurrentBudgetMonthKey(new Date(), budgetCycleStartDay)
  const period = getBudgetPeriodDateRange(targetMonthKey, budgetCycleStartDay, locale)
  const monthExpenseTxs = allTxs.filter((tx) => (tx.date || '') >= period.startDate && (tx.date || '') <= period.endDate)
  const activeRates = getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }

  const rawCategory = (result.category || '').trim()
  const isAllCategory = !rawCategory || rawCategory.toLowerCase() === 'semua' || rawCategory.toLowerCase() === 'all'

  // Check if rawCategory matches a parent category
  const expenseTree = getMergedExpenseTree()
  const cleanRawCat = rawCategory.toLowerCase().replace(/[_-\s]+/g, ' ')
  const matchedParent = !isAllCategory ? expenseTree.find((p) => {
    const pId = p.id.toLowerCase().replace(/[_-\s]+/g, ' ')
    const pNameId = (p.names?.id || '').toLowerCase().replace(/[_-\s]+/g, ' ')
    const pNameEn = (p.names?.en || '').toLowerCase().replace(/[_-\s]+/g, ' ')
    return pId === cleanRawCat || pNameId === cleanRawCat || pNameEn === cleanRawCat
  }) : null

  const budgetCatKey = isAllCategory ? 'all' : (matchedParent ? matchedParent.id : sanitizeCategoryPath(rawCategory, 'expense'))
  const displayTitle = isAllCategory ? 'Semua' : (matchedParent ? (matchedParent.names?.[locale === 'en' ? 'en' : 'id'] || matchedParent.id) : rawCategory)
  const isBudgetCategoryMatch = (bCat) => {
    if (isAllCategory) {
      const bLower = (bCat || '').toLowerCase()
      return bLower === 'all' || bLower === 'semua'
    }
    const bLower = (bCat || '').toLowerCase()
    return bLower === budgetCatKey.toLowerCase() || fuzzyMatch(bCat, budgetCatKey) || fuzzyMatch(bCat, rawCategory)
  }

  const matched = budgets.find((b) => b.month === targetMonthKey && isBudgetCategoryMatch(b.category))
  const effectiveCurrency = (result.currency && typeof result.currency === 'string' && result.currency.trim())
    ? result.currency.trim().toUpperCase()
    : (matched?.currency || defaultCurrency)
  const spentThisMonth = calculateBudgetSpent(budgetCatKey, monthExpenseTxs, effectiveCurrency, activeRates)

  if (result.action === 'status') {
    const foundLimit = matched ? Number(matched.limit) : (Number(result.limit) || 0)
    newMsgs.push({
      id: Date.now() + 3,
      role: 'ai',
      type: 'action_success',
      data: {
        type: 'budget',
        action: 'status',
        title: displayTitle,
        data: {
          category: budgetCatKey,
          limit: foundLimit,
          spent: spentThisMonth,
          currency: effectiveCurrency,
        },
      },
    })
  } else if (result.action === 'create' || result.action === 'update') {
    const numLimit = Number(result.limit) || 0
    if (matched) {
      await db.budgets.update(matched.id, {
        limit: numLimit,
        ...(result.currency ? { currency: effectiveCurrency } : {}),
      })
      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'action_success',
        data: {
          type: 'budget',
          action: 'update',
          title: matched.category,
          data: {
            category: matched.category,
            limit: numLimit,
            spent: spentThisMonth,
            currency: matched.currency || effectiveCurrency,
          },
        },
      })
    } else {
      await db.budgets.add({
        category: budgetCatKey,
        limit: numLimit,
        month: targetMonthKey,
        currency: effectiveCurrency,
      })
      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'action_success',
        data: {
          type: 'budget',
          action: 'create',
          title: displayTitle,
          data: {
            category: budgetCatKey,
            limit: numLimit,
            spent: spentThisMonth,
            currency: effectiveCurrency,
          },
        },
      })
    }
  }

  return newMsgs
}
