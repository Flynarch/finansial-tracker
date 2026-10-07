// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import SettingsEmailVerificationBanner from '../src/pages/settings/sections/SettingsEmailVerificationBanner'
import SettingsAccountCard from '../src/pages/settings/sections/SettingsAccountCard'
import SettingsActionModals from '../src/pages/settings/sections/SettingsActionModals'
import SettingsCurrencyModal from '../src/pages/settings/sections/SettingsCurrencyModal'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock AuthModal & BudgetCycleModal
vi.mock('../src/components/auth/AuthModal', () => ({
  default: ({ isOpen, onClose }) =>
    isOpen ? (
      <div data-testid="mock-auth-modal">
        <button type="button" onClick={onClose}>Close Auth</button>
      </div>
    ) : null,
}))

vi.mock('../src/components/budget/BudgetCycleModal', () => ({
  default: ({ isOpen, onClose }) =>
    isOpen ? (
      <div data-testid="mock-budget-cycle-modal">
        <button type="button" onClick={onClose}>Close Budget</button>
      </div>
    ) : null,
}))

// Mock auth library
const mockSendVerificationEmail = vi.fn()
const mockReloadAuthUser = vi.fn()
const mockSignOutCurrentUser = vi.fn()
vi.mock('../src/lib/auth', () => ({
  sendVerificationEmail: (...args) => mockSendVerificationEmail(...args),
  reloadAuthUser: (...args) => mockReloadAuthUser(...args),
  signOutCurrentUser: (...args) => mockSignOutCurrentUser(...args),
}))

