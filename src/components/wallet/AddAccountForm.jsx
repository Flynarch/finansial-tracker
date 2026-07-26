import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Edit2, Check, ChevronDown, XCircle, Sparkles } from 'lucide-react'
import useWalletStore from '../../store/useWalletStore'
import MoneyBagIcon from '../ui/MoneyBagIcon'
import { getWalletLogoUrl } from '../../data/walletInstitutions'

const COLOR_PRESETS = [
  { id: 'blue', name: 'Ocean Blue', bgClass: 'from-blue-600 to-indigo-800', dotClass: 'bg-blue-600' },
  { id: 'emerald', name: 'Emerald', bgClass: 'from-emerald-600 to-teal-800', dotClass: 'bg-emerald-600' },
  { id: 'purple', name: 'Royal Purple', bgClass: 'from-purple-600 to-indigo-900', dotClass: 'bg-purple-600' },
  { id: 'amber', name: 'Sunset Amber', bgClass: 'from-amber-500 to-orange-700', dotClass: 'bg-amber-500' },
  { id: 'rose', name: 'Crimson Rose', bgClass: 'from-rose-600 to-pink-800', dotClass: 'bg-rose-600' },
  { id: 'slate', name: 'Slate Dark', bgClass: 'from-slate-700 to-slate-900', dotClass: 'bg-slate-700' },
]

