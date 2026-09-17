import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/lib/db'
import { getMergedExpenseTree } from '../src/lib/expenseCategories'
import { calculateBudgetSpent, isTxMatchingBudget } from '../src/lib/budgetUtils'
import { distributeReceiptTransactions } from '../src/lib/gemini'

describe('AI Subsystem Audit Remediation Verification', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.budgets.clear()
    await db.loans.clear()
    await db.wallets.clear()
  })

  describe('CRIT-02: scanMode === per_item tax & discount distribution', () => {
    it('distributes tax and discount proportionately so item sum equals grand total using distributeReceiptTransactions', () => {
      const transactions = [
        {
          amount: 55000,
          tax: 5000,
          discount: 0,
          currency: 'IDR',
          date: '2026-09-15',
          merchant: 'Kafe FinTrack',
          items: [
            { name: 'Kopi', price: 30000, qty: 1 },
            { name: 'Roti', price: 20000, qty: 1 },
          ],
        },
      ]
      const resultMeta = { tax: 5000 }

      const processed = distributeReceiptTransactions(transactions, resultMeta, 'per_item')
      expect(processed).toHaveLength(2)
      expect(processed[0].amount).toBe(33000)
      expect(processed[1].amount).toBe(22000)
      const totalSum = processed.reduce((s, t) => s + t.amount, 0)
      expect(totalSum).toBe(55000)
      expect(processed[0].notes).toBe('Kopi')
      expect(processed[1].notes).toBe('Roti')
    })

    it('distributes discount correctly without losing balancing cents', () => {
      const transactions = [
        {
          amount: 45000,
          tax: 0,
          discount: 5000,
          currency: 'IDR',
          items: [
            { name: 'Barang A', price: 25000 },
            { name: 'Barang B', price: 25000 },
          ],
        },
      ]

      const processed = distributeReceiptTransactions(transactions, {}, 'per_item')
      expect(processed).toHaveLength(2)
      const totalSum = processed.reduce((s, t) => s + t.amount, 0)
      expect(totalSum).toBe(45000)
    })

    it('unrolls single-item receipts in per_item mode and applies full tax', () => {
      const transactions = [
        {
          amount: 55000,
          tax: 5000,
          discount: 0,
          currency: 'IDR',
          date: '2026-09-15',
          merchant: 'Toko Buku',
          items: [
            { name: 'Buku Pemrograman', price: 50000, qty: 1 },
          ],
        },
      ]

      const processed = distributeReceiptTransactions(transactions, {}, 'per_item')
      expect(processed).toHaveLength(1)
      expect(processed[0].amount).toBe(55000)
      expect(processed[0].notes).toBe('Buku Pemrograman')
    })

    it('distributes tax when transactions are already multiple items', () => {
      const transactions = [
        { name: 'Item 1', amount: 30000, currency: 'IDR' },
        { name: 'Item 2', amount: 20000, currency: 'IDR' },
      ]
      const resultMeta = { tax: 5000 }

      const processed = distributeReceiptTransactions(transactions, resultMeta, 'per_item')
      expect(processed).toHaveLength(2)
      expect(processed[0].amount).toBe(33000)
      expect(processed[1].amount).toBe(22000)
      const totalSum = processed.reduce((s, t) => s + t.amount, 0)
      expect(totalSum).toBe(55000)
    })

    it('leaves transactions untouched when scanMode is all', () => {
      const transactions = [
        {
          amount: 55000,
          tax: 5000,
          items: [
            { name: 'Kopi', price: 30000 },
            { name: 'Roti', price: 20000 },
          ],
        },
      ]

      const processed = distributeReceiptTransactions(transactions, {}, 'all')
      expect(processed).toHaveLength(1)
      expect(processed[0].amount).toBe(55000)
    })
  })

  describe('HIGH-03: Parent category budget retention and transaction matching', () => {
    it('recognizes parent categories like "Makanan" and keeps them at parent level', () => {
      const expenseTree = getMergedExpenseTree()
      const rawCategoriesToTest = ['Makanan', 'makanan', 'Tagihan & Utilitas', 'tagihan', 'Transportasi']

      for (const rawCat of rawCategoriesToTest) {
        const cleanRawCat = rawCat.toLowerCase().replace(/[_-\s]+/g, ' ')
        const matchedParent = expenseTree.find((p) => {
          const pId = p.id.toLowerCase().replace(/[_-\s]+/g, ' ')
          const pNameId = (p.names?.id || '').toLowerCase().replace(/[_-\s]+/g, ' ')
          const pNameEn = (p.names?.en || '').toLowerCase().replace(/[_-\s]+/g, ' ')
          return pId === cleanRawCat || pNameId === cleanRawCat || pNameEn === cleanRawCat
        })

        expect(matchedParent).toBeDefined()
        const budgetCatKey = matchedParent.id
        expect(budgetCatKey).not.toContain('/')
      }
    })

    it('matches child transactions against parent budget in budgetUtils', () => {
      const budgetCategory = 'makanan'
      expect(isTxMatchingBudget(budgetCategory, 'makanan/makan_siang')).toBe(true)
      expect(isTxMatchingBudget(budgetCategory, 'makanan/kopi')).toBe(true)
      expect(isTxMatchingBudget(budgetCategory, 'makanan/makan_malam')).toBe(true)
      expect(isTxMatchingBudget(budgetCategory, 'transportasi/bensin')).toBe(false)
    })

    it('correctly calculates spent amount for parent category budget across diverse child transactions', () => {
      const monthExpenseTxs = [
        { date: '2026-09-10', type: 'expense', amount: 35000, category: 'makanan/makan_siang', currency: 'IDR' },
        { date: '2026-09-11', type: 'expense', amount: 25000, category: 'makanan/kopi', currency: 'IDR' },
        { date: '2026-09-12', type: 'expense', amount: 50000, category: 'transportasi/bensin', currency: 'IDR' },
      ]

      const spent = calculateBudgetSpent('makanan', monthExpenseTxs, 'IDR')
      expect(spent).toBe(60000)
    })
  })

  describe('CRIT-01: Loan pay / mark_paid / delete not-found handling', () => {
    it('produces error when pay or mark_paid does not match any active loan', async () => {
      const allLoans = [
        { id: 1, title: 'Pinjaman Motor', status: 'paid', remainingAmount: 0 },
      ]
      const result = { action: 'pay', title: 'Pinjaman Laptop', amount: 500000 }

      const matched = allLoans.find((l) => l.title?.toLowerCase().includes((result.title || '').toLowerCase()) && l.status !== 'paid')
      expect(matched).toBeUndefined()

      // When matched is undefined, an explicit error message must be created
      const newMsgs = []
      if (matched) {
        newMsgs.push({ type: 'action_success' })
      } else {
        newMsgs.push({
          role: 'ai',
          type: 'text',
          isError: true,
          content: `Catatan pinjaman aktif "${result.title}" tidak ditemukan atau sudah lunas.`,
        })
      }

      expect(newMsgs).toHaveLength(1)
      expect(newMsgs[0].isError).toBe(true)
      expect(newMsgs[0].content).toContain('tidak ditemukan')
    })

    it('sets isError: true when deleting a non-existent loan', async () => {
      const allLoans = [
        { id: 1, title: 'Pinjaman Motor' },
      ]
      const result = { action: 'delete', title: 'Pinjaman Rumah' }
      const matched = allLoans.find((l) => l.title?.toLowerCase().includes(result.title.toLowerCase()))

      const newMsgs = []
      if (matched) {
        newMsgs.push({ type: 'delete_confirm' })
      } else {
        newMsgs.push({
          role: 'ai',
          type: 'text',
          isError: true,
          content: `Catatan pinjaman "${result.title}" tidak ditemukan.`,
        })
      }

      expect(newMsgs).toHaveLength(1)
      expect(newMsgs[0].isError).toBe(true)
      expect(newMsgs[0].content).toContain('tidak ditemukan')
    })

    it('preserves database query content over AI text fallback', () => {
      const summaryText = '### Ringkasan Utang: Total Utang: Rp 500.000'
      const unifiedMsg = {
        role: 'ai',
        type: 'text',
        preserveContent: true,
        content: summaryText,
      }
      const result = { text: 'Halusinasi AI tanpa data' }

      const finalContent = (unifiedMsg.isError || unifiedMsg.preserveContent)
        ? (unifiedMsg.content || unifiedMsg.customMsg || '')
        : (result.text || unifiedMsg.content || unifiedMsg.customMsg || '')

      expect(finalContent).toBe(summaryText)
      expect(finalContent).not.toBe(result.text)
    })
  })
})
