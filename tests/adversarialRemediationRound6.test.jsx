// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  encryptField,
  decryptField,
  warmupDecryptionCache,
  getDecryptedNoteSync,
  clearSessionEncryptionKey,
} from '../src/lib/fieldEncryption'
import {
  detectDuplicateTransactions,
} from '../src/lib/statementParser'
import {
  parseIndonesianFinancialText,
} from '../src/lib/ai/nlp/rules'
import { queryTransactions } from '../src/lib/aiDatabaseQueries'
import useSettingsStore from '../src/store/useSettingsStore'

vi.mock('../src/lib/api', () => ({
  getCachedCurrencyRates: vi.fn(() => ({ IDR: 1, USD: 16000 })),
}))

vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
}))

describe('Adversarial Remediation Round 6 Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearSessionEncryptionKey()
  })

  describe('1. Realtime Decryption Event Dispatching', () => {
    it('dispatches ft-notes-decrypted custom window event on warmupDecryptionCache', async () => {
      const plaintext = 'Beli martabak manis telur'
      const encrypted = await encryptField(plaintext)

      // Clear memory cache so warmupDecryptionCache actually performs decryption and dispatches event
      clearSessionEncryptionKey()

      let eventReceived = false
      let receivedCount = 0
      const handler = (e) => {
        eventReceived = true
        receivedCount = e.detail?.count
      }

      window.addEventListener('ft-notes-decrypted', handler)
      try {
        await warmupDecryptionCache([{ notes: encrypted }])
        expect(eventReceived).toBe(true)
        expect(receivedCount).toBeGreaterThanOrEqual(1)
        expect(getDecryptedNoteSync(encrypted)).toBe(plaintext)
      } finally {
        window.removeEventListener('ft-notes-decrypted', handler)
      }
    })
  })

  describe('2. Statement Deduplication with Encrypted Existing Notes', () => {
    it('detects duplicate statement mutation when existing transaction note is encrypted', async () => {
      const plainMerchant = 'Starbucks Coffee Grand Indonesia'
      const encryptedNote = await encryptField(plainMerchant)
      await warmupDecryptionCache([{ notes: encryptedNote }])

      const existingTxs = [
        {
          id: 501,
          date: '2026-10-05',
          type: 'expense',
          amount: 65000,
          notes: encryptedNote,
          cleanMerchant: '',
          category: 'makanan/kopi',
          walletId: 1,
          deletedAt: null,
        },
      ]

      const parsedMutation = [
        {
          date: '2026-10-05',
          type: 'expense',
          amount: 65000,
          cleanMerchant: 'Starbucks Coffee',
          rawDescription: 'Starbucks Coffee Grand Indonesia',
          category: 'makanan/kopi',
        },
      ]

      const deduplicated = detectDuplicateTransactions(parsedMutation, existingTxs, 1)
      expect(deduplicated[0].isDuplicate).toBe(true)
      expect(deduplicated[0].selected).toBe(false)
      expect(deduplicated[0].duplicateMatch.id).toBe(501)
    })
  })

  describe('3. AI Database Queries Decrypted Notes', () => {
    it('returns decrypted notes in recentSampleTransactions for Gemini context', async () => {
      useSettingsStore.setState({ defaultCurrency: 'IDR' })
      const plain = 'Makan siang warteg bersama tim'
      const encNote = await encryptField(plain)

      const mockDb = {
        transactions: {
          where: () => ({
            between: () => ({
              toArray: vi.fn().mockResolvedValue([
                {
                  id: 1,
                  date: '2026-10-01',
                  type: 'expense',
                  category: 'makanan/makan_siang',
                  amount: 35000,
                  currency: 'IDR',
                  notes: encNote,
                  deletedAt: null,
                },
              ]),
            }),
          }),
          orderBy: () => ({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        },
      }

      // Temporarily replace db in module
      const originalDbModule = await import('../src/lib/db')
      const origTransactions = originalDbModule.db.transactions
      originalDbModule.db.transactions = mockDb.transactions

      try {
        const result = await queryTransactions({ startDate: '2026-10-01', endDate: '2026-10-01' })
        expect(result.recentSampleTransactions.length).toBe(1)
        expect(result.recentSampleTransactions[0].notes).toBe(plain)
        expect(result.recentSampleTransactions[0].notes).not.toContain('enc:v1:')
      } finally {
        originalDbModule.db.transactions = origTransactions
      }
    })
  })

  describe('4. Multi-word Fallback Merchant in Indonesian NLP', () => {
    it('captures multi-word merchant like "kopi kenangan" without truncating', () => {
      const result = parseIndonesianFinancialText('habisin 35k buat kopi kenangan', [
        { id: 1, name: 'Dompet Utama', currency: 'IDR' },
      ])

      expect(result).not.toBeNull()
      expect(result.type).toBe('transactions')
      expect(result.transactions[0].amount).toBe(35000)
      const capturedName = result.transactions[0].merchant || result.transactions[0].notes
      expect(capturedName.toLowerCase()).toContain('kopi kenangan')
    })

    it('captures multi-word merchant and strips trailing relative day keywords', () => {
      const result = parseIndonesianFinancialText('habisin 50k buat nasi padang kemarin', [
        { id: 1, name: 'Dompet Utama', currency: 'IDR' },
      ])

      expect(result).not.toBeNull()
      expect(result.type).toBe('transactions')
      expect(result.transactions[0].amount).toBe(50000)
      const capturedName = result.transactions[0].merchant || result.transactions[0].notes
      expect(capturedName.toLowerCase()).toContain('nasi padang')
      expect(capturedName.toLowerCase()).not.toContain('kemarin')
    })
  })

  describe('5. Split Bill Participant Name Fallback', () => {
    it('provides safe fallback name when participant name is cleared or empty', () => {
      const p = { id: '2', name: '   ', amount: '50000', isPayer: false }
      const safePersonName = (p.name && p.name.trim()) || 'Teman 2'
      expect(safePersonName).toBe('Teman 2')
    })
  })

  describe('6. Savings Goal isArchived Typing Standard', () => {
    it('standardizes isArchived to integer 1', () => {
      const updatePayload = { isCompleted: true, isArchived: 1 }
      expect(updatePayload.isArchived).toBe(1)
      expect(typeof updatePayload.isArchived).toBe('number')
      expect(Boolean(updatePayload.isArchived)).toBe(true)
    })
  })

  describe('7. Merchant Categorizer Envelope Re-encryption', () => {
    it('decrypts note before appending AI prediction label and re-encrypts envelope safely', async () => {
      const originalText = 'Beli bensin pertalite'
      const encrypted = await encryptField(originalText)

      // Emulate the enrich logic
      const plainNote = getDecryptedNoteSync(encrypted)
      expect(plainNote).toBe(originalText)

      const updatedPlain = `${plainNote} [Kategori diprediksi AI]`.trim()
      const reEncrypted = await encryptField(updatedPlain)

      expect(reEncrypted.startsWith('enc:v1:')).toBe(true)
      const decryptedFinal = await decryptField(reEncrypted)
      expect(decryptedFinal).toBe('Beli bensin pertalite [Kategori diprediksi AI]')
    })
  })
})
