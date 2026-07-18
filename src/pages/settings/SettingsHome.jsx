import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { currencyOptions } from './settingsConstants'
import { SettingsLinkRow, SettingsSection, SettingsSplitRow } from './settingsComponents'

export default function SettingsHome() {
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
      <header className="ft-settings-hero">
        <h1 className="ft-page-title">{t('nav.settings')}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{t('settings.pageSubtitle')}</p>
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
        <div className="ft-settings-cell">
          <p className="mb-2 text-[15px] font-medium text-[var(--fg)]">{t('settings.theme')}</p>
          <div className="ft-settings-segment" role="group" aria-label={t('settings.theme')}>
            <button type="button" data-active={theme === 'dark'} onClick={() => setTheme('dark')}>
              {t('settings.theme.dark')}
            </button>
            <button type="button" data-active={theme === 'light'} onClick={() => setTheme('light')}>
              {t('settings.theme.light')}
            </button>
          </div>
        </div>
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

      <SettingsSection label={t('settings.section.more')}>
        <SettingsLinkRow to="/settings/security" title={t('settings.appLock')} />
        <SettingsLinkRow to="/settings/categories" title={t('settings.section.categories')} />
        <SettingsLinkRow to="/settings/recurring" title={t('settings.recurringTitle')} />
        <SettingsLinkRow to="/settings/data" title={t('settings.nav.data')} />
        <SettingsLinkRow to="/settings/help" title={t('profile.help')} subtitle={t('profile.helpSub')} />
      </SettingsSection>
    </>
  )
}
