import { useState, useRef, useEffect } from 'react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'

function Navbar() {
  const { t, locale } = useTranslation()
  const profileName = useSettingsStore((state) => state.profileName)
  const [showNotifications, setShowNotifications] = useState(false)
  const dropdownRef = useRef(null)

  const todayLabel = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'id-ID', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
    return undefined
  }, [showNotifications])

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--panel-strong)] px-4 py-2.5 shadow-2xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        {/* Brand & User Greeting */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--fg)] text-xs font-black tracking-wider text-[var(--bg)] shadow-sm">
            FT
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">FinTrack</span>
              {profileName ? (
                <>
                  <span className="text-[10px] text-[var(--border-strong)]">•</span>
                  <span className="truncate text-[11px] font-semibold text-[var(--accent)]">{profileName}</span>
                </>
              ) : null}
            </div>
            <p className="truncate text-sm font-bold tracking-tight text-[var(--fg)] sm:text-base">
              {profileName ? `Hai, ${profileName}` : 'Keuangan Pribadi'}
            </p>
          </div>
        </div>

        {/* Date & Notification Action */}
        <div className="flex shrink-0 items-center gap-2.5" ref={dropdownRef}>
          <span className="hidden rounded-lg border border-[var(--border)]/60 bg-[var(--field-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)] sm:inline-block">
            {todayLabel}
          </span>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications((prev) => !prev)}
              aria-label={t('navbar.notifications') || 'Notifikasi'}
              aria-expanded={showNotifications}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
                showNotifications
                  ? 'border-[var(--fg)] bg-[var(--panel)] text-[var(--fg)] shadow-sm'
                  : 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--panel)] hover:shadow-[var(--accent-glow)]'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6.5 16.5V11a5.5 5.5 0 1 1 11 0v5.5l1.5 1.5H5z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
              </svg>
            </button>

            {/* Notification Empty State Popover */}
            {showNotifications ? (
              <div className="ft-motion-panel absolute right-0 top-11 z-50 w-72 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-xl sm:w-80">
                <div className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--fg)]">
                    {t('navbar.notifications') || 'Notifikasi'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    className="text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--fg)]"
                  >
                    Tutup
                  </button>
                </div>

                <div className="py-6 text-center">
                  <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--field-bg)] text-[var(--muted)] border border-[var(--border)]/40">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M6.5 16.5V11a5.5 5.5 0 1 1 11 0v5.5l1.5 1.5H5z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-xs font-bold text-[var(--fg)]">Belum Ada Notifikasi Baru</p>
                  <p className="mt-1 px-2 text-[11px] leading-relaxed text-[var(--muted)]">
                    Semua aktivitas, pengingat jadwal, dan pembaruan anggaran akan ditampilkan di sini.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Navbar
