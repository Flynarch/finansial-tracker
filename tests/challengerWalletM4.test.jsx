// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import WalletDetailHero from '../src/components/wallet/detail/WalletDetailHero'
import WalletTransactionsList from '../src/components/wallet/detail/WalletTransactionsList'
import WalletManageModals from '../src/components/wallet/detail/WalletManageModals'
import WalletDetailPage from '../src/pages/WalletDetailPage'
import { formatAccountType, getInitials } from '../src/components/wallet/detail/walletDetailUtils'
import { db, computeWalletBalance } from '../src/lib/db'
import { roundCurrency, convertCurrency, parseMoneyInput, formatMoneyValueForInput } from '../src/lib/utils'
import { deleteWallet } from '../src/services/walletService'
import useSettingsStore from '../src/store/useSettingsStore'

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock exportReports
const mockExportTransactionsToCsv = vi.fn()
vi.mock('../src/lib/exportReports', () => ({
  exportTransactionsToCsv: (...args) => mockExportTransactionsToCsv(...args),
}))

// Mock transactionService create/update/delete for WalletManageModals / WalletTransactionsList
const mockCreateTransaction = vi.fn().mockResolvedValue(1)
const mockUpdateTransaction = vi.fn().mockResolvedValue(1)
const mockDeleteTransaction = vi.fn().mockResolvedValue(1)
vi.mock('../src/services/transactionService', () => ({
  createTransaction: (...args) => mockCreateTransaction(...args),
  updateTransaction: (...args) => mockUpdateTransaction(...args),
  deleteTransaction: (...args) => mockDeleteTransaction(...args),
}))

// Mock fieldEncryption getDecryptedNoteSync to test encrypted split notes
vi.mock('../src/lib/fieldEncryption', async () => {
  const actual = await vi.importActual('../src/lib/fieldEncryption')
  return {
    ...actual,
    getDecryptedNoteSync: vi.fn((note) => {
      if (note === 'enc:v1:secret_split_note') return 'rahasia perusahaan'
      if (note === 'enc:v1:other_encrypted') return 'catatan rahasia terenkripsi'
      return note || ''
    }),
    isFieldEncrypted: (note) => typeof note === 'string' && note.startsWith('enc:v1:'),
  }
})

