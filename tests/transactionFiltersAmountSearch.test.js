import { describe, it, expect } from 'vitest'
import { computeFilteredTransactions } from '../src/hooks/useTransactionFilters'

describe('computeFilteredTransactions amount and operator search', () => {
  const sampleTransactions = [
    {
      id: 'tx1',
      date: '2026-10-10',
      category: 'Makanan & Minuman',
      subcategory: 'Kopi',
      notes: 'Kopi Kenangan Mantan',
      amount: 28000,
      type: 'expense',
      walletId: 'w1',
    },
    {
      id: 'tx2',
      date: '2026-10-11',
      category: 'Makanan & Minuman',
      subcategory: 'Restoran',
      notes: 'Makan Siang Steak',
      amount: 175000,
      type: 'expense',
      walletId: 'w1',
    },
    {
      id: 'tx3',
      date: '2026-10-12',
      category: 'Transportasi',
      subcategory: 'Bensin',
      notes: 'Bensin Pertamax',
      amount: 50000,
      type: 'expense',
      walletId: 'w1',
    },
    {
      id: 'tx4',
      date: '2026-10-13',
      category: 'Gaji',
      subcategory: 'Bulanan',
      notes: 'Transfer Gaji Kantor',
      amount: 15000000,
      type: 'income',
      walletId: 'w2',
    },
    {
      id: 'tx5',
      date: '2026-10-14',
      category: 'Belanja',
      subcategory: 'Supermarket',
      notes: 'Belanja Bulanan Superindo',
      amount: 350000,
      type: 'expense',
      walletId: 'w1',
      isSplit: true,
      splitItems: [
        { id: 'si1', category: 'Makanan & Minuman', notes: 'Snack & Kopi', amount: 80000 },
        { id: 'si2', category: 'Kebutuhan Rumah', notes: 'Deterjen & Sabun', amount: 270000 },
      ],
    },
  ]

  it('filters transactions by exact shorthand amount "50k"', () => {
    const results = computeFilteredTransactions(sampleTransactions, { search: '50k', startDate: '', endDate: '' })
    expect(results.map((tx) => tx.id)).toEqual(['tx3'])
  })

  it('filters transactions by exact dotted amount "50.000"', () => {
    const results = computeFilteredTransactions(sampleTransactions, { search: '50.000', startDate: '', endDate: '' })
    expect(results.map((tx) => tx.id)).toEqual(['tx3'])
  })

  it('filters transactions by comparison operator "> 100k"', () => {
    const results = computeFilteredTransactions(sampleTransactions, { search: '> 100k', startDate: '', endDate: '' })
    // tx4 (15jt), tx5 (350k total, 270k splitItem), tx2 (175k)
    expect(results.map((tx) => tx.id)).toEqual(['tx5', 'tx4', 'tx2'])
  })

  it('filters transactions by comparison operator "< 50k"', () => {
    const results = computeFilteredTransactions(sampleTransactions, { search: '< 50k', startDate: '', endDate: '' })
    expect(results.map((tx) => tx.id)).toEqual(['tx1'])
  })

  it('filters transactions by range "50k - 200k"', () => {
    const results = computeFilteredTransactions(sampleTransactions, { search: '50k - 200k', startDate: '', endDate: '' })
    // tx5 has split item 80k in range, tx3 (50k), tx2 (175k)
    expect(results.map((tx) => tx.id)).toEqual(['tx5', 'tx3', 'tx2'])
  })

  it('filters transactions by mixed query: text and operator "kopi > 20k"', () => {
    const results = computeFilteredTransactions(sampleTransactions, { search: 'kopi > 20k', startDate: '', endDate: '' })
    // tx5 has split item 'Snack & Kopi' with amount 80k (> 20k)
    // tx1 has 'Kopi Kenangan Mantan' with amount 28k (> 20k)
    expect(results.map((tx) => tx.id)).toEqual(['tx5', 'tx1'])
  })

  it('filters transactions by mixed query: text and operator with no match for text "steak > 500k"', () => {
    const results = computeFilteredTransactions(sampleTransactions, { search: 'steak > 500k', startDate: '', endDate: '' })
    expect(results).toEqual([])
  })

  it('preserves backwards compatibility for pure text searches "pertamax"', () => {
    const results = computeFilteredTransactions(sampleTransactions, { search: 'pertamax', startDate: '', endDate: '' })
    expect(results.map((tx) => tx.id)).toEqual(['tx3'])
  })
})
