import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Check, Star, ChevronRight } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { walletInstitutions, getWalletLogoUrl } from '../data/walletInstitutions'
import AddAccountForm from '../components/wallet/AddAccountForm'
import MoneyBagIcon from '../components/ui/MoneyBagIcon'
import PageHeader from '../components/ui/PageHeader'

const TABS = [
  { id: 'all', label: 'Semua' },
  { id: 'bank', label: 'Bank' },
  { id: 'ewallet', label: 'E-Wallet' },
  { id: 'investasi', label: 'Investasi' },
  { id: 'lainnya', label: 'Kas & Lainnya' },
]

const CATEGORY_SECTIONS = [
  { id: 'recommended', title: 'Rekomendasi Utama' },
  { id: 'bank', title: 'Bank Digital & Nasional' },
  { id: 'ewallet', title: 'E-Wallet & PayLater' },
  { id: 'investasi', title: 'Investasi & Crypto' },
  { id: 'lainnya', title: 'Kas & Lainnya' },
]

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
          className="w-full h-full object-cover"
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
  const navigate = useNavigate()
  const wallets = useLiveQuery(() => db.wallets.toArray()) || []

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
      <div className="sticky top-0 z-30 bg-[var(--panel-strong)]/95 backdrop-blur-xl pb-2.5 border-b border-[var(--border)] shadow-xs">
        <div className="px-4 pt-4 pb-2">
          <PageHeader
            title={'Pilih Institusi / Dompet'}
            onBack={() => (isOnboarding && onBack ? onBack() : navigate(-1))}
          />
        </div>

        {/* Search Field */}
        <div className="px-4 pb-2.5">
          <div className="relative flex items-center">
            <Search size={17} className="absolute left-3.5 text-[var(--muted)]" />
            <input
              type="text"
              placeholder={'Cari Bank, e-Wallet, atau Kas...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl bg-[var(--field-bg)] py-3 pl-10 pr-4 text-sm font-semibold text-[var(--fg)] placeholder:text-[var(--muted-2)] border border-[var(--border)] focus:border-[var(--fg)] transition outline-none"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto ft-hide-scrollbar px-4 pb-0.5">
          {TABS.map((tab) => (
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
      </div>

      {/* ── Sleek List Content (Gaya Baris Melengkung iOS Fintech) ─ */}
      <div className="flex-1 overflow-y-auto pb-28 pt-4 px-4 space-y-6">
        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search size={36} className="text-[var(--muted)] opacity-40 mb-3" />
            <h3 className="text-sm font-black text-[var(--fg)]">Tidak ditemukan</h3>
            <p className="text-xs font-medium text-[var(--muted)] mt-1 max-w-[240px]">
              Institusi &lsquo;{search}&rsquo; tidak ada dalam preset. Gunakan tombol kustom di bawah.
            </p>
          </div>
        ) : (
          CATEGORY_SECTIONS.map((sec) => {
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
                        className={`group w-full flex items-center gap-3.5 px-4 py-3 rounded-[1.25rem] border text-left transition-all active:scale-[0.98] cursor-pointer ${
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
                            <span className="text-sm font-black text-[var(--fg)] truncate">
                              {inst.name}
                            </span>
                            {inst.isRecommended && (
                              <Star size={12} className="fill-amber-400 text-amber-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] font-medium text-[var(--muted)] truncate mt-0.5">
                            {inst.type === 'bank'
                              ? 'Bank Digital / Nasional'
                              : inst.type === 'ewallet'
                              ? 'E-Wallet / Dompet Digital'
                              : inst.type === 'investasi'
                              ? 'Platform Investasi'
                              : 'Kas Utama & Lainnya'}
                          </p>
                        </div>

                        {/* Right Status / Arrow Indicator */}
                        {added ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-emerald-500 uppercase tracking-wider bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 shrink-0">
                            <Check size={11} strokeWidth={3} />
                            Terdaftar
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
        className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"
        style={{ background: 'linear-gradient(to top, var(--bg) 80%, transparent)' }}
      >
        <button
          onClick={() => setSelectedInst('custom')}
          className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-2xl bg-[var(--fg)] text-[var(--bg)] font-black text-xs shadow-md transition hover:opacity-90 active:scale-[0.98] cursor-pointer"
        >
          <Plus size={16} strokeWidth={3} />
          <span>Buat Akun / Dompet Kustom</span>
        </button>
      </div>
    </div>
  )
}
