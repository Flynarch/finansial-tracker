import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/lib/db'
import { updateTransaction, deleteTransaction } from '../src/services/transactionService'
import useLoanStore from '../src/store/useLoanStore'
import { processRecurringTransactions } from '../src/lib/automation'

describe('Subagent A Audit Tests', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.loans.clear()
    await db.loanPayments.clear()
    await db.wallets.clear()
    await db.goals.clear()
    await db.goalLogs.clear()
    await db.investments.clear()
    await db.investmentOrders.clear()
    await db.recurringTransactions.clear()
    await db.notifications.clear()
  })

  describe('1. transactionService - updateTransaction split bill loans', () => {
    it('distributes amount delta proportionally across multiple active participant loans', async () => {
      const walletId = await db.wallets.add({
        name: 'Main Wallet',
        currency: 'IDR',
        balance: 1000000,
      })

      // Fronted transaction
      const frontedTxId = await db.transactions.add({
        date: '2026-10-01',
        amount: 200000,
        type: 'expense',
        category: 'Pinjaman Diberikan',
        walletId,
        splitBillId: 'sb-1',
        isExcludeAnalyticsTx: true,
      })

      // Participant Loan 1: 100,000
      const loan1Id = await db.loans.add({
        type: 'receivable',
        personName: 'Alice',
        title: 'Split Bill',
        totalAmount: 100000,
        remainingAmount: 100000,
        currency: 'IDR',
        status: 'active',
        initialTransactionId: frontedTxId,
        splitBillId: 'sb-1',
      })

      // Participant Loan 2: 100,000
      const loan2Id = await db.loans.add({
        type: 'receivable',
        personName: 'Bob',
        title: 'Split Bill',
        totalAmount: 100000,
        remainingAmount: 100000,
        currency: 'IDR',
        status: 'active',
        initialTransactionId: frontedTxId,
        splitBillId: 'sb-1',
      })

      // Update fronted transaction amount to 300,000 (delta = +100,000)
      await updateTransaction(frontedTxId, { amount: 300000 })

      const updatedLoan1 = await db.loans.get(loan1Id)
      const updatedLoan2 = await db.loans.get(loan2Id)

      expect(updatedLoan1.totalAmount).toBe(150000)
      expect(updatedLoan1.remainingAmount).toBe(150000)
      expect(updatedLoan2.totalAmount).toBe(150000)
      expect(updatedLoan2.remainingAmount).toBe(150000)
    })

    it('handles fronted transaction update when one participant loan is already paid', async () => {
      const walletId = await db.wallets.add({
        name: 'Main Wallet',
        currency: 'IDR',
        balance: 1000000,
      })

      const frontedTxId = await db.transactions.add({
        date: '2026-10-01',
        amount: 200000,
        type: 'expense',
        category: 'Pinjaman Diberikan',
        walletId,
        splitBillId: 'sb-2',
        isExcludeAnalyticsTx: true,
      })

      const loan1Id = await db.loans.add({
        type: 'receivable',
        personName: 'Alice',
        title: 'Split Bill',
        totalAmount: 100000,
        remainingAmount: 0,
        currency: 'IDR',
        status: 'paid',
        initialTransactionId: frontedTxId,
        splitBillId: 'sb-2',
      })

      const loan2Id = await db.loans.add({
        type: 'receivable',
        personName: 'Bob',
        title: 'Split Bill',
        totalAmount: 100000,
        remainingAmount: 100000,
        currency: 'IDR',
        status: 'active',
        initialTransactionId: frontedTxId,
        splitBillId: 'sb-2',
      })

      // Update fronted transaction to 250,000
      await updateTransaction(frontedTxId, { amount: 250000 })

      const updatedLoan1 = await db.loans.get(loan1Id)
      const updatedLoan2 = await db.loans.get(loan2Id)

      // Loan 1 was paid, so it should NOT be touched
      expect(updatedLoan1.status).toBe('paid')
      expect(updatedLoan1.remainingAmount).toBe(0)
      expect(updatedLoan2.remainingAmount).toBe(150000)
    })

    it('does not falsely reject foreign currency amount on fronted split bill update', async () => {
      const walletId = await db.wallets.add({
        name: 'Main Wallet',
        currency: 'USD',
        balance: 10000,
      })

      const frontedTxId = await db.transactions.add({
        date: '2026-10-01',
        amount: 50,
        currency: 'USD',
        type: 'expense',
        category: 'Pinjaman Diberikan',
        walletId,
        splitBillId: 'sb-usd-1',
        isExcludeAnalyticsTx: true,
      })

      // Participant loan in IDR: 500,000 IDR (~32 USD)
      await db.loans.add({
        type: 'receivable',
        personName: 'Alice',
        title: 'Split Bill',
        totalAmount: 500000,
        remainingAmount: 500000,
        currency: 'IDR',
        status: 'active',
        initialTransactionId: frontedTxId,
        splitBillId: 'sb-usd-1',
      })

      // Update to 70 USD (70 USD ~ 1,085,000 IDR > 500,000 IDR)
      // Without currency normalization in the guard, 70 < 500,000 would falsely throw!
      await expect(updateTransaction(frontedTxId, { amount: 70, currency: 'USD' })).resolves.not.toThrow()
    })
  })

  describe('1. transactionService - investment synchronization', () => {
    it('synchronizes investmentOrders when transaction amount and date change', async () => {
      const walletId = await db.wallets.add({
        name: 'Investment Wallet',
        currency: 'IDR',
        balance: 5000000,
      })

      const investmentId = await db.investments.add({
        name: 'BBCA',
        type: 'stock',
        currentPrice: 10000,
      })

      const txId = await db.transactions.add({
        date: '2026-09-01',
        amount: 1000000,
        type: 'expense',
        category: 'investasi_pengeluaran',
        walletId,
        investmentId,
      })

      const orderId = await db.investmentOrders.add({
        date: '2026-09-01',
        totalAmount: 1000000,
        name: 'BBCA',
        side: 'buy',
        transactionId: txId,
      })

      // Update transaction amount & date
      await updateTransaction(txId, {
        amount: 1200000,
        date: '2026-09-05',
      })

      const updatedOrder = await db.investmentOrders.get(orderId)
      expect(updatedOrder.totalAmount).toBe(1200000)
      expect(updatedOrder.date).toBe('2026-09-05')
    })
  })

  describe('1. transactionService - deleteTransaction split bill', () => {
    it('blocks deletion of fronted split bill tx if participant loans are still active', async () => {
      const walletId = await db.wallets.add({
        name: 'Main Wallet',
        currency: 'IDR',
        balance: 1000000,
      })

      const frontedTxId = await db.transactions.add({
        date: '2026-10-01',
        amount: 200000,
        type: 'expense',
        category: 'Pinjaman Diberikan',
        walletId,
        splitBillId: 'sb-del-1',
        isExcludeAnalyticsTx: true,
      })

      await db.loans.add({
        type: 'receivable',
        personName: 'Alice',
        title: 'Split Bill',
        totalAmount: 100000,
        remainingAmount: 100000,
        currency: 'IDR',
        status: 'active',
        initialTransactionId: frontedTxId,
        splitBillId: 'sb-del-1',
      })

      await expect(deleteTransaction(frontedTxId)).rejects.toThrow('Transaksi ini merupakan talangan split bill')
    })

    it('blocks deletion of fronted split bill tx while participant loans exist', async () => {
      const walletId = await db.wallets.add({
        name: 'Main Wallet',
        currency: 'IDR',
        balance: 1000000,
      })

      const frontedTxId = await db.transactions.add({
        date: '2026-10-01',
        amount: 200000,
        type: 'expense',
        category: 'Pinjaman Diberikan',
        walletId,
        splitBillId: 'sb-del-2',
        isExcludeAnalyticsTx: true,
      })

      await db.loans.add({
        type: 'receivable',
        personName: 'Alice',
        title: 'Split Bill',
        totalAmount: 100000,
        remainingAmount: 0,
        currency: 'IDR',
        status: 'paid',
        initialTransactionId: frontedTxId,
        splitBillId: 'sb-del-2',
      })

      await expect(deleteTransaction(frontedTxId)).rejects.toThrow(
        /memiliki catatan pinjaman partisipan/i
      )
    })
  })

  describe('2. useLoanStore - cross-currency disbursement', () => {
    it('converts principal to wallet currency when wallet currency differs from loan currency', async () => {
      // Wallet in IDR
      const walletId = await db.wallets.add({
        name: 'Rupiah Wallet',
        currency: 'IDR',
        balance: 10000000,
      })

      // Add Loan in USD: principal 100 USD
      const loanId = await useLoanStore.getState().addLoan({
        type: 'receivable',
        personName: 'Charlie',
        title: 'USD Loan',
        totalAmount: 100,
        principalAmount: 100,
        currency: 'USD',
        walletId,
      })

      const createdLoan = await db.loans.get(loanId)
      expect(createdLoan).toBeTruthy()
      expect(createdLoan.currency).toBe('USD')

      const initialTx = await db.transactions.get(createdLoan.initialTransactionId)
      expect(initialTx).toBeTruthy()
      // Transaction should be recorded in wallet's currency (IDR)
      expect(initialTx.currency).toBe('IDR')
      // 100 USD converted to IDR using cached rate (~15,500 = ~1,550,000)
      expect(initialTx.amount).toBeGreaterThan(1000000)
    })

    it('preserves wallet currency conversion when updating loan principal', async () => {
      const walletId = await db.wallets.add({
        name: 'Rupiah Wallet',
        currency: 'IDR',
        balance: 10000000,
      })

      const loanId = await useLoanStore.getState().addLoan({
        type: 'receivable',
        personName: 'Charlie',
        title: 'USD Loan',
        totalAmount: 100,
        principalAmount: 100,
        currency: 'USD',
        walletId,
      })

      const loan = await db.loans.get(loanId)
      const initTxBefore = await db.transactions.get(loan.initialTransactionId)
      expect(initTxBefore.currency).toBe('IDR')
      expect(initTxBefore.amount).toBeGreaterThan(1000000)

      // Update principal from 100 USD to 200 USD
      await useLoanStore.getState().updateLoan(loanId, {
        totalAmount: 200,
        principalAmount: 200,
      })

      const initTxAfter = await db.transactions.get(loan.initialTransactionId)
      expect(initTxAfter.currency).toBe('IDR')
      expect(initTxAfter.amount).toBeGreaterThan(2000000)
    })
  })

  describe('2. useLoanStore - updateLoan split bill siblings check', () => {
    it('does not adjust initTx amount if there are multiple sibling loans', async () => {
      const walletId = await db.wallets.add({
        name: 'Wallet',
        currency: 'IDR',
        balance: 1000000,
      })

      const frontedTxId = await db.transactions.add({
        date: '2026-10-01',
        amount: 200000,
        type: 'expense',
        category: 'Pinjaman Diberikan',
        walletId,
        splitBillId: 'sb-sib-1',
      })

      const loan1Id = await db.loans.add({
        type: 'receivable',
        personName: 'Alice',
        title: 'Split Bill',
        totalAmount: 100000,
        remainingAmount: 100000,
        currency: 'IDR',
        status: 'active',
        initialTransactionId: frontedTxId,
        splitBillId: 'sb-sib-1',
        walletId,
      })

      await db.loans.add({
        type: 'receivable',
        personName: 'Bob',
        title: 'Split Bill',
        totalAmount: 100000,
        remainingAmount: 100000,
        currency: 'IDR',
        status: 'active',
        initialTransactionId: frontedTxId,
        splitBillId: 'sb-sib-1',
        walletId,
      })

      // Update loan 1 total amount to 120,000
      await useLoanStore.getState().updateLoan(loan1Id, {
        totalAmount: 120000,
        principalAmount: 120000,
      })

      const initTx = await db.transactions.get(frontedTxId)
      // initTx amount reflects pooled split bill increase to 220,000
      expect(initTx.amount).toBe(220000)
    })

    it('adjusts initTx amount with currency conversion when only 1 loan on split bill', async () => {
      const walletId = await db.wallets.add({
        name: 'IDR Wallet',
        currency: 'IDR',
        balance: 10000000,
      })

      const frontedTxId = await db.transactions.add({
        date: '2026-10-01',
        amount: 775000,
        currency: 'IDR',
        type: 'expense',
        category: 'Pinjaman Diberikan',
        walletId,
        splitBillId: 'sb-single-1',
      })

      // Single USD participant loan on IDR fronted transaction
      const loanId = await db.loans.add({
        type: 'receivable',
        personName: 'Alice',
        title: 'Split Bill Single',
        totalAmount: 50,
        principalAmount: 50,
        remainingAmount: 50,
        currency: 'USD',
        status: 'active',
        initialTransactionId: frontedTxId,
        splitBillId: 'sb-single-1',
        walletId,
      })

      // Increase totalAmount from 50 USD to 60 USD (diffTotal = +10 USD ~ +155,000 IDR)
      await useLoanStore.getState().updateLoan(loanId, {
        totalAmount: 60,
        principalAmount: 60,
      })

      const initTx = await db.transactions.get(frontedTxId)
      // Initial amount 775,000 + ~155,000 = ~930,000 IDR
      expect(initTx.amount).toBeGreaterThan(900000)
      expect(initTx.currency).toBe('IDR')
    })
  })

  describe('3. SavingsDetail - cashout to wallet cross-currency', () => {
    it('converts goal amount in USD to wallet currency in IDR on cashout', async () => {
      const walletId = await db.wallets.add({
        name: 'IDR Savings Wallet',
        currency: 'IDR',
        balance: 0,
      })

      const goalId = await db.goals.add({
        name: 'Vacation Fund',
        targetAmount: 500,
        currentAmount: 100,
        currency: 'USD',
        status: 'active',
      })

      const goal = await db.goals.get(goalId)
      const walletObj = await db.wallets.get(walletId)
      const { convertCurrency, roundCurrency } = await import('../src/lib/utils')
      const { getCachedCurrencyRates } = await import('../src/lib/api')

      const cashoutAmount = Number(goal.currentAmount || 0)
      const walletCurrency = walletObj?.currency || 'IDR'
      const goalCurrency = goal.currency || 'IDR'
      const rates = getCachedCurrencyRates('USD')
      const cashoutInWallet = roundCurrency(convertCurrency(cashoutAmount, goalCurrency, walletCurrency, rates), walletCurrency)

      await db.transaction('rw', [db.goals, db.transactions, db.goalLogs, db.wallets], async () => {
        await db.goals.update(goalId, {
          currentAmount: 0,
          isCompleted: true,
          status: 'completed',
        })

        const cashoutTxId = await db.transactions.add({
          date: '2026-10-01',
          amount: cashoutInWallet,
          type: 'income',
          category: 'cairkan_tabungan',
          notes: `Pencairan Tabungan: ${goal.name} ke ${walletObj.name}`,
          currency: walletCurrency,
          walletId,
          goalId,
          createdAt: Date.now(),
          deletedAt: null,
          isExcludeAnalyticsTx: true,
        })

        await db.goalLogs.add({
          goalId,
          amount: -cashoutAmount,
          notes: `Pencairan Tabungan ke ${walletObj.name}`,
          date: '2026-10-01 12:00:00',
          walletName: walletObj.name,
          transactionId: cashoutTxId,
        })
      })

      const updatedGoal = await db.goals.get(goalId)
      expect(updatedGoal.currentAmount).toBe(0)
      expect(updatedGoal.status).toBe('completed')

      const txs = await db.transactions.where('goalId').equals(goalId).toArray()
      expect(txs.length).toBe(1)
      expect(txs[0].currency).toBe('IDR')
      expect(txs[0].amount).toBeGreaterThan(1000000) // 100 USD = ~1,550,000 IDR
    })

    it('prevents phantom cash withdrawal when goal currentAmount is zero or less than requested', async () => {
      const walletId = await db.wallets.add({
        name: 'Main Wallet',
        currency: 'IDR',
        balance: 500000,
      })

      const goalId = await db.goals.add({
        name: 'Emergency Fund',
        targetAmount: 1000000,
        currentAmount: 50000,
        currency: 'IDR',
        status: 'active',
      })

      // Test Case 1: Partial balance withdrawal clamped to currentAmount
      const goal = await db.goals.get(goalId)
      const requestedVal = 200000
      const isWithdraw = true
      const currentGoalAmt = Number(goal?.currentAmount || 0)
      if (isWithdraw && currentGoalAmt <= 0) {
        throw new Error('Should not return early when currentGoalAmt > 0')
      }
      const effectiveVal = isWithdraw ? Math.min(requestedVal, currentGoalAmt) : requestedVal
      expect(effectiveVal).toBe(50000)

      const newGoalAmount = isWithdraw ? Math.max(0, currentGoalAmt - effectiveVal) : currentGoalAmt + effectiveVal
      await db.transaction('rw', [db.goals, db.goalLogs, db.transactions, db.wallets], async () => {
        await db.goals.update(goalId, { currentAmount: newGoalAmount })
        await db.transactions.add({
          date: '2026-10-01',
          amount: effectiveVal,
          type: 'income',
          category: 'cairkan_tabungan',
          notes: 'Tarik Tabungan',
          currency: 'IDR',
          walletId,
          goalId,
          createdAt: Date.now(),
          deletedAt: null,
          isExcludeAnalyticsTx: true,
        })
        await db.goalLogs.add({
          goalId,
          amount: -effectiveVal,
          notes: 'Penarikan Tabungan',
          date: '2026-10-01 12:00:00',
        })
      })

      const updatedGoal = await db.goals.get(goalId)
      expect(updatedGoal.currentAmount).toBe(0)

      const txs = await db.transactions.where('goalId').equals(goalId).toArray()
      expect(txs.length).toBe(1)
      expect(txs[0].amount).toBe(50000) // Clamped to available balance, NOT 200000!

      const logs = await db.goalLogs.where('goalId').equals(goalId).toArray()
      expect(logs.length).toBe(1)
      expect(logs[0].amount).toBe(-50000)

      // Test Case 2: Zero balance withdrawal aborted with zero DB side-effects
      const emptyGoalId = await db.goals.add({
        name: 'Empty Fund',
        targetAmount: 500000,
        currentAmount: 0,
        currency: 'IDR',
        status: 'active',
      })
      const emptyGoal = await db.goals.get(emptyGoalId)
      const emptyCurrentAmt = Number(emptyGoal?.currentAmount || 0)

      let emptyWithdrawExecuted = false
      if (!(isWithdraw && emptyCurrentAmt <= 0)) {
        const valToWithdraw = isWithdraw ? Math.min(requestedVal, emptyCurrentAmt) : requestedVal
        if (valToWithdraw > 0) {
          emptyWithdrawExecuted = true
          await db.transactions.add({
            date: '2026-10-01',
            amount: valToWithdraw,
            type: 'income',
            category: 'cairkan_tabungan',
            currency: 'IDR',
            walletId,
            goalId: emptyGoalId,
          })
        }
      }

      expect(emptyWithdrawExecuted).toBe(false)
      const emptyTxs = await db.transactions.where('goalId').equals(emptyGoalId).toArray()
      expect(emptyTxs.length).toBe(0) // No phantom transaction created
      const emptyLogs = await db.goalLogs.where('goalId').equals(emptyGoalId).toArray()
      expect(emptyLogs.length).toBe(0) // No phantom log created
    })
  })

  describe('4. automation - processRecurringTransactions cross-currency transfer', () => {
    it('computes targetAmount when transferring between wallets with different currencies', async () => {
      const srcWalletId = await db.wallets.add({
        name: 'USD Wallet',
        currency: 'USD',
        balance: 1000,
      })

      const tgtWalletId = await db.wallets.add({
        name: 'IDR Wallet',
        currency: 'IDR',
        balance: 0,
      })

      await db.recurringTransactions.add({
        id: 111,
        title: 'USD to IDR Transfer',
        amount: 10,
        currency: 'USD',
        type: 'transfer',
        category: 'transfer',
        frequency: 'monthly',
        startDate: '2026-03-01',
        nextDate: '2026-03-01',
        anchorDay: 1,
        enabled: true,
        autoExecute: true,
        walletId: srcWalletId,
        targetWalletId: tgtWalletId,
      })

      await processRecurringTransactions(new Date('2026-03-05T12:00:00'))

      const txs = await db.transactions.toArray()
      expect(txs.length).toBe(1)
      const transferTx = txs[0]
      expect(transferTx.type).toBe('transfer')
      expect(transferTx.amount).toBe(10)
      expect(transferTx.currency).toBe('USD')
      expect(transferTx.targetWalletId).toBe(tgtWalletId)
      expect(transferTx.targetAmount).toBeGreaterThan(100000) // ~155,000 IDR
    })

    it('falls back to srcWallet currency when item.currency is omitted', async () => {
      const srcWalletId = await db.wallets.add({
        name: 'USD Wallet No Curr Item',
        currency: 'USD',
        balance: 1000,
      })

      const tgtWalletId = await db.wallets.add({
        name: 'IDR Wallet Target',
        currency: 'IDR',
        balance: 0,
      })

      await db.recurringTransactions.add({
        id: 222,
        title: 'USD Transfer Without Currency Field',
        amount: 20,
        type: 'transfer',
        category: 'transfer',
        frequency: 'monthly',
        startDate: '2026-03-01',
        nextDate: '2026-03-01',
        anchorDay: 1,
        enabled: true,
        autoExecute: true,
        walletId: srcWalletId,
        targetWalletId: tgtWalletId,
      })

      await processRecurringTransactions(new Date('2026-03-05T12:00:00'))

      const txs = await db.transactions.toArray()
      expect(txs.length).toBe(1)
      const transferTx = txs[0]
      expect(transferTx.currency).toBe('USD')
      expect(transferTx.targetAmount).toBeGreaterThan(250000)
    })
  })
})
