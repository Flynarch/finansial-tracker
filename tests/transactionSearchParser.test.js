import { describe, it, expect } from 'vitest'
import {
  parseTransactionSearchQuery,
  matchesTransactionAmount,
  formatAmountConditionBadge,
} from '../src/lib/transactionSearchParser'

describe('transactionSearchParser', () => {
  describe('parseTransactionSearchQuery', () => {
    it('returns empty textQuery and null condition for falsy or empty inputs', () => {
      expect(parseTransactionSearchQuery('')).toEqual({
        textQuery: '',
        amountCondition: null,
        rawQuery: '',
      })
      expect(parseTransactionSearchQuery('   ')).toEqual({
        textQuery: '',
        amountCondition: null,
        rawQuery: '',
      })
      expect(parseTransactionSearchQuery(null)).toEqual({
        textQuery: '',
        amountCondition: null,
        rawQuery: '',
      })
    })

    it('returns pure textQuery when query contains no amount operators or amounts', () => {
      const parsed = parseTransactionSearchQuery('kopi susu kenangan')
      expect(parsed.textQuery).toBe('kopi susu kenangan')
      expect(parsed.amountCondition).toBeNull()
      expect(parsed.rawQuery).toBe('kopi susu kenangan')
    })

    it('parses comparison operators (> , >=, <, <=, =)', () => {
      expect(parseTransactionSearchQuery('> 100k')).toEqual({
        textQuery: '',
        amountCondition: { type: 'comp', op: '>', value: 100000 },
        rawQuery: '> 100k',
      })

      expect(parseTransactionSearchQuery('>=50000')).toEqual({
        textQuery: '',
        amountCondition: { type: 'comp', op: '>=', value: 50000 },
        rawQuery: '>=50000',
      })

      expect(parseTransactionSearchQuery('< 25rb')).toEqual({
        textQuery: '',
        amountCondition: { type: 'comp', op: '<', value: 25000 },
        rawQuery: '< 25rb',
      })

      expect(parseTransactionSearchQuery('<= 500k')).toEqual({
        textQuery: '',
        amountCondition: { type: 'comp', op: '<=', value: 500000 },
        rawQuery: '<= 500k',
      })

      expect(parseTransactionSearchQuery('= 75.000')).toEqual({
        textQuery: '',
        amountCondition: { type: 'comp', op: '=', value: 75000 },
        rawQuery: '= 75.000',
      })

      expect(parseTransactionSearchQuery('== 2,5jt')).toEqual({
        textQuery: '',
        amountCondition: { type: 'comp', op: '=', value: 2500000 },
        rawQuery: '== 2,5jt',
      })
    })

    it('parses range queries with hyphen, en-dash, or double-dots', () => {
      expect(parseTransactionSearchQuery('50k - 200k')).toEqual({
        textQuery: '',
        amountCondition: { type: 'range', min: 50000, max: 200000 },
        rawQuery: '50k - 200k',
      })

      // Auto-reverses if min > max
      expect(parseTransactionSearchQuery('200k - 50k')).toEqual({
        textQuery: '',
        amountCondition: { type: 'range', min: 50000, max: 200000 },
        rawQuery: '200k - 50k',
      })

      expect(parseTransactionSearchQuery('25000..50000')).toEqual({
        textQuery: '',
        amountCondition: { type: 'range', min: 25000, max: 50000 },
        rawQuery: '25000..50000',
      })

      expect(parseTransactionSearchQuery('50rb – 150rb')).toEqual({
        textQuery: '',
        amountCondition: { type: 'range', min: 50000, max: 150000 },
        rawQuery: '50rb – 150rb',
      })
    })

    it('parses mixed text + comparison operator queries', () => {
      const res1 = parseTransactionSearchQuery('kopi > 20k')
      expect(res1.textQuery).toBe('kopi')
      expect(res1.amountCondition).toEqual({ type: 'comp', op: '>', value: 20000 })

      const res2 = parseTransactionSearchQuery('> 50k bca')
      expect(res2.textQuery).toBe('bca')
      expect(res2.amountCondition).toEqual({ type: 'comp', op: '>', value: 50000 })

      const res3 = parseTransactionSearchQuery('< 50rb makan siang warteg')
      expect(res3.textQuery).toBe('makan siang warteg')
      expect(res3.amountCondition).toEqual({ type: 'comp', op: '<', value: 25000 ? 50000 : 0 })
    })

    it('parses mixed text + range queries', () => {
      const res = parseTransactionSearchQuery('makan siang 20k - 50k')
      expect(res.textQuery).toBe('makan siang')
      expect(res.amountCondition).toEqual({ type: 'range', min: 20000, max: 50000 })
    })

    it('parses standalone single number or shorthand as exact amount condition', () => {
      expect(parseTransactionSearchQuery('50k')).toEqual({
        textQuery: '',
        amountCondition: { type: 'exact', value: 50000 },
        rawQuery: '50k',
      })

      expect(parseTransactionSearchQuery('50.000')).toEqual({
        textQuery: '',
        amountCondition: { type: 'exact', value: 50000 },
        rawQuery: '50.000',
      })

      expect(parseTransactionSearchQuery('2,5jt')).toEqual({
        textQuery: '',
        amountCondition: { type: 'exact', value: 2500000 },
        rawQuery: '2,5jt',
      })
    })

    it('preserves text with ordinary numbers when not formatted as amount or operator', () => {
      const res = parseTransactionSearchQuery('kamar 302 lantai 3')
      expect(res.textQuery).toBe('kamar 302 lantai 3')
      expect(res.amountCondition).toBeNull()
    })

    it('ignores currency prefixes such as Rp or $ gracefully', () => {
      const res1 = parseTransactionSearchQuery('> Rp 50.000')
      expect(res1.amountCondition).toEqual({ type: 'comp', op: '>', value: 50000 })

      const res2 = parseTransactionSearchQuery('Rp 50k - Rp 200k')
      expect(res2.amountCondition).toEqual({ type: 'range', min: 50000, max: 200000 })
    })
  })

  describe('matchesTransactionAmount', () => {
    it('returns true when amountCondition is null', () => {
      expect(matchesTransactionAmount({ amount: 50000 }, null)).toBe(true)
    })

    it('matches exact amounts correctly', () => {
      const cond = { type: 'exact', value: 50000 }
      expect(matchesTransactionAmount({ amount: 50000 }, cond)).toBe(true)
      expect(matchesTransactionAmount({ amount: -50000 }, cond)).toBe(true)
      expect(matchesTransactionAmount({ amount: 50001 }, cond)).toBe(false)
    })

    it('matches comparison operators correctly', () => {
      const gt100 = { type: 'comp', op: '>', value: 100000 }
      expect(matchesTransactionAmount({ amount: 120000 }, gt100)).toBe(true)
      expect(matchesTransactionAmount({ amount: 100000 }, gt100)).toBe(false)
      expect(matchesTransactionAmount({ amount: 80000 }, gt100)).toBe(false)

      const gte100 = { type: 'comp', op: '>=', value: 100000 }
      expect(matchesTransactionAmount({ amount: 100000 }, gte100)).toBe(true)

      const lt50 = { type: 'comp', op: '<', value: 50000 }
      expect(matchesTransactionAmount({ amount: 45000 }, lt50)).toBe(true)
      expect(matchesTransactionAmount({ amount: 50000 }, lt50)).toBe(false)

      const lte50 = { type: 'comp', op: '<=', value: 50000 }
      expect(matchesTransactionAmount({ amount: 50000 }, lte50)).toBe(true)

      const eq50 = { type: 'comp', op: '=', value: 50000 }
      expect(matchesTransactionAmount({ amount: 50000 }, eq50)).toBe(true)
      expect(matchesTransactionAmount({ amount: 49000 }, eq50)).toBe(false)
    })

    it('matches range conditions correctly', () => {
      const range = { type: 'range', min: 50000, max: 200000 }
      expect(matchesTransactionAmount({ amount: 50000 }, range)).toBe(true)
      expect(matchesTransactionAmount({ amount: 100000 }, range)).toBe(true)
      expect(matchesTransactionAmount({ amount: 200000 }, range)).toBe(true)
      expect(matchesTransactionAmount({ amount: 49999 }, range)).toBe(false)
      expect(matchesTransactionAmount({ amount: 200001 }, range)).toBe(false)
    })

    it('matches split transactions if parent OR child split items match condition', () => {
      const splitTx = {
        amount: 150000,
        isSplit: true,
        splitItems: [
          { amount: 50000, category: 'Makanan' },
          { amount: 100000, category: 'Transport' },
        ],
      }

      // Exact match against child split item
      expect(matchesTransactionAmount(splitTx, { type: 'exact', value: 50000 })).toBe(true)
      expect(matchesTransactionAmount(splitTx, { type: 'exact', value: 100000 })).toBe(true)
      expect(matchesTransactionAmount(splitTx, { type: 'exact', value: 150000 })).toBe(true)
      expect(matchesTransactionAmount(splitTx, { type: 'exact', value: 30000 })).toBe(false)

      // Comparison match against split items
      expect(matchesTransactionAmount(splitTx, { type: 'comp', op: '<=', value: 50000 })).toBe(true)
    })
  })

  describe('formatAmountConditionBadge', () => {
    it('formats badge label for comparison operators', () => {
      const label = formatAmountConditionBadge({ type: 'comp', op: '>', value: 100000 }, 'id-ID', 'IDR')
      expect(label).toContain('>')
      expect(label).toContain('100.000')
    })

    it('formats badge label for range conditions', () => {
      const label = formatAmountConditionBadge({ type: 'range', min: 50000, max: 200000 }, 'id-ID', 'IDR')
      expect(label).toContain('50.000')
      expect(label).toContain('200.000')
    })
  })
})
