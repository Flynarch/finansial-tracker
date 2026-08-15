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
  let txs = await db.transactions.toArray()

  if (startDate) {
    txs = txs.filter(tx => tx.date && tx.date >= startDate)
  }
  if (endDate) {
    txs = txs.filter(tx => tx.date && tx.date <= endDate)
  }

  // Sort chronologically ascending
  txs.sort((a, b) => (a.date || '').localeCompare(b.date || ''))

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
    const amt = Number(tx.amount) || 0
    if (tx.type === 'income') totalIncome += amt
    if (tx.type === 'expense') totalExpense += amt
  })

  // Group by category
  const expenseByCategory = {}
  const incomeByCategory = {}
  txs.forEach(tx => {
    const amt = Number(tx.amount) || 0
    if (tx.type === 'expense') {
      expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + amt
    } else if (tx.type === 'income') {
      incomeByCategory[tx.category] = (incomeByCategory[tx.category] || 0) + amt
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
 * Fetches a comprehensive financial & task summary (including multi-month comparison)
 * to inject directly into AI System Prompt for zero-latency, high-accuracy answers.
 */
export async function getMonthSummaryForPrompt() {
  try {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-indexed
    
    const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
    
    // Calculate previous month prefix
    const prevDate = new Date(currentYear, currentMonth - 1, 1)
    const prevMonthPrefix = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    
    const allTxs = await db.transactions.toArray()
    
    // Current month metrics
    const currentMonthTxs = allTxs.filter(t => t.date && t.date.startsWith(currentMonthPrefix))
    let currentIncome = 0
    let currentExpense = 0
    const currentCatMap = {}
    
    currentMonthTxs.forEach(t => {
      const amt = Number(t.amount) || 0
      if (t.type === 'income') currentIncome += amt
      if (t.type === 'expense') {
        currentExpense += amt
        currentCatMap[t.category] = (currentCatMap[t.category] || 0) + amt
      }
    })
    
    const currentTopCats = Object.entries(currentCatMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat, val]) => `${cat}: Rp ${val.toLocaleString('id-ID')}`)
      .join(', ')

    // Previous month metrics
    const prevMonthTxs = allTxs.filter(t => t.date && t.date.startsWith(prevMonthPrefix))
    let prevIncome = 0
    let prevExpense = 0
    const prevCatMap = {}
    
    prevMonthTxs.forEach(t => {
      const amt = Number(t.amount) || 0
      if (t.type === 'income') prevIncome += amt
      if (t.type === 'expense') {
        prevExpense += amt
        prevCatMap[t.category] = (prevCatMap[t.category] || 0) + amt
      }
    })
    
    const prevTopCats = Object.entries(prevCatMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat, val]) => `${cat}: Rp ${val.toLocaleString('id-ID')}`)
      .join(', ')

    // Comparisons
    const expenseDiff = currentExpense - prevExpense
    const expensePct = prevExpense > 0 ? Math.round((expenseDiff / prevExpense) * 100) : null
    const expenseDiffStr = expensePct !== null
      ? `${expenseDiff >= 0 ? '+' : ''}Rp ${expenseDiff.toLocaleString('id-ID')} (${expenseDiff >= 0 ? '+' : ''}${expensePct}%)`
      : 'Bulan lalu belum ada data'

    // Loans / Debts
    const loans = await db.loans.toArray().catch(() => [])
    const activeDebts = loans.filter(l => l.type === 'debt' && l.status !== 'paid')
    const activeReceivables = loans.filter(l => l.type === 'receivable' && l.status !== 'paid')
    const totalDebt = activeDebts.reduce((s, l) => s + (l.remainingAmount ?? l.totalAmount ?? 0), 0)
    const totalReceivable = activeReceivables.reduce((s, l) => s + (l.remainingAmount ?? l.totalAmount ?? 0), 0)

    // Goals / Savings
    const goals = await db.goals.toArray().catch(() => [])
    const goalsSummary = goals.map(g => `${g.name}: Rp ${(g.currentAmount || 0).toLocaleString('id-ID')} / Rp ${(g.targetAmount || 0).toLocaleString('id-ID')}`).join('; ')

    // Habits & Todos
    const habits = await db.habits.toArray().catch(() => [])
    const activeTodos = await db.todos.where('completed').equals(0).toArray().catch(() => [])

    return `
1. BULAN INI (${currentMonthPrefix}):
   - Pemasukan: Rp ${currentIncome.toLocaleString('id-ID')} (${currentMonthTxs.filter(t => t.type === 'income').length} transaksi)
   - Pengeluaran: Rp ${currentExpense.toLocaleString('id-ID')} (${currentMonthTxs.filter(t => t.type === 'expense').length} transaksi)
   - Selisih Bersih (Pemasukan - Pengeluaran): Rp ${(currentIncome - currentExpense).toLocaleString('id-ID')}
   - Kategori Terbesar Bulan Ini: ${currentTopCats || 'Belum ada'}

2. BULAN LALU (${prevMonthPrefix}):
   - Pemasukan: Rp ${prevIncome.toLocaleString('id-ID')}
   - Pengeluaran: Rp ${prevExpense.toLocaleString('id-ID')}
   - Kategori Terbesar Bulan Lalu: ${prevTopCats || 'Belum ada'}

3. PERBANDINGAN BULAN INI VS BULAN LALU:
   - Perubahan Pengeluaran: ${expenseDiffStr} ${expenseDiff > 0 ? '(Pengeluaran Naik/Boros)' : expenseDiff < 0 ? '(Pengeluaran Turun/Hemat)' : '(Stabil)'}

4. UTANG & PIUTANG:
   - Total Hutang Anda: Rp ${totalDebt.toLocaleString('id-ID')} (${activeDebts.length} item aktif)
   - Total Piutang Anda: Rp ${totalReceivable.toLocaleString('id-ID')} (${activeReceivables.length} item aktif)

5. TARGET TABUNGAN:
   - ${goalsSummary || 'Belum ada target tabungan.'}

6. LAINNYA:
   - Total Habits Aktif: ${habits.length} | Tugas Belum Selesai: ${activeTodos.length}`
  } catch {
    return 'Gagal memuat ringkasan data finansial pengguna.'
  }
}
