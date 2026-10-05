// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { encryptField, decryptField } from '../src/lib/fieldEncryption'

describe('Calendar Indicators & Split Fallback Suite', () => {
  function computeIndicators({ transactions = [], importantEvents = [], loans = [], todos = [], selectedDate = new Date('2026-04-10') }) {
    const map = new Map()
    const toDateOnlyString = (d) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const bump = (dateKey, patch) => {
      const prev = map.get(dateKey) || { income: 0, expense: 0, reminder: 0 }
      map.set(dateKey, { ...prev, ...patch })
    }

    transactions.forEach((tx) => {
      if (!tx?.date || tx.isPendingReview === true || tx.isPendingReview === 1) return
      const dateKey = String(tx.date).slice(0, 10)
      const prev = map.get(dateKey) || { income: 0, expense: 0, reminder: 0 }
      let inc = 0
      let exp = 0
      if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
        tx.splitItems.forEach((si) => {
          const itemType = si.type || tx.type
          if (itemType === 'income') inc++
          else if (itemType === 'expense') exp++
        })
      } else {
        if (tx.type === 'income') inc++
        else if (tx.type === 'expense') exp++
      }
      map.set(dateKey, {
        ...prev,
        income: prev.income + inc,
        expense: prev.expense + exp,
      })
    })

    importantEvents.forEach((ev) => {
      if (!ev?.date) return
      const dateKey = String(ev.date).slice(0, 10)
      const prev = map.get(dateKey) || { income: 0, expense: 0, reminder: 0 }
      map.set(dateKey, { ...prev, reminder: prev.reminder + 1 })
    })

    loans.forEach((l) => {
      if (!l?.dueDate) return
      if (l.status === 'paid' || l.status === 'forgiven' || Number(l.remainingAmount ?? l.totalAmount) <= 0) return
      const dateKey = String(l.dueDate).slice(0, 10)
      const prev = map.get(dateKey) || { income: 0, expense: 0, reminder: 0 }
      map.set(dateKey, { ...prev, reminder: prev.reminder + 1 })
    })

    todos.forEach((td) => {
      if (!td?.dueDate) return
      const dateKey = String(td.dueDate).slice(0, 10)
      const prev = map.get(dateKey) || { income: 0, expense: 0, reminder: 0 }
      map.set(dateKey, { ...prev, reminder: prev.reminder + 1 })
    })

    bump(toDateOnlyString(selectedDate), {})
    return map
  }

  it('correctly normalizes timestamped ISO strings to YYYY-MM-DD keys for indicator lookup', () => {
    const transactions = [
      { id: 1, date: '2026-04-10T14:30:00Z', type: 'expense', amount: 50000 },
      { id: 2, date: '2026-04-10T18:45:00.000Z', type: 'income', amount: 150000 },
    ]
    const importantEvents = [
      { id: 1, date: '2026-04-10T09:00:00', title: 'Rapat Keuangan' },
    ]
    const loans = [
      { id: 1, dueDate: '2026-04-10T23:59:59', title: 'Hutang Bank', status: 'active', remainingAmount: 500000 },
    ]
    const todos = [
      { id: 1, dueDate: '2026-04-10T10:00:00', title: 'Bayar Wifi', completed: false },
    ]

    const map = computeIndicators({ transactions, importantEvents, loans, todos })
    const dayData = map.get('2026-04-10')

    expect(dayData).toBeDefined()
    expect(dayData.expense).toBe(1)
    expect(dayData.income).toBe(1)
    expect(dayData.reminder).toBe(3) // 1 event + 1 active loan + 1 todo
  })

  it('correctly handles split item fallback to parent transaction type', () => {
    const incomeSplitTx = {
      id: 10,
      date: '2026-04-10',
      type: 'income',
      isSplit: true,
      splitItems: [
        { category: 'bonus', amount: 100000 }, // omitted si.type -> must inherit parent 'income'
        { category: 'gaji', amount: 200000, type: 'income' },
      ],
    }

    const map = computeIndicators({ transactions: [incomeSplitTx] })
    const dayData = map.get('2026-04-10')

    expect(dayData.income).toBe(2)
    expect(dayData.expense).toBe(0)
  })

  it('excludes paid and forgiven loans from calendar reminder count', () => {
    const loans = [
      { id: 1, dueDate: '2026-04-10', title: 'Paid Loan', status: 'paid', remainingAmount: 0 },
      { id: 2, dueDate: '2026-04-10', title: 'Forgiven Loan', status: 'forgiven', remainingAmount: 100000 },
      { id: 3, dueDate: '2026-04-10', title: 'Zero Balance Loan', status: 'active', remainingAmount: 0 },
      { id: 4, dueDate: '2026-04-10', title: 'Active Loan', status: 'active', remainingAmount: 250000 },
    ]

    const map = computeIndicators({ loans })
    const dayData = map.get('2026-04-10')

    expect(dayData.reminder).toBe(1) // Only loan #4 is active with remaining balance > 0
  })
})

describe('Savings Transactions Envelope Encryption Suite', () => {
  it('encrypts raw savings transaction notes with enc:v1: prefix', async () => {
    const rawNote = 'Pencairan Tabungan: Liburan Jepang ke Bank Mandiri'
    const encrypted = await encryptField(rawNote)

    expect(encrypted).toMatch(/^enc:v1:/)
    const decrypted = await decryptField(encrypted)
    expect(decrypted).toBe(rawNote)
  })

  it('encrypts deposit notes with enc:v1: and supports round-trip decryption', async () => {
    const rawNote = 'Setor ke Tabungan: Dana Darurat'
    const encrypted = await encryptField(rawNote)

    expect(encrypted).toMatch(/^enc:v1:/)
    const decrypted = await decryptField(encrypted)
    expect(decrypted).toBe(rawNote)
  })
})
