import { describe, it, expect } from 'vitest'
import { extractMonetaryAmountFromText } from '../src/lib/ai/nlp/amountRules'
import { parseIndonesianFinancialText } from '../src/lib/ai/nlp/rules'

describe('Financial Modifiers (Discounts, Tax/PPN, and Compound Calculations)', () => {
  describe('Percentage Discounts', () => {
    it('applies percentage discount to base amount', () => {
      // 300,000 - 20% = 240,000
      expect(extractMonetaryAmountFromText('beli sepatu 300k diskon 20%')).toBe(240000)
      // 50,000 - 50% = 25,000
      expect(extractMonetaryAmountFromText('baju 50rb diskon 50%')).toBe(25000)
      // 1,000,000 - 10% = 900,000
      expect(extractMonetaryAmountFromText('jaket 1jt disc 10%')).toBe(900000)
    })
  })

  describe('Nominal Discounts', () => {
    it('applies fixed amount discount to base amount', () => {
      // 35,000 - 10,000 = 25,000
      expect(extractMonetaryAmountFromText('kopi 35k diskon 10k')).toBe(25000)
      // 100,000 - 15,000 = 85,000
      expect(extractMonetaryAmountFromText('makan 100rb potongan 15rb')).toBe(85000)
    })
  })

  describe('Taxes and PPN', () => {
    it('applies PPN / tax percentages to base amount', () => {
      // 100,000 + 11% = 111,000
      expect(extractMonetaryAmountFromText('belanja 100k ppn 11%')).toBe(111000)
      // 50,000 + 10% = 55,000
      expect(extractMonetaryAmountFromText('makan 50k plus pajak 10%')).toBe(55000)
    })
  })

  describe('Compound Multiplier + Discount', () => {
    it('applies multiplier then discount', () => {
      // 2 * 20,000 = 40,000 - 10% = 36,000
      expect(extractMonetaryAmountFromText('2 porsi nasi goreng @ 20k diskon 10%')).toBe(36000)
    })
  })

  describe('Integration with parseIndonesianFinancialText', () => {
    it('extracts correct final amount and clean notes', () => {
      const parsed = parseIndonesianFinancialText('beli sepatu 300k diskon 20% pake bca')
      expect(parsed.transactions[0].amount).toBe(240000)
      expect(parsed.transactions[0].notes).toBe('Sepatu')

      const parsedTax = parseIndonesianFinancialText('makan di solaria 100k plus pajak 10%')
      expect(parsedTax.transactions[0].amount).toBe(110000)
      expect(parsedTax.transactions[0].merchant).toBe('Solaria')
    })
  })
})
