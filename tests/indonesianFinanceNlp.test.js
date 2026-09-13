import { describe, it, expect } from 'vitest'
import {
  normalizeIndonesianNlpText,
  getRecentPastDayDate,
  parseIndonesianAmount,
  extractMonetaryAmountFromText,
  extractMerchantAndCategory,
  parseIndonesianFinancialText,
} from '../src/lib/ai/indonesianFinanceNlp'
import { parseShortTransactionFast } from '../src/lib/gemini'
import { sanitizeCategoryPath } from '../src/lib/categorySanitizer'

describe('Indonesian Finance NLP Parser & Heuristics', () => {
  const mockWallets = [
    { id: 1, name: 'BCA Utama', currency: 'IDR' },
    { id: 2, name: 'GoPay', currency: 'IDR' },
    { id: 3, name: 'Cash Dompet', currency: 'IDR' },
  ]

  // Reference date: Monday, 14 September 2026
  const refDateMonday = new Date(2026, 8, 14, 10, 30, 0) // Month index 8 = September

  describe('User Screenshot Exact Scenario', () => {
    const userSentence = 'kemarin hari sabtu dan jumwt masing masing hwri habisin 10k buat maxim'

    it('successfully parses into two distinct transactions for Saturday and Friday', () => {
      const result = parseIndonesianFinancialText(userSentence, mockWallets, 'IDR', refDateMonday)

      expect(result).not.toBeNull()
      expect(result.type).toBe('transactions')
      expect(result.action).toBe('create')
      expect(result.transactions).toHaveLength(2)

      const [txSaturday, txFriday] = result.transactions

      // Transaction 1: Saturday 12 Sep 2026
      expect(txSaturday.date).toBe('2026-09-12')
      expect(txSaturday.amount).toBe(10000)
      expect(txSaturday.merchant).toBe('Maxim')
      expect(txSaturday.category).toBe('transportasi/ojol')
      expect(txSaturday.type).toBe('expense')
      expect(txSaturday.currency).toBe('IDR')

      // Transaction 2: Friday 11 Sep 2026
      expect(txFriday.date).toBe('2026-09-11')
      expect(txFriday.amount).toBe(10000)
      expect(txFriday.merchant).toBe('Maxim')
      expect(txFriday.category).toBe('transportasi/ojol')
      expect(txFriday.type).toBe('expense')
      expect(txFriday.currency).toBe('IDR')
    })

    it('works identically when invoked through parseShortTransactionFast', () => {
      const result = parseShortTransactionFast(userSentence, mockWallets, 'IDR', refDateMonday)

      expect(result).not.toBeNull()
      expect(result.transactions).toHaveLength(2)
      expect(result.merchant).toBe('Maxim')
      expect(result.transactions[0].date).toBe('2026-09-12')
      expect(result.transactions[1].date).toBe('2026-09-11')
      expect(result.transactions[0].category).toBe('transportasi/ojol')
    })

    it('ensures clean merchant naming without capturing sentence artifacts', () => {
      const result = parseIndonesianFinancialText(userSentence, mockWallets, 'IDR', refDateMonday)
      expect(result.merchant).toBe('Maxim')
      expect(result.transactions[0].merchant).toBe('Maxim')
      expect(result.transactions[0].notes).toBe('Maxim')
      expect(result.transactions[0].merchant).not.toContain('kemarin')
      expect(result.transactions[0].merchant).not.toContain('sabtu')
    })
  })

  describe('Edge Cases in Multi-day Parsing', () => {
    it('handles slang amounts like ceban in multi-day spending', () => {
      const text = 'kemarin hari sabtu dan jumwt masing masing hwri habisin ceban buat maxim'
      const result = parseIndonesianFinancialText(text, mockWallets, 'IDR', refDateMonday)
      expect(result).not.toBeNull()
      expect(result.transactions).toHaveLength(2)
      expect(result.transactions[0].amount).toBe(10000)
      expect(result.transactions[1].amount).toBe(10000)
    })

    it('guards against date numbers in sentence (e.g. 2 hari lalu) when extracting amount', () => {
      const text = 'kemarin 2 hari lalu sabtu dan jumat masing-masing habisin 10k buat maxim'
      const result = parseIndonesianFinancialText(text, mockWallets, 'IDR', refDateMonday)
      expect(result).not.toBeNull()
      expect(result.transactions).toHaveLength(2)
      expect(result.transactions[0].amount).toBe(10000)
      expect(result.transactions[1].amount).toBe(10000)
      expect(result.transactions[0].amount).not.toBe(2)
    })

    it('handles conjunction variations: "sama" and "&"', () => {
      const textSama = 'sabtu sama jumat masing masing 10k buat maxim'
      const resSama = parseIndonesianFinancialText(textSama, mockWallets, 'IDR', refDateMonday)
      expect(resSama).not.toBeNull()
      expect(resSama.transactions).toHaveLength(2)

      const textAmp = 'sabtu & jumat masing masing 10k buat maxim'
      const resAmp = parseIndonesianFinancialText(textAmp, mockWallets, 'IDR', refDateMonday)
      expect(resAmp).not.toBeNull()
      expect(resAmp.transactions).toHaveLength(2)
    })

    it('supports per-day specific amounts when specified', () => {
      const text = 'sabtu 20k dan jumat 15k buat maxim'
      const result = parseIndonesianFinancialText(text, mockWallets, 'IDR', refDateMonday)
      expect(result).not.toBeNull()
      expect(result.transactions).toHaveLength(2)
      expect(result.transactions[0].date).toBe('2026-09-12')
      expect(result.transactions[0].amount).toBe(20000)
      expect(result.transactions[1].date).toBe('2026-09-11')
      expect(result.transactions[1].amount).toBe(15000)
    })

    it('supports relative days: kemarin dan kemarin lusa', () => {
      const text = 'kemarin dan kemarin lusa masing masing 10k buat maxim'
      const result = parseIndonesianFinancialText(text, mockWallets, 'IDR', refDateMonday)
      expect(result).not.toBeNull()
      expect(result.transactions).toHaveLength(2)
      expect(result.transactions[0].date).toBe('2026-09-13')
      expect(result.transactions[1].date).toBe('2026-09-12')
    })
  })

  describe('Text Normalization & Typo Handling', () => {
    it('normalizes common Indonesian chat abbreviations and typos', () => {
      const raw = 'kmrn hwri sbtu dan jumwt masing masing hri ngabisin 15rb buat indrive'
      const normalized = normalizeIndonesianNlpText(raw)

      expect(normalized).toContain('kemarin')
      expect(normalized).toContain('hari')
      expect(normalized).toContain('sabtu')
      expect(normalized).toContain('jumat')
      expect(normalized).toContain('masing-masing')
      expect(normalized).toContain('habisin')
      expect(normalized).not.toContain('hwri')
      expect(normalized).not.toContain('jumwt')
      expect(normalized).not.toContain('sbtu')
      expect(normalized).not.toContain('kmrn')
    })
  })

  describe('Relative Date Resolution (getRecentPastDayDate)', () => {
    it('resolves Friday and Saturday relative to Monday correctly', () => {
      expect(getRecentPastDayDate(6, refDateMonday)).toBe('2026-09-12')
      expect(getRecentPastDayDate(5, refDateMonday)).toBe('2026-09-11')
      expect(getRecentPastDayDate(4, refDateMonday)).toBe('2026-09-10')
      expect(getRecentPastDayDate(0, refDateMonday)).toBe('2026-09-13')
      expect(getRecentPastDayDate(1, refDateMonday)).toBe('2026-09-14')
    })

    it('resolves past week when forcePastWeek is true', () => {
      // Monday relative to Monday with forcePastWeek = true -> 7 days ago
      expect(getRecentPastDayDate(1, refDateMonday, true)).toBe('2026-09-07')
    })

    it('resolves past days correctly when refDate is Sunday', () => {
      const refSunday = new Date(2026, 8, 13) // Sunday 13 Sep 2026
      expect(getRecentPastDayDate(6, refSunday)).toBe('2026-09-12')
      expect(getRecentPastDayDate(5, refSunday)).toBe('2026-09-11')
    })
  })

  describe('Amount Parsing (parseIndonesianAmount & extractMonetaryAmountFromText)', () => {
    it('parses k, rb, jt, and slang correctly', () => {
      expect(parseIndonesianAmount('10k')).toBe(10000)
      expect(parseIndonesianAmount('25rb')).toBe(25000)
      expect(parseIndonesianAmount('50ribu')).toBe(50000)
      expect(parseIndonesianAmount('1.5jt')).toBe(1500000)
      expect(parseIndonesianAmount('2,5 juta')).toBe(2500000)
      expect(parseIndonesianAmount('ceban')).toBe(10000)
      expect(parseIndonesianAmount('goceng')).toBe(5000)
      expect(parseIndonesianAmount('gocap')).toBe(50000)
      expect(parseIndonesianAmount('cepek')).toBe(100000)
    })

    it('extracts monetary amounts accurately from sentences', () => {
      expect(extractMonetaryAmountFromText('habisin 10k buat maxim')).toBe(10000)
      expect(extractMonetaryAmountFromText('habisin ceban buat gojek')).toBe(10000)
      expect(extractMonetaryAmountFromText('keluar 25rb di indomaret')).toBe(25000)
      expect(extractMonetaryAmountFromText('2 hari lalu beli kopi 15k')).toBe(15000)
    })
  })

  describe('Merchant & Category Extraction', () => {
    it('detects ride-hailing services and maps them to transportasi/ojol', () => {
      expect(extractMerchantAndCategory('habisin 10k buat maxim').category).toBe('transportasi/ojol')
      expect(extractMerchantAndCategory('habisin 10k buat maxim').merchant).toBe('Maxim')

      expect(extractMerchantAndCategory('naik gojek ke kantor').category).toBe('transportasi/ojol')
      expect(extractMerchantAndCategory('naik gojek ke kantor').merchant).toBe('Gojek')

      expect(extractMerchantAndCategory('order grab 15k').category).toBe('transportasi/ojol')
      expect(extractMerchantAndCategory('order grab 15k').merchant).toBe('Grab')

      expect(extractMerchantAndCategory('bayar indrive 20k').category).toBe('transportasi/ojol')
      expect(extractMerchantAndCategory('bayar indrive 20k').merchant).toBe('inDrive')
    })

    it('detects taxis and trains', () => {
      expect(extractMerchantAndCategory('naik bluebird ke bandara').category).toBe('transportasi/taksi')
      expect(extractMerchantAndCategory('naik krl commuterline').category).toBe('transportasi/kereta')
      expect(extractMerchantAndCategory('naik transjakarta busway').category).toBe('transportasi/bis')
    })
  })

  describe('Category Sanitizer Boundary Fixes (Regression Guard)', () => {
    it('does NOT categorize habisin as transportasi/bis', () => {
      const result = sanitizeCategoryPath('habisin 10k', 'expense')
      expect(result).not.toBe('transportasi/bis')
    })

    it('properly categorizes bis and bus only when whole words match', () => {
      expect(sanitizeCategoryPath('tiket bis antar kota', 'expense')).toBe('transportasi/bis')
      expect(sanitizeCategoryPath('naik bus damri', 'expense')).toBe('transportasi/bis')
      expect(sanitizeCategoryPath('habis belanja', 'expense')).not.toBe('transportasi/bis')
    })

    it('properly sanitizes pdam / air without false matching on other words', () => {
      expect(sanitizeCategoryPath('bayar air pdam', 'expense')).toBe('tagihan/air')
      expect(sanitizeCategoryPath('air conditioner', 'expense')).not.toBe('tagihan/air')
    })

    it('properly sanitizes e-toll and tol with boundary matching', () => {
      expect(sanitizeCategoryPath('isi saldo e-toll', 'expense')).toBe('transportasi/tol')
      expect(sanitizeCategoryPath('bayar tol cipularang', 'expense')).toBe('transportasi/tol')
    })

    it('properly sanitizes maxim and indrive to transportasi/ojol', () => {
      expect(sanitizeCategoryPath('maxim motor', 'expense')).toBe('transportasi/ojol')
      expect(sanitizeCategoryPath('indrive car', 'expense')).toBe('transportasi/ojol')
    })
  })

  describe('Non-Transaction Query Guards', () => {
    it('returns null for financial health questions so AI advisor can respond', () => {
      expect(parseIndonesianFinancialText('bagaimana kesehatan keuangan saya?')).toBeNull()
      expect(parseIndonesianFinancialText('analisis pengeluaran bulan ini')).toBeNull()
      expect(parseIndonesianFinancialText('siapa yang punya utang ke saya?')).toBeNull()
    })
  })
})
