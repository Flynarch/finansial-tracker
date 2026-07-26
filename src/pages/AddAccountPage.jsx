import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { walletInstitutions, getWalletLogoUrl } from '../data/walletInstitutions'
import AddAccountForm from '../components/wallet/AddAccountForm'
import MoneyBagIcon from '../components/ui/MoneyBagIcon'

const TABS = [
  { id: 'all', label: 'Semua' },
  { id: 'bank', label: 'Bank' },
  { id: 'ewallet', label: 'E-Wallet' },
  { id: 'investasi', label: 'Investasi' },
  { id: 'lainnya', label: 'Lainnya' }
]

const getAvatarColor = (name) => {
  const colors = [
    'bg-sky-500/15 text-sky-400',
    'bg-emerald-500/15 text-emerald-400',
    'bg-violet-500/15 text-violet-400',
    'bg-amber-500/15 text-amber-400',
    'bg-rose-500/15 text-rose-400',
    'bg-teal-500/15 text-teal-400',
    'bg-fuchsia-500/15 text-fuchsia-400',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function InstitutionLogo({ inst, size = 'md' }) {
  const sizeClasses = size === 'lg'
    ? 'w-12 h-12 rounded-full text-[15px]'
    : 'w-10 h-10 rounded-full text-[13px]'

  return (
    <div className={`${sizeClasses} bg-[var(--field-bg)] flex items-center justify-center overflow-hidden shrink-0`}>
      {inst.customIcon === 'dollar' ? (
        <div className={`w-full h-full flex items-center justify-center bg-[var(--field-bg)] text-amber-500 drop-shadow-sm`}>
          <MoneyBagIcon size={size === 'lg' ? 24 : 20} strokeWidth={2.5} />
        </div>
      ) : getWalletLogoUrl(inst) ? (
        <img
          src={getWalletLogoUrl(inst)}
          alt={inst.name}
          className="w-full h-full object-contain p-[2px]"
          onError={(e) => {
            e.target.style.display = 'none'
            e.target.nextSibling.style.display = 'flex'
            e.target.parentElement.className = `${sizeClasses} flex items-center justify-center overflow-hidden shrink-0 ${getAvatarColor(inst.name)}`
          }}
        />
      ) : null}
      <div
        className={`w-full h-full items-center justify-center font-bold ${getAvatarColor(inst.name)}`}
        style={{ display: inst.customIcon || getWalletLogoUrl(inst) ? 'none' : 'flex' }}
      >
        {inst.name.substring(0, 2).toUpperCase()}
      </div>
    </div>
  )
}

export default function AddAccountPage({ isOnboarding, onBack, onSuccess }) {
  const navigate = useNavigate()
  const scrollRef = useRef(null)

  const wallets = useLiveQuery(() => db.wallets.toArray()) || []

  const isInstitutionAdded = (inst) => {
    return wallets.some(w => {
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
    return walletInstitutions.filter(inst => {
      const matchTab = activeTab === 'all' || inst.type === activeTab
      const matchSearch = inst.name.toLowerCase().includes(search.toLowerCase())
      return matchTab && matchSearch
    })
  }, [search, activeTab])

  const recommended = activeTab === 'all' ? filteredData.filter(i => i.isRecommended) : []
  const others = activeTab === 'all' ? filteredData.filter(i => !i.isRecommended) : filteredData

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
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[var(--bg)]/90 backdrop-blur-md pb-1 border-b border-[var(--border)]">
        <div className="flex items-center px-4 pt-4 pb-3">
          <button
            onClick={() => isOnboarding && onBack ? onBack() : navigate(-1)}
            className="p-2 -ml-2 rounded-full text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="flex-1 text-center text-base font-bold text-[var(--fg)] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Tambah Akun
          </h1>
          {/* Spacer to center title */}
          <div className="w-9" />
        </div>

        {/* ── Search ──────────────────────────────────────────── */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-2)]" />
            <input
              type="text"
              placeholder="Cari akun atau mata uang"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl bg-[var(--field-bg)] py-3 pl-10 pr-4 text-[14px] text-[var(--fg)] font-medium placeholder:text-[var(--muted)] border border-[var(--border)] focus:border-[var(--fg)] transition outline-none"
            />
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto ft-hide-scrollbar px-4 pb-3">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-5 py-2 rounded-full text-[13px] font-bold transition-all border-[1.5px] ${
                activeTab === tab.id
                  ? 'bg-[var(--fg)] border-[var(--fg)] text-[var(--bg)] shadow-md'
                  : 'bg-[var(--field-bg)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-24">

        {/* ── Rekomendasi (horizontal scroll cards) ─────────── */}
        {recommended.length > 0 && (
          <section className="mt-1">
            <h2 className="px-4 mb-3 text-[15px] font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
              Rekomendasi
            </h2>
            <div ref={scrollRef} className="flex overflow-x-auto gap-4 px-4 pb-2 ft-no-scrollbar" style={{ scrollbarWidth: 'none' }}>
              {recommended.map(inst => {
                const added = isInstitutionAdded(inst)
                return (
                <button
                  key={inst.id}
                  onClick={() => {
                    if (!added) setSelectedInst(inst)
                  }}
                  disabled={added}
                  className={`relative flex flex-col items-center shrink-0 w-[110px] rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] p-4 pt-5 transition-all shadow-sm ${added ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:bg-[var(--panel)] active:scale-[0.97]'}`}
                >
                  {/* Star Icon for Rekomendasi */}
                  <div className="absolute top-2.5 left-2.5 text-yellow-500">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                  </div>
                  
                  {added && (
                    <div className="absolute top-1/2 -translate-y-1/2 bg-[var(--bg)] shadow-md border border-[var(--border)] px-1.5 py-0.5 rounded text-[9px] font-black uppercase text-rose-500 z-10 whitespace-nowrap">
                      Terdaftar
                    </div>
                  )}
                  
                  <InstitutionLogo inst={inst} size="lg" />
                  <span className="mt-3 text-[13px] font-semibold text-[var(--fg)] leading-tight text-center line-clamp-1">{inst.name}</span>
                  <span className="mt-0.5 text-[11px] text-[var(--muted)] text-center leading-tight">{inst.subtitle || 'Indonesian Rupiah'}</span>
                </button>
              )})}
            </div>
          </section>
        )}

        {/* ── Grouped Category Sections (Idea 4) ────────────────────── */}
        {(() => {
          const SECTION_MAP = [
            { id: 'bank', title: 'Bank Digital & Nasional' },
            { id: 'ewallet', title: 'E-Wallet & Transaksi' },
            { id: 'investasi', title: 'Platform Investasi & Crypto' },
            { id: 'lainnya', title: 'Kas & Lainnya' },
          ]

          return SECTION_MAP.map((sec) => {
            const secItems = filteredData.filter((i) => i.type === sec.id)
            if (secItems.length === 0) return null

            return (
              <section key={sec.id} className="mt-5">
                <div className="flex items-center justify-between px-4 mb-2">
                  <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                    {sec.title} ({secItems.length})
                  </h2>
                </div>
                <div className="divide-y divide-[var(--border)] border-y border-[var(--border)] bg-[var(--field-bg)]">
                  {secItems.map((inst) => {
                    const added = isInstitutionAdded(inst)
                    return (
                      <button
                        key={inst.id}
                        onClick={() => {
                          if (!added) setSelectedInst(inst)
                        }}
                        disabled={added}
                        className={`w-full flex items-center gap-3.5 px-4 py-3 text-left transition group ${
                          added
                            ? 'opacity-50 grayscale cursor-not-allowed'
                            : 'hover:bg-[var(--panel)] active:scale-[0.99]'
                        }`}
                      >
                        <InstitutionLogo inst={inst} size="md" />
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-[var(--fg)] truncate">{inst.name}</p>
                            <p className="text-[11px] text-[var(--muted)] mt-0.5 truncate">{inst.subtitle || 'Indonesian Rupiah'}</p>
                          </div>
                          {added && (
                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              Terdaftar
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })
        })()}

        {/* ── All as list when searching ────────────────────────── */}
        {recommended.length > 0 && others.length === 0 && search && (
          <section className="mt-2">
            {recommended.map(inst => {
              const added = isInstitutionAdded(inst)
              return (
              <button
                key={inst.id}
                onClick={() => {
                  if (!added) setSelectedInst(inst)
                }}
                disabled={added}
                className={`w-full flex items-center gap-4 px-4 py-3.5 text-left transition group ${added ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:bg-[var(--panel)] active:bg-[var(--field-bg)]'}`}
              >
                <div className="relative">
                  <InstitutionLogo inst={inst} size="md" />
                </div>
                <div className="flex-1 min-w-0 border-b border-[var(--border)] pb-3.5 -mb-3.5 group-last:border-b-0 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-[var(--fg)] truncate">{inst.name}</p>
                    <p className="text-[12px] text-[var(--muted)] mt-0.5">{inst.subtitle || 'Indonesian Rupiah'}</p>
                  </div>
                  {added && (
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wide bg-rose-500/10 px-2 py-1 rounded-md">Terdaftar</span>
                  )}
                </div>
              </button>
            )})}
          </section>
        )}

        {/* ── Akun Diarsip ────────────────────────────────────────── */}
        {(() => {
          const archived = (wallets || []).filter(w => w.isArchived)
          if (archived.length === 0) return null
          return (
            <section className="mt-4 px-4">
              <h2 className="mb-2 text-[15px] font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
                Akun Diarsip ({archived.length})
              </h2>
              <div className="space-y-2">
                {archived.map(w => (
                  <button
                    key={w.id}
                    onClick={() => navigate(`/wallet/${w.id}`)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] text-left hover:bg-[var(--panel)] transition active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--panel-strong)] flex items-center justify-center font-bold text-xs text-[var(--fg)] border border-[var(--border)] overflow-hidden">
                        {getWalletLogoUrl(w) ? (
                          <img src={getWalletLogoUrl(w)} alt={w.name} className="w-full h-full object-contain p-[2px] rounded-full" />
                        ) : (
                          w.name?.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-[var(--fg)]">{w.name}</p>
                        <p className="text-[11px] text-amber-500 font-semibold">Diarsipkan</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[var(--muted)]">Lihat / Buka</span>
                  </button>
                ))}
              </div>
            </section>
          )
        })()}

        {/* ── Empty State ──────────────────────────────────────── */}
        {filteredData.length === 0 && search && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Search size={36} className="text-muted-2 opacity-40 mb-3" />
            <h3 className="text-[15px] font-semibold text-fg">Tidak ditemukan</h3>
            <p className="text-[13px] text-muted mt-1 max-w-[240px]">
              Akun &lsquo;{search}&rsquo; tidak ada dalam preset.
            </p>
          </div>
        )}
      </div>

      {/* ── Sticky bottom: Tambah Akun Lain ────────────────────── */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6"
        style={{ background: 'linear-gradient(to top, var(--bg) 75%, transparent)' }}
      >
        <button
          onClick={() => setSelectedInst('custom')}
          className="relative w-full flex items-center justify-center py-4 rounded-xl bg-gray-100 border border-black/5 text-gray-800 font-bold text-[15px] transition hover:bg-gray-200 active:scale-[0.98]"
        >
          <span>Tambah Akun Lain</span>
          <div className="absolute right-3 bg-white shadow-sm border border-black/5 text-gray-700 rounded-lg p-1.5 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </div>
        </button>
      </div>
    </div>
  )
}
