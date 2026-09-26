import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncNativeWidgetData, syncNativeWidgetFromDb } from '../src/lib/nativeWidgetSync'
import { FinTrackNotificationPlugin } from '../src/lib/notificationIngestion'
import { db } from '../src/lib/db'
import useSettingsStore from '../src/store/useSettingsStore'

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
  })

  it('ensures widget text strings contain zero system emojis', async () => {
    useSettingsStore.setState({ locale: 'id', defaultCurrency: 'IDR' })

    await syncNativeWidgetData({
      totalBalance: 1000000,
      monthIncome: 500000,
      monthExpense: 200000,
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
})
