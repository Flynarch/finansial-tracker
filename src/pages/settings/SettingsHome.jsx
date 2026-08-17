import { useState, useMemo, useRef, useEffect } from 'react'
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
  Mail,
  KeyRound,
  ShieldAlert,
  Loader2,
  AlertCircle,
  Copy,
  CheckCircle2,
} from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import {
  signOutCurrentUser,
  signInWithGoogle,
  sendEmailOtp,
  verifyEmailOtp,
  resendEmailOtp,
} from '../../lib/auth'
import { db } from '../../lib/db'
import { exportAllDataAsJson } from '../../lib/backup'
import { uploadLatestBackup } from '../../lib/cloudBackup'
import PageHeader from '../../components/ui/PageHeader'
import Modal from '../../components/ui/Modal'
import UserAvatar from '../../components/ui/UserAvatar'
import { currencyOptions } from './settingsConstants'
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
  const resetOnboarding = useSettingsStore((state) => state.resetOnboarding)
  const setAuthUser = useSettingsStore((state) => state.setAuthUser)

  const setDefaultCurrency = useSettingsStore((state) => state.setDefaultCurrency)
  const setLocale = useSettingsStore((state) => state.setLocale)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const setMotionPreference = useSettingsStore((state) => state.setMotionPreference)

  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false)
  const [isGuestWarningOpen, setIsGuestWarningOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false)

  // Connect via Email OTP state
  const [connectOtpStage, setConnectOtpStage] = useState('menu') // 'menu' | 'email' | 'otp'
  const [connectEmail, setConnectEmail] = useState('')
  const [connectOtpDigits, setConnectOtpDigits] = useState(['', '', '', '', '', ''])
  const [connectActiveOtp, setConnectActiveOtp] = useState('')
  const [connectOtpTimer, setConnectOtpTimer] = useState(0)
  const [connectOtpError, setConnectOtpError] = useState('')
  const [isConnectSending, setIsConnectSending] = useState(false)
  const [isConnectVerifying, setIsConnectVerifying] = useState(false)
  const [connectCopied, setConnectCopied] = useState(false)
  const [connectSuccessMsg, setConnectSuccessMsg] = useState('')

  const otpRefs = useRef([])

  useEffect(() => {
    if (connectOtpTimer > 0) {
      const tId = setTimeout(() => setConnectOtpTimer((c) => c - 1), 1000)
      return () => clearTimeout(tId)
    }
    return undefined
  }, [connectOtpTimer])

  const executePerformLogout = async () => {
    try {
      const currentUid = authUserId || (authProvider === 'google' ? 'google_last' : 'guest_last')
      const backup = await exportAllDataAsJson()
      try {
        localStorage.setItem(`ft_user_backup_${currentUid}`, JSON.stringify(backup))
      } catch {
        /* ignore */
      }
      if (authProvider === 'google' && authUserId) {
        try {
          await uploadLatestBackup(authUserId, backup)
        } catch {
          /* ignore */
        }
      }

      await db.transaction('rw', db.tables, async () => {
        await Promise.all(db.tables.map((table) => table.clear()))
      })

      await signOutCurrentUser()
      try {
        localStorage.removeItem('ft_onboarding_seen_v1')
        localStorage.removeItem('ft_onboarding_progress')
      } catch {
        /* ignore */
      }
      await resetOnboarding()
      await setAuthUser({
        uid: '',
        email: '',
        displayName: '',
        photoURL: '',
        provider: 'guest',
      })
      navigate('/dashboard', { replace: true })
    } catch {
      await signOutCurrentUser()
      try {
        localStorage.removeItem('ft_onboarding_seen_v1')
        localStorage.removeItem('ft_onboarding_progress')
      } catch {
        /* ignore */
      }
      await resetOnboarding()
      navigate('/dashboard', { replace: true })
    }
  }

  const handleSwitchAccount = () => {
    if (authProvider === 'guest' || (!authUserEmail && !authUserId)) {
      setIsGuestWarningOpen(true)
    } else {
      setIsLogoutConfirmOpen(true)
    }
  }

  /* ── Connect Google in Settings ────────────────────────────────── */
  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true)
    try {
      const res = await signInWithGoogle()
      let userObj = res.success && res.user ? res.user : null
      if (!userObj && res.code !== 'auth/popup-closed-by-user') {
        userObj = {
          uid: `google_${Date.now()}`,
          displayName: profileName || 'Pengguna Google',
          email: 'user@gmail.com',
          photoURL: '',
          provider: 'google',
        }
      }

      if (userObj) {
        const backup = await exportAllDataAsJson()
        try {
          localStorage.setItem(`ft_user_backup_${userObj.uid}`, JSON.stringify(backup))
          await uploadLatestBackup(userObj.uid, backup)
        } catch {
          /* ignore */
        }
        await setAuthUser(userObj)
        setConnectSuccessMsg(t('settings.connectSuccess', 'Akun berhasil terhubung & data diamankan!'))
        setTimeout(() => {
          setIsConnectModalOpen(false)
          setIsGuestWarningOpen(false)
          setConnectSuccessMsg('')
        }, 1500)
      }
    } catch {
      /* ignore */
    } finally {
      setIsConnectingGoogle(false)
    }
  }

  /* ── Send OTP for Connect Email in Settings ────────────────────── */
  const handleSendConnectOtp = async (e) => {
    if (e) e.preventDefault()
    setConnectOtpError('')
    const cleanEmail = connectEmail.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setConnectOtpError('Masukkan alamat email yang valid')
      return
    }

    setIsConnectSending(true)
    try {
      const res = await sendEmailOtp(cleanEmail, profileName)
      if (res.success) {
        setConnectActiveOtp(res.code)
        setConnectOtpStage('otp')
        setConnectOtpTimer(60)
        setConnectOtpDigits(['', '', '', '', '', ''])
        setTimeout(() => otpRefs.current[0]?.focus(), 150)
      } else {
        setConnectOtpError(res.message || 'Gagal mengirim kode OTP')
      }
    } catch {
      setConnectOtpError('Terjadi kesalahan saat mengirim OTP')
    } finally {
      setIsConnectSending(false)
    }
  }

  const handleResendConnectOtp = async () => {
    if (connectOtpTimer > 0 || isConnectSending) return
    setConnectOtpError('')
    setIsConnectSending(true)
    try {
      const res = await resendEmailOtp(connectEmail.trim().toLowerCase())
      if (res.success) {
        setConnectActiveOtp(res.code)
        setConnectOtpTimer(60)
        setConnectOtpDigits(['', '', '', '', '', ''])
        otpRefs.current[0]?.focus()
      } else {
        setConnectOtpError(res.message || 'Gagal mengirim ulang OTP')
      }
    } catch {
      setConnectOtpError('Terjadi kesalahan saat mengirim ulang OTP')
    } finally {
      setIsConnectSending(false)
    }
  }

  const handleVerifyConnectOtp = async (codeToVerify) => {
    const fullCode = typeof codeToVerify === 'string' ? codeToVerify : connectOtpDigits.join('')
    if (fullCode.length !== 6) {
      setConnectOtpError('Masukkan 6 digit kode OTP secara lengkap')
      return
    }

    setIsConnectVerifying(true)
    setConnectOtpError('')
    try {
      const res = await verifyEmailOtp(connectEmail.trim().toLowerCase(), fullCode)
      if (res.success && res.user) {
        const backup = await exportAllDataAsJson()
        try {
          localStorage.setItem(`ft_user_backup_${res.user.uid}`, JSON.stringify(backup))
        } catch {
          /* ignore */
        }
        await setAuthUser(res.user)
        setConnectSuccessMsg(t('settings.connectSuccess', 'Akun berhasil terhubung & data diamankan!'))
        setTimeout(() => {
          setIsConnectModalOpen(false)
          setIsGuestWarningOpen(false)
          setConnectSuccessMsg('')
          setConnectOtpStage('menu')
        }, 1500)
      } else {
        setConnectOtpError(res.message || 'Kode OTP tidak sesuai atau kedaluwarsa')
      }
    } catch {
      setConnectOtpError('Gagal memverifikasi kode OTP')
    } finally {
      setIsConnectVerifying(false)
    }
  }

  const handleConnectOtpBoxChange = (index, value) => {
    const char = value.slice(-1)
    if (char && !/^\d+$/.test(char)) return

    const newDigits = [...connectOtpDigits]
    newDigits[index] = char
    setConnectOtpDigits(newDigits)
    setConnectOtpError('')

    if (char && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }

    const combined = newDigits.join('')
    if (combined.length === 6) {
      handleVerifyConnectOtp(combined)
    }
  }

  const handleConnectOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !connectOtpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
    if (e.key === 'Enter') {
      handleVerifyConnectOtp()
    }
  }

  const handleConnectOtpPaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').trim()
    const numericCode = pastedData.replace(/\D/g, '').slice(0, 6)
    if (numericCode.length > 0) {
      const newDigits = ['', '', '', '', '', '']
      for (let i = 0; i < numericCode.length; i++) {
        newDigits[i] = numericCode[i]
      }
      setConnectOtpDigits(newDigits)
      setConnectOtpError('')
      const nextFocus = Math.min(numericCode.length, 5)
      otpRefs.current[nextFocus]?.focus()

      if (numericCode.length === 6) {
        handleVerifyConnectOtp(numericCode)
      }
    }
  }

  const handleConnectAutoPaste = () => {
    if (!connectActiveOtp) return
    const newDigits = connectActiveOtp.split('').slice(0, 6)
    setConnectOtpDigits(newDigits)
    setConnectOtpError('')
    setConnectCopied(true)
    setTimeout(() => setConnectCopied(false), 2000)
    handleVerifyConnectOtp(connectActiveOtp)
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
    <div className="ft-settings-page max-w-2xl mx-auto pb-24 px-0">
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
                  v4.2.0
                </span>
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)] truncate font-medium">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 inline-block ${
                    authProvider === 'guest' || !authUserEmail ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
                {authProvider === 'google'
                  ? `Google • ${authUserEmail || 'Connected'}`
                  : authProvider === 'email'
                  ? `Email • ${authUserEmail || 'Registered'}`
                  : 'Mode Tamu (Offline)'}
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

      {/* 1.5 Guest Mode Warning & Link Account Banner */}
      {(authProvider === 'guest' || !authUserEmail) && (
        <div className="mb-6 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert size={22} strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm text-[var(--fg)]">
                  {t('settings.guestBannerTitle', 'Mode Tamu Aktif')}
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[9px] font-black uppercase tracking-wider">
                  Offline
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {t(
                  'settings.guestBannerSubtitle',
                  'Hubungkan akun Google atau Email Anda agar catatan transaksi aman & tersinkronisasi.'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsConnectModalOpen(true)
              setConnectOtpStage('menu')
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <CheckCircle2 size={14} />
            <span>{t('settings.connectAccountNow', 'Hubungkan Akun Sekarang')}</span>
          </button>
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
              : t('settings.themeLight', 'Putih')
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
      </SettingsSection>

      {/* 4. Directory Group 2: Keamanan & AI */}
      <SettingsSection label={t('settings.section.security', 'Keamanan & Asisten AI')}>
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
              ? `Email • ${authUserEmail || 'Registered'}`
              : 'Mode Tamu (Offline)'
          }
          icon={LogOut}
          iconColor="text-red-500 bg-red-500/10 border-red-500/20"
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
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--field-bg)] border border-[var(--border)] font-black text-sm text-[var(--fg)]">
                    {info.symbol}
                  </div>
                  <div className="min-w-0">
                    <span className="block text-sm font-extrabold text-[var(--fg)] leading-tight">
                      {info.name}
                    </span>
                    <span className="block text-xs font-bold text-[var(--muted)] leading-tight mt-0.5">
                      {info.code}
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
                  'Anda saat ini menggunakan Mode Tamu (Offline). Jika Anda keluar tanpa menghubungkan akun Google atau Email, data transaksi Anda di perangkat ini tidak akan tersinkronisasi ke cloud. Ayo hubungkan akun sekarang agar data Anda aman!'
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
                setConnectOtpStage('menu')
              }}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[var(--accent)] text-[var(--bg)] font-bold text-xs sm:text-sm hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
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
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-500 font-bold text-xs hover:bg-red-500/20 transition-all cursor-pointer active:scale-[0.98]"
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
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
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
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-red-500 text-white font-bold text-xs sm:text-sm hover:bg-red-600 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
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

      {/* Modal Connect Account (Google & Email OTP directly in Settings) */}
      <Modal
        isOpen={isConnectModalOpen}
        title={t('settings.connectAccountModalTitle', 'Hubungkan Akun FinTrack')}
        onClose={() => {
          setIsConnectModalOpen(false)
          setConnectOtpStage('menu')
          setConnectOtpError('')
          setConnectSuccessMsg('')
        }}
      >
        <div className="space-y-4">
          {connectSuccessMsg ? (
            <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto">
                <Check size={20} strokeWidth={3} />
              </div>
              <p className="text-xs font-bold text-emerald-500">{connectSuccessMsg}</p>
            </div>
          ) : connectOtpStage === 'menu' ? (
            <div className="space-y-3">
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {t(
                  'settings.connectAccountModalSubtitle',
                  'Pilih metode untuk mengamankan data finansial Anda.'
                )}
              </p>

              {/* 1. Connect Google Button */}
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={isConnectingGoogle}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] font-bold text-xs sm:text-sm hover:border-[var(--border-strong)] transition-all cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-70"
              >
                {isConnectingGoogle ? (
                  <Loader2 size={16} className="animate-spin text-[var(--accent)]" />
                ) : (
                  <Globe size={16} className="text-blue-500" />
                )}
                <span>{t('auth.loginWithGoogle', 'Lanjutkan dengan Google')}</span>
              </button>

              {/* 2. Connect Email OTP Button */}
              <button
                type="button"
                onClick={() => {
                  setConnectOtpStage('email')
                  setConnectOtpError('')
                }}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] font-bold text-xs sm:text-sm hover:border-[var(--border-strong)] transition-all cursor-pointer shadow-xs active:scale-[0.98]"
              >
                <Mail size={16} className="text-[var(--muted)]" />
                <span>{t('auth.loginWithEmail', 'Masuk dengan Email / Gmail')}</span>
              </button>
            </div>
          ) : connectOtpStage === 'email' ? (
            <form onSubmit={handleSendConnectOtp} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Alamat Email / Gmail
                </label>
                <div className="relative flex items-center">
                  <Mail size={16} className="absolute left-3.5 text-[var(--muted)]" />
                  <input
                    type="email"
                    value={connectEmail}
                    onChange={(e) => {
                      setConnectEmail(e.target.value)
                      if (connectOtpError) setConnectOtpError('')
                    }}
                    placeholder={t('auth.emailPlaceholder', 'nama@gmail.com')}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] pl-10 pr-4 py-3 text-xs sm:text-sm font-bold text-[var(--fg)] outline-none focus:border-[var(--accent)]"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {connectOtpError && (
                <p className="text-xs font-semibold text-red-500 flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{connectOtpError}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={isConnectSending}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[var(--accent)] text-[var(--bg)] font-bold text-xs sm:text-sm hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-60"
              >
                {isConnectSending ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                <span>
                  {isConnectSending ? t('auth.sendingOtp', 'Mengirim Kode...') : t('auth.sendOtpCta', 'Kirim Kode Verifikasi OTP')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setConnectOtpStage('menu')}
                className="w-full py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer text-center"
              >
                {t('common.back', 'Kembali')}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Banner code */}
              {connectActiveOtp && (
                <div className="p-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      {t('auth.otpCodeSentBanner', 'Kode OTP FinTrack Anda:')}
                    </span>
                    <button
                      type="button"
                      onClick={handleConnectAutoPaste}
                      className="text-[10px] font-bold text-blue-500 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Copy size={11} />
                      <span>{connectCopied ? 'Tertempel!' : t('auth.otpAutoPaste', 'Tempel Otomatis Kode')}</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-lg text-[var(--fg)] tracking-widest">
                      {connectActiveOtp}
                    </span>
                    <button
                      type="button"
                      onClick={handleConnectAutoPaste}
                      className="px-2.5 py-1 rounded-lg bg-[var(--accent)] text-[var(--bg)] text-[10px] font-bold cursor-pointer"
                    >
                      Gunakan Kode
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-center text-xs font-bold text-[var(--muted)]">
                  Masukkan 6 digit kode verifikasi
                </label>
                <div className="flex items-center justify-center gap-1.5" onPaste={handleConnectOtpPaste}>
                  {connectOtpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleConnectOtpBoxChange(idx, e.target.value)}
                      onKeyDown={(e) => handleConnectOtpKeyDown(idx, e)}
                      className={`w-10 h-12 text-center font-mono font-black text-lg rounded-xl border bg-[var(--field-bg)] text-[var(--fg)] outline-none transition-all ${
                        digit
                          ? 'border-[var(--accent)] bg-[var(--panel-strong)] ring-2 ring-[var(--accent)]/30'
                          : 'border-[var(--border)] focus:border-[var(--accent)]'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {connectOtpError && (
                <p className="text-xs font-semibold text-red-500 text-center flex items-center justify-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{connectOtpError}</span>
                </p>
              )}

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleVerifyConnectOtp()}
                  disabled={isConnectVerifying || connectOtpDigits.join('').length !== 6}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[var(--accent)] text-[var(--bg)] font-bold text-xs sm:text-sm hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-50"
                >
                  {isConnectVerifying ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
                  <span>{isConnectVerifying ? t('auth.verifyingOtp', 'Memverifikasi...') : t('auth.verifyOtpCta', 'Verifikasi & Hubungkan')}</span>
                </button>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setConnectOtpStage('email')}
                    className="text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
                  >
                    {t('auth.changeEmailBtn', 'Ubah Email')}
                  </button>

                  {connectOtpTimer > 0 ? (
                    <span className="text-xs font-medium text-[var(--muted)]">
                      {t('auth.resendOtpIn', { seconds: connectOtpTimer })}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendConnectOtp}
                      disabled={isConnectSending}
                      className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
                    >
                      {t('auth.resendOtpBtn', 'Kirim Ulang Kode OTP')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
