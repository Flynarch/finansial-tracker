// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TransactionItemCard } from '../src/components/transactions/TransactionItemCard'
import { DashboardRecentTx } from '../src/components/dashboard/DashboardRecentTx'
import { useDecryptedNote } from '../src/hooks/useDecryptedNote'
import DeleteConfirmCard from '../src/components/chat/DeleteConfirmCard'
import { computeFilteredTransactions } from '../src/hooks/useTransactionFilters'
import {
  encryptField,
  warmupDecryptionCache,
  getDecryptedNoteSync,
  clearSessionEncryptionKey,
} from '../src/lib/fieldEncryption'
import {
  calculateTotalWalletBalance,
  computeCashBalanceBeforeDateHelper,
} from '../src/hooks/dashboard/assetBreakdownSlice'
import LockScreen from '../src/components/ui/LockScreen'
import useSettingsStore from '../src/store/useSettingsStore'
import { authenticateBiometric } from '../src/lib/biometric'
import { authenticatePasskey, getStoredPasskeys } from '../src/lib/passkeys'

vi.mock('../src/lib/biometric', () => ({
  authenticateBiometric: vi.fn().mockResolvedValue(true),
  canUseBiometric: vi.fn().mockResolvedValue(true),
}))

vi.mock('../src/lib/passkeys', () => ({
  authenticatePasskey: vi.fn().mockResolvedValue({ success: true }),
  getStoredPasskeys: vi.fn().mockReturnValue([]),
}))

vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
}))

vi.mock('../src/lib/db', () => ({
  db: {
    settings: {
      put: vi.fn().mockResolvedValue('preferences'),
      get: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(1),
    },
  },
}))

