import { describe, it, expect } from 'vitest'
import { parseIndonesianFinancialText } from '../src/lib/ai/nlp/rules'
import { extractVenueSlot, extractCleanSubjectEntity } from '../src/lib/ai/semanticSlotFiller'
import { KNOWN_MERCHANT_SERVICES } from '../src/lib/ai/nlp/lexicon'

describe('Indonesian Lexicon Expansion & Preposition Disambiguation', () => {
  describe('Expanded Merchant Services in KNOWN_MERCHANT_SERVICES', () => {
    it('contains at least 65 curated Indonesian merchants and brands', () => {
      expect(KNOWN_MERCHANT_SERVICES.length).toBeGreaterThanOrEqual(65)
    })

    it('identifies top F&B merchants (Mie Gacoan, HokBen, Richeese, Mixue, Fore)', () => {
      const gacoan = parseIndonesianFinancialText('mie gacoan level 3 25k')
      expect(gacoan.transactions[0].merchant).toBe('Mie Gacoan')
      expect(gacoan.transactions[0].category).toContain('makan')

      const hokben = parseIndonesianFinancialText('makan hokben paket c 60k')
      expect(hokben.transactions[0].merchant).toBe('HokBen')

      const richeese = parseIndonesianFinancialText('combo richeese 45k')
      expect(richeese.transactions[0].merchant).toBe('Richeese Factory')

      const mixue = parseIndonesianFinancialText('mixue boba sundae 16k')
      expect(mixue.transactions[0].merchant).toBe('Mixue')

      const fore = parseIndonesianFinancialText('kopi pandan di fore 35k')
      expect(fore.transactions[0].merchant).toBe('Fore Coffee')
    })

    it('identifies E-Commerce and Digital Services (Shopee, Tokopedia, Netflix, Spotify)', () => {
      const shopee = parseIndonesianFinancialText('checkout shopee 150k')
      expect(shopee.transactions[0].merchant).toBe('Shopee')

      const tokped = parseIndonesianFinancialText('beli casing hp di tokped 45k')
      expect(tokped.transactions[0].merchant).toBe('Tokopedia')

      const netflix = parseIndonesianFinancialText('langganan netflix 186k')
      expect(netflix.transactions[0].merchant).toBe('Netflix')

      const spotify = parseIndonesianFinancialText('bayar spotify premium 55k')
      expect(spotify.transactions[0].merchant).toBe('Spotify')
    })

    it('identifies Health, Utilities, and Transportation (Kimia Farma, Halodoc, PLN, Shell)', () => {
      const kf = parseIndonesianFinancialText('beli obat flu di kimia farma 35k')
      expect(kf.transactions[0].merchant).toBe('Kimia Farma')

      const pln = parseIndonesianFinancialText('beli token pln 100k')
      expect(pln.transactions[0].merchant).toBe('PLN')

      const shell = parseIndonesianFinancialText('isi bensin shell vpower 150k')
      expect(shell.transactions[0].merchant).toBe('Shell')
    })
  })

  describe('Preposition Disambiguation (di [Merchant] vs beli [Item])', () => {
    it('correctly maps venue to merchant and purchased good to notes', () => {
      const parsed1 = parseIndonesianFinancialText('beli sabun mandi di alfamart 25k')
      expect(parsed1.transactions[0].merchant).toBe('Alfamart')
      expect(parsed1.transactions[0].notes).toBe('Sabun Mandi')

      const parsed2 = parseIndonesianFinancialText('beli martabak manis di warung bu siti 35k')
      expect(parsed2.transactions[0].merchant).toBe('Warung Bu Siti')
      expect(parsed2.transactions[0].notes).toBe('Martabak Manis')

      const parsed3 = parseIndonesianFinancialText('makan soto ayam di cak har 25k')
      expect(parsed3.transactions[0].merchant).toBe('Cak Har')
      expect(parsed3.transactions[0].notes).toBe('Soto Ayam')
    })

    it('extractVenueSlot isolates di [Merchant] without consuming the verb', () => {
      const venue = extractVenueSlot('beli kopi susu di Kopi Kenangan 20k', KNOWN_MERCHANT_SERVICES)
      expect(venue).not.toBeNull()
      expect(venue.merchant).toBe('Kopi Kenangan')

      const cleanSub = extractCleanSubjectEntity('beli kopi susu di Kopi Kenangan 20k', {
        merchant: venue.merchant,
      })
      expect(cleanSub).toBe('Kopi Susu')
    })
  })
})
