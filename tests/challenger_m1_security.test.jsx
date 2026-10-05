// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { db } from '../src/lib/db'
import { canUseBiometric, authenticateBiometric } from '../src/lib/biometric'
import * as passkeysModule from '../src/lib/passkeys'
import {
  decryptField,
  isFieldEncrypted,
} from '../src/lib/fieldEncryption'
import {
  createTransaction,
  updateTransaction,
  getTransaction,
} from '../src/services/transactionService'
import LockScreen from '../src/components/ui/LockScreen'
import useSettingsStore from '../src/store/useSettingsStore'
import { Capacitor } from '@capacitor/core'
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth'

vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
}))

vi.mock('../src/lib/smartNotifications', () => ({
  initNotificationChannels: vi.fn().mockResolvedValue(true),
  checkBudgetAlertsAfterExpense: vi.fn().mockResolvedValue(true),
}))

vi.mock('../src/lib/nativeWidgetSync', () => ({
  scheduleNativeWidgetSync: vi.fn(),
}))

vi.mock('../src/lib/ai/entityMemory', () => ({
  rememberTransactionEntity: vi.fn(),
  updateEntityMemory: vi.fn(),
  forgetTransactionEntity: vi.fn(),
}))

describe('Challenger M1 Adversarial Suite - Security Hardening & Edge Resilience', () => {
  let sampleWalletId
  const originalPublicKeyCredential = window.PublicKeyCredential

  beforeEach(async () => {
    vi.restoreAllMocks()
    await db.wallets.clear()
    await db.transactions.clear()

    sampleWalletId = await db.wallets.add({
      name: 'Rekening Adversarial',
      currency: 'IDR',
      balance: 5000000,
      isArchived: 0,
    })

    useSettingsStore.setState({
      locale: 'id',
      securityEnabled: true,
      securityMethod: 'pin',
      lockSecret: '1234',
      biometricEnabled: true,
      autoLockTimeout: 0,
      defaultWalletId: sampleWalletId,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
    window.PublicKeyCredential = originalPublicKeyCredential
  })

  // =========================================================================
  // CHALLENGE 1: Biometric Auto-Approval Bypass Elimination
  // =========================================================================
  describe('Challenge 1: Elimination of Web Biometric Simulation & Bypass', () => {
    it('canUseBiometric strictly returns false when window.PublicKeyCredential is undefined', async () => {
      window.PublicKeyCredential = undefined
      const available = await canUseBiometric()
      expect(available).toBe(false)
    })

    it('canUseBiometric strictly returns false when isUserVerifyingPlatformAuthenticatorAvailable is missing or not a function', async () => {
      window.PublicKeyCredential = {}
      const available = await canUseBiometric()
      expect(available).toBe(false)
    })

    it('canUseBiometric strictly returns false when platform authenticator check resolves to false', async () => {
      window.PublicKeyCredential = {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(false),
      }
      const available = await canUseBiometric()
      expect(available).toBe(false)
    })

    it('canUseBiometric catches and returns false when platform check throws SecurityError or DOMException (no dev bypass)', async () => {
      window.PublicKeyCredential = {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockRejectedValue(
          new DOMException('Access denied by browser security policy', 'SecurityError')
        ),
      }
      const available = await canUseBiometric()
      expect(available).toBe(false)
    })

    it('canUseBiometric catches and returns false when platform check throws non-Error primitives', async () => {
      window.PublicKeyCredential = {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockRejectedValue('Fatal internal failure'),
      }
      const available = await canUseBiometric()
      expect(available).toBe(false)
    })

    it('canUseBiometric returns true ONLY when genuine platform authenticator confirms available', async () => {
      window.PublicKeyCredential = {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
      }
      const available = await canUseBiometric()
      expect(available).toBe(true)
    })

    it('authenticateBiometric on web returns false when 0 passkeys exist (ABSOLUTELY NO auto-approval simulation)', async () => {
      window.PublicKeyCredential = {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
      }
      vi.spyOn(passkeysModule, 'getStoredPasskeys').mockReturnValue([])

      const success = await authenticateBiometric()
      expect(success).toBe(false)
    })

    it('authenticateBiometric on web returns false when passkeys array is null or corrupt', async () => {
      window.PublicKeyCredential = {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
      }
      vi.spyOn(passkeysModule, 'getStoredPasskeys').mockImplementation(() => {
        throw new Error('Corrupted localStorage payload')
      })

      const success = await authenticateBiometric()
      expect(success).toBe(false)
    })

    it('authenticateBiometric returns false when authenticatePasskey returns { success: false }', async () => {
      window.PublicKeyCredential = {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
      }
      vi.spyOn(passkeysModule, 'getStoredPasskeys').mockReturnValue([
        { id: 'pk-registered-1', deviceName: 'Windows Hello' },
      ])
      vi.spyOn(passkeysModule, 'authenticatePasskey').mockResolvedValue({ success: false })

      const success = await authenticateBiometric()
      expect(success).toBe(false)
    })

    it('authenticateBiometric returns false when authenticatePasskey rejects with NotAllowedError', async () => {
      window.PublicKeyCredential = {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
      }
      vi.spyOn(passkeysModule, 'getStoredPasskeys').mockReturnValue([
        { id: 'pk-registered-1', deviceName: 'Windows Hello' },
      ])
      vi.spyOn(passkeysModule, 'authenticatePasskey').mockRejectedValue(
        new DOMException('User dismissed biometric prompt', 'NotAllowedError')
      )

      const success = await authenticateBiometric()
      expect(success).toBe(false)
    })

    it('native platform: authenticateBiometric returns false when native BiometricAuth throws', async () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
      BiometricAuth.authenticate = vi.fn().mockRejectedValue(new Error('Fingerprint not recognized'))

      const success = await authenticateBiometric()
      expect(success).toBe(false)
    })
  })

  // =========================================================================
  // CHALLENGE 2: Passkey Authentication in LockScreen & PIN Fallback
  // =========================================================================
  describe('Challenge 2: Passkey Authentication in LockScreen & Fallback to PIN', () => {
    it('when 0 passkeys exist on web: auto-prompt fails safely, leaves screen locked, and allows successful PIN entry', async () => {
      vi.useFakeTimers()
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
      vi.spyOn(passkeysModule, 'getStoredPasskeys').mockReturnValue([])
      const passkeySpy = vi.spyOn(passkeysModule, 'authenticatePasskey')

      const handleUnlock = vi.fn()
      render(<LockScreen onUnlock={handleUnlock} />)

      // Fast-forward auto-prompt delay (280ms)
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      // Must NOT attempt to authenticate nonexistent passkey
      expect(passkeySpy).not.toHaveBeenCalled()
      // Screen remains locked
      expect(handleUnlock).not.toHaveBeenCalled()

      // Fallback: user types PIN '1234' on keypad with proper act flushes
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '1' }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '2' }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '3' }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '4' }))
      })

      // Fast-forward unlock animation (300ms) and flush microtasks
      await act(async () => {
        await Promise.resolve()
        vi.advanceTimersByTime(350)
      })

      // Successfully unlocked via PIN
      expect(handleUnlock).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })

    it('when WebAuthn prompt is cancelled by user: shows error message, keeps screen locked, and enables PIN unlock', async () => {
      vi.useFakeTimers()
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
      vi.spyOn(passkeysModule, 'getStoredPasskeys').mockReturnValue([
        { id: 'pk-registered-1', deviceName: 'MacBook Touch ID' },
      ])
      vi.spyOn(passkeysModule, 'authenticatePasskey').mockRejectedValue(
        new Error('Autentikasi Passkey dibatalkan oleh pengguna.')
      )

      const handleUnlock = vi.fn()
      render(<LockScreen onUnlock={handleUnlock} />)

      // User triggers passkey via explicit gesture on web
      const passkeyBtn = screen.getByLabelText(/Passkey/i)
      await act(async () => {
        fireEvent.click(passkeyBtn)
      })

      expect(handleUnlock).not.toHaveBeenCalled()
      // Error message is displayed in UI
      expect(screen.getByText('Autentikasi Passkey dibatalkan oleh pengguna.')).toBeTruthy()

      // Fallback to PIN
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '1' }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '2' }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '3' }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '4' }))
      })

      await act(async () => {
        await Promise.resolve()
        vi.advanceTimersByTime(350)
      })

      expect(handleUnlock).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })

    it('calling authenticatePasskey directly with empty passkeys throws descriptive error', async () => {
      const origCreds = navigator.credentials
      Object.defineProperty(navigator, 'credentials', {
        value: { get: vi.fn(), create: vi.fn() },
        configurable: true,
      })
      vi.spyOn(passkeysModule, 'getStoredPasskeys').mockReturnValue([])
      try {
        await expect(passkeysModule.authenticatePasskey()).rejects.toThrow(
          'Belum ada Passkey yang terdaftar.'
        )
      } finally {
        Object.defineProperty(navigator, 'credentials', {
          value: origCreds,
          configurable: true,
        })
      }
    })

    it('when passkey succeeds: completes unlock animation and invokes onUnlock', async () => {
      vi.useFakeTimers()
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
      vi.spyOn(passkeysModule, 'getStoredPasskeys').mockReturnValue([
        { id: 'pk-registered-1', deviceName: 'YubiKey 5C' },
      ])
      vi.spyOn(passkeysModule, 'authenticatePasskey').mockResolvedValue({
        success: true,
        credentialId: 'pk-registered-1',
      })

      const handleUnlock = vi.fn()
      render(<LockScreen onUnlock={handleUnlock} />)

      // User triggers passkey via explicit gesture on web
      const passkeyBtn = screen.getByLabelText(/Passkey/i)
      await act(async () => {
        fireEvent.click(passkeyBtn)
      })

      // Fill animation takes ~450ms
      await act(async () => {
        vi.advanceTimersByTime(500)
      })

      expect(handleUnlock).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })

    it('clicking manual biometric trigger retries passkey after initial cancellation', async () => {
      vi.useFakeTimers()
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
      vi.spyOn(passkeysModule, 'getStoredPasskeys').mockReturnValue([
        { id: 'pk-registered-1', deviceName: 'Windows Hello' },
      ])

      const passkeyMock = vi.spyOn(passkeysModule, 'authenticatePasskey')
        .mockRejectedValueOnce(new Error('Prompt ditutup.'))
        .mockResolvedValueOnce({ success: true, credentialId: 'pk-registered-1' })

      const handleUnlock = vi.fn()
      render(<LockScreen onUnlock={handleUnlock} />)

      // User clicks passkey trigger, first attempt is cancelled
      const bioButton = screen.getByLabelText(/Passkey/i)
      await act(async () => {
        fireEvent.click(bioButton)
      })
      expect(passkeyMock).toHaveBeenCalledTimes(1)
      expect(handleUnlock).not.toHaveBeenCalled()
      expect(screen.getByText('Prompt ditutup.')).toBeTruthy()

      // User manually retries by clicking the biometric passkey button
      await act(async () => {
        fireEvent.click(bioButton)
      })

      await act(async () => {
        await Promise.resolve()
        vi.advanceTimersByTime(600)
      })

      expect(passkeyMock).toHaveBeenCalledTimes(2)
      expect(handleUnlock).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })
  })

  // =========================================================================
  // CHALLENGE 3: Field Encryption Edge Cases & Error Resilience
  // =========================================================================
  describe('Challenge 3: Field Encryption Edge Cases & Corrupted Ciphertext Resilience', () => {
    it('handles empty string, null, and undefined notes without errors or pseudo-encryption', async () => {
      const emptyTxId = await createTransaction({
        walletId: sampleWalletId,
        type: 'expense',
        amount: 25000,
        notes: '',
        date: '2026-04-10',
      })
      const emptyTx = await getTransaction(emptyTxId)
      expect(emptyTx).toBeTruthy()
      expect(emptyTx.notes === '' || emptyTx.notes == null).toBe(true)

      const nullTxId = await createTransaction({
        walletId: sampleWalletId,
        type: 'income',
        amount: 50000,
        notes: null,
        date: '2026-04-10',
      })
      const nullTx = await getTransaction(nullTxId)
      expect(nullTx).toBeTruthy()
      expect(nullTx.notes == null).toBe(true)

      const undefTxId = await createTransaction({
        walletId: sampleWalletId,
        type: 'income',
        amount: 30000,
        date: '2026-04-10',
      })
      const undefTx = await getTransaction(undefTxId)
      expect(undefTx).toBeTruthy()
      expect(undefTx.notes == null).toBe(true)
    })

    it('encrypts and decrypts multi-byte Unicode, Asian characters, Arabic, accents, and financial symbols', async () => {
      const complexUnicode = 'Makan malam Sushi 🍣 & Wagyu (¥18,500 / €120.00 / £99.90) di "Café de Paris" — متجر دبي 💎 — 𠮷野家'
      const txId = await createTransaction({
        walletId: sampleWalletId,
        type: 'expense',
        amount: 350000,
        category: 'makanan',
        notes: complexUnicode,
        date: '2026-04-11',
      })

      // Raw record in IndexedDB must be encrypted with enc:v1:
      const rawInDb = await db.transactions.get(txId)
      expect(isFieldEncrypted(rawInDb.notes)).toBe(true)
      expect(rawInDb.notes).not.toContain('Sushi')
      expect(rawInDb.notes).not.toContain('🍣')

      // getTransaction must decrypt back to identical Unicode string byte-for-byte
      const decryptedTx = await getTransaction(txId)
      expect(decryptedTx.notes).toBe(complexUnicode)
    })

    it('encrypts and decrypts massive Unicode payloads (>10,000 chars) without truncation or memory issues', async () => {
      const longNote = 'Catatan panjang: 🚀 ' + 'Rp 1.000.000 per transaksi; '.repeat(400)
      const txId = await createTransaction({
        walletId: sampleWalletId,
        type: 'expense',
        amount: 100000,
        notes: longNote,
        date: '2026-04-11',
      })

      const rawInDb = await db.transactions.get(txId)
      expect(isFieldEncrypted(rawInDb.notes)).toBe(true)

      const decryptedTx = await getTransaction(txId)
      expect(decryptedTx.notes).toBe(longNote)
      expect(decryptedTx.notes.length).toBe(longNote.length)
    })

    it('preserves legacy plaintext notes containing colons, symbols, and pseudo-prefixes', async () => {
      const legacyNoteWithColons = 'ORDER: #99812: MERCHANT: Tokopedia: ITEM: Monitor 4K'
      const legacyId = await db.transactions.add({
        walletId: sampleWalletId,
        type: 'expense',
        amount: 4500000,
        category: 'elektronik',
        notes: legacyNoteWithColons,
        date: '2025-12-01',
        createdAt: Date.now(),
        deletedAt: null,
      })

      const retrieved = await getTransaction(legacyId)
      expect(retrieved).toBeTruthy()
      expect(retrieved.notes).toBe(legacyNoteWithColons)

      // Test pseudo-prefixes like enc:v0: or enc:custom:
      const pseudoEncryptedNote = 'enc:v0:old_format_raw_text'
      const pseudoId = await db.transactions.add({
        walletId: sampleWalletId,
        type: 'expense',
        amount: 50000,
        notes: pseudoEncryptedNote,
        date: '2025-11-01',
        createdAt: Date.now(),
        deletedAt: null,
      })

      const pseudoRetrieved = await getTransaction(pseudoId)
      expect(pseudoRetrieved.notes).toBe(pseudoEncryptedNote)
    })

    it('survives corrupted ciphertext (enc:v1:corrupted) in getTransaction without throwing', async () => {
      const corruptedNote = 'enc:v1:corrupted'
      const txId = await db.transactions.add({
        walletId: sampleWalletId,
        type: 'expense',
        amount: 80000,
        notes: corruptedNote,
        date: '2026-04-12',
        createdAt: Date.now(),
        deletedAt: null,
      })

      // Must NOT throw OperationError or PrematureCommitError
      const retrieved = await getTransaction(txId)
      expect(retrieved).toBeTruthy()
      // Degrades gracefully to the ciphertext rather than crashing the UI or service
      expect(retrieved.notes).toBe(corruptedNote)
    })

    it('survives malformed IV and ciphertext chunks (enc:v1:1234:5678) without throwing', async () => {
      const malformedCiphertext = 'enc:v1:1234:5678'
      const txId = await db.transactions.add({
        walletId: sampleWalletId,
        type: 'expense',
        amount: 90000,
        notes: malformedCiphertext,
        date: '2026-04-12',
        createdAt: Date.now(),
        deletedAt: null,
      })

      const retrieved = await getTransaction(txId)
      expect(retrieved).toBeTruthy()
      expect(retrieved.notes).toBe(malformedCiphertext)
    })

    it('survives valid-format hex with invalid GCM authentication tag without throwing', async () => {
      // 12-byte IV (24 hex) + 16-byte corrupted ciphertext (32 hex)
      const fakeGcmCiphertext = 'enc:v1:0123456789abcdef01234567:0123456789abcdef0123456789abcdef'
      const txId = await db.transactions.add({
        walletId: sampleWalletId,
        type: 'expense',
        amount: 95000,
        notes: fakeGcmCiphertext,
        date: '2026-04-12',
        createdAt: Date.now(),
        deletedAt: null,
      })

      const retrieved = await getTransaction(txId)
      expect(retrieved).toBeTruthy()
      expect(retrieved.notes).toBe(fakeGcmCiphertext)
    })

    it('handles direct decryptField call on corrupted ciphertext gracefully', async () => {
      expect(await decryptField('enc:v1:corrupted')).toBe('enc:v1:corrupted')
      expect(await decryptField('enc:v1:short')).toBe('enc:v1:short')
      expect(await decryptField('enc:v1::')).toBe('enc:v1::')
      expect(await decryptField('enc:v1:abc:def:ghi')).toBe('enc:v1:abc:def:ghi')
    })

    it('safely handles non-string corrupted notes in getTransaction', async () => {
      const txId = await db.transactions.add({
        walletId: sampleWalletId,
        type: 'expense',
        amount: 120000,
        notes: 12345, // corrupted non-string in DB
        date: '2026-04-12',
        createdAt: Date.now(),
        deletedAt: null,
      })

      const retrieved = await getTransaction(txId)
      expect(retrieved).toBeTruthy()
      expect(retrieved.notes).toBe(12345)
    })

    it('safely executes createTransaction inside nested Dexie transaction without PrematureCommitError', async () => {
      let createdId = null
      await db.transaction('rw', [db.transactions, db.wallets], async () => {
        createdId = await createTransaction({
          walletId: sampleWalletId,
          type: 'expense',
          amount: 55000,
          category: 'makanan',
          notes: 'Transaksi dalam nested Dexie transaction scope',
          date: '2026-04-13',
        })
      })

      expect(createdId).toBeTruthy()
      const retrieved = await getTransaction(createdId)
      expect(retrieved.notes).toBe('Transaksi dalam nested Dexie transaction scope')
    })

    it('updateTransaction updates notes, encrypts new notes, and decrypts accurately', async () => {
      const initialTxId = await createTransaction({
        walletId: sampleWalletId,
        type: 'expense',
        amount: 40000,
        notes: 'Catatan sebelum diupdate',
        date: '2026-04-13',
      })

      const updatedNote = 'Catatan setelah diupdate via updateTransaction'
      await updateTransaction(initialTxId, {
        notes: updatedNote,
      })

      // Raw DB record must be encrypted
      const rawInDb = await db.transactions.get(initialTxId)
      expect(isFieldEncrypted(rawInDb.notes)).toBe(true)
      expect(rawInDb.notes).not.toContain(updatedNote)

      // getTransaction must return decrypted text
      const retrieved = await getTransaction(initialTxId)
      expect(retrieved.notes).toBe(updatedNote)
    })
  })
})
