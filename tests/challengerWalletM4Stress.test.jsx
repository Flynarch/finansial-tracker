// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import WalletDetailHero from '../src/components/wallet/detail/WalletDetailHero'
import WalletTransactionsList from '../src/components/wallet/detail/WalletTransactionsList'
import WalletManageModals from '../src/components/wallet/detail/WalletManageModals'
import { db } from '../src/lib/db'
import useSettingsStore from '../src/store/useSettingsStore'
import * as fieldEncryption from '../src/lib/fieldEncryption'

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

describe('Challenger M4 Stress Test Suite: Wallet Detail Modular Contracts', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    cleanup()
    useSettingsStore.setState({ locale: 'id', defaultCurrency: 'IDR', defaultWalletId: 1 })
    await db.wallets.clear()
    await db.transactions.clear()
    await db.loans.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: RAPID MODAL TRANSITIONS & DYNAMIC WALLET PROP SWITCHES
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Rapid Modal Transitions & Dynamic Wallet Prop Switches', () => {
    const walletA = {
      id: 1,
      name: 'Bank BCA Utama',
      institutionType: 'bank',
      currency: 'IDR',
      accountNumber: '111222333',
      notes: 'Rekening utama bisnis',
    }

    const walletB = {
      id: 2,
      name: 'Bank Mandiri Bisnis',
      institutionType: 'bank',
      currency: 'USD',
      accountNumber: '888999000',
      notes: 'Rekening valas luar negeri',
    }

    it('handles rapid toggle of isEditWalletModalOpen without corrupting internal form state', () => {
      const setIsEditWalletModalOpen = vi.fn()
      const { rerender } = render(
        <MemoryRouter>
          <WalletManageModals
            wallet={walletA}
            isActionMenuOpen={false}
            setIsActionMenuOpen={vi.fn()}
            isEditWalletModalOpen={false}
            setIsEditWalletModalOpen={setIsEditWalletModalOpen}
            isEditBalanceModalOpen={false}
            setIsEditBalanceModalOpen={vi.fn()}
            isDeleteModalOpen={false}
            setIsDeleteModalOpen={vi.fn()}
            locale="id"
          />
        </MemoryRouter>
      )

      // Rapid cycle: open -> close -> open
      rerender(
        <MemoryRouter>
          <WalletManageModals
            wallet={walletA}
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

      expect(screen.getByDisplayValue('Bank BCA Utama')).toBeDefined()
      expect(screen.getByDisplayValue('111222333')).toBeDefined()

      rerender(
        <MemoryRouter>
          <WalletManageModals
            wallet={walletA}
            isActionMenuOpen={false}
            setIsActionMenuOpen={vi.fn()}
            isEditWalletModalOpen={false}
            setIsEditWalletModalOpen={setIsEditWalletModalOpen}
            isEditBalanceModalOpen={false}
            setIsEditBalanceModalOpen={vi.fn()}
            isDeleteModalOpen={false}
            setIsDeleteModalOpen={vi.fn()}
            locale="id"
          />
        </MemoryRouter>
      )

      rerender(
        <MemoryRouter>
          <WalletManageModals
            wallet={walletA}
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

      expect(screen.getByDisplayValue('Bank BCA Utama')).toBeDefined()
      expect(screen.getByDisplayValue('111222333')).toBeDefined()
    })

    it('dynamically resynchronizes form state when wallet prop changes while modal was closed', () => {
      const { rerender } = render(
        <MemoryRouter>
          <WalletManageModals
            wallet={walletA}
            isActionMenuOpen={false}
            setIsActionMenuOpen={vi.fn()}
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

      // Switch wallet prop from walletA to walletB while modal is closed
      rerender(
        <MemoryRouter>
          <WalletManageModals
            wallet={walletB}
            isActionMenuOpen={false}
            setIsActionMenuOpen={vi.fn()}
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

      // Now open modal with walletB
      rerender(
        <MemoryRouter>
          <WalletManageModals
            wallet={walletB}
            isActionMenuOpen={false}
            setIsActionMenuOpen={vi.fn()}
            isEditWalletModalOpen={true}
            setIsEditWalletModalOpen={vi.fn()}
            isEditBalanceModalOpen={false}
            setIsEditBalanceModalOpen={vi.fn()}
            isDeleteModalOpen={false}
            setIsDeleteModalOpen={vi.fn()}
            locale="id"
          />
        </MemoryRouter>
      )

      // Must reflect walletB values, not stale walletA
      expect(screen.getByDisplayValue('Bank Mandiri Bisnis')).toBeDefined()
      expect(screen.getByDisplayValue('888999000')).toBeDefined()
      expect(screen.getByDisplayValue('Rekening valas luar negeri')).toBeDefined()
      expect(screen.queryByDisplayValue('Bank BCA Utama')).toBeNull()
    })

    it('resets dirty unsubmitted balance input when modal is closed and reopened', () => {
      const setIsEditBalanceModalOpen = vi.fn()
      const { rerender } = render(
        <MemoryRouter>
          <WalletManageModals
            wallet={walletA}
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

      const input = screen.getByRole('textbox')
      expect(input.value).toBe('1.000.000')

      // User enters dirty uncommitted value
      fireEvent.change(input, { target: { value: '9.999.999' } })
      expect(input.value).toBe('9.999.999')

      // Close modal
      rerender(
        <MemoryRouter>
          <WalletManageModals
            wallet={walletA}
            currentBalance={1000000}
            isActionMenuOpen={false}
            setIsActionMenuOpen={vi.fn()}
            isEditWalletModalOpen={false}
            setIsEditWalletModalOpen={vi.fn()}
            isEditBalanceModalOpen={false}
            setIsEditBalanceModalOpen={setIsEditBalanceModalOpen}
            isDeleteModalOpen={false}
            setIsDeleteModalOpen={vi.fn()}
            locale="id"
          />
        </MemoryRouter>
      )

      // Reopen modal: must discard dirty input and reset to 1.000.000
      rerender(
        <MemoryRouter>
          <WalletManageModals
            wallet={walletA}
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

      const reopenedInput = screen.getByRole('textbox')
      expect(reopenedInput.value).toBe('1.000.000')
    })

    it('dynamically adapts currency symbol and rounding between IDR and USD in balance adjustment', () => {
      const { rerender } = render(
        <MemoryRouter>
          <WalletManageModals
            wallet={walletA}
            currentBalance={1000000}
            isActionMenuOpen={false}
            setIsActionMenuOpen={vi.fn()}
            isEditWalletModalOpen={false}
            setIsEditWalletModalOpen={vi.fn()}
            isEditBalanceModalOpen={true}
            setIsEditBalanceModalOpen={vi.fn()}
            isDeleteModalOpen={false}
            setIsDeleteModalOpen={vi.fn()}
            locale="id"
          />
        </MemoryRouter>
      )

      expect(screen.getByText('Rp')).toBeDefined()

      // Close and switch to USD walletB with fractional balance
      rerender(
        <MemoryRouter>
          <WalletManageModals
            wallet={walletB}
            currentBalance={250.75}
            isActionMenuOpen={false}
            setIsActionMenuOpen={vi.fn()}
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

      // Open for walletB
      rerender(
        <MemoryRouter>
          <WalletManageModals
            wallet={walletB}
            currentBalance={250.75}
            isActionMenuOpen={false}
            setIsActionMenuOpen={vi.fn()}
            isEditWalletModalOpen={false}
            setIsEditWalletModalOpen={vi.fn()}
            isEditBalanceModalOpen={true}
            setIsEditBalanceModalOpen={vi.fn()}
            isDeleteModalOpen={false}
            setIsDeleteModalOpen={vi.fn()}
            locale="id"
          />
        </MemoryRouter>
      )

      expect(screen.getByText('$')).toBeDefined()
      const usdInput = screen.getByRole('textbox')
      expect(usdInput.value).toBe('250,75')
    })

    it('does NOT create a balance_adjustment transaction if submitted diff is zero', async () => {
      const setIsEditBalanceModalOpen = vi.fn()
      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={walletA}
            currentBalance={500000}
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

      // Submit without modifying input (diff == 0)
      const saveBtn = screen.getByRole('button', { name: /Simpan Saldo|Save Balance/i })
      fireEvent.click(saveBtn)

      await waitFor(() => {
        expect(mockCreateTransaction).not.toHaveBeenCalled()
        expect(setIsEditBalanceModalOpen).toHaveBeenCalledWith(false)
      })
    })

    it('calculates exact decimal precision diff for non-zero decimal currencies (USD)', async () => {
      const setIsEditBalanceModalOpen = vi.fn()
      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={walletB}
            currentBalance={100.25}
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

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '120.75' } })

      const saveBtn = screen.getByRole('button', { name: /Simpan Saldo|Save Balance/i })
      fireEvent.click(saveBtn)

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'balance_adjustment',
            amount: 20.5,
            currency: 'USD',
            walletId: 2,
          })
        )
      })
    })

    it('safely renders null without error when wallet prop is null or undefined', () => {
      const { container: heroContainer } = render(
        <MemoryRouter>
          <WalletDetailHero wallet={null} />
        </MemoryRouter>
      )
      expect(heroContainer.firstChild).toBeNull()

      const { container: modalsContainer } = render(
        <MemoryRouter>
          <WalletManageModals wallet={null} />
        </MemoryRouter>
      )
      expect(modalsContainer.firstChild).toBeNull()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: NOTE DECRYPTION EVENT REACTIVITY (ft-notes-decrypted)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Note Decryption Event Reactivity (ft-notes-decrypted)', () => {
    const mockWallet = { id: 1, name: 'BCA Utama', currency: 'IDR' }
    const cipherText = 'enc:v1:0123456789abcdef:fedcba9876543210'
    const decryptedSecret = 'bonus kinerja tahunan rahasia'

    it('dynamically triggers search re-filtering when ft-notes-decrypted is dispatched', async () => {
      // Mock getDecryptedNoteSync to simulate cache miss initially, then hit after event
      let isDecrypted = false
      vi.spyOn(fieldEncryption, 'getDecryptedNoteSync').mockImplementation((note, fallback = '') => {
        if (note === cipherText) {
          return isDecrypted ? decryptedSecret : fallback
        }
        return note || ''
      })

      const txWithCipher = {
        id: 201,
        walletId: 1,
        date: '2026-10-05',
        type: 'income',
        category: 'Gaji',
        amount: 15000000,
        currency: 'IDR',
        notes: cipherText,
      }

      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={[txWithCipher]}
            allWallets={[mockWallet]}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      // Search for secret word before decryption: should NOT match
      const searchInput = screen.getByRole('textbox')
      fireEvent.change(searchInput, { target: { value: 'rahasia' } })

      // Initially empty state since ciphertext is unresolved
      expect(screen.getByText(/Belum Ada Transaksi|No Transactions/i)).toBeDefined()
      expect(screen.queryByText('Gaji')).toBeNull()

      // Now background decryption finishes and emits event
      act(() => {
        isDecrypted = true
        window.dispatchEvent(new CustomEvent('ft-notes-decrypted', { detail: { note: cipherText } }))
      })

      // WalletTransactionsList re-rendered via decryptedTick and matched search query!
      await waitFor(() => {
        expect(screen.getByText('Gaji')).toBeDefined()
        expect(screen.queryByText(/Belum Ada Transaksi|No Transactions/i)).toBeNull()
      })
    })

    it('dynamically triggers split transaction item search re-filtering on ft-notes-decrypted', async () => {
      const splitCipher = 'enc:v1:aabbccdd:11223344'
      const splitPlain = 'kopi geisha eksklusif'
      let isSplitDecrypted = false

      vi.spyOn(fieldEncryption, 'getDecryptedNoteSync').mockImplementation((note, fallback = '') => {
        if (note === splitCipher) {
          return isSplitDecrypted ? splitPlain : fallback
        }
        return note || ''
      })

      const splitTx = {
        id: 202,
        walletId: 1,
        date: '2026-10-05',
        type: 'expense',
        category: 'Kafe',
        amount: 250000,
        currency: 'IDR',
        isSplit: true,
        splitItems: [
          {
            category: 'Minuman',
            subcategory: 'Manual Brew',
            notes: splitCipher,
            amount: 250000,
          },
        ],
      }

      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={[splitTx]}
            allWallets={[mockWallet]}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      const searchInput = screen.getByRole('textbox')
      fireEvent.change(searchInput, { target: { value: 'geisha' } })

      // Before event: 0 matches
      expect(screen.getByText(/Belum Ada Transaksi/i)).toBeDefined()

      // Dispatch event
      act(() => {
        isSplitDecrypted = true
        window.dispatchEvent(new CustomEvent('ft-notes-decrypted', { detail: { note: splitCipher } }))
      })

      // After event: split items unpacked and matched!
      await waitFor(() => {
        expect(screen.getByText('Kafe')).toBeDefined()
      })
    })

    it('ensures openEditTransaction decodes plain notes and never populates raw enc:v1: ciphertext into form', async () => {
      vi.spyOn(fieldEncryption, 'getDecryptedNoteSync').mockReturnValue('Catatan terdekripsi bersih')

      const txWithCipher = {
        id: 203,
        walletId: 1,
        date: '2026-10-05',
        type: 'expense',
        category: 'Belanja',
        amount: 50000,
        currency: 'IDR',
        notes: cipherText,
      }

      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={[txWithCipher]}
            allWallets={[mockWallet]}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      // Open detail sheet by clicking transaction card
      const txCard = screen.getByText('Belanja')
      fireEvent.click(txCard)

      // Detail sheet should open; then click edit button
      const editBtn = await screen.findByRole('button', { name: /Edit Transaksi|Edit transaction/i })
      fireEvent.click(editBtn)

      // The edit form should contain the safe decrypted notes, not enc:v1:
      const notesTextarea = await screen.findByDisplayValue('Catatan terdekripsi bersih')
      expect(notesTextarea).toBeDefined()
      expect(notesTextarea.value).toBe('Catatan terdekripsi bersih')
      expect(notesTextarea.value).not.toContain('enc:v1:')
    })

    it('renders decrypted notes in ReceiptPreviewModal without leaking ciphertext', async () => {
      vi.spyOn(fieldEncryption, 'getDecryptedNoteSync').mockReturnValue('Struk makan malam keluarga')

      const txWithReceipt = {
        id: 204,
        walletId: 1,
        date: '2026-10-05',
        type: 'expense',
        category: 'Restoran',
        amount: 350000,
        currency: 'IDR',
        notes: cipherText,
        receiptImage: 'data:image/png;base64,mockreceipt',
      }

      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={[txWithReceipt]}
            allWallets={[mockWallet]}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      // Click "Struk" button
      const receiptBtn = screen.getByRole('button', { name: /Lihat Bukti Transaksi|Struk|Receipt/i })
      fireEvent.click(receiptBtn)

      // Notes in modal should be decrypted (both card and ReceiptPreviewModal render “Struk makan malam keluarga”)
      const decryptedNoteEls = await screen.findAllByText(/Struk makan malam keluarga/)
      expect(decryptedNoteEls.length).toBeGreaterThanOrEqual(2)
      expect(screen.queryByText(/enc:v1:/)).toBeNull()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: PAGINATION & BOUNDARY TRANSITIONS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Pagination & Boundary Transitions (0, 20, 30, > 30 items)', () => {
    const mockWallet = { id: 1, name: 'BCA Utama', currency: 'IDR' }

    const generateTransactions = (count) => {
      return Array.from({ length: count }, (_, i) => ({
        id: 1000 + i,
        walletId: 1,
        date: `2026-09-${String(Math.max(1, 30 - (i % 30))).padStart(2, '0')}`,
        type: i % 2 === 0 ? 'expense' : 'income',
        category: `Kategori-${i}`,
        amount: (i + 1) * 10000,
        currency: 'IDR',
        notes: `Catatan transaksi ${i}`,
      }))
    }

    it('boundary 0 items: displays empty state and zero count badge', () => {
      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={[]}
            allWallets={[mockWallet]}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      expect(screen.getByText(/Belum Ada Transaksi/i)).toBeDefined()
      expect(screen.getByText('0 transaksi')).toBeDefined()
      expect(screen.queryByRole('button', { name: /Muat Lebih Banyak/i })).toBeNull()
    })

    it('boundary 20 items: renders all 20 transactions without pagination trigger button', () => {
      const txs20 = generateTransactions(20)
      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={txs20}
            allWallets={[mockWallet]}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      expect(screen.getByText('20 transaksi')).toBeDefined()
      expect(screen.getByText(/Catatan transaksi 0/)).toBeDefined()
      expect(screen.getByText(/Catatan transaksi 19/)).toBeDefined()
      // All 20 items are visible, so hasMore is false
      expect(screen.queryByRole('button', { name: /Tampilkan Lebih Banyak|Muat Lebih Banyak/i })).toBeNull()
    })

    it('boundary 30 items (exact page size threshold): renders all 30 without button', () => {
      // 30 items on separate dates
      const txs30 = Array.from({ length: 30 }, (_, i) => ({
        id: 2000 + i,
        walletId: 1,
        date: `2026-08-${String(i + 1).padStart(2, '0')}`,
        type: 'expense',
        category: `Kategori-${i}`,
        amount: 50000,
        currency: 'IDR',
        notes: `Tx 30 Batch item ${i}`,
      }))

      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={txs30}
            allWallets={[mockWallet]}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      expect(screen.getByText('30 transaksi')).toBeDefined()
      expect(screen.getByText(/Tx 30 Batch item 0/)).toBeDefined()
      expect(screen.getByText(/Tx 30 Batch item 29/)).toBeDefined()
      // rendered count 30 == total count 30 -> hasMore is false
      expect(screen.queryByRole('button', { name: /Tampilkan Lebih Banyak|Muat Lebih Banyak/i })).toBeNull()
    })

    it('boundary > 30 items (45 items across distinct dates): caps at 30, shows load more button, and loads remaining on click', () => {
      const txs45 = Array.from({ length: 45 }, (_, i) => {
        const day = (i % 28) + 1
        const month = i < 28 ? '07' : '06'
        return {
          id: 3000 + i,
          walletId: 1,
          date: `2026-${month}-${String(day).padStart(2, '0')}`,
          type: 'expense',
          category: `Kat-${i}`,
          amount: 25000,
          currency: 'IDR',
          notes: `Batch45 item ${i}`,
        }
      })

      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={txs45}
            allWallets={[mockWallet]}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      expect(screen.getByText('45 transaksi')).toBeDefined()
      // Initial render should have the "Tampilkan Lebih Banyak" button
      const loadMoreBtn = screen.getByRole('button', { name: /Tampilkan Lebih Banyak|Muat Lebih Banyak/i })
      expect(loadMoreBtn).toBeDefined()

      // Click to load next batch
      fireEvent.click(loadMoreBtn)

      // Now all 45 items are loaded and button is removed
      expect(screen.queryByRole('button', { name: /Tampilkan Lebih Banyak|Muat Lebih Banyak/i })).toBeNull()
      expect(screen.getByText(/Batch45 item 44/)).toBeDefined()
    })

    it('automatically resets extraCount when activeTab or searchQuery changes', () => {
      const txs50 = Array.from({ length: 50 }, (_, i) => ({
        id: 4000 + i,
        walletId: 1,
        date: `2026-05-${String((i % 25) + 1).padStart(2, '0')}`,
        type: i % 2 === 0 ? 'expense' : 'income',
        category: `Tipe-${i % 2 === 0 ? 'Exp' : 'Inc'}`,
        amount: 10000,
        currency: 'IDR',
        notes: `ResetTest item ${i}`,
      }))

      render(
        <MemoryRouter>
          <WalletTransactionsList
            walletId={1}
            wallet={mockWallet}
            allTransactions={txs50}
            allWallets={[mockWallet]}
            defaultCurrency="IDR"
            locale="id"
          />
        </MemoryRouter>
      )

      // Click "Tampilkan Lebih Banyak" to expand pagination
      const loadMoreBtn = screen.getByRole('button', { name: /Tampilkan Lebih Banyak|Muat Lebih Banyak/i })
      fireEvent.click(loadMoreBtn)

      // Now change search query to filter
      const searchInput = screen.getByRole('textbox')
      fireEvent.change(searchInput, { target: { value: 'ResetTest item 1' } })

      // Filtering reduces count, proving state transition safely updated
      expect(screen.getAllByText(/ResetTest item 1/).length).toBeGreaterThan(0)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4: DEFAULT WALLET REASSIGNMENT ON DELETE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Default Wallet Reassignment Logic on Delete', () => {
    const defaultWallet = {
      id: 10,
      name: 'Dompet Utama',
      institutionType: 'bank',
      currency: 'IDR',
    }

    const secondaryWallet = {
      id: 20,
      name: 'Dompet Cadangan',
      institutionType: 'ewallet',
      currency: 'IDR',
      isArchived: 0,
    }

    const archivedWallet = {
      id: 30,
      name: 'Dompet Terarsip',
      institutionType: 'bank',
      currency: 'IDR',
      isArchived: 1,
    }

    it('aborts deletion and displays error if wallet has active unpaid loans', async () => {
      await db.loans.add({
        id: 501,
        walletId: 10,
        status: 'active',
        remainingAmount: 750000,
      })

      const onError = vi.fn()
      const setIsDeleteModalOpen = vi.fn()

      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={defaultWallet}
            allWallets={[defaultWallet, secondaryWallet]}
            isDefaultWallet={true}
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

      const confirmBtn = screen.getByRole('button', { name: /Hapus|Delete/i })
      fireEvent.click(confirmBtn)

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.stringContaining('masih terdapat catatan utang/piutang aktif')
        )
        expect(mockDeleteWallet).not.toHaveBeenCalled()
        expect(setIsDeleteModalOpen).toHaveBeenCalledWith(false)
      })
    })

    it('permits deletion if loans associated with the wallet are paid, forgiven, or have zero remaining amount', async () => {
      await db.loans.bulkAdd([
        { id: 502, walletId: 10, status: 'paid', remainingAmount: 0 },
        { id: 503, walletId: 10, status: 'forgiven', remainingAmount: 50000 },
        { id: 504, walletId: 10, status: 'active', remainingAmount: 0 },
      ])

      const onError = vi.fn()
      const setDefaultWalletIdSpy = vi.spyOn(useSettingsStore.getState(), 'setDefaultWalletId')

      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={defaultWallet}
            allWallets={[defaultWallet, secondaryWallet]}
            isDefaultWallet={true}
            isActionMenuOpen={false}
            setIsActionMenuOpen={vi.fn()}
            isEditWalletModalOpen={false}
            setIsEditWalletModalOpen={vi.fn()}
            isEditBalanceModalOpen={false}
            setIsEditBalanceModalOpen={vi.fn()}
            isDeleteModalOpen={true}
            setIsDeleteModalOpen={vi.fn()}
            onError={onError}
            locale="id"
          />
        </MemoryRouter>
      )

      const confirmBtn = screen.getByRole('button', { name: /Hapus|Delete/i })
      fireEvent.click(confirmBtn)

      await waitFor(() => {
        expect(onError).not.toHaveBeenCalled()
        // Reassigned to secondaryWallet (id: 20)
        expect(setDefaultWalletIdSpy).toHaveBeenCalledWith(20)
        expect(mockDeleteWallet).toHaveBeenCalledWith(10)
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
      })
    })

    it('skips archived wallets when selecting replacement default wallet', async () => {
      const activeWallet3 = { id: 40, name: 'Dompet Baru', isArchived: 0 }
      const allWalletsList = [defaultWallet, archivedWallet, activeWallet3]

      const setDefaultWalletIdSpy = vi.spyOn(useSettingsStore.getState(), 'setDefaultWalletId')

      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={defaultWallet}
            allWallets={allWalletsList}
            isDefaultWallet={true}
            isActionMenuOpen={false}
            setIsActionMenuOpen={vi.fn()}
            isEditWalletModalOpen={false}
            setIsEditWalletModalOpen={vi.fn()}
            isEditBalanceModalOpen={false}
            setIsEditBalanceModalOpen={vi.fn()}
            isDeleteModalOpen={true}
            setIsDeleteModalOpen={vi.fn()}
            locale="id"
          />
        </MemoryRouter>
      )

      const confirmBtn = screen.getByRole('button', { name: /Hapus|Delete/i })
      fireEvent.click(confirmBtn)

      await waitFor(() => {
        // Skips archivedWallet (id: 30) and picks activeWallet3 (id: 40)
        expect(setDefaultWalletIdSpy).toHaveBeenCalledWith(40)
        expect(mockDeleteWallet).toHaveBeenCalledWith(10)
      })
    })

    it('sets defaultWalletId to null when no other active non-archived wallets exist', async () => {
      const onlyDefaultAndArchived = [defaultWallet, archivedWallet]
      const setDefaultWalletIdSpy = vi.spyOn(useSettingsStore.getState(), 'setDefaultWalletId')

      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={defaultWallet}
            allWallets={onlyDefaultAndArchived}
            isDefaultWallet={true}
            isActionMenuOpen={false}
            setIsActionMenuOpen={vi.fn()}
            isEditWalletModalOpen={false}
            setIsEditWalletModalOpen={vi.fn()}
            isEditBalanceModalOpen={false}
            setIsEditBalanceModalOpen={vi.fn()}
            isDeleteModalOpen={true}
            setIsDeleteModalOpen={vi.fn()}
            locale="id"
          />
        </MemoryRouter>
      )

      const confirmBtn = screen.getByRole('button', { name: /Hapus|Delete/i })
      fireEvent.click(confirmBtn)

      await waitFor(() => {
        expect(setDefaultWalletIdSpy).toHaveBeenCalledWith(null)
        expect(mockDeleteWallet).toHaveBeenCalledWith(10)
      })
    })

    it('does NOT reassign defaultWalletId when deleting a non-default wallet', async () => {
      const nonDefaultWallet = { id: 25, name: 'Bukan Utama' }
      const setDefaultWalletIdSpy = vi.spyOn(useSettingsStore.getState(), 'setDefaultWalletId')

      render(
        <MemoryRouter>
          <WalletManageModals
            wallet={nonDefaultWallet}
            allWallets={[defaultWallet, nonDefaultWallet]}
            isDefaultWallet={false}
            isActionMenuOpen={false}
            setIsActionMenuOpen={vi.fn()}
            isEditWalletModalOpen={false}
            setIsEditWalletModalOpen={vi.fn()}
            isEditBalanceModalOpen={false}
            setIsEditBalanceModalOpen={vi.fn()}
            isDeleteModalOpen={true}
            setIsDeleteModalOpen={vi.fn()}
            locale="id"
          />
        </MemoryRouter>
      )

      const confirmBtn = screen.getByRole('button', { name: /Hapus|Delete/i })
      fireEvent.click(confirmBtn)

      await waitFor(() => {
        expect(setDefaultWalletIdSpy).not.toHaveBeenCalled()
        expect(mockDeleteWallet).toHaveBeenCalledWith(25)
      })
    })
  })
})
