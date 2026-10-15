import { describe, it, expect } from 'vitest'
import { format, subDays, addDays, subMonths } from 'date-fns'
import { extractDateFromPhrase } from '../src/lib/ai/nlp/dateRules'
import { extractTimeSlot } from '../src/lib/ai/semanticSlotFiller'
import { parseIndonesianFinancialText } from '../src/lib/ai/nlp/rules'

describe('Dynamic Relative Dates & Contextual Time Slots', () => {
  const ref = new Date('2026-10-14T15:30:00')

  describe('extractDateFromPhrase - Dynamic Days, Weeks, Months', () => {
    it('parses dynamic N hari lalu (digits and words)', () => {
      const res3 = extractDateFromPhrase('beli makan 3 hari lalu', ref)
      expect(res3).not.toBeNull()
      expect(res3.dateStr).toBe(format(subDays(ref, 3), 'yyyy-MM-dd'))

      const res5 = extractDateFromPhrase('bayar bensin 5 hari lalu', ref)
      expect(res5).not.toBeNull()
      expect(res5.dateStr).toBe(format(subDays(ref, 5), 'yyyy-MM-dd'))

      const resTiga = extractDateFromPhrase('kopi 25k tiga hari lalu', ref)
      expect(resTiga).not.toBeNull()
      expect(resTiga.dateStr).toBe(format(subDays(ref, 3), 'yyyy-MM-dd'))

      const resEmpat = extractDateFromPhrase('jajan 15k empat hari lalu', ref)
      expect(resEmpat).not.toBeNull()
      expect(resEmpat.dateStr).toBe(format(subDays(ref, 4), 'yyyy-MM-dd'))
    })

    it('parses seminggu lalu and N minggu lalu', () => {
      const res1w = extractDateFromPhrase('servis laptop seminggu lalu', ref)
      expect(res1w).not.toBeNull()
      expect(res1w.dateStr).toBe(format(subDays(ref, 7), 'yyyy-MM-dd'))

      const res1wDigit = extractDateFromPhrase('servis laptop 1 minggu lalu', ref)
      expect(res1wDigit).not.toBeNull()
      expect(res1wDigit.dateStr).toBe(format(subDays(ref, 7), 'yyyy-MM-dd'))

      const res2w = extractDateFromPhrase('ganti oli 2 minggu lalu', ref)
      expect(res2w).not.toBeNull()
      expect(res2w.dateStr).toBe(format(subDays(ref, 14), 'yyyy-MM-dd'))

      const resDuaMinggu = extractDateFromPhrase('ganti oli dua minggu lalu', ref)
      expect(resDuaMinggu).not.toBeNull()
      expect(resDuaMinggu.dateStr).toBe(format(subDays(ref, 14), 'yyyy-MM-dd'))
    })

    it('parses sebulan lalu', () => {
      const res1m = extractDateFromPhrase('bayar hosting sebulan lalu', ref)
      expect(res1m).not.toBeNull()
      expect(res1m.dateStr).toBe(format(subMonths(ref, 1), 'yyyy-MM-dd'))
    })

    it('parses dynamic future days like N hari lagi and seminggu lagi', () => {
      const res3ahead = extractDateFromPhrase('tagihan wifi 3 hari lagi', ref)
      expect(res3ahead).not.toBeNull()
      expect(res3ahead.dateStr).toBe(format(addDays(ref, 3), 'yyyy-MM-dd'))

      const res1wAhead = extractDateFromPhrase('jatuh tempo seminggu lagi', ref)
      expect(res1wAhead).not.toBeNull()
      expect(res1wAhead.dateStr).toBe(format(addDays(ref, 7), 'yyyy-MM-dd'))
    })
  })

  describe('extractTimeSlot - Contextual Time Slots', () => {
    it('parses contextual time slots paired with relative days', () => {
      const sore = extractTimeSlot('makan bakso kemarin sore', ref)
      expect(sore).not.toBeNull()
      expect(sore.timeStr).toBe('17:00')

      const malam = extractTimeSlot('beli martabak kemarin malam', ref)
      expect(malam).not.toBeNull()
      expect(malam.timeStr).toBe('20:00')

      const pagi = extractTimeSlot('bubur ayam senin pagi', ref)
      expect(pagi).not.toBeNull()
      expect(pagi.timeStr).toBe('07:30')

      const siang = extractTimeSlot('nasi padang tadi siang', ref)
      expect(siang).not.toBeNull()
      expect(siang.timeStr).toBe('12:30')
    })
  })

  describe('Integration with parseIndonesianFinancialText', () => {
    it('sets correct date and time in parsed transaction', () => {
      const parsed = parseIndonesianFinancialText('makan siang padang 30k 3 hari lalu', [], 'IDR', ref)
      expect(parsed.transactions[0].amount).toBe(30000)
      expect(parsed.transactions[0].date).toBe(format(subDays(ref, 3), 'yyyy-MM-dd'))

      const parsedMalam = parseIndonesianFinancialText('beli martabak 45k kemarin malam', [], 'IDR', ref)
      expect(parsedMalam.transactions[0].amount).toBe(45000)
      expect(parsedMalam.transactions[0].date).toBe(format(subDays(ref, 1), 'yyyy-MM-dd'))
      expect(parsedMalam.transactions[0].time).toBe('20:00')
    })
  })
})
