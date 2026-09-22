import { format } from 'date-fns'
import { convertCurrency, isExcludeAnalyticsTx, roundCurrency, toSafeNumber } from './utils'

export { roundCurrency }

/**
 * Calculates SHA-256 digital checksum of a string using Web Crypto API.
 * @param {string} input - Text to hash
 * @returns {Promise<string>} Hexadecimal hash string
 */
export async function calculateSha256Checksum(input) {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    try {
      const msgBuffer = new TextEncoder().encode(input)
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    } catch (err) {
      console.error('[calculateSha256Checksum]', err)
    }
  }
  // Deterministic fallback
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return 'FT' + Math.abs(hash).toString(16).padStart(16, '0') + Date.now().toString(16)
}

/**
 * Filter transactions within a date range [startDate, endDate] (inclusive YYYY-MM-DD strings).
 */
export function filterTransactionsByDateRange(transactions = [], startDate, endDate) {
  if (!Array.isArray(transactions)) return []
  if (!startDate && !endDate) return transactions.filter((tx) => tx && !tx.deletedAt)

  const hasIsoRange = (!startDate || startDate.length === 10) && (!endDate || endDate.length === 10)

  if (hasIsoRange) {
    return transactions.filter((tx) => {
      if (!tx || !tx.date || tx.deletedAt) return false
      const dateKey = String(tx.date).slice(0, 10)
      if (startDate && dateKey < startDate) return false
      if (endDate && dateKey > endDate) return false
      return true
    })
  }

  const start = startDate ? new Date(startDate + 'T00:00:00') : new Date('1970-01-01')
  const end = endDate ? new Date(endDate + 'T23:59:59') : new Date('2099-12-31')

  return transactions.filter((tx) => {
    if (!tx || !tx.date || tx.deletedAt) return false
    try {
      const txDate = new Date(tx.date.length === 10 ? tx.date + 'T12:00:00' : tx.date)
      return txDate >= start && txDate <= end
    } catch (err) {
      console.warn('[filterTransactionsByDateRange]', err)
      return false
    }
  })
}

/**
 * Generates formal Income Statement (Laporan Laba Rugi).
 * Revenues - Operating Expenses = Operating Income (EBIT)
 * +/- Non-operating items = Net Income (Laba Bersih)
 */
