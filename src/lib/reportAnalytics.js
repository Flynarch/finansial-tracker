import { format, parseISO, startOfMonth, subMonths } from 'date-fns'
import { convertCurrency, isExcludeAnalyticsTx, toSafeNumber } from './utils'
import { computeAllWalletBalances } from './db'

/**
 * Calculates the personal savings rate percentage.
 * Formula: ((income - expense) / income) * 100
 * Clamped between -100% and 100%. Returns 0 if income is 0.
 *
 * @param {number} income
 * @param {number} expense
 * @returns {number} Integer percentage (-100 to 100)
 */
export function calculateSavingsRate(income, expense) {
  const inc = toSafeNumber(income)
  const exp = toSafeNumber(expense)
  if (inc <= 0) return 0
  const net = inc - exp
  const rate = Math.round((net / inc) * 100)
  return Math.max(-100, Math.min(100, rate))
}

/**
 * Calculates average daily spending pace (daily burn rate).
 *
 * @param {number} totalExpense
 * @param {number} daysCount
 * @returns {number} Daily average expense amount
 */
export function calculateDailyBurnRate(totalExpense, daysCount) {
  const exp = toSafeNumber(totalExpense)
  const days = toSafeNumber(daysCount)
  if (exp <= 0 || days <= 0) return 0
  return exp / days
}

/**
 * Calculates proportional ratio between inflow and outflow.
 *
 * @param {number} income
 * @param {number} expense
 * @returns {{ incomePercent: number, expensePercent: number, totalFlow: number, hasData: boolean }}
 */
export function calculateCashflowRatio(income, expense) {
  const inc = toSafeNumber(income)
  const exp = toSafeNumber(expense)
  const totalFlow = inc + exp
  if (totalFlow <= 0) {
    return {
      incomePercent: 0,
      expensePercent: 0,
      totalFlow: 0,
      hasData: false,
    }
  }
  const incomePercent = Math.round((inc / totalFlow) * 100)
  return {
    incomePercent,
    expensePercent: 100 - incomePercent,
    totalFlow,
    hasData: true,
  }
}

/**
 * Evaluates current spending vs historical monthly average.
 *
 * @param {number} currentExpense
 * @param {number} historicalAverageExpense
 * @returns {{ diffPercent: number, isLower: boolean, isHigher: boolean, isNormal: boolean, hasHistory: boolean }}
 */
export function calculateSpendingTrend(currentExpense, historicalAverageExpense) {
  const curr = toSafeNumber(currentExpense)
  const avg = toSafeNumber(historicalAverageExpense)
  if (avg <= 0) {
    return {
      diffPercent: 0,
      isLower: false,
      isHigher: false,
      isNormal: true,
      hasHistory: false,
    }
  }
  const diffPercent = Math.round(((curr - avg) / avg) * 100)
  return {
    diffPercent,
    isLower: diffPercent < 0,
    isHigher: diffPercent > 0,
    isNormal: diffPercent === 0,
    hasHistory: true,
  }
}

/**
 * Determines financial health tier badge based on net savings.
 *
 * @param {number} netSavings
 * @param {boolean} hasData
 * @returns {'surplus' | 'stable' | 'deficit' | 'empty'}
 */
export function calculateFinancialHealthTier(netSavings, hasData) {
  if (!hasData) return 'empty'
  const net = toSafeNumber(netSavings)
  if (net > 0) return 'surplus'
  if (net === 0) return 'stable'
  return 'deficit'
}

/**
 * Formats period-over-period percentage delta string (+12.5%, -8.0%, etc).
 *
 * @param {number} current
 * @param {number} previous
 * @returns {string} e.g. "+12.5%", "-5.0%", "—"
 */
