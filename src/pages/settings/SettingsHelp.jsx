import useTranslation from '../../hooks/useTranslation'
import { SettingsSection } from './settingsComponents'

const faqItems = [
  { q: 'settings.faq.storage.q', a: 'settings.faq.storage.a' },
  { q: 'settings.faq.cloud.q', a: 'settings.faq.cloud.a' },
  { q: 'settings.faq.json.q', a: 'settings.faq.json.a' },
]

export default function SettingsHelp() {
  const { t } = useTranslation()

  return (
    <SettingsSection label={t('profile.help')} footnote={t('settings.help.intro')}>
      {faqItems.map((item) => (
        <details key={item.q} className="ft-settings-faq ft-settings-cell group">
          <summary className="flex cursor-pointer items-center justify-between gap-2 text-[15px] font-medium text-[var(--fg)]">
            <span className="pr-2">{t(item.q)}</span>
            <span
              className="text-lg text-[var(--muted)] transition-transform duration-200 group-open:rotate-90"
              aria-hidden
            >
              ›
            </span>
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{t(item.a)}</p>
        </details>
      ))}
    </SettingsSection>
  )
}
