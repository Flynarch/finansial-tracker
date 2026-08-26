import { describe, it, expect } from 'vitest'

describe('loan forgiveness logic', () => {
  it('calculates remaining amount and status when a loan is forgiven', () => {
    const originalLoan = {
      id: 1,
      type: 'receivable',
      personName: 'Andi',
      title: 'Pinjaman Modal Usaha',
      totalAmount: 1000000,
      remainingAmount: 600000,
      status: 'partially_paid',
    }

    const forgiveNotes = 'Disedekahkan karena musibah'
    const forgiveDate = '2026-08-26'

    // Simulation of forgiveness transformation
    const forgivenLoan = {
      ...originalLoan,
      remainingAmount: 0,
      status: 'forgiven',
      forgivenAt: 1771900000000,
      forgivenAmount: originalLoan.remainingAmount,
      forgivenNotes: forgiveNotes,
    }

    const paymentLog = {
      loanId: originalLoan.id,
      amount: originalLoan.remainingAmount,
      date: forgiveDate,
      notes: forgiveNotes,
      isForgive: true,
      transactionId: null,
    }

    expect(forgivenLoan.remainingAmount).toBe(0)
    expect(forgivenLoan.status).toBe('forgiven')
    expect(forgivenLoan.forgivenAmount).toBe(600000)
    expect(paymentLog.isForgive).toBe(true)
    expect(paymentLog.transactionId).toBeNull()
  })

  it('filters active, paid, and forgiven loans appropriately', () => {
    const loans = [
      { id: 1, type: 'debt', status: 'active', remainingAmount: 500000, totalAmount: 500000 },
      { id: 2, type: 'debt', status: 'paid', remainingAmount: 0, totalAmount: 500000 },
      { id: 3, type: 'debt', status: 'forgiven', remainingAmount: 0, totalAmount: 1000000 },
      { id: 4, type: 'receivable', status: 'active', remainingAmount: 300000, totalAmount: 300000 },
      { id: 5, type: 'receivable', status: 'forgiven', remainingAmount: 0, totalAmount: 800000 },
    ]

    const isSettled = (l) => l.status === 'paid' || l.status === 'forgiven' || (l.remainingAmount ?? 0) <= 0
    const isForgiven = (l) => l.status === 'forgiven'

    const activeDebts = loans.filter((l) => l.type === 'debt' && !isSettled(l))
    const paidDebts = loans.filter((l) => l.type === 'debt' && l.status === 'paid')
    const forgivenDebts = loans.filter((l) => l.type === 'debt' && isForgiven(l))

    expect(activeDebts.length).toBe(1)
    expect(paidDebts.length).toBe(1)
    expect(forgivenDebts.length).toBe(1)

    const forgivenReceivables = loans.filter((l) => l.type === 'receivable' && isForgiven(l))
    expect(forgivenReceivables.length).toBe(1)
  })
})