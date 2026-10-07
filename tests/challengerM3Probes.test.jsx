// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import SettingsActionModals from '../src/pages/settings/sections/SettingsActionModals'
import SettingsEmailVerificationBanner from '../src/pages/settings/sections/SettingsEmailVerificationBanner'
import SettingsAccountCard from '../src/pages/settings/sections/SettingsAccountCard'
import { db } from '../src/lib/db'

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock auth library
const mockSendVerificationEmail = vi.fn()
const mockReloadAuthUser = vi.fn()
const mockSignOutCurrentUser = vi.fn()
vi.mock('../src/lib/auth', () => ({
  sendVerificationEmail: (...args) => mockSendVerificationEmail(...args),
  reloadAuthUser: (...args) => mockReloadAuthUser(...args),
  signOutCurrentUser: (...args) => mockSignOutCurrentUser(...args),
}))

// Mock mnemonicCrypto
const mockGetSessionMnemonicPhrase = vi.fn()
const mockClearSessionMnemonicPhrase = vi.fn()
vi.mock('../src/lib/mnemonicCrypto', () => ({
  getSessionMnemonicPhrase: () => mockGetSessionMnemonicPhrase(),
  clearSessionMnemonicPhrase: () => mockClearSessionMnemonicPhrase(),
}))

// Mock backup & cloudBackup
const mockExportAllDataAsJson = vi.fn()
const mockExportAllDataAsEncryptedEnvelope = vi.fn()
const mockUploadLatestBackup = vi.fn()
vi.mock('../src/lib/backup', () => ({
  exportAllDataAsJson: (...args) => mockExportAllDataAsJson(...args),
  exportAllDataAsEncryptedEnvelope: (...args) => mockExportAllDataAsEncryptedEnvelope(...args),
}))
vi.mock('../src/lib/cloudBackup', () => ({
  uploadLatestBackup: (...args) => mockUploadLatestBackup(...args),
}))

// Mock useSettingsStore
let mockStoreState = {}
vi.mock('../src/store/useSettingsStore', () => {
  const mockHook = vi.fn((selector) => {
    return typeof selector === 'function' ? selector(mockStoreState) : mockStoreState
  })
  mockHook.getState = vi.fn(() => mockStoreState)
  return { default: mockHook }
})

