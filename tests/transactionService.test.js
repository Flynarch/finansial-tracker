import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/lib/db'
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransaction,
} from '../src/services/transactionService'
import { isFieldEncrypted } from '../src/lib/fieldEncryption'

describe('transactionService - Field Encryption & Ledger Contracts', () => {
  let sampleWalletId

  beforeEach(async () => {
    await db.wallets.clear()
    await db.transactions.clear()

    sampleWalletId = await db.wallets.add({
      name: 'Rekening Utama',
      currency: 'IDR',
      balance: 1000000,
      isArchived: 0,
    })
  })

  it('createTransaction encrypts sensitive notes with enc:v1: in IndexedDB', async () => {
    const rawNote = 'Pembayaran rahasia konsultan hukum bisnis'
    const txId = await createTransaction({
      walletId: sampleWalletId,
      type: 'expense',
      amount: 150000,
      category: 'jasa',
      notes: rawNote,
      date: '2026-04-01',
    })

    // Direct inspect raw DB record
    const rawInDb = await db.transactions.get(txId)
    expect(rawInDb).toBeTruthy()
    expect(isFieldEncrypted(rawInDb.notes)).toBe(true)
    expect(rawInDb.notes).not.toContain(rawNote)
    expect(rawInDb.amount).toBe(150000)
    expect(rawInDb.walletId).toBe(sampleWalletId)
  })

  it('getTransaction transparently decrypts encrypted notes', async () => {
    const rawNote = 'Beli kado ulang tahun kejutan'
    const txId = await createTransaction({
      walletId: sampleWalletId,
      type: 'expense',
      amount: 75000,
      category: 'hadiah',
      notes: rawNote,
      date: '2026-04-02',
    })

    const retrieved = await getTransaction(txId)
    expect(retrieved).toBeTruthy()
    expect(retrieved.notes).toBe(rawNote)
    expect(retrieved.amount).toBe(75000)
  })

  it('getTransaction maintains 100% backward compatibility for legacy plaintext notes', async () => {
    const legacyPlaintext = 'Catatan lama dari versi sebelumnya tanpa enkripsi'
    const legacyTxId = await db.transactions.add({
      walletId: sampleWalletId,
      type: 'income',
      amount: 500000,
      category: 'gaji',
      notes: legacyPlaintext,
      currency: 'IDR',
      date: '2026-01-01',
      createdAt: Date.now(),
      deletedAt: null,
    })

    const retrieved = await getTransaction(legacyTxId)
    expect(retrieved).toBeTruthy()
    expect(retrieved.notes).toBe(legacyPlaintext)
    expect(retrieved.amount).toBe(500000)
  })

  it('updateTransaction encrypts updated notes and getTransaction retrieves decrypted notes', async () => {
    const initialNote = 'Catatan awal sebelum diedit'
    const txId = await createTransaction({
      walletId: sampleWalletId,
      type: 'expense',
      amount: 50000,
      category: 'makanan',
      notes: initialNote,
      date: '2026-04-03',
    })

    const updatedNote = 'Catatan baru setelah revisi'
    await updateTransaction(txId, {
      notes: updatedNote,
      amount: 60000,
    })

    // Inspect database row directly: must be encrypted
    const rawInDb = await db.transactions.get(txId)
    expect(isFieldEncrypted(rawInDb.notes)).toBe(true)
    expect(rawInDb.notes).not.toContain(updatedNote)
    expect(rawInDb.amount).toBe(60000)

    // Inspect via getTransaction: must be decrypted
    const decrypted = await getTransaction(txId)
    expect(decrypted.notes).toBe(updatedNote)
  })

  it('handles empty or missing notes gracefully without error', async () => {
    const txId = await createTransaction({
      walletId: sampleWalletId,
      type: 'income',
      amount: 250000,
      category: 'freelance',
      notes: '',
      date: '2026-04-04',
    })

    const retrieved = await getTransaction(txId)
    expect(retrieved.notes === '' || retrieved.notes == null).toBe(true)
  })

  it('respects financial split transaction invariants and encrypts parent notes', async () => {
    const parentNote = 'Makan siang bersama tim divisi engineering'
    const splitItems = [
      { category: 'makanan', amount: 80000, type: 'expense' },
      { category: 'minuman', amount: 20000, type: 'expense' },
    ]

    const txId = await createTransaction({
      walletId: sampleWalletId,
      type: 'expense',
      amount: 100000,
      isSplit: true,
      splitItems,
      notes: parentNote,
      date: '2026-04-05',
    })

    const rawInDb = await db.transactions.get(txId)
    expect(isFieldEncrypted(rawInDb.notes)).toBe(true)
    expect(rawInDb.isSplit).toBe(true)
    expect(rawInDb.splitItems).toHaveLength(2)

    const decrypted = await getTransaction(txId)
    expect(decrypted.notes).toBe(parentNote)
    expect(decrypted.splitItems).toHaveLength(2)
    expect(decrypted.splitItems[0].amount).toBe(80000)
    expect(decrypted.splitItems[1].amount).toBe(20000)
  })

  it('deleteTransaction soft deletes and getTransaction returns null for nonexistent or deleted', async () => {
    const txId = await createTransaction({
      walletId: sampleWalletId,
      type: 'expense',
      amount: 30000,
      category: 'transport',
      notes: 'Tiket KRL Commuter Line',
      date: '2026-04-06',
    })

    await deleteTransaction(txId)
    const rawInDb = await db.transactions.get(txId)
    expect(rawInDb.deletedAt).toBeTruthy()

    expect(await getTransaction(999999)).toBeNull()
    expect(await getTransaction('invalid')).toBeNull()
  })
})
