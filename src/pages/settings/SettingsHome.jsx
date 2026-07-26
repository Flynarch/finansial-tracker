import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
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
  const setDefaultCurrency = useSettingsStore((state) => state.setDefaultCurrency)
  const setLocale = useSettingsStore((state) => state.setLocale)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const setMotionPreference = useSettingsStore((state) => state.setMotionPreference)

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
      <header className="ft-settings-hero flex items-start gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs transition hover:bg-[var(--field-bg)] active:scale-95 mt-0.5"
          aria-label={t('common.back')}
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="ft-page-title">{t('nav.settings')}</h1>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{t('settings.pageSubtitle')}</p>
        </div>
      </header>

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

      <SettingsSection label={t('settings.section.categories')}>
        <SettingsLinkRow to="/settings/categories" label={t('settings.expenseCategories')} />
      </SettingsSection>

      <SettingsSection label={t('settings.section.more')}>
        <SettingsLinkRow to="/settings/security" label={t('settings.appLock')} />
        <SettingsLinkRow to="/settings/recurring" label={t('settings.recurringTitle')} />
        <SettingsLinkRow to="/settings/data" label={t('settings.nav.data')} />
        <SettingsLinkRow to="/settings/help" label={t('profile.help')} />
      </SettingsSection>
    </>
  )
}
