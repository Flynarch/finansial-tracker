import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  X,
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
import { uploadLatestBackup, downloadLatestBackupJson, getLatestBackupMeta } from '../../lib/cloudBackup'
import { getSessionMnemonicPhrase } from '../../lib/mnemonicCrypto'
import { db } from '../../lib/db'
import { triggerHaptic } from '../../lib/haptics'
import useSettingsStore from '../../store/useSettingsStore'
import useTranslation from '../../hooks/useTranslation'
import Modal from '../ui/Modal'
import MnemonicRecoveryModal from '../security/MnemonicRecoveryModal'
import AuthLoginForm from './sections/AuthLoginForm'
import AuthRegisterForm from './sections/AuthRegisterForm'
import AuthForgotPasswordForm from './sections/AuthForgotPasswordForm'
import AuthMagicLinkForm from './sections/AuthMagicLinkForm'

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

  const [pendingEncryptedCloudBackup, setPendingEncryptedCloudBackup] = useState(null)
  const [isCloudRecoveryOpen, setIsCloudRecoveryOpen] = useState(false)
  const [pendingAuthUser, setPendingAuthUser] = useState(null)

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)
  const [prevInitialMode, setPrevInitialMode] = useState(initialMode)
  if (prevIsOpen !== isOpen || prevInitialMode !== initialMode) {
    setPrevIsOpen(isOpen)
    setPrevInitialMode(initialMode)
    if (isOpen) {
      setMode(initialMode)
      setErrorMessage('')
      setSuccessMessage('')
      setPassword('')
      setConfirmPassword('')
      setPendingEncryptedCloudBackup(null)
      setIsCloudRecoveryOpen(false)
      setPendingAuthUser(null)
    }
  }

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
    if (!userObj?.uid) return { success: false }
    try {
      const getUploadPayload = async () => {
        const e2eePhrase = getSessionMnemonicPhrase()
        const isE2eeActive = Boolean(e2eePhrase && e2eePhrase.trim().split(/\s+/).length === 12)
        if (!isE2eeActive) {
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

      if (isNewUser) {
        try {
          const meta = await getLatestBackupMeta(userObj.uid)
          const hasPriorBackup = Boolean(meta?.lastBackupPath || meta?.lastBackupAt || meta?.lastBackupUrl)
          if (!hasPriorBackup) {
            const txCount = await db.transactions.count().catch(() => 0)
            const loanCount = await db.loans.count().catch(() => 0)
            const goalCount = await db.goals.count().catch(() => 0)
            if (txCount > 0 || loanCount > 0 || goalCount > 0) {
              const uploadRes = await getUploadPayload()
              if (uploadRes?.payload) {
                await uploadLatestBackup(userObj.uid, uploadRes.payload, { isEncrypted: uploadRes.isEncrypted }).catch((err) => console.warn('[AuthModal]', err))
              }
            }
          }
        } catch (err){
          console.warn('[AuthModal]', err)
        }
        return { success: true }
      }

      const cloudData = await downloadLatestBackupJson(userObj.uid).catch(() => null)

      if (cloudData) {
        if (cloudData.format === 'fintrack_encrypted_envelope') {
          const e2eePhrase = getSessionMnemonicPhrase()
          if (e2eePhrase && e2eePhrase.trim().split(/\s+/).length === 12) {
            try {
              await importAllDataFromEncryptedEnvelope(cloudData, e2eePhrase.trim())
              return { success: true }
            } catch (err){
              console.warn('[AuthModal]', err)
              return { needsRecoveryPhrase: true, cloudData }
            }
          } else {
            return { needsRecoveryPhrase: true, cloudData }
          }
        } else {
          await importAllDataFromJsonPayload(cloudData)
          return { success: true }
        }
      }
      return { success: true }
    } catch (err){
      console.warn('[AuthModal]', err)
      return { success: false }
    }
  }, [t])

  /* ── Auto Prompt Google One Tap on Web ───────────────────────────── */
  useEffect(() => {
    if (!isOpen || (mode !== 'login' && mode !== 'register')) return
    promptGoogleOneTap({
      onSuccess: async (user) => {
        setIsLoading(true)
        try {
          await setAuthUser(user)
          const restoreRes = await restoreUserBackup(user, false)
          if (restoreRes?.needsRecoveryPhrase) {
            setPendingAuthUser(user)
            setPendingEncryptedCloudBackup(restoreRes.cloudData)
            setIsCloudRecoveryOpen(true)
            return
          }
          triggerHaptic('success')
          setSuccessMessage(t('auth.loginSuccess', 'Berhasil masuk dengan akun Google.'))
          setTimeout(() => {
            onSuccess?.(user)
            onClose?.()
          }, 800)
        } catch (err){
          console.warn('[AuthModal]', err)
          triggerHaptic('warning')
          setErrorMessage(t('auth.generalError', 'Terjadi kesalahan saat masuk.'))
        } finally {
          setIsLoading(false)
        }
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
        const restoreRes = await restoreUserBackup(res.user, Boolean(res.isNewUser))
        if (restoreRes?.needsRecoveryPhrase) {
          setPendingAuthUser(res.user)
          setPendingEncryptedCloudBackup(restoreRes.cloudData)
          setIsCloudRecoveryOpen(true)
          return
        }
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
    } catch (err){
      console.warn('[AuthModal]', err)
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
        const restoreRes = await restoreUserBackup(res.user, false)
        if (restoreRes?.needsRecoveryPhrase) {
          setPendingAuthUser(res.user)
          setPendingEncryptedCloudBackup(restoreRes.cloudData)
          setIsCloudRecoveryOpen(true)
          return
        }
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
    } catch (err){
      console.warn('[AuthModal]', err)
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
    } catch (err){
      console.warn('[AuthModal]', err)
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
    } catch (err){
      console.warn('[AuthModal]', err)
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
    } catch (err){
      console.warn('[AuthModal]', err)
      triggerHaptic('warning')
      setErrorMessage(t('auth.generalError', 'Terjadi kesalahan sistem.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Modal isOpen={isOpen && !isCloudRecoveryOpen} onClose={onClose} showHeader={false} showCloseButton={false} zIndex="z-[200]">
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
            <AuthLoginForm
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              isLoading={isLoading}
              isEmailError={isEmailError}
              isPasswordError={isPasswordError}
              isEmailDomainInvalid={isEmailDomainInvalid}
              handleEmailSignIn={handleEmailSignIn}
              handleGoogleAuth={handleGoogleAuth}
              handleApplyDomain={handleApplyDomain}
              switchMode={switchMode}
              t={t}
              clearErrorMessage={() => errorMessage && setErrorMessage('')}
            />
          )}

          {/* ── MODE 2: REGISTER (CREATE ACCOUNT) ────────────────────── */}
          {mode === 'register' && (
            <AuthRegisterForm
              name={name}
              setName={setName}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              showConfirmPassword={showConfirmPassword}
              setShowConfirmPassword={setShowConfirmPassword}
              sendVerification={sendVerification}
              setSendVerification={setSendVerification}
              isLoading={isLoading}
              passwordScore={passwordScore}
              isEmailError={isEmailError}
              isPasswordError={isPasswordError}
              isConfirmPasswordError={isConfirmPasswordError}
              isEmailDomainInvalid={isEmailDomainInvalid}
              handleRegister={handleRegister}
              handleGoogleAuth={handleGoogleAuth}
              handleApplyDomain={handleApplyDomain}
              switchMode={switchMode}
              t={t}
              clearErrorMessage={() => errorMessage && setErrorMessage('')}
            />
          )}

          {/* ── MODE 3: FORGOT PASSWORD ──────────────────────────────── */}
          {mode === 'forgot' && (
            <AuthForgotPasswordForm
              email={email}
              setEmail={setEmail}
              isLoading={isLoading}
              isEmailError={isEmailError}
              isEmailDomainInvalid={isEmailDomainInvalid}
              handleForgotPassword={handleForgotPassword}
              handleApplyDomain={handleApplyDomain}
              switchMode={switchMode}
              t={t}
              clearErrorMessage={() => errorMessage && setErrorMessage('')}
            />
          )}

          {/* ── MODE 4: MAGIC LINK (PASSWORDLESS) ────────────────────── */}
          {mode === 'magic_link' && (
            <AuthMagicLinkForm
              email={email}
              setEmail={setEmail}
              isLoading={isLoading}
              isEmailError={isEmailError}
              isEmailDomainInvalid={isEmailDomainInvalid}
              handleMagicLink={handleMagicLink}
              handleApplyDomain={handleApplyDomain}
              switchMode={switchMode}
              t={t}
              clearErrorMessage={() => errorMessage && setErrorMessage('')}
            />
          )}
        </div>
      </Modal>

      {isCloudRecoveryOpen && (
        <MnemonicRecoveryModal
          isOpen={isCloudRecoveryOpen}
          initialEnvelope={pendingEncryptedCloudBackup}
          source="cloud"
          onRestoreComplete={() => {
            setIsCloudRecoveryOpen(false)
            setPendingEncryptedCloudBackup(null)
            triggerHaptic('success')
            if (pendingAuthUser) {
              onSuccess?.(pendingAuthUser)
            }
            onClose?.()
          }}
          onClose={() => {
            setIsCloudRecoveryOpen(false)
            setPendingEncryptedCloudBackup(null)
            if (pendingAuthUser) {
              onSuccess?.(pendingAuthUser)
            }
            onClose?.()
          }}
        />
      )}
    </>
  )
}
