import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { computeWalletBalance, computeAllWalletBalances, db } from '../src/lib/db'
import { getAllWalletBalances, invalidateAllBalances } from '../src/lib/balanceEngine'

describe('balanceEngine - computeWalletBalance & computeAllWalletBalances', () => {
  const sampleWallet = {
    id: 1,
    name: 'BCA Main',
    currency: 'IDR',
    balance: 1000000, // Saldo awal 1jt
  }

  it('computes wallet balance with initial balance + income - expense', () => {
    const transactions = [
      { id: 101, walletId: 1, type: 'income', amount: 500000, currency: 'IDR' },
      { id: 102, walletId: 1, type: 'expense', amount: 200000, currency: 'IDR' },
      { id: 103, walletId: 1, type: 'expense', amount: 50000, currency: 'IDR' },
    ]

    const balance = computeWalletBalance(sampleWallet, transactions)
    // 1,000,000 + 500,000 - 200,000 - 50,000 = 1,250,000
    expect(balance).toBe(1250000)
  })

  it('computes transfers in and transfers out correctly', () => {
    const walletA = { id: 1, name: 'BCA', currency: 'IDR', balance: 500000 }
    const walletB = { id: 2, name: 'GoPay', currency: 'IDR', balance: 100000 }

    const transactions = [
      {
        id: 201,
        type: 'transfer',
        walletId: 1, // Transfer out of Wallet 1
        targetWalletId: 2, // Transfer into Wallet 2
        amount: 200000,
        currency: 'IDR',
      },
    ]

    const balA = computeWalletBalance(walletA, transactions)
    const balB = computeWalletBalance(walletB, transactions)

    expect(balA).toBe(300000)
    expect(balB).toBe(300000)
  })

  it('computes batch wallet balances in computeAllWalletBalances', () => {
    const wallets = [
      { id: 1, name: 'BCA', currency: 'IDR', balance: 500000 },
      { id: 2, name: 'GoPay', currency: 'IDR', balance: 100000 },
    ]

    const transactions = [
      { id: 301, walletId: 1, type: 'expense', amount: 100000, currency: 'IDR' },
      { id: 302, walletId: 2, type: 'income', amount: 50000, currency: 'IDR' },
    ]

    const computed = computeAllWalletBalances(wallets, transactions)
    expect(computed[0].currentBalance).toBe(400000)
    expect(computed[1].currentBalance).toBe(150000)
  })

  it('never credits targetWalletId in computeAllWalletBalances if transaction type is not transfer', () => {
    const wallets = [
      { id: 1, name: 'BCA', currency: 'IDR', balance: 500000 },
      { id: 2, name: 'GoPay', currency: 'IDR', balance: 100000 },
    ]

    // An expense transaction that happens to have a lingering targetWalletId
    const transactions = [
      { id: 401, walletId: 1, targetWalletId: 2, type: 'expense', amount: 50000, currency: 'IDR' },
    ]

    const computed = computeAllWalletBalances(wallets, transactions)
    // Wallet 1 should decrease by 50,000 -> 450,000
    expect(computed[0].currentBalance).toBe(450000)
    // Wallet 2 should NOT increase because this is an expense, not a transfer -> stays 100,000
    expect(computed[1].currentBalance).toBe(100000)
  })

  it('handles string wallet IDs and numeric wallet IDs consistently', () => {
    const wallets = [
      { id: 'wallet_abc', name: 'Cash', currency: 'IDR', balance: 200000 },
      { id: 'wallet_xyz', name: 'Bank', currency: 'IDR', balance: 500000 },
    ]

    const transactions = [
      { id: 501, walletId: 'wallet_abc', targetWalletId: 'wallet_xyz', type: 'transfer', amount: 50000, currency: 'IDR' },
    ]

    const computed = computeAllWalletBalances(wallets, transactions)
    expect(computed[0].currentBalance).toBe(150000)
    expect(computed[1].currentBalance).toBe(550000)
  })

  it('getAllWalletBalances recomputes all uncached wallets in a single batch pass', async () => {
    await db.wallets.clear()
    await db.transactions.clear()
    await invalidateAllBalances()

    const w1Id = await db.wallets.add({ name: 'Dompet A', balance: 500000, currency: 'IDR' })
    const w2Id = await db.wallets.add({ name: 'Dompet B', balance: 200000, currency: 'IDR' })

    await db.transactions.add({
      walletId: w1Id,
      type: 'expense',
      amount: 100000,
      currency: 'IDR',
      date: '2026-03-01',
    })

    await db.transactions.add({
      walletId: w2Id,
      type: 'income',
      amount: 50000,
      currency: 'IDR',
      date: '2026-03-01',
    })

    const wallets = await db.wallets.toArray()
    const balances = await getAllWalletBalances(wallets)

    expect(balances.find((w) => w.id === w1Id)?.currentBalance).toBe(400000)
    expect(balances.find((w) => w.id === w2Id)?.currentBalance).toBe(250000)
  })
})
