import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Check, Star } from 'lucide-react'
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

function InstitutionLogo({ inst, size = 'md' }) {
  const sizeClasses =
    size === 'lg'
      ? 'w-12 h-12 rounded-2xl text-[15px]'
      : 'w-10 h-10 rounded-xl text-[13px]'

  return (
    <div
      className={`${sizeClasses} bg-[var(--field-bg)] border border-[color-mix(in_srgb,var(--border)_60%,transparent)] flex items-center justify-center overflow-hidden shrink-0 shadow-2xs`}
    >
      {inst.customIcon === 'dollar' ? (
        <div className="w-full h-full flex items-center justify-center bg-[var(--field-bg)] text-amber-500 drop-shadow-xs">
          <MoneyBagIcon size={size === 'lg' ? 24 : 20} strokeWidth={2.5} />
        </div>
      ) : getWalletLogoUrl(inst) ? (
        <img
          src={getWalletLogoUrl(inst)}
          alt={inst.name}
          className="w-full h-full object-contain p-1"
          onError={(e) => {
            e.target.style.display = 'none'
            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
            e.target.parentElement.className = `${sizeClasses} flex items-center justify-center overflow-hidden shrink-0 ${getAvatarColor(inst.name)}`
          }}
        />
      ) : null}
      <div
        className={`w-full h-full items-center justify-center font-extrabold ${getAvatarColor(inst.name)}`}
        style={{ display: inst.customIcon || getWalletLogoUrl(inst) ? 'none' : 'flex' }}
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
      {/* ── Header Bar ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[var(--panel-strong)] pb-2 border-b border-[var(--border)] shadow-xs">
        <div className="px-4 pt-4 pb-2">
          <PageHeader
            title="Pilih Institusi / Dompet"
            onBack={() => (isOnboarding && onBack ? onBack() : navigate(-1))}
          />
        </div>

        {/* Search Field */}
        <div className="px-4 pb-2.5">
          <div className="relative flex items-center">
            <Search size={17} className="absolute left-3.5 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="Cari Bank, e-Wallet, atau Kas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl bg-[var(--field-bg)] py-3 pl-10 pr-4 text-sm font-semibold text-[var(--fg)] placeholder:text-[var(--muted-2)] border border-[var(--border)] focus:border-[var(--fg)] transition outline-none"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto ft-hide-scrollbar px-4 pb-1">
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

      {/* ── Content Grid ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-28 pt-3">
        {filteredData.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 px-4">
            {filteredData.map((inst) => {
              const added = isInstitutionAdded(inst)
              return (
                <button
                  key={inst.id}
                  onClick={() => {
                    if (!added) setSelectedInst(inst)
                  }}
                  disabled={added}
                  className={`relative flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer ${
                    added
                      ? 'bg-[var(--field-bg)]/40 border-[var(--border)]/40 opacity-50 grayscale cursor-not-allowed'
                      : 'bg-[var(--panel-strong)] border-[color-mix(in_srgb,var(--border)_70%,transparent)] shadow-xs hover:border-[var(--border-strong)] hover:shadow-sm'
                  }`}
                >
                  <InstitutionLogo inst={inst} size="md" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      {inst.isRecommended && (
                        <Star size={11} className="fill-amber-400 text-amber-400 shrink-0" />
                      )}
                      <p className="text-xs font-black text-[var(--fg)] truncate">{inst.name}</p>
                    </div>
                    <p className="text-[10px] font-bold text-[var(--muted)] truncate mt-0.5">
                      {inst.type === 'bank' ? 'Bank' : inst.type === 'ewallet' ? 'E-Wallet' : inst.type === 'investasi' ? 'Investasi' : 'Kas'}
                    </p>
                    {added && (
                      <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] font-black text-emerald-500 uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                        <Check size={9} strokeWidth={3} />
                        Terdaftar
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Search size={36} className="text-[var(--muted)] opacity-40 mb-3" />
            <h3 className="text-sm font-black text-[var(--fg)]">Tidak ditemukan</h3>
            <p className="text-xs font-medium text-[var(--muted)] mt-1 max-w-[240px]">
              Institusi &lsquo;{search}&rsquo; tidak ada dalam preset. Gunakan tombol kustom di bawah.
            </p>
          </div>
        )}
      </div>

      {/* ── Fixed Bottom Bar: Custom Account Button ─────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"
        style={{ background: 'linear-gradient(to top, var(--bg) 80%, transparent)' }}
      >
        <button
          onClick={() => setSelectedInst('custom')}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[var(--fg)] text-[var(--bg)] font-black text-xs shadow-md transition hover:opacity-90 active:scale-[0.98] cursor-pointer"
        >
          <Plus size={16} strokeWidth={3} />
          <span>Buat Akun / Dompet Kustom</span>
        </button>
      </div>
    </div>
  )
}
