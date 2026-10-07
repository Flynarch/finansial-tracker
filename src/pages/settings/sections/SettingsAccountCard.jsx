import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ShieldAlert, CheckCircle2 } from 'lucide-react'
import useTranslation from '../../../hooks/useTranslation'
import useSettingsStore from '../../../store/useSettingsStore'
import { APP_DISPLAY_VERSION } from '../../../lib/version'
import UserAvatar from '../../../components/ui/UserAvatar'
import { currencyDisplayMap } from '../settingsConstants'

export default function SettingsAccountCard({
  onConnectAccount,
  onNavigateProfile,
  profileName: propProfileName,
  authProvider: propAuthProvider,
  authUserEmail: propAuthUserEmail,
  emailVerified: propEmailVerified,
  securityEnabled: propSecurityEnabled,
  defaultCurrency: propDefaultCurrency,
  locale: propLocale,
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const storeProfileName = useSettingsStore((state) => state.profileName)
  const storeAuthProvider = useSettingsStore((state) => state.authProvider)
  const storeAuthUserEmail = useSettingsStore((state) => state.authUserEmail)
  const storeEmailVerified = useSettingsStore((state) => state.emailVerified)
  const storeSecurityEnabled = useSettingsStore((state) => state.securityEnabled)
  const storeDefaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const storeLocale = useSettingsStore((state) => state.locale)

  const profileName = propProfileName !== undefined ? propProfileName : storeProfileName
  const authProvider = propAuthProvider !== undefined ? propAuthProvider : storeAuthProvider
  const authUserEmail = propAuthUserEmail !== undefined ? propAuthUserEmail : storeAuthUserEmail
  const emailVerified = propEmailVerified !== undefined ? propEmailVerified : storeEmailVerified
  const securityEnabled = propSecurityEnabled !== undefined ? propSecurityEnabled : storeSecurityEnabled
  const defaultCurrency = propDefaultCurrency !== undefined ? propDefaultCurrency : storeDefaultCurrency
  const locale = propLocale !== undefined ? propLocale : storeLocale

  const currentCurrencyInfo = useMemo(() => {
    return currencyDisplayMap[defaultCurrency] || { name: defaultCurrency, symbol: defaultCurrency, code: defaultCurrency }
  }, [defaultCurrency])

  const handleNavigate = () => {
    if (onNavigateProfile) {
      onNavigateProfile()
    } else {
      navigate('/profile')
    }
  }

  const isGuest = authProvider === 'guest' || authProvider === 'anonymous' || !authUserEmail

  return (
    <>
      {/* 1. Profile / App Info Hero Card (Elevated Bento Header) */}
      <div className="mb-4 rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-card">
        {/* Profile trigger row */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleNavigate}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleNavigate()
            }
          }}
          className="group flex cursor-pointer items-center justify-between gap-4 pb-4 transition select-none"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <UserAvatar
              size={48}
              shape="circle"
              className="group-hover:scale-105 transition-transform"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base text-[var(--fg)] truncate tracking-tight">
                  {profileName || 'Rico'}
                </h3>
                <span className="rounded-md border border-[var(--border)] bg-[var(--field-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--muted)]">
                  {APP_DISPLAY_VERSION}
                </span>
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)] truncate font-medium">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 inline-block ${
                    isGuest ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
                {authProvider === 'google'
                  ? `Google • ${authUserEmail || 'Connected'}`
                  : authProvider === 'email'
                  ? `Email • ${authUserEmail || 'Registered'}${emailVerified ? ` (${t('auth.verified', 'Terverifikasi')})` : ''}`
                  : authProvider === 'anonymous'
                  ? t('settings.anonymousAccount', 'Akun Anonim (Tamu)')
                  : t('settings.guestMode', 'Mode Tamu')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-[var(--muted)] group-hover:text-[var(--fg)] transition-colors shrink-0">
            <span className="hidden sm:inline">{t('profile.title', 'Profil')}</span>
            <ChevronRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Read-only quick status pill tags (non-interactive) */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-3 border-t border-[var(--border)]/60 text-center select-none">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-1.5 px-1.5 sm:px-2">
            <span className="block text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {t('settings.currency', 'Mata Uang')}
            </span>
            <span className="block text-[11.5px] sm:text-xs font-black text-[var(--fg)] truncate mt-0.5">
              {currentCurrencyInfo.symbol} {currentCurrencyInfo.code}
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-1.5 px-1.5 sm:px-2">
            <span className="block text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {t('settings.language', 'Bahasa')}
            </span>
            <span className="block text-[11.5px] sm:text-xs font-black text-[var(--fg)] truncate mt-0.5">
              {locale === 'id' ? t('common.indonesia', 'Indonesia') : t('common.english', 'English')}
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-1.5 px-1.5 sm:px-2">
            <span className="block text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {t('settings.protection', 'Proteksi')}
            </span>
            <span
              className={`block text-[11.5px] sm:text-xs font-black truncate mt-0.5 ${
                securityEnabled ? 'text-emerald-500' : 'text-[var(--muted)]'
              }`}
            >
              {securityEnabled ? t('settings.active', 'Aktif') : t('settings.inactive', 'Nonaktif')}
            </span>
          </div>
        </div>
      </div>

      {/* 1.5 Guest / Anonymous Mode Warning & Link Account Banner */}
      {isGuest && (
        <div className="mb-6 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert size={22} strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm text-[var(--fg)]">
                  {t('settings.guestBannerTitle', 'Mode Tamu / Anonim Aktif')}
                </h4>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {t(
                  'settings.guestBannerSubtitle',
                  'Hubungkan akun Google atau Email Anda agar catatan transaksi aman & tersinkronisasi multi-perangkat.'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onConnectAccount}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <CheckCircle2 size={14} />
            <span>{t('settings.connectAccountNow', 'Hubungkan / Tautkan Akun')}</span>
          </button>
        </div>
      )}
    </>
  )
}
