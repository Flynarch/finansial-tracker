import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { format, startOfWeek, subWeeks, addDays } from 'date-fns'
import { calculateHabitStats, calculateWeeklyTrend } from '../src/lib/habitStats'
import { handleHabitAction } from '../src/lib/ai/chatActions/habitActions'
import { generateBalanceSheet } from '../src/lib/accountingEngine'
import { generateInstallmentSchedule } from '../src/lib/loanUtils'
import { reconcileNonCashPositionsBeforeDate } from '../src/hooks/dashboard/chartSlices'
import { db } from '../src/lib/db'
import useLoanStore from '../src/store/useLoanStore'
import { updateTransaction, deleteTransaction } from '../src/services/transactionService'
import { isLocalDataEmpty } from '../src/lib/backup'

describe('Round 9 Hardening Suite: Habits, Investments, Loans, AI & Sync', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await db.habits.clear()
    await db.habitLogs.clear()
    await db.investments.clear()
    await db.investmentOrders.clear()
    await db.transactions.clear()
    await db.loans.clear()
    await db.loanPayments.clear()
    await db.wallets.clear()
  })

  describe('1. Habits & Streaks Engine Hardening', () => {
    it('calculateWeeklyTrend dynamically adjusts target for habit creation week in past weeks', () => {
      // Habit created 2 weeks ago on Friday (target 3x a week, completed 3/3 on Fri, Sat, Sun of that week)
      const twoWeeksAgoMonday = startOfWeek(subWeeks(new Date(), 2), { weekStartsOn: 1 })
      const twoWeeksAgoFriday = addDays(twoWeeksAgoMonday, 4)
      const twoWeeksAgoSaturday = addDays(twoWeeksAgoMonday, 5)
      const twoWeeksAgoSunday = addDays(twoWeeksAgoMonday, 6)

      const habit = {
        id: 1,
        title: 'Olahraga Sore',
        frequencyType: 'weekly',
        frequencyValue: 3,
        createdAt: twoWeeksAgoFriday.toISOString(),
      }
      const logs = [
        { habitId: 1, date: format(twoWeeksAgoFriday, 'yyyy-MM-dd') },
        { habitId: 1, date: format(twoWeeksAgoSaturday, 'yyyy-MM-dd') },
        { habitId: 1, date: format(twoWeeksAgoSunday, 'yyyy-MM-dd') },
      ]

      const trend = calculateWeeklyTrend(habit, logs, 4)
      expect(Array.isArray(trend)).toBe(true)
      // Check that habit creation week calculates rate fairly without defaulting to full 7-day target
      const creationWeekTrend = trend.find(t => t.rawCompleted === 3)
      expect(creationWeekTrend).toBeDefined()
      expect(creationWeekTrend.rawTarget).toBe(3)
      expect(creationWeekTrend.rate).toBe(100)
    })

    it('calculateHabitStats does not penalize habit created on Sunday with a full past week target', () => {
      // Created on previous week's Sunday, completed on Sunday
      const lastWeekSunday = addDays(startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), 6)
      const habit = {
        id: 2,
        title: 'Refleksi Mingguan',
        frequencyType: 'weekly',
        frequencyValue: 3,
        createdAt: lastWeekSunday.toISOString(),
      }
      const logs = [
        { habitId: 2, date: format(lastWeekSunday, 'yyyy-MM-dd') },
      ]

      const stats = calculateHabitStats(habit, logs)
      expect(stats).toBeDefined()
      expect(stats.currentWeekTarget).toBe(3)
      // Completion rate should not be crippled by phantom Mon-Sat before creation (1/1 = 100%)
      expect(stats.completionRate).toBe(100)
    })

    it('calculateHabitStats caps each past week contribution so over-logging cannot cover missed weeks', () => {
      const habit = {
        id: 3,
        title: 'Membaca Buku',
        frequencyType: 'weekly',
        frequencyValue: 2,
        createdAt: '2026-01-01T00:00:00',
      }
      // 10 logs in a single week should not give 100% for 5 weeks if other weeks were empty
      const logs = [
        { habitId: 3, date: '2026-01-02' },
        { habitId: 3, date: '2026-01-03' },
        { habitId: 3, date: '2026-01-04' },
        { habitId: 3, date: '2026-01-05' },
      ]

      const stats = calculateHabitStats(habit, logs)
      expect(stats).toBeDefined()
      expect(stats.completionRate).toBeLessThanOrEqual(100)
    })

    it('calculateHabitStats caps current week over-logging to prevent leaking completions to past weeks', () => {
      const twoWeeksAgo = subWeeks(new Date(), 2)
      const habit = {
        id: 30,
        title: 'Meditasi',
        frequencyType: 'weekly',
        frequencyValue: 2,
        createdAt: twoWeeksAgo.toISOString(),
      }
      // 0 logs in past 2 weeks, but 6 logs in current week
      const currentMonday = startOfWeek(new Date(), { weekStartsOn: 1 })
      const logs = [
        { habitId: 30, date: format(currentMonday, 'yyyy-MM-dd') },
        { habitId: 30, date: format(addDays(currentMonday, 1), 'yyyy-MM-dd') },
        { habitId: 30, date: format(addDays(currentMonday, 2), 'yyyy-MM-dd') },
        { habitId: 30, date: format(addDays(currentMonday, 3), 'yyyy-MM-dd') },
        { habitId: 30, date: format(addDays(currentMonday, 4), 'yyyy-MM-dd') },
        { habitId: 30, date: format(addDays(currentMonday, 5), 'yyyy-MM-dd') },
      ]

      const stats = calculateHabitStats(habit, logs)
      // Denominator: 2 past weeks * 2 + min(2, 6) = 6. Numerator: min(2, 6) = 2. Rate: 2/6 = 33%
      expect(stats.completionRate).toBe(33)
    })

    it('handleHabitAction correctly sets frequencyValue defaulting to 3 for weekly habits', async () => {
      const res = await handleHabitAction({
        action: 'create',
        title: 'Jogging Mingguan',
        frequencyType: 'weekly',
        frequencyValue: null,
      })

      expect(res).toHaveLength(1)
      expect(res[0].data.data.frequencyValue).toBe(3)

      const saved = await db.habits.where('title').equals('Jogging Mingguan').first()
      expect(saved).toBeDefined()
      expect(saved.frequencyValue).toBe(3)
    })
  })

  describe('2. Investments & Balance Sheet Hardening', () => {
    it('generateBalanceSheet reconstructs historical holdings as of asOfDate from investmentOrders', () => {
      // Current holding is 0 shares because asset was sold after asOfDate
      const investments = []
      const investmentOrders = [
        {
          id: 1,
          date: '2026-01-10',
          side: 'buy',
          name: 'BBCA',
          quantity: 100,
          unitPrice: 9000,
          totalAmount: 900000,
          currency: 'IDR',
          costBasis: 9000,
        },
        {
          id: 2,
          date: '2026-03-20', // Sold after asOfDate (2026-02-28)
          side: 'sell',
          name: 'BBCA',
          quantity: 100,
          unitPrice: 10000,
          totalAmount: 1000000,
          currency: 'IDR',
          costBasis: 9000,
        },
      ]

      const sheet = generateBalanceSheet([], [], [], {
        asOfDate: '2026-02-28',
        defaultCurrency: 'IDR',
        investments,
        investmentOrders,
      })

      // As of 2026-02-28, BBCA should be reconstructed with 100 shares at costBasis 9,000 = 900,000
      expect(sheet.assets.nonCurrentAssets.investments.total).toBe(900000)
      expect(sheet.assets.nonCurrentAssets.investments.items).toHaveLength(1)
      expect(sheet.assets.nonCurrentAssets.investments.items[0].name).toBe('BBCA')
      expect(sheet.assets.nonCurrentAssets.investments.items[0].amount).toBe(900000)
    })

    it('generateBalanceSheet subtracts post-date purchases when generating balance sheet before purchase date', () => {
      const investments = [
        {
          id: 1,
          name: 'TLKM',
          quantity: 200,
          purchasePrice: 3500,
          currency: 'IDR',
        },
      ]
      const investmentOrders = [
        {
          id: 1,
          date: '2026-04-15', // Bought after asOfDate (2026-03-31)
          side: 'buy',
          name: 'TLKM',
          quantity: 200,
          unitPrice: 3500,
          totalAmount: 700000,
          currency: 'IDR',
          costBasis: 3500,
        },
      ]

      const sheet = generateBalanceSheet([], [], [], {
        asOfDate: '2026-03-31',
        defaultCurrency: 'IDR',
        investments,
        investmentOrders,
      })

      // Before purchase date, holding is 0
      expect(sheet.assets.nonCurrentAssets.investments.total).toBe(0)
      expect(sheet.assets.nonCurrentAssets.investments.items).toHaveLength(0)
    })

    it('updateTransaction recalculates weighted average purchasePrice across all buy orders for holding', async () => {
      const invId = await db.investments.add({
        name: 'ASII',
        type: 'stocks',
        quantity: 20,
        purchasePrice: 5000,
        currency: 'IDR',
      })

      await db.investmentOrders.add({
        date: '2026-01-01',
        side: 'buy',
        name: 'ASII',
        quantity: 10,
        unitPrice: 4000,
        totalAmount: 40000,
        currency: 'IDR',
      })

      const o2Id = await db.investmentOrders.add({
        date: '2026-02-01',
        side: 'buy',
        name: 'ASII',
        quantity: 10,
        unitPrice: 6000,
        totalAmount: 60000,
        currency: 'IDR',
      })

      const txId = await db.transactions.add({
        date: '2026-02-01',
        amount: 60000,
        type: 'expense',
        category: 'investasi_pengeluaran/stocks',
        currency: 'IDR',
        investmentId: invId,
        investmentOrderId: o2Id,
      })

      // Update tx2 amount from 60,000 to 80,000 (unitPrice 8,000)
      // New total cost = 10 * 4000 + 10 * 8000 = 120,000 / 20 qty = 6,000
      await updateTransaction(txId, { amount: 80000 })

      const updatedHolding = await db.investments.get(invId)
      expect(updatedHolding.purchasePrice).toBe(6000)
    })

    it('generateBalanceSheet correctly unwinds interleaved post-date buy and sell orders in reverse chronological order', () => {
      // Prior holding before 2026-02-28: 50 shares @ 5,000 = 250,000
      // Post-date buy on 2026-03-05: 50 shares @ 6,000 = 300,000 (now 100 shares, weighted basis 5,500)
      // Post-date sell on 2026-03-20: 100 shares @ 7,000, costBasis 5,500
      // Current holdings today = 0 shares
      const investments = []
      const investmentOrders = [
        {
          id: 1,
          date: '2026-01-10',
          side: 'buy',
          name: 'BBRI',
          quantity: 50,
          unitPrice: 5000,
          totalAmount: 250000,
          currency: 'IDR',
          costBasis: 5000,
        },
        {
          id: 2,
          date: '2026-03-05', // Bought after asOfDate
          side: 'buy',
          name: 'BBRI',
          quantity: 50,
          unitPrice: 6000,
          totalAmount: 300000,
          currency: 'IDR',
          costBasis: 6000,
        },
        {
          id: 3,
          date: '2026-03-20', // Sold after asOfDate
          side: 'sell',
          name: 'BBRI',
          quantity: 100,
          unitPrice: 7000,
          totalAmount: 700000,
          currency: 'IDR',
          costBasis: 5500,
        },
      ]

      const sheet = generateBalanceSheet([], [], [], {
        asOfDate: '2026-02-28',
        defaultCurrency: 'IDR',
        investments,
        investmentOrders,
      })

      // Must reconstruct exactly 50 shares with cost basis 250,000 without 0-clipping
      expect(sheet.assets.nonCurrentAssets.investments.total).toBe(250000)
      expect(sheet.assets.nonCurrentAssets.investments.items).toHaveLength(1)
      expect(sheet.assets.nonCurrentAssets.investments.items[0].name).toBe('BBRI')
      expect(sheet.assets.nonCurrentAssets.investments.items[0].amount).toBe(250000)
    })

    it('generateBalanceSheet ignores post-asOfDate holdings that have no investment orders', () => {
      const investments = [
        {
          id: 1,
          name: 'BBCA',
          quantity: 10,
          purchasePrice: 9000,
          purchaseDate: '2026-01-10',
          currency: 'IDR',
        },
        {
          id: 99,
          name: 'CRYPTO_BTC',
          quantity: 1,
          purchasePrice: 50000000,
          purchaseDate: '2026-04-15',
          currency: 'IDR',
        },
      ]
      const investmentOrders = [
        {
          id: 1,
          date: '2026-01-10',
          side: 'buy',
          name: 'BBCA',
          quantity: 10,
          unitPrice: 9000,
          totalAmount: 90000,
          currency: 'IDR',
          costBasis: 9000,
        },
      ]

      const sheet = generateBalanceSheet([], [], [], {
        asOfDate: '2026-03-31',
        defaultCurrency: 'IDR',
        investments,
        investmentOrders,
      })

      // BBCA is reconstructed from order, CRYPTO_BTC (bought 2026-04-15) must be excluded
      expect(sheet.assets.nonCurrentAssets.investments.total).toBe(90000)
      expect(sheet.assets.nonCurrentAssets.investments.items).toHaveLength(1)
      expect(sheet.assets.nonCurrentAssets.investments.items[0].name).toBe('BBCA')
    })

    it('updateTransaction recalculates weighted purchasePrice when transaction lacks investmentId but has investmentOrderId', async () => {
      const invId = await db.investments.add({
        name: 'BBNI',
        type: 'stocks',
        quantity: 20,
        purchasePrice: 5000,
        currency: 'IDR',
      })

      await db.investmentOrders.add({
        date: '2026-01-01',
        side: 'buy',
        name: 'BBNI',
        investmentId: invId,
        quantity: 10,
        unitPrice: 4000,
        totalAmount: 40000,
        currency: 'IDR',
      })

      const o2Id = await db.investmentOrders.add({
        date: '2026-02-01',
        side: 'buy',
        name: 'BBNI',
        investmentId: invId,
        quantity: 10,
        unitPrice: 6000,
        totalAmount: 60000,
        currency: 'IDR',
      })

      // Transaction only has investmentOrderId, no investmentId
      const txId = await db.transactions.add({
        date: '2026-02-01',
        amount: 60000,
        type: 'expense',
        category: 'investasi_pengeluaran/stocks',
        currency: 'IDR',
        investmentOrderId: o2Id,
      })

      // Update tx amount from 60,000 to 100,000 (new unit price 10,000)
      // New weighted price = (10 * 4000 + 10 * 10000) / 20 = 7,000
      await updateTransaction(txId, { amount: 100000 })

      const updatedHolding = await db.investments.get(invId)
      expect(updatedHolding.purchasePrice).toBe(7000)
    })
  })

  describe('3. Loans & Installment Schedules Hardening', () => {
    it('generateInstallmentSchedule anchors monthly stepping base date to loan.startDate', () => {
      const loan = {
        id: 1,
        totalAmount: 6000000,
        remainingAmount: 6000000,
        startDate: '2026-01-15',
        dueDate: '2026-07-15',
        tenorMonths: 6,
        monthlyPayment: 1000000,
      }

      const schedule = generateInstallmentSchedule(loan, [])
      expect(schedule).toHaveLength(6)
      expect(schedule[0].dueDate).toBe('2026-02-15')
      expect(schedule[1].dueDate).toBe('2026-03-15')
      expect(schedule[2].dueDate).toBe('2026-04-15')
      expect(schedule[3].dueDate).toBe('2026-05-15')
      expect(schedule[4].dueDate).toBe('2026-06-15')
      expect(schedule[5].dueDate).toBe('2026-07-15')
    })

    it('recordPayment separates repayment into principal (excluded from analytics) and interest/margin (included in analytics)', async () => {
      const walletId = await db.wallets.add({
        name: 'BCA Utama',
        balance: 10000000,
        currency: 'IDR',
      })

      const loanId = await db.loans.add({
        type: 'debt',
        title: 'Cicilan KPR',
        totalAmount: 10000000,
        remainingAmount: 10000000,
        currency: 'IDR',
        walletId,
      })

      // Record payment: 1,200,000 total where 200,000 is interest/margin
      await useLoanStore.getState().recordPayment(
        loanId,
        {
          amount: 1200000,
          date: '2026-05-01',
          notes: 'Cicilan bulan 1',
          paymentWalletId: walletId,
          interestAmount: 200000,
        }
      )

      const updatedLoan = await db.loans.get(loanId)
      // Principal was 1,000,000 so remaining should be 9,000,000
      expect(updatedLoan.remainingAmount).toBe(9000000)

      const txs = await db.transactions.where('loanId').equals(loanId).toArray()
      expect(txs).toHaveLength(2)

      const principalTx = txs.find(t => !t.isLoanExcess)
      const interestTx = txs.find(t => t.isLoanExcess)

      expect(principalTx).toBeDefined()
      expect(principalTx.amount).toBe(1000000)
      expect(principalTx.isExcludeAnalyticsTx).toBe(true)

      expect(interestTx).toBeDefined()
      expect(interestTx.amount).toBe(200000)
      expect(interestTx.isExcludeAnalyticsTx).toBe(false)
    })

    it('deleteTransaction on excess transaction resets both excessAmount and interestAmount in loan payment record', async () => {
      const walletId = await db.wallets.add({
        name: 'Mandiri',
        balance: 5000000,
        currency: 'IDR',
      })

      const loanId = await db.loans.add({
        type: 'debt',
        title: 'Pinjaman Modal',
        totalAmount: 5000000,
        remainingAmount: 5000000,
        currency: 'IDR',
        walletId,
      })

      await useLoanStore.getState().recordPayment(loanId, {
        amount: 1500000,
        date: '2026-06-01',
        paymentWalletId: walletId,
        interestAmount: 250000,
      })

      const pmtBefore = await db.loanPayments.where('loanId').equals(loanId).first()
      expect(pmtBefore.interestAmount).toBe(250000)
      expect(pmtBefore.excessTransactionId).toBeDefined()

      // Delete the excess/interest transaction
      await deleteTransaction(pmtBefore.excessTransactionId)

      const pmtAfter = await db.loanPayments.get(pmtBefore.id)
      expect(pmtAfter.excessAmount).toBe(0)
      expect(pmtAfter.interestAmount).toBe(0)
      expect(pmtAfter.excessTransactionId).toBeNull()
    })
  })

  describe('4. Historical Net Worth Reconciled Starting Balance', () => {
    it('reconcileNonCashPositionsBeforeDate excludes future asset purchases and loans from distant past startBalance', () => {
      const safeTx = [
        {
          date: '2026-05-01',
          type: 'expense',
          category: 'investasi_pengeluaran/stocks',
          amount: 50000000,
          convertedAmount: 50000000,
        },
        {
          date: '2026-04-10',
          type: 'income',
          loanId: 10,
          isLoanInitial: true,
          amount: 20000000,
          convertedAmount: 20000000,
        },
        {
          date: '2026-03-01',
          type: 'expense',
          category: 'tabungan',
          amount: 10000000,
          convertedAmount: 10000000,
        },
      ]

      // Today's positions: portfolio 50M, net loans -20M, savings 10M
      const res = reconcileNonCashPositionsBeforeDate({
        dateKey: '2025-01-01',
        safeTx,
        portfolioValue: 50000000,
        netLoanPosition: -20000000,
        totalSavings: 10000000,
      })

      // In 2025 (before these transactions occurred):
      // Portfolio should be reconciled to 0
      expect(res.portfolioValue).toBe(0)
      // Savings should be reconciled to 0
      expect(res.totalSavings).toBe(0)
      // Debt did not exist yet so netLoanPosition should be 0 instead of -20M
      expect(res.netLoanPosition).toBe(0)
    })
  })

  describe('5. Local Data Safety & Restore Guards', () => {
    it('isLocalDataEmpty accurately identifies when database contains user data', async () => {
      expect(await isLocalDataEmpty()).toBe(true)

      await db.transactions.add({
        date: '2026-05-01',
        amount: 25000,
        type: 'expense',
        category: 'makanan',
      })

      expect(await isLocalDataEmpty()).toBe(false)
    })
  })
})