export function generateIncomeStatement(
  transactions = [],
  { startDate, endDate, defaultCurrency = 'IDR', rates = {} } = {}
) {
  const filteredTxs = filterTransactionsByDateRange(transactions, startDate, endDate)

  // Operating Revenue & Non-Operating Income
  const operatingRevenueItems = []
  const nonOperatingRevenueItems = []
  let totalOperatingRevenue = 0
  let totalNonOperatingRevenue = 0

  // Operating Expenses & Non-Operating Expenses
  const operatingExpenseItems = []
  const nonOperatingExpenseItems = []
  let totalOperatingExpenses = 0
  let totalNonOperatingExpenses = 0

  // Aggregation maps
  const revenueMap = new Map()
  const expenseMap = new Map()

  filteredTxs.forEach((tx) => {
    if (tx.type === 'transfer' || tx.type === 'balance_adjustment') return

    const isSplit = tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0
    const items = isSplit
      ? tx.splitItems
          .map((si) => {
            const itemTx = {
              ...tx,
              ...si,
              category: si.category || tx.category,
              isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
              isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
              excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
            }
            if (isExcludeAnalyticsTx(itemTx) || si.isExcluded) return null
            return {
              amount: toSafeNumber(si.amount),
              category: si.category || tx.category,
              type: si.type || tx.type,
              currency: si.currency || tx.currency || defaultCurrency,
            }
          })
          .filter(Boolean)
      : isExcludeAnalyticsTx(tx) || tx.isExcluded
      ? []
      : [
          {
            amount: toSafeNumber(tx.amount),
            category: tx.category,
            type: tx.type,
            currency: tx.currency || defaultCurrency,
          },
        ]

    items.forEach((item) => {
      const rawAmt = item.amount
      if (rawAmt <= 0) return

      const normalizedAmt = convertCurrency(rawAmt, item.currency || defaultCurrency, defaultCurrency, rates)
      const cat = String(item.category || '').trim()
      const parentCat = cat.split('/')[0] || 'lainnya'

      if (item.type === 'income') {
        const isNonOperating = ['investasi', 'dividen', 'bunga', 'hadiah', 'lainnya'].includes(parentCat.toLowerCase())
        const mapKey = cat || 'income/general'
        revenueMap.set(mapKey, {
          category: mapKey,
          parentCategory: parentCat,
          amount: roundCurrency((revenueMap.get(mapKey)?.amount || 0) + normalizedAmt),
          isNonOperating,
        })
      } else if (item.type === 'expense') {
        const isNonOperating = ['pajak', 'denda', 'bunga_pinjaman', 'donasi', 'lainnya'].includes(parentCat.toLowerCase())
        const mapKey = cat || 'expense/general'
        expenseMap.set(mapKey, {
          category: mapKey,
          parentCategory: parentCat,
          amount: roundCurrency((expenseMap.get(mapKey)?.amount || 0) + normalizedAmt),
          isNonOperating,
        })
      }
    })
  })

  revenueMap.forEach((val) => {
    if (val.isNonOperating) {
      nonOperatingRevenueItems.push(val)
      totalNonOperatingRevenue += val.amount
    } else {
      operatingRevenueItems.push(val)
      totalOperatingRevenue += val.amount
    }
  })

  expenseMap.forEach((val) => {
    if (val.isNonOperating) {
      nonOperatingExpenseItems.push(val)
      totalNonOperatingExpenses += val.amount
    } else {
      operatingExpenseItems.push(val)
      totalOperatingExpenses += val.amount
    }
  })

  // Sort descending by amount
  operatingRevenueItems.sort((a, b) => b.amount - a.amount)
  nonOperatingRevenueItems.sort((a, b) => b.amount - a.amount)
  operatingExpenseItems.sort((a, b) => b.amount - a.amount)
  nonOperatingExpenseItems.sort((a, b) => b.amount - a.amount)

  totalOperatingRevenue = roundCurrency(totalOperatingRevenue)
  totalNonOperatingRevenue = roundCurrency(totalNonOperatingRevenue)
  totalOperatingExpenses = roundCurrency(totalOperatingExpenses)
  totalNonOperatingExpenses = roundCurrency(totalNonOperatingExpenses)

  const totalRevenue = roundCurrency(totalOperatingRevenue + totalNonOperatingRevenue)
  const totalExpenses = roundCurrency(totalOperatingExpenses + totalNonOperatingExpenses)
  const operatingProfit = roundCurrency(totalOperatingRevenue - totalOperatingExpenses)
  const netIncome = roundCurrency(totalRevenue - totalExpenses)
  const netProfitMargin = totalRevenue > 0 ? roundCurrency((netIncome / totalRevenue) * 100) : 0

  return {
    period: { startDate, endDate },
    defaultCurrency,
    operatingRevenue: {
      items: operatingRevenueItems,
      total: totalOperatingRevenue,
    },
    operatingExpenses: {
      items: operatingExpenseItems,
      total: totalOperatingExpenses,
    },
    operatingProfit, // Laba Operasi (EBIT)
    nonOperatingRevenue: {
      items: nonOperatingRevenueItems,
      total: totalNonOperatingRevenue,
    },
    nonOperatingExpenses: {
      items: nonOperatingExpenseItems,
      total: totalNonOperatingExpenses,
    },
    totalRevenue,
    totalExpenses,
    netIncome, // Laba Bersih
    netProfitMargin, // Persentase Margin Laba Bersih
  }
}

/**
 * Generates formal Balance Sheet (Neraca Keuangan).
 * Assets = Liabilities + Equity
 */
