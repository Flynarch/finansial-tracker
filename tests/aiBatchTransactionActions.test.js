import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleTransactionAction } from '../src/lib/ai/chatActions/transactionActions'
import { db } from '../src/lib/db'
import { updateTransaction } from '../src/services/transactionService'

vi.mock('../src/services/transactionService', () => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn().mockResolvedValue(1),
  deleteTransaction: vi.fn().mockResolvedValue(1),
}))

vi.mock('../src/lib/db', () => ({
  db: {
    transactions: {
      toArray: vi.fn(),
    },
  },
}))

describe('AI Chat Actions - Batch Mutations, String Wallet Resolution & Snapshots', () => {
  const wallets = [
    { id: 1, name: 'Dompet Utama', currency: 'IDR' },
    { id: 2, name: 'DANA', currency: 'IDR' },
  ]

  const mockDbTxs = [
    { id: 101, date: '2026-10-08', time: '10:00', amount: 20000, category: 'makanan/kopi', walletId: 1, notes: 'Kopi' },
    { id: 102, date: '2026-10-08', time: '11:00', amount: 30000, category: 'transportasi/bensin', walletId: 1, notes: 'Bensin' },
    { id: 103, date: '2026-10-08', time: '12:00', amount: 40000, category: 'makanan/makan_siang', walletId: 1, notes: 'Makan' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    db.transactions.toArray.mockResolvedValue([...mockDbTxs])
  })

  it('updates multiple transactions via string or number transactionIds with previousData snapshot', async () => {
    const result = {
      action: 'update',
      transactionIds: ['101', '102'],
      updatedFields: {
        category: 'makanan/jajanan',
      },
    }

    const msgs = await handleTransactionAction(result, {
      locale: 'id',
      defaultCurrency: 'IDR',
      wallets,
    })

    expect(msgs.length).toBe(1)
    const msg = msgs[0]
    expect(msg.type).toBe('success')
    expect(msg.isUpdate).toBe(true)
    expect(msg.previousData).toBeDefined()
    expect(msg.previousData.length).toBe(2)
    expect(msg.previousData[0].category).toBe('transportasi/bensin')
    expect(msg.previousData[1].category).toBe('makanan/kopi')
    expect(updateTransaction).toHaveBeenCalledTimes(2)
    expect(updateTransaction).toHaveBeenCalledWith(101, expect.objectContaining({ category: 'makanan/jajan' }))
    expect(updateTransaction).toHaveBeenCalledWith(102, expect.objectContaining({ category: 'makanan/jajan' }))
  })

  it('resolves string wallet name to numeric walletId', async () => {
    const result = {
      action: 'update',
      transactionId: 101,
      updatedFields: {
        walletId: 'dana',
      },
    }

    const msgs = await handleTransactionAction(result, {
      locale: 'id',
      defaultCurrency: 'IDR',
      wallets,
    })

    expect(msgs.length).toBe(1)
    expect(updateTransaction).toHaveBeenCalledWith(101, expect.objectContaining({ walletId: 2 }))
  })

  it('returns batch delete_confirm card when multiple transactionIds are specified', async () => {
    const result = {
      action: 'delete',
      transactionIds: [101, 102],
    }

    const msgs = await handleTransactionAction(result, {
      locale: 'id',
      defaultCurrency: 'IDR',
      wallets,
    })

    expect(msgs.length).toBe(1)
    const msg = msgs[0]
    expect(msg.type).toBe('delete_confirm')
    expect(msg.data.isBatch).toBe(true)
    expect(msg.data.ids).toEqual([102, 101])
    expect(msg.data.items.length).toBe(2)
  })

  it('triggers batch delete confirmation from multi-ordinal searchQuery "hapus transaksi ke-1 dan ke-2"', async () => {
    const result = {
      action: 'delete',
      searchQuery: 'hapus transaksi ke-1 dan ke-2',
    }

    const msgs = await handleTransactionAction(result, {
      locale: 'id',
      defaultCurrency: 'IDR',
      wallets,
    })

    expect(msgs.length).toBe(1)
    const msg = msgs[0]
    expect(msg.type).toBe('delete_confirm')
    expect(msg.data.isBatch).toBe(true)
    // mockDbTxs sorted desc: 103 (12:00), 102 (11:00), 101 (10:00)
    // index 0 -> 103, index 1 -> 102
    expect(msg.data.ids).toEqual([103, 102])
    expect(msg.data.items.length).toBe(2)
  })

  it('triggers batch update from searchQuery "2 transaksi terakhir"', async () => {
    const result = {
      action: 'update',
      searchQuery: '2 transaksi terakhir',
      updatedFields: {
        category: 'makanan/makan_siang',
      },
    }

    const msgs = await handleTransactionAction(result, {
      locale: 'id',
      defaultCurrency: 'IDR',
      wallets,
    })

    expect(msgs.length).toBe(1)
    const msg = msgs[0]
    expect(msg.type).toBe('success')
    expect(msg.isUpdate).toBe(true)
    expect(updateTransaction).toHaveBeenCalledTimes(2)
    expect(updateTransaction).toHaveBeenCalledWith(103, expect.objectContaining({ category: 'makanan/makan_siang' }))
    expect(updateTransaction).toHaveBeenCalledWith(102, expect.objectContaining({ category: 'makanan/makan_siang' }))
  })
})