describe('Field Decryption UX & Web LockScreen Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearSessionEncryptionKey()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Transaction Note Decryption in UI Cards', () => {
    const defaultCardProps = {
      locale: 'id',
      t: (key, fallback) => fallback || key,
      format: vi.fn(),
      defaultCurrency: 'IDR',
      formatCurrency: (val) => `Rp ${val}`,
      convertCurrency: (val) => val,
      getCategoryColorClass: () => 'bg-emerald-500 text-white',
      resolveTransactionIconKey: () => 'food',
      getTransactionCategoryLabels: () => ({ main: 'Makanan', sub: null }),
      rates: {},
      wallets: [{ id: 1, name: 'BCA Utama' }],
    }

    it('renders decrypted note in TransactionItemCard when note is encrypted and cached', async () => {
      const plaintextNote = 'Nasi goreng kambing kebon sirih'
      const encryptedNote = await encryptField(plaintextNote)

      // Warm up cache as done in Transactions.jsx
      await warmupDecryptionCache([{ notes: encryptedNote }])

      // Verify sync cache hit
      expect(getDecryptedNoteSync(encryptedNote)).toBe(plaintextNote)

      const tx = {
        id: 101,
        amount: 45000,
        type: 'expense',
        category: 'makanan/makan_diluar',
        notes: encryptedNote,
        date: '2026-10-05',
        currency: 'IDR',
        walletId: 1,
      }

      render(<TransactionItemCard {...defaultCardProps} transaction={tx} />)

      // The plaintext note should appear in the rendered document, not the ciphertext
      expect(screen.getByText(/Nasi goreng kambing kebon sirih/)).toBeDefined()
      expect(screen.queryByText(encryptedNote)).toBeNull()
    })

    it('renders plaintext directly when note is not encrypted', () => {
      const plainNote = 'Kopi kenangan mantan'
      const tx = {
        id: 102,
        amount: 22000,
        type: 'expense',
        category: 'makanan/minuman',
        notes: plainNote,
        date: '2026-10-05',
        currency: 'IDR',
        walletId: 1,
      }

      render(<TransactionItemCard {...defaultCardProps} transaction={tx} />)
      expect(screen.getByText(/Kopi kenangan mantan/)).toBeDefined()
    })

    it('renders decrypted note in DashboardRecentTx and never leaks raw ciphertext for encrypted DANA transactions', async () => {
      const plaintextNote = 'Transfer ke DANA Top Up'
      const encryptedNote = await encryptField(plaintextNote)

      // Warm up cache as done in useDashboardData
      await warmupDecryptionCache([{ notes: encryptedNote }])

      expect(getDecryptedNoteSync(encryptedNote)).toBe(plaintextNote)

      const danaTx = {
        id: 999,
        amount: 50000,
        type: 'expense',
        category: 'transfer',
        notes: encryptedNote,
        date: '2026-10-05',
        currency: 'IDR',
        walletId: 1,
        createdAt: Date.now(),
      }

      const groupedRecentEntries = [
        ['2026-10-05', [danaTx]],
      ]

      render(
        <MemoryRouter>
          <DashboardRecentTx
            groupedRecentEntries={groupedRecentEntries}
            isDbLoading={false}
            defaultCurrency="IDR"
            locale="id"
            rates={{}}
            wallets={[{ id: 1, name: 'DANA' }]}
            t={(k, fallback) => fallback || k}
          />
        </MemoryRouter>
      )

      expect(screen.getByText(/Transfer ke DANA Top Up/)).toBeDefined()
      expect(screen.queryByText(/enc:v1:/)).toBeNull()
    })

    it('suppresses raw ciphertext completely when cache is cold or key is missing in DashboardRecentTx', () => {
      const encryptedNote = 'enc:v1:ac09ad0e3aa84d4410c44d78:910ce2db0d2788075a5e35bb8db0924e54d39c71234'

      const coldTx = {
        id: 998,
        amount: 25000,
        type: 'expense',
        category: 'makanan',
        notes: encryptedNote,
        date: '2026-10-05',
        currency: 'IDR',
        walletId: 1,
        createdAt: Date.now(),
      }

      const groupedRecentEntries = [
        ['2026-10-05', [coldTx]],
      ]

      render(
        <MemoryRouter>
          <DashboardRecentTx
            groupedRecentEntries={groupedRecentEntries}
            isDbLoading={false}
            defaultCurrency="IDR"
            locale="id"
            rates={{}}
            wallets={[{ id: 1, name: 'DANA' }]}
            t={(k, fallback) => fallback || k}
          />
        </MemoryRouter>
      )

      // Raw ciphertext must NEVER be rendered in the document
      expect(screen.queryByText(/enc:v1:/)).toBeNull()
    })

    it('useDecryptedNote hook safely resolves plaintext and guards against ciphertext', async () => {
      // 1. Non-encrypted plain text
      const { result: plainResult } = renderHook(() => useDecryptedNote('Plain note text'))
      expect(plainResult.current).toBe('Plain note text')

      // 2. Empty / falsy note
      const { result: emptyResult } = renderHook(() => useDecryptedNote(''))
      expect(emptyResult.current).toBe('')

      // 3. Encrypted note that is cached
      const secret = 'Rahasia dompet'
      const cipher = await encryptField(secret)
      await warmupDecryptionCache([{ notes: cipher }])

      const { result: cachedResult } = renderHook(() => useDecryptedNote(cipher))
      expect(cachedResult.current).toBe(secret)
      expect(cachedResult.current.startsWith('enc:v1:')).toBe(false)
    })

    it('suppresses raw ciphertext completely when cache is cold in TransactionItemCard', () => {
      const encryptedNote = 'enc:v1:ac09ad0e3aa84d4410c44d78:910ce2db0d2788075a5e35bb8db0924e54d39c79999'
      const coldTx = {
        id: 103,
        amount: 35000,
        type: 'expense',
        category: 'makanan/jajan',
        notes: encryptedNote,
        date: '2026-10-05',
        currency: 'IDR',
        walletId: 1,
      }

      render(<TransactionItemCard {...defaultCardProps} transaction={coldTx} />)
      expect(screen.queryByText(/enc:v1:/)).toBeNull()
    })

    it('sanitizes encrypted notes in DeleteConfirmCard to prevent ciphertext leak', async () => {
      const plainNote = 'Beli paket data Telkomsel'
      const encryptedNote = await encryptField(plainNote)
      await warmupDecryptionCache([{ notes: encryptedNote }])

      const { unmount } = render(
        <DeleteConfirmCard
          msgId="msg-1"
          data={{ id: 501, amount: 100000, notes: encryptedNote, category: 'tagihan/telepon' }}
          locale="id"
        />
      )
      expect(screen.getByText(/Beli paket data Telkomsel/)).toBeDefined()
      expect(screen.queryByText(/enc:v1:/)).toBeNull()
      unmount()

      // Cold cache case
      const coldEncrypted = 'enc:v1:deadbeef1234567890abcdef:1122334455667788'
      render(
        <DeleteConfirmCard
          msgId="msg-2"
          data={{ id: 502, amount: 50000, notes: coldEncrypted, category: 'tagihan/listrik' }}
          locale="id"
        />
      )
      expect(screen.queryByText(/enc:v1:/)).toBeNull()
    })

    it('computeFilteredTransactions safely searches by decrypted notes and avoids false positives on ciphertext', async () => {
      const secretNote = 'Pembayaran DANA Merchant Kopi'
      const encryptedNote = await encryptField(secretNote)
      await warmupDecryptionCache([{ notes: encryptedNote }])

      const txs = [
        {
          id: 1,
          date: '2026-10-05',
          amount: 25000,
          type: 'expense',
          category: 'makanan',
          notes: encryptedNote,
        },
      ]

      // Search by plaintext word
      const matchesPlain = computeFilteredTransactions(txs, { search: 'Merchant Kopi' }, 1, 1)
      expect(matchesPlain.length).toBe(1)

      // Search by 'enc:v1' must NOT match because ciphertext is sanitized
      const matchesCipher = computeFilteredTransactions(txs, { search: 'enc:v1' }, 1, 1)
      expect(matchesCipher.length).toBe(0)
    })
  })

  describe('Financial Rounding in Asset Breakdown Slice', () => {
    it('eliminates floating-point drift in calculateTotalWalletBalance', () => {
      const wallets = [
        { id: 1, currentBalance: 0.1, currency: 'USD', isArchived: false },
        { id: 2, currentBalance: 0.2, currency: 'USD', isArchived: false },
      ]
      // In JS, 0.1 + 0.2 = 0.30000000000000004
      const rates = { USD: 1 }
      const total = calculateTotalWalletBalance(wallets, 'USD', rates)
      expect(total).toBe(0.3)
    })

    it('eliminates floating-point drift in computeCashBalanceBeforeDateHelper', () => {
      const totalWalletBalance = 100.0
      const txs = [
        {
          id: 1,
          date: '2026-10-05',
          walletId: 1,
          type: 'income',
          convertedAmount: 0.1,
        },
        {
          id: 2,
          date: '2026-10-05',
          walletId: 1,
          type: 'income',
          convertedAmount: 0.2,
        },
      ]
      const activeWalletIdSet = new Set(['1'])
      const balanceBefore = computeCashBalanceBeforeDateHelper({
        dateKey: '2026-10-05',
        normalizedTransactions: txs,
        totalWalletBalance,
        activeWalletIdSet,
        defaultCurrency: 'USD',
      })
      // 100 - (0.1 + 0.2) = 99.7 (not 99.700000000000003)
      expect(balanceBefore).toBe(99.7)
    })
  })

  describe('LockScreen Web WebAuthn Gestures', () => {
    beforeEach(() => {
      useSettingsStore.setState({
        securityEnabled: true,
        securityMethod: 'biometric',
        biometricEnabled: true,
        storedPin: '1234',
        lockSecret: '1234',
      })
    })

    it('does NOT auto-prompt WebAuthn or biometrics on web mount without user activation', async () => {
      vi.useFakeTimers()

      render(<LockScreen onUnlock={vi.fn()} />)

      // Fast-forward past the 280ms timer
      act(() => {
        vi.advanceTimersByTime(500)
      })

      // Neither biometric nor passkey should be invoked without user gesture
      expect(authenticateBiometric).not.toHaveBeenCalled()
      expect(authenticatePasskey).not.toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('renders passkey unlock label and KeyRound icon when passkeys exist on web', async () => {
      getStoredPasskeys.mockReturnValue([{ id: 'credential-1', name: 'My YubiKey' }])

      render(<LockScreen onUnlock={vi.fn()} />)

      // In biometric-only mode on web with passkeys, the button text should indicate Passkey
      expect(screen.getByText(/Passkey/i)).toBeDefined()

      // Clicking triggers passkey authentication
      const btn = screen.getByText(/Passkey/i).closest('button')
      await act(async () => {
        fireEvent.click(btn)
      })

      expect(authenticatePasskey).toHaveBeenCalled()
    })
  })
})
