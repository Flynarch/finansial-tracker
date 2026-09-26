import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseIndonesianFinancialText,
  KNOWN_MERCHANT_SERVICES,
} from '../src/lib/ai/indonesianFinanceNlp'
import {
  rememberTransactionEntity,
  predictOmissionSuggestion,
  clearEntityMemory,
} from '../src/lib/ai/entityMemory'
import {
  extractTimeSlot,
  extractVenueSlot,
  extractCleanSubjectEntity,
} from '../src/lib/ai/semanticSlotFiller'

describe('AI Clean Notes & Semantic Slot-Filling Enhancement', () => {
  const mockWallets = [
    { id: 1, name: 'BCA Utama', currency: 'IDR' },
    { id: 2, name: 'GoPay', currency: 'IDR' },
    { id: 3, name: 'Cash', currency: 'IDR' },
  ]

  // Reference date: Monday, 14 September 2026 at 19:00 (evening)
  const refDate = new Date(2026, 8, 14, 19, 0, 0)

  beforeEach(() => {
    clearEntityMemory()
  })

  describe('User Screenshot & Direct Voice Input Scenarios', () => {
    it('isolates clean Title Case notes "Matcha" and extracts 17:00 clock time from "tadi jam 5 beli matcha 20k"', () => {
      const res = parseIndonesianFinancialText('tadi jam 5 beli matcha 20k', mockWallets, 'IDR', refDate)

      expect(res).not.toBeNull()
      expect(res.transactions).toHaveLength(1)

      const tx = res.transactions[0]
      expect(tx.notes).toBe('Matcha')
      expect(tx.time).toBe('17:00')
      expect(tx.amount).toBe(20000)
      expect(tx.type).toBe('expense')
      expect(tx.category).toMatch(/makanan\/(kopi|minuman)/)
      expect(tx.date).toBe('2026-09-14')
    })

    it('separates venue from item in "beli matcha di kulo 20k"', () => {
      const res = parseIndonesianFinancialText('beli matcha di kulo 20k', mockWallets, 'IDR', refDate)

      expect(res).not.toBeNull()
      const tx = res.transactions[0]
      expect(tx.notes).toBe('Matcha')
      expect(tx.merchant).toBe('Kulo')
      expect(tx.amount).toBe(20000)
      expect(tx.type).toBe('expense')
    })

    it('extracts fractional time, venue, and item in "kemarin jam setengah 6 sore beli matcha di kulo 25k"', () => {
      const res = parseIndonesianFinancialText(
        'kemarin jam setengah 6 sore beli matcha di kulo 25k',
        mockWallets,
        'IDR',
        refDate
      )

      expect(res).not.toBeNull()
      const tx = res.transactions[0]
      expect(tx.notes).toBe('Matcha')
      expect(tx.merchant).toBe('Kulo')
      expect(tx.time).toBe('17:30')
      expect(tx.date).toBe('2026-09-13')
      expect(tx.amount).toBe(25000)
    })

    it('handles omission when user says "tadi jam 5 beli matcha" without amount', () => {
      const res = parseIndonesianFinancialText('tadi jam 5 beli matcha', mockWallets, 'IDR', refDate)

      expect(res).not.toBeNull()
      expect(res.error).toBe(true)
      expect(res.message).toContain('Matcha')
      expect(res.message).toMatch(/nominal/i)
      expect(res.chips).toBeDefined()
      expect(res.chips.length).toBeGreaterThanOrEqual(2)
    })

    it('predicts omission amount from entity memory when item has history', () => {
      // 1. User previously recorded Matcha for 22,000 via GoPay
      rememberTransactionEntity({
        notes: 'Matcha',
        category: 'makanan/minuman',
        amount: 22000,
        walletId: 2,
      })

      // 2. User later says "tadi beli matcha" without specifying amount
      const res = parseIndonesianFinancialText('tadi beli matcha', mockWallets, 'IDR', refDate)

      expect(res).not.toBeNull()
      expect(res.error).toBe(true)
      expect(res.message).toContain('Matcha')
      expect(res.message).toMatch(/nominal/i)
      // Suggestion chips should include the historical Rp 22.000
      expect(res.chips.some((chip) => chip.includes('22.000'))).toBe(true)

      const directSug = predictOmissionSuggestion('matcha', mockWallets, 'IDR')
      expect(directSug.found).toBe(true)
      expect(directSug.suggestedAmount).toBe(22000)
    })
  })

  describe('Slot Fillers Standalone Verification', () => {
    it('extracts various clock formats accurately', () => {
      expect(extractTimeSlot('jam 5 sore', refDate)?.timeStr).toBe('17:00')
      expect(extractTimeSlot('jam 7 pagi', refDate)?.timeStr).toBe('07:00')
      expect(extractTimeSlot('jam setengah 6', refDate)?.timeStr).toBe('17:30')
      expect(extractTimeSlot('jam 5 kurang 15', refDate)?.timeStr).toBe('16:45')
      expect(extractTimeSlot('pukul 21:15', refDate)?.timeStr).toBe('21:15')
      expect(extractTimeSlot('tadi siang', refDate)?.timeStr).toBe('12:30')
    })

    it('extracts venue accurately regardless of word order', () => {
      expect(extractVenueSlot('beli matcha di starbucks 50k')?.venue).toBe('Starbucks')
      expect(extractVenueSlot('di kulo beli matcha 20k')?.venue).toBe('Kulo')
      expect(extractVenueSlot('kopi kenangan 25k', KNOWN_MERCHANT_SERVICES)?.venue).toBe('Kopi Kenangan')
    })

    it('strips temporal, action verbs, and extraneous words to produce clean Title Case notes', () => {
      expect(extractCleanSubjectEntity('tadi jam 5 beli matcha')).toBe('Matcha')
      expect(extractCleanSubjectEntity('beli 2 cup matcha 40k')).toBe('Matcha (2 Cup)')
      expect(extractCleanSubjectEntity('makan siang 35rb')).toBe('Makan Siang')
      expect(extractCleanSubjectEntity('bayar tagihan listrik pln 200k')).toBe('Tagihan Listrik Pln')
      expect(extractCleanSubjectEntity('dapet uang saku dari ayah 100k')).toBe('Uang Saku (Ayah)')
      // Model number preservation
      expect(extractCleanSubjectEntity('beli iphone 15 15jt')).toBe('Iphone 15')
      expect(extractCleanSubjectEntity('sepatu ukuran 42 350rb')).toBe('Sepatu Ukuran 42')
    })
  })

  describe('Phase 1 Hardening: Math, Multi-Currency, and Transfer Slang', () => {
    it('evaluates multiplier @ expressions and computes total amount', () => {
      const res = parseIndonesianFinancialText('kopi 2 @ 25k', mockWallets, 'IDR', refDate)
      expect(res).not.toBeNull()
      expect(res.transactions[0].amount).toBe(50000)
      expect(res.transactions[0].notes).toBe('Kopi (2x)')
    })

    it('evaluates arithmetic expressions like 35k + 5k and 120k / 4', () => {
      const resSum = parseIndonesianFinancialText('makan 35k + 5k', mockWallets, 'IDR', refDate)
      expect(resSum).not.toBeNull()
      expect(resSum.transactions[0].amount).toBe(40000)

      const resDiv = parseIndonesianFinancialText('patungan 120k / 4', mockWallets, 'IDR', refDate)
      expect(resDiv).not.toBeNull()
      expect(resDiv.transactions[0].amount).toBe(30000)
    })

    it('parses multi-currency amounts without 500 IDR limit and preserves currency code', () => {
      const usdWallets = [
        ...mockWallets,
        { id: 4, name: 'Wise USD', currency: 'USD' },
      ]
      const resUsd = parseIndonesianFinancialText('makan siang $15', usdWallets, 'IDR', refDate)
      expect(resUsd).not.toBeNull()
      expect(resUsd.transactions[0].amount).toBe(15)
      expect(resUsd.transactions[0].currency).toBe('USD')
      expect(resUsd.transactions[0].walletId).toBe(4)
    })

    it('normalizes tf and handles transfer parsing properly', () => {
      const resTf = parseIndonesianFinancialText('tf 50rb dari bca ke gopay', mockWallets, 'IDR', refDate)
      expect(resTf).not.toBeNull()
      expect(resTf.transactions[0].type).toBe('transfer')
      expect(resTf.transactions[0].amount).toBe(50000)
      expect(resTf.transactions[0].walletId).toBe(1)
      expect(resTf.transactions[0].targetWalletId).toBe(2)
    })

    it('parses relative future dates besok and lusa', () => {
      // refDate is 2026-09-14
      const resBesok = parseIndonesianFinancialText('besok bayar wifi 300k', mockWallets, 'IDR', refDate)
      expect(resBesok).not.toBeNull()
      expect(resBesok.transactions[0].date).toBe('2026-09-15')

      const resLusa = parseIndonesianFinancialText('lusa beli pulsa 50k', mockWallets, 'IDR', refDate)
      expect(resLusa).not.toBeNull()
      expect(resLusa.transactions[0].date).toBe('2026-09-16')
    })
  })
})
