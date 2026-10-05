import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js-light'
import { convertCurrency, roundCurrency } from '../src/lib/utils'
import { computeWalletBalance, computeAllWalletBalances } from '../src/lib/db'

describe('Adversarial Challenge: Financial Precision & Arithmetic Soundness', () => {
  describe('1. convertCurrency Extreme & Edge Values', () => {
    it('handles 100 Trillion IDR without precision collapse or NaN', () => {
      const oneHundredTrillion = 100_000_000_000_000 // 100 Triliun IDR
      const customRates = { USD: 1, IDR: 16000 }

      const convertedToUsd = convertCurrency(oneHundredTrillion, 'IDR', 'USD', customRates)
      // 100,000,000,000,000 / 16,000 = 6,250,000,000 USD (6.25 Billion USD)
      expect(typeof convertedToUsd).toBe('number')
      expect(Number.isFinite(convertedToUsd)).toBe(true)
      expect(convertedToUsd).toBe(6_250_000_000)

      // Inverse: 6.25 Billion USD back to IDR
      const convertedBackToIdr = convertCurrency(6_250_000_000, 'USD', 'IDR', customRates)
      expect(convertedBackToIdr).toBe(oneHundredTrillion)
    })

    it('handles crypto micro-amounts (0.000001 BTC satoshi-scale) with arbitrary precision', () => {
      const btcAmount = 0.000001 // 100 satoshis
      // 1 USD = 0.000015 BTC (~$66,666.67 / BTC)
      const cryptoRates = { USD: 1, BTC: 0.000015 }

      const usdValue = convertCurrency(btcAmount, 'BTC', 'USD', cryptoRates)
      const expectedDecimal = new Decimal(0.000001).dividedBy(0.000015).times(1).toNumber()

      expect(typeof usdValue).toBe('number')
      expect(Number.isFinite(usdValue)).toBe(true)
      expect(usdValue).toBe(expectedDecimal)
      // 0.000001 / 0.000015 = 0.06666666666666667
      expect(usdValue).toBeCloseTo(0.06666667, 7)
    })

    it('handles repeating decimals (e.g. rate 1/3, 1/7) cleanly', () => {
      const rates = { USD: 1, THIRD: 3, SEVENTH: 7 }

      const oneThird = convertCurrency(1, 'THIRD', 'USD', rates)
      expect(typeof oneThird).toBe('number')
      expect(Number.isFinite(oneThird)).toBe(true)
      expect(oneThird).toBe(1 / 3)

      const oneSeventh = convertCurrency(1, 'SEVENTH', 'USD', rates)
      expect(typeof oneSeventh).toBe('number')
      expect(Number.isFinite(oneSeventh)).toBe(true)
      expect(oneSeventh).toBe(1 / 7)
    })

    it('handles 0 rates, negative rates, and missing rates safely without throwing or NaN', () => {
      const zeroRates = { USD: 1, ZERO_RATE: 0, NEG_RATE: -12.5 }

      // Division by zero safeguard
      expect(convertCurrency(500, 'ZERO_RATE', 'USD', zeroRates)).toBe(500)
      expect(convertCurrency(500, 'USD', 'ZERO_RATE', zeroRates)).toBe(500)

      // Negative rate safeguard
      expect(convertCurrency(500, 'NEG_RATE', 'USD', zeroRates)).toBe(500)
      expect(convertCurrency(500, 'USD', 'NEG_RATE', zeroRates)).toBe(500)

      // Unknown currency not in rates
      expect(convertCurrency(500, 'UNKNOWN_COIN', 'USD', zeroRates)).toBe(500)
      expect(convertCurrency(500, 'USD', 'UNKNOWN_COIN', zeroRates)).toBe(500)

      // Null or empty rates
      expect(convertCurrency(500, 'ABC', 'XYZ', null)).toBe(500)
      expect(convertCurrency(500, 'ABC', 'XYZ', {})).toBe(500)
    })

    it('handles adversarial amount inputs (NaN, Infinity, null, undefined, strings)', () => {
      expect(convertCurrency(NaN, 'USD', 'IDR')).toBe(0)
      expect(convertCurrency(Infinity, 'USD', 'IDR')).toBe(0)
      expect(convertCurrency(-Infinity, 'USD', 'IDR')).toBe(0)
      expect(convertCurrency(null, 'USD', 'IDR')).toBe(0)
      expect(convertCurrency(undefined, 'USD', 'IDR')).toBe(0)
      expect(convertCurrency('random_string', 'USD', 'IDR')).toBe(0)

      // String representation of valid number
      const strResult = convertCurrency('100', 'USD', 'IDR', { USD: 1, IDR: 16000 })
      expect(strResult).toBe(1_600_000)

      // Negative number conversion
      const negResult = convertCurrency(-10, 'USD', 'IDR', { USD: 1, IDR: 16000 })
      expect(negResult).toBe(-160_000)
    })
  })

  describe('2. computeWalletBalance 10,000 Synthetic Transactions Stress Test', () => {
    it('accumulates 10,000 transactions (5,000 x 0.1 + 5,000 x 0.2) with ZERO floating-point drift', () => {
      const testWallet = {
        id: 777,
        name: 'High Frequency Micro Wallet',
        currency: 'USD',
        balance: 0,
      }

      // In IEEE-754 floating point arithmetic:
      // (0.1 + 0.2) * 5000 suffers from binary float representation errors.
      // E.g., repeatedly adding 0.1 and 0.2 drifts away from 1500.0.
      const txCount = 10_000
      const transactions = []

      // Generate 5,000 txs of 0.1 and 5,000 txs of 0.2
      for (let i = 0; i < txCount / 2; i++) {
        transactions.push({
          id: `tx_a_${i}`,
          walletId: 777,
          type: 'income',
          amount: 0.1,
          currency: 'USD',
        })
        transactions.push({
          id: `tx_b_${i}`,
          walletId: 777,
          type: 'income',
          amount: 0.2,
          currency: 'USD',
        })
      }

      // Arbitrary precision oracle:
      // 5000 * 0.1 + 5000 * 0.2 = 500 + 1000 = 1500 exactly.
      const expectedOracleBalance = 1500

      const startTime = performance.now()
      const balance = computeWalletBalance(testWallet, transactions)
      const durationMs = performance.now() - startTime

      expect(typeof balance).toBe('number')
      expect(Number.isFinite(balance)).toBe(true)
      expect(Number.isNaN(balance)).toBe(false)
      expect(balance).toBe(expectedOracleBalance)
      // Performance check: 10,000 transactions should process in under 500ms
      expect(durationMs).toBeLessThan(500)
    })

    it('accumulates 10,000 mixed positive/negative fractional transactions matching Decimal oracle', () => {
      const testWallet = {
        id: 888,
        name: 'Cent Scale Wallet',
        currency: 'USD',
        balance: 100.55,
      }

      // Seed pseudorandom list of fractional amounts
      const transactions = []
      let oracleDecimal = new Decimal('100.55')

      const stepAmounts = [0.07, 0.13, 0.29, 0.01, 0.99, 1.49, 2.75, 0.33, 0.67, 0.05]
      const types = ['income', 'expense', 'income', 'income', 'expense', 'expense', 'income', 'expense', 'income', 'expense']

      for (let i = 0; i < 10_000; i++) {
        const amt = stepAmounts[i % stepAmounts.length]
        const type = types[i % types.length]

        transactions.push({
          id: `mixed_${i}`,
          walletId: 888,
          type,
          amount: amt,
          currency: 'USD',
        })

        if (type === 'income') {
          oracleDecimal = oracleDecimal.plus(new Decimal(amt))
        } else {
          oracleDecimal = oracleDecimal.minus(new Decimal(amt))
        }
      }

      const expectedOracleResult = roundCurrency(oracleDecimal.toNumber())
      const actualBalance = computeWalletBalance(testWallet, transactions)

      expect(actualBalance).toBe(expectedOracleResult)
      expect(typeof actualBalance).toBe('number')
      expect(Number.isFinite(actualBalance)).toBe(true)
    })
  })

  describe('3. computeAllWalletBalances Multi-Wallet 10,000 Transactions Test', () => {
    it('computes 10,000 cross-wallet transfers and multi-currency transactions across 5 wallets', () => {
      const wallets = [
        { id: 'w1', name: 'Wallet USD', currency: 'USD', balance: 1000 },
        { id: 'w2', name: 'Wallet EUR', currency: 'EUR', balance: 1000 },
        { id: 'w3', name: 'Wallet IDR', currency: 'IDR', balance: 10_000_000 },
        { id: 'w4', name: 'Wallet SGD', currency: 'SGD', balance: 500 },
        { id: 'w5', name: 'Wallet JPY', currency: 'JPY', balance: 50_000 },
      ]

      const customRates = {
        USD: 1,
        EUR: 0.9,
        IDR: 16000,
        SGD: 1.35,
        JPY: 150,
      }

      // Build 10,000 transactions:
      // Mixture of internal income, expense, and transfers
      const transactions = []
      for (let i = 0; i < 2_000; i++) {
        // w1 income 0.1 USD
        transactions.push({ id: `t1_${i}`, walletId: 'w1', type: 'income', amount: 0.1, currency: 'USD' })
        // w1 expense 0.2 USD
        transactions.push({ id: `t2_${i}`, walletId: 'w1', type: 'expense', amount: 0.2, currency: 'USD' })
        // w1 transfer 0.05 USD to w2
        transactions.push({ id: `t3_${i}`, walletId: 'w1', targetWalletId: 'w2', type: 'transfer', amount: 0.05, currency: 'USD' })
        // w3 income 15000 IDR
        transactions.push({ id: `t4_${i}`, walletId: 'w3', type: 'income', amount: 15000, currency: 'IDR' })
        // w3 transfer 5000 IDR to w1
        transactions.push({ id: `t5_${i}`, walletId: 'w3', targetWalletId: 'w1', type: 'transfer', amount: 5000, currency: 'IDR' })
      }

      const startTime = performance.now()
      const results = computeAllWalletBalances(wallets, transactions, customRates)
      const durationMs = performance.now() - startTime

      expect(results.length).toBe(5)
      results.forEach((w) => {
        expect(typeof w.currentBalance).toBe('number')
        expect(Number.isFinite(w.currentBalance)).toBe(true)
        expect(Number.isNaN(w.currentBalance)).toBe(false)
      })

      // Verify consistency: computeWalletBalance individual should match computeAllWalletBalances
      for (const w of wallets) {
        const individual = computeWalletBalance(w, transactions, customRates, wallets)
        const batch = results.find((res) => res.id === w.id)?.currentBalance
        expect(batch).toBe(individual)
      }

      // Performance: 10k transactions multi-wallet in batch under 500ms
      expect(durationMs).toBeLessThan(500)
    })
  })

  describe('4. NaN, Infinity & Malformed Data Defense', () => {
    it('handles NaN, null, undefined, invalid strings, deletedAt, and pending review transactions gracefully', () => {
      const wallet = { id: 1, currency: 'IDR', balance: 500000 }
      const malformedTxs = [
        { id: 1, walletId: 1, type: 'income', amount: NaN },
        { id: 4, walletId: 1, type: 'transfer', amount: 'not_a_number' },
        { id: 5, walletId: 1, type: 'balance_adjustment', amount: null },
        { id: 6, walletId: 1, type: 'income', amount: undefined },
        { id: 7, walletId: 1, type: 'unknown_type', amount: 100000 },
        { id: 8, walletId: 1, type: 'income', amount: 50000, deletedAt: '2026-03-01' },
        { id: 9, walletId: 1, type: 'income', amount: 50000, isPendingReview: true },
        { id: 10, walletId: 1, type: 'income', amount: 50000, isPendingReview: 1 },
      ]

      const bal = computeWalletBalance(wallet, malformedTxs)
      expect(typeof bal).toBe('number')
      expect(Number.isFinite(bal)).toBe(true)
      expect(Number.isNaN(bal)).toBe(false)
      // Since all malformed transactions are either 0 or ignored/deleted/pending:
      expect(bal).toBe(500000)

      const all = computeAllWalletBalances([wallet], malformedTxs)
      expect(all[0].currentBalance).toBe(500000)
    })

    it('safely handles Infinity payloads without crashing due to toSafeNumber sanitization', () => {
      const wallet = { id: 1, currency: 'IDR', balance: 500000 }

      // When Infinity is passed as amount, it is safely sanitized to 0
      expect(
        computeWalletBalance(wallet, [{ id: 99, walletId: 1, type: 'income', amount: Infinity }])
      ).toBe(500000)

      expect(
        computeWalletBalance(wallet, [{ id: 100, walletId: 1, type: 'expense', amount: Infinity }])
      ).toBe(500000)

      expect(
        computeWalletBalance({ id: 1, currency: 'IDR', balance: Infinity }, [])
      ).toBe(0)

      const batch = computeAllWalletBalances([{ id: 1, currency: 'IDR', balance: Infinity }], [])
      expect(batch[0].currentBalance).toBe(0)
    })

    it('roundCurrency always returns finite standard JS numbers and handles rounding modes', () => {
      expect(roundCurrency(NaN)).toBe(0)
      expect(roundCurrency(Infinity)).toBe(0)
      expect(roundCurrency(-Infinity)).toBe(0)
      expect(roundCurrency('not-a-number')).toBe(0)

      // Extreme large numbers
      const bigNum = 9007199254740991 // Number.MAX_SAFE_INTEGER
      expect(roundCurrency(bigNum)).toBe(bigNum)

      // Half-up rounding verification
      expect(roundCurrency(0.125)).toBe(0.13)
      expect(roundCurrency(0.124)).toBe(0.12)
      expect(roundCurrency(-0.125)).toBe(-0.13)
    })
  })
})
