import { format } from 'date-fns'
import { convertCurrency, isExcludeAnalyticsTx, toSafeNumber, roundCurrency } from '../../lib/utils'

/**
 * Calculates sum of wallet balances converted to default currency.
 */
export function calculateTotalWalletBalance(walletsWithBalance, defaultCurrency = 'IDR', rates = null) {
  if (walletsWithBalance === undefined || walletsWithBalance === null) {
    return 0
  }
  const total = walletsWithBalance
    .filter((w) => !w.isArchived)
    .reduce((s, w) => {
      const converted = convertCurrency(
        w.currentBalance || 0,
        w.currency || defaultCurrency,
        defaultCurrency,
        rates,
      )
      return s + converted
    }, 0)
  return roundCurrency(total, defaultCurrency)
}

/**
 * Calculates portfolio valuation from investments.
 */
export function calculatePortfolioStats(investments, defaultCurrency = 'IDR', rates = null) {
  if (investments === null) return { portfolioValue: 0 }
  const safeInv = investments ?? []
  const investedAmount = safeInv.reduce((acc, inv) => {
    const raw = toSafeNumber(inv.quantity) * toSafeNumber(inv.purchasePrice)
    return acc + convertCurrency(raw, inv.purchaseCurrency || defaultCurrency, defaultCurrency, rates)
  }, 0)
  return { portfolioValue: investedAmount }
}

/**
 * Calculates today's cashflow flow and net total handling split transactions.
 */
export function calculateTodayStats(normalizedTransactions, defaultCurrency = 'IDR', rates = null) {
  if (!normalizedTransactions) {
    return { todayNet: 0, todayIncome: 0 }
  }
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const flow = normalizedTransactions.reduce(
    (acc, tx) => {
      if (tx?.date !== todayKey) return acc
      if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
        tx.splitItems.forEach((si) => {
          const itemTx = {
            ...tx,
            ...si,
            category: si.category || tx.category,
            isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
            isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
            excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
          }
          if (isExcludeAnalyticsTx(itemTx)) return
          const amount = convertCurrency(
            toSafeNumber(si.amount),
            si.currency || tx.currency || defaultCurrency,
            defaultCurrency,
            rates,
          )
          const itemType = si.type || tx.type
          if (itemType === 'income') acc.income += amount
          if (itemType === 'expense') acc.expense += amount
        })
        return acc
      }
      if (isExcludeAnalyticsTx(tx)) return acc
      const amount = tx.convertedAmount || 0
      if (tx.type === 'income') acc.income += amount
      if (tx.type === 'expense') acc.expense += amount
      return acc
    },
    { income: 0, expense: 0 },
  )
  return { todayIncome: flow.income, todayNet: flow.income - flow.expense }
}

/**
 * Back-calculates cash balance before a specific date key.
 */
export function computeCashBalanceBeforeDateHelper({
  dateKey,
  normalizedTransactions = [],
  totalWalletBalance = 0,
  activeWalletIdSet = new Set(),
  walletCurrencyMap = new Map(),
  defaultCurrency = 'IDR',
  rates = null,
}) {
  const safeTx = normalizedTransactions || []
  const target = String(dateKey || '')
  if (!target) return totalWalletBalance || 0

  const netFlowSinceTarget = safeTx.reduce((acc, tx) => {
    if (tx?.isPendingReview === true || tx?.isPendingReview === 1) return acc
    const d = String(tx?.date || '')
    if (!d || d < target) return acc
    const isSrcActive = activeWalletIdSet.has(String(tx?.walletId))
    const isTgtActive = tx?.targetWalletId ? activeWalletIdSet.has(String(tx.targetWalletId)) : false

    if (tx.type === 'transfer') {
      if (isSrcActive && !isTgtActive) {
        return acc - (tx.convertedAmount || 0)
      }
      if (!isSrcActive && isTgtActive) {
        const tgtCurrency =
          tx.targetCurrency ||
          (tx.targetWalletId != null ? walletCurrencyMap.get(String(tx.targetWalletId)) : null) ||
          defaultCurrency
        const tgtAmt =
          tx.targetAmount != null && toSafeNumber(tx.targetAmount) > 0
            ? convertCurrency(toSafeNumber(tx.targetAmount), tgtCurrency, defaultCurrency, rates)
            : tx.convertedAmount || 0
        return acc + tgtAmt
      }
      return acc
    }

    if (!isSrcActive) return acc
    const isAdj = tx.type === 'balance_adjustment'
    const amount = tx.convertedAmount || 0
    if (tx.type === 'income') return acc + amount
    if (tx.type === 'expense') return acc - amount
    if (isAdj) return acc + amount
    return acc
  }, 0)

  const balanceBeforeDate = (totalWalletBalance || 0) - netFlowSinceTarget
  return roundCurrency(balanceBeforeDate, defaultCurrency)
}

/**
 * Calculates allocation percentages and color badges for wallet assets.
 */
export function calculateAssetBreakdown(walletsWithBalance = [], defaultCurrency = 'IDR', rates = null) {
  const safeWallets = walletsWithBalance ?? []
  if (safeWallets.length === 0) return { total: 0, items: [] }

  const convertedBalances = safeWallets.map((w) => ({
    ...w,
    convertedBalance: Math.max(
      0,
      convertCurrency(
        Math.max(0, toSafeNumber(w.currentBalance)),
        w.currency || defaultCurrency,
        defaultCurrency,
        rates,
      ),
    ),
  }))

  const total = convertedBalances.reduce((acc, w) => acc + w.convertedBalance, 0)
  if (total === 0) return { total: 0, items: [] }

  const colors = [
    'bg-emerald-500',
    'bg-indigo-500',
    'bg-amber-500',
    'bg-cyan-500',
    'bg-rose-500',
    'bg-violet-500',
  ]

  const items = convertedBalances
    .map((w, idx) => {
      const bal = w.convertedBalance
      const pct = Math.round((bal / total) * 100)
      return {
        id: w.id || idx,
        name: w.name || 'Dompet',
        balance: bal,
        rawBalance: Math.max(0, toSafeNumber(w.currentBalance)),
        currency: w.currency || defaultCurrency,
        pct,
        percentage: pct,
        color: colors[idx % colors.length],
      }
    })
    .filter((w) => w.balance > 0)
    .sort((a, b) => b.balance - a.balance)

  return { total, items }
}