// Mock theme transition
vi.mock('../src/lib/themeTransition', () => ({
  executeThemeTransition: vi.fn(),
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

// Mock db
const mockClearTable = vi.fn().mockResolvedValue(true)
vi.mock('../src/lib/db', () => ({
  db: {
    transactions: { clear: () => mockClearTable() },
    investments: { clear: () => mockClearTable() },
    investmentOrders: { clear: () => mockClearTable() },
    budgets: { clear: () => mockClearTable() },
    goals: { clear: () => mockClearTable() },
    goalLogs: { clear: () => mockClearTable() },
    calendarEvents: { clear: () => mockClearTable() },
    recurringTransactions: { clear: () => mockClearTable() },
    todos: { clear: () => mockClearTable() },
    sub_tasks: { clear: () => mockClearTable() },
    habits: { clear: () => mockClearTable() },
    habitLogs: { clear: () => mockClearTable() },
    ideas: { clear: () => mockClearTable() },
    board_links: { clear: () => mockClearTable() },
    notifications: { clear: () => mockClearTable() },
    wallets: { clear: () => mockClearTable() },
    loans: { clear: () => mockClearTable() },
    loanPayments: { clear: () => mockClearTable() },
    walletBalanceCache: { clear: () => mockClearTable() },
    chatMessages: { clear: () => mockClearTable() },
  },
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

describe('Challenger M3 Empirical Adversarial Stress Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    mockStoreState = {
      defaultCurrency: 'IDR',
      locale: 'id',
      theme: 'dark',
      motionPreference: 'system',
      securityEnabled: true,
      profileName: 'Challenger Target',
      authProvider: 'email',
      authUserEmail: 'target@example.com',
      authUserId: 'usr-adversary-1',
      emailVerified: false,
      budgetCycleStartDay: 1,
      setDefaultCurrency: vi.fn((c) => { mockStoreState.defaultCurrency = c }),
      setLocale: vi.fn((l) => { mockStoreState.locale = l }),
      setTheme: vi.fn((t) => { mockStoreState.theme = t }),
      setMotionPreference: vi.fn((m) => { mockStoreState.motionPreference = m }),
      resetOnboarding: vi.fn().mockResolvedValue(true),
      setAuthUser: vi.fn().mockResolvedValue(true),
      setEmailVerified: vi.fn((v) => { mockStoreState.emailVerified = v }),
    }
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  // --------------------------------------------------------------------------
  // PROBE 1: Concurrency & Rapid Multi-Clicks on Logout in SettingsActionModals
  // --------------------------------------------------------------------------
  describe('Probe 1: Rapid multi-clicks on logout or cancel while cloud backup upload is in flight', () => {
    it('handles rapid consecutive clicks on Logout button without duplicate upload calls or crash', async () => {
      let resolveUpload
      const uploadPromise = new Promise((resolve) => {
        resolveUpload = resolve
      })

      mockGetSessionMnemonicPhrase.mockReturnValue(
        'apple banana cherry date elderberry fig grape hazelnut iris jasmine kiwi lemon'
      )
      mockExportAllDataAsJson.mockResolvedValue({
        transactions: [{ id: 'tx-1' }],
        wallets: [{ id: 'w-1' }],
      })
      mockExportAllDataAsEncryptedEnvelope.mockResolvedValue({
        ciphertext: 'cipher-adversary',
        iv: 'iv-adversary',
      })
      mockUploadLatestBackup.mockImplementation(() => uploadPromise)
      mockSignOutCurrentUser.mockResolvedValue(true)

      const onCloseLogoutConfirm = vi.fn()

      render(
        <MemoryRouter>
          <SettingsActionModals
            isGuestWarningOpen={false}
            onCloseGuestWarning={vi.fn()}
            isLogoutConfirmOpen={true}
            onCloseLogoutConfirm={onCloseLogoutConfirm}
            isConnectModalOpen={false}
            onCloseConnectModal={vi.fn()}
            onOpenConnectModal={vi.fn()}
          />
        </MemoryRouter>
      )

      const logoutBtn = screen.getByRole('button', { name: /Keluar & Ganti Akun/i })

      // Rapidly trigger 5 click events concurrently
      await act(async () => {
        fireEvent.click(logoutBtn)
        fireEvent.click(logoutBtn)
        fireEvent.click(logoutBtn)
        fireEvent.click(logoutBtn)
        fireEvent.click(logoutBtn)
      })

      // Upload should only be initiated once (or at least not crash/corrupt)
      expect(mockUploadLatestBackup).toHaveBeenCalledTimes(1)

      // Resolve the pending upload
      await act(async () => {
        resolveUpload({ success: true })
      })

      // Database clear and sign-out should execute once
      expect(mockSignOutCurrentUser).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })

    it('prevents modal backdrop/close from cancelling or crashing when isLoggingOut is true', async () => {
      let resolveUpload
      const uploadPromise = new Promise((resolve) => {
        resolveUpload = resolve
      })

      mockGetSessionMnemonicPhrase.mockReturnValue(
        'apple banana cherry date elderberry fig grape hazelnut iris jasmine kiwi lemon'
      )
      mockExportAllDataAsJson.mockResolvedValue({
        transactions: [{ id: 'tx-1' }],
        wallets: [{ id: 'w-1' }],
      })
      mockExportAllDataAsEncryptedEnvelope.mockResolvedValue({ ciphertext: 'abc' })
      mockUploadLatestBackup.mockImplementation(() => uploadPromise)

      const onCloseLogoutConfirm = vi.fn()

      render(
        <MemoryRouter>
          <SettingsActionModals
            isGuestWarningOpen={false}
            onCloseGuestWarning={vi.fn()}
            isLogoutConfirmOpen={true}
            onCloseLogoutConfirm={onCloseLogoutConfirm}
            isConnectModalOpen={false}
            onCloseConnectModal={vi.fn()}
            onOpenConnectModal={vi.fn()}
          />
        </MemoryRouter>
      )

      const logoutBtn = screen.getByRole('button', { name: /Keluar & Ganti Akun/i })
      const cancelBtn = screen.getByRole('button', { name: /Batal/i })

      // Start logout
      await act(async () => {
        fireEvent.click(logoutBtn)
      })

      // Attempt to click cancel during upload
      await act(async () => {
        fireEvent.click(cancelBtn)
      })

      // Cancel button is disabled during logout, onCloseLogoutConfirm should not be called
      expect(onCloseLogoutConfirm).not.toHaveBeenCalled()

      // Resolve upload
      await act(async () => {
        resolveUpload({ success: true })
      })

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })

    it('handles timeout (15s) in Promise.race without unhandled rejections', async () => {
      vi.useFakeTimers()

      mockGetSessionMnemonicPhrase.mockReturnValue(
        'apple banana cherry date elderberry fig grape hazelnut iris jasmine kiwi lemon'
      )
      mockExportAllDataAsJson.mockResolvedValue({
        transactions: [{ id: 'tx-1' }],
        wallets: [{ id: 'w-1' }],
      })
      mockExportAllDataAsEncryptedEnvelope.mockResolvedValue({ ciphertext: 'abc' })
      // upload hangs indefinitely
      mockUploadLatestBackup.mockReturnValue(new Promise(() => {}))

      const toastListener = vi.fn()
      window.addEventListener('ft-show-toast', toastListener)

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

      // Advance timers by 15,000ms
      await act(async () => {
        vi.advanceTimersByTime(15000)
      })

      // Expect toast notification indicating timeout / backup failure
      expect(toastListener).toHaveBeenCalled()
      // Local database must NOT be wiped!
      expect(mockClearTable).not.toHaveBeenCalled()
      expect(mockSignOutCurrentUser).not.toHaveBeenCalled()

      window.removeEventListener('ft-show-toast', toastListener)
    })
  })

  // --------------------------------------------------------------------------
  // PROBE 2: Unmounting SettingsEmailVerificationBanner during Active Timers
  // --------------------------------------------------------------------------
  describe('Probe 2: Unmounting SettingsEmailVerificationBanner during active countdown or polling', () => {
    it('safely cancels cooldown timer when component unmounts mid-countdown', async () => {
      vi.useFakeTimers()
      mockSendVerificationEmail.mockResolvedValueOnce({ success: true, alreadyVerified: false })

      const { unmount } = render(
        <SettingsEmailVerificationBanner
          authProvider="email"
          authUserEmail="unverified@example.com"
          emailVerified={false}
        />
      )

      const sendBtn = screen.getByRole('button', { name: /Kirim Tautan Verifikasi/i })
      await act(async () => {
        fireEvent.click(sendBtn)
      })

      expect(screen.getByText(/Kirim Ulang/i)).toBeDefined()

      // Advance by 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      // Unmount during active countdown
      expect(() => {
        unmount()
      }).not.toThrow()

      // Further advance timers by 60 seconds - should not cause errors
      expect(() => {
        act(() => {
          vi.advanceTimersByTime(60000)
        })
      }).not.toThrow()
    })

    it('safely handles in-flight reloadAuthUser when component unmounts before resolution', async () => {
      vi.useFakeTimers()
      let resolveReload
      const reloadPromise = new Promise((resolve) => {
        resolveReload = resolve
      })
      mockReloadAuthUser.mockImplementation(() => reloadPromise)

      const onVerified = vi.fn()

      const { unmount } = render(
        <SettingsEmailVerificationBanner
          authProvider="email"
          authUserEmail="unverified@example.com"
          emailVerified={false}
          onVerified={onVerified}
        />
      )

      const checkBtn = screen.getByRole('button', { name: /Cek Status/i })
      await act(async () => {
        fireEvent.click(checkBtn)
      })

      // Unmount while reload is still pending
      unmount()

      // Now resolve the promise
      await act(async () => {
        resolveReload({ emailVerified: true })
      })

      // Advance timers by 3000ms
      act(() => {
        vi.advanceTimersByTime(3000)
      })

      // onVerified should NOT be called on unmounted component
      expect(onVerified).not.toHaveBeenCalled()
    })

    it('cleans up success exit animation timeouts when unmounted during transition', async () => {
      vi.useFakeTimers()
      mockReloadAuthUser.mockResolvedValueOnce({ emailVerified: true })
      const onVerified = vi.fn()

      const { unmount } = render(
        <SettingsEmailVerificationBanner
          authProvider="email"
          authUserEmail="unverified@example.com"
          emailVerified={false}
          onVerified={onVerified}
        />
      )

      const checkBtn = screen.getByRole('button', { name: /Cek Status/i })
      await act(async () => {
        fireEvent.click(checkBtn)
      })

      expect(screen.getByText(/Email Berhasil Terverifikasi/i)).toBeDefined()

      // Unmount at 500ms (before the 1800ms / 2350ms timeouts fire)
      act(() => {
        vi.advanceTimersByTime(500)
      })
      unmount()

      // Advance past 3000ms
      act(() => {
        vi.advanceTimersByTime(2500)
      })

      // Timeout should have been cancelled by unmount cleanup, onVerified not called
      expect(onVerified).not.toHaveBeenCalled()
    })

    it('prevents rapid double-clicks on Send Verification button from firing duplicate requests', async () => {
      let resolveSend
      const sendPromise = new Promise((resolve) => {
        resolveSend = resolve
      })
      mockSendVerificationEmail.mockImplementation(() => sendPromise)

      render(
        <SettingsEmailVerificationBanner
          authProvider="email"
          authUserEmail="unverified@example.com"
          emailVerified={false}
        />
      )

      const sendBtn = screen.getByRole('button', { name: /Kirim Tautan Verifikasi/i })

      await act(async () => {
        fireEvent.click(sendBtn)
        fireEvent.click(sendBtn)
        fireEvent.click(sendBtn)
      })

      expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1)

      await act(async () => {
        resolveSend({ success: true, alreadyVerified: false })
      })
    })
  })

  // --------------------------------------------------------------------------
  // PROBE 3: Boundary & Invalid Currency Codes in SettingsCurrencyModal
  // --------------------------------------------------------------------------
  describe('Probe 3: Invalid/missing/unsupported currency codes in SettingsCurrencyModal & AccountCard', () => {
    it('renders SettingsCurrencyModal with undefined defaultCurrency without crashing', () => {
      const onClose = vi.fn()
      const onSelectCurrency = vi.fn()

      expect(() => {
        render(
          <SettingsCurrencyModal
            isOpen={true}
            onClose={onClose}
            defaultCurrency={undefined}
            onSelectCurrency={onSelectCurrency}
          />
        )
      }).not.toThrow()

      expect(screen.getByText(/Pilih Mata Uang Utama/i)).toBeDefined()
      // Default currency options should still render correctly
      expect(screen.getByText(/Rupiah Indonesia/i)).toBeDefined()
    })

    it('renders SettingsCurrencyModal with null defaultCurrency without crashing', () => {
      expect(() => {
        render(
          <SettingsCurrencyModal
            isOpen={true}
            onClose={vi.fn()}
            defaultCurrency={null}
            onSelectCurrency={vi.fn()}
          />
        )
      }).not.toThrow()
    })

    it('renders SettingsCurrencyModal with unsupported currency code ("XYZ") without crashing', () => {
      const { container } = render(
        <SettingsCurrencyModal
          isOpen={true}
          onClose={vi.fn()}
          defaultCurrency="XYZ"
          onSelectCurrency={vi.fn()}
        />
      )

      expect(container).toBeDefined()
      expect(screen.getByText(/Pilih Mata Uang Utama/i)).toBeDefined()
    })

    it('gracefully handles missing onClose or onSelectCurrency callbacks', () => {
      render(
        <SettingsCurrencyModal
          isOpen={true}
          defaultCurrency="IDR"
        />
      )

      const usdButton = screen.getByRole('button', { name: /US Dollar/i })
      expect(() => {
        fireEvent.click(usdButton)
      }).not.toThrow()

      expect(mockStoreState.setDefaultCurrency).toHaveBeenCalledWith('USD')
    })

    it('renders SettingsAccountCard with null/invalid currency without crashing', () => {
      expect(() => {
        render(
          <MemoryRouter>
            <SettingsAccountCard
              onConnectAccount={vi.fn()}
              defaultCurrency={null}
            />
          </MemoryRouter>
        )
      }).not.toThrow()
    })

    it('renders SettingsAccountCard with exotic unsupported currency code without crashing', () => {
      render(
        <MemoryRouter>
          <SettingsAccountCard
            onConnectAccount={vi.fn()}
            defaultCurrency="BTC"
          />
        </MemoryRouter>
      )

      expect(screen.getByText('BTC BTC')).toBeDefined()
    })
  })

  // --------------------------------------------------------------------------
  // PROBE 4: Error Injection & Edge Case Stability
  // --------------------------------------------------------------------------
  describe('Probe 4: Error injection and boundary conditions in SettingsActionModals', () => {
    it('aborts logout cleanly if encryption envelope fails without wiping database', async () => {
      mockGetSessionMnemonicPhrase.mockReturnValue(
        'apple banana cherry date elderberry fig grape hazelnut iris jasmine kiwi lemon'
      )
      mockExportAllDataAsJson.mockResolvedValue({
        transactions: [{ id: 'tx-1' }],
        wallets: [{ id: 'w-1' }],
      })
      mockExportAllDataAsEncryptedEnvelope.mockRejectedValue(new Error('CRYPTO_FAILURE'))

      const toastListener = vi.fn()
      window.addEventListener('ft-show-toast', toastListener)

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

      expect(toastListener).toHaveBeenCalled()
      expect(mockUploadLatestBackup).not.toHaveBeenCalled()
      expect(mockClearTable).not.toHaveBeenCalled()
      expect(mockSignOutCurrentUser).not.toHaveBeenCalled()

      window.removeEventListener('ft-show-toast', toastListener)
    })

    it('handles missing or malformed mnemonic phrase by preserving local data (no wipe)', async () => {
      // User has no E2EE phrase or invalid phrase
      mockGetSessionMnemonicPhrase.mockReturnValue('invalid short phrase')
      mockExportAllDataAsJson.mockResolvedValue({
        transactions: [{ id: 'tx-1' }],
        wallets: [{ id: 'w-1' }],
      })
      mockSignOutCurrentUser.mockResolvedValue(true)

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

      // When E2EE is not active, local tables are NOT cleared
      expect(mockClearTable).not.toHaveBeenCalled()
      // But sign out completes
      expect(mockSignOutCurrentUser).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })

    it('resilient against signOutCurrentUser network failure', async () => {
      mockGetSessionMnemonicPhrase.mockReturnValue(null)
      mockExportAllDataAsJson.mockResolvedValue(null)
      mockSignOutCurrentUser.mockRejectedValue(new Error('NETWORK_TIMEOUT'))

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

      // Should still navigate to /dashboard and reset state even if auth signOut threw
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })
})
