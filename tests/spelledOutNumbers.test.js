import { describe, it, expect } from 'vitest'
import {
  parseSpelledOutIndonesianNumber,
  extractSpelledOutAmountFromText,
} from '../src/lib/ai/nlp/spelledOutNumbers'
import { parseIndonesianAmount, extractMonetaryAmountFromText } from '../src/lib/ai/nlp/amountRules'

describe('Indonesian Spelled-out Numbers & Fractions Parser', () => {
  describe('parseSpelledOutIndonesianNumber', () => {
    it('parses single units and teens', () => {
      expect(parseSpelledOutIndonesianNumber('satu')).toBe(1)
      expect(parseSpelledOutIndonesianNumber('dua')).toBe(2)
      expect(parseSpelledOutIndonesianNumber('tiga')).toBe(3)
      expect(parseSpelledOutIndonesianNumber('delapan')).toBe(8)
      expect(parseSpelledOutIndonesianNumber('sepuluh')).toBe(10)
      expect(parseSpelledOutIndonesianNumber('sebelas')).toBe(11)
      expect(parseSpelledOutIndonesianNumber('dua belas')).toBe(12)
      expect(parseSpelledOutIndonesianNumber('lima belas')).toBe(15)
      expect(parseSpelledOutIndonesianNumber('sembilan belas')).toBe(19)
    })

    it('parses tens and hundreds', () => {
      expect(parseSpelledOutIndonesianNumber('dua puluh')).toBe(20)
      expect(parseSpelledOutIndonesianNumber('dua puluh lima')).toBe(25)
      expect(parseSpelledOutIndonesianNumber('tujuh puluh lima')).toBe(75)
      expect(parseSpelledOutIndonesianNumber('seratus')).toBe(100)
      expect(parseSpelledOutIndonesianNumber('seratus lima puluh')).toBe(150)
      expect(parseSpelledOutIndonesianNumber('dua ratus lima puluh')).toBe(250)
      expect(parseSpelledOutIndonesianNumber('tujuh ratus lima puluh')).toBe(750)
    })

    it('parses thousands correctly', () => {
      expect(parseSpelledOutIndonesianNumber('seribu')).toBe(1000)
      expect(parseSpelledOutIndonesianNumber('dua ribu')).toBe(2000)
      expect(parseSpelledOutIndonesianNumber('lima ribu')).toBe(5000)
      expect(parseSpelledOutIndonesianNumber('sepuluh ribu')).toBe(10000)
      expect(parseSpelledOutIndonesianNumber('dua puluh lima ribu')).toBe(25000)
      expect(parseSpelledOutIndonesianNumber('lima puluh ribu')).toBe(50000)
      expect(parseSpelledOutIndonesianNumber('seratus ribu')).toBe(100000)
      expect(parseSpelledOutIndonesianNumber('seratus lima puluh ribu')).toBe(150000)
      expect(parseSpelledOutIndonesianNumber('tiga ratus tujuh puluh lima ribu')).toBe(375000)
    })

    it('parses millions and billions correctly', () => {
      expect(parseSpelledOutIndonesianNumber('sejuta')).toBe(1000000)
      expect(parseSpelledOutIndonesianNumber('satu juta')).toBe(1000000)
      expect(parseSpelledOutIndonesianNumber('dua juta')).toBe(2000000)
      expect(parseSpelledOutIndonesianNumber('dua juta lima ratus ribu')).toBe(2500000)
      expect(parseSpelledOutIndonesianNumber('sepuluh juta')).toBe(10000000)
      expect(parseSpelledOutIndonesianNumber('satu miliar')).toBe(1000000000)
      expect(parseSpelledOutIndonesianNumber('semiliar')).toBe(1000000000)
    })

    it('parses Indonesian fractions like setengah juta, seperempat juta, satu setengah juta', () => {
      expect(parseSpelledOutIndonesianNumber('setengah juta')).toBe(500000)
      expect(parseSpelledOutIndonesianNumber('seperempat juta')).toBe(250000)
      expect(parseSpelledOutIndonesianNumber('tiga perempat juta')).toBe(750000)
      expect(parseSpelledOutIndonesianNumber('satu setengah juta')).toBe(1500000)
      expect(parseSpelledOutIndonesianNumber('dua setengah juta')).toBe(2500000)
      expect(parseSpelledOutIndonesianNumber('setengah miliar')).toBe(500000000)
      expect(parseSpelledOutIndonesianNumber('setengah rebu')).toBe(500)
      expect(parseSpelledOutIndonesianNumber('setengah ribu')).toBe(500)
    })

    it('parses colloquial variations such as rebu, rebo, jeti', () => {
      expect(parseSpelledOutIndonesianNumber('lima puluh rebu')).toBe(50000)
      expect(parseSpelledOutIndonesianNumber('dua puluh lima rebo')).toBe(25000)
      expect(parseSpelledOutIndonesianNumber('satu jeti')).toBe(1000000)
      expect(parseSpelledOutIndonesianNumber('dua jeti')).toBe(2000000)
    })

    it('returns 0 for unrecognized words', () => {
      expect(parseSpelledOutIndonesianNumber('makan siang')).toBe(0)
      expect(parseSpelledOutIndonesianNumber('')).toBe(0)
      expect(parseSpelledOutIndonesianNumber(null)).toBe(0)
    })
  })

  describe('extractSpelledOutAmountFromText', () => {
    it('extracts spelled-out nominals inside natural Indonesian sentences', () => {
      const res1 = extractSpelledOutAmountFromText('beli kopi dua puluh lima ribu tadi pagi')
      expect(res1).not.toBeNull()
      expect(res1.amount).toBe(25000)
      expect(res1.matchedText).toBe('dua puluh lima ribu')

      const res2 = extractSpelledOutAmountFromText('bayar kosan satu setengah juta pake bca')
      expect(res2).not.toBeNull()
      expect(res2.amount).toBe(1500000)
      expect(res2.matchedText).toBe('satu setengah juta')

      const res3 = extractSpelledOutAmountFromText('dapet uang saku lima puluh rebu')
      expect(res3).not.toBeNull()
      expect(res3.amount).toBe(50000)
      expect(res3.matchedText).toBe('lima puluh rebu')
    })
  })

  describe('Integration with amountRules.js', () => {
    it('parseIndonesianAmount handles spelled-out numbers and slang suffixes', () => {
      expect(parseIndonesianAmount('dua puluh lima ribu')).toBe(25000)
      expect(parseIndonesianAmount('setengah juta')).toBe(500000)
      expect(parseIndonesianAmount('50 rebu')).toBe(50000)
      expect(parseIndonesianAmount('25 rebo')).toBe(25000)
      expect(parseIndonesianAmount('1.5 jeti')).toBe(1500000)
    })

    it('extractMonetaryAmountFromText parses sentences with spelled out amounts', () => {
      expect(extractMonetaryAmountFromText('beli makan dua puluh lima ribu')).toBe(25000)
      expect(extractMonetaryAmountFromText('bayar kontrakan dua juta lima ratus ribu')).toBe(2500000)
      expect(extractMonetaryAmountFromText('bensin 50 rebu pake gopay')).toBe(50000)
    })
  })
})
