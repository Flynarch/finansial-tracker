import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Check, Star, ChevronRight } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { walletInstitutions, getWalletLogoUrl } from '../data/walletInstitutions'
import AddAccountForm from '../components/wallet/AddAccountForm'
import MoneyBagIcon from '../components/ui/MoneyBagIcon'
import PageHeader from '../components/ui/PageHeader'
import useTranslation from '../hooks/useTranslation'

const getAvatarColor = (name) => {
  const colors = [
    'bg-sky-500/15 text-sky-500',
    'bg-emerald-500/15 text-emerald-500',
    'bg-violet-500/15 text-violet-500',
    'bg-amber-500/15 text-amber-500',
    'bg-rose-500/15 text-rose-500',
    'bg-teal-500/15 text-teal-500',
    'bg-indigo-500/15 text-indigo-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function CircularInstitutionLogo({ inst }) {
  const isCash =
    inst.id === 'cash' ||
    inst.customIcon === 'dollar' ||
    inst.customIcon === 'cash' ||
    String(inst.name || '').toLowerCase().includes('uang tunai') ||
    String(inst.name || '').toLowerCase().includes('cash')

  return (
    <div className="w-11 h-11 rounded-full bg-[var(--wallet-logo-bg,var(--field-bg))] border-[0.5px] border-[var(--wallet-logo-border,var(--border))] flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
      {isCash ? (
        <div className="w-full h-full flex items-center justify-center text-amber-500 p-1.5">
          <MoneyBagIcon size={22} strokeWidth={2.5} />
        </div>
      ) : getWalletLogoUrl(inst) ? (
        <img
          src={getWalletLogoUrl(inst)}
          alt={inst.name}
          className="w-full h-full object-cover rounded-full"
          onError={(e) => {
            e.target.style.display = 'none'
            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
            e.target.parentElement.className = `w-11 h-11 rounded-full flex items-center justify-center overflow-hidden shrink-0 ${getAvatarColor(inst.name)}`
          }}
        />
      ) : null}
      <div
        className={`w-full h-full items-center justify-center font-black text-xs ${getAvatarColor(inst.name)}`}
        style={{ display: isCash || getWalletLogoUrl(inst) ? 'none' : 'flex' }}
      >
        {inst.name.substring(0, 2).toUpperCase()}
      </div>
    </div>
  )
}

export default function AddAccountPage({ isOnboarding, onBack, onSuccess }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const wallets = useLiveQuery(() => db.wallets.toArray()) || []

  const tabs = useMemo(
    () => [
      { id: 'all', label: t('wallets.tabAll', 'Semua') },
      { id: 'bank', label: t('wallets.tabBank', 'Bank') },
      { id: 'ewallet', label: t('wallets.tabEwallet', 'E-Wallet') },
      { id: 'investasi', label: t('wallets.tabInvestasi', 'Investasi') },
      { id: 'lainnya', label: t('wallets.tabLainnya', 'Kas & Lainnya') },
    ],
    [t]
  )

  const categorySections = useMemo(
    () => [
      { id: 'recommended', title: t('wallets.sectionRecommended', 'Rekomendasi Utama') },
      { id: 'bank', title: t('wallets.sectionBank', 'Bank Digital & Nasional') },
      { id: 'ewallet', title: t('wallets.sectionEwallet', 'E-Wallet & PayLater') },
      { id: 'investasi', title: t('wallets.sectionInvestasi', 'Investasi & Crypto') },
      { id: 'lainnya', title: t('wallets.sectionLainnya', 'Kas & Lainnya') },
    ],
    [t]
  )

  const isInstitutionAdded = (inst) => {
    return wallets.some((w) => {
      if (inst.logoUrl && w.logoUrl === inst.logoUrl) return true
      if (inst.customIcon && w.customIcon === inst.customIcon) return true
      if (w.name.toLowerCase() === inst.name.toLowerCase()) return true
      return false
    })
  }

  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [selectedInst, setSelectedInst] = useState(null)

  const filteredData = useMemo(() => {
    return walletInstitutions.filter((inst) => {
      const matchTab = activeTab === 'all' || inst.type === activeTab
      const matchSearch = inst.name.toLowerCase().includes(search.toLowerCase())
      return matchTab && matchSearch
    })
  }, [search, activeTab])

  if (selectedInst) {
    return (
      <AddAccountForm
        institution={selectedInst === 'custom' ? null : selectedInst}
        onBack={() => setSelectedInst(null)}
        onSuccess={onSuccess}
      />
    )
  }

  return (
    <div className={`ft-page-enter flex flex-col ${isOnboarding ? 'h-full w-full' : 'min-h-screen bg-[var(--bg)]'}`}>
      {/* ── Sticky Top Header & Filters ─────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[var(--panel-strong)]/95 backdrop-blur-xl pb-2.5 border-b border-[var(--border)] shadow-xs w-full">
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 pt-4 pb-2">
          <PageHeader
            title={t('wallets.chooseInstitution', 'Pilih Institusi / Dompet')}
            onBack={() => (isOnboarding && onBack ? onBack() : navigate(-1))}
          />
        </div>

        {/* Search Field */}
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 pb-2.5">
          <div className="relative flex items-center">
            <Search size={17} className="absolute left-3.5 text-[var(--muted)]" />
            <input
              type="text"
              placeholder={t('wallets.searchPlaceholder', 'Cari Bank, e-Wallet, atau Kas...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl bg-[var(--field-bg)] py-3 pl-10 pr-4 text-sm font-semibold text-[var(--fg)] placeholder:text-[var(--muted-2)] border border-[var(--border)] focus:border-[var(--fg)] transition outline-none"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="max-w-2xl mx-auto w-full flex items-center gap-2 overflow-x-auto ft-hide-scrollbar px-4 sm:px-6 pb-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[var(--fg)] text-[var(--bg)] shadow-md'
                  : 'bg-[var(--field-bg)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Returning User Existing Wallets Banner */}
        {isOnboarding && wallets.length > 0 && (
          <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 pt-2 pb-0.5">
            <button
              type="button"
              onClick={onSuccess}
              className="w-full flex items-center justify-between p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs hover:bg-emerald-500/15 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <div className="flex items-center gap-2.5">
                <div className="grid h-7 w-7 place-items-center rounded-xl bg-emerald-500/20 text-emerald-500 shrink-0">
                  <Check size={14} strokeWidth={2.8} />
                </div>
                <div className="text-left">
                  <span className="block text-xs font-black text-[var(--fg)]">
                    {t('wallets.syncedWalletsBanner', '{{count}} Dompet Tersinkronisasi', { count: wallets.length })}
                  </span>
                  <span className="block text-[10.5px] text-[var(--muted)] font-medium">
                    {t('wallets.syncedWalletsDesc', 'Gunakan dompet yang sudah ada tanpa perlu menambah baru')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-black text-[var(--fg)] shrink-0">
                <span>{t('auth.continue', 'Lanjut')}</span>
                <ChevronRight size={14} strokeWidth={2.5} />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ── Sleek List Content (Gaya Baris Melengkung iOS Fintech Wide Layout) ─ */}
      <div className="flex-1 overflow-y-auto pb-28 pt-4 px-4 sm:px-6 space-y-6 max-w-2xl mx-auto w-full">
        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search size={36} className="text-[var(--muted)] opacity-40 mb-3" />
            <h3 className="text-sm font-black text-[var(--fg)]">
              {t('wallets.notFoundTitle', 'Tidak ditemukan')}
            </h3>
            <p className="text-xs font-medium text-[var(--muted)] mt-1 max-w-[240px]">
              {t('wallets.notFoundDesc', 'Institusi "{{query}}" tidak ada dalam preset. Gunakan tombol kustom di bawah.', { query: search })}
            </p>
          </div>
        ) : (
          categorySections.map((sec) => {
            let secItems
            if (search || activeTab !== 'all') {
              if (sec.id === 'recommended') return null
              secItems = filteredData.filter((i) => i.type === sec.id)
            } else if (sec.id === 'recommended') {
              secItems = filteredData.filter((i) => i.isRecommended)
            } else {
              secItems = filteredData.filter((i) => i.type === sec.id && !i.isRecommended)
            }

            if (secItems.length === 0) return null

            return (
              <section key={sec.id} className="space-y-2.5">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)] px-1">
                  {sec.title} ({secItems.length})
                </h4>

                <div className="space-y-2">
                  {secItems.map((inst) => {
                    const added = isInstitutionAdded(inst)
                    return (
                      <button
                        key={inst.id}
                        onClick={() => {
                          if (!added) setSelectedInst(inst)
                        }}
                        disabled={added}
                        className={`group w-full flex items-center gap-3.5 sm:gap-4 px-4 py-3.5 sm:px-5 sm:py-4 rounded-[1.25rem] border text-left transition-all active:scale-[0.98] cursor-pointer ${
                          added
                            ? 'bg-[var(--field-bg)]/40 border-[var(--border)]/40 opacity-50 grayscale cursor-not-allowed'
                            : 'bg-[var(--panel-strong)] border-[color-mix(in_srgb,var(--border)_75%,transparent)] hover:bg-[var(--field-bg)] hover:border-[var(--border-strong)] shadow-2xs'
                        }`}
                      >
                        {/* Circular Logo */}
                        <CircularInstitutionLogo inst={inst} />

                        {/* Text Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm sm:text-base font-black text-[var(--fg)] truncate">
                              {inst.name}
                            </span>
                            {inst.isRecommended && (
                              <Star size={13} className="fill-amber-400 text-amber-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] sm:text-xs font-medium text-[var(--muted)] truncate mt-0.5">
                            {inst.type === 'bank'
                              ? t('wallets.typeBank', 'Bank Digital / Nasional')
                              : inst.type === 'ewallet'
                              ? t('wallets.typeEwallet', 'E-Wallet / Dompet Digital')
                              : inst.type === 'investasi'
                              ? t('wallets.typeInvestasi', 'Platform Investasi')
                              : t('wallets.typeLainnya', 'Kas Utama & Lainnya')}
                          </p>
                        </div>

                        {/* Right Status / Arrow Indicator */}
                        {added ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-emerald-500 uppercase tracking-wider bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 shrink-0">
                            <Check size={11} strokeWidth={3} />
                            {t('wallets.alreadyRegistered', 'Terdaftar')}
                          </span>
                        ) : (
                          <div className="p-1 rounded-full text-[var(--muted-2)] group-hover:text-[var(--fg)] group-hover:translate-x-0.5 transition-all shrink-0">
                            <ChevronRight size={18} strokeWidth={2.2} />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })
        )}
      </div>

      {/* ── Sticky Bottom Action Bar ─────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-4 sm:px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"
        style={{ background: 'linear-gradient(to top, var(--bg) 80%, transparent)' }}
      >
        <div className="max-w-2xl mx-auto w-full">
          <button
            onClick={() => setSelectedInst('custom')}
            className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-2xl bg-[var(--fg)] text-[var(--bg)] font-black text-xs sm:text-sm shadow-md transition hover:opacity-90 active:scale-[0.98] cursor-pointer"
          >
            <Plus size={16} strokeWidth={3} />
            <span>{t('wallets.createCustomWallet', 'Buat Akun / Dompet Kustom')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