describe('Challenger M3-2 Empirical Probes & Adversarial Harness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    mockExportAllDataAsJson.mockResolvedValue({ transactions: [], wallets: [] })
    mockExportAllDataAsEncryptedEnvelope.mockResolvedValue({ ciphertext: 'enc-data', iv: 'iv-1' })
    mockUploadLatestBackup.mockResolvedValue({ success: true })
    mockSignOutCurrentUser.mockResolvedValue(true)
    mockStoreState = {
      defaultCurrency: 'IDR',
      locale: 'id',
      theme: 'dark',
      motionPreference: 'system',
      securityEnabled: true,
      profileName: 'Challenger Subject',
      authProvider: 'email',
      authUserEmail: 'challenger@example.com',
      authUserId: 'usr-challenger-42',
      emailVerified: false,
      budgetCycleStartDay: 1,
      resetOnboarding: vi.fn().mockResolvedValue(true),
      setAuthUser: vi.fn().mockResolvedValue(true),
      setEmailVerified: vi.fn(),
    }
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  describe('Probe 1: Assertion Rigor & Purge Count Verification', () => {
    it('verifies exact count of tables cleared during E2EE logout (detecting if any of the 19 tables are skipped)', async () => {
      mockGetSessionMnemonicPhrase.mockReturnValue(
        'apple banana cherry date elderberry fig grape hazelnut iris jasmine kiwi lemon'
      )
      mockExportAllDataAsJson.mockResolvedValueOnce({
        transactions: [{ id: 'tx-1' }],
        wallets: [{ id: 'w-1' }],
      })
      mockExportAllDataAsEncryptedEnvelope.mockResolvedValueOnce({
        ciphertext: 'enc-data',
        iv: 'iv-1',
      })
      mockUploadLatestBackup.mockResolvedValueOnce({ success: true })
      mockSignOutCurrentUser.mockResolvedValueOnce(true)

      // Spy on each table's clear method
      const tableClearSpies = []
      const knownTables = [
        'transactions', 'investments', 'investmentOrders', 'budgets', 'goals',
        'goalLogs', 'calendarEvents', 'recurringTransactions', 'todos', 'sub_tasks',
        'habits', 'habitLogs', 'ideas', 'board_links', 'notifications',
        'wallets', 'loans', 'loanPayments', 'walletBalanceCache'
      ]

      for (const tName of knownTables) {
        if (db[tName] && typeof db[tName].clear === 'function') {
          const spy = vi.spyOn(db[tName], 'clear').mockResolvedValue(true)
          tableClearSpies.push({ name: tName, spy })
        }
      }

      render(
        <MemoryRouter>
          <SettingsActionModals
            isGuestWarningOpen={false}
            onCloseGuestWarning={vi.fn()}
            isLogoutConfirmOpen={true}
            onCloseLogoutConfirm={vi.fn()}
            isConnectModalOpen={false}
            onCloseConnectModal={vi.fn()}
            onOpenConnectModal={vi.fn()}
          />
        </MemoryRouter>
      )

      const logoutBtn = screen.getByRole('button', { name: /Keluar & Ganti Akun/i })
      await act(async () => {
        fireEvent.click(logoutBtn)
      })

      // Verify that EVERY single one of the 19 tables was actually cleared
      for (const { name, spy } of tableClearSpies) {
        expect(spy, `Table ${name} should have clear() called`).toHaveBeenCalledTimes(1)
      }
      expect(tableClearSpies.length).toBe(19)

      // Clean up spies
      tableClearSpies.forEach(({ spy }) => spy.mockRestore())
    })

    it('verifies db.chatMessages is purged alongside other data tables on E2EE logout', async () => {
      mockGetSessionMnemonicPhrase.mockReturnValue(
        'apple banana cherry date elderberry fig grape hazelnut iris jasmine kiwi lemon'
      )
      mockExportAllDataAsJson.mockResolvedValueOnce({
        transactions: [{ id: 'tx-1' }],
        wallets: [{ id: 'w-1' }],
      })
      mockExportAllDataAsEncryptedEnvelope.mockResolvedValueOnce({
        ciphertext: 'enc-data',
        iv: 'iv-1',
      })
      mockUploadLatestBackup.mockResolvedValueOnce({ success: true })
      mockSignOutCurrentUser.mockResolvedValueOnce(true)

      let chatMessagesClearCalled = false
      if (db.chatMessages && typeof db.chatMessages.clear === 'function') {
        vi.spyOn(db.chatMessages, 'clear').mockImplementation(async () => {
          chatMessagesClearCalled = true
          return true
        })
      }

      render(
        <MemoryRouter>
          <SettingsActionModals
            isGuestWarningOpen={false}
            onCloseGuestWarning={vi.fn()}
            isLogoutConfirmOpen={true}
            onCloseLogoutConfirm={vi.fn()}
            isConnectModalOpen={false}
            onCloseConnectModal={vi.fn()}
            onOpenConnectModal={vi.fn()}
          />
        </MemoryRouter>
      )

      const logoutBtn = screen.getByRole('button', { name: /Keluar & Ganti Akun/i })
      await act(async () => {
        fireEvent.click(logoutBtn)
      })

      // Verify db.chatMessages is purged on E2EE logout
      expect(chatMessagesClearCalled).toBe(true)
    })
  })

  describe('Probe 2: Unverified Branch Probes in SettingsActionModals', () => {
    it('verifies non-E2EE logout preserves local ledger data (tables not cleared)', async () => {
      // E2EE is NOT active (e.g. no phrase)
      mockGetSessionMnemonicPhrase.mockReturnValue(null)
      mockSignOutCurrentUser.mockResolvedValueOnce(true)

      const txClearSpy = vi.spyOn(db.transactions, 'clear')

      render(
        <MemoryRouter>
          <SettingsActionModals
            isGuestWarningOpen={false}
            onCloseGuestWarning={vi.fn()}
            isLogoutConfirmOpen={true}
            onCloseLogoutConfirm={vi.fn()}
            isConnectModalOpen={false}
            onCloseConnectModal={vi.fn()}
            onOpenConnectModal={vi.fn()}
          />
        </MemoryRouter>
      )

      const warnSpy = vi.spyOn(console, 'warn')
      const logoutBtn = screen.getByRole('button', { name: /Keluar & Ganti Akun/i })
      await act(async () => {
        fireEvent.click(logoutBtn)
      })

      if (warnSpy.mock.calls.length > 0) {
        console.log('CONSOLE WARN CALLS in Probe 2:', warnSpy.mock.calls)
      }
      expect(txClearSpy).not.toHaveBeenCalled()
      // But sign out should still occur
      expect(mockSignOutCurrentUser).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })

      txClearSpy.mockRestore()
      warnSpy.mockRestore()
    })

    it('probes custom onLogout callback priority over default flow', async () => {
      const customOnLogout = vi.fn().mockResolvedValue(true)

      render(
        <MemoryRouter>
          <SettingsActionModals
            isGuestWarningOpen={false}
            onCloseGuestWarning={vi.fn()}
            isLogoutConfirmOpen={true}
            onCloseLogoutConfirm={vi.fn()}
            isConnectModalOpen={false}
            onCloseConnectModal={vi.fn()}
            onOpenConnectModal={vi.fn()}
            onLogout={customOnLogout}
          />
        </MemoryRouter>
      )

      const logoutBtn = screen.getByRole('button', { name: /Keluar & Ganti Akun/i })
      await act(async () => {
        fireEvent.click(logoutBtn)
      })

      expect(customOnLogout).toHaveBeenCalledTimes(1)
      expect(mockSignOutCurrentUser).not.toHaveBeenCalled()
    })
  })

  describe('Probe 3: Dexie Table Purge Resilience & Fault Injection', () => {
    it('recovers gracefully when a table clear() rejects with an error', async () => {
      mockGetSessionMnemonicPhrase.mockReturnValue(
        'apple banana cherry date elderberry fig grape hazelnut iris jasmine kiwi lemon'
      )
      mockExportAllDataAsJson.mockResolvedValueOnce({ transactions: [], wallets: [] })
      mockSignOutCurrentUser.mockResolvedValueOnce(true)

      // Mock other tables with resolved promises, and inject fault only on db.wallets
      const knownTables = [
        'transactions', 'investments', 'investmentOrders', 'budgets', 'goals',
        'goalLogs', 'calendarEvents', 'recurringTransactions', 'todos', 'sub_tasks',
        'habits', 'habitLogs', 'ideas', 'board_links', 'notifications',
        'loans', 'loanPayments', 'walletBalanceCache'
      ]
      const spies = knownTables.map((t) => vi.spyOn(db[t], 'clear').mockResolvedValue(true))
      const walletClearSpy = vi.spyOn(db.wallets, 'clear').mockRejectedValue(new Error('Dexie: DatabaseClosedError'))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      render(
        <MemoryRouter>
          <SettingsActionModals
            isGuestWarningOpen={false}
            onCloseGuestWarning={vi.fn()}
            isLogoutConfirmOpen={true}
            onCloseLogoutConfirm={vi.fn()}
            isConnectModalOpen={false}
            onCloseConnectModal={vi.fn()}
            onOpenConnectModal={vi.fn()}
          />
        </MemoryRouter>
      )

      const logoutBtn = screen.getByRole('button', { name: /Keluar & Ganti Akun/i })
      await act(async () => {
        fireEvent.click(logoutBtn)
      })

      expect(warnSpy).toHaveBeenCalled()
      expect(mockSignOutCurrentUser).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })

      walletClearSpy.mockRestore()
      spies.forEach((s) => s.mockRestore())
      warnSpy.mockRestore()
    })

    it('probes Dexie db.tables iteration behavior with missing or unexpected tables', async () => {
      // Test dynamic db.tables resilience if code were to iterate db.tables
      const tables = db.tables || []
      expect(Array.isArray(tables)).toBe(true)

      // Verify that every table in db.tables has a valid name and clear method
      for (const tbl of tables) {
        expect(typeof tbl.name).toBe('string')
        expect(typeof tbl.clear).toBe('function')
      }

      // Verify filtering out 'settings' leaves only data tables
      const dataTables = tables.filter((t) => t.name !== 'settings')
      const tableNames = dataTables.map((t) => t.name)
      expect(tableNames).toContain('transactions')
      expect(tableNames).toContain('wallets')
      expect(tableNames).toContain('budgets')
      expect(tableNames).not.toContain('settings')
    })
  })

  describe('Probe 4: SettingsAccountCard Default Navigation Fallback', () => {
    it('navigates to /profile when onNavigateProfile is omitted (click, Enter, Space)', () => {
      render(
        <MemoryRouter>
          <SettingsAccountCard
            onConnectAccount={vi.fn()}
            profileName="Bob"
            authProvider="email"
            authUserEmail="bob@example.com"
          />
        </MemoryRouter>
      )

      const profileRow = screen.getByRole('button', { name: /Profil/i })

      // Click
      fireEvent.click(profileRow)
      expect(mockNavigate).toHaveBeenCalledWith('/profile')

      // Enter key
      mockNavigate.mockClear()
      fireEvent.keyDown(profileRow, { key: 'Enter' })
      expect(mockNavigate).toHaveBeenCalledWith('/profile')

      // Space key
      mockNavigate.mockClear()
      fireEvent.keyDown(profileRow, { key: ' ' })
      expect(mockNavigate).toHaveBeenCalledWith('/profile')
    })
  })

  describe('Probe 5: SettingsEmailVerificationBanner Failure & Error Branches', () => {
    it('displays error message when sendVerificationEmail returns success=false', async () => {
      mockSendVerificationEmail.mockResolvedValueOnce({
        success: false,
        message: 'Batas pengiriman email terlampaui. Coba lagi dalam 10 menit.',
      })

      render(
        <SettingsEmailVerificationBanner
          authProvider="email"
          authUserEmail="rate_limited@example.com"
          emailVerified={false}
        />
      )

      const sendBtn = screen.getByRole('button', { name: /Kirim Tautan Verifikasi/i })
      await act(async () => {
        fireEvent.click(sendBtn)
      })

      expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1)
      expect(screen.getByText(/Batas pengiriman email terlampaui/i)).toBeDefined()
    })

    it('handles unexpected network exception in sendVerificationEmail without crashing', async () => {
      mockSendVerificationEmail.mockRejectedValueOnce(new Error('Network failure'))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      render(
        <SettingsEmailVerificationBanner
          authProvider="email"
          authUserEmail="network_err@example.com"
          emailVerified={false}
        />
      )

      const sendBtn = screen.getByRole('button', { name: /Kirim Tautan Verifikasi/i })
      await act(async () => {
        fireEvent.click(sendBtn)
      })

      expect(screen.getByText(/Terjadi kesalahan/i)).toBeDefined()
      warnSpy.mockRestore()
    })
  })
})
