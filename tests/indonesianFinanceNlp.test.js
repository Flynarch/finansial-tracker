import { describe, it, expect } from 'vitest'
import {
  normalizeIndonesianNlpText,
  getRecentPastDayDate,
  parseIndonesianAmount,
  extractMonetaryAmountFromText,
  extractMerchantAndCategory,
  parseIndonesianFinancialText,
  extractDateFromPhrase,
  maskDateExpressions,
  findWalletInText,
  parseMultiClauseTransactions,
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

  describe('Calendar Dates & Multi-Clause Transactions (Bug 2 Fix)', () => {
    const mockWalletsWithDana = [
      { id: 1, name: 'BCA Utama', currency: 'IDR' },
      { id: 2, name: 'GoPay', currency: 'IDR' },
      { id: 3, name: 'Cash Dompet', currency: 'IDR' },
      { id: 4, name: 'DANA', currency: 'IDR' },
    ]

    const exactPrompt = '9 september dapet uang saku 60k dan 12 sep 25k buat beli paketan (dana)'

    it('accurately parses exact user prompt into two distinct transactions with dates, types, and wallets', () => {
      const result = parseIndonesianFinancialText(exactPrompt, mockWalletsWithDana, 'IDR', refDateMonday)

      expect(result).not.toBeNull()
      expect(result.type).toBe('transactions')
      expect(result.action).toBe('create')
      expect(result.transactions).toHaveLength(2)

      const [txIncome, txExpense] = result.transactions

      // Transaction 1: 9 September 2026, Income Rp 60.000, Uang Saku
      expect(txIncome.date).toBe('2026-09-09')
      expect(txIncome.amount).toBe(60000)
      expect(txIncome.type).toBe('income')
      expect(txIncome.category).toBe('uang_jajan/uang_saku')
      expect(txIncome.notes).toMatch(/uang saku/i)
      expect(txIncome.merchant).toBeUndefined()

      // Transaction 2: 12 September 2026, Expense Rp 25.000, Paket Data, DANA wallet
      expect(txExpense.date).toBe('2026-09-12')
      expect(txExpense.amount).toBe(25000)
      expect(txExpense.type).toBe('expense')
      expect(txExpense.category).toBe('tagihan/paket_data')
      expect(txExpense.walletId).toBe(4)
      expect(txExpense.notes).toMatch(/paketan/i)
    })

    it('works seamlessly when called via parseShortTransactionFast', () => {
      const result = parseShortTransactionFast(exactPrompt, mockWalletsWithDana, 'IDR', refDateMonday)
      expect(result).not.toBeNull()
      expect(result.transactions).toHaveLength(2)
      expect(result.transactions[0].date).toBe('2026-09-09')
      expect(result.transactions[0].amount).toBe(60000)
      expect(result.transactions[0].type).toBe('income')
      expect(result.transactions[1].date).toBe('2026-09-12')
      expect(result.transactions[1].amount).toBe(25000)
      expect(result.transactions[1].type).toBe('expense')
      expect(result.transactions[1].walletId).toBe(4)
    })

    it('never captures calendar date day numbers as monetary amounts', () => {
      expect(extractMonetaryAmountFromText('9 september dapet uang saku 60k')).toBe(60000)
      expect(extractMonetaryAmountFromText('12 sep 25k buat beli paketan')).toBe(25000)
      expect(extractMonetaryAmountFromText('25 agustus bayar wifi 300k')).toBe(300000)
      expect(extractMonetaryAmountFromText('tanggal 10 okt beli sepatu 150k')).toBe(150000)
      expect(extractMonetaryAmountFromText('9 september')).toBe(0)
      expect(extractMonetaryAmountFromText('12 sep')).toBe(0)
    })

    it('extracts calendar dates accurately from various Indonesian formats', () => {
      expect(extractDateFromPhrase('9 september', refDateMonday)?.dateStr).toBe('2026-09-09')
      expect(extractDateFromPhrase('12 sep', refDateMonday)?.dateStr).toBe('2026-09-12')
      expect(extractDateFromPhrase('25 agustus 2026', refDateMonday)?.dateStr).toBe('2026-08-25')
      expect(extractDateFromPhrase('tanggal 10 okt', refDateMonday)?.dateStr).toBe('2026-10-10')
      expect(extractDateFromPhrase('15/09/2026', refDateMonday)?.dateStr).toBe('2026-09-15')
    })

    it('masks date expressions so date digits are never mistaken for amounts', () => {
      const masked = maskDateExpressions('9 september dapet uang saku 60k dan 12 sep 25k')
      expect(masked).not.toMatch(/\b9\b/)
      expect(masked).not.toMatch(/\b12\b/)
      expect(masked).toContain('60k')
      expect(masked).toContain('25k')
    })

    it('matches wallets by name, parenthesized name, and cash/tunai type', () => {
      expect(findWalletInText('beli paketan (dana)', mockWalletsWithDana, 1)).toBe(4)
      expect(findWalletInText('beli pulsa di dana', mockWalletsWithDana, 1)).toBe(4)
      expect(findWalletInText('bayar kosan pakai bca', mockWalletsWithDana, 1)).toBe(1)
      expect(findWalletInText('jajan kopi pakai cash', mockWalletsWithDana, 1)).toBe(3)
      expect(findWalletInText('jajan kopi tunai', mockWalletsWithDana, 1)).toBe(3)
      expect(findWalletInText('beli bakso tanpa dompet', mockWalletsWithDana, 1)).toBe(1)
    })

    it('prioritizes longer wallet names to prevent shorter names from shadowing (Regression Guard)', () => {
      // "BCA" is placed BEFORE "BCA Syariah" in array order
      const walletsWithShadowing = [
        { id: 1, name: 'BCA', currency: 'IDR' },
        { id: 2, name: 'BCA Syariah', currency: 'IDR' },
      ]
      // Should match BCA Syariah (id 2), not BCA (id 1)
      expect(findWalletInText('transfer ke bca syariah 500k', walletsWithShadowing, 1)).toBe(2)
      expect(findWalletInText('bayar bca 100k', walletsWithShadowing, 1)).toBe(1)
    })

    it('supports multiple clauses connected by lalu, terus, kemudian, serta', () => {
      const text = 'dapet gaji 5jt terus bayar kosan 1.5jt bca serta beli kopi 25rb gopay'
      const result = parseIndonesianFinancialText(text, mockWalletsWithDana, 'IDR', refDateMonday)

      expect(result).not.toBeNull()
      expect(result.transactions).toHaveLength(3)

      expect(result.transactions[0].type).toBe('income')
      expect(result.transactions[0].amount).toBe(5000000)
      expect(result.transactions[0].category).toBe('gaji/gaji_pokok')

      expect(result.transactions[1].type).toBe('expense')
      expect(result.transactions[1].amount).toBe(1500000)
      expect(result.transactions[1].walletId).toBe(1)

      expect(result.transactions[2].type).toBe('expense')
      expect(result.transactions[2].amount).toBe(25000)
      expect(result.transactions[2].walletId).toBe(2)
      expect(result.transactions[2].category).toBe('makanan/kopi')
    })

    it('tests parseMultiClauseTransactions helper directly', () => {
      const res = parseMultiClauseTransactions('gaji 5jt dan makan siang 30rb', mockWalletsWithDana, 'IDR', refDateMonday)
      expect(res).not.toBeNull()
      expect(res.transactions).toHaveLength(2)
      expect(res.transactions[0].amount).toBe(5000000)
      expect(res.transactions[1].amount).toBe(30000)
    })

    it('returns helpful error when multi-day sentence is missing nominal (Screenshot 1 scenario)', () => {
      const promptNoAmount = 'Kemarin hari sabtu dan jumwt masing masing hwri habisin (buat maxim)'
      const result = parseIndonesianFinancialText(promptNoAmount, mockWalletsWithDana, 'IDR', refDateMonday)
      expect(result).not.toBeNull()
      expect(result.error).toBe(true)
      expect(result.message).toMatch(/nominal/i)
      expect(result.message).toMatch(/sabtu/i)
      expect(result.message).toMatch(/jumat/i)
    })

    it('returns helpful error when explicit spending verb is used without monetary amount', () => {
      const promptNoAmount = 'Kemarin beli kopi di starbucks tapi lupa tulis harga'
      const result = parseIndonesianFinancialText(promptNoAmount, mockWalletsWithDana, 'IDR', refDateMonday)
      expect(result).not.toBeNull()
      expect(result.error).toBe(true)
      expect(result.message).toMatch(/nominal/i)
    })
  })

  describe('Transfer & Balance Movement Heuristic Parsing', () => {
    const transferWallets = [
      { id: 1, name: 'BCA', currency: 'IDR', institutionType: 'bank' },
      { id: 2, name: 'GoPay', currency: 'IDR', institutionType: 'e-wallet' },
      { id: 3, name: 'Dompet Tunai', currency: 'IDR', institutionType: 'cash' },
    ]

    it('parses transfer between two explicit wallets', () => {
      const res = parseIndonesianFinancialText('transfer 50rb dari bca ke gopay', transferWallets, 'IDR', refDateMonday)
      expect(res).not.toBeNull()
      expect(res.type).toBe('transactions')
      expect(res.transactions).toHaveLength(1)
      expect(res.transactions[0].type).toBe('transfer')
      expect(res.transactions[0].amount).toBe(50000)
      expect(res.transactions[0].walletId).toBe(1)
      expect(res.transactions[0].targetWalletId).toBe(2)
    })

    it('parses pindah saldo keyword', () => {
      const res = parseIndonesianFinancialText('pindah saldo 100k dari bca ke dompet tunai', transferWallets, 'IDR', refDateMonday)
      expect(res).not.toBeNull()
      expect(res.transactions[0].type).toBe('transfer')
      expect(res.transactions[0].amount).toBe(100000)
      expect(res.transactions[0].walletId).toBe(1)
      expect(res.transactions[0].targetWalletId).toBe(3)
    })

    it('parses tarik tunai keyword defaulting destination to cash wallet', () => {
      const res = parseIndonesianFinancialText('tarik tunai 200rb dari bca', transferWallets, 'IDR', refDateMonday)
      expect(res).not.toBeNull()
      expect(res.transactions[0].type).toBe('transfer')
      expect(res.transactions[0].amount).toBe(200000)
      expect(res.transactions[0].walletId).toBe(1)
      expect(res.transactions[0].targetWalletId).toBe(3)
    })

    it('parses top up keyword with target e-wallet and funding source', () => {
      const res = parseIndonesianFinancialText('top up gopay 50k dari bca', transferWallets, 'IDR', refDateMonday)
      expect(res).not.toBeNull()
      expect(res.transactions[0].type).toBe('transfer')
      expect(res.transactions[0].amount).toBe(50000)
      expect(res.transactions[0].walletId).toBe(1)
      expect(res.transactions[0].targetWalletId).toBe(2)
    })

    it('parses top up into multi-word wallet containing stop words', () => {
      const res = parseIndonesianFinancialText('top up dompet tunai 50k dari bca', transferWallets, 'IDR', refDateMonday)
      expect(res).not.toBeNull()
      expect(res.transactions[0].type).toBe('transfer')
      expect(res.transactions[0].amount).toBe(50000)
      expect(res.transactions[0].walletId).toBe(1)
      expect(res.transactions[0].targetWalletId).toBe(3)
    })

    it('parses top up funded from multi-word wallet', () => {
      const res = parseIndonesianFinancialText('top up gopay 50k pakai dompet tunai', transferWallets, 'IDR', refDateMonday)
      expect(res).not.toBeNull()
      expect(res.transactions[0].type).toBe('transfer')
      expect(res.transactions[0].amount).toBe(50000)
      expect(res.transactions[0].walletId).toBe(3)
      expect(res.transactions[0].targetWalletId).toBe(2)
    })

    it('parses simple transfer between multi-word wallets', () => {
      const res = parseIndonesianFinancialText('transfer bca ke dompet tunai 75k', transferWallets, 'IDR', refDateMonday)
      expect(res).not.toBeNull()
      expect(res.transactions[0].type).toBe('transfer')
      expect(res.transactions[0].amount).toBe(75000)
      expect(res.transactions[0].walletId).toBe(1)
      expect(res.transactions[0].targetWalletId).toBe(3)
    })

    it('returns error when transfer nominal is missing', () => {
      const res = parseIndonesianFinancialText('transfer dari bca ke gopay', transferWallets, 'IDR', refDateMonday)
      expect(res).not.toBeNull()
      expect(res.error).toBe(true)
      expect(res.message).toMatch(/nominal/i)
    })
  })

  describe('Category Sanitizer Fallback', () => {
    it('does not force makan_siang onto non-food expense categories', () => {
      const sanitizedTransport = sanitizeCategoryPath('transportasi', 'expense')
      expect(sanitizedTransport).not.toContain('makan_siang')
      expect(sanitizedTransport.startsWith('transportasi/')).toBe(true)

      const sanitizedHealth = sanitizeCategoryPath('kesehatan', 'expense')
      expect(sanitizedHealth).not.toContain('makan_siang')
      expect(sanitizedHealth.startsWith('kesehatan/')).toBe(true)
    })
  })

  describe('LOW-01 & MED-04: DANA Lookahead & Missing Nominal Income Interception', () => {
    const danaWallets = [
      { id: 1, name: 'BCA', currency: 'IDR' },
      { id: 2, name: 'DANA', currency: 'IDR' },
    ]

    it('does not match DANA wallet when conceptual phrase like dana darurat is used', () => {
      const res = parseIndonesianFinancialText('tabung ke dana darurat 500rb', danaWallets, 'IDR')
      expect(res).not.toBeNull()
      // Should NOT match DANA wallet (id: 2), should fallback to default (id: 1)
      expect(res.transactions[0].walletId).toBe(1)
    })

    it('does not match DANA wallet for dana pensiun or dana cadangan', () => {
      const resPensiun = parseIndonesianFinancialText('alokasi dana pensiun 1jt', danaWallets, 'IDR')
      expect(resPensiun).not.toBeNull()
      expect(resPensiun.transactions[0].walletId).toBe(1)

      const resCadangan = parseIndonesianFinancialText('simpan di dana cadangan 200rb', danaWallets, 'IDR')
      expect(resCadangan).not.toBeNull()
      expect(resCadangan.transactions[0].walletId).toBe(1)
    })

    it('correctly matches DANA wallet when used as payment method', () => {
      const res = parseIndonesianFinancialText('beli kopi 25rb pakai dana', danaWallets, 'IDR')
      expect(res).not.toBeNull()
      expect(res.transactions[0].walletId).toBe(2)
    })

    it('intercepts income verbs without amount and prompts user locally (MED-04)', () => {
      const gajiRes = parseIndonesianFinancialText('gaji bulanan', danaWallets, 'IDR')
      expect(gajiRes).not.toBeNull()
      expect(gajiRes.error).toBe(true)
      expect(gajiRes.message).toContain('Nominal transaksi belum disebutkan')

      const terimaRes = parseIndonesianFinancialText('terima uang', danaWallets, 'IDR')
      expect(terimaRes).not.toBeNull()
      expect(terimaRes.error).toBe(true)
      expect(terimaRes.message).toContain('Nominal transaksi belum disebutkan')

      const kirimanRes = parseIndonesianFinancialText('dapat kiriman', danaWallets, 'IDR')
      expect(kirimanRes).not.toBeNull()
      expect(kirimanRes.error).toBe(true)
      expect(kirimanRes.message).toContain('Nominal transaksi belum disebutkan')

      const sakuRes = parseIndonesianFinancialText('uang saku', danaWallets, 'IDR')
      expect(sakuRes).not.toBeNull()
      expect(sakuRes.error).toBe(true)
      expect(sakuRes.message).toContain('Nominal transaksi belum disebutkan')
    })
  })
})
