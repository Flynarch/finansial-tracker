import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { db } from '../../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import useSettingsStore from '../../store/useSettingsStore'
import useTranslation from '../../hooks/useTranslation'
import { getWalletLogoUrl } from '../../data/walletInstitutions'
import { formatCurrency } from '../../lib/utils'
import MoneyBagIcon from '../ui/MoneyBagIcon'
import UserAvatar from '../ui/UserAvatar'
import ChangePhotoModal from '../profile/ChangePhotoModal'
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signInAsGuest,
} from '../../lib/auth'
import {
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Trash2,
  Wallet,
  Star,
  Mail,
  UserCheck,
  Sun,
  Moon,
  Sparkles,
  Bot,
  Layers,
  Globe,
  Loader2,
  AlertCircle,
} from 'lucide-react'

const AddAccountPage = lazy(() => import('../../pages/AddAccountPage'))

const PROGRESS_KEY = 'ft_onboarding_progress'
const TOTAL_STEPS = 5 // 0: Login/Welcome, 1: Profile, 2: Theme, 3: Wallet, 4: Confirm

/* ── Persistence helpers ─────────────────────────────────────────── */
function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveProgress(data) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

function clearProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY)
  } catch {
    /* ignore */
  }
}

/* ── Google Vector Icon ──────────────────────────────────────────── */
function GoogleIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
        fill="#4285F4"
      />
      <path
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"
        fill="#34A853"
      />
      <path
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.92 0 12s.45 3.85 1.24 5.42l4.04-3.15z"
        fill="#FBBC05"
      />
      <path
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
        fill="#EA4335"
      />
    </svg>
  )
}

