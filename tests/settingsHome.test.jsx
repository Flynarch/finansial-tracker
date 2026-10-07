// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import SettingsHome from '../src/pages/settings/SettingsHome'
import SettingsEmailVerificationBanner from '../src/pages/settings/sections/SettingsEmailVerificationBanner'
import SettingsAccountCard from '../src/pages/settings/sections/SettingsAccountCard'
import SettingsActionModals from '../src/pages/settings/sections/SettingsActionModals'
import SettingsCurrencyModal from '../src/pages/settings/sections/SettingsCurrencyModal'
import { currencyOptions, currencyDisplayMap } from '../src/pages/settings/settingsConstants'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock AuthModal & BudgetCycleModal to isolate section testing
vi.mock('../src/components/auth/AuthModal', () => ({
  default: ({ isOpen, onClose }) =>
    isOpen ? (
      <div data-testid="mock-auth-modal">
        <span>Auth Modal Content</span>
        <button type="button" onClick={onClose}>Close Auth Modal</button>
      </div>
    ) : null,
}))

vi.mock('../src/components/budget/BudgetCycleModal', () => ({
  default: ({ isOpen, onClose }) =>
    isOpen ? (
      <div data-testid="mock-budget-cycle-modal">
        <span>Budget Cycle Modal</span>
        <button type="button" onClick={onClose}>Close Budget Modal</button>
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
const mockExecuteThemeTransition = vi.fn()
vi.mock('../src/lib/themeTransition', () => ({
  executeThemeTransition: (...args) => mockExecuteThemeTransition(...args),
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
  },
}))

// Configurable mock useSettingsStore
let mockStoreState = {
  defaultCurrency: 'IDR',
  locale: 'id',
  theme: 'dark',
  motionPreference: 'system',
  securityEnabled: true,
  profileName: 'Budi Santoso',
  authProvider: 'email',
  authUserEmail: 'budi@example.com',
  authUserId: 'usr-123',
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

vi.mock('../src/store/useSettingsStore', () => {
  const mockHook = vi.fn((selector) => {
    return typeof selector === 'function' ? selector(mockStoreState) : mockStoreState
  })
  mockHook.getState = vi.fn(() => mockStoreState)
  return { default: mockHook }
})

describe('SettingsHome & Modular Sections Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    mockStoreState = {
      defaultCurrency: 'IDR',
      locale: 'id',
      theme: 'dark',
      motionPreference: 'system',
      securityEnabled: true,
      profileName: 'Budi Santoso',
      authProvider: 'email',
      authUserEmail: 'budi@example.com',
      authUserId: 'usr-123',
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

  describe('settingsConstants exports', () => {
    it('exports currencyOptions and currencyDisplayMap with expected currencies', () => {
      expect(currencyOptions).toContain('IDR')
      expect(currencyOptions).toContain('USD')
      expect(currencyDisplayMap.IDR).toEqual({ name: 'Rupiah Indonesia', symbol: 'Rp', code: 'IDR' })
      expect(currencyDisplayMap.USD).toEqual({ name: 'US Dollar', symbol: '$', code: 'USD' })
      expect(currencyDisplayMap.EUR).toEqual({ name: 'Euro', symbol: '€', code: 'EUR' })
    })
  })

  describe('SettingsEmailVerificationBanner', () => {
    it('does not render if authProvider is not email', () => {
      const { container } = render(
        <SettingsEmailVerificationBanner
          authProvider="google"
          authUserEmail="test@gmail.com"
          emailVerified={false}
        />
      )
      expect(container.firstChild).toBeNull()
    })

    it('does not render if emailVerified is true', () => {
      const { container } = render(
        <SettingsEmailVerificationBanner
          authProvider="email"
          authUserEmail="test@example.com"
          emailVerified={true}
        />
      )
      expect(container.firstChild).toBeNull()
    })

    it('does not render if authUserEmail is empty', () => {
      const { container } = render(
        <SettingsEmailVerificationBanner
          authProvider="email"
          authUserEmail=""
          emailVerified={false}
        />
      )
      expect(container.firstChild).toBeNull()
    })

    it('renders unverified email banner with send and check buttons', () => {
      render(
        <SettingsEmailVerificationBanner
          authProvider="email"
          authUserEmail="unverified@example.com"
          emailVerified={false}
        />
      )
      expect(screen.getByText(/Verifikasi Alamat Email/i)).toBeDefined()
      expect(screen.getByText(/unverified@example.com/i)).toBeDefined()
      expect(screen.getByRole('button', { name: /Kirim Tautan Verifikasi/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /Cek Status/i })).toBeDefined()
    })

    it('triggers sendVerificationEmail and starts cooldown timer', async () => {
      mockSendVerificationEmail.mockResolvedValueOnce({ success: true, alreadyVerified: false })

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
      })

      expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1)
      expect(screen.getByText(/Tautan verifikasi telah dikirim ke email Anda/i)).toBeDefined()
      expect(screen.getByText(/Kirim Ulang/i)).toBeDefined()
    })

    it('handles alreadyVerified on sendVerificationEmail and runs success flow', async () => {
      vi.useFakeTimers()
      mockSendVerificationEmail.mockResolvedValueOnce({ success: true, alreadyVerified: true })
      const onVerified = vi.fn()

      render(
        <SettingsEmailVerificationBanner
          authProvider="email"
          authUserEmail="unverified@example.com"
          emailVerified={false}
          onVerified={onVerified}
        />
      )

      const sendBtn = screen.getByRole('button', { name: /Kirim Tautan Verifikasi/i })
      await act(async () => {
        fireEvent.click(sendBtn)
      })

      expect(screen.getByText(/Email Berhasil Terverifikasi/i)).toBeDefined()

      // Fast-forward past 1800ms to closing
      act(() => {
        vi.advanceTimersByTime(1800)
      })

      // Fast-forward past 2350ms total
      act(() => {
        vi.advanceTimersByTime(550)
      })

      expect(onVerified).toHaveBeenCalled()
    })

    it('checks status with reloadAuthUser and triggers success when verified', async () => {
      vi.useFakeTimers()
      mockReloadAuthUser.mockResolvedValueOnce({ emailVerified: true })
      const onVerified = vi.fn()

      render(
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

      expect(mockReloadAuthUser).toHaveBeenCalledTimes(1)
      expect(screen.getByText(/Email Berhasil Terverifikasi/i)).toBeDefined()

      act(() => {
        vi.advanceTimersByTime(2350)
      })
      expect(onVerified).toHaveBeenCalled()
    })

    it('handles check status not verified feedback', async () => {
      mockReloadAuthUser.mockResolvedValueOnce({ emailVerified: false })

      render(
        <SettingsEmailVerificationBanner
          authProvider="email"
          authUserEmail="unverified@example.com"
          emailVerified={false}
        />
      )

      const checkBtn = screen.getByRole('button', { name: /Cek Status/i })
      await act(async () => {
        fireEvent.click(checkBtn)
      })

      expect(screen.getByText(/Email belum diverifikasi/i)).toBeDefined()
    })

    it('cleans up timers properly on unmount without crashing', () => {
      vi.useFakeTimers()
      const { unmount } = render(
        <SettingsEmailVerificationBanner
          authProvider="email"
          authUserEmail="unverified@example.com"
          emailVerified={false}
        />
      )
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('SettingsAccountCard', () => {
    it('renders user profile name, version badge, and currency/locale/protection pills', () => {
      render(
        <MemoryRouter>
          <SettingsAccountCard
            onConnectAccount={vi.fn()}
            profileName="Alice"
            authProvider="google"
            authUserEmail="alice@gmail.com"
            defaultCurrency="USD"
            locale="id"
            securityEnabled={true}
          />
        </MemoryRouter>
      )

      expect(screen.getByText('Alice')).toBeDefined()
      expect(screen.getByText(/Google • alice@gmail.com/i)).toBeDefined()
      expect(screen.getByText('$ USD')).toBeDefined()
      expect(screen.getByText('Indonesia')).toBeDefined()
      expect(screen.getByText('Aktif')).toBeDefined()
    })

    it('renders guest warning banner and triggers onConnectAccount when clicked', () => {
      const onConnectAccount = vi.fn()
      render(
        <MemoryRouter>
          <SettingsAccountCard
            onConnectAccount={onConnectAccount}
            authProvider="guest"
            authUserEmail=""
          />
        </MemoryRouter>
      )

      expect(screen.getByText(/Mode Tamu Aktif/i)).toBeDefined()
      const connectBtn = screen.getByRole('button', { name: /Hubungkan Akun Sekarang/i })
      fireEvent.click(connectBtn)
      expect(onConnectAccount).toHaveBeenCalledTimes(1)
    })

    it('navigates to /profile when profile row is clicked or keydown Enter', () => {
      const onNavigateProfile = vi.fn()
      render(
        <MemoryRouter>
          <SettingsAccountCard
            onConnectAccount={vi.fn()}
            onNavigateProfile={onNavigateProfile}
          />
        </MemoryRouter>
      )

      const profileRow = screen.getByRole('button', { name: /Profil/i })
      fireEvent.click(profileRow)
      expect(onNavigateProfile).toHaveBeenCalledTimes(1)

      fireEvent.keyDown(profileRow, { key: 'Enter' })
      expect(onNavigateProfile).toHaveBeenCalledTimes(2)
    })
  })

  describe('SettingsCurrencyModal', () => {
    it('renders currency list and handles currency selection', () => {
      const onClose = vi.fn()
      const onSelectCurrency = vi.fn()

      render(
        <SettingsCurrencyModal
          isOpen={true}
          onClose={onClose}
          defaultCurrency="IDR"
          onSelectCurrency={onSelectCurrency}
        />
      )

      expect(screen.getByText(/Pilih Mata Uang Utama/i)).toBeDefined()
      expect(screen.getByText(/Rupiah Indonesia/i)).toBeDefined()
      expect(screen.getByText(/US Dollar/i)).toBeDefined()

      const usdOption = screen.getByRole('button', { name: /US Dollar/i })
      fireEvent.click(usdOption)

      expect(onSelectCurrency).toHaveBeenCalledWith('USD')
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('SettingsActionModals', () => {
    it('renders guest warning modal and allows connecting account or canceling', () => {
      const onCloseGuestWarning = vi.fn()
      const onOpenConnectModal = vi.fn()

      render(
        <MemoryRouter>
          <SettingsActionModals
            isGuestWarningOpen={true}
            onCloseGuestWarning={onCloseGuestWarning}
            isLogoutConfirmOpen={false}
            onCloseLogoutConfirm={vi.fn()}
            isConnectModalOpen={false}
            onCloseConnectModal={vi.fn()}
            onOpenConnectModal={onOpenConnectModal}
          />
        </MemoryRouter>
      )

      expect(screen.getByText(/Peringatan Mode Tamu/i)).toBeDefined()

      // Primary connect button
      const connectBtn = screen.getByRole('button', { name: /Hubungkan Akun Sekarang/i })
      fireEvent.click(connectBtn)
      expect(onCloseGuestWarning).toHaveBeenCalledTimes(1)
      expect(onOpenConnectModal).toHaveBeenCalledTimes(1)

      // Cancel button
      const cancelBtn = screen.getByRole('button', { name: /Batal/i })
      fireEvent.click(cancelBtn)
      expect(onCloseGuestWarning).toHaveBeenCalledTimes(2)
    })

    it('renders logout confirm modal and handles cancel', () => {
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

      expect(screen.getByText(/Konfirmasi Keluar Akun/i)).toBeDefined()
      const cancelBtn = screen.getByRole('button', { name: /Batal/i })
      fireEvent.click(cancelBtn)
      expect(onCloseLogoutConfirm).toHaveBeenCalledTimes(1)
    })

    it('executes full encrypted backup and logout flow on confirm', async () => {
      mockGetSessionMnemonicPhrase.mockReturnValue(
        'apple banana cherry date elderberry fig grape hazelnut iris jasmine kiwi lemon'
      )
      mockExportAllDataAsJson.mockResolvedValueOnce({
        transactions: [{ id: 'tx-1' }],
        wallets: [{ id: 'w-1' }],
      })
      mockExportAllDataAsEncryptedEnvelope.mockResolvedValueOnce({
        ciphertext: 'enc-backup',
        iv: 'iv-123',
      })
      mockUploadLatestBackup.mockResolvedValueOnce({ success: true })
      mockSignOutCurrentUser.mockResolvedValueOnce(true)

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
      await act(async () => {
        fireEvent.click(logoutBtn)
      })

      expect(mockExportAllDataAsEncryptedEnvelope).toHaveBeenCalled()
      expect(mockUploadLatestBackup).toHaveBeenCalledWith(
        'usr-123',
        { ciphertext: 'enc-backup', iv: 'iv-123' },
        { isEncrypted: true }
      )
      expect(mockClearTable).toHaveBeenCalled()
      expect(mockSignOutCurrentUser).toHaveBeenCalled()
      expect(mockClearSessionMnemonicPhrase).toHaveBeenCalled()
      expect(mockStoreState.resetOnboarding).toHaveBeenCalled()
      expect(mockStoreState.setAuthUser).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })

    it('aborts logout and dispatches error toast if cloud backup fails', async () => {
      mockGetSessionMnemonicPhrase.mockReturnValue(
        'apple banana cherry date elderberry fig grape hazelnut iris jasmine kiwi lemon'
      )
      mockExportAllDataAsJson.mockResolvedValueOnce({
        transactions: [{ id: 'tx-1' }],
        wallets: [],
      })
      mockExportAllDataAsEncryptedEnvelope.mockResolvedValueOnce({
        ciphertext: 'enc-backup',
      })
      mockUploadLatestBackup.mockResolvedValueOnce(null) // Failure!

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
      // Should NOT have cleared tables or signed out
      expect(mockSignOutCurrentUser).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()

      window.removeEventListener('ft-show-toast', toastListener)
    })

    it('renders AuthModal when isConnectModalOpen is true', () => {
      const onCloseConnectModal = vi.fn()
      render(
        <MemoryRouter>
          <SettingsActionModals
            isGuestWarningOpen={false}
            onCloseGuestWarning={vi.fn()}
            isLogoutConfirmOpen={false}
            onCloseLogoutConfirm={vi.fn()}
            isConnectModalOpen={true}
            onCloseConnectModal={onCloseConnectModal}
            onOpenConnectModal={vi.fn()}
          />
        </MemoryRouter>
      )

      expect(screen.getByTestId('mock-auth-modal')).toBeDefined()
      const closeAuth = screen.getByRole('button', { name: /Close Auth Modal/i })
      fireEvent.click(closeAuth)
      expect(onCloseConnectModal).toHaveBeenCalledTimes(1)
    })
  })

  describe('SettingsHome Integrated Layout Hub', () => {
    it('mounts cleanly and renders all major settings sections and bento tiles', () => {
      render(
        <MemoryRouter initialEntries={['/settings']}>
          <SettingsHome />
        </MemoryRouter>
      )

      expect(screen.getByText(/Pengaturan/i)).toBeDefined()
      expect(screen.getByText(/Preferensi Cepat/i)).toBeDefined()
      expect(screen.getByText(/Tema Visual/i)).toBeDefined()
      expect(screen.getByText(/Mata Uang Utama/i)).toBeDefined()
      expect(screen.getByText(/Bahasa Sistem/i)).toBeDefined()
      expect(screen.getByText(/Efek Animasi/i)).toBeDefined()
      expect(screen.getByText(/Fitur & Keuangan/i)).toBeDefined()
      expect(screen.getByText(/Keamanan & Asisten AI/i)).toBeDefined()
      expect(screen.getByText(/Bantuan & Dukungan/i)).toBeDefined()
    })

    it('triggers theme transition when theme bento tile is clicked', () => {
      render(
        <MemoryRouter>
          <SettingsHome />
        </MemoryRouter>
      )

      const themeTile = screen.getByRole('button', { name: /Tema Visual/i })
      fireEvent.click(themeTile)
      expect(mockExecuteThemeTransition).toHaveBeenCalledTimes(1)
    })

    it('toggles locale when language bento tile is clicked', () => {
      render(
        <MemoryRouter>
          <SettingsHome />
        </MemoryRouter>
      )

      const langTile = screen.getByRole('button', { name: /Bahasa Sistem/i })
      fireEvent.click(langTile)
      expect(mockStoreState.setLocale).toHaveBeenCalledWith('en')
    })

    it('cycles motion preference when animation tile is clicked', () => {
      render(
        <MemoryRouter>
          <SettingsHome />
        </MemoryRouter>
      )

      const motionTile = screen.getByRole('button', { name: /Efek Animasi/i })
      fireEvent.click(motionTile)
      expect(mockStoreState.setMotionPreference).toHaveBeenCalledWith('full')
    })

    it('opens currency modal when currency bento tile is clicked', () => {
      render(
        <MemoryRouter>
          <SettingsHome />
        </MemoryRouter>
      )

      const currencyTile = screen.getByRole('button', { name: /Mata Uang Utama/i })
      fireEvent.click(currencyTile)
      expect(screen.getByText(/Pilih Mata Uang Utama/i)).toBeDefined()
    })

    it('opens budget cycle modal when budget cycle row is clicked', () => {
      render(
        <MemoryRouter>
          <SettingsHome />
        </MemoryRouter>
      )

      const budgetRow = screen.getByRole('button', { name: /Siklus Anggaran Bulanan/i })
      fireEvent.click(budgetRow)
      expect(screen.getByTestId('mock-budget-cycle-modal')).toBeDefined()
    })

    it('triggers guest warning when logout is clicked in guest mode', () => {
      mockStoreState.authProvider = 'guest'
      mockStoreState.authUserEmail = ''

      render(
        <MemoryRouter>
          <SettingsHome />
        </MemoryRouter>
      )

      const logoutRow = screen.getByRole('button', { name: /Ganti Akun \/ Logout/i })
      fireEvent.click(logoutRow)

      expect(screen.getByText(/Peringatan Mode Tamu/i)).toBeDefined()
    })

    it('triggers logout confirm when logout is clicked for logged-in user', () => {
      mockStoreState.authProvider = 'email'
      mockStoreState.authUserEmail = 'user@example.com'

      render(
        <MemoryRouter>
          <SettingsHome />
        </MemoryRouter>
      )

      const logoutRow = screen.getByRole('button', { name: /Ganti Akun \/ Logout/i })
      fireEvent.click(logoutRow)

      expect(screen.getByText(/Konfirmasi Keluar Akun/i)).toBeDefined()
    })
  })
})
