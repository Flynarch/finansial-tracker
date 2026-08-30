import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HelpCircle,
  ChevronDown,
  Compass,
  Sparkles,
  ShieldCheck,
  Zap,
  Database,
  Cloud,
  UserCheck,
  Mail,
  Fingerprint,
  FileText,
  Bot,
  Coins,
  HandCoins,
  RefreshCw,
  Search,
  CheckCircle2,
} from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { triggerHaptic } from '../../lib/haptics'
import { APP_DISPLAY_VERSION } from '../../lib/version'
import { SettingsSection, SettingsSearchInput } from './settingsComponents'

const FAQ_CATEGORIES = [
  { id: 'all', labelKey: 'help.cat.all', fallback: 'Semua' },
  { id: 'storage', labelKey: 'help.cat.storage', fallback: 'Penyimpanan & Data' },
  { id: 'auth', labelKey: 'help.cat.auth', fallback: 'Akun & Cloud' },
  { id: 'security', labelKey: 'help.cat.security', fallback: 'Keamanan & Kunci' },
  { id: 'ai', labelKey: 'help.cat.ai', fallback: 'Asisten AI & Struk' },
  { id: 'features', labelKey: 'help.cat.features', fallback: 'Fitur & Keuangan' },
]

const FAQ_ITEMS = [
  {
    id: 'storage',
    catId: 'storage',
    categoryKey: 'help.cat.storage',
    categoryFallback: 'Penyimpanan & Data',
    icon: Database,
    q: 'settings.faq.storage.q',
    a: 'settings.faq.storage.a',
  },
  {
    id: 'cloud',
    catId: 'auth',
    categoryKey: 'help.cat.auth',
    categoryFallback: 'Akun & Cloud',
    icon: Cloud,
    q: 'settings.faq.cloud.q',
    a: 'settings.faq.cloud.a',
  },
  {
    id: 'guestToAccount',
    catId: 'auth',
    categoryKey: 'help.cat.auth',
    categoryFallback: 'Akun & Cloud',
    icon: UserCheck,
    q: 'settings.faq.guestToAccount.q',
    a: 'settings.faq.guestToAccount.a',
  },
  {
    id: 'gmailOnly',
    catId: 'auth',
    categoryKey: 'help.cat.auth',
    categoryFallback: 'Akun & Cloud',
    icon: Mail,
    q: 'settings.faq.gmailOnly.q',
    a: 'settings.faq.gmailOnly.a',
  },
  {
    id: 'biometric',
    catId: 'security',
    categoryKey: 'help.cat.security',
    categoryFallback: 'Keamanan & Kunci',
    icon: Fingerprint,
    q: 'settings.faq.biometric.q',
    a: 'settings.faq.biometric.a',
  },
  {
    id: 'json',
    catId: 'storage',
    categoryKey: 'help.cat.storage',
    categoryFallback: 'Penyimpanan & Data',
    icon: FileText,
    q: 'settings.faq.json.q',
    a: 'settings.faq.json.a',
  },
  {
    id: 'aiScan',
    catId: 'ai',
    categoryKey: 'help.cat.ai',
    categoryFallback: 'Asisten AI & Struk',
    icon: Bot,
    q: 'settings.faq.aiScan.q',
    a: 'settings.faq.aiScan.a',
  },
  {
    id: 'currency',
    catId: 'features',
    categoryKey: 'help.cat.features',
    categoryFallback: 'Fitur & Keuangan',
    icon: Coins,
    q: 'settings.faq.currency.q',
    a: 'settings.faq.currency.a',
  },
  {
    id: 'loans',
    catId: 'features',
    categoryKey: 'help.cat.features',
    categoryFallback: 'Fitur & Keuangan',
    icon: HandCoins,
    q: 'settings.faq.loans.q',
    a: 'settings.faq.loans.a',
  },
  {
    id: 'recurring',
    catId: 'features',
    categoryKey: 'help.cat.features',
    categoryFallback: 'Fitur & Keuangan',
    icon: RefreshCw,
    q: 'settings.faq.recurring.q',
    a: 'settings.faq.recurring.a',
  },
]

