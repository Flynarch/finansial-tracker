import useTranslation from '../../hooks/useTranslation'

function LoadingScreen() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--bg)] text-[var(--fg)] relative overflow-hidden">
      <div className="flex flex-col items-center gap-8 relative z-10">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[var(--fg)] shadow-[0_16px_40px_rgba(0,0,0,0.3)] ring-1 ring-white/5">
          <span className="text-3xl font-black tracking-[0.15em] text-[var(--bg)] ml-2">FT</span>
          
          {/* Smooth spinning rings */}
          <div className="absolute -inset-[3px] rounded-full border border-transparent border-t-[var(--accent)] opacity-100 animate-[spin_1.2s_cubic-bezier(0.5,0,0.5,1)_infinite]" />
          <div className="absolute -inset-[3px] rounded-full border border-transparent border-b-[var(--accent)] opacity-50 animate-[spin_2s_cubic-bezier(0.5,0,0.5,1)_infinite]" />
        </div>
        
        <div className="flex flex-col items-center gap-2.5">
          <h1 className="text-[13px] font-bold tracking-[0.3em] uppercase text-[var(--fg)] ml-1">FinTrack</h1>
          <span className="text-[9px] font-bold tracking-widest text-[var(--muted)] uppercase animate-pulse">
            {t('common.loadingData', 'Memuat Data...')}
          </span>
        </div>
      </div>
    </div>
  )
}

export default LoadingScreen
