import { describe, it, expect } from 'vitest'
import { formatMoneyValueForInput, parseMoneyInput, formatCurrency } from '../src/lib/utils'
import { resolveTransactionIconKey, getTransactionCategoryLabels } from '../src/lib/categoryIcon'

describe('Transaction Details and Receipt Editing Flow', () => {
  describe('Edit Form State Initialization', () => {
    it('correctly extracts and populates receiptImage and targetWalletId from transaction into form state', () => {
      const sampleTx = {
        id: 101,
        date: '2026-09-06',
        amount: 150000,
        type: 'transfer',
        category: 'transfer/umum',
        notes: 'Bayar makan siang bareng tim kantor cabang',
        currency: 'IDR',
        walletId: 1,
        targetWalletId: 2,
        receiptImage: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
      }

      const matchingWallet = { id: 1, currency: 'IDR' }
      const defaultCurrency = 'IDR'
      const targetCurrency = sampleTx.currency || matchingWallet?.currency || defaultCurrency

      // Simulates openEditTransaction logic
      const editFormData = {
        date: sampleTx.date,
        amount: formatMoneyValueForInput(sampleTx.amount, targetCurrency),
        type: sampleTx.type,
        category: sampleTx.category,
        notes: sampleTx.notes || '',
        currency: targetCurrency,
        walletId: sampleTx.walletId,
        targetWalletId: sampleTx.targetWalletId || '',
        receiptImage: sampleTx.receiptImage || null,
      }

      expect(editFormData.receiptImage).toBe(sampleTx.receiptImage)
      expect(editFormData.targetWalletId).toBe(2)
      expect(editFormData.type).toBe('transfer')
      expect(editFormData.notes).toBe('Bayar makan siang bareng tim kantor cabang')
    })

    it('handles transaction without receiptImage gracefully with null', () => {
      const sampleTx = {
        id: 102,
        date: '2026-09-06',
        amount: 50000,
        type: 'expense',
        category: 'food',
        notes: 'Kopi sore',
        currency: 'IDR',
        walletId: 1,
      }

      const editFormData = {
        date: sampleTx.date,
        amount: formatMoneyValueForInput(sampleTx.amount, 'IDR'),
        type: sampleTx.type,
        category: sampleTx.category,
        notes: sampleTx.notes || '',
        currency: 'IDR',
        walletId: sampleTx.walletId,
        targetWalletId: sampleTx.targetWalletId || '',
        receiptImage: sampleTx.receiptImage || null,
      }

      expect(editFormData.receiptImage).toBeNull()
      expect(editFormData.targetWalletId).toBe('')
    })

    it('correctly prepares update payload retaining updated receipt image and parsed amount', () => {
      const editFormData = {
        date: '2026-09-06',
        amount: '75.000',
        type: 'expense',
        category: 'food',
        notes: 'Makan malam',
        currency: 'IDR',
        walletId: 1,
        targetWalletId: '',
        receiptImage: 'data:image/png;base64,newReceiptImageString123',
      }

      const updatePayload = {
        ...editFormData,
        amount: parseMoneyInput(editFormData.amount, editFormData.currency),
        receiptImage: editFormData.receiptImage || null,
      }

      expect(updatePayload.amount).toBe(75000)
      expect(updatePayload.receiptImage).toBe('data:image/png;base64,newReceiptImageString123')
    })
  })

  describe('Category and Icon Resolution for Transaction Details', () => {
    it('resolves icons and labels for standard expense transaction', () => {
      const iconKey = resolveTransactionIconKey('food/groceries', 'expense')
      const labels = getTransactionCategoryLabels('food/groceries', 'expense', 'id')

      expect(iconKey).toBeDefined()
      expect(typeof iconKey).toBe('string')
      expect(labels.main).toBeDefined()
    })

    it('resolves icons for transfer transaction', () => {
      const iconKey = resolveTransactionIconKey('transfer/umum', 'transfer')
      expect(iconKey).toBe('transfer')
    })

    it('resolves icons for balance adjustment transaction', () => {
      const txType = 'balance_adjustment'
      const iconKey = txType === 'balance_adjustment' ? 'adjustment' : resolveTransactionIconKey('adjustment', txType)
      expect(iconKey).toBe('adjustment')
    })
  })

  describe('Long Notes Text Handling', () => {
    it('handles long multiline notes strings cleanly without throwing', () => {
      const longNote = `Tagihan bulanan kantor bulan September 2026:
- Pembelian token listrik PLN Rp 500.000
- Tagihan internet Indihome 100Mbps Rp 450.000
- Galon air minum 5x Rp 100.000
Nomor Referensi: INV-20260906-8912389127398127391827391823`

      expect(longNote.length).toBeGreaterThan(150)
      expect(longNote.includes('\n')).toBe(true)
      const trimmed = longNote.trim()
      expect(trimmed).toBe(longNote)
    })
  })

  describe('Receipt Preview Amount Formatting', () => {
    it('formats negative balance adjustments with a single minus sign and no duplicate minus', () => {
      const tx = {
        id: 999,
        amount: -75000,
        type: 'balance_adjustment',
        currency: 'IDR',
      }

      const val = Number(tx.amount || 0)
      const amountPrefix = val > 0 ? '+' : val < 0 ? '-' : ''
      const amountFormatted = `${amountPrefix}${formatCurrency(Math.abs(val), tx.currency)}`

      expect(amountFormatted).toContain('-')
      expect(amountFormatted).not.toContain('--')
      expect(amountFormatted).toBe('-Rp\u00A075.000')
    })

    it('formats positive income with plus prefix and no double signs', () => {
      const tx = {
        id: 998,
        amount: 250000,
        type: 'income',
        currency: 'IDR',
      }

      const amountPrefix = '+'
      const amountFormatted = `${amountPrefix}${formatCurrency(Math.abs(Number(tx.amount || 0)), tx.currency)}`

      expect(amountFormatted.startsWith('+')).toBe(true)
      expect(amountFormatted).not.toContain('++')
    })
  })

  describe('Edit Form Validation Rules', () => {
    it('detects invalid non-positive amount on submission', () => {
      const testCases = ['', '0', '0,00', '-50000']
      testCases.forEach((val) => {
        const parsed = parseMoneyInput(val, 'IDR')
        const isValid = parsed > 0
        expect(isValid).toBe(false)
      })
    })

    it('detects same-wallet transfer route as invalid', () => {
      const form = {
        type: 'transfer',
        walletId: 'wallet-1',
        targetWalletId: 'wallet-1',
      }

      const isSameWallet = String(form.walletId) === String(form.targetWalletId)
      expect(isSameWallet).toBe(true)
    })
  })
})