export function formatDelta(current, previous) {
  const curr = Number(current)
  const prev = Number(previous)
  if (!Number.isFinite(curr) || !Number.isFinite(prev) || prev === 0) return '—'
  const pct = ((curr - prev) / Math.abs(prev)) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

/**
 * Aggregates monthly income and expense over a timeframe range.
 *
 * @param {Array} transactions
 * @param {number} rangeMonths
 * @param {string} defaultCurrency
 * @param {Object} rates
 * @param {Date} [referenceDate]
 * @returns {Array<{ month: string, key: string, income: number, expense: number }>}
 */
export function aggregateMonthlyIncomeExpense(
  transactions = [],
  rangeMonths = 6,
  defaultCurrency = 'IDR',
  rates = null,
  referenceDate = new Date()
) {
  const monthMap = new Map()
  const monthsCount = Math.max(1, Number(rangeMonths) || 6)

  for (let i = monthsCount - 1; i >= 0; i -= 1) {
    const month = subMonths(startOfMonth(referenceDate), i)
    const key = format(month, 'yyyy-MM')
    monthMap.set(key, {
      key,
      month: format(month, 'MMM yy'),
      income: 0,
      expense: 0,
    })
  }

  const validTxs = (transactions || []).filter((tx) => !isExcludeAnalyticsTx(tx))

  validTxs.forEach((tx) => {
    if (!tx?.date) return
    let key
    try {
      key = format(parseISO(String(tx.date)), 'yyyy-MM')
    } catch {
      return
    }
    if (!monthMap.has(key)) return
    const row = monthMap.get(key)
    let val = toSafeNumber(tx.amount)
    if (tx.currency && tx.currency !== defaultCurrency && rates) {
      val = convertCurrency(val, tx.currency, defaultCurrency, rates)
    }
    if (tx.type === 'income') row.income += val
    if (tx.type === 'expense') row.expense += val
  })

  return [...monthMap.values()]
}

/**
 * Computes comprehensive net worth summary components.
 *
 * @param {Array} wallets
 * @param {Array} allTransactions
 * @param {Array} investments
 * @param {Array} loans
 * @param {Object} rates
 * @param {string} defaultCurrency
 * @returns {{ totalCash: number, investmentValue: number, netLoanPosition: number, totalNetWorth: number }}
 */
export function calculateNetWorthSummary(
  wallets = [],
  allTransactions = [],
  investments = [],
  loans = [],
  rates = null,
  defaultCurrency = 'IDR'
) {
  const computedWallets = computeAllWalletBalances(wallets || [], allTransactions || [], rates)
  const totalCash = computedWallets.reduce((sum, w) => {
    return (
      sum +
      convertCurrency(
        toSafeNumber(w.currentBalance),
        w.currency || defaultCurrency,
        defaultCurrency,
        rates
      )
    )
  }, 0)

  const investmentValue = (investments || []).reduce((acc, row) => {
    return (
      acc +
      convertCurrency(
        toSafeNumber(row.quantity) * toSafeNumber(row.purchasePrice),
        row.purchaseCurrency || defaultCurrency,
        defaultCurrency,
        rates
      )
    )
  }, 0)

  const activeLoans = (loans || []).filter(
    (l) => l.status !== 'paid' && l.status !== 'forgiven' && toSafeNumber(l.remainingAmount ?? l.totalAmount) > 0
  )
  const debt = activeLoans
    .filter((l) => l.type === 'debt')
    .reduce(
      (s, l) =>
        s +
        convertCurrency(
          toSafeNumber(l.remainingAmount ?? l.totalAmount),
          l.currency || defaultCurrency,
          defaultCurrency,
          rates
        ),
      0
    )
  const rec = activeLoans
    .filter((l) => l.type === 'receivable')
    .reduce(
      (s, l) =>
        s +
        convertCurrency(
          toSafeNumber(l.remainingAmount ?? l.totalAmount),
          l.currency || defaultCurrency,
          defaultCurrency,
          rates
        ),
      0
    )
  const netLoanPosition = rec - debt
  const totalNetWorth = totalCash + investmentValue + netLoanPosition

  return {
    totalCash,
    investmentValue,
    netLoanPosition,
    totalNetWorth,
  }
}
