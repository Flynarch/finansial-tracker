import { describe, it, expect } from 'vitest'
import { computeWalletBalance, computeAllWalletBalances } from '../src/lib/db'

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
})
