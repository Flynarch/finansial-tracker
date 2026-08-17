import { useState, useEffect } from 'react'
import { Mail, AlertCircle, RefreshCw, X, Send } from 'lucide-react'
import { sendVerificationEmail, reloadAuthUser } from '../../lib/auth'
import useSettingsStore from '../../store/useSettingsStore'
import useTranslation from '../../hooks/useTranslation'

export default function EmailVerificationBanner() {
  const { t } = useTranslation()
  const authProvider = useSettingsStore((s) => s.authProvider)
  const authUserEmail = useSettingsStore((s) => s.authUserEmail)
  const emailVerified = useSettingsStore((s) => s.emailVerified)
  const emailVerificationDismissed = useSettingsStore((s) => s.emailVerificationDismissed)
  const setEmailVerified = useSettingsStore((s) => s.setEmailVerified)
  const dismissBanner = useSettingsStore((s) => s.dismissEmailVerificationBanner)

  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // Don't show if user is guest or google (google emails are automatically pre-verified by google),
  // or if already verified, or if dismissed for this session.
  if (authProvider !== 'email' || emailVerified || emailVerificationDismissed || !authUserEmail) {
    return null
  }

  const handleSendVerification = async () => {
    if (cooldown > 0 || isLoading) return
    setIsLoading(true)
    setFeedback('')
    try {
      const res = await sendVerificationEmail()
      if (res.success) {
        if (res.alreadyVerified) {
          await setEmailVerified(true)
        } else {
          setCooldown(60)
          setFeedback(t('auth.verifSentFeedback', 'Tautan verifikasi telah dikirim ke email Anda.'))
        }
      } else {
        setFeedback(res.message || t('auth.verifFailedFeedback', 'Gagal mengirim email verifikasi.'))
      }
    } catch {
      setFeedback(t('auth.generalError', 'Terjadi kesalahan sistem.'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckStatus = async () => {
    setIsChecking(true)
    setFeedback('')
    try {
      const refreshed = await reloadAuthUser()
      if (refreshed?.emailVerified) {
        await setEmailVerified(true)
        setFeedback(t('auth.verifSuccessConfirmed', 'Email berhasil diverifikasi!'))
      } else {
        setFeedback(t('auth.verifNotYetConfirmed', 'Email belum diverifikasi. Cek inbox email Anda.'))
      }
    } catch {
      setFeedback(t('auth.generalError', 'Terjadi kesalahan saat memeriksa status.'))
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 sm:p-4 text-xs shadow-xs space-y-2.5 transition-all">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Mail className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-[var(--fg)] tracking-tight">
              {t('auth.emailUnverifiedTitle', 'Verifikasi Alamat Email')}
            </p>
            <p className="text-[11px] font-medium text-[var(--muted)] truncate">
              {authUserEmail} • {t('auth.emailUnverifiedSubtitle', 'Amankan akun dan cadangan data Anda.')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={dismissBanner}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors cursor-pointer"
          aria-label={t('common.close', 'Tutup')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {feedback && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap pt-0.5">
        <button
          type="button"
          onClick={handleSendVerification}
          disabled={isLoading || cooldown > 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 text-white dark:text-slate-900 px-3 py-1.5 text-[11px] font-black shadow-2xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
        >
          <Send className="h-3 w-3" />
          <span>
            {cooldown > 0
              ? `${t('auth.resendIn', 'Kirim Ulang')} (${cooldown}s)`
              : t('auth.resendVerifBtn', 'Kirim Tautan Verifikasi')}
          </span>
        </button>

        <button
          type="button"
          onClick={handleCheckStatus}
          disabled={isChecking}
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-[var(--panel-strong)] px-3 py-1.5 text-[11px] font-extrabold text-[var(--fg)] hover:bg-[var(--field-bg)] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{t('auth.checkStatusBtn', 'Cek Status')}</span>
        </button>
      </div>
    </div>
  )
}
