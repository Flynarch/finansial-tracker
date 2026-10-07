import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { db } from '../../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import useSettingsStore from '../../store/useSettingsStore'
import useTranslation from '../../hooks/useTranslation'
import useBackButton from '../../hooks/useBackButton'
import ChangePhotoModal from '../profile/ChangePhotoModal'
import AuthModal from '../auth/AuthModal'
import { signInWithGoogle, signInAsGuest } from '../../lib/auth'
import { executeThemeTransition } from '../../lib/themeTransition'
import { importAllDataFromJsonPayload, importAllDataFromEncryptedEnvelope } from '../../lib/backup'
import { downloadLatestBackupJson } from '../../lib/cloudBackup'
import { getSessionMnemonicPhrase } from '../../lib/mnemonicCrypto'
import StepWelcomeAuth from './steps/StepWelcomeAuth'
import StepProfileSetup from './steps/StepProfileSetup'
import StepThemeSelect from './steps/StepThemeSelect'
import StepWalletSetup from './steps/StepWalletSetup'
import StepSummaryConfirm from './steps/StepSummaryConfirm'
import { loadProgress, saveProgress, clearProgress, TOTAL_STEPS } from './onboardingUtils'

export default function OnboardingFlow() {
  const { t } = useTranslation()
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
  const [googleError, setGoogleError] = useState('')
  const [isChangePhotoOpen, setIsChangePhotoOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState('login')
  const [mounted, setMounted] = useState(false)

  const wallets = useLiveQuery(() => db.wallets.toArray(), [], [])
  const hasWallets = wallets && wallets.length > 0

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
    if (step > 0) saveProgress({ step, username })
  }, [step, username])

  useEffect(() => {
    if (wallets && wallets.length > 0) {
      const isCurrentDefaultValid = defaultWalletId && wallets.some((w) => w.id === defaultWalletId)
      if (!isCurrentDefaultValid) setDefaultWalletId(wallets[0].id)
    }
  }, [wallets, defaultWalletId, setDefaultWalletId])

  const goTo = useCallback((nextStep) => {
    setDirection(nextStep > step ? 1 : -1)
    setIsAnimating(true)
    setTimeout(() => {
      setStep(nextStep)
      requestAnimationFrame(() => setIsAnimating(false))
    }, 180)
  }, [step])

  const processGoogleLoginUser = useCallback(async (user) => {
    if (!user?.uid) return
    await setAuthUser(user)
    if (user.displayName) setUsername(user.displayName)
    if (user.photoURL) setProfilePhoto(user.photoURL)

    try {
      const cloudData = await downloadLatestBackupJson(user.uid).catch(() => null)
      if (cloudData) {
        if (cloudData.format === 'fintrack_encrypted_envelope') {
          const e2eePhrase = getSessionMnemonicPhrase()
          if (e2eePhrase && e2eePhrase.trim().split(/\s+/).length === 12) {
            try {
              await importAllDataFromEncryptedEnvelope(cloudData, e2eePhrase.trim())
            } catch (err) {
              console.warn('[OnboardingFlow]', err)
            }
          }
        } else {
          await importAllDataFromJsonPayload(cloudData)
        }
        await completeOnboarding()
        clearProgress()
        try { localStorage.setItem('ft_onboarding_seen_v1', '1') } catch (err) { console.warn('[OnboardingFlow]', err) }
        navigate('/dashboard', { replace: true })
        return
      }
    } catch (err) {
      console.warn('[OnboardingFlow]', err)
    }

    try {
      const [walletCount, txCount] = await Promise.all([db.wallets.count(), db.transactions.count()])
      if (txCount > 0 || walletCount > 1) {
        await completeOnboarding()
        clearProgress()
        try { localStorage.setItem('ft_onboarding_seen_v1', '1') } catch (err) { console.warn('[OnboardingFlow]', err) }
        navigate('/dashboard', { replace: true })
        return
      }
    } catch (err) {
      console.warn('[OnboardingFlow]', err)
    }

    goTo(1)
  }, [setAuthUser, setUsername, setProfilePhoto, completeOnboarding, navigate, goTo])

  const handleGoogleSignIn = async () => {
    setGoogleError('')
    setIsGoogleLoading(true)
    try {
      const res = await signInWithGoogle()
      if (res.success && res.user) {
        await processGoogleLoginUser(res.user)
      } else if (!res.cancelled) {
        setGoogleError(res.message || t('auth.googleFailed', 'Gagal masuk dengan Google'))
      }
    } catch (err) {
      console.warn('[OnboardingFlow]', err)
      setGoogleError(t('auth.googleFailed', 'Terjadi kesalahan saat masuk dengan Google'))
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const handleGuestSignIn = async () => {
    setGoogleError('')
    const res = await signInAsGuest()
    if (res.user) await setAuthUser(res.user)
    setUsername('')
    goTo(1)
  }

  const handleThemeSelect = (targetTheme, e) => {
    if (targetTheme === theme) return
    const rect = e?.currentTarget?.getBoundingClientRect?.()
    const originX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const originY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
    executeThemeTransition({ currentTheme: theme, targetTheme, setTheme, originX, originY })
  }

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
      setProfileName(trimmed)
      if (editingUsernameFromStep4) {
        setEditingUsernameFromStep4(false)
        goTo(4)
        return
      }
    }
    goTo(Math.min(step + 1, TOTAL_STEPS - 1))
  }, [step, username, editingUsernameFromStep4, goTo, setProfileName, t])

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

  useBackButton(handleBack, step > 0)

  const handleEditUsernameFromStep4 = useCallback(() => {
    setEditingUsernameFromStep4(true)
    goTo(1)
  }, [goTo])

  const handleAddExtraWallet = useCallback(() => {
    setCameFromStep4(true)
    goTo(3)
  }, [goTo])

  const handleDeleteWallet = useCallback(async (e, walletId) => {
    e.stopPropagation()
    if (defaultWalletId === walletId && wallets && wallets.length > 1) {
      const nextW = wallets.find((w) => w.id !== walletId)
      if (nextW) await setDefaultWalletId(nextW.id)
    }
    await db.wallets.delete(walletId)
  }, [defaultWalletId, wallets, setDefaultWalletId])

  const handleFinish = useCallback(async () => {
    if (!hasWallets) return
    const trimmedName = username.trim()
    if (trimmedName) await setProfileName(trimmedName)
    const currentDefault = useSettingsStore.getState().defaultWalletId
    if (!currentDefault && wallets && wallets.length > 0) {
      await setDefaultWalletId(wallets[0].id)
    }
    await completeOnboarding()
    startSpotlightTour()
    clearProgress()
    try { localStorage.setItem('ft_onboarding_seen_v1', '1') } catch (err) { console.warn('[OnboardingFlow]', err) }
    navigate('/dashboard', { replace: true })
  }, [hasWallets, username, wallets, setProfileName, setDefaultWalletId, completeOnboarding, startSpotlightTour, navigate])

  if (!isLoaded || hasCompleted) return null

  const slideTransform = isAnimating
    ? `translateX(${direction > 0 ? '-20px' : '20px'})`
    : 'translateX(0)'
  const slideOpacity = isAnimating ? 0 : 1

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg)] overscroll-none select-none ${
        step === 3 ? 'overflow-y-auto touch-auto max-w-2xl px-0 sm:px-4' : 'overflow-hidden touch-none max-w-lg px-6'
      }`}
      style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease-out' }}
    >
      <div className={`relative z-10 flex h-full w-full ${step === 3 ? 'max-w-2xl px-0 sm:px-4' : 'max-w-lg px-6'} flex-col py-6 sm:justify-center sm:py-10`}>
        <div
          className="flex flex-1 flex-col justify-center sm:flex-initial"
          style={{
            transform: slideTransform,
            opacity: slideOpacity,
            transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease-out',
          }}
        >
          {step === 0 && (
            <StepWelcomeAuth
              onGoogleSignIn={handleGoogleSignIn}
              isGoogleLoading={isGoogleLoading}
              googleError={googleError}
              onContinueWithEmail={() => {
                setAuthModalMode('login')
                setAuthModalOpen(true)
              }}
              onGuestSignIn={handleGuestSignIn}
              onCreateAccount={() => {
                setAuthModalMode('register')
                setAuthModalOpen(true)
              }}
              onOneTapSuccess={processGoogleLoginUser}
              setGoogleError={setGoogleError}
            />
          )}

          {step === 1 && (
            <StepProfileSetup
              username={username}
              setUsername={setUsername}
              profilePhoto={profilePhoto}
              usernameError={usernameError}
              setUsernameError={setUsernameError}
              onOpenChangePhoto={() => setIsChangePhotoOpen(true)}
              onBack={handleBack}
              onNext={handleNext}
            />
          )}

          {step === 2 && (
            <StepThemeSelect
              theme={theme}
              onThemeSelect={handleThemeSelect}
              onBack={handleBack}
              onNext={handleNext}
            />
          )}

          {step === 3 && (
            <StepWalletSetup
              onBack={handleBack}
              onSuccess={() => {
                setCameFromStep4(false)
                goTo(4)
              }}
            />
          )}

          {step === 4 && (
            <StepSummaryConfirm
              username={username}
              profilePhoto={profilePhoto}
              authProvider={authProvider}
              wallets={wallets}
              defaultWalletId={defaultWalletId}
              onSetDefaultWalletId={setDefaultWalletId}
              onDeleteWallet={handleDeleteWallet}
              onEditUsername={handleEditUsernameFromStep4}
              onAddExtraWallet={handleAddExtraWallet}
              onFinish={handleFinish}
            />
          )}
        </div>
      </div>

      <ChangePhotoModal
        isOpen={isChangePhotoOpen}
        onClose={() => setIsChangePhotoOpen(false)}
        currentPhoto={profilePhoto}
        onSavePhoto={(photoDataUrl) => setProfilePhoto(photoDataUrl)}
        zIndex="z-[10000]"
      />

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(u) => {
          setAuthModalOpen(false)
          if (u?.displayName) {
            setUsername(u.displayName)
          } else if (u?.email) {
            const prefix = u.email.split('@')[0]
            setUsername(prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : '')
          }
          if (u?.photoURL) setProfilePhoto(u.photoURL)
          goTo(1)
        }}
      />
    </div>,
    document.body
  )
}
