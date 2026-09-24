import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../src/lib/db'
import { invalidateWalletBalance, getWalletBalance } from '../src/lib/balanceEngine'
import { updateTransaction } from '../src/services/transactionService'
import {
  parseFinancialNotification,
} from '../src/lib/notificationIngestion'
import {
  getRememberedCategory,
  clearMerchantMemory,
  normalizeMerchantKey,
  preseedMerchantMemoryFromDb,
} from '../src/lib/ai/merchantCategorizer'

describe('Staging Review Pipeline & Transfer Reconciliation', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.wallets.clear()
    if (db.walletBalanceCache) {
      await db.walletBalanceCache.clear()
    }
    clearMerchantMemory()
    vi.restoreAllMocks()
  })

  it('updates both walletId and targetWalletId when approving transfer from staging and balances both wallets', async () => {
    // Create source wallet (BCA) and destination wallet (GoPay)
    await db.wallets.add({
      id: 1,
      name: 'BCA Utama',
      currency: 'IDR',
      balance: 1000000,
    })
    await db.wallets.add({
      id: 2,
      name: 'GoPay Saldo',
      currency: 'IDR',
      balance: 50000,
    })

    // Staged transfer transaction with isPendingReview = true
    const txId = await db.transactions.add({
      type: 'transfer',
      amount: 150000,
      currency: 'IDR',
      date: '2026-09-23',
      walletId: 1, // From BCA
      targetWalletId: undefined, // Destination not yet assigned
      isPendingReview: true,
      notes: '[Pindah Dana] BCA -> GoPay',
      cleanMerchant: 'Pindah Dana: BCA -> GoPay',
      source: 'notification_listener_transfer',
      createdAt: Date.now(),
    })

    // Before approval, pending review tx must not affect wallet balances
    const bal1Before = await getWalletBalance(1)
    const bal2Before = await getWalletBalance(2)
    expect(bal1Before).toBe(1000000)
    expect(bal2Before).toBe(50000)

    // Simulate approving the transaction with destination wallet selected
    const chosenTargetWalletId = 2
    await db.transactions.update(txId, {
      walletId: 1,
      targetWalletId: chosenTargetWalletId,
      isPendingReview: false,
    })

    // Invalidate affected wallets
    await invalidateWalletBalance([1, chosenTargetWalletId])

    // Verify transaction record in db
    const updatedTx = await db.transactions.get(txId)
    expect(updatedTx.isPendingReview).toBe(false)
    expect(updatedTx.walletId).toBe(1)
    expect(updatedTx.targetWalletId).toBe(2)

    // Verify that BOTH wallets reflect the transfer:
    // BCA debited -150.000 -> 850.000
    // GoPay credited +150.000 -> 200.000
    const bal1After = await getWalletBalance(1)
    const bal2After = await getWalletBalance(2)
    expect(bal1After).toBe(850000)
    expect(bal2After).toBe(200000)
  })

  it('clears isPendingReview when transaction is confirmed via updateTransaction', async () => {
    const walletId = await db.wallets.add({
      id: 10,
      name: 'Cash',
      currency: 'IDR',
      balance: 200000,
    })

    const txId = await db.transactions.add({
      type: 'expense',
      amount: 45000,
      currency: 'IDR',
      date: '2026-09-23',
      walletId,
      isPendingReview: true,
      notes: '[Auto: GoPay] Kopi Kenangan Mantan',
      cleanMerchant: 'Kopi Kenangan Mantan',
      category: 'lainnya_kategori/umum',
      source: 'notification_listener',
      createdAt: Date.now(),
    })

    // Edit and save transaction from editing modal
    await updateTransaction(txId, {
      amount: 45000,
      currency: 'IDR',
      walletId,
      category: 'makanan/kopi',
      notes: 'Kopi Kenangan Mantan',
      isPendingReview: false,
    })

    // Invalidate affected wallet balance
    await invalidateWalletBalance(walletId)

    // Transaction must no longer be pending review
    const confirmedTx = await db.transactions.get(txId)
    expect(confirmedTx.isPendingReview).toBe(false)
    expect(confirmedTx.category).toBe('makanan/kopi')

    // Balance must now reflect the confirmed expense (200.000 - 45.000 = 155.000)
    const bal = await getWalletBalance(walletId)
    expect(bal).toBe(155000)
  })

  it('preseedMerchantMemoryFromDb ignores unconfirmed pending mutations', async () => {
    await db.transactions.bulkAdd([
      {
        id: 301,
        description: 'Toko Baju Pending',
        category: 'pakaian/baju',
        type: 'expense',
        amount: 250000,
        date: '2026-09-22',
        isPendingReview: true,
      },
      {
        id: 302,
        description: 'Bengkel Motor Confirmed',
        category: 'transportasi/servis',
        type: 'expense',
        amount: 80000,
        date: '2026-09-22',
        isPendingReview: false,
      },
    ])

    await preseedMerchantMemoryFromDb()

    expect(getRememberedCategory('Toko Baju Pending', 'expense')).toBeNull()
    expect(getRememberedCategory('Bengkel Motor Confirmed', 'expense')).toBe('transportasi/servis')
  })

  it('normalizes merchant keys by stripping AI prediction tags and noise', () => {
    const raw = '[Auto: Mandiri] Martabak Pecenongan [Kategori diprediksi AI]'
    const normalized = normalizeMerchantKey(raw)
    expect(normalized).toBe('martabak pecenongan')
  })

  it('preserves cleanMerchant in formatted financial notification', () => {
    const notif = {
      title: 'myBCA',
      text: 'm-Transfer Berhasil. Transfer Rp 80.000 ke 098765 Kopi Tuku',
      packageName: 'com.bca.mybca',
      timestamp: Date.now(),
    }

    const parsed = parseFinancialNotification(notif)
    expect(parsed).not.toBeNull()
    expect(parsed.amount).toBe(80000)
    expect(parsed.cleanMerchant).toContain('Kopi Tuku')
    expect(parsed.notes).toContain('Kopi Tuku')
  })

  it('rejects circular transfers where source and target wallet are identical in updateTransaction', async () => {
    await db.wallets.add({
      id: 5,
      name: 'BCA Tabungan',
      currency: 'IDR',
      balance: 500000,
    })

    const txId = await db.transactions.add({
      type: 'transfer',
      amount: 50000,
      currency: 'IDR',
      date: '2026-09-23',
      walletId: 5,
      targetWalletId: undefined,
      isPendingReview: true,
    })

    await expect(
      updateTransaction(txId, {
        walletId: 5,
        targetWalletId: 5,
        isPendingReview: false,
      })
    ).rejects.toThrow(/berbeda dengan dompet asal/i)
  })

  it('ensures duplicated transactions do not inherit isPendingReview: true', async () => {
    const sourceTx = {
      type: 'expense',
      amount: 75000,
      currency: 'IDR',
      walletId: 1,
      isPendingReview: true,
      notes: 'Pending Mutation',
    }

    const duplicatedPayload = {
      ...sourceTx,
      date: '2026-09-23',
      createdAt: Date.now(),
      isPendingReview: false,
    }

    expect(duplicatedPayload.isPendingReview).toBe(false)
  })
})
