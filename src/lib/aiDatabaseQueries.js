import { db } from './db'
import { isExcludeAnalyticsTx, convertCurrency, formatCurrency, FALLBACK_EXCHANGE_RATES } from './utils'
import { getCachedCurrencyRates } from './api'
import useSettingsStore from '../store/useSettingsStore'
import { subMonths, format } from 'date-fns'
import { getCurrentBudgetMonthKey, getBudgetPeriodDateRange } from './budgetUtils'
import { getDecryptedNoteSync, warmupDecryptionCache } from './fieldEncryption'

/**
 * Executes a query against the local Dexie DB on behalf of the AI.
 * Unpacks split transactions, excludes non-analytics items, and normalizes multi-currency amounts.
 * 
 * @param {object} params
 * @param {string} [params.startDate] YYYY-MM-DD
 * @param {string} [params.endDate] YYYY-MM-DD
 * @param {string} [params.type] 'income' | 'expense'
 * @param {string} [params.category]
 */
export async function queryTransactions({ startDate, endDate, type, category }) {
  const defaultCurrency = useSettingsStore.getState().defaultCurrency || 'IDR'
  const activeRates = getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }

  let collection
  if (startDate && endDate) {
    collection = db.transactions.where('date').between(startDate, `${endDate}\uffff`, true, true)
  } else if (startDate) {
    collection = db.transactions.where('date').aboveOrEqual(startDate)
  } else if (endDate) {
    collection = db.transactions.where('date').belowOrEqual(`${endDate}\uffff`)
  } else {
    collection = db.transactions.orderBy('date')
  }

  let allRawTxs = await collection.toArray()
  let rawTxs = allRawTxs.filter((tx) => !tx.deletedAt && tx.isPendingReview !== true && tx.isPendingReview !== 1)

  // Sort chronologically ascending
  rawTxs.sort((a, b) => (a.date || '').localeCompare(b.date || ''))

  // Unpack split transactions and filter out analytics exclusions
  const flattenedTxs = []
  rawTxs.forEach((tx) => {
    if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
      tx.splitItems.forEach((si) => {
        const itemTx = {
          ...tx,
          ...si,
          category: si.category || tx.category,
          amount: si.amount,
          type: si.type || tx.type,
          currency: si.currency || tx.currency || defaultCurrency,
          isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
          isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
          excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
        }
        if (!isExcludeAnalyticsTx(itemTx)) {
          flattenedTxs.push(itemTx)
        }
      })
    } else {
      if (!isExcludeAnalyticsTx(tx)) {
        flattenedTxs.push(tx)
      }
    }
  })

  let filteredTxs = flattenedTxs

  if (type) {
    filteredTxs = filteredTxs.filter((tx) => tx.type === type)
  }

  if (category) {
    const catLower = category.toLowerCase()
    filteredTxs = filteredTxs.filter((tx) => tx.category && tx.category.toLowerCase().includes(catLower))
  }

  // Calculate summaries with currency normalization
  let totalIncome = 0
  let totalExpense = 0
  const expenseByCategory = {}
  const incomeByCategory = {}

  filteredTxs.forEach((tx) => {
    const rawAmt = Number(tx.amount) || 0
    const amt = convertCurrency(rawAmt, tx.currency || defaultCurrency, defaultCurrency, activeRates)
    if (tx.type === 'income') {
      totalIncome += amt
      incomeByCategory[tx.category] = (incomeByCategory[tx.category] || 0) + amt
    } else if (tx.type === 'expense') {
      totalExpense += amt
      expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + amt
    }
  })

  const sampleTxs = filteredTxs.slice(-10)
  await warmupDecryptionCache(sampleTxs)

  // Return a structured summary to the AI
  return {
    queryParameters: { startDate, endDate, type, category },
    totalTransactionsFound: filteredTxs.length,
    currency: defaultCurrency,
    totalIncome,
    totalExpense,
    netBalance: totalIncome - totalExpense,
    expenseByCategory,
    incomeByCategory,
    // Only return the 10 most recent sample transactions to avoid exceeding AI context window
    recentSampleTransactions: sampleTxs.map((tx) => ({
      date: tx.date,
      type: tx.type,
      category: tx.category,
      amount: tx.amount,
      currency: tx.currency || defaultCurrency,
      notes: getDecryptedNoteSync(tx.notes) || tx.notes,
    })),
  }
}

