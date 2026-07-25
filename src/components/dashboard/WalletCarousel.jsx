import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatCurrency } from '../../lib/utils'
import { ArrowDownLeft, ArrowUpRight, Plus } from 'lucide-react'
import MoneyBagIcon from '../ui/MoneyBagIcon'

export default function WalletCarousel({ 
  monthIncome, 
  monthExpense, 
  wallets, 
  defaultCurrency 
}) {
  const navigate = useNavigate()
  const [activeSlide, setActiveSlide] = useState(() => {
    const saved = sessionStorage.getItem('dashboard_carousel_slide')
    return saved ? parseInt(saved, 10) : 0
  })
  const scrollRef = useRef(null)
  const isRestoring = useRef(activeSlide > 0)
  const hasRestored = useRef(false)

  const sisaKeuangan = monthIncome - monthExpense
  const totalSaldo = wallets?.reduce((sum, w) => sum + (Number(w.currentBalance) || 0), 0) || 0

  const scrollTo = (index) => {
    if (!scrollRef.current) return
    const slides = scrollRef.current.children
    if (slides[index]) {
      scrollRef.current.scrollTo({
        left: slides[index].offsetLeft,
        behavior: 'smooth'
      })
    }
  }

  // Restore scroll position when wallets are loaded
  useEffect(() => {
    if (wallets !== undefined && !hasRestored.current) {
      hasRestored.current = true
      if (scrollRef.current && activeSlide > 0) {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            const slides = scrollRef.current.children
            if (slides[activeSlide]) {
              scrollRef.current.scrollTo({
                left: slides[activeSlide].offsetLeft,
                behavior: 'instant'
              })
            }
          }
          setTimeout(() => {
            isRestoring.current = false
          }, 150)
        })
      } else {
        isRestoring.current = false
      }
    }
  }, [wallets, activeSlide])

  // Loading state handling
  if (wallets === undefined) {
    return (
      <section className="mb-4">
        <div className="ft-hero-card h-[200px] animate-pulse" style={{ background: 'var(--field-bg)' }} />
      </section>
    )
  }

  // Empty state handling
  if (wallets.length === 0) {
    return (
      <section className="mb-4">
        <div className="ft-hero-card flex flex-col items-center justify-center text-center" style={{ minHeight: '200px' }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted-2)]">Total Saldo</p>
          <p className="ft-display mt-2 text-[2.25rem] leading-[1.1] font-black tracking-tight tabular-nums text-[var(--fg)]">
            {formatCurrency(0, defaultCurrency)}
          </p>
          <button 
            onClick={() => navigate('/add-account')}
            className="mt-6 w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--bg)] rounded-xl py-3 font-bold transition active:scale-[0.98]"
          >
            <Plus size={18} strokeWidth={2.5} />
            Tambah Akun
          </button>
        </div>
      </section>
    )
  }

  const handleScroll = () => {
    if (!scrollRef.current || isRestoring.current) return
    const scrollLeft = scrollRef.current.scrollLeft
    const width = scrollRef.current.clientWidth
    
    // Prevent divide by zero if width isn't ready
    if (width === 0) return 

    const index = Math.round(scrollLeft / width)
    if (index !== activeSlide) {
      setActiveSlide(index)
      sessionStorage.setItem('dashboard_carousel_slide', index.toString())
    }
  }


  return (
    <section className="mb-4 relative">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory ft-hide-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {/* SLIDE 1: Sisa Keuangan */}
        <div className="w-full shrink-0 snap-center ft-hero-card">
          {/* Header row */}
          <div className="relative z-10 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted-2)]">
              Sisa Keuangan
            </p>
            <span className="rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              Bulan Ini
            </span>
          </div>

          {/* Main amount */}
          <p className="relative z-10 ft-display mt-2 text-[2.25rem] leading-[1.05] font-black tracking-tight tabular-nums text-[var(--fg)] break-words">
            <span className="whitespace-nowrap">{formatCurrency(sisaKeuangan, defaultCurrency)}</span>
          </p>

          {/* Income / Expense stat pills */}
          <div className="relative z-10 mt-5 flex gap-2">
            {/* Income pill */}
            <div className="ft-stat-pill ft-stat-pill--income">
              <div className="ft-stat-pill-icon">
                <ArrowDownLeft size={16} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--status-income)' }}>
                  Pemasukan
                </p>
                <p className="mt-0.5 text-[12px] font-black tabular-nums truncate" style={{ color: 'var(--status-income)' }}>
                  {formatCurrency(monthIncome, defaultCurrency)}
                </p>
              </div>
            </div>
            
            {/* Expense pill */}
            <div className="ft-stat-pill ft-stat-pill--expense">
              <div className="ft-stat-pill-icon">
                <ArrowUpRight size={16} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--status-expense)' }}>
                  Pengeluaran
                </p>
                <p className="mt-0.5 text-[12px] font-black tabular-nums truncate" style={{ color: 'var(--status-expense)' }}>
                  {formatCurrency(monthExpense, defaultCurrency)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SLIDE 2: Total Saldo & Horizontal Mini Wallet Cards */}
        <div className="w-full shrink-0 snap-center ft-hero-card ml-4 flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="relative z-10 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted-2)]">
                Total Saldo
              </p>
              <span className="rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                {wallets.length} Akun
              </span>
            </div>

            {/* Main amount */}
            <p className="relative z-10 ft-display mt-2 break-all text-[2.25rem] leading-[1.05] font-black tracking-tight tabular-nums text-[var(--fg)]">
              {formatCurrency(totalSaldo, defaultCurrency)}
            </p>
          </div>

          {/* Mini Wallet Cards Horizontal Scroll (Logo + Saldo Uang) */}
          <div className="relative z-10 mt-5 flex overflow-x-auto gap-2.5 pb-1 ft-hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
            {wallets.map(w => (
              <button 
                key={w.id}
                onClick={() => navigate(`/wallet/${w.id}`)}
                className="ft-wallet-mini"
              >
                {/* Logo (prominent) */}
                <div className="ft-wallet-mini-logo">
                  {w.customIcon === 'dollar' || w.name?.toLowerCase() === 'cash' ? (
                    <div className="w-full h-full flex items-center justify-center text-amber-500">
                      <MoneyBagIcon size={18} strokeWidth={2.5} />
                    </div>
                  ) : w.logoUrl ? (
                    <img src={w.logoUrl} alt={w.name} className="w-full h-full object-contain p-1" />
                  ) : (
                    <span className="text-[11px] font-bold text-[var(--fg)]">{w.name.substring(0,2).toUpperCase()}</span>
                  )}
                </div>
                {/* Saldo Uang */}
                <span className="ft-wallet-mini-balance">{formatCurrency(w.currentBalance, defaultCurrency)}</span>
              </button>
            ))}
            
            {/* Tambah Akun Card */}
            <button 
              onClick={() => navigate('/add-account')}
              className="ft-wallet-mini"
              style={{ borderStyle: 'dashed' }}
            >
              <div className="ft-wallet-mini-logo" style={{ background: 'var(--fg)', color: 'var(--bg)', border: 'none' }}>
                <Plus size={16} strokeWidth={2.5} />
              </div>
              <span className="ft-wallet-mini-balance" style={{ color: 'var(--muted)', fontSize: '12px' }}>Tambah</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dots Indicator */}
      <div className="flex justify-center gap-2 mt-3">
        <button 
          onClick={() => scrollTo(0)} 
          className={`h-2 rounded-full transition-all ${activeSlide === 0 ? 'w-5 bg-[var(--accent)]' : 'w-2 bg-[var(--border-strong)]'}`} 
          aria-label="Slide 1" 
        />
        <button 
          onClick={() => scrollTo(1)} 
          className={`h-2 rounded-full transition-all ${activeSlide === 1 ? 'w-5 bg-[var(--accent)]' : 'w-2 bg-[var(--border-strong)]'}`} 
          aria-label="Slide 2" 
        />
      </div>
    </section>
  )
}