export function generateBalanceSheet(
  wallets = [],
  savingsGoals = [],
  loans = [],
  {
    asOfDate = format(new Date(), 'yyyy-MM-dd'),
    defaultCurrency = 'IDR',
    rates = {},
    transactions = [],
    loanPayments = [],
    investments = [],
  } = {}
) {
  // 1. Current Assets (Kas & Bank as of asOfDate)
  const cashAccounts = []
  let totalCash = 0

  const activeWallets = wallets.filter((w) => !w.isArchived)
  const postDateTxs = (transactions || []).filter(
    (tx) =>
      tx?.date &&
      !tx.deletedAt &&
      String(tx.date).slice(0, 10) > asOfDate &&
      !(tx.isPendingReview === true || tx.isPendingReview === 1)
  )

  activeWallets.forEach((w) => {
    let bal = toSafeNumber(w.currentBalance ?? w.balance)

    for (const tx of postDateTxs) {
      const rawAmt = toSafeNumber(tx.amount)
      const txCurr = tx.currency || w.currency || defaultCurrency
      const amt = convertCurrency(rawAmt, txCurr, w.currency || defaultCurrency, rates)

      if (String(tx.walletId) === String(w.id)) {
        if (tx.type === 'income' || tx.type === 'balance_adjustment') {
          bal -= amt
        } else if (tx.type === 'expense' || tx.type === 'transfer') {
          bal += amt
        }
      }
      if (String(tx.targetWalletId) === String(w.id) && tx.type === 'transfer') {
        const targetAmt =
          tx.targetAmount !== undefined && tx.targetAmount !== null
            ? toSafeNumber(tx.targetAmount)
            : convertCurrency(rawAmt, txCurr, w.currency || defaultCurrency, rates)
        bal -= targetAmt
      }
    }

    const normBal = convertCurrency(bal, w.currency || defaultCurrency, defaultCurrency, rates)
    cashAccounts.push({
      id: w.id,
      name: w.name,
      type: w.type || 'bank',
      balance: normBal,
      currency: defaultCurrency,
    })
    totalCash += normBal
  })

  // 2. Non-Current Assets (Tabungan/Target as of asOfDate)
  const savingsItems = []
  let totalSavings = 0

  savingsGoals.forEach((goal) => {
    if (goal.createdAt) {
      const createdDate = format(new Date(goal.createdAt), 'yyyy-MM-dd')
      if (createdDate > asOfDate) return
    }

    let cur = toSafeNumber(goal.currentAmount || goal.savedAmount || 0)

    const postDateGoalTxs = (transactions || []).filter(
      (tx) =>
        tx?.date &&
        !tx.deletedAt &&
        String(tx.date).slice(0, 10) > asOfDate &&
        !(tx.isPendingReview === true || tx.isPendingReview === 1) &&
        ((tx.goalId != null && String(tx.goalId) === String(goal.id)) ||
          (!tx.goalId && goal.name && tx.notes?.includes(goal.name)) ||
          tx.category === 'tabungan' ||
          tx.category === 'cairkan_tabungan')
    )

    for (const tx of postDateGoalTxs) {
      const matchesGoal =
        tx.goalId != null
          ? String(tx.goalId) === String(goal.id)
          : Boolean(goal.name && tx.notes?.includes(goal.name))
      if (matchesGoal) {
        const rawAmt = toSafeNumber(tx.amount)
        const amt = convertCurrency(rawAmt, tx.currency || defaultCurrency, goal.currency || defaultCurrency, rates)
        if (tx.category === 'tabungan' || tx.type === 'expense') {
          cur -= amt
        } else if (tx.category === 'cairkan_tabungan' || tx.type === 'income') {
          cur += amt
        }
      }
    }

    cur = Math.max(0, cur)
    if (cur > 0) {
      const norm = convertCurrency(cur, goal.currency || defaultCurrency, defaultCurrency, rates)
      savingsItems.push({
        id: goal.id,
        name: goal.name || goal.title || 'Tabungan',
        targetAmount: toSafeNumber(goal.targetAmount),
        currentAmount: norm,
      })
      totalSavings += norm
    }
  })

  // 3. Receivables & Liabilities (as of asOfDate)
  const receivableItems = []
  let totalReceivables = 0
  const debtItems = []
  let totalLiabilities = 0

  loans.forEach((l) => {
    const loanStartDate = l.startDate || (l.createdAt ? format(new Date(l.createdAt), 'yyyy-MM-dd') : null)
    if (loanStartDate && loanStartDate > asOfDate) {
      return
    }

    let remaining = toSafeNumber(l.remainingAmount ?? l.amount)

    // Add back payments recorded after asOfDate
    const postPayments = (loanPayments || []).filter(
      (p) => String(p.loanId) === String(l.id) && p.date && String(p.date).slice(0, 10) > asOfDate
    )
    for (const p of postPayments) {
      const pAmt = convertCurrency(toSafeNumber(p.amount), p.currency || l.currency || defaultCurrency, l.currency || defaultCurrency, rates)
      remaining += pAmt
    }

    if (postPayments.length === 0) {
      const postTxPayments = (transactions || []).filter(
        (tx) =>
          String(tx.loanId) === String(l.id) &&
          tx.date &&
          String(tx.date).slice(0, 10) > asOfDate &&
          (tx.category === 'Bayar Hutang' || tx.category === 'Terima Piutang' || tx.type === 'expense' || tx.type === 'income') &&
          tx.id !== l.initialTransactionId
      )
      for (const tx of postTxPayments) {
        const txAmt = convertCurrency(toSafeNumber(tx.amount), tx.currency || l.currency || defaultCurrency, l.currency || defaultCurrency, rates)
        remaining += txAmt
      }
    }

    const totalAmt = toSafeNumber(l.totalAmount ?? l.amount)
    if (totalAmt > 0) {
      remaining = Math.min(totalAmt, remaining)
    }
    remaining = Math.max(0, roundCurrency(remaining))

    const isPaidBeforeAsOf = l.status === 'paid' && l.paidDate && String(l.paidDate).slice(0, 10) <= asOfDate
    const isForgivenBeforeAsOf = l.status === 'forgiven' && l.forgivenDate && String(l.forgivenDate).slice(0, 10) <= asOfDate

    if (remaining > 0 && !isPaidBeforeAsOf && !isForgivenBeforeAsOf) {
      const norm = convertCurrency(remaining, l.currency || defaultCurrency, defaultCurrency, rates)
      if (l.type === 'receivable') {
        receivableItems.push({
          id: l.id,
          personName: l.personName || l.title || 'Piutang',
          amount: norm,
          dueDate: l.dueDate || null,
        })
        totalReceivables += norm
      } else if (l.type === 'debt' || l.type === 'payable') {
        debtItems.push({
          id: l.id,
          personName: l.personName || l.title || 'Utang / Pinjaman',
          amount: norm,
          dueDate: l.dueDate || null,
        })
        totalLiabilities += norm
      }
    }
  })

  // 3b. Investments (Portfolio as of asOfDate)
  const investmentItems = []
  let totalInvestments = 0

  ;(investments || []).forEach((inv) => {
    const purchaseDate = inv.purchaseDate || (inv.createdAt ? format(new Date(inv.createdAt), 'yyyy-MM-dd') : null)
    if (purchaseDate && purchaseDate > asOfDate) return
    const qty = toSafeNumber(inv.quantity)
    const price = toSafeNumber(inv.purchasePrice || inv.currentPrice)
    const val = qty * price
    if (val > 0) {
      const norm = convertCurrency(val, inv.purchaseCurrency || inv.currency || defaultCurrency, defaultCurrency, rates)
      investmentItems.push({
        id: inv.id,
        name: inv.name || inv.assetName || inv.symbol || 'Investasi',
        amount: norm,
      })
      totalInvestments += norm
    }
  })

  totalCash = roundCurrency(totalCash)
  totalSavings = roundCurrency(totalSavings)
  totalInvestments = roundCurrency(totalInvestments)
  totalReceivables = roundCurrency(totalReceivables)
  totalLiabilities = roundCurrency(totalLiabilities)

  const totalCurrentAssets = roundCurrency(totalCash)
  const totalNonCurrentAssets = roundCurrency(totalSavings + totalInvestments + totalReceivables)
  const totalAssets = roundCurrency(totalCurrentAssets + totalNonCurrentAssets)

  // 4. Equity (Net Worth / Ekuitas Bersih)
  const totalEquity = roundCurrency(totalAssets - totalLiabilities)
  const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0
  const currentRatio = totalLiabilities > 0 ? totalCurrentAssets / totalLiabilities : totalCurrentAssets > 0 ? 10 : 1

  return {
    asOfDate,
    defaultCurrency,
    assets: {
      currentAssets: {
        items: cashAccounts,
        total: totalCurrentAssets,
      },
      nonCurrentAssets: {
        savings: { items: savingsItems, total: totalSavings },
        investments: { items: investmentItems, total: totalInvestments },
        receivables: { items: receivableItems, total: totalReceivables },
        total: totalNonCurrentAssets,
      },
      totalAssets,
    },
    liabilities: {
      items: debtItems,
      total: totalLiabilities,
    },
    equity: {
      netWorth: totalEquity,
      totalEquity,
    },
    ratios: {
      debtToAssetRatio,
      currentRatio,
    },
    isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  }
}

