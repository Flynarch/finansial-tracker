import { describe, it, expect, vi } from 'vitest'
import {
  findMatchingTransactionForAction,
  findMatchingTransactionsForAction,
  parseOrdinalNumber,
  resolveOrdinalIndices,
} from '../src/lib/ai/aiChatHelpers'
import { buildSystemPrompt } from '../src/lib/ai/promptBuilder'
import { getTools } from '../src/lib/ai/toolSchemas'

vi.mock('../src/lib/fieldEncryption', () => ({
  getDecryptedNoteSync: vi.fn((val) => {
    if (val === 'enc:v1:secretKopi') return 'Kopi Susu'
    if (val === 'enc:v1:secretBensin') return 'Bensin Pertamax'
    return val
  }),
  isFieldEncrypted: vi.fn((val) => typeof val === 'string' && val.startsWith('enc:v1:')),
  warmupDecryptionCache: vi.fn().mockResolvedValue(),
}))

describe('AI Ordinal Resolution, Decryption & Tool Schemas', () => {
  const sampleTxs = [
    { id: 91, date: '2026-10-08', time: '14:00', amount: 20000, notes: 'enc:v1:secretKopi', category: 'makanan/kopi' },
    { id: 92, date: '2026-10-08', time: '13:00', amount: 35000, notes: 'enc:v1:secretBensin', category: 'transportasi/bensin' },
    { id: 93, date: '2026-10-08', time: '12:00', amount: 50000, notes: 'Makan Siang Padang', category: 'makanan/restoran' },
    { id: 94, date: '2026-10-08', time: '11:00', amount: 15000, notes: 'Parkir Motor', category: 'transportasi/parkir' },
  ]

  it('resolves relative keyword "terakhir", "latest", "transaksi terakhir", "transaksi tadi" to index 0', () => {
    const res1 = findMatchingTransactionForAction(sampleTxs, { searchQuery: 'terakhir' })
    expect(res1?.id).toBe(91)

    const res2 = findMatchingTransactionForAction(sampleTxs, { searchQuery: 'latest' })
    expect(res2?.id).toBe(91)

    const res3 = findMatchingTransactionForAction(sampleTxs, { searchQuery: 'transaksi terakhir' })
    expect(res3?.id).toBe(91)

    const res4 = findMatchingTransactionForAction(sampleTxs, { searchQuery: 'transaksi tadi' })
    expect(res4?.id).toBe(91)
  })

  it('resolves word ordinals "pertama", "kedua", "ketiga", "keempat"', () => {
    const first = findMatchingTransactionForAction(sampleTxs, { searchQuery: 'transaksi pertama' })
    expect(first?.id).toBe(91)

    const second = findMatchingTransactionForAction(sampleTxs, { searchQuery: 'kedua' })
    expect(second?.id).toBe(92)

    const third = findMatchingTransactionForAction(sampleTxs, { searchQuery: 'transaksi ketiga' })
    expect(third?.id).toBe(93)

    const fourth = findMatchingTransactionForAction(sampleTxs, { searchQuery: 'keempat' })
    expect(fourth?.id).toBe(94)
  })

  it('resolves numeric ordinals "ke-1", "ke-2", "ke 3", "2nd", "3rd", "#1", "#2", "transaksi 2"', () => {
    const item1 = findMatchingTransactionForAction(sampleTxs, { searchQuery: 'ke-1' })
    expect(item1?.id).toBe(91)

    const item2 = findMatchingTransactionForAction(sampleTxs, { searchQuery: 'ke-2' })
    expect(item2?.id).toBe(92)

    const item3 = findMatchingTransactionForAction(sampleTxs, { searchQuery: 'transaksi ke 3' })
    expect(item3?.id).toBe(93)

    const item2nd = findMatchingTransactionForAction(sampleTxs, { searchQuery: '2nd' })
    expect(item2nd?.id).toBe(92)

    const item3rd = findMatchingTransactionForAction(sampleTxs, { searchQuery: '3rd' })
    expect(item3rd?.id).toBe(93)

    const itemHash2 = findMatchingTransactionForAction(sampleTxs, { searchQuery: 'transaksi #2' })
    expect(itemHash2?.id).toBe(92)

    const itemHash1 = findMatchingTransactionForAction(sampleTxs, { searchQuery: '#1' })
    expect(itemHash1?.id).toBe(91)

    const itemTrans2 = findMatchingTransactionForAction(sampleTxs, { searchQuery: 'transaksi 2' })
    expect(itemTrans2?.id).toBe(92)
  })

  it('matches encrypted notes after transparent decryption', () => {
    const matched = findMatchingTransactionForAction(sampleTxs, { searchQuery: 'kopi susu' })
    expect(matched?.id).toBe(91)

    const matchedBensin = findMatchingTransactionForAction(sampleTxs, { searchQuery: 'bensin pertamax' })
    expect(matchedBensin?.id).toBe(92)
  })

  it('buildSystemPrompt decrypts notes and includes time without leaking enc:v1: ciphertext', () => {
    const wallets = [{ id: 1, name: 'Dompet Utama', currency: 'IDR' }]
    const prompt = buildSystemPrompt({
      todayStr: '2026-10-08',
      currentTime: '15:00',
      wallets,
      recentTransactions: sampleTxs,
    })

    expect(prompt).toContain('Catatan: "Kopi Susu"')
    expect(prompt).toContain('Catatan: "Bensin Pertamax"')
    expect(prompt).toContain('1. [ID: 91]')
    expect(prompt).toContain('2. [ID: 92]')
    expect(prompt).not.toContain('enc:v1:')
    expect(prompt).toContain('2026-10-08 14:00')
    expect(prompt).toContain('RESOLUSI REFERENSI URUTAN TRANSAKSI (ORDINAL RESOLUTION)')
  })

  it('declares transactionIds in delete_transaction tool schema for batch deletion', () => {
    const tools = getTools()
    const deleteTool = tools[0].functionDeclarations.find((fn) => fn.name === 'delete_transaction')
    expect(deleteTool).toBeDefined()
    expect(deleteTool.parameters.properties.transactionIds).toBeDefined()
    expect(deleteTool.parameters.properties.transactionIds.type).toBe('ARRAY')
  })

  it('correctly parses individual tokens with parseOrdinalNumber', () => {
    expect(parseOrdinalNumber('pertama')).toBe(0)
    expect(parseOrdinalNumber('kedua')).toBe(1)
    expect(parseOrdinalNumber('ketiga')).toBe(2)
    expect(parseOrdinalNumber('first')).toBe(0)
    expect(parseOrdinalNumber('third')).toBe(2)
    expect(parseOrdinalNumber('ke-3')).toBe(2)
    expect(parseOrdinalNumber('#2')).toBe(1)
    expect(parseOrdinalNumber('item #4')).toBe(3)
    expect(parseOrdinalNumber('transaksi 5')).toBe(4)
    expect(parseOrdinalNumber('non-ordinal-text')).toBeNull()
    expect(parseOrdinalNumber('')).toBeNull()
  })

  it('resolves multi-ordinal indices and recent expressions with resolveOrdinalIndices', () => {
    expect(resolveOrdinalIndices('hapus transaksi pertama dan kedua')).toEqual([0, 1])
    expect(resolveOrdinalIndices('transaksi ke-1 dan ke-3')).toEqual([0, 2])
    expect(resolveOrdinalIndices('#1, #2, #3')).toEqual([0, 1, 2])
    expect(resolveOrdinalIndices('transaksi 1 dan 2')).toEqual([0, 1])
    expect(resolveOrdinalIndices('2 transaksi terakhir')).toEqual([0, 1])
    expect(resolveOrdinalIndices('dua transaksi terakhir')).toEqual([0, 1])
    expect(resolveOrdinalIndices('kedua transaksi tadi')).toEqual([0, 1])
    expect(resolveOrdinalIndices('transaksi terakhir')).toEqual([0])
    expect(resolveOrdinalIndices('barusan')).toEqual([0])
  })

  it('matches multiple transactions via findMatchingTransactionsForAction', () => {
    const multi1 = findMatchingTransactionsForAction(sampleTxs, { searchQuery: 'transaksi ke-1 dan ke-2' })
    expect(multi1.map((t) => t.id)).toEqual([91, 92])

    const multi2 = findMatchingTransactionsForAction(sampleTxs, { searchQuery: '2 transaksi terakhir' })
    expect(multi2.map((t) => t.id)).toEqual([91, 92])

    const multi3 = findMatchingTransactionsForAction(sampleTxs, { searchQuery: '#1 dan #3' })
    expect(multi3.map((t) => t.id)).toEqual([91, 93])

    const singleText = findMatchingTransactionsForAction(sampleTxs, { searchQuery: 'kopi susu' })
    expect(singleText.map((t) => t.id)).toEqual([91])
  })
})