export default function AddAccountForm({ institution, onBack, onSuccess }) {
  const navigate = useNavigate()
  const createWallet = useWalletStore(state => state.createWallet)

  const [name, setName] = useState(institution ? institution.name : 'Akun Baru')
  const [isEditingName, setIsEditingName] = useState(!institution)
  const [currency, setCurrency] = useState('IDR')
  const [colorTheme, setColorTheme] = useState('blue')
  
  const [displayBalance, setDisplayBalance] = useState('')
  const [rawBalance, setRawBalance] = useState(0)

  const handleBalanceChange = (e) => {
    const val = e.target.value.replace(/\D/g, '')
    if (!val) {
      setDisplayBalance('')
      setRawBalance(0)
      return
    }
    const num = parseInt(val, 10)
    setRawBalance(num)
    setDisplayBalance(num.toLocaleString('id-ID'))
  }

  const addPresetAmount = (amount) => {
    const newTotal = rawBalance + amount
    setRawBalance(newTotal)
    setDisplayBalance(newTotal.toLocaleString('id-ID'))
  }

  const clearBalance = () => {
    setDisplayBalance('')
    setRawBalance(0)
  }

  const getInitials = (text) => text ? text.substring(0, 2).toUpperCase() : ''
  const logo = getWalletLogoUrl(institution)

  const selectedThemeObj = COLOR_PRESETS.find(c => c.id === colorTheme) || COLOR_PRESETS[0]

  const isFormValid = name.trim().length > 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isFormValid) return
    
    const newId = await createWallet({
      name,
      institutionType: institution ? institution.type : 'lainnya',
      logoUrl: institution ? institution.logoUrl : null,
      customIcon: institution ? institution.customIcon : null,
      colorTheme,
      currency,
      balance: rawBalance,
      createdAt: Date.now()
    })
    
    if (onSuccess) {
      onSuccess(newId)
    } else {
      navigate(`/wallet/${newId}`)
    }
  }

  return (
    <div className="ft-page-enter min-h-screen flex flex-col bg-[var(--bg)]">
      {/* ── Top Header Section ──────────────────────────────────── */}
      <div className="relative bg-[var(--panel-strong)] pt-5 pb-6 px-5 rounded-b-3xl shrink-0 border-b border-[var(--border)] shadow-xs z-10">
        
        {/* Nav Bar */}
        <div className="relative z-10 flex items-center justify-between mb-5">
          <button 
            type="button"
            onClick={onBack} 
            className="p-2 -ml-2 text-[var(--fg)] hover:bg-[var(--field-bg)] rounded-full transition active:scale-95"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)]">
            <Sparkles size={12} className="text-[var(--accent)]" />
            <span>{institution ? (institution.type || 'Bank') : 'Akun Custom'}</span>
          </div>

          <div className="w-8" />
        </div>

        {/* ── Live Virtual Wallet Card Preview ──────────────────────── */}
        <div className="relative z-10 mx-auto max-w-sm">
          <div className={`relative h-44 w-full overflow-hidden rounded-2xl bg-gradient-to-br ${selectedThemeObj.bgClass} p-5 text-white shadow-xl transition-all duration-300 flex flex-col justify-between`}>
            
            {/* Card Glassmorphic Overlay Decorative Circles */}
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
            <div className="absolute -left-6 -bottom-6 h-28 w-28 rounded-full bg-black/10 blur-lg pointer-events-none" />

            {/* Top Row: Institution Logo & Currency */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 backdrop-blur-md shadow-xs">
                  {institution?.customIcon === 'dollar' ? (
                    <MoneyBagIcon size={22} className="text-amber-300" strokeWidth={2.5} />
                  ) : logo ? (
                    <img 
                      src={logo} 
                      alt={name} 
                      className="h-full w-full object-contain p-[2px] rounded-full"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <span 
                    className="text-xs font-black text-white"
                    style={{ display: institution?.customIcon === 'dollar' || logo ? 'none' : 'flex' }}
                  >
                    {getInitials(name)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/70">
                    {institution ? institution.name : 'Kartu Dompet'}
                  </span>
                </div>
              </div>

              <span className="rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-md">
                {currency}
              </span>
            </div>

            {/* Middle/Bottom Row: Live Balance & Account Name */}
            <div className="relative z-10 mt-auto">
              <span className="text-[10px] font-bold tracking-wider text-white/70 uppercase">
                Saldo Awal
              </span>
              <p className="text-2xl font-black tracking-tight text-white drop-shadow-sm truncate">
                {currency === 'IDR' ? 'Rp ' : '$ '}
                {rawBalance > 0 ? rawBalance.toLocaleString('id-ID') : '0'}
              </p>

              <div className="mt-2 flex items-center justify-between border-t border-white/15 pt-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white/90">
                    {name || 'Nama Akun'}
                  </p>
                </div>
                <span className="text-[9px] font-mono tracking-widest text-white/50 uppercase">
                  ACTIVE
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Form Section ────────────────────────────────────────────── */}
      <div className="flex-1 px-5 pt-6 pb-28 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* 1. Nama Akun Input */}
          <div className="space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] pl-1">
              Nama Akun / Dompet
            </label>
            <div className="relative flex items-center rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] focus-within:border-[var(--fg)] transition-all">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: BCA Tabungan Utama"
                className="w-full bg-transparent py-3.5 px-4 text-sm font-bold text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
              />
              {name && (
                <button
                  type="button"
                  onClick={() => setName('')}
                  className="pr-4 text-[var(--muted)] hover:text-[var(--fg)] transition"
                >
                  <XCircle size={18} />
                </button>
              )}
            </div>
          </div>

          {/* 2. Palet Warna Aksen Dompet (Ide 2) */}
          <div className="space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] pl-1">
              Warna Tema Dompet
            </label>
            <div className="grid grid-cols-6 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3">
              {COLOR_PRESETS.map((preset) => {
                const isSelected = colorTheme === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setColorTheme(preset.id)}
                    className={`group relative flex h-9 w-full items-center justify-center rounded-xl ${preset.dotClass} transition-transform active:scale-90`}
                    title={preset.name}
                  >
                    {isSelected && (
                      <Check size={16} className="text-white drop-shadow-md" strokeWidth={3} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3. Saldo Saat Ini & Quick Balance Preset Chips (Ide 1) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pl-1">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                Saldo Saat Ini
              </label>
              {rawBalance > 0 && (
                <button
                  type="button"
                  onClick={clearBalance}
                  className="text-[10px] font-bold text-rose-500 hover:underline"
                >
                  Reset Saldo
                </button>
              )}
            </div>

            <div className="relative flex items-center rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] focus-within:border-[var(--fg)] transition-all">
              <span className="pl-4 font-black text-sm text-[var(--muted)] pointer-events-none">
                {currency === 'IDR' ? 'Rp' : '$'}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={displayBalance}
                onChange={handleBalanceChange}
                placeholder="0"
                className="w-full bg-transparent py-3.5 pl-2 pr-10 text-xl font-extrabold text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
              />
            </div>

            {/* Quick Balance Preset Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto ft-hide-scrollbar pt-1">
              {[
                { label: '+100rb', val: 100000 },
                { label: '+500rb', val: 500000 },
                { label: '+1jt', val: 1000000 },
                { label: '+5jt', val: 5000000 },
                { label: '+10jt', val: 10000000 },
              ].map((chip) => (
                <button
                  key={chip.val}
                  type="button"
                  onClick={() => addPresetAmount(chip.val)}
                  className="whitespace-nowrap rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] hover:border-[var(--border-strong)] active:scale-95 transition"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Mata Uang Selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] pl-1">
              Mata Uang
            </label>
            <div className="relative">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] py-3.5 pl-4 pr-10 text-xs font-bold text-[var(--fg)] outline-none focus:border-[var(--fg)] transition cursor-pointer"
              >
                <option value="IDR">IDR - Indonesian Rupiah</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="SGD">SGD - Singapore Dollar</option>
                <option value="JPY">JPY - Japanese Yen</option>
                <option value="MYR">MYR - Malaysian Ringgit</option>
              </select>
              <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
            </div>
          </div>
        </form>
      </div>

      {/* ── Fixed Bottom Submit Button ────────────────────────────── */}
      <div className="sticky bottom-0 mt-auto border-t border-[var(--border)] bg-[var(--bg)] p-4">
        <button
          type="submit"
          onClick={handleSubmit}
          disabled={!isFormValid}
          className={`w-full rounded-2xl py-3.5 text-xs font-black uppercase tracking-wider transition active:scale-[0.98] ${
            isFormValid 
              ? 'bg-[var(--accent)] text-[var(--bg)] shadow-md hover:opacity-90' 
              : 'bg-[var(--field-bg)] text-[var(--muted)] border border-[var(--border)] cursor-not-allowed'
          }`}
        >
          {institution ? 'Simpan Akun Baru' : 'Buat Akun Custom'}
        </button>
      </div>
    </div>
  )
}
