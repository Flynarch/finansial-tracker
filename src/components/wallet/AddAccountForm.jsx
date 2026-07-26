import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Edit2, Check, ChevronDown, DollarSign, XCircle } from 'lucide-react'
import useWalletStore from '../../store/useWalletStore'
import MoneyBagIcon from '../ui/MoneyBagIcon'

export default function AddAccountForm({ institution, onBack, onSuccess }) {
  const navigate = useNavigate()
  const createWallet = useWalletStore(state => state.createWallet)

  const [name, setName] = useState(institution ? institution.name : 'Akun Baru')
  const [isEditingName, setIsEditingName] = useState(!institution)
  const [currency, setCurrency] = useState('IDR')
  
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

  const clearBalance = () => {
    setDisplayBalance('')
    setRawBalance(0)
  }

  const getInitials = (text) => text ? text.substring(0, 2).toUpperCase() : ''

  // Fix: Can be submitted even if balance is 0.
  const isFormValid = name.trim().length > 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isFormValid) return
    
    const newId = await createWallet({
      name,
      institutionType: institution ? institution.type : 'lainnya',
      logoUrl: institution ? institution.logoUrl : null,
      customIcon: institution ? institution.customIcon : null,
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
      {/* ── Top Curved Section (Hero) ──────────────────────────────────── */}
      <div className="relative bg-[var(--panel-strong)] pt-6 pb-8 px-6 rounded-b-3xl shrink-0 border-b border-[var(--border)] shadow-[0_4px_24px_rgba(0,0,0,0.02)] z-10">
        
        {/* Subtle Background Glow/Pattern (Glassmorphism touch) */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--fg)]/[0.02] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--fg)]/[0.03] rounded-full blur-2xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />

        {/* Header Nav */}
        <div className="relative z-10 flex items-center justify-center mb-8">
          <button onClick={onBack} className="absolute left-0 p-2.5 -ml-2 text-[var(--fg)] hover:bg-[var(--fg)]/10 rounded-full transition active:scale-95">
            <ChevronLeft size={28} strokeWidth={2.5} />
          </button>
          
          <div className="bg-[var(--fg)]/5 backdrop-blur-md border border-[var(--border)] text-[var(--fg)] px-5 py-1.5 rounded-full text-[13px] font-bold shadow-sm">
            Akun Manual
          </div>
        </div>

        {/* Logo and Name */}
        <div className="relative z-10 flex flex-col items-center justify-center mt-2">
          <div className="flex flex-col items-center gap-4">
            
            {/* Logo Circle with Premium Ring */}
            <div className="w-[52px] h-[52px] rounded-full bg-[var(--field-bg)] flex items-center justify-center overflow-hidden shrink-0 shadow-md ring-4 ring-[var(--panel)]">
              {institution?.customIcon === 'dollar' ? (
                <div className="w-full h-full flex items-center justify-center text-amber-500 drop-shadow-sm">
                  <MoneyBagIcon size={28} strokeWidth={2.5} />
                </div>
              ) : institution?.logoUrl ? (
                <img 
                  src={institution.logoUrl} 
                  alt={name} 
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div 
                className="w-full h-full flex items-center justify-center font-extrabold text-[17px] text-[var(--fg)]"
                style={{ display: institution?.customIcon === 'dollar' || institution?.logoUrl ? 'none' : 'flex' }}
              >
                {getInitials(name)}
              </div>
            </div>

            {/* Name Input / Display */}
            {isEditingName ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-transparent border-b-2 border-[var(--border)] focus:border-[var(--fg)] text-[var(--fg)] font-extrabold text-[28px] w-[180px] text-center outline-none placeholder:text-[var(--muted)] transition-colors pb-1"
                  autoFocus
                  onBlur={() => setIsEditingName(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                />
                <button onClick={() => setIsEditingName(false)} className="p-2 bg-[var(--fg)] text-[var(--bg)] rounded-full shadow-[0_4px_14px_rgb(0,0,0,0.1)] hover:scale-105 active:scale-95 transition-all">
                  <Check size={18} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 mt-1 cursor-pointer group" onClick={() => setIsEditingName(true)}>
                <h2 className="text-[28px] font-extrabold text-[var(--fg)] tracking-tight">{name}</h2>
                <div className="p-1.5 bg-[var(--fg)]/10 rounded-full group-hover:bg-[var(--fg)]/20 transition-colors">
                  <Edit2 size={14} className="text-[var(--fg)]" strokeWidth={2.5} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Section (White Form) ──────────────────────────────────── */}
      <div className="flex-1 px-6 pt-10 pb-32 relative">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Mata Uang */}
          <div className="space-y-3">
            <label className="text-[12px] font-extrabold text-[var(--muted)] uppercase tracking-[0.1em] pl-1">
              Mata Uang
            </label>
            <div className="relative group">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-[var(--field-bg)] hover:bg-[var(--panel)] border border-[var(--border)] rounded-2xl py-3.5 pl-5 pr-12 text-[15px] font-bold text-[var(--fg)] appearance-none outline-none focus:border-[var(--fg)] transition-all cursor-pointer shadow-sm"
              >
                <option value="IDR">Indonesian Rupiah (IDR)</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="SGD">Singapore Dollar (SGD)</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-active:scale-95">
                <ChevronDown size={20} className="text-[var(--muted)] stroke-[2.5px]" />
              </div>
            </div>
          </div>
          
          {/* Saldo Saat Ini */}
          <div className="space-y-3">
            <label className="text-[12px] font-extrabold text-[var(--muted)] uppercase tracking-[0.1em] pl-1">
              Saldo saat ini
            </label>
            <div className="relative flex items-center bg-[var(--field-bg)] border border-[var(--border)] rounded-2xl focus-within:border-[var(--fg)] transition-all shadow-sm hover:border-[var(--border)]">
              <span className="pl-5 text-[var(--muted)] font-bold text-lg pointer-events-none">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={displayBalance}
                onChange={handleBalanceChange}
                placeholder="0"
                className="w-full bg-transparent py-3.5 pl-3 pr-14 font-extrabold text-[22px] text-[var(--fg)] outline-none placeholder:text-[var(--muted-2)] tracking-tight"
              />
              {displayBalance && (
                <button 
                  type="button" 
                  onClick={clearBalance}
                  className="absolute right-4 text-[var(--muted-2)] hover:text-[var(--fg)] transition-colors active:scale-95 p-1"
                >
                  <XCircle size={22} className="fill-[var(--field-bg)]" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* ── Fixed Bottom Button ────────────────────────────────────────── */}
      <div className="p-4 bg-[var(--bg)] mt-auto sticky bottom-0 border-t border-[var(--border)]">
        <button
          type="submit"
          onClick={handleSubmit}
          disabled={!isFormValid}
          className={`w-full py-3.5 rounded-2xl font-bold transition active:scale-[0.97] shadow-sm ${
            isFormValid 
              ? 'bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--fg)]/90' 
              : 'bg-[var(--field-bg)] text-[var(--muted-2)] cursor-not-allowed border border-[var(--border)]'
          }`}
        >
          {institution ? 'Simpan Akun' : 'Lanjut'}
        </button>
      </div>
    </div>
  )
}
