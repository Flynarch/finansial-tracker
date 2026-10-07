// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import ProgressHeader from '../src/components/onboarding/ProgressHeader'
import {
  loadProgress,
  saveProgress,
  clearProgress,
  GoogleIcon,
  PROGRESS_KEY,
} from '../src/components/onboarding/onboardingUtils'
import StepWelcomeAuth from '../src/components/onboarding/steps/StepWelcomeAuth'
import StepProfileSetup from '../src/components/onboarding/steps/StepProfileSetup'
import StepThemeSelect from '../src/components/onboarding/steps/StepThemeSelect'
import StepWalletSetup from '../src/components/onboarding/steps/StepWalletSetup'
import StepSummaryConfirm from '../src/components/onboarding/steps/StepSummaryConfirm'
import OnboardingFlow from '../src/components/onboarding/OnboardingFlow'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

// Mock AddAccountPage for StepWalletSetup and OnboardingFlow
vi.mock('../src/pages/AddAccountPage', () => ({
  default: ({ onBack, onSuccess, isOnboarding }) => (
    <div data-testid="mock-add-account-page" data-onboarding={String(isOnboarding)}>
      <span>Mock Add Account Page</span>
      <button type="button" onClick={onBack}>Mock Back Account</button>
      <button type="button" onClick={onSuccess}>Mock Success Account</button>
    </div>
  ),
}))

// Mock useSettingsStore
const mockStoreState = {
  isLoaded: true,
  hasCompletedOnboarding: false,
  profilePhoto: 'data:image/png;base64,mock',
  setProfilePhoto: vi.fn((photo) => { mockStoreState.profilePhoto = photo }),
  profileName: 'John Doe',
  setProfileName: vi.fn((name) => { mockStoreState.profileName = name }),
  setAuthUser: vi.fn(),
  authProvider: 'guest',
  theme: 'dark',
  setTheme: vi.fn((th) => { mockStoreState.theme = th }),
  completeOnboarding: vi.fn(),
  startSpotlightTour: vi.fn(),
  defaultWalletId: 'wallet-1',
  setDefaultWalletId: vi.fn((id) => { mockStoreState.defaultWalletId = id }),
}

vi.mock('../src/store/useSettingsStore', () => {
  const mockHook = vi.fn((selector) => {
    return typeof selector === 'function' ? selector(mockStoreState) : mockStoreState
  })
  mockHook.getState = vi.fn(() => mockStoreState)
  return { default: mockHook }
})

// Mock dexie db & dexie-react-hooks
let mockWallets = [
  { id: 'wallet-1', name: 'Dompet Utama', balance: 500000, currency: 'IDR', institutionId: 'bca' },
  { id: 'wallet-2', name: 'Cash', balance: 100000, currency: 'IDR', customIcon: 'cash' },
]

vi.mock('../src/lib/db', () => ({
  db: {
    wallets: {
      toArray: vi.fn(async () => mockWallets),
      count: vi.fn(async () => mockWallets.length),
      delete: vi.fn(async (id) => {
        mockWallets = mockWallets.filter((w) => w.id !== id)
      }),
    },
    transactions: {
      count: vi.fn(async () => 0),
    },
  },
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn((fn, deps, defaultVal) => mockWallets ?? defaultVal),
}))

// Mock auth utilities
vi.mock('../src/lib/auth', () => ({
  signInWithGoogle: vi.fn(async () => ({ success: true, user: { uid: 'u-123', displayName: 'Google User' } })),
  signInAsGuest: vi.fn(async () => ({ user: { uid: 'guest-123', isAnonymous: true } })),
  promptGoogleOneTap: vi.fn(),
}))

// Mock theme transition
vi.mock('../src/lib/themeTransition', () => ({
  executeThemeTransition: vi.fn(({ targetTheme, setTheme }) => setTheme(targetTheme)),
}))

// Mock backup & cloud backup
vi.mock('../src/lib/backup', () => ({
  importAllDataFromJsonPayload: vi.fn(async () => {}),
  importAllDataFromEncryptedEnvelope: vi.fn(async () => {}),
}))

vi.mock('../src/lib/cloudBackup', () => ({
  downloadLatestBackupJson: vi.fn(async () => null),
}))

vi.mock('../src/lib/mnemonicCrypto', () => ({
  getSessionMnemonicPhrase: vi.fn(() => null),
}))

