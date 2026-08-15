import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import PageHeader from '../../components/ui/PageHeader'
import { currencyOptions } from './settingsConstants'
import { SettingsLinkRow, SettingsSection, SettingsSplitRow } from './settingsComponents'

export default function SettingsHome() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const locale = useSettingsStore((state) => state.locale)
  const theme = useSettingsStore((state) => state.theme)
  const motionPreference = useSettingsStore((state) => state.motionPreference)
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const geminiApiKey = useSettingsStore((state) => state.geminiApiKey)
  const setDefaultCurrency = useSettingsStore((state) => state.setDefaultCurrency)
  const setLocale = useSettingsStore((state) => state.setLocale)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const setMotionPreference = useSettingsStore((state) => state.setMotionPreference)
  const setGeminiApiKey = useSettingsStore((state) => state.setGeminiApiKey)

  const [apiKeyInput, setApiKeyInput] = useState(geminiApiKey || '')
  const [showKey, setShowKey] = useState(false)
  const [keyStatusMessage, setKeyStatusMessage] = useState('')

  useEffect(() => {
    setApiKeyInput(geminiApiKey || '')
  }, [geminiApiKey])

  const handleSaveApiKey = async (e) => {
    e.preventDefault()
    await setGeminiApiKey(apiKeyInput)
    setKeyStatusMessage('API Key Gemini berhasil disimpan!')
    setTimeout(() => setKeyStatusMessage(''), 3000)
  }

  const handleClearApiKey = async () => {
    setApiKeyInput('')
    await setGeminiApiKey('')
    setKeyStatusMessage('API Key diset ke default.')
    setTimeout(() => setKeyStatusMessage(''), 3000)
  }

  const motionSummary =
    motionPreference === 'system'
      ? t('settings.motion.current.system', {
          value: reduceMotion ? t('settings.motion.state.reduce') : t('settings.motion.state.full'),
        })
      : motionPreference === 'reduce'
        ? t('settings.motion.current.reduce')
        : t('settings.motion.current.full')

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

      <SettingsSection
        label={t('settings.preferences')}
        footnote={t('settings.motion.current', { value: motionSummary })}
      >
        <SettingsSplitRow label={t('settings.language')}>
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value)}
            className="ft-settings-field-compact"
            aria-label={t('settings.language')}
          >
            <option value="id">{t('settings.lang.id')}</option>
            <option value="en">{t('settings.lang.en')}</option>
          </select>
        </SettingsSplitRow>
        <SettingsSplitRow label={t('settings.defaultCurrency')}>
          <select
            value={defaultCurrency}
            onChange={(event) => setDefaultCurrency(event.target.value)}
            className="ft-settings-field-compact"
            aria-label={t('settings.defaultCurrency')}
          >
            {currencyOptions.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </SettingsSplitRow>
        <SettingsSplitRow label={t('settings.theme')}>
          <select
            value={theme}
            onChange={(event) => setTheme(event.target.value)}
            className="ft-settings-field-compact"
            aria-label={t('settings.theme')}
          >
            <option value="dark">{t('settings.theme.dark')}</option>
            <option value="light">{t('settings.theme.light')}</option>
          </select>
        </SettingsSplitRow>
        <SettingsSplitRow label={t('settings.motion')}>
          <select
            value={motionPreference}
            onChange={(event) => setMotionPreference(event.target.value)}
            className="ft-settings-field-compact"
            aria-label={t('settings.motion')}
          >
            <option value="system">{t('settings.motion.system')}</option>
            <option value="reduce">{t('settings.motion.reduce')}</option>
            <option value="full">{t('settings.motion.full')}</option>
          </select>
        </SettingsSplitRow>
      </SettingsSection>

      <SettingsSection label="Integrasi AI (Gemini API Key)">
        <div className="ft-settings-cell space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[var(--fg)]">Status API Key</span>
            {geminiApiKey ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-500 border border-emerald-500/20">
                Key Kustom Aktif
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--field-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--muted)] border border-[var(--border)]">
                Default (Env Variable)
              </span>
            )}
          </div>

          {keyStatusMessage ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs font-bold text-emerald-500">
              {keyStatusMessage}
            </div>
          ) : null}

          <form onSubmit={handleSaveApiKey} className="space-y-2.5">
            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={'Masukkan API Key Gemini Anda...'}
                className="ft-settings-field-compact w-full pr-10 text-xs font-mono"
                aria-label={'Gemini API Key'}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 text-[var(--muted)] hover:text-[var(--fg)] transition p-1 rounded-md cursor-pointer"
                aria-label={showKey ? 'Sembunyikan Key' : 'Tampilkan Key'}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-[var(--fg)] py-2 px-3 text-xs font-bold text-[var(--bg)] transition hover:opacity-90 active:scale-95 cursor-pointer"
              >
                Simpan Key
              </button>
              {geminiApiKey ? (
                <button
                  type="button"
                  onClick={handleClearApiKey}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 px-3 text-xs font-bold text-rose-500 hover:bg-rose-500/20 transition active:scale-95 cursor-pointer"
                >
                  Reset Default
                </button>
              ) : null}
            </div>
          </form>

          <p className="text-[11px] leading-relaxed text-[var(--muted-2)]">
            Dapatkan API Key gratis di{' '}
            <a
              href="https://ai.google.dev"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--accent)] underline font-semibold hover:opacity-80"
            >
              Google AI Studio (ai.google.dev)
            </a>
            . Key disimpan secara lokal di perangkat Anda.
          </p>
        </div>
      </SettingsSection>

      <SettingsSection label={t('settings.section.categories')}>
        <SettingsLinkRow to="/settings/categories" label={t('settings.expenseCategories')} />
      </SettingsSection>

      <SettingsSection label={t('settings.section.more')}>
        <SettingsLinkRow to="/settings/security" label={t('settings.appLock')} />
        <SettingsLinkRow to="/settings/recurring" label={t('settings.recurringTitle')} />
        <SettingsLinkRow to="/settings/data" label={t('settings.nav.data')} />
        <SettingsLinkRow to="/settings/help" label="Tur & Panduan Aplikasi" />
      </SettingsSection>
    </>
  )
}
