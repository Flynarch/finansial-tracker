import { ChevronLeft } from 'lucide-react'

export default function PageHeader({
  title,
  subtitle,
  onBack,
  rightAction,
  titlePosition = 'center', // 'center' | 'left'
  titleUppercase = false,
  className = '',
  backAriaLabel = 'Kembali',
}) {
  if (titlePosition === 'left') {
    return (
      <header className={`flex items-start gap-3 mb-4 ${className}`}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs transition hover:bg-[var(--field-bg)] active:scale-95 mt-0.5"
            aria-label={backAriaLabel}
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          {title ? (
            <h1 className={`ft-page-title ${titleUppercase ? 'uppercase' : ''}`}>
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{subtitle}</p>
          ) : null}
        </div>
        {rightAction ? <div className="shrink-0">{rightAction}</div> : null}
      </header>
    )
  }

  return (
    <header className={`relative z-10 flex items-center justify-between min-h-[36px] ${className}`}>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="relative z-10 flex items-center justify-center w-9 h-9 -ml-1 rounded-full text-[var(--fg)] hover:bg-[var(--fg)]/10 transition active:scale-95 shrink-0"
          aria-label={backAriaLabel}
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
      ) : <div className="w-9" />}

      {title ? (
        <h1 className={`absolute left-1/2 -translate-x-1/2 max-w-[60%] truncate text-center text-[17px] sm:text-lg font-extrabold tracking-tight text-[var(--fg)] pointer-events-none ${titleUppercase ? 'uppercase' : ''}`} style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h1>
      ) : null}

      <div className="relative z-10 flex items-center gap-1">
        {rightAction || <div className="w-9" />}
      </div>
    </header>
  )
}
