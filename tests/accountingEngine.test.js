import { describe, it, expect } from 'vitest'
import {
  generateIncomeStatement,
  generateBalanceSheet,
  generateCashFlowStatement,
  calculateSha256Checksum,
  filterTransactionsByDateRange,
} from '../src/lib/accountingEngine'

describe('accountingEngine', () => {
  const sampleTransactions = [
    { id: 1, type: 'income', category: 'gaji/gaji_pokok', amount: 15000000, date: '2026-08-01', currency: 'IDR' },
    { id: 2, type: 'income', category: 'bisnis/freelance', amount: 5000000, date: '2026-08-10', currency: 'IDR' },
    { id: 3, type: 'expense', category: 'makanMinum/restoran', amount: 2000000, date: '2026-08-05', currency: 'IDR' },
    { id: 4, type: 'expense', category: 'tempatTinggal/sewa', amount: 3500000, date: '2026-08-02', currency: 'IDR' },
    { id: 5, type: 'expense', category: 'investasi/reksadana', amount: 4000000, date: '2026-08-15', currency: 'IDR' },
    { id: 6, type: 'expense', category: 'pinjaman/cicilan', amount: 1500000, date: '2026-08-20', currency: 'IDR' },
  ]

  const sampleWallets = [
    { id: 1, name: 'BCA Utama', balance: 25000000, currency: 'IDR', isArchived: false },
    { id: 2, name: 'GoPay', balance: 1500000, currency: 'IDR', isArchived: false },
  ]

  const sampleSavings = [
    { id: 1, name: 'Dana Darurat', currentAmount: 10000000, targetAmount: 30000000, currency: 'IDR' },
  ]

  const sampleLoans = [
    { id: 1, type: 'debt', personName: 'Bank Mandiri KTA', amount: 12000000, remainingAmount: 8000000, status: 'active', currency: 'IDR' },
    { id: 2, type: 'receivable', personName: 'Budi', amount: 3000000, remainingAmount: 2000000, status: 'active', currency: 'IDR' },
  ]

  it('filters transactions accurately by date range', () => {
    const res = filterTransactionsByDateRange(sampleTransactions, '2026-08-01', '2026-08-09')
    expect(res.length).toBe(3) // 2026-08-01, 2026-08-02, and 2026-08-05
  })

  it('calculates Income Statement revenues, expenses, and net profit correctly', () => {
    const report = generateIncomeStatement(sampleTransactions, {
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      defaultCurrency: 'IDR',
    })

    expect(report.totalRevenue).toBe(20000000)
    expect(report.totalExpenses).toBe(11000000)
    expect(report.netIncome).toBe(9000000)
    expect(report.netProfitMargin).toBe(45)
  })

  it('calculates Balance Sheet with perfect balance (Assets = Liabilities + Equity)', () => {
    const bs = generateBalanceSheet(sampleWallets, sampleSavings, sampleLoans, {
      defaultCurrency: 'IDR',
    })

    // Total Cash = 25m + 1.5m = 26.5m
    expect(bs.assets.currentAssets.total).toBe(26500000)
    // Non-Current = 10m (savings) + 2m (receivables) = 12m
    expect(bs.assets.nonCurrentAssets.total).toBe(12000000)
    // Total Assets = 38.5m
    expect(bs.assets.totalAssets).toBe(38500000)
    // Total Liabilities = 8m
    expect(bs.liabilities.total).toBe(8000000)
    // Total Equity = 38.5m - 8m = 30.5m
    expect(bs.equity.totalEquity).toBe(30500000)
    expect(bs.isBalanced).toBe(true)
  })

  it('calculates Cash Flow Statement with operational, investing, and financing divisions', () => {
    const cf = generateCashFlowStatement(sampleTransactions, {
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      defaultCurrency: 'IDR',
    })

    // Operating: 20m in - 5.5m out (food 2m + housing 3.5m) = 14.5m
    expect(cf.operatingActivities.net).toBe(14500000)
    // Investing: -4m (reksadana)
    expect(cf.investingActivities.net).toBe(-4000000)
    // Financing: -1.5m (cicilan)
    expect(cf.financingActivities.net).toBe(-1500000)
    // Net Change in Cash: 14.5m - 4m - 1.5m = 9m
    expect(cf.netChangeInCash).toBe(9000000)
  })

  it('correctly unpacks split transactions in Income Statement and Cash Flow Statement', () => {
    const splitTx = {
      id: 99,
      type: 'expense',
      category: 'split_parent',
      amount: 1000000,
      date: '2026-08-15',
      currency: 'IDR',
      isSplit: true,
      splitItems: [
        { category: 'makanan/makan_siang', amount: 600000, type: 'expense' },
        { category: 'investasi/emas', amount: 400000, type: 'expense' },
      ],
    }

    const report = generateIncomeStatement([splitTx], { defaultCurrency: 'IDR' })
    expect(report.totalExpenses).toBe(1000000)

    const cf = generateCashFlowStatement([splitTx], { defaultCurrency: 'IDR' })
    // Makanan goes to operating outflow (600k), Investasi goes to investing outflow (400k)
    expect(cf.operatingActivities.outflow).toBe(600000)
    expect(cf.investingActivities.outflow).toBe(400000)
    expect(cf.netChangeInCash).toBe(-1000000)
  })

  it('excludes pending review transactions in filterTransactionsByDateRange', () => {
    const txs = [
      { id: 1, date: '2026-08-01', amount: 100000, isPendingReview: true },
      { id: 2, date: '2026-08-02', amount: 200000, isPendingReview: 1 },
      { id: 3, date: '2026-08-03', amount: 300000, isPendingReview: false },
      { id: 4, date: '2026-08-04', amount: 400000 },
    ]
    const withoutRange = filterTransactionsByDateRange(txs)
    expect(withoutRange.length).toBe(2)
    expect(withoutRange.map((t) => t.id)).toEqual([3, 4])

    const withIsoRange = filterTransactionsByDateRange(txs, '2026-08-01', '2026-08-31')
    expect(withIsoRange.length).toBe(2)
    expect(withIsoRange.map((t) => t.id)).toEqual([3, 4])

    const withCustomRange = filterTransactionsByDateRange(txs, '2026-08-01 00:00', '2026-08-31 23:59')
    expect(withCustomRange.length).toBe(2)
    expect(withCustomRange.map((t) => t.id)).toEqual([3, 4])
  })

  it('excludes excluded and non-analytic transactions from investing and financing activities in Cash Flow Statement', () => {
    const txs = [
      { id: 1, type: 'expense', category: 'investasi/saham', amount: 5000000, date: '2026-08-10', isExcluded: true },
      { id: 2, type: 'expense', category: 'pinjaman/cicilan', amount: 2000000, date: '2026-08-11', isExcludeAnalyticsTx: true },
      { id: 3, type: 'expense', category: 'makanMinum/restoran', amount: 100000, date: '2026-08-12' },
    ]
    const cf = generateCashFlowStatement(txs, { defaultCurrency: 'IDR' })
    expect(cf.investingActivities.outflow).toBe(0)
    expect(cf.financingActivities.outflow).toBe(0)
    expect(cf.operatingActivities.outflow).toBe(100000)
    expect(cf.netChangeInCash).toBe(-100000)
  })

  it('computes SHA-256 digital checksum deterministically', async () => {
    const checksum1 = await calculateSha256Checksum('FINTRACK-VERIFY-123')
    const checksum2 = await calculateSha256Checksum('FINTRACK-VERIFY-123')
    expect(checksum1).toBe(checksum2)
    expect(checksum1.length).toBeGreaterThan(16)
  })
})
