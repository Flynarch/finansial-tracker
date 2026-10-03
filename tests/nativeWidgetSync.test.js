import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncNativeWidgetData, syncNativeWidgetFromDb } from '../src/lib/nativeWidgetSync'
import { FinTrackNotificationPlugin } from '../src/lib/notificationIngestion'
import { db } from '../src/lib/db'
import { formatCompactCurrency } from '../src/lib/utils'
import useSettingsStore from '../src/store/useSettingsStore'

vi.mock('../src/lib/api', () => ({
  getCachedCurrencyRates: vi.fn(() => null),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'android'),
  },
  registerPlugin: vi.fn(() => ({
    updateWidgetData: vi.fn().mockResolvedValue({ success: true }),
  })),
  WebPlugin: class {},
}))

vi.mock('../src/lib/notificationIngestion', () => ({
  FinTrackNotificationPlugin: {
    updateWidgetData: vi.fn().mockResolvedValue({ success: true }),
    getWidgetConfig: vi.fn().mockResolvedValue({ range: null, walletId: null, walletName: null }),
    setWidgetConfig: vi.fn().mockResolvedValue({ success: true }),
  },
}))

vi.mock('../src/lib/db', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    db: {
      wallets: {
        toArray: vi.fn().mockResolvedValue([
          { id: 1, name: 'Cash', balance: 5000000, currency: 'IDR', isArchived: 0 },
        ]),
      },
      transactions: {
        toArray: vi.fn().mockResolvedValue([]),
      },
    },
  }
})

