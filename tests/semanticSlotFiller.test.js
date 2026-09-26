import { describe, it, expect } from 'vitest'
import {
  levenshteinDistance,
  fuzzySimilarity,
  fuzzyFindBestMatch,
  extractTimeSlot,
  extractVenueSlot,
  extractQuantitySlot,
  extractCleanSubjectEntity,
  splitMultiItemSegments,
} from '../src/lib/ai/semanticSlotFiller'

describe('Semantic Slot Filler & Fuzzy Token Matcher', () => {
  describe('Levenshtein Distance & Fuzzy Matcher', () => {
    it('computes exact distance correctly', () => {
      expect(levenshteinDistance('matcha', 'matcha')).toBe(0)
      expect(levenshteinDistance('macha', 'matcha')).toBe(1)
      expect(levenshteinDistance('kemaren', 'kemarin')).toBe(1)
      expect(levenshteinDistance('sbtu', 'sabtu')).toBe(1)
      expect(levenshteinDistance('jumwt', 'jumat')).toBe(1)
    })

    it('computes fuzzy similarity ratio', () => {
      expect(fuzzySimilarity('matcha', 'matcha')).toBe(1)
      expect(fuzzySimilarity('macha', 'matcha')).toBeGreaterThan(0.8)
      expect(fuzzySimilarity('gopay', 'gopay')).toBe(1)
      expect(fuzzySimilarity('gopy', 'gopay')).toBe(0.8)
    })

    it('fuzzyFindBestMatch selects closest candidate above threshold', () => {
      const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']
      expect(fuzzyFindBestMatch('jumwt', days)?.match).toBe('jumat')
      expect(fuzzyFindBestMatch('sbtu', days)?.match).toBe('sabtu')
      expect(fuzzyFindBestMatch('senen', days)?.match).toBe('senin')
      expect(fuzzyFindBestMatch('xyz123', days)).toBeNull()
    })
  })

  describe('extractTimeSlot', () => {
    // Reference date: 15:00 in the afternoon
    const refAfternoon = new Date(2026, 8, 26, 15, 0, 0)

    it('extracts "jam 5" in afternoon context as 17:00', () => {
      const res = extractTimeSlot('tadi jam 5 beli matcha', refAfternoon)
      expect(res).not.toBeNull()
      expect(res?.timeStr).toBe('17:00')
    })

    it('extracts explicit "jam 5 sore" as 17:00', () => {
      const res = extractTimeSlot('beli matcha jam 5 sore', refAfternoon)
      expect(res?.timeStr).toBe('17:00')
    })

    it('extracts explicit "jam 7 pagi" as 07:00', () => {
      const res = extractTimeSlot('sarapan bubur jam 7 pagi', refAfternoon)
      expect(res?.timeStr).toBe('07:00')
    })

    it('extracts 24-hr timestamps like "jam 17.30"', () => {
      const res = extractTimeSlot('ngopi jam 17.30', refAfternoon)
      expect(res?.timeStr).toBe('17:30')
    })

    it('extracts Indonesian colloquial "jam setengah 6"', () => {
      const res = extractTimeSlot('beli matcha jam setengah 6', refAfternoon)
      expect(res?.timeStr).toBe('17:30')
    })

    it('extracts Indonesian colloquial "jam 5 kurang 15"', () => {
      const res = extractTimeSlot('beli matcha jam 5 kurang 15', refAfternoon)
      expect(res?.timeStr).toBe('16:45')
    })

    it('extracts fuzzy period "tadi sore" as 17:00', () => {
      const res = extractTimeSlot('tadi sore beli matcha 20k', refAfternoon)
      expect(res?.timeStr).toBe('17:00')
    })

    it('extracts fuzzy period "tadi siang" as 12:30', () => {
      const res = extractTimeSlot('tadi siang makan padang 25k', refAfternoon)
      expect(res?.timeStr).toBe('12:30')
    })

    it('extracts fuzzy period "tadi pagi" as 07:30', () => {
      const res = extractTimeSlot('tadi pagi sarapan bubur 15k', refAfternoon)
      expect(res?.timeStr).toBe('07:30')
    })

    it('extracts fuzzy period "semalam" / "tadi malam" as 20:00', () => {
      const res = extractTimeSlot('semalam nongkrong 50k', refAfternoon)
      expect(res?.timeStr).toBe('20:00')
    })
  })

  describe('extractVenueSlot', () => {
    it('extracts store after "di [place]"', () => {
      const res = extractVenueSlot('tadi jam 5 beli matcha di kulo 20k')
      expect(res).not.toBeNull()
      expect(res?.merchant).toBe('Kulo')
    })

    it('extracts store with brand matching', () => {
      const known = [{ regex: /\bstarbucks\b/i, name: 'Starbucks' }]
      const res = extractVenueSlot('beli kopi di starbucks 55k', known)
      expect(res?.merchant).toBe('Starbucks')
    })
  })

  describe('extractQuantitySlot', () => {
    it('extracts units like "2 cup"', () => {
      const res = extractQuantitySlot('beli matcha 2 cup 40k')
      expect(res).not.toBeNull()
      expect(res?.qty).toBe(2)
      expect(res?.unit).toBe('cup')
    })

    it('extracts units like "3 liter"', () => {
      const res = extractQuantitySlot('beli bensin 3 liter 30k')
      expect(res?.qty).toBe(3)
      expect(res?.unit).toBe('liter')
    })

    it('extracts multiplier "2x"', () => {
      const res = extractQuantitySlot('beli 2x matcha 40k')
      expect(res?.qty).toBe(2)
    })
  })

  describe('extractCleanSubjectEntity (Title Case Notes)', () => {
    it('isolates "Matcha" from "tadi jam 5 beli matcha"', () => {
      const clean = extractCleanSubjectEntity('tadi jam 5 beli matcha')
      expect(clean).toBe('Matcha')
    })

    it('isolates "Matcha" from "tadi jam 5 beli matcha di kulo 20k pakai gopay"', () => {
      const clean = extractCleanSubjectEntity('tadi jam 5 beli matcha di kulo 20k pakai gopay', {
        merchant: 'Kulo',
        walletName: 'GoPay',
      })
      expect(clean).toBe('Matcha')
    })

    it('preserves compound meal phrases like "makan siang"', () => {
      const clean = extractCleanSubjectEntity('tadi siang makan siang 35rb')
      expect(clean).toBe('Makan Siang')
    })

    it('strips "makan" from non-compound phrases like "makan bakso 25rb"', () => {
      const clean = extractCleanSubjectEntity('makan bakso 25rb')
      expect(clean).toBe('Bakso')
    })

    it('formats quantities nicely: "beli 2 matcha 40k" -> "Matcha (2x)"', () => {
      const clean = extractCleanSubjectEntity('beli 2x matcha 40k')
      expect(clean).toBe('Matcha (2x)')
    })

    it('formats sender for income: "dikasih uang saku sama mama 100k" -> "Uang Saku (Mama)"', () => {
      const clean = extractCleanSubjectEntity('dikasih uang saku sama mama 100k', { txType: 'income' })
      expect(clean).toBe('Uang Saku (Mama)')
    })
  })

  describe('splitMultiItemSegments', () => {
    it('splits multiple items with amounts connected by "sama"', () => {
      const segments = splitMultiItemSegments('tadi beli matcha 25k sama donat 12k')
      expect(segments).toHaveLength(2)
      expect(segments?.[0]).toBe('tadi beli matcha 25k')
      expect(segments?.[1]).toBe('donat 12k')
    })

    it('returns null for single amount text', () => {
      const segments = splitMultiItemSegments('tadi beli matcha 25k di kulo')
      expect(segments).toBeNull()
    })
  })
})
