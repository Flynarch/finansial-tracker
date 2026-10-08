// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { handleTransactionAction } from '../src/lib/ai/chatActions/transactionActions'
import TransactionSuccess from '../src/components/chat/TransactionSuccess'
import DeleteConfirmCard from '../src/components/chat/DeleteConfirmCard'
import AiDigitalReceipt from '../src/components/chat/AiDigitalReceipt'
import TransactionDetailSheet from '../src/components/transactions/TransactionDetailSheet'
import { createTransaction } from '../src/services/transactionService'
import * as fieldEncryption from '../src/lib/fieldEncryption'

vi.mock('../src/services/transactionService', () => ({
  createTransaction: vi.fn().mockResolvedValue(999),
  updateTransaction: vi.fn().mockResolvedValue(1),
  deleteTransaction: vi.fn().mockResolvedValue(1),
}))

vi.mock('../src/lib/db', () => ({
  db: {
    transactions: {
      toArray: vi.fn().mockResolvedValue([]),
    },
  },
}))

describe('AI Receipt Integrity, Decryption Warmup & UX Polish', () => {
  const wallets = [
    { id: 1, name: 'BCA Utama', currency: 'IDR' },
    { id: 2, name: 'Bank Jago', currency: 'IDR' },
    { id: 3, name: 'Wise USD', currency: 'USD' },
  ]

  const rates = {
    USD: 1,
    IDR: 16000,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Receipt Image Attachment & Cross-Currency Transfer', () => {
    it('persists receiptImage from actionContext into txToSave on transaction creation', async () => {
      const mockReceiptImage = 'data:image/jpeg;base64,mockReceiptBase64Data123'
      const result = {
        action: 'create',
        transactions: [
          {
            amount: 50000,
            type: 'expense',
            category: 'makanan/restoran',
            notes: 'Makan Siang Resto',
            walletId: 1,
          },
        ],
      }

      const msgs = await handleTransactionAction(result, {
        locale: 'id',
        defaultCurrency: 'IDR',
        wallets,
        receiptImage: mockReceiptImage,
        rates,
      })

      expect(msgs.length).toBe(1)
      expect(createTransaction).toHaveBeenCalledTimes(1)
      expect(createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          receiptImage: mockReceiptImage,
          amount: 50000,
          category: expect.stringMatching(/makanan/),
        })
      )
    })

    it('calculates targetAmount and targetCurrency for cross-currency transfers', async () => {
      const result = {
        action: 'create',
        transactions: [
          {
            amount: 160000, // IDR
            type: 'transfer',
            category: 'transfer/umum',
            notes: 'Transfer ke Wise USD',
            walletId: 1, // IDR
            targetWalletId: 3, // USD
          },
        ],
      }

      const msgs = await handleTransactionAction(result, {
        locale: 'id',
        defaultCurrency: 'IDR',
        wallets,
        rates,
      })

      expect(msgs.length).toBe(1)
      expect(createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'transfer',
          walletId: 1,
          targetWalletId: 3,
          targetCurrency: 'USD',
          targetAmount: 10, // 160000 IDR / 16000 = 10 USD
        })
      )
    })
  })

  describe('DeleteConfirmCard Decryption Warmup & Reactivity', () => {
    it('calls warmupDecryptionCache on mount and updates when ft-notes-decrypted fires', () => {
      const warmupSpy = vi.spyOn(fieldEncryption, 'warmupDecryptionCache').mockResolvedValue()
      vi.spyOn(fieldEncryption, 'isFieldEncrypted').mockImplementation((val) => typeof val === 'string' && val.startsWith('enc:v1:'))
      
      let decryptedNote = ''
      vi.spyOn(fieldEncryption, 'getDecryptedNoteSync').mockImplementation((val) => {
        if (val === 'enc:v1:secretKopi') return decryptedNote
        return val
      })

      const data = {
        id: 777,
        amount: 25000,
        currency: 'IDR',
        category: 'makanan/kopi',
        notes: 'enc:v1:secretKopi',
      }

      render(
        <DeleteConfirmCard
          msgId="msg-1"
          data={data}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      expect(warmupSpy).toHaveBeenCalledWith(expect.arrayContaining([data]))

      // Simulate asynchronous note decryption completion
      act(() => {
        decryptedNote = 'Kopi Gula Aren Special'
        window.dispatchEvent(new CustomEvent('ft-notes-decrypted'))
      })

      expect(screen.getByText('Kopi Gula Aren Special')).toBeDefined()
    })
  })

  describe('AiDigitalReceipt Decryption of Split Item Notes', () => {
    it('decrypts split items notes when onEdit is triggered', () => {
      vi.spyOn(fieldEncryption, 'isFieldEncrypted').mockReturnValue(true)
      vi.spyOn(fieldEncryption, 'getDecryptedNoteSync').mockImplementation((val) => {
        if (val === 'enc:v1:splitNote1') return 'Decrypted Item 1'
        if (val === 'enc:v1:splitNote2') return 'Decrypted Item 2'
        return val
      })

      const tx = {
        id: 888,
        amount: 60000,
        currency: 'IDR',
        type: 'expense',
        category: 'makanan',
        notes: 'Belanja gabungan',
        isSplit: true,
        splitItems: [
          { amount: 35000, category: 'makanan/kopi', notes: 'enc:v1:splitNote1' },
          { amount: 25000, category: 'makanan/snack', notes: 'enc:v1:splitNote2' },
        ],
      }

      render(
        <MemoryRouter>
          <AiDigitalReceipt
            transactions={[tx]}
            wallets={wallets}
            onLogAnother={vi.fn()}
            onClose={vi.fn()}
          />
        </MemoryRouter>
      )

      const editBtn = screen.getByRole('button', { name: /Edit/i })
      fireEvent.click(editBtn)

      expect(screen.getByDisplayValue('Decrypted Item 1')).toBeDefined()
      expect(screen.getByDisplayValue('Decrypted Item 2')).toBeDefined()
    })
  })

  describe('TransactionSuccess Transfer Route Formatting', () => {
    it('displays Source -> Target wallet name format for transfer transactions', () => {
      const transferTx = {
        id: 991,
        type: 'transfer',
        amount: 100000,
        currency: 'IDR',
        category: 'transfer/bank',
        walletId: 1, // BCA Utama
        targetWalletId: 2, // Bank Jago
        notes: 'Pindah saldo bulanan',
      }

      render(
        <MemoryRouter>
          <TransactionSuccess
            data={transferTx}
            wallets={wallets}
          />
        </MemoryRouter>
      )

      expect(screen.getByText('BCA Utama -> Bank Jago')).toBeDefined()
    })
  })

  describe('TransactionDetailSheet Itemized OCR Receipt Breakdown', () => {
    it('renders OCR breakdown items, subtotal, tax, and discount correctly', () => {
      const ocrTx = {
        id: 992,
        type: 'expense',
        amount: 88000,
        currency: 'IDR',
        category: 'makanan/restoran',
        walletId: 1,
        date: '2026-10-08',
        time: '12:00',
        items: [
          { name: 'Nasi Goreng Spesial', price: 45000, qty: 1 },
          { name: 'Es Teh Manis', price: 15000, qty: 2 },
        ],
        subtotal: 75000,
        tax: 8000,
        discount: 5000,
      }

      render(
        <TransactionDetailSheet
          isOpen={true}
          onClose={vi.fn()}
          transaction={ocrTx}
          wallets={wallets}
          defaultCurrency="IDR"
          formatCurrency={(val, curr) => `${curr || 'Rp'} ${Number(val).toLocaleString('id-ID')}`}
          convertCurrency={(val) => val}
          locale="id"
          t={(key, def, opts) => {
            if (opts?.count !== undefined) return def.replace('{{count}}', opts.count)
            return def || key
          }}
        />
      )

      // Check item headers and lines
      expect(screen.getByText('Rincian Item Struk (2)')).toBeDefined()
      expect(screen.getByText('Nasi Goreng Spesial')).toBeDefined()
      expect(screen.getByText('Es Teh Manis')).toBeDefined()
      expect(screen.getByText('x2')).toBeDefined()

      // Check subtotal, tax, discount lines
      expect(screen.getByText('Subtotal')).toBeDefined()
      expect(screen.getByText('Pajak (PPN/PB1)')).toBeDefined()
      expect(screen.getByText('Diskon')).toBeDefined()
      expect(screen.getByText('+IDR 8.000')).toBeDefined()
      expect(screen.getByText('-IDR 5.000')).toBeDefined()
    })
  })
})
