import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/lib/db'
import { getLocalDateString } from '../src/lib/dateUtils'
import { createTransaction, updateTransaction, deleteTransaction } from '../src/services/transactionService'
import { deleteWallet } from '../src/services/walletService'
import { exportAllDataAsJson, exportAllDataAsEncryptedEnvelope } from '../src/lib/backup'
import useLoanStore from '../src/store/useLoanStore'
import useSettingsStore from '../src/store/useSettingsStore'
import { computeWalletBalance, computeAllWalletBalances } from '../src/lib/db'
import { isExcludeAnalyticsTx } from '../src/lib/utils'
import { aggregateMonthlyIncomeExpense } from '../src/lib/reportAnalytics'
import { evaluateExpression } from '../src/lib/calcParser'
import { calculateBudgetSpent } from '../src/lib/budgetUtils'

describe('Phase 1 - Data Integrity & Atomicity', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.wallets.clear()
    await db.loans.clear()
    await db.loanPayments.clear()
  })

  it('getLocalDateString returns valid YYYY-MM-DD local date', () => {
    const d = getLocalDateString()
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('deleteWallet archives wallet instead of hard deleting (soft-delete)', async () => {
    const walletId = await db.wallets.add({
      name: 'Bank Test',
      balance: 100000,
      currency: 'IDR',
      isArchived: 0,
    })

    const txId = await db.transactions.add({
      amount: 50000,
      type: 'expense',
      walletId,
      date: '2026-03-01',
    })

    await deleteWallet(walletId)

    // Wallet is archived, NOT deleted from IndexedDB
    const wallet = await db.wallets.get(walletId)
    expect(wallet).toBeDefined()
    expect(wallet.isArchived).toBe(1)

    // Transactions remain intact
    const tx = await db.transactions.get(txId)
    expect(tx).toBeDefined()
    expect(tx.amount).toBe(50000)
  })

  it('updateTransaction on initial loan transaction updates loan totalAmount and remainingAmount', async () => {
    const walletId = await db.wallets.add({
      name: 'Kas',
      balance: 500000,
      currency: 'IDR',
    })

    const loanId = await db.loans.add({
      title: 'Pinjaman Teman',
      type: 'receivable',
      totalAmount: 100000,
      remainingAmount: 100000,
      status: 'active',
      walletId,
      initialTransactionId: null,
    })

    const initialTxId = await db.transactions.add({
      amount: 100000,
      type: 'expense',
      category: 'Pinjaman Diberikan',
      walletId,
      loanId,
      date: '2026-03-01',
    })

    await db.loans.update(loanId, { initialTransactionId: initialTxId })

    // Edit initial transaction amount from 100,000 to 150,000
    await updateTransaction(initialTxId, { amount: 150000 })

    const updatedTx = await db.transactions.get(initialTxId)
    expect(updatedTx.amount).toBe(150000)

    const updatedLoan = await db.loans.get(loanId)
    expect(updatedLoan.totalAmount).toBe(150000)
    expect(updatedLoan.remainingAmount).toBe(150000)
  })

  it('recordPayment atomically creates transaction, payment log, and updates loan remainingAmount', async () => {
    const walletId = await db.wallets.add({
      name: 'Dompet Utama',
      balance: 1000000,
      currency: 'IDR',
    })

    const loanId = await useLoanStore.getState().addLoan({
      title: 'Cicilan HP',
      type: 'debt',
      totalAmount: 2000000,
      walletId,
      startDate: '2026-02-01',
    })

    await useLoanStore.getState().recordPayment(loanId, 500000, '2026-03-01', 'Cicilan ke-1')

    const loan = await db.loans.get(loanId)
    expect(loan.remainingAmount).toBe(1500000)
    expect(loan.status).toBe('partially_paid')

    const payments = await db.loanPayments.where('loanId').equals(loanId).toArray()
    expect(payments).toHaveLength(1)
    expect(payments[0].amount).toBe(500000)
    expect(payments[0].transactionId).toBeDefined()

    const tx = await db.transactions.get(payments[0].transactionId)
    expect(tx).toBeDefined()
    expect(tx.amount).toBe(500000)
    expect(tx.type).toBe('expense')
    expect(tx.isExcludeFromAnalytics).toBe(true)
  })

  it('deleteTransaction throws when trying to delete the initial transaction of an active loan', async () => {
    const walletId = await db.wallets.add({
      name: 'Kas',
      balance: 100000,
      currency: 'IDR',
    })

    const loanId = await useLoanStore.getState().addLoan({
      title: 'Pinjam Uang',
      type: 'debt',
      totalAmount: 100000,
      walletId,
      startDate: '2026-03-01',
    })

    const loan = await db.loans.get(loanId)
    expect(loan.initialTransactionId).toBeDefined()

    await expect(deleteTransaction(loan.initialTransactionId)).rejects.toThrow(
      'Transaksi ini merupakan pencairan pokok pinjaman aktif'
    )

    // Verify transaction was NOT deleted
    const tx = await db.transactions.get(loan.initialTransactionId)
    expect(tx).toBeDefined()
  })

  it('exportAllDataAsEncryptedEnvelope throws when phrase is empty and exportAllDataAsJson sanitizes geminiApiKey', async () => {
    await db.settings.put({
      key: 'preferences',
      geminiApiKey: 'AIzaSySecretApiKey12345',
      lockSecret: 'hashedSecret999',
    })

    const rawBackup = await exportAllDataAsJson()
    const prefSetting = rawBackup.data.settings.find((s) => s.key === 'preferences')
    expect(prefSetting.lockSecret).toBeUndefined()
    expect(prefSetting.geminiApiKey).toBeUndefined()

    // Encrypted export requires non-empty 12-word phrase
    await expect(exportAllDataAsEncryptedEnvelope('')).rejects.toThrow(
      'Frasa pemulihan 12-kata diperlukan'
    )
  })

  it('updateTransaction allows negative amount for balance_adjustment without re-passing type', async () => {
    const txId = await db.transactions.add({
      type: 'balance_adjustment',
      amount: -10000,
      date: '2026-03-01',
    })

    await updateTransaction(txId, { amount: -25000 })
    const updated = await db.transactions.get(txId)
    expect(updated.amount).toBe(-25000)
  })

  it('updateTransaction sanitizes string amounts to numbers', async () => {
    const txId = await db.transactions.add({
      type: 'expense',
      amount: 10000,
      date: '2026-03-01',
    })

    await updateTransaction(txId, { amount: '75000' })
    const updated = await db.transactions.get(txId)
    expect(updated.amount).toBe(75000)
    expect(typeof updated.amount).toBe('number')
  })

  it('createTransaction triggers in-app notification for overall budget category all', async () => {
    await db.notifications.clear()
    await db.budgets.clear()

    await db.budgets.add({
      category: 'all',
      limit: 100000,
      month: '2026-03',
    })

    const walletId = await db.wallets.add({
      name: 'Dompet Utama',
      balance: 1000000,
      currency: 'IDR',
    })

    await createTransaction({
      walletId,
      type: 'expense',
      amount: 90000,
      category: 'Makanan',
      date: '2026-03-05',
    })

    const notifs = await db.notifications.toArray()
    expect(notifs.length).toBeGreaterThan(0)
    expect(notifs[0].message).toMatch(/Total Anggaran|Total Budget/)
  })

  it('throws error when walletId is missing and defaultWalletId is null', async () => {
    await expect(
      createTransaction({
        type: 'expense',
        amount: 50000,
        category: 'Makanan',
        date: '2026-03-05',
      })
    ).rejects.toThrow('Dompet wajib dipilih.')
  })

  it('falls back to defaultWalletId when walletId is omitted from payload', async () => {
    useSettingsStore.setState({ defaultWalletId: 999 })
    const createdId = await createTransaction({
      type: 'expense',
      amount: 15000,
      category: 'Makanan',
      date: '2026-03-05',
    })
    const tx = await db.transactions.get(createdId)
    expect(tx.walletId).toBe(999)
    useSettingsStore.setState({ defaultWalletId: null })
  })

  it('cross-currency incoming transfer without tx.currency matches batch balance calculation', () => {
    const idrWallet = { id: 1, balance: 100000, currency: 'IDR' }
    const usdWallet = { id: 2, balance: 0, currency: 'USD' }
    const allWallets = [idrWallet, usdWallet]

    const transferTx = {
      id: 101,
      type: 'transfer',
      amount: 16000, // 16,000 IDR transferred to USD wallet
      walletId: 1, // from IDR
      targetWalletId: 2, // to USD
      // currency omitted to simulate legacy/missing field
    }

    const rates = { USD: 1, IDR: 16000 } // Rates are based on 1 USD = 16000 IDR

    // Single wallet balance calculation
    const singleBal = computeWalletBalance(usdWallet, [transferTx], rates, allWallets)
    // Batch balance calculation
    const batchBals = computeAllWalletBalances(allWallets, [transferTx], rates)
    const batchUsdBal = batchBals.find((w) => w.id === 2)?.currentBalance

    expect(singleBal).toBe(1)
    expect(batchUsdBal).toBe(1)
    expect(singleBal).toBe(batchUsdBal)
  })

  it('isExcludeAnalyticsTx properly identifies investment expenses', () => {
    expect(isExcludeAnalyticsTx({ type: 'expense', category: 'investasi_pengeluaran' })).toBe(true)
    expect(isExcludeAnalyticsTx({ type: 'expense', category: 'investasi_pengeluaran/saham' })).toBe(true)
    expect(isExcludeAnalyticsTx({ type: 'expense', category: 'investasi_pengeluaran/emas' })).toBe(true)
    expect(isExcludeAnalyticsTx({ type: 'expense', category: 'makanan' })).toBe(false)
  })

  it('aggregateMonthlyIncomeExpense converts currency with fallback rates when rates is null', () => {
    const txs = [
      { id: 1, date: '2026-03-01', type: 'income', amount: 10, currency: 'USD' },
    ]
    // Call with rangeMonths = 1, defaultCurrency = 'IDR', rates = null, referenceDate = 2026-03-15
    const result = aggregateMonthlyIncomeExpense(txs, 1, 'IDR', null, new Date('2026-03-15'))
    expect(result.length).toBe(1)
    // Fallback rate: 1 USD = 16,800 IDR -> 10 USD = 168,000 IDR
    expect(result[0].income).toBe(168000)
  })

  it('updateLoan synchronizes startDate and currency to initialTransactionId', async () => {
    const walletId = await db.wallets.add({
      name: 'Dompet Sync',
      balance: 1000000,
      currency: 'IDR',
    })

    const initialTxId = await db.transactions.add({
      amount: 200000,
      type: 'expense',
      category: 'Pinjaman Diberikan',
      walletId,
      currency: 'IDR',
      date: '2026-03-01',
    })

    const loanId = await db.loans.add({
      title: 'Pinjaman Budi',
      type: 'receivable',
      totalAmount: 200000,
      remainingAmount: 200000,
      status: 'active',
      walletId,
      currency: 'IDR',
      startDate: '2026-03-01',
      initialTransactionId: initialTxId,
    })

    await useLoanStore.getState().updateLoan(loanId, {
      title: 'Pinjaman Budi Update',
      startDate: '2026-03-15',
      currency: 'USD',
    })

    const updatedTx = await db.transactions.get(initialTxId)
    expect(updatedTx.date).toBe('2026-03-15')
    expect(updatedTx.currency).toBe('USD')
  })

  it('evaluateExpression supports allowNegative: true', () => {
    expect(evaluateExpression('-50000', 'IDR', { allowNegative: true }).result).toBe(-50000)
    expect(evaluateExpression('10000 - 25000', 'IDR', { allowNegative: true }).result).toBe(-15000)
    // Default remains non-negative
    expect(evaluateExpression('-50000', 'IDR').result).toBe(0)
  })

  it('calculateBudgetSpent clamps floating-point decimals to 2 places', () => {
    const txs = [
      { amount: 10.00000000004, category: 'makanan', type: 'expense' },
      { amount: 20.00000000003, category: 'makanan', type: 'expense' },
    ]
    const spent = calculateBudgetSpent('makanan', txs, 'IDR')
    expect(spent).toBe(30)
  })

  it('updateTransaction throws error when walletId is set to null or empty', async () => {
    const walletId = await db.wallets.add({ name: 'Kas', balance: 100000, currency: 'IDR' })
    const txId = await db.transactions.add({
      type: 'expense',
      amount: 25000,
      walletId,
      date: '2026-03-01',
    })

    await expect(updateTransaction(txId, { walletId: null })).rejects.toThrow('Dompet wajib dipilih.')
    await expect(updateTransaction(txId, { walletId: '' })).rejects.toThrow('Dompet wajib dipilih.')
  })

  it('isExcludeAnalyticsTx respects tx.isExcludeAnalyticsTx flag', () => {
    expect(isExcludeAnalyticsTx({ isExcludeAnalyticsTx: true, type: 'expense', amount: 50000 })).toBe(true)
    expect(isExcludeAnalyticsTx({ type: 'expense', amount: 50000, category: 'makanan' })).toBe(false)
  })

  it('updateLoan on split bill loan updates pooled initial transaction amount by delta without overwriting notes', async () => {
    const walletId = await db.wallets.add({ name: 'Kas', balance: 500000, currency: 'IDR' })
    const splitBillId = 'SPLIT-TEST-123'

    // Pooled friends disbursement transaction (Friend 1: 100k + Friend 2: 100k = 200k)
    const friendsTxId = await db.transactions.add({
      amount: 200000,
      type: 'expense',
      category: 'Pinjaman Diberikan',
      notes: 'Split Bill (Talangan Teman): Dinner',
      walletId,
      splitBillId,
      date: '2026-03-01',
    })

    // Friend 1 loan
    const loan1Id = await db.loans.add({
      title: 'Patungan: Dinner',
      personName: 'Andi',
      type: 'receivable',
      totalAmount: 100000,
      remainingAmount: 100000,
      status: 'active',
      walletId,
      splitBillId,
      initialTransactionId: friendsTxId,
    })

    // Friend 2 loan
    await db.loans.add({
      title: 'Patungan: Dinner',
      personName: 'Budi',
      type: 'receivable',
      totalAmount: 100000,
      remainingAmount: 100000,
      status: 'active',
      walletId,
      splitBillId,
      initialTransactionId: friendsTxId,
    })

    // Update Friend 1 loan amount from 100,000 to 120,000 (+20,000 delta)
    await useLoanStore.getState().updateLoan(loan1Id, {
      totalAmount: 120000,
      title: 'Patungan: Dinner + Dessert',
    })

    // Pooled transaction amount should be 200,000 + 20,000 = 220,000 (NOT replaced with 120,000!)
    const updatedFriendsTx = await db.transactions.get(friendsTxId)
    expect(updatedFriendsTx.amount).toBe(220000)
    // Notes should remain intact for the pooled split bill disbursement
    expect(updatedFriendsTx.notes).toBe('Split Bill (Talangan Teman): Dinner')
  })

  it('split bill accounting isolation distinguishes personal expense from friend loan disbursement', async () => {
    const walletId = await db.wallets.add({ name: 'Bank BCA', balance: 500000, currency: 'IDR' })
    const billTotal = 300000
    const userShare = 100000
    const friendsShare = 200000
    const splitBillId = 'SPLIT-ACCOUNTING-TEST'
    expect(userShare + friendsShare).toBe(billTotal)

    // 1. User Personal Share
    const personalTxId = await createTransaction({
      date: '2026-03-10',
      amount: userShare,
      type: 'expense',
      category: 'makanan/restoran',
      notes: 'Split Bill (Porsi Saya): Makan Siang',
      walletId,
      tags: ['patungan', 'splitbill'],
    })

    // 2. Friends Share
    const friendsTxId = await createTransaction({
      date: '2026-03-10',
      amount: friendsShare,
      type: 'expense',
      category: 'Pinjaman Diberikan',
      isExcludeAnalyticsTx: true,
      excludeFromAnalytics: true,
      isExcludeFromAnalytics: true,
      splitBillId,
      notes: 'Split Bill (Talangan Teman): Makan Siang',
      walletId,
      tags: ['patungan', 'splitbill', 'exclude_analytics'],
    })

    const personalTx = await db.transactions.get(personalTxId)
    const friendsTx = await db.transactions.get(friendsTxId)

    // Personal share is an operational expense included in analytics
    expect(isExcludeAnalyticsTx(personalTx)).toBe(false)

    // Friends share is excluded from analytics
    expect(isExcludeAnalyticsTx(friendsTx)).toBe(true)

    // Wallet balance deductions total 100% (300k)
    const currentBal = computeWalletBalance(
      await db.wallets.get(walletId),
      [personalTx, friendsTx]
    )
    expect(currentBal).toBe(200000) // 500k - 100k - 200k = 200k
  })
})
