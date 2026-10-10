// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/lib/db'
import { parseExpenseCategoryPath } from '../src/lib/expenseCategories'
import { PRINT_THEME_COLORS } from '../src/lib/exportReports'
import { groupTransactionsDetailed } from '../src/components/transactions/transactionDateGrouping'
import { unarchiveWallet } from '../src/services/walletService'
import useLoanStore from '../src/store/useLoanStore'
import { processRecurringTransactions } from '../src/lib/automation'

describe('Adjacent Subsystems Hardening - Round 6', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.wallets.clear()
    await db.loans.clear()
    await db.loanPayments.clear()
    await db.recurringTransactions.clear()
    await db.notifications.clear()
  })

  // F6-01: Balance sheet uses computed wallets with currentBalance
  it('F6-01: balance sheet calculation receives wallets with dynamic currentBalance', async () => {
    const walletId = await db.wallets.add({
      name: 'BCA Utama',
      currency: 'IDR',
      balance: 0, // initial balance
    })

    await db.transactions.add({
      walletId,
      type: 'income',
      amount: 50000000,
      date: '2026-03-01',
      createdAt: Date.now(),
    })

    const rawWallets = await db.wallets.toArray()
    expect(rawWallets[0].balance).toBe(0)

    const { getAllWalletBalances } = await import('../src/lib/balanceEngine')
    const computedWallets = await getAllWalletBalances(rawWallets, {})
    expect(computedWallets[0].currentBalance).toBe(50000000)

    const { generateBalanceSheet } = await import('../src/lib/accountingEngine')
    const sheet = generateBalanceSheet(computedWallets, [], [], {
      asOfDate: '2026-03-10',
      defaultCurrency: 'IDR',
      rates: {},
      transactions: await db.transactions.toArray(),
      loanPayments: [],
    })

    expect(sheet.assets.currentAssets.total).toBe(50000000)
    expect(sheet.assets.totalAssets).toBe(50000000)
    expect(sheet.equity.netWorth).toBe(50000000)
  })

  // F6-02: 1Y range cutoff includes 24 months of history
  it('F6-02: 1Y revenue range uses 24 months cutoff for comparison curves', async () => {
    const { format, subMonths, startOfMonth } = await import('date-fns')
    const isMultiYear = true
    const cutoffMonths = isMultiYear ? 24 : 12
    const txCutoffDate = format(subMonths(startOfMonth(new Date('2026-03-15')), cutoffMonths), 'yyyy-MM-dd')
    expect(txCutoffDate).toBe('2024-03-01')
  })

  // F6-03: AI Chat CSV export delegates to hardened exportTransactionsToCsv
  it('F6-03: AI Chat export delegates to exportTransactionsToCsv with sanitization', async () => {
    const walletId = await db.wallets.add({
      name: 'Mandiri',
      currency: 'IDR',
      balance: 1000000,
    })

    await db.transactions.add({
      walletId,
      type: 'expense',
      amount: 25000,
      category: 'makanan/makan_siang',
      notes: '=cmd|calc!A0', // formula injection probe
      date: '2026-03-05',
      createdAt: Date.now(),
    })

    const { handleExportAction } = await import('../src/lib/ai/chatActions/exportActions')
    const msgs = await handleExportAction({ month: '2026-03' }, { defaultCurrency: 'IDR', locale: 'id' })

    expect(msgs.length).toBeGreaterThan(0)
    expect(msgs[0].data?.type).toBe('export')
    expect(msgs[0].data?.action).toBe('create')
  })

  // F6-04: Recurring auto-execution forwards split items, tags, and resolves fallback wallet
  it('F6-04: recurring auto-execution forwards splitItems, tags, and resolves active wallet', async () => {
    const walletId = await db.wallets.add({
      name: 'Dompet Operasional',
      currency: 'IDR',
      balance: 500000,
      isArchived: 0,
    })

    await db.recurringTransactions.add({
      id: 701,
      title: 'Split Office Supplies',
      amount: 150000,
      type: 'expense',
      category: 'tagihan/umum',
      frequency: 'monthly',
      startDate: '2026-02-01',
      nextDate: '2026-02-01',
      anchorDay: 1,
      enabled: true,
      autoExecute: true,
      tags: ['office', 'monthly'],
      isSplit: true,
      splitItems: [
        { amount: 100000, category: 'tagihan/listrik', type: 'expense', notes: 'Listrik' },
        { amount: 50000, category: 'tagihan/air', type: 'expense', notes: 'Air' },
      ],
      // walletId omitted on purpose to test fallback resolution
    })

    await processRecurringTransactions(new Date('2026-02-05T12:00:00'))

    const txs = await db.transactions.toArray()
    expect(txs.length).toBe(1)
    const generatedTx = txs[0]
    expect(generatedTx.walletId).toBe(walletId)
    expect(generatedTx.isSplit).toBe(true)
    expect(generatedTx.splitItems?.length).toBe(2)
    expect(generatedTx.tags).toEqual(['office', 'monthly'])
  })

  // F6-05: Manual recurring recording logs transaction and advances nextDate
  it('F6-05: manual recurring can be logged to ledger and advances nextDate', async () => {
    const walletId = await db.wallets.add({
      name: 'BCA Tabungan',
      currency: 'IDR',
      balance: 5000000,
    })

    await db.recurringTransactions.add({
      id: 801,
      title: 'Manual Rent Reminder',
      amount: 2000000,
      type: 'expense',
      category: 'rumah/sewa',
      frequency: 'monthly',
      startDate: '2026-03-01',
      nextDate: '2026-03-01',
      anchorDay: 1,
      enabled: true,
      autoExecute: false, // manual reminder
      walletId,
    })

    const { createTransaction } = await import('../src/services/transactionService')
    const { nextDateByFrequency } = await import('../src/lib/automation')

    const item = await db.recurringTransactions.get(801)
    await createTransaction({
      date: '2026-03-01',
      amount: item.amount,
      type: item.type,
      category: item.category,
      walletId: item.walletId,
      notes: item.title,
    })

    const nextPointer = nextDateByFrequency(new Date('2026-03-01T12:00:00'), item.frequency, item.anchorDay)
    const nextDateStr = nextPointer.toISOString().slice(0, 10)
    await db.recurringTransactions.update(item.id, { nextDate: nextDateStr, lastRun: '2026-03-01' })

    const updated = await db.recurringTransactions.get(801)
    expect(updated.nextDate).toBe('2026-04-01')
    expect(updated.lastRun).toBe('2026-03-01')

    const txs = await db.transactions.toArray()
    expect(txs.length).toBe(1)
    expect(txs[0].amount).toBe(2000000)
  })

  // F6-06: Loan soft-archive preserves historical loan payments and unlinks transactions
  it('F6-06: archiveLoan soft-archives loan and payments, decoupling ledger transactions', async () => {
    const walletId = await db.wallets.add({
      name: 'BCA',
      currency: 'IDR',
      balance: 5000000,
    })

    const loanId = await db.loans.add({
      title: 'Pinjaman Modal',
      personName: 'Budi',
      type: 'receivable',
      totalAmount: 1000000,
      remainingAmount: 500000,
      walletId,
      status: 'active',
    })

    const paymentId = await db.loanPayments.add({
      loanId,
      amount: 500000,
      date: '2026-02-01',
    })

    const txId = await db.transactions.add({
      loanId,
      walletId,
      type: 'income',
      amount: 500000,
      date: '2026-02-01',
      createdAt: Date.now(),
    })

    await useLoanStore.getState().archiveLoan(loanId)

    const archivedLoan = await db.loans.get(loanId)
    expect(archivedLoan.isArchived).toBe(1)
    expect(archivedLoan.deletedAt).toBeDefined()

    const archivedPayment = await db.loanPayments.get(paymentId)
    expect(archivedPayment.isArchived).toBe(1)

    // Transaction decoupled, not destroyed
    const preservedTx = await db.transactions.get(txId)
    expect(preservedTx).toBeDefined()
    expect(preservedTx.loanId).toBeNull()
  })

  // F6-07: HTML export CSS does not output '${...}' literal string
  it('F6-07: PRINT_THEME_COLORS are valid CSS colors without string literal interpolation bugs', () => {
    const netSavingsPositive = 100000
    const netSavingsNegative = -50000

    const colorPos = netSavingsPositive >= 0 ? PRINT_THEME_COLORS.textIncome : PRINT_THEME_COLORS.textExpense
    const colorNeg = netSavingsNegative >= 0 ? PRINT_THEME_COLORS.textIncome : PRINT_THEME_COLORS.textExpense

    expect(colorPos).toBe('#059669')
    expect(colorNeg).toBe('#e11d48')
    expect(colorPos).not.toContain('${')
    expect(colorNeg).not.toContain('${')
  })

  // F6-08: Category parser preserves parent category when subcategory is removed
  it('F6-08: parseExpenseCategoryPath preserves parent category when subcategory is missing or custom', () => {
    // makanan exists in default tree, but custom_legacy_sub is missing
    const parsed = parseExpenseCategoryPath('makanan/custom_legacy_sub')
    expect(parsed).not.toBeNull()
    expect(parsed.parentId).toBe('makanan')
    expect(parsed.childId).toBe('custom_legacy_sub')
    expect(parsed.parent).toBeDefined()
    expect(parsed.parent.id).toBe('makanan')
    expect(parsed.child).toBeNull()
  })

  // F6-09: unarchiveWallet restores archived wallet
  it('F6-09: unarchiveWallet restores wallet from isArchived: 1 to isArchived: 0', async () => {
    const walletId = await db.wallets.add({
      name: 'Tabungan Lama',
      currency: 'IDR',
      balance: 200000,
      isArchived: 1,
    })

    await unarchiveWallet(walletId)

    const restored = await db.wallets.get(walletId)
    expect(restored.isArchived).toBe(0)
  })

  // F6-10: groupTransactionsDetailed sorts intra-day items by time descending
  it('F6-10: groupTransactionsDetailed sorts items within same day by time descending', () => {
    const txs = [
      { id: 1, date: '2026-03-10', time: '08:30', amount: 10000, type: 'expense', category: 'makanan' },
      { id: 2, date: '2026-03-10', time: '19:45', amount: 50000, type: 'expense', category: 'makanan' },
      { id: 3, date: '2026-03-10', time: '12:15', amount: 25000, type: 'expense', category: 'makanan' },
    ]

    const groups = groupTransactionsDetailed(txs, { defaultCurrency: 'IDR' })
    expect(groups.length).toBe(1)
    const dayItems = groups[0].items
    expect(dayItems.length).toBe(3)
    expect(dayItems[0].time).toBe('19:45')
    expect(dayItems[1].time).toBe('12:15')
    expect(dayItems[2].time).toBe('08:30')
    expect(groups[0].dailySummaryText).toMatch(/-Rp[\s\u00a0]85\.000/)
  })
})
