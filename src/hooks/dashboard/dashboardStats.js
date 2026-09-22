import { format, startOfMonth, subMonths } from 'date-fns'
import { convertCurrency, isExcludeAnalyticsTx, roundCurrency, toSafeNumber } from '../../lib/utils'

/**
 * Calculates net worth growth and percentage from start value to current value.
 */
export function computeNetWorthGrowth(startVal, currentVal) {
  const net = currentVal - startVal
  const pct = startVal !== 0 ? (net / Math.abs(startVal)) * 100 : net > 0 ? 100 : 0
  return { net, pct }
}

/**
 * Generates an array and Map of monthly buckets for historical trend charts.
 */
export function generateMonthlyData(monthsCount, endMonthD = new Date()) {
  const baseDate = startOfMonth(endMonthD)
  const arr = Array.from({ length: monthsCount }, (_, idx) => {
    const d = subMonths(baseDate, monthsCount - 1 - idx)
    return { day: format(d, 'MMM yyyy'), key: format(d, 'yyyy-MM'), income: 0, expense: 0, net: 0 }
  })
  const map = new Map(arr.map((r) => [r.key, r]))
  return { arr, map }
}

/**
 * Calculates total income and expense within a specified date period, correctly handling split transactions.
 */
export function calculatePeriodStats(safeTx, period, defaultCurrency = 'IDR', rates = null) {
  if (!Array.isArray(safeTx) || !period?.startDate || !period?.endDate) {
    return { income: 0, expense: 0 }
  }

  const raw = safeTx.reduce(
    (acc, tx) => {
      const txDate = (tx?.date || '').slice(0, 10)
      if (!txDate || txDate < period.startDate || txDate > period.endDate) return acc

      if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
        tx.splitItems.forEach((si) => {
          const itemTx = {
            ...tx,
            ...si,
            category: si.category || tx.category,
            isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
            excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
            isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
          }
          if (isExcludeAnalyticsTx(itemTx)) return
          const amount = convertCurrency(toSafeNumber(si.amount), si.currency || tx.currency || defaultCurrency, defaultCurrency, rates)
          const itemType = si.type || tx.type
          if (itemType === 'income') acc.income += amount
          if (itemType === 'expense') acc.expense += amount
        })
        return acc
      }

      if (isExcludeAnalyticsTx(tx)) return acc
      const amount = tx.convertedAmount != null
        ? tx.convertedAmount
        : convertCurrency(toSafeNumber(tx.amount), tx.currency || defaultCurrency, defaultCurrency, rates)
      if (tx.type === 'income') acc.income += amount
      if (tx.type === 'expense') acc.expense += amount
      return acc
    },
    { income: 0, expense: 0 },
  )

  return {
    income: roundCurrency(raw.income),
    expense: roundCurrency(raw.expense),
  }
}

/**
 * Aggregates net cash flow across 24 hourly buckets for the 1D chart view.
 */
export function calculate1DHourlyFlow(
  normalizedTransactions,
  todayKey,
  activeWalletIdSet,
  walletCurrencyMap,
  defaultCurrency = 'IDR',
  rates = null,
) {
  const hourNet = Array.from({ length: 24 }, () => 0)
  if (!Array.isArray(normalizedTransactions)) return hourNet

  normalizedTransactions.forEach((tx) => {
    if (tx?.isPendingReview === true || tx?.isPendingReview === 1) return
    if (String(tx?.date || '') !== todayKey) return
    const isAdj = tx.type === 'balance_adjustment'
    const amount = tx.convertedAmount || 0
    const isSrcActive = activeWalletIdSet ? activeWalletIdSet.has(String(tx?.walletId)) : true
    const isTgtActive = tx?.targetWalletId && activeWalletIdSet ? activeWalletIdSet.has(String(tx.targetWalletId)) : false

    let signed = 0
    if (tx.type === 'transfer') {
      if (isSrcActive && !isTgtActive) signed = -amount
      else if (!isSrcActive && isTgtActive) {
        const tgtCurrency =
          tx.targetCurrency || (tx.targetWalletId != null && walletCurrencyMap ? walletCurrencyMap.get(String(tx.targetWalletId)) : null) || defaultCurrency
        signed =
          tx.targetAmount != null && toSafeNumber(tx.targetAmount) > 0
            ? convertCurrency(toSafeNumber(tx.targetAmount), tgtCurrency, defaultCurrency, rates)
            : amount
      }
    } else if (isSrcActive) {
      if (tx.type === 'income' || isAdj) signed = amount
      else if (tx.type === 'expense') signed = -amount
    }

    let h = 12
    if (tx?.createdAt) {
      const dt = new Date(tx.createdAt)
      if (!Number.isNaN(dt.getTime())) h = dt.getHours()
    }
    hourNet[h] += signed
  })

  return hourNet
}
