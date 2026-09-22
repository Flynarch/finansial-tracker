/**
 * Direct offline financial health evaluation engine for FinTrack AI.
 */
import { db, computeAllWalletBalances } from '../db'
import { convertCurrency, toSafeNumber, FALLBACK_EXCHANGE_RATES, isExcludeAnalyticsTx } from '../utils'
import { getCachedCurrencyRates } from '../api'
import { getBudgetPeriodDateRange, getCurrentBudgetMonthKey } from '../budgetUtils'
import useSettingsStore from '../../store/useSettingsStore'

/**
 * Calculates financial health score directly from local database (Dexie).
 * Evaluates total cash, monthly income/expenses, active debts, savings ratio,
 * debt-to-income ratio (DTI), and emergency fund runway.
 *
 * @param {object} [options={}] - Options
 * @param {string} [options.defaultCurrency='IDR'] - Default active currency
 * @param {string} [options.locale='id'] - Locale ('id' or 'en')
 * @param {object} [options.rates=null] - Exchange rates mapping
 * @param {string} [options.replyMessage=''] - Custom message override
 * @param {Array<string>} [options.suggestedChips=null] - Suggested interactive chips
 * @param {Date} [options.referenceDate=null] - Anchor date
 * @returns {Promise<object>} Financial health assessment result
 */
export async function calculateDirectFinancialHealth({
  defaultCurrency = 'IDR',
  locale = 'id',
  rates = null,
  replyMessage = '',
  suggestedChips = null,
  referenceDate = null,
} = {}) {
  const activeRates = rates || getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }
  const allWallets = await db.wallets.toArray()
  const txs = await db.transactions.toArray()
  const loans = await db.loans.toArray()

  const computedWallets = computeAllWalletBalances(allWallets, txs, activeRates)
  const totalCash = computedWallets
    .filter((w) => !w.isArchived)
    .reduce((acc, w) => {
      const bal = toSafeNumber(w.currentBalance ?? w.balance ?? 0)
      return acc + convertCurrency(bal, w.currency || defaultCurrency, defaultCurrency, activeRates)
    }, 0)

  const now = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date()
  const budgetCycleStartDay = useSettingsStore.getState().budgetCycleStartDay || 1
  const currentMonthKey = getCurrentBudgetMonthKey(now, budgetCycleStartDay)
  const period = getBudgetPeriodDateRange(currentMonthKey, budgetCycleStartDay, locale)

  let monthlyIncome = 0
  let monthlyExpense = 0

  txs.forEach((t) => {
    const txDate = (t?.date || '').slice(0, 10)
    if (!txDate || txDate < period.startDate || txDate > period.endDate) return

    if (t.isSplit && Array.isArray(t.splitItems) && t.splitItems.length > 0) {
      t.splitItems.forEach((si) => {
        const itemTx = {
          ...t,
          ...si,
          category: si.category || t.category,
          isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
          excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
          isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
        }
        if (isExcludeAnalyticsTx(itemTx)) return
        const amt = convertCurrency(toSafeNumber(si.amount), si.currency || t.currency || defaultCurrency, defaultCurrency, activeRates)
        const itemType = si.type || t.type
        if (itemType === 'income') monthlyIncome += amt
        if (itemType === 'expense') monthlyExpense += amt
      })
      return
    }

    if (isExcludeAnalyticsTx(t)) return
    const amt = convertCurrency(toSafeNumber(t.amount), t.currency || defaultCurrency, defaultCurrency, activeRates)
    if (t.type === 'income') monthlyIncome += amt
    if (t.type === 'expense') monthlyExpense += amt
  })

  const activeLoans = loans.filter((l) => !l.isArchived && l.status !== 'paid' && l.status !== 'forgiven')

  const totalDebt = activeLoans
    .filter((l) => l.type === 'debt')
    .reduce((acc, l) => {
      const raw = toSafeNumber(l.remainingAmount ?? l.totalAmount ?? l.amount ?? 0)
      return acc + convertCurrency(raw, l.currency || defaultCurrency, defaultCurrency, activeRates)
    }, 0)

  const totalReceivable = activeLoans
    .filter((l) => l.type === 'receivable')
    .reduce((acc, l) => {
      const raw = toSafeNumber(l.remainingAmount ?? l.totalAmount ?? l.amount ?? 0)
      return acc + convertCurrency(raw, l.currency || defaultCurrency, defaultCurrency, activeRates)
    }, 0)

  const rawSavingsRatio = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : (monthlyExpense > 0 ? -100 : 0)
  const savingsRatio = Math.max(0, rawSavingsRatio)
  const dti = monthlyIncome > 0 ? (totalDebt / monthlyIncome) * 100 : (totalDebt > 0 ? 100 : 0)
  const emergencyMonths = monthlyExpense > 0 ? (totalCash / monthlyExpense) : (totalCash > 0 ? 12 : 0)

  let score = 50
  if (rawSavingsRatio >= 20) score += 20
  else if (rawSavingsRatio >= 10) score += 10
  else if (rawSavingsRatio < 0) score -= 20

  if (dti <= 30) score += 15
  else if (dti > 50) score -= 15

  if (emergencyMonths >= 6) score += 15
  else if (emergencyMonths >= 3) score += 10
  else if (emergencyMonths < 1) score -= 10

  score = Math.max(10, Math.min(100, Math.round(score)))

  const isEn = String(locale || '').toLowerCase().startsWith('en')
  let rating
  if (score >= 85) rating = isEn ? 'Excellent' : 'Sangat Sehat'
  else if (score >= 70) rating = isEn ? 'Healthy' : 'Sehat'
  else if (score >= 50) rating = isEn ? 'Fair' : 'Cukup'
  else if (score >= 35) rating = isEn ? 'Needs Attention' : 'Perlu Perhatian'
  else rating = isEn ? 'Critical' : 'Kritis'

  const defaultText = isEn
    ? `Here is your Financial Health Score evaluation: ${score}/100 (${rating}).`
    : `Berikut adalah evaluasi Skor Kesehatan Finansial Anda: ${score}/100 (${rating}).`
  const defaultChips = isEn
    ? ['How to improve score?', 'Analyze spending', 'Emergency fund advice']
    : ['Bagaimana cara menaikkan skor?', 'Analisis pengeluaranku', 'Rekomendasi dana darurat']

  return {
    type: 'financial_health',
    score,
    rating,
    metrics: {
      savingsRatio: Math.round(savingsRatio),
      dti: Math.round(dti),
      emergencyMonths: Number(emergencyMonths.toFixed(1)),
      totalCash,
      monthlyIncome,
      monthlyExpense,
      totalDebt,
      totalReceivable,
    },
    text: replyMessage || defaultText,
    chips: Array.isArray(suggestedChips) && suggestedChips.length > 0 ? suggestedChips : defaultChips,
  }
}
