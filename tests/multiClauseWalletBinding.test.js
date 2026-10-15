import { describe, it, expect } from 'vitest'
import { parseIndonesianFinancialText, parseMultiClauseTransactions } from '../src/lib/ai/nlp/rules'

describe('Multi-Clause Independent Wallet Binding', () => {
  const wallets = [
    { id: 10, name: 'BCA', currency: 'IDR', institutionType: 'bank' },
    { id: 20, name: 'GoPay', currency: 'IDR', institutionType: 'e-wallet' },
    { id: 30, name: 'OVO', currency: 'IDR', institutionType: 'e-wallet' },
    { id: 99, name: 'Dompet Tunai', currency: 'IDR', institutionType: 'cash' },
  ]

  it('binds independent wallets to respective clauses in a compound sentence', () => {
    const text = 'kopi 25k pake gopay dan belanja 100k pake bca'
    const result = parseIndonesianFinancialText(text, wallets, 'IDR')

    expect(result).not.toBeNull()
    expect(result.transactions).toHaveLength(2)

    // Clause 1: Kopi 25k -> GoPay (id 20)
    expect(result.transactions[0].amount).toBe(25000)
    expect(result.transactions[0].walletId).toBe(20)

    // Clause 2: Belanja 100k -> BCA (id 10)
    expect(result.transactions[1].amount).toBe(100000)
    expect(result.transactions[1].walletId).toBe(10)
  })

  it('binds 3 distinct wallets across 3 clauses', () => {
    const text = 'sarapan 20k pake ovo, makan siang 40k pake gopay, terus makan malam 50k pake bca'
    const result = parseIndonesianFinancialText(text, wallets, 'IDR')

    expect(result).not.toBeNull()
    expect(result.transactions).toHaveLength(3)

    expect(result.transactions[0].walletId).toBe(30) // OVO
    expect(result.transactions[1].walletId).toBe(20) // GoPay
    expect(result.transactions[2].walletId).toBe(10) // BCA
  })

  it('keeps default wallet for clause without explicit wallet when sibling clause has explicit wallet', () => {
    const text = 'beli kopi 25k pake gopay dan makan siang padang 30rb'
    const result = parseIndonesianFinancialText(text, wallets, 'IDR')

    expect(result).not.toBeNull()
    expect(result.transactions).toHaveLength(2)

    // Clause 1 has explicit GoPay
    expect(result.transactions[0].walletId).toBe(20)

    // Clause 2 has no explicit wallet, falls back to default wallet (first or default id 10)
    // and does NOT inherit GoPay from clause 1
    expect(result.transactions[1].walletId).not.toBe(20)
  })
})
