function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--fg)]">
      <div className="flex flex-col items-center gap-4">
        {/* Pulsing logo circle */}
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-md"
          style={{
            animation: 'ft-glow-pulse 2s ease-in-out infinite',
          }}
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
          </svg>
        </div>
        {/* Animated text */}
        <div className="flex items-center gap-1.5">
          <span className="ft-display text-sm font-semibold tracking-tight text-[var(--fg)]">FinTrack</span>
          <span className="flex gap-0.5">
            <span className="h-1 w-1 rounded-full bg-[var(--accent)]" style={{ animation: 'ft-float 1.2s ease-in-out infinite', animationDelay: '0ms' }} />
            <span className="h-1 w-1 rounded-full bg-[var(--accent)]" style={{ animation: 'ft-float 1.2s ease-in-out infinite', animationDelay: '200ms' }} />
            <span className="h-1 w-1 rounded-full bg-[var(--accent)]" style={{ animation: 'ft-float 1.2s ease-in-out infinite', animationDelay: '400ms' }} />
          </span>
        </div>
      </div>
    </div>
  )
}

export default LoadingScreen
