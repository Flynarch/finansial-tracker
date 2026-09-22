import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/lib/db'
import { processSseEventBlock, mergeFunctionCallArgs } from '../src/lib/ai/streamParsers'
import { distributeReceiptTransactions } from '../src/lib/ai/receiptDistributor'
import { calculateDirectFinancialHealth } from '../src/lib/ai/financialHealth'
import * as geminiFacade from '../src/lib/gemini'

describe('Challenger Empirical Stress Suite - Milestone 1', () => {
  describe('1. Stream Parsing and Function Call Argument Aggregation', () => {
    it('handles empty, whitespace, and comment-only SSE blocks without crashing or corrupting state', () => {
      const state = { fullText: 'existing', functionCall: null }
      processSseEventBlock('', state)
      processSseEventBlock('   \n  \t  \r\n', state)
      processSseEventBlock(': keepalive-ping-from-gateway\n', state)
      processSseEventBlock(': id: 12345\n: retry: 1000\n', state)
      expect(state.fullText).toBe('existing')
      expect(state.functionCall).toBeNull()
    })

    it('safely survives malformed and truncated JSON payloads without throwing', () => {
      const state = { fullText: 'valid', functionCall: { name: 'func1', args: { a: 1 } } }
      // Incomplete JSON
      processSseEventBlock('data: {"candidates":[{"content":{"parts":[{"text":"cut off', state)
      // Non-JSON garbage
      processSseEventBlock('data: <html><body>502 Bad Gateway</body></html>', state)
      // Truncated object in data line
      processSseEventBlock('data: { "unclosed": ', state)
      // JSON primitives instead of Gemini schema
      processSseEventBlock('data: 12345', state)
      processSseEventBlock('data: "plain string"', state)
      processSseEventBlock('data: null', state)

      // Verify state was not wiped or corrupted
      expect(state.fullText).toBe('valid')
      expect(state.functionCall.name).toBe('func1')
      expect(state.functionCall.args.a).toBe(1)
    })

    it('correctly processes W3C multi-line data payloads with mixed CRLF, LF, and CR', () => {
      const state = { fullText: '', functionCall: null }
      const chunks = []
      const onStream = (text) => chunks.push(text)

      const multilineBlock = [
        'data: {',
        'data:   "candidates": [{',
        'data:     "content": {',
        'data:       "parts": [{"text": "Hello "}, {"text": "World!"}]',
        'data:     }',
        'data:   }]',
        'data: }',
      ].join('\r\n')

      processSseEventBlock(multilineBlock, state, onStream)
      expect(state.fullText).toBe('Hello World!')
      expect(chunks).toEqual(['Hello ', 'World!'])
    })

    it('handles [DONE] sentinels with varied surrounding whitespace', () => {
      const state = { fullText: 'Initial', functionCall: null }
      processSseEventBlock('data: [DONE]', state)
      processSseEventBlock('data:   [DONE]   \r\n', state)
      expect(state.fullText).toBe('Initial')
    })

    it('preserves function name when later streaming chunks omit name and only provide delta args', () => {
      const state = { fullText: '', functionCall: null }

      // Chunk 1: introduces functionCall name and partial args
      const chunk1 = 'data: {"candidates":[{"content":{"parts":[{"functionCall":{"name":"record_transaction","args":{"merchant":"Alfamart"}}}]}}]}'
      processSseEventBlock(chunk1, state)
      expect(state.functionCall.name).toBe('record_transaction')
      expect(state.functionCall.args.merchant).toBe('Alfamart')

      // Chunk 2: omits functionCall name, provides more args
      const chunk2 = 'data: {"candidates":[{"content":{"parts":[{"functionCall":{"args":{"amount":45000,"category":"makanan"}}}]}}]}'
      processSseEventBlock(chunk2, state)
      expect(state.functionCall.name).toBe('record_transaction')
      expect(state.functionCall.args.merchant).toBe('Alfamart')
      expect(state.functionCall.args.amount).toBe(45000)
      expect(state.functionCall.args.category).toBe('makanan')
    })

    it('deeply merges nested objects across streaming argument chunks', () => {
      const target = {
        filter: {
          dateRange: { start: '2026-01-01' },
          categories: ['makanan'],
        },
        meta: { debug: false },
      }

      const source = {
        filter: {
          dateRange: { end: '2026-01-31' },
          minAmount: 10000,
        },
        meta: { source: 'ai_stream' },
      }

      mergeFunctionCallArgs(target, source)
      expect(target.filter.dateRange.start).toBe('2026-01-01')
      expect(target.filter.dateRange.end).toBe('2026-01-31')
      expect(target.filter.categories).toEqual(['makanan'])
      expect(target.filter.minAmount).toBe(10000)
      expect(target.meta.debug).toBe(false)
      expect(target.meta.source).toBe('ai_stream')
    })

    it('accumulates stream array items without duplicating or losing items under high volume', () => {
      const target = { items: [] }
      for (let i = 0; i < 50; i++) {
        mergeFunctionCallArgs(target, {
          items: [{ index: i, name: `Item ${i}`, price: (i + 1) * 1000 }],
        })
      }
      expect(target.items).toHaveLength(50)
      expect(target.items[0]).toEqual({ index: 0, name: 'Item 0', price: 1000 })
      expect(target.items[49]).toEqual({ index: 49, name: 'Item 49', price: 50000 })

      // Re-merging the last 5 chunks must not duplicate them
      for (let i = 45; i < 50; i++) {
        mergeFunctionCallArgs(target, {
          items: [{ index: i, name: `Item ${i}`, price: (i + 1) * 1000 }],
        })
      }
      expect(target.items).toHaveLength(50)
    })

    it('correctly handles non-object and null arguments in mergeFunctionCallArgs', () => {
      const target = { a: 1 }
      expect(mergeFunctionCallArgs(target, null)).toBe(target)
      expect(mergeFunctionCallArgs(target, undefined)).toBe(target)
      expect(mergeFunctionCallArgs(target, 'string')).toBe(target)
      expect(mergeFunctionCallArgs(target, 42)).toBe(target)
    })

    it('verifies facade export contracts for streaming parsers', () => {
      expect(geminiFacade.processSseEventBlock).toBe(processSseEventBlock)
      expect(geminiFacade.mergeFunctionCallArgs).toBe(mergeFunctionCallArgs)
    })
  })

  describe('2. Receipt Transaction Distribution & Numerical Rounding', () => {
    it('distributes odd amounts in IDR with exact zero-decimal conservation', () => {
      // Grand total = 100,001 IDR. Subtotal = 100,000 IDR (Item 1: 50,000, Item 2: 50,000). Tax = 1 IDR.
      const parent = {
        amount: 100000,
        currency: 'IDR',
        tax: 1,
        items: [
          { name: 'A', price: 50000 },
          { name: 'B', price: 50000 },
        ],
      }
      const resultMeta = { total: 100001, currency: 'IDR' }
      const res = distributeReceiptTransactions([parent], resultMeta, 'per_item')

      expect(res).toHaveLength(2)
      // Check zero decimals (integers)
      expect(Number.isInteger(res[0].amount)).toBe(true)
      expect(Number.isInteger(res[1].amount)).toBe(true)
      const sum = res.reduce((acc, tx) => acc + tx.amount, 0)
      expect(sum).toBe(100001)
    })

    it('handles zero-decimal three-way split with penny balancing remainder absorption', () => {
      // 100,000 IDR split 3 ways with items of equal price (33,333 + 33,333 + 33,334 = 100,000)
      const parent = {
        amount: 100000,
        currency: 'IDR',
        items: [
          { name: 'Kopi A', price: 33333 },
          { name: 'Kopi B', price: 33333 },
          { name: 'Kopi C', price: 33334 },
        ],
      }
      const res = distributeReceiptTransactions([parent], { total: 100000 }, 'per_item')
      expect(res).toHaveLength(3)
      res.forEach((tx) => {
        expect(Number.isInteger(tx.amount)).toBe(true)
      })
      const sum = res.reduce((acc, tx) => acc + tx.amount, 0)
      expect(sum).toBe(100000)
    })

    it('conserves cents in USD with fractional cent tax and tip distribution', () => {
      // 3 items: $10.00, $20.00, $30.00 -> subtotal $60.00
      // Tax: $5.35, Tip: $10.00, Discount: $2.50 -> net adjustment = +$12.85 -> Grand Total = $72.85
      const parent = {
        amount: 60.0,
        currency: 'USD',
        tax: 5.35,
        discount: 2.5,
        items: [
          { name: 'Entree', price: 30.0 },
          { name: 'Appetizer', price: 20.0 },
          { name: 'Beverage', price: 10.0 },
        ],
      }
      const resultMeta = { total: 72.85, currency: 'USD' }
      const res = distributeReceiptTransactions([parent], resultMeta, 'per_item')

      expect(res).toHaveLength(3)
      // All amounts must have at most 2 decimal places
      res.forEach((tx) => {
        expect(Math.round(tx.amount * 100) / 100).toBe(tx.amount)
      })
      const sum = Math.round(res.reduce((acc, tx) => acc + tx.amount, 0) * 100) / 100
      expect(sum).toBe(72.85)
    })

    it('filters out free or zero-price items in per_item mode', () => {
      const parent = {
        amount: 50000,
        currency: 'IDR',
        items: [
          { name: 'Burger', price: 50000 },
          { name: 'Saus Gratis', price: 0 },
          { name: 'Struk Biaya Layanan', price: -500 },
        ],
      }
      const res = distributeReceiptTransactions([parent], { total: 50000 }, 'per_item')
      expect(res).toHaveLength(1)
      expect(res[0].notes).toBe('Burger')
      expect(res[0].amount).toBe(50000)
    })

    it('reconciles single transaction in scanMode all when tax/discount was omitted from parent amount', () => {
      const transactions = [
        {
          amount: 100000,
          currency: 'IDR',
          tax: 11000,
          discount: 5000,
        },
      ]
      // Grand total should be 100,000 + 11,000 - 5,000 = 106,000
      const res = distributeReceiptTransactions(transactions, {}, 'all')
      expect(res).toHaveLength(1)
      expect(res[0].amount).toBe(106000)
    })

    it('prioritizes explicit receiptGrandTotal over calculated sum in scanMode all', () => {
      const transactions = [
        {
          amount: 100000,
          currency: 'IDR',
        },
      ]
      const res = distributeReceiptTransactions(transactions, { grandTotal: 95500 }, 'all')
      expect(res).toHaveLength(1)
      expect(res[0].amount).toBe(95500)
    })

    it('distributes taxes and discounts across multiple pre-parsed transactions in per_item mode', () => {
      const transactions = [
        { amount: 40000, currency: 'IDR', category: 'makanan' },
        { amount: 60000, currency: 'IDR', category: 'minuman' },
      ]
      // Subtotal = 100,000. Grand total = 110,000 (tax 10,000)
      const res = distributeReceiptTransactions(transactions, { total: 110000, tax: 10000 }, 'per_item')
      expect(res).toHaveLength(2)
      expect(res[0].amount).toBe(44000)
      expect(res[1].amount).toBe(66000)
      expect(res[0].amount + res[1].amount).toBe(110000)
    })

    it('gracefully handles empty, null, or degenerate transactions arrays', () => {
      expect(distributeReceiptTransactions([])).toEqual([])
      expect(distributeReceiptTransactions(null)).toBeNull()
      expect(distributeReceiptTransactions(undefined)).toBeUndefined()
    })

    it('verifies facade export contracts for receipt distributor', () => {
      expect(geminiFacade.distributeReceiptTransactions).toBe(distributeReceiptTransactions)
    })
  })

  describe('3. Offline Direct Financial Health Engine Stress Testing', () => {
    beforeEach(async () => {
      await db.wallets.clear()
      await db.transactions.clear()
      await db.loans.clear()
    })

    it('handles empty database tables without throwing NaN or division by zero', async () => {
      const health = await calculateDirectFinancialHealth({
        defaultCurrency: 'IDR',
        locale: 'id',
        referenceDate: new Date('2026-09-15'),
      })

      expect(health).toBeDefined()
      expect(health.type).toBe('financial_health')
      expect(typeof health.score).toBe('number')
      expect(health.score).toBeGreaterThanOrEqual(10)
      expect(health.score).toBeLessThanOrEqual(100)
      expect(Number.isNaN(health.score)).toBe(false)
      expect(health.rating).toBeDefined()
      expect(health.text).toBeDefined()
      expect(Array.isArray(health.chips)).toBe(true)

      // Verify numerical metrics contain zero instead of NaN
      expect(health.metrics.totalCash).toBe(0)
      expect(health.metrics.monthlyIncome).toBe(0)
      expect(health.metrics.monthlyExpense).toBe(0)
      expect(health.metrics.totalDebt).toBe(0)
      expect(health.metrics.totalReceivable).toBe(0)
      expect(health.metrics.savingsRatio).toBe(0)
      expect(health.metrics.dti).toBe(0)
      expect(health.metrics.emergencyMonths).toBe(0)
    })

    it('handles extreme debt-to-income scenario (zero income with multi-billion debt)', async () => {
      await db.wallets.add({ id: 1, name: 'BCA', balance: 5000000, currency: 'IDR' })
      // Active multi-billion debt
      await db.loans.add({
        id: 1,
        title: 'Kredit Korporat',
        type: 'debt',
        totalAmount: 10000000000,
        remainingAmount: 10000000000,
        status: 'active',
        currency: 'IDR',
        isArchived: 0,
      })

      const health = await calculateDirectFinancialHealth({
        defaultCurrency: 'IDR',
        locale: 'id',
        referenceDate: new Date('2026-09-15'),
      })

      expect(health.metrics.totalDebt).toBe(10000000000)
      expect(health.metrics.dti).toBe(100)
      // Empirical Discovery: When monthlyExpense is 0 and totalCash > 0, emergencyMonths defaults to 12 (+15),
      // which exactly offsets the dti > 50 penalty (-15). Score is exactly 50 ('Cukup').
      expect(health.score).toBe(50)
      expect(health.rating).toBe('Cukup')

      // Now add realistic monthly expense (e.g. 5,000,000 IDR) with zero income
      await db.transactions.add({
        id: 99,
        date: '2026-09-05',
        type: 'expense',
        amount: 5000000,
        currency: 'IDR',
        category: 'kebutuhan',
      })

      const healthWithExpense = await calculateDirectFinancialHealth({
        defaultCurrency: 'IDR',
        locale: 'id',
        referenceDate: new Date('2026-09-15'),
      })

      // Deficit (-20) + DTI penalty (-15) + emergency months (5m/5m = 1 month, +0) = 50 - 20 - 15 = 15 ('Kritis')
      expect(healthWithExpense.score).toBe(15)
      expect(healthWithExpense.rating).toBe('Kritis')
    })

    it('handles severe negative cashflow (deficit) with score clamping to valid range', async () => {
      await db.wallets.add({ id: 1, name: 'Tunai', balance: 0, currency: 'IDR' })
      // Monthly income 1,000,000, Monthly expense 50,000,000
      await db.transactions.bulkAdd([
        { id: 1, date: '2026-09-02', type: 'income', amount: 1000000, currency: 'IDR' },
        { id: 2, date: '2026-09-05', type: 'expense', amount: 50000000, currency: 'IDR' },
      ])
      // Huge debt
      await db.loans.add({
        id: 1,
        title: 'Utang Rentenir',
        type: 'debt',
        totalAmount: 100000000,
        remainingAmount: 100000000,
        status: 'active',
        currency: 'IDR',
        isArchived: 0,
      })

      const health = await calculateDirectFinancialHealth({
        defaultCurrency: 'IDR',
        locale: 'id',
        referenceDate: new Date('2026-09-15'),
      })

      expect(health.metrics.monthlyIncome).toBe(1000000)
      expect(health.metrics.monthlyExpense).toBe(50000000)
      // Deficit savings ratio should be non-negative in displayed metric
      expect(health.metrics.savingsRatio).toBe(0)
      // Score must not drop below 10
      expect(health.score).toBeGreaterThanOrEqual(10)
      expect(health.score).toBeLessThanOrEqual(35)
      expect(health.rating).toBe('Kritis')
    })

    it('excludes archived wallets, archived loans, paid loans, and forgiven loans from health metrics', async () => {
      // 1. Wallets: 1 active (10m), 1 archived (50m)
      await db.wallets.bulkAdd([
        { id: 1, name: 'Active Wallet', balance: 10000000, currency: 'IDR', isArchived: 0 },
        { id: 2, name: 'Archived Wallet', balance: 50000000, currency: 'IDR', isArchived: 1 },
      ])

      // 2. Loans: 1 active debt (5m), 1 archived debt (20m), 1 paid debt (15m), 1 forgiven debt (10m), 1 active receivable (8m)
      await db.loans.bulkAdd([
        { id: 1, title: 'Active Debt', type: 'debt', totalAmount: 5000000, remainingAmount: 5000000, status: 'active', currency: 'IDR', isArchived: 0 },
        { id: 2, title: 'Archived Debt', type: 'debt', totalAmount: 20000000, remainingAmount: 20000000, status: 'active', currency: 'IDR', isArchived: 1 },
        { id: 3, title: 'Paid Debt', type: 'debt', totalAmount: 15000000, remainingAmount: 0, status: 'paid', currency: 'IDR', isArchived: 0 },
        { id: 4, title: 'Forgiven Debt', type: 'debt', totalAmount: 10000000, remainingAmount: 10000000, status: 'forgiven', currency: 'IDR', isArchived: 0 },
        { id: 5, title: 'Active Receivable', type: 'receivable', totalAmount: 8000000, remainingAmount: 8000000, status: 'active', currency: 'IDR', isArchived: 0 },
      ])

      const health = await calculateDirectFinancialHealth({
        defaultCurrency: 'IDR',
        locale: 'id',
        referenceDate: new Date('2026-09-15'),
      })

      // Total cash should ONLY count active wallet (10,000,000 IDR)
      expect(health.metrics.totalCash).toBe(10000000)
      // Total debt should ONLY count active debt (5,000,000 IDR)
      expect(health.metrics.totalDebt).toBe(5000000)
      // Total receivable should ONLY count active receivable (8,000,000 IDR)
      expect(health.metrics.totalReceivable).toBe(8000000)
    })

    it('unpacks split transactions and respects analytics exclusion flags in health calculations', async () => {
      await db.wallets.add({ id: 1, name: 'BCA', balance: 20000000, currency: 'IDR' })

      await db.transactions.bulkAdd([
        // Regular transaction
        { id: 1, date: '2026-09-05', type: 'income', amount: 15000000, currency: 'IDR', category: 'gaji' },
        // Split transaction with parent tagged as excluded, but splitItems contain real expenses
        {
          id: 2,
          date: '2026-09-08',
          type: 'expense',
          amount: 2000000,
          currency: 'IDR',
          isSplit: true,
          isExcludeAnalyticsTx: true, // Parent tag should NOT suppress items
          splitItems: [
            { category: 'makanan', amount: 800000, type: 'expense' },
            { category: 'transport', amount: 400000, type: 'expense' },
            { category: 'tabungan', amount: 800000, type: 'expense', isExcludeFromAnalytics: true }, // Should be excluded
          ],
        },
        // Fully excluded non-split transaction (e.g. transfer)
        { id: 3, date: '2026-09-10', type: 'expense', amount: 5000000, currency: 'IDR', isExcludeAnalyticsTx: true },
      ])

      const health = await calculateDirectFinancialHealth({
        defaultCurrency: 'IDR',
        locale: 'id',
        referenceDate: new Date('2026-09-15'),
      })

      expect(health.metrics.monthlyIncome).toBe(15000000)
      // Monthly expense should be 800,000 + 400,000 = 1,200,000 (tabungan and transfer excluded)
      expect(health.metrics.monthlyExpense).toBe(1200000)
    })

    it('verifies facade export contracts for financial health calculator', () => {
      expect(geminiFacade.calculateDirectFinancialHealth).toBe(calculateDirectFinancialHealth)
    })
  })
})
