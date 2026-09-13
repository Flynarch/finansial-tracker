import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  X,
  KeyRound,
  Send,
  Loader2,
  ShieldCheck,
  UserPlus,
  LogIn,
} from 'lucide-react'
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  sendPasswordReset,
  sendEmailMagicLink,
  promptGoogleOneTap,
} from '../../lib/auth'
import {
  importAllDataFromJsonPayload,
  exportAllDataAsEncryptedEnvelope,
  importAllDataFromEncryptedEnvelope,
} from '../../lib/backup'
import { uploadLatestBackup, downloadLatestBackupJson } from '../../lib/cloudBackup'
import { db } from '../../lib/db'
import { triggerHaptic } from '../../lib/haptics'
import useSettingsStore from '../../store/useSettingsStore'
import useTranslation from '../../hooks/useTranslation'
import Modal from '../ui/Modal'

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = 'login', // 'login' | 'register' | 'forgot' | 'magic_link'
  onSuccess,
}) {
  const { t } = useTranslation()
  const setAuthUser = useSettingsStore((s) => s.setAuthUser)
  const profileName = useSettingsStore((s) => s.profileName)

  const [mode, setMode] = useState(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [sendVerification, setSendVerification] = useState(true)

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen)
    if (isOpen) {
      setMode(initialMode)
      setErrorMessage('')
      setSuccessMessage('')
      setPassword('')
      setConfirmPassword('')
    }
  }

  // Gmail domain suggestion list (Mandatory Gmail app policy)
  const suggestedDomains = useMemo(() => ['@gmail.com', '@googlemail.com'], [])

  const switchMode = (nextMode) => {
    triggerHaptic('light')
    setMode(nextMode)
    setErrorMessage('')
    setSuccessMessage('')
  }

  const handleApplyDomain = (domain) => {
    triggerHaptic('light')
    const trimmed = email.trim()
    if (!trimmed) {
      setEmail(domain)
      if (errorMessage) setErrorMessage('')
      return
    }
    const atIndex = trimmed.indexOf('@')
    const username = atIndex >= 0 ? trimmed.slice(0, atIndex) : trimmed
    setEmail(`${username}${domain}`)
    if (errorMessage) setErrorMessage('')
  }

  const isGmailAddress = (rawEmail) => {
    const trimmed = String(rawEmail || '').trim().toLowerCase()
    return trimmed.endsWith('@gmail.com') || trimmed.endsWith('@googlemail.com')
  }

  const validateGmailOrSetError = (rawEmail) => {
    if (!isGmailAddress(rawEmail)) {
      setErrorMessage(t('auth.gmailOnlyWarning', 'Hanya mendukung alamat email @gmail.com atau @googlemail.com'))
      triggerHaptic('warning')
      return false
    }
    return true
  }

  // Dynamic field-level error evaluations for subtle, elegant red styling
  const isEmailDomainInvalid = useMemo(() => {
    if (!email.trim()) return false
    return email.includes('@') && !isGmailAddress(email)
  }, [email])

  const isEmailError = useMemo(() => {
    if (isEmailDomainInvalid) return true
    if (!errorMessage) return false
    const err = errorMessage.toLowerCase()
    return (
      err.includes('email') ||
      err.includes('gmail') ||
      err.includes('salah') ||
      err.includes('seluruh') ||
      err.includes('semua')
    )
  }, [isEmailDomainInvalid, errorMessage])

  const isPasswordError = useMemo(() => {
    if (mode === 'register' && password.length > 0 && password.length < 6) return true
    if (!errorMessage) return false
    const err = errorMessage.toLowerCase()
    return (
      err.includes('sandi') ||
      err.includes('password') ||
      err.includes('salah') ||
      err.includes('seluruh') ||
      err.includes('semua')
    )
  }, [mode, password, errorMessage])

  const isConfirmPasswordError = useMemo(() => {
    if (mode === 'register' && confirmPassword.length > 0 && confirmPassword !== password) return true
    if (!errorMessage) return false
    const err = errorMessage.toLowerCase()
    return err.includes('cocok') || err.includes('mismatch')
  }, [mode, confirmPassword, password, errorMessage])

  const getInputClasses = (hasError, isLarge = false) => {
    const basePadding = isLarge ? 'pl-10 pr-4 py-2.5 rounded-2xl' : 'pl-9 pr-3 py-2 rounded-xl'
    if (hasError) {
      return `w-full border ${basePadding} text-xs font-semibold placeholder:text-[var(--muted)]/60 focus:outline-none transition-all duration-200 border-rose-500/50 bg-rose-500/[0.025] text-[var(--fg)] ring-2 ring-rose-500/15 focus:border-rose-500/80 focus:ring-2 focus:ring-rose-500/25`
    }
    return `w-full border ${basePadding} text-xs font-semibold placeholder:text-[var(--muted)]/60 focus:outline-none transition-all duration-200 border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15`
  }

  const getPasswordInputClasses = (hasError) => {
    if (hasError) {
      return `w-full rounded-xl border pl-9 pr-9 py-2 text-xs font-semibold placeholder:text-[var(--muted)]/60 focus:outline-none transition-all duration-200 border-rose-500/50 bg-rose-500/[0.025] text-[var(--fg)] ring-2 ring-rose-500/15 focus:border-rose-500/80 focus:ring-2 focus:ring-rose-500/25`
    }
    return `w-full rounded-xl border pl-9 pr-9 py-2 text-xs font-semibold placeholder:text-[var(--muted)]/60 focus:outline-none transition-all duration-200 border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15`
  }

  // Password strength calculation for register mode
  const passwordScore = useMemo(() => {
    if (!password) return 0
    let score = 0
    if (password.length >= 6) score += 1
    if (password.length >= 8) score += 1
    if (/[0-9]/.test(password)) score += 1
    if (/[a-zA-Z]/.test(password) && /[^a-zA-Z0-9]/.test(password)) score += 1
    return score
  }, [password])

  const restoreUserBackup = useCallback(async (userObj, isNewUser = false) => {
    if (!userObj?.uid) return
    try {
      const getUploadPayload = async () => {
        const e2eePhrase = typeof window !== 'undefined' ? localStorage.getItem('fintrack_e2ee_phrase') : null
        const isE2eeActive = Boolean(e2eePhrase && e2eePhrase.trim().split(/\s+/).length === 12)
        if (!isE2eeActive) {
          // Never upload unencrypted data to cloud storage
          return null
        }
        try {
          const enc = await exportAllDataAsEncryptedEnvelope(e2eePhrase.trim())
          return { payload: enc, isEncrypted: true }
        } catch (err) {
          console.error('Failed to encrypt backup envelope for E2EE cloud backup, aborting upload to protect privacy:', err)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('ft-show-toast', {
                detail: {
                  title: t('settings.security.e2eeEncryptFailedTitle', 'Enkripsi Gagal'),
                  message: t(
                    'settings.security.e2eeEncryptFailedMsg',
                    'Gagal mengenkripsi data cadangan E2EE. Unggahan ke cloud dibatalkan untuk menjaga keamanan.',
                  ),
                  type: 'danger',
                },
              })
            )
          }
          return null
        }
      }

      // Brand new user: immediately export guest data and upload in background if real user data exists
      if (isNewUser) {
        const txCount = await db.transactions.count().catch(() => 0)
        const loanCount = await db.loans.count().catch(() => 0)
        const goalCount = await db.goals.count().catch(() => 0)
        if (txCount > 0 || loanCount > 0 || goalCount > 0) {
          const uploadRes = await getUploadPayload()
          if (uploadRes?.payload) {
            uploadLatestBackup(userObj.uid, uploadRes.payload, { isEncrypted: uploadRes.isEncrypted }).catch(() => {})
          }
        }
        return
      }

      // Existing user sign-in: attempt cloud download with resilient fast timeout
      const cloudData = await Promise.race([
        downloadLatestBackupJson(userObj.uid),
        new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
      ]).catch(() => null)

      if (cloudData) {
        if (cloudData.format === 'fintrack_encrypted_envelope') {
          const e2eePhrase = typeof window !== 'undefined' ? localStorage.getItem('fintrack_e2ee_phrase') : null
          if (e2eePhrase && e2eePhrase.trim().split(/\s+/).length === 12) {
            try {
              await importAllDataFromEncryptedEnvelope(cloudData, e2eePhrase.trim())
            } catch {
              /* stored phrase mismatch or invalid, user can restore in settings */
            }
          }
        } else {
          await importAllDataFromJsonPayload(cloudData)
        }
      } else {
        // Only upload local data if real financial records exist, preventing overwriting cloud backups with empty default wallets
        const txCount = await db.transactions.count().catch(() => 0)
        const loanCount = await db.loans.count().catch(() => 0)
        const goalCount = await db.goals.count().catch(() => 0)
        if (txCount > 0 || loanCount > 0 || goalCount > 0) {
          const uploadRes = await getUploadPayload()
          if (uploadRes?.payload) {
            uploadLatestBackup(userObj.uid, uploadRes.payload, { isEncrypted: uploadRes.isEncrypted }).catch(() => {})
          }
        }
      }
    } catch {
      // Backup restore error non-blocking
    }
  }, [t])

  /* ── Auto Prompt Google One Tap on Web ───────────────────────────── */
  useEffect(() => {
    if (!isOpen || (mode !== 'login' && mode !== 'register')) return
    promptGoogleOneTap({
      onSuccess: async (user) => {
        await setAuthUser(user)
        await restoreUserBackup(user, false)
        triggerHaptic('success')
        setSuccessMessage(t('auth.loginSuccess', 'Berhasil masuk dengan akun Google.'))
        setTimeout(() => {
          onSuccess?.(user)
          onClose?.()
        }, 800)
      },
      onError: (msg) => {
        if (msg) setErrorMessage(msg)
      },
    })
  }, [isOpen, mode, setAuthUser, onSuccess, onClose, t, restoreUserBackup])

  /* ── Google Sign In ─────────────────────────────────────────────── */
  const handleGoogleAuth = async () => {
    setErrorMessage('')
    setSuccessMessage('')
    setIsLoading(true)
    try {
      const res = await signInWithGoogle()
      if (res.success && res.user) {
        await setAuthUser(res.user)
        await restoreUserBackup(res.user, Boolean(res.isNewUser))
        triggerHaptic('success')
        setSuccessMessage(t('auth.loginSuccess', 'Berhasil masuk dengan akun Google.'))
        setTimeout(() => {
          onSuccess?.(res.user)
          onClose?.()
        }, 500)
      } else if (!res.cancelled) {
        triggerHaptic('warning')
        setErrorMessage(res.message || t('auth.googleFailed', 'Gagal masuk dengan Google.'))
      }
    } catch {
      triggerHaptic('warning')
      setErrorMessage(t('auth.generalError', 'Terjadi kesalahan saat masuk.'))
    } finally {
      setIsLoading(false)
    }
  }

  /* ── Email & Password Sign In ────────────────────────────────────── */
  const handleEmailSignIn = async (e) => {
    e?.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    if (!email.trim() || !password) {
      triggerHaptic('warning')
      setErrorMessage(t('auth.fillAllFields', 'Silakan masukkan email dan kata sandi.'))
      return
    }

    if (!validateGmailOrSetError(email)) {
      return
    }

    setIsLoading(true)
    try {
      const res = await signInWithEmail(email, password)
      if (res.success && res.user) {
        await setAuthUser(res.user)
        await restoreUserBackup(res.user, false)
        triggerHaptic('success')
        setSuccessMessage(t('auth.loginSuccess', 'Berhasil masuk ke akun FinTrack.'))
        setTimeout(() => {
          onSuccess?.(res.user)
          onClose?.()
        }, 800)
      } else {
        triggerHaptic('warning')
        setErrorMessage(res.message || t('auth.loginFailed', 'Email atau kata sandi salah.'))
      }
    } catch {
      triggerHaptic('warning')
      setErrorMessage(t('auth.generalError', 'Terjadi kesalahan pada sistem.'))
    } finally {
      setIsLoading(false)
    }
  }

  /* ── Register / Sign Up ─────────────────────────────────────────── */
  const handleRegister = async (e) => {
    e?.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!email.trim() || !password) {
      triggerHaptic('warning')
      setErrorMessage(t('auth.fillAllFields', 'Silakan isi seluruh formulir pendaftaran.'))
      return
    }

    if (!validateGmailOrSetError(email)) {
      return
    }

    if (password.length < 6) {
      triggerHaptic('warning')
      setErrorMessage(t('auth.passwordTooShort', 'Kata sandi minimal 6 karakter.'))
      return
    }

    if (password !== confirmPassword) {
      triggerHaptic('warning')
      setErrorMessage(t('auth.passwordMismatch', 'Konfirmasi kata sandi tidak cocok.'))
      return
    }

    setIsLoading(true)
    try {
      const fallbackName = name.trim() || profileName || (email.split('@')[0] ? email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1) : '')
      const res = await signUpWithEmail(email, password, fallbackName, sendVerification)
      if (res.success && res.user) {
        await setAuthUser(res.user)
        await restoreUserBackup(res.user, true)
        triggerHaptic('success')
        if (res.verificationSent) {
          setSuccessMessage(t('auth.registerSuccessWithVerif', 'Akun berhasil dibuat! Tautan verifikasi telah dikirim ke email Anda.'))
        } else {
          setSuccessMessage(t('auth.registerSuccess', 'Akun baru berhasil didaftarkan!'))
        }
        setTimeout(() => {
          onSuccess?.(res.user)
          onClose?.()
        }, 1200)
      } else {
        triggerHaptic('warning')
        setErrorMessage(res.message || t('auth.registerFailed', 'Gagal mendaftarkan akun baru.'))
      }
    } catch {
      triggerHaptic('warning')
      setErrorMessage(t('auth.generalError', 'Terjadi kesalahan saat pendaftaran.'))
    } finally {
      setIsLoading(false)
    }
  }

  /* ── Forgot Password ────────────────────────────────────────────── */
  const handleForgotPassword = async (e) => {
    e?.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    if (!email.trim()) {
      triggerHaptic('warning')
      setErrorMessage(t('auth.fillEmail', 'Masukkan alamat email Anda.'))
      return
    }

    if (!validateGmailOrSetError(email)) {
      return
    }

    setIsLoading(true)
    try {
      const res = await sendPasswordReset(email)
      if (res.success) {
        triggerHaptic('success')
        setSuccessMessage(res.message || t('auth.resetSent', 'Email pemulihan kata sandi telah dikirim.'))
      } else {
        triggerHaptic('warning')
        setErrorMessage(res.message || t('auth.resetFailed', 'Gagal mengirim email reset kata sandi.'))
      }
    } catch {
      triggerHaptic('warning')
      setErrorMessage(t('auth.generalError', 'Terjadi kesalahan sistem.'))
    } finally {
      setIsLoading(false)
    }
  }

  /* ── Magic Link (Passwordless) ──────────────────────────────────── */
  const handleMagicLink = async (e) => {
    e?.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    if (!email.trim()) {
      triggerHaptic('warning')
      setErrorMessage(t('auth.fillEmail', 'Masukkan alamat email Anda.'))
      return
    }

    if (!validateGmailOrSetError(email)) {
      return
    }

    setIsLoading(true)
    try {
      const res = await sendEmailMagicLink(email)
      if (res.success) {
        triggerHaptic('success')
        setSuccessMessage(res.message || t('auth.magicLinkSent', 'Tautan masuk ajaib telah dikirim ke email Anda.'))
      } else {
        triggerHaptic('warning')
        setErrorMessage(res.message || t('auth.magicLinkFailed', 'Gagal mengirim tautan masuk.'))
      }
    } catch {
      triggerHaptic('warning')
      setErrorMessage(t('auth.generalError', 'Terjadi kesalahan sistem.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} showHeader={false} showCloseButton={false} zIndex="z-[200]">
      <div className="p-4 sm:p-5 space-y-3 max-w-sm w-full mx-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode !== 'login' && mode !== 'register' ? (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--panel-strong)] active:scale-95 transition-all cursor-pointer"
                aria-label={t('common.back', 'Kembali')}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--accent)] text-[var(--bg)] shadow-xs">
                <ShieldCheck className="h-4 w-4" />
              </div>
            )}
            <div>
              <h2 className="text-sm font-black tracking-tight text-[var(--fg)]">
                {mode === 'login' && t('auth.signInTitle', 'Masuk ke FinTrack')}
                {mode === 'register' && t('auth.signUpTitle', 'Daftar Akun Baru')}
                {mode === 'forgot' && t('auth.forgotTitle', 'Pemulihan Kata Sandi')}
                {mode === 'magic_link' && t('auth.magicLinkTitle', 'Masuk Tanpa Sandi')}
              </h2>
              <p className="text-[10.5px] font-semibold text-[var(--muted)] leading-none mt-0.5">
                {mode === 'login' && t('auth.signInSubtitle', 'Sinkronkan data dan amankan catatan finansial Anda.')}
                {mode === 'register' && t('auth.signUpSubtitle', 'Buat akun untuk cadangan otomatis multi-perangkat.')}
                {mode === 'forgot' && t('auth.forgotSubtitle', 'Kami akan mengirim tautan ubah sandi ke email Anda.')}
                {mode === 'magic_link' && t('auth.magicLinkSubtitle', 'Tautan sekali klik langsung masuk dari inbox email.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--field-bg)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)] active:scale-95 transition-all cursor-pointer"
            aria-label={t('common.close', 'Tutup')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Segmented Mode Switcher Tabs (Sign In / Register) */}
        {(mode === 'login' || mode === 'register') && (
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] gap-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'login'
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs border border-[var(--border)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>{t('auth.signInTab', 'Masuk Akun')}</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'register'
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs border border-[var(--border)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>{t('auth.signUpTab', 'Buat Akun Baru')}</span>
            </button>
          </div>
        )}

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 animate-fadeIn">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="leading-tight">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 animate-fadeIn">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="leading-tight">{successMessage}</span>
          </div>
        )}

        {/* ── MODE 1: LOGIN (EMAIL & PASSWORD) ────────────────────── */}
        {mode === 'login' && (
          <div className="space-y-2.5">
            <form onSubmit={handleEmailSignIn} className="space-y-2.5">
              <div className="space-y-1">
                <label className={`text-[11px] font-bold block transition-colors ${isEmailError ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--muted)]'}`}>
                  {t('auth.emailLabel', 'Alamat Email')}
                </label>
                <div className="relative">
                  <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors ${isEmailError ? 'text-rose-500' : 'text-[var(--muted)]'}`} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (errorMessage) setErrorMessage('')
                    }}
                    placeholder={t('auth.emailPlaceholder', 'nama@gmail.com')}
                    className={getInputClasses(isEmailError)}
                  />
                </div>

                {/* Smart Domain Suggestion Chips */}
                {email.trim().length > 0 && !suggestedDomains.some((d) => email.trim().toLowerCase().endsWith(d)) && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5 animate-fadeIn">
                    <span className="text-[9.5px] font-semibold text-[var(--muted)] shrink-0">
                      {t('auth.quickDomainHint', 'Domain cepat:')}
                    </span>
                    {suggestedDomains.map((dom) => (
                      <button
                        key={dom}
                        type="button"
                        onClick={() => handleApplyDomain(dom)}
                        className="px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--panel-strong)] text-[10px] font-bold text-[var(--accent)] hover:border-[var(--accent)] active:scale-95 transition-all cursor-pointer shadow-2xs"
                      >
                        {dom}
                      </button>
                    ))}
                  </div>
                )}

                {/* Subtle warning if not a valid Gmail address */}
                {isEmailDomainInvalid && (
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-rose-500/80 pt-0.5 animate-fadeIn">
                    <AlertCircle className="h-3 w-3 shrink-0 text-rose-500/70" />
                    <span>{t('auth.gmailOnlyWarning', 'Hanya mendukung @gmail.com atau @googlemail.com')}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className={`text-[11px] font-bold transition-colors ${isPasswordError ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--muted)]'}`}>
                    {t('auth.passwordLabel', 'Kata Sandi')}
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-[10.5px] font-bold text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    {t('auth.forgotPassword', 'Lupa Sandi?')}
                  </button>
                </div>
                <div className="relative">
                  <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors ${isPasswordError ? 'text-rose-500' : 'text-[var(--muted)]'}`} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (errorMessage) setErrorMessage('')
                    }}
                    placeholder={t('auth.placeholder.password', '••••••••')}
                    className={getPasswordInputClasses(isPasswordError)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer"
                    aria-label={showPassword ? t('auth.hidePassword', 'Sembunyikan Sandi') : t('auth.showPassword', 'Lihat Sandi')}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-[var(--bg)] py-2.5 px-4 text-xs font-black shadow-xs active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 mt-0.5"
              >
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                <span>{t('auth.signInBtn', 'Masuk ke Akun')}</span>
              </button>
            </form>

            {/* Clean Minimal Prompt: Switch to Register */}
            <div className="text-center text-xs text-[var(--muted)] font-medium pt-0.5">
              <span>{t('auth.noAccountYetPrompt', 'Belum punya akun?')} </span>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="font-black text-[var(--accent)] hover:underline active:scale-95 transition-transform cursor-pointer"
              >
                {t('auth.createAccountNow', 'Buat Akun Baru')}
              </button>
            </div>

            {/* Subtle Divider (Seamless flex line) */}
            <div className="flex items-center gap-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]/50">
              <div className="flex-1 border-t border-[var(--border)]/40" />
              <span>{t('auth.orOtherOptions', 'atau opsi lainnya')}</span>
              <div className="flex-1 border-t border-[var(--border)]/40" />
            </div>

            {/* Quick Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2.5 px-3 text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel-strong)] hover:border-[var(--border-strong)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              <span>{t('auth.quickGoogleSignIn', 'Masuk Cepat dengan Google')}</span>
            </button>

            {/* Passwordless Magic Link Button */}
            <button
              type="button"
              onClick={() => switchMode('magic_link')}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2.5 px-3 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel-strong)] hover:border-[var(--border-strong)] active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
              <span>{t('auth.useMagicLink', 'Masuk Tanpa Sandi (Magic Link)')}</span>
            </button>
          </div>
        )}

        {/* ── MODE 2: REGISTER (CREATE ACCOUNT) ────────────────────── */}
        {mode === 'register' && (
          <div className="space-y-2.5">
            <form onSubmit={handleRegister} className="space-y-2">
              <div className="space-y-0.5">
                <label className="text-[11px] font-bold text-[var(--muted)]">
                  {t('auth.nameLabel', 'Nama Lengkap')}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted)]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (errorMessage) setErrorMessage('')
                    }}
                    placeholder={t('auth.placeholder.name', 'Contoh: Budi Santoso')}
                    className={getInputClasses(false)}
                  />
                </div>
              </div>

              <div className="space-y-0.5">
                <label className={`text-[11px] font-bold block transition-colors ${isEmailError ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--muted)]'}`}>
                  {t('auth.emailLabel', 'Alamat Email')}
                </label>
                <div className="relative">
                  <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors ${isEmailError ? 'text-rose-500' : 'text-[var(--muted)]'}`} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (errorMessage) setErrorMessage('')
                    }}
                    placeholder={t('auth.emailPlaceholder', 'nama@gmail.com')}
                    className={getInputClasses(isEmailError)}
                  />
                </div>

                {/* Smart Domain Suggestion Chips */}
                {email.trim().length > 0 && !suggestedDomains.some((d) => email.trim().toLowerCase().endsWith(d)) && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5 animate-fadeIn">
                    <span className="text-[9.5px] font-semibold text-[var(--muted)] shrink-0">
                      {t('auth.quickDomainHint', 'Domain cepat:')}
                    </span>
                    {suggestedDomains.map((dom) => (
                      <button
                        key={dom}
                        type="button"
                        onClick={() => handleApplyDomain(dom)}
                        className="px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--panel-strong)] text-[10px] font-bold text-[var(--accent)] hover:border-[var(--accent)] active:scale-95 transition-all cursor-pointer shadow-2xs"
                      >
                        {dom}
                      </button>
                    ))}
                  </div>
                )}

                {/* Subtle warning if not a valid Gmail address */}
                {isEmailDomainInvalid && (
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-rose-500/80 pt-0.5 animate-fadeIn">
                    <AlertCircle className="h-3 w-3 shrink-0 text-rose-500/70" />
                    <span>{t('auth.gmailOnlyWarning', 'Hanya mendukung @gmail.com atau @googlemail.com')}</span>
                  </div>
                )}
              </div>

              <div className="space-y-0.5">
                <label className={`text-[11px] font-bold transition-colors ${isPasswordError ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--muted)]'}`}>
                  {t('auth.passwordMinLabel', 'Kata Sandi (Min. 6 Karakter)')}
                </label>
                <div className="relative">
                  <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors ${isPasswordError ? 'text-rose-500' : 'text-[var(--muted)]'}`} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (errorMessage) setErrorMessage('')
                    }}
                    placeholder={t('auth.placeholder.passwordMin', 'Minimal 6 karakter')}
                    className={getPasswordInputClasses(isPasswordError)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer"
                    aria-label={showPassword ? t('auth.hidePassword', 'Sembunyikan Sandi') : t('auth.showPassword', 'Lihat Sandi')}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {password && (
                  <div className="pt-0.5 space-y-0.5">
                    <div className="flex gap-1 h-1">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`flex-1 rounded-full transition-all duration-300 ${
                            passwordScore >= step
                              ? step <= 2
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                              : 'bg-[var(--border)]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Real-time warning if password too short */}
                {password.length > 0 && password.length < 6 && (
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-500 pt-0.5 animate-fadeIn">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{t('auth.passwordTooShort', 'Kata sandi minimal 6 karakter.')}</span>
                  </div>
                )}
              </div>

              <div className="space-y-0.5">
                <label className={`text-[11px] font-bold transition-colors ${isConfirmPasswordError ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--muted)]'}`}>
                  {t('auth.confirmPasswordLabel', 'Konfirmasi Kata Sandi')}
                </label>
                <div className="relative">
                  <KeyRound className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors ${isConfirmPasswordError ? 'text-rose-500' : 'text-[var(--muted)]'}`} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      if (errorMessage) setErrorMessage('')
                    }}
                    placeholder={t('auth.placeholder.confirmPassword', 'Ulangi kata sandi')}
                    className={getPasswordInputClasses(isConfirmPasswordError)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer"
                    aria-label={showConfirmPassword ? t('auth.hidePassword', 'Sembunyikan Sandi') : t('auth.showPassword', 'Lihat Sandi')}
                  >
                    {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Real-time warning if confirm password mismatch */}
                {confirmPassword.length > 0 && confirmPassword !== password && (
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-500 pt-0.5 animate-fadeIn">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{t('auth.passwordMismatch', 'Konfirmasi kata sandi tidak cocok.')}</span>
                  </div>
                )}
              </div>

              {/* Email Verification Checkbox */}
              <label className="flex items-center gap-2 pt-0.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sendVerification}
                  onChange={(e) => setSendVerification(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                />
                <span className="text-[10.5px] font-semibold text-[var(--muted)]">
                  {t('auth.sendVerificationOption', 'Kirim email verifikasi setelah pendaftaran')}
                </span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-[var(--bg)] py-2.5 px-4 text-xs font-black shadow-xs active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 mt-0.5"
              >
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <User className="h-3.5 w-3.5" />}
                <span>{t('auth.signUpBtn', 'Bikin Akun Baru')}</span>
              </button>
            </form>

            {/* Clean Minimal Prompt: Switch to Login */}
            <div className="text-center text-xs text-[var(--muted)] font-medium pt-0.5">
              <span>{t('auth.haveAccountPrompt', 'Sudah punya akun?')} </span>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-black text-[var(--accent)] hover:underline active:scale-95 transition-transform cursor-pointer"
              >
                {t('auth.signInPrompt', 'Masuk di Sini')}
              </button>
            </div>

            {/* Subtle Divider */}
            <div className="flex items-center gap-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]/50">
              <div className="flex-1 border-t border-[var(--border)]/40" />
              <span>{t('auth.orOtherOptions', 'atau opsi lainnya')}</span>
              <div className="flex-1 border-t border-[var(--border)]/40" />
            </div>

            {/* Quick Google Sign-Up Button */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2.5 px-3 text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel-strong)] hover:border-[var(--border-strong)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              <span>{t('auth.quickGoogleSignUp', 'Daftar Cepat dengan Google')}</span>
            </button>
          </div>
        )}

        {/* ── MODE 3: FORGOT PASSWORD ──────────────────────────────── */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1">
              <label className={`text-[11px] font-bold block transition-colors ${isEmailError ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--muted)]'}`}>
                {t('auth.emailLabel', 'Alamat Email')}
              </label>
              <div className="relative">
                <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${isEmailError ? 'text-rose-500' : 'text-[var(--muted)]'}`} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errorMessage) setErrorMessage('')
                  }}
                  placeholder={t('auth.emailPlaceholder', 'nama@gmail.com')}
                  className={getInputClasses(isEmailError, true)}
                />
              </div>

              {/* Smart Domain Suggestion Chips */}
              {email.trim().length > 0 && !suggestedDomains.some((d) => email.trim().toLowerCase().endsWith(d)) && (
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5 animate-fadeIn">
                  <span className="text-[9.5px] font-semibold text-[var(--muted)] shrink-0">
                    {t('auth.quickDomainHint', 'Domain cepat:')}
                  </span>
                  {suggestedDomains.map((dom) => (
                    <button
                      key={dom}
                      type="button"
                      onClick={() => handleApplyDomain(dom)}
                      className="px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--panel-strong)] text-[10px] font-bold text-[var(--accent)] hover:border-[var(--accent)] active:scale-95 transition-all cursor-pointer shadow-2xs"
                    >
                      {dom}
                    </button>
                  ))}
                </div>
              )}

              {/* Subtle warning if not a valid Gmail address */}
              {isEmailDomainInvalid && (
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-rose-500/80 pt-0.5 animate-fadeIn">
                  <AlertCircle className="h-3 w-3 shrink-0 text-rose-500/70" />
                  <span>{t('auth.gmailOnlyWarning', 'Hanya mendukung @gmail.com atau @googlemail.com')}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-[var(--bg)] py-3 px-4 text-xs font-extrabold shadow-sm active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>{t('auth.sendResetLink', 'Kirim Tautan Reset Sandi')}</span>
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
              >
                {t('auth.backToSignIn', 'Kembali ke Halaman Masuk')}
              </button>
            </div>
          </form>
        )}

        {/* ── MODE 4: MAGIC LINK (PASSWORDLESS) ────────────────────── */}
        {mode === 'magic_link' && (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--fg)]">
                <Sparkles className="h-4 w-4 text-[var(--accent)] shrink-0" />
                <span>{t('auth.magicLinkHowItWorks', 'Cara Kerja Magic Link:')}</span>
              </div>
              <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                {t(
                  'auth.magicLinkInstruction',
                  'Masukkan email Gmail Anda, buka email di perangkat ini, dan klik tautan masuk. Anda akan langsung masuk ke FinTrack secara otomatis tanpa perlu mengingat kata sandi.'
                )}
              </p>
            </div>

            <div className="space-y-1">
              <label className={`text-[11px] font-bold block transition-colors ${isEmailError ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--muted)]'}`}>
                {t('auth.emailLabel', 'Alamat Email')}
              </label>
              <div className="relative">
                <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${isEmailError ? 'text-rose-500' : 'text-[var(--muted)]'}`} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errorMessage) setErrorMessage('')
                  }}
                  placeholder={t('auth.emailPlaceholder', 'nama@gmail.com')}
                  className={getInputClasses(isEmailError, true)}
                />
              </div>

              {/* Smart Domain Suggestion Chips */}
              {email.trim().length > 0 && !suggestedDomains.some((d) => email.trim().toLowerCase().endsWith(d)) && (
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5 animate-fadeIn">
                  <span className="text-[9.5px] font-semibold text-[var(--muted)] shrink-0">
                    {t('auth.quickDomainHint', 'Domain cepat:')}
                  </span>
                  {suggestedDomains.map((dom) => (
                    <button
                      key={dom}
                      type="button"
                      onClick={() => handleApplyDomain(dom)}
                      className="px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--panel-strong)] text-[10px] font-bold text-[var(--accent)] hover:border-[var(--accent)] active:scale-95 transition-all cursor-pointer shadow-2xs"
                    >
                      {dom}
                    </button>
                  ))}
                </div>
              )}

              {/* Subtle warning if not a valid Gmail address */}
              {isEmailDomainInvalid && (
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-rose-500/80 pt-0.5 animate-fadeIn">
                  <AlertCircle className="h-3 w-3 shrink-0 text-rose-500/70" />
                  <span>{t('auth.gmailOnlyWarning', 'Hanya mendukung @gmail.com atau @googlemail.com')}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-[var(--bg)] py-3 px-4 text-xs font-extrabold shadow-sm active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>{t('auth.sendMagicLinkBtn', 'Kirim Tautan Masuk Ajaib')}</span>
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
              >
                {t('auth.usePasswordInstead', 'Masuk dengan Kata Sandi Biasa')}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
