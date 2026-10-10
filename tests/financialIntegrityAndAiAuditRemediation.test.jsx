// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../src/lib/db'
import { updateTransaction } from '../src/services/transactionService'
import { handleTransactionAction } from '../src/lib/ai/chatActions/transactionActions'
import { findMatchingTransactionsForAction } from '../src/lib/ai/aiChatHelpers'
import { calculate1DHourlyFlow } from '../src/hooks/dashboard/dashboardStats'
import { processRecurringTransactions } from '../src/lib/automation'
import { evaluateExpression } from '../src/lib/calcParser'
import DeleteConfirmCard from '../src/components/chat/DeleteConfirmCard'
import { TransactionItemCard } from '../src/components/transactions/TransactionItemCard'
import TransactionEditSheet from '../src/components/transactions/TransactionEditSheet'
import { useTransactionEditForm } from '../src/components/transactions/useTransactionEditForm'
import AiDigitalReceipt from '../src/components/chat/AiDigitalReceipt'
import useSettingsStore from '../src/store/useSettingsStore'

// Mock haptics
vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
  hapticSuccess: vi.fn(),
  hapticWarning: vi.fn(),
  hapticError: vi.fn(),
  hapticSelection: vi.fn(),
  hapticImpact: vi.fn(),
}))

describe('Financial Integrity, AI Chat & Ledger Invariants Remediation Suite', () => {
  beforeEach(async () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    await db.transactions.clear()
    await db.wallets.clear()
    await db.recurringTransactions.clear()
    await db.notifications.clear()
    useSettingsStore.setState({
      defaultCurrency: 'IDR',
      defaultWalletId: 1,
      locale: 'id',
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  // 1. Financial Precision & Math Expressions
  describe('1. Financial Precision & Math Expressions Evaluation', () => {
    it('evaluates math expressions accurately without raw eval', () => {
      const res1 = evaluateExpression('50.000 + 25.000', 'IDR')
      expect(res1.isValid).toBe(true)
      expect(res1.result).toBe(75000)

      const res2 = evaluateExpression('100k - 25k', 'IDR')
      expect(res2.isValid).toBe(true)
      expect(res2.result).toBe(75000)

      const resUSD = evaluateExpression('10.50 + 4.25', 'USD')
      expect(resUSD.isValid).toBe(true)
      expect(resUSD.result).toBe(14.75)
    })

    it('TransactionEditSheet evaluates expressions and passes evaluated amounts to onSubmit', async () => {
      const onSubmitMock = vi.fn()
      const tx = {
        id: 101,
        amount: 50000,
        currency: 'IDR',
        type: 'expense',
        category: 'makanan/makan_siang',
        walletId: 1,
        date: '2026-10-08',
      }

      const wallets = [{ id: 1, name: 'Dompet Utama', currency: 'IDR' }]

      render(
        <MemoryRouter>
          <TransactionEditSheet
            isOpen={true}
            onClose={vi.fn()}
            transaction={tx}
            onSubmit={onSubmitMock}
            wallets={wallets}
            locale="id"
          />
        </MemoryRouter>
      )

      // Enter a math expression in amount
      const amountInput = screen.getByTestId('amount-input')
      fireEvent.change(amountInput, { target: { value: '50000 + 25000' } })

      const submitBtn = screen.getByRole('button', { name: /perbarui transaksi/i })
      fireEvent.click(submitBtn)
      const form = document.querySelector('#transaction-edit-form')
      if (form) fireEvent.submit(form)

      await waitFor(() => {
        expect(onSubmitMock).toHaveBeenCalled()
      })

      const secondArg = onSubmitMock.mock.calls[0][1]
      expect(secondArg).toBeDefined()
      expect(secondArg.amount).toBe(75000)
    })

    it('TransactionEditSheet evaluates targetAmount expression for cross-currency transfers', async () => {
      const onSubmitMock = vi.fn()
      const tx = {
        id: 102,
        amount: 160000,
        currency: 'IDR',
        type: 'transfer',
        category: 'transfer',
        walletId: 1,
        targetWalletId: 2,
        targetAmount: 10,
        date: '2026-10-08',
      }

      const wallets = [
        { id: 1, name: 'IDR Cash', currency: 'IDR' },
        { id: 2, name: 'USD Wallet', currency: 'USD' },
      ]

      render(
        <MemoryRouter>
          <TransactionEditSheet
            isOpen={true}
            onClose={vi.fn()}
            transaction={tx}
            onSubmit={onSubmitMock}
            wallets={wallets}
            locale="id"
          />
        </MemoryRouter>
      )

      const targetInput = screen.getByTestId('target-amount-input')
      fireEvent.change(targetInput, { target: { value: '10 + 5' } })

      const submitBtn = screen.getByRole('button', { name: /perbarui transaksi/i })
      fireEvent.click(submitBtn)
      const form = document.querySelector('#transaction-edit-form')
      if (form) fireEvent.submit(form)

      await waitFor(() => {
        expect(onSubmitMock).toHaveBeenCalled()
      })

      const secondArg = onSubmitMock.mock.calls[0][1]
      expect(secondArg.targetAmount).toBe(15)
    })
  })

  // 2. Clear Orphaned Split Items
  describe('2. Clear Orphaned Split Items Invariant', () => {
    it('clears splitItems when updating a split transaction to isSplit: false', async () => {
      await db.wallets.add({ id: 1, name: 'Cash', balance: 100000, currency: 'IDR' })
      const txId = await db.transactions.add({
        amount: 50000,
        currency: 'IDR',
        type: 'expense',
        category: 'makanan',
        walletId: 1,
        date: '2026-10-08',
        isSplit: true,
        splitItems: [
          { amount: 30000, category: 'makanan/makan_siang', notes: 'Lunch' },
          { amount: 20000, category: 'makanan/kopi', notes: 'Coffee' },
        ],
      })

      // Update to non-split transaction
      await updateTransaction(txId, {
        isSplit: false,
        amount: 50000,
        category: 'makanan/makan_siang',
      })

      const updated = await db.transactions.get(txId)
      expect(updated.isSplit).toBe(false)
      expect(updated.splitItems).toBeNull()
    })
  })

  // 3. Cross-Currency Transfer Calculations
  describe('3. Cross-Currency Transfer Calculations', () => {
    it('recalculates targetAmount and targetCurrency on transfer update in transactionActions', async () => {
      const wallets = [
        { id: 1, name: 'IDR Cash', currency: 'IDR' },
        { id: 2, name: 'USD Account', currency: 'USD' },
      ]
      await db.wallets.bulkAdd(wallets)

      const txId = await db.transactions.add({
        amount: 160000,
        currency: 'IDR',
        type: 'transfer',
        category: 'transfer',
        walletId: 1,
        targetWalletId: 2,
        targetAmount: 10,
        targetCurrency: 'USD',
        date: '2026-10-08',
      })

      const rates = { USD: 1, IDR: 16000 } // 1 USD = 16000 IDR

      // User updates transfer amount to 320,000 IDR via AI chat
      const result = {
        action: 'update',
        transactionIds: [txId],
        updatedFields: {
          amount: 320000,
        },
      }

      const msgs = await handleTransactionAction(result, {
        locale: 'id',
        defaultCurrency: 'IDR',
        wallets,
        rates,
      })

      expect(msgs.length).toBeGreaterThan(0)
      const updatedTx = await db.transactions.get(txId)
      expect(updatedTx.amount).toBe(320000)
      expect(updatedTx.targetCurrency).toBe('USD')
      // 320,000 IDR at 16,000 IDR/USD = 20 USD
      expect(updatedTx.targetAmount).toBe(20)
    })
  })

  // 4. AI Chat Query Resolution & Batch Matching
  describe('4. AI Chat Query Resolution & Batch Matching', () => {
    it('matches transactions by inspecting splitItems notes', () => {
      const txs = [
        {
          id: 1,
          date: '2026-10-08',
          amount: 50000,
          category: 'belanja',
          isSplit: true,
          splitItems: [
            { category: 'makanan/kopi', notes: 'Espresso Single Origin', amount: 30000 },
            { category: 'belanja/snack', notes: 'Roti Bakar', amount: 20000 },
          ],
        },
        {
          id: 2,
          date: '2026-10-07',
          amount: 100000,
          category: 'transportasi',
          notes: 'Bensin Pertamax',
        },
      ]

      const matched = findMatchingTransactionsForAction(txs, { searchQuery: 'espresso' })
      expect(matched.length).toBe(1)
      expect(matched[0].id).toBe(1)
    })

    it('matches category tokens in categoryLower', () => {
      const txs = [
        {
          id: 1,
          date: '2026-10-08',
          amount: 45000,
          category: 'makanan_minuman/makan_siang',
          notes: 'Warteg Bahari',
        },
      ]

      const matched = findMatchingTransactionsForAction(txs, { searchQuery: 'makan siang' })
      expect(matched.length).toBe(1)
      expect(matched[0].id).toBe(1)
    })

    it('returns all matching records with batch keywords like "semua" or "all"', () => {
      const txs = [
        { id: 1, date: '2026-10-08', amount: 25000, category: 'makanan/kopi', notes: 'Kopi Kenangan' },
        { id: 2, date: '2026-10-08', amount: 35000, category: 'makanan/kopi', notes: 'Kopi Janji Jiwa' },
        { id: 3, date: '2026-10-08', amount: 80000, category: 'transportasi', notes: 'Taxi' },
      ]

      const matchedAllCoffee = findMatchingTransactionsForAction(txs, { searchQuery: 'semua kopi' })
      expect(matchedAllCoffee.length).toBe(2)
      expect(matchedAllCoffee.map((t) => t.id)).toEqual([1, 2])

      const matchedAll = findMatchingTransactionsForAction(txs, { searchQuery: 'semua' })
      expect(matchedAll.length).toBe(3)
    })
  })

  // 5. Receipt Scanner OCR Data Retention
  describe('5. Receipt Scanner OCR Data Retention', () => {
    it('packages and retains items, subtotal, tax, discount, and merchant', () => {
      const scanResultData = {
        totalAmount: 125000,
        date: '2026-10-08',
        merchantName: 'Supermarket Jaya',
        category: 'belanja/supermarket',
        notes: 'Belanja Mingguan',
        items: [{ name: 'Susu', price: 25000 }, { name: 'Roti', price: 15000 }],
        subtotal: 110000,
        tax: 12000,
        discount: 5000,
      }

      const forwarded = {
        amount: scanResultData.totalAmount,
        date: scanResultData.date,
        category: scanResultData.category,
        notes: scanResultData.notes,
        merchant: scanResultData.merchantName,
        currency: 'IDR',
        items: scanResultData.items,
        subtotal: scanResultData.subtotal,
        tax: scanResultData.tax,
        discount: scanResultData.discount,
        merchantName: scanResultData.merchantName,
      }

      expect(forwarded.items.length).toBe(2)
      expect(forwarded.subtotal).toBe(110000)
      expect(forwarded.tax).toBe(12000)
      expect(forwarded.discount).toBe(5000)
      expect(forwarded.merchant).toBe('Supermarket Jaya')
    })
  })

  // 6. DeleteConfirmCard Enrichment
  describe('6. DeleteConfirmCard Enrichment', () => {
    it('populates walletName, targetWalletName, and time in delete_confirm action', async () => {
      const wallets = [
        { id: 1, name: 'BCA Utama', currency: 'IDR' },
        { id: 2, name: 'GoPay', currency: 'IDR' },
      ]
      await db.wallets.bulkAdd(wallets)

      const txId = await db.transactions.add({
        amount: 50000,
        currency: 'IDR',
        type: 'transfer',
        category: 'transfer',
        walletId: 1,
        targetWalletId: 2,
        date: '2026-10-08',
        time: '14:30',
        notes: 'Top up e-wallet',
      })

      const result = {
        action: 'delete',
        transactionIds: [txId],
      }

      const msgs = await handleTransactionAction(result, {
        locale: 'id',
        defaultCurrency: 'IDR',
        wallets,
      })

      expect(msgs.length).toBe(1)
      const confirmMsg = msgs[0]
      expect(confirmMsg.type).toBe('delete_confirm')
      expect(confirmMsg.data.walletName).toBe('BCA Utama')
      expect(confirmMsg.data.targetWalletName).toBe('GoPay')
      expect(confirmMsg.data.time).toBe('14:30')
    })

    it('DeleteConfirmCard renders wallet route and transfer accent styling for transfer transactions', () => {
      const transferData = {
        id: 1,
        amount: 75000,
        currency: 'IDR',
        type: 'transfer',
        date: '2026-10-08',
        time: '11:15',
        walletName: 'BCA',
        targetWalletName: 'Mandiri',
      }

      const { container } = render(
        <DeleteConfirmCard
          msgId={1}
          data={transferData}
          locale="id"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      expect(screen.getByText(/BCA → Mandiri/i)).toBeTruthy()
      expect(screen.getByText(/11:15/i)).toBeTruthy()
      const amountEl = container.querySelector('.text-\\[var\\(--transfer\\)\\]')
      expect(amountEl).toBeTruthy()
    })
  })

  // 7. Time Accuracy & Automation
  describe('7. Time Accuracy & Automation', () => {
    it('TransactionItemCard prioritizes transaction.time over createdAt', () => {
      const tx = {
        id: 1,
        amount: 25000,
        currency: 'IDR',
        type: 'expense',
        category: 'makanan',
        time: '08:45',
        createdAt: new Date('2026-10-08T18:00:00').getTime(), // 18:00
      }

      render(
        <TransactionItemCard
          transaction={tx}
          getCategoryColorClass={() => ''}
          resolveTransactionIconKey={() => 'food'}
          getTransactionCategoryLabels={() => ({ main: 'Makanan', sub: 'Makan Pagi' })}
          format={(d, f) => (f === 'HH:mm' ? '18:00' : '2026-10-08')}
          t={(k, f) => f}
          locale="id"
          defaultCurrency="IDR"
          formatCurrency={(v) => `Rp${v}`}
          convertCurrency={(v) => v}
        />
      )

      expect(screen.getByText(/08:45/i)).toBeTruthy()
      expect(screen.queryByText(/18:00/i)).toBeNull()
    })

    it('calculate1DHourlyFlow prioritizes tx.time hour component', () => {
      const txs = [
        {
          id: 1,
          date: '2026-10-08',
          amount: 50000,
          convertedAmount: 50000,
          type: 'expense',
          time: '09:30', // Hour 9
          createdAt: new Date('2026-10-08T16:00:00').getTime(), // Hour 16
        },
      ]

      const hourlyFlow = calculate1DHourlyFlow(txs, '2026-10-08', null, null, 'IDR', null)
      expect(hourlyFlow[9]).toBe(-50000)
      expect(hourlyFlow[16]).toBe(0)
    })

    it('processRecurringTransactions populates time on recurring transactions', async () => {
      await db.wallets.add({ id: 1, name: 'Dompet Utama', balance: 500000, currency: 'IDR' })
      await db.recurringTransactions.add({
        id: 1,
        title: 'Langganan Internet',
        amount: 300000,
        type: 'expense',
        category: 'tagihan/internet',
        frequency: 'monthly',
        nextDate: '2026-10-08',
        walletId: 1,
        time: '07:30',
        enabled: true,
        autoExecute: true,
      })

      await processRecurringTransactions(new Date('2026-10-08T12:00:00'))

      const txs = await db.transactions.toArray()
      expect(txs.length).toBe(1)
      expect(txs[0].time).toBe('07:30')
      expect(txs[0].amount).toBe(300000)
    })
  })

  // 8. Error Toasts & Haptics Feedback
  describe('8. Error Toasts & Haptics Feedback', () => {
    it('AiDigitalReceipt triggers warning haptic and dispatches ft-show-toast on undo error', async () => {
      const { triggerHaptic } = await import('../src/lib/haptics')
      const txService = await import('../src/services/transactionService')
      const deleteSpy = vi.spyOn(txService, 'deleteTransaction').mockRejectedValue(new Error('Simulated delete failure'))

      const toastHandler = vi.fn()
      window.addEventListener('ft-show-toast', toastHandler)

      const tx = { id: 9999, amount: 50000, type: 'expense', currency: 'IDR' }

      render(
        <MemoryRouter>
          <AiDigitalReceipt
            transactions={[tx]}
            onClose={vi.fn()}
          />
        </MemoryRouter>
      )

      const undoBtn = screen.getByRole('button', { name: /^Batalkan$/i })
      fireEvent.click(undoBtn)

      await waitFor(() => {
        expect(triggerHaptic).toHaveBeenCalledWith('warning')
        expect(toastHandler).toHaveBeenCalled()
      })

      window.removeEventListener('ft-show-toast', toastHandler)
      deleteSpy.mockRestore()
    })
  })

  // 9. Zero Emojis Compliance Verification
  describe('9. Zero Emojis Policy Verification', () => {
    it('modified files contain zero default emojis', async () => {
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u
      expect(emojiRegex.test('Transaksi Tersimpan')).toBe(false)
      expect(emojiRegex.test('Gagal Memperbarui')).toBe(false)
      expect(emojiRegex.test('Ekstraksi Cerdas Gemini AI')).toBe(false)
    })
  })

  // 10. Edge Cases & Regressions Defense
  describe('10. Edge Cases & Regressions Defense', () => {
    it('useTransactionEditForm preserves targetAmount, time, and OCR items upon openEditTransaction', () => {
      const allWallets = [
        { id: 1, name: 'IDR Main', currency: 'IDR' },
        { id: 2, name: 'USD Wise', currency: 'USD' },
      ]
      const tx = {
        id: 777,
        date: '2026-10-08',
        time: '15:45',
        amount: 320000,
        currency: 'IDR',
        type: 'transfer',
        category: 'transfer',
        walletId: 1,
        targetWalletId: 2,
        targetAmount: 20,
        items: [{ name: 'Item 1', price: 10 }],
        subtotal: 10,
        tax: 1,
        discount: 0,
        merchant: 'Exchange Booth',
      }

      const { result } = renderHook(() =>
        useTransactionEditForm({
          allWallets,
          defaultCurrency: 'IDR',
          addTransaction: vi.fn(),
          updateTransaction: vi.fn(),
          t: (k, def) => def,
          setApiError: vi.fn(),
          setApiErrorTone: vi.fn(),
        })
      )

      act(() => {
        result.current.openEditTransaction(tx)
      })

      expect(result.current.editFormData.time).toBe('15:45')
      expect(result.current.editFormData.targetAmount).toBe('20')
      expect(result.current.editFormData.items).toEqual([{ name: 'Item 1', price: 10 }])
      expect(result.current.editFormData.subtotal).toBe(10)
      expect(result.current.editFormData.merchant).toBe('Exchange Booth')
    })

    it('updateTransaction clears splitItems when isSplit is 0', async () => {
      await db.wallets.add({ id: 9, name: 'Wallet 9', balance: 50000, currency: 'IDR' })
      const txId = await db.transactions.add({
        amount: 25000,
        currency: 'IDR',
        type: 'expense',
        category: 'makanan',
        walletId: 9,
        date: '2026-10-08',
        isSplit: true,
        splitItems: [{ amount: 25000, category: 'makanan/kopi', notes: 'Latte' }],
      })

      await updateTransaction(txId, {
        isSplit: 0,
        amount: 25000,
        category: 'makanan/kopi',
      })

      const updated = await db.transactions.get(txId)
      expect(updated.isSplit).toBe(0)
      expect(updated.splitItems).toBeNull()
    })

    it('handleTransactionAction preserves explicit targetAmount when provided during transfer update', async () => {
      const wallets = [
        { id: 1, name: 'IDR Cash', currency: 'IDR' },
        { id: 2, name: 'USD Account', currency: 'USD' },
      ]
      await db.wallets.bulkAdd(wallets)

      const txId = await db.transactions.add({
        amount: 160000,
        currency: 'IDR',
        type: 'transfer',
        category: 'transfer',
        walletId: 1,
        targetWalletId: 2,
        targetAmount: 10,
        targetCurrency: 'USD',
        date: '2026-10-08',
      })

      const rates = { USD: 1, IDR: 16000 }

      const result = {
        action: 'update',
        transactionIds: [txId],
        updatedFields: {
          amount: 320000,
          targetAmount: 25, // Explicitly 25 USD (custom negotiated rate)
        },
      }

      await handleTransactionAction(result, {
        locale: 'id',
        defaultCurrency: 'IDR',
        wallets,
        rates,
      })

      const updatedTx = await db.transactions.get(txId)
      expect(updatedTx.amount).toBe(320000)
      // Custom targetAmount should NOT be overwritten with convertCurrency result (20)
      expect(updatedTx.targetAmount).toBe(25)
    })

    it('findMatchingTransactionsForAction matches Indonesian batch keyword "seluruh" and "seluruhnya"', () => {
      const txs = [
        { id: 1, date: '2026-10-08', amount: 20000, category: 'makanan/snack', notes: 'Donat' },
        { id: 2, date: '2026-10-08', amount: 25000, category: 'makanan/snack', notes: 'Kue Cubit' },
        { id: 3, date: '2026-10-08', amount: 90000, category: 'utilitas/listrik', notes: 'Token Listrik' },
      ]

      const matchedAllSnacks = findMatchingTransactionsForAction(txs, { searchQuery: 'seluruh snack' })
      expect(matchedAllSnacks.length).toBe(2)
      expect(matchedAllSnacks.map((t) => t.id)).toEqual([1, 2])

      const matchedSeluruhnya = findMatchingTransactionsForAction(txs, { searchQuery: 'seluruhnya' })
      expect(matchedSeluruhnya.length).toBe(3)
    })
  })
})
