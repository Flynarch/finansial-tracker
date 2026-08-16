import { useNavigate } from 'react-router-dom'
import { Sparkles, HelpCircle, ChevronDown, Compass } from 'lucide-react'
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
      {/* Tour Replay Card */}
      <div className="mb-5 flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-card">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 shadow-2xs">
            <Compass className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[var(--fg)]">
              {t('settings.tour.title', 'Spotlight Tour Fitur')}
            </h3>
            <p className="text-[11px] font-medium text-[var(--muted)] truncate mt-0.5">
              Pelajari kembali fungsi utama Dashboard & Navigasi
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleReplayTour}
          className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 py-2 text-xs font-extrabold text-[var(--bg)] shadow-sm transition active:scale-95 hover:opacity-90 cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>{t('settings.tour.start', 'Mulai Tur')}</span>
        </button>
      </div>

      <SettingsSection
        label={t('profile.help', 'Pertanyaan Umum (FAQ)')}
        footnote={t('settings.help.intro', 'FinTrack berjalan 100% offline-first di perangkat Anda.')}
      >
        {faqItems.map((item) => (
          <details key={item.q} className="ft-settings-faq ft-settings-cell group">
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-bold text-[var(--fg)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <HelpCircle className="h-4 w-4 text-[var(--muted)] shrink-0" />
                <span className="truncate">{t(item.q)}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-[var(--muted)] transition-transform duration-200 group-open:rotate-180 shrink-0" />
            </summary>
            <p className="mt-2.5 pl-6 text-xs leading-relaxed text-[var(--muted)] font-medium">
              {t(item.a)}
            </p>
          </details>
        ))}
      </SettingsSection>
    </>
  )
}
