// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { TransactionItemCard } from '../src/components/transactions/TransactionItemCard'
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
