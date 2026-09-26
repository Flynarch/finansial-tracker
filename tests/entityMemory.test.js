import { describe, it, expect, beforeEach } from 'vitest'
import {
  normalizeEntityKey,
  clearEntityMemory,
  rememberTransactionEntity,
  findHistoricalEntity,
  predictOmissionSuggestion,
  getFrequentUserEntities,
  forgetTransactionEntity,
  updateEntityMemory,
} from '../src/lib/ai/entityMemory'

describe('Self-Learning User Entity Memory Engine', () => {
  beforeEach(() => {
    clearEntityMemory()
  })

  describe('normalizeEntityKey', () => {
    it('normalizes entity strings into consistent keys', () => {
      expect(normalizeEntityKey('Matcha')).toBe('matcha')
      expect(normalizeEntityKey('Kopi Susu (Gula Aren)')).toBe('kopi susu gula aren')
      expect(normalizeEntityKey('  Bensin Pertamax! ')).toBe('bensin pertamax')
    })
  })

  describe('rememberTransactionEntity & findHistoricalEntity', () => {
    it('records an entity and retrieves it by exact name', () => {
      rememberTransactionEntity({
        notes: 'Matcha Latte',
        category: 'makanan/kopi',
        amount: 28000,
        walletId: 2,
        merchant: 'Kulo',
      })

      const entity = findHistoricalEntity('Matcha Latte')
      expect(entity).not.toBeNull()
      expect(entity?.name).toBe('Matcha Latte')
      expect(entity?.category).toBe('makanan/kopi')
      expect(entity?.lastAmount).toBe(28000)
      expect(entity?.merchant).toBe('Kulo')
    })

    it('finds entity using fuzzy matching with typo', () => {
      rememberTransactionEntity({
        notes: 'Matcha Latte',
        category: 'makanan/kopi',
        amount: 28000,
      })

      // Query with typo "macha latte"
      const entity = findHistoricalEntity('macha latte')
      expect(entity).not.toBeNull()
      expect(entity?.category).toBe('makanan/kopi')
    })

    it('finds entity using substring query', () => {
      rememberTransactionEntity({
        notes: 'Matcha Latte',
        category: 'makanan/kopi',
        amount: 28000,
      })

      // Query with sub-word "matcha"
      const entity = findHistoricalEntity('matcha')
      expect(entity).not.toBeNull()
      expect(entity?.name).toBe('Matcha Latte')
    })
  })

  describe('predictOmissionSuggestion', () => {
    it('suggests historical amount and wallet when item was previously recorded', () => {
      const mockWallets = [
        { id: 1, name: 'BCA Utama' },
        { id: 2, name: 'GoPay' },
      ]

      rememberTransactionEntity({
        notes: 'Matcha',
        category: 'makanan/kopi',
        amount: 22000,
        walletId: 2,
      })

      const suggestion = predictOmissionSuggestion('Matcha', mockWallets, 'IDR', 'id')
      expect(suggestion.found).toBe(true)
      expect(suggestion.suggestedAmount).toBe(22000)
      expect(suggestion.suggestedWalletId).toBe(2)
      expect(suggestion.message).toContain('Matcha')
      expect(suggestion.message).toContain('GoPay')
      expect(suggestion.chips).toHaveLength(4)
    })

    it('returns generic amount chips when item is completely unknown', () => {
      const suggestion = predictOmissionSuggestion('Item Baru Sekali', [], 'IDR', 'id')
      expect(suggestion.found).toBe(false)
      expect(suggestion.chips).toHaveLength(4)
    })
  })

  describe('getFrequentUserEntities', () => {
    it('returns top frequent entities sorted by usage count', () => {
      rememberTransactionEntity({ notes: 'Kopi', amount: 15000 })
      rememberTransactionEntity({ notes: 'Kopi', amount: 15000 })
      rememberTransactionEntity({ notes: 'Kopi', amount: 15000 })

      rememberTransactionEntity({ notes: 'Matcha', amount: 25000 })
      rememberTransactionEntity({ notes: 'Matcha', amount: 25000 })

      rememberTransactionEntity({ notes: 'Donat', amount: 10000 })

      const top = getFrequentUserEntities(2)
      expect(top).toHaveLength(2)
      expect(top[0].name).toBe('Kopi')
      expect(top[0].count).toBe(3)
      expect(top[1].name).toBe('Matcha')
      expect(top[1].count).toBe(2)
    })
  })

  describe('forgetTransactionEntity & updateEntityMemory', () => {
    it('decrements count on forgetTransactionEntity and deletes when count reaches 0', () => {
      rememberTransactionEntity({ notes: 'Susu UHT', amount: 20000 })
      rememberTransactionEntity({ notes: 'Susu UHT', amount: 20000 })
      expect(findHistoricalEntity('Susu UHT')?.count).toBe(2)

      forgetTransactionEntity('Susu UHT')
      expect(findHistoricalEntity('Susu UHT')?.count).toBe(1)

      forgetTransactionEntity('Susu UHT')
      expect(findHistoricalEntity('Susu UHT')).toBeNull()
    })

    it('updates memory when transaction is edited', () => {
      rememberTransactionEntity({ notes: 'Teh Botol', amount: 5000, category: 'makanan/minuman' })
      expect(findHistoricalEntity('Teh Botol')?.lastAmount).toBe(5000)

      updateEntityMemory(
        { notes: 'Teh Botol', amount: 5000, category: 'makanan/minuman' },
        { notes: 'Teh Botol', amount: 6000, category: 'makanan/minuman' }
      )
      expect(findHistoricalEntity('Teh Botol')?.lastAmount).toBe(6000)

      // Renaming entity
      updateEntityMemory(
        { notes: 'Teh Botol', amount: 6000 },
        { notes: 'Teh Kotak', amount: 7000 }
      )
      expect(findHistoricalEntity('Teh Botol')).toBeNull()
      expect(findHistoricalEntity('Teh Kotak')?.lastAmount).toBe(7000)
    })
  })
})
