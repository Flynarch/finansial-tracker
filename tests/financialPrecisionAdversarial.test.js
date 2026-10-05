import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js-light'
import { convertCurrency, FALLBACK_EXCHANGE_RATES } from '../src/lib/utils'
import { computeWalletBalance, computeAllWalletBalances } from '../src/lib/db'

describe('Adversarial Financial Precision: convertCurrency', () => {
  describe('1. Extreme Values (Large & Small)', () => {
    it('accurately converts 100 trillion IDR to USD without overflow or precision loss', () => {
      const amount = 100_000_000_000_000 // 100 trillion IDR
      const res = convertCurrency(amount, 'IDR', 'USD')

      // 100,000,000,000,000 / 16800 = 5952380952.380952...
      const expected = new Decimal(amount).dividedBy(FALLBACK_EXCHANGE_RATES.IDR).times(FALLBACK_EXCHANGE_RATES.USD).toNumber()

      expect(typeof res).toBe('number')
      expect(Number.isFinite(res)).toBe(true)
      expect(res).toBe(expected)
      expect(res).toBeCloseTo(5_952_380_952.38, 2)
    })

    it('accurately converts Number.MAX_SAFE_INTEGER', () => {
      const maxSafe = Number.MAX_SAFE_INTEGER // 9,007,199,254,740,991
      const res = convertCurrency(maxSafe, 'IDR', 'USD')

      expect(typeof res).toBe('number')
      expect(Number.isFinite(res)).toBe(true)
      expect(res).toBeGreaterThan(0)
    })

    it('accurately converts 0.000001 BTC (micro crypto amounts)', () => {
      // 1 BTC = 65,000 USD, so rates: BTC = 0.000015384615384615385, USD = 1
      const rates = { BTC: 0.000015, USD: 1 }
      const amount = 0.000001 // 1 micro-BTC
      const res = convertCurrency(amount, 'BTC', 'USD', rates)

      // 0.000001 / 0.000015 * 1 = 0.06666666666666667
      expect(typeof res).toBe('number')
      expect(Number.isFinite(res)).toBe(true)
      expect(res).toBeCloseTo(0.0666666667, 8)
    })

    it('accurately converts 1 satoshi (0.00000001 BTC)', () => {
      const rates = { BTC: 0.00001, USD: 1 }
      const satoshi = 0.00000001 // 1e-8
      const res = convertCurrency(satoshi, 'BTC', 'USD', rates)

      expect(typeof res).toBe('number')
      expect(Number.isFinite(res)).toBe(true)
      expect(res).toBe(0.001)
    })

    it('accurately handles sub-micro amounts (1e-12)', () => {
      const rates = { TOKEN: 0.000001, USD: 1 }
      const amount = 1e-12
      const res = convertCurrency(amount, 'TOKEN', 'USD', rates)

      expect(typeof res).toBe('number')
      expect(Number.isFinite(res)).toBe(true)
      expect(res).toBe(1e-6)
    })
  })

  describe('2. Repeating Decimals and Rational Fractions', () => {
    it('handles 1/3 exchange rate division cleanly without throwing or losing finite bounds', () => {
      const rates = { BASE: 3, TARGET: 1 }
      const res = convertCurrency(100, 'BASE', 'TARGET', rates)

      expect(typeof res).toBe('number')
      expect(Number.isFinite(res)).toBe(true)
      // 100 / 3 = 33.333333333333336
      expect(res).toBeCloseTo(33.33333333, 6)
    })

    it('handles repeating 1/7 rate and round-trip conversion without drift', () => {
      const rates = { A: 7, B: 3 }
      const original = 70
      const forward = convertCurrency(original, 'A', 'B', rates)
      // forward = 70 / 7 * 3 = 30
      expect(forward).toBe(30)

      const backward = convertCurrency(forward, 'B', 'A', rates)
      // backward = 30 / 3 * 7 = 70
      expect(backward).toBe(70)
    })

    it('preserves Decimal precision when converting 0.1 from rate 100 to rate 300', () => {
      const rates = { A: 100, B: 300 }
      const res = convertCurrency(0.1, 'A', 'B', rates)
      expect(res).toBe(0.3)
    })
  })

  describe('3. Boundary, Zero & Negative Rates', () => {
    it('safely handles fromRate = 0 without throwing DivisionByZero or returning Infinity', () => {
      const rates = { USD: 0, IDR: 16800 }
      const res = convertCurrency(100, 'USD', 'IDR', rates)
      // Since fromRate <= 0, returns numericAmount safely
      expect(res).toBe(100)
      expect(Number.isFinite(res)).toBe(true)
    })

    it('safely handles toRate = 0 without returning 0 or NaN', () => {
      const rates = { USD: 1, IDR: 0 }
      const res = convertCurrency(100, 'USD', 'IDR', rates)
      expect(res).toBe(100)
      expect(Number.isFinite(res)).toBe(true)
    })

    it('safely handles negative exchange rates', () => {
      const rates = { USD: -1, IDR: 16800 }
      const res = convertCurrency(50, 'USD', 'IDR', rates)
      expect(res).toBe(50)
      expect(Number.isFinite(res)).toBe(true)
    })

    it('safely handles unknown currencies not in rates or fallbacks', () => {
      const res = convertCurrency(250, 'UNKNOWN_X', 'UNKNOWN_Y', {})
      expect(res).toBe(250)
      expect(Number.isFinite(res)).toBe(true)
    })

    it('safely handles null / undefined / empty rates object', () => {
      expect(convertCurrency(100, 'USD', 'IDR', null)).toBe(100 * FALLBACK_EXCHANGE_RATES.IDR)
      expect(convertCurrency(100, 'USD', 'IDR', undefined)).toBe(100 * FALLBACK_EXCHANGE_RATES.IDR)
    })

    it('returns numericAmount when fromCurrency === toCurrency regardless of rates', () => {
      expect(convertCurrency(500, 'USD', 'USD', { USD: 0 })).toBe(500)
      expect(convertCurrency(500, 'IDR', 'IDR')).toBe(500)
    })

    it('returns numericAmount when currency is empty or null', () => {
      expect(convertCurrency(100, null, 'USD')).toBe(100)
      expect(convertCurrency(100, 'USD', null)).toBe(100)
      expect(convertCurrency(100, '', '')).toBe(100)
    })
  })

  describe('4. Malformed and Non-Finite Amounts', () => {
    it('handles NaN gracefully returning 0', () => {
      const res = convertCurrency(NaN, 'USD', 'IDR')
      expect(res).toBe(0)
      expect(Number.isNaN(res)).toBe(false)
    })

    it('handles Infinity and -Infinity returning 0', () => {
      expect(convertCurrency(Infinity, 'USD', 'IDR')).toBe(0)
      expect(convertCurrency(-Infinity, 'USD', 'IDR')).toBe(0)
    })

    it('handles null, undefined, and non-numeric strings returning 0', () => {
      expect(convertCurrency(null, 'USD', 'IDR')).toBe(0)
      expect(convertCurrency(undefined, 'USD', 'IDR')).toBe(0)
      expect(convertCurrency('abc', 'USD', 'IDR')).toBe(0)
    })

    it('handles numeric string inputs correctly', () => {
      const res = convertCurrency('10', 'USD', 'IDR')
      expect(res).toBe(10 * FALLBACK_EXCHANGE_RATES.IDR)
    })

    it('handles negative amounts correctly', () => {
      const res = convertCurrency(-10, 'USD', 'IDR')
      expect(res).toBe(-10 * FALLBACK_EXCHANGE_RATES.IDR)
    })
  })

  describe('5. Return Type Contract', () => {
    it('always returns primitive JavaScript number, never Decimal instance', () => {
      const res = convertCurrency(100, 'USD', 'IDR')
      expect(typeof res).toBe('number')
      expect(res instanceof Decimal).toBe(false)
    })
  })
})

