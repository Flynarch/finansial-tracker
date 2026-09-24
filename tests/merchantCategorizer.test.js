import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    _store: {},
    getItem(key) { return this._store[key] ?? null },
    setItem(key, val) { this._store[key] = String(val) },
    removeItem(key) { delete this._store[key] },
    clear() { this._store = {} },
  }
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    localStorage: globalThis.localStorage,
    dispatchEvent: vi.fn(),
    CustomEvent: class CustomEvent {},
  }
}

import { db } from '../src/lib/db'
import { cleanMutationMerchant } from '../src/lib/merchantUtils'
import {
  normalizeMerchantKey,
  getRememberedCategory,
  rememberMerchantCategory,
  clearMerchantMemory,
  getMerchantMemoryEntries,
  classifyMerchantWithRules,
  classifyMerchantWithAi,
  classifyMerchantHybrid,
  preseedMerchantMemoryFromDb,
  enrichPendingMutationsWithAi,
} from '../src/lib/ai/merchantCategorizer'

describe('merchantCategorizer - Intelligent Hybrid Categorization', () => {
  beforeEach(async () => {
    localStorage.clear()
    clearMerchantMemory()
    await db.transactions.clear()
    vi.restoreAllMocks()
  })

  afterEach(async () => {
    localStorage.clear()
    clearMerchantMemory()
    await db.transactions.clear()
    vi.restoreAllMocks()
  })

  describe('normalizeMerchantKey & cleanMutationMerchant', () => {
    it('normalizes common prefixes and noise tokens', () => {
      expect(normalizeMerchantKey('[Auto: GoPay] Pembayaran ke Kopi Kenangan Mall')).toBe('kopi kenangan')
      expect(normalizeMerchantKey('[Auto: BCA] [Pindah Dana] BCA -> GoPay')).toBe('bca gopay')
      expect(normalizeMerchantKey('Bayar QRIS Indomaret Point Sudirman')).toBe('indomaret point')
      expect(normalizeMerchantKey('Transfer Ke PT Tokopedia Jakarta')).toBe('tokopedia')
      expect(normalizeMerchantKey('Toko Alfamart Cabang Tebet #9821')).toBe('alfamart')
      expect(normalizeMerchantKey('Merchant: Starbucks Coffee - Jakarta Selatan')).toBe('starbucks coffee')
    })

    it('strips invoice references, timestamps, and order numbers', () => {
      expect(normalizeMerchantKey('Shopee Pay INV/2026/03/15/XX-992')).toBe('shopee pay')
      expect(normalizeMerchantKey('GrabFood Order #GF-883921')).toBe('grabfood')
      expect(normalizeMerchantKey('Kopi Kenangan [Kategori diprediksi AI]')).toBe('kopi kenangan')
    })

    it('cleanMutationMerchant strips AI predicted tags', () => {
      expect(cleanMutationMerchant('Kopi Kenangan [Kategori diprediksi AI]')).toBe('Kopi Kenangan')
    })

    it('handles empty or non-string inputs safely', () => {
      expect(normalizeMerchantKey('')).toBe('')
      expect(normalizeMerchantKey(null)).toBe('')
      expect(normalizeMerchantKey(undefined)).toBe('')
      expect(normalizeMerchantKey(12345)).toBe('')
    })
  })

  describe('Tier 1: Memory Cache', () => {
    it('remembers and retrieves merchant category mappings with word stem matching', () => {
      rememberMerchantCategory('Kopi Tuku Cipete', 'makanan/kopi', 'expense')
      const remembered = getRememberedCategory('Kopi Tuku Jakarta Selatan', 'expense')
      expect(remembered).toBe('makanan/kopi')
    })

    it('differentiates expense and income mappings', () => {
      rememberMerchantCategory('PT Tokopedia Rekening', 'bonus/cashback', 'income')
      rememberMerchantCategory('PT Tokopedia Rekening', 'kebutuhan_harian/belanja_bulanan', 'expense')

      expect(getRememberedCategory('Tokopedia', 'income')).toBe('bonus/cashback')
      expect(getRememberedCategory('Tokopedia', 'expense')).toBe('kebutuhan_harian/belanja_bulanan')
    })

    it('refuses to remember generic fallback categories', () => {
      rememberMerchantCategory('Warung Tidak Jelas', 'lainnya_kategori/umum', 'expense')
      rememberMerchantCategory('Warung Lainnya', 'Lainnya', 'expense')

      expect(getRememberedCategory('Warung Tidak Jelas', 'expense')).toBeNull()
      expect(getRememberedCategory('Warung Lainnya', 'expense')).toBeNull()
    })

    it('clears memory cache and provides entries snapshot', () => {
      rememberMerchantCategory('Mie Gacoan', 'makanan/makan_diluar', 'expense')
      const entries = getMerchantMemoryEntries()
      expect(Object.keys(entries).length).toBeGreaterThan(0)

      clearMerchantMemory()
      expect(getRememberedCategory('Mie Gacoan', 'expense')).toBeNull()
      expect(Object.keys(getMerchantMemoryEntries()).length).toBe(0)
    })

    it('enforces word boundary safety so short substrings do not falsely match unrelated words', () => {
      rememberMerchantCategory('Kopi Tuku', 'makanan/kopi', 'expense')
      // "fotokopi" contains "kopi" as a substring, but is NOT the word "kopi"
      expect(getRememberedCategory('Fotokopi Jaya Abadi', 'expense')).toBeNull()

      rememberMerchantCategory('Ban Motor Ahass', 'transportasi/servis', 'expense')
      // "bantuan" contains "ban", but should NOT match
      expect(getRememberedCategory('Bantuan Bencana Alam', 'expense')).toBeNull()

      rememberMerchantCategory('Toko Sentosa Jaya', 'kebutuhan_harian/belanja_bulanan', 'expense')
      // "Apotek Sentosa Sehat" shares single word "sentosa" but is completely different business
      expect(getRememberedCategory('Apotek Sentosa Sehat', 'expense')).toBeNull()
    })
  })

  describe('Tier 2: Fast-Path Rule Engine', () => {
    it('accurately classifies popular food & beverage merchants', () => {
      expect(classifyMerchantWithRules('Starbucks Reserve')).toBe('makanan/kopi')
      expect(classifyMerchantWithRules('Kopi Kenangan Mantan')).toBe('makanan/kopi')
      expect(classifyMerchantWithRules('Mixue Ice Cream')).toBe('makanan/kopi')
      expect(classifyMerchantWithRules('GoFood Martabak Pecenongan')).toBe('makanan/makan_diluar')
      expect(classifyMerchantWithRules('Warteg Bahari')).toBe('makanan/makan_diluar')
    })

    it('accurately classifies grocery and supermarket merchants', () => {
      expect(classifyMerchantWithRules('Indomaret Fresh')).toBe('kebutuhan_harian/belanja_bulanan')
      expect(classifyMerchantWithRules('Alfamart DC')).toBe('kebutuhan_harian/belanja_bulanan')
      expect(classifyMerchantWithRules('Super Indo Supermarket')).toBe('kebutuhan_harian/belanja_bulanan')
    })

    it('accurately classifies transportation and fuel merchants', () => {
      expect(classifyMerchantWithRules('SPBU Pertamina 31.123')).toBe('transportasi/bensin')
      expect(classifyMerchantWithRules('Shell SPBU Antasari')).toBe('transportasi/bensin')
      expect(classifyMerchantWithRules('Gojek Ride')).toBe('transportasi/ojol')
      expect(classifyMerchantWithRules('KAI Commuter Jabodetabek')).toBe('transportasi/kereta')
    })

    it('accurately classifies bill utilities and subscriptions', () => {
      expect(classifyMerchantWithRules('PLN Prabayar Listrik')).toBe('tagihan/listrik')
      expect(classifyMerchantWithRules('Tagihan PDAM Surya')).toBe('tagihan/air')
      expect(classifyMerchantWithRules('Indihome Speedy Internet')).toBe('tagihan/internet')
      expect(classifyMerchantWithRules('Netflix International')).toBe('tagihan/langganan')
      expect(classifyMerchantWithRules('Spotify AB Premium')).toBe('tagihan/langganan')
    })

    it('accurately classifies income sources', () => {
      expect(classifyMerchantWithRules('Payroll Gaji Bulanan PT Maju', 'income')).toBe('gaji/gaji_pokok')
      expect(classifyMerchantWithRules('Dividen Saham BBCA', 'income')).toBe('investasi/dividen')
      expect(classifyMerchantWithRules('Cashback Promo Shopee', 'income')).toBe('bonus/cashback')
      expect(classifyMerchantWithRules('Bunga Tabungan Tahapan', 'income')).toBe('investasi/bunga_bank')
    })

    it('returns null for unknown obscure merchants', () => {
      expect(classifyMerchantWithRules('Bengkel Pak Joko')).toBeNull()
      expect(classifyMerchantWithRules('CV Sinar Abadi Perkasa')).toBeNull()
    })
  })

  describe('Tier 3 & Hybrid Categorization', () => {
    it('prioritizes Tier 1 (Memory) over Tier 2 (Rule)', async () => {
      // Rule would classify Starbucks as 'makanan/kopi'
      // But user customized it to 'kultur/games'
      rememberMerchantCategory('Starbucks', 'kultur/games', 'expense')

      const result = await classifyMerchantHybrid('Starbucks Senayan City', 'expense', { enableAi: false })
      expect(result.category).toBe('kultur/games')
      expect(result.source).toBe('memory')
      expect(result.confidence).toBe(0.95)
    })

    it('falls back to Tier 2 (Rule) when not in Memory', async () => {
      const result = await classifyMerchantHybrid('McDonalds Sarinah', 'expense', { enableAi: false })
      expect(result.category).toBe('makanan/makan_diluar')
      expect(result.source).toBe('rule')
      expect(result.confidence).toBe(0.85)
    })

    it('returns fallback when unknown and enableAi is false', async () => {
      const result = await classifyMerchantHybrid('Studio Senam Bugar Abadi', 'expense', { enableAi: false })
      expect(result.category).toBe('lainnya_kategori/umum')
      expect(result.source).toBe('fallback')
      expect(result.confidence).toBe(0.2)
    })

    it('calls Tier 3 AI when unknown and enableAi is true, then saves to Memory', async () => {
      // Mock global fetch for Gemini API
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      category: 'kesehatan/gym',
                      confidence: 0.92,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })

      const result = await classifyMerchantHybrid('Studio Senam Bugar Abadi', 'expense', {
        enableAi: true,
        apiKey: 'test-fake-key',
      })
      expect(result.category).toBe('kesehatan/gym')
      expect(result.source).toBe('ai')
      expect(result.confidence).toBe(0.92)

      // Subsequent call should hit Tier 1 memory without invoking fetch
      const memoryResult = await classifyMerchantHybrid('Studio Senam Bugar Abadi', 'expense', { enableAi: false })
      expect(memoryResult.category).toBe('kesehatan/gym')
      expect(memoryResult.source).toBe('memory')
    })
  })

  describe('classifyMerchantWithAi', () => {
    it('handles AI response parsing and sanitizes non-canonical categories', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      category: 'Obat & Apotek',
                      confidence: 0.88,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })

      const res = await classifyMerchantWithAi('Apotek Kimia Farma Sudirman', 'expense', { apiKey: 'fake-key' })
      expect(res).toBe('kesehatan/obat')
    })

    it('gracefully returns null if network fails or API key is missing', async () => {
      const resWithoutKey = await classifyMerchantWithAi('Apotek K-24', 'expense', { apiKey: '' })
      expect(resWithoutKey).toBeNull()

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
      const resWithError = await classifyMerchantWithAi('Apotek K-24', 'expense', { apiKey: 'key' })
      expect(resWithError).toBeNull()
    })
  })

  describe('preseedMerchantMemoryFromDb', () => {
    it('seeds memory from historical transactions in database', async () => {
      await db.transactions.bulkAdd([
        {
          id: 101,
          description: 'Apotek Roxy Thamrin',
          category: 'kesehatan/obat',
          type: 'expense',
          amount: 85000,
          date: '2026-03-01T10:00:00Z',
          isArchived: 0,
        },
        {
          id: 102,
          description: 'Barbershop Asgar Tebet',
          category: 'kecantikan/salon',
          type: 'expense',
          amount: 50000,
          date: '2026-03-02T11:00:00Z',
          isArchived: 0,
        },
      ])

      await preseedMerchantMemoryFromDb()

      expect(getRememberedCategory('Apotek Roxy Thamrin', 'expense')).toBe('kesehatan/obat')
      expect(getRememberedCategory('Barbershop Asgar Tebet', 'expense')).toBe('kecantikan/salon')
    })

    it('skips unconfirmed staging transactions so memory cache is not polluted', async () => {
      await db.transactions.bulkAdd([
        {
          id: 201,
          description: 'Unconfirmed Staging Shop',
          category: 'hiburan/games',
          type: 'expense',
          amount: 150000,
          date: '2026-03-03T10:00:00Z',
          isPendingReview: true,
        },
        {
          id: 202,
          description: 'Pending Review Coffee',
          category: 'makanan/kopi',
          type: 'expense',
          amount: 25000,
          date: '2026-03-03T11:00:00Z',
          isPendingReview: 1,
        },
      ])

      await preseedMerchantMemoryFromDb()

      expect(getRememberedCategory('Unconfirmed Staging Shop', 'expense')).toBeNull()
      expect(getRememberedCategory('Pending Review Coffee', 'expense')).toBeNull()
    })
  })

  describe('enrichPendingMutationsWithAi', () => {
    it('enriches unconfirmed transactions with AI classifications asynchronously', async () => {
      const txId = await db.transactions.add({
        description: 'Klinik Gigi Sehat',
        category: 'lainnya_kategori/umum',
        type: 'expense',
        amount: 250000,
        date: '2026-03-03T14:00:00Z',
        isConfirmed: 0,
      })

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      category: 'kesehatan/dokter',
                      confidence: 0.9,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })

      await enrichPendingMutationsWithAi([txId], { apiKey: 'fake-key' })

      const updatedTx = await db.transactions.get(txId)
      expect(updatedTx.category).toBe('kesehatan/dokter')
      expect(updatedTx.notes).toContain('Kategori diprediksi AI')
    })

    it('does not append duplicate [Kategori diprediksi AI] tags when run multiple times', async () => {
      const txId = await db.transactions.add({
        description: 'Puskesmas Tebet',
        notes: 'Puskesmas Tebet [Kategori diprediksi AI]',
        category: 'lainnya_kategori/umum',
        type: 'expense',
        amount: 50000,
        date: '2026-03-03T15:00:00Z',
      })

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ category: 'kesehatan/dokter', confidence: 0.9 }) }],
              },
            },
          ],
        }),
      })

      await enrichPendingMutationsWithAi([txId], { apiKey: 'fake-key' })
      const updatedTx = await db.transactions.get(txId)
      expect(updatedTx.notes).toBe('Puskesmas Tebet [Kategori diprediksi AI]')
      const matches = updatedTx.notes.match(/\[kategori diprediksi ai\]/gi) || []
      expect(matches.length).toBe(1)
    })
  })
})
