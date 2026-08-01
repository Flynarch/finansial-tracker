import { useId, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import QuickAddTransactionModal from '../transactions/QuickAddTransactionModal'
import useTranslation from '../../hooks/useTranslation'
import { navItems } from './navItems'

function linkClassName({ isActive }) {
  return `ft-interactive-card flex min-w-0 flex-col items-center justify-center rounded-[var(--radius-sm)] px-2 py-2 text-[11px] leading-tight ${
    isActive
      ? 'text-[var(--nav-item-active)]'
      : 'text-[var(--nav-item-inactive)] hover:text-[var(--nav-item-hover)]'
  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.99]`
}

function NavIcon({ name, isActive }) {
  const common = `h-5 w-5 ${isActive ? 'text-[var(--nav-item-active)]' : 'text-[var(--nav-item-inactive)]'}`
  const sw = isActive ? '2.5' : '1.8'

  switch (name) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M3 10.5 12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.5 10.5V21h13V10.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'list':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M8 6h13" strokeLinecap="round" />
          <path d="M8 12h13" strokeLinecap="round" />
          <path d="M8 18h13" strokeLinecap="round" />
          <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" strokeLinecap="round" />
        </svg>
      )
    case 'chart':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M4 19V5" strokeLinecap="round" />
          <path d="M4 19h16" strokeLinecap="round" />
          <path d="M7 16l4-5 3 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'todo':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M5 5h14v14H5z" strokeLinejoin="round" />
          <path d="M9 9h6M9 12.5h6M9 16h4" strokeLinecap="round" />
        </svg>
      )
    case 'wallet':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" strokeLinejoin="round" />
          <path d="M16 12h4v3h-4a1.5 1.5 0 0 1 0-3z" strokeLinejoin="round" />
        </svg>
      )
    case 'calendar':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M7 3v3M17 3v3" strokeLinecap="round" />
          <path d="M4 7h16" strokeLinecap="round" />
          <path d="M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" strokeLinejoin="round" />
        </svg>
      )
    case 'report':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M7 3h7l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" strokeLinejoin="round" />
          <path d="M14 3v4h4" strokeLinejoin="round" />
          <path d="M8 12h8M8 16h8" strokeLinecap="round" />
        </svg>
      )
    case 'gear':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={sw}>
          <path
            d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"
            strokeLinejoin="round"
          />
          <path
            d="M19.4 15a7.9 7.9 0 0 0 .1-1l2-1.2-2-3.4-2.3.5a7.6 7.6 0 0 0-1.7-1L15 6l-4 0-.5 2.9a7.6 7.6 0 0 0-1.7 1L6.5 9.4l-2 3.4 2 1.2a7.9 7.9 0 0 0 .1 1l-2 1.2 2 3.4 2.3-.5a7.6 7.6 0 0 0 1.7 1L11 22h4l.5-2.9a7.6 7.6 0 0 0 1.7-1l2.3.5 2-3.4-2-1.2z"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'user':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" strokeLinejoin="round" />
          <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
        </svg>
      )
    default:
      return (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--field-bg)] text-[10px] font-semibold tracking-wide text-[var(--muted)]">
          {name?.slice(0, 2)?.toUpperCase?.() || '?'}
        </span>
      )
  }
}

function BottomNav() {
  const { t } = useTranslation()
  const navBarUid = useId().replace(/:/g, '')
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false)
  const [addTxNonce, setAddTxNonce] = useState(0)

  const primaryPaths = useMemo(() => ['/dashboard', '/transactions', '/todos', '/profile'], [])
  const primaryItems = useMemo(
    () => navItems.filter((item) => primaryPaths.includes(item.path)),
    [primaryPaths],
  )
  const leftItems = primaryItems.slice(0, 2)
  const rightItems = primaryItems.slice(2, 4)

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 md:hidden">
        {/*
          Kartu nav: lebar penuh, tinggi = lebar×72/400 → skala SVG seragam.
          Notch pakai kurva bezier bertahap (lebih halus di bahu kiri/kanan, tidak tajam saat masuk-keluar lengkungan).
        */}
        <div className="relative isolate mx-auto w-full max-w-[393px] overflow-visible pt-9">
          <div className="relative w-full [aspect-ratio:400/72]">
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              viewBox="0 0 400 72"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden
            >
              <defs>
                <filter id={`${navBarUid}-lift`} x="-8%" y="-25%" width="116%" height="130%">
                  <feDropShadow dx="0" dy="-2" stdDeviation="3.5" floodColor="#000000" floodOpacity="0.18" />
                  <feDropShadow dx="0" dy="3" stdDeviation="4.5" floodColor="#000000" floodOpacity="0.14" />
                </filter>
              </defs>
              <path
                filter={`url(#${navBarUid}-lift)`}
                fill="var(--nav-shell-fill)"
                fillOpacity="1"
                stroke="var(--nav-shell-stroke)"
                strokeWidth="1"
                strokeLinejoin="round"
                d="M21,0
                   L138,0
                   C150,0 160,7 166,18
                   A44,44 0 0 0 234,18
                   C240,7 250,0 262,0
                   L379,0
                   C391.5,0 400,8.5 400,21
                   L400,51
                   C400,63.5 391.5,72 379,72
                   L21,72
                   C8.5,72 0,63.5 0,51
                   L0,21
                   C0,8.5 8.5,0 21,0 Z"
              />
            </svg>

            <div className="relative z-10 grid h-full grid-cols-5 items-end gap-1 px-1.5 pb-1.5 pt-1">
              {leftItems.map((item) => (
                <NavLink key={item.path} to={item.path} className={linkClassName}>
                  {({ isActive }) => (
                    <>
                      <NavIcon name={item.icon} isActive={isActive} />
                      <span
                        className={`mt-0.5 truncate text-[10px] font-semibold ${
                          isActive ? 'text-[var(--nav-item-active)]' : 'text-[var(--nav-item-inactive)]'
                        }`}
                      >
                        {t(item.labelKey)}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}

              <div aria-hidden="true" />

              {rightItems.map((item) => (
                <NavLink key={item.path} to={item.path} className={linkClassName}>
                  {({ isActive }) => (
                    <>
                      <NavIcon name={item.icon} isActive={isActive} />
                      <span
                        className={`mt-0.5 truncate text-[10px] font-semibold ${
                          isActive ? 'text-[var(--nav-item-active)]' : 'text-[var(--nav-item-inactive)]'
                        }`}
                      >
                        {t(item.labelKey)}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>

            <button
              data-tour="quick-add-btn"
              type="button"
              className="absolute left-1/2 top-0 z-40 h-[3.625rem] w-[3.625rem] -translate-x-1/2 -translate-y-[51%] rounded-full bg-[var(--nav-fab-bg)] text-[var(--nav-fab-fg)] ring-1 ring-[var(--nav-fab-ring)] transition-all duration-200 hover:-translate-y-[53%] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              style={{
                boxShadow: 'var(--shadow-fab)',
                animation: 'ft-glow-pulse 3s ease-in-out infinite',
              }}
              onClick={() => {
                setAddTxNonce((v) => v + 1)
                setIsAddTransactionOpen(true)
              }}
              aria-label={t('addTx.title')}
            >
              <svg viewBox="0 0 24 24" className="mx-auto h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 5v14" strokeLinecap="round" />
                <path d="M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <QuickAddTransactionModal nonce={addTxNonce} isOpen={isAddTransactionOpen} onClose={() => setIsAddTransactionOpen(false)} />
    </>
  )
}

export default BottomNav
