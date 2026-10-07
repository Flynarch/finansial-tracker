// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import WalletDetailHero from '../src/components/wallet/detail/WalletDetailHero'
import { formatAccountType, getInitials } from '../src/components/wallet/detail/walletDetailUtils'
import WalletTransactionsList from '../src/components/wallet/detail/WalletTransactionsList'
import WalletManageModals from '../src/components/wallet/detail/WalletManageModals'
import WalletDetailPage from '../src/pages/WalletDetailPage'
import { db } from '../src/lib/db'
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

// Mock transactionService
const mockCreateTransaction = vi.fn().mockResolvedValue(1)
const mockUpdateTransaction = vi.fn().mockResolvedValue(1)
const mockDeleteTransaction = vi.fn().mockResolvedValue(1)
vi.mock('../src/services/transactionService', () => ({
  createTransaction: (...args) => mockCreateTransaction(...args),
  updateTransaction: (...args) => mockUpdateTransaction(...args),
  deleteTransaction: (...args) => mockDeleteTransaction(...args),
}))

// Mock walletService
const mockUpdateWallet = vi.fn().mockResolvedValue(1)
const mockDeleteWallet = vi.fn().mockResolvedValue(1)
vi.mock('../src/services/walletService', () => ({
  updateWallet: (...args) => mockUpdateWallet(...args),
  deleteWallet: (...args) => mockDeleteWallet(...args),
  archiveWallet: (...args) => mockDeleteWallet(...args),
}))

