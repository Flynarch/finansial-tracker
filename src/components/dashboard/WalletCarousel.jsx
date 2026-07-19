import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatCurrency } from '../../lib/utils'
import { ArrowUpRight, ArrowDownRight, Plus } from 'lucide-react'
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
        <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--field-bg)] h-[180px] animate-pulse" />
      </section>
    )
  }

  // Empty state handling
  if (wallets.length === 0) {
    return (
      <section className="mb-4">
        <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel-strong)] p-6 shadow-sm sm:p-8 flex flex-col items-center justify-center text-center">
          <p className="text-[12px] font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Total Saldo</p>
          <p className="ft-display break-all text-[2.75rem] leading-[1.1] font-black tracking-tight tabular-nums text-[var(--fg)] mb-6">
            {formatCurrency(0, defaultCurrency)}
          </p>
          <button 
            onClick={() => navigate('/add-account')}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-3.5 font-bold hover:bg-blue-700 transition"
          >
            <Plus size={20} strokeWidth={2.5} />
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
        className="flex overflow-x-auto snap-x snap-mandatory ft-no-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* SLIDE 1: Sisa Keuangan */}
        <div className="w-full shrink-0 snap-center rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-sm sm:p-8">
          <p className="text-[12px] font-bold uppercase tracking-widest text-[var(--muted)]">Sisa Keuangan</p>
          <p className="ft-display mt-1.5 text-[2.75rem] leading-[1.1] font-black tracking-tight tabular-nums text-[var(--fg)] break-words">
            <span className="whitespace-nowrap">{formatCurrency(sisaKeuangan, defaultCurrency)}</span>
          </p>

          <div className="mt-6 flex gap-2">
            <div className="flex-1 rounded-xl bg-green-500/10 p-2 border border-green-500/20">
              <div className="flex items-center gap-1 text-green-600 mb-0.5">
                <ArrowDownRight size={12} strokeWidth={3} />
                <span className="text-[9px] font-bold uppercase tracking-wider">Pemasukan</span>
              </div>
              <p className="font-black text-green-700 tabular-nums text-[12px] truncate">{formatCurrency(monthIncome, defaultCurrency)}</p>
            </div>
            
            <div className="flex-1 rounded-xl bg-rose-500/10 p-2 border border-rose-500/20">
              <div className="flex items-center gap-1 text-rose-600 mb-0.5">
                <ArrowUpRight size={12} strokeWidth={3} />
                <span className="text-[9px] font-bold uppercase tracking-wider">Pengeluaran</span>
              </div>
              <p className="font-black text-rose-700 tabular-nums text-[12px] truncate">{formatCurrency(monthExpense, defaultCurrency)}</p>
            </div>
          </div>
        </div>

        {/* SLIDE 2: Total Saldo & Wallets */}
        <div className="w-full shrink-0 snap-center rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-sm sm:p-8 flex flex-col justify-between ml-4">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-widest text-[var(--muted)]">Total Saldo</p>
            <p className="ft-display mt-1.5 break-all text-[2.75rem] leading-[1.1] font-black tracking-tight tabular-nums text-[var(--fg)]">
              {formatCurrency(totalSaldo, defaultCurrency)}
            </p>
          </div>

          <div className="mt-6 flex overflow-x-auto gap-3 pb-2 ft-no-scrollbar" style={{ scrollbarWidth: 'none' }}>
            {wallets.map(w => (
              <button 
                key={w.id}
                onClick={() => navigate(`/wallet/${w.id}`)}
                className="shrink-0 flex items-center gap-2.5 bg-[var(--field-bg)] border border-[var(--border)] rounded-[14px] p-2 pr-3.5 hover:bg-[var(--panel)] transition active:scale-95"
              >
                <div className="w-8 h-8 rounded-full bg-[var(--field-bg)] flex items-center justify-center overflow-hidden shrink-0 shadow-sm border border-[var(--border)]">
                  {w.customIcon === 'dollar' || w.name?.toLowerCase() === 'cash' ? (
                    <div className="w-full h-full flex items-center justify-center text-amber-500 drop-shadow-sm">
                      <MoneyBagIcon size={16} strokeWidth={2.5} />
                    </div>
                  ) : w.logoUrl ? (
                    <img src={w.logoUrl} alt={w.name} className="w-full h-full object-contain p-1.5" />
                  ) : (
                    <span className="text-[10px] font-bold text-[var(--fg)]">{w.name.substring(0,2).toUpperCase()}</span>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-[12px] font-bold text-[var(--fg)] tabular-nums whitespace-nowrap">{formatCurrency(w.currentBalance, defaultCurrency)}</p>
                </div>
              </button>
            ))}
            
            {/* Tambah Akun Mini Card */}
            <button 
              onClick={() => navigate('/add-account')}
              className="shrink-0 flex items-center gap-2 bg-[var(--field-bg)] border border-[var(--border)] rounded-[14px] p-2 pr-3.5 hover:bg-[var(--panel)] transition active:scale-95"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--fg)] text-[var(--bg)] flex items-center justify-center shrink-0 shadow-sm">
                <Plus size={16} strokeWidth={3} />
              </div>
              <p className="text-[12px] font-bold text-[var(--fg)] whitespace-nowrap">Tambah Akun</p>
            </button>
          </div>
        </div>
      </div>

      {/* Dots Indicator */}
      <div className="flex justify-center gap-1.5 mt-3">
        <button 
          onClick={() => scrollTo(0)} 
          className={`h-1.5 rounded-full transition-all ${activeSlide === 0 ? 'w-4 bg-[var(--accent)]' : 'w-1.5 bg-[var(--border-strong)]'}`} 
          aria-label="Slide 1" 
        />
        <button 
          onClick={() => scrollTo(1)} 
          className={`h-1.5 rounded-full transition-all ${activeSlide === 1 ? 'w-4 bg-[var(--accent)]' : 'w-1.5 bg-[var(--border-strong)]'}`} 
          aria-label="Slide 2" 
        />
      </div>
    </section>
  )
}