describe('Adversarial Financial Precision: computeWalletBalance & computeAllWalletBalances', () => {
  describe('1. Floating-Point Drift Immunity', () => {
    it('eliminates drift on 10 x 0.1 transactions (exact 1.0)', () => {
      const wallet = { id: 1, balance: 0, currency: 'USD' }
      const txs = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        walletId: 1,
        type: 'income',
        amount: 0.1,
        currency: 'USD',
      }))

      const balance = computeWalletBalance(wallet, txs)
      expect(balance).toBe(1)

      const all = computeAllWalletBalances([wallet], txs)
      expect(all[0].currentBalance).toBe(1)
    })

    it('eliminates drift on 100 x 0.01 transactions (exact 1.00)', () => {
      const wallet = { id: 1, balance: 0, currency: 'USD' }
      const txs = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        walletId: 1,
        type: 'income',
        amount: 0.01,
        currency: 'USD',
      }))

      const balance = computeWalletBalance(wallet, txs)
      expect(balance).toBe(1)

      const all = computeAllWalletBalances([wallet], txs)
      expect(all[0].currentBalance).toBe(1)
    })

    it('eliminates drift on 1,000 x 0.07 transactions (exact 70.00)', () => {
      const wallet = { id: 1, balance: 0, currency: 'USD' }
      const txs = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        walletId: 1,
        type: 'income',
        amount: 0.07,
        currency: 'USD',
      }))

      const balance = computeWalletBalance(wallet, txs)
      expect(balance).toBe(70)

      const all = computeAllWalletBalances([wallet], txs)
      expect(all[0].currentBalance).toBe(70)
    })

    it('eliminates drift on 500 x +0.1 and 500 x -0.1 alternating transactions (exact 0)', () => {
      const wallet = { id: 1, balance: 0, currency: 'USD' }
      const txs = []
      for (let i = 0; i < 500; i++) {
        txs.push({ id: `inc_${i}`, walletId: 1, type: 'income', amount: 0.1, currency: 'USD' })
        txs.push({ id: `exp_${i}`, walletId: 1, type: 'expense', amount: 0.1, currency: 'USD' })
      }

      const balance = computeWalletBalance(wallet, txs)
      expect(balance).toBe(0)

      const all = computeAllWalletBalances([wallet], txs)
      expect(all[0].currentBalance).toBe(0)
    })

    it('solves classic 0.1 + 0.2 - 0.3 without floating point residue', () => {
      const wallet = { id: 1, balance: 0, currency: 'USD' }
      const txs = [
        { id: 1, walletId: 1, type: 'income', amount: 0.1, currency: 'USD' },
        { id: 2, walletId: 1, type: 'income', amount: 0.2, currency: 'USD' },
        { id: 3, walletId: 1, type: 'expense', amount: 0.3, currency: 'USD' },
      ]

      const balance = computeWalletBalance(wallet, txs)
      expect(balance).toBe(0)

      const all = computeAllWalletBalances([wallet], txs)
      expect(all[0].currentBalance).toBe(0)
    })

    it('solves 1.005 + 0.005 correctly', () => {
      const wallet = { id: 1, balance: 0, currency: 'USD' }
      const txs = [
        { id: 1, walletId: 1, type: 'income', amount: 1.005, currency: 'USD' },
        { id: 2, walletId: 1, type: 'income', amount: 0.005, currency: 'USD' },
      ]

      const balance = computeWalletBalance(wallet, txs)
      expect(balance).toBe(1.01)
    })
  })

  describe('2. Multi-Type Ledger Accounting Stress', () => {
    it('correctly aggregates income, expense, transfer-out, transfer-in, and signed balance adjustments', () => {
      const walletA = { id: 'w1', name: 'Wallet A', balance: 1_000_000, currency: 'IDR' }
      const walletB = { id: 'w2', name: 'Wallet B', balance: 500_000, currency: 'IDR' }

      const txs = [
        { id: 1, walletId: 'w1', type: 'income', amount: 250_000.5, currency: 'IDR' },
        { id: 2, walletId: 'w1', type: 'expense', amount: 75_000.2, currency: 'IDR' },
        { id: 3, walletId: 'w1', targetWalletId: 'w2', type: 'transfer', amount: 100_000.1, currency: 'IDR' },
        { id: 4, walletId: 'w2', targetWalletId: 'w1', type: 'transfer', amount: 20_000.4, currency: 'IDR' },
        { id: 5, walletId: 'w1', type: 'balance_adjustment', amount: 50_000.2, currency: 'IDR' }, // positive adjustment
        { id: 6, walletId: 'w1', type: 'balance_adjustment', amount: -15_000.3, currency: 'IDR' }, // negative adjustment
      ]

      // Wallet A expected:
      // 1,000,000 + 250,000.5 - 75,000.2 - 100,000.1 + 20,000.4 + 50,000.2 - 15,000.3
      // = 1,130,000.5
      const balA = computeWalletBalance(walletA, txs, null, [walletA, walletB])
      expect(balA).toBe(1_130_000.5)

      // Wallet B expected:
      // 500,000 + 100,000.1 - 20,000.4 = 580,000.7 - wait: wait 579,999.7
      // 500,000 + 100,000.1 = 600,000.1; 600,000.1 - 20,000.4 = 579,999.7
      const balB = computeWalletBalance(walletB, txs, null, [walletA, walletB])
      expect(balB).toBe(579_999.7)

      // Batch computation must match
      const all = computeAllWalletBalances([walletA, walletB], txs, null, [walletA, walletB])
      expect(all[0].currentBalance).toBe(1_130_000.5)
      expect(all[1].currentBalance).toBe(579_999.7)
    })

    it('handles cross-currency transfers with explicit targetAmount and implicit conversion', () => {
      const walletUSD = { id: 'usd_1', balance: 100, currency: 'USD' }
      const walletIDR = { id: 'idr_1', balance: 0, currency: 'IDR' }
      const rates = { USD: 1, IDR: 16800 }

      // 1. Explicit targetAmount
      const txExplicit = [
        {
          id: 'tx_exp',
          type: 'transfer',
          walletId: 'usd_1',
          targetWalletId: 'idr_1',
          amount: 10,
          targetAmount: 168_000,
          currency: 'USD',
        },
      ]

      expect(computeWalletBalance(walletUSD, txExplicit, rates, [walletUSD, walletIDR])).toBe(90)
      expect(computeWalletBalance(walletIDR, txExplicit, rates, [walletUSD, walletIDR])).toBe(168_000)

      const allExplicit = computeAllWalletBalances([walletUSD, walletIDR], txExplicit, rates, [walletUSD, walletIDR])
      expect(allExplicit[0].currentBalance).toBe(90)
      expect(allExplicit[1].currentBalance).toBe(168_000)

      // 2. Implicit targetAmount (converts via rates)
      const txImplicit = [
        {
          id: 'tx_imp',
          type: 'transfer',
          walletId: 'usd_1',
          targetWalletId: 'idr_1',
          amount: 5,
          currency: 'USD',
        },
      ]

      expect(computeWalletBalance(walletUSD, txImplicit, rates, [walletUSD, walletIDR])).toBe(95)
      expect(computeWalletBalance(walletIDR, txImplicit, rates, [walletUSD, walletIDR])).toBe(84_000)

      const allImplicit = computeAllWalletBalances([walletUSD, walletIDR], txImplicit, rates, [walletUSD, walletIDR])
      expect(allImplicit[0].currentBalance).toBe(95)
      expect(allImplicit[1].currentBalance).toBe(84_000)
    })
  })

  describe('3. Edge Cases, Deleted and Pending Transactions', () => {
    it('completely ignores deleted transactions (deletedAt)', () => {
      const wallet = { id: 1, balance: 1000, currency: 'USD' }
      const txs = [
        { id: 1, walletId: 1, type: 'income', amount: 500, deletedAt: '2026-03-01T00:00:00Z' },
        { id: 2, walletId: 1, type: 'expense', amount: 200, deletedAt: 1772409600000 },
      ]

      expect(computeWalletBalance(wallet, txs)).toBe(1000)
      const all = computeAllWalletBalances([wallet], txs)
      expect(all[0].currentBalance).toBe(1000)
    })

    it('completely ignores pending review transactions (isPendingReview true or 1)', () => {
      const wallet = { id: 1, balance: 1000, currency: 'USD' }
      const txs = [
        { id: 1, walletId: 1, type: 'income', amount: 500, isPendingReview: true },
        { id: 2, walletId: 1, type: 'expense', amount: 200, isPendingReview: 1 },
      ]

      expect(computeWalletBalance(wallet, txs)).toBe(1000)
      const all = computeAllWalletBalances([wallet], txs)
      expect(all[0].currentBalance).toBe(1000)
    })

    it('neutralizes self-transfers (walletId === targetWalletId)', () => {
      const wallet = { id: 1, balance: 5000, currency: 'USD' }
      const txs = [
        { id: 1, walletId: 1, targetWalletId: 1, type: 'transfer', amount: 1000, currency: 'USD' },
      ]

      expect(computeWalletBalance(wallet, txs)).toBe(5000)
      const all = computeAllWalletBalances([wallet], txs)
      expect(all[0].currentBalance).toBe(5000)
    })

    it('safely handles null/undefined inputs for wallets and transactions', () => {
      expect(computeWalletBalance(null, [])).toBe(0)
      expect(computeWalletBalance(undefined, [])).toBe(0)

      const wallet = { id: 1, balance: 500, currency: 'USD' }
      expect(computeWalletBalance(wallet, null)).toBe(500)
      expect(computeWalletBalance(wallet, undefined)).toBe(500)
      expect(computeWalletBalance(wallet, 'invalid')).toBe(500)

      expect(computeAllWalletBalances(null, [])).toEqual([])
      expect(computeAllWalletBalances(undefined, [])).toEqual([])
      expect(computeAllWalletBalances([], [])).toEqual([])
    })

    it('safely handles transactions with falsy or non-numeric amounts (NaN, null, undefined, string)', () => {
      const wallet = { id: 1, balance: 1000, currency: 'USD' }
      const txs = [
        { id: 1, walletId: 1, type: 'income', amount: NaN },
        { id: 2, walletId: 1, type: 'expense', amount: null },
        { id: 3, walletId: 1, type: 'income', amount: undefined },
        { id: 4, walletId: 1, type: 'income', amount: 'not_a_number' },
      ]

      const res = computeWalletBalance(wallet, txs)
      expect(typeof res).toBe('number')
      expect(Number.isFinite(res)).toBe(true)
      expect(res).toBe(1000)
    })

    it('safely handles Infinity amount without crashing in computeWalletBalance', () => {
      const wallet = { id: 1, balance: 1000, currency: 'USD' }
      const txs = [
        { id: 1, walletId: 1, type: 'income', amount: Infinity, currency: 'USD' },
      ]

      // Infinity amount is safely sanitized to 0 via toSafeNumber, preserving existing balance
      expect(computeWalletBalance(wallet, txs)).toBe(1000)
    })

    it('safely handles Infinity wallet balance without crashing in computeWalletBalance', () => {
      const wallet = { id: 1, balance: Infinity, currency: 'USD' }
      // Infinity initial balance is safely converted to 0 via toSafeNumber
      expect(computeWalletBalance(wallet, [])).toBe(0)
    })

    it('safely handles cross-currency transfer with Infinity targetAmount in computeWalletBalance', () => {
      const walletUSD = { id: 1, balance: 1000, currency: 'USD' }
      const txs = [
        { id: 1, targetWalletId: 1, type: 'transfer', amount: 50, targetAmount: Infinity, currency: 'USD' },
      ]
      // targetAmount Infinity evaluates to 0 (not > 0), safely falling back to source currency amount (50)
      expect(computeWalletBalance(walletUSD, txs)).toBe(1050)
    })

    it('safely handles Infinity amount without crashing in computeAllWalletBalances', () => {
      const wallet = { id: 1, balance: 1000, currency: 'USD' }
      const txs = [
        { id: 1, walletId: 1, type: 'income', amount: Infinity, currency: 'USD' },
      ]
      const results = computeAllWalletBalances([wallet], txs)
      expect(results[0].currentBalance).toBe(1000)
    })
  })

  describe('4. Consistency Between Single and Batch Calculations', () => {
    it('produces identical balances across single and batch engines for multi-wallet topologies', () => {
      const wallets = [
        { id: 'bca', name: 'BCA', balance: 5_000_000, currency: 'IDR' },
        { id: 'mandiri', name: 'Mandiri', balance: 2_500_000, currency: 'IDR' },
        { id: 'gopay', name: 'GoPay', balance: 350_000, currency: 'IDR' },
        { id: 'wise_usd', name: 'Wise USD', balance: 250.75, currency: 'USD' },
      ]

      const rates = { IDR: 16800, USD: 1 }

      // Generate 200 mixed transactions across all wallets
      const txs = []
      let idCounter = 1

      for (let i = 0; i < 50; i++) {
        txs.push({
          id: idCounter++,
          walletId: 'bca',
          type: 'income',
          amount: 100_000 + i * 500,
          currency: 'IDR',
        })
        txs.push({
          id: idCounter++,
          walletId: 'mandiri',
          type: 'expense',
          amount: 50_000 + i * 250,
          currency: 'IDR',
        })
        txs.push({
          id: idCounter++,
          walletId: 'bca',
          targetWalletId: 'gopay',
          type: 'transfer',
          amount: 25_000,
          currency: 'IDR',
        })
        txs.push({
          id: idCounter++,
          walletId: 'wise_usd',
          type: 'income',
          amount: 1.25,
          currency: 'USD',
        })
      }

      // Compute individually
      const individualResults = wallets.map((w) => ({
        id: w.id,
        currentBalance: computeWalletBalance(w, txs, rates, wallets),
      }))

      // Compute in batch
      const batchResults = computeAllWalletBalances(wallets, txs, rates, wallets)

      for (const single of individualResults) {
        const batch = batchResults.find((b) => b.id === single.id)
        expect(batch).toBeDefined()
        expect(batch.currentBalance).toBe(single.currentBalance)
      }
    })
  })
})
