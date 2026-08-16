import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  Sun,
  Moon,
  Globe,
  Coins,
  Activity,
  Bot,
  Tag,
  RefreshCw,
  ShieldCheck,
  Database,
  Compass,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import PageHeader from '../../components/ui/PageHeader'
import { currencyOptions } from './settingsConstants'
import {
  SettingsLinkRow,
  SettingsSection,
  SettingsSegmentControl,
  SettingsSplitRow,
} from './settingsComponents'

const currencyDisplayMap = {
  IDR: 'Rp • IDR (Rupiah)',
  USD: '$ • USD (US Dollar)',
  EUR: '€ • EUR (Euro)',
  SGD: 'S$ • SGD (Singapore Dollar)',
  MYR: 'RM • MYR (Ringgit)',
  JPY: '¥ • JPY (Japanese Yen)',
  GBP: '£ • GBP (British Pound)',
}

export default function SettingsHome() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const locale = useSettingsStore((state) => state.locale)
  const theme = useSettingsStore((state) => state.theme)
  const motionPreference = useSettingsStore((state) => state.motionPreference)
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const geminiApiKey = useSettingsStore((state) => state.geminiApiKey)
  const securityEnabled = useSettingsStore((state) => state.securityEnabled)
  const securityMethod = useSettingsStore((state) => state.securityMethod)
  const profileName = useSettingsStore((state) => state.profileName)

  const setDefaultCurrency = useSettingsStore((state) => state.setDefaultCurrency)
  const setLocale = useSettingsStore((state) => state.setLocale)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const setMotionPreference = useSettingsStore((state) => state.setMotionPreference)
  const setGeminiApiKey = useSettingsStore((state) => state.setGeminiApiKey)

  const [apiKeyInput, setApiKeyInput] = useState(geminiApiKey || '')
  const [showKey, setShowKey] = useState(false)
  const [keyStatusMessage, setKeyStatusMessage] = useState('')
  const [prevGeminiApiKey, setPrevGeminiApiKey] = useState(geminiApiKey)

  if (prevGeminiApiKey !== geminiApiKey) {
    setPrevGeminiApiKey(geminiApiKey)
    setApiKeyInput(geminiApiKey || '')
  }

  const handleSaveApiKey = async (e) => {
    e.preventDefault()
    await setGeminiApiKey(apiKeyInput.trim())
    setKeyStatusMessage(t('settings.apiKeySaved', 'API Key Gemini berhasil disimpan!'))
    setTimeout(() => setKeyStatusMessage(''), 3000)
  }

  const handleClearApiKey = async () => {
    setApiKeyInput('')
    await setGeminiApiKey('')
    setKeyStatusMessage(t('settings.apiKeyCleared', 'API Key dikembalikan ke bawaan sistem.'))
    setTimeout(() => setKeyStatusMessage(''), 3000)
  }

  const languageOptions = useMemo(
    () => [
      { value: 'id', label: 'Indonesia' },
      { value: 'en', label: 'English' },
    ],
    [],
  )

  const themeOptions = useMemo(
    () => [
      { value: 'light', label: t('settings.theme.light', 'Terang'), icon: Sun },
      { value: 'dark', label: t('settings.theme.dark', 'Gelap'), icon: Moon },
    ],
    [t],
  )

  const motionOptions = useMemo(
    () => [
      { value: 'system', label: t('settings.motion.system', 'Sistem') },
      { value: 'full', label: t('settings.motion.full', 'Penuh') },
      { value: 'reduce', label: t('settings.motion.reduce', 'Hemat') },
    ],
    [t],
  )

  const motionSummary =
    motionPreference === 'system'
      ? t('settings.motion.current.system', {
          value: reduceMotion ? t('settings.motion.state.reduce') : t('settings.motion.state.full'),
        })
      : motionPreference === 'reduce'
        ? t('settings.motion.current.reduce')
        : t('settings.motion.current.full')

  const securityBadge = securityEnabled
    ? securityMethod === 'biometric'
      ? t('settings.lockMethod.biometric', 'Biometrik')
      : securityMethod === 'pattern'
        ? t('settings.lockMethod.pattern', 'Pola Aktif')
        : t('settings.lockMethod.pin', 'PIN Aktif')
    : t('settings.lockStatus.off', 'Nonaktif')

  const securityBadgeColor = securityEnabled
    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    : 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)]'

  return (
    <>
      <PageHeader
        title={t('nav.settings')}
        subtitle={t('settings.pageSubtitle')}
        titlePosition="left"
        onBack={() => navigate('/profile')}
        backAriaLabel={t('common.back')}
        className="ft-settings-hero"
      />

      {/* User Mini Profile Strip */}
      <div className="mb-5 flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 shadow-card backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white font-black text-sm shadow-sm">
            {(profileName || 'FinTrack').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--fg)]">
              {profileName || 'Pengguna FinTrack'}
            </p>
            <p className="text-[11px] font-medium text-[var(--muted)] flex items-center gap-1 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Offline-First (IndexedDB)</span>
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-1 text-[10px] font-extrabold text-[var(--muted)]">
          v2.0.0
        </span>
      </div>

      {/* 1. Preferensi Tampilan & Wilayah */}
      <SettingsSection
        label={t('settings.preferences')}
        footnote={t('settings.motion.current', { value: motionSummary })}
      >
        <SettingsSplitRow
          label={t('settings.language')}
          description={t('settings.languageDesc', 'Bahasa tampilan menu & antarmuka')}
          icon={Globe}
          iconColor="text-blue-500 bg-blue-500/10 border-blue-500/20"
        >
          <SettingsSegmentControl
            options={languageOptions}
            value={locale}
            onChange={(val) => setLocale(val)}
            ariaLabel={t('settings.language')}
          />
        </SettingsSplitRow>

        <SettingsSplitRow
          label={t('settings.theme')}
          description={t('settings.themeDesc', 'Mode visual terang atau gelap')}
          icon={theme === 'dark' ? Moon : Sun}
          iconColor="text-amber-500 bg-amber-500/10 border-amber-500/20"
        >
          <SettingsSegmentControl
            options={themeOptions}
            value={theme}
            onChange={(val) => setTheme(val)}
            ariaLabel={t('settings.theme')}
          />
        </SettingsSplitRow>

        <SettingsSplitRow
          label={t('settings.defaultCurrency')}
          description={t('settings.currencyDesc', 'Mata uang utama laporan & ringkasan')}
          icon={Coins}
          iconColor="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
        >
          <select
            value={defaultCurrency}
            onChange={(event) => setDefaultCurrency(event.target.value)}
            className="ft-settings-field-compact font-semibold"
            aria-label={t('settings.defaultCurrency')}
          >
            {currencyOptions.map((currency) => (
              <option key={currency} value={currency}>
                {currencyDisplayMap[currency] || currency}
              </option>
            ))}
          </select>
        </SettingsSplitRow>

        <SettingsSplitRow
          label={t('settings.motion')}
          description={t('settings.motionDesc', 'Pengaturan efek transisi animasi')}
          icon={Activity}
          iconColor="text-purple-500 bg-purple-500/10 border-purple-500/20"
        >
          <SettingsSegmentControl
            options={motionOptions}
            value={motionPreference}
            onChange={(val) => setMotionPreference(val)}
            ariaLabel={t('settings.motion')}
          />
        </SettingsSplitRow>
      </SettingsSection>

      {/* 2. Integrasi AI Gemini */}
      <SettingsSection label={t('settings.aiIntegration', 'Integrasi Asisten AI (Gemini)')}>
        <div className="ft-settings-cell space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                <Bot className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-[var(--fg)]">
                {t('settings.aiKeyStatus', 'Status API Key')}
              </span>
            </div>
            {geminiApiKey ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10.5px] font-extrabold text-emerald-500 border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" />
                <span>{t('settings.customKeyActive', 'Key Kustom Aktif')}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--field-bg)] px-2.5 py-0.5 text-[10.5px] font-semibold text-[var(--muted)] border border-[var(--border)]">
                {t('settings.defaultKey', 'Bawaan Sistem')}
              </span>
            )}
          </div>

          {keyStatusMessage ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs font-bold text-emerald-500 animate-fadeIn">
              {keyStatusMessage}
            </div>
          ) : null}

          <form onSubmit={handleSaveApiKey} className="space-y-2">
            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={t('settings.apiKeyPlaceholder', 'Masukkan Gemini API Key (opsional)...')}
                className="ft-settings-field-compact w-full pr-10 text-xs font-mono"
                aria-label={'Gemini API Key'}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 text-[var(--muted)] hover:text-[var(--fg)] transition p-1 rounded-md cursor-pointer"
                aria-label={showKey ? 'Sembunyikan Key' : 'Tampilkan Key'}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-[var(--fg)] py-2 px-3 text-xs font-bold text-[var(--bg)] transition hover:opacity-90 active:scale-95 cursor-pointer shadow-xs"
              >
                {t('settings.saveApiKey', 'Simpan Key')}
              </button>
              {geminiApiKey ? (
                <button
                  type="button"
                  onClick={handleClearApiKey}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 px-3 text-xs font-bold text-rose-500 hover:bg-rose-500/20 transition active:scale-95 cursor-pointer"
                >
                  {t('settings.resetApiKey', 'Reset')}
                </button>
              ) : null}
            </div>
          </form>

          <p className="text-[11px] leading-relaxed text-[var(--muted)] font-medium">
            {t('settings.aiKeyFree', 'Dapatkan API Key gratis di')}{' '}
            <a
              href="https://aistudio.google.com"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--accent)] underline font-bold hover:opacity-80"
            >
              Google AI Studio (aistudio.google.com)
            </a>
            . {t('settings.aiKeyStoredLocal', 'Key tersimpan lokal di perangkat ini.')}
          </p>
        </div>
      </SettingsSection>

      {/* 3. Manajemen Fitur & Data */}
      <SettingsSection label={t('settings.section.features', 'Fitur & Personalisasi')}>
        <SettingsLinkRow
          to="/settings/categories"
          label={t('settings.expenseCategories', 'Kategori Transaksi')}
          subtitle={t('settings.categoriesSubtitle', 'Kelola kategori & subkategori')}
          icon={Tag}
          iconColor="text-indigo-500 bg-indigo-500/10 border-indigo-500/20"
        />
        <SettingsLinkRow
          to="/settings/recurring"
          label={t('settings.recurringTitle', 'Transaksi Berulang')}
          subtitle={t('settings.recurringSubtitle', 'Otomasi gaji, tagihan & langganan')}
          icon={RefreshCw}
          iconColor="text-teal-500 bg-teal-500/10 border-teal-500/20"
        />
        <SettingsLinkRow
          to="/settings/security"
          label={t('settings.appLock', 'Keamanan & Kunci Aplikasi')}
          subtitle={t('settings.securitySubtitle', 'Lindungi privasi dengan PIN, Pola, atau Biometrik')}
          icon={securityEnabled ? ShieldCheck : Lock}
          iconColor="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
          badge={securityBadge}
          badgeColor={securityBadgeColor}
        />
        <SettingsLinkRow
          to="/settings/data"
          label={t('settings.nav.data', 'Data & Cadangan')}
          subtitle={t('settings.dataSubtitle', 'Ekspor JSON, Impor data, dan Uji Coba')}
          icon={Database}
          iconColor="text-amber-500 bg-amber-500/10 border-amber-500/20"
        />
        <SettingsLinkRow
          to="/settings/help"
          label={t('settings.helpTitle', 'Tur & Panduan Fitur')}
          subtitle={t('settings.helpSubtitle', 'FAQ & panduan pengenalan fitur aplikasi')}
          icon={Compass}
          iconColor="text-sky-500 bg-sky-500/10 border-sky-500/20"
        />
      </SettingsSection>
    </>
  )
}