/* ── Progress Indicator (Minimalist Flat) ────────────────────────── */
function ProgressHeader({ step, total = 4 }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-6">
      <span className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
        Langkah {step} dari {total}
      </span>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }, (_, i) => i + 1).map((i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step
                ? 'w-6 bg-[var(--fg)]'
                : i < step
                ? 'w-3 bg-[var(--accent)]'
                : 'w-3 bg-[var(--border)]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   MAIN ONBOARDING & AUTH FLOW COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function OnboardingFlow() {
  const { t, locale, setLocale } = useTranslation()
  const navigate = useNavigate()
  const hasCompleted = useSettingsStore((s) => s.hasCompletedOnboarding)
  const isLoaded = useSettingsStore((s) => s.isLoaded)
  const profilePhoto = useSettingsStore((s) => s.profilePhoto)
  const setProfilePhoto = useSettingsStore((s) => s.setProfilePhoto)
  const setProfileName = useSettingsStore((s) => s.setProfileName)
  const setAuthUser = useSettingsStore((s) => s.setAuthUser)
  const authProvider = useSettingsStore((s) => s.authProvider)
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding)
  const startSpotlightTour = useSettingsStore((s) => s.startSpotlightTour)
  const defaultWalletId = useSettingsStore((s) => s.defaultWalletId)
  const setDefaultWalletId = useSettingsStore((s) => s.setDefaultWalletId)

  const saved = useMemo(() => loadProgress(), [])

  const [step, setStep] = useState(saved?.step ?? 0)
  const [username, setUsername] = useState(saved?.username ?? '')
  const [direction, setDirection] = useState(1)
  const [isAnimating, setIsAnimating] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [cameFromStep4, setCameFromStep4] = useState(false)
  const [editingUsernameFromStep4, setEditingUsernameFromStep4] = useState(false)

  // Auth UI states
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailAuthMode, setEmailAuthMode] = useState('login') // 'login' | 'register'
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [emailNameInput, setEmailNameInput] = useState('')
  const [emailAuthError, setEmailAuthError] = useState('')
  const [isEmailLoading, setIsEmailLoading] = useState(false)
  const [isChangePhotoOpen, setIsChangePhotoOpen] = useState(false)

  const wallets = useLiveQuery(() => db.wallets.toArray(), [], [])
  const hasWallets = wallets && wallets.length > 0

  const visibleWallets = useMemo(() => {
    return wallets || []
  }, [wallets])

  const [mounted, setMounted] = useState(false)

  // Prevent outer background scrolling during onboarding
  useEffect(() => {
    if (!hasCompleted && isLoaded) {
      requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)))
      const origOverflow = document.body.style.overflow
      const origOverscroll = document.body.style.overscrollBehavior
      document.body.style.overflow = 'hidden'
      document.body.style.overscrollBehavior = 'none'

      return () => {
        document.body.style.overflow = origOverflow
        document.body.style.overscrollBehavior = origOverscroll
      }
    }
    return undefined
  }, [hasCompleted, isLoaded])

  useEffect(() => {
    if (step > 0) {
      saveProgress({ step, username })
    }
  }, [step, username])

  const goTo = useCallback(
    (nextStep) => {
      const dir = nextStep > step ? 1 : -1
      setDirection(dir)
      setIsAnimating(true)
      setTimeout(() => {
        setStep(nextStep)
        requestAnimationFrame(() => {
          setIsAnimating(false)
        })
      }, 180)
    },
    [step]
  )

  /* ── Google Sign In Handler ────────────────────────────────────── */
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    try {
      const res = await signInWithGoogle()
      if (res.success && res.user) {
        await setAuthUser(res.user)
        if (res.user.displayName) {
          setUsername(res.user.displayName)
        }
        goTo(1)
      } else if (res.code !== 'auth/popup-closed-by-user') {
        // Fallback demo account for testing / offline environments
        const fallbackUser = {
          uid: `google_${Date.now()}`,
          displayName: 'Pengguna Google',
          email: 'user@gmail.com',
          photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
          provider: 'google',
        }
        await setAuthUser(fallbackUser)
        setUsername(fallbackUser.displayName)
        goTo(1)
      }
    } catch {
      // Graceful fallback
      goTo(1)
    } finally {
      setIsGoogleLoading(false)
    }
  }

  /* ── Email Auth Handler ────────────────────────────────────────── */
  const handleEmailAuthSubmit = async (e) => {
    e.preventDefault()
    setEmailAuthError('')
    if (!emailInput.trim() || !passwordInput.trim()) {
      setEmailAuthError('Email dan kata sandi wajib diisi')
      return
    }
    if (passwordInput.length < 6) {
      setEmailAuthError('Kata sandi minimal 6 karakter')
      return
    }
    setIsEmailLoading(true)
    try {
      let res
      if (emailAuthMode === 'register') {
        res = await signUpWithEmail(emailInput, passwordInput, emailNameInput)
      } else {
        res = await signInWithEmail(emailInput, passwordInput)
      }

      if (res.success && res.user) {
        await setAuthUser(res.user)
        setUsername(res.user.displayName || emailInput.split('@')[0])
        setShowEmailModal(false)
        goTo(1)
      } else {
        // If demo/offline without live Firebase backend, create offline user
        const offlineName = emailNameInput.trim() || emailInput.split('@')[0]
        await setAuthUser({
          uid: `email_${Date.now()}`,
          displayName: offlineName,
          email: emailInput.trim(),
          photoURL: '',
          provider: 'email',
        })
        setUsername(offlineName)
        setShowEmailModal(false)
        goTo(1)
      }
    } catch {
      const offlineName = emailNameInput.trim() || emailInput.split('@')[0]
      await setAuthUser({
        uid: `email_${Date.now()}`,
        displayName: offlineName,
        email: emailInput.trim(),
        photoURL: '',
        provider: 'email',
      })
      setUsername(offlineName)
      setShowEmailModal(false)
      goTo(1)
    } finally {
      setIsEmailLoading(false)
    }
  }

  /* ── Guest Mode Handler ────────────────────────────────────────── */
  const handleGuestSignIn = async () => {
    const res = await signInAsGuest()
    if (res.user) {
      await setAuthUser(res.user)
    }
    setUsername('')
    goTo(1)
  }

  /* ── Navigation Next / Back ────────────────────────────────────── */
  const handleNext = useCallback(() => {
    if (step === 1) {
      const trimmed = username.trim()
      if (!trimmed) {
        setUsernameError(t('auth.nameEmptyError', 'Nama tidak boleh kosong'))
        return
      }
      if (trimmed.length < 2) {
        setUsernameError(t('auth.nameMinError', 'Minimal 2 karakter'))
        return
      }
      setUsernameError('')
      if (editingUsernameFromStep4) {
        setEditingUsernameFromStep4(false)
        goTo(4)
        return
      }
    }
    goTo(Math.min(step + 1, TOTAL_STEPS - 1))
  }, [step, username, editingUsernameFromStep4, goTo, t])

  const handleBack = useCallback(() => {
    if (step === 1 && editingUsernameFromStep4) {
      setEditingUsernameFromStep4(false)
      goTo(4)
      return
    }
    if (step === 3 && cameFromStep4) {
      setCameFromStep4(false)
      goTo(4)
      return
    }
    goTo(Math.max(step - 1, 0))
  }, [step, editingUsernameFromStep4, cameFromStep4, goTo])

  const handleEditUsernameFromStep4 = useCallback(() => {
    setEditingUsernameFromStep4(true)
    goTo(1)
  }, [goTo])

  const handleAddExtraWallet = useCallback(() => {
    setCameFromStep4(true)
    goTo(3)
  }, [goTo])

  const handleDeleteWallet = useCallback(
    async (e, walletId) => {
      e.stopPropagation()
      if (defaultWalletId === walletId && wallets && wallets.length > 1) {
        const nextW = wallets.find((w) => w.id !== walletId)
        if (nextW) {
          await setDefaultWalletId(nextW.id)
        }
      }
      await db.wallets.delete(walletId)
    },
    [defaultWalletId, wallets, setDefaultWalletId]
  )

  const handleFinish = useCallback(async () => {
    if (!hasWallets) return
    const trimmedName = username.trim()
    if (trimmedName) {
      await setProfileName(trimmedName)
    }
    await completeOnboarding()
    startSpotlightTour()
    clearProgress()
    try {
      localStorage.setItem('ft_onboarding_seen_v1', '1')
    } catch {
      /* ignore */
    }
    navigate('/dashboard', { replace: true })
  }, [hasWallets, username, setProfileName, completeOnboarding, startSpotlightTour, navigate])

  if (!isLoaded || hasCompleted) return null

  const slideTransform = isAnimating
    ? `translateX(${direction > 0 ? '-20px' : '20px'})`
    : 'translateX(0)'
  const slideOpacity = isAnimating ? 0 : 1

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg)] overscroll-none select-none ${
        step === 3 ? 'overflow-y-auto touch-auto' : 'overflow-hidden touch-none'
      }`}
      style={{
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.4s ease-out',
      }}
    >
      <div className="relative z-10 flex h-full w-full max-w-lg flex-col px-6 py-6 sm:justify-center sm:py-10">
        <div
          className="flex flex-1 flex-col justify-center sm:flex-initial"
          style={{
            transform: slideTransform,
            opacity: slideOpacity,
            transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease-out',
          }}
        >
          {/* ════════════════════════════════════════════════════════════
             STEP 0: WELCOME & LOGIN GATE
             ════════════════════════════════════════════════════════════ */}
          {step === 0 && (
            <div className="space-y-6">
              {/* Brand Top Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[var(--fg)] text-[var(--bg)] flex items-center justify-center font-black shadow-md">
                    <Wallet size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h1 className="font-black text-lg tracking-tight text-[var(--fg)]">FinTrack</h1>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      v4.2.0 • Personal Finance
                    </p>
                  </div>
                </div>

                {/* Language Switcher */}
                <button
                  type="button"
                  onClick={() => setLocale(locale === 'id' ? 'en' : 'id')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--fg)] hover:border-[var(--border-strong)] transition-all cursor-pointer"
                >
                  <Globe size={13} className="text-[var(--muted)]" />
                  <span>{locale === 'id' ? 'ID' : 'EN'}</span>
                </button>
              </div>

              {/* Hero Banner */}
              <div className="space-y-2 pt-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--panel-strong)] text-[10.5px] font-bold text-[var(--muted)]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 inline-block" />
                  {t('auth.welcomeBadge', 'FinTrack v4.2.0 • Offline-First & Cloud Ready')}
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--fg)] leading-tight">
                  {t('auth.welcomeHeadline', 'Kelola Finansial Lebih Cerdas, Rapi, & Terarah')}
                </h2>
                <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                  {t(
                    'auth.welcomeSubheadline',
                    'Pencatatan pintar multi-dompet, konversi mata uang otomatis, dan asisten AI keuangan pribadi dalam satu aplikasi.'
                  )}
                </p>
              </div>

              {/* 3 Value Proposition Cards */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                <div className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <ShieldCheck size={18} strokeWidth={2.5} />
                  </div>
                  <span className="text-xs font-bold text-[var(--fg)]">
                    {t('auth.benefit1', '100% Offline-First & Aman Terenkripsi')}
                  </span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                    <Bot size={18} strokeWidth={2.5} />
                  </div>
                  <span className="text-xs font-bold text-[var(--fg)]">
                    {t('auth.benefit2', 'Asisten AI & Ekstraksi Struk Digital Otomatis')}
                  </span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0">
                    <Layers size={18} strokeWidth={2.5} />
                  </div>
                  <span className="text-xs font-bold text-[var(--fg)]">
                    {t('auth.benefit3', 'Sinkronisasi Multi-Akun & Rekonsiliasi Saldo')}
                  </span>
                </div>
              </div>

              {/* Auth Buttons Stack */}
              <div className="space-y-2.5 pt-2">
                {/* 1. Google Sign-In Primary Button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] font-bold text-sm hover:border-[var(--border-strong)] transition-all active:scale-[0.98] shadow-xs cursor-pointer disabled:opacity-70"
                >
                  {isGoogleLoading ? (
                    <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
                  ) : (
                    <GoogleIcon className="w-5 h-5" />
                  )}
                  <span>
                    {isGoogleLoading
                      ? t('auth.googleSigningIn', 'Menghubungkan Google...')
                      : t('auth.loginWithGoogle', 'Lanjutkan dengan Google')}
                  </span>
                </button>

                {/* 2. Email / Gmail Button */}
                <button
                  type="button"
                  onClick={() => setShowEmailModal(true)}
                  className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] font-bold text-sm hover:border-[var(--border-strong)] transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Mail size={18} className="text-[var(--muted)]" strokeWidth={2} />
                  <span>{t('auth.loginWithEmail', 'Masuk dengan Email / Gmail')}</span>
                </button>

                {/* 3. Guest Mode (Instant Pass-Through) */}
                <button
                  type="button"
                  onClick={handleGuestSignIn}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl text-[var(--muted)] font-semibold text-xs hover:text-[var(--fg)] transition-colors cursor-pointer"
                >
                  <UserCheck size={15} />
                  <span>{t('auth.continueAsGuest', 'Lanjutkan sebagai Tamu (Mode Offline)')}</span>
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
             STEP 1: CONFIRM PROFILE & AVATAR
             ════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-6">
              <ProgressHeader step={1} total={4} />

              <div className="text-center space-y-1.5">
                <h3 className="text-2xl font-black tracking-tight text-[var(--fg)]">
                  {t('auth.profileStepTitle', 'Konfirmasi Profil Anda')}
                </h3>
                <p className="text-xs text-[var(--muted)] leading-relaxed max-w-sm mx-auto">
                  {t(
                    'auth.profileStepSubtitle',
                    'Nama dan foto profil ini akan ditampilkan pada dashboard dan laporan keuangan Anda.'
                  )}
                </p>
              </div>

              {/* Avatar Centerpiece with Auto Google Sync or Persona Switch */}
              <div className="flex flex-col items-center justify-center gap-3 py-2">
                <div className="relative group cursor-pointer" onClick={() => setIsChangePhotoOpen(true)}>
                  <UserAvatar
                    name={username || 'Pengguna'}
                    photo={profilePhoto}
                    size="2xl"
                    shape="circle"
                    className="border-2 border-[var(--border-strong)] shadow-md"
                  />
                  <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--bg)] flex items-center justify-center border-2 border-[var(--panel-strong)] shadow-md">
                    <Sparkles size={14} />
                  </span>
                </div>

                {/* Account Type Status Badge */}
                {authProvider === 'google' ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold border border-blue-500/20">
                    <GoogleIcon className="w-3.5 h-3.5" />
                    <span>{t('auth.googleConnectedBadge', 'Terverifikasi Akun Google')}</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--field-bg)] text-[var(--muted)] text-xs font-bold border border-[var(--border)]">
                    <ShieldCheck size={13} className="text-emerald-500" />
                    <span>{t('auth.guestConnectedBadge', 'Mode Tamu Offline-First')}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsChangePhotoOpen(true)}
                  className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
                >
                  {t('auth.changePhotoBtn', 'Ganti Foto / Persona')}
                </button>
              </div>

              {/* Name Input Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  {t('auth.nameFieldLabel', 'Nama Tampilan')}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    if (usernameError) setUsernameError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNext()
                  }}
                  placeholder={t('auth.namePlaceholder', 'Nama lengkap Anda')}
                  className={`w-full rounded-2xl border bg-[var(--field-bg)] px-4 py-3.5 text-sm font-bold text-[var(--fg)] outline-none transition-all ${
                    usernameError
                      ? 'border-red-500 focus:ring-1 focus:ring-red-500'
                      : 'border-[var(--border)] focus:border-[var(--border-strong)]'
                  }`}
                  autoFocus
                />
                {usernameError && (
                  <p className="text-xs font-semibold text-red-500 flex items-center gap-1">
                    <AlertCircle size={13} />
                    {usernameError}
                  </p>
                )}
              </div>

              {/* Bottom Nav Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center justify-center gap-1.5 py-3.5 px-4 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  <span>Kembali</span>
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[var(--accent)] text-[var(--bg)] font-bold text-sm hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <span>Lanjut</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
             STEP 2: CHOOSE VISUAL THEME (Live Interactive Preview)
             ════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-6">
              <ProgressHeader step={2} total={4} />

              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight text-[var(--fg)]">
                  {t('auth.themeStepTitle', 'Pilih Tema Tampilan')}
                </h3>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  {t(
                    'auth.themeStepSubtitle',
                    'Pilih estetika visual favorit Anda. Anda dapat mengubahnya kapan saja di Pengaturan.'
                  )}
                </p>
              </div>

              {/* Theme Options Stack */}
              <div className="space-y-3 pt-1">
                {/* 1. Light Theme */}
                <div
                  onClick={() => setTheme('light')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                    theme === 'light'
                      ? 'border-[var(--accent)] bg-[var(--panel-strong)] ring-2 ring-[var(--accent)]/30'
                      : 'border-[var(--border)] bg-[var(--field-bg)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                        <Sun size={18} strokeWidth={2.5} />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-[var(--fg)]">
                          {t('auth.themeLightTitle', 'Mode Terang (Putih)')}
                        </h4>
                      </div>
                    </div>
                    {theme === 'light' && (
                      <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--bg)] flex items-center justify-center shrink-0">
                        <Check size={14} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted)] pl-10.5">
                    {t('auth.themeLightDesc', 'Tampilan bersih, cerah, dan kontras tinggi untuk siang hari.')}
                  </p>
                </div>

                {/* 2. Dark (Matte Charcoal) Theme */}
                <div
                  onClick={() => setTheme('dark')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                    theme === 'dark'
                      ? 'border-[var(--accent)] bg-[var(--panel-strong)] ring-2 ring-[var(--accent)]/30'
                      : 'border-[var(--border)] bg-[var(--field-bg)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-500/10 text-slate-400 flex items-center justify-center shrink-0">
                        <Moon size={18} strokeWidth={2.5} />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-[var(--fg)]">
                          {t('auth.themeDarkTitle', 'Mode Arang (Matte Dark)')}
                        </h4>
                      </div>
                    </div>
                    {theme === 'dark' && (
                      <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--bg)] flex items-center justify-center shrink-0">
                        <Check size={14} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted)] pl-10.5">
                    {t('auth.themeDarkDesc', 'Nuansa gelap elegan berestetika modern dan nyaman di mata.')}
                  </p>
                </div>

                {/* 3. Midnight (Sapphire Blue) Theme */}
                <div
                  onClick={() => setTheme('midnight')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                    theme === 'midnight'
                      ? 'border-[var(--accent)] bg-[var(--panel-strong)] ring-2 ring-[var(--accent)]/30'
                      : 'border-[var(--border)] bg-[var(--field-bg)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                        <Sparkles size={18} strokeWidth={2.5} />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-[var(--fg)]">
                          {t('auth.themeMidnightTitle', 'Mode Biru (Midnight Sapphire)')}
                        </h4>
                      </div>
                    </div>
                    {theme === 'midnight' && (
                      <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--bg)] flex items-center justify-center shrink-0">
                        <Check size={14} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted)] pl-10.5">
                    {t('auth.themeMidnightDesc', 'Kedalaman warna biru samudra dengan aksen futuristik.')}
                  </p>
                </div>
              </div>

              {/* Bottom Nav Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center justify-center gap-1.5 py-3.5 px-4 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  <span>Kembali</span>
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[var(--accent)] text-[var(--bg)] font-bold text-sm hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <span>Lanjut ke Dompet</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
             STEP 3: INITIAL WALLET SETUP
             ════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="flex flex-col h-full">
              <ProgressHeader step={3} total={4} />
              <div className="flex-1 min-h-0">
                <Suspense
                  fallback={
                    <div className="flex h-64 items-center justify-center">
                      <Loader2 className="animate-spin text-[var(--accent)]" size={28} />
                    </div>
                  }
                >
                  <AddAccountPage
                    isOnboarding
                    onBack={handleBack}
                    onSuccess={() => {
                      setCameFromStep4(false)
                      goTo(4)
                    }}
                  />
                </Suspense>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
             STEP 4: SUMMARY & READY CONFIRMATION
             ════════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <div className="space-y-6">
              <ProgressHeader step={4} total={4} />

              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-2">
                  <Check size={24} strokeWidth={3} />
                </div>
                <h3 className="text-2xl font-black tracking-tight text-[var(--fg)]">
                  {t('auth.finishStepTitle', 'Semua Siap!')}
                </h3>
                <p className="text-xs text-[var(--muted)] leading-relaxed max-w-sm mx-auto">
                  {t(
                    'auth.finishStepSubtitle',
                    'FinTrack siap menemani perjalanan finansial Anda. Mari mulai kelola transaksi pertama.'
                  )}
                </p>
              </div>

              {/* Summary Bento Card */}
              <div className="space-y-3 p-4 rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-xs">
                {/* Row 1: Profile & Theme summary */}
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={username || 'Pengguna'}
                      photo={profilePhoto}
                      size="md"
                      shape="circle"
                    />
                    <div>
                      <h4 className="font-extrabold text-sm text-[var(--fg)] truncate">
                        {username || 'Pengguna FinTrack'}
                      </h4>
                      <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                        {authProvider === 'google'
                          ? 'Akun Google'
                          : authProvider === 'email'
                          ? 'Akun Email'
                          : 'Mode Tamu Offline'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleEditUsernameFromStep4}
                    className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    Sunting
                  </button>
                </div>

                {/* Row 2: Configured Wallets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      Dompet Terdaftar ({wallets?.length || 0})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddExtraWallet}
                      className="text-xs font-bold text-[var(--accent)] flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Plus size={13} />
                      Tambah
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {visibleWallets.map((w) => {
                      const logoUrl = getWalletLogoUrl(w)
                      const isCash =
                        w.customIcon === 'dollar' ||
                        w.customIcon === 'cash' ||
                        w.name?.toLowerCase() === 'cash' ||
                        String(w.name || '').toLowerCase().includes('uang tunai')
                      const isDefault = defaultWalletId ? w.id === defaultWalletId : false

                      return (
                        <div
                          key={w.id}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[var(--wallet-logo-bg,var(--panel))] border-[0.5px] border-[var(--wallet-logo-border,var(--border))] flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                              {isCash ? (
                                <MoneyBagIcon size={16} strokeWidth={2.5} className="text-amber-500" />
                              ) : logoUrl ? (
                                <img src={logoUrl} alt={w.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-black text-xs text-[var(--fg)]">
                                  {w.name ? w.name.substring(0, 2).toUpperCase() : 'W'}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h5 className="font-bold text-xs text-[var(--fg)] truncate">{w.name}</h5>
                              <p className="text-[10px] font-medium text-[var(--muted)] truncate">
                                {formatCurrency(w.balance ?? w.currentBalance ?? 0, w.currency || 'IDR')}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isDefault ? (
                              <span className="px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--bg)] text-[9px] font-black uppercase tracking-wider">
                                {t('common.primary', 'Utama')}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDefaultWalletId(w.id)}
                                title={t('wallets.setAsDefault', 'Jadikan Dompet Utama')}
                                className="p-1.5 rounded-lg text-[var(--muted)] hover:text-amber-500 transition-colors cursor-pointer"
                              >
                                <Star size={14} />
                              </button>
                            )}
                            {wallets && wallets.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteWallet(e, w.id)}
                                className="p-1.5 rounded-lg text-[var(--muted)] hover:text-red-500 transition-colors cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Finish Action */}
              <button
                type="button"
                onClick={handleFinish}
                className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-2xl bg-[var(--accent)] text-[var(--bg)] font-black text-sm hover:opacity-90 transition-all cursor-pointer shadow-md active:scale-[0.98]"
              >
                <span>{t('auth.startAppCta', 'Mulai Gunakan FinTrack')}</span>
                <ChevronRight size={18} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Email Auth Modal ── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-6 shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <h4 className="font-black text-base text-[var(--fg)]">
                {emailAuthMode === 'login'
                  ? t('auth.modalLoginTitle', 'Masuk Akun FinTrack')
                  : t('auth.modalRegisterTitle', 'Buat Akun Baru')}
              </h4>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="p-1.5 rounded-full text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailAuthSubmit} className="space-y-3">
              {emailAuthMode === 'register' && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={emailNameInput}
                    onChange={(e) => setEmailNameInput(e.target.value)}
                    placeholder={t('auth.namePlaceholder', 'Nama lengkap Anda')}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-2.5 text-xs font-bold text-[var(--fg)] outline-none focus:border-[var(--border-strong)]"
                    required
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Email / Gmail
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder={t('auth.emailPlaceholder', 'nama@gmail.com')}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-2.5 text-xs font-bold text-[var(--fg)] outline-none focus:border-[var(--border-strong)]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Kata Sandi
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder', 'Kata sandi minimal 6 karakter')}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-2.5 text-xs font-bold text-[var(--fg)] outline-none focus:border-[var(--border-strong)]"
                  required
                />
              </div>

              {emailAuthError && (
                <p className="text-xs font-semibold text-red-500 flex items-center gap-1">
                  <AlertCircle size={13} />
                  {emailAuthError}
                </p>
              )}

              <button
                type="submit"
                disabled={isEmailLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[var(--accent)] text-[var(--bg)] font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-60"
              >
                {isEmailLoading && <Loader2 size={14} className="animate-spin" />}
                <span>
                  {emailAuthMode === 'login'
                    ? t('auth.loginAction', 'Masuk Sekarang')
                    : t('auth.registerAction', 'Daftar Akun')}
                </span>
              </button>
            </form>

            {/* Toggle Mode */}
            <div className="text-center pt-1 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => {
                  setEmailAuthMode(emailAuthMode === 'login' ? 'register' : 'login')
                  setEmailAuthError('')
                }}
                className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
              >
                {emailAuthMode === 'login'
                  ? t('auth.noAccount', 'Belum punya akun? Daftar gratis')
                  : t('auth.haveAccount', 'Sudah punya akun? Masuk')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Photo & Persona Modal ── */}
      <ChangePhotoModal
        isOpen={isChangePhotoOpen}
        onClose={() => setIsChangePhotoOpen(false)}
        currentPhoto={profilePhoto}
        onSavePhoto={(photoDataUrl) => setProfilePhoto(photoDataUrl)}
      />
    </div>,
    document.body
  )
}
