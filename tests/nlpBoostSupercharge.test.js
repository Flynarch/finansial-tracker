import { describe, it, expect } from 'vitest'
import { parseIndonesianFinancialText } from '../src/lib/ai/nlp/rules'
import { parseIndonesianAmount } from '../src/lib/ai/nlp/amountRules'
import { extractTimeSlot, extractCleanSubjectEntity } from '../src/lib/ai/semanticSlotFiller'
import { parseTransferTransaction } from '../src/lib/ai/nlp/transferRules'

describe('NLP Boost & Quality Supercharge Test Suite', () => {
  const wallets = [
    { id: 1, name: 'BCA', currency: 'IDR', institutionType: 'bank' },
    { id: 2, name: 'Mandiri', currency: 'IDR', institutionType: 'bank' },
    { id: 3, name: 'GoPay', currency: 'IDR', institutionType: 'e-wallet' },
    { id: 4, name: 'Dompet Tunai', currency: 'IDR', institutionType: 'cash' },
  ]

  describe('1. Universal Scope Multi-Clause Wallet Binding', () => {
    it('binds Mandiri to both clauses and cleans "semuanya" from notes for "mixue 10k, bakso 10k pakai mandiri semuanya"', () => {
      const text = 'mixue 10k, bakso 10k pakai mandiri semuanya'
      const result = parseIndonesianFinancialText(text, wallets, 'IDR')

      expect(result).not.toBeNull()
      expect(result.transactions).toHaveLength(2)

      const [tx1, tx2] = result.transactions
      expect(tx1.amount).toBe(10000)
      expect(tx1.walletId).toBe(2) // Mandiri
      expect(tx1.notes.toLowerCase()).toBe('mixue')

      expect(tx2.amount).toBe(10000)
      expect(tx2.walletId).toBe(2) // Mandiri
      expect(tx2.notes.toLowerCase()).toBe('bakso')
    })

    it('binds universal wallet with "semua" and "keduanya"', () => {
      const text = 'kopi 15k dan roti 10k pake gopay semua'
      const result = parseIndonesianFinancialText(text, wallets, 'IDR')

      expect(result).not.toBeNull()
      expect(result.transactions).toHaveLength(2)
      expect(result.transactions[0].walletId).toBe(3) // GoPay
      expect(result.transactions[1].walletId).toBe(3) // GoPay
      expect(result.transactions[1].notes.toLowerCase()).toBe('roti')
    })
  })

  describe('2. Third-Party Transfer Disambiguation & Admin Fees', () => {
    it('parses transfer to external contact as expense from source wallet', () => {
      const text = 'transfer 100k ke Budi pakai BCA'
      const result = parseIndonesianFinancialText(text, wallets, 'IDR')

      expect(result).not.toBeNull()
      expect(result.transactions).toHaveLength(1)
      const tx = result.transactions[0]
      expect(tx.type).toBe('expense')
      expect(tx.amount).toBe(100000)
      expect(tx.walletId).toBe(1) // BCA
      expect(tx.category).toBe('transfer/keluar')
      expect(tx.notes).toBe('Transfer ke Budi')
      expect(tx.merchant).toBe('Budi')
    })

    it('adds admin fee to total transfer expense and records in notes', () => {
      const text = 'transfer 500k ke rekening Ibu biaya admin 2500 pakai Mandiri'
      const result = parseIndonesianFinancialText(text, wallets, 'IDR')

      expect(result).not.toBeNull()
      expect(result.transactions).toHaveLength(1)
      const tx = result.transactions[0]
      expect(tx.type).toBe('expense')
      expect(tx.amount).toBe(502500)
      expect(tx.walletId).toBe(2) // Mandiri
      expect(tx.notes).toContain('Transfer ke Ibu')
      expect(tx.notes).toContain('biaya admin')
    })

    it('handles direct parseTransferTransaction to external recipient with 1 wallet', () => {
      const singleWallet = [{ id: 5, name: 'BCA', currency: 'IDR' }]
      const result = parseTransferTransaction('transfer 50rb ke Andi', singleWallet, 'IDR')

      expect(result).not.toBeNull()
      expect(result.error).toBeUndefined()
      expect(result.transactions[0].type).toBe('expense')
      expect(result.transactions[0].notes).toBe('Transfer ke Andi')
    })
  })

  describe('3. Income Inversion Prevention', () => {
    it('keeps purchases of gifts and kado as expense', () => {
      const text = 'beli kado 100k pakai bca'
      const result = parseIndonesianFinancialText(text, wallets, 'IDR')

      expect(result).not.toBeNull()
      const tx = result.transactions[0]
      expect(tx.type).toBe('expense')
      expect(tx.amount).toBe(100000)
      expect(tx.category).toBe('kehidupan_sosial/kondangan')
      expect(tx.notes.toLowerCase()).toBe('kado')
    })

    it('keeps orders with cashback as expense with net deduction', () => {
      const text = 'order gofood 60k dapet cashback 10k pakai gopay'
      const result = parseIndonesianFinancialText(text, wallets, 'IDR')

      expect(result).not.toBeNull()
      const tx = result.transactions[0]
      expect(tx.type).toBe('expense')
      expect(tx.amount).toBe(50000) // 60k - 10k
      expect(tx.walletId).toBe(3) // GoPay
    })

    it('recognizes genuine gift income when received', () => {
      const text = 'dapet kado uang 200k dari paman'
      const result = parseIndonesianFinancialText(text, wallets, 'IDR')

      expect(result).not.toBeNull()
      const tx = result.transactions[0]
      expect(tx.type).toBe('income')
      expect(tx.amount).toBe(200000)
      expect(tx.category).toBe('bonus/hadiah')
    })
  })

  describe('4. Thousand Comma Truncation & Digits Preservation', () => {
    it('parses comma-separated thousands integer correctly without truncating', () => {
      const amt1 = parseIndonesianAmount('50,000')
      expect(amt1).toBe(50000)

      const amt2 = parseIndonesianAmount('Rp 150,000')
      expect(amt2).toBe(150000)

      const result = parseIndonesianFinancialText('makan padang 50,000', wallets, 'IDR')
      expect(result).not.toBeNull()
      expect(result.transactions[0].amount).toBe(50000)
    })
  })

  describe('5. Digital Product Brand Name Preservation', () => {
    it('preserves brand name in digital product notes (does not strip without preposition)', () => {
      const sub1 = extractCleanSubjectEntity('beli paketan telkomsel 50k', { txType: 'expense', merchant: 'Telkomsel' })
      expect(sub1.toLowerCase()).toContain('paketan telkomsel')

      const sub2 = extractCleanSubjectEntity('token pln 100k', { txType: 'expense', merchant: 'PLN' })
      expect(sub2.toLowerCase()).toContain('token pln')
    })

    it('strips merchant only when preceded by preposition di/outlet/cabang', () => {
      const sub = extractCleanSubjectEntity('kopi susu di starbucks 45k', { txType: 'expense', merchant: 'Starbucks' })
      expect(sub.toLowerCase()).toBe('kopi susu')
      expect(sub.toLowerCase()).not.toContain('starbucks')
    })
  })

  describe('6. Surcharges & Modifiers', () => {
    it('applies plus ongkir surcharge', () => {
      const result = parseIndonesianFinancialText('mie ayam 15k plus ongkir 10rb', wallets, 'IDR')
      expect(result).not.toBeNull()
      expect(result.transactions[0].amount).toBe(25000)
    })

    it('applies service charge', () => {
      const result = parseIndonesianFinancialText('makan malam 100k service 10k', wallets, 'IDR')
      expect(result).not.toBeNull()
      expect(result.transactions[0].amount).toBe(110000)
    })
  })

  describe('7. Conversational Chat Slang & Nominal Slang', () => {
    it('normalizes chat slang bli, mkn, pke', () => {
      const result = parseIndonesianFinancialText('bli mkn 20k pke mandiri', wallets, 'IDR')
      expect(result).not.toBeNull()
      expect(result.transactions[0].amount).toBe(20000)
      expect(result.transactions[0].walletId).toBe(2) // Mandiri
    })

    it('parses goban, gopit, and seceng go slang nominals', () => {
      expect(parseIndonesianAmount('goban')).toBe(50000)
      expect(parseIndonesianAmount('gopit')).toBe(500000)
      expect(parseIndonesianAmount('seceng go')).toBe(1500)
    })

    it('parses verbal decimals like dua koma lima juta', () => {
      expect(parseIndonesianAmount('dua koma lima juta')).toBe(2500000)
      expect(parseIndonesianAmount('satu koma lima juta')).toBe(1500000)
    })
  })

  describe('8. Prayer Times & Category Synonyms', () => {
    it('resolves prayer times accurately', () => {
      const maghrib = extractTimeSlot('makan bakso 25k pas maghrib')
      expect(maghrib).not.toBeNull()
      expect(maghrib.timeStr).toBe('18:15')

      const ashar = extractTimeSlot('ngopi 20k pas ashar')
      expect(ashar).not.toBeNull()
      expect(ashar.timeStr).toBe('15:30')

      const dzuhur = extractTimeSlot('makan siang 30k waktu dzuhur')
      expect(dzuhur).not.toBeNull()
      expect(dzuhur.timeStr).toBe('12:15')

      const isya = extractTimeSlot('beli martabak 35k sehabis isya')
      expect(isya).not.toBeNull()
      expect(isya.timeStr).toBe('19:30')
    })

    it('categorizes ngopi as makanan/kopi and malem as makanan/makan_malam', () => {
      const resKopi = parseIndonesianFinancialText('ngopi 20k', wallets, 'IDR')
      expect(resKopi).not.toBeNull()
      expect(resKopi.transactions[0].category).toBe('makanan/kopi')

      const resMalem = parseIndonesianFinancialText('makan malem 35k', wallets, 'IDR')
      expect(resMalem).not.toBeNull()
      expect(resMalem.transactions[0].category).toBe('makanan/makan_malam')
    })
  })
})
