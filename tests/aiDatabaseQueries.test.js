import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/lib/db'
import { queryTransactions, getMonthSummaryForPrompt } from '../src/lib/aiDatabaseQueries'
import useSettingsStore from '../src/store/useSettingsStore'

describe('aiDatabaseQueries', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.loans.clear()
    await db.goals.clear()
    await db.habits.clear()
    await db.todos.clear()
    useSettingsStore.setState({ defaultCurrency: 'IDR' })
  })

  it('unpacks split transactions and calculates category sums correctly', async () => {
    await db.transactions.add({
      date: '2026-09-10',
      type: 'expense',
      amount: 100000,
      category: 'Belanja',
      isSplit: true,
      splitItems: [
        { category: 'Makanan', amount: 60000, type: 'expense' },
        { category: 'Transportasi', amount: 40000, type: 'expense' },
      ],
    })

    const result = await queryTransactions({ startDate: '2026-09-01', endDate: '2026-09-30' })
    expect(result.totalTransactionsFound).toBe(2)
    expect(result.totalExpense).toBe(100000)
    expect(result.expenseByCategory['Makanan']).toBe(60000)
    expect(result.expenseByCategory['Transportasi']).toBe(40000)
  })

  it('excludes items with isExcludeFromAnalytics from queries', async () => {
    await db.transactions.add({
      date: '2026-09-11',
      type: 'expense',
      amount: 50000,
      category: 'Transfer',
      isExcludeFromAnalytics: true,
    })

    await db.transactions.add({
      date: '2026-09-11',
      type: 'expense',
      amount: 25000,
      category: 'Makan Siang',
      isExcludeFromAnalytics: false,
    })

    const result = await queryTransactions({ startDate: '2026-09-01', endDate: '2026-09-30' })
    expect(result.totalTransactionsFound).toBe(1)
    expect(result.totalExpense).toBe(25000)
    expect(result.expenseByCategory['Makan Siang']).toBe(25000)
  })

  it('normalizes multi-currency transactions to default currency', async () => {
    await db.transactions.add({
      date: '2026-09-12',
      type: 'expense',
      amount: 10,
      currency: 'USD',
      category: 'Langganan Software',
    })

    const result = await queryTransactions({ startDate: '2026-09-01', endDate: '2026-09-30' })
    expect(result.totalTransactionsFound).toBe(1)
    expect(result.currency).toBe('IDR')
    expect(result.totalExpense).toBeGreaterThan(100000)
    expect(result.expenseByCategory['Langganan Software']).toBeGreaterThan(100000)
  })

  it('generates prompt summary with safe date stepping and unpacked splits', async () => {
    const today = new Date().toISOString().slice(0, 10)
    await db.transactions.add({
      date: today,
      type: 'income',
      amount: 5000000,
      category: 'Gaji',
    })

    await db.transactions.add({
      date: today,
      type: 'expense',
      amount: 150000,
      category: 'Makan',
      isSplit: true,
      splitItems: [
        { category: 'Makan Pagi', amount: 50000, type: 'expense' },
        { category: 'Makan Siang', amount: 100000, type: 'expense' },
      ],
    })

    const summary = await getMonthSummaryForPrompt()
    expect(summary).toContain('BULAN INI')
    expect(summary).toMatch(/Pemasukan:\s*Rp\s*5\.000\.000/)
    expect(summary).toMatch(/Pengeluaran:\s*Rp\s*150\.000/)
  })

  it('CRIT-03 & MED-01: correctly queries active todos with boolean completed and sanitizes goal tags', async () => {
    // Add completed and uncompleted todos (completed is boolean false/true)
    await db.todos.add({
      title: 'Bayar Tagihan Listrik',
      completed: false,
    })
    await db.todos.add({
      title: 'Beli Kado',
      completed: true,
    })

    // Add goal with dangerous XML/HTML brackets
    await db.goals.add({
      name: '<script>alert("hack")</script> Dana Darurat',
      currentAmount: 1000000,
      targetAmount: 5000000,
      currency: 'IDR',
    })

    const summary = await getMonthSummaryForPrompt()
    expect(summary).toContain('Tugas Belum Selesai: 1')
    expect(summary).not.toContain('<script>')
    expect(summary).toContain('scriptalert(hack)/script Dana Darurat')
  })
})