describe('Onboarding Flow Modular Architecture Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockWallets = [
      { id: 'wallet-1', name: 'Dompet Utama', balance: 500000, currency: 'IDR', institutionId: 'bca' },
      { id: 'wallet-2', name: 'Cash', balance: 100000, currency: 'IDR', customIcon: 'cash' },
    ]
    mockStoreState.hasCompletedOnboarding = false
    mockStoreState.defaultWalletId = 'wallet-1'
  })

  afterEach(() => {
    cleanup()
  })

  /* ── 1. onboardingUtils.js Tests ── */
  describe('onboardingUtils', () => {
    it('handles loadProgress, saveProgress, and clearProgress in localStorage', () => {
      expect(loadProgress()).toBeNull()

      saveProgress({ step: 2, username: 'Alex' })
      expect(localStorage.getItem(PROGRESS_KEY)).toBe(JSON.stringify({ step: 2, username: 'Alex' }))

      const loaded = loadProgress()
      expect(loaded).toEqual({ step: 2, username: 'Alex' })

      clearProgress()
      expect(loadProgress()).toBeNull()
      expect(localStorage.getItem(PROGRESS_KEY)).toBeNull()
    })

    it('renders GoogleIcon with expected viewBox and path tags', () => {
      const { container } = render(<GoogleIcon className="w-6 h-6" />)
      const svg = container.querySelector('svg')
      expect(svg).toBeDefined()
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
      expect(container.querySelectorAll('path').length).toBe(4)
    })
  })

  /* ── 2. ProgressHeader.jsx Tests ── */
  describe('ProgressHeader', () => {
    it('renders step indicator badge with correct numbers', () => {
      render(<ProgressHeader step={2} total={4} />)
      expect(screen.getByText(/Langkah 2 dari 4/i)).toBeDefined()
    })

    it('renders back button when onBack prop is provided and triggers callback', () => {
      const onBack = vi.fn()
      render(<ProgressHeader step={2} total={4} onBack={onBack} />)
      const backBtn = screen.getByRole('button', { name: /kembali/i })
      fireEvent.click(backBtn)
      expect(onBack).toHaveBeenCalledTimes(1)
    })

    it('does not render back button when onBack prop is omitted', () => {
      render(<ProgressHeader step={1} total={4} />)
      expect(screen.queryByRole('button', { name: /kembali/i })).toBeNull()
    })
  })

  /* ── 3. StepWelcomeAuth.jsx Tests ── */
  describe('StepWelcomeAuth', () => {
    it('renders welcome headlines, Google, Email, Guest, and Create Account buttons', () => {
      const onGoogleSignIn = vi.fn()
      const onContinueWithEmail = vi.fn()
      const onGuestSignIn = vi.fn()
      const onCreateAccount = vi.fn()

      render(
        <StepWelcomeAuth
          onGoogleSignIn={onGoogleSignIn}
          onContinueWithEmail={onContinueWithEmail}
          onGuestSignIn={onGuestSignIn}
          onCreateAccount={onCreateAccount}
        />
      )

      expect(screen.getByText(/Kelola Finansial Lebih Cerdas/i)).toBeDefined()
      expect(screen.getByText(/Lanjutkan dengan Google/i)).toBeDefined()
      expect(screen.getByText(/Lanjutkan dengan Email/i)).toBeDefined()
      expect(screen.getByText(/Lanjut Mode Tamu/i)).toBeDefined()
      expect(screen.getByText(/Buat Akun Baru/i)).toBeDefined()

      fireEvent.click(screen.getByText(/Lanjutkan dengan Google/i))
      expect(onGoogleSignIn).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByText(/Lanjutkan dengan Email/i))
      expect(onContinueWithEmail).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByText(/Lanjut Mode Tamu/i))
      expect(onGuestSignIn).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByText(/Buat Akun Baru/i))
      expect(onCreateAccount).toHaveBeenCalledTimes(1)
    })

    it('displays loading state and error alert when provided', () => {
      render(
        <StepWelcomeAuth
          onGoogleSignIn={vi.fn()}
          isGoogleLoading={true}
          googleError="Gagal masuk akun Google"
        />
      )

      expect(screen.getByText(/Menghubungkan Google.../i)).toBeDefined()
      expect(screen.getByText(/Gagal masuk akun Google/i)).toBeDefined()
    })
  })

  /* ── 4. StepProfileSetup.jsx Tests ── */
  describe('StepProfileSetup', () => {
    it('renders avatar preview, username input, and triggers change photo modal', () => {
      const onOpenChangePhoto = vi.fn()
      const setUsername = vi.fn()
      const onBack = vi.fn()
      const onNext = vi.fn()

      render(
        <StepProfileSetup
          username="Budi"
          setUsername={setUsername}
          profilePhoto="mock-photo.jpg"
          onOpenChangePhoto={onOpenChangePhoto}
          onBack={onBack}
          onNext={onNext}
        />
      )

      expect(screen.getByText(/Konfirmasi Profil Anda/i)).toBeDefined()
      const input = screen.getByPlaceholderText(/Nama lengkap Anda/i)
      expect(input.value).toBe('Budi')

      const changePhotoBtns = screen.getAllByTitle(/Ganti Foto \/ Persona/i)
      expect(changePhotoBtns.length).toBeGreaterThanOrEqual(1)
      fireEvent.click(changePhotoBtns[0])
      expect(onOpenChangePhoto).toHaveBeenCalled()

      fireEvent.click(screen.getByText(/Kembali/i))
      expect(onBack).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByText(/Lanjut/i))
      expect(onNext).toHaveBeenCalledTimes(1)
    })

    it('displays username validation error when provided', () => {
      render(
        <StepProfileSetup
          username=""
          setUsername={vi.fn()}
          usernameError="Nama tidak boleh kosong"
          onBack={vi.fn()}
          onNext={vi.fn()}
        />
      )

      expect(screen.getByText(/Nama tidak boleh kosong/i)).toBeDefined()
    })
  })

  /* ── 5. StepThemeSelect.jsx Tests ── */
  describe('StepThemeSelect', () => {
    it('renders 3 theme options (light, dark, midnight) and triggers onThemeSelect', () => {
      const onThemeSelect = vi.fn()
      const onBack = vi.fn()
      const onNext = vi.fn()

      render(
        <StepThemeSelect
          theme="dark"
          onThemeSelect={onThemeSelect}
          onBack={onBack}
          onNext={onNext}
        />
      )

      expect(screen.getByText(/Pure Light/i)).toBeDefined()
      expect(screen.getByText(/Matte Dark/i)).toBeDefined()
      expect(screen.getByText(/Midnight Sapphire/i)).toBeDefined()

      fireEvent.click(screen.getByText(/Pure Light/i))
      expect(onThemeSelect).toHaveBeenCalledWith('light', expect.anything())

      fireEvent.click(screen.getByText(/Midnight Sapphire/i))
      expect(onThemeSelect).toHaveBeenCalledWith('midnight', expect.anything())

      fireEvent.click(screen.getByText(/Kembali/i))
      expect(onBack).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByText(/Lanjut ke Dompet/i))
      expect(onNext).toHaveBeenCalledTimes(1)
    })
  })

  /* ── 6. StepWalletSetup.jsx Tests ── */
  describe('StepWalletSetup', () => {
    it('renders Step 3 progress header and embeds AddAccountPage with callbacks', async () => {
      const onBack = vi.fn()
      const onSuccess = vi.fn()

      render(<StepWalletSetup onBack={onBack} onSuccess={onSuccess} />)

      expect(screen.getByText(/Langkah 3 dari 4/i)).toBeDefined()

      const mockPage = await screen.findByTestId('mock-add-account-page')
      expect(mockPage).toBeDefined()
      expect(mockPage.getAttribute('data-onboarding')).toBe('true')

      fireEvent.click(screen.getByText('Mock Back Account'))
      expect(onBack).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByText('Mock Success Account'))
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  /* ── 7. StepSummaryConfirm.jsx Tests ── */
  describe('StepSummaryConfirm', () => {
    it('renders summary overview, user profile, wallets list, and finish button', () => {
      const onSetDefaultWalletId = vi.fn()
      const onDeleteWallet = vi.fn()
      const onEditUsername = vi.fn()
      const onAddExtraWallet = vi.fn()
      const onFinish = vi.fn()

      render(
        <StepSummaryConfirm
          username="Siti"
          profilePhoto="mock-siti.jpg"
          authProvider="guest"
          wallets={mockWallets}
          defaultWalletId="wallet-1"
          onSetDefaultWalletId={onSetDefaultWalletId}
          onDeleteWallet={onDeleteWallet}
          onEditUsername={onEditUsername}
          onAddExtraWallet={onAddExtraWallet}
          onFinish={onFinish}
        />
      )

      expect(screen.getByText(/Semua Siap!/i)).toBeDefined()
      expect(screen.getByText('Siti')).toBeDefined()
      expect(screen.getByText(/Mode Tamu/i)).toBeDefined()

      // Edit name
      fireEvent.click(screen.getByText(/Edit/i))
      expect(onEditUsername).toHaveBeenCalledTimes(1)

      // Add extra wallet
      fireEvent.click(screen.getByText(/Tambah/i))
      expect(onAddExtraWallet).toHaveBeenCalledTimes(1)

      // Wallet list contains Dompet Utama (primary) and Cash (with Star)
      expect(screen.getByText('Dompet Utama')).toBeDefined()
      expect(screen.getByText('Cash')).toBeDefined()
      expect(screen.getByText(/^Utama$/i)).toBeDefined()

      // Click Star button for Cash wallet
      const starBtn = screen.getByTitle(/Jadikan Dompet Utama/i)
      fireEvent.click(starBtn)
      expect(onSetDefaultWalletId).toHaveBeenCalledWith('wallet-2')

      // Finish CTA
      fireEvent.click(screen.getByText(/Mulai Gunakan FinTrack/i))
      expect(onFinish).toHaveBeenCalledTimes(1)
    })
  })

  /* ── 8. OnboardingFlow Orchestrator Full State Machine Integration ── */
  describe('OnboardingFlow Orchestrator State Machine', () => {
    it('renders Step 0 initially and transitions smoothly through wizard steps to completion', async () => {
      vi.useFakeTimers()

      render(<OnboardingFlow />)

      // Initial Step 0
      expect(screen.getByText(/Kelola Finansial Lebih Cerdas/i)).toBeDefined()

      // Click Guest Sign-In -> transitions to Step 1
      await act(async () => {
        fireEvent.click(screen.getByText(/Lanjut Mode Tamu/i))
      })

      act(() => {
        vi.advanceTimersByTime(250)
      })

      // Step 1: Profile Setup
      expect(screen.getByText(/Konfirmasi Profil Anda/i)).toBeDefined()
      const nameInput = screen.getByPlaceholderText(/Nama lengkap Anda/i)

      // Try empty submission -> triggers validation error
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: '' } })
        fireEvent.click(screen.getByText(/Lanjut/i))
      })
      expect(screen.getByText(/Nama tidak boleh kosong/i)).toBeDefined()

      // Try 1 char submission -> triggers min error
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'A' } })
        fireEvent.click(screen.getByText(/Lanjut/i))
      })
      expect(screen.getByText(/Minimal 2 karakter/i)).toBeDefined()

      // Valid name submission -> transitions to Step 2
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Budi Santoso' } })
        fireEvent.click(screen.getByText(/Lanjut/i))
      })

      act(() => {
        vi.advanceTimersByTime(250)
      })

      // Step 2: Theme Selection
      expect(screen.getByText(/Pilih Tema Tampilan/i)).toBeDefined()

      // Select Pure Light and proceed to Step 3
      await act(async () => {
        fireEvent.click(screen.getByText(/Pure Light/i))
        fireEvent.click(screen.getByText(/Lanjut ke Dompet/i))
      })

      act(() => {
        vi.advanceTimersByTime(250)
      })

      // Step 3: Wallet Setup
      expect(screen.getByText(/Langkah 3 dari 4/i)).toBeDefined()
      expect(screen.getByTestId('mock-add-account-page')).toBeDefined()

      // Successful wallet addition -> transitions to Step 4
      await act(async () => {
        fireEvent.click(screen.getByText('Mock Success Account'))
      })

      act(() => {
        vi.advanceTimersByTime(250)
      })

      // Step 4: Summary Confirm
      expect(screen.getByText(/Semua Siap!/i)).toBeDefined()
      expect(screen.getByText('Budi Santoso')).toBeDefined()

      // Finish CTA -> completes onboarding and navigates to dashboard
      await act(async () => {
        fireEvent.click(screen.getByText(/Mulai Gunakan FinTrack/i))
      })

      expect(mockStoreState.completeOnboarding).toHaveBeenCalled()
      expect(mockStoreState.startSpotlightTour).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })

      vi.useRealTimers()
    })

    it('navigates back to Step 1 when editing username from Step 4 and returns directly to Step 4', async () => {
      vi.useFakeTimers()

      // Set saved progress at step 4
      saveProgress({ step: 4, username: 'Dewi' })

      render(<OnboardingFlow />)

      // In step 4
      expect(screen.getByText(/Semua Siap!/i)).toBeDefined()

      // Click Edit username
      await act(async () => {
        fireEvent.click(screen.getByText(/Edit/i))
      })

      act(() => {
        vi.advanceTimersByTime(250)
      })

      // Routed back to Step 1
      expect(screen.getByText(/Konfirmasi Profil Anda/i)).toBeDefined()
      const nameInput = screen.getByPlaceholderText(/Nama lengkap Anda/i)

      // Change name and click Continue
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Dewi Lestari' } })
        fireEvent.click(screen.getByText(/Lanjut/i))
      })

      act(() => {
        vi.advanceTimersByTime(250)
      })

      // Returns straight back to Step 4 with updated name!
      expect(screen.getByText(/Semua Siap!/i)).toBeDefined()
      expect(screen.getByText('Dewi Lestari')).toBeDefined()

      vi.useRealTimers()
    })
  })
})
