import { db } from './db'

/**
 * Executes a query against the local Dexie DB on behalf of the AI.
 * Returns summarized data to prevent prompt context limits.
 * 
 * @param {object} params
 * @param {string} [params.startDate] YYYY-MM-DD
 * @param {string} [params.endDate] YYYY-MM-DD
 * @param {string} [params.type] 'income' | 'expense'
 * @param {string} [params.category]
 */
export async function queryTransactions({ startDate, endDate, type, category }) {
  let collection = db.transactions.orderBy('date')

  if (startDate && endDate) {
    // If both are provided, use Dexie's optimized between query
    collection = collection.between(startDate, endDate, true, true)
  } 

  let txs = await collection.toArray()

  // Apply filters manually if single dates were provided (or fallback)
  if (startDate && !endDate) {
    txs = txs.filter(tx => tx.date >= startDate)
  }
  if (endDate && !startDate) {
    txs = txs.filter(tx => tx.date <= endDate)
  }

  if (type) {
    txs = txs.filter(tx => tx.type === type)
  }

  if (category) {
    const catLower = category.toLowerCase()
    txs = txs.filter(tx => tx.category && tx.category.toLowerCase().includes(catLower))
  }

  // Calculate summaries
  let totalIncome = 0
  let totalExpense = 0
  
  txs.forEach(tx => {
    if (tx.type === 'income') totalIncome += tx.amount
    if (tx.type === 'expense') totalExpense += tx.amount
  })

  // Group by category
  const expenseByCategory = {}
  const incomeByCategory = {}
  txs.forEach(tx => {
    if (tx.type === 'expense') {
      expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + tx.amount
    } else if (tx.type === 'income') {
      incomeByCategory[tx.category] = (incomeByCategory[tx.category] || 0) + tx.amount
    }
  })

  // Return a structured summary to the AI
  return {
    queryParameters: { startDate, endDate, type, category },
    totalTransactionsFound: txs.length,
    totalIncome,
    totalExpense,
    netBalance: totalIncome - totalExpense,
    expenseByCategory,
    incomeByCategory,
    // Only return the 10 most recent transactions to avoid exceeding AI context window
    recentSampleTransactions: txs.slice(-10).map(tx => ({
      date: tx.date,
      type: tx.type,
      category: tx.category,
      amount: tx.amount,
      notes: tx.notes
    }))
  }
}

/**
 * Fetches a lightweight financial & task summary for current month to inject into AI System Prompt.
 */
export async function getMonthSummaryForPrompt() {
  try {
    const now = new Date()
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    
    const allTxs = await db.transactions.toArray()
    const monthTxs = allTxs.filter(t => t.date && t.date.startsWith(currentMonthPrefix))
    
    let totalIncome = 0
    let totalExpense = 0
    const catMap = {}
    
    monthTxs.forEach(t => {
      if (t.type === 'income') totalIncome += (t.amount || 0)
      if (t.type === 'expense') {
        totalExpense += (t.amount || 0)
        catMap[t.category] = (catMap[t.category] || 0) + (t.amount || 0)
      }
    })
    
    const topCategories = Object.entries(catMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cat, val]) => `${cat}: Rp ${val.toLocaleString('id-ID')}`)
      .join(', ')

    const habits = await db.habits.toArray()
    const activeTodos = await db.todos.where('completed').equals(0).toArray().catch(() => [])

    return `
- Transaksi Bulan Ini (${currentMonthPrefix}): Pemasukan Rp ${totalIncome.toLocaleString('id-ID')} | Pengeluaran Rp ${totalExpense.toLocaleString('id-ID')}
- Top Kategori Pengeluaran: ${topCategories || 'Belum ada'}
- Total Habits Aktif: ${habits.length} | Tugas Belum Selesai: ${activeTodos.length}`
  } catch {
    return 'Gagal memuat ringkasan bulan ini.'
  }
}
