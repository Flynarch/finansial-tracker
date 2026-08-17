import { useState, useMemo } from 'react'
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
} from 'lucide-react'
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  sendPasswordReset,
  sendEmailMagicLink,
} from '../../lib/auth'
import { exportAllDataAsJson, importAllDataFromJsonPayload } from '../../lib/backup'
import { uploadLatestBackup, downloadLatestBackupJson } from '../../lib/cloudBackup'
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

  const restoreUserBackup = async (userObj) => {
    if (!userObj?.uid) return
    try {
      const userBackupKey = `ft_user_backup_${userObj.uid}`
      const rawLocal = localStorage.getItem(userBackupKey)
      if (rawLocal) {
        const data = JSON.parse(rawLocal)
        await importAllDataFromJsonPayload(data)
        return
      }
      const cloudData = await downloadLatestBackupJson(userObj.uid)
      if (cloudData) {
        await importAllDataFromJsonPayload(cloudData)
      } else {
        // First time cloud sync for new user
        const backup = await exportAllDataAsJson()
        localStorage.setItem(userBackupKey, JSON.stringify(backup))
        await uploadLatestBackup(userObj.uid, backup).catch(() => {})
      }
    } catch {
      // Backup restore error non-blocking
    }
  }

  /* ── Google Sign In ─────────────────────────────────────────────── */
  const handleGoogleAuth = async () => {
    setErrorMessage('')
    setSuccessMessage('')
    setIsLoading(true)
    try {
      const res = await signInWithGoogle()
      if (res.success && res.user) {
        await setAuthUser(res.user)
        await restoreUserBackup(res.user)
        setSuccessMessage(t('auth.loginSuccess', 'Berhasil masuk dengan akun Google.'))
        setTimeout(() => {
          onSuccess?.(res.user)
          onClose?.()
        }, 800)
      } else if (!res.cancelled) {
        setErrorMessage(res.message || t('auth.googleFailed', 'Gagal masuk dengan Google.'))
      }
    } catch {
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
      setErrorMessage(t('auth.fillAllFields', 'Silakan masukkan email dan kata sandi.'))
      return
    }

    setIsLoading(true)
    try {
      const res = await signInWithEmail(email, password)
      if (res.success && res.user) {
        await setAuthUser(res.user)
        await restoreUserBackup(res.user)
        setSuccessMessage(t('auth.loginSuccess', 'Berhasil masuk ke akun FinTrack.'))
        setTimeout(() => {
          onSuccess?.(res.user)
          onClose?.()
        }, 800)
      } else {
        setErrorMessage(res.message || t('auth.loginFailed', 'Email atau kata sandi salah.'))
      }
    } catch {
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
      setErrorMessage(t('auth.fillAllFields', 'Silakan isi seluruh formulir pendaftaran.'))
      return
    }

    if (password.length < 6) {
      setErrorMessage(t('auth.passwordTooShort', 'Kata sandi minimal 6 karakter.'))
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage(t('auth.passwordMismatch', 'Konfirmasi kata sandi tidak cocok.'))
      return
    }

    setIsLoading(true)
    try {
      const res = await signUpWithEmail(email, password, name || profileName, sendVerification)
      if (res.success && res.user) {
        await setAuthUser(res.user)
        await restoreUserBackup(res.user)
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
        setErrorMessage(res.message || t('auth.registerFailed', 'Gagal mendaftarkan akun baru.'))
      }
    } catch {
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
      setErrorMessage(t('auth.fillEmail', 'Masukkan alamat email Anda.'))
      return
    }

    setIsLoading(true)
    try {
      const res = await sendPasswordReset(email)
      if (res.success) {
        setSuccessMessage(res.message || t('auth.resetSent', 'Email pemulihan kata sandi telah dikirim.'))
      } else {
        setErrorMessage(res.message || t('auth.resetFailed', 'Gagal mengirim email reset kata sandi.'))
      }
    } catch {
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
      setErrorMessage(t('auth.fillEmail', 'Masukkan alamat email Anda.'))
      return
    }

    setIsLoading(true)
    try {
      const res = await sendEmailMagicLink(email)
      if (res.success) {
        setSuccessMessage(res.message || t('auth.magicLinkSent', 'Tautan masuk ajaib telah dikirim ke email Anda.'))
      } else {
        setErrorMessage(res.message || t('auth.magicLinkFailed', 'Gagal mengirim tautan masuk.'))
      }
    } catch {
      setErrorMessage(t('auth.generalError', 'Terjadi kesalahan sistem.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false}>
      <div className="p-5 sm:p-6 space-y-5 max-w-md w-full mx-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode !== 'login' ? (
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setErrorMessage('')
                  setSuccessMessage('')
                }}
                className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--panel-strong)] active:scale-95 transition-all cursor-pointer"
                aria-label={t('common.back', 'Kembali')}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-[var(--bg)] shadow-xs">
                <ShieldCheck className="h-5 w-5" />
              </div>
            )}
            <div>
              <h2 className="text-base font-black tracking-tight text-[var(--fg)]">
                {mode === 'login' && t('auth.signInTitle', 'Masuk ke FinTrack')}
                {mode === 'register' && t('auth.signUpTitle', 'Daftar Akun Baru')}
                {mode === 'forgot' && t('auth.forgotTitle', 'Pemulihan Kata Sandi')}
                {mode === 'magic_link' && t('auth.magicLinkTitle', 'Masuk Tanpa Sandi')}
              </h2>
              <p className="text-[11px] font-semibold text-[var(--muted)]">
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
            className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)] active:scale-95 transition-all cursor-pointer"
            aria-label={t('common.close', 'Tutup')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* ── MODE 1: LOGIN (EMAIL & PASSWORD) ────────────────────── */}
        {mode === 'login' && (
          <div className="space-y-4">
            {/* One-Tap Google Button */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] py-3 px-4 text-xs font-extrabold text-[var(--fg)] shadow-xs hover:border-[var(--border-strong)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
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
              <span>{t('auth.continueWithGoogle', 'Lanjut dengan Akun Google')}</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="w-full border-t border-[var(--border)]" />
              <span className="absolute bg-[var(--panel-strong)] px-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
                {t('auth.orEmail', 'atau gunakan email')}
              </span>
            </div>

            <form onSubmit={handleEmailSignIn} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--muted)]">
                  {t('auth.emailLabel', 'Alamat Email')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.placeholder.email', 'nama@email.com')}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] pl-10 pr-4 py-2.5 text-xs font-semibold text-[var(--fg)] placeholder:text-[var(--muted)]/60 focus:border-[var(--accent)] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[var(--muted)]">
                    {t('auth.passwordLabel', 'Kata Sandi')}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot')
                      setErrorMessage('')
                      setSuccessMessage('')
                    }}
                    className="text-[11px] font-bold text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    {t('auth.forgotPassword', 'Lupa Sandi?')}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.placeholder.password', '••••••••')}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] pl-10 pr-10 py-2.5 text-xs font-semibold text-[var(--fg)] placeholder:text-[var(--muted)]/60 focus:border-[var(--accent)] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer"
                    aria-label={showPassword ? t('auth.hidePassword', 'Sembunyikan Sandi') : t('auth.showPassword', 'Lihat Sandi')}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-[var(--bg)] py-3 px-4 text-xs font-extrabold shadow-sm active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 mt-1"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                <span>{t('auth.signInBtn', 'Masuk ke Akun')}</span>
              </button>
            </form>

            {/* Magic Link Alternative & Sign Up Footer */}
            <div className="pt-2 space-y-2.5 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('magic_link')
                  setErrorMessage('')
                  setSuccessMessage('')
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span>{t('auth.useMagicLink', 'Masuk tanpa sandi (Magic Link Email)')}</span>
              </button>

              <div className="text-xs text-[var(--muted)] font-medium">
                <span>{t('auth.noAccountYet', 'Belum memiliki akun?')} </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setErrorMessage('')
                    setSuccessMessage('')
                  }}
                  className="font-extrabold text-[var(--accent)] hover:underline cursor-pointer"
                >
                  {t('auth.signUpNow', 'Daftar Sekarang')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODE 2: REGISTER (CREATE ACCOUNT) ────────────────────── */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--muted)]">
                {t('auth.nameLabel', 'Nama Lengkap')}
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('auth.placeholder.name', 'Contoh: Budi Santoso')}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] pl-10 pr-4 py-2.5 text-xs font-semibold text-[var(--fg)] placeholder:text-[var(--muted)]/60 focus:border-[var(--accent)] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--muted)]">
                {t('auth.emailLabel', 'Alamat Email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.placeholder.email', 'nama@email.com')}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] pl-10 pr-4 py-2.5 text-xs font-semibold text-[var(--fg)] placeholder:text-[var(--muted)]/60 focus:border-[var(--accent)] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--muted)]">
                {t('auth.passwordLabel', 'Kata Sandi (Min. 6 Karakter)')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.placeholder.passwordMin', 'Minimal 6 karakter')}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] pl-10 pr-10 py-2.5 text-xs font-semibold text-[var(--fg)] placeholder:text-[var(--muted)]/60 focus:border-[var(--accent)] focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer"
                  aria-label={showPassword ? t('auth.hidePassword', 'Sembunyikan Sandi') : t('auth.showPassword', 'Lihat Sandi')}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className="pt-1 space-y-1">
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
                  <p className="text-[10px] font-bold text-[var(--muted)]">
                    {passwordScore <= 1 && t('auth.strengthWeak', 'Sandi Lemah (tambahkan angka & simbol)')}
                    {passwordScore === 2 && t('auth.strengthMedium', 'Sandi Cukup')}
                    {passwordScore >= 3 && t('auth.strengthStrong', 'Sandi Kuat')}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--muted)]">
                {t('auth.confirmPasswordLabel', 'Konfirmasi Kata Sandi')}
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.placeholder.confirmPassword', 'Ulangi kata sandi')}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] pl-10 pr-10 py-2.5 text-xs font-semibold text-[var(--fg)] placeholder:text-[var(--muted)]/60 focus:border-[var(--accent)] focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer"
                  aria-label={showConfirmPassword ? t('auth.hidePassword', 'Sembunyikan Sandi') : t('auth.showPassword', 'Lihat Sandi')}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Email Verification Checkbox */}
            <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendVerification}
                onChange={(e) => setSendVerification(e.target.checked)}
                className="h-4 w-4 rounded-md border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              <span className="text-[11px] font-semibold text-[var(--muted)]">
                {t('auth.sendVerificationOption', 'Kirim email verifikasi setelah pendaftaran')}
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-[var(--bg)] py-3 px-4 text-xs font-extrabold shadow-sm active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 mt-2"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
              <span>{t('auth.signUpBtn', 'Bikin Akun Baru')}</span>
            </button>

            <div className="pt-2 text-center text-xs text-[var(--muted)] font-medium">
              <span>{t('auth.alreadyHaveAccount', 'Sudah punya akun?')} </span>
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setErrorMessage('')
                  setSuccessMessage('')
                }}
                className="font-extrabold text-[var(--accent)] hover:underline cursor-pointer"
              >
                {t('auth.signInNow', 'Masuk')}
              </button>
            </div>
          </form>
        )}

        {/* ── MODE 3: FORGOT PASSWORD ──────────────────────────────── */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--muted)]">
                {t('auth.emailLabel', 'Alamat Email Akun')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.placeholder.email', 'nama@email.com')}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] pl-10 pr-4 py-2.5 text-xs font-semibold text-[var(--fg)] placeholder:text-[var(--muted)]/60 focus:border-[var(--accent)] focus:outline-none transition-colors"
                />
              </div>
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
                onClick={() => {
                  setMode('login')
                  setErrorMessage('')
                  setSuccessMessage('')
                }}
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
                  'Masukkan email Anda, buka email di perangkat ini, dan klik tautan masuk. Anda akan langsung masuk ke FinTrack secara otomatis tanpa perlu mengingat kata sandi.'
                )}
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--muted)]">
                {t('auth.emailLabel', 'Alamat Email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.placeholder.email', 'nama@email.com')}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] pl-10 pr-4 py-2.5 text-xs font-semibold text-[var(--fg)] placeholder:text-[var(--muted)]/60 focus:border-[var(--accent)] focus:outline-none transition-colors"
                />
              </div>
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
                onClick={() => {
                  setMode('login')
                  setErrorMessage('')
                  setSuccessMessage('')
                }}
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
