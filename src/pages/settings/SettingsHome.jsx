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
  IDR: 'Rp • IDR',
  USD: '$ • USD',
  EUR: '€ • EUR',
  SGD: 'S$ • SGD',
  MYR: 'RM • MYR',
  JPY: '¥ • JPY',
  GBP: '£ • GBP',
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
        ? t('settings.lockMethod.pattern', 'Pola')
        : t('settings.lockMethod.pin', 'PIN')
    : t('settings.lockStatus.off', 'Nonaktif')

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

      {/* User Mini Profile Strip - Clean & Compact */}
      <div className="mb-3.5 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3.5 py-2.5 shadow-card">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--fg)] text-[var(--bg)] font-black text-xs">
            {(profileName || 'FT').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-[var(--fg)]">
              {profileName || 'Pengguna FinTrack'}
            </p>
            <p className="text-[10px] font-medium text-[var(--muted)] flex items-center gap-1 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-income)] shrink-0" />
              <span>Offline-First (IndexedDB)</span>
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--field-bg)] px-2 py-0.5 text-[9.5px] font-extrabold text-[var(--muted)]">
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
          description={t('settings.languageDesc', 'Bahasa tampilan')}
          icon={Globe}
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
          description={t('settings.themeDesc', 'Mode visual')}
          icon={theme === 'dark' ? Moon : Sun}
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
          description={t('settings.currencyDesc', 'Mata uang utama')}
          icon={Coins}
        >
          <select
            value={defaultCurrency}
            onChange={(event) => setDefaultCurrency(event.target.value)}
            className="ft-settings-field-compact font-bold"
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
          description={t('settings.motionDesc', 'Transisi animasi')}
          icon={Activity}
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
        <div className="ft-settings-cell space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="grid h-6 w-6 place-items-center rounded-md bg-[var(--field-bg)] text-[var(--muted)] border border-[var(--border)]">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold text-[var(--fg)]">
                {t('settings.aiKeyStatus', 'Status API Key')}
              </span>
            </div>
            {geminiApiKey ? (
              <span className="inline-flex items-center rounded-md bg-[var(--field-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--fg)] border border-[var(--border)]">
                Key Kustom Aktif
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md bg-[var(--field-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)] border border-[var(--border)]">
                {t('settings.defaultKey', 'Bawaan Sistem')}
              </span>
            )}
          </div>

          {keyStatusMessage ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--field-bg)] p-2 text-[11px] font-bold text-[var(--fg)] animate-fadeIn">
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
                className="ft-settings-field-compact w-full pr-8 text-xs font-mono"
                aria-label={'Gemini API Key'}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 text-[var(--muted)] hover:text-[var(--fg)] transition p-0.5 rounded cursor-pointer"
                aria-label={showKey ? 'Sembunyikan Key' : 'Tampilkan Key'}
              >
                {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-[var(--fg)] py-1.5 px-3 text-xs font-bold text-[var(--bg)] transition hover:opacity-90 active:scale-95 cursor-pointer shadow-2xs"
              >
                {t('settings.saveApiKey', 'Simpan Key')}
              </button>
              {geminiApiKey ? (
                <button
                  type="button"
                  onClick={handleClearApiKey}
                  className="rounded-lg border border-[var(--border)] bg-[var(--field-bg)] py-1.5 px-3 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 cursor-pointer"
                >
                  {t('settings.resetApiKey', 'Reset')}
                </button>
              ) : null}
            </div>
          </form>

          <p className="text-[10.5px] leading-relaxed text-[var(--muted)] font-medium">
            {t('settings.aiKeyFree', 'Dapatkan API Key gratis di')}{' '}
            <a
              href="https://aistudio.google.com"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--fg)] underline font-bold hover:opacity-80"
            >
              aistudio.google.com
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
        />
        <SettingsLinkRow
          to="/settings/recurring"
          label={t('settings.recurringTitle', 'Transaksi Berulang')}
          subtitle={t('settings.recurringSubtitle', 'Otomasi tagihan & gaji')}
          icon={RefreshCw}
        />
        <SettingsLinkRow
          to="/settings/security"
          label={t('settings.appLock', 'Keamanan & Kunci Aplikasi')}
          subtitle={t('settings.securitySubtitle', 'PIN, Pola, atau Biometrik')}
          icon={securityEnabled ? ShieldCheck : Lock}
          badge={securityBadge}
        />
        <SettingsLinkRow
          to="/settings/data"
          label={t('settings.nav.data', 'Data & Cadangan')}
          subtitle={t('settings.dataSubtitle', 'Ekspor JSON, Impor data, dan Uji Coba')}
          icon={Database}
        />
        <SettingsLinkRow
          to="/settings/help"
          label={t('settings.helpTitle', 'Tur & Panduan Fitur')}
          subtitle={t('settings.helpSubtitle', 'FAQ & panduan fitur aplikasi')}
          icon={Compass}
        />
      </SettingsSection>
    </>
  )
}