describe('nativeWidgetSync - Localization & Widget Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({ locale: 'id', defaultCurrency: 'IDR' })
  })

  it('formats Indonesian widget metrics with proper prefixes and labels', async () => {
    useSettingsStore.setState({ locale: 'id', defaultCurrency: 'IDR' })

    await syncNativeWidgetData({
      totalBalance: 5000000,
      monthIncome: 3000000,
      monthExpense: 1500000,
      defaultCurrency: 'IDR',
      sparklinePoints: [100000, 200000],
    })

    expect(FinTrackNotificationPlugin.updateWidgetData).toHaveBeenCalledTimes(1)
    const payload = FinTrackNotificationPlugin.updateWidgetData.mock.calls[0][0]

    expect(payload.income).toContain('Masuk:')
    expect(payload.expense).toContain('Keluar:')
    expect(payload.period).toBe('Bulan Ini')
    expect(payload.btnText).toBe('+ Catat')
    expect(payload.balanceLabel).toBe('Kekayaan Bersih')
    expect(payload.dateText).toBeDefined()
    expect(typeof payload.dateText).toBe('string')
    expect(/Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu/i.test(payload.dateText)).toBe(true)
    expect(payload.incomeValue).toContain('+Rp')
    expect(payload.expenseValue).toContain('-Rp')
    expect(payload.sparklinePoints).toEqual([100000, 200000])
    expect(payload.sparklineDates).toBeDefined()
    expect(payload.sparklineDates.length).toBe(2)
    expect(payload.todayNet).toBeDefined()
    expect(payload.todayNetVal).toBeDefined()
  })

  it('formats English widget metrics with proper prefixes and labels', async () => {
    useSettingsStore.setState({ locale: 'en', defaultCurrency: 'USD' })

    await syncNativeWidgetData({
      totalBalance: 2500,
      monthIncome: 1200,
      monthExpense: 800,
      defaultCurrency: 'USD',
      period: 'This Month',
      sparklinePoints: [500],
      todayNet: -150,
    })

    expect(FinTrackNotificationPlugin.updateWidgetData).toHaveBeenCalledTimes(1)
    const payload = FinTrackNotificationPlugin.updateWidgetData.mock.calls[0][0]

    expect(payload.income).toContain('In:')
    expect(payload.expense).toContain('Out:')
    expect(payload.period).toBe('This Month')
    expect(payload.btnText).toBe('+ Add')
    expect(payload.balanceLabel).toBe('Net Worth')
    expect(payload.dateText).toBeDefined()
    expect(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i.test(payload.dateText)).toBe(true)
    expect(payload.incomeValue).toContain('+$')
    expect(payload.expenseValue).toContain('-$')
    expect(payload.sparklinePoints).toEqual([500])
    expect(payload.todayNet).toContain('-$')
    expect(payload.todayNetVal).toBe(-150)
  })

  it('ensures widget text strings contain zero system emojis', async () => {
    useSettingsStore.setState({ locale: 'id', defaultCurrency: 'IDR' })

    await syncNativeWidgetData({
      totalBalance: 1000000,
      monthIncome: 500000,
      monthExpense: 200000,
      todayNet: 50000,
    })

    const payload = FinTrackNotificationPlugin.updateWidgetData.mock.calls[0][0]
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

    expect(emojiRegex.test(payload.balance)).toBe(false)
    expect(emojiRegex.test(payload.income)).toBe(false)
    expect(emojiRegex.test(payload.expense)).toBe(false)
    expect(emojiRegex.test(payload.period)).toBe(false)
    expect(emojiRegex.test(payload.btnText)).toBe(false)
    expect(emojiRegex.test(payload.balanceLabel)).toBe(false)
    expect(emojiRegex.test(payload.dateText)).toBe(false)
    expect(emojiRegex.test(payload.todayNet)).toBe(false)
  })

  it('aggregates balances and split transactions correctly in syncNativeWidgetFromDb with 7-day adaptive default', async () => {
    useSettingsStore.setState({ locale: 'id', defaultCurrency: 'IDR', widgetRange: '7d' })
    const todayStr = new Date().toISOString().slice(0, 10)

    db.wallets.toArray.mockResolvedValue([
      { id: 1, name: 'Main Wallet', balance: 2000000, currency: 'IDR', isArchived: 0 },
    ])

    db.transactions.toArray.mockResolvedValue([
      {
        id: 101,
        date: todayStr,
        walletId: 1,
        type: 'expense',
        amount: 200000,
        currency: 'IDR',
        isSplit: true,
        splitItems: [
          { amount: 150000, category: 'Food', type: 'expense' },
          { amount: 50000, category: 'Transfer', type: 'expense', isExcludeAnalyticsTx: true },
        ],
      },
      {
        id: 102,
        date: todayStr,
        walletId: 1,
        type: 'income',
        amount: 500000,
        currency: 'IDR',
      },
    ])

    await syncNativeWidgetFromDb()

    expect(FinTrackNotificationPlugin.updateWidgetData).toHaveBeenCalledTimes(1)
    const payload = FinTrackNotificationPlugin.updateWidgetData.mock.calls[0][0]

    expect(payload.period).toBe('7 Hari Terakhir')
    expect(payload.monthIncome).toContain('Masuk:')
    expect(payload.monthExpense).toContain('Keluar:')
    expect(payload.sparklinePoints).toBeDefined()
    expect(payload.sparklinePoints.length).toBe(7)
  })

  it('respects monthly widgetRange setting in syncNativeWidgetFromDb', async () => {
    useSettingsStore.setState({ locale: 'id', defaultCurrency: 'IDR', widgetRange: 'month' })
    const todayStr = new Date().toISOString().slice(0, 10)

    db.wallets.toArray.mockResolvedValue([
      { id: 1, name: 'Main Wallet', balance: 2000000, currency: 'IDR', isArchived: 0 },
    ])

    db.transactions.toArray.mockResolvedValue([
      {
        id: 103,
        date: todayStr,
        walletId: 1,
        type: 'income',
        amount: 1000000,
        currency: 'IDR',
      },
    ])

    await syncNativeWidgetFromDb()

    expect(FinTrackNotificationPlugin.updateWidgetData).toHaveBeenCalledTimes(1)
    const payload = FinTrackNotificationPlugin.updateWidgetData.mock.calls[0][0]

    expect(payload.period).toBe('Bulan Ini')
    expect(payload.monthIncome).toContain('Masuk:')
  })

  it('computes and transmits surplus values in widget payload', async () => {
    useSettingsStore.setState({ locale: 'id', defaultCurrency: 'IDR' })

    await syncNativeWidgetData({
      totalBalance: 10000000,
      monthIncome: 5000000,
      monthExpense: 2000000,
      defaultCurrency: 'IDR',
    })

    const payload = FinTrackNotificationPlugin.updateWidgetData.mock.calls[0][0]
    expect(payload.incomeValNum).toBe(5000000)
    expect(payload.expenseValNum).toBe(2000000)
    expect(payload.surplusFormatted).toBeDefined()
    expect(payload.surplusFormatted).toContain('3') // 3 juta
  })

  it('filters widget metrics to a single wallet when configured in widget config', async () => {
    useSettingsStore.setState({ locale: 'id', defaultCurrency: 'IDR' })
    const todayStr = new Date().toISOString().slice(0, 10)

    db.wallets.toArray.mockResolvedValue([
      { id: 1, name: 'BCA Main', balance: 5000000, currency: 'IDR', isArchived: 0 },
      { id: 2, name: 'Mandiri Savings', balance: 10000000, currency: 'IDR', isArchived: 0 },
    ])

    db.transactions.toArray.mockResolvedValue([
      {
        id: 201,
        date: todayStr,
        walletId: 1,
        type: 'income',
        amount: 3000000,
        currency: 'IDR',
      },
      {
        id: 202,
        date: todayStr,
        walletId: 2,
        type: 'income',
        amount: 8000000,
        currency: 'IDR',
      },
    ])

    // Mock widget configured for wallet 1 (BCA Main)
    FinTrackNotificationPlugin.getWidgetConfig.mockResolvedValueOnce({
      range: 'month',
      walletId: '1',
      walletName: 'BCA Main',
    })

    await syncNativeWidgetFromDb()

    const payload = FinTrackNotificationPlugin.updateWidgetData.mock.calls[0][0]
    // Balance should only be for wallet 1 (5M + 3M = 8M, not 15M + 11M)
    expect(payload.balance).toContain('8.000.000')
    // Income should only be from wallet 1 (3M)
    expect(payload.incomeValNum).toBe(3000000)
    // Period should include wallet name
    expect(payload.period).toContain('BCA Main')
    // walletList should be passed
    expect(payload.walletList).toBeDefined()
  })

  describe('Extended Widget Payload Contract (Compact Metrics, Net Metrics & Localization)', () => {
    it('includes compact metrics, surplus netSign (1), locale, and currencyPrefix (IDR surplus)', async () => {
      useSettingsStore.setState({ locale: 'id', defaultCurrency: 'IDR' })
      const totalBalance = 15000000
      const monthIncome = 10000000
      const monthExpense = 4000000
      const defaultCurrency = 'IDR'

      await syncNativeWidgetData({
        totalBalance,
        monthIncome,
        monthExpense,
        defaultCurrency,
        sparklinePoints: [1000, 2000],
      })

      expect(FinTrackNotificationPlugin.updateWidgetData).toHaveBeenCalledTimes(1)
      const payload = FinTrackNotificationPlugin.updateWidgetData.mock.calls[0][0]

      expect(payload.balanceCompact).toBe(formatCompactCurrency(Math.abs(totalBalance), defaultCurrency, 'id', true))
      expect(payload.incomeCompact).toBe(formatCompactCurrency(Math.abs(monthIncome), defaultCurrency, 'id', true))
      expect(payload.expenseCompact).toBe(formatCompactCurrency(Math.abs(monthExpense), defaultCurrency, 'id', true))
      expect(payload.netCompact).toBe(formatCompactCurrency(Math.abs(monthIncome - monthExpense), defaultCurrency, 'id', true))
      expect(payload.netSign).toBe(1)
      expect(payload.locale).toBe('id')
      expect(payload.currencyPrefix).toBe('Rp')

      // Existing backward compatibility keys
      expect(payload.balance).toBeDefined()
      expect(payload.income).toBeDefined()
      expect(payload.expense).toBeDefined()
      expect(payload.sparklineData).toBeDefined()
      expect(payload.incomeValNum).toBe(monthIncome)
      expect(payload.expenseValNum).toBe(monthExpense)
      expect(payload.surplusFormatted).toBeDefined()
    })

    it('includes compact metrics, deficit netSign (-1) when expense exceeds income', async () => {
      useSettingsStore.setState({ locale: 'id', defaultCurrency: 'IDR' })
      const totalBalance = 5000000
      const monthIncome = 2000000
      const monthExpense = 7000000
      const defaultCurrency = 'IDR'

      await syncNativeWidgetData({
        totalBalance,
        monthIncome,
        monthExpense,
        defaultCurrency,
      })

      expect(FinTrackNotificationPlugin.updateWidgetData).toHaveBeenCalledTimes(1)
      const payload = FinTrackNotificationPlugin.updateWidgetData.mock.calls[0][0]

      expect(payload.balanceCompact).toBe(formatCompactCurrency(Math.abs(totalBalance), defaultCurrency, 'id', true))
      expect(payload.incomeCompact).toBe(formatCompactCurrency(Math.abs(monthIncome), defaultCurrency, 'id', true))
      expect(payload.expenseCompact).toBe(formatCompactCurrency(Math.abs(monthExpense), defaultCurrency, 'id', true))
      expect(payload.netCompact).toBe(formatCompactCurrency(Math.abs(monthIncome - monthExpense), defaultCurrency, 'id', true))
      expect(payload.netSign).toBe(-1)
      expect(payload.locale).toBe('id')
      expect(payload.currencyPrefix).toBe('Rp')
    })

    it('includes compact metrics, zero netSign (0) when income equals expense', async () => {
      useSettingsStore.setState({ locale: 'id', defaultCurrency: 'IDR' })
      const totalBalance = 1000000
      const monthIncome = 3000000
      const monthExpense = 3000000
      const defaultCurrency = 'IDR'

      await syncNativeWidgetData({
        totalBalance,
        monthIncome,
        monthExpense,
        defaultCurrency,
      })

      expect(FinTrackNotificationPlugin.updateWidgetData).toHaveBeenCalledTimes(1)
      const payload = FinTrackNotificationPlugin.updateWidgetData.mock.calls[0][0]

      expect(payload.balanceCompact).toBe(formatCompactCurrency(Math.abs(totalBalance), defaultCurrency, 'id', true))
      expect(payload.incomeCompact).toBe(formatCompactCurrency(Math.abs(monthIncome), defaultCurrency, 'id', true))
      expect(payload.expenseCompact).toBe(formatCompactCurrency(Math.abs(monthExpense), defaultCurrency, 'id', true))
      expect(payload.netCompact).toBe(formatCompactCurrency(0, defaultCurrency, 'id', true))
      expect(payload.netSign).toBe(0)
      expect(payload.locale).toBe('id')
      expect(payload.currencyPrefix).toBe('Rp')
    })

    it('handles locale en and USD currency correctly', async () => {
      useSettingsStore.setState({ locale: 'en', defaultCurrency: 'USD' })
      const totalBalance = 25000
      const monthIncome = 8000
      const monthExpense = 4500
      const defaultCurrency = 'USD'

      await syncNativeWidgetData({
        totalBalance,
        monthIncome,
        monthExpense,
        defaultCurrency,
      })

      expect(FinTrackNotificationPlugin.updateWidgetData).toHaveBeenCalledTimes(1)
      const payload = FinTrackNotificationPlugin.updateWidgetData.mock.calls[0][0]

      expect(payload.balanceCompact).toBe(formatCompactCurrency(Math.abs(totalBalance), defaultCurrency, 'en', true))
      expect(payload.incomeCompact).toBe(formatCompactCurrency(Math.abs(monthIncome), defaultCurrency, 'en', true))
      expect(payload.expenseCompact).toBe(formatCompactCurrency(Math.abs(monthExpense), defaultCurrency, 'en', true))
      expect(payload.netCompact).toBe(formatCompactCurrency(Math.abs(monthIncome - monthExpense), defaultCurrency, 'en', true))
      expect(payload.netSign).toBe(1)
      expect(payload.locale).toBe('en')
      expect(payload.currencyPrefix).toBe('USD')
    })
  })
})

