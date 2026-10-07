import { useEffect } from 'react'
import useTranslation from '../../../hooks/useTranslation'
import { APP_DISPLAY_VERSION } from '../../../lib/version'
import { promptGoogleOneTap } from '../../../lib/auth'
import { GoogleIcon } from '../onboardingUtils'
import {
  Wallet,
  Globe,
  Loader2,
  Mail,
  UserCheck,
  UserPlus,
  AlertCircle,
} from 'lucide-react'

export default function StepWelcomeAuth({
  onGoogleSignIn,
  isGoogleLoading = false,
  googleError = '',
  onContinueWithEmail,
  onGuestSignIn,
  onCreateAccount,
  onOneTapSuccess,
  setGoogleError,
}) {
  const { t, locale, setLocale } = useTranslation()

  /* ── Google One Tap on Onboarding Screen ───────────────────────── */
  useEffect(() => {
    if (!onOneTapSuccess) return
    promptGoogleOneTap({
      onSuccess: async (user) => {
        await onOneTapSuccess(user)
      },
      onError: (msg) => {
        if (msg && setGoogleError) setGoogleError(msg)
      },
    })
  }, [onOneTapSuccess, setGoogleError])

  return (
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
              {APP_DISPLAY_VERSION} • Personal Finance
            </p>
          </div>
        </div>

        {/* Language Switcher */}
        <button
          type="button"
          onClick={() => setLocale(locale === 'id' ? 'en' : 'id')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[var(--border)] bg-[var(--field-bg)] text-xs font-black text-[var(--fg)] hover:border-[var(--border-strong)] transition-all cursor-pointer shadow-2xs active:scale-95"
          aria-label={t('settings.language', 'Bahasa')}
          title={t('settings.language', 'Bahasa')}
        >
          <Globe size={13} className="text-[var(--accent)]" />
          <span>{locale === 'id' ? 'ID' : 'EN'}</span>
        </button>
      </div>

      {/* Hero Banner */}
      <div className="space-y-2 pt-4 pb-2">
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

      {/* Auth Buttons Stack */}
      <div className="space-y-2.5 pt-2">
        {/* 1. Google Sign-In Primary Button */}
        <button
          type="button"
          onClick={onGoogleSignIn}
          disabled={isGoogleLoading}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] font-bold text-sm hover:border-[var(--border-strong)] transition-all active:scale-[0.98] shadow-xs cursor-pointer disabled:opacity-70"
        >
          {isGoogleLoading ? (
            <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
          ) : (
            <GoogleIcon className="w-5 h-5 shrink-0" />
          )}
          <span>
            {isGoogleLoading
              ? t('auth.googleSigningIn', 'Menghubungkan Google...')
              : t('auth.loginWithGoogle', 'Lanjutkan dengan Google')}
          </span>
        </button>

        {/* 2. Continue with Email */}
        <button
          type="button"
          onClick={onContinueWithEmail}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] font-bold text-sm hover:border-[var(--border-strong)] hover:bg-[var(--panel-strong)] transition-all active:scale-[0.98] shadow-2xs cursor-pointer"
        >
          <Mail size={17} className="text-[var(--accent)] shrink-0" />
          <span>{t('auth.continueWithEmail', 'Lanjutkan dengan Email')}</span>
        </button>

        {/* Subtle Divider */}
        <div className="flex items-center gap-3 py-1 my-0.5 text-[9.5px] font-bold uppercase tracking-widest text-[var(--muted)]/50">
          <div className="flex-1 border-t border-[var(--border)]/40" />
          <span>{t('auth.orOtherOptions', 'atau opsi lainnya')}</span>
          <div className="flex-1 border-t border-[var(--border)]/40" />
        </div>

        {/* 3. Guest Mode */}
        <button
          type="button"
          onClick={onGuestSignIn}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl border border-dashed border-[var(--border)] bg-transparent text-[var(--muted)] font-bold text-xs hover:text-[var(--fg)] hover:border-[var(--border-strong)] transition-all active:scale-[0.98] cursor-pointer"
        >
          <UserCheck size={14} className="shrink-0" />
          <span>{t('auth.guestModeFull', 'Lanjut Mode Tamu')}</span>
        </button>

        {/* 4. Direct 'No Account? Create Account' prompt */}
        <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-[var(--muted)] font-medium">
          <span>{t('auth.noAccountYetPrompt', 'Belum punya akun?')}</span>
          <button
            type="button"
            onClick={onCreateAccount}
            className="inline-flex items-center gap-1 font-extrabold text-[var(--accent)] hover:underline active:scale-95 transition-transform cursor-pointer"
          >
            <UserPlus size={13} strokeWidth={2.5} />
            <span>{t('auth.createAccountNow', 'Buat Akun Baru')}</span>
          </button>
        </div>

        {googleError && (
          <div className="p-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-500 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{googleError}</span>
          </div>
        )}
      </div>
    </div>
  )
}
