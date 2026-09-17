import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sun,
  Moon,
  Sparkles,
  Globe,
  Coins,
  Activity,
  Bot,
  Tag,
  RefreshCw,
  ShieldCheck,
  Database,
  Compass,
  Lock,
  ChevronRight,
  TrendingUp,
  Check,
  LogOut,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Mail,
  Send,
  AlertCircle,
  Bell,
  Calendar,
} from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { APP_DISPLAY_VERSION } from '../../lib/version'
import {
  signOutCurrentUser,
  sendVerificationEmail,
  reloadAuthUser,
} from '../../lib/auth'
import { db } from '../../lib/db'
import { exportAllDataAsJson, exportAllDataAsEncryptedEnvelope } from '../../lib/backup'
import { uploadLatestBackup } from '../../lib/cloudBackup'
import { firebaseErrorToI18nKey } from '../../lib/firebaseErrors'
import PageHeader from '../../components/ui/PageHeader'
import Modal from '../../components/ui/Modal'
import UserAvatar from '../../components/ui/UserAvatar'
import AuthModal from '../../components/auth/AuthModal'
import BudgetCycleModal from '../../components/budget/BudgetCycleModal'
import { currencyOptions, clearFinancialLocalStorage } from './settingsConstants'
import CurrencyFlag from '../../components/currency/CurrencyFlag'
import {
  SettingsBentoTile,
  SettingsLinkRow,
  SettingsSection,
} from './settingsComponents'
import { executeThemeTransition } from '../../lib/themeTransition'

const currencyDisplayMap = {
  IDR: { name: 'Rupiah Indonesia', symbol: 'Rp', code: 'IDR' },
  USD: { name: 'US Dollar', symbol: '$', code: 'USD' },
  EUR: { name: 'Euro', symbol: '€', code: 'EUR' },
  SGD: { name: 'Singapore Dollar', symbol: 'S$', code: 'SGD' },
  MYR: { name: 'Malaysian Ringgit', symbol: 'RM', code: 'MYR' },
  JPY: { name: 'Japanese Yen', symbol: '¥', code: 'JPY' },
  GBP: { name: 'British Pound', symbol: '£', code: 'GBP' },
}

