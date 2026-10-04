import { useId, useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import useTransactionStore from '../../store/useTransactionStore'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { navItems } from './navItems'
import { triggerHaptic } from '../../lib/haptics'

function linkClassName({ isActive }) {
  return `relative z-1 flex h-full min-h-[44px] min-w-0 flex-col items-center justify-center rounded-2xl px-2 py-1 text-[11px] leading-tight transition-colors duration-200 ${
    isActive
      ? 'text-[var(--nav-item-active)] font-black'
      : 'text-[var(--nav-item-inactive)] hover:text-[var(--nav-item-hover)] font-medium'
  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.98]`
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
    case 'handcoins':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.7-2.9l-3.7 2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="18" cy="5" r="3" strokeLinecap="round" strokeLinejoin="round" />
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
  const openQuickAdd = useTransactionStore((state) => state.openQuickAdd)

  const primaryPaths = useMemo(() => ['/dashboard', '/transactions', '/todos', '/profile'], [])
  const primaryItems = useMemo(
    () => navItems.filter((item) => primaryPaths.includes(item.path)),
    [primaryPaths],
  )
  const leftItems = primaryItems.slice(0, 2)
  const rightItems = primaryItems.slice(2, 4)

  const location = useLocation()
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)

  const activeColIndex = useMemo(() => {
    const p = location.pathname
    if (p === '/dashboard' || p.startsWith('/dashboard/')) return 0
    if (p === '/transactions' || p.startsWith('/transactions/')) return 1
    if (p === '/todos' || p.startsWith('/todos/')) return 3
    if (p === '/profile' || p.startsWith('/profile/')) return 4
    return -1
  }, [location.pathname])

  const unviewedMutationsCount = useSettingsStore((state) => state.unviewedMutationsCount || 0)

  return (
    <>
      <nav data-tour="bottom-nav" className="fixed inset-x-0 bottom-0 z-30 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 md:hidden">
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
              {/* Fluid Sliding Active Pill */}
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute top-1 bottom-1.5 left-1.5 rounded-2xl bg-[var(--panel-strong)] shadow-2xs border border-[var(--border)]/40 ${
                  reduceMotion
                    ? 'transition-opacity duration-150'
                    : 'transition-all duration-280 ease-[cubic-bezier(0.16,1,0.3,1)]'
                }`}
                style={{
                  width: 'calc((100% - 28px) / 5)',
                  opacity: activeColIndex >= 0 ? 1 : 0,
                  transform:
                    activeColIndex >= 0
                      ? `translate3d(calc(${activeColIndex} * (100% + 4px)), 0, 0)`
                      : undefined,
                }}
              />
              {leftItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={linkClassName}
                  onClick={() => triggerHaptic('light')}
                >
                  {({ isActive }) => (
                    <>
                      <div className="relative">
                        <NavIcon name={item.icon} isActive={isActive} />
                        {item.path === '/transactions' && unviewedMutationsCount > 0 && (
                          <span className="absolute -top-1 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-black text-white shadow-xs">
                            {unviewedMutationsCount > 9 ? '9+' : unviewedMutationsCount}
                          </span>
                        )}
                      </div>
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
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={linkClassName}
                  onClick={() => triggerHaptic('light')}
                >
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
              className="absolute left-1/2 top-0 z-40 h-[3.625rem] w-[3.625rem] -translate-x-1/2 -translate-y-[51%] rounded-full bg-[var(--nav-fab-bg)] text-[var(--nav-fab-fg)] ring-1 ring-[var(--nav-fab-ring)] transition-[translate,scale,opacity] duration-200 hover:-translate-y-[53%] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              style={{
                boxShadow: 'var(--shadow-fab)',
              }}
              onClick={() => {
                triggerHaptic('medium')
                openQuickAdd()
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
    </>
  )
}

export default BottomNav
