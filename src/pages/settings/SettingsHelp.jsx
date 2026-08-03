import { useNavigate } from 'react-router-dom'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { SettingsSection } from './settingsComponents'

const faqItems = [
  { q: 'settings.faq.storage.q', a: 'settings.faq.storage.a' },
  { q: 'settings.faq.cloud.q', a: 'settings.faq.cloud.a' },
  { q: 'settings.faq.json.q', a: 'settings.faq.json.a' },
]

export default function SettingsHelp() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const resetSpotlightTour = useSettingsStore((state) => state.resetSpotlightTour)

  const handleReplayTour = async () => {
    await resetSpotlightTour()
    navigate('/dashboard')
  }

  return (
    <>
      <SettingsSection label="Panduan & Tur Aplikasi" footnote="Putar ulang petunjuk penggunaan fitur FinTrack kapan saja.">
        <div className="ft-settings-cell flex items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-bold text-[var(--fg)]">Spotlight Tour Fitur</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Pelajari kembali fungsi utama Dashboard & Navigasi.</p>
          </div>
          <button
            type="button"
            onClick={handleReplayTour}
            className="shrink-0 rounded-xl bg-[var(--fg)] px-3.5 py-2 text-xs font-bold text-[var(--bg)] shadow-sm transition active:scale-95 hover:opacity-90 cursor-pointer"
          >
            Mulai Tur
          </button>
        </div>
      </SettingsSection>

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
    </>
  )
}
