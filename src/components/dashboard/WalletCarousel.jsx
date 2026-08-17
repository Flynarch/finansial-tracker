import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatCurrency, convertCurrency, FALLBACK_EXCHANGE_RATES } from '../../lib/utils'
import { ArrowDownLeft, ArrowUpRight, Plus, Star } from 'lucide-react'
import MoneyBagIcon from '../ui/MoneyBagIcon'
import { getWalletLogoUrl } from '../../data/walletInstitutions'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'

export default function WalletCarousel({ 
  monthIncome, 
  monthExpense, 
  wallets, 
  defaultCurrency,
  rates = FALLBACK_EXCHANGE_RATES,
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const defaultWalletId = useSettingsStore((state) => state.defaultWalletId)
  const [activeSlide, setActiveSlide] = useState(() => {
    const saved = sessionStorage.getItem('dashboard_carousel_slide')
    return saved ? parseInt(saved, 10) : 0
  })
  const scrollRef = useRef(null)
  const isRestoring = useRef(activeSlide > 0)
  const hasRestored = useRef(false)

  const activeWallets = wallets?.filter(w => !w.isArchived) || []
  const sisaKeuangan = monthIncome - monthExpense
  const totalSaldo = activeWallets.reduce((sum, w) => {
    const bal = Number(w.currentBalance) || 0
    return sum + convertCurrency(bal, w.currency || defaultCurrency, defaultCurrency, rates)
  }, 0)

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
                behavior: 'auto'
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
  if (wallets === undefined || wallets === null) {
    return (
      <section className="relative ft-stagger-in" style={{ '--stagger': 0 }}>
        <div className="ft-hero-card flex flex-col justify-between p-5 h-[200px] animate-pulse border border-[var(--border)] bg-[var(--panel-strong)] rounded-3xl">
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-28 rounded-md bg-[var(--border)]/70" />
            <div className="h-4 w-4 rounded-full bg-[var(--border)]/50" />
          </div>
          <div className="space-y-2">
            <div className="h-8 w-44 rounded-xl bg-[var(--border)]/80" />
            <div className="h-3 w-20 rounded-md bg-[var(--border)]/40" />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <div className="h-9 flex-1 rounded-xl bg-[var(--field-bg)] border border-[var(--border)]/60" />
            <div className="h-9 flex-1 rounded-xl bg-[var(--field-bg)] border border-[var(--border)]/60" />
          </div>
        </div>
      </section>
    )
  }

  // Empty state handling
  if (wallets.length === 0) {
    return (
      <section className="relative ft-stagger-in" style={{ '--stagger': 0 }}>
        <div className="ft-hero-card flex flex-col items-center justify-center text-center" style={{ minHeight: '200px' }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted-2)]">
            {t('dashboard.totalBalance', 'Total Saldo')}
          </p>
          <p className="ft-display mt-2 text-[2.25rem] leading-[1.1] font-black tracking-tight tabular-nums text-[var(--fg)]">
            {formatCurrency(0, defaultCurrency)}
          </p>
          <button 
            onClick={() => navigate('/add-account')}
            className="mt-6 w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--bg)] rounded-xl py-3 font-bold transition active:scale-[0.98]"
          >
            <Plus size={18} strokeWidth={2.5} />
            {t('wallet.addAccount', 'Tambah Akun')}
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
    <section className="relative ft-stagger-in" style={{ '--stagger': 0 }}>
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
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted-2)]">
                {t('dashboard.sisaKeuangan', 'Sisa Keuangan')}
              </p>
              {/* Inline Slide Indicator */}
              <div className="flex items-center gap-1 ml-0.5">
                <button 
                  type="button"
                  onClick={() => scrollTo(0)} 
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${activeSlide === 0 ? 'w-3.5 bg-[var(--fg)]' : 'w-1.5 bg-[var(--border-strong)] hover:bg-[var(--muted)]'}`} 
                  aria-label={t('dashboard.sisaKeuangan', 'Sisa Keuangan')} 
                />
                <button 
                  type="button"
                  onClick={() => scrollTo(1)} 
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${activeSlide === 1 ? 'w-3.5 bg-[var(--fg)]' : 'w-1.5 bg-[var(--border-strong)] hover:bg-[var(--muted)]'}`} 
                  aria-label={t('dashboard.totalSaldo', 'Total Saldo')} 
                />
              </div>
            </div>
            <span className="rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              {t('dashboard.thisMonth', 'Bulan Ini')}
            </span>
          </div>

          {/* Main amount */}
          <p className="relative z-10 ft-hero-number mt-2 break-words">
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
                <p className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--earthy-green)' }}>
                  {t('dashboard.income', 'Pemasukan')}
                </p>
                <p className="mt-0.5 text-[13px] font-black tabular-nums truncate" style={{ color: 'var(--earthy-green)' }}>
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
                <p className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--earthy-terra)' }}>
                  {t('dashboard.expense', 'Pengeluaran')}
                </p>
                <p className="mt-0.5 text-[13px] font-black tabular-nums truncate" style={{ color: 'var(--earthy-terra)' }}>
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
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted-2)]">
                  {t('dashboard.totalBalance', 'Total Saldo')}
                </p>
                {/* Inline Slide Indicator */}
                <div className="flex items-center gap-1 ml-0.5">
                  <button 
                    type="button"
                    onClick={() => scrollTo(0)} 
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${activeSlide === 0 ? 'w-3.5 bg-[var(--fg)]' : 'w-1.5 bg-[var(--border-strong)] hover:bg-[var(--muted)]'}`} 
                    aria-label={t('dashboard.sisaKeuangan', 'Sisa Keuangan')} 
                  />
                  <button 
                    type="button"
                    onClick={() => scrollTo(1)} 
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${activeSlide === 1 ? 'w-3.5 bg-[var(--fg)]' : 'w-1.5 bg-[var(--border-strong)] hover:bg-[var(--muted)]'}`} 
                    aria-label={t('dashboard.totalSaldo', 'Total Saldo')} 
                  />
                </div>
              </div>
              <span className="rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                {t('dashboard.accountCount', '{{count}} Akun', { count: activeWallets.length })}
              </span>
            </div>

            {/* Main amount */}
            <p className="relative z-10 ft-hero-number mt-2 break-all">
              {formatCurrency(totalSaldo, defaultCurrency)}
            </p>
          </div>

          {/* Mini Wallet Cards Horizontal Scroll (Logo + Saldo Uang) */}
          <div className="relative z-10 mt-5 flex overflow-x-auto gap-2.5 pb-1 -mx-5 px-5 ft-hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
            {activeWallets.map((w) => {
              const isPrimary = defaultWalletId ? w.id === defaultWalletId : (activeWallets.length === 1 && w.id === activeWallets[0].id)
              return (
                <button 
                  key={w.id}
                  onClick={() => navigate(`/wallet/${w.id}`)}
                  className="ft-wallet-mini"
                  title={`${w.name} - ${formatCurrency(w.currentBalance ?? w.balance ?? 0, w.currency || defaultCurrency)}`}
                >

                  {/* Logo (prominent) */}
                  <div className="ft-wallet-mini-logo rounded-full overflow-hidden">
                    {w.customIcon === 'dollar' || w.customIcon === 'cash' || w.name?.toLowerCase() === 'cash' || String(w.name || '').toLowerCase().includes('uang tunai') ? (
                      <div className="w-full h-full flex items-center justify-center text-amber-500">
                        <MoneyBagIcon size={18} strokeWidth={2.5} />
                      </div>
                    ) : getWalletLogoUrl(w) ? (
                      <img 
                        src={getWalletLogoUrl(w)} 
                        alt={w.name} 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          e.target.style.display = 'none'
                          if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    <span 
                      className="text-[11px] font-bold text-[var(--fg)]"
                      style={{ display: w.customIcon === 'dollar' || w.customIcon === 'cash' || w.name?.toLowerCase() === 'cash' || String(w.name || '').toLowerCase().includes('uang tunai') || getWalletLogoUrl(w) ? 'none' : 'flex' }}
                    >
                      {w.name?.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  {/* Name + Saldo Uang */}
                  <div className="min-w-0 flex flex-col text-left gap-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10.5px] font-bold tracking-tight text-[var(--muted)] truncate max-w-[85px] leading-tight">
                        {w.name}
                      </span>
                      {isPrimary && (
                        <Star size={10} className="fill-amber-500 text-amber-500 shrink-0 inline-block self-center" />
                      )}
                    </div>
                    <span className="ft-wallet-mini-balance">
                      {formatCurrency(w.currentBalance ?? w.balance ?? 0, w.currency || defaultCurrency)}
                    </span>
                  </div>
                </button>
              )
            })}
            
            {/* Tambah Akun Card */}
            <button 
              onClick={() => navigate('/add-account')}
              className="ft-wallet-mini"
              style={{ borderStyle: 'dashed' }}
            >
              <div className="ft-wallet-mini-logo" style={{ background: 'var(--fg)', color: 'var(--bg)', border: 'none' }}>
                <Plus size={16} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex flex-col text-left gap-0.5">
                <span className="text-[10px] font-bold tracking-tight text-[var(--muted)] leading-tight">
                  {t('wallet.newAccount', 'Akun Baru')}
                </span>
                <span className="ft-wallet-mini-balance" style={{ color: 'var(--muted)', fontSize: '12px' }}>
                  {t('common.add', 'Tambah')}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