/**
 * Generates formal Statement of Cash Flows (Laporan Arus Kas).
 * Operating Activities + Investing Activities + Financing Activities = Net Change in Cash
 */
export function generateCashFlowStatement(
  transactions = [],
  { startDate, endDate, defaultCurrency = 'IDR', rates = {} } = {}
) {
  const filteredTxs = filterTransactionsByDateRange(transactions, startDate, endDate)

  // 1. Cash Flow from Operating Activities
  let operatingInflow = 0
  let operatingOutflow = 0
  const operatingDetails = []

  // 2. Cash Flow from Investing Activities (Savings / Goals Deposits, Asset Purchases)
  let investingInflow = 0
  let investingOutflow = 0
  const investingDetails = []

  // 3. Cash Flow from Financing Activities (Loan proceeds, debt payments)
  let financingInflow = 0
  let financingOutflow = 0
  const financingDetails = []

  filteredTxs.forEach((tx) => {
    if (tx.type === 'balance_adjustment' || tx.type === 'transfer') return

    const isSplit = tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0
    const items = isSplit
      ? tx.splitItems.map((si) => {
          const itemTx = {
            ...tx,
            ...si,
            category: si.category || tx.category,
            isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
            isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
            excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
          }
          return {
            amount: toSafeNumber(si.amount),
            category: si.category || tx.category,
            type: si.type || tx.type,
            currency: si.currency || tx.currency || defaultCurrency,
            notes: si.notes || tx.notes,
            loanId: si.loanId || tx.loanId,
            isExcluded: isExcludeAnalyticsTx(itemTx) || si.isExcluded || false,
          }
        })
      : [
          {
            amount: toSafeNumber(tx.amount),
            category: tx.category,
            type: tx.type,
            currency: tx.currency || defaultCurrency,
            notes: tx.notes,
            loanId: tx.loanId,
            isExcluded: isExcludeAnalyticsTx(tx) || tx.isExcluded || false,
          },
        ]

    items.forEach((item) => {
      const rawAmt = item.amount
      if (rawAmt <= 0) return

      const normAmt = convertCurrency(rawAmt, item.currency || defaultCurrency, defaultCurrency, rates)
      const cat = String(item.category || '').toLowerCase()
      const isLoanTx = cat.includes('pinjaman') || cat.includes('utang') || cat.includes('cicilan') || item.loanId != null

      if (cat.includes('investasi') || cat.includes('tabungan') || cat.includes('reksadana') || cat.includes('saham') || cat.includes('emas')) {
        if (item.type === 'income') {
          investingInflow += normAmt
          investingDetails.push({ name: item.notes || 'Hasil Investasi', amount: normAmt, type: 'inflow' })
        } else if (item.type === 'expense') {
          investingOutflow += normAmt
          investingDetails.push({ name: item.notes || 'Penempatan Investasi / Tabungan', amount: normAmt, type: 'outflow' })
        }
      } else if (isLoanTx) {
        if (item.type === 'income') {
          financingInflow += normAmt
          financingDetails.push({ name: item.notes || 'Penerimaan Pinjaman', amount: normAmt, type: 'inflow' })
        } else if (item.type === 'expense') {
          financingOutflow += normAmt
          financingDetails.push({ name: item.notes || 'Pembayaran Pokok Utang / Pinjaman', amount: normAmt, type: 'outflow' })
        }
      } else {
        // Standard Operating (skip if marked exclude from analytics)
        if (item.isExcluded) return
        if (item.type === 'income') {
          operatingInflow += normAmt
          operatingDetails.push({ name: item.notes || item.category || 'Penerimaan Operasional', amount: normAmt, type: 'inflow' })
        } else if (item.type === 'expense') {
          operatingOutflow += normAmt
          operatingDetails.push({ name: item.notes || item.category || 'Pengeluaran Operasional', amount: normAmt, type: 'outflow' })
        }
      }
    })
  })

  operatingInflow = roundCurrency(operatingInflow)
  operatingOutflow = roundCurrency(operatingOutflow)
  investingInflow = roundCurrency(investingInflow)
  investingOutflow = roundCurrency(investingOutflow)
  financingInflow = roundCurrency(financingInflow)
  financingOutflow = roundCurrency(financingOutflow)

  const netOperatingCashFlow = roundCurrency(operatingInflow - operatingOutflow)
  const netInvestingCashFlow = roundCurrency(investingInflow - investingOutflow)
  const netFinancingCashFlow = roundCurrency(financingInflow - financingOutflow)
  const netChangeInCash = roundCurrency(netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow)

  return {
    period: { startDate, endDate },
    defaultCurrency,
    operatingActivities: {
      inflow: operatingInflow,
      outflow: operatingOutflow,
      net: netOperatingCashFlow,
      items: operatingDetails.slice(0, 20),
    },
    investingActivities: {
      inflow: investingInflow,
      outflow: investingOutflow,
      net: netInvestingCashFlow,
      items: investingDetails.slice(0, 10),
    },
    financingActivities: {
      inflow: financingInflow,
      outflow: financingOutflow,
      net: netFinancingCashFlow,
      items: financingDetails.slice(0, 10),
    },
    netChangeInCash,
  }
}