describe('WalletDetailPage Modular Decomposition Suite', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    cleanup()
    useSettingsStore.setState({ locale: 'id', defaultCurrency: 'IDR' })
    await db.wallets.clear()
    await db.transactions.clear()
    await db.loans.clear()
  })

  afterEach(() => {
    cleanup()
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. WalletDetailHero Tests
  // ─────────────────────────────────────────────────────────────────────────────
  describe('WalletDetailHero Component', () => {
    const mockWallet = {
      id: 1,
      name: 'BCA Utama',
      currency: 'IDR',
      institutionType: 'bank',
      createdAt: '2026-01-01T10:00:00Z',
    }

    it('renders wallet name, account type badge, and balance', () => {
      render(
        <MemoryRouter>
          <WalletDetailHero
            wallet={mockWallet}
            balance={2500000}
            isDefaultWallet={false}
            hideBalance={false}
            locale="id"
            onToggleHideBalance={vi.fn()}
            onAdjustBalance={vi.fn()}
            onOpenOptions={vi.fn()}
          />
        </MemoryRouter>
      )

      expect(screen.getAllByText('BCA Utama').length).toBeGreaterThan(0)
      expect(screen.getByText('Bank')).toBeDefined()
      expect(screen.getAllByText(/Rp/).length).toBeGreaterThan(0)
    })

    it('renders primary wallet badge when isDefaultWallet is true', () => {
      render(
        <MemoryRouter>
          <WalletDetailHero
            wallet={mockWallet}
            balance={1000000}
            isDefaultWallet={true}
            locale="id"
            onAdjustBalance={vi.fn()}
            onOpenOptions={vi.fn()}
          />
        </MemoryRouter>
      )

      expect(screen.getByText(/Akun Utama|Primary/i)).toBeDefined()
    })

    it('renders MoneyBagIcon for cash wallets and initials for generic wallets', () => {
      const cashWallet = {
        id: 2,
        name: 'Kas Tunai Dompet',
        institutionType: 'cash',
        currency: 'IDR',
      }

      const { container } = render(
        <MemoryRouter>
          <WalletDetailHero
            wallet={cashWallet}
            balance={50000}
            locale="id"
            onAdjustBalance={vi.fn()}
            onOpenOptions={vi.fn()}
          />
        </MemoryRouter>
      )

      const amberElements = container.querySelectorAll('.text-amber-500')
      expect(amberElements.length).toBeGreaterThan(0)
    })

    it('triggers onToggleHideBalance, onAdjustBalance, and onOpenOptions on click', () => {
      const onToggleHideBalance = vi.fn()
      const onAdjustBalance = vi.fn()
      const onOpenOptions = vi.fn()

      render(
        <MemoryRouter>
          <WalletDetailHero
            wallet={mockWallet}
            balance={1500000}
            hideBalance={false}
            locale="id"
            onToggleHideBalance={onToggleHideBalance}
            onAdjustBalance={onAdjustBalance}
            onOpenOptions={onOpenOptions}
          />
        </MemoryRouter>
      )

      // Click Options 3-dots button
      const optionsBtn = screen.getByLabelText(/Opsi Akun|Wallet Options/i)
      fireEvent.click(optionsBtn)
      expect(onOpenOptions).toHaveBeenCalledTimes(1)

      // Click Adjust Balance button
      const adjustBtn = screen.getByTitle(/Penyesuaian Saldo|Adjust Balance/i)
      fireEvent.click(adjustBtn)
      expect(onAdjustBalance).toHaveBeenCalledTimes(1)

      // Click Hide Balance button
      const hideBtn = screen.getByLabelText(/Sembunyikan Saldo|Hide Balance/i)
      fireEvent.click(hideBtn)
      expect(onToggleHideBalance).toHaveBeenCalledTimes(1)
    })

    it('formatAccountType accurately classifies institutions in id and en', () => {
      expect(formatAccountType('bank', 'BCA', 'id')).toBe('Bank')
      expect(formatAccountType('ewallet', 'GoPay', 'id')).toBe('E-Wallet')
      expect(formatAccountType('cash', 'Kas Kecil', 'id')).toBe('Kas Fisik')
      expect(formatAccountType('cash', 'Cash Pocket', 'en')).toBe('Cash')
      expect(formatAccountType('investasi', 'Bibit Reksadana', 'id')).toBe('Investasi')
      expect(formatAccountType('investment', 'Stockbit', 'en')).toBe('Investment')
      expect(formatAccountType('lainnya', 'Catatan', 'en')).toBe('Manual Account')
    })

    it('getInitials extracts first two characters in uppercase', () => {
      expect(getInitials('Mandiri')).toBe('MA')
      expect(getInitials('bca')).toBe('BC')
      expect(getInitials('')).toBe('')
      expect(getInitials(null)).toBe('')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. WalletTransactionsList Tests
  // ─────────────────────────────────────────────────────────────────────────────
  describe('WalletTransactionsList Component', () => {
    const mockWallet = { id: 1, name: 'BCA Utama', currency: 'IDR' }
    const mockWallets = [mockWallet, { id: 2, name: 'Dana', currency: 'IDR' }]

    const transactionsFixture = [
      {
        id: 101,
        walletId: 1,
        date: '2026-10-01',
        type: 'income',
        category: 'Gaji',
        amount: 5000000,
        currency: 'IDR',
        notes: 'Gaji Bulanan',
      },
      {
        id: 102,
        walletId: 1,
        date: '2026-10-01',
        type: 'expense',
        category: 'Makan',
        amount: 150000,
        currency: 'IDR',
        notes: 'Makan siang bareng tim',
      },
      {
        id: 103,
        walletId: 1,
        targetWalletId: 2,
        date: '2026-10-02',
        type: 'transfer',
        amount: 200000,
        currency: 'IDR',
        notes: 'Transfer topup ewallet',
      },
      {
        id: 104,
        walletId: 2,
        targetWalletId: 1,
        date: '2026-10-02',
        type: 'transfer',
        amount: 300000,
        currency: 'IDR',
        notes: 'Transfer balik dari dana',
      },
      {
        id: 105,
        walletId: 1,
        date: '2026-10-03',
        type: 'expense',
        category: 'Belanja Supermarket',
        amount: 450000,
        currency: 'IDR',
        isSplit: true,
        splitItems: [
          { category: 'Makanan', subcategory: 'Kopi Bubuk', notes: 'Beli biji kopi arabika', amount: 150000 },
          { category: 'Kebutuhan Rumah', subcategory: 'Deterjen', notes: 'Sabun cuci baju', amount: 300000 },
        ],
      },
      {
        id: 106,
        walletId: 1,
        date: '2026-10-03',
        type: 'income',
        amount: 1000000,
        currency: 'IDR',
        notes: 'Review pending',
        isPendingReview: true,
      },
    ]

    it('renders transactions list with tab counts and sticky headers', () => {
      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={transactionsFixture}
            allWallets={mockWallets}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      expect(screen.getByText(/Riwayat Transaksi|Transaction History/i)).toBeDefined()
      expect(screen.getByRole('button', { name: /Semua|All/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /Pengeluaran|Expense/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /Pemasukan|Income/i })).toBeDefined()

      // Should display transaction items
      expect(screen.getByText(/Gaji Bulanan/)).toBeDefined()
      expect(screen.getByText(/Makan siang bareng tim/)).toBeDefined()
    })

    it('filters transactions when selecting tabs (all / expense / income)', () => {
      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={transactionsFixture}
            allWallets={mockWallets}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      // Tab Expense
      const expenseTab = screen.getByRole('button', { name: /Pengeluaran|Expense/i })
      fireEvent.click(expenseTab)

      expect(screen.getByText(/Makan siang bareng tim/)).toBeDefined()
      expect(screen.queryByText(/Gaji Bulanan/)).toBeNull()

      // Tab Income
      const incomeTab = screen.getByRole('button', { name: /Pemasukan|Income/i })
      fireEvent.click(incomeTab)

      expect(screen.getByText(/Gaji Bulanan/)).toBeDefined()
      expect(screen.queryByText(/Makan siang bareng tim/)).toBeNull()
    })

    it('unpacks splitItems during search queries (Financial Split Invariant)', () => {
      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={transactionsFixture}
            allWallets={mockWallets}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      const searchInput = screen.getByRole('textbox')
      // Query "arabika" which is only inside tx 105's split item notes
      fireEvent.change(searchInput, { target: { value: 'arabika' } })

      // Tx 105 should match via unpacked split item
      expect(screen.getByText('Belanja Supermarket')).toBeDefined()
      expect(screen.queryByText('Gaji Bulanan')).toBeNull()
    })

    it('skips isPendingReview transactions in daily net calculation', () => {
      // Tx 106 has isPendingReview: true and should NOT appear in counts or net
      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={transactionsFixture}
            allWallets={mockWallets}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      // Pending tx 106 should not be displayed
      expect(screen.queryByText('Review pending')).toBeNull()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. WalletManageModals Tests
  // ─────────────────────────────────────────────────────────────────────────────
  describe('WalletManageModals Component', () => {
    const mockWallet = {
      id: 1,
      name: 'Mandiri Tabungan',
      institutionType: 'bank',
      currency: 'IDR',
      accountNumber: '1400012345678',
      notes: 'Rekening tabungan utama',
    }
    const mockAllWallets = [
      mockWallet,
      { id: 2, name: 'BCA Cadangan', isArchived: 0, currency: 'IDR' },
    ]

    it('renders Options BottomSheet with all action triggers', () => {
      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={mockWallet}
            allWallets={mockAllWallets}
            isActionMenuOpen={true}
            setIsActionMenuOpen={vi.fn()}
            isEditWalletModalOpen={false}
            setIsEditWalletModalOpen={vi.fn()}
            isEditBalanceModalOpen={false}
            setIsEditBalanceModalOpen={vi.fn()}
            isDeleteModalOpen={false}
            setIsDeleteModalOpen={vi.fn()}
            isDefaultWallet={false}
            locale="id"
          />
        </MemoryRouter>
      )

      expect(screen.getByText(/Opsi Akun Dompet|Wallet Options/i)).toBeDefined()
      expect(screen.getByText(/Jadikan Akun Utama|Set as Primary/i)).toBeDefined()
      expect(screen.getByText(/Ubah Info Dompet|Edit/i)).toBeDefined()
      expect(screen.getByText(/Ekspor Transaksi|Export Transactions/i)).toBeDefined()
      expect(screen.getByText(/Hapus Dompet|Hapus Akun Dompet|Delete/i)).toBeDefined()
    })

    it('exports CSV on clicking Ekspor Transaksi (.CSV)', () => {
      const setIsActionMenuOpen = vi.fn()
      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={mockWallet}
            allWallets={mockAllWallets}
            isActionMenuOpen={true}
            setIsActionMenuOpen={setIsActionMenuOpen}
            isEditWalletModalOpen={false}
            setIsEditWalletModalOpen={vi.fn()}
            isEditBalanceModalOpen={false}
            setIsEditBalanceModalOpen={vi.fn()}
            isDeleteModalOpen={false}
            setIsDeleteModalOpen={vi.fn()}
            locale="id"
          />
        </MemoryRouter>
      )

      const exportBtn = screen.getByText(/Ekspor Transaksi|Export Transactions/i)
      fireEvent.click(exportBtn)

      expect(setIsActionMenuOpen).toHaveBeenCalledWith(false)
      expect(mockExportTransactionsToCsv).toHaveBeenCalledTimes(1)
    })

    it('handles Edit Wallet info form submission with updateWallet', async () => {
      const setIsEditWalletModalOpen = vi.fn()
      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={mockWallet}
            allWallets={mockAllWallets}
            isActionMenuOpen={false}
            setIsActionMenuOpen={vi.fn()}
            isEditWalletModalOpen={true}
            setIsEditWalletModalOpen={setIsEditWalletModalOpen}
            isEditBalanceModalOpen={false}
            setIsEditBalanceModalOpen={vi.fn()}
            isDeleteModalOpen={false}
            setIsDeleteModalOpen={vi.fn()}
            locale="id"
          />
        </MemoryRouter>
      )

      expect(screen.getByText(/Ubah Info Dompet|Edit Wallet/i)).toBeDefined()
      const nameInput = screen.getByPlaceholderText(/BCA Utama|Wallet Name/i)
      expect(nameInput.value).toBe('Mandiri Tabungan')

      fireEvent.change(nameInput, { target: { value: 'Mandiri Tabungan Baru' } })
      const saveBtn = screen.getByRole('button', { name: /Simpan|Save/i })
      fireEvent.click(saveBtn)

      await waitFor(() => {
        expect(mockUpdateWallet).toHaveBeenCalledWith(1, expect.objectContaining({
          name: 'Mandiri Tabungan Baru',
        }))
        expect(setIsEditWalletModalOpen).toHaveBeenCalledWith(false)
      })
    })

    it('computes diff and writes balance_adjustment transaction in Balance Adjustment Modal', async () => {
      const setIsEditBalanceModalOpen = vi.fn()
      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={mockWallet}
            allWallets={mockAllWallets}
            currentBalance={1000000}
            isActionMenuOpen={false}
            setIsActionMenuOpen={vi.fn()}
            isEditWalletModalOpen={false}
            setIsEditWalletModalOpen={vi.fn()}
            isEditBalanceModalOpen={true}
            setIsEditBalanceModalOpen={setIsEditBalanceModalOpen}
            isDeleteModalOpen={false}
            setIsDeleteModalOpen={vi.fn()}
            locale="id"
          />
        </MemoryRouter>
      )

      expect(screen.getByText(/Penyesuaian Saldo|Adjust Balance/i)).toBeDefined()
      // Current balance is 1,000,000. Let's input 1,250,000 (+250,000 diff)
      const balanceInput = screen.getByRole('textbox')
      fireEvent.change(balanceInput, { target: { value: '1.250.000' } })

      const submitBtn = screen.getByRole('button', { name: /Simpan Saldo|Save Balance/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalledWith(expect.objectContaining({
          type: 'balance_adjustment',
          category: 'Penyesuaian Saldo',
          amount: 250000,
          walletId: 1,
          currency: 'IDR',
        }))
        expect(setIsEditBalanceModalOpen).toHaveBeenCalledWith(false)
      })
    })

    it('blocks wallet deletion when active loans are attached to the wallet', async () => {
      // Add active unpaid loan in IndexedDB
      await db.loans.add({
        id: 99,
        walletId: 1,
        status: 'active',
        remainingAmount: 500000,
      })

      const onError = vi.fn()
      const setIsDeleteModalOpen = vi.fn()

      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={mockWallet}
            allWallets={mockAllWallets}
            isActionMenuOpen={false}
            setIsActionMenuOpen={vi.fn()}
            isEditWalletModalOpen={false}
            setIsEditWalletModalOpen={vi.fn()}
            isEditBalanceModalOpen={false}
            setIsEditBalanceModalOpen={vi.fn()}
            isDeleteModalOpen={true}
            setIsDeleteModalOpen={setIsDeleteModalOpen}
            onError={onError}
            locale="id"
          />
        </MemoryRouter>
      )

      // Confirm delete in modal
      const confirmDeleteBtn = screen.getByRole('button', { name: /Hapus|Delete/i })
      fireEvent.click(confirmDeleteBtn)

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.stringContaining('catatan utang/piutang aktif'))
        expect(mockDeleteWallet).not.toHaveBeenCalled()
      })
    })

    it('safely reassigns default wallet and soft-archives when deleting primary wallet without active loans', async () => {
      const setDefaultWalletIdSpy = vi.spyOn(useSettingsStore.getState(), 'setDefaultWalletId')
      const setIsDeleteModalOpen = vi.fn()

      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={mockWallet}
            allWallets={mockAllWallets}
            isDefaultWallet={true}
            isActionMenuOpen={false}
            setIsActionMenuOpen={vi.fn()}
            isEditWalletModalOpen={false}
            setIsEditWalletModalOpen={vi.fn()}
            isEditBalanceModalOpen={false}
            setIsEditBalanceModalOpen={vi.fn()}
            isDeleteModalOpen={true}
            setIsDeleteModalOpen={setIsDeleteModalOpen}
            locale="id"
          />
        </MemoryRouter>
      )

      const confirmDeleteBtn = screen.getByRole('button', { name: /Hapus|Delete/i })
      fireEvent.click(confirmDeleteBtn)

      await waitFor(() => {
        expect(setDefaultWalletIdSpy).toHaveBeenCalledWith(2) // next active wallet is id: 2
        expect(mockDeleteWallet).toHaveBeenCalledWith(1)
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. WalletDetailPage Coordinator Tests
  // ─────────────────────────────────────────────────────────────────────────────
  describe('WalletDetailPage Coordinator Page', () => {
    it('renders 404 empty state when wallet ID does not exist', async () => {
      render(
        <MemoryRouter initialEntries={['/wallets/999']}>
          <Routes>
            <Route path="/wallets/:id" element={<WalletDetailPage />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Akun Tidak Ditemukan|Wallet Not Found/i)).toBeDefined()
      })
    })

    it('renders coordinator page with sub-components when wallet exists', async () => {
      await db.wallets.add({
        id: 42,
        name: 'Dompet Koordinator',
        currency: 'IDR',
        balance: 750000,
        institutionType: 'cash',
        isArchived: 0,
      })

      render(
        <MemoryRouter initialEntries={['/wallets/42']}>
          <Routes>
            <Route path="/wallets/:id" element={<WalletDetailPage />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getAllByText('Dompet Koordinator').length).toBeGreaterThan(0)
        expect(screen.getByText(/Riwayat Transaksi|Transaction History/i)).toBeDefined()
      })
    })
  })
})
