import { useState, useMemo } from 'react'
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
} from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { signOutCurrentUser } from '../../lib/auth'
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

  const handleSwitchAccount = async () => {
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
      await resetOnboarding()
      await setAuthUser({
        uid: '',
        email: '',
        displayName: '',
        photoURL: '',
        provider: 'guest',
      })
      navigate('/', { replace: true })
    } catch {
      await signOutCurrentUser()
      await resetOnboarding()
      navigate('/', { replace: true })
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
    <div className="ft-settings-page max-w-2xl mx-auto pb-24 px-0">
      <PageHeader
        title={t('settings.title', 'Pengaturan')}
        subtitle={t('settings.subtitle', 'Sesuaikan bahasa, tampilan, keamanan, dan cadangan data.')}
      />

      {/* 1. Profile / App Info Hero Card (Elevated Bento Header) */}
      <div className="mb-6 rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-card">
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
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 inline-block" />
                {authProvider === 'google'
                  ? `Google • ${authUserEmail || 'Connected'}`
                  : authProvider === 'email'
                  ? `Email • ${authUserEmail || 'Registered'}`
                  : 'Offline-First Storage'}
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

      {/* 2. Quick Preference Bento Grid */}
      <div className="mb-2 px-1">
        <h2 className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
          {t('settings.quickPrefs', 'Preferensi Cepat')}
        </h2>
      </div>

      <div className="ft-settings-bento-grid">
        {/* Tile 1: 3-Theme Visual Toggle (Putih -> Arang -> Biru) */}
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
              : 'Mode Tamu Offline'
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
    </div>
  )
}