export default function SettingsHelp() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const resetSpotlightTour = useSettingsStore((state) => state.resetSpotlightTour)

  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [openFaqIndex, setOpenFaqIndex] = useState(null)

  const handleReplayTour = async () => {
    triggerHaptic('medium')
    await resetSpotlightTour()
    navigate('/dashboard')
  }

  const toggleFaq = (index) => {
    triggerHaptic('light')
    setOpenFaqIndex((prev) => (prev === index ? null : index))
  }

  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return FAQ_ITEMS.filter((item) => {
      const matchCategory = activeCategory === 'all' || item.catId === activeCategory
      if (!matchCategory) return false

      if (!q) return true

      const questionText = t(item.q).toLowerCase()
      const answerText = t(item.a).toLowerCase()
      const catText = t(item.categoryKey, item.categoryFallback).toLowerCase()
      return questionText.includes(q) || answerText.includes(q) || catText.includes(q)
    })
  }, [activeCategory, searchQuery, t])

  return (
    <div className="space-y-6">
      {/* 1. Tour Replay Hero Card */}
      <div className="flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 shadow-2xs">
              <Compass className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-[var(--fg)] leading-tight">
                {t('help.tourCardTitle', 'Tur Panduan Aplikasi')}
              </h3>
              <p className="text-xs font-medium text-[var(--muted)] mt-1">
                {t('help.tourCardSubtitle', 'Pelajari fungsi utama Dashboard, Navigasi, dan Pencatatan Cepat')}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReplayTour}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl bg-[var(--fg)] px-4 text-sm font-black text-[var(--bg)] shadow-xs transition active:scale-[0.98] hover:opacity-90 cursor-pointer"
        >
          <Sparkles className="h-4 w-4" />
          <span>{t('help.tourCardBtn', 'Mulai Spotlight Tour')}</span>
        </button>
      </div>

      {/* 2. Search Input for FAQ */}
      <div className="space-y-3">
        <SettingsSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('help.searchPlaceholder', 'Cari pertanyaan, fitur, atau topik bantuan...')}
        />

        {/* Category Horizontal Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto ft-hide-scrollbar pb-1 px-0.5">
          {FAQ_CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.id
            const count =
              cat.id === 'all'
                ? FAQ_ITEMS.length
                : FAQ_ITEMS.filter((item) => item.catId === cat.id).length

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  triggerHaptic('light')
                  setActiveCategory(cat.id)
                }}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                  isSelected
                    ? 'bg-[var(--fg)] text-[var(--bg)] shadow-xs'
                    : 'bg-[var(--field-bg)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]'
                }`}
              >
                <span>{t(cat.labelKey, cat.fallback)}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected
                      ? 'bg-[var(--bg)]/20 text-[var(--bg)]'
                      : 'bg-[var(--border)] text-[var(--muted)]'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. FAQ Accordion Section */}
      <SettingsSection
        label={t('profile.help', 'Pertanyaan Umum (FAQ)')}
        footnote={t('settings.help.intro', 'FinTrack berjalan 100% offline-first di perangkat Anda.')}
      >
        {filteredFaqs.length === 0 ? (
          <div className="ft-settings-cell py-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--field-bg)] text-[var(--muted)] border border-[var(--border)] mb-2.5 shadow-2xs">
              <Search className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-[var(--fg)]">
              {t('help.faqNotFound', 'Pertanyaan Tidak Ditemukan')}
            </p>
            <p className="text-xs font-medium text-[var(--muted)] mt-1 max-w-xs mx-auto">
              {t(
                'help.faqNotFoundDesc',
                'Tidak ada FAQ yang cocok dengan "{{query}}". Coba kata kunci lain atau reset pencarian.',
                { query: searchQuery }
              )}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setActiveCategory('all')
              }}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel-strong)] transition-all cursor-pointer"
            >
              <span>{t('help.resetSearch', 'Reset Pencarian')}</span>
            </button>
          </div>
        ) : (
          filteredFaqs.map((item, index) => {
            const isOpen = openFaqIndex === index
            const ItemIcon = item.icon || HelpCircle

            return (
              <div key={item.q} className="ft-settings-cell transition-colors">
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3.5 text-left select-none group"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border transition-colors shadow-2xs ${
                      isOpen
                        ? 'bg-[var(--accent)]/15 border-[var(--accent)]/30 text-[var(--accent)]'
                        : 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)] group-hover:text-[var(--fg)]'
                    }`}>
                      <ItemIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                        {t(item.categoryKey, item.categoryFallback)}
                      </span>
                      <span className="block text-sm sm:text-[14.5px] font-extrabold text-[var(--fg)] leading-snug mt-0.5">
                        {t(item.q)}
                      </span>
                    </div>
                  </div>
                  <div className="p-1 rounded-lg text-[var(--muted)] group-hover:text-[var(--fg)] shrink-0">
                    <ChevronDown
                      className={`h-5 w-5 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[var(--fg)]' : ''
                      }`}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-3.5 pl-0 sm:pl-13.5 text-xs leading-relaxed text-[var(--muted)] font-medium animate-fadeIn">
                    <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] space-y-2">
                      <p className="text-xs text-[var(--fg)] leading-relaxed font-normal">
                        {t(item.a)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </SettingsSection>

      {/* 4. Quick Architecture Pillars Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-xs space-y-1.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <span className="block text-xs font-black text-[var(--fg)]">100% Offline-First</span>
          <p className="text-[11px] font-medium text-[var(--muted)] leading-relaxed">
            Data tersimpan aman di database IndexedDB perangkat Anda.
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-xs space-y-1.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
            <Zap className="h-4.5 w-4.5" />
          </div>
          <span className="block text-xs font-black text-[var(--fg)]">Performa Instan</span>
          <p className="text-[11px] font-medium text-[var(--muted)] leading-relaxed">
            Respons kilat tanpa jeda jaringan dan hemat kuota data.
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-xs space-y-1.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
            <Bot className="h-4.5 w-4.5" />
          </div>
          <span className="block text-xs font-black text-[var(--fg)]">Asisten AI Gemini</span>
          <p className="text-[11px] font-medium text-[var(--muted)] leading-relaxed">
            Ekstraksi struk fisik & rekomendasi finansial cerdas otomatis.
          </p>
        </div>
      </div>

      {/* 5. Support & Community Banner */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--field-bg)] p-4 sm:p-5 flex items-center justify-between gap-4">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
            <h4 className="text-xs font-black text-[var(--fg)]">
              {t('help.contactCardTitle', 'Pusat Bantuan & Komunitas')}
            </h4>
          </div>
          <p className="text-[11px] text-[var(--muted)] font-medium">
            {t('help.contactCardSubtitle', `FinTrack ${APP_DISPLAY_VERSION} • Native Android & Offline-First`)}
          </p>
        </div>
      </div>
    </div>
  )
}
