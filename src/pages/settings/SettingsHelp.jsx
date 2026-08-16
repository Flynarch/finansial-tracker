import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HelpCircle,
  ChevronDown,
  Compass,
  Sparkles,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { SettingsSection, SettingsSearchInput } from './settingsComponents'

const faqItems = [
  {
    category: 'Penyimpanan & Privasi',
    q: 'settings.faq.storage.q',
    a: 'settings.faq.storage.a',
  },
  {
    category: 'Cloud & Multi-Device',
    q: 'settings.faq.cloud.q',
    a: 'settings.faq.cloud.a',
  },
  {
    category: 'Backup & Restore',
    q: 'settings.faq.json.q',
    a: 'settings.faq.json.a',
  },
]

export default function SettingsHelp() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const resetSpotlightTour = useSettingsStore((state) => state.resetSpotlightTour)
  const [searchQuery, setSearchQuery] = useState('')
  const [openFaqIndex, setOpenFaqIndex] = useState(null)

  const handleReplayTour = async () => {
    await resetSpotlightTour()
    navigate('/dashboard')
  }

  const toggleFaq = (index) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index))
  }

  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return faqItems
    return faqItems.filter((item) => {
      const questionText = t(item.q).toLowerCase()
      const answerText = t(item.a).toLowerCase()
      const catText = item.category.toLowerCase()
      return questionText.includes(q) || answerText.includes(q) || catText.includes(q)
    })
  }, [searchQuery, t])

  return (
    <>
      {/* Tour Replay Hero Card */}
      <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--badge-bg)] text-[var(--badge-icon)] border border-[var(--badge-border)] shadow-2xs">
              <Compass className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-[var(--fg)] leading-tight">
                {t('settings.tour.title', 'Spotlight Tour Fitur')}
              </h3>
              <p className="text-xs font-medium text-[var(--muted)] mt-1">
                Pelajari kembali fungsi utama Dashboard & Navigasi
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReplayTour}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl bg-[var(--fg)] px-4 text-sm font-black text-[var(--bg)] shadow-xs transition active:scale-95 hover:opacity-90 cursor-pointer"
        >
          <Sparkles className="h-4 w-4" />
          <span>{t('settings.tour.start', 'Mulai Spotlight Tour')}</span>
        </button>
      </div>

      {/* Search Input for FAQ */}
      <div className="mb-5">
        <SettingsSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('help.searchPlaceholder', 'Cari pertanyaan umum atau solusi...')}
        />
      </div>

      {/* FAQ Section */}
      <SettingsSection
        label={t('profile.help', 'Pertanyaan Umum (FAQ)')}
        footnote={t('settings.help.intro', 'FinTrack berjalan 100% offline-first di perangkat Anda.')}
      >
        {filteredFaqs.length === 0 ? (
          <div className="ft-settings-cell py-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--field-bg)] text-[var(--muted)] border border-[var(--border)] mb-2.5 shadow-2xs">
              <HelpCircle className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-[var(--fg)]">Pertanyaan Tidak Ditemukan</p>
            <p className="text-xs font-medium text-[var(--muted)] mt-1 max-w-xs mx-auto">
              Tidak ada jawaban yang sesuai dengan kata kunci &quot;{searchQuery}&quot;.
            </p>
          </div>
        ) : (
          filteredFaqs.map((item, index) => {
            const isOpen = openFaqIndex === index
            return (
              <div key={item.q} className="ft-settings-cell transition-colors">
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3.5 text-left select-none group"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--field-bg)] text-[var(--muted)] border border-[var(--border)] group-hover:text-[var(--fg)] transition-colors shadow-2xs">
                      <HelpCircle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                        {item.category}
                      </span>
                      <span className="block text-[14.5px] font-extrabold text-[var(--fg)] leading-snug mt-0.5">
                        {t(item.q)}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-[var(--muted)] transition-transform duration-200 shrink-0 ${
                      isOpen ? 'rotate-180 text-[var(--fg)]' : 'group-hover:text-[var(--fg)]'
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="mt-3.5 pl-13.5 text-xs leading-relaxed text-[var(--muted)] font-medium animate-fadeIn">
                    <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]">
                      {t(item.a)}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </SettingsSection>

      {/* Quick Architecture Highlights */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-card">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 mb-2.5">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <span className="block text-xs font-black text-[var(--fg)]">100% Offline-First</span>
          <span className="block text-[11px] font-medium text-[var(--muted)] mt-0.5">
            Data tersimpan aman di perangkat tanpa bergantung server luar.
          </span>
        </div>

        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-card">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 mb-2.5">
            <Zap className="h-4.5 w-4.5" />
          </div>
          <span className="block text-xs font-black text-[var(--fg)]">Performa Cepat</span>
          <span className="block text-[11px] font-medium text-[var(--muted)] mt-0.5">
            Respons instan tanpa buffering atau koneksi internet.
          </span>
        </div>
      </div>
    </>
  )
}
