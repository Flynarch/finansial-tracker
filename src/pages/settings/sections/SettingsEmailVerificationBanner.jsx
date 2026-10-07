import { useState, useEffect, useRef } from 'react'
import { CheckCircle2, Mail, AlertCircle, Send, RefreshCw } from 'lucide-react'
import useTranslation from '../../../hooks/useTranslation'
import useSettingsStore from '../../../store/useSettingsStore'
import { sendVerificationEmail, reloadAuthUser } from '../../../lib/auth'

export default function SettingsEmailVerificationBanner({
  authProvider: propAuthProvider,
  authUserEmail: propAuthUserEmail,
  emailVerified: propEmailVerified,
  onVerified,
}) {
  const { t } = useTranslation()
  const storeAuthProvider = useSettingsStore((state) => state.authProvider)
  const storeAuthUserEmail = useSettingsStore((state) => state.authUserEmail)
  const storeEmailVerified = useSettingsStore((state) => state.emailVerified)
  const storeSetEmailVerified = useSettingsStore((state) => state.setEmailVerified)

  const authProvider = propAuthProvider !== undefined ? propAuthProvider : storeAuthProvider
  const authUserEmail = propAuthUserEmail !== undefined ? propAuthUserEmail : storeAuthUserEmail
  const emailVerified = propEmailVerified !== undefined ? propEmailVerified : storeEmailVerified

  const [isVerifLoading, setIsVerifLoading] = useState(false)
  const [isVerifChecking, setIsVerifChecking] = useState(false)
  const [verifCooldown, setVerifCooldown] = useState(0)
  const [verifFeedback, setVerifFeedback] = useState('')
  const [verifPhase, setVerifPhase] = useState('idle') // 'idle' | 'success' | 'closing'

  const successTimerRef = useRef(null)
  const closingTimerRef = useRef(null)
  const isMountedRef = useRef(true)
  const isSendingRef = useRef(false)
  const isCheckingRef = useRef(false)

  const hasCooldown = verifCooldown > 0

  // Cooldown interval with functional updater to avoid teardown/recreation every second
  useEffect(() => {
    if (!hasCooldown) return

    const timer = setInterval(() => {
      setVerifCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [hasCooldown])

  // Cleanup all pending timers on unmount and track mount lifecycle
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current)
        successTimerRef.current = null
      }
      if (closingTimerRef.current) {
        clearTimeout(closingTimerRef.current)
        closingTimerRef.current = null
      }
    }
  }, [])

  const triggerSuccessExit = () => {
    if (!isMountedRef.current) return
    setVerifPhase('success')
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    if (closingTimerRef.current) clearTimeout(closingTimerRef.current)

    successTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return
      setVerifPhase('closing')
    }, 1800)

    closingTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return
      if (onVerified) {
        onVerified()
      } else {
        storeSetEmailVerified(true)
      }
    }, 2350)
  }

  const handleSendVerification = async () => {
    if (isSendingRef.current || verifCooldown > 0 || isVerifLoading || verifPhase !== 'idle') return
    isSendingRef.current = true
    setIsVerifLoading(true)
    setVerifFeedback('')
    try {
      const res = await sendVerificationEmail()
      if (!isMountedRef.current) return
      if (res?.success) {
        if (res.alreadyVerified) {
          triggerSuccessExit()
        } else {
          setVerifCooldown(60)
          setVerifFeedback(t('auth.verifSentFeedback', 'Tautan verifikasi telah dikirim ke email Anda.'))
        }
      } else {
        setVerifFeedback(res?.message || t('auth.verifFailedFeedback', 'Gagal mengirim email verifikasi.'))
      }
    } catch (err) {
      if (!isMountedRef.current) return
      console.warn('[SettingsEmailVerificationBanner]', err)
      setVerifFeedback(t('auth.generalError', 'Terjadi kesalahan sistem.'))
    } finally {
      isSendingRef.current = false
      if (isMountedRef.current) {
        setIsVerifLoading(false)
      }
    }
  }

  const handleCheckVerifStatus = async () => {
    if (isCheckingRef.current || isVerifChecking || verifPhase !== 'idle') return
    isCheckingRef.current = true
    setIsVerifChecking(true)
    setVerifFeedback('')
    try {
      const refreshed = await reloadAuthUser()
      if (!isMountedRef.current) return
      if (refreshed?.emailVerified) {
        triggerSuccessExit()
      } else {
        setVerifFeedback(t('auth.verifNotYetConfirmed', 'Email belum diverifikasi. Cek inbox email Anda.'))
      }
    } catch (err) {
      if (!isMountedRef.current) return
      console.warn('[SettingsEmailVerificationBanner]', err)
      setVerifFeedback(t('auth.generalError', 'Terjadi kesalahan saat memeriksa status.'))
    } finally {
      isCheckingRef.current = false
      if (isMountedRef.current) {
        setIsVerifChecking(false)
      }
    }
  }

  if (authProvider !== 'email' || (emailVerified && verifPhase === 'idle') || !authUserEmail) {
    return null
  }

  return (
    <div
      className={`mb-6 overflow-hidden rounded-3xl border shadow-xs transition-all duration-500 ease-out transform-gpu ${
        verifPhase === 'closing'
          ? 'max-h-0 opacity-0 -translate-y-3 scale-95 py-0 my-0 border-transparent pointer-events-none'
          : verifPhase === 'success'
          ? 'max-h-40 opacity-100 translate-y-0 scale-100 border-emerald-500/40 bg-emerald-500/15 p-4 sm:p-5 text-emerald-300'
          : 'max-h-72 opacity-100 translate-y-0 scale-100 border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 space-y-3'
      }`}
    >
      {verifPhase === 'success' || verifPhase === 'closing' ? (
        <div className="flex items-center gap-3.5 py-1 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 size={24} className="animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-extrabold text-sm text-emerald-400 tracking-tight">
              {t('auth.emailVerifiedSuccessTitle', 'Email Berhasil Terverifikasi!')}
            </h4>
            <p className="text-xs text-emerald-500/90 leading-relaxed mt-0.5">
              {authUserEmail} • {t('auth.emailVerifiedSuccessSubtitle', 'Akun Anda telah diamankan & terhubung.')}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
              <Mail size={22} strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm text-[var(--fg)]">
                  {t('auth.emailUnverifiedTitle', 'Verifikasi Alamat Email')}
                </h4>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {authUserEmail} • {t('auth.emailUnverifiedSubtitle', 'Amankan akun dan cadangan data Anda.')}
              </p>
            </div>
          </div>

          {verifFeedback && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 px-1">
              <AlertCircle size={14} className="shrink-0" />
              <span>{verifFeedback}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleSendVerification}
              disabled={isVerifLoading || verifCooldown > 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-xs hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Send size={14} />
              <span>
                {verifCooldown > 0
                  ? `${t('auth.resendIn', 'Kirim Ulang')} (${verifCooldown}s)`
                  : t('auth.resendVerifBtn', 'Kirim Tautan Verifikasi')}
              </span>
            </button>
            <button
              type="button"
              onClick={handleCheckVerifStatus}
              disabled={isVerifChecking}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl border border-amber-500/40 bg-[var(--card-bg)] text-[var(--fg)] font-bold text-xs hover:bg-[var(--field-bg)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isVerifChecking ? 'animate-spin' : ''} />
              <span>{t('auth.checkStatusBtn', 'Cek Status')}</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