/**
 * Fetches a comprehensive financial & task summary (including multi-month comparison)
 * to inject directly into AI System Prompt for zero-latency, high-accuracy answers.
 */
export async function getMonthSummaryForPrompt() {
  try {
    const now = new Date()
    const defaultCurrency = useSettingsStore.getState().defaultCurrency || 'IDR'
    const budgetCycleStartDay = useSettingsStore.getState().budgetCycleStartDay || 1
    const activeRates = getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }

    const currentMonthKey = getCurrentBudgetMonthKey(now, budgetCycleStartDay)
    const currentPeriod = getBudgetPeriodDateRange(currentMonthKey, budgetCycleStartDay)

    const [cYear, cMonth] = currentMonthKey.split('-').map(Number)
    const currentMonthDate = new Date(cYear, cMonth - 1, 1)
    const prevMonthKey = format(subMonths(currentMonthDate, 1), 'yyyy-MM')
    const prevPeriod = getBudgetPeriodDateRange(prevMonthKey, budgetCycleStartDay)

    const rawAllTxs = await db.transactions
      .where('date')
      .between(prevPeriod.startDate, `${currentPeriod.endDate}\uffff`, true, true)
      .toArray()
    const allTxs = (rawAllTxs || []).filter((tx) => !tx.deletedAt && tx.isPendingReview !== true && tx.isPendingReview !== 1)

    const currentMonthTxs = []
    const prevMonthTxs = []

    allTxs.forEach((tx) => {
      const txDate = (tx.date || '').slice(0, 10)
      const isCurrent = txDate >= currentPeriod.startDate && txDate <= currentPeriod.endDate
      const isPrev = txDate >= prevPeriod.startDate && txDate <= prevPeriod.endDate
      if (!isCurrent && !isPrev) return

      if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
        tx.splitItems.forEach((si) => {
          const itemTx = {
            ...tx,
            ...si,
            category: si.category || tx.category,
            amount: si.amount,
            type: si.type || tx.type,
            currency: si.currency || tx.currency || defaultCurrency,
            isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
            isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
            excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
          }
          if (isExcludeAnalyticsTx(itemTx)) return
          if (isCurrent) currentMonthTxs.push(itemTx)
          if (isPrev) prevMonthTxs.push(itemTx)
        })
      } else {
        if (isExcludeAnalyticsTx(tx)) return
        if (isCurrent) currentMonthTxs.push(tx)
        if (isPrev) prevMonthTxs.push(tx)
      }
    })

    // Current month metrics
    let currentIncome = 0
    let currentExpense = 0
    const currentCatMap = {}

    currentMonthTxs.forEach((t) => {
      const rawAmt = Number(t.amount) || 0
      const amt = convertCurrency(rawAmt, t.currency || defaultCurrency, defaultCurrency, activeRates)
      if (t.type === 'income') currentIncome += amt
      if (t.type === 'expense') {
        currentExpense += amt
        currentCatMap[t.category] = (currentCatMap[t.category] || 0) + amt
      }
    })

    const currentTopCats = Object.entries(currentCatMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat, val]) => `${cat}: ${formatCurrency(val, defaultCurrency)}`)
      .join(', ')

    // Previous month metrics
    let prevIncome = 0
    let prevExpense = 0
    const prevCatMap = {}

    prevMonthTxs.forEach((t) => {
      const rawAmt = Number(t.amount) || 0
      const amt = convertCurrency(rawAmt, t.currency || defaultCurrency, defaultCurrency, activeRates)
      if (t.type === 'income') prevIncome += amt
      if (t.type === 'expense') {
        prevExpense += amt
        prevCatMap[t.category] = (prevCatMap[t.category] || 0) + amt
      }
    })

    const prevTopCats = Object.entries(prevCatMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat, val]) => `${cat}: ${formatCurrency(val, defaultCurrency)}`)
      .join(', ')

    // Comparisons
    const expenseDiff = currentExpense - prevExpense
    const expensePct = prevExpense > 0 ? Math.round((expenseDiff / prevExpense) * 100) : null
    const isEarlyMonth = now.getDate() <= 3
    const expenseDiffStr = isEarlyMonth
      ? `Awal bulan berjalan (hari ke-${now.getDate()}), perbandingan tren belanja belum stabil: ${expenseDiff >= 0 ? '+' : ''}${formatCurrency(expenseDiff, defaultCurrency)} vs bulan lalu`
      : expensePct !== null
        ? `${expenseDiff >= 0 ? '+' : ''}${formatCurrency(expenseDiff, defaultCurrency)} (${expenseDiff >= 0 ? '+' : ''}${expensePct}%)`
        : 'Bulan lalu belum ada data'

    // Loans / Debts
    const loans = await db.loans.toArray().catch(() => [])
    const activeDebts = loans.filter((l) => !l.isArchived && l.type === 'debt' && l.status !== 'paid' && l.status !== 'forgiven')
    const activeReceivables = loans.filter((l) => !l.isArchived && l.type === 'receivable' && l.status !== 'paid' && l.status !== 'forgiven')
    const totalDebt = activeDebts.reduce((s, l) => {
      const raw = Number(l.remainingAmount ?? l.totalAmount ?? l.amount ?? 0)
      return s + convertCurrency(raw, l.currency || defaultCurrency, defaultCurrency, activeRates)
    }, 0)
    const totalReceivable = activeReceivables.reduce((s, l) => {
      const raw = Number(l.remainingAmount ?? l.totalAmount ?? l.amount ?? 0)
      return s + convertCurrency(raw, l.currency || defaultCurrency, defaultCurrency, activeRates)
    }, 0)

    // Goals / Savings
    const goals = await db.goals.toArray().catch(() => [])
    const goalsSummary = goals
      .map((g) => {
        const safeGoalName = String(g.name || '').replace(/[\r\n\t]+/g, ' ').replace(/[\\"`<>]/g, '').slice(0, 40)
        const cur = convertCurrency(Number(g.currentAmount || 0), g.currency || defaultCurrency, defaultCurrency, activeRates)
        const tgt = convertCurrency(Number(g.targetAmount || 0), g.currency || defaultCurrency, defaultCurrency, activeRates)
        return `${safeGoalName}: ${formatCurrency(cur, defaultCurrency)} / ${formatCurrency(tgt, defaultCurrency)}`
      })
      .join('; ')

    // Habits & Todos
    const habits = await db.habits.toArray().catch(() => [])
    const activeTodos = await db.todos.filter((t) => !t.completed).toArray().catch(() => [])

    return `
1. BULAN INI (${currentPeriod.label || currentMonthKey}):
   - Pemasukan: ${formatCurrency(currentIncome, defaultCurrency)} (${currentMonthTxs.filter((t) => t.type === 'income').length} transaksi)
   - Pengeluaran: ${formatCurrency(currentExpense, defaultCurrency)} (${currentMonthTxs.filter((t) => t.type === 'expense').length} transaksi)
   - Selisih Bersih (Pemasukan - Pengeluaran): ${formatCurrency(currentIncome - currentExpense, defaultCurrency)}
   - Kategori Terbesar Bulan Ini: ${currentTopCats || 'Belum ada'}

2. BULAN LALU (${prevPeriod.label || prevMonthKey}):
   - Pemasukan: ${formatCurrency(prevIncome, defaultCurrency)}
   - Pengeluaran: ${formatCurrency(prevExpense, defaultCurrency)}
   - Kategori Terbesar Bulan Lalu: ${prevTopCats || 'Belum ada'}

3. PERBANDINGAN BULAN INI VS BULAN LALU:
   - Perubahan Pengeluaran: ${expenseDiffStr} ${expenseDiff > 0 ? '(Pengeluaran Naik/Boros)' : expenseDiff < 0 ? '(Pengeluaran Turun/Hemat)' : '(Stabil)'}

4. UTANG & PIUTANG:
   - Total Hutang Anda: ${formatCurrency(totalDebt, defaultCurrency)} (${activeDebts.length} item aktif)
   - Total Piutang Anda: ${formatCurrency(totalReceivable, defaultCurrency)} (${activeReceivables.length} item aktif)

5. TARGET TABUNGAN:
   - ${goalsSummary || 'Belum ada target tabungan.'}

6. LAINNYA:
   - Total Habits Aktif: ${habits.length} | Tugas Belum Selesai: ${activeTodos.length}`
  } catch (err){
      console.warn('[aiDatabaseQueries]', err)
    return 'Gagal memuat ringkasan data finansial pengguna.'
  }
}
