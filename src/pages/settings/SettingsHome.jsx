import { useState, useMemo, useEffect } from 'react'
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
  TrendingUp,
  LogOut,
  Bell,
  Calendar,
} from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import PageHeader from '../../components/ui/PageHeader'
import BudgetCycleModal from '../../components/budget/BudgetCycleModal'
import { currencyDisplayMap } from './settingsConstants'
import {
  SettingsBentoTile,
  SettingsLinkRow,
  SettingsSection,
} from './settingsComponents'
import { executeThemeTransition } from '../../lib/themeTransition'
import SettingsEmailVerificationBanner from './sections/SettingsEmailVerificationBanner'
import SettingsAccountCard from './sections/SettingsAccountCard'
import SettingsActionModals from './sections/SettingsActionModals'
import SettingsCurrencyModal from './sections/SettingsCurrencyModal'

export default function SettingsHome() {
  const { t } = useTranslation()

  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const locale = useSettingsStore((state) => state.locale)
  const theme = useSettingsStore((state) => state.theme)
  const motionPreference = useSettingsStore((state) => state.motionPreference)
  const securityEnabled = useSettingsStore((state) => state.securityEnabled)
  const authProvider = useSettingsStore((state) => state.authProvider)
  const authUserEmail = useSettingsStore((state) => state.authUserEmail)
  const authUserId = useSettingsStore((state) => state.authUserId)
  const emailVerified = useSettingsStore((state) => state.emailVerified)

  const setLocale = useSettingsStore((state) => state.setLocale)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const setMotionPreference = useSettingsStore((state) => state.setMotionPreference)
  const budgetCycleStartDay = useSettingsStore((state) => state.budgetCycleStartDay || 1)

  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false)
  const [isBudgetCycleModalOpen, setIsBudgetCycleModalOpen] = useState(false)
  const [isGuestWarningOpen, setIsGuestWarningOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)

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

      {/* 1. Profile / App Info Hero Card & Guest Warning */}
      <SettingsAccountCard
        onConnectAccount={() => setIsConnectModalOpen(true)}
      />

      {/* 1.6 Unverified Email Banner */}
      <SettingsEmailVerificationBanner />

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
              ? `Email • ${authUserEmail || 'Registered'}${emailVerified ? ` (${t('auth.verified', 'Terverifikasi')})` : ''}`
              : authProvider === 'anonymous'
              ? t('settings.anonymousAccount', 'Akun Anonim (Tamu)')
              : t('settings.guestMode', 'Mode Tamu')
          }
          icon={LogOut}
          iconColor="text-amber-500 bg-amber-500/10 border-amber-500/20"
          onClick={handleSwitchAccount}
        />
      </SettingsSection>

      {/* Modal Quick Currency Selector */}
      <SettingsCurrencyModal
        isOpen={isCurrencyModalOpen}
        onClose={() => setIsCurrencyModalOpen(false)}
      />

      {/* Modal Budget Cycle Selector */}
      <BudgetCycleModal
        isOpen={isBudgetCycleModalOpen}
        onClose={() => setIsBudgetCycleModalOpen(false)}
      />

      {/* Action Modals: Guest Warning, Logout Confirm & Auth Modal */}
      <SettingsActionModals
        isGuestWarningOpen={isGuestWarningOpen}
        onCloseGuestWarning={() => setIsGuestWarningOpen(false)}
        isLogoutConfirmOpen={isLogoutConfirmOpen}
        onCloseLogoutConfirm={() => setIsLogoutConfirmOpen(false)}
        isConnectModalOpen={isConnectModalOpen}
        onCloseConnectModal={() => setIsConnectModalOpen(false)}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
      />
    </div>
  )
}
