import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../src/lib/ai/promptBuilder'

describe('AI Financial Chat - Context & Mutation Masterplan', () => {
  it('injects recent transactions with ID, wallet name, category, and notes into system prompt', () => {
    const wallets = [
      { id: 1, name: 'Dompet Tunai', currency: 'IDR' },
      { id: 2, name: 'DANA', currency: 'IDR' },
      { id: 3, name: 'BCA Utama', currency: 'IDR' },
    ]

    const recentTransactions = [
      {
        id: 42,
        date: '2026-08-30',
        type: 'income',
        amount: 50000,
        currency: 'IDR',
        category: 'uang_jajan/uang_saku',
        walletId: 2,
        notes: '[Auto: DANA] Top up saldo',
      },
      {
        id: 41,
        date: '2026-08-30',
        type: 'expense',
        amount: 25000,
        currency: 'IDR',
        category: 'makanMinum/kopi',
        walletId: 3,
        notes: 'Kopi Kenangan Mantan',
      },
    ]

    const prompt = buildSystemPrompt({
      todayStr: '2026-08-30',
      currency: 'IDR',
      locale: 'id',
      wallets,
      recentTransactions,
    })

    expect(prompt).toContain('[ID: 42]')
    expect(prompt).toContain('Pemasukan IDR 50.000')
    expect(prompt).toContain('Dompet: DANA')
    expect(prompt).toContain('[Auto: DANA] Top up saldo')
    expect(prompt).toContain('[ID: 41]')
    expect(prompt).toContain('Pengeluaran IDR 25.000')
    expect(prompt).toContain('Dompet: BCA Utama')
    expect(prompt).toContain('Kopi Kenangan Mantan')
    expect(prompt).toContain('update_transaction')
  })

  it('provides editing guidance for natural language queries like "transaksi tadi"', () => {
    const prompt = buildSystemPrompt({
      todayStr: '2026-08-30',
      currency: 'IDR',
      locale: 'id',
      wallets: [{ id: 1, name: 'Cash', currency: 'IDR' }],
      recentTransactions: [],
    })

    expect(prompt).toContain('KETENTUAN PENGELOLAAN & EDIT TRANSAKSI')
    expect(prompt).toContain('update_transaction')
    expect(prompt).toContain('delete_transaction')
  })
})
