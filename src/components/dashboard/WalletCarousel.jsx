import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatCurrency, convertCurrency, FALLBACK_EXCHANGE_RATES } from '../../lib/utils'
import { ArrowDownLeft, ArrowUpRight, Plus, Star, Eye, EyeOff } from 'lucide-react'
import MoneyBagIcon from '../ui/MoneyBagIcon'
import { getWalletLogoUrl } from '../../data/walletInstitutions'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import AnimatedCounter from '../ui/AnimatedCounter'
import MaskedBalance from '../ui/MaskedBalance'
import AnimatedWalletBalance from './AnimatedWalletBalance'
import { triggerHaptic } from '../../lib/haptics'

const STORAGE_KEY = 'dashboard_carousel_slide'

const getSavedSlide = () => {
  try {
    const val = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY)
    const parsed = parseInt(val, 10)
    return parsed === 1 ? 1 : 0
  } catch {
    return 0
  }
}

const saveSlide = (index) => {
  try {
    localStorage.setItem(STORAGE_KEY, index.toString())
    sessionStorage.setItem(STORAGE_KEY, index.toString())
  } catch {
    // Ignore storage quota/permission errors in restricted environments
  }
}

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
  const hideBalance = useSettingsStore((state) => state.hideBalance)
  const toggleHideBalance = useSettingsStore((state) => state.toggleHideBalance)
  const [activeSlide, setActiveSlide] = useState(getSavedSlide)
  const activeSlideRef = useRef(activeSlide)
  const scrollRef = useRef(null)
  const hasRestoredScroll = useRef(false)

  useEffect(() => {
    activeSlideRef.current = activeSlide
  }, [activeSlide])

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
      activeSlideRef.current = index
      setActiveSlide(index)
      saveSlide(index)
      if (typeof scrollRef.current.scrollTo === 'function') {
        scrollRef.current.scrollTo({
          left: slides[index].offsetLeft,
          behavior: 'smooth'
        })
      } else {
        scrollRef.current.scrollLeft = slides[index].offsetLeft
      }
    }
  }

  // Restore scroll position when carousel element mounts and wallets load
  useEffect(() => {
    if (!scrollRef.current || hasRestoredScroll.current) return
    hasRestoredScroll.current = true

    if (activeSlide > 0) {
      const slides = scrollRef.current.children
      if (slides[activeSlide]) {
        if (typeof scrollRef.current.scrollTo === 'function') {
          scrollRef.current.scrollTo({
            left: slides[activeSlide].offsetLeft,
            behavior: 'instant'
          })
        } else {
          scrollRef.current.scrollLeft = slides[activeSlide].offsetLeft
        }
      }
    }
  }, [wallets, activeSlide])

  const handleScroll = () => {
    if (!scrollRef.current || !hasRestoredScroll.current) return
    const container = scrollRef.current
    const scrollLeft = container.scrollLeft
    const slides = container.children
    if (!slides || slides.length === 0) return

    let closestIndex = 0
    let minDistance = Infinity

    for (let i = 0; i < slides.length; i++) {
      const dist = Math.abs(slides[i].offsetLeft - scrollLeft)
      if (dist < minDistance) {
        minDistance = dist
        closestIndex = i
      }
    }

    if (closestIndex !== activeSlideRef.current) {
      activeSlideRef.current = closestIndex
      setActiveSlide(closestIndex)
      saveSlide(closestIndex)
      triggerHaptic('selection')
    }
  }

  // Listen for scrollend to ensure exact indicator sync on touch flick / CSS snap completion
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof el.addEventListener !== 'function') return
    const onScrollEnd = () => handleScroll()
    el.addEventListener('scrollend', onScrollEnd, { passive: true })
    return () => {
      el.removeEventListener('scrollend', onScrollEnd)
    }
  }, [wallets])

  // Handle window resize or orientation changes
  useEffect(() => {
    const handleResize = () => {
      if (!scrollRef.current) return
      const current = activeSlideRef.current
      if (current > 0) {
        const slides = scrollRef.current.children
        if (slides[current]) {
          if (typeof scrollRef.current.scrollTo === 'function') {
            scrollRef.current.scrollTo({
              left: slides[current].offsetLeft,
              behavior: 'instant'
            })
          } else {
            scrollRef.current.scrollLeft = slides[current].offsetLeft
          }
        }
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
            <div className="h-8 w-48 rounded-lg bg-[var(--border)]/80" />
            <div className="h-3 w-20 rounded bg-[var(--border)]/50" />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="h-10 rounded-xl bg-[var(--field-bg)]/60" />
            <div className="h-10 rounded-xl bg-[var(--field-bg)]/60" />
          </div>
        </div>
      </section>
    )
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
        <div className="w-full shrink-0 snap-center ft-hero-card ft-card-sheen">
          {/* Header row */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted-2)]">
                {t('dashboard.sisaKeuangan', 'Sisa Keuangan')}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleHideBalance()
                }}
                className="grid h-7 w-7 min-h-[44px] min-w-[44px] -m-2 place-items-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors active:scale-90 cursor-pointer"
                title={hideBalance ? t('dashboard.showBalance', 'Tampilkan Saldo') : t('dashboard.hideBalance', 'Sembunyikan Saldo')}
                aria-label={hideBalance ? t('dashboard.showBalance', 'Tampilkan Saldo') : t('dashboard.hideBalance', 'Sembunyikan Saldo')}
              >
                {hideBalance ? <EyeOff size={13} strokeWidth={2.3} /> : <Eye size={13} strokeWidth={2.3} />}
              </button>
              {/* Inline Slide Indicator */}
              <div className="flex items-center gap-1.5 ml-1 py-1">
                <button 
                  type="button"
                  onClick={() => scrollTo(0)} 
                  className="p-2 -m-2 min-h-[36px] min-w-[28px] flex items-center justify-center cursor-pointer"
                  aria-label={t('dashboard.sisaKeuangan', 'Sisa Keuangan')}
                >
                  <span className={`h-1.5 rounded-full transition-all duration-300 block ${activeSlide === 0 ? 'w-3.5 bg-[var(--fg)]' : 'w-1.5 bg-[var(--border-strong)] hover:bg-[var(--muted)]'}`} />
                </button>
                <button 
                  type="button"
                  onClick={() => scrollTo(1)} 
                  className="p-2 -m-2 min-h-[36px] min-w-[28px] flex items-center justify-center cursor-pointer"
                  aria-label={t('dashboard.totalSaldo', 'Total Saldo')}
                >
                  <span className={`h-1.5 rounded-full transition-all duration-300 block ${activeSlide === 1 ? 'w-3.5 bg-[var(--fg)]' : 'w-1.5 bg-[var(--border-strong)] hover:bg-[var(--muted)]'}`} />
                </button>
              </div>
            </div>
            <span className="rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
              {t('dashboard.thisMonth', 'Bulan Ini')}
            </span>
          </div>

          {/* Main amount */}
          <div className="relative z-10 ft-hero-number mt-2 break-words flex items-center min-h-[2.5rem]">
            {hideBalance ? (
              <div className="animate-[ft-fade-in_0.25s_ease-out]">
                <MaskedBalance size="hero" />
              </div>
            ) : (
              <div className="animate-[ft-fade-in_0.25s_ease-out]">
                <AnimatedCounter value={sisaKeuangan} currency={defaultCurrency} />
              </div>
            )}
          </div>

          {/* Income / Expense stat pills */}
          <div className="relative z-10 mt-5 flex gap-2">
            {/* Income pill */}
            <div className="ft-stat-pill ft-stat-pill--income ft-spring-press">
              <div className="ft-stat-pill-icon">
                <ArrowDownLeft size={16} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--status-income)]">
                  {t('dashboard.income', 'Pemasukan')}
                </p>
                <div className="mt-0.5 text-[13px] font-black tabular-nums truncate flex items-center min-h-[1.2rem] text-[var(--status-income)]">
                  {hideBalance ? (
                    <div className="animate-[ft-fade-in_0.25s_ease-out]">
                      <MaskedBalance size="md" />
                    </div>
                  ) : (
                    <div className="animate-[ft-fade-in_0.25s_ease-out]">
                      <AnimatedCounter value={monthIncome} currency={defaultCurrency} />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Expense pill */}
            <div className="ft-stat-pill ft-stat-pill--expense ft-spring-press">
              <div className="ft-stat-pill-icon">
                <ArrowUpRight size={16} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--status-expense)]">
                  {t('dashboard.expense', 'Pengeluaran')}
                </p>
                <div className="mt-0.5 text-[13px] font-black tabular-nums truncate flex items-center min-h-[1.2rem] text-[var(--status-expense)]">
                  {hideBalance ? (
                    <div className="animate-[ft-fade-in_0.25s_ease-out]">
                      <MaskedBalance size="md" />
                    </div>
                  ) : (
                    <div className="animate-[ft-fade-in_0.25s_ease-out]">
                      <AnimatedCounter value={monthExpense} currency={defaultCurrency} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SLIDE 2: Total Saldo & Horizontal Mini Wallet Cards */}
        <div className="w-full shrink-0 snap-center ft-hero-card ft-card-sheen ml-4 flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted-2)]">
                  {t('dashboard.totalBalance', 'Total Saldo')}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleHideBalance()
                  }}
                  className="grid h-7 w-7 min-h-[44px] min-w-[44px] -m-2 place-items-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors active:scale-90 cursor-pointer"
                  title={hideBalance ? t('dashboard.showBalance', 'Tampilkan Saldo') : t('dashboard.hideBalance', 'Sembunyikan Saldo')}
                  aria-label={hideBalance ? t('dashboard.showBalance', 'Tampilkan Saldo') : t('dashboard.hideBalance', 'Sembunyikan Saldo')}
                >
                  {hideBalance ? <EyeOff size={13} strokeWidth={2.3} /> : <Eye size={13} strokeWidth={2.3} />}
                </button>
                {/* Inline Slide Indicator */}
                <div className="flex items-center gap-1.5 ml-1 py-1">
                  <button 
                    type="button"
                    onClick={() => scrollTo(0)} 
                    className="p-2 -m-2 min-h-[36px] min-w-[28px] flex items-center justify-center cursor-pointer"
                    aria-label={t('dashboard.sisaKeuangan', 'Sisa Keuangan')}
                  >
                    <span className={`h-1.5 rounded-full transition-all duration-300 block ${activeSlide === 0 ? 'w-3.5 bg-[var(--fg)]' : 'w-1.5 bg-[var(--border-strong)] hover:bg-[var(--muted)]'}`} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => scrollTo(1)} 
                    className="p-2 -m-2 min-h-[36px] min-w-[28px] flex items-center justify-center cursor-pointer"
                    aria-label={t('dashboard.totalSaldo', 'Total Saldo')}
                  >
                    <span className={`h-1.5 rounded-full transition-all duration-300 block ${activeSlide === 1 ? 'w-3.5 bg-[var(--fg)]' : 'w-1.5 bg-[var(--border-strong)] hover:bg-[var(--muted)]'}`} />
                  </button>
                </div>
              </div>
              <span className="rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                {t('dashboard.accountCount', '{{count}} Akun', { count: activeWallets.length })}
              </span>
            </div>

            {/* Main amount */}
            <div className="relative z-10 ft-hero-number mt-2 break-all flex items-center min-h-[2.5rem]">
              {hideBalance ? (
                <div className="animate-[ft-fade-in_0.25s_ease-out]">
                  <MaskedBalance size="hero" />
                </div>
              ) : (
                <div className="animate-[ft-fade-in_0.25s_ease-out]">
                  <AnimatedCounter value={totalSaldo} currency={defaultCurrency} />
                </div>
              )}
            </div>
          </div>

          {/* Mini Wallet Cards Horizontal Scroll (Logo + Saldo Uang) */}
          <div className="relative z-10 mt-5 flex overflow-x-auto gap-2.5 pb-1 -mx-5 px-5 ft-hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
            {activeWallets.map((w) => {
              const isPrimary = defaultWalletId ? w.id === defaultWalletId : (activeWallets.length === 1 && w.id === activeWallets[0].id)
              return (
                <button 
                  key={w.id}
                  onClick={() => navigate(`/wallet/${w.id}`)}
                  className="ft-wallet-mini ft-spring-press"
                  style={w.color ? {
                    boxShadow: `0 2px 14px -3px ${w.color}24, inset 0 0 0 1px ${w.color}30`,
                  } : undefined}
                  title={`${w.name} - ${hideBalance ? '••••••' : formatCurrency(w.currentBalance ?? w.balance ?? 0, w.currency || defaultCurrency)}`}
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
                    <span className="ft-wallet-mini-balance flex items-center">
                      <AnimatedWalletBalance
                        balance={w.currentBalance ?? w.balance ?? 0}
                        currency={w.currency || defaultCurrency}
                        hideBalance={hideBalance}
                      />
                    </span>
                  </div>
                </button>
              )
            })}
            
            {/* Tambah Akun Card */}
            <button 
              onClick={() => navigate('/add-account')}
              className="ft-wallet-mini ft-spring-press"
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