describe('Challenger M4: Empirical Adversarial Stress Suite for Wallet Detail Page', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    cleanup()
    useSettingsStore.setState({ locale: 'id', defaultCurrency: 'IDR', defaultWalletId: 1, hideBalance: false })
    await db.wallets.clear()
    await db.transactions.clear()
    await db.loans.clear()
  })

  afterEach(() => {
    cleanup()
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Balance Adjustment Arithmetic & Currency Invariants
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Balance Adjustment Arithmetic & Rounding Invariants', () => {
    const baseWalletIDR = {
      id: 1,
      name: 'Rekening IDR',
      currency: 'IDR',
      institutionType: 'bank',
    }

    const baseWalletUSD = {
      id: 2,
      name: 'Wise USD',
      currency: 'USD',
      institutionType: 'bank',
    }

    const baseWalletJPY = {
      id: 3,
      name: 'Sony Bank JPY',
      currency: 'JPY',
      institutionType: 'bank',
    }

    it('IDR: calculates positive diff and creates signed balance_adjustment transaction', async () => {
      const setIsEditBalanceModalOpen = vi.fn()
      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={baseWalletIDR}
            currentBalance={1000000}
            isEditBalanceModalOpen={true}
            setIsEditBalanceModalOpen={setIsEditBalanceModalOpen}
            locale="id"
          />
        </MemoryRouter>
      )

      // Starting balance: 1,000,000 -> User inputs 1,500,000 (+500,000 diff)
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '1.500.000' } })

      const submitBtn = screen.getByRole('button', { name: /Simpan Saldo|Save Balance/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalledTimes(1)
        expect(mockCreateTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'balance_adjustment',
            category: 'Penyesuaian Saldo',
            notes: 'Edit Saldo',
            amount: 500000,
            currency: 'IDR',
            walletId: 1,
          })
        )
        expect(setIsEditBalanceModalOpen).toHaveBeenCalledWith(false)
      })
    })

    it('IDR: calculates negative diff when new balance is lower than current balance', async () => {
      const setIsEditBalanceModalOpen = vi.fn()
      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={baseWalletIDR}
            currentBalance={1000000}
            isEditBalanceModalOpen={true}
            setIsEditBalanceModalOpen={setIsEditBalanceModalOpen}
            locale="id"
          />
        </MemoryRouter>
      )

      // Starting balance: 1,000,000 -> User inputs 750,000 (-250,000 diff)
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '750.000' } })

      const submitBtn = screen.getByRole('button', { name: /Simpan Saldo|Save Balance/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalledTimes(1)
        expect(mockCreateTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'balance_adjustment',
            amount: -250000,
            currency: 'IDR',
            walletId: 1,
          })
        )
      })
    })

    it('IDR: zero diff does NOT create redundant balance_adjustment transaction', async () => {
      const setIsEditBalanceModalOpen = vi.fn()
      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={baseWalletIDR}
            currentBalance={1000000}
            isEditBalanceModalOpen={true}
            setIsEditBalanceModalOpen={setIsEditBalanceModalOpen}
            locale="id"
          />
        </MemoryRouter>
      )

      // Same balance: 1,000,000 -> diff is 0
      const submitBtn = screen.getByRole('button', { name: /Simpan Saldo|Save Balance/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(mockCreateTransaction).not.toHaveBeenCalled()
        expect(setIsEditBalanceModalOpen).toHaveBeenCalledWith(false)
      })
    })

    it('IDR: adjusting balance to zero (0) creates exact negative adjustment', async () => {
      const setIsEditBalanceModalOpen = vi.fn()
      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={baseWalletIDR}
            currentBalance={450000}
            isEditBalanceModalOpen={true}
            setIsEditBalanceModalOpen={setIsEditBalanceModalOpen}
            locale="id"
          />
        </MemoryRouter>
      )

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '0' } })

      const submitBtn = screen.getByRole('button', { name: /Simpan Saldo|Save Balance/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalledTimes(1)
        expect(mockCreateTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'balance_adjustment',
            amount: -450000,
            walletId: 1,
          })
        )
      })
    })

    it('IDR: fractional starting balance from multi-currency converts to integer without sen drift', async () => {
      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={baseWalletIDR}
            currentBalance={100000.75}
            isEditBalanceModalOpen={true}
            setIsEditBalanceModalOpen={vi.fn()}
            locale="id"
          />
        </MemoryRouter>
      )

      // User enters 150,000 -> Math.round(150000 - 100000.75) = 49999
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '150.000' } })

      const submitBtn = screen.getByRole('button', { name: /Simpan Saldo|Save Balance/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 49999,
          })
        )
      })
    })

    it('USD: two-decimal currency calculates clean cents diff with roundCurrency', async () => {
      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={baseWalletUSD}
            currentBalance={100.25}
            isEditBalanceModalOpen={true}
            setIsEditBalanceModalOpen={vi.fn()}
            locale="id"
          />
        </MemoryRouter>
      )

      const input = screen.getByRole('textbox')
      // Enter 100.75 in USD (formats to 100,75)
      fireEvent.change(input, { target: { value: '100,75' } })

      const submitBtn = screen.getByRole('button', { name: /Simpan Saldo|Save Balance/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 0.5,
            currency: 'USD',
            walletId: 2,
          })
        )
      })
    })

    it('USD: prevents IEEE 754 floating-point drift (e.g. 0.3 - 0.1 resulting in 0.19999999999999998)', async () => {
      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={baseWalletUSD}
            currentBalance={0.1}
            isEditBalanceModalOpen={true}
            setIsEditBalanceModalOpen={vi.fn()}
            locale="id"
          />
        </MemoryRouter>
      )

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '0,30' } })

      const submitBtn = screen.getByRole('button', { name: /Simpan Saldo|Save Balance/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 0.2, // Must be exactly 0.2, not 0.19999999999999998
            currency: 'USD',
          })
        )
      })
    })

    it('JPY: handles zero-decimal balance adjustment arithmetic', async () => {
      // Invariant: isZeroDec uses Math.round for integer diffs
      const currentBalance = 25000
      const newBal = 21000
      const isZeroDec = ['IDR', 'JPY', 'KRW', 'VND'].includes('JPY')
      const diff = isZeroDec ? Math.round(newBal - currentBalance) : roundCurrency(newBal - currentBalance)
      expect(diff).toBe(-4000)

      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={baseWalletJPY}
            currentBalance={100}
            isEditBalanceModalOpen={true}
            setIsEditBalanceModalOpen={vi.fn()}
            locale="id"
          />
        </MemoryRouter>
      )

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '80' } })

      const submitBtn = screen.getByRole('button', { name: /Simpan Saldo|Save Balance/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: -20,
            currency: 'JPY',
            walletId: 3,
          })
        )
      })
    })

    it('Empirical computeWalletBalance verification with balance_adjustment transactions', () => {
      const testWallet = { id: 10, balance: 1000000, currency: 'IDR' }
      const txs = [
        { id: 1, walletId: 10, type: 'income', amount: 200000, currency: 'IDR' },
        { id: 2, walletId: 10, type: 'expense', amount: 50000, currency: 'IDR' },
        { id: 3, walletId: 10, type: 'balance_adjustment', amount: -150000, currency: 'IDR' },
        { id: 4, walletId: 10, type: 'balance_adjustment', amount: 30000, currency: 'IDR' },
      ]

      // Formula: 1,000,000 + 200,000 - 50,000 - 150,000 + 30,000 = 1,030,000
      const computed = computeWalletBalance(testWallet, txs)
      expect(computed).toBe(1030000)

      // Test USD wallet with cents
      const testWalletUsd = { id: 11, balance: 100.5, currency: 'USD' }
      const txsUsd = [
        { id: 101, walletId: 11, type: 'balance_adjustment', amount: -25.25, currency: 'USD' },
      ]
      // 100.50 - 25.25 = 75.25
      const computedUsd = computeWalletBalance(testWalletUsd, txsUsd)
      expect(computedUsd).toBe(75.25)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Split Transactions Search and Unpack Invariants (AGENTS.md Section 6)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Split Transactions Search & Unpack Invariants', () => {
    const mockWallet = { id: 1, name: 'BCA Utama', currency: 'IDR' }
    const splitTxFixture = [
      {
        id: 201,
        walletId: 1,
        date: '2026-10-05',
        type: 'expense',
        category: 'Supermarket Umum',
        amount: 350000,
        currency: 'IDR',
        notes: '', // Empty parent note
        isSplit: true,
        splitItems: [
          {
            category: 'Elektronik',
            subcategory: 'Kabel Data',
            notes: 'Kabel Type-C Fast Charge 100W',
            amount: 150000,
          },
          {
            category: 'Makanan',
            subcategory: 'Snack Ringan',
            notes: 'enc:v1:secret_split_note', // Encrypted note: decrypts to "rahasia perusahaan"
            amount: 200000,
          },
        ],
      },
      {
        id: 202,
        walletId: 1,
        date: '2026-10-05',
        type: 'income',
        category: 'Bonus',
        amount: 1000000,
        currency: 'IDR',
        notes: 'Bonus Kuartal',
      },
    ]

    it('unpacks and matches split item subcategory ("Kabel Data")', () => {
      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={splitTxFixture}
            allWallets={[mockWallet]}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      const searchInput = screen.getByRole('textbox')
      fireEvent.change(searchInput, { target: { value: 'Kabel Data' } })

      // Should find the split transaction
      expect(screen.getByText('Supermarket Umum')).toBeDefined()
      // Non-matching transaction is excluded
      expect(screen.queryByText('Bonus Kuartal')).toBeNull()
    })

    it('unpacks and matches split item plaintext notes ("Fast Charge")', () => {
      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={splitTxFixture}
            allWallets={[mockWallet]}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      const searchInput = screen.getByRole('textbox')
      fireEvent.change(searchInput, { target: { value: 'fast charge' } })

      expect(screen.getByText('Supermarket Umum')).toBeDefined()
      expect(screen.queryByText('Bonus Kuartal')).toBeNull()
    })

    it('unpacks and matches encrypted split item notes decrypted via getDecryptedNoteSync', () => {
      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={splitTxFixture}
            allWallets={[mockWallet]}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      const searchInput = screen.getByRole('textbox')
      // "rahasia perusahaan" is the decrypted string from "enc:v1:secret_split_note"
      fireEvent.change(searchInput, { target: { value: 'rahasia perusahaan' } })

      expect(screen.getByText('Supermarket Umum')).toBeDefined()
      expect(screen.queryByText('Bonus Kuartal')).toBeNull()
    })

    it('unpacks and matches split item individual amount ("150000")', () => {
      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={splitTxFixture}
            allWallets={[mockWallet]}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      const searchInput = screen.getByRole('textbox')
      fireEvent.change(searchInput, { target: { value: '150000' } })

      expect(screen.getByText('Supermarket Umum')).toBeDefined()
    })

    it('gracefully handles malformed split transactions with null/empty items', () => {
      const malformedTxs = [
        {
          id: 301,
          walletId: 1,
          date: '2026-10-05',
          type: 'expense',
          category: 'Belanja',
          amount: 50000,
          isSplit: true,
          splitItems: [null, undefined, { category: 'Valid Cat', amount: 50000 }],
        },
        {
          id: 302,
          walletId: 1,
          date: '2026-10-05',
          type: 'expense',
          category: 'Belanja 2',
          amount: 20000,
          isSplit: true,
          splitItems: null, // Null split items
        },
      ]

      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={malformedTxs}
            allWallets={[mockWallet]}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      const searchInput = screen.getByRole('textbox')
      // Searching for "Valid Cat" should match tx 301 without crashing on null items
      fireEvent.change(searchInput, { target: { value: 'Valid Cat' } })
      expect(screen.getByText('Belanja')).toBeDefined()
    })

    it('tab filter takes precedence: split expense matching query is hidden in income tab', () => {
      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={splitTxFixture}
            allWallets={[mockWallet]}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      // Search matches split item of tx 201 (which is an expense)
      const searchInput = screen.getByRole('textbox')
      fireEvent.change(searchInput, { target: { value: 'Kabel Data' } })
      expect(screen.getByText('Supermarket Umum')).toBeDefined()

      // Switch to Income tab
      const incomeTab = screen.getByRole('button', { name: /Pemasukan|Income/i })
      fireEvent.click(incomeTab)

      // Must NOT be shown in Income tab
      expect(screen.queryByText('Supermarket Umum')).toBeNull()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Daily Net Accumulation Invariants (Skipping Pending Review)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Daily Net Accumulation Invariants', () => {
    const mockWallet = { id: 1, name: 'BCA Utama', currency: 'IDR' }
    const targetWallet = { id: 2, name: 'Mandiri', currency: 'IDR' }
    const allWallets = [mockWallet, targetWallet]

    it('strictly skips isPendingReview === true and isPendingReview === 1 from daily net and display', () => {
      const txs = [
        {
          id: 401,
          walletId: 1,
          date: '2026-10-06',
          type: 'income',
          amount: 500000,
          currency: 'IDR',
          notes: 'Gaji Pokok',
        },
        {
          id: 402,
          walletId: 1,
          date: '2026-10-06',
          type: 'expense',
          amount: 150000,
          currency: 'IDR',
          notes: 'Makan Siang',
        },
        {
          id: 403,
          walletId: 1,
          date: '2026-10-06',
          type: 'balance_adjustment',
          amount: 50000,
          currency: 'IDR',
          notes: 'Adjust up',
        },
        {
          id: 404,
          walletId: 1,
          date: '2026-10-06',
          type: 'balance_adjustment',
          amount: -20000,
          currency: 'IDR',
          notes: 'Adjust down',
        },
        {
          id: 405,
          walletId: 1,
          targetWalletId: 2,
          date: '2026-10-06',
          type: 'transfer',
          amount: 80000,
          currency: 'IDR',
          notes: 'Transfer Out',
        },
        {
          id: 406,
          walletId: 2,
          targetWalletId: 1,
          date: '2026-10-06',
          type: 'transfer',
          amount: 100000,
          currency: 'IDR',
          notes: 'Transfer In',
        },
        // ADVERSARIAL: Massive pending review transactions
        {
          id: 407,
          walletId: 1,
          date: '2026-10-06',
          type: 'income',
          amount: 10000000, // 10 million IDR
          currency: 'IDR',
          notes: 'Pending OCR Ingestion',
          isPendingReview: true,
        },
        {
          id: 408,
          walletId: 1,
          date: '2026-10-06',
          type: 'income',
          amount: 5000000, // 5 million IDR
          currency: 'IDR',
          notes: 'Pending Notification 1',
          isPendingReview: 1,
        },
      ]

      // Formula:
      // + 500,000 (income)
      // - 150,000 (expense)
      // + 50,000 (balance adj positive)
      // - 20,000 (balance adj negative)
      // - 80,000 (outgoing transfer)
      // + 100,000 (incoming transfer)
      // Expected net: +400,000 IDR
      // If pending leaked: net would be +15,400,000 IDR.

      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={txs}
            allWallets={allWallets}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      // Verify pending transactions are never rendered
      expect(screen.queryByText('Pending OCR Ingestion')).toBeNull()
      expect(screen.queryByText('Pending Notification 1')).toBeNull()

      // Verify daily net text reflects exactly +400.000
      expect(screen.getByText(/\+Rp.*400\.000/)).toBeDefined()
    })

    it('USD wallet: calculates multi-currency daily net accurately', () => {
      const usdWallet = { id: 5, name: 'USD Cash', currency: 'USD' }
      const usdTxs = [
        {
          id: 501,
          walletId: 5,
          date: '2026-10-06',
          type: 'income',
          amount: 100,
          currency: 'USD',
          notes: 'Client Pay',
        },
        {
          id: 502,
          walletId: 5,
          date: '2026-10-06',
          type: 'expense',
          amount: 35.5,
          currency: 'USD',
          notes: 'Dinner',
        },
      ]

      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={5}
            wallet={usdWallet}
            allTransactions={usdTxs}
            allWallets={[usdWallet]}
            defaultCurrency="USD"
            locale="id"
          />
        </MemoryRouter>
      )

      // Expected net: +64.50 USD (formatted as +US$64,50 in Indonesian locale or +$64.50 in US locale)
      expect(screen.getByText(/(\+US\$|\+\$)64[,.]50/)).toBeDefined()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Active Loan Guard & Soft-Archive Ledger Preservation
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Active Loan Deletion Guard & Soft-Archive Preservation', () => {
    const mockWallet = { id: 10, name: 'Akun Terikat Utang', currency: 'IDR' }
    const backupWallet = { id: 20, name: 'Akun Cadangan', isArchived: 0, currency: 'IDR' }

    it('blocks wallet deletion when active unpaid loan is attached', async () => {
      await db.loans.add({
        id: 88,
        walletId: 10,
        status: 'active',
        remainingAmount: 750000,
        type: 'debt',
      })

      const onError = vi.fn()
      const setIsDeleteModalOpen = vi.fn()

      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={mockWallet}
            allWallets={[mockWallet, backupWallet]}
            isDeleteModalOpen={true}
            setIsDeleteModalOpen={setIsDeleteModalOpen}
            onError={onError}
            locale="id"
          />
        </MemoryRouter>
      )

      const confirmDeleteBtn = screen.getByRole('button', { name: /Hapus|Delete/i })
      fireEvent.click(confirmDeleteBtn)

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.stringContaining('catatan utang/piutang aktif')
        )
        expect(setIsDeleteModalOpen).toHaveBeenCalledWith(false)
      })
    })

    it('allows wallet deletion when loans are marked as paid or forgiven', async () => {
      // Loan with status paid (remainingAmount: 0)
      await db.loans.add({
        id: 89,
        walletId: 10,
        status: 'paid',
        remainingAmount: 0,
      })
      // Loan with status forgiven
      await db.loans.add({
        id: 90,
        walletId: 10,
        status: 'forgiven',
        remainingAmount: 300000,
      })

      const onError = vi.fn()
      const setIsDeleteModalOpen = vi.fn()

      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={mockWallet}
            allWallets={[mockWallet, backupWallet]}
            isDeleteModalOpen={true}
            setIsDeleteModalOpen={setIsDeleteModalOpen}
            onError={onError}
            locale="id"
          />
        </MemoryRouter>
      )

      const confirmDeleteBtn = screen.getByRole('button', { name: /Hapus|Delete/i })
      fireEvent.click(confirmDeleteBtn)

      await waitFor(() => {
        expect(onError).not.toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
      })
    })

    it('Dexie Soft-Archive Invariant: deleteWallet sets isArchived: 1 and NEVER deletes transactions', async () => {
      // 1. Seed Dexie with wallets and transactions
      await db.wallets.bulkAdd([
        { id: 100, name: 'Dompet Prioritas', currency: 'IDR', balance: 500000, isArchived: 0 },
        { id: 200, name: 'Dompet Sekunder', currency: 'IDR', balance: 200000, isArchived: 0 },
      ])

      await db.transactions.bulkAdd([
        { id: 901, walletId: 100, type: 'income', amount: 500000, date: '2026-09-01' },
        { id: 902, walletId: 100, type: 'expense', amount: 100000, date: '2026-09-02' },
        { id: 903, walletId: 100, type: 'expense', amount: 50000, date: '2026-09-03' },
      ])

      useSettingsStore.setState({ defaultWalletId: 100 })

      // 2. Execute genuine deleteWallet
      await deleteWallet(100)

      // 3. Verify wallet is soft-archived, NOT deleted
      const archivedWallet = await db.wallets.get(100)
      expect(archivedWallet).toBeDefined()
      expect(archivedWallet.isArchived).toBe(1)

      // 4. Invariant: Transactions MUST remain intact (immutable ledger)
      const survivingTxs = await db.transactions.where('walletId').equals(100).toArray()
      expect(survivingTxs.length).toBe(3)

      // 5. Invariant: Settings store defaultWalletId is reassigned to remaining active wallet
      const currentDefault = useSettingsStore.getState().defaultWalletId
      expect(currentDefault).toBe(200)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Wallet Detail Hero & Coordinator Edge Cases
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Wallet Detail Hero & Coordinator Edge Cases', () => {
    it('WalletDetailHero: handles negative balance (overdraft) and zero balance gracefully', () => {
      const mockWallet = { id: 1, name: 'Akun Giro', currency: 'IDR', institutionType: 'bank' }
      const { rerender } = render(
        <MemoryRouter>
          <WalletDetailHero
            wallet={mockWallet}
            balance={-250000}
            hideBalance={false}
            locale="id"
          />
        </MemoryRouter>
      )

      expect(screen.getAllByText(/-Rp.*250\.000/).length).toBeGreaterThan(0)

      rerender(
        <MemoryRouter>
          <WalletDetailHero
            wallet={mockWallet}
            balance={0}
            hideBalance={false}
            locale="id"
          />
        </MemoryRouter>
      )

      expect(screen.getAllByText(/Rp.*0/).length).toBeGreaterThan(0)
    })

    it('WalletDetailHero: hides balance when hideBalance is true', () => {
      const mockWallet = { id: 1, name: 'Dompet Rahasia', currency: 'IDR' }
      render(
        <MemoryRouter>
          <WalletDetailHero
            wallet={mockWallet}
            balance={50000000}
            hideBalance={true}
            locale="id"
          />
        </MemoryRouter>
      )

      // Should render MaskedBalance accessible container
      expect(screen.getByLabelText(/Saldo disembunyikan|Balance hidden/i)).toBeDefined()
      // Toggle button should offer to show balance
      expect(screen.getByLabelText(/Tampilkan Saldo|Show Balance/i)).toBeDefined()
    })

    it('WalletDetailPage Coordinator: renders 404 state and navigates back on missing wallet', async () => {
      render(
        <MemoryRouter initialEntries={['/wallets/9999']}>
          <Routes>
            <Route path="/wallets/:id" element={<WalletDetailPage />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Akun Tidak Ditemukan/i)).toBeDefined()
      })

      const backBtn = screen.getByRole('button', { name: /Kembali ke Dashboard/i })
      fireEvent.click(backBtn)
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Utility & Currency Parsing Contracts
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Utility & Currency Parsing Contracts', () => {
    it('formatAccountType and getInitials utility contracts', () => {
      expect(formatAccountType('bank', 'BCA', 'id')).toBe('Bank')
      expect(formatAccountType('ewallet', 'GoPay', 'id')).toBe('E-Wallet')
      expect(getInitials('BCA')).toBe('BC')
    })

    it('currency conversion and formatting utilities', () => {
      expect(convertCurrency(100, 'USD', 'USD')).toBe(100)
      expect(parseMoneyInput('1.000.000', 'IDR')).toBe(1000000)
      expect(formatMoneyValueForInput(1000000, 'IDR')).toBe('1.000.000')
    })
  })
})