export default function SettingsHome() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const locale = useSettingsStore((state) => state.locale)
  const theme = useSettingsStore((state) => state.theme)
  const motionPreference = useSettingsStore((state) => state.motionPreference)
  const securityEnabled = useSettingsStore((state) => state.securityEnabled)
  const profileName = useSettingsStore((state) => state.profileName)
  const authProvider = useSettingsStore((state) => state.authProvider)
  const authUserEmail = useSettingsStore((state) => state.authUserEmail)
  const authUserId = useSettingsStore((state) => state.authUserId)
  const emailVerified = useSettingsStore((state) => state.emailVerified)
  const resetOnboarding = useSettingsStore((state) => state.resetOnboarding)
  const setAuthUser = useSettingsStore((state) => state.setAuthUser)
  const setEmailVerified = useSettingsStore((state) => state.setEmailVerified)

  const setDefaultCurrency = useSettingsStore((state) => state.setDefaultCurrency)
  const setLocale = useSettingsStore((state) => state.setLocale)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const setMotionPreference = useSettingsStore((state) => state.setMotionPreference)
  const budgetCycleStartDay = useSettingsStore((state) => state.budgetCycleStartDay || 1)

  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false)
  const [isBudgetCycleModalOpen, setIsBudgetCycleModalOpen] = useState(false)
  const [isGuestWarningOpen, setIsGuestWarningOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)

  const [isVerifLoading, setIsVerifLoading] = useState(false)
  const [isVerifChecking, setIsVerifChecking] = useState(false)
  const [verifCooldown, setVerifCooldown] = useState(0)
  const [verifFeedback, setVerifFeedback] = useState('')
  const [verifPhase, setVerifPhase] = useState('idle') // 'idle' | 'success' | 'closing'

  useEffect(() => {
    if (verifCooldown <= 0) return
    const timer = setInterval(() => {
      setVerifCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [verifCooldown])

  // Preserve and restore scroll position when navigating to and from sub-settings pages
  useEffect(() => {
    const savedPos = sessionStorage.getItem('ft_settings_scroll_pos')
    if (savedPos) {
      const top = parseInt(savedPos, 10)
      if (!isNaN(top) && top > 0) {
        requestAnimationFrame(() => {
          window.scrollTo({ top, behavior: 'instant' })
        })
      }
    }

    const onScroll = () => {
      sessionStorage.setItem('ft_settings_scroll_pos', String(window.scrollY || 0))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  const triggerSuccessExit = () => {
    setVerifPhase('success')
    setTimeout(() => {
      setVerifPhase('closing')
    }, 1800)
    setTimeout(() => {
      setEmailVerified(true)
    }, 2350)
  }

  const handleSendVerification = async () => {
    if (verifCooldown > 0 || isVerifLoading || verifPhase !== 'idle') return
    setIsVerifLoading(true)
    setVerifFeedback('')
    try {
      const res = await sendVerificationEmail()
      if (res.success) {
        if (res.alreadyVerified) {
          triggerSuccessExit()
        } else {
          setVerifCooldown(60)
          setVerifFeedback(t('auth.verifSentFeedback', 'Tautan verifikasi telah dikirim ke email Anda.'))
        }
      } else {
        setVerifFeedback(res.message || t('auth.verifFailedFeedback', 'Gagal mengirim email verifikasi.'))
      }
    } catch {
      setVerifFeedback(t('auth.generalError', 'Terjadi kesalahan sistem.'))
    } finally {
      setIsVerifLoading(false)
    }
  }

  const handleCheckVerifStatus = async () => {
    if (isVerifChecking || verifPhase !== 'idle') return
    setIsVerifChecking(true)
    setVerifFeedback('')
    try {
      const refreshed = await reloadAuthUser()
      if (refreshed?.emailVerified) {
        triggerSuccessExit()
      } else {
        setVerifFeedback(t('auth.verifNotYetConfirmed', 'Email belum diverifikasi. Cek inbox email Anda.'))
      }
    } catch {
      setVerifFeedback(t('auth.generalError', 'Terjadi kesalahan saat memeriksa status.'))
    } finally {
      setIsVerifChecking(false)
    }
  }

  const executePerformLogout = async () => {
    try {
      const backup = await exportAllDataAsJson().catch(() => null)
      if (backup && authUserId) {
        const hasData = (backup.transactions && backup.transactions.length > 0) || (backup.wallets && backup.wallets.length > 0)
        if (hasData) {
          const e2eePhrase = typeof window !== 'undefined' ? localStorage.getItem('fintrack_e2ee_phrase') : null
          const isE2eeActive = Boolean(e2eePhrase && e2eePhrase.trim().split(/\s+/).length === 12)

          if (isE2eeActive) {
            let uploadPayload = null
            try {
              uploadPayload = await exportAllDataAsEncryptedEnvelope(e2eePhrase.trim())
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
            }

            if (uploadPayload) {
              await Promise.race([
                uploadLatestBackup(authUserId, uploadPayload, { isEncrypted: true }),
                new Promise((resolve) => setTimeout(resolve, 7000)),
              ]).catch((err) => {
                if (typeof window !== 'undefined') {
                  const errorKey = err ? (err.i18nKey || firebaseErrorToI18nKey(err)) : 'profile.cloud.err.generic'
                  window.dispatchEvent(
                    new CustomEvent('ft-show-toast', {
                      detail: {
                        title: t('common.error', 'Terjadi Kesalahan'),
                        message: t(errorKey),
                        type: 'danger',
                      },
                    })
                  )
                }
              })
            }
          }
        }
      }

      // Safely clear financial and feature data tables without deleting settings configuration
      const dataTables = [
        db.transactions,
        db.investments,
        db.investmentOrders,
        db.budgets,
        db.goals,
        db.goalLogs,
        db.calendarEvents,
        db.recurringTransactions,
        db.todos,
        db.sub_tasks,
        db.habits,
        db.habitLogs,
        db.ideas,
        db.board_links,
        db.notifications,
        db.wallets,
        db.loans,
        db.loanPayments,
        db.walletBalanceCache,
      ]
      await Promise.all(dataTables.map((tbl) => tbl?.clear?.().catch(() => {})))
      clearFinancialLocalStorage()
    } catch {
      /* ignore */
    } finally {
      await signOutCurrentUser().catch(() => {})
      try {
        localStorage.removeItem('ft_onboarding_seen_v1')
        localStorage.removeItem('ft_onboarding_progress')
      } catch {
        /* ignore */
      }
      await resetOnboarding().catch(() => {})
      await setAuthUser({
        uid: '',
        email: '',
        displayName: '',
        photoURL: '',
        provider: 'guest',
        emailVerified: false,
      }).catch(() => {})
      navigate('/dashboard', { replace: true })
    }
  }

  const handleSwitchAccount = () => {
    if (authProvider === 'guest' || authProvider === 'anonymous' || (!authUserEmail && !authUserId)) {
      setIsGuestWarningOpen(true)
    } else {
      setIsLogoutConfirmOpen(true)
    }
  }

  const handleToggleTheme = () => {
    executeThemeTransition({
      currentTheme: theme,
      setTheme,
      originX: typeof window !== 'undefined' ? window.innerWidth : 400,
      originY: 0,
    })
  }

  const handleToggleLocale = () => {
    setLocale(locale === 'id' ? 'en' : 'id')
  }

  const handleCycleMotion = () => {
    const cycle = { system: 'full', full: 'reduce', reduce: 'system' }
    setMotionPreference(cycle[motionPreference] || 'system')
  }

  const motionDisplay = useMemo(() => {
    if (motionPreference === 'system') return t('settings.motion.system', 'Sistem (OS)')
    if (motionPreference === 'reduce') return t('settings.motion.reduce', 'Hemat Gerak')
    return t('settings.motion.full', 'Penuh (Full)')
  }, [motionPreference, t])

  const currentCurrencyInfo = useMemo(() => {
    return currencyDisplayMap[defaultCurrency] || { name: defaultCurrency, symbol: defaultCurrency, code: defaultCurrency }
  }, [defaultCurrency])

  return (
    <div className="ft-settings-page max-w-2xl mx-auto pb-36 px-0">
      <PageHeader
        title={t('settings.title', 'Pengaturan')}
        subtitle={t('settings.subtitle', 'Sesuaikan bahasa, tampilan, keamanan, dan cadangan data.')}
      />

      {/* 1. Profile / App Info Hero Card (Elevated Bento Header) */}
      <div className="mb-4 rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-card">
        {/* Profile trigger row */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('/profile')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              navigate('/profile')
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
                    authProvider === 'guest' || authProvider === 'anonymous' || !authUserEmail ? 'bg-amber-500' : 'bg-emerald-500'
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
              {locale === 'id' ? 'Indonesia' : 'English'}
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-1.5 px-1.5 sm:px-2">
            <span className="block text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {t('settings.protection', 'Proteksi')}
            </span>
            <span className={`block text-[11.5px] sm:text-xs font-black truncate mt-0.5 ${
              securityEnabled ? 'text-emerald-500' : 'text-[var(--muted)]'
            }`}>
              {securityEnabled ? t('settings.active', 'Aktif') : t('settings.inactive', 'Nonaktif')}
            </span>
          </div>
        </div>
      </div>

      {/* 1.5 Guest / Anonymous Mode Warning & Link Account Banner */}
      {(authProvider === 'guest' || authProvider === 'anonymous' || !authUserEmail) && (
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
            onClick={() => {
              setIsConnectModalOpen(true)
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <CheckCircle2 size={14} />
            <span>{t('settings.connectAccountNow', 'Hubungkan / Tautkan Akun')}</span>
          </button>
        </div>
      )}

      {/* 1.6 Unverified Email Banner (Persis di posisi kartu status profil / tamu) */}
      {authProvider === 'email' && (!emailVerified || verifPhase !== 'idle') && authUserEmail && (
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
      )}

      {/* 2. Quick Preference Bento Grid */}
      <div className="mb-2 px-1">
        <h2 className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
          {t('settings.quickPrefs', 'Preferensi Cepat')}
        </h2>
      </div>

      <div className="ft-settings-bento-grid">
        {/* Tile 1: 3-Theme Visual Toggle */}
        <SettingsBentoTile
          label={t('settings.visualTheme', 'Tema Visual')}
          value={
            theme === 'midnight'
              ? t('settings.themeMidnight', 'Midnight Sapphire')
              : theme === 'dark'
              ? t('settings.themeDark', 'Matte Dark')
              : t('settings.themeLight', 'Pure Light')
          }
          icon={theme === 'midnight' ? Sparkles : theme === 'dark' ? Moon : Sun}
          onClick={handleToggleTheme}
        />

        {/* Tile 2: Currency Selector Modal Trigger */}
        <SettingsBentoTile
          label={t('settings.mainCurrency', 'Mata Uang Utama')}
          value={`${currentCurrencyInfo.symbol} • ${currentCurrencyInfo.code}`}
          icon={Coins}
          onClick={() => setIsCurrencyModalOpen(true)}
        />

        {/* Tile 3: Language Switcher */}
        <SettingsBentoTile
          label={t('settings.systemLanguage', 'Bahasa Sistem')}
          value={locale === 'id' ? 'ID • Indonesia' : 'EN • English'}
          icon={Globe}
          onClick={handleToggleLocale}
        />

        {/* Tile 4: Motion Animation Preference */}
        <SettingsBentoTile
          label={t('settings.animationEffects', 'Efek Animasi')}
          value={motionDisplay}
          icon={Activity}
          onClick={handleCycleMotion}
        />
      </div>

      {/* 3. Directory Group 1: Fitur & Keuangan */}
      <SettingsSection label={t('settings.section.features', 'Fitur & Keuangan')}>
        <SettingsLinkRow
          to="/settings/categories"
          label={t('settings.categories', 'Kategori Transaksi')}
          icon={Tag}
        />
        <SettingsLinkRow
          to="/settings/recurring"
          label={t('settings.recurringTitle', 'Transaksi Berulang')}
          icon={RefreshCw}
        />
        <SettingsLinkRow
          to="/settings/currency"
          label={t('settings.fxRatesTitle', 'Kurs & Konversi Mata Uang')}
          icon={TrendingUp}
        />
        <SettingsLinkRow
          label={t('settings.budgetCycleTitle', 'Siklus Anggaran Bulanan')}
          subtitle={
            budgetCycleStartDay > 1
              ? `${t('settings.paydayPrefix', 'Siklus Gajian')}: ${t('common.day', 'Tgl')} ${budgetCycleStartDay}`
              : t('settings.standardMonthPrefix', 'Standar Kalender: Tgl 1')
          }
          icon={Calendar}
          onClick={() => setIsBudgetCycleModalOpen(true)}
        />
      </SettingsSection>

      {/* 4. Directory Group 2: Keamanan, Notifikasi & AI */}
      <SettingsSection label={t('settings.section.security', 'Keamanan, Notifikasi & AI')}>
        <SettingsLinkRow
          to="/settings/notifications"
          label={t('settings.notifications.title', 'Notifikasi & Pengingat Cerdas')}
          icon={Bell}
        />
        <SettingsLinkRow
          to="/settings/security"
          label={t('settings.appLock', 'Keamanan & Kunci Aplikasi')}
          icon={securityEnabled ? ShieldCheck : Lock}
        />
        <SettingsLinkRow
          to="/settings/ai"
          label={t('settings.aiIntegration', 'Integrasi Asisten AI (Gemini)')}
          icon={Bot}
        />
        <SettingsLinkRow
          to="/settings/data"
          label={t('settings.nav.data', 'Data & Cadangan')}
          icon={Database}
        />
      </SettingsSection>

      {/* 5. Directory Group 3: Pusat Bantuan & Sesi Akun */}
      <SettingsSection label={t('settings.section.support', 'Bantuan & Dukungan')}>
        <SettingsLinkRow
          to="/settings/help"
          label={t('settings.helpTitle', 'Tur & Panduan Fitur')}
          icon={Compass}
        />
        <SettingsLinkRow
          label={t('auth.switchAccount', 'Ganti Akun / Logout')}
          subtitle={
            authProvider === 'google'
              ? `Google • ${authUserEmail || 'Connected'}`
              : authProvider === 'email'
              ? `Email • ${authUserEmail || 'Registered'}${emailVerified ? ' (Terverifikasi)' : ''}`
              : authProvider === 'anonymous'
              ? 'Akun Anonim (Tamu)'
              : 'Mode Tamu'
          }
          icon={LogOut}
          iconColor="text-amber-500 bg-amber-500/10 border-amber-500/20"
          onClick={handleSwitchAccount}
        />
      </SettingsSection>

      {/* Modal Quick Currency Selector */}
      <Modal
        isOpen={isCurrencyModalOpen}
        title={t('settings.selectDefaultCurrency', 'Pilih Mata Uang Utama')}
        onClose={() => setIsCurrencyModalOpen(false)}
      >
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {currencyOptions.map((code) => {
            const info = currencyDisplayMap[code] || { name: code, symbol: code, code }
            const isSelected = defaultCurrency === code

            return (
              <button
                key={code}
                type="button"
                onClick={() => {
                  setDefaultCurrency(code)
                  setIsCurrencyModalOpen(false)
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                  isSelected
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/20'
                    : 'border-[var(--border)] bg-[var(--panel-strong)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <CurrencyFlag code={code} size={38} className="shadow-2xs" />
                  <div className="min-w-0">
                    <span className="block text-sm font-extrabold text-[var(--fg)] leading-tight">
                      {info.name}
                    </span>
                    <span className="block text-xs font-bold text-[var(--muted)] leading-tight mt-0.5">
                      {info.code} • {info.symbol}
                    </span>
                  </div>
                </div>

                {isSelected ? (
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-[var(--bg)]">
                    <Check className="h-4 w-4 stroke-[3]" />
                  </div>
                ) : null}
              </button>
            )
          })}
        </div>
      </Modal>

      {/* Modal Budget Cycle Selector */}
      <BudgetCycleModal
        isOpen={isBudgetCycleModalOpen}
        onClose={() => setIsBudgetCycleModalOpen(false)}
      />

      {/* Modal Guest Warning when Logging Out */}
      <Modal
        isOpen={isGuestWarningOpen}
        title={t('settings.guestWarningTitle', 'Peringatan Mode Tamu')}
        onClose={() => setIsGuestWarningOpen(false)}
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={20} strokeWidth={2.5} />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <h5 className="font-bold text-xs text-[var(--fg)]">
                {t('settings.guestWarningSubtitle', 'Data Transaksi Belum Terhubung ke Cloud')}
              </h5>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {t(
                  'settings.guestWarningDesc',
                  'Anda saat ini menggunakan Mode Tamu. Jika Anda keluar tanpa menghubungkan akun Google, data transaksi Anda di perangkat ini tidak akan tersinkronisasi ke cloud. Ayo hubungkan akun sekarang agar data Anda aman!'
                )}
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {/* Primary Action: Link Account Now */}
            <button
              type="button"
              onClick={() => {
                setIsGuestWarningOpen(false)
                setIsConnectModalOpen(true)
              }}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[var(--accent)] text-white font-bold text-xs sm:text-sm hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <ShieldCheck size={16} />
              <span>{t('settings.connectAccountNow', 'Hubungkan Akun Sekarang')}</span>
            </button>

            {/* Secondary Action: Log out anyway */}
            <button
              type="button"
              onClick={() => {
                setIsGuestWarningOpen(false)
                executePerformLogout()
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-[var(--status-expense)]/30 bg-[var(--status-expense)]/10 text-[var(--status-expense)] font-bold text-xs hover:bg-[var(--status-expense)]/20 transition-all cursor-pointer active:scale-[0.98]"
            >
              <LogOut size={15} />
              <span>{t('settings.proceedLogoutAnyway', 'Tetap Keluar & Ganti Akun')}</span>
            </button>

            {/* Cancel */}
            <button
              type="button"
              onClick={() => setIsGuestWarningOpen(false)}
              className="w-full py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer text-center"
            >
              {t('common.cancel', 'Batal')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Logout Confirmation for Logged-In accounts */}
      <Modal
        isOpen={isLogoutConfirmOpen}
        title={t('settings.logoutConfirmTitle', 'Konfirmasi Keluar Akun')}
        onClose={() => setIsLogoutConfirmOpen(false)}
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Database size={18} strokeWidth={2.5} />
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed min-w-0 flex-1">
              {t(
                'settings.logoutConfirmDesc',
                'Data transaksi Anda telah dicadangkan secara aman. Anda dapat masuk kembali dengan akun Google/Email ini kapan saja.'
              )}
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsLogoutConfirmOpen(false)
                executePerformLogout()
              }}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[var(--status-expense)] text-white font-bold text-xs sm:text-sm hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <LogOut size={15} />
              <span>{t('settings.proceedLogoutAnyway', 'Keluar & Ganti Akun')}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsLogoutConfirmOpen(false)}
              className="w-full py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer text-center"
            >
              {t('common.cancel', 'Batal')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Connect Account / Switch Account (Google / Email / Register) */}
      <AuthModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onSuccess={() => setIsConnectModalOpen(false)}
      />
    </div>
  )
}
